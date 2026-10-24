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
- **AI:** Anthropic TypeScript SDK `@anthropic-ai/sdk`, model `claude-opus-5-5`.
  Server-side only; the API key never reaches the client.
- **Validation:** `zod` everywhere (API inputs, AI output, provider responses).
- **Geo math:** haversine in TypeScript (PostGIS optional, not needed at demo
  scale).
- **Tests:** `vitest` for pure logic (points, badges, recs, haversine/geofence,
  Apple Health XML parser).

## Demo mode must ALWAYS work (hard rule)

With only `DEMO_MODE=true` and **no API keys**, the full flow (map → check-in →
photo → card → points → leaderboard) must run end to end:

- Use the **demo health provider** (seeded synthetic snapshots, labeled "DEMO").
- Use a **deterministic mock card generator** when `ANTHROPIC_API_KEY` is
  missing (see the `claude-vision-card` skill).
- Fall back to in-memory / SQLite data when Supabase is not configured.
- Real keys switch on the real integrations; absence of keys never breaks the
  demo.

## Environment variables

Commit `.env.example`; never commit `.env.local`.

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
WHOOP_CLIENT_ID=
WHOOP_CLIENT_SECRET=
FITBIT_CLIENT_ID=
FITBIT_CLIENT_SECRET=
APP_URL=http://localhost:3000
DEMO_MODE=true
```

## Claude API rules (PLAN.md §6) — do not guess SDK shapes

Use the `claude-vision-card` skill for the exact pattern. Key rules:

- **Model:** `claude-opus-5-5`.
- **Call:** `client.messages.parse(...)` with
  `output_config: { effort: "low", format: zodOutputFormat(StampCardSchema) }`.
- **Import** `zodOutputFormat` from `@anthropic-ai/sdk/helpers/zod`.
- **Content order:** the base64 **image content block comes BEFORE the text
  block**:
  `{ type: "image", source: { type: "base64", media_type, data } }`.
- **Refusal handling:** if `stop_reason === "refusal"`, fall back to a generic
  "Mystery Spot" card. Do not store the photo.
- **Null guard:** guard `parsed_output` for `null` before using it.
- **Secrets:** the Anthropic key and all provider tokens are **server-side
  only**. Never ship them to the client. Resize photos client-side (≤ 1280 px
  long edge, JPEG ~0.8) and strip EXIF location before storing.

## Provider adapter interface (PLAN.md §4)

All health sources implement a common `HealthProvider` interface with
`getSnapshot(userId, from, to)`. At check-in, merge snapshots from all connected
providers; prefer real device data over estimates and record which source
supplied each field. Label estimated values "est." (e.g. browser-estimated
steps = distance / stride length).
