# CityDex Core — Implementation Tasks

Tasks M0–M2 are grouped by milestone (per `PLAN.md` §12 and `workflow.md`). The
remaining work is restructured into **batches B0–B4** for speed: each batch
bundles related milestones and ends in a running app, committed after
`npm run lint` → `npx tsc --noEmit` → `npm test` → `npm run build` pass (commit
message `B<n>: <summary>`, no `Co-Authored-By` trailer). Each task references the
requirement IDs it satisfies.

**No AI anywhere.** There is no `lib/ai`, no Kiro ACP
card generation, and no `kiro-cli` subprocess. The stamp card is assembled from
place data + the uploaded photo (seeded place → stored name/category/rarity; new
user-created place → user-typed name + category, rarity `common`), with a
required "No people are the main subject of this photo" checkbox.

Only the human can create Supabase/Strava/WHOOP/Fitbit apps; build those features
behind the demo fallback and continue.

---

## M0 — Scaffold

- [x] 1. Initialize Next.js (App Router) + TypeScript project with ESLint and the
  App Router directory layout from `design.md` §1. _(REQ-1.1, REQ-1.5)_
- [x] 2. Add Tailwind and define the pixel theme tokens (palette, rarity colors,
  activity orange) and Google Fonts (Pixelify Sans, VT323/Silkscreen, system
  body) in config and `globals.css`. _(REQ-1.1)_
- [x] 3. Add the PWA manifest and placeholder icons; wire installability. _(REQ-1.2)_
- [x] 4. Create `.env.example` with every variable from `tech.md`; confirm
  `.gitignore` excludes `.env.local`. _(REQ-1.4)_
- [x] 5. Add `lib/config.ts` resolving `isDemoMode`, `hasSupabase`,
  `hasStrava/Whoop/Fitbit`. _(REQ-1.3, REQ-1.7)_
- [x] 6. Add the `Store` interface and `lib/db/memory.ts` + `lib/db/supabase.ts`
  skeletons with `getStore()` selecting by `hasSupabase`. _(REQ-1.6)_
- [x] 7. Add bottom tab bar (Map · Quests · Dex · Feed · Profile) and empty route
  pages so the app runs; verify at 375×812 with a clean console. _(REQ-1.3, REQ-2.6)_
- [x] 8. Set up vitest and a trivial passing test; create `README.md` with
  setup + demo-mode run steps. _(REQ-15.4)_
- [x] 9. Run lint, typecheck, test; commit `M0: scaffold Next.js app with pixel
  Tailwind theme and demo fallback`.

## M1 — Map + places

- [x] 10. Implement `lib/geo` (haversine, geofence, roundCoord, estimateSteps,
  routeDistance) with vitest tests. _(REQ-3.6, REQ-7.2, REQ-11.2)_
- [x] 11. Create `data/seed/boston-places.*` from OSM categories with ODbL
  attribution noted; load into the demo store. _(REQ-15.1)_
- [x] 12. Build the react-leaflet map with OSM tiles and always-visible
  attribution. _(REQ-2.1)_
- [x] 13. Add live position via `watchPosition`; handle denied permission with a
  default Boston center and a non-blocking message. _(REQ-2.2, REQ-2.5)_
- [x] 14. Render pixel-styled rarity-colored place markers from the store.
  _(REQ-2.3)_
- [x] 15. Build the place detail sheet (name, category, neighborhood, rarity,
  collect count). _(REQ-2.4)_
- [x] 16. Verify map at 375×812, clean console; commit `M1: map with live position
  and seeded Boston places`.

## M2 — Check-in + photo + stamp card (initial)

> Note: M2 originally shipped an AI card generator. That has been **removed** —
> see **B0** below, which replaces it with the place-based card. The tasks below
> are kept for history; items specific to the AI path are superseded by B0.

- [x] 17. Add client photo capture (`capture="environment"`), client-side resize
  to ≤1280px JPEG ~0.8, and EXIF strip. _(REQ-3.5, REQ-14.8)_
