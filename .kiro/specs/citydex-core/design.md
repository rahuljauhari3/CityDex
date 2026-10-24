# CityDex Core — Design

Grounded in `PLAN.md` and `.kiro/steering/*.md`. This document covers the
architecture, data model, provider adapter, the place-based stamp card assembly
(no AI), the points/badges/recommendation algorithms, the place-insight / CDC
baseline / weekly-summary health features, the demo-mode fallback storage
design, and the check-in pipeline sequence. Requirement IDs (REQ-n) refer to
`requirements.md`.

---

## 1. Architecture overview

CityDex is a mobile-first Next.js (App Router) + TypeScript PWA with Tailwind.
All secret-touching code is server-side only. **No AI is used anywhere** — there
is no model client, no `kiro-cli` subprocess, and no `lib/ai`.

```
Browser (mobile, 375×812)
  ├─ App Router pages: /map /quests /dex /feed /profile /onboarding
  ├─ Client components: Leaflet map, camera capture, card reveal, rings
  └─ Geolocation watchPosition, client-side photo resize + EXIF strip
        │  (multipart POST, no secrets)
        ▼
Next.js server (route handlers / server actions)
  ├─ /api/stamps        → check-in pipeline (place-based card, points, persist)
  ├─ /api/providers/*   → OAuth connect/callback, Apple export upload
  ├─ /api/leaderboard   → aggregates (never location)
  └─ /api/feed /api/friends /api/kudos
        │
        ├─ lib/ (pure, testable): geo, points, badges, recs, insights, health parsers
        └─ lib/db/ (server-only): Supabase OR demo in-memory/SQLite fallback
        ▼
Supabase (Postgres + RLS, Auth, Storage `stamps`)  ── OR ──  Demo store
External: Strava/WHOOP/Fitbit OAuth, OSM tiles
```

Design rules (from `structure.md`):
- Pure logic lives in `lib/points`, `lib/badges`, `lib/recs`, `lib/insights`,
  `lib/geo`, and the Apple Health parser — no I/O, directly unit-testable
  (REQ-8, 9, 11, 13, 16, 18).
- Server-only modules (provider token handling, `lib/db` service-role paths) are
  never imported into client components (REQ-14.10).
- Demo fallbacks live beside the real implementation: `lib/health/demo.ts`,
  `lib/db/memory.ts` (REQ-1.6, 1.7, 6.2).
- Validate every external input (API body, provider response) with `zod` at the
  boundary.
- **No AI anywhere** (REQ-4.2): the stamp card is assembled from place data + the
  uploaded photo; there is no `lib/ai`, model call, or `kiro-cli` subprocess.

### Directory layout (from `structure.md`)
```
app/(routes)/{map,quests,dex,feed,profile,onboarding}
app/api/{stamps,providers,auth,leaderboard,feed,friends,kudos}
components/{map,stamp,feed,leaderboard,ui}
lib/{health,points,badges,recs,insights,geo,db}
tests/            data/seed/            public/ (manifest, icons, pixel assets)
```

---

## 2. Config and demo-mode resolution (REQ-1)

