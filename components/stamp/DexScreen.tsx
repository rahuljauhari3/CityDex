"use client";

import { useEffect, useMemo, useState } from "react";
import type { DexEntry } from "@/lib/db/types";
import { PixelPanel } from "@/components/ui/PixelPanel";
import { DexGrid } from "./DexGrid";

/** How many locked (undiscovered) slots to surface alongside owned stamps. */
const LOCKED_SHOWN = 16;

/**
 * Dex / Collection book screen (REQ-5.2, 5.3). Fetches the viewer's entries
 * from /api/dex and renders the 4-column grid: owned stamps first, then a
 * bounded set of locked "???" silhouettes for undiscovered places.
 */
export function DexScreen() {
  const [entries, setEntries] = useState<DexEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dex")
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
      )
      .then((data: { entries: DexEntry[] }) => {
        if (!cancelled) setEntries(data.entries ?? []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { shown, ownedCount } = useMemo(() => {
    const all = entries ?? [];
    const owned = all.filter((e) => !e.locked);
    const locked = all.filter((e) => e.locked).slice(0, LOCKED_SHOWN);
    return { shown: [...owned, ...locked], ownedCount: owned.length };
  }, [entries]);

  return (
    <section className="mx-auto max-w-screen-sm px-4 py-4">
      <header className="mb-4">
        <h1 className="font-heading text-3xl text-wood-dark">Dex</h1>
        <p className="mt-1 text-sm text-wood-dark/80">
          Your collection book.{" "}
          <span className="font-heading text-activity">{ownedCount}</span>{" "}
          collected.
        </p>
      </header>

      {error && (
        <PixelPanel>
          <p className="text-wood-dark">
            Couldn’t load your collection. Please try again.
          </p>
        </PixelPanel>
      )}

      {!error && entries === null && (
        <p className="font-label text-sm uppercase tracking-wide text-wood-dark/70">
          Loading collection…
        </p>
      )}

      {!error && entries !== null && shown.length === 0 && (
        <PixelPanel>
          <p className="text-wood-dark">
            No places yet. Head to the map and collect your first stamp!
          </p>
        </PixelPanel>
      )}

      {!error && shown.length > 0 && <DexGrid entries={shown} />}
    </section>
  );
}
