/**
 * The `Store` interface (design.md §4).
 *
 * Route handlers depend only on this interface via `getStore()`, so they never
 * branch on whether Supabase or the in-memory demo backend is active
 * (REQ-1.6). Two implementations satisfy it: `memoryStore` (demo fallback) and
 * `supabaseStore` (real Postgres + Storage).
 */

import type {
  BoundingBox,
  CreatePlaceInput,
  CreateRouteInput,
  CreateStampInput,
  DexEntry,
  FeedItem,
  Friendship,
  Goal,
  LeaderboardMetric,
  LeaderboardRow,
  LeaderboardScope,
  LeaderboardWindow,
  Place,
  Route,
  Stamp,
  Badge,
} from "./types";

export interface Store {
  // Places
  getPlaces(bbox?: BoundingBox): Promise<Place[]>;
  getPlace(id: string): Promise<Place | null>;
  createPlace(input: CreatePlaceInput): Promise<Place>;
  /**
   * Record a collection at a place (design.md §7 step 8): increments
   * `collectCount` and sets `firstCollectedAt` on the first ever collection.
   * Returns the updated place. No-op-safe if the id is unknown (returns null).
   */
  recordCollection(placeId: string): Promise<Place | null>;

  // Stamps / Dex
  createStamp(input: CreateStampInput): Promise<Stamp>;
  getStampsByUser(userId: string): Promise<Stamp[]>;
  getDexForUser(userId: string, nearbyPlaceIds?: string[]): Promise<DexEntry[]>;

  // Routes
  createRoute(input: CreateRouteInput): Promise<Route>;

  // Goals
  getGoals(userId: string): Promise<Goal[]>;
  upsertGoal(goal: Omit<Goal, "id"> & { id?: string }): Promise<Goal>;

  // Leaderboards (never expose location — design.md §13)
  getLeaderboard(
    scope: LeaderboardScope,
    window: LeaderboardWindow,
    metric: LeaderboardMetric,
    userId?: string,
  ): Promise<LeaderboardRow[]>;

  // Social
  addFriend(userId: string, friendUsernameOrCode: string): Promise<Friendship>;
  acceptFriend(userId: string, friendId: string): Promise<Friendship>;
  listFriends(userId: string): Promise<Friendship[]>;
  getFeed(userId: string): Promise<FeedItem[]>;
  addKudos(stampId: string, userId: string): Promise<void>;

  // Badges
  listBadges(): Promise<Badge[]>;
  awardBadge(userId: string, badgeSlug: string): Promise<void>;

  // Account
  deleteAccount(userId: string): Promise<void>;
}
