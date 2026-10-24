# Kiro Journal

## 2026-10-24

- Reverted mutating shell commands (`git rm`, `git mv`, `rm *.tmp`, `npm uninstall`)
  from `.kiro/agents/citydex-reviewer.json`. The reviewer must stay **read-only**;
  it should only inspect and report findings, never modify the repo. Removed them
  from both `toolsSettings.shell.allowedCommands` and the `permissions` allow rule.
  Reviewer now allows only `git diff`, `git log`, `git status`, `ls`, `cat`.
  These mutating commands remain on `citydex-builder` and `citydex-tester`.

- **Direction change — the app's AI runtime is now Kiro. Instead the
  Next.js server reaches **Kiro itself** over the **Agent Client Protocol (ACP,
  JSON-RPC 2.0 over stdio)**: it spawns `kiro-cli acp --agent citydex-cardsmith`
  and drives `initialize` → `session/new` → `session/prompt` (image content block
  **before** the text block; `data` base64 with no `data:` prefix) → collect
  `session/update` `agent_message_chunk` text → extract the first balanced JSON
  object and `StampCardSchema.safeParse(...)`. Rationale: this is a Kiro hackathon
  entry, so dog-fooding Kiro as the product's own AI runtime is more honest and
  compelling than calling a third-party API, and it keeps a single AI dependency
  (kiro-cli) instead of an SDK + key.

  Fallback chain so demo mode always works: ACP → CLI (`kiro-cli chat
  --no-interactive --agent citydex-cardsmith` reading a temp-file photo) →
  deterministic mock (also used when `AI_PROVIDER=mock` or no kiro-cli). Refusal,
  no parseable JSON, a schema failure, or `accepted === false` all collapse to a
  generic "Mystery Spot" card with the photo **not** stored. A per-card timeout
  (`KIRO_CARD_TIMEOUT_MS`, default 45000) kills the child process, and a single
  in-process queue ensures only one kiro-cli card job runs at a time. Trade-off:
  the server must run where `kiro-cli` is installed and logged in (a long-running
  host/container/dev box, **not** serverless/Vercel); demo mode still runs
  everywhere via the mock.

- **`citydex-cardsmith` agent design** (`.kiro/agents/citydex-cardsmith.json`).
  This is the in-app card generator Kiro spawns at runtime — distinct from the
  build-time crew (builder/tester/reviewer/ui). Design choices:
  - **Least privilege:** no write tools, no shell. `read` is allowed **only**
    within the OS temp dir (`/tmp`, `/private/tmp`, `/var/folders`) for the
    CLI-fallback image, and `.env*`/home are explicitly denied — the agent should
    never touch repo or secret files.
  - **Prompt:** the whimsical village naturalist (PLAN §6): short, punny, PG lore
    (≤ 220 chars), never identify or describe real people, lore clearly playful,
    and `accepted=false` when the main subject is a person, a screen, a private
    interior, or unrecognizable. It must reply with ONLY a JSON object matching
    `StampCardSchema` (fields + enums enumerated inline so the agent self-checks).
  - Written in the universal v2+v3 agent format (`tools`/`allowedTools`,
    `permissions.rules`, `toolsSettings`, `kiroUpgrade`).

- **Config/doc sweep.** Updated `.kiro/steering/tech.md` (ACP architecture, new
  env vars `AI_PROVIDER`/`KIRO_CLI_PATH`/`KIRO_CARD_AGENT`/`KIRO_CARD_TIMEOUT_MS`,
  deployment limitation), `privacy.md`, `structure.md`, `workflow.md`,
  `.kiro/prompts/milestone.md`, PLAN.md §5/§6 (+ flow/table/milestone rows),
  `AGENT_PROMPT.md`, `README.md`, and the spec (`requirements.md` REQ-4,
  `design.md` §1/§2/§6/§7, `tasks.md` tasks 20/21 + a new **M2b** section).
  Replaced the skill with `.kiro/skills/kiro-vision-card/`
  (ACP message sequence with exact JSON-RPC shapes, CLI fallback, first-JSON-object
  parser, refusal → Mystery Spot, timeout + kill, single-job queue, mock).

---

## 2026-10-24 — Final re-scope: healthcare focus, no AI, batched delivery

**Direction change from the human (final).** Two decisions reshape the project:

