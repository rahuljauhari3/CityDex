# CityDex Core — Design

Grounded in `PLAN.md` and `.kiro/steering/*.md`. This document covers the
architecture, data model, provider adapter, AI card pipeline, the
points/badges/recommendation algorithms, the demo-mode fallback storage design,
and the check-in pipeline sequence. Requirement IDs (REQ-n) refer to
`requirements.md`.

---

## 1. Architecture overview

CityDex is a mobile-first Next.js (App Router) + TypeScript PWA with Tailwind.
All secret-touching code is server-side only.

```
Browser (mobile, 375×812)
  ├─ App Router pages: /map /quests /dex /feed /profile /onboarding
  ├─ Client components: Leaflet map, camera capture, card reveal, rings
  └─ Geolocation watchPosition, client-side photo resize + EXIF strip
        │  (multipart POST, no secrets)
        ▼
Next.js server (route handlers / server actions)
  ├─ /api/stamps        → check-in pipeline (AI card, points, persistence)
  ├─ /api/providers/*   → OAuth connect/callback, Apple export upload
  ├─ /api/leaderboard   → aggregates (never location)
  └─ /api/feed /api/friends /api/kudos
        │
        ├─ lib/ (pure, testable): geo, points, badges, recs, health parsers
        ├─ lib/ai/ (server-only): Kiro ACP client (kiro-cli) + mock
        └─ lib/db/ (server-only): Supabase OR demo in-memory/SQLite fallback
        ▼
Supabase (Postgres + RLS, Auth, Storage `stamps`)  ── OR ──  Demo store
External: kiro-cli (Kiro, ACP), Strava/WHOOP/Fitbit OAuth, OSM tiles
```

Design rules (from `structure.md`):
- Pure logic lives in `lib/points`, `lib/badges`, `lib/recs`, `lib/geo`, and the
  Apple Health parser — no I/O, directly unit-testable (REQ-8, 9, 11, 13).
- Server-only modules (`lib/ai`, provider token handling, `lib/db` service-role
  paths) are never imported into client components (REQ-4.9, 14.10).
- Demo fallbacks live beside the real implementation: `lib/health/demo.ts`,
  `lib/ai/mock.ts`, `lib/db/memory.ts` (REQ-1.6, 1.7, 4.6, 6.2).
- Validate every external input (API body, AI output, provider response) with
  `zod` at the boundary.

### Directory layout (from `structure.md`)
```
app/(routes)/{map,quests,dex,feed,profile,onboarding}
app/api/{stamps,providers,auth,leaderboard,feed,friends,kudos}
components/{map,stamp,feed,leaderboard,ui}
lib/{health,points,badges,recs,geo,ai,db}
tests/            data/seed/            public/ (manifest, icons, pixel assets)
```

---

## 2. Config and demo-mode resolution (REQ-1)

A single `lib/config.ts` reads env once and exposes typed flags:
- `isDemoMode = DEMO_MODE === "true"`
- `hasSupabase = NEXT_PUBLIC_SUPABASE_URL && NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `aiProvider = AI_PROVIDER` (`kiro` | `mock`; default `kiro` if a `kiro-cli`
  binary is found on `KIRO_CLI_PATH`, else `mock`)
- `kiroCliPath`, `kiroCardAgent`, `kiroCardTimeoutMs` (ACP card generator config)
- `hasStrava`, `hasWhoop`, `hasFitbit` similarly.

Selection logic (REQ-1.6, 1.7, 4.6, 6.2):
- DB: `hasSupabase ? supabaseStore : memoryStore`.
- AI: `aiProvider === "kiro" && kiro-cli available ? kiroAcpCard : mockCard`
  (ACP path falls back to the CLI path, then to the mock on any failure).
- Health: always include `demo` provider; add real providers when keys + user
  connection exist.

The app must never crash from a missing key; absence selects the fallback.

---

## 3. Data model (REQ-8, 9, 10, 12, 14)

Postgres tables (Supabase), mirrored by a demo in-memory store with identical
shapes.

```
profiles(id uuid pk = auth.uid, username unique, avatar_url,
         home_neighborhood, show_route_map bool default false, created_at)
