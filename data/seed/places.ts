/**
 * Seed places loader (REQ-15.1, design.md §3).
 *
 * Curated real Boston/Cambridge points of interest derived from OpenStreetMap
 * (© OpenStreetMap contributors, ODbL). The JSON is the single source; this
 * module validates it with zod and exposes typed `Place` rows for the demo
 * store. No network calls — Overpass is never hit at runtime.
 */

import { z } from "zod";
import type { Place } from "@/lib/db/types";
import seed from "./boston-places.json";

const SeedPlaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
  neighborhood: z.string(),
  category: z.enum([
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
  ]),
  rarity: z.enum(["common", "uncommon", "rare", "epic", "legendary"]),
});

const SeedFileSchema = z.object({
  places: z.array(SeedPlaceSchema),
});

/**
 * Attribution string for the seed data (ODbL). Surface this near the map /
 * about screen alongside the live © OpenStreetMap tile attribution.
 */
export const SEED_ATTRIBUTION =
  "Places © OpenStreetMap contributors, ODbL (openstreetmap.org/copyright).";

/**
 * The seed places as `Place` rows. The seed `rarity` becomes `baselineRarity`,
 * used for map marker coloring (REQ-2.3); per-user stamp rarity is adjusted
 * server-side at check-in (design.md §7 step 6).
 */
export function getSeedPlaces(): Place[] {
  const parsed = SeedFileSchema.parse(seed);
  return parsed.places.map((p) => ({
    id: p.id,
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    neighborhood: p.neighborhood,
    category: p.category,
    source: "seed" as const,
    createdBy: null,
    firstCollectedAt: null,
    collectCount: 0,
    baselineRarity: p.rarity,
  }));
}