A single `lib/config.ts` reads env once and exposes typed flags:
- `isDemoMode` — true unless `DEMO_MODE=false` while Supabase is configured.
- `hasSupabase = NEXT_PUBLIC_SUPABASE_URL && NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `hasStrava`, `hasWhoop`, `hasFitbit` similarly.

Selection logic (REQ-1.6, 1.7, 6.2):
- DB: `hasSupabase ? supabaseStore : memoryStore`.
- Health: always include `demo` provider; add real providers when keys + user
  connection exist.

There is **no AI config** (no `AI_PROVIDER`, `KIRO_*`). The app must never crash
from a missing key; absence selects the fallback.

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
  getStampsByPlace(userId, placeId): Promise<Stamp[]>;   // for place insights
  getWeeklyHealth(userId, weekStart): Promise<WeeklySummary>;
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

## 6. Stamp-card assembly — no AI (REQ-4)

The stamp card is assembled server-side from the **place** and the uploaded
photo. There is no model call, no `kiro-cli` subprocess, and no `lib/ai`.

- **Request** (`POST /api/stamps`, multipart): photo + lat/lng/accuracy/routeId,
  the required `noPeople` checkbox flag, and **either** `placeId` (seeded place)
  **or** `name` + `category` (new user-created place). Validated with zod at the
  boundary (REQ-4.1, 4.7).
- **Photo handling:** client resizes to ≤ 1280 px long edge, JPEG ~0.8, strips
  EXIF (REQ-3.5, 14.8); the server re-validates and stores the photo **exactly
  as uploaded** — no pixel/dither filter (REQ-4.5).
- **Card source** (REQ-4.3, 4.4):
  - seeded place → `name`, `category`, `rarity` from the place record;
  - new user-created place (`source=user`) → user-typed `name` + `category`,
    rarity `common`.
  - The card has **no `lore` field** and no AI-generated text.
- **Privacy guard** (REQ-4.6): if `noPeople !== true`, return a 4xx JSON error
  and store nothing. This checkbox replaces any image analysis.
- **Card shape** stored in `stamps.card` jsonb:
```ts
type StampCard = {
  name: string;
  category: "mural"|"statue"|"cafe"|"door"|"park"|"building"
          |"transit"|"water"|"nature"|"shop"|"oddity"|"other";
  rarity: "common"|"uncommon"|"rare"|"epic"|"legendary"; // place rarity, adjusted server-side
  source: "seed"|"user";
};
```
- **Final rarity** (REQ-8.3): the place's rarity, +1 tier for the first 3
  collectors, capped at "uncommon" when collect_count > 50.
- Everything here is deterministic and offline, so demo mode works with zero
  keys (REQ-4.8).

---

## 7. Check-in pipeline sequence (REQ-3, 4, 6, 7, 8, 9)

`POST /api/stamps` (multipart: photo, lat, lng, accuracy, routeId, noPeople, and
either placeId or name+category):

1. **Validate input** with zod; reject if GPS accuracy > 50 m (REQ-3.2); reject
   with a 4xx and store nothing if `noPeople !== true` (REQ-4.6).
2. **Resolve place**: `placeId` within ~75 m → that seeded place; else create a
   `source=user` place at rounded coords from the typed `name` + `category`
   (REQ-3.1, 3.3, 4.4, 14.4).
3. **Health snapshot**: merge snapshots from the user's connected providers for
   `[route.started_at … now]`; demo provider if none (REQ-6, 7.3).
4. **Build card** from the place (seeded name/category/rarity, or user-typed
   name/category + rarity `common`) — no AI, no external process (REQ-4.3, 4.4,
   4.5, 4.8).
5. **EXIF strip + store photo** exactly as uploaded to Storage / memory data URL
   (REQ-14.8).
6. **Final rarity**: place rarity, +1 tier for first 3 collectors, capped at
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
Client ──(photo,coords,routeId,noPeople,placeId|name+category)──▶ /api/stamps
  validate (accuracy ≤ 50m, noPeople = true) → resolve/create place
  → health snapshot → build card from place data
  → strip EXIF + store photo as uploaded → final rarity → points
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
count (REQ-8.2). Final rarity feeding `rarityBase` is the server-adjusted place
rarity from step 6.

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
wooden-panel cards, stamp card with rarity glow and the photo shown as uploaded,
Dex grid with locked silhouettes, Home header (clock/weather chip, day counter,
pixel rings), Strava-style feed cards, notice-board leaderboard, bottom tab bar
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
- `lib/insights` — `computePlaceInsights` pace bucketing + bpm/week trend, min 2
  points, sample-size reporting (REQ-16); `computeWeeklySummary` aggregation with
  per-field source (REQ-18).
- `lib/health/apple` — Apple Health XML parsing of the five HK identifiers (REQ-13).

Before each commit: `npm run lint` → `npx tsc --noEmit` → `npm test`.

---

## 15. Place insights over time (REQ-16)

`lib/insights` pure function:

```ts
type PlaceInsight = {
  placeId: string;
  metric: "hr" | "resting_hr";
  deltaBpm: number;           // negative = improvement (lower HR at same pace)
  overWeeks: number;          // span between first and last comparable visit
  sampleSize: number;         // comparable visits used
  isDemo: boolean;
  text: string;               // wellness-worded, e.g. "avg HR ... down 6 bpm ..."
};

