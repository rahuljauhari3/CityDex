/**
 * GET /api/health/live?elapsedMin=&distanceM=: a live heart-rate reading for
 * the walk in progress. Only the demo watch streams live data in a web app;
 * Strava and Apple exports arrive after the fact, so they return null here.
 */

import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { demoLiveHr } from "@/lib/health/demo";
import { estimatedMaxHr, zoneFor } from "@/lib/health/zones";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const elapsedMin = Math.max(0, Number(url.searchParams.get("elapsedMin")) || 0);
  const distanceM = Math.max(0, Number(url.searchParams.get("distanceM")) || 0);
  const store = getStore();
  const conns = await store.getConnections(DEMO_USER_ID);
  if (!conns.some((c) => c.provider === "demo")) {
    return NextResponse.json({ hr: null, source: null, reason: "No live heart-rate source connected." });
  }
  const profile = await store.getProfile(DEMO_USER_ID);
  const maxHr = estimatedMaxHr(profile?.age ?? undefined);
  const pace = distanceM > 100 && elapsedMin > 0 ? elapsedMin / (distanceM / 1000) : null;
  const hr = demoLiveHr(DEMO_USER_ID, elapsedMin, pace, maxHr);
  return NextResponse.json({ hr, zone: zoneFor(hr, maxHr), source: "demo", isDemo: true });
}
