import { describe, expect, it } from "vitest";
import {
  DEFAULT_BOSTON_CENTER,
  estimateSteps,
  haversineMeters,
  isWithinGeofence,
  roundCoord,
  routeDistance,
  type LatLng,
} from "@/lib/geo";

const BOSTON_COMMON: LatLng = { lat: 42.3554, lng: -71.0656 };
const FENWAY_PARK: LatLng = { lat: 42.3467, lng: -71.0972 };

describe("haversineMeters", () => {
  it("returns 0 for identical points", () => {
    expect(haversineMeters(BOSTON_COMMON, BOSTON_COMMON)).toBe(0);
  });
  it("matches a roughly-known Boston pair (Common <-> Fenway ~2.7 km)", () => {
    const d = haversineMeters(BOSTON_COMMON, FENWAY_PARK);
    expect(d).toBeGreaterThan(2500);
    expect(d).toBeLessThan(2900);
  });
  it("matches a known ~111 m per 0.001 deg latitude step", () => {
    expect(
      haversineMeters({ lat: 42.0, lng: -71.0 }, { lat: 42.001, lng: -71.0 }),
    ).toBeCloseTo(111.2, 0);
  });
  it("matches a known ~1 degree of latitude (~111.2 km)", () => {
    expect(haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(
      111_195,
      -2,
    );
  });
  it("is symmetric (a->b == b->a)", () => {
    expect(haversineMeters(BOSTON_COMMON, FENWAY_PARK)).toBeCloseTo(
      haversineMeters(FENWAY_PARK, BOSTON_COMMON),
      6,
    );
  });
});

describe("isWithinGeofence", () => {
  const place = BOSTON_COMMON;
  it("accepts a point clearly inside the default 75 m radius", () => {
    const inside: LatLng = { lat: place.lat + 0.0003, lng: place.lng };
    expect(haversineMeters(inside, place)).toBeLessThan(75);
    expect(isWithinGeofence(inside, place)).toBe(true);
  });
  it("rejects a point clearly outside the default 75 m radius", () => {
    const outside: LatLng = { lat: place.lat + 0.002, lng: place.lng };
    expect(haversineMeters(outside, place)).toBeGreaterThan(75);
    expect(isWithinGeofence(outside, place)).toBe(false);
  });
  it("honors a custom radius argument near the boundary", () => {
    const point: LatLng = { lat: place.lat + 0.0009, lng: place.lng };
    const dist = haversineMeters(point, place);
    expect(dist).toBeGreaterThan(75);
    expect(dist).toBeLessThan(150);
    expect(isWithinGeofence(point, place)).toBe(false);
    expect(isWithinGeofence(point, place, 150)).toBe(true);
  });
  it("includes points exactly at the radius (<= boundary)", () => {
    const point: LatLng = { lat: place.lat + 0.0003, lng: place.lng };
    const dist = haversineMeters(point, place);
    expect(isWithinGeofence(point, place, dist)).toBe(true);
  });
});

describe("roundCoord", () => {
  const coord: LatLng = { lat: 42.355412, lng: -71.065678 };
  it("stays within ~15 m of the input (default 10 m precision)", () => {
    expect(haversineMeters(roundCoord(coord), coord)).toBeLessThan(15);
  });
  it("collapses two points in the same cell to the same rounded value", () => {
    // Both points sit near the center of a grid cell (not straddling a
    // boundary), so they round to the same value. Boundary straddling is
    // inherent to any grid and is not asserted here.
    const a: LatLng = { lat: 42.355401, lng: -71.065601 };
    const b: LatLng = { lat: 42.355409, lng: -71.065609 };
    expect(haversineMeters(a, b)).toBeLessThan(10);
    const ra = roundCoord(a);
    const rb = roundCoord(b);
    expect(ra.lat).toBeCloseTo(rb.lat, 10);
    expect(ra.lng).toBeCloseTo(rb.lng, 10);
  });
  it("produces coarser buckets with a larger custom precision", () => {
    const fine = roundCoord(coord, 10);
    const coarse = roundCoord(coord, 100);
    expect(haversineMeters(coarse, coord)).toBeLessThan(150);
    const sameBucket =
      Math.abs(fine.lat - coarse.lat) < 1e-10 &&
      Math.abs(fine.lng - coarse.lng) < 1e-10;
    expect(sameBucket).toBe(false);
  });
  it("is idempotent: rounding an already-rounded value is stable", () => {
    const once = roundCoord(coord);
    const twice = roundCoord(once);
    expect(twice.lat).toBeCloseTo(once.lat, 10);
    expect(twice.lng).toBeCloseTo(once.lng, 10);
  });
});

describe("estimateSteps", () => {
  it("uses the default 0.7 m stride", () => {
    expect(estimateSteps(700)).toBe(1000);
  });
  it("rounds to the nearest whole step", () => {
    expect(estimateSteps(100)).toBe(143);
  });
  it("honors a custom stride length", () => {
    expect(estimateSteps(100, 1.0)).toBe(100);
  });
  it("returns 0 for zero distance", () => {
    expect(estimateSteps(0)).toBe(0);
  });
  it("returns 0 for negative distance", () => {
    expect(estimateSteps(-50)).toBe(0);
  });
  it("returns 0 for a non-positive stride", () => {
    expect(estimateSteps(100, 0)).toBe(0);
    expect(estimateSteps(100, -0.7)).toBe(0);
  });
});

describe("routeDistance", () => {
  it("returns 0 for an empty array", () => {
    expect(routeDistance([])).toBe(0);
  });
  it("returns 0 for a single point", () => {
    expect(routeDistance([BOSTON_COMMON])).toBe(0);
  });
  it("sums segment haversines for a multi-point route", () => {
    const points: LatLng[] = [
      { lat: 42.0, lng: -71.0 },
      { lat: 42.001, lng: -71.0 },
      { lat: 42.001, lng: -71.001 },
      { lat: 42.002, lng: -71.001 },
    ];
    const expected =
      haversineMeters(points[0], points[1]) +
      haversineMeters(points[1], points[2]) +
      haversineMeters(points[2], points[3]);
    expect(routeDistance(points)).toBeCloseTo(expected, 6);
    expect(routeDistance(points)).toBeGreaterThan(0);
  });
  it("equals a single haversine for a two-point route", () => {
    expect(routeDistance([BOSTON_COMMON, FENWAY_PARK])).toBeCloseTo(
      haversineMeters(BOSTON_COMMON, FENWAY_PARK),
      6,
    );
  });
});

describe("DEFAULT_BOSTON_CENTER", () => {
  it("is Boston Common and within the city", () => {
    expect(DEFAULT_BOSTON_CENTER).toEqual({ lat: 42.3554, lng: -71.0656 });
    expect(haversineMeters(DEFAULT_BOSTON_CENTER, BOSTON_COMMON)).toBeLessThan(
      5000,
    );
  });
});