- [x] 18. Add geofence collect gating (~75 m) and GPS-accuracy guard (>50 m
  warns/blocks). _(REQ-3.1, REQ-3.2)_
- [x] 19–21. (Superseded by B0) AI card schema + Kiro ACP client + mock.
- [x] 22. Implement `POST /api/stamps` check-in pipeline skeleton (validate →
  resolve/create place → store photo → persist stamp/route/place). _(REQ-3.3,
  REQ-4.1, REQ-14.4)_
- [x] 23. Build the card-reveal animation (parchment, rarity glow, pixel name,
  orange stats), honoring `prefers-reduced-motion` and optional pop/vibrate.
  _(REQ-5.1, REQ-5.4, REQ-5.5)_
- [x] 24. Build the Dex 4-column grid with locked "???" silhouettes. _(REQ-5.2,
  REQ-5.3)_
- [x] 25. Commit `M2: check-in, photo capture, stamp card, and Dex`.

---

## B0 — Remove all AI; photo-as-uploaded + place card; QA fixes

Goal: delete the entire AI card path and switch the stamp to place data + the
photo shown exactly as uploaded, then clear the QA findings in
`.kiro/logs/qa-findings-1.md`. Ends runnable; commit `B0: remove AI card, use
place + uploaded photo, fix QA findings`.

- [ ] B0.1. Delete all AI code: remove `lib/ai/` entirely, drop
  from `package.json`/lockfile, remove `AI_PROVIDER`,
  `KIRO_CLI_PATH`, `KIRO_CARD_AGENT`, `KIRO_CARD_TIMEOUT_MS` from `lib/config.ts`
  and `.env.example`, and delete `scripts/kiro-card-smoke.mjs`. Grep for
 `kiro-cli`, `AI_PROVIDER`, `StampCardSchema`, `lore`,
  `Mystery Spot`, `cardsmith` and confirm none remain outside historical logs.
  _(REQ-4.2)_
- [ ] B0.2. Define the place-based `StampCard` type/zod schema (`name`,
  `category` enum, `rarity` enum, `source`) — no `lore`, `tags`, `accepted`,
  `colorHex`. _(REQ-4.5)_
- [ ] B0.3. Rewrite `POST /api/stamps` to accept `placeId` **or**
  `name` + `category` plus a `noPeople` flag; build the card from the place
  (seeded → stored values; user → typed name/category, rarity `common`); require
  `noPeople === true` (else 4xx JSON + store nothing); store the photo exactly as
  uploaded. _(REQ-4.1, REQ-4.3, REQ-4.4, REQ-4.6, REQ-4.7, REQ-4.8)_
- [ ] B0.4. Update the collect UI: for a new place, prompt for a name + category;
  add the required "No people are the main subject of this photo" checkbox; show
  the photo as uploaded on the reveal (remove any dither/lore UI). _(REQ-4.5,
  REQ-4.6, REQ-5.1)_
- [ ] B0.5. **QA #1** — treat demo mode as ON unless `DEMO_MODE=false` while
  Supabase is configured; show a "DEMO" chip in the header whenever demo mode is
  on. _(REQ-1.3)_
- [ ] B0.6. **QA #2** — set `devIndicators: false` in `next.config.ts`; keep the
  active tab visible above `env(safe-area-inset-bottom)`.
- [ ] B0.7. **QA #3** — Collect button states: out of range + no teleport shows
  the distance and a disabled-but-AA style; within 75 m or teleport on → full
  orange enabled. _(REQ-3.1)_
- [ ] B0.8. **QA #4** — end-to-end check-in in demo mode: `POST /api/stamps` with
  a JPEG, `teleport=true`, `noPeople=true`, `placeId=seed_boston_common` returns
  200 + card; far away without teleport returns a clear 4xx JSON (not HTML). Add
  a route-level test for both. _(REQ-1.3, REQ-4.6)_
