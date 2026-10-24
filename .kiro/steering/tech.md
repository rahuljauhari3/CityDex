---
inclusion: always
---

# CityDex — Tech

## Stack (PLAN.md §5)

- **Framework:** Next.js (App Router) + TypeScript, deployed on Vercel.
  Mobile-first PWA (manifest + icons, installable).
- **Styling:** Tailwind CSS with a custom pixel theme (see ui.md).
- **Backend:** Next.js route handlers / server actions.
- **Database / Auth / Storage:** Supabase (Postgres, Auth, Storage bucket
  `stamps` for photos, Row Level Security on every table).
- **Map:** `react-leaflet` + OpenStreetMap tiles. Keep the © OpenStreetMap
  attribution visible. Pixel-styled custom markers.
- **AI:** **None.** The app uses **no AI anywhere** — no  SDK or API,
  no Kiro ACP card generation, no `kiro-cli` subprocess. The stamp's name,
  category and rarity come from the place (seed data) or, for a new
  user-created place, the name + category the user types (rarity `common`); the
  photo is shown exactly as uploaded.
- **Validation:** `zod` everywhere (API inputs, provider responses).
- **Geo math:** haversine in TypeScript (PostGIS optional, not needed at demo
  scale).
- **Tests:** `vitest` for pure logic (points, badges, recs, haversine/geofence,
  place-insight trend, weekly summary aggregation, Apple Health XML parser).

## Demo mode must ALWAYS work (hard rule)

With only `DEMO_MODE=true` and **no API keys**, the full flow (map → check-in →
photo → card → points → leaderboard) must run end to end:

- Use the **demo health provider** (seeded synthetic snapshots, labeled "DEMO").
- Build the stamp card from **place data + the uploaded photo** (no AI, no
  external process).
- Fall back to in-memory / SQLite data when Supabase is not configured.
- Real keys switch on the real integrations (Strava, Apple Health export,
  WHOOP, Fitbit); their absence never breaks the demo.

## Environment variables

Commit `.env.example`; never commit `.env.local`.

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
WHOOP_CLIENT_ID=
WHOOP_CLIENT_SECRET=
FITBIT_CLIENT_ID=
FITBIT_CLIENT_SECRET=
APP_URL=http://localhost:3000
DEMO_MODE=true
```

## Stamp card generation — no AI (PLAN.md §6)

The stamp card is assembled server-side from the **place** and the uploaded
photo; there is no model call and no `kiro-cli` subprocess.

- `POST /api/stamps` (multipart): photo + lat/lng/accuracy/routeId, plus either
  `placeId` for a seeded place, or `name` + `category` for a new user-created
  place.
- **Card source:** a **seeded place** supplies its stored name, category and
  rarity; a **new user-created place** (`source=user`) uses the user-typed name
  and category with rarity `common`. There is no `lore` field.
- The photo is stored and shown **exactly as uploaded** — no pixel/dither filter.
- **Final rarity** = the place's rarity adjusted by collector count (first 3
  collectors +1 tier; >50 collectors capped at "uncommon").
- **Privacy guard:** require the checkbox **"No people are the main subject of
  this photo"**. If it is not set, the server returns a 4xx and does **not**
  store the photo. This checkbox replaces any image analysis.
- Resize photos client-side (≤ 1280 px long edge, JPEG ~0.8) and strip EXIF
  location before the photo reaches storage.

## Provider adapter interface (PLAN.md §4)

All health sources implement a common `HealthProvider` interface with
`getSnapshot(userId, from, to)`. At check-in, merge snapshots from all connected
providers; prefer real device data over estimates and record which source
supplied each field. Label estimated values "est." (e.g. browser-estimated
steps = distance / stride length).
