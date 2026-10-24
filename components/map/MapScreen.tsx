"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

/**
 * Client entry for the map screen. Leaflet touches `window`, so the map is
 * loaded via `next/dynamic` with `ssr: false`. The health header is rendered
 * on the server and passed in.
 */
const LeafletMap = dynamic(() => import("./LeafletMap").then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-parchment">
      <p className="font-label text-sm uppercase tracking-wide text-wood-dark/70">Loading map…</p>
    </div>
  ),
});

export function MapScreen({
  demoMode,
  header,
  focusPlaceId,
  questIds,
}: {
  demoMode: boolean;
  header: ReactNode;
  focusPlaceId: string | null;
  questIds: string[];
}) {
  return (
    <section aria-label="City map" className="flex h-[calc(100dvh-4rem-env(safe-area-inset-bottom))] flex-col">
      {header}
      <div className="relative min-h-0 flex-1">
        <LeafletMap demoMode={demoMode} focusPlaceId={focusPlaceId} questIds={questIds} />
      </div>
    </section>
  );
}