1. **Healthcare (track H1) is the point; the collecting game is the motivation
   layer.** Updated `.kiro/steering/product.md` to lead with the pitch "How does
   this place affect your body?" and an explicit, prioritized list of the health
   features: health snapshot per check-in (steps, HR avg/max, HR zones, active
   kcal, SpO₂, with a source label) → weekly health summary → goals + progress
   rings → goal-based "Today's Quests" → place insights over time (HR at the same
   pace trending across visits) → CDC PLACES Suffolk County baseline card →
   Strava + Apple Health export, all under the privacy/consent/not-medical-advice
   rules. Pulled the two P2 health features (place insights, CDC baseline) into
   scope as REQ-16/17/18.

2. **No AI anywhere.** Dropped AI stamp-card generation entirely — no API,
   no Kiro ACP card generation, no `kiro-cli` subprocess, no
   `cardsmith`, no `lib/ai`. At check-in the user adds a photo that is shown on
   the stamp **exactly as uploaded** (still resized ≤ 1280 px and EXIF/location
   stripped client-side). The stamp's name, category and rarity come from the
   **place**: a seeded place supplies its stored values; a new user-created place
   uses the name + category the user types, with rarity `common`. The old AI
   "person is the main subject" check is replaced by a required checkbox: **"No
   people are the main subject of this photo"** — the server returns a 4xx and
   stores nothing if it is unset.

**Why.** (a) It sharpens the hackathon submission on the healthcare track the
app is actually entered in. (b) It makes the demo simpler and far more reliable:
no model latency, no `kiro-cli` install/login on the host, no ACP protocol
surface to get wrong, and no fallbacks to babysit — the card is deterministic and
offline, so demo mode works everywhere with zero keys. (c) It removes an entire
dependency and its failure modes, which is the right trade for a one-day build.

**Config/doc sweep (this run — docs/config only, no app code).**
- Removed every mention of AI card generation, the Kiro ACP card
  generation, `cardsmith`, `AI_PROVIDER`/`KIRO_CARD_*` env vars, `lore`, and the
  mock card from: `.kiro/steering/{product,tech,structure,workflow,ui,privacy}.md`,
  `.kiro/prompts/milestone.md`, `PLAN.md` (§2 flow, §3 table, §5 stack + env, §6
  rewritten as "Stamp card generation (no AI)", §9 UI, §11 privacy, §12 M2 row),
  `AGENT_PROMPT.md`, `README.md`, `.env.example`, and the spec
  (`requirements.md` REQ-4/5/8.3/14.8, `design.md` §1/§2/§4/§6/§7/§8/§12/§14,
  `tasks.md`).
- Spec additions: REQ-16 (place insights over time), REQ-17 (CDC PLACES Suffolk
  County baseline card), REQ-18 (weekly health summary); `design.md` §15/§16/§17
  for the insight algorithm (`computePlaceInsights`: ±10% pace bucketing + bpm/
  week linear trend, ≥2 points, sample size), the CDC baseline file format
  (`data/cdc-places-suffolk.json` with sourceUrl/releaseYear/dataYear), and the
  weekly summary aggregation (`computeWeeklySummary` with per-field source).
- `tasks.md` restructured into batches: **B0** remove all AI + switch to
  photo-as-uploaded + place card + fix the `qa-findings-1.md` findings; **B1**
  M3 health snapshot + M4 points/badges/leaderboards; **B2** M5 goals/quests +
  REQ-16/17/18; **B3a** M6 friends/feed and **B3b** M7 Strava/Apple export as
  parallel worktrees (each lists the files it owns and the shared
  `types.ts`/`store.ts`/`memory.ts` additive-only edits); **B4** M8 demo seed +
  README. Each batch ends with lint → tsc → test → build → commit.
- Agents: rewrote `citydex-builder` (no-AI prompt, dropped the `skill://`
  resource and `skill` capability) and `citydex-reviewer` (checks for the
  *absence* of AI and for the required "no people" checkbox). Tombstoned
  `.kiro/agents/citydex-cardsmith.json` and both skill folders
  (`.kiro/skills/kiro-vision-card`) — this configuring agent has no
  delete tool, so each file now carries a removal note and must be dropped with
  `git rm .kiro/agents/citydex-cardsmith.json` and
  `rm -rf .kiro/skills/kiro-vision-card`.

**Still references AI (handled by the B0 code run, not this config run):** app
code under `lib/ai/`, `app/api/stamps/route.ts`, `lib/config.ts`, `package.json`
`scripts/kiro-card-smoke.mjs`, and the `tests/ai-*.ts`
tests. B0 removes all of it.
