/**
 * Merge health snapshots from every connected provider (PLAN.md §4).
 * Real device data beats demo data, and demo data beats browser estimates.
 * The result records which source supplied each field.
 */

import type { HealthField, HealthSnapshot, ProviderId } from "@/lib/db/types";

const FIELDS: HealthField[] = [
  "steps",
  "distanceM",
  "activeKcal",
  "hrAvg",
  "hrMax",
  "hrZoneMinutes",
  "spo2Avg",
];

/** Higher wins. Estimates from the browser rank lowest. */
function rank(s: HealthSnapshot, field: HealthField): number {
  if (field === "steps" && s.stepsEstimated) return 0;
  if (s.source === "demo") return 1;
  return 2;
}

export function mergeSnapshots(snaps: (HealthSnapshot | null | undefined)[]): HealthSnapshot | null {
  const list = snaps.filter((s): s is HealthSnapshot => Boolean(s));
  if (list.length === 0) return null;

  const from = list.map((s) => s.from).sort()[0];
  const to = list.map((s) => s.to).sort().at(-1)!;
  const merged: HealthSnapshot = { source: list[0].source, from, to, isDemo: false, fieldSources: {} };
  let usedDemo = false;

  for (const field of FIELDS) {
    let best: HealthSnapshot | null = null;
    for (const s of list) {
      if (s[field] === undefined || s[field] === null) continue;
      if (!best || rank(s, field) > rank(best, field)) best = s;
    }
    if (!best) continue;
    (merged as unknown as Record<string, unknown>)[field] = best[field];
    const label: ProviderId | "est" = field === "steps" && best.stepsEstimated ? "est" : best.source;
    merged.fieldSources![field] = label;
    if (field === "steps") merged.stepsEstimated = Boolean(best.stepsEstimated);
    if (best.isDemo) usedDemo = true;
  }

  const durations = list.map((s) => s.durationMin).filter((d): d is number => d !== undefined);
  if (durations.length) merged.durationMin = Math.max(...durations);

  // The primary source is whichever supplied heart rate, else steps.
  const primary = merged.fieldSources!.hrAvg ?? merged.fieldSources!.steps;
  if (primary && primary !== "est") merged.source = primary;
  merged.isDemo = usedDemo;
  return merged;
}
