import { describe, expect, it } from "vitest";
import { compareToUsual, goalImpact, paceMinPerKm } from "@/lib/health/checkin";
import { demoLiveHr } from "@/lib/health/demo";
import type { GoalProgress } from "@/lib/health/summary";
import type { HealthSnapshot, Stamp } from "@/lib/db/types";

const snap = (hrAvg: number, distanceM: number, durationMin: number): HealthSnapshot => ({
  source: "demo", from: "", to: "", isDemo: true, hrAvg, distanceM, durationMin, steps: 1600, activeKcal: 70,
  hrZoneMinutes: { z1: 3, z2: 9, z3: 1, z4: 0, z5: 0 },
});

const stamp = (i: number, h: HealthSnapshot): Stamp => ({
  id: `s${i}`, userId: "u", placeId: `p${i}`, routeId: null, photoPath: null,
  card: { name: "x", category: "park", rarity: "common", source: "seed" }, rarity: "common", points: 10,
  healthSnapshot: h, createdAt: "2026-10-20T12:00:00Z",
});

const progress = (type: GoalProgress["goal"]["type"], target: number, pct: number, period: "day" | "week" = "day"): GoalProgress => ({
  goal: { id: type, userId: "u", type, target, period, active: true },
  current: Math.round(target * pct), pct, remaining: Math.round(target * (1 - pct)), source: "demo",
});

describe("goal impact", () => {
  it("reports what the walk added to each daily goal", () => {
    const impact = goalImpact(snap(120, 1100, 14), [
      progress("steps", 8000, 0.8),
      progress("active_kcal", 400, 1),
      progress("zone_minutes", 30, 0.5),
      progress("explore", 3, 0.33, "week"),
    ]);
    expect(impact.map((g) => g.type)).toEqual(["steps", "active_kcal", "zone_minutes"]);
    expect(impact[0]).toMatchObject({ amount: 1600, pctOfTarget: 0.2, done: false });
    expect(impact[1].done).toBe(true);
    expect(impact[2].amount).toBe(10);
  });

  it("is empty without a snapshot", () => {
    expect(goalImpact(null, [progress("steps", 8000, 0.5)])).toEqual([]);
  });
});

describe("compare to usual", () => {
  it("compares walks with walks", () => {
    const earlier = [stamp(1, snap(124, 1500, 19)), stamp(2, snap(120, 1200, 15)), stamp(3, snap(150, 3000, 18))];
    const c = compareToUsual(snap(116, 1100, 14), earlier)!;
    expect(c.kind).toBe("walk");
    expect(c.usualHr).toBe(122);
    expect(c.diff).toBe(-6);
    expect(c.samples).toBe(2);
    expect(c.text).toBe("6 bpm lower than your usual walk (122 bpm).");
  });

  it("needs two earlier check-ins of the same kind", () => {
    expect(compareToUsual(snap(116, 1100, 14), [stamp(1, snap(150, 3000, 18))])).toBeNull();
  });

  it("computes pace only for real distances", () => {
    expect(paceMinPerKm(snap(1, 2000, 25))).toBe(12.5);
    expect(paceMinPerKm(snap(1, 100, 5))).toBeNull();
  });
});

describe("demo live heart rate", () => {
  it("warms up and runs higher than walking", () => {
    const start = demoLiveHr("u", 0, 12);
    const walk = demoLiveHr("u", 10, 12);
    const run = demoLiveHr("u", 10, 6);
    expect(walk).toBeGreaterThan(start + 20);
    expect(run).toBeGreaterThan(walk + 15);
  });
});
