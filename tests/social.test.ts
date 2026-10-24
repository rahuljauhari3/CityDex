import { describe, expect, it } from "vitest";
import { buildMilestones, capMilestones, milestoneId, milestoneOwner } from "@/lib/social/milestones";
import { weeklyChallenges, type MemberWeek } from "@/lib/social/challenges";
import type { MergedDay } from "@/lib/health/summary";
import type { Profile } from "@/lib/db/types";
import type { PlaceInsight } from "@/lib/insights/place";

const profile: Profile = {
  id: "demo_maya", username: "maya", avatarUrl: null, homeNeighborhood: null, showRouteMap: false, createdAt: "",
  avatarEmoji: "🦊", age: 27, inviteCode: "CDX-MAYA", consentedAt: null, onboardedAt: null, isDemo: true,
};

const day = (date: string, steps: number, zoneMinutes: number): MergedDay => ({
  date, values: { steps, zoneMinutes }, sources: { steps: "demo", zoneMinutes: "demo" }, isDemo: true,
});

describe("milestone ids", () => {
  it("round-trips the owner even with underscores in user ids", () => {
    const id = milestoneId("demo_maya", "badge", "10k-club");
    expect(milestoneOwner(id, ["demo-user", "demo_maya", "demo_m"])).toBe("demo_maya");
    expect(milestoneOwner("stamp_1", ["demo_maya"])).toBeNull();
  });
});

describe("health milestones", () => {
  const week = [day("2026-10-19", 9000, 60), day("2026-10-20", 11_200, 50), day("2026-10-21", 7000, 45)];
  const insight = {
    placeId: "seed_charles_esplanade", placeName: "Charles River Esplanade", deltaBpm: -6, comparableVisits: 4, isDemo: true,
    history: [{ date: "2026-10-20T11:00:00Z", hr: 146, pace: 6.3, comparable: true }],
  } as unknown as PlaceInsight;

  const ms = buildMilestones({
    profile,
    badges: [
      { userId: "demo_maya", badgeId: "10k-club", earnedAt: "2026-10-20T16:00:00Z" },
      { userId: "demo_maya", badgeId: "first-steps", earnedAt: "2026-10-20T16:00:00Z" },
    ],
    week,
    insights: [insight],
    weekStart: "2026-10-19",
    since: Date.parse("2026-10-18T00:00:00Z"),
  });

  it("includes health badges only, 10K days, the 150-minute week and fitness gains", () => {
    const kinds = ms.map((m) => m.kind).sort();
    expect(kinds).toEqual(["badge", "cardio150", "insight", "steps10k"]);
    expect(ms.find((m) => m.kind === "steps10k")?.title).toBe("walked 11,200 steps");
    expect(ms.find((m) => m.kind === "cardio150")?.at).toBe(new Date("2026-10-21T12:00:00-04:00").toISOString());
    expect(ms.find((m) => m.kind === "insight")?.detail).toMatch(/down 6 bpm/);
  });

  it("caps each person's milestones, most meaningful first", () => {
    const capped = capMilestones(ms, 2);
    expect(capped.map((m) => m.kind)).toEqual(["insight", "cardio150"]);
  });

  it("drops anything older than `since`", () => {
    const recent = buildMilestones({ profile, badges: [], week, insights: [], weekStart: "2026-10-19", since: Date.parse("2026-10-21T00:00:00Z") });
    expect(recent.map((m) => m.kind)).toEqual(["cardio150"]);
  });
});

describe("weekly challenges", () => {
  const member = (userId: string, steps: number, cardioMinutes: number, greenVisits: number): MemberWeek => ({
    userId, username: userId, avatarEmoji: "🙂", steps, cardioMinutes, greenVisits, activeDays: 3, isViewer: userId === "you",
  });

  it("adds group steps and counts who finished the each-challenges", () => {
    const [steps, cardio, green] = weeklyChallenges([member("you", 50_000, 160, 1), member("maya", 40_000, 90, 3)]);
    expect(steps.target).toBe(120_000);
    expect(steps.progress).toBe(90_000);
    expect(steps.pct).toBeCloseTo(0.75);
    expect(cardio.progress).toBe(1);
    expect(cardio.rows[0]).toMatchObject({ userId: "you", done: true });
    expect(green.progress).toBe(1);
    expect(green.rows[0].userId).toBe("maya");
  });

  it("is empty with no members", () => {
    expect(weeklyChallenges([])).toEqual([]);
  });
});
