/**
 * POST   /api/health/connections?provider=demo  connect a built-in source
 * DELETE /api/health/connections?provider=…     disconnect: deletes tokens and
 *                                               imported data (PLAN §11)
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { revokeStrava } from "@/lib/health/strava";

export const runtime = "nodejs";

const Provider = z.enum(["demo", "strava", "apple_export", "whoop", "fitbit", "garmin", "samsung"]);

function provider(request: Request) {
  return Provider.safeParse(new URL(request.url).searchParams.get("provider"));
}

export async function POST(request: Request) {
  const p = provider(request);
  if (!p.success) return NextResponse.json({ error: "Unknown provider." }, { status: 400 });
  if (p.data !== "demo") {
    return NextResponse.json({ error: "Use the provider's own connect flow." }, { status: 400 });
  }
  await getStore().saveConnection({ userId: DEMO_USER_ID, provider: "demo", connectedAt: new Date().toISOString() });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const p = provider(request);
  if (!p.success) return NextResponse.json({ error: "Unknown provider." }, { status: 400 });
  const store = getStore();
  if (p.data === "strava") {
    const conn = (await store.getConnections(DEMO_USER_ID)).find((c) => c.provider === "strava");
    if (conn) await revokeStrava(conn);
  }
  await store.deleteConnection(DEMO_USER_ID, p.data);
  return NextResponse.json({ ok: true });
}
