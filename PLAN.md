# CityDex — Build Plan

> A mobile web app that turns walking and running around a city into a collecting game.
> You move, find interesting real-world spots (murals, statues, cafés, weird doors), photograph them,
> and AI turns each one into a collectible **stamp card** with a name, rarity, and short funny lore.
> Your smartwatch health data (steps, heart rate, calories, SpO₂) powers points, tags, leaderboards,
> and place recommendations that help you hit your health goals.

- **Hackathon:** Hackachusetts 2026 — https://hackachusetts2026.vercel.app/#/healthcare
- **Primary track:** Healthcare & Biotech → **H1: Turning wearable data into better healthcare**
- **Look and feel:** cozy pixel-art farming-sim aesthetic (Stardew Valley-*inspired*) × Strava-style activity stats, feed and leaderboards
- **Build window:** 1 day

---

## 1. Main selling point

**"How does this place affect your body?"**

Wearable apps (Apple Health, Garmin, WHOOP) track your **body over time**. Strava tracks **where you went**.
CityDex connects the two: every place you collect stores a snapshot of what your body did to get there and while you were there.
That powers:

1. **Goal-driven place recommendations:** "Want 400 kcal today? Your friends burned an average of 380 kcal on the way to the Harborwalk mural."
2. **A collection game that makes healthy movement fun:** stamps, rarity, tags, leaderboards.
3. **Personal insight over time:** "Your heart rate on the Esplanade loop dropped 8 bpm over 3 weeks at the same pace."

Wellness insights only, never medical advice. The hackathon page itself says "Clinical decisions stay with qualified professionals."

---

## 2. Core user flow

1. **Onboarding**
   1. Sign up (email magic link or a username for the demo).
   2. **Pick goals** (multi-select, each with a target):
      - Daily steps (default 8,000)
      - Active calories burned (default 400 kcal)
      - Cardio minutes in heart-rate zone 2+ (default 30 min)
      - Explore: new places per week (default 3)
      - Stress and recovery: more time in green and quiet places
   3. **Connect health sources** (any of them, or skip to demo data). See section 4.
   4. **Consent screen:** explain exactly what is stored (location of check-ins, health snapshot, photo) and that leaderboards never show location.
2. **Home / Map:** your position, nearby places (pins colored by rarity), recommended places for today's goals, and goal progress rings.
3. **Go to a place.** The app tracks the walk or run in the browser with the Geolocation API (distance, duration, route).
4. **Arrive (geofence ≈ 75 m) → "Collect!"** The app prompts for a photo using the camera input.
5. **Check-in pipeline (server):**
   1. Verify location (GPS accuracy ≤ 50 m, within the geofence, or a new place at the current coordinates).
   2. Pull a **health snapshot** from connected providers for the window `[route start … now]`: steps, average and max HR, HR zones, calories, SpO₂ if available.
   3. Send the photo to Kiro (ACP vision) → stamp card JSON (name, category, rarity, lore, tags).
   4. Compute points: rarity base + health bonus + first-discoverer bonus.
   5. Save the stamp; update tags and badges, the leaderboards and the feed.
6. **Card reveal:** a pixel-art card flips over with a rarity glow, lore, stats ("1.8 km · 2,340 steps · avg 128 bpm · 142 kcal") and the points earned.
7. **Share to friends:** the stamp shows in the friends feed (Strava-style), and friends can give it a "high five" (kudos).

---

## 3. Features and priority

| Priority | Feature | Notes |
|---|---|---|
| **P0** | Map with places + live position | react-leaflet + OpenStreetMap tiles (attribution required) |
| **P0** | Check-in with geofence + photo capture | `<input type="file" accept="image/*" capture="environment">` |
| **P0** | AI stamp card from the photo | Kiro vision (ACP) + structured output (section 6) |
| **P0** | Collection book ("Dex") | Inventory-grid UI, locked silhouettes for undiscovered nearby places |
| **P0** | Demo health provider | Seeded realistic data so the demo works with no watch (labeled DEMO) |
| **P0** | Points + global leaderboard | Weekly and all-time; steps, points, stamps |
| **P1** | Strava OAuth provider | Web OAuth; activities with distance, HR, calories |
| **P1** | Apple Health export upload | Parse `export.xml` from the iPhone Health app's "Export All Health Data" |
| **P1** | Goals onboarding + progress rings | Daily and weekly |
| **P1** | Friends + friends leaderboard + feed with kudos | Add by username or invite code |
| **P1** | Tags / badges | Rule-based (section 7) |
| **P1** | Goal-based recommendations | Explainable heuristic (section 8) |
| **P2** | WHOOP OAuth provider | Recovery, strain, HR, sleep, SpO₂ |
| **P2** | Fitbit Web API provider | Steps, HR, SpO₂ |
| **P2** | Place insights over time | Same-place HR at similar pace, trending |
| **P2** | County baseline card | CDC PLACES (Suffolk County) — hackathon kit data |
| **Stub** | Garmin, Samsung Health | Show as "coming soon" with the reason (section 4) |

