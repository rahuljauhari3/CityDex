/**
 * Check-in health context for the card reveal: what this walk contributed to
 * today's goals, and how it compares with your usual walks. Pure.
 */

import type { Goal, HealthSnapshot, Stamp } from "@/lib/db/types";
import type { GoalProgress } from "./summary";
import { GOAL_META } from "./summary";
import { zone2Plus } from "./zones";

export interface GoalImpact {
  type: Goal["type"];
  label: string;
  unit: string;
  amount: number;
  /** Share of the daily target this walk alone covered (0–1+). */
  pctOfTarget: number;
  /** Today's progress including this walk (0–1). */
  todayPct: number;
  done: boolean;
}

export function goalImpact(snapshot: HealthSnapshot | null, progress: GoalProgress[]): GoalImpact[] {
  if (!snapshot) return [];
  const amountFor: Partial<Record<Goal["type"], number>> = {
    steps: snapshot.steps,
    active_kcal: snapshot.activeKcal,
    zone_minutes: snapshot.hrZoneMinutes ? zone2Plus(snapshot.hrZoneMinutes) : undefined,
  };
  return progress.flatMap((p) => {
    const amount = amountFor[p.goal.type];
    if (amount === undefined || p.goal.period !== "day") return [];
    const meta = GOAL_META[p.goal.type];
    return [
      {
        type: p.goal.type,
        label: meta.label,
        unit: meta.unit,
        amount: Math.round(amount),
        pctOfTarget: p.goal.target > 0 ? amount / p.goal.target : 0,
        todayPct: p.pct,
        done: p.pct >= 1,
      },
    ];
  });
}

export function paceMinPerKm(s: HealthSnapshot | null | undefined): number | null {
  if (!s?.distanceM || !s.durationMin || s.distanceM < 200) return null;
  return s.durationMin / (s.distanceM / 1000);
}

export interface UsualComparison {
  kind: "walk" | "run";
  usualHr: number;
  diff: number;
  samples: number;
  text: string;
}

/**
 * Compare this check-in's average HR with your other check-ins of the same
 * kind (walks vs runs, split at 8 min/km). Needs 2+ earlier check-ins.
 */
export function compareToUsual(snapshot: HealthSnapshot | null, earlier: Stamp[]): UsualComparison | null {
  const pace = paceMinPerKm(snapshot);
  if (!snapshot?.hrAvg || pace === null) return null;
  const kind = pace < 8 ? "run" : "walk";
  const same = earlier
    .map((s) => s.healthSnapshot)
    .filter((h): h is HealthSnapshot => Boolean(h?.hrAvg))
    .filter((h) => {
      const p = paceMinPerKm(h);
      return p !== null && (p < 8 ? "run" : "walk") === kind;
    });
  if (same.length < 2) return null;
  const usual = Math.round(same.reduce((s, h) => s + h.hrAvg!, 0) / same.length);
  const diff = snapshot.hrAvg - usual;
  const text =
    Math.abs(diff) < 2
      ? `Right around your usual ${kind} heart rate (${usual} bpm).`
      : `${Math.abs(diff)} bpm ${diff < 0 ? "lower" : "higher"} than your usual ${kind} (${usual} bpm).`;
  return { kind, usualHr: usual, diff, samples: same.length, text };
}
