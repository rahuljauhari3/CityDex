/**
 * POST /api/stamps — the check-in pipeline (design.md §7; REQ-3.1–3.3, 4.1,
 * 4.4, 4.8, 14.4, 14.8).
 *
 * Multipart body: photo (File), lat, lng, accuracy, optional routeId, optional
 * placeId, and a demo `teleport` flag. Server-only: reaches the active `Store`
 * and the AI card generator (Claude or deterministic mock). The Anthropic key
 * and any backend secrets never leave the server.
 *
 * Pipeline:
 *   1. validate input (zod); reject GPS accuracy > 50 m unless demo teleport
 *   2. resolve place: explicit placeId → that place; else nearest seeded place
 *      within ~75 m; else create a user place at rounded coords
 *   3. geofence gate (~75 m) unless demo teleport
 *   4. AI card (Claude or mock); if not accepted → retake, store nothing
 *   5. store photo (demo: data URL in memory), only when accepted
 *   6. persist route (if coords) + stamp; increment place collect_count
 *   7. respond with card + stats + points for the reveal animation
 *
 * Health snapshots, the full points formula, final-rarity adjustment, and badge
 * evaluation arrive in M3/M4; M2 uses the AI-suggested rarity and the rarity
 * base for points.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/db";
import { generateCard } from "@/lib/ai";
import { rarityBase } from "@/lib/points/rarity";
import {
  haversineMeters,
  isWithinGeofence,
  roundCoord,
  type LatLng,
} from "@/lib/geo";
import { DEMO_USER_ID } from "@/lib/demo-user";
import type { Place, StampCard } from "@/lib/db/types";

export const runtime = "nodejs";

const GEOFENCE_M = 75;
const MAX_ACCURACY_M = 50;

const CheckInSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  accuracy: z.coerce.number().min(0).optional(),
  routeId: z.string().optional(),
  placeId: z.string().optional(),
  // Demo-only: skip the physical geofence/accuracy gates so collect works
  // without being at the place. Labeled DEMO in the UI (REQ-1.3).
  teleport: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "true"),
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
    teleport: form.get("teleport") ?? undefined,
  });
  if (!parsed.success) {
    return bail(400, "Invalid check-in parameters.");
  }
  const { lat, lng, accuracy, routeId, placeId, teleport } = parsed.data;

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
    const all = await store.getPlaces();
    place = nearestWithin(userPos, all, GEOFENCE_M);
    if (!place) {
      // New, unseeded spot: create a user place at rounded (privacy) coords.
      const rounded = roundCoord(userPos);
      place = await store.createPlace({
        name: "Unknown Spot",
        lat: rounded.lat,
        lng: rounded.lng,
        neighborhood: null,
        category: "other",
        source: "user",
        createdBy: DEMO_USER_ID,
      });
    }
  }

  // AI card (design.md §7 step 4). Run before storing anything so a rejected or
  // refused photo is never persisted (REQ-4.4, 4.8).
  const bytes = new Uint8Array(await photo.arrayBuffer());
  let card: StampCard;
  let aiSource: "claude" | "mock";
  try {
    const result = await generateCard(bytes, mediaType as "image/jpeg" | "image/png");
    card = result.card;
    aiSource = result.source;
  } catch {
    return bail(502, "Couldn’t reach the card generator. Please try again.");
  }

  if (!card.accepted) {
    // Store nothing; ask the user to retake (REQ-4.8).
    return NextResponse.json(
      {
        accepted: false,
        reason: card.rejectReason ?? "This photo can’t be collected.",
        message:
          "We couldn’t turn this into a stamp — try a photo of a place, not a person. No photo was saved.",
      },
      { status: 200 },
    );
  }

  // Store the (client-resized, EXIF-stripped) photo. Demo store keeps it as an
  // in-memory data URL; the client already strips EXIF/location before upload
  // (REQ-14.8). Server never trusts or reads EXIF.
  const base64 = Buffer.from(bytes).toString("base64");
  const photoPath = `data:${mediaType};base64,${base64}`;

  // Persist a route if the client tracked one inline (full browser tracking is
  // M3). For M2 we persist a minimal route record when coords are present.
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

  // Final rarity adjustment and the full points formula arrive in M4; M2 uses
  // the AI-suggested rarity and the rarity base (design.md §8).
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
    aiSource,
  });
}
