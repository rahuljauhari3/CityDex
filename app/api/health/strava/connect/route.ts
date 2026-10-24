/** GET /api/health/strava/connect: start Strava OAuth (scope activity:read_all). */

import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { hasStrava } from "@/lib/config";
import { stravaAuthorizeUrl } from "@/lib/health/strava";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!hasStrava) {
    return NextResponse.redirect(new URL("/profile?error=strava_keys", request.url));
  }
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(stravaAuthorizeUrl(state));
  res.cookies.set("strava_state", state, { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
