/**
 * POST /api/onboarding: save goals, age (for HR zones) and consent.
 * Consent is required to finish onboarding (PLAN §2 step 1.4).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/demo-user";

export const runtime = "nodejs";

const Body = z.object({
  goals: z
    .array(
      z.object({
        type: z.enum(["steps", "active_kcal", "zone_minutes", "explore", "recovery"]),
        target: z.number().int().min(1).max(100_000),
        active: z.boolean(),
      }),
    )
    .min(1),
  age: z.number().int().min(13).max(110).nullable(),
  consent: z.literal(true),
  connectDemo: z.boolean(),
});

const PERIOD = { steps: "day", active_kcal: "day", zone_minutes: "day", explore: "week", recovery: "week" } as const;

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Pick at least one goal and accept the consent to continue." }, { status: 400 });
  }
  const store = getStore();
  const { goals, age, connectDemo } = parsed.data;
  await store.setGoals(
    DEMO_USER_ID,
    goals.map((g) => ({ ...g, period: PERIOD[g.type] })),
  );
  const now = new Date().toISOString();
  await store.updateProfile(DEMO_USER_ID, { age, consentedAt: now, onboardedAt: now });
  if (connectDemo) await store.saveConnection({ userId: DEMO_USER_ID, provider: "demo", connectedAt: now });
  else await store.deleteConnection(DEMO_USER_ID, "demo");
  return NextResponse.json({ ok: true });
}
