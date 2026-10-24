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
