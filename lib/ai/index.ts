/**
 * AI card generator selection (design.md §2, §6; REQ-4.6).
 *
 * Server-only. Returns a real Claude-backed card when `ANTHROPIC_API_KEY` is
 * present, otherwise the deterministic mock so demo mode works with no keys.
 * Route handlers call `generateCard()` and never branch on the key themselves.
 */

import "server-only";
import { hasAnthropic } from "@/lib/config";
import { mockStampCard } from "./mock";
import { generateStampCard, type StampImageMediaType } from "./claude";
import type { StampCard } from "./schema";

export type { StampCard } from "./schema";
export { StampCardSchema } from "./schema";

/**
 * Produce a stamp card for the given image bytes. Uses Claude when configured,
 * otherwise the deterministic mock. The mock ignores `mediaType` (it only
 * hashes bytes), so the same photo always yields the same card in demo mode.
 */
export async function generateCard(
  bytes: Uint8Array,
  mediaType: StampImageMediaType,
): Promise<{ card: StampCard; source: "claude" | "mock" }> {
  if (hasAnthropic) {
    const base64 = Buffer.from(bytes).toString("base64");
    const card = await generateStampCard(base64, mediaType);
    return { card, source: "claude" };
  }
  return { card: mockStampCard(bytes), source: "mock" };
}
