/**
 * Stamp-card schema (design.md §6, PLAN.md §6, REQ-4.7).
 *
 * The single zod contract for AI output. The Claude client validates its parsed
 * output against this, and the deterministic mock validates its canned cards
 * against it too, so both paths produce identical shapes. Pure — no I/O — so it
 * is safe to import from client and server alike (only the AI *clients* are
 * server-only).
 */

import { z } from "zod";

/** Place categories the naturalist may assign (mirrors `PlaceCategory`). */
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

/** AI-suggested rarity (final rarity is adjusted server-side by collector count). */
export const STAMP_RARITIES = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
] as const;

export const StampCardSchema = z.object({
  /** false if the main subject is a person, a screen, a private interior, or unrecognizable. */
  accepted: z.boolean(),
  rejectReason: z.string().nullable(),
  /** e.g. "The Door That Judges You" */
  name: z.string(),
  category: z.enum(STAMP_CATEGORIES),
  /** AI suggestion; final rarity adjusted server-side (design.md §7 step 6). */
  rarity: z.enum(STAMP_RARITIES),
  /** <= 220 chars, funny, kind, no claims about real people. */
  lore: z.string().max(220),
  /** e.g. ["red-brick","cozy","historic"] */
  tags: z.array(z.string()).max(4),
  /** Dominant color for the card frame tint, e.g. "#2196F3". */
  colorHex: z.string(),
});

export type StampCard = z.infer<typeof StampCardSchema>;
