/**
 * POST /api/stamps: the check-in pipeline (PLAN.md §2 step 5, design.md §7).
 *
 * Multipart body: photo (File), lat, lng, accuracy, optional route tracking
 * (routeStartedAt, routeDistanceM), a required `noPeople` confirmation, and a
 * demo `teleport` flag. The place is either `placeId` (seeded) or `name` +
 * `category` (new user place). There is no AI: the card comes from the place,
 * and the photo is shown exactly as uploaded.
 *
 * Pipeline:
 *   1. validate input; reject GPS accuracy > 50 m unless demo teleport;
 *      store nothing without the "no people" confirmation
 *   2. resolve the place (must be within ~75 m unless teleport)
 *   3. build the card from the place, final rarity adjusted by collector count
 *   4. health snapshot from every connected provider for [route start … now]
 *   5. points: rarity base + discoverer + movement + effort (×1.5 for quests)
 *   6. save route + stamp, bump the place's collect count, award badges
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/db";
import { cardForPlace } from "@/lib/stamp/build";
import { STAMP_CATEGORIES } from "@/lib/stamp/card";
import {
  DEFAULT_BOSTON_CENTER,
  estimateSteps,
  haversineMeters,
  isWithinGeofence,
  roundCoord,
  type LatLng,
} from "@/lib/geo";
import { DEMO_USER_ID } from "@/lib/demo-user";
import { isDemoMode } from "@/lib/config";
import type { Place, PlaceCategory } from "@/lib/db/types";
import { computePoints } from "@/lib/points/compute";
import { BADGES, evaluateBadges } from "@/lib/badges/rules";
import { zone2Plus } from "@/lib/health/zones";
import { checkinSnapshot, dailyFor } from "@/lib/app/health";
import { getQuests, getToday } from "@/lib/app/views";
import { compareToUsual, goalImpact, paceMinPerKm } from "@/lib/health/checkin";
import { computePlaceInsight } from "@/lib/insights/place";
import { addDays, nyDate } from "@/lib/time";

export const runtime = "nodejs";

const GEOFENCE_M = 75;
const MAX_ACCURACY_M = 50;
/** Walking pace used to simulate a demo-teleport route. */
const DEMO_MIN_PER_KM = 12.5;

const boolFlag = z
  .union([z.literal("true"), z.literal("false"), z.boolean()])
  .optional()
  .transform((v) => v === true || v === "true");

const optionalNumber = z.preprocess((v) => (v === null || v === "" ? undefined : v), z.coerce.number().optional());

const CheckInSchema = z
  .object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    accuracy: optionalNumber.pipe(z.number().min(0).optional()),
    routeStartedAt: z.string().datetime().optional(),
    routeDistanceM: optionalNumber.pipe(z.number().min(0).max(100_000).optional()),
    fromLat: optionalNumber,
    fromLng: optionalNumber,
    placeId: z.string().min(1).optional(),
    name: z.string().trim().min(1).max(80).optional(),
    category: z.enum(STAMP_CATEGORIES).optional(),
    noPeople: boolFlag,
    teleport: boolFlag,
    simulatedWalk: boolFlag,
  })
  .refine((v) => Boolean(v.placeId) || Boolean(v.name && v.category), {
    message: "Provide placeId, or a name and category for a new place.",
  });

const ACCEPTED_MEDIA = new Set(["image/jpeg", "image/png"]);

function nearestWithin(pos: LatLng, places: Place[], radiusM: number): Place | null {
  let best: Place | null = null;
  let bestD = Infinity;
  for (const p of places) {
    const d = haversineMeters(pos, { lat: p.lat, lng: p.lng });
    if (d <= radiusM && d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

function bail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status });
}

function field(form: FormData, key: string) {
  const v = form.get(key);
  return v === null ? undefined : v;
}

