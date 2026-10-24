---
inclusion: always
---

# CityDex — Structure

Proposed Next.js App Router layout. Keep pure, testable logic in `lib/` so it
can be unit-tested without a browser or network. Keep all secret-touching code
(the kiro-cli subprocess, provider tokens, service role) server-side only.

```
app/                      # Next.js App Router
  (routes)/               # pages: map, quests, dex, feed, profile, onboarding
  api/                    # route handlers (server-only: stamps, auth, providers)
  layout.tsx
  globals.css
components/                # presentational + interactive React components
  map/                    # leaflet map, markers, place sheet
  stamp/                  # stamp card reveal, dex grid
  feed/                   # activity cards, kudos
  leaderboard/            # notice-board rows
  ui/                     # shared pixel UI primitives (panels, buttons, rings)
lib/
  health/                 # HealthProvider interface + adapters (demo, strava,
                          #   apple_export, whoop, fitbit, garmin, samsung stubs)
  points/                 # points formula (rarity base, bonuses, multipliers)
  badges/                 # rule-based badge engine
  recs/                   # goal-based recommendation scoring
  geo/                    # haversine, geofence, stride estimation
  ai/                     # Kiro ACP stamp-card client (kiro-cli) + mock card generator
  db/                     # Supabase client + demo/in-memory fallback, queries
tests/                     # vitest unit tests for lib/* pure logic
data/
  seed/                   # Boston seed places (OSM-derived), demo users/history
public/                    # PWA manifest, icons, static pixel assets
```

## Conventions

- Validate every external input (API body, AI output, provider response) with
  `zod` at the boundary.
- Pure logic (`lib/points`, `lib/badges`, `lib/recs`, `lib/geo`, Apple Health
  XML parser) must be free of I/O so it is directly unit-testable.
- Server-only modules (`lib/ai`, provider token handling, `lib/db` service-role
  paths) must never be imported into client components.
- Demo fallbacks live alongside the real implementation they shadow (e.g.
  `lib/health/demo.ts`, `lib/ai/mock.ts`, `lib/db/memory.ts`).
