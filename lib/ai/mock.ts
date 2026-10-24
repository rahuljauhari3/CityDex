/**
 * Deterministic mock stamp-card generator (design.md §6, PLAN.md §6, REQ-4.6).
 *
 * Used whenever `ANTHROPIC_API_KEY` is missing so demo mode works end to end
 * with no keys. The card is chosen from a hash of the image bytes, so the same
 * photo always yields the same card (stable demos, stable tests). Pure — no I/O
 * and no SDK import — so it is unit-testable and safe to run anywhere.
 */

import { StampCardSchema, type StampCard } from "./schema";

const MOCKS: StampCard[] = [
  {
    accepted: true,
    rejectReason: null,
    name: "The Wall That Ate Tuesday",
    category: "mural",
    rarity: "rare",
    lore: "A mural so vivid it allegedly swallowed a whole Tuesday. No refunds.",
    tags: ["colorful", "street-art", "bold"],
    colorHex: "#2196F3",
  },
  {
    accepted: true,
    rejectReason: null,
    name: "The Door That Judges You",
    category: "door",
    rarity: "uncommon",
    lore: "It has seen your posture. It is not impressed, but it wishes you well.",
    tags: ["red-brick", "historic", "cozy"],
    colorHex: "#C0392B",
  },
  {
    accepted: true,
    rejectReason: null,
    name: "Bench of Quiet Reckonings",
    category: "park",
    rarity: "common",
    lore: "Where big decisions go to be postponed in the shade of a kind tree.",
    tags: ["green", "calm", "restful"],
    colorHex: "#6DAA2C",
  },
  {
    accepted: true,
    rejectReason: null,
    name: "The Statue of Mild Opinions",
    category: "statue",
    rarity: "epic",
    lore: "Bronze and unbothered, it has stood here agreeing with no one in particular.",
    tags: ["bronze", "stoic", "landmark"],
    colorHex: "#9C27B0",
  },
  {
    accepted: true,
    rejectReason: null,
    name: "Café of Second Chances",
    category: "cafe",
    rarity: "uncommon",
    lore: "Serves courage in mug form. The pastries are suspiciously motivational.",
    tags: ["cozy", "warm", "coffee"],
    colorHex: "#A0703C",
  },
  {
    accepted: true,
    rejectReason: null,
    name: "The Legendary Lamppost",
    category: "oddity",
    rarity: "legendary",
    lore: "Rumored to light the way home even when the grid fails. A loyal little beacon.",
    tags: ["glowing", "rare", "beloved"],
    colorHex: "#FFC107",
  },
];

/** FNV-1a 32-bit hash of the image bytes for deterministic selection. */
function hashBytes(bytes: Uint8Array): number {
  let h = 2166136261;
  for (const b of bytes) {
    h ^= b;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Pick a deterministic mock card for the given image bytes. Validates the
 * chosen card against the schema so the mock path cannot drift from the real
 * shape.
 */
export function mockStampCard(bytes: Uint8Array): StampCard {
  const card = MOCKS[hashBytes(bytes) % MOCKS.length];
  return StampCardSchema.parse(card);
}
