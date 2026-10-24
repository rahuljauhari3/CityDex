/**
 * Geo math (design.md §11, REQ-3.6, REQ-7.2, REQ-11.2).
 *
 * Pure, I/O-free functions so they are directly unit-testable without a browser
 * or network. Used for geofencing at check-in, coordinate rounding for privacy,
 * step estimation, and route distance accumulation.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle distance between two points in meters (haversine).
 */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_M * c;
}

/**
 * True when `userPos` is within `radiusM` meters of `place` (REQ-3.1).
 * Default geofence radius is ~75 m per PLAN.md §2.
 */
export function isWithinGeofence(
  userPos: LatLng,
  place: LatLng,
  radiusM = 75,
): boolean {
  return haversineMeters(userPos, place) <= radiusM;
}

/**
 * Round a coordinate so stored check-in locations are only precise to about
 * `meters` (REQ-14.4, design.md §3: "~10 m ≈ 4 decimal places"). Privacy:
 * coarse coordinates make exact homes/routes harder to reconstruct.
 *
 * Rounds both lat and lng to a fixed number of decimal places chosen from
 * `meters` (≈ 111_320 m per degree). Decimal-place rounding is idempotent and
 * bucket-stable: re-rounding an already-rounded value returns the same value,
 * and nearby points collapse to the same cell. A fixed grid slightly
 * over-coarsens longitude at Boston's latitude, which is fine (and safer) for a
 * privacy floor.
 */
export function roundCoord(coord: LatLng, meters = 10): LatLng {
  const metersPerDeg = 111_320;
  // Decimal places whose grid step is <= `meters`.
  const decimals = Math.max(
    0,
    Math.round(Math.log10(metersPerDeg / Math.max(meters, 1e-9))),
  );
  const factor = 10 ** decimals;
  const roundTo = (value: number): number => Math.round(value * factor) / factor;
  return {
    lat: roundTo(coord.lat),
    lng: roundTo(coord.lng),
  };
}

/**
 * Browser-estimated steps from distance (REQ-7.2). No reliable web step
 * counter exists, so steps = distance / stride length; always labeled "est."
 * in the UI. Default stride 0.7 m (PLAN.md §4).
 */
export function estimateSteps(distanceM: number, strideM = 0.7): number {
  if (!(distanceM > 0) || !(strideM > 0)) return 0;
  return Math.round(distanceM / strideM);
}

/**
 * Accumulate the total distance in meters along an ordered list of points,
 * used for polyline/route distance (REQ-7.2).
 */
export function routeDistance(points: LatLng[]): number {
  if (!points || points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineMeters(points[i - 1], points[i]);
  }
  return total;
}

/** Default map center when geolocation is unavailable: Boston Common (REQ-2.5). */
export const DEFAULT_BOSTON_CENTER: LatLng = { lat: 42.3554, lng: -71.0656 };
