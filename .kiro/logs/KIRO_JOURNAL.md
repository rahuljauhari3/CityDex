# Kiro Journal — CityDex

A short, factual record of which Kiro features we use and why.

## Steering (`.kiro/steering/*.md`, inclusion: always)
Always-on project context so every agent shares the same rules without
re-prompting:
- `product.md` — what CityDex is, users, H1 track, demo script, P0/P1/P2.
- `tech.md` — stack, demo-mode-always-works rule, Claude API rules.
- `structure.md` — Next.js App Router layout; pure logic isolated in `lib/`.
- `privacy.md` — PLAN §11 rules as hard requirements.
- `ui.md` — pixel × Strava tokens, fonts, components, mobile-first + a11y.
- `workflow.md` — M0–M8 order, pre-commit checks, commit/push rules.

## Custom agents (`.kiro/agents/*.json`)
Role-scoped agents with least-privilege tool access:
- `citydex-builder` — full-stack implementer; broad tools with scoped shell and
  write denials; can delegate to the trusted sub-agents.
- `citydex-tester` — vitest for pure logic; write limited to `tests/**`.
- `citydex-reviewer` — read-only; audits against privacy/tech/PLAN.
- `citydex-ui` — frontend/pixel-art; write limited to UI paths.

## Hooks (on `citydex-builder`)
Automation at agent lifecycle points:
- `agentSpawn` — show git status + recent log for orientation.
- `postToolUse` (write) — fast `tsc --noEmit` when `package.json` exists.
- `stop` — run lint at the end of a turn.

## Skills (`.kiro/skills/claude-vision-card/SKILL.md`)
Captures the exact `@anthropic-ai/sdk` stamp-card pattern (messages.parse +
zodOutputFormat, image-before-text, refusal + null guards, deterministic mock)
so the AI call is implemented correctly without guessing SDK shapes.

## Prompts (`.kiro/prompts/milestone.md`)
Reusable `{{M}}` template to drive each milestone consistently (task list →
delegate tests + review → fix → verify → commit).

## Sub-agents / crew
`citydex-builder` delegates to `citydex-tester` and `citydex-reviewer` (listed
as trusted) to keep test-writing and review separate from implementation.

## Not used yet
- Specs — PLAN.md already serves as the detailed spec; may add a spec later if a
  milestone needs formal requirements/design/tasks.
- Knowledge bases — not needed; steering + PLAN.md cover shared context.
- MCP — no external MCP servers configured; all integrations go through the
  provider adapters in PLAN §4.

## Agent format upgrade (universal v2+v3)
Upgraded the four agents to the universal v2+v3 format with
`kiro-cli agent upgrade`. The conversion of the old `curl .*\| *sh.*`
denied-command regex left a bare `"*"` in each shell deny rule's `match` array,
which denied ALL shell commands. Fixed by replacing that bare `"*"` with
`"curl * | sh*"` in `citydex-builder`, `citydex-reviewer`, `citydex-tester`,
and `citydex-ui`. The builder's `"tools": ["*"]` array was left unchanged.

## M0 — Scaffold (what Kiro features helped)
- **Spec (`.kiro/specs/citydex-core/`)** drove the work: `tasks.md` gave the exact
  M0 task breakdown (1–9) to track and check off, `design.md` §1–§4 fixed the
  App Router layout, the `Store` interface, and the demo-mode selection logic, so
  there was no guessing about structure.
- **Steering (always-on)** kept the scaffold on-spec without re-prompting:
  `ui.md` supplied the exact pixel palette/rarity/fonts baked into
  `globals.css` + `layout.tsx`; `tech.md` fixed the env var list for
  `.env.example` and the demo-fallback rule behind `lib/config.ts`;
  `structure.md` dictated the `lib/` layout and the server-only isolation
  (`import "server-only"` in `lib/db/index.ts` + `supabase.ts`).
- **`citydex-reviewer` sub-agent** did a read-only M0 audit and caught two real
  MEDIUM issues that the build wouldn't flag: a locked `maximumScale: 1` viewport
  (WCAG 1.4.4 pinch-zoom), and SVG-only PWA icons with no raster fallback. Both
  were fixed before commit (added a dependency-free PNG icon generator in
  `scripts/generate-icons.mjs`). It confirmed secret isolation and demo-fallback
  correctness, which let me commit with confidence.
- **Workflow steering** enforced the pre-commit gate (lint → tsc --noEmit → test,
  plus a build) and the `M0: …` commit message with no Co-Authored-By trailer.

## M1 — Map + places (what Kiro features helped)
- **Spec drove scope:** `tasks.md` tasks 10–16 gave the exact M1 breakdown;
  `design.md` §4 (the `Store` interface), §11 (geo math signatures), and §3 (the
  `Place` shape) fixed where everything went. Added `baselineRarity: Rarity` to
  `Place` so map pins can be rarity-colored without a per-user stamp.
- **Pure logic first:** `lib/geo/index.ts` (haversine, geofence, roundCoord,
  estimateSteps, routeDistance) is I/O-free per `structure.md`, so it was unit
  tested directly. `roundCoord` switched to fixed decimal-place rounding
  (design §3: "~10 m ≈ 4 decimal places") after tests exposed that the earlier
  cos(lat) grid was not idempotent.
- **Seed data, no runtime Overpass:** curated ~42 real Boston/Cambridge spots in
  `data/seed/boston-places.json` with OSM ODbL attribution; `data/seed/places.ts`
  validates with zod and feeds `memoryStore` via `ensureSeeded()`. `GET
  /api/places` serves them so the client map never imports the server-only store.
- **Sub-agent delegation (parallel):** dispatched `citydex-tester` (geo tests)
  and `citydex-ui` (react-leaflet map, markers, place sheet) in one turn. Both
  are write-restricted to paths outside the workspace home root, so their file
  writes were denied by their own permission profiles; they returned complete,
  hand-verified implementations which the builder applied with file tools. Worth
  revisiting the tester/ui write scope so they can write directly next time.
- **react-leaflet via `next/dynamic` ssr:false:** `MapScreen.tsx` lazy-loads
  `LeafletMap.tsx` so Leaflet never touches `window` on the server; OSM ©
  attribution stays visible (REQ-2.1), `watchPosition` drives live position with
  a non-blocking Boston fallback on denial (REQ-2.5).
- **`citydex-reviewer` audit** found no blockers and two should-fix items: the
  map height `calc(100vh-4rem)` could clip the OSM attribution on iOS Safari —
  switched to `100dvh`; and `CreatePlaceInput.baselineRarity` lacks a zod schema
  — deferred to M2 where user-created places first hit that boundary. Added a
  seed-attribution test so the ODbL notice can't silently drift.
- **Build note:** this repo uses `cacheComponents`, which rejects
  `export const dynamic = "force-dynamic"`; the route is dynamic anyway by
  reading `request.url`, so the export was removed.
- **Gate:** lint, `tsc --noEmit`, `npm test` (28 passing), and `npm run build`
  all pass before the `M1:` commit.
