"use client";

import { useCallback, useEffect, useState } from "react";
import { routeDistance, type LatLng } from "@/lib/geo";

const KEY = "citydex.route";
const MAX_ACCURACY_M = 50;

interface TrackedRoute {
  startedAt: string;
  points: LatLng[];
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

/**
 * Browser walk/run tracking (PLAN §2 step 3). Records accurate fixes from
 * watchPosition while a walk is active. The path stays on the device; only
 * the start time and distance are sent at check-in (routes are private).
 */
export function useRouteTracker(pos: LatLng | null, accuracyM: number | null) {
  const [route, setRoute] = useState<TrackedRoute | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setRoute(load()), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!route || !pos || (accuracyM !== null && accuracyM > MAX_ACCURACY_M)) return;
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
    const r = { startedAt: new Date().toISOString(), points: pos ? [pos] : [] };
    setRoute(r);
    save(r);
  }, [pos]);

  const stop = useCallback(() => {
    setRoute(null);
    save(null);
  }, []);

  return {
    active: Boolean(route),
    startedAt: route?.startedAt ?? null,
    distanceM: route ? routeDistance(route.points) : 0,
    start,
    stop,
  };
}
