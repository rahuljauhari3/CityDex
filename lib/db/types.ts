/**
 * Domain types shared by every `Store` implementation (design.md §3, §4).
 *
 * These mirror the Postgres tables so the Supabase store and the in-memory demo
 * store expose identical shapes. Pure data only — no I/O here.
 */

import type { StampCard } from "@/lib/stamp/card";

export type { StampCard } from "@/lib/stamp/card";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type PlaceCategory =
  | "mural"
  | "statue"
  | "cafe"
  | "door"
  | "park"
  | "building"
  | "transit"
  | "water"
  | "nature"
  | "shop"
  | "oddity"
  | "other";

export type GoalType =
  | "steps"
  | "active_kcal"
  | "zone_minutes"
  | "explore"
  | "recovery";

export type GoalPeriod = "day" | "week";

export type ProviderId =
  | "demo"
  | "strava"
  | "apple_export"
  | "whoop"
  | "fitbit"
  | "garmin"
  | "samsung";

export type LeaderboardScope = "global" | "friends";
export type LeaderboardWindow = "week" | "all_time";
export type LeaderboardMetric = "steps" | "points" | "stamps";

export type FriendshipStatus = "pending" | "accepted";

export interface Profile {
  id: string;
  username: string;
  avatarUrl: string | null;
  homeNeighborhood: string | null;
  showRouteMap: boolean;
  createdAt: string;
  /** Pixel avatar glyph shown on leaderboards and the feed. */
  avatarEmoji: string;
  /** Used for the 220 − age max-HR estimate behind HR zones. */
  age: number | null;
  inviteCode: string;
  consentedAt: string | null;
  onboardedAt: string | null;
  isDemo: boolean;
}

export interface Goal {
  id: string;
  userId: string;
  type: GoalType;
  target: number;
  period: GoalPeriod;
  active: boolean;
}

export interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
  neighborhood: string | null;
  category: PlaceCategory;
  source: "seed" | "user";
  createdBy: string | null;
  firstCollectedAt: string | null;
  collectCount: number;
  /**
   * Baseline/suggested rarity used to color the place's map marker (REQ-2.3).
   * Per-user stamp rarity is adjusted server-side at check-in (design.md §7).
   */
  baselineRarity: Rarity;
}

export interface Route {
  id: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  distanceM: number;
  polyline: string | null;
  estSteps: number;
  shared: boolean;
}

export interface HealthSnapshot {
  source: ProviderId;
  from: string;
  to: string;
  steps?: number;
  stepsEstimated?: boolean;
  distanceM?: number;
  activeKcal?: number;
  hrAvg?: number;
  hrMax?: number;
  hrZoneMinutes?: { z1: number; z2: number; z3: number; z4: number; z5: number };
  spo2Avg?: number;
  durationMin?: number;
  isDemo: boolean;
  /** Which provider (or "est" for browser estimates) supplied each field. */
  fieldSources?: Partial<Record<HealthField, ProviderId | "est">>;
}

export type HealthField =
  | "steps"
  | "distanceM"
  | "activeKcal"
  | "hrAvg"
  | "hrMax"
  | "hrZoneMinutes"
  | "spo2Avg";

/** One day of totals from a provider (drives goals and weekly summaries). */
export interface DailyHealth {
  date: string; // YYYY-MM-DD (America/New_York)
  source: ProviderId;
  isDemo: boolean;
  steps?: number;
  activeKcal?: number;
  zoneMinutes?: number; // zone 2+ minutes
  restingHr?: number;
  spo2Avg?: number;
  sleepHours?: number;
}

export interface HealthConnection {
  userId: string;
  provider: ProviderId;
  connectedAt: string;
  /** AES-GCM encrypted tokens (server-only, never sent to the client). */
  accessTokenEnc?: string | null;
  refreshTokenEnc?: string | null;
  expiresAt?: string | null;
  scopes?: string | null;
  /** For uploads (Apple export): summary of what was imported. */
  meta?: Record<string, unknown>;
}

export interface Stamp {
  id: string;
  userId: string;
  placeId: string;
  routeId: string | null;
  photoPath: string | null;
  card: StampCard;
  rarity: Rarity;
  points: number;
  pointsBreakdown?: PointsSummary | null;
  /** Attribution when the photo isn't the user's own (seeded demo stamps). */
  photoCredit?: PhotoCredit | null;
  healthSnapshot: HealthSnapshot | null;
  createdAt: string;
}

export interface PhotoCredit {
  author: string;
  license: string;
  licenseUrl: string | null;
  source: string;
}

export interface PointsSummary {
  base: number;
  discoverer: number;
  movement: number;
  effort: number;
  multiplier: number;
  total: number;
}

export interface Badge {
  id: string;
  slug: string;
  name: string;
  description: string;
  rule: Record<string, unknown>;
  icon: string;
}

export interface UserBadge {
  userId: string;
  badgeId: string;
  earnedAt: string;
}

export interface Friendship {
  userId: string;
  friendId: string;
  status: FriendshipStatus;
  createdAt: string;
}

export interface Kudos {
  stampId: string;
  userId: string;
  createdAt: string;
}

/** A Dex grid entry: either an owned stamp or a locked (undiscovered) slot. */
export interface DexEntry {
  placeId: string;
  locked: boolean;
  stamp: Stamp | null;
  place: Place;
}

export interface LeaderboardRow {
  userId: string;
  username: string;
  avatarUrl: string | null;
  value: number;
  rank: number;
  rankChange: number;
}

export interface FeedItem {
  stampId: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  card: StampCard;
  rarity: Rarity;
  photoPath: string | null;
  photoCredit?: PhotoCredit | null;
  healthSnapshot: HealthSnapshot | null;
  routeMiniMap: string | null;
  kudosCount: number;
  viewerGaveKudos: boolean;
  createdAt: string;
}

export interface BoundingBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export interface CreatePlaceInput {
  name: string;
  lat: number;
  lng: number;
  neighborhood?: string | null;
  category: PlaceCategory;
  source: "seed" | "user";
  createdBy?: string | null;
  baselineRarity?: Rarity;
}

export interface CreateStampInput {
  userId: string;
  placeId: string;
  routeId?: string | null;
  photoPath?: string | null;
  card: StampCard;
  rarity: Rarity;
  points: number;
  pointsBreakdown?: PointsSummary | null;
  photoCredit?: PhotoCredit | null;
  healthSnapshot?: HealthSnapshot | null;
  createdAt?: string;
}

export interface CreateRouteInput {
  userId: string;
  startedAt: string;
  endedAt?: string | null;
  distanceM: number;
  polyline?: string | null;
  estSteps: number;
  shared?: boolean;
}