---

## 4. Health data integration: what is actually possible from a **web** app

This matters for the demo. Be honest with the judges about it.

| Source | Web-accessible? | Plan |
|---|---|---|
| **Apple Health** | **No public web API.** HealthKit is native iOS only. | P1: user uploads `export.zip` / `export.xml` (Health app → profile → Export All Health Data). Parse it with a streaming parser: `HKQuantityTypeIdentifierStepCount`, `HeartRate`, `ActiveEnergyBurned`, `OxygenSaturation`, `DistanceWalkingRunning`. Future: native iOS wrapper. |
| **Samsung Health / Android Health Connect** | **No web API.** Native Android SDKs only. | Stub. Future: native Android wrapper, or an aggregator. |
| **Garmin** | Garmin Health / Connect Developer API needs **business approval**. | Stub ("coming soon"). Mention it in the pitch as a roadmap item. |
| **Strava** | **Yes**, web OAuth 2.0. | P1. Scope `activity:read_all`. Activity detail gives distance, moving time, average/max HR, calories, polyline. |
| **WHOOP** | **Yes**, web OAuth 2.0 (developer app required). | P2. Recovery (resting HR, HRV, SpO₂), cycles (strain, kJ), workouts (HR zones). |
| **Fitbit (Google)** | **Yes**, Web API OAuth 2.0. | P2. Steps, HR intraday (personal apps), SpO₂. |
| **Aggregators** (Terra, Junction/Vital, Rook) | Yes, but paid/trial, and Apple/Samsung still need their mobile SDK. | Optional, not required for the demo. |
| **Browser itself** | Geolocation only. No reliable step counter on the web. | Route distance and duration from `watchPosition`; **estimated** steps = distance / stride length (label it "est."). |
| **Demo** | n/a | Seeded synthetic snapshots, optionally shaped from the PhysioNet wearable dataset in the hackathon kit. Always labeled "DEMO DATA". |

### Provider adapter interface
```ts
interface HealthProvider {
  id: "demo" | "strava" | "apple_export" | "whoop" | "fitbit" | "garmin" | "samsung";
  displayName: string;
  status: "available" | "coming_soon";
  connect?(userId: string): Promise<{ redirectUrl: string }>;      // OAuth providers
  handleCallback?(userId: string, params: URLSearchParams): Promise<void>;
  getSnapshot(userId: string, from: Date, to: Date): Promise<HealthSnapshot | null>;
}

type HealthSnapshot = {
  source: HealthProvider["id"];
  from: string; to: string;           // ISO
  steps?: number; stepsEstimated?: boolean;
  distanceM?: number;
  activeKcal?: number;
  hrAvg?: number; hrMax?: number;
  hrZoneMinutes?: { z1: number; z2: number; z3: number; z4: number; z5: number };
  spo2Avg?: number;                   // %
  isDemo: boolean;
};
```
At check-in, merge snapshots from all connected providers. Prefer real device data over estimates, and record which source supplied each field.

---

## 5. Tech stack

- **Framework:** Next.js (App Router) + TypeScript, deployed on Vercel. Mobile-first PWA (manifest + icons, installable).
- **Styling:** Tailwind CSS with a custom pixel theme (section 9).
- **Backend:** Next.js route handlers / server actions.
- **Database / Auth / Storage:** Supabase (Postgres, Auth, Storage bucket `stamps` for photos, Row Level Security on every table).
- **Map:** `react-leaflet` + OpenStreetMap tiles (keep the © OpenStreetMap attribution visible). Pixel-styled custom markers.
- **AI:** **Kiro only** — the app does **not** use the Anthropic SDK or API. The Next.js server reaches Kiro over the **Agent Client Protocol (ACP, JSON-RPC 2.0 over stdio)** by spawning `kiro-cli acp --agent citydex-cardsmith` (section 6). A `kiro-cli chat --no-interactive` CLI fallback and a deterministic mock cover the cases where ACP image input or kiro-cli itself is unavailable. Server-side only; kiro-cli is never spawned from the client. Use the `kiro-vision-card` skill for the exact message sequence. Do not guess protocol shapes.
- **Validation:** `zod` everywhere (API inputs, AI output, provider responses).
- **Geo math:** haversine in TypeScript (PostGIS is optional; not needed for the demo scale).

