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
      // Anywhere in Massachusetts.
      expect(p.lat).toBeGreaterThan(41.2);
      expect(p.lat).toBeLessThan(42.9);
      expect(p.lng).toBeGreaterThan(-73.6);
      expect(p.lng).toBeLessThan(-69.9);
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

import { demoIllustration, demoPhotoFor } from "@/lib/demo/photos";
import { buildDemoWorld } from "@/lib/demo/seed";

describe("demo photos", () => {
  it("uses the real Gasson Hall photo and original illustrations elsewhere", () => {
    expect(demoPhotoFor({ id: "seed_bc_gasson_hall", name: "Gasson Hall", category: "building" }).url).toBe("/demo/gasson-hall.jpg");
    const walden = demoPhotoFor({ id: "seed_walden_pond", name: "Walden Pond", category: "water" });
    expect(walden.url).toMatch(/^https:\/\/(upload|thumb)\.wikimedia\.org\//);
    expect(walden.credit?.license).toMatch(/CC|Public domain/i);
    // Places without a free photo fall back to an illustration with no credit.
    expect(demoPhotoFor({ id: "seed_underground_ink_block", name: "Ink Block", category: "mural" }).credit).toBeNull();
    const svg = demoIllustration({ id: "seed_walden_pond", name: "Walden Pond", category: "water" });
    expect(svg.startsWith("data:image/svg+xml;utf8,")).toBe(true);
    expect(decodeURIComponent(svg)).toContain("Walden Pond");
  });

  it("gives every seeded stamp a photo, and you a Gasson Hall stamp", () => {
    const world = buildDemoWorld(getSeedPlaces(), new Date("2026-10-24T18:00:00Z"));
    expect(world.stamps.every((s) => s.photoPath)).toBe(true);
    // Every non-illustration photo carries a credit.
    expect(world.stamps.filter((s) => !s.photoPath!.startsWith("data:")).every((s) => s.photoCredit)).toBe(true);
    expect(world.stamps.some((s) => s.userId === "demo-user" && s.placeId === "seed_bc_gasson_hall")).toBe(true);
  });

  it("includes Boston College and statewide Massachusetts stops", () => {
    const ids = new Set(getSeedPlaces().map((p) => p.id));
    for (const id of ["seed_bc_gasson_hall", "seed_heartbreak_hill", "seed_walden_pond", "seed_mount_greylock", "seed_plymouth_rock"]) {
      expect(ids.has(id)).toBe(true);
    }
  });
});
