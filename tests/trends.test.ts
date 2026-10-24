import { describe, expect, it } from "vitest";
import { computeTrends, metricTrend, nextDayRestingHrEffect, recoveryEstimate } from "@/lib/health/trends";
import { buildHealthStory } from "@/lib/health/story";
import { computePlaceEffects, computePlaceInsight } from "@/lib/insights/place";
import { weeklySummary, type MergedDay } from "@/lib/health/summary";
import { recommend } from "@/lib/recs/score";
import { getSeedPlaces } from "@/data/seed/places";
import type { Place, Stamp } from "@/lib/db/types";

function day(i: number, v: Partial<MergedDay["values"]>): MergedDay {
  const date = new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10);
  const sources = Object.fromEntries(Object.keys(v).map((k) => [k, "demo"])) as MergedDay["sources"];
  return { date, values: v, sources, isDemo: true };
}

describe("metric trends", () => {
  it("compares this week with last week and fits a slope", () => {
    const days = Array.from({ length: 14 }, (_, i) => day(i, { restingHr: 64 - i * 0.5 }));
    const t = metricTrend(days, "restingHr");
    expect(t.current7).toBeCloseTo(59, 1);
    expect(t.prev7).toBeCloseTo(62.5, 1);
    expect(t.delta).toBeCloseTo(-3.5, 1);
    expect(t.perWeek).toBeCloseTo(-3.5, 1);
    expect(t.series).toHaveLength(14);
  });

  it("leaves gaps for missing days and needs data to compare", () => {
    const t = metricTrend([day(0, {}), day(1, { sleepHours: 7 })], "sleepHours");
    expect(t.series).toEqual([null, 7]);
    expect(t.prev7).toBeNull();
    expect(t.delta).toBeNull();
    expect(t.perWeek).toBeNull();
  });

  it("excludes today's partial steps from the step trend", () => {
    const days = Array.from({ length: 15 }, (_, i) => day(i, { steps: i === 14 ? 500 : 10_000, restingHr: 60 }));
    expect(computeTrends(days).steps.current7).toBe(10_000);
  });
});

describe("recovery estimate", () => {
  const base = Array.from({ length: 14 }, (_, i) => day(i, { restingHr: 60, sleepHours: 7.5, zoneMinutes: 30 }));

  it("is high when resting HR is at baseline and sleep is good", () => {
    const r = recoveryEstimate([...base, day(14, { restingHr: 60, sleepHours: 8 })])!;
    expect(r.score).toBeGreaterThanOrEqual(75);
    expect(r.level).toBe("ready");
  });

  it("drops with elevated resting HR, short sleep and a hard day", () => {
    const hard = [...base.slice(0, 13), day(13, { restingHr: 60, zoneMinutes: 90 })];
    const r = recoveryEstimate([...hard, day(14, { restingHr: 65, sleepHours: 5 })])!;
    expect(r.level).toBe("easy");
    expect(r.factors.map((f) => f.effect).every((e) => e < 0)).toBe(true);
    expect(r.factors).toHaveLength(3);
  });

  it("returns null without resting HR or sleep", () => {
    expect(recoveryEstimate([day(0, { steps: 1000 })])).toBeNull();
  });
});

describe("next-day resting HR effect", () => {
  it("compares mornings after active vs lighter days", () => {
    const days = Array.from({ length: 12 }, (_, i) => {
      const active = i % 2 === 0;
      return day(i, { zoneMinutes: active ? 40 : 5, restingHr: active ? 61 : 58 });
    });
    const e = nextDayRestingHrEffect(days)!;
    expect(e.activeAvg).toBe(58); // mornings after active days
    expect(e.restAvg).toBe(61);
    expect(e.diff).toBe(-3);
  });

  it("needs at least 3 of each", () => {
    expect(nextDayRestingHrEffect([day(0, { zoneMinutes: 40 }), day(1, { restingHr: 58 })])).toBeNull();
  });
});

const places = new Map<string, Place>(getSeedPlaces().map((p) => [p.id, p]));