export async function POST(request: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bail(400, "Expected multipart/form-data.");
  }

  const parsed = CheckInSchema.safeParse({
    lat: field(form, "lat"),
    lng: field(form, "lng"),
    accuracy: field(form, "accuracy"),
    routeStartedAt: field(form, "routeStartedAt"),
    routeDistanceM: field(form, "routeDistanceM"),
    fromLat: field(form, "fromLat"),
    fromLng: field(form, "fromLng"),
    placeId: field(form, "placeId"),
    name: field(form, "name"),
    category: field(form, "category"),
    noPeople: field(form, "noPeople"),
    teleport: field(form, "teleport"),
    simulatedWalk: field(form, "simulatedWalk"),
  });
  if (!parsed.success) return bail(400, "Invalid check-in parameters.");
  const input = parsed.data;
  // Demo-only shortcuts are refused outside demo mode.
  if ((input.teleport || input.simulatedWalk) && !isDemoMode) {
    return bail(403, "Teleport and simulated walks are only available in demo mode.");
  }

  // Privacy guard: without the "no people" confirmation we store nothing.
  if (!input.noPeople) {
    return bail(422, "Please confirm that no people are the main subject of this photo.", {
      code: "no_people_required",
    });
  }

  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return bail(400, "A photo is required to collect a stamp.");
  }
  const mediaType = photo.type || "image/jpeg";
  if (!ACCEPTED_MEDIA.has(mediaType)) return bail(415, "Photo must be a JPEG or PNG.");

  if (!input.teleport && input.accuracy !== undefined && input.accuracy > MAX_ACCURACY_M) {
    return bail(422, "Location accuracy is too low. Move to open sky and retry.", { code: "low_accuracy" });
  }

  const store = getStore();
  const userPos: LatLng = { lat: input.lat, lng: input.lng };

  let place: Place | null = null;
  if (input.placeId) {
    place = await store.getPlace(input.placeId);
    if (!place) return bail(404, "That place no longer exists.");
    if (!input.teleport && !isWithinGeofence(userPos, { lat: place.lat, lng: place.lng }, GEOFENCE_M)) {
      return bail(422, "You’re not close enough to collect here yet.", { code: "out_of_range" });
    }
  } else {
    // Collect an existing place within the geofence instead of duplicating it.
    place = input.teleport ? null : nearestWithin(userPos, await store.getPlaces(), GEOFENCE_M);
    if (!place) {
      const rounded = roundCoord(userPos); // ~10 m, privacy rule
      place = await store.createPlace({
        name: input.name as string,
        lat: rounded.lat,
        lng: rounded.lng,
        neighborhood: null,
        category: input.category as PlaceCategory,
        source: "user",
        createdBy: DEMO_USER_ID,
        baselineRarity: "common",
      });
    }
  }

  const priorCollectCount = place.collectCount;
  const card = cardForPlace(place, priorCollectCount);

  // The client already resized the photo and stripped EXIF/location. The
  // demo store keeps it as a data URL; it is shown exactly as uploaded.
  const bytes = new Uint8Array(await photo.arrayBuffer());
  const photoPath = `data:${mediaType};base64,${Buffer.from(bytes).toString("base64")}`;

  // Route window: [route start … now]. Demo teleport simulates the walk from
  // where the user is (or downtown) to the place.
  const now = new Date();
  let distanceM = input.routeDistanceM ?? 0;
  let startedAt = input.routeStartedAt ? new Date(input.routeStartedAt) : null;
  if (input.teleport && (!startedAt || distanceM < 100)) {
    const fromPos =
      input.fromLat !== undefined && input.fromLng !== undefined
        ? { lat: input.fromLat, lng: input.fromLng }
        : DEFAULT_BOSTON_CENTER;
    const straight = haversineMeters(fromPos, { lat: place.lat, lng: place.lng });
    distanceM = Math.min(3500, Math.max(900, straight * 1.25));
    startedAt = new Date(now.getTime() - (distanceM / 1000) * DEMO_MIN_PER_KM * 60_000);
  }
  if (!startedAt) startedAt = new Date(now.getTime() - 15 * 60_000);

  const route = await store.createRoute({
    userId: DEMO_USER_ID,
    startedAt: startedAt.toISOString(),
    endedAt: now.toISOString(),
    distanceM: Math.round(distanceM),
    polyline: null, // Routes are private; the path itself is not stored.
    estSteps: estimateSteps(distanceM),
  });

  const healthSnapshot = await checkinSnapshot(
    DEMO_USER_ID,
    { from: startedAt, to: now, distanceM },
    `${DEMO_USER_ID}:${place.id}:${now.toISOString()}`,
  );

  const myStamps = await store.getStampsByUser(DEMO_USER_ID);
  const repeatVisit = myStamps.some((s) => s.placeId === place.id);
  const { quests } = await getQuests(DEMO_USER_ID, userPos, 5);
  const recommended = quests.some((q) => q.place.id === place.id);
  const breakdown = computePoints({
    rarity: card.rarity,
    firstDiscoverer: priorCollectCount === 0,
    steps: healthSnapshot?.steps ?? 0,
    zone2PlusMinutes: zone2Plus(healthSnapshot?.hrZoneMinutes),
    recommended,
    repeatVisit,
  });

  const updatedPlace = await store.recordCollection(place.id);
  const stamp = await store.createStamp({
    userId: DEMO_USER_ID,
    placeId: place.id,
    routeId: route.id,
    photoPath,
    card,
    rarity: card.rarity,
    points: breakdown.total,
    pointsBreakdown: breakdown,
    healthSnapshot,
  });

  // Badges over the full history; only newly earned ones are returned.
  const places = new Map((await store.getPlaces()).map((p) => [p.id, p]));
  const today = nyDate(now);
  const days = await dailyFor(DEMO_USER_ID, Array.from({ length: 14 }, (_, i) => addDays(today, -i)));
  const daily = days.map((d) => ({ date: d.date, source: "demo" as const, isDemo: d.isDemo, steps: d.values.steps }));
  const newBadges: { slug: string; name: string; icon: string; description: string }[] = [];
  for (const slug of evaluateBadges({ stamps: [...myStamps, stamp], places, daily })) {
    if (await store.awardBadge(DEMO_USER_ID, slug)) {
      const def = BADGES.find((b) => b.slug === slug);
      if (def) newBadges.push({ slug, name: def.name, icon: def.icon, description: def.description });
    }
  }

  // Health context for the reveal: goal impact and how this compares.
  const todayView = await getToday(DEMO_USER_ID);
  const insight = repeatVisit ? computePlaceInsight([...myStamps, stamp], updatedPlace ?? place) : null;
  const pace = paceMinPerKm(healthSnapshot);

  return NextResponse.json({
    accepted: true,
    stamp,
    place: updatedPlace ?? place,
    recommended,
    repeatVisit,
    newBadges,
    health: {
      paceMinPerKm: pace === null ? null : Math.round(pace * 10) / 10,
      goalImpact: goalImpact(healthSnapshot, todayView.progress),
      usual: compareToUsual(healthSnapshot, myStamps),
      placeInsight: insight ? { text: insight.text, history: insight.history, visits: insight.visits } : null,
    },
  });
}
