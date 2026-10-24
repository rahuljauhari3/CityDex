# CityDex

A mobile-first web app (PWA) for the Healthcare & Biotech track that turns
wearable health data into better self-care by making movement around a city
rewarding. **Health is the point:** every check-in captures a health snapshot
(steps, heart rate and zones, active calories, SpO₂) and feeds a weekly health
summary, wellness goals and progress rings, goal-based place recommendations,
and place insights over time. The collecting game is the motivation layer — move
around Boston, find interesting real-world spots (murals, statues, cafés, weird
doors), photograph them, and each becomes a collectible **stamp card** whose
name, category and rarity come from the place (seed data, or a name + category
you type for a new place). The photo is shown exactly as uploaded. **No AI is
used anywhere.**

> Built for Hackachusetts 2026 — Healthcare & Biotech track (H1: turning
> wearable data into better healthcare). **Wellness insights only, never medical
> advice.**

## Tech stack

- **Next.js** (App Router) + **TypeScript**, mobile-first **PWA**
- **Tailwind CSS v4** with a custom pixel theme (parchment/wood palette, rarity
  colors, activity orange)
- **Supabase** (Postgres, Auth, Storage) with an in-memory **demo fallback**
- **react-leaflet** + OpenStreetMap tiles
- **No AI**: the stamp card is built from place data + the uploaded photo
- **zod** for validation, **vitest** for pure-logic unit tests

## Demo mode (no keys required)

CityDex is designed so the full flow runs **with zero API keys**. With
`DEMO_MODE=true` and nothing else configured:

- data lives in an in-memory store (no Supabase needed) that is re-seeded on
  every server start,
- 6 demo users (maya, theo, priya, jordan, sam, lee) have a week of check-ins,
  health snapshots, badges and high fives; you start as `@you` with two weeks of
  history, including four runs on the Esplanade loop for the place insight,
- a seeded **DEMO** health provider supplies synthetic snapshots,
- the place sheet offers a **DEMO teleport** so you can collect without being
  there (the walk to the place is simulated from your position or downtown).

Demo mode is on unless you set `DEMO_MODE=false` *and* configure Supabase.

Real keys switch on the real integrations; their absence never breaks the demo.

## Demo

The 2-minute presenter script, with timings and fallbacks, is in [`DEMO.md`](./DEMO.md).
Use **Profile → Reset demo data** before presenting.

## Getting started

Requirements: Node.js 20+ and npm.

```bash
# 1. Install dependencies
npm install

# 2. Create your local env from the template (demo mode is the default)
cp .env.example .env.local

# 3. Run the dev server
npm run dev
```

Open http://localhost:3000 — it redirects to the Map tab. The app is mobile-first;
test at **375×812** (e.g. iPhone X) in your browser's device toolbar.

## Environment variables

See [`.env.example`](./.env.example) for the full list. All keys are optional in
demo mode. Secret-touching values (`SUPABASE_SERVICE_ROLE_KEY`, provider client
secrets, `TOKEN_ENC_KEY`) are read **server-side only** and never shipped to the
client. Provider tokens are encrypted with AES-256-GCM before they are stored.

To try **Strava**, create an app at https://www.strava.com/settings/api with the
callback domain `localhost`, then set `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`,
`TOKEN_ENC_KEY` and `APP_URL` (e.g. `http://localhost:3000`).

Only a human can create the Supabase project and the Strava/WHOOP/Fitbit
developer apps, then paste any secrets into `.env.local`. Never commit
`.env.local`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Run vitest unit tests |

Before every commit, run in order and fix failures: `npm run lint` →
`npx tsc --noEmit` → `npm test`.

## Features (healthcare first)

