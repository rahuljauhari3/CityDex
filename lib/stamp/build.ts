/**
 * Build a stamp card from place data + the uploaded photo (design.md §6,
 * PLAN.md §6, REQ-4.3, 4.4, 4.5).
 *
 * No AI, no model call: a **seeded** place supplies its stored name, category
 * and baseline rarity; a **new user-created** place uses the user-typed name
 * and category with baseline rarity `common`. The returned card's `rarity` is
 * the *final* rarity after the collector-count adjustment (design.md §7 step
 * 6). The photo itself is stored and shown exactly as uploaded and is not part
 * of the card record.
 *
 * Pure — no I/O — so it is directly unit-testable.
 */

import {
  StampCardSchema,
  type StampCard,
  type StampCategory,
  type StampRarity,
} from "./card";
import { adjustRarity } from "./rarity";

export interface SeededPlaceCardInput {
  source: "seed";
  name: string;
  category: StampCategory;
  baselineRarity: StampRarity;
  /** collect_count before this collection is recorded. */
  priorCollectCount: number;
}

export interface UserPlaceCardInput {
  source: "user";
  name: string;
  category: StampCategory;
  /** collect_count before this collection is recorded (0 for a brand-new place). */
  priorCollectCount: number;
}

export type BuildCardInput = SeededPlaceCardInput | UserPlaceCardInput;

/**
 * Assemble and validate the place-based card. A new user-created place always
 * starts at `common` baseline rarity; a seeded place uses its stored rarity.
 */
export function buildStampCard(input: BuildCardInput): StampCard {
  const baseline: StampRarity =
    input.source === "seed" ? input.baselineRarity : "common";

  const card: StampCard = {
    name: input.name,
    category: input.category,
    rarity: adjustRarity(baseline, input.priorCollectCount),
    source: input.source,
  };

  // Validate at the boundary so a malformed name/category never persists.
  return StampCardSchema.parse(card);
}

/** Card for a stored place: seeded places keep their rarity, user places start common. */
export function cardForPlace(
  place: { name: string; category: StampCategory; source: "seed" | "user"; baselineRarity: StampRarity },
  priorCollectCount: number,
): StampCard {
  return place.source === "seed"
    ? buildStampCard({ source: "seed", name: place.name, category: place.category, baselineRarity: place.baselineRarity, priorCollectCount })
    : buildStampCard({ source: "user", name: place.name, category: place.category, priorCollectCount });
}