goals(id, user_id fk, type[steps|active_kcal|zone_minutes|explore|recovery],
      target int, period[day|week], active bool)
health_connections(id, user_id, provider, access_token_enc, refresh_token_enc,
                   expires_at, scopes, connected_at)
places(id, name, lat, lng, neighborhood, category,
       source[seed|user], created_by, first_collected_at, collect_count)
routes(id, user_id, started_at, ended_at, distance_m, polyline, est_steps,
       shared bool default false)
stamps(id, user_id, place_id, route_id, photo_path, card jsonb, rarity,
       points, health_snapshot jsonb, created_at)
badges(id, slug, name, description, rule jsonb, icon)
user_badges(user_id, badge_id, earned_at)
friendships(user_id, friend_id, status[pending|accepted], created_at)
kudos(stamp_id, user_id, created_at)
leaderboard_weekly (SQL view: user_id, week_start, steps, points, stamps)
```

### RLS and token protection (REQ-14.10, 14.11)
- Every table has RLS: a user can read/write only their own private rows.
- `stamps` and `profiles` are visible to accepted friends; globally only through
  leaderboard aggregate views (REQ-12.5, 8.7).
- `health_connections` rows are readable only by the service role.
- Tokens stored encrypted (AES-GCM with a server key) or via Supabase Vault
  (REQ-14.10).

### Coordinate and photo handling (REQ-14.4, 14.8)
- Check-in coordinates rounded to ~10 m (≈ 4 decimal places) before storage.
- Photos have EXIF (incl. location) stripped client-side before upload and again
  validated server-side.

---

## 4. Demo-mode fallback storage design (REQ-1.6, 1.7)

`lib/db/` exposes a single `Store` interface so route handlers don't branch on
backend:

```ts
interface Store {
  getPlaces(bbox): Promise<Place[]>;
  getPlace(id): Promise<Place | null>;
  createPlace(input): Promise<Place>;
  createStamp(input): Promise<Stamp>;
  getStampsByUser(userId): Promise<Stamp[]>;
  getDexForUser(userId, nearby): Promise<DexEntry[]>; // owned + locked silhouettes
  createRoute(input): Promise<Route>;
  getGoals(userId) / upsertGoal(...) ;
  getLeaderboard(scope, window, metric): Promise<LeaderboardRow[]>;
  addFriend / acceptFriend / listFriends ;
  getFeed(userId): Promise<FeedItem[]>;
  addKudos(stampId, userId) ;
  awardBadge / listBadges ;
  deleteAccount(userId): Promise<void>;
}
```

Two implementations:
- **`supabaseStore`** — real Postgres + Storage; used when `hasSupabase`.
- **`memoryStore`** — process-memory maps seeded from `data/seed/`. For the demo
  it keeps photos as data URLs in memory (no Storage bucket). Optionally backed
  by SQLite if persistence across restarts is wanted; in-memory is sufficient
  for the demo. Chosen at startup by `lib/config.ts`.

Because both satisfy `Store`, REQ-1.3 (full flow with no keys) is met by wiring
route handlers to `getStore()` only.

---

## 5. Provider adapter (REQ-6, 7, 13)

```ts
interface HealthProvider {
  id: "demo" | "strava" | "apple_export" | "whoop" | "fitbit" | "garmin" | "samsung";
  displayName: string;
  status: "available" | "coming_soon";
  connect?(userId): Promise<{ redirectUrl: string }>;        // OAuth
  handleCallback?(userId, params: URLSearchParams): Promise<void>;
  getSnapshot(userId, from: Date, to: Date): Promise<HealthSnapshot | null>;
}

