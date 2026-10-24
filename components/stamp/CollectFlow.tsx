"use client";

import { useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { Place, PlaceCategory, Stamp } from "@/lib/db/types";
import { haversineMeters, isWithinGeofence } from "@/lib/geo";
import { preparePhoto } from "@/lib/photo";
import { StampCardReveal } from "./StampCardReveal";

const GEOFENCE_M = 75;
const MAX_ACCURACY_M = 50;

/** Categories a user can assign to a new place (mirrors PlaceCategory). */
const NEW_PLACE_CATEGORIES: { value: PlaceCategory; label: string }[] = [
  { value: "mural", label: "Mural" },
  { value: "statue", label: "Statue" },
  { value: "cafe", label: "Café" },
  { value: "door", label: "Door" },
  { value: "park", label: "Park" },
  { value: "building", label: "Building" },
  { value: "transit", label: "Transit" },
  { value: "water", label: "Water" },
  { value: "nature", label: "Nature" },
  { value: "shop", label: "Shop" },
  { value: "oddity", label: "Oddity" },
  { value: "other", label: "Other" },
];

type Phase = "idle" | "preparing" | "uploading" | "revealed" | "error";

interface CollectFlowProps {
  /** The place being collected. `null` means a new, unseeded spot here. */
  place: Place | null;
  /** Current user position, if known. */
  userPos: { lat: number; lng: number } | null;
  /** GPS accuracy in meters for the latest fix, if known. */
  accuracyM: number | null;
  /** Demo mode enables the "teleport to place" collect option (REQ-1.3). */
  demoMode: boolean;
  /** Called after a successful collect so the map/Dex can refresh. */
  onCollected?: (result: { stamp: Stamp; place: Place }) => void;
}

/** Human-friendly distance for the out-of-range hint (QA #3). */
function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

/**
 * Collect flow (REQ-3.1, 3.2, 4.3–4.6, 5.1): optional new-place name/category →
 * required "No people" confirmation → camera capture → client resize + EXIF
 * strip → POST /api/stamps → card reveal. There is no AI; the card is built
 * server-side from the place + the photo, which is shown exactly as uploaded.
 *
 * Gates on the ~75 m geofence and GPS accuracy (> 50 m warns). In demo mode a
 * "teleport" option bypasses the physical gates so the full flow works without
 * being on-site; it is labeled DEMO.
 */
export function CollectFlow({
  place,
  userPos,
  accuracyM,
  demoMode,
  onCollected,
}: CollectFlowProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [stamp, setStamp] = useState<Stamp | null>(null);
  const [collectedPlace, setCollectedPlace] = useState<Place | null>(null);
  const [teleport, setTeleport] = useState(false);
  const [noPeople, setNoPeople] = useState(false);

  // New-place fields (only used when `place` is null).
  const isNewPlace = place == null;
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<PlaceCategory>("other");

  // Distance + range. For a new place the target is the user's own position,
  // so range is trivially satisfied once we have a fix.
  const target = place ? { lat: place.lat, lng: place.lng } : userPos;
  const distanceM =
    userPos && target ? haversineMeters(userPos, target) : null;
  const inRange =
    userPos != null &&
    target != null &&
    isWithinGeofence(userPos, target, GEOFENCE_M);
  const accuracyBad = accuracyM != null && accuracyM > MAX_ACCURACY_M;

  const nameOk = !isNewPlace || newName.trim().length > 0;

  // Collect is allowed when: the "no people" box is checked, the place details
  // are complete, and we're in range with usable accuracy OR via demo teleport.
  const physicallyOk = (inRange && !accuracyBad) || (demoMode && teleport);
  const canCollect = noPeople && nameOk && physicallyOk;

  // Why the button is disabled, surfaced for QA #3.
  const disabledReason = useMemo(() => {
    if (!noPeople) return "Confirm the photo below to collect.";
    if (isNewPlace && !nameOk) return "Name this place to collect.";
    if (physicallyOk) return null;
    if (distanceM != null)
      return `You’re ${formatDistance(distanceM)} away — get within ~75 m to collect.`;
    return "Waiting for your location — get within ~75 m to collect.";
  }, [noPeople, isNewPlace, nameOk, physicallyOk, distanceM]);

  function openCamera() {
    if (!canCollect) return;
    setMessage(null);
    fileRef.current?.click();
  }

  async function onPhotoChosen(e: ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    // Reset the input so re-picking the same file fires change again.
    input.value = "";
    if (!file) return;

    setPhase("preparing");
    setMessage(null);
    let previewUrlToRevoke: string | null = null;
    try {
      const prepared = await preparePhoto(file);
      previewUrlToRevoke = prepared.previewUrl;

      const form = new FormData();
      form.append("photo", prepared.file);
      // Use the place's coords when teleporting; otherwise the live position.
      const pos =
        place && demoMode && teleport
          ? { lat: place.lat, lng: place.lng }
          : userPos;
      form.append("lat", String(pos?.lat ?? place?.lat ?? 0));
      form.append("lng", String(pos?.lng ?? place?.lng ?? 0));
      if (accuracyM != null) form.append("accuracy", String(accuracyM));
      form.append("noPeople", "true");
      if (place) {
        form.append("placeId", place.id);
      } else {
        form.append("name", newName.trim());
        form.append("category", newCategory);
      }
      if (demoMode && teleport) form.append("teleport", "true");

      setPhase("uploading");
      const res = await fetch("/api/stamps", { method: "POST", body: form });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.accepted) {
        setPhase("error");
        setMessage(data?.error ?? "Collect failed. Please try again.");
        return;
      }

      setStamp(data.stamp as Stamp);
      setCollectedPlace(data.place as Place);
      setPhase("revealed");
      onCollected?.({ stamp: data.stamp as Stamp, place: data.place as Place });
    } catch {
      setPhase("error");
      setMessage("Couldn’t prepare the photo. Please try again.");
    } finally {
      if (previewUrlToRevoke) URL.revokeObjectURL(previewUrlToRevoke);
    }
  }

  const busy = phase === "preparing" || phase === "uploading";

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={onPhotoChosen}
      />

      {/* New-place details: name + category (REQ-4.4). */}
      {isNewPlace && (
        <div className="mb-3 space-y-2">
          <label className="block">
            <span className="font-label text-xs uppercase tracking-wide text-wood-dark">
              Name this place
            </span>
            <input
              type="text"
              value={newName}
              maxLength={80}
              onChange={(ev) => setNewName(ev.target.value)}
              placeholder="e.g. The Door That Judges You"
              className="mt-1 w-full border-4 border-wood-dark bg-parchment px-2 py-2 text-base text-wood-dark placeholder:text-wood-dark/50"
            />
          </label>
          <label className="block">
            <span className="font-label text-xs uppercase tracking-wide text-wood-dark">
              Category
            </span>
            <select
              value={newCategory}
              onChange={(ev) => setNewCategory(ev.target.value as PlaceCategory)}
              className="mt-1 w-full border-4 border-wood-dark bg-parchment px-2 py-2 text-base text-wood-dark"
            >
              {NEW_PLACE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* GPS accuracy warning (REQ-3.2). */}
      {accuracyBad && !teleport && (
        <p role="status" className="mb-2 text-sm text-berry">
          Location accuracy is low ({Math.round(accuracyM ?? 0)} m). Move to open
          sky for a cleaner fix.
        </p>
      )}

      {/* Demo teleport option (REQ-1.3). */}
      {demoMode && (
        <label className="mb-2 flex items-center gap-2 text-sm text-wood-dark">
          <input
            type="checkbox"
            checked={teleport}
            onChange={(ev) => setTeleport(ev.target.checked)}
            className="h-5 w-5 accent-activity"
          />
          <span>
            <span className="border-2 border-wood-dark bg-wood-light px-1 font-label text-[10px] uppercase text-wood-dark">
              Demo
            </span>{" "}
            Teleport to this place (collect without being there)
          </span>
        </label>
      )}

      {/* Required privacy guard (REQ-4.6). */}
      <label className="mb-3 flex items-start gap-2 text-sm text-wood-dark">
        <input
          type="checkbox"
          checked={noPeople}
          onChange={(ev) => setNoPeople(ev.target.checked)}
          className="mt-0.5 h-5 w-5 accent-activity"
          aria-describedby="no-people-help"
        />
        <span>
          No people are the main subject of this photo.
          <span id="no-people-help" className="mt-0.5 block text-xs text-wood-dark/70">
            Required. We don’t analyze your photo — this confirmation stands in
            for it, and the photo is shown exactly as you upload it.
          </span>
        </span>
      </label>

      <button
        type="button"
        onClick={openCamera}
        disabled={!canCollect || busy}
        aria-disabled={!canCollect || busy}
        className={
          canCollect && !busy
            ? "w-full border-4 border-wood-dark bg-activity px-4 py-3 font-heading text-lg text-parchment"
            : "w-full cursor-not-allowed border-4 border-wood-dark bg-wood-light px-4 py-3 font-heading text-lg text-wood-dark"
        }
      >
        {busy
          ? phase === "preparing"
            ? "Preparing photo…"
            : "Collecting…"
          : "Collect! Snap a photo"}
      </button>

      {/* Reason the button is unavailable (QA #3). */}
      {!canCollect && !busy && disabledReason && (
        <p role="status" className="mt-2 text-sm text-wood-dark">
          {disabledReason}
        </p>
      )}

      {message && (
        <p
          role="status"
          className={`mt-2 text-sm ${phase === "error" ? "text-berry" : "text-wood-dark"}`}
        >
          {message}
        </p>
      )}

      {phase === "revealed" && stamp && (
        <StampCardReveal
          stamp={stamp}
          place={
            collectedPlace
              ? { name: collectedPlace.name, neighborhood: collectedPlace.neighborhood }
              : place
                ? { name: place.name, neighborhood: place.neighborhood }
                : null
          }
          onClose={() => {
            setStamp(null);
            setCollectedPlace(null);
            setPhase("idle");
          }}
        />
      )}
    </div>
  );
}
