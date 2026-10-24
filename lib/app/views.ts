/**
 * View-model builders for screens (server-only). Each returns plain JSON so
 * server components and route handlers can share it.
 */

import "server-only";
import cdc from "@/data/cdc-places-suffolk.json";
import { getStore } from "@/lib/db";
import type {
  FeedItem,
  LeaderboardMetric,
  LeaderboardScope,
  LeaderboardWindow,
  Place,
  Profile,
  Stamp,
} from "@/lib/db/types";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { BADGES } from "@/lib/badges/rules";
import { config } from "@/lib/config";
import { DEFAULT_BOSTON_CENTER, type LatLng } from "@/lib/geo";
import { providerCatalog } from "@/lib/health/providers";
import { goalProgress, stampsOnDates, weeklySummary } from "@/lib/health/summary";
import { computePlaceEffects, computePlaceInsights } from "@/lib/insights/place";
import { computeTrends, recoveryEstimate } from "@/lib/health/trends";
import { buildHealthStory } from "@/lib/health/story";
import { buildLeaderboard, metricValues } from "@/lib/leaderboard";
import { recommend } from "@/lib/recs/score";
import { addDays, nyDate, nyWeekStart, weekDates } from "@/lib/time";
import { dailyFor } from "./health";

export async function getViewer(): Promise<Profile> {
  const p = await getStore().getProfile(DEMO_USER_ID);
  if (!p) throw new Error("Demo user missing");
  return p;
}

export async function friendIdsOf(userId: string): Promise<Set<string>> {
  const fs = await getStore().listFriendships(userId);
  return new Set(
    fs.filter((f) => f.status === "accepted").map((f) => (f.userId === userId ? f.friendId : f.userId)),
  );
}

async function placeMap(): Promise<Map<string, Place>> {
  return new Map((await getStore().getPlaces()).map((p) => [p.id, p]));
}

/** Today's goal progress + this week's stamps for the header rings. */
export async function getToday(userId: string) {
  const store = getStore();
  const now = new Date();
  const today = nyDate(now);
  const weekStart = nyWeekStart(now);
  const [day] = await dailyFor(userId, [today]);
  const goals = await store.getGoals(userId);
  const stamps = await store.getStampsByUser(userId);
  const week = new Set(weekDates(weekStart));
  const weekStamps = stamps.filter((s) => week.has(nyDate(new Date(s.createdAt))));
  const prior = new Set(stamps.filter((s) => nyDate(new Date(s.createdAt)) < weekStart).map((s) => s.placeId));
  const profile = await store.getProfile(userId);
  const firstDay = profile ? nyDate(new Date(profile.createdAt)) : today;
  const dayNumber = Math.max(1, Math.round((Date.parse(today) - Date.parse(firstDay)) / 86_400_000) + 1);
  return { day, progress: goalProgress(goals, day, weekStamps, prior), dayNumber, isDemo: day.isDemo };
}

/** 28 days of merged daily data ending today, oldest first. */
async function last28(userId: string) {
  const today = nyDate(new Date());
  return dailyFor(userId, Array.from({ length: 28 }, (_, i) => addDays(today, i - 27)));
}

export async function getTrends(userId: string) {
  return computeTrends(await last28(userId));
}

export async function getPlaceEffects(userId: string) {
  return computePlaceEffects(await getStore().getStampsByUser(userId), await placeMap());
}

export async function getHealthStory(userId: string) {
  const [trends, weekly, insights, effects, goals] = await Promise.all([
    getTrends(userId),
    getWeekly(userId),
    getInsights(userId),
    getPlaceEffects(userId),
    getStore().getGoals(userId),
  ]);
  const stepGoal = goals.find((g) => g.type === "steps" && g.active)?.target ?? 8000;
  return { trends, weekly, insights, effects, stepGoal, story: buildHealthStory({ trends, weekly, stepGoal, insights, effects }) };
}

export async function getQuests(userId: string, pos: LatLng | null, limit = 5) {
  const store = getStore();
  const today = await getToday(userId);
  const recovery = recoveryEstimate(await dailyFor(userId, Array.from({ length: 15 }, (_, i) => addDays(nyDate(new Date()), i - 14))));
  const remaining: { steps?: number; activeKcal?: number; zoneMinutes?: number } = {};
  for (const p of today.progress) {
    if (p.goal.type === "steps") remaining.steps = p.remaining;
    if (p.goal.type === "active_kcal") remaining.activeKcal = p.remaining;
    if (p.goal.type === "zone_minutes") remaining.zoneMinutes = p.remaining;
  }
  const quests = recommend(
    {
      places: await store.getPlaces(),
      userId,
      userPos: pos ?? DEFAULT_BOSTON_CENTER,
      userStamps: await store.getStampsByUser(userId),
      allStamps: await store.getAllStamps(),
      friendIds: await friendIdsOf(userId),
      remaining,
      recovery: recovery?.level ?? null,
    },
    limit,
  );
  return { quests, today, recovery, usedDefaultPosition: !pos };
}

export async function getWeekly(userId: string, weekOffset = 0) {
  const store = getStore();
  const weekStart = addDays(nyWeekStart(new Date()), -7 * weekOffset);
  const dates = weekDates(weekStart);
  const days = await dailyFor(userId, dates);
  const stamps = stampsOnDates(await store.getStampsByUser(userId), dates);
  return weeklySummary(weekStart, days, stamps);
}

