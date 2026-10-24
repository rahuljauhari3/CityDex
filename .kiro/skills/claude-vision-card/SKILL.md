---
name: claude-vision-card
description: Exact @anthropic-ai/sdk pattern for generating a CityDex stamp card from a photo (messages.parse + zodOutputFormat, base64 image block before text, refusal handling, null guard) plus a deterministic mock used when ANTHROPIC_API_KEY is missing. Use whenever implementing or editing the stamp-card AI call in lib/ai.
---

# Claude vision → stamp card

Server-side only. The Anthropic key never reaches the client. Follow this
pattern exactly; do not guess SDK shapes.

## Schema (PLAN.md §6)

```ts
import { z } from "zod";

export const StampCardSchema = z.object({
  accepted: z.boolean(),            // false if main subject is a person, a screen,
                                    // private interior, or unrecognizable
  rejectReason: z.string().nullable(),
  name: z.string(),                 // e.g. "The Door That Judges You"
  category: z.enum([
    "mural","statue","cafe","door","park","building",
    "transit","water","nature","shop","oddity","other",
  ]),
  rarity: z.enum(["common","uncommon","rare","epic","legendary"]), // AI suggestion
  lore: z.string(),                 // <= 220 chars, funny, kind, no real-people claims
  tags: z.array(z.string()).max(4), // e.g. ["red-brick","cozy","historic"]
  colorHex: z.string(),             // dominant color for card frame tint
});

export type StampCard = z.infer<typeof StampCardSchema>;
```

## Real call

```ts
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { StampCardSchema, type StampCard } from "./schema";

const SYSTEM_PROMPT =
  "You are a whimsical village naturalist cataloging city curiosities. " +
  "Give each spot a short, punny, PG name and playful lore (<= 220 chars). " +
  "Never identify or describe real people. Never state historical facts as true; " +
  "lore is clearly playful. Set accepted=false if the main subject is a person, " +
  "a screen, a private interior, or unrecognizable.";

// media_type must match the uploaded JPEG/PNG; data is base64 (no data: prefix).
export async function generateStampCard(
  base64: string,
  mediaType: "image/jpeg" | "image/png",
): Promise<StampCard> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the server env

  const message = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    output_config: {
      effort: "low",
      format: zodOutputFormat(StampCardSchema),
    },
    messages: [
      {
        role: "user",
        content: [
          // IMAGE BLOCK COMES BEFORE THE TEXT BLOCK
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          { type: "text", text: "Catalog this city spot as a collectible stamp card." },
        ],
      },
    ],
  });

  // Refusal handling -> generic "Mystery Spot" card; caller must not store the photo.
  if (message.stop_reason === "refusal") {
    return mysterySpotCard("refusal");
  }

  // Null guard on parsed_output.
  const parsed = message.parsed_output;
  if (!parsed) {
    return mysterySpotCard("no_parsed_output");
  }

  return parsed;
}

function mysterySpotCard(reason: string): StampCard {
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
```

## Mock (when ANTHROPIC_API_KEY is missing)

Demo mode must work with no key. Pick the mock deterministically from a hash of
the image bytes so the same photo always yields the same card.

```ts
import { StampCardSchema, type StampCard } from "./schema";

const MOCKS: StampCard[] = [
  { accepted: true, rejectReason: null, name: "The Wall That Ate Tuesday",
    category: "mural", rarity: "rare",
    lore: "A mural so vivid it allegedly swallowed a whole Tuesday. No refunds.",
    tags: ["colorful","street-art","bold"], colorHex: "#2196F3" },
  { accepted: true, rejectReason: null, name: "The Door That Judges You",
    category: "door", rarity: "uncommon",
    lore: "It has seen your posture. It is not impressed, but it wishes you well.",
    tags: ["red-brick","historic","cozy"], colorHex: "#C0392B" },
  { accepted: true, rejectReason: null, name: "Bench of Quiet Reckonings",
    category: "park", rarity: "common",
    lore: "Where big decisions go to be postponed in the shade of a kind tree.",
    tags: ["green","calm","restful"], colorHex: "#6DAA2C" },
];

function hash(bytes: Uint8Array): number {
  let h = 2166136261;
  for (const b of bytes) { h ^= b; h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function mockStampCard(bytes: Uint8Array): StampCard {
  const card = MOCKS[hash(bytes) % MOCKS.length];
  return StampCardSchema.parse(card); // validate the mock too
}
```

## Rules checklist
- Model `claude-opus-5-5`; call `client.messages.parse`.
- `output_config: { effort: "low", format: zodOutputFormat(StampCardSchema) }`.
- Import `zodOutputFormat` from `@anthropic-ai/sdk/helpers/zod`.
- Image content block **before** the text block; base64 with correct
  `media_type`.
- Handle `stop_reason === "refusal"` → Mystery Spot card; do not store the photo.
- Guard `parsed_output` for `null`.
- No `ANTHROPIC_API_KEY` → use `mockStampCard` (deterministic). Server-side only.
- Final rarity is adjusted server-side by collector count (see PLAN.md §6); this
  call only produces the AI suggestion.
