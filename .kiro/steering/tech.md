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
- **AI:** **Kiro only.** The app does NOT use the Anthropic SDK or API. The
  Next.js server talks to Kiro through the **Agent Client Protocol (ACP)** by
  spawning `kiro-cli acp --agent citydex-cardsmith` (JSON-RPC 2.0 over stdio).
  A CLI fallback (`kiro-cli chat --no-interactive`) and a deterministic mock
  cover the cases where ACP image input or kiro-cli itself is unavailable.
  Server-side only; kiro-cli is never spawned from the client.
- **Validation:** `zod` everywhere (API inputs, AI output, provider responses).
- **Geo math:** haversine in TypeScript (PostGIS optional, not needed at demo
  scale).
- **Tests:** `vitest` for pure logic (points, badges, recs, haversine/geofence,
  Apple Health XML parser).

## Demo mode must ALWAYS work (hard rule)

With only `DEMO_MODE=true` and **no API keys**, the full flow (map → check-in →
photo → card → points → leaderboard) must run end to end:

- Use the **demo health provider** (seeded synthetic snapshots, labeled "DEMO").
- Use a **deterministic mock card generator** when `AI_PROVIDER=mock` or
  `kiro-cli` is not available (see the `kiro-vision-card` skill).
- Fall back to in-memory / SQLite data when Supabase is not configured.
- Real keys / a logged-in `kiro-cli` switch on the real integrations; their
  absence never breaks the demo.

## Environment variables

Commit `.env.example`; never commit `.env.local`.

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
DEMO_MODE=true
```

## Kiro ACP card generator (PLAN.md §6) — do not guess the protocol shapes

Use the `kiro-vision-card` skill for the exact message sequence. The app's AI
runtime is Kiro itself, reached from the Next.js server over the Agent Client
Protocol (ACP, JSON-RPC 2.0 over stdio). Key rules:

- **Transport (primary):** spawn `kiro-cli acp --agent $KIRO_CARD_AGENT` and
  drive it over stdio: `initialize` → `session/new` → `session/prompt` with an
  **image content block before the text block**
  (`{ type: "image", mimeType, data }` where `data` is base64, no `data:`
  prefix) → collect `session/update` `agent_message_chunk` text → parse JSON.
- **CLI fallback:** if ACP image input is unavailable, write the photo to a
  temp file and run `kiro-cli chat --no-interactive --agent $KIRO_CARD_AGENT`,
  pointing the agent at the temp file to read.
- **Mock fallback:** if `AI_PROVIDER=mock` or `kiro-cli` is unavailable/fails,
  use the deterministic mock card generator (demo mode always works).
- **Output parsing:** extract the first JSON object from the agent's reply and
  `StampCardSchema.safeParse(...)` it. On parse failure, treat as a refusal.
- **Refusal / reject handling:** if the agent refuses, returns no parseable
  JSON, or sets `accepted === false`, fall back to a generic "Mystery Spot"
  card and do NOT store the photo.
- **Timeout + kill:** enforce `KIRO_CARD_TIMEOUT_MS` (default 45000); kill the
  kiro-cli process on timeout and fall back to the mock.
- **Single in-process queue:** only one kiro-cli card job runs at a time; new
  requests queue behind the active job.
- **Secrets & client boundary:** kiro-cli is spawned **server-side only** and
  never from the client. Provider tokens stay server-side. Resize photos
  client-side (≤ 1280 px long edge, JPEG ~0.8) and strip EXIF location before
  the photo reaches the agent or storage.

**Deployment limitation:** the server must run on a machine where `kiro-cli` is
installed and logged in (a long-running Node host, container, or local dev box),
**not** a serverless/Vercel function. Demo mode still works everywhere via the
mock card generator.

## Provider adapter interface (PLAN.md §4)

All health sources implement a common `HealthProvider` interface with
`getSnapshot(userId, from, to)`. At check-in, merge snapshots from all connected
providers; prefer real device data over estimates and record which source
supplied each field. Label estimated values "est." (e.g. browser-estimated
steps = distance / stride length).
