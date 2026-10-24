import { describe, expect, it } from "vitest";
import { appUrl } from "@/lib/config";

/**
 * Trivial smoke test proving vitest + the `@/*` alias resolve. Pure-logic unit
 * tests (points, badges, recs, geo, Apple parser) are added as each matching
 * milestone lands (design.md §14).
 */
describe("config", () => {
  it("resolves a non-empty app URL", () => {
    expect(appUrl.length).toBeGreaterThan(0);
  });
});
