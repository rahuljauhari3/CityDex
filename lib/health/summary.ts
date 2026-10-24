/**
 * Daily merge, goal progress and the weekly health summary (REQ-18, PLAN §2).
 * Pure functions over provider daily totals and stamps.
 */

import type { DailyHealth, Goal, GoalType, ProviderId, Stamp } from "@/lib/db/types";
import { nyDate } from "@/lib/time";
import { zone2Plus } from "./zones";

type DailyField = "steps" | "activeKcal" | "zoneMinutes" | "restingHr" | "spo2Avg" | "sleepHours";
const DAILY_FIELDS: DailyField[] = ["steps", "activeKcal", "zoneMinutes", "restingHr", "spo2Avg", "sleepHours"];

export interface MergedDay {
  date: string;
  values: Partial<Record<DailyField, number>>;
  sources: Partial<Record<DailyField, ProviderId>>;
  isDemo: boolean;
}

/** Per field, prefer real device data over demo data. */
export function mergeDaily(date: string, rows: DailyHealth[]): MergedDay {
  const day: MergedDay = { date, values: {}, sources: {}, isDemo: false };
  for (const f of DAILY_FIELDS) {
    const candidates = rows.filter((r) => r.date === date && r[f] !== undefined);
    const best = candidates.find((r) => !r.isDemo) ?? candidates[0];
    if (!best) continue;
    day.values[f] = best[f];
    day.sources[f] = best.source;
    if (best.isDemo) day.isDemo = true;
  }
  return day;
}

export const DEFAULT_GOALS: Omit<Goal, "id" | "userId">[] = [
  { type: "steps", target: 8000, period: "day", active: true },
  { type: "active_kcal", target: 400, period: "day", active: true },
  { type: "zone_minutes", target: 30, period: "day", active: true },
  { type: "explore", target: 3, period: "week", active: true },
  { type: "recovery", target: 2, period: "week", active: false },
];

export const GOAL_META: Record<GoalType, { label: string; unit: string; icon: string }> = {
  steps: { label: "Daily steps", unit: "steps", icon: "🥾" },
  active_kcal: { label: "Active calories", unit: "kcal", icon: "🔥" },
  zone_minutes: { label: "Cardio minutes (zone 2+)", unit: "min", icon: "❤️" },
  explore: { label: "New places this week", unit: "places", icon: "🧭" },
  recovery: { label: "Green & quiet places this week", unit: "visits", icon: "🌿" },
};

export interface GoalProgress {
  goal: Goal;
  current: number;
  pct: number;
  remaining: number;
  source: ProviderId | "stamps" | null;
}

const GREEN = new Set(["park", "nature", "water"]);

export function goalProgress(
  goals: Goal[],
  today: MergedDay,
  weekStamps: Stamp[],
  priorPlaceIds: Set<string>,
): GoalProgress[] {
  return goals
    .filter((g) => g.active)
    .map((goal) => {
      let current = 0;
      let source: GoalProgress["source"] = null;
      if (goal.type === "steps") {
        current = today.values.steps ?? 0;
        source = today.sources.steps ?? null;
      } else if (goal.type === "active_kcal") {
        current = today.values.activeKcal ?? 0;
        source = today.sources.activeKcal ?? null;
      } else if (goal.type === "zone_minutes") {
        current = today.values.zoneMinutes ?? 0;
        source = today.sources.zoneMinutes ?? null;
      } else if (goal.type === "explore") {
        current = new Set(weekStamps.filter((s) => !priorPlaceIds.has(s.placeId)).map((s) => s.placeId)).size;
        source = "stamps";
      } else if (goal.type === "recovery") {
        current = weekStamps.filter((s) => GREEN.has(s.card.category)).length;
        source = "stamps";
      }
      const pct = goal.target > 0 ? Math.min(1, current / goal.target) : 0;
      return { goal, current: Math.round(current), pct, remaining: Math.max(0, Math.round(goal.target - current)), source };
    });
}

export interface WeeklySummary {
  weekStart: string;
  days: MergedDay[];
  totals: { steps: number; activeKcal: number; zoneMinutes: number };
  averages: { restingHr: number | null; spo2Avg: number | null; sleepHours: number | null; stepsPerDay: number };
  sources: Partial<Record<DailyField, ProviderId[]>>;
  activeDays: number;
  stamps: number;
  checkinZoneMinutes: number;
  isDemo: boolean;
}

export function weeklySummary(weekStart: string, days: MergedDay[], weekStamps: Stamp[]): WeeklySummary {
  const sum = (f: DailyField) => days.reduce((s, d) => s + (d.values[f] ?? 0), 0);
  const avg = (f: DailyField) => {
    const xs = days.map((d) => d.values[f]).filter((x): x is number => x !== undefined);
    return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;
  };
  const sources: WeeklySummary["sources"] = {};
  for (const f of DAILY_FIELDS) {
    const s = new Set(days.map((d) => d.sources[f]).filter((x): x is ProviderId => Boolean(x)));
    if (s.size) sources[f] = [...s];
  }
  const withData = days.filter((d) => d.values.steps !== undefined);
  return {
    weekStart,
    days,
    totals: { steps: Math.round(sum("steps")), activeKcal: Math.round(sum("activeKcal")), zoneMinutes: Math.round(sum("zoneMinutes")) },
    averages: {
      restingHr: avg("restingHr") === null ? null : Math.round(avg("restingHr")!),
      spo2Avg: avg("spo2Avg"),
      sleepHours: avg("sleepHours"),
      stepsPerDay: withData.length ? Math.round(sum("steps") / withData.length) : 0,
    },
    sources,
    activeDays: days.filter((d) => (d.values.zoneMinutes ?? 0) >= 20 || (d.values.steps ?? 0) >= 8000).length,
    stamps: weekStamps.length,
    checkinZoneMinutes: weekStamps.reduce((s, x) => s + zone2Plus(x.healthSnapshot?.hrZoneMinutes), 0),
    isDemo: days.some((d) => d.isDemo),
  };
}

/** Stamps whose Boston date falls in `dates`. */
export function stampsOnDates(stamps: Stamp[], dates: string[]): Stamp[] {
  const set = new Set(dates);
  return stamps.filter((s) => set.has(nyDate(new Date(s.createdAt))));
}
