import { describe, expect, it } from "vitest";
import { AppleHealthParser, appleDaily, appleSnapshot, parseAppleDate, parseAppleHealthXml } from "@/lib/health/apple";
import { mergeSnapshots } from "@/lib/health/merge";
import { zoneFor, zoneMinutesFromSamples, zone2Plus } from "@/lib/health/zones";
import { demoRouteSnapshot } from "@/lib/health/demo";
import { computePlaceInsight, comparable, slope } from "@/lib/insights/place";
import { goalProgress, mergeDaily, weeklySummary } from "@/lib/health/summary";
import type { Goal, HealthSnapshot, Place, Stamp } from "@/lib/db/types";

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<HealthData locale="en_US">
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" startDate="2026-10-20 09:00:00 -0400" endDate="2026-10-20 09:10:00 -0400" value="1200"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" startDate="2026-10-20 09:10:00 -0400" endDate="2026-10-20 09:20:00 -0400" value="800"/>
 <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Watch" unit="count/min" startDate="2026-10-20 09:05:00 -0400" endDate="2026-10-20 09:05:00 -0400" value="120"/>
 <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Watch" unit="count/min" startDate="2026-10-20 09:15:00 -0400" endDate="2026-10-20 09:15:00 -0400" value="140"/>
 <Record type="HKQuantityTypeIdentifierActiveEnergyBurned" sourceName="Watch" unit="kcal" startDate="2026-10-20 09:00:00 -0400" endDate="2026-10-20 09:20:00 -0400" value="95"/>
 <Record type="HKQuantityTypeIdentifierOxygenSaturation" sourceName="Watch" unit="%" startDate="2026-10-20 09:12:00 -0400" endDate="2026-10-20 09:12:00 -0400" value="0.97"/>
 <Record type="HKQuantityTypeIdentifierDistanceWalkingRunning" sourceName="iPhone" unit="mi" startDate="2026-10-20 09:00:00 -0400" endDate="2026-10-20 09:20:00 -0400" value="1"/>
 <Record type="HKQuantityTypeIdentifierBodyMass" sourceName="Scale" unit="lb" startDate="2026-10-20 08:00:00 -0400" endDate="2026-10-20 08:00:00 -0400" value="160"/>