### Environment variables (`.env.local`, with `.env.example` committed)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AI_PROVIDER=kiro            # kiro | mock (default: kiro if kiro-cli is found, else mock)
KIRO_CLI_PATH=kiro-cli      # path to the kiro-cli binary (default "kiro-cli")
KIRO_CARD_AGENT=citydex-cardsmith   # agent spawned for card generation
KIRO_CARD_TIMEOUT_MS=45000  # per-card timeout before the process is killed
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
WHOOP_CLIENT_ID=
WHOOP_CLIENT_SECRET=
FITBIT_CLIENT_ID=
FITBIT_CLIENT_SECRET=
APP_URL=http://localhost:3000
DEMO_MODE=true        # seeds demo users + demo health provider, mock AI card if AI_PROVIDER=mock or kiro-cli unavailable
```
**The app must run end to end with only `DEMO_MODE=true`.** With no keys and no `kiro-cli`, use a local mock for the AI card and in-memory or SQLite fallback data if Supabase is not configured. That's what keeps the hackathon demo safe.

---

## 6. AI stamp card generation (Kiro)

- **Endpoint:** `POST /api/stamps` (multipart: photo, lat, lng, accuracy, routeId).
- Resize the photo client-side to ≤ 1280 px long edge, JPEG ~0.8, before upload. Strip EXIF location before storing.
- **Runtime:** **Kiro over the Agent Client Protocol (ACP, JSON-RPC 2.0 over stdio).** The Next.js server spawns `kiro-cli acp --agent citydex-cardsmith` and drives it: `initialize` → `session/new` → `session/prompt` with the **base64 image content block before the text block** (`{ type: "image", mimeType, data }`, `data` has no `data:` prefix) → collect `session/update` `agent_message_chunk` text → extract the first JSON object and `StampCardSchema.safeParse(...)` it. **CLI fallback:** if ACP image input is unavailable, write the photo to an OS temp file and run `kiro-cli chat --no-interactive --agent citydex-cardsmith`, pointing the agent at that file. **Mock fallback:** if `AI_PROVIDER=mock` or kiro-cli is unavailable/fails, use a deterministic mock card. Refusal, no parseable JSON, a schema failure, or `accepted === false` → generic "Mystery Spot" card (do not store the photo). Enforce `KIRO_CARD_TIMEOUT_MS` (kill the process on timeout) and a single in-process queue (one card job at a time). The app does **not** use the Anthropic SDK or API. Use the `kiro-vision-card` skill for the exact message sequence. Do not guess protocol shapes.
- **Schema:**
```ts
const StampCardSchema = z.object({
  accepted: z.boolean(),               // false if the photo's main subject is a person, a screen, private property interior, or unrecognizable
  rejectReason: z.string().nullable(),
  name: z.string(),                    // e.g. "The Door That Judges You"
  category: z.enum(["mural","statue","cafe","door","park","building","transit","water","nature","shop","oddity","other"]),
  rarity: z.enum(["common","uncommon","rare","epic","legendary"]),  // AI suggestion; final rarity adjusted server-side
  lore: z.string(),                    // ≤ 220 chars, funny, kind, no claims about real people
  tags: z.array(z.string()).max(4),    // e.g. ["red-brick","cozy","historic"]
  colorHex: z.string(),                // dominant color for card frame tint
});
```
- **System prompt tone:** a whimsical village naturalist cataloging city curiosities. Short, punny, PG. Never identify or describe real people. Never invent historical facts as true (lore is clearly playful).
- **Final rarity** = AI suggestion, adjusted by how many users already hold a stamp at this place (first 3 collectors get +1 tier; places with >50 collectors drop to max "uncommon").
- **Privacy guard:** if `accepted === false` (for example, a selfie or a person as the main subject), don't store the photo. Ask the user to retake.

---

## 7. Points, tags and leaderboards

### Points per check-in
| Component | Value |
|---|---|
| Rarity base | common 10 · uncommon 25 · rare 50 · epic 100 · legendary 200 |
| First discoverer of a new place | +50 |
| Movement bonus | +1 per 100 steps on the route (cap +100) |
| Effort bonus | +2 per zone-2+ minute (cap +60) |
| Goal-recommended place | ×1.5 multiplier |
| Repeat visit to the same place | 0 base, movement/effort bonus only (encourages exploring; repeat visits still feed insights) |

### Tags / badges (rule-based, stored in a `badges` table with JSON rules)
- **First Steps:** first stamp
- **Mural Hunter I/II/III:** 3 / 10 / 25 murals
- **Night Owl:** a stamp after 9 pm
- **Heart of the City:** 30+ zone-2 minutes on one route
- **10K Club:** 10,000 steps in a day
- **Neighborhood Hopper:** stamps in 5 different neighborhoods
- **Legend Seeker:** collect a legendary
- **Green Thumb:** 5 park/nature stamps (ties to the stress/recovery goal)
- **Streak 3 / 7 / 30:** consecutive days with a stamp

### Leaderboards
- **Global** and **Friends** tabs × **This week / All time** × metric: **Steps**, **Points**, **Stamps**.
- Show avatar, username, value, rank change arrow. **Never show location or routes on leaderboards.**
- Weekly reset Monday 00:00 America/New_York.

---

## 8. Goal-based place recommendations

Explainable heuristic, no ML needed:

```
score(place, user) =
    w_goal    * goalFit(place, user.goals)          // avg calories/steps/zone-min others logged on routes ending here vs. user's remaining goal today
  + w_friend  * friendSignal(place, user)           // friends who collected here, weighted by their kcal there
  + w_novel   * (user has not collected it ? 1 : 0)
  + w_rarity  * rarityValue(place)
  - w_dist    * distancePenalty(user.position, place)   // keep it reachable
