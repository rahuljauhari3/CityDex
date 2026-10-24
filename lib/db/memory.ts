/**
 * In-memory demo store (design.md §4).
 *
 * Process-memory maps used when Supabase is not configured, so the full demo
 * flow works with no keys (REQ-1.6, REQ-1.7). Seeded data and the richer
 * queries land in later milestones; this M0 skeleton implements the `Store`
 * surface with empty/simple behavior so route handlers compile and the app
 * runs.
 */

import type { Store } from "./store";
import type {
  Badge,
  BoundingBox,
  CreatePlaceInput,
  CreateRouteInput,
  CreateStampInput,
  DexEntry,
  FeedItem,
  Friendship,
  Goal,
  LeaderboardRow,
  Place,
  Route,
  Stamp,
} from "./types";

function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

interface MemoryDb {
  places: Map<string, Place>;
  stamps: Map<string, Stamp>;
  routes: Map<string, Route>;
  goals: Map<string, Goal>;
  friendships: Friendship[];
  kudos: Set<string>; // `${stampId}:${userId}`
  badges: Map<string, Badge>;
  userBadges: Set<string>; // `${userId}:${badgeSlug}`
}

/** Single shared instance for the process lifetime. */
const db: MemoryDb = {
  places: new Map(),
  stamps: new Map(),
  routes: new Map(),
  goals: new Map(),
  friendships: [],
  kudos: new Set(),
  badges: new Map(),
  userBadges: new Set(),
};

function inBbox(place: Place, bbox: BoundingBox): boolean {
  return (
    place.lat >= bbox.minLat &&
    place.lat <= bbox.maxLat &&
    place.lng >= bbox.minLng &&
    place.lng <= bbox.maxLng
  );
}

export const memoryStore: Store = {
  async getPlaces(bbox) {
    const all = [...db.places.values()];
    return bbox ? all.filter((p) => inBbox(p, bbox)) : all;
  },

  async getPlace(placeId) {
    return db.places.get(placeId) ?? null;
  },

  async createPlace(input: CreatePlaceInput) {
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
    };
    db.places.set(place.id, place);
    return place;
  },

  async createStamp(input: CreateStampInput) {
    const stamp: Stamp = {
      id: id("stamp"),
      userId: input.userId,
      placeId: input.placeId,
      routeId: input.routeId ?? null,
      photoPath: input.photoPath ?? null,
      card: input.card,
      rarity: input.rarity,
      points: input.points,
      healthSnapshot: input.healthSnapshot ?? null,
      createdAt: nowIso(),
    };
    db.stamps.set(stamp.id, stamp);
    return stamp;
  },

  async getStampsByUser(userId) {
    return [...db.stamps.values()].filter((s) => s.userId === userId);
  },

  async getDexForUser(userId, nearbyPlaceIds) {
    const owned = new Map(
      [...db.stamps.values()]
        .filter((s) => s.userId === userId)
        .map((s) => [s.placeId, s]),
    );
    const placeIds = nearbyPlaceIds ?? [...db.places.keys()];
    const entries: DexEntry[] = [];
    for (const placeId of placeIds) {
      const place = db.places.get(placeId);
      if (!place) continue;
      const stamp = owned.get(placeId) ?? null;
      entries.push({ placeId, locked: !stamp, stamp, place });
    }
    return entries;
  },

  async createRoute(input: CreateRouteInput) {
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
    db.routes.set(route.id, route);
    return route;
  },

  async getGoals(userId) {
    return [...db.goals.values()].filter((g) => g.userId === userId);
  },

  async upsertGoal(goal) {
    const resolved: Goal = { ...goal, id: goal.id ?? id("goal") };
    db.goals.set(resolved.id, resolved);
    return resolved;
  },

  async getLeaderboard(): Promise<LeaderboardRow[]> {
    // Aggregation lands in M4. Location is never included here.
    return [];
  },

  async addFriend(userId, friendUsernameOrCode) {
    const friendship: Friendship = {
      userId,
      friendId: friendUsernameOrCode,
      status: "pending",
      createdAt: nowIso(),
    };
    db.friendships.push(friendship);
    return friendship;
  },

  async acceptFriend(userId, friendId) {
    const friendship = db.friendships.find(
      (f) => f.userId === userId && f.friendId === friendId,
    );
    if (!friendship) {
      throw new Error("Friendship not found");
    }
    friendship.status = "accepted";
    return friendship;
  },

  async listFriends(userId) {
    return db.friendships.filter(
      (f) => f.userId === userId || f.friendId === userId,
    );
  },

  async getFeed(): Promise<FeedItem[]> {
    // Feed assembly lands in M6.
    return [];
  },

  async addKudos(stampId, userId) {
    db.kudos.add(`${stampId}:${userId}`);
  },

  async listBadges() {
    return [...db.badges.values()];
  },

  async awardBadge(userId, badgeSlug) {
    db.userBadges.add(`${userId}:${badgeSlug}`);
  },

  async deleteAccount(userId) {
    for (const [key, stamp] of db.stamps) {
      if (stamp.userId === userId) db.stamps.delete(key);
    }
    for (const [key, route] of db.routes) {
      if (route.userId === userId) db.routes.delete(key);
    }
    for (const [key, goal] of db.goals) {
      if (goal.userId === userId) db.goals.delete(key);
    }
    db.friendships = db.friendships.filter(
      (f) => f.userId !== userId && f.friendId !== userId,
    );
  },
};
