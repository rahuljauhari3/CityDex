/**
 * POST /api/stamps — the check-in pipeline (design.md §6, §7; REQ-3.1–3.3,
 * 4.1, 4.3–4.8, 8.3, 14.4, 14.8).
 *
 * Multipart body: photo (File), lat, lng, accuracy, optional routeId, a
 * required `noPeople` checkbox flag, and a demo `teleport` flag. The place is
 * identified by **either** `placeId` (a seeded place) **or** `name` + `category`
 * (a new user-created place). Server-only: reaches the active `Store`. There is
 * **no AI** — the card is assembled from place data + the uploaded photo.
 *
 * Pipeline:
 *   1. validate input (zod); reject GPS accuracy > 50 m unless demo teleport;
 *      reject with a 4xx (store nothing) if `noPeople !== true`
 *   2. resolve place: `placeId` → that place (must be in range unless teleport);
 *      else create a user place from the typed `name` + `category`
 *   3. build the card from the place (seeded → stored name/category/rarity;
 *      user → typed name/category, rarity `common`), with the final rarity
 *      adjusted by collector count
 *   4. store the photo exactly as uploaded (demo: data URL in memory)
 *   5. persist route (if coords) + stamp; increment place collect_count
 *   6. respond with card + stats + points for the reveal animation
 *
 * Health snapshots, the full points formula, and badge evaluation arrive in B1;
 * B0 uses the rarity base for points.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/db";
import { rarityBase } from "@/lib/points/rarity";
import { buildStampCard } from "@/lib/stamp/build";
import { STAMP_CATEGORIES } from "@/lib/stamp/card";
import {
  haversineMeters,
  isWithinGeofence,
  roundCoord,
  type LatLng,
} from "@/lib/geo";
import { DEMO_USER_ID } from "@/lib/demo-user";
import type { Place, PlaceCategory } from "@/lib/db/types";

export const runtime = "nodejs";

const GEOFENCE_M = 75;
const MAX_ACCURACY_M = 50;

const boolFlag = z
  .union([z.literal("true"), z.literal("false"), z.boolean()])
  .optional()
  .transform((v) => v === true || v === "true");

const CheckInSchema = z
  .object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    accuracy: z.coerce.number().min(0).optional(),
    routeId: z.string().optional(),
    placeId: z.string().min(1).optional(),
    // For a new, unseeded place: the user types a name + picks a category.
    name: z.string().trim().min(1).max(80).optional(),
    category: z.enum(STAMP_CATEGORIES).optional(),
    // Required privacy guard (REQ-4.6). The photo is never stored unless true.
    noPeople: boolFlag,
    // Demo-only: skip the physical geofence/accuracy gates so collect works
    // without being at the place. Labeled DEMO in the UI (REQ-1.3).
    teleport: boolFlag,
  })
  .refine((v) => Boolean(v.placeId) || Boolean(v.name && v.category), {
    message: "Provide placeId, or a name and category for a new place.",
  });

const ACCEPTED_MEDIA = new Set(["image/jpeg", "image/png"]);

/** Find the nearest place within `radiusM`, or null. */
function nearestWithin(
  pos: LatLng,
  places: Place[],
  radiusM: number,
): Place | null {
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

export async function POST(request: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bail(400, "Expected multipart/form-data.");
  }

  const parsed = CheckInSchema.safeParse({
    lat: form.get("lat"),
    lng: form.get("lng"),
    accuracy: form.get("accuracy") ?? undefined,
    routeId: form.get("routeId") ?? undefined,
    placeId: form.get("placeId") ?? undefined,
    name: form.get("name") ?? undefined,
    category: form.get("category") ?? undefined,
    noPeople: form.get("noPeople") ?? undefined,
    teleport: form.get("teleport") ?? undefined,
  });
  if (!parsed.success) {
    return bail(400, "Invalid check-in parameters.");
  }
  const { lat, lng, accuracy, routeId, placeId, name, category, noPeople, teleport } =
    parsed.data;

  // Privacy guard (REQ-4.6): without the "no people" confirmation we store
  // nothing and never read the photo bytes. This replaces image analysis.
  if (!noPeople) {
    return bail(
      422,
      "Please confirm that no people are the main subject of this photo.",
      { code: "no_people_required" },
    );
  }

  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return bail(400, "A photo is required to collect a stamp.");
  }
  const mediaType = photo.type || "image/jpeg";
  if (!ACCEPTED_MEDIA.has(mediaType)) {
    return bail(415, "Photo must be a JPEG or PNG.");
  }

  // GPS-accuracy guard (REQ-3.2). Demo teleport bypasses the physical gates.
  if (!teleport && accuracy !== undefined && accuracy > MAX_ACCURACY_M) {
    return bail(422, "Location accuracy is too low. Move to open sky and retry.", {
      code: "low_accuracy",
    });
  }

  const store = getStore();
  const userPos: LatLng = { lat, lng };

  // Resolve the place (design.md §7 step 2).
  let place: Place | null = null;
  if (placeId) {
    place = await store.getPlace(placeId);
    if (!place) return bail(404, "That place no longer exists.");
    // A real (non-teleport) check-in at a chosen place must still be in range.
    if (
      !teleport &&
      !isWithinGeofence(userPos, { lat: place.lat, lng: place.lng }, GEOFENCE_M)
    ) {
      return bail(422, "You’re not close enough to collect here yet.", {
        code: "out_of_range",
      });
    }
  } else {
    // New, unseeded spot. If an existing seeded place is within the geofence we
    // collect that instead of duplicating it; otherwise create a user place
    // from the typed name + category at rounded (privacy) coords.
    const all = await store.getPlaces();
    place = teleport ? null : nearestWithin(userPos, all, GEOFENCE_M);
    if (!place) {
      const rounded = roundCoord(userPos);
      place = await store.createPlace({
        name: name as string,
        lat: rounded.lat,
        lng: rounded.lng,
        neighborhood: null,
        category: category as PlaceCategory,
        source: "user",
        createdBy: DEMO_USER_ID,
        baselineRarity: "common",
      });
    }
  }

  // Build the card from the place (design.md §6, §7 steps 3 & 6). The final
  // rarity is the place's baseline rarity adjusted by its prior collect count.
  const priorCollectCount = place.collectCount;
  const card =
    place.source === "seed"
      ? buildStampCard({
          source: "seed",
          name: place.name,
          category: place.category,
          baselineRarity: place.baselineRarity,
          priorCollectCount,
        })
      : buildStampCard({
          source: "user",
          name: place.name,
          category: place.category,
          priorCollectCount,
        });

  // Store the (client-resized, EXIF-stripped) photo exactly as uploaded. The
  // demo store keeps it as an in-memory data URL; the client already strips
  // EXIF/location before upload (REQ-14.8). The server never reads EXIF and
  // applies no filter (REQ-4.5).
  const bytes = new Uint8Array(await photo.arrayBuffer());
  const base64 = Buffer.from(bytes).toString("base64");
  const photoPath = `data:${mediaType};base64,${base64}`;

  // Persist a route if the client tracked one inline (full browser tracking is
  // B1). For B0 we persist a minimal route record when coords are present.
  let persistedRouteId: string | null = routeId ?? null;
  if (!persistedRouteId) {
    const route = await store.createRoute({
      userId: DEMO_USER_ID,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      distanceM: 0,
      polyline: null,
      estSteps: 0,
    });
    persistedRouteId = route.id;
  }

  // Points: B0 uses the rarity base of the final (adjusted) rarity. The full
  // formula (movement/effort/goal/repeat) lands in B1 (design.md §8).
  const rarity = card.rarity;
  const points = rarityBase(rarity);

  const updatedPlace = await store.recordCollection(place.id);

  const stamp = await store.createStamp({
    userId: DEMO_USER_ID,
    placeId: place.id,
    routeId: persistedRouteId,
    photoPath,
    card,
    rarity,
    points,
    healthSnapshot: null,
  });

  return NextResponse.json({
    accepted: true,
    stamp,
    place: updatedPlace ?? place,
  });
}
