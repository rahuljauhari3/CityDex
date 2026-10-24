---
inclusion: always
---

# CityDex — Workflow

## Build milestones in order (PLAN.md §12)

Build M0 → M8 in sequence. Each milestone must end in a **running app** and be
committed before starting the next.

| # | Milestone | Done when |
|---|---|---|
| M0 | Scaffold | Next.js + TS + Tailwind pixel theme, PWA manifest, `.env.example`, Supabase client with demo fallback, lint passes, runs locally |
| M1 | Map + places | Leaflet map, live position, seeded Boston places with rarity pins, place detail sheet |
| M2 | Check-in + photo + AI card | Geofence check, camera capture, `/api/stamps` → Claude card (or mock), card reveal, saved to Dex |
| M3 | Health snapshot | Provider interface, demo provider, browser route tracking (est. steps), snapshot on each stamp |
| M4 | Points, badges, leaderboards | Points formula, badge engine, global leaderboard (week/all-time × steps/points/stamps) |
| M5 | Onboarding goals + recs | Goals flow, progress rings, "Today's Quests" with reasons |
| M6 | Friends + feed | Add friend, friends leaderboard tab, feed with kudos |
| M7 | Real providers | Strava OAuth; Apple Health export parser; WHOOP if time allows |
| M8 | Polish + demo | Seed 6 demo users with a week of history, demo script runs, README updated |

## Before every commit
Run, in order, and fix failures before committing:
1. `npm run lint`
2. `npx tsc --noEmit`
3. `npm test`

## Commit rules
- Commit after each milestone with message format: `M<n>: <summary>`
  (e.g. `M0: scaffold Next.js app with pixel Tailwind theme and demo fallback`).
- **NEVER add a `Co-Authored-By` trailer to any commit.**
- Prefer staging specific files over `git add .`.
- Never push and never create remote repos.

## Things only the human can do — ask, do not attempt
- Creating the Supabase project, Strava / WHOOP / Fitbit developer apps, or an
  Anthropic API key, and pasting secrets into `.env.local`.
- Deploying to Vercel or any public URL.
- Any action that sends data to an external service beyond the APIs in PLAN.md.

When a milestone needs one of these, build it behind the demo fallback, tell the
human exactly which keys/settings are needed, and continue with the next
milestone.

## Verification cadence
- Demo mode (`DEMO_MODE=true`, no keys) must work after every milestone.
- After UI milestones, test at 375×812 and check the browser console.
- Write focused tests for pure logic as the matching milestone lands; delegate
  test writing to `citydex-tester` and code review to `citydex-reviewer`.