type HealthSnapshot = {
  source: HealthProvider["id"];
  from: string; to: string;
  steps?: number; stepsEstimated?: boolean;
  distanceM?: number; activeKcal?: number;
  hrAvg?: number; hrMax?: number;
  hrZoneMinutes?: { z1: number; z2: number; z3: number; z4: number; z5: number };
  spo2Avg?: number; isDemo: boolean;
};
```

Adapters:
- **demo** (REQ-6.2): seeded synthetic snapshots scaled by route distance;
  `isDemo=true`, every field labeled DEMO in the UI.
- **strava** (REQ-13.1): web OAuth, scope `activity:read_all`; maps activity
  detail (distance, moving time, avg/max HR, calories) to the snapshot.
- **apple_export** (REQ-13.2): parses uploaded `export.xml` with a streaming SAX
  parser; pure `lib/health/apple.ts` maps the HK identifiers to snapshot fields.
- **whoop / fitbit** (P2): web OAuth; may be stubbed initially.
- **garmin / samsung** (REQ-13.3): `status: "coming_soon"` with the honest reason.

### Merge rule (REQ-6.5)
Given snapshots from all connected providers for a window, prefer real device
data over estimates per field, and record which `source` supplied each field.
Estimated fields keep `stepsEstimated=true`/"est." labels.

### Browser route tracking (REQ-7)
A client route tracker accumulates `watchPosition` points into distance +
polyline; `est_steps = distanceM / strideLengthM` (default 0.7 m), always labeled
"est.". The check-in requests the snapshot for `[route.started_at … now]`.

---

## 6. AI stamp-card pipeline (REQ-4)

Authoritative pattern comes from the `kiro-vision-card` skill; the agent
implementing `lib/ai` must activate it. Shape summary:

- `StampCardSchema` (zod): `accepted`, `rejectReason`, `name`, `category` enum,
  `rarity` enum, `lore ≤ 220 chars`, `tags` max 4, `colorHex`.
- Client resizes to ≤ 1280 px long edge, JPEG ~0.8, strips EXIF (REQ-3.5, 14.8).
- Server spawns `kiro-cli acp --agent $KIRO_CARD_AGENT` and drives it over the
  Agent Client Protocol (JSON-RPC 2.0 over stdio): `initialize` → `session/new`
  → `session/prompt` with the **base64 image content block BEFORE the text
  block** (`{ type: "image", mimeType, data }`, `data` has no `data:` prefix)
  (REQ-4.3) → collect `session/update` `agent_message_chunk` text.
- **CLI fallback** (REQ-4.2): if ACP image input is unavailable, write the photo
  to an OS temp file and run `kiro-cli chat --no-interactive --agent
  $KIRO_CARD_AGENT`, pointing the agent at the temp file; delete the temp file
  afterwards.
- **Output parsing** (REQ-4.5): extract the first balanced JSON object from the
  reply and `StampCardSchema.safeParse(...)`; a missing/unparseable/invalid
  object is treated as a refusal.
- **Refusal / reject** → generic "Mystery Spot" card; do not store the photo
  (REQ-4.4). Applies to a `refusal`/`cancelled` stop reason, no parseable JSON,
  a schema failure, or `accepted === false` (REQ-4.8).
- **Timeout + kill:** enforce `KIRO_CARD_TIMEOUT_MS` (default 45000); SIGKILL the
  kiro-cli child on timeout and fall back to the mock; no orphan processes.
- **Single in-process queue:** only one kiro-cli card job runs at a time.
- **No kiro-cli / `AI_PROVIDER=mock`** → `lib/ai/mock.ts` deterministic card
  (REQ-4.6).
- kiro-cli is spawned **server-side only**, never from the client (REQ-4.9). The
  app does not use the Anthropic SDK or API.
- System prompt tone (agent `citydex-cardsmith`): whimsical village naturalist;
  short, punny, PG; never identify or describe real people; lore is clearly
  playful, not factual.

---

## 7. Check-in pipeline sequence (REQ-3, 4, 6, 7, 8, 9)

`POST /api/stamps` (multipart: photo, lat, lng, accuracy, routeId):

1. **Validate input** with zod; reject if GPS accuracy > 50 m (REQ-3.2).
2. **Resolve place**: within ~75 m of a seeded place → that place; else create a
   `source=user` place at rounded coords (REQ-3.1, 3.3, 14.4).
3. **Health snapshot**: merge snapshots from the user's connected providers for
   `[route.started_at … now]`; demo provider if none (REQ-6, 7.3).
4. **AI card**: run the Kiro ACP pipeline (or CLI fallback / mock). Handle
   refusal/rejection first;
   if not accepted, return a retake response and store nothing (REQ-4.4, 4.8).
5. **EXIF strip + store photo** (only if accepted) to Storage / memory data URL
   (REQ-14.8).
6. **Final rarity**: AI suggestion, +1 tier for first 3 collectors, capped at
   "uncommon" when collect_count > 50 (REQ-8.3).
7. **Points**: compute via `lib/points` using rarity + snapshot + whether the
   place was goal-recommended + repeat-visit flag (REQ-8.1, 8.2).
8. **Persist**: stamp (card jsonb, rarity, points, health_snapshot jsonb), route,
   increment place collect_count and set first_collected_at if first.
9. **Badges**: evaluate `lib/badges` rules against updated user history; award new
   ones (REQ-9.3).
10. **Leaderboard/feed**: aggregates refresh; feed item created (REQ-8.4, 12.3).
11. **Respond** with card + stats + points for the reveal animation (REQ-5.1).

```
Client ──(photo,coords,routeId)──▶ /api/stamps
  validate → resolve place → health snapshot → AI card
  (reject? → retake, store nothing)
  → strip EXIF + store photo → final rarity → points
  → persist stamp/route/place → evaluate badges → update feed/leaderboard
  ◀── card JSON + stats + points ── reveal animation