</HealthData>`;

describe("Apple Health export parser", () => {
  it("parses Apple's date format with offsets", () => {
    expect(parseAppleDate("2026-10-20 09:00:00 -0400")).toBe(Date.parse("2026-10-20T13:00:00Z"));
  });

  it("keeps supported record types and converts units", () => {
    const recs = parseAppleHealthXml(XML);
    expect(recs).toHaveLength(7); // BodyMass is ignored
    expect(recs.find((r) => r.kind === "spo2")?.value).toBeCloseTo(97);
    expect(recs.find((r) => r.kind === "distance")?.value).toBeCloseTo(1609.344);
  });

  it("handles records split across stream chunks", () => {
    const p = new AppleHealthParser(0);
    for (let i = 0; i < XML.length; i += 37) p.push(XML.slice(i, i + 37));
    expect(p.finish()).toHaveLength(7);
  });

  it("builds a check-in snapshot for a time window", () => {
    const recs = parseAppleHealthXml(XML);
    const snap = appleSnapshot(recs, new Date("2026-10-20T13:00:00Z"), new Date("2026-10-20T13:20:00Z"))!;
    expect(snap.steps).toBe(2000);
    expect(snap.hrAvg).toBe(130);
    expect(snap.hrMax).toBe(140);
    expect(snap.activeKcal).toBe(95);
    expect(snap.spo2Avg).toBe(97);
    expect(snap.isDemo).toBe(false);
  });

  it("prorates interval records that only partly overlap the window", () => {
    const recs = parseAppleHealthXml(XML);
    const snap = appleSnapshot(recs, new Date("2026-10-20T13:00:00Z"), new Date("2026-10-20T13:05:00Z"))!;
    expect(snap.steps).toBe(600);
  });

  it("aggregates daily totals", () => {
    const [day] = appleDaily(parseAppleHealthXml(XML));
    expect(day.date).toBe("2026-10-20");
    expect(day.steps).toBe(2000);
  });
});

describe("heart-rate zones", () => {
  it("bins by % of max HR", () => {
    expect(zoneFor(100, 200)).toBe(1);
    expect(zoneFor(130, 200)).toBe(2);
    expect(zoneFor(185, 200)).toBe(5);
    expect(zoneFor(90, 200)).toBe(0);
  });

  it("counts minutes between samples, capping gaps", () => {
    const t0 = 0;
    const z = zoneMinutesFromSamples(
      [
        { t: t0, bpm: 130 },
        { t: t0 + 10 * 60_000, bpm: 150 },
        { t: t0 + 12 * 60_000, bpm: 150 },
      ],
      200,
    );
    expect(z.z2).toBe(5); // 10-minute gap capped at 5
    expect(z.z3).toBe(3);
    expect(zone2Plus(z)).toBe(8);
  });
});

describe("snapshot merge", () => {
  const base = { from: "2026-10-20T13:00:00Z", to: "2026-10-20T13:20:00Z" };
  it("prefers real device data over demo data and estimates", () => {
    const est: HealthSnapshot = { ...base, source: "demo", steps: 1500, stepsEstimated: true, distanceM: 1100, isDemo: false };
    const demo: HealthSnapshot = { ...base, source: "demo", steps: 1700, hrAvg: 120, isDemo: true };
    const apple: HealthSnapshot = { ...base, source: "apple_export", steps: 1800, isDemo: false };
    const m = mergeSnapshots([est, demo, apple])!;
    expect(m.steps).toBe(1800);
    expect(m.fieldSources?.steps).toBe("apple_export");
    expect(m.hrAvg).toBe(120);
    expect(m.fieldSources?.hrAvg).toBe("demo");
    expect(m.isDemo).toBe(true);
  });

  it("labels estimated steps as est.", () => {
    const est: HealthSnapshot = { ...base, source: "demo", steps: 1500, stepsEstimated: true, isDemo: false };
    const m = mergeSnapshots([est])!;
    expect(m.fieldSources?.steps).toBe("est");
    expect(m.stepsEstimated).toBe(true);
  });

  it("returns null with no data", () => {
    expect(mergeSnapshots([null, undefined])).toBeNull();
  });
});

describe("demo provider", () => {
  it("is deterministic and labeled demo", () => {
    const input = { seed: "x", from: new Date(0), to: new Date(15 * 60_000), distanceM: 1200 };
    expect(demoRouteSnapshot(input)).toEqual(demoRouteSnapshot(input));
    expect(demoRouteSnapshot(input).isDemo).toBe(true);
  });
});

const place: Place = {
  id: "p1", name: "Esplanade", lat: 42.35, lng: -71.07, neighborhood: "Back Bay", category: "park",
  source: "seed", createdBy: null, firstCollectedAt: null, collectCount: 0, baselineRarity: "common",
};

function visit(day: number, hr: number, distanceM = 3000, durationMin = 18): Stamp {
  return {
    id: `s${day}`, userId: "u", placeId: "p1", routeId: null, photoPath: null,
    card: { name: "Esplanade", category: "park", rarity: "common", source: "seed" },
    rarity: "common", points: 10,
    healthSnapshot: { source: "demo", from: "", to: "", hrAvg: hr, distanceM, durationMin, isDemo: true },
    createdAt: new Date(Date.UTC(2026, 9, day)).toISOString(),
  };
}

describe("place insights", () => {
  it("fits a slope", () => {
    expect(slope([{ x: 0, y: 10 }, { x: 1, y: 8 }, { x: 2, y: 6 }])).toBeCloseTo(-2);
  });

  it("reports HR down at the same pace", () => {
    const i = computePlaceInsight([visit(1, 152), visit(5, 149), visit(9, 147), visit(13, 146)], place)!;
    expect(i.deltaBpm).toBe(-6);
    expect(i.comparableVisits).toBe(4);
    expect(i.text).toContain("down 6 bpm");
    expect(i.text).toContain("same pace");
  });

  it("drops visits at a different pace", () => {
    const visits = [visit(1, 120, 3000, 40), visit(5, 150), visit(9, 148)];
    const i = computePlaceInsight(visits, place)!;
    expect(i.comparableVisits).toBe(2);
    expect(comparable([{ t: 0, hr: 1, pace: 13 }, { t: 1, hr: 1, pace: 6 }].map((v) => ({ ...v, isDemo: false })))).toHaveLength(1);
  });

  it("needs at least two visits", () => {
    expect(computePlaceInsight([visit(1, 150)], place)).toBeNull();
  });
});

describe("daily merge and goals", () => {
  it("prefers non-demo values per field", () => {
    const d = mergeDaily("2026-10-20", [
      { date: "2026-10-20", source: "demo", isDemo: true, steps: 9000, restingHr: 60 },
      { date: "2026-10-20", source: "apple_export", isDemo: false, steps: 7000 },
    ]);
    expect(d.values.steps).toBe(7000);
    expect(d.sources.steps).toBe("apple_export");
    expect(d.values.restingHr).toBe(60);
  });

  it("computes progress and remaining", () => {
    const goals: Goal[] = [
      { id: "g1", userId: "u", type: "steps", target: 8000, period: "day", active: true },
      { id: "g2", userId: "u", type: "explore", target: 3, period: "week", active: true },
      { id: "g3", userId: "u", type: "recovery", target: 2, period: "week", active: false },
    ];
    const day = mergeDaily("2026-10-20", [{ date: "2026-10-20", source: "demo", isDemo: true, steps: 6000 }]);
    const p = goalProgress(goals, day, [visit(20, 120)], new Set());
    expect(p).toHaveLength(2);
    expect(p[0].remaining).toBe(2000);
    expect(p[0].pct).toBeCloseTo(0.75);
    expect(p[1].current).toBe(1);
  });

  it("summarizes a week", () => {
    const days = ["2026-10-19", "2026-10-20"].map((date) =>
      mergeDaily(date, [{ date, source: "demo", isDemo: true, steps: 9000, zoneMinutes: 25, spo2Avg: 97 }]),
    );
    const w = weeklySummary("2026-10-19", days, []);
    expect(w.totals.steps).toBe(18000);
    expect(w.totals.zoneMinutes).toBe(50);
    expect(w.averages.spo2Avg).toBe(97);
    expect(w.activeDays).toBe(2);
    expect(w.isDemo).toBe(true);
  });
});
