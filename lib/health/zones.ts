/**
 * Heart-rate zones (PLAN.md §4, §7). Zones are % of an estimated max HR
 * (220 − age): z1 50–60 %, z2 60–70 %, z3 70–80 %, z4 80–90 %, z5 ≥ 90 %.
 * Wellness estimates only, not a clinical measure.
 */

export type ZoneMinutes = { z1: number; z2: number; z3: number; z4: number; z5: number };

export const DEFAULT_AGE = 30;

export function estimatedMaxHr(age = DEFAULT_AGE): number {
  return 220 - age;
}

/** Zone (0 = below z1, 1–5) for a heart rate. */
export function zoneFor(bpm: number, maxHr = estimatedMaxHr()): 0 | 1 | 2 | 3 | 4 | 5 {
  const pct = bpm / maxHr;
  if (pct >= 0.9) return 5;
  if (pct >= 0.8) return 4;
  if (pct >= 0.7) return 3;
  if (pct >= 0.6) return 2;
  if (pct >= 0.5) return 1;
  return 0;
}

export function emptyZones(): ZoneMinutes {
  return { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
}

/**
 * Minutes per zone from timestamped HR samples. Each sample counts until the
 * next one, capped at 5 min so gaps in the data don't inflate a zone.
 */
export function zoneMinutesFromSamples(
  samples: { t: number; bpm: number }[],
  maxHr = estimatedMaxHr(),
): ZoneMinutes {
  const zones = emptyZones();
  const sorted = [...samples].sort((a, b) => a.t - b.t);
  for (let i = 0; i < sorted.length; i++) {
    const next = sorted[i + 1];
    const durMs = next ? Math.min(next.t - sorted[i].t, 5 * 60_000) : 60_000;
    const z = zoneFor(sorted[i].bpm, maxHr);
    if (z > 0) zones[`z${z}` as keyof ZoneMinutes] += durMs / 60_000;
  }
  for (const k of Object.keys(zones) as (keyof ZoneMinutes)[]) {
    zones[k] = Math.round(zones[k] * 10) / 10;
  }
  return zones;
}

/** Minutes in zone 2 or higher (the "cardio minutes" goal and effort bonus). */
export function zone2Plus(z: ZoneMinutes | undefined | null): number {
  if (!z) return 0;
  return Math.round(z.z2 + z.z3 + z.z4 + z.z5);
}
