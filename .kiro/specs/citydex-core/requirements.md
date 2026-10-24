# CityDex Core — Requirements

Source of truth: `PLAN.md` and `.kiro/steering/*.md`. This document captures the
P0 and P1 features, the privacy requirements, and the health-focused P2 features
now pulled into scope (place insights, CDC baseline), as EARS-style user stories
with numbered acceptance criteria. Requirement IDs are stable and referenced from
`design.md` and `tasks.md`.

EARS keywords used: **WHEN** (event), **WHILE** (state), **IF/THEN** (conditional),
**WHERE** (feature-inclusive), and the ubiquitous **THE SYSTEM SHALL**.

Priorities: **P0** = demo-critical, **P1** = next tier. Privacy requirements are
hard requirements regardless of priority.

---

## REQ-1: Project scaffold and demo-mode guarantee (P0)

**User story:** As a developer, I want a Next.js + TypeScript + Tailwind app that
runs end to end with no API keys, so the hackathon demo can never be blocked by
missing credentials.

### Acceptance criteria
1.1 THE SYSTEM SHALL be a Next.js (App Router) + TypeScript project styled with
Tailwind CSS using the pixel theme tokens defined in `ui.md`.
1.2 THE SYSTEM SHALL ship a PWA manifest and icons so it is installable on mobile.
1.3 WHEN the app starts WHILE `DEMO_MODE=true` and no API keys are present, THE
SYSTEM SHALL run the full flow (map → check-in → photo → card → points →
leaderboard) without error.
1.4 THE SYSTEM SHALL commit a `.env.example` listing every environment variable
from `tech.md` and SHALL NOT commit `.env.local`.
1.5 THE SYSTEM SHALL pass `npm run lint` and `npx tsc --noEmit` with no errors.
1.6 WHERE Supabase is not configured, THE SYSTEM SHALL fall back to an in-memory /
SQLite data store so all P0 reads and writes still succeed.
1.7 WHERE a required integration key is absent, THE SYSTEM SHALL select the demo
fallback for that integration and SHALL NOT crash.

---

## REQ-2: Map with places and live position (P0)

**User story:** As a user, I want a map of nearby curious places and my live
position, so I can decide where to walk next.

### Acceptance criteria
2.1 THE SYSTEM SHALL render a `react-leaflet` map using OpenStreetMap tiles with
the © OpenStreetMap attribution always visible.
2.2 WHILE the browser Geolocation permission is granted, THE SYSTEM SHALL show the
user's live position and keep it updated via `watchPosition`.
2.3 THE SYSTEM SHALL display seeded Boston places as pixel-styled markers colored
by rarity (common gray, uncommon green, rare blue, epic purple, legendary gold).
2.4 WHEN the user taps a place marker, THE SYSTEM SHALL open a place detail sheet
showing name, category, neighborhood, rarity, and collect count.
2.5 IF Geolocation permission is denied, THEN THE SYSTEM SHALL center on a default
Boston location and show a non-blocking message instead of failing.
2.6 THE SYSTEM SHALL design and verify the map screen at a 375×812 viewport with
no console errors.

---

## REQ-3: Check-in with geofence and photo capture (P0)

**User story:** As a user, I want to collect a place by confirming I'm there and
taking a photo, so I can earn a stamp.

### Acceptance criteria
3.1 WHEN the user is within approximately 75 m of a place (geofence), THE SYSTEM
SHALL enable a "Collect!" action for that place.
3.2 WHILE GPS accuracy is worse than 50 m, THE SYSTEM SHALL warn the user and
SHALL NOT allow a verified check-in until accuracy improves or the user retries.
3.3 WHEN the user initiates a collect at an unseeded location, THE SYSTEM SHALL
create a new `source=user` place at the current coordinates.
3.4 THE SYSTEM SHALL capture a photo via `<input type="file" accept="image/*"
capture="environment">`.
3.5 THE SYSTEM SHALL resize the photo client-side to ≤ 1280 px on the long edge at
JPEG quality ~0.8 before upload.
3.6 THE SYSTEM SHALL compute geofence distance using a TypeScript haversine
implementation.

