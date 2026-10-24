/**
 * The `Store` interface (design.md §4).
 *
 * Route handlers and server components depend only on this interface via
 * `getStore()`, so they never branch on whether Supabase or the in-memory demo
 * backend is active. Business rules (points, badges, quests, insights,
 * leaderboards) live in pure modules under `lib/`; the store is plain data
 * access.
 */

import type {
  BoundingBox,
  CreatePlaceInput,
  CreateRouteInput,
  CreateStampInput,
  Friendship,
  Goal,
  HealthConnection,
  Kudos,
  Place,
  Profile,
  ProviderId,
  Route,
  Stamp,
  UserBadge,
} from "./types";
import type { AppleRecord } from "@/lib/health/apple";

export interface Store {
  // Places
  getPlaces(bbox?: BoundingBox): Promise<Place[]>;
  getPlace(id: string): Promise<Place | null>;
  createPlace(input: CreatePlaceInput): Promise<Place>;
  /** Increments collectCount and sets firstCollectedAt on the first collection. */
  recordCollection(placeId: string): Promise<Place | null>;

  // Profiles
  getProfile(id: string): Promise<Profile | null>;
  findProfile(usernameOrInviteCode: string): Promise<Profile | null>;
  listProfiles(): Promise<Profile[]>;
  updateProfile(id: string, patch: Partial<Omit<Profile, "id">>): Promise<Profile>;

  // Stamps
  createStamp(input: CreateStampInput): Promise<Stamp>;
  getStamp(id: string): Promise<Stamp | null>;
  getStampsByUser(userId: string): Promise<Stamp[]>;
  getAllStamps(): Promise<Stamp[]>;

  // Routes (private: never exposed on leaderboards)
  createRoute(input: CreateRouteInput): Promise<Route>;
  getRoute(id: string): Promise<Route | null>;

  // Goals
  getGoals(userId: string): Promise<Goal[]>;
  setGoals(userId: string, goals: Omit<Goal, "id" | "userId">[]): Promise<Goal[]>;

  // Social
  addFriendship(userId: string, friendId: string, status: Friendship["status"]): Promise<Friendship>;
  listFriendships(userId: string): Promise<Friendship[]>;
  toggleKudos(stampId: string, userId: string): Promise<boolean>;
  listKudos(stampIds: string[]): Promise<Kudos[]>;

  // Badges
  getUserBadges(userId: string): Promise<UserBadge[]>;
  awardBadge(userId: string, badgeSlug: string, earnedAt?: string): Promise<boolean>;

  // Health connections (tokens are encrypted, service-role only)
  getConnections(userId: string): Promise<HealthConnection[]>;
  saveConnection(conn: HealthConnection): Promise<void>;
  deleteConnection(userId: string, provider: ProviderId): Promise<void>;
  setAppleRecords(userId: string, records: AppleRecord[]): Promise<void>;
  getAppleRecords(userId: string): Promise<AppleRecord[]>;

  // Account
  deleteAccount(userId: string): Promise<void>;
}