```

---

## 8. Points algorithm (REQ-8.1, 8.2, 8.3)

```
rarityBase = { common:10, uncommon:25, rare:50, epic:100, legendary:200 }[rarity]
firstDiscoverer = isNewPlaceFirstCollector ? 50 : 0
movementBonus  = min(floor(steps / 100), 100)          // +1 per 100 steps, cap +100
effortBonus    = min(zone2PlusMinutes * 2, 60)         // +2 per zone-2+ min, cap +60
base           = isRepeatVisit ? 0 : rarityBase
subtotal       = base + firstDiscoverer*(!isRepeatVisit) + movementBonus + effortBonus
points         = round(subtotal * (goalRecommended ? 1.5 : 1))
```
Repeat visit → rarity base and first-discoverer are 0; movement/effort still
count (REQ-8.2). Final rarity feeding `rarityBase` is the server-adjusted rarity
from step 6.

Pure function: `computePoints(input): number` in `lib/points` (REQ-8, testable).

---

## 9. Badge engine (REQ-9)

`lib/badges` holds rule evaluators keyed by slug, each a pure predicate over a
`UserHistory` snapshot (stamps, routes, days with stamps, category counts,
neighborhoods, max daily steps, max route zone-2 minutes, time-of-day):

- First Steps: stamps.length ≥ 1
- Mural Hunter I/II/III: muralCount ≥ 3/10/25
- Night Owl: any stamp with local hour ≥ 21
- Heart of the City: any route zone2min ≥ 30
- 10K Club: any day steps ≥ 10000
- Neighborhood Hopper: distinct neighborhoods ≥ 5
- Legend Seeker: any stamp rarity = legendary
- Green Thumb: park/nature stamps ≥ 5
- Streak 3/7/30: longest consecutive-day stamp streak ≥ 3/7/30

`evaluateBadges(history, alreadyEarned): BadgeSlug[]` returns newly earned slugs.
Rules also serializable as JSON in the `badges` table for storage/display.

---

## 10. Recommendation algorithm (REQ-11)

`lib/recs` pure scorer:
```
score(place, user) =
    w_goal   * goalFit(place, user)        // kcal/steps/zone-min logged on routes ending here vs. user's remaining goal today
  + w_friend * friendSignal(place, user)   // friends who collected here, weighted by their kcal there
  + w_novel  * (collectedByUser ? 0 : 1)
  + w_rarity * rarityValue(place)
  - w_dist   * distancePenalty(userPos, place)
