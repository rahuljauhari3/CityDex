/**
 * Longer-term health trends from daily totals: resting HR, sleep, steps and
 * cardio minutes this week vs last, a recovery estimate, and how active days
 * line up with the next morning's resting HR. Pure; wellness wording only.
 */

import type { ProviderId } from "@/lib/db/types";
import { slope } from "@/lib/insights/place";
import type { MergedDay } from "./summary";

export type DailyMetric = "restingHr" | "sleepHours" | "steps" | "zoneMinutes";

export interface MetricTrend {
  metric: DailyMetric;
  /** Chronological values for the sparkline (null = no data that day). */
  series: (number | null)[];
  current7: number | null;
  prev7: number | null;
  delta: number | null;
  /** Least-squares slope over the window, per week. */
  perWeek: number | null;
  samples: number;
  source: ProviderId | null;
}

function avg(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

function round1(x: number | null): number | null {
  return x === null ? null : Math.round(x * 10) / 10;
}

/** `days` must be chronological (oldest first), ideally 28 days ending today. */
export function metricTrend(days: MergedDay[], metric: DailyMetric): MetricTrend {
  const series = days.map((d) => d.values[metric] ?? null);
  const last7 = series.slice(-7).filter((x): x is number => x !== null);
  const prev7 = series.slice(-14, -7).filter((x): x is number => x !== null);
  const pts = series.flatMap((y, i) => (y === null ? [] : [{ x: i / 7, y }]));
  const current = avg(last7);
  const previous = avg(prev7);
  const sources = days.map((d) => d.sources[metric]).filter((s): s is ProviderId => Boolean(s));
  return {
    metric,
    series,
    current7: round1(current),
    prev7: round1(previous),
    delta: current !== null && previous !== null ? round1(current - previous) : null,
    perWeek: pts.length >= 4 ? round1(slope(pts)) : null,
    samples: pts.length,
    source: sources.at(-1) ?? null,
  };
}

export interface RecoveryFactor {
  label: string;
  effect: number; // points added (+) or removed (−)
}

export interface RecoveryEstimate {
  score: number; // 0–100
  level: "ready" | "moderate" | "easy";
  headline: string;
  factors: RecoveryFactor[];
  isDemo: boolean;
}

/**
 * A transparent recovery estimate from three signals: last night's resting HR
 * vs the 14-day baseline, sleep vs 7 h, and yesterday's cardio load. Not a
 * clinical score; every factor is shown.
 */
export function recoveryEstimate(days: MergedDay[]): RecoveryEstimate | null {
  const today = days.at(-1);
  const yesterday = days.at(-2);
  if (!today) return null;
  const baselineDays = days.slice(-15, -1).map((d) => d.values.restingHr).filter((x): x is number => x !== undefined);
  const baseline = avg(baselineDays);
  const rhr = today.values.restingHr;
  const sleep = today.values.sleepHours ?? yesterday?.values.sleepHours;
  const load = yesterday?.values.zoneMinutes;
  if (rhr === undefined && sleep === undefined) return null;

  const factors: RecoveryFactor[] = [];
  if (rhr !== undefined && baseline !== null && baselineDays.length >= 5) {
    const diff = rhr - baseline;
    const effect = Math.round(Math.max(-30, Math.min(10, -diff * 6)));
    const word = Math.abs(diff) < 1 ? "at" : diff > 0 ? `${Math.round(diff)} bpm above` : `${Math.round(-diff)} bpm below`;
    factors.push({ label: `Resting HR ${Math.round(rhr)} bpm, ${word} your 2-week baseline`, effect });
  }
  if (sleep !== undefined) {
    const short = 7 - sleep;
    const effect = Math.round(short > 0 ? -Math.min(30, short * 12) : Math.min(5, -short * 4));
    factors.push({ label: `${sleep} h sleep${short > 0 ? `, ${Math.round(short * 10) / 10} h under 7 h` : ""}`, effect });
  }
  if (load !== undefined && load > 45) {
    factors.push({ label: `${load} cardio minutes yesterday`, effect: -Math.min(15, Math.round((load - 45) / 3)) });
  }

  const score = Math.max(0, Math.min(100, 80 + factors.reduce((s, f) => s + f.effect, 0)));
  const level = score >= 75 ? "ready" : score >= 50 ? "moderate" : "easy";
  const headline =
    level === "ready"
      ? "Ready for a longer walk or run"
      : level === "moderate"
        ? "A moderate day: a steady walk fits"
        : "Take it easy: an easy walk to a green, quiet spot";
  return { score, level, headline, factors, isDemo: today.isDemo };
}

export interface NextDayEffect {
  activeAvg: number;
  restAvg: number;
  activeDays: number;
  restDays: number;
  diff: number;
}

/**
 * Resting HR the morning after days with 30+ cardio minutes vs after lighter
 * days. Needs at least 3 of each; a correlation, not a cause.
 */
export function nextDayRestingHrEffect(days: MergedDay[], threshold = 30): NextDayEffect | null {
  const after: number[] = [];
  const rest: number[] = [];
  for (let i = 0; i < days.length - 1; i++) {
    const load = days[i].values.zoneMinutes;
    const next = days[i + 1].values.restingHr;
    if (load === undefined || next === undefined) continue;
    (load >= threshold ? after : rest).push(next);
  }
  if (after.length < 3 || rest.length < 3) return null;
  const a = avg(after)!;
  const r = avg(rest)!;
  return {
    activeAvg: Math.round(a * 10) / 10,
    restAvg: Math.round(r * 10) / 10,
    activeDays: after.length,
    restDays: rest.length,
    diff: Math.round((a - r) * 10) / 10,
  };
}

export interface HealthTrends {
  days: string[];
  restingHr: MetricTrend;
  sleep: MetricTrend;
  steps: MetricTrend;
  cardio: MetricTrend;
  recovery: RecoveryEstimate | null;
  nextDay: NextDayEffect | null;
  isDemo: boolean;
}

/** `days` is chronological and ends today. */
export function computeTrends(days: MergedDay[]): HealthTrends {
  // Today's steps and cardio are still accumulating, so compare full days only.
  // Resting HR and sleep are measured in the morning, so today counts.
  const complete = days.slice(0, -1);
  return {
    days: days.map((d) => d.date),
    restingHr: metricTrend(days, "restingHr"),
    sleep: metricTrend(days, "sleepHours"),
    steps: metricTrend(complete, "steps"),
    cardio: metricTrend(complete, "zoneMinutes"),
    recovery: recoveryEstimate(days),
    nextDay: nextDayRestingHrEffect(days),
    isDemo: days.some((d) => d.isDemo),
  };
}
