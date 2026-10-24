import { describe, expect, it } from "vitest";
import { computePoints } from "@/lib/points/compute";
import { evaluateBadges } from "@/lib/badges/rules";
import { fit, recommend } from "@/lib/recs/score";
import { buildLeaderboard } from "@/lib/leaderboard";
import { buildDemoWorld } from "@/lib/demo/seed";
import { getSeedPlaces } from "@/data/seed/places";
import type { Place, Profile, Stamp } from "@/lib/db/types";

describe("points", () => {
  it("adds rarity, discoverer, movement and effort", () => {
    const p = computePoints({ rarity: "rare", firstDiscoverer: true, steps: 2180, zone2PlusMinutes: 18, recommended: false, repeatVisit: false });
    expect(p).toMatchObject({ base: 50, discoverer: 50, movement: 21, effort: 36, total: 157 });
  });

  it("caps movement and effort", () => {
    const p = computePoints({ rarity: "common", firstDiscoverer: false, steps: 50_000, zone2PlusMinutes: 90, recommended: false, repeatVisit: false });
    expect(p.movement).toBe(100);
    expect(p.effort).toBe(60);
  });

  it("applies the quest multiplier", () => {
    const p = computePoints({ rarity: "uncommon", firstDiscoverer: false, steps: 1000, zone2PlusMinutes: 0, recommended: true, repeatVisit: false });
    expect(p.total).toBe(Math.round((25 + 10) * 1.5));
  });

  it("gives repeat visits only the health bonuses", () => {
    const p = computePoints({ rarity: "legendary", firstDiscoverer: true, steps: 1000, zone2PlusMinutes: 10, recommended: false, repeatVisit: true });
    expect(p).toMatchObject({ base: 0, discoverer: 0, total: 30 });
  });
});

const places = new Map<string, Place>(getSeedPlaces().map((p) => [p.id, p]));

function stamp(i: number, placeId: string, category: Stamp["card"]["category"], createdAt: string, zone2 = 0): Stamp {
  return {
    id: `s${i}`, userId: "u", placeId, routeId: null, photoPath: null,
    card: { name: "x", category, rarity: "common", source: "seed" }, rarity: "common", points: 10,
    healthSnapshot: { source: "demo", from: "", to: "", isDemo: true, hrZoneMinutes: { z1: 0, z2: zone2, z3: 0, z4: 0, z5: 0 } },
    createdAt,
  };
}

describe("badges", () => {
  it("awards first steps, mural hunter and heart of the city", () => {
    const s = [
      stamp(1, "seed_dewey_square_mural", "mural", "2026-10-20T14:00:00Z", 31),
      stamp(2, "seed_graffiti_alley", "mural", "2026-10-21T14:00:00Z"),
      stamp(3, "seed_underground_ink_block", "mural", "2026-10-22T14:00:00Z"),
    ];
    const got = evaluateBadges({ stamps: s, places, daily: [] });
    expect(got).toEqual(expect.arrayContaining(["first-steps", "mural-hunter-1", "heart-of-the-city", "streak-3"]));
    expect(got).not.toContain("streak-7");
  });

  it("awards night owl after 9 pm Boston time and 10K club from daily steps", () => {
    const s = [stamp(1, "seed_boston_common", "park", "2026-10-21T01:30:00Z")]; // 9:30 pm EDT
    const got = evaluateBadges({ stamps: s, places, daily: [{ date: "2026-10-20", source: "demo", isDemo: true, steps: 10_500 }] });
    expect(got).toContain("night-owl");
    expect(got).toContain("10k-club");
  });
});

describe("recommendations", () => {
  it("fit is 1 when expected equals remaining", () => {
    expect(fit(250, 250)).toBe(1);
    expect(fit(100, 400)).toBe(0.25);
    expect(fit(100, 0)).toBe(0);
  });

  it("explains friend signals and prefers novel places", () => {
    const all = [...places.values()];
    const friendStamp = (i: number, userId: string): Stamp => ({
      ...stamp(i, "seed_dewey_square_mural", "mural", "2026-10-20T14:00:00Z"),
      id: `f${i}`,
      userId,
      healthSnapshot: { source: "demo", from: "", to: "", isDemo: true, activeKcal: 300 + i * 10, steps: 3000 },
    });
    const quests = recommend({
      places: all,
      userId: "u",
      userPos: { lat: 42.3554, lng: -71.0656 },
      userStamps: [],
      allStamps: [friendStamp(1, "a"), friendStamp(2, "b"), friendStamp(3, "c")],
      friendIds: new Set(["a", "b", "c"]),
      remaining: { activeKcal: 250 },
    });
    expect(quests).toHaveLength(5);
    const dewey = quests.find((q) => q.place.id === "seed_dewey_square_mural");
    expect(dewey?.reason).toBe("3 friends burned avg 320 kcal getting here");
  });
});

describe("leaderboard", () => {
  const profile = (id: string): Profile => ({
    id, username: id, avatarUrl: null, homeNeighborhood: "Back Bay", showRouteMap: false, createdAt: "",
    avatarEmoji: "🙂", age: 30, inviteCode: id, consentedAt: null, onboardedAt: null, isDemo: true,
  });

  it("ranks by metric and never includes location fields", () => {
    const rows = buildLeaderboard({
      profiles: [profile("a"), profile("b")],
      stamps: [],
      steps: new Map([["a", 5000], ["b", 9000]]),
      previous: new Map([["a", 9000], ["b", 1000]]),
      metric: "steps",
    });
    expect(rows.map((r) => r.userId)).toEqual(["b", "a"]);
    expect(rows[0].rankChange).toBe(1);
    expect(Object.keys(rows[0]).sort()).toEqual(["avatarUrl", "rank", "rankChange", "userId", "username", "value"]);
  });
});

describe("demo world", () => {
  it("seeds 7 users with history, and the demo user can unlock Mural Hunter I live", () => {
    const world = buildDemoWorld(getSeedPlaces(), new Date("2026-10-24T18:00:00Z"));
    expect(world.profiles).toHaveLength(7);
    expect(world.stamps.length).toBeGreaterThan(30);
    const mine = world.stamps.filter((s) => s.userId === "demo-user");
    expect(mine.filter((s) => s.card.category === "mural")).toHaveLength(2);
    expect(world.userBadges.some((b) => b.userId === "demo-user" && b.badgeId === "mural-hunter-1")).toBe(false);
    expect(world.stamps.every((s) => s.healthSnapshot?.isDemo)).toBe(true);
  });
});