| Feature | Where | Notes |
|---|---|---|
| Live walk tracking | Map | time, distance, est. steps, pace, est. kcal and live HR (demo watch) while you walk; path drawn on the map and kept on the device. In demo mode without GPS, "Demo walk to quest" simulates the walk at ×20 (labeled DEMO; the server refuses simulated walks outside demo mode) |
| Health snapshot per check-in | card reveal, Feed, Dex | steps, avg/max HR, HR zones, active kcal, SpO₂, duration, pace; every value labeled with its source (DEMO, Strava, Apple, est.). The reveal also shows what the walk added to each daily goal and how it compares with your usual walk or earlier visits here |
| Dex stamp details | Dex | tap a stamp: photo, totals for the place, the HR-trend insight, the latest snapshot and every visit |
| Goals + progress bars | onboarding, Map header, Quests | steps, active kcal, zone-2+ cardio minutes, new places/week, green & quiet places/week |
| Today's Quests | Quests | explainable score (PLAN §8) with reasons like "3 friends burned avg 310 kcal getting here" |
| Health story | Profile (top) | 3–4 plain-language takeaways ranked "going well" first: resting HR change, place insight, cardio vs the 150 min guideline, step-goal days, sleep, best cardio spot, next-morning resting HR after active days |
| Recovery estimate | Profile, Quests | transparent 0–100 score from resting HR vs 2-week baseline, sleep vs 7 h and yesterday's cardio load; every factor shown. On "easy" days, quests favor short walks to green, quiet places |
| 4-week trends | Profile | resting HR, sleep, steps, cardio: this week vs last with 28-day sparklines and a bpm/week slope (today's partial steps excluded) |
| Place insights over time | Profile | HR at the same pace (±10%) across visits, linear trend in bpm/week, per-visit sparkline (other-pace visits shown hollow), best cardio spot, calmest walk, per-place table |
| Weekly health summary | Profile | steps per day vs goal, kcal, cardio minutes, resting HR, SpO₂, sleep |
| County baseline | Profile | CDC PLACES Suffolk County (2025 release) next to your week and the 150 min/week guideline |
| Health sources | Profile | Demo watch, Apple Health `export.xml` upload (streamed parser), Strava OAuth; WHOOP/Fitbit need keys; Garmin/Samsung "coming soon" with the reason |
| Points + badges | card reveal, Profile | rarity base + first finder + movement + effort, ×1.5 for quests; 13 rule-based badges, 6 of them health badges |
| Leaderboards | Feed → Leaderboard | friends/global × week/all time × steps/points/stamps, rank-change arrows, no location |
| Friends + feed | Feed | add by username or invite code, accept requests, high fives on stamps and health milestones |
| Weekly challenges | Feed | "This week with friends": group marathon-steps goal, 150 Club (150 cardio minutes each), green breaks; health milestones (health badges, 10K days, 150-minute weeks, fitness gains at a place) |
| Privacy | everywhere | consent screen, "not medical advice" footer, EXIF stripped, coords rounded to ~10 m, walk paths stay on device, disconnect deletes tokens, account deletion |

## Project layout

```
app/(routes)/{map,quests,dex,feed,profile,onboarding}   # pages (server components)
app/api/                                                 # stamps, health/*, friends, kudos, onboarding, account
components/{map,stamp,health,feed,onboarding,ui}         # React components
lib/health/        # zones, demo provider, merge, Apple parser, Strava, summary
lib/{points,badges,recs,insights,leaderboard}.ts         # pure game + health logic
lib/app/           # server view-models shared by pages and routes
lib/db/            # Store interface, in-memory demo store, Supabase stub
lib/demo/seed.ts   # deterministic demo world
data/seed/         # Boston places (OSM), data/cdc-places-suffolk.json
tests/             # vitest unit tests
```

## Data sources & attribution

- Map tiles and seeded places: © OpenStreetMap contributors (ODbL). Attribution
  stays visible on the map. 66 places: Boston and Cambridge, Boston College and
  the Marathon route (Heartbreak Hill, the finish line), and statewide stops from
  Plymouth Rock and Race Point to Walden Pond, Salem, Lowell, Worcester,
  Springfield, MASS MoCA and Mount Greylock (the only legendary). Coordinates
  are approximate.
- Place photos: 41 freely licensed photos from Wikimedia Commons (CC BY,
  CC BY-SA, CC0, public domain), the lead images of each place's Wikipedia
  article, reviewed by hand. They're used on seeded demo stamps and place cards,
  with the author and license shown in the Dex and on `/credits`. The metadata
  is in `data/seed/place-photos.json`; regenerate it with
  `node scripts/fetch-place-photos.mjs`. Images load from Wikimedia at runtime.
- Gasson Hall photo: taken by the CityDex team at Boston College
  (`public/demo/gasson-hall.jpg`), with no location metadata.
- Places with no free photo use original pixel-style illustrations from
  `lib/demo/photos.ts`.
- County baseline: CDC, *PLACES: Local Data for Better Health, County Data,
  2025 release* (data.cdc.gov dataset `swc5-untb`), Suffolk County, MA, crude
  prevalence among adults. Bundled in `data/cdc-places-suffolk.json`.
- Physical activity guideline (150 min/week moderate activity): CDC adult
  physical activity guidelines.

## Known limitations

- Demo data lives in memory and resets when the server restarts.
- The Supabase store is a stub; set no Supabase keys for the demo.
- Apple Health and Samsung Health have no web API. Apple works through the
  `export.xml` upload (unzip `export.zip` first); a native wrapper is the roadmap.
- Garmin needs business approval; WHOOP and Fitbit OAuth are not wired yet.
- Browser step counts are estimated from GPS distance (0.7 m stride) and
  labeled "est.".
- HR zones use 220 − age (age from onboarding, default 30). It's an estimate.
- There's one demo identity (`@you`); there is no real sign-in yet.
- Wellness insights only, not medical advice.
