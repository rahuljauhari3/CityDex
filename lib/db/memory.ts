/**
 * In-memory demo store (design.md §4). Used when Supabase is not configured,
 * so the whole app works with no keys. The DB lives on `globalThis` so it
 * survives dev hot reloads, and is seeded once with Boston places plus the
 * demo world (6 demo users with a week of history).
 */

import { getSeedPlaces } from "@/data/seed/places";
import { buildDemoWorld } from "@/lib/demo/seed";
import type { AppleRecord } from "@/lib/health/apple";
import type { Store } from "./store";
import type {
  Friendship,
  Goal,
  HealthConnection,
  Kudos,
  Place,
  Profile,
  Route,
  Stamp,
  UserBadge,
} from "./types";

function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

interface MemoryDb {
  places: Map<string, Place>;
  profiles: Map<string, Profile>;
  stamps: Map<string, Stamp>;
  routes: Map<string, Route>;
  goals: Map<string, Goal[]>;
  friendships: Friendship[];
  kudos: Kudos[];
  userBadges: UserBadge[];
  connections: HealthConnection[];
  appleRecords: Map<string, AppleRecord[]>;
}

const g = globalThis as unknown as { __citydexDb?: MemoryDb };

function createDb(): MemoryDb {
  const db: MemoryDb = {
    places: new Map(getSeedPlaces().map((p) => [p.id, p])),
    profiles: new Map(),
    stamps: new Map(),
    routes: new Map(),
    goals: new Map(),
    friendships: [],
    kudos: [],
    userBadges: [],
    connections: [],
    appleRecords: new Map(),
  };
  const world = buildDemoWorld([...db.places.values()], new Date());
  for (const p of world.profiles) db.profiles.set(p.id, p);
  for (const s of world.stamps) {
    db.stamps.set(s.id, s);
    const place = db.places.get(s.placeId);
    if (place) {
      place.collectCount += 1;
      if (!place.firstCollectedAt || s.createdAt < place.firstCollectedAt) place.firstCollectedAt = s.createdAt;
    }
  }
  for (const [userId, goals] of world.goals) db.goals.set(userId, goals);
  db.friendships.push(...world.friendships);
  db.kudos.push(...world.kudos);
  db.userBadges.push(...world.userBadges);
  db.connections.push(...world.connections);
  return db;
}

function getDb(): MemoryDb {
  if (!g.__citydexDb) g.__citydexDb = createDb();
  return g.__citydexDb;
}

/** Test helper: rebuild the demo world from scratch. */
export function resetMemoryDb(): void {
  g.__citydexDb = undefined;
}

