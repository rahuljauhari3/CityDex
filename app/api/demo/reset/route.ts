/** POST /api/demo/reset: rebuild the demo world (demo mode only). */

import { NextResponse } from "next/server";
import { isDemoMode, hasSupabase } from "@/lib/config";
import { resetMemoryDb } from "@/lib/db/memory";

export const runtime = "nodejs";

export async function POST() {
  if (!isDemoMode || hasSupabase) {
    return NextResponse.json({ error: "Reset is only available in demo mode." }, { status: 403 });
  }
  resetMemoryDb();
  return NextResponse.json({ ok: true });
}
