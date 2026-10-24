/**
 * GET /api/dex — the viewer's collection book entries (REQ-5.2, 5.3).
 *
 * Server-only access to the active `Store`. Returns owned stamps plus locked
 * (undiscovered) slots for every known place, so the Dex can render the 4-col
 * grid with "???" silhouettes. Demo mode uses the single demo user until auth
 * lands (M7).
 */

import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/demo-user";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    const store = getStore();
    const entries = await store.getDexForUser(DEMO_USER_ID);
    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json(
      { error: "Couldn’t load your collection." },
      { status: 500 },
    );
  }
}
