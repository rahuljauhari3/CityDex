/**
 * GET /api/dex/:placeId: the viewer's visits to one place, newest first, with
 * health snapshots, the place insight (2+ visits) and totals.
 */

import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { computePlaceInsight } from "@/lib/insights/place";
import { zone2Plus } from "@/lib/health/zones";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ placeId: string }> }) {
  const { placeId } = await params;
  const store = getStore();
  const place = await store.getPlace(placeId);
  if (!place) return NextResponse.json({ error: "Place not found." }, { status: 404 });
  const mine = (await store.getStampsByUser(DEMO_USER_ID)).filter((s) => s.placeId === placeId);
  if (mine.length === 0) return NextResponse.json({ error: "You haven't collected this place yet." }, { status: 404 });
  const snaps = mine.map((s) => s.healthSnapshot).filter((h) => h !== null);
  return NextResponse.json({
    place,
    visits: [...mine].reverse(),
    insight: computePlaceInsight(mine, place),
    totals: {
      visits: mine.length,
      points: mine.reduce((s, x) => s + x.points, 0),
      distanceM: Math.round(snaps.reduce((s, h) => s + (h.distanceM ?? 0), 0)),
      steps: Math.round(snaps.reduce((s, h) => s + (h.steps ?? 0), 0)),
      activeKcal: Math.round(snaps.reduce((s, h) => s + (h.activeKcal ?? 0), 0)),
      zoneMinutes: snaps.reduce((s, h) => s + zone2Plus(h.hrZoneMinutes), 0),
    },
  });
}
