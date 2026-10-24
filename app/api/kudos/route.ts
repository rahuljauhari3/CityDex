/**
 * POST /api/kudos { stampId }: toggle a high five on a friend's stamp or
 * health milestone (milestone ids start with "ms_").
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { friendIdsOf } from "@/lib/app/views";
import { milestoneOwner } from "@/lib/social/milestones";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = z.object({ stampId: z.string().min(1).max(200) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  const store = getStore();
  const id = parsed.data.stampId;

  let ownerId: string | null;
  if (id.startsWith("ms_")) {
    ownerId = milestoneOwner(id, (await store.listProfiles()).map((p) => p.id));
  } else {
    ownerId = (await store.getStamp(id))?.userId ?? null;
  }
  if (!ownerId) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (ownerId === DEMO_USER_ID) return NextResponse.json({ error: "You can't high-five yourself." }, { status: 400 });
  if (!(await friendIdsOf(DEMO_USER_ID)).has(ownerId)) {
    return NextResponse.json({ error: "Only friends can high-five." }, { status: 403 });
  }
  const given = await store.toggleKudos(id, DEMO_USER_ID);
  return NextResponse.json({ ok: true, given });
}
