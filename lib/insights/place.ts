/**
 * Place insights over time (REQ-16). For places a user visited at least twice,
 * compare heart rate at a similar pace across visits and fit a linear trend in
 * bpm per week. Wellness insight only; it shows its sample size and never
 * claims a diagnosis.
 */

import type { Place, Stamp } from "@/lib/db/types";

export interface PlaceInsight {
  placeId: string;
  placeName: string;
  visits: number;
  /** Visits used for the trend (similar pace to the latest visit). */
  comparableVisits: number;
  firstHr: number;
  latestHr: number;
  deltaBpm: number;
  bpmPerWeek: number;
  spanDays: number;
  paceMinPerKm: number | null;
  isDemo: boolean;
  text: string;
}

export interface Visit {
  t: number;
  hr: number;
  pace: number | null; // min/km
  isDemo: boolean;
}

function paceOf(s: Stamp): number | null {
  const h = s.healthSnapshot;
  if (!h?.distanceM || !h.durationMin || h.distanceM < 200) return null;
  return h.durationMin / (h.distanceM / 1000);
}

/** Least-squares slope of y over x. */
export function slope(points: { x: number; y: number }[]): number {
  const n = points.length;
  if (n < 2) return 0;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0, den = 0;
  for (const p of points) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

/** Keep visits whose pace is within ±10% of the latest visit's pace. */
export function comparable(visits: Visit[], tolerance = 0.1): Visit[] {
  const latest = visits[visits.length - 1];
  if (!latest || latest.pace === null) return visits;
  return visits.filter((v) => v.pace === null || Math.abs(v.pace - latest.pace!) / latest.pace! <= tolerance);
}

export function computePlaceInsight(stamps: Stamp[], place: Place): PlaceInsight | null {
  const visits: Visit[] = stamps
    .filter((s) => s.placeId === place.id && s.healthSnapshot?.hrAvg)
    .map((s) => ({ t: Date.parse(s.createdAt), hr: s.healthSnapshot!.hrAvg!, pace: paceOf(s), isDemo: s.healthSnapshot!.isDemo }))
    .sort((a, b) => a.t - b.t);
  if (visits.length < 2) return null;
  const used = comparable(visits);
  if (used.length < 2) return null;

  const t0 = used[0].t;
  const weeks = used.map((v) => ({ x: (v.t - t0) / (7 * 86_400_000), y: v.hr }));
  const bpmPerWeek = Math.round(slope(weeks) * 10) / 10;
  const first = used[0];
  const latest = used[used.length - 1];
  const delta = Math.round(latest.hr - first.hr);
  const spanDays = Math.max(1, Math.round((latest.t - first.t) / 86_400_000));
  const span = spanDays >= 14 ? `${Math.round(spanDays / 7)} weeks` : `${spanDays} days`;
  const pace = latest.pace ? Math.round(latest.pace * 10) / 10 : null;
  const atPace = pace ? " at the same pace" : "";

  let text: string;
  if (delta <= -2) text = `Your avg HR at ${place.name} is down ${Math.abs(delta)} bpm over ${span}${atPace}.`;
  else if (delta >= 2) text = `Your avg HR at ${place.name} is up ${delta} bpm over ${span}${atPace}. Rest, heat or a faster pace can all raise it.`;
  else text = `Your avg HR at ${place.name} is steady over ${span}${atPace}.`;

  return {
    placeId: place.id,
    placeName: place.name,
    visits: visits.length,
    comparableVisits: used.length,
    firstHr: first.hr,
    latestHr: latest.hr,
    deltaBpm: delta,
    bpmPerWeek,
    spanDays,
    paceMinPerKm: pace,
    isDemo: used.some((v) => v.isDemo),
    text,
  };
}

/** Insights for every place the user has visited twice or more, biggest change first. */
export function computePlaceInsights(stamps: Stamp[], places: Map<string, Place>): PlaceInsight[] {
  const ids = new Set(stamps.map((s) => s.placeId));
  const out: PlaceInsight[] = [];
  for (const id of ids) {
    const place = places.get(id);
    if (!place) continue;
    const insight = computePlaceInsight(stamps, place);
    if (insight) out.push(insight);
  }
  return out.sort((a, b) => Math.abs(b.deltaBpm) - Math.abs(a.deltaBpm));
}
