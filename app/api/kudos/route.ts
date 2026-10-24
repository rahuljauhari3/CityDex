/** POST /api/kudos { stampId }: toggle a high five on a friend's stamp. */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { friendIdsOf } from "@/lib/app/views";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = z.object({ stampId: z.string().min(1) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Missing stampId." }, { status: 400 });
  const store = getStore();
  const stamp = await store.getStamp(parsed.data.stampId);
  if (!stamp) return NextResponse.json({ error: "Stamp not found." }, { status: 404 });
  if (stamp.userId === DEMO_USER_ID) return NextResponse.json({ error: "You can't high-five yourself." }, { status: 400 });
  if (!(await friendIdsOf(DEMO_USER_ID)).has(stamp.userId)) {
    return NextResponse.json({ error: "Only friends can high-five." }, { status: 403 });
  }
  const given = await store.toggleKudos(stamp.id, DEMO_USER_ID);
  return NextResponse.json({ ok: true, given });
}
