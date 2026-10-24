/**
 * POST /api/friends
 *   { action: "add", query }    add by username or invite code
 *   { action: "accept", userId } accept an incoming request
 * Demo users accept new requests right away so the demo flows.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/demo-user";

export const runtime = "nodejs";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), query: z.string().min(1).max(60) }),
  z.object({ action: z.literal("accept"), userId: z.string().min(1) }),
]);

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const store = getStore();
  if (parsed.data.action === "accept") {
    const { userId } = parsed.data;
    const fs = await store.listFriendships(DEMO_USER_ID);
    const pending = fs.find((f) => f.userId === userId && f.friendId === DEMO_USER_ID && f.status === "pending");
    if (!pending) return NextResponse.json({ error: "No request from that user." }, { status: 404 });
    await store.addFriendship(pending.userId, DEMO_USER_ID, "accepted");
    return NextResponse.json({ ok: true, message: "Friend added." });
  }
  const other = await store.findProfile(parsed.data.query);
  if (!other) return NextResponse.json({ error: "No one with that username or code." }, { status: 404 });
  if (other.id === DEMO_USER_ID) return NextResponse.json({ error: "That's you!" }, { status: 400 });
  const f = await store.addFriendship(DEMO_USER_ID, other.id, other.isDemo ? "accepted" : "pending");
  return NextResponse.json({
    ok: true,
    message: f.status === "accepted" ? `You and @${other.username} are friends.` : `Request sent to @${other.username}.`,
  });
}