export const memoryStore: Store = {
  async getPlaces(bbox) {
    const all = [...getDb().places.values()];
    if (!bbox) return all;
    return all.filter(
      (p) => p.lat >= bbox.minLat && p.lat <= bbox.maxLat && p.lng >= bbox.minLng && p.lng <= bbox.maxLng,
    );
  },

  async getPlace(placeId) {
    return getDb().places.get(placeId) ?? null;
  },

  async createPlace(input) {
    const place: Place = {
      id: id("place"),
      name: input.name,
      lat: input.lat,
      lng: input.lng,
      neighborhood: input.neighborhood ?? null,
      category: input.category,
      source: input.source,
      createdBy: input.createdBy ?? null,
      firstCollectedAt: null,
      collectCount: 0,
      baselineRarity: input.baselineRarity ?? "common",
    };
    getDb().places.set(place.id, place);
    return place;
  },

  async recordCollection(placeId) {
    const place = getDb().places.get(placeId);
    if (!place) return null;
    place.collectCount += 1;
    if (!place.firstCollectedAt) place.firstCollectedAt = nowIso();
    return place;
  },

  async getProfile(userId) {
    return getDb().profiles.get(userId) ?? null;
  },

  async findProfile(q) {
    const needle = q.trim().toLowerCase().replace(/^@/, "");
    for (const p of getDb().profiles.values()) {
      if (p.username.toLowerCase() === needle || p.inviteCode.toLowerCase() === needle) return p;
    }
    return null;
  },

  async listProfiles() {
    return [...getDb().profiles.values()];
  },

  async updateProfile(userId, patch) {
    const db = getDb();
    const current = db.profiles.get(userId);
    if (!current) throw new Error("Profile not found");
    const next = { ...current, ...patch };
    db.profiles.set(userId, next);
    return next;
  },

  async createStamp(input) {
    const stamp: Stamp = {
      id: id("stamp"),
      userId: input.userId,
      placeId: input.placeId,
      routeId: input.routeId ?? null,
      photoPath: input.photoPath ?? null,
      card: input.card,
      rarity: input.rarity,
      points: input.points,
      pointsBreakdown: input.pointsBreakdown ?? null,
      photoCredit: input.photoCredit ?? null,
      healthSnapshot: input.healthSnapshot ?? null,
      createdAt: input.createdAt ?? nowIso(),
    };
    getDb().stamps.set(stamp.id, stamp);
    return stamp;
  },

  async getStamp(stampId) {
    return getDb().stamps.get(stampId) ?? null;
  },

  async getStampsByUser(userId) {
    return [...getDb().stamps.values()]
      .filter((s) => s.userId === userId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async getAllStamps() {
    return [...getDb().stamps.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async createRoute(input) {
    const route: Route = {
      id: id("route"),
      userId: input.userId,
      startedAt: input.startedAt,
      endedAt: input.endedAt ?? null,
      distanceM: input.distanceM,
      polyline: input.polyline ?? null,
      estSteps: input.estSteps,
      shared: input.shared ?? false,
    };
    getDb().routes.set(route.id, route);
    return route;
  },

  async getRoute(routeId) {
    return getDb().routes.get(routeId) ?? null;
  },

  async getGoals(userId) {
    return getDb().goals.get(userId) ?? [];
  },

  async setGoals(userId, goals) {
    const rows: Goal[] = goals.map((goal) => ({ ...goal, id: `goal_${userId}_${goal.type}`, userId }));
    getDb().goals.set(userId, rows);
    return rows;
  },

  async addFriendship(userId, friendId, status) {
    const db = getDb();
    const existing = db.friendships.find(
      (f) => (f.userId === userId && f.friendId === friendId) || (f.userId === friendId && f.friendId === userId),
    );
    if (existing) {
      if (status === "accepted") existing.status = "accepted";
      return existing;
    }
    const friendship: Friendship = { userId, friendId, status, createdAt: nowIso() };
    db.friendships.push(friendship);
    return friendship;
  },

  async listFriendships(userId) {
    return getDb().friendships.filter((f) => f.userId === userId || f.friendId === userId);
  },

  async toggleKudos(stampId, userId) {
    const db = getDb();
    const i = db.kudos.findIndex((k) => k.stampId === stampId && k.userId === userId);
    if (i >= 0) {
      db.kudos.splice(i, 1);
      return false;
    }
    db.kudos.push({ stampId, userId, createdAt: nowIso() });
    return true;
  },

  async listKudos(stampIds) {
    const set = new Set(stampIds);
    return getDb().kudos.filter((k) => set.has(k.stampId));
  },

  async getUserBadges(userId) {
    return getDb().userBadges.filter((b) => b.userId === userId);
  },

  async awardBadge(userId, badgeSlug, earnedAt) {
    const db = getDb();
    if (db.userBadges.some((b) => b.userId === userId && b.badgeId === badgeSlug)) return false;
    db.userBadges.push({ userId, badgeId: badgeSlug, earnedAt: earnedAt ?? nowIso() });
    return true;
  },

  async getConnections(userId) {
    return getDb().connections.filter((c) => c.userId === userId);
  },

  async saveConnection(conn) {
    const db = getDb();
    db.connections = db.connections.filter((c) => !(c.userId === conn.userId && c.provider === conn.provider));
    db.connections.push(conn);
  },

  async deleteConnection(userId, provider) {
    const db = getDb();
    db.connections = db.connections.filter((c) => !(c.userId === userId && c.provider === provider));
    if (provider === "apple_export") db.appleRecords.delete(userId);
  },

  async setAppleRecords(userId, records) {
    getDb().appleRecords.set(userId, records);
  },

  async getAppleRecords(userId) {
    return getDb().appleRecords.get(userId) ?? [];
  },

  async deleteAccount(userId) {
    const db = getDb();
    const stampIds = new Set<string>();
    for (const [key, stamp] of db.stamps) {
      if (stamp.userId === userId) {
        stampIds.add(key);
        db.stamps.delete(key);
      }
    }
    for (const [key, route] of db.routes) if (route.userId === userId) db.routes.delete(key);
    db.goals.delete(userId);
    db.friendships = db.friendships.filter((f) => f.userId !== userId && f.friendId !== userId);
    db.kudos = db.kudos.filter((k) => k.userId !== userId && !stampIds.has(k.stampId));
    db.userBadges = db.userBadges.filter((b) => b.userId !== userId);
    db.connections = db.connections.filter((c) => c.userId !== userId);
    db.appleRecords.delete(userId);
    const profile = db.profiles.get(userId);
    if (profile) {
      // The demo identity is recreated fresh so the app keeps working.
      db.profiles.set(userId, { ...profile, consentedAt: null, onboardedAt: null, age: null });
    }
  },
};
