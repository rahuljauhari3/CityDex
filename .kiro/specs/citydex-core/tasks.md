# CityDex Core — Implementation Tasks

Tasks are grouped by milestone (M0–M8, per `PLAN.md` §12 and `workflow.md`) and
ordered for sequential execution. Each milestone must end in a running app and be
committed (`M<n>: <summary>`, no `Co-Authored-By` trailer) after
`npm run lint` → `npx tsc --noEmit` → `npm test` pass. Each task references the
requirement IDs it satisfies and is scoped for a single agent turn.

Only the human can create Supabase/Strava/WHOOP/Fitbit apps and the Anthropic
key; build those features behind the demo fallback and continue.

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
  `hasAnthropic`, `hasStrava/Whoop/Fitbit`. _(REQ-1.3, REQ-1.7)_
- [x] 6. Add the `Store` interface and `lib/db/memory.ts` + `lib/db/supabase.ts`
  skeletons with `getStore()` selecting by `hasSupabase`. _(REQ-1.6)_
- [x] 7. Add bottom tab bar (Map · Quests · Dex · Feed · Profile) and empty route
  pages so the app runs; verify at 375×812 with a clean console. _(REQ-1.3, REQ-2.6)_
- [x] 8. Set up vitest and a trivial passing test; create `README.md` with
  setup + demo-mode run steps. _(REQ-15.4)_
- [x] 9. Run lint, typecheck, test; commit `M0: scaffold Next.js app with pixel
  Tailwind theme and demo fallback`.

## M1 — Map + places

- [ ] 10. Implement `lib/geo` (haversine, geofence, roundCoord, estimateSteps,
  routeDistance) with vitest tests. _(REQ-3.6, REQ-7.2, REQ-11.2)_
- [ ] 11. Create `data/seed/boston-places.*` from OSM categories with ODbL
  attribution noted; load into the demo store. _(REQ-15.1)_
- [ ] 12. Build the react-leaflet map with OSM tiles and always-visible
  attribution. _(REQ-2.1)_
- [ ] 13. Add live position via `watchPosition`; handle denied permission with a
  default Boston center and a non-blocking message. _(REQ-2.2, REQ-2.5)_
- [ ] 14. Render pixel-styled rarity-colored place markers from the store.
  _(REQ-2.3)_
- [ ] 15. Build the place detail sheet (name, category, neighborhood, rarity,
  collect count). _(REQ-2.4)_
- [ ] 16. Verify map at 375×812, clean console; commit `M1: map with live position
  and seeded Boston places`.

## M2 — Check-in + photo + AI card

- [ ] 17. Add client photo capture (`capture="environment"`), client-side resize
  to ≤1280px JPEG ~0.8, and EXIF strip. _(REQ-3.4, REQ-3.5, REQ-14.8)_
- [ ] 18. Add geofence collect gating (~75 m) and GPS-accuracy guard (>50 m
  warns/blocks). _(REQ-3.1, REQ-3.2)_
- [ ] 19. Define `StampCardSchema` (zod) per `design.md` §6. _(REQ-4.7)_
- [ ] 20. Activate the `claude-vision-card` skill and implement `lib/ai/claude.ts`
  (model, `messages.parse`, `zodOutputFormat`, image-before-text, refusal + null
  guard). _(REQ-4.2, REQ-4.3, REQ-4.4, REQ-4.5, REQ-4.9)_
- [ ] 21. Implement `lib/ai/mock.ts` deterministic card generator used when no
  Anthropic key. _(REQ-4.6)_
- [ ] 22. Implement `POST /api/stamps` check-in pipeline per `design.md` §7
  (validate → resolve/create place → AI card → reject/retake handling → store
  photo → persist stamp/route/place). _(REQ-3.3, REQ-4.1, REQ-4.8, REQ-14.4)_
- [ ] 23. Build the card-reveal animation (parchment, rarity glow, dither photo,
  pixel name, italic lore, orange stats), honoring `prefers-reduced-motion` and
  optional pop/vibrate. _(REQ-5.1, REQ-5.4, REQ-5.5)_
- [ ] 24. Build the Dex 4-column grid with locked "???" silhouettes for
  undiscovered nearby places. _(REQ-5.2, REQ-5.3)_
- [ ] 25. Verify full collect flow at 375×812 in demo mode; commit `M2: check-in,
  photo capture, AI stamp card, and Dex`.

## M3 — Health snapshot

- [ ] 26. Define the `HealthProvider` interface and `HealthSnapshot` type. _(REQ-6.1, REQ-6.4)_
- [ ] 27. Implement `lib/health/demo.ts` seeded synthetic provider labeled DEMO.
  _(REQ-6.2, REQ-6.3)_
- [ ] 28. Implement browser route tracking (distance, polyline, est_steps labeled
  "est.") and persist routes. _(REQ-7.1, REQ-7.2, REQ-7.4)_
- [ ] 29. Implement multi-provider snapshot merge (prefer real over estimate,
  record source per field) and attach to check-in window. _(REQ-6.5, REQ-7.3)_
- [ ] 30. Show the snapshot stats on the stamp card (distance · steps · avg HR ·
  kcal), with DEMO/est. labels. _(REQ-5.1, REQ-6.3)_
