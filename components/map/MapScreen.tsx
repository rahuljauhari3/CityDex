"use client";

import dynamic from "next/dynamic";

/**
 * Client entry for the map screen (REQ-2.1). Leaflet touches `window`, so the
 * heavy map component is loaded via `next/dynamic` with `ssr: false` and never
 * renders on the server.
 */
const LeafletMap = dynamic(
  () => import("./LeafletMap").then((m) => m.LeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[calc(100dvh-4rem)] items-center justify-center bg-parchment">
        <p className="font-label text-sm uppercase tracking-wide text-wood-dark/70">
          Loading map…
        </p>
      </div>
    ),
  },
);

export function MapScreen() {
  return (
    <section aria-label="City map" className="relative">
      <LeafletMap />
    </section>
  );
}