```
- `goalFit`: with history, compare median route cost to remaining goal; with no
  history, estimate from distance (≈ 60 kcal/km, 0.7 m/step) and label "est."
  (REQ-11.2).
- Output includes an explainable `reason` string (REQ-11.4).
- `recommend(user, places, friendsData): Recommendation[]` returns top 5 sorted,
  surfaced as Home "Today's Quests" (REQ-11.3). Pure/testable (REQ-11.5).

Default weights are constants tuned so goal fit and reachability dominate; exposed
for unit tests.

---

## 11. Geo math (REQ-3.6, 7)

`lib/geo`:
- `haversineMeters(a, b): number`
- `isWithinGeofence(userPos, place, radiusM = 75): boolean`
- `roundCoord(coord, meters = 10)`
- `estimateSteps(distanceM, strideM = 0.7): number`
- `routeDistance(points): number` for polyline accumulation.
All pure/testable (REQ-3.6, 7.2).

---

## 12. UI / theme (REQ-2, 5, 10, 12, 14.9)

Per `ui.md`: Tailwind pixel tokens (Parchment, Wood dark/light, Grass, Sky,
Berry, activity orange `#FC5200`, rarity colors). Fonts: Pixelify Sans
(headings/numbers), VT323/Silkscreen (labels), system font for body. Components:
wooden-panel cards, stamp card with rarity glow + dither photo filter, Dex grid
with locked silhouettes, Home header (clock/weather chip, day counter, pixel
rings), Strava-style feed cards, notice-board leaderboard, bottom tab bar
(Map · Quests · Dex · Feed · Profile).

Accessibility (REQ-5.4, 14.9): ≥ 16 px body, AA contrast,
`prefers-reduced-motion` disables glow/flip, OSM attribution always visible,
"Not medical advice" footer on every health screen.

---

## 13. Privacy enforcement map (REQ-14)

| Concern | Mechanism |
|---|---|
| Per-provider opt-in + field disclosure | consent UI before connect (14.1, 14.3) |
| Disconnect deletes tokens | `deleteConnection` drops token rows (14.2) |
| Coords rounded ~10 m | `roundCoord` at check-in (14.4) |
| Routes private by default | `routes.shared=false`; feed map gated by `show_route_map` (14.5) |
| Home-zone blur | trim first/last 200 m before sharing (14.6) |
| No location on leaderboards | leaderboard views exclude coords/routes (14.7) |
| EXIF strip | client + server before store (14.8) |
| Not-medical-advice footer | shared layout on health screens (14.9) |
| Token encryption + service-role only | AES-GCM/Vault + RLS (14.10, 14.11) |
| Account deletion cascade | `deleteAccount` removes photos/stamps/snapshots/tokens (14.12) |

---

## 14. Testing strategy (vitest)

Pure-logic unit tests (per `workflow.md` cadence):
- `lib/points` — points formula incl. caps, repeat-visit, goal multiplier (REQ-8).
- `lib/badges` — each rule, streak computation (REQ-9).
- `lib/recs` — scoring ordering, no-history estimate, reasons (REQ-11).
- `lib/geo` — haversine, geofence boundary, step estimate, coord rounding (REQ-3,7).
- `lib/health/apple` — Apple Health XML parsing of the five HK identifiers (REQ-13).

Before each commit: `npm run lint` → `npx tsc --noEmit` → `npm test`.