---

## REQ-4: Stamp card from place + photo — no AI (P0)

**User story:** As a user, I want my photo turned into a collectible card whose
name, category and rarity come from the place, so collecting feels rewarding
without any AI.

### Acceptance criteria
4.1 WHEN a check-in is submitted to `POST /api/stamps` (multipart: photo, lat,
lng, accuracy, routeId, and either `placeId` for a seeded place or `name` +
`category` for a new user-created place, plus the "no people" checkbox flag),
THE SYSTEM SHALL process it server-side only.
4.2 THE SYSTEM SHALL use **no AI anywhere** — no  SDK or API, no Kiro
ACP card generation, and no `kiro-cli` subprocess.
4.3 WHERE the check-in targets a **seeded place**, THE SYSTEM SHALL build the
card from that place's stored `name`, `category` and `rarity`.
4.4 WHERE the check-in creates a **new user-created place** (`source=user`), THE
SYSTEM SHALL use the user-typed `name` and `category` with rarity `common`.
4.5 THE SYSTEM SHALL store and display the photo **exactly as uploaded** (no
pixel/dither filter, no AI-generated name or lore); there is no `lore` field.
4.6 THE SYSTEM SHALL require the **"No people are the main subject of this
photo"** checkbox; IF it is not set, THEN THE SYSTEM SHALL return a 4xx JSON
error and SHALL NOT store the photo.
4.7 THE SYSTEM SHALL validate the request body with zod at the boundary
(coordinates, accuracy, the checkbox flag, and either `placeId` or
`name` + `category`).
4.8 THE SYSTEM SHALL assemble the card deterministically with no external
process or network model call, so demo mode works with zero keys.

---

## REQ-5: Card reveal and Collection book / Dex (P0)

**User story:** As a user, I want my new card to flip into view and live in my
collection, so I can see and revisit what I've found.

### Acceptance criteria
5.1 WHEN a stamp is created, THE SYSTEM SHALL present a card-reveal animation: a
parchment card with a rarity-colored frame glow, the photo shown exactly as
uploaded, the name in a pixel font, a category label, and a stats row with
orange numbers.
5.2 THE SYSTEM SHALL render the Dex as a 4-column mobile inventory grid.
5.3 THE SYSTEM SHALL render undiscovered nearby places as locked dark silhouettes
labeled "???".
5.4 WHILE `prefers-reduced-motion` is set, THE SYSTEM SHALL disable the glow and
flip animations.
5.5 WHERE enabled, THE SYSTEM SHALL play an optional muted "pop" on reveal and
trigger `navigator.vibrate` on collect.

---

## REQ-6: Demo health provider and provider adapter interface (P0)

**User story:** As a user without a connected wearable, I want realistic health
data on my check-ins, so the game works and is clearly labeled as demo.

### Acceptance criteria
6.1 THE SYSTEM SHALL define a `HealthProvider` interface with
`getSnapshot(userId, from, to)` and OAuth hooks `connect`/`handleCallback`.
6.2 THE SYSTEM SHALL provide a demo provider returning seeded synthetic snapshots.
6.3 THE SYSTEM SHALL label all demo-sourced values "DEMO".
6.4 WHEN producing a snapshot, THE SYSTEM SHALL populate the `HealthSnapshot`
shape (steps, stepsEstimated, distanceM, activeKcal, hrAvg, hrMax, hrZoneMinutes,
spo2Avg, source, from, to, isDemo).
6.5 WHEN multiple providers are connected, THE SYSTEM SHALL merge snapshots,
preferring real device data over estimates, and SHALL record which source
supplied each field.

---

## REQ-7: Browser route tracking and estimated steps (P0/P1)

