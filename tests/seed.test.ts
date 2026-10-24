import { describe, expect, it } from "vitest";
import { getSeedPlaces, SEED_ATTRIBUTION } from "@/data/seed/places";
import seedJson from "@/data/seed/boston-places.json";

describe("seed places", () => {
  it("loads a curated set of Boston/Cambridge places", () => {
    const places = getSeedPlaces();
    expect(places.length).toBeGreaterThanOrEqual(40);
  });

  it("gives every seed place a stable id, coords, and baseline rarity", () => {
    const places = getSeedPlaces();
    const ids = new Set<string>();
    for (const p of places) {
      expect(p.id).toMatch(/^seed_/);
      expect(ids.has(p.id)).toBe(false); // unique ids
      ids.add(p.id);
      expect(p.source).toBe("seed");
      expect(p.lat).toBeGreaterThan(42.2);
      expect(p.lat).toBeLessThan(42.5);
      expect(p.lng).toBeGreaterThan(-71.2);
      expect(p.lng).toBeLessThan(-70.9);
      expect([
        "common",
        "uncommon",
        "rare",
        "epic",
        "legendary",
      ]).toContain(p.baselineRarity);
    }
  });

  it("carries ODbL / OpenStreetMap attribution in both the JSON and the constant", () => {
    const attribution = (seedJson as { _attribution: string })._attribution;
    expect(attribution).toMatch(/OpenStreetMap/i);
    expect(attribution).toMatch(/ODbL/i);
    expect(SEED_ATTRIBUTION).toMatch(/OpenStreetMap/i);
    expect(SEED_ATTRIBUTION).toMatch(/ODbL/i);
  });
});
