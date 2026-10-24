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
- **react-leaflet** + OpenStreetMap tiles (M1+)
- **No AI** — the stamp card is built from place data + the uploaded photo; the
  app uses no Anthropic SDK or API and no `kiro-cli` subprocess
- **zod** for validation, **vitest** for pure-logic unit tests

## Demo mode (no keys required)

CityDex is designed so the full flow runs **with zero API keys**. With
`DEMO_MODE=true` and nothing else configured:

- data lives in an in-memory store (no Supabase needed),
- the stamp card is built from place data + the uploaded photo (no AI),
- a seeded **DEMO** health provider supplies synthetic snapshots.

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
secrets) are read **server-side only** and never shipped to the client. The app
uses no AI — no Anthropic SDK or API and no `kiro-cli` subprocess.

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

## Project layout

```
app/(routes)/{map,quests,dex,feed,profile,onboarding}   # pages
app/api/                                                 # server route handlers
components/{map,stamp,feed,leaderboard,ui}               # React components
lib/{geo,points,badges,recs,insights,health,db}         # pure logic + server services
tests/                                                   # vitest unit tests
data/seed/                                               # Boston places, demo users
public/                                                  # PWA manifest + icons
```

## Data sources & attribution

- Map tiles and seeded places: © OpenStreetMap contributors (ODbL). Attribution
  stays visible on the map.

## Status

Milestone **M0 (scaffold)** complete: Next.js + TypeScript + the pixel Tailwind
theme, PWA manifest, demo-mode config and store fallback, the bottom tab bar,
and placeholder route screens. Map, check-in, stamp cards, health snapshots,
points/badges/leaderboards, goals, friends/feed, and real providers follow in
M1–M8.