**User story:** As a user, I want the walk to a place tracked in the browser, so my
distance and estimated steps feed points and insights.

### Acceptance criteria
7.1 WHILE a route is active, THE SYSTEM SHALL track distance and duration from
`watchPosition`.
7.2 THE SYSTEM SHALL estimate steps as distance / stride length and SHALL label the
value "est.".
7.3 WHEN a check-in occurs, THE SYSTEM SHALL request the health snapshot for the
window `[route start … now]`.
7.4 THE SYSTEM SHALL store the route with started_at, ended_at, distance_m,
polyline, and est_steps.

---

## REQ-8: Points and global leaderboard (P0)

**User story:** As a user, I want points for check-ins and a leaderboard, so there's
competition and progress.

### Acceptance criteria
8.1 WHEN a stamp is created, THE SYSTEM SHALL compute points as: rarity base
(common 10, uncommon 25, rare 50, epic 100, legendary 200) + first-discoverer
bonus (+50) + movement bonus (+1 per 100 steps, cap +100) + effort bonus (+2 per
zone-2+ minute, cap +60), with a ×1.5 multiplier WHERE the place is
goal-recommended.
8.2 WHERE the check-in is a repeat visit to the same place, THE SYSTEM SHALL award
0 rarity base and apply only movement and effort bonuses.
8.3 THE SYSTEM SHALL compute final rarity as the place's rarity adjusted +1 tier
for the first 3 collectors of a place, and capped at "uncommon" when a place has
> 50 collectors.
8.4 THE SYSTEM SHALL provide a global leaderboard with This-week and All-time views
and Steps / Points / Stamps metrics.
8.5 THE SYSTEM SHALL reset weekly leaderboards Monday 00:00 America/New_York.
8.6 THE SYSTEM SHALL show avatar, username, value, and rank-change arrow per row.
8.7 THE SYSTEM SHALL NEVER display location or routes on any leaderboard.

---

## REQ-9: Badges / tags (P1)

**User story:** As a user, I want to unlock badges for milestones, so progress feels
rewarding.

### Acceptance criteria
9.1 THE SYSTEM SHALL store badges with JSON rules and evaluate them rule-based.
9.2 THE SYSTEM SHALL support at least: First Steps, Mural Hunter I/II/III (3/10/25
murals), Night Owl (stamp after 9pm), Heart of the City (30+ zone-2 min on one
route), 10K Club (10,000 steps in a day), Neighborhood Hopper (5 neighborhoods),
Legend Seeker (collect a legendary), Green Thumb (5 park/nature stamps), Streak
3/7/30 (consecutive days with a stamp).
9.3 WHEN a check-in satisfies a badge rule, THE SYSTEM SHALL award the badge and
surface an unlock notification.
9.4 THE SYSTEM SHALL evaluate badge rules as pure functions testable without I/O.

---

## REQ-10: Goals onboarding and progress rings (P1)

**User story:** As a user, I want to pick wellness goals during onboarding and see
my progress, so the app feels personal and motivating.

### Acceptance criteria
10.1 WHEN a new user onboards, THE SYSTEM SHALL offer multi-select goals with
targets: daily steps (default 8,000), active kcal (default 400), zone-2+ minutes
(default 30), explore new places/week (default 3), and recovery (more green/quiet
places).
10.2 THE SYSTEM SHALL store goals with type, target, period (day/week), and active
flag.
10.3 THE SYSTEM SHALL render goal progress as pixel hearts/energy rings on Home.
10.4 THE SYSTEM SHALL show a day counter and an in-game clock/weather chip on the
Home header.

---

## REQ-11: Goal-based recommendations — "Today's Quests" (P1)

**User story:** As a user, I want recommended places tied to my goals with reasons,
so I know where to go and why.

