"use client";

import { useEffect, useRef } from "react";
import type { Place, Stamp } from "@/lib/db/types";
import { rarityHex, RARITY_LABEL_HEX } from "./rarity";
import { CollectFlow } from "@/components/stamp/CollectFlow";
import { PhotoCredit } from "@/components/ui/PhotoCredit";
import { placePhoto } from "@/lib/demo/photos";

const CATEGORY_LABEL: Record<string, string> = {
  mural: "Mural",
  statue: "Statue",
  cafe: "Café",
  door: "Door",
  park: "Park",
  building: "Building",
  transit: "Transit",
  water: "Water",
  nature: "Nature",
  shop: "Shop",
  oddity: "Oddity",
  other: "Spot",
};

/**
 * Place detail sheet (REQ-2.4): name, category, neighborhood, rarity, collect
 * count. Accessible bottom sheet — focusable close button, Escape to close,
 * backdrop is a real button for keyboard users.
 */
export function PlaceSheet({
  place,
  questReason,
  onDemoWalk,
  userPos,
  accuracyM,
  demoMode,
  route,
  onRouteUsed,
  onClose,
  onCollected,
}: {
  place: Place | null;
  questReason: string | null;
  onDemoWalk: (() => void) | null;
  userPos: { lat: number; lng: number } | null;
  accuracyM: number | null;
  demoMode: boolean;
  route: { startedAt: string; distanceM: number; elapsedMs: number; simulated?: boolean } | null;
  onRouteUsed: () => void;
  onClose: () => void;
  onCollected: (result: { stamp: Stamp; place: Place }) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!place) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [place, onClose]);

  if (!place) return null;

  const rarity = place.baselineRarity;
  const photo = placePhoto(place.id);
  return (
    <>
      <button
        type="button"
        aria-label="Close place details"
        onClick={onClose}
        className="fixed inset-0 bottom-16 z-[1100] bg-wood-dark/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${place.name} details`}
        className="fixed inset-x-0 bottom-16 z-[1200] mx-auto max-h-[78dvh] max-w-screen-sm overflow-y-auto border-x-4 border-t-4 border-wood-dark bg-parchment p-4 pixel-shadow"
      >
        <div className="flex items-start justify-between gap-3">
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.url}
              alt={place.name}
              className="h-16 w-20 shrink-0 border-4 object-cover"
              style={{ borderColor: rarityHex(rarity) }}
            />
          )}
          <h2 className="flex-1 font-heading text-2xl leading-tight text-wood-dark">
            {place.name}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 border-4 border-wood-dark bg-wood-light px-3 py-1 font-label text-sm text-wood-dark"
          >
            ✕
          </button>
        </div>

        {photo && <PhotoCredit credit={photo.credit} className="mt-1" />}

        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="font-label text-xs uppercase tracking-wide text-wood-dark/70">
              Category
            </dt>
            <dd className="text-wood-dark">
              {CATEGORY_LABEL[place.category] ?? place.category}
            </dd>
          </div>
          <div>
            <dt className="font-label text-xs uppercase tracking-wide text-wood-dark/70">
              Neighborhood
            </dt>
            <dd className="text-wood-dark">{place.neighborhood ?? "Unknown"}</dd>
          </div>
          <div>
            <dt className="font-label text-xs uppercase tracking-wide text-wood-dark/70">
              Rarity
            </dt>
            <dd className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="pixelated inline-block h-3.5 w-3.5 border-2 border-wood-dark"
                style={{ background: rarityHex(rarity) }}
              />
              <span
                className="font-heading capitalize"
                style={{ color: RARITY_LABEL_HEX[rarity] }}
              >
                {rarity}
              </span>
            </dd>
          </div>
          <div>
            <dt className="font-label text-xs uppercase tracking-wide text-wood-dark/70">
              Collected
            </dt>
            <dd className="text-wood-dark">
              <span className="font-heading text-activity">
                {place.collectCount}
              </span>{" "}
              {place.collectCount === 1 ? "time" : "times"}
            </dd>
          </div>
        </dl>

        {questReason && (
          <p className="mt-3 border-l-4 border-activity pl-2 font-heading text-base text-activity">
            ★ Today&apos;s quest: {questReason}
          </p>
        )}

        {onDemoWalk && (
          <button
            type="button"
            onClick={onDemoWalk}
            className="mt-3 w-full border-4 border-wood-dark bg-grass py-2 font-heading text-base text-wood-dark"
          >
            ▶ Demo walk here (tracks health live)
          </button>
        )}

        <div className="mt-4">
          <CollectFlow
            place={place}
            userPos={userPos}
            accuracyM={accuracyM}
            demoMode={demoMode}
            route={route}
            onRouteUsed={onRouteUsed}
            onCollected={onCollected}
          />
        </div>
      </div>
    </>
  );
}
