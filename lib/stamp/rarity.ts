/**
 * Final-rarity adjustment (design.md §6/§7 step 6, PLAN.md §6, REQ-8.3).
 *
 * The stamp's final rarity is the place's baseline rarity, adjusted by how many
 * users already collected the place:
 *   - the first 3 collectors get +1 tier (a reward for early discovery);
 *   - once a place has been collected by more than 50 users it is "popular" and
 *     caps at "uncommon".
 *
 * `priorCollectCount` is the collect_count **before** this collection is
 * recorded (so the 1st, 2nd and 3rd collectors see 0, 1, 2).
 *
 * Pure — no I/O — so it is directly unit-testable.
 */

import type { StampRarity } from "./card";

const RARITY_ORDER: StampRarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
];

function tierIndex(r: StampRarity): number {
  const i = RARITY_ORDER.indexOf(r);
  return i < 0 ? 0 : i;
}

/** Bump a rarity up by `n` tiers, clamped to the legendary ceiling. */
function bumpTier(r: StampRarity, n: number): StampRarity {
  const next = Math.min(RARITY_ORDER.length - 1, tierIndex(r) + n);
  return RARITY_ORDER[next];
}

/** Clamp a rarity down to at most `cap`. */
function capAt(r: StampRarity, cap: StampRarity): StampRarity {
  return tierIndex(r) > tierIndex(cap) ? cap : r;
}

export function adjustRarity(
  baseline: StampRarity,
  priorCollectCount: number,
): StampRarity {
  // Popular place: hard-cap at uncommon regardless of other bonuses.
  if (priorCollectCount > 50) {
    return capAt(baseline, "uncommon");
  }
  // First 3 collectors (prior count 0, 1, 2) get +1 tier.
  if (priorCollectCount < 3) {
    return bumpTier(baseline, 1);
  }
  return baseline;
}
