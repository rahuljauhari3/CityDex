/**
 * Demo health provider data (PLAN.md §4 "Demo"). Deterministic synthetic
 * numbers so the demo works with no watch. Everything produced here is marked
 * `isDemo: true` and labeled DEMO in the UI.
 */

import type { DailyHealth, HealthSnapshot } from "@/lib/db/types";
import { estimateSteps } from "@/lib/geo";
import { emptyZones, estimatedMaxHr, type ZoneMinutes } from "./zones";

/** Small seeded PRNG (mulberry32) so the same inputs give the same numbers. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function between(rand: () => number, lo: number, hi: number): number {
  return lo + (hi - lo) * rand();
}

export interface DemoRouteInput {
  seed: string;
  from: Date;
  to: Date;
  distanceM: number;
  /** Fitness offset in bpm; negative = fitter (used to shape insight trends). */
  hrOffset?: number;
  /** Estimated max HR (220 − age). */
  maxHr?: number;
}

/**
 * Snapshot for a walk/run. Pace sets the intensity: brisk walking lands mostly
 * in zone 2, running reaches zones 3–4.
 */
export function demoRouteSnapshot(input: DemoRouteInput): HealthSnapshot {
  const rand = seededRandom(input.seed);
  const durationMin = Math.max(1, (input.to.getTime() - input.from.getTime()) / 60_000);
  const km = input.distanceM / 1000;
  const paceMinPerKm = km > 0 ? durationMin / km : 12;
  const running = paceMinPerKm < 8;
  const maxHr = input.maxHr ?? estimatedMaxHr();

  // With an explicit fitness offset (seeded repeat loops), hold the base steady
  // so the trend shows through instead of random noise.
  const base =
    input.hrOffset !== undefined
      ? (running ? 146 : 122) + between(rand, -0.6, 0.6)
      : running ? between(rand, 140, 158) : between(rand, 116, 130);
  const hrAvg = Math.round(base + (input.hrOffset ?? 0));
  const hrMax = Math.round(hrAvg + between(rand, 12, 24));

  const zones: ZoneMinutes = emptyZones();
  const share = running
    ? { z1: 0.05, z2: 0.25, z3: 0.45, z4: 0.22, z5: 0.03 }
    : { z1: 0.3, z2: 0.55, z3: 0.13, z4: 0.02, z5: 0 };
  for (const k of Object.keys(share) as (keyof ZoneMinutes)[]) {
    zones[k] = Math.round(durationMin * share[k] * between(rand, 0.85, 1.15) * 10) / 10;
  }
  // Keep zone time consistent with avg HR when the walk is very easy.
  if (hrAvg < maxHr * 0.6) {
    zones.z1 += zones.z2;
    zones.z2 = 0;
  }

  const steps = Math.round(estimateSteps(input.distanceM, running ? 1.1 : 0.72) * between(rand, 0.95, 1.05));
  const activeKcal = Math.round(km * (running ? 75 : 58) * between(rand, 0.9, 1.1));

  return {
    source: "demo",
    from: input.from.toISOString(),
    to: input.to.toISOString(),
    steps,
    stepsEstimated: false,
    distanceM: Math.round(input.distanceM),
    activeKcal,
    hrAvg,
    hrMax,
    hrZoneMinutes: zones,
    spo2Avg: Math.round(between(rand, 95.5, 98.8) * 10) / 10,
    durationMin: Math.round(durationMin),
    isDemo: true,
  };
}

/** Demo users who train regularly: their resting HR drifts down over time. */
const IMPROVING = new Set(["demo-user", "demo_maya", "demo_priya"]);

/**
 * Daily totals for one demo user and day. `progress` (0–1) scales today's
 * partial day; `daysAgo` shapes slow trends (older days sit a little higher
 * for users who are getting fitter).
 */
export function demoDaily(userId: string, date: string, progress = 1, daysAgo = 0): DailyHealth {
  const rand = seededRandom(`${userId}:${date}`);
  const baseline = 57 + seededRandom(`${userId}:rhr`)() * 6;
  const drift = IMPROVING.has(userId) ? 0.12 * daysAgo : 0;
  const active = rand() > 0.2;
  const steps = Math.round((active ? between(rand, 7000, 13500) : between(rand, 2500, 6000)) * progress);
  return {
    date,
    source: "demo",
    isDemo: true,
    steps,
    activeKcal: Math.round(steps * between(rand, 0.038, 0.048)),
    zoneMinutes: Math.round((active ? between(rand, 18, 55) : between(rand, 0, 12)) * progress),
    restingHr: Math.round(baseline + drift + between(rand, -1.5, 1.5)),
    spo2Avg: Math.round(between(rand, 95.8, 98.6) * 10) / 10,
    sleepHours: Math.round(between(rand, 5.8, 8.3) * 10) / 10,
  };
}

/**
 * A live demo heart-rate reading for a walk in progress. Warms up over the
 * first few minutes, follows pace, and wobbles a little. Always labeled DEMO.
 */
export function demoLiveHr(seed: string, elapsedMin: number, paceMinPerKm: number | null, maxHr = estimatedMaxHr()): number {
  const rand = seededRandom(`${seed}:${Math.floor(elapsedMin * 4)}`);
  const running = paceMinPerKm !== null && paceMinPerKm < 8;
  const target = running ? 0.78 * maxHr : 0.64 * maxHr;
  const rest = 0.4 * maxHr;
  const warm = Math.min(1, elapsedMin / 4);
  const wobble = Math.sin(elapsedMin * 1.7) * 3 + (rand() - 0.5) * 4;
  return Math.round(rest + (target - rest) * warm + wobble);
}
