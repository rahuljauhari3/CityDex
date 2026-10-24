/**
 * Rarity point bases (design.md §8, PLAN.md §7).
 *
 * Pure constant shared by the check-in pipeline (M2) and the full points
 * formula (`computePoints`, M4). Kept separate so both can import it without a
 * cycle.
 */

import type { Rarity } from "@/lib/db/types";

export const RARITY_BASE: Record<Rarity, number> = {
  common: 10,
  uncommon: 25,
  rare: 50,
  epic: 100,
  legendary: 200,
};

export function rarityBase(rarity: Rarity): number {
  return RARITY_BASE[rarity] ?? RARITY_BASE.common;
}