export async function getInsights(userId: string) {
  return computePlaceInsights(await getStore().getStampsByUser(userId), await placeMap());
}

export function getCdcBaseline() {
  return cdc;
}

export async function getBadges(userId: string) {
  const earned = new Map((await getStore().getUserBadges(userId)).map((b) => [b.badgeId, b.earnedAt]));
  return BADGES.map((b) => ({ ...b, earnedAt: earned.get(b.slug) ?? null }));
}

export async function getConnectionsView(userId: string) {
  const conns = await getStore().getConnections(userId);
  return providerCatalog(config).map((p) => {
    const c = conns.find((x) => x.provider === p.id);
    // Never send tokens to the client: only connection status + import summary.
    return { ...p, connected: Boolean(c), connectedAt: c?.connectedAt ?? null, meta: c?.meta ?? null };
  });
}

export async function getLeaderboard(
  userId: string,
  scope: LeaderboardScope,
  window: LeaderboardWindow,
  metric: LeaderboardMetric,
) {
  const store = getStore();
  let profiles = await store.listProfiles();
  if (scope === "friends") {
    const friends = await friendIdsOf(userId);
    profiles = profiles.filter((p) => p.id === userId || friends.has(p.id));
  }
  const ids = profiles.map((p) => p.id);
  const now = new Date();
  const weekStart = nyWeekStart(now);
  const all = await store.getAllStamps();

  const range = (start: string, days: number) => weekDates(start).slice(0, days);
  const windowDates = window === "week" ? range(weekStart, 7) : Array.from({ length: 28 }, (_, i) => addDays(nyDate(now), -i));
  const prevDates = window === "week" ? range(addDays(weekStart, -7), 7) : null;

  async function stepsFor(dates: string[]) {
    const m = new Map<string, number>();
    for (const id of ids) {
      const days = await dailyFor(id, dates);
      m.set(id, days.reduce((s, d) => s + (d.values.steps ?? 0), 0));
    }
    return m;
  }
  const inDates = (dates: string[]) => {
    const set = new Set(dates);
    return all.filter((s) => set.has(nyDate(new Date(s.createdAt))));
  };
  const stamps = window === "week" ? inDates(windowDates) : all;
  const steps = metric === "steps" ? await stepsFor(windowDates) : new Map<string, number>();
  let previous: Map<string, number> | undefined;
  if (prevDates) {
    const prevSteps = metric === "steps" ? await stepsFor(prevDates) : new Map<string, number>();
    previous = metricValues(inDates(prevDates), prevSteps, metric, ids);
  }
  const rows = buildLeaderboard({ profiles, stamps, steps, previous, metric });
  const emoji = new Map(profiles.map((p) => [p.id, p.avatarEmoji]));
  return rows.map((r) => ({ ...r, avatarEmoji: emoji.get(r.userId) ?? "🙂", isViewer: r.userId === userId }));
}

export async function getFeed(userId: string): Promise<(FeedItem & { avatarEmoji: string; placeName: string; neighborhood: string | null })[]> {
  const store = getStore();
  const friends = await friendIdsOf(userId);
  const profiles = new Map((await store.listProfiles()).map((p) => [p.id, p]));
  const places = await placeMap();
  const stamps = (await store.getAllStamps())
    .filter((s) => s.userId === userId || friends.has(s.userId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 40);
  const kudos = await store.listKudos(stamps.map((s) => s.id));
  return stamps.map((s: Stamp) => {
    const p = profiles.get(s.userId);
    const place = places.get(s.placeId);
    const k = kudos.filter((x) => x.stampId === s.id);
    return {
      stampId: s.id,
      userId: s.userId,
      username: p?.username ?? "someone",
      avatarUrl: null,
      avatarEmoji: p?.avatarEmoji ?? "🙂",
      card: s.card,
      rarity: s.rarity,
      photoPath: s.photoPath,
      healthSnapshot: s.healthSnapshot,
      // Routes stay private by default; no mini-map unless the user opts in.
      routeMiniMap: null,
      kudosCount: k.length,
      viewerGaveKudos: k.some((x) => x.userId === userId),
      createdAt: s.createdAt,
      placeName: place?.name ?? s.card.name,
      neighborhood: place?.neighborhood ?? null,
    };
  });
}

export async function getFriendsView(userId: string) {
  const store = getStore();
  const fs = await store.listFriendships(userId);
  const profiles = new Map((await store.listProfiles()).map((p) => [p.id, p]));
  return fs.map((f) => {
    const otherId = f.userId === userId ? f.friendId : f.userId;
    const p = profiles.get(otherId);
    return {
      userId: otherId,
      username: p?.username ?? otherId,
      avatarEmoji: p?.avatarEmoji ?? "🙂",
      status: f.status,
      incoming: f.status === "pending" && f.friendId === userId,
    };
  });
}

/** Dex entries: the viewer's latest stamp per place, plus locked slots. */
export async function getDex(userId: string) {
  const store = getStore();
  const stamps = await store.getStampsByUser(userId);
  const latest = new Map<string, Stamp>();
  const visits = new Map<string, number>();
  for (const s of stamps) {
    latest.set(s.placeId, s);
    visits.set(s.placeId, (visits.get(s.placeId) ?? 0) + 1);
  }
  return (await store.getPlaces()).map((place) => ({
    placeId: place.id,
    locked: !latest.has(place.id),
    stamp: latest.get(place.id) ?? null,
    place,
    visits: visits.get(place.id) ?? 0,
  }));
}
