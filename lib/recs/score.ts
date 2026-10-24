/**
 * Goal-based place recommendations, "Today's Quests" (PLAN.md §8).
 *
 *   score = w_goal·goalFit + w_friend·friendSignal + w_novel·novel
 *         + w_rarity·rarityValue − w_dist·distancePenalty
 *
 * Explainable on purpose: every quest carries a plain-language reason.
 */

import type { Place, Rarity, Stamp } from "@/lib/db/types";
import { haversineMeters, type LatLng } from "@/lib/geo";
import { zone2Plus } from "@/lib/health/zones";

export const WEIGHTS = { goal: 3, friend: 1.5, novel: 1, rarity: 0.7, dist: 1 };

const KCAL_PER_KM = 60;
const STRIDE_M = 0.7;
const WALK_MIN_PER_KM = 12;
const ZONE2_SHARE_WALKING = 0.55;

const RARITY_VALUE: Record<Rarity, number> = { common: 0, uncommon: 0.25, rare: 0.5, epic: 0.75, legendary: 1 };

export interface RemainingGoals {
  steps?: number;
  activeKcal?: number;
  zoneMinutes?: number;
}

export interface RecInput {
  places: Place[];
  userId: string;
  userPos: LatLng;
  userStamps: Stamp[];
  /** Everyone's stamps, used for "others burned X getting here". */
  allStamps: Stamp[];
  friendIds: Set<string>;
  remaining: RemainingGoals;
  /** On low-recovery days, favor short walks to green, quiet places. */
  recovery?: "ready" | "moderate" | "easy" | null;
}

const GREEN = new Set(["park", "nature", "water"]);
const EASY_MAX_KM = 1.5;

export interface Quest {
  place: Place;
  score: number;
  distanceM: number;
  expected: { steps: number; activeKcal: number; zoneMinutes: number; estimated: boolean };
  reason: string;
  reasons: string[];
  friendCount: number;
  novel: boolean;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Fill ratio between an expected value and what's left of a goal (0–1). */
export function fit(expected: number, remaining: number): number {
  if (remaining <= 0 || expected <= 0) return 0;
  return Math.min(expected, remaining) / Math.max(expected, remaining);
}

export function recommend(input: RecInput, limit = 5): Quest[] {
  const owned = new Set(input.userStamps.map((s) => s.placeId));
  const byPlace = new Map<string, Stamp[]>();
  for (const s of input.allStamps) {
    if (s.userId === input.userId) continue;
    const list = byPlace.get(s.placeId) ?? [];
    list.push(s);
    byPlace.set(s.placeId, list);
  }

  const quests: Quest[] = input.places.map((place) => {
    const distanceM = haversineMeters(input.userPos, { lat: place.lat, lng: place.lng });
    const km = distanceM / 1000;
    const others = (byPlace.get(place.id) ?? []).filter((s) => s.healthSnapshot);
    const histKcal = median(others.map((s) => s.healthSnapshot!.activeKcal ?? 0).filter((x) => x > 0));
    const histSteps = median(others.map((s) => s.healthSnapshot!.steps ?? 0).filter((x) => x > 0));
    const histZone = median(others.map((s) => zone2Plus(s.healthSnapshot!.hrZoneMinutes)));
    // History reflects the route people took; blend with distance from here.
    const estKcal = km * KCAL_PER_KM;
    const estSteps = distanceM / STRIDE_M;
    const estZone = km * WALK_MIN_PER_KM * ZONE2_SHARE_WALKING;
    const useHist = others.length >= 2;
    const expected = {
      activeKcal: Math.round(useHist && histKcal ? (histKcal + estKcal) / 2 : estKcal),
      steps: Math.round(useHist && histSteps ? (histSteps + estSteps) / 2 : estSteps),
      zoneMinutes: Math.round(useHist && histZone !== null ? (histZone + estZone) / 2 : estZone),
      estimated: !useHist,
    };

    const fits: { label: string; value: number; pct: number }[] = [];
    const r = input.remaining;
    if (r.steps && r.steps > 0) fits.push({ label: "step", value: fit(expected.steps, r.steps), pct: expected.steps / r.steps });
    if (r.activeKcal && r.activeKcal > 0) fits.push({ label: "calorie", value: fit(expected.activeKcal, r.activeKcal), pct: expected.activeKcal / r.activeKcal });
    if (r.zoneMinutes && r.zoneMinutes > 0) fits.push({ label: "cardio-minute", value: fit(expected.zoneMinutes, r.zoneMinutes), pct: expected.zoneMinutes / r.zoneMinutes });
    const goalFit = fits.length ? fits.reduce((s, f) => s + f.value, 0) / fits.length : 0;

    const friendStamps = others.filter((s) => input.friendIds.has(s.userId));
    const friendUsers = new Set(friendStamps.map((s) => s.userId));
    const friendSignal = Math.min(1, friendUsers.size / 3);
    const novel = !owned.has(place.id);
    const neverCollected = place.collectCount === 0 && (byPlace.get(place.id)?.length ?? 0) === 0;
    const easyDay = input.recovery === "easy";
    const green = GREEN.has(place.category);
    const distancePenalty = 0.1 * km + Math.max(0, km - 3) / 3 + (easyDay ? Math.max(0, km - EASY_MAX_KM) : 0);
    const recoveryBonus = easyDay && green && km <= EASY_MAX_KM * 1.5 ? 1.5 : 0;

    const score =
      WEIGHTS.goal * goalFit +
      WEIGHTS.friend * friendSignal +
      WEIGHTS.novel * (novel ? 1 : 0) +
      WEIGHTS.rarity * RARITY_VALUE[place.baselineRarity] +
      recoveryBonus -
      WEIGHTS.dist * distancePenalty;

    const reasons: string[] = [];
    if (recoveryBonus > 0) reasons.push("Easy recovery walk: green, quiet and close");
    if (friendUsers.size > 0) {
      const kcals = friendStamps.map((s) => s.healthSnapshot!.activeKcal ?? 0).filter((x) => x > 0);
      const avg = kcals.length ? Math.round(kcals.reduce((a, b) => a + b, 0) / kcals.length) : null;
      const who = friendUsers.size === 1 ? "1 friend" : `${friendUsers.size} friends`;
      reasons.push(avg ? `${who} burned avg ${avg} kcal getting here` : `${who} collected this`);
    }
    const bestFit = [...fits].sort((a, b) => b.value - a.value)[0];
    if (bestFit && bestFit.value > 0.15) {
      const pct = Math.round(Math.min(1, bestFit.pct) * 100);
      reasons.push(`Fills ${pct}% of today's remaining ${bestFit.label} goal${expected.estimated ? " (est.)" : ""}`);
    }
    if (neverCollected) reasons.push("Never collected by anyone. Be the first!");
    else if (novel) reasons.push("New for your Dex");
    if (!reasons.length) reasons.push(`${(km).toFixed(1)} km away`);

    return {
      place,
      score,
      distanceM,
      expected,
      reason: reasons[0],
      reasons,
      friendCount: friendUsers.size,
      novel,
    };
  });

  return quests.sort((a, b) => b.score - a.score).slice(0, limit);
}