function computePlaceInsights(stamps: Stamp[], placeId: string): PlaceInsight[];
```

Algorithm:
1. Filter the user's stamps for `placeId`; each carries a `health_snapshot`
   (hrAvg, distanceM, route duration → pace) and `created_at`.
2. **Pace bucketing:** keep only visits whose pace (min/km = duration / distance)
   is within **±10%** of each other, so HR is compared at a similar effort
   (REQ-16.1). Visits outside the dominant pace band are dropped.
3. Require **≥ 2** comparable visits; otherwise emit no insight (REQ-16.2).
4. **Trend:** fit a simple linear regression of `hrAvg` against time (weeks) over
   the comparable visits; `deltaBpm = slope × overWeeks` (bpm change across the
   observed span). Report `sampleSize` (REQ-16.2).
5. **Resting/recovery:** if snapshots include resting HR / recovery (WHOOP or
   Apple), compute the same trend for `resting_hr` (REQ-16.3).
6. **Wording:** wellness language only, no diagnosis; append "based on N visits";
   label "DEMO" when any contributing snapshot `isDemo` (REQ-16.4, 16.5). Pure /
   testable (REQ-16.6).

Surfaced as a place-insight card on the place sheet / Profile, under the "not
medical advice" footer.

---

## 16. CDC PLACES county baseline (REQ-17)

Static bundled dataset `data/cdc-places-suffolk.json` (no network call):

```json
{
  "source": "CDC PLACES: Local Data for Better Health, County Data",
  "sourceUrl": "https://www.cdc.gov/places/",
  "county": "Suffolk County, MA",
  "dataYear": "2023",
  "releaseYear": 2024,
  "indicators": [
    { "id": "LPA", "label": "No leisure-time physical activity", "valuePct": 00.0 },
    { "id": "OBESITY", "label": "Obesity among adults", "valuePct": 00.0 },
    { "id": "SLEEP", "label": "Short sleep duration", "valuePct": 00.0 },
    { "id": "GHLTH", "label": "Fair or poor general health", "valuePct": 00.0 }
  ]
}
```

- The human/seed step fills in the real indicator values from CDC PLACES; values
  above are placeholders.
- Profile shows **one** card combining a county indicator with the user's own
  week, e.g. "In Suffolk County, X% of adults report no leisure-time physical
  activity. This week you logged N active minutes." (REQ-17.3).
- The card cites CDC PLACES and shows the `dataYear` (REQ-17.2, 17.4), with
  wellness wording and the "not medical advice" footer (REQ-17.5).

---

## 17. Weekly health summary (REQ-18)

`lib/insights` pure aggregation:

```ts
type WeeklySummary = {
  weekStart: string;                       // ISO, Monday 00:00 America/New_York
  steps: { value: number; source: SourceLabel };
  activeKcal: { value: number; source: SourceLabel };
  zone2PlusMin: { value: number; source: SourceLabel };
  spo2Avg?: { value: number; source: SourceLabel };
  goalProgress: { type: GoalType; value: number; target: number; pct: number }[];
};
type SourceLabel = "DEMO" | "strava" | "apple" | "est.";

function computeWeeklySummary(
  stamps: Stamp[], goals: Goal[], weekStart: Date,
): WeeklySummary;
```

- Sums the week's health snapshots for steps, active kcal and zone-2+ minutes,
  and averages SpO₂ when present (REQ-18.1).
- Records the dominant **source** per field (prefer real device over estimate),
  surfaced as a per-value label (REQ-18.2).
- Computes progress against each active weekly goal (REQ-18.3).
- Rendered on Profile under the "not medical advice" footer (REQ-18.4); pure /
  testable (REQ-18.5).
