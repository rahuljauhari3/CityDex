/**
 * Rule-based badges (PLAN.md §7). Rules are data so they can live in the
 * `badges` table as JSON; `evaluateBadges` is pure.
 */

import type { DailyHealth, Place, PlaceCategory, Stamp } from "@/lib/db/types";
import { zone2Plus } from "@/lib/health/zones";
import { addDays, nyDate, nyHour } from "@/lib/time";

export type BadgeRule =
  | { kind: "stampCount"; min: number }
  | { kind: "categoryCount"; categories: PlaceCategory[]; min: number }
  | { kind: "nightStamp"; afterHour: number }
  | { kind: "routeZone2"; minMinutes: number }
  | { kind: "dailySteps"; min: number }
  | { kind: "neighborhoods"; min: number }
  | { kind: "rarity"; rarity: Stamp["rarity"] }
  | { kind: "streak"; days: number };

export interface BadgeDef {
  slug: string;
  name: string;
  description: string;
  icon: string;
  health: boolean;
  rule: BadgeRule;
}

export const BADGES: BadgeDef[] = [
  { slug: "first-steps", name: "First Steps", description: "Collect your first stamp", icon: "👣", health: false, rule: { kind: "stampCount", min: 1 } },
  { slug: "heart-of-the-city", name: "Heart of the City", description: "30+ zone-2 minutes on one route", icon: "❤️", health: true, rule: { kind: "routeZone2", minMinutes: 30 } },
  { slug: "10k-club", name: "10K Club", description: "10,000 steps in a day", icon: "🥾", health: true, rule: { kind: "dailySteps", min: 10_000 } },
  { slug: "green-thumb", name: "Green Thumb", description: "5 park or nature stamps (recovery)", icon: "🌿", health: true, rule: { kind: "categoryCount", categories: ["park", "nature"], min: 5 } },
  { slug: "streak-3", name: "Streak 3", description: "Stamps on 3 days in a row", icon: "🔥", health: true, rule: { kind: "streak", days: 3 } },
  { slug: "streak-7", name: "Streak 7", description: "Stamps on 7 days in a row", icon: "🔥", health: true, rule: { kind: "streak", days: 7 } },
  { slug: "streak-30", name: "Streak 30", description: "Stamps on 30 days in a row", icon: "🏆", health: true, rule: { kind: "streak", days: 30 } },
  { slug: "mural-hunter-1", name: "Mural Hunter I", description: "Collect 3 murals", icon: "🎨", health: false, rule: { kind: "categoryCount", categories: ["mural"], min: 3 } },
  { slug: "mural-hunter-2", name: "Mural Hunter II", description: "Collect 10 murals", icon: "🎨", health: false, rule: { kind: "categoryCount", categories: ["mural"], min: 10 } },
  { slug: "mural-hunter-3", name: "Mural Hunter III", description: "Collect 25 murals", icon: "🎨", health: false, rule: { kind: "categoryCount", categories: ["mural"], min: 25 } },
  { slug: "night-owl", name: "Night Owl", description: "A stamp after 9 pm", icon: "🦉", health: false, rule: { kind: "nightStamp", afterHour: 21 } },
  { slug: "neighborhood-hopper", name: "Neighborhood Hopper", description: "Stamps in 5 neighborhoods", icon: "🧭", health: false, rule: { kind: "neighborhoods", min: 5 } },
  { slug: "legend-seeker", name: "Legend Seeker", description: "Collect a legendary", icon: "⭐", health: false, rule: { kind: "rarity", rarity: "legendary" } },
];

export interface BadgeContext {
  stamps: Stamp[];
  places: Map<string, Place>;
  daily: DailyHealth[];
}

function longestStreak(dates: string[]): number {
  const set = new Set(dates);
  let best = 0;
  for (const d of set) {
    if (set.has(addDays(d, -1))) continue;
    let n = 1;
    while (set.has(addDays(d, n))) n++;
    best = Math.max(best, n);
  }
  return best;
}

export function ruleMet(rule: BadgeRule, ctx: BadgeContext): boolean {
  const { stamps, places, daily } = ctx;
  switch (rule.kind) {
    case "stampCount":
      return stamps.length >= rule.min;
    case "categoryCount":
      return stamps.filter((s) => rule.categories.includes(s.card.category)).length >= rule.min;
    case "nightStamp":
      return stamps.some((s) => nyHour(new Date(s.createdAt)) >= rule.afterHour);
    case "routeZone2":
      return stamps.some((s) => zone2Plus(s.healthSnapshot?.hrZoneMinutes) >= rule.minMinutes);
    case "dailySteps":
      return daily.some((d) => (d.steps ?? 0) >= rule.min);
    case "neighborhoods": {
      const hoods = new Set(stamps.map((s) => places.get(s.placeId)?.neighborhood).filter(Boolean));
      return hoods.size >= rule.min;
    }
    case "rarity":
      return stamps.some((s) => s.rarity === rule.rarity);
    case "streak":
      return longestStreak(stamps.map((s) => nyDate(new Date(s.createdAt)))) >= rule.days;
  }
}

/** Slugs of every badge the user currently qualifies for. */
export function evaluateBadges(ctx: BadgeContext): string[] {
  return BADGES.filter((b) => ruleMet(b.rule, ctx)).map((b) => b.slug);
}