- [ ] 31. Verify snapshot attaches on each stamp; commit `M3: health snapshot with
  demo provider and browser route tracking`.

## M4 — Points, badges, leaderboards

- [ ] 32. Implement `lib/points` `computePoints` (rarity base, bonuses + caps,
  repeat-visit, goal ×1.5) with vitest tests. _(REQ-8.1, REQ-8.2)_
- [ ] 33. Implement server-side final-rarity adjustment (first-3 +1 tier, >50
  collectors cap uncommon). _(REQ-8.3)_
- [ ] 34. Implement `lib/badges` rule engine + streak logic with vitest tests, and
  the `badges` seed rows. _(REQ-9.1, REQ-9.2, REQ-9.4)_
- [ ] 35. Wire badge evaluation + award + unlock notification into the check-in
  pipeline. _(REQ-9.3)_
- [ ] 36. Build the global leaderboard (Global tab; Week/All-time × Steps/Points/
  Stamps) with avatar, username, value, rank-change arrow; never show location.
  _(REQ-8.4, REQ-8.6, REQ-8.7)_
- [ ] 37. Implement weekly reset at Monday 00:00 America/New_York in the
  aggregate view. _(REQ-8.5)_
- [ ] 38. Verify points/badges/leaderboard in demo mode; commit `M4: points
  formula, badge engine, and global leaderboard`.

## M5 — Onboarding goals + recommendations

- [ ] 39. Build the goals onboarding flow (multi-select with defaults; store type/
  target/period/active). _(REQ-10.1, REQ-10.2)_
- [ ] 40. Build the consent screen explaining stored data before any capture.
  _(REQ-14.3)_
- [ ] 41. Build the Home header (in-game clock/weather chip, day counter) and pixel
  goal progress rings. _(REQ-10.3, REQ-10.4)_
- [ ] 42. Implement `lib/recs` scorer with weights, no-history estimate, and reason
  strings, with vitest tests. _(REQ-11.1, REQ-11.2, REQ-11.5)_
- [ ] 43. Render top-5 "Today's Quests" on Home with explainable reasons, and apply
  the goal-recommended ×1.5 at check-in. _(REQ-11.3, REQ-11.4, REQ-8.1)_
- [ ] 44. Verify goals + quests at 375×812; commit `M5: onboarding goals, progress
  rings, and Today's Quests`.

## M6 — Friends + feed

- [ ] 45. Implement add-friend by username/invite code with pending→accepted
  status. _(REQ-12.1)_
- [ ] 46. Add the Friends leaderboard tab alongside Global. _(REQ-12.2)_
- [ ] 47. Build the Strava-style feed with activity cards (avatar, optional route
  mini-map, distance·time·kcal·avg HR, stamp thumbnail) honoring
  private-by-default + home-zone blur. _(REQ-12.3, REQ-14.5, REQ-14.6)_
- [ ] 48. Implement high-five/kudos recording and count display; enforce
  friend/global visibility rules. _(REQ-12.4, REQ-12.5)_
- [ ] 49. Verify friends/feed/kudos in demo mode; commit `M6: friends, friends
  leaderboard, and feed with kudos`.

## M7 — Real providers

- [ ] 50. Implement Strava OAuth connect/callback and activity→snapshot mapping,
  behind the key check with demo fallback. _(REQ-13.1, REQ-1.7)_
- [ ] 51. Implement `lib/health/apple.ts` streaming `export.xml` parser for the
  five HK identifiers with vitest tests. _(REQ-13.2, REQ-13.4)_
- [ ] 52. Build the Apple Health export upload UI + server ingest to snapshots.
  _(REQ-13.2)_
- [ ] 53. Add Garmin and Samsung Health as `coming_soon` stubs with honest
  reasons. _(REQ-13.3)_
- [ ] 54. Build provider consent/opt-in UI (fields disclosed) and a disconnect
  button that deletes tokens; encrypt tokens at rest, service-role-only access.
  _(REQ-14.1, REQ-14.2, REQ-14.10)_
- [ ] 55. If Supabase configured: add RLS policies on every table and the
  leaderboard aggregate views (no location); else keep demo store. _(REQ-14.11, REQ-8.7, REQ-1.6)_
- [ ] 56. Add account deletion removing photos, stamps, snapshots, and tokens.
  _(REQ-14.12)_
- [ ] 57. Verify real-provider paths with keys and demo fallback without; commit
  `M7: Strava OAuth, Apple Health export parser, and privacy controls`.

## M8 — Polish + demo

- [ ] 58. Seed 6 demo users with a week of history (stamps, routes, snapshots,
  badges, kudos). _(REQ-15.2)_
- [ ] 59. Add the "Not medical advice" footer to every health screen and confirm
  DEMO/est. labels throughout. _(REQ-14.9, REQ-6.3)_
- [ ] 60. Run the PLAN.md §13 two-minute demo script end to end in demo mode at
  375×812; fix any console errors. _(REQ-15.3, REQ-1.3)_
- [ ] 61. Finalize `README.md` (setup, env vars, demo run, OSM/dataset citations,
  known limitations). _(REQ-15.4)_
- [ ] 62. Final lint/typecheck/test pass; commit `M8: demo seed data, honesty
  footers, and README polish`.
