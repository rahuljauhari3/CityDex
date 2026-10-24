/**
 * GET /api/places — list places for the map (REQ-2.3).
 *
 * Server-only access to the active `Store` (demo in-memory or Supabase). The
 * client map fetches this to render rarity-colored markers. Optional bounding
 * box via query params (`minLat,minLng,maxLat,maxLng`) narrows results.
 *
 * Never returns user-private data — places are public game content.
 */

import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import type { BoundingBox } from "@/lib/db/types";

function parseBbox(url: URL): BoundingBox | undefined {
  const minLat = url.searchParams.get("minLat");
  const minLng = url.searchParams.get("minLng");
  const maxLat = url.searchParams.get("maxLat");
  const maxLng = url.searchParams.get("maxLng");
  if (!minLat || !minLng || !maxLat || !maxLng) return undefined;
  const nums = [minLat, minLng, maxLat, maxLng].map(Number);
  if (nums.some((n) => Number.isNaN(n))) return undefined;
  return {
    minLat: nums[0],
    minLng: nums[1],
    maxLat: nums[2],
    maxLng: nums[3],
  };
}

export async function GET(request: Request): Promise<Response> {
  const store = getStore();
  const bbox = parseBbox(new URL(request.url));
  const places = await store.getPlaces(bbox);
  return NextResponse.json({ places });
}
