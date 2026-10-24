"use client";

import { useEffect, useState } from "react";
import { estimateSteps } from "@/lib/geo";
import type { WalkTracker } from "./useRouteTracker";
import { SIM_SPEEDUP } from "./useRouteTracker";

const ZONE_COLORS = ["#9e9e9e", "#9e9e9e", "#6daa2c", "#f0b429", "#fc5200", "#c0392b"];
const KCAL_PER_KM = 60;

function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

function Cell({ label, value, unit, tag }: { label: string; value: string; unit?: string; tag?: string }) {
  return (
    <div>
      <p className="font-label text-[10px] uppercase text-parchment/80">
        {label}
        {tag && <span className="ml-1 border border-parchment/70 px-0.5 text-[9px]">{tag}</span>}
      </p>
      <p className="font-heading text-lg leading-tight text-parchment">
        {value}
        {unit && <span className="text-xs text-parchment/80"> {unit}</span>}
      </p>
    </div>
  );
}

/**
 * Live stats while a walk is tracked: time, distance, estimated steps, pace,
 * estimated kcal and heart rate when a live source exists (the demo watch).
 */
export function LiveWalkPanel({ tracker, onArrivedCollect }: { tracker: WalkTracker; onArrivedCollect: () => void }) {
  const [hr, setHr] = useState<{ hr: number | null; zone?: number; source: string | null } | null>(null);
  const elapsedMin = tracker.elapsedMs / 60_000;
  const km = tracker.distanceM / 1000;
  const pace = km > 0.05 ? elapsedMin / km : null;

  // Poll live heart rate every 3 s while walking.
  const minuteBucket = Math.floor(elapsedMin * 4);
  const distBucket = Math.floor(tracker.distanceM / 50);
  useEffect(() => {
    if (!tracker.active) return;
    let cancelled = false;
    fetch(`/api/health/live?elapsedMin=${elapsedMin.toFixed(2)}&distanceM=${Math.round(tracker.distanceM)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setHr(d);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // Re-poll as time and distance move on, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracker.active, minuteBucket, distBucket]);

  if (!tracker.active) return null;
  return (
    <div className="pointer-events-auto absolute inset-x-2 top-2 z-[1000] border-4 border-wood-dark bg-wood-dark/95 p-2 pixel-shadow" role="status" aria-live="polite">
      <div className="flex items-center justify-between">
        <p className="font-label text-[11px] uppercase text-parchment">
          <span className="mr-1 inline-block h-2 w-2 animate-pulse bg-berry" aria-hidden="true" />
          {tracker.simulated ? `Demo walk ×${SIM_SPEEDUP}` : "Tracking walk"}
          {tracker.target && ` → ${tracker.target.name}`}
        </p>
        <button type="button" onClick={tracker.stop} className="border-2 border-parchment px-1.5 font-label text-[10px] uppercase text-parchment">
          End
        </button>
      </div>
      <div className="mt-1 grid grid-cols-3 gap-x-2 gap-y-1">
        <Cell label="Time" value={clock(tracker.elapsedMs)} />
        <Cell label="Distance" value={km.toFixed(2)} unit="km" />
        <Cell label="Steps" value={estimateSteps(tracker.distanceM).toLocaleString()} tag="est." />
        <Cell label="Pace" value={pace ? `${Math.floor(pace)}:${String(Math.round((pace % 1) * 60)).padStart(2, "0")}` : "–"} unit="/km" />
        <Cell label="Active" value={String(Math.round(km * KCAL_PER_KM))} unit="kcal" tag="est." />
        {hr?.hr ? (
          <div>
            <p className="font-label text-[10px] uppercase text-parchment/80">
              Heart rate{hr.source === "demo" && <span className="ml-1 border border-parchment/70 px-0.5 text-[9px]">DEMO</span>}
            </p>
            <p className="font-heading text-lg leading-tight" style={{ color: ZONE_COLORS[hr.zone ?? 0] === "#9e9e9e" ? "#f4e4c1" : ZONE_COLORS[hr.zone ?? 0] }}>
              ♥ {hr.hr}
              <span className="text-xs text-parchment/80"> bpm · Z{hr.zone}</span>
            </p>
          </div>
        ) : (
          <Cell label="Heart rate" value="–" unit="no live source" />
        )}
      </div>
      {tracker.arrived && tracker.target && (
        <button type="button" onClick={onArrivedCollect} className="mt-2 w-full border-2 border-parchment bg-activity py-1.5 font-heading text-sm text-parchment">
          Arrived at {tracker.target.name}! Collect →
        </button>
      )}
      {!tracker.simulated && km < 0.01 && (
        <p className="mt-1 text-xs text-parchment/80">Waiting for GPS. Steps are estimated from distance.</p>
      )}
    </div>
  );
}
