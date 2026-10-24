/**
 * Points per check-in (PLAN.md §7).
 *   rarity base: common 10 · uncommon 25 · rare 50 · epic 100 · legendary 200
 *   first discoverer of a place: +50
 *   movement: +1 per 100 steps on the route (cap +100)
 *   effort: +2 per zone-2+ minute (cap +60)
 *   goal-recommended place: ×1.5
 *   repeat visit: no base or discoverer bonus, movement/effort only
 */

import type { Rarity } from "@/lib/db/types";
import { rarityBase } from "./rarity";

export interface PointsInput {
  rarity: Rarity;
  firstDiscoverer: boolean;
  steps: number;
  zone2PlusMinutes: number;
  recommended: boolean;
  repeatVisit: boolean;
}

export interface PointsBreakdown {
  base: number;
  discoverer: number;
  movement: number;
  effort: number;
  multiplier: number;
  total: number;
}

export function computePoints(input: PointsInput): PointsBreakdown {
  const base = input.repeatVisit ? 0 : rarityBase(input.rarity);
  const discoverer = !input.repeatVisit && input.firstDiscoverer ? 50 : 0;
  const movement = Math.min(100, Math.floor(Math.max(0, input.steps) / 100));
  const effort = Math.min(60, Math.round(Math.max(0, input.zone2PlusMinutes)) * 2);
  const multiplier = input.recommended ? 1.5 : 1;
  const total = Math.round((base + discoverer + movement + effort) * multiplier);
  return { base, discoverer, movement, effort, multiplier, total };
}
