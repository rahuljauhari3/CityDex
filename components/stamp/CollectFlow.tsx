"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { Place, Stamp } from "@/lib/db/types";
import { isWithinGeofence } from "@/lib/geo";
import { preparePhoto } from "@/lib/photo";
import { StampCardReveal } from "./StampCardReveal";

const GEOFENCE_M = 75;
const MAX_ACCURACY_M = 50;

type Phase =
  | "idle"
  | "preparing"
  | "uploading"
  | "revealed"
  | "retake"
  | "error";

interface CollectFlowProps {
  place: Place;
  /** Current user position, if known. */
  userPos: { lat: number; lng: number } | null;
  /** GPS accuracy in meters for the latest fix, if known. */
  accuracyM: number | null;
  /** Demo mode enables the "teleport to place" collect option (REQ-1.3). */
  demoMode: boolean;
  /** Called after a successful collect so the map/Dex can refresh. */
  onCollected?: (result: { stamp: Stamp; place: Place }) => void;
}

/**
 * Collect flow (REQ-3.1, 3.2, 3.4): camera capture → client resize + EXIF strip
 * → POST /api/stamps → card reveal. Gates on the ~75 m geofence and GPS
 * accuracy (> 50 m warns). In demo mode a "teleport" option bypasses the
 * physical gates so the full flow works without being on-site; it is labeled
 * DEMO.
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
  const [teleport, setTeleport] = useState(false);

  const inRange =
    userPos != null &&
    isWithinGeofence(
      userPos,
      { lat: place.lat, lng: place.lng },
      GEOFENCE_M,
    );
  const accuracyBad = accuracyM != null && accuracyM > MAX_ACCURACY_M;

  // Collect is allowed when in range with usable accuracy, OR via demo teleport.
  const canCollect = (inRange && !accuracyBad) || (demoMode && teleport);

  function openCamera() {
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
      const pos = demoMode && teleport ? { lat: place.lat, lng: place.lng } : userPos;
      form.append("lat", String(pos?.lat ?? place.lat));
      form.append("lng", String(pos?.lng ?? place.lng));
      if (accuracyM != null) form.append("accuracy", String(accuracyM));
      form.append("placeId", place.id);
      if (demoMode && teleport) form.append("teleport", "true");

      setPhase("uploading");
      const res = await fetch("/api/stamps", { method: "POST", body: form });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        setPhase("error");
        setMessage(data?.error ?? "Collect failed. Please try again.");
        return;
      }

      if (data.accepted === false) {
        // Photo rejected — nothing was stored; ask for a retake (REQ-4.8).
        setPhase("retake");
        setMessage(
          data.message ??
            "That photo can’t be collected. Try a photo of the place, not a person.",
        );
        return;
      }

      setStamp(data.stamp as Stamp);
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

      {/* GPS accuracy warning (REQ-3.2). */}
      {accuracyBad && !teleport && (
        <p role="status" className="mb-2 text-sm text-berry">
          Location accuracy is low ({Math.round(accuracyM ?? 0)} m). Move to open
          sky for a cleaner fix.
        </p>
      )}

      {/* Out-of-range hint (REQ-3.1). */}
      {!inRange && !teleport && (
        <p className="mb-2 text-sm text-wood-dark/80">
          Get within ~75 m of this place to collect.
        </p>
      )}

      {/* Demo teleport option (REQ-1.3). */}
      {demoMode && (
        <label className="mb-2 flex items-center gap-2 text-sm text-wood-dark">
          <input
            type="checkbox"
            checked={teleport}
            onChange={(ev) => setTeleport(ev.target.checked)}
            className="h-4 w-4 accent-activity"
          />
          <span>
            <span className="border-2 border-wood-dark bg-wood-light px-1 font-label text-[10px] uppercase text-wood-dark">
              Demo
            </span>{" "}
            Teleport to this place (collect without being there)
          </span>
        </label>
      )}

      <button
        type="button"
        onClick={openCamera}
        disabled={!canCollect || busy}
        aria-disabled={!canCollect || busy}
        className="w-full border-4 border-wood-dark bg-activity px-4 py-3 font-heading text-lg text-parchment disabled:cursor-not-allowed disabled:bg-activity/50"
      >
        {busy
          ? phase === "preparing"
            ? "Preparing photo…"
            : "Collecting…"
          : "Collect! Snap a photo"}
      </button>

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
          place={{ name: place.name, neighborhood: place.neighborhood }}
          onClose={() => {
            setStamp(null);
            setPhase("idle");
          }}
        />
      )}
    </div>
  );
}
