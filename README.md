# CityDex

A mobile-first web app (PWA) that turns walking and running around a city into a
collecting game. Move around Boston, find interesting real-world spots (murals,
statues, cafés, weird doors), photograph them, and AI turns each photo into a
collectible **stamp card** with a name, rarity, and short funny lore. Wearable
health data (steps, heart rate, calories, SpO₂) is attached to every check-in
and powers points, badges, leaderboards, and goal-based place recommendations.

> Built for Hackachusetts 2026 — Healthcare & Biotech track (H1: turning
> wearable data into better healthcare). **Wellness insights only, never medical
> advice.**

## Tech stack

- **Next.js** (App Router) + **TypeScript**, mobile-first **PWA**
- **Tailwind CSS v4** with a custom pixel theme (parchment/wood palette, rarity
  colors, activity orange)
- **Supabase** (Postgres, Auth, Storage) with an in-memory **demo fallback**
- **react-leaflet** + OpenStreetMap tiles (M1+)
- **Kiro** over the Agent Client Protocol (ACP) via `kiro-cli`, server-side only
  (M2+); no Anthropic SDK or API. A deterministic mock covers demo mode.
- **zod** for validation, **vitest** for pure-logic unit tests

## Demo mode (no keys required)

CityDex is designed so the full flow runs **with zero API keys**. With
`DEMO_MODE=true` and nothing else configured:

- data lives in an in-memory store (no Supabase needed),
- the AI stamp card uses a deterministic mock generator (no kiro-cli needed),
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
secrets) are read **server-side only** and never shipped to the client. The AI
runs through Kiro via `kiro-cli` spawned **server-side only**; the app uses no
Anthropic SDK or API.

Only a human can create the Supabase project and the Strava/WHOOP/Fitbit
developer apps, and install + log in `kiro-cli` on the server host, then paste
any secrets into `.env.local`. Never commit `.env.local`.

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
lib/{geo,points,badges,recs,health,ai,db}               # pure logic + server services
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
and placeholder route screens. Map, check-in, AI cards, health snapshots,
points/badges/leaderboards, goals, friends/feed, and real providers follow in
M1–M8.
