"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_BOSTON_CENTER, haversineMeters, routeDistance, type LatLng } from "@/lib/geo";

const KEY = "citydex.route";
const MAX_ACCURACY_M = 50;
/** Demo simulation: brisk walking pace, played back faster than real time. */
const WALK_MPS = 1.4;
export const SIM_SPEEDUP = 12;
const ARRIVE_M = 30;

interface TrackedRoute {
  /** Real start time for GPS walks; virtual (sped-up) start for simulated ones. */
  startedAt: string;
  points: LatLng[];
  sim: { target: LatLng; targetName: string; virtualMs: number } | null;
}

function load(): TrackedRoute | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TrackedRoute) : null;
  } catch {
    return null;
  }
}

function save(r: TrackedRoute | null) {
  try {
    if (r) sessionStorage.setItem(KEY, JSON.stringify(r));
    else sessionStorage.removeItem(KEY);
  } catch {
    // Storage can be unavailable (private mode); tracking still works in memory.
  }
}

/** Step `meters` from `a` toward `b` (flat-earth approximation, fine for a city). */
function stepToward(a: LatLng, b: LatLng, meters: number): LatLng {
  const d = haversineMeters(a, b);
  if (d <= meters) return b;
  const f = meters / d;
  return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f };
}

export interface WalkTracker {
  active: boolean;
  simulated: boolean;
  /** ISO start time to send at check-in (virtual for simulated walks). */
  startedAt: string | null;
  elapsedMs: number;
  distanceM: number;
  points: LatLng[];
  /** Current position for simulated walks (null for GPS walks). */
  position: LatLng | null;
  target: { name: string; position: LatLng } | null;
  arrived: boolean;
  start: () => void;
  simulate: (target: LatLng, name: string) => void;
  stop: () => void;
}

/**
 * Walk/run tracking (PLAN §2 step 3). GPS walks record accurate fixes from
 * watchPosition. In demo mode a walk can be simulated toward a place so the
 * flow works without moving; it's labeled DEMO in the UI. The path stays on
 * the device; only the start time and distance are sent at check-in.
 */
export function useRouteTracker(pos: LatLng | null, accuracyM: number | null): WalkTracker {
  const [route, setRoute] = useState<TrackedRoute | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const active = Boolean(route);

  useEffect(() => {
    const t = setTimeout(() => setRoute(load()), 0);
    return () => clearTimeout(t);
  }, []);

  // Clock tick: drives the elapsed timer and the simulation.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setNow(Date.now());
      setRoute((r) => {
        if (!r?.sim) return r;
        const last = r.points.at(-1)!;
        if (haversineMeters(last, r.sim.target) <= ARRIVE_M) return r;
        const next = stepToward(last, r.sim.target, WALK_MPS * SIM_SPEEDUP);
        const updated: TrackedRoute = {
          ...r,
          points: [...r.points, next],
          sim: { ...r.sim, virtualMs: r.sim.virtualMs + 1000 * SIM_SPEEDUP },
        };
        save(updated);
        return updated;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  // GPS walks: record accurate fixes.
  useEffect(() => {
    if (!route || route.sim || !pos || (accuracyM !== null && accuracyM > MAX_ACCURACY_M)) return;
    const last = route.points.at(-1);
    if (last && last.lat === pos.lat && last.lng === pos.lng) return;
    const next = { ...route, points: [...route.points, pos].slice(-2000) };
    const t = setTimeout(() => {
      setRoute(next);
      save(next);
    }, 0);
    return () => clearTimeout(t);
  }, [pos, accuracyM, route]);

  const start = useCallback(() => {
    const r: TrackedRoute = { startedAt: new Date().toISOString(), points: pos ? [pos] : [], sim: null };
    setRoute(r);
    save(r);
  }, [pos]);

  const simulate = useCallback(
    (target: LatLng, targetName: string) => {
      const from = pos ?? DEFAULT_BOSTON_CENTER;
      const r: TrackedRoute = { startedAt: new Date().toISOString(), points: [from], sim: { target, targetName, virtualMs: 0 } };
      setRoute(r);
      save(r);
    },
    [pos],
  );

  const stop = useCallback(() => {
    setRoute(null);
    save(null);
  }, []);

  const simulated = Boolean(route?.sim);
  const elapsedMs = route ? (route.sim ? route.sim.virtualMs : Math.max(0, now - Date.parse(route.startedAt))) : 0;
  const position = route?.sim ? route.points.at(-1) ?? null : null;
  const arrived = Boolean(route?.sim && position && haversineMeters(position, route.sim.target) <= ARRIVE_M);

  return {
    active,
    simulated,
    // For simulated walks, report a virtual start so pace and duration look real.
    startedAt: route ? new Date(now - elapsedMs).toISOString() : null,
    elapsedMs,
    distanceM: route ? routeDistance(route.points) : 0,
    points: route?.points ?? [],
    position,
    target: route?.sim ? { name: route.sim.targetName, position: route.sim.target } : null,
    arrived,
    start,
    simulate,
    stop,
  };
}
