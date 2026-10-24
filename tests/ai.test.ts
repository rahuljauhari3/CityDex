import { describe, expect, it } from "vitest";
import { mockStampCard } from "@/lib/ai/mock";
import { StampCardSchema } from "@/lib/ai/schema";

describe("mockStampCard", () => {
  it("is deterministic: the same bytes always yield the same card", () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const first = mockStampCard(bytes);
    const second = mockStampCard(Uint8Array.from(bytes));
    expect(second).toEqual(first);
  });

  it("maps different byte inputs to at least two distinct card names", () => {
    // 6 mocks selected by FNV-1a hash modulo length; a spread of inputs must
    // surface more than one of them (the generator is not a constant).
    const inputs: Uint8Array[] = [];
    for (let i = 0; i < 24; i++) {
      inputs.push(new Uint8Array([i, i * 7 + 1, (i * 31 + 5) & 0xff]));
    }
    const names = new Set(inputs.map((b) => mockStampCard(b).name));
    expect(names.size).toBeGreaterThanOrEqual(2);
  });

  it("returns cards that validate against the schema and are accepted", () => {
    const inputs: Uint8Array[] = [];
    for (let i = 0; i < 12; i++) {
      inputs.push(new Uint8Array([i * 13 + 2, i * 5 + 9]));
    }
    for (const bytes of inputs) {
      const card = mockStampCard(bytes);
      expect(() => StampCardSchema.parse(card)).not.toThrow();
      expect(card.accepted).toBe(true);
    }
  });

  it("handles an empty Uint8Array without throwing", () => {
    expect(() => mockStampCard(new Uint8Array())).not.toThrow();
    const card = mockStampCard(new Uint8Array());
    expect(() => StampCardSchema.parse(card)).not.toThrow();
    expect(card.accepted).toBe(true);
  });
});

describe("StampCardSchema", () => {
  const validCard = {
    accepted: true,
    rejectReason: null,
    name: "The Door That Judges You",
    category: "door",
    rarity: "uncommon",
    lore: "It has seen your posture. It is not impressed, but it wishes you well.",
    tags: ["red-brick", "historic", "cozy"],
    colorHex: "#C0392B",
  };

  it("parses a well-formed card", () => {
    expect(() => StampCardSchema.parse(validCard)).not.toThrow();
  });

  it("rejects lore longer than 220 characters", () => {
    const card = { ...validCard, lore: "x".repeat(221) };
    expect(() => StampCardSchema.parse(card)).toThrow();
    // boundary: exactly 220 is allowed
    expect(() =>
      StampCardSchema.parse({ ...validCard, lore: "x".repeat(220) }),
    ).not.toThrow();
  });

  it("rejects more than 4 tags", () => {
    const card = { ...validCard, tags: ["a", "b", "c", "d", "e"] };
    expect(() => StampCardSchema.parse(card)).toThrow();
    // boundary: exactly 4 is allowed
    expect(() =>
      StampCardSchema.parse({ ...validCard, tags: ["a", "b", "c", "d"] }),
    ).not.toThrow();
  });

  it("rejects an invalid category", () => {
    const card = { ...validCard, category: "spaceship" };
    expect(() => StampCardSchema.parse(card)).toThrow();
  });

  it("rejects an invalid rarity", () => {
    const card = { ...validCard, rarity: "mythic" };
    expect(() => StampCardSchema.parse(card)).toThrow();
  });
});