```
- `goalFit`: if the user has 250 kcal left today and the median route to this place burns ~240 kcal, that's a high fit. With no history, estimate from distance (≈ 60 kcal/km walking, 0.7 m/step; label "est.").
- Show the **reason** on each recommendation card: "3 friends burned avg 310 kcal getting here" / "Fills 80% of today's step goal" / "Never collected by anyone. Be the first!"
- Top 5 shown on Home as "Today's Quests".

---

## 9. UI / visual direction: cozy pixel × Strava

Original artwork only. Don't copy any game's sprites, fonts or logos, or use Strava's branding.

- **Fonts (Google Fonts):** `Pixelify Sans` (headings, numbers), `VT323` or `Silkscreen` (small labels), a readable system font for long text.
- **Palette (tokens in Tailwind config):**
  - Parchment `#F4E4C1`, Wood dark `#5B3A29`, Wood light `#A0703C`, Grass `#6DAA2C`, Sky `#7EC8E3`, Berry `#C0392B`
  - Activity accent (Strava-like energy): `#FC5200`-ish orange for stats and CTA buttons
  - Rarity colors: common gray `#9E9E9E`, uncommon green `#4CAF50`, rare blue `#2196F3`, epic purple `#9C27B0`, legendary gold `#FFC107`
- **Components:**
  - Wooden-panel cards with chunky 2–4 px borders and pixel shadows (`box-shadow` stepped, `image-rendering: pixelated` on sprites)
  - **Stamp card:** parchment card, rarity-colored frame with a glow animation, photo with a subtle pixelation/dither filter, name in a pixel font, lore in italics, stats row with orange numbers
  - **Dex / Collection book:** inventory grid (4 columns on mobile), locked slots as dark silhouettes with "???"
  - **Home header:** in-game-style clock and weather chip, day counter ("Day 12 of your journey"), goal progress rings drawn as pixel hearts/energy bars
  - **Feed:** Strava-style activity cards (avatar, route mini-map, distance · time · kcal · avg HR, stamp thumbnail, high-five button)
  - **Leaderboard:** wooden notice-board style with pinned paper rows
  - **Bottom tab bar:** Map · Quests · Dex · Feed · Profile
- Sound/feedback: optional little "pop" on card reveal (muted by default), `navigator.vibrate` on collect.
- Accessibility: minimum 16 px body text, contrast AA, `prefers-reduced-motion` disables the glow and flip animations.

---

## 10. Data model (Supabase / Postgres)

