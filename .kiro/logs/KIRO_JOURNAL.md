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