### Acceptance criteria
11.1 THE SYSTEM SHALL score places with:
`w_goal*goalFit + w_friend*friendSignal + w_novel*novelty + w_rarity*rarityValue
- w_dist*distancePenalty`.
11.2 WHERE the user has no route history for a place, THE SYSTEM SHALL estimate
goalFit from distance (≈ 60 kcal/km walking, 0.7 m/step) and label it "est.".
11.3 THE SYSTEM SHALL show the top 5 as "Today's Quests" on Home.
11.4 THE SYSTEM SHALL display an explainable reason per recommendation (e.g. "3
friends burned avg 310 kcal getting here", "Fills 80% of today's step goal",
"Never collected by anyone. Be the first!").
11.5 THE SYSTEM SHALL implement the scoring as a pure function testable without I/O.

---

## REQ-12: Friends, friends leaderboard, and feed with kudos (P1)

**User story:** As a user, I want friends and a shared feed, so collecting is social.

### Acceptance criteria
12.1 THE SYSTEM SHALL let a user add a friend by username or invite code with a
pending → accepted friendship status.
12.2 THE SYSTEM SHALL provide a Friends tab on the leaderboard alongside Global.
12.3 THE SYSTEM SHALL render a Strava-style feed card: avatar, optional route
mini-map, distance · time · kcal · avg HR, stamp thumbnail, high-five button.
12.4 WHEN a user taps high-five on a stamp, THE SYSTEM SHALL record a kudos and
update the count.
12.5 THE SYSTEM SHALL show stamps and profiles to friends, and globally only as
leaderboard aggregates.

---

## REQ-13: Real providers — Strava OAuth and Apple Health export (P1)

**User story:** As a user, I want to connect Strava or upload my Apple Health
export, so my real data powers check-ins.

### Acceptance criteria
13.1 WHERE `STRAVA_CLIENT_ID`/`SECRET` are present, THE SYSTEM SHALL support Strava
web OAuth 2.0 with scope `activity:read_all` and map activity detail to a
`HealthSnapshot` (distance, moving time, avg/max HR, calories).
13.2 THE SYSTEM SHALL let a user upload an Apple Health `export.xml` and parse
`HKQuantityTypeIdentifierStepCount`, `HeartRate`, `ActiveEnergyBurned`,
`OxygenSaturation`, `DistanceWalkingRunning` with a streaming parser.
13.3 THE SYSTEM SHALL present Garmin and Samsung Health as "coming_soon" stubs with
the honest reason (no web API / needs business approval).
13.4 THE SYSTEM SHALL implement the Apple Health XML parser as pure logic testable
without I/O.

---

## REQ-14: Privacy and consent (hard requirement)

**User story:** As a user, I want control and honesty about my health and location
data, so I can trust the app.

### Acceptance criteria
14.1 THE SYSTEM SHALL require explicit opt-in per health provider and show exactly
which fields are pulled.
14.2 THE SYSTEM SHALL provide a disconnect button that deletes the provider tokens.
14.3 THE SYSTEM SHALL show a consent screen explaining what is stored (check-in
location, health snapshot, photo) before any data is captured.
14.4 THE SYSTEM SHALL store check-in coordinates rounded to ~10 m.
14.5 THE SYSTEM SHALL keep routes private by default and show a feed mini-map only
when the user turns it on.
14.6 WHEN a route is shared, THE SYSTEM SHALL blur the first and last 200 m
(home-zone blur).
14.7 THE SYSTEM SHALL NEVER show location or routes on leaderboards.
14.8 THE SYSTEM SHALL strip EXIF (including location) from photos before storing,
store and display the photo exactly as uploaded, and require the "No people are
the main subject of this photo" checkbox (returning a 4xx and storing nothing if
it is unset).
14.9 THE SYSTEM SHALL show a "Not medical advice" footer on every health screen and
use wellness language only.
14.10 THE SYSTEM SHALL encrypt provider tokens at rest (AES-GCM with a server key or
Supabase Vault) and make them readable only by the service role.
14.11 THE SYSTEM SHALL apply Supabase RLS on every table so users read/write only
their own private rows.
14.12 WHEN a user deletes their account, THE SYSTEM SHALL remove photos, stamps,
snapshots, and tokens.

