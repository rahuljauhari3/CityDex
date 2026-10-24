# Kiro Journal

## 2026-10-24

- Reverted mutating shell commands (`git rm`, `git mv`, `rm *.tmp`, `npm uninstall`)
  from `.kiro/agents/citydex-reviewer.json`. The reviewer must stay **read-only**;
  it should only inspect and report findings, never modify the repo. Removed them
  from both `toolsSettings.shell.allowedCommands` and the `permissions` allow rule.
  Reviewer now allows only `git diff`, `git log`, `git status`, `ls`, `cat`.
  These mutating commands remain on `citydex-builder` and `citydex-tester`.

- **Direction change — the app's AI runtime is now Kiro, not Anthropic.** CityDex
  no longer uses `@anthropic-ai/sdk` or the Anthropic API anywhere. Instead the
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
  - **Model:** `claude-haiku-5.5` — fast and cheap, right-sized for a single
    structured-output vision turn per check-in.
  - Written in the universal v2+v3 agent format (`tools`/`allowedTools`,
    `permissions.rules`, `toolsSettings`, `kiroUpgrade`).

- **Config/doc sweep.** Updated `.kiro/steering/tech.md` (ACP architecture, new
  env vars `AI_PROVIDER`/`KIRO_CLI_PATH`/`KIRO_CARD_AGENT`/`KIRO_CARD_TIMEOUT_MS`,
  deployment limitation), `privacy.md`, `structure.md`, `workflow.md`,
  `.kiro/prompts/milestone.md`, PLAN.md §5/§6 (+ flow/table/milestone rows),
  `AGENT_PROMPT.md`, `README.md`, and the spec (`requirements.md` REQ-4,
  `design.md` §1/§2/§6/§7, `tasks.md` tasks 20/21 + a new **M2b** section).
  Replaced the `claude-vision-card` skill with `.kiro/skills/kiro-vision-card/`
  (ACP message sequence with exact JSON-RPC shapes, CLI fallback, first-JSON-object
  parser, refusal → Mystery Spot, timeout + kill, single-job queue, mock). The old
  `claude-vision-card` folder was left as a tombstone pointing to the new skill
  because this configuring agent has no delete tool — it should be removed with
  `rm -rf .kiro/skills/claude-vision-card`. App code under `lib/ai`, `app/api`,
  `package.json`, and `.env.example` still references Anthropic and is handled in
  the separate M2b code run (tasks 25a–25i).
