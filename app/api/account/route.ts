/** DELETE /api/account: removes photos, stamps, snapshots, routes, goals and tokens. */

import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { revokeStrava } from "@/lib/health/strava";

export const runtime = "nodejs";

export async function DELETE() {
  const store = getStore();
  const strava = (await store.getConnections(DEMO_USER_ID)).find((c) => c.provider === "strava");
  if (strava) await revokeStrava(strava);
  await store.deleteAccount(DEMO_USER_ID);
  return NextResponse.json({ ok: true });
}