---

## REQ-15: Demo seed data and demo script (P0 for M8)

**User story:** As a presenter, I want seeded demo users and history, so the
2-minute demo runs start to finish.

### Acceptance criteria
15.1 THE SYSTEM SHALL seed Boston places derived from OpenStreetMap (tourism=
artwork, historic=memorial|monument, amenity=cafe sample, leisure=park) with OSM
(ODbL) attribution.
15.2 THE SYSTEM SHALL seed 6 demo users with a week of history (stamps, routes,
snapshots, badges, kudos).
15.3 THE SYSTEM SHALL run the PLAN.md §13 two-minute demo script end to end without
errors in demo mode at a 375×812 viewport.
15.4 THE SYSTEM SHALL keep a `README.md` with setup, env vars, demo-mode run steps,
data-source citations, and known limitations.

---

## REQ-16: Place insights over time (P2 → now in scope)

**User story:** As a user who revisits places, I want to see how my body responds
to the same place over time, so I get personal wellness insight — never a
diagnosis.

### Acceptance criteria
16.1 WHERE a user has visited a place at least twice, THE SYSTEM SHALL compare
heart rate across visits **at a similar pace** (pace within ±10% of each other)
and surface a wellness-worded insight card (e.g. "Your avg HR on the Esplanade
loop is down 6 bpm over 2 weeks at the same pace").
16.2 THE SYSTEM SHALL require at least 2 comparable data points and SHALL show
the sample size in the insight (e.g. "based on 4 visits").
16.3 WHERE WHOOP or Apple data provide resting HR / recovery, THE SYSTEM SHALL
also show a resting/recovery trend.
16.4 THE SYSTEM SHALL use wellness wording only, with **no diagnosis** and the
"not medical advice" footer.
16.5 THE SYSTEM SHALL label insights computed from demo data "DEMO".
16.6 THE SYSTEM SHALL implement the insight computation as a pure function
(`computePlaceInsights(stamps, placeId)`) testable without I/O.

---

## REQ-17: County health baseline card — CDC PLACES (P2 → now in scope)

**User story:** As a user, I want to see how my activity compares to my county's
public-health baseline, so my movement has context — framed as wellness, not
medical advice.

### Acceptance criteria
17.1 THE SYSTEM SHALL ship CDC PLACES (Suffolk County, MA) baseline indicators
relevant to activity (e.g. physical inactivity %, obesity %, short sleep %,
fair/poor health %) as a static bundled file `data/cdc-places-suffolk.json`.
17.2 THE SYSTEM SHALL record in that file the source URL, release year, and a
"data year" label.
17.3 THE SYSTEM SHALL show one card on Profile, e.g. "In Suffolk County, X% of
adults report no leisure-time physical activity. This week you logged N active
minutes."
17.4 THE SYSTEM SHALL cite CDC PLACES and show the data year on the card.
17.5 THE SYSTEM SHALL use wellness wording only and show the "not medical advice"
footer; it SHALL NOT present the baseline as a personal clinical assessment.

---

## REQ-18: Weekly health summary on Profile (P1)

**User story:** As a user, I want a weekly summary of my health metrics and goal
progress, so the app's health purpose is front and center.

### Acceptance criteria
18.1 THE SYSTEM SHALL show on Profile a weekly health summary with steps, active
kcal, zone-2+ minutes, and avg SpO₂ when available.
18.2 THE SYSTEM SHALL show the source of each value (DEMO / Strava / Apple /
est.).
18.3 THE SYSTEM SHALL show progress against the user's active goals for the week.
18.4 THE SYSTEM SHALL carry the "not medical advice" footer.
18.5 THE SYSTEM SHALL implement the weekly aggregation as a pure function
testable without I/O.
