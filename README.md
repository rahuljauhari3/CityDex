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
| Health snapshot per check-in | card reveal, Feed, Dex | steps, avg/max HR, HR zones, active kcal, SpO₂, duration; every value labeled with its source (DEMO, Strava, Apple, est.) |
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
| Friends + feed | Feed | add by username or invite code, accept requests, high fives |
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
  stays visible on the map.
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