- [ ] B0.9. **QA #5/#6** — reduce marker overlap at low zoom (smaller pins or
  clustering) + a compact rarity legend; add a minimal map header (app name +
  DEMO chip). _(REQ-2.3)_
- [ ] B0.10. Update/replace unit tests: drop AI tests; add the `/api/stamps`
  route tests and place-card assembly tests. Run lint, tsc, test, build; commit.

## B1 — M3 health snapshot + M4 points/badges/leaderboards

Commit `B1: health snapshot, points, badges, and leaderboards`.

- [ ] B1.1. Define the `HealthProvider` interface and `HealthSnapshot` type.
  _(REQ-6.1, REQ-6.4)_
- [ ] B1.2. Implement `lib/health/demo.ts` seeded synthetic provider labeled DEMO.
  _(REQ-6.2, REQ-6.3)_
- [ ] B1.3. Implement browser route tracking (distance, polyline, est_steps
  labeled "est.") and persist routes. _(REQ-7.1, REQ-7.2, REQ-7.4)_
- [ ] B1.4. Implement multi-provider snapshot merge (prefer real over estimate,
  record source per field) for the check-in window. _(REQ-6.5, REQ-7.3)_
- [ ] B1.5. Show the snapshot stats on the stamp card (distance · steps · avg HR ·
  kcal) with DEMO/est. labels. _(REQ-5.1, REQ-6.3)_
- [ ] B1.6. Implement `lib/points` `computePoints` (rarity base, bonuses + caps,
  repeat-visit, goal ×1.5) with vitest tests. _(REQ-8.1, REQ-8.2)_
- [ ] B1.7. Implement server-side final-rarity adjustment (first-3 +1 tier, >50
  collectors cap uncommon) from the **place** rarity. _(REQ-8.3)_
- [ ] B1.8. Implement `lib/badges` rule engine + streak logic with vitest tests
  and the `badges` seed rows; wire evaluation + award + unlock notice into
  check-in. _(REQ-9.1, REQ-9.2, REQ-9.3, REQ-9.4)_
- [ ] B1.9. Build the global leaderboard (Global; Week/All-time × Steps/Points/
  Stamps) with avatar/username/value/rank arrow; never show location; weekly
  reset Monday 00:00 America/New_York. _(REQ-8.4, REQ-8.5, REQ-8.6, REQ-8.7)_
- [ ] B1.10. Run lint, tsc, test, build; commit.

## B2 — M5 goals/quests + REQ-16/17/18

Commit `B2: goals, quests, place insights, CDC baseline, and weekly summary`.

- [ ] B2.1. Build the goals onboarding flow (multi-select with defaults; store
  type/target/period/active). _(REQ-10.1, REQ-10.2)_
- [ ] B2.2. Build the consent screen explaining stored data before any capture.
  _(REQ-14.3)_
- [ ] B2.3. Build the Home header (in-game clock/weather chip, day counter) and
  pixel goal progress rings. _(REQ-10.3, REQ-10.4)_
- [ ] B2.4. Implement `lib/recs` scorer (weights, no-history estimate, reason
  strings) with vitest tests; render top-5 "Today's Quests" and apply the
  goal-recommended ×1.5 at check-in. _(REQ-11.1–11.5, REQ-8.1)_
- [ ] B2.5. Implement `lib/insights` `computePlaceInsights` (pace bucketing ±10%,
  bpm/week trend, ≥2 points, sample size, DEMO label) with vitest tests; render a
  place-insight card. _(REQ-16.1–16.6)_
- [ ] B2.6. Add `data/cdc-places-suffolk.json` (indicators + sourceUrl +
  releaseYear + dataYear) and the Profile CDC baseline card (cited, data year,
  not-medical-advice). _(REQ-17.1–17.5)_
- [ ] B2.7. Implement `lib/insights` `computeWeeklySummary` (steps, active kcal,
  zone-2+ min, avg SpO₂, per-field source, goal progress) with vitest tests; show
  the weekly summary on Profile. _(REQ-18.1–18.5)_
