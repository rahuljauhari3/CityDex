# Kiro Journal — CityDex

A short, factual record of which Kiro features we use and why.

## Steering (`.kiro/steering/*.md`, inclusion: always)
Always-on project context so every agent shares the same rules without
re-prompting:
- `product.md` — what CityDex is, users, H1 track, demo script, P0/P1/P2.
- `tech.md` — stack, demo-mode-always-works rule.
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

## M2 — Check-in + photo + AI card + Dex (what Kiro features helped)
- **Spec drove scope:** `tasks.md` 17–25 and `design.md` §6 (AI schema/pipeline)
  and §7 (check-in sequence) fixed the order: photo capture → geofence/accuracy
  gates → `StampCardSchema` → Kiro ACP → mock → `POST /api/stamps` → card
  reveal → Dex grid. The single `StampCard` type now lives in `lib/ai/schema.ts`
  and `lib/db/types.ts` re-exports it, so the store and AI share one contract.
- **Privacy at the boundary:** `lib/photo.ts` re-encodes the capture through a
  canvas (≤1280 px, JPEG ~0.8), which drops all EXIF/GPS before upload; the
  server never trusts EXIF. New user places are created at `roundCoord(pos)`
  (~10 m). Rejected (`accepted === false`) and refused photos are never stored.
- **Demo teleport (requested):** `CollectFlow` offers a DEMO-labeled "teleport
  to this place" checkbox shown only in demo mode; the server reads `teleport`
  purely as a bypass of the 75 m geofence / 50 m accuracy gates so the full
  collect flow runs without being on-site. `isDemoMode` is threaded server→client
  through the map page as a prop — no new `NEXT_PUBLIC_*` secret-ish env var.
- **Sub-agent delegation:** dispatched `citydex-tester` (pure-logic tests for the
  deterministic mock + schema) and `citydex-ui` (StampCardReveal + DexGrid) in
  parallel. Both were again blocked from writing by their own `~/**` deny rule
  (the workspace lives under `~`), so they returned complete, hand-verified code
  that the builder applied with file tools. `citydex-reviewer` (read-only) then
  audited M2: no blockers; it confirmed the beta-SDK shape, server-only
  isolation, EXIF strip, coord rounding, no-store-on-reject, and the demo path.
  Fixed its two should-fix items: wrapped `GET /api/dex` in try/catch, and added
  a Tab focus-trap to the card-reveal dialog (WCAG 2.4.3).
- **Tests:** `tests/ai.test.ts` covers mock determinism, distinct-card spread,
  schema validity of every mock, and `StampCardSchema` boundary cases
  (lore >220, >4 tags, bad category/rarity).

## Lesson — single-command shell rules + expanded allow-list
In headless (non-interactive) runs the agent permission allow-list matches
**single** commands only. Chaining with `&&`, `||`, `;`, pipes, redirects, or
subshells pushes a command outside those patterns, so it is denied. Codified
this in `workflow.md` under "Shell command rules (non-interactive
permissions)": one command per tool call, no chaining, and the pre-commit gate
(lint → tsc --noEmit → test) runs as three separate tool calls. Also widened the
shell allow-lists on `citydex-builder`, `citydex-tester`, and `citydex-reviewer`
to permit `git rm *`, `git mv *`, `rm *.tmp`, and `npm uninstall *` in **both**
`toolsSettings.shell.allowedCommands` (regex form) and `permissions.rules` shell
allow `match` (glob form). Note: these four are mutating commands now allowed on
the otherwise read-only `citydex-reviewer`, per the request.
