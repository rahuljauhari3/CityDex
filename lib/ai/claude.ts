/**
 * Claude vision → stamp card (design.md §6, PLAN.md §6, REQ-4.2–4.5, 4.9).
 *
 * Server-only. The Anthropic key never reaches the client, and this module is
 * only imported from server code. Follows the `claude-vision-card` skill's
 * semantics exactly:
 *   - model `claude-opus-5-5`
 *   - structured output via a zod output format helper
 *   - the base64 image content block comes BEFORE the text block (REQ-4.3)
 *   - `stop_reason === "refusal"` → generic "Mystery Spot" card; caller stores
 *     no photo (REQ-4.4)
 *   - the parsed output is guarded for null before use (REQ-4.5)
 *
 * SDK note: the installed `@anthropic-ai/sdk@0.70.x` exposes structured parsing
 * through the *beta* messages API — `client.beta.messages.parse(...)` with
 * `output_format: betaZodOutputFormat(schema)` (from
 * `@anthropic-ai/sdk/helpers/beta/zod`), and the parsed value on
 * `message.parsed_output`. This is the real, verified shape for the pinned
 * version; we do not guess. The semantic contract from the skill (image-first,
 * refusal → Mystery Spot, null guard) is preserved exactly.
 */

import "server-only";
import { StampCardSchema, type StampCard } from "./schema";

export type StampImageMediaType = "image/jpeg" | "image/png";

const SYSTEM_PROMPT =
  "You are a whimsical village naturalist cataloging city curiosities. " +
  "Give each spot a short, punny, PG name and playful lore (<= 220 chars). " +
  "Never identify or describe real people. Never state historical facts as true; " +
  "lore is clearly playful. Set accepted=false if the main subject is a person, " +
  "a screen, a private interior, or unrecognizable.";

/**
 * Generate a stamp card from a base64 JPEG/PNG. `base64` must be raw base64
 * (no `data:` prefix) and `mediaType` must match the bytes.
 *
 * On a model refusal or a missing parsed output, returns a generic Mystery Spot
 * card with `accepted: false`; the check-in pipeline then stores no photo and
 * asks the user to retake (design.md §7 step 4).
 */
export async function generateStampCard(
  base64: string,
  mediaType: StampImageMediaType,
): Promise<StampCard> {
  // Import the SDK lazily so demo mode (no key) never requires the package at
  // build or runtime for the mock path (REQ-1.3). This path only runs when a
  // real ANTHROPIC_API_KEY is present.
  const [{ default: Anthropic }, { betaZodOutputFormat }] = await Promise.all([
    import("@anthropic-ai/sdk"),
    import("@anthropic-ai/sdk/helpers/beta/zod"),
  ]);

  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the server env

  const message = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    output_format: betaZodOutputFormat(StampCardSchema),
    messages: [
      {
        role: "user",
        content: [
          // IMAGE BLOCK COMES BEFORE THE TEXT BLOCK (REQ-4.3).
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          {
            type: "text",
            text: "Catalog this city spot as a collectible stamp card.",
          },
        ],
      },
    ],
  });

  // Refusal → Mystery Spot card; caller must not store the photo (REQ-4.4).
  if (message.stop_reason === "refusal") {
    return mysterySpotCard("refusal");
  }

  // Null guard on the parsed output (REQ-4.5).
  const parsed = message.parsed_output;
  if (!parsed) {
    return mysterySpotCard("no_parsed_output");
  }

  // Validate again at the boundary; if the SDK ever returns an off-shape value
  // we fall back rather than trust it.
  const safe = StampCardSchema.safeParse(parsed);
  if (!safe.success) {
    return mysterySpotCard("invalid_parsed_output");
  }
  return safe.data;
}

/** Generic fallback card used on refusal / parse failure (REQ-4.4). */
export function mysterySpotCard(reason: string): StampCard {
  return {
    accepted: false,
    rejectReason: reason,
    name: "Mystery Spot",
    category: "oddity",
    rarity: "common",
    lore: "Something here resisted cataloging. The naturalist shrugs and moves on.",
    tags: ["mysterious"],
    colorHex: "#9E9E9E",
  };
}