function visit(i: number, placeId: string, hr: number, zone2: number, distanceM = 2000, durationMin = 25): Stamp {
  const p = places.get(placeId)!;
  return {
    id: `v${i}`, userId: "u", placeId, routeId: null, photoPath: null,
    card: { name: p.name, category: p.category, rarity: "common", source: "seed" }, rarity: "common", points: 10,
    healthSnapshot: {
      source: "demo", from: "", to: "", isDemo: true, hrAvg: hr, distanceM, durationMin, activeKcal: 120,
      hrZoneMinutes: { z1: 5, z2: zone2, z3: 0, z4: 0, z5: 0 },
    },
    createdAt: new Date(Date.UTC(2026, 9, 1 + i)).toISOString(),
  };
}

describe("place effects and visit history", () => {
  const stamps = [
    visit(1, "seed_charles_esplanade", 150, 18, 3200, 20),
    visit(2, "seed_charles_esplanade", 147, 17, 3200, 20),
    visit(3, "seed_boston_common", 108, 3),
    visit(4, "seed_dewey_square_mural", 120, 8),
  ];

  it("finds the best cardio spot and the calmest green walk", () => {
    const e = computePlaceEffects(stamps, places);
    expect(e.places[0].placeId).toBe("seed_charles_esplanade");
    expect(e.places[0].visits).toBe(2);
    expect(e.bestCardio?.placeId).toBe("seed_charles_esplanade");
    expect(e.calmest?.placeId).toBe("seed_boston_common");
    expect(e.places.find((p) => p.placeId === "seed_boston_common")?.kcalPerKm).toBe(60);
  });

  it("includes per-visit history and marks visits at another pace", () => {
    const withSlow = [stamps[0], visit(5, "seed_charles_esplanade", 110, 2, 3200, 45), visit(6, "seed_charles_esplanade", 146, 17, 3200, 20)];
    const i = computePlaceInsight(withSlow, places.get("seed_charles_esplanade")!)!;
    expect(i.history.map((h) => h.hr)).toEqual([150, 110, 146]);
    expect(i.history.map((h) => h.comparable)).toEqual([true, false, true]);
    expect(i.deltaBpm).toBe(-4);
  });
});

describe("health story", () => {
  it("leads with what's going well and explains resting HR changes", () => {
    const days = Array.from({ length: 15 }, (_, i) =>
      day(i, { restingHr: i < 8 ? 62 : 59, sleepHours: 6.2, steps: 9500, zoneMinutes: 25 }),
    );
    const trends = computeTrends(days);
    const weekly = weeklySummary(days[8].date, days.slice(8), []);
    const story = buildHealthStory({
      trends,
      weekly,
      stepGoal: 8000,
      insights: [],
      effects: { places: [], bestCardio: null, calmest: null },
    });
    expect(story[0].tone).toBe("good");
    const rhr = story.find((t) => t.id === "rhr")!;
    expect(rhr.title).toMatch(/Resting HR down/);
    expect(story.find((t) => t.id === "sleep")?.tone).toBe("watch");
    expect(story.find((t) => t.id === "cardio")?.title).toMatch(/guideline/);
    expect(story.every((t) => !/diagnos|disease|treat/i.test(t.title + t.detail))).toBe(true);
  });
});

describe("recovery-aware quests", () => {
  it("favors close green places on easy days", () => {
    const base = {
      places: [...places.values()],
      userId: "u",
      userPos: { lat: 42.3554, lng: -71.0656 },
      userStamps: [],
      allStamps: [],
      friendIds: new Set<string>(),
      remaining: { steps: 6000 },
    };
    const easy = recommend({ ...base, recovery: "easy" });
    const green = new Set(["park", "nature", "water"]);
    expect(green.has(easy[0].place.category)).toBe(true);
    expect(easy[0].distanceM).toBeLessThan(2250);
    expect(easy[0].reason).toBe("Easy recovery walk: green, quiet and close");
    const ready = recommend({ ...base, recovery: "ready" });
    expect(ready.some((q) => q.reason.startsWith("Easy recovery"))).toBe(false);
  });
});
