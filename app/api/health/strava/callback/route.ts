/** GET /api/health/strava/callback: finish Strava OAuth and store encrypted tokens. */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getStore } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { exchangeStravaCode } from "@/lib/health/strava";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const expected = jar.get("strava_state")?.value;
  const back = (q: string) => {
    const res = NextResponse.redirect(new URL(`/profile?${q}`, request.url));
    res.cookies.delete("strava_state");
    return res;
  };
  if (url.searchParams.get("error") || !code) return back("error=strava_denied");
  if (!state || !expected || state !== expected) return back("error=strava_state");
  const scope = url.searchParams.get("scope");
  if (scope && !scope.includes("activity:read")) return back("error=strava_scope");
  try {
    await getStore().saveConnection(await exchangeStravaCode(DEMO_USER_ID, code, scope));
    return back("connected=strava");
  } catch (err) {
    console.warn("[strava] token exchange failed:", (err as Error).message);
    return back("error=strava_exchange");
  }
}
