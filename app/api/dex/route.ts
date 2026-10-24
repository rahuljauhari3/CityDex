/**
 * GET /api/dex — the viewer's collection book entries (REQ-5.2, 5.3).
 *
 * Server-only access to the active `Store`. Returns owned stamps plus locked
 * (undiscovered) slots for every known place, so the Dex can render the 4-col
 * grid with "???" silhouettes. Demo mode uses the single demo user until auth
 * lands (M7).
 */

import { NextResponse } from "next/server";
import { getDex } from "@/lib/app/views";
import { DEMO_USER_ID } from "@/lib/demo-user";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    const entries = await getDex(DEMO_USER_ID);
    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json(
      { error: "Couldn’t load your collection." },
      { status: 500 },
    );
  }
}