```
profiles(id uuid pk = auth.uid, username unique, avatar_url, home_neighborhood, created_at)
goals(id, user_id fk, type enum[steps,active_kcal,zone_minutes,explore,recovery], target int, period enum[day,week], active bool)
health_connections(id, user_id, provider, access_token_enc, refresh_token_enc, expires_at, scopes, connected_at)
places(id, name, lat, lng, neighborhood, category, source enum[seed,user], created_by, first_collected_at, collect_count)
routes(id, user_id, started_at, ended_at, distance_m, polyline, est_steps)
stamps(id, user_id, place_id, route_id, photo_path, card jsonb, rarity, points, health_snapshot jsonb, created_at)
badges(id, slug, name, description, rule jsonb, icon)
user_badges(user_id, badge_id, earned_at)
friendships(user_id, friend_id, status enum[pending,accepted], created_at)
kudos(stamp_id, user_id, created_at)
leaderboard_weekly (materialized view or SQL view: user_id, week_start, steps, points, stamps)
```
- RLS: users read/write only their own private rows; `stamps` and `profiles` visible to friends (and globally for leaderboard aggregates only). Health tokens are readable **only** by the service role.
- Encrypt provider tokens at rest (AES-GCM with a server key) or use Supabase Vault.

### Seed places (Boston)
- OpenStreetMap Overpass query for a Boston/Cambridge bbox: `tourism=artwork`, `historic=memorial|monument`, `amenity=cafe` (sample), `leisure=park`. Store name + coords + category. Cite OSM (ODbL).
- Users can also create new places by collecting somewhere unseeded (becomes `source=user`).

---

## 11. Privacy, safety and honesty (judges will check this)

- Explicit opt-in per health provider. Show which fields are pulled. A disconnect button deletes the tokens.
- Store check-in coordinates rounded to ~10 m. Routes are private by default; the feed shows a mini-map only if the user turns it on. **Home-zone blur:** hide the first and last 200 m of shared routes.
- No location or route on leaderboards, ever.
- Photos: strip EXIF. Reject photos where a person is the main subject.
- "Not medical advice" footer on every health screen. Wellness language only.
- Label all demo, synthetic and estimated data clearly ("DEMO", "est.").
- Account deletion removes photos, stamps, snapshots and tokens.

---

## 12. Milestones (build in this order; each ends runnable and committed)

| # | Milestone | Done when |
|---|---|---|
| M0 | Scaffold | Next.js + TS + Tailwind pixel theme, PWA manifest, `.env.example`, Supabase client (with demo fallback), lint passes, deployed or running locally |
| M1 | Map + places | Leaflet map, live position, seeded Boston places with rarity pins, place detail sheet |
| M2 | Check-in + photo + AI card | Geofence check, camera capture, `/api/stamps` → Kiro ACP card (or mock), card reveal animation, saved to the Dex |
| M3 | Health snapshot | Provider interface, demo provider, browser route tracking with estimated steps, snapshot attached to each stamp and shown on the card |
| M4 | Points, badges, leaderboards | Points formula, badge engine, global leaderboard (week / all time × steps / points / stamps) |
| M5 | Onboarding goals + recommendations | Goals flow, progress rings, "Today's Quests" with reasons |
| M6 | Friends + feed | Add friend, friends leaderboard tab, feed with kudos |
| M7 | Real providers | Strava OAuth; Apple Health export upload parser; WHOOP if time allows |
| M8 | Polish + demo | Seed 6 demo users with a week of history, demo script below works on a phone, README with setup + data sources + caveats |

---

## 13. Two-minute demo script

1. **Hook (15 s):** "Your watch knows your heart rate. Strava knows your route. Nobody tells you how a place affects your body, or makes walking to it fun."
2. **Onboard (20 s):** pick "400 kcal/day" + "explore 3 places/week", connect Strava (or the demo provider).
3. **Quests (20 s):** Home shows "Today's Quests". Tap one: "3 friends burned avg 310 kcal getting here."
4. **Collect (30 s):** arrive at a mural, snap a photo, and the card flips: *"The Wall That Ate Tuesday" · RARE · 1.6 km · 2,180 steps · avg 124 bpm · 138 kcal · +86 pts*.
5. **Social (20 s):** badge unlocked "Mural Hunter I", friends leaderboard, a friend high-fives.
6. **Insight + honesty (15 s):** a place-insight card ("HR on this loop down 6 bpm over 2 weeks"), the CDC PLACES county baseline, and "not medical advice; Apple/Samsung need a native wrapper, which is our roadmap."

---

## 14. Open questions for the team
- Supabase project and Strava / WHOOP developer apps: who creates them? (A human must create these accounts and keys.)
- Final name: CityDex vs BostonDex.