- [ ] B2.8. Confirm the "not medical advice" footer on every health screen; run
  lint, tsc, test, build; commit.

## B3a — M6 friends/feed  (parallel worktree A)

Owns: `app/api/{friends,kudos,feed}/`, `components/feed/`, the Friends
leaderboard tab UI. Shared files touched **additively only**: `lib/db/types.ts`
(friendship/kudos/feed types), `lib/db/store.ts` (friend/feed/kudos method
signatures), `lib/db/memory.ts` (their implementations). Commit `B3a: friends,
friends leaderboard, and feed with kudos`.

- [ ] B3a.1. Add-friend by username/invite code with pending→accepted status.
  _(REQ-12.1)_
- [ ] B3a.2. Friends leaderboard tab alongside Global. _(REQ-12.2)_
- [ ] B3a.3. Strava-style feed cards (avatar, optional route mini-map,
  distance·time·kcal·avg HR, stamp thumbnail) honoring private-by-default +
  home-zone blur. _(REQ-12.3, REQ-14.5, REQ-14.6)_
- [ ] B3a.4. High-five/kudos recording + count; enforce friend/global visibility.
  _(REQ-12.4, REQ-12.5)_
- [ ] B3a.5. Run lint, tsc, test, build; commit.

## B3b — M7 Strava / Apple Health export  (parallel worktree B)

Owns: `lib/health/{strava,apple,garmin,samsung}.ts`,
`app/api/providers/`, the provider connect/disconnect UI, account deletion.
Shared files touched **additively only**: `lib/db/types.ts`
(`health_connections`), `lib/db/store.ts` (connection/delete signatures),
`lib/db/memory.ts` (implementations). Coordinate the shared edits with B3a to
avoid merge conflicts (append new members; don't reorder). Commit `B3b: Strava
OAuth, Apple Health export parser, and privacy controls`.

- [ ] B3b.1. Strava OAuth connect/callback + activity→snapshot mapping, behind
  the key check with demo fallback. _(REQ-13.1, REQ-1.7)_
- [ ] B3b.2. `lib/health/apple.ts` streaming `export.xml` parser for the five HK
  identifiers, pure + vitest tests. _(REQ-13.2, REQ-13.4)_
- [ ] B3b.3. Apple Health export upload UI + server ingest to snapshots.
  _(REQ-13.2)_
- [ ] B3b.4. Garmin + Samsung Health `coming_soon` stubs with honest reasons.
  _(REQ-13.3)_
- [ ] B3b.5. Provider consent/opt-in UI (fields disclosed) + disconnect that
  deletes tokens; encrypt tokens at rest, service-role-only access. _(REQ-14.1,
  REQ-14.2, REQ-14.10)_
- [ ] B3b.6. If Supabase configured: RLS on every table + leaderboard aggregate
  views (no location); else keep demo store. _(REQ-14.11, REQ-8.7, REQ-1.6)_
- [ ] B3b.7. Account deletion removing photos, stamps, snapshots, tokens.
  _(REQ-14.12)_
- [ ] B3b.8. Run lint, tsc, test, build; commit.

## B4 — M8 demo seed + README

Commit `B4: demo seed data, honesty footers, and README polish`.

- [ ] B4.1. Seed 6 demo users with a week of history (stamps, routes, snapshots,
  badges, kudos), **including repeat visits to the same places at a similar pace**
  so place insights (REQ-16) appear. _(REQ-15.2)_
- [ ] B4.2. Confirm the "Not medical advice" footer on every health screen and
  DEMO/est. labels throughout. _(REQ-14.9, REQ-6.3)_
- [ ] B4.3. Run the PLAN.md §13 two-minute demo script end to end in demo mode at
  375×812; fix any console errors. _(REQ-15.3, REQ-1.3)_
- [ ] B4.4. Finalize `README.md` (setup, env vars, demo run, OSM + CDC PLACES
  citations, known limitations). _(REQ-15.4, REQ-17.4)_
- [ ] B4.5. Final lint/tsc/test/build pass; commit.
