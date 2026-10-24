/**
 * Place-based stamp card (design.md §6, PLAN.md §6, REQ-4.5).
 *
 * The stamp card is assembled server-side from the **place** and the uploaded
 * photo — there is no AI, no model call, and no `kiro-cli` subprocess. This is
 * the single zod contract for a card's stored shape (`stamps.card` jsonb). Pure
 * — no I/O — so it is safe to import from client and server alike.
 *
 * There is no `lore`, `tags`, `accepted`, `rejectReason`, or `colorHex` field:
 * the name/category/rarity come from the place, and the photo is shown exactly
 * as uploaded.
 */

import { z } from "zod";

/** Place categories a stamp may carry (mirrors `PlaceCategory`). */
export const STAMP_CATEGORIES = [
  "mural",
  "statue",
  "cafe",
  "door",
  "park",
  "building",
  "transit",
  "water",
  "nature",
  "shop",
  "oddity",
  "other",
] as const;

export type StampCategory = (typeof STAMP_CATEGORIES)[number];

/** Rarity tiers. Final rarity is adjusted server-side by collector count. */
export const STAMP_RARITIES = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
] as const;

export type StampRarity = (typeof STAMP_RARITIES)[number];

export const StampCardSchema = z.object({
  /** Place name: a seeded place's stored name, or the user-typed name. */
  name: z.string().min(1).max(80),
  /** Category from the place (seeded) or chosen by the user (new place). */
  category: z.enum(STAMP_CATEGORIES),
  /** Place rarity; server adjusts the final value by collector count. */
  rarity: z.enum(STAMP_RARITIES),
  /** Where the card's name/category came from. */
  source: z.enum(["seed", "user"]),
});

export type StampCard = z.infer<typeof StampCardSchema>;
