"use client";

import type { DexEntry } from "@/lib/db/types";
import { rarityHex } from "@/components/map/rarity";

/**
 * Dex / Collection book grid (ui.md "Dex / Collection book", REQ-5.2, 5.3).
 * 4 columns on mobile. Owned entries show the stamp thumbnail with a
 * rarity-colored chunky border and the place/card name; locked entries render
 * as a dark silhouette slot with "???". List semantics + labels for a11y.
 */
export function DexGrid({ entries, onSelect }: { entries: (DexEntry & { visits?: number })[]; onSelect: (placeId: string) => void }) {
  return (
    <ul role="list" aria-label="Collection" className="grid grid-cols-4 gap-2">
      {entries.map((entry) => {
        if (entry.locked || !entry.stamp) {
          return (
            <li key={entry.placeId}>
              <div
                aria-label="Undiscovered place"
                className="pixel-shadow flex aspect-square min-h-16 w-full items-center justify-center border-4 border-wood-dark bg-wood-dark/80"
              >
                <span
                  aria-hidden="true"
                  className="font-heading text-lg text-parchment/50"
                >
                  ???
                </span>
              </div>
            </li>
          );
        }

        const stamp = entry.stamp;
        const name = entry.place?.name ?? stamp.card.name;
        const frameHex = rarityHex(stamp.rarity);

        return (
          <li key={entry.placeId}>
            <button
              type="button"
              onClick={() => onSelect(entry.placeId)}
              aria-label={`${name}, ${stamp.rarity}${entry.visits && entry.visits > 1 ? `, ${entry.visits} visits` : ""}. Show details`}
              className="pixel-shadow relative block w-full overflow-hidden border-4 bg-parchment text-left"
              style={{ borderColor: frameHex }}
            >
              {entry.visits && entry.visits > 1 ? (
                <span className="absolute right-0.5 top-0.5 z-10 border-2 border-wood-dark bg-activity px-1 font-label text-[10px] text-parchment">
                  ×{entry.visits}
                </span>
              ) : null}
              <div className="aspect-square w-full overflow-hidden bg-wood-dark/10">
                {stamp.photoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={stamp.photoPath}
                    alt={`${name} (${stamp.rarity})`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-heading text-2xl text-wood-dark/50">
                    ★
                  </div>
                )}
              </div>
              <p className="truncate px-1 py-1 text-center font-label text-[11px] text-wood-dark">
                {name}
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
