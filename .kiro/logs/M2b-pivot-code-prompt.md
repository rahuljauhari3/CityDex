Execute the M2b tasks in .kiro/specs/citydex-core/tasks.md: replace the Anthropic SDK card generator with the Kiro ACP card generator, using the kiro-vision-card skill and the updated tech.md.

- Delete lib/ai/claude.ts and remove @anthropic-ai/sdk from package.json (npm uninstall). Remove ANTHROPIC_API_KEY from .env.example, lib/config.ts and README; add AI_PROVIDER, KIRO_CLI_PATH, KIRO_CARD_AGENT, KIRO_CARD_TIMEOUT_MS.
- Implement lib/ai/kiro.ts (server-only): spawn kiro-cli acp --agent citydex-cardsmith, JSON-RPC over stdio, send the photo as an image content block, collect the text reply, extract JSON, zod-validate with StampCardSchema, timeout + kill, one-at-a-time queue. CLI fallback as in the skill. On any failure return the mock card and log why (server-side only, never the photo).
- Wire lib/ai/index.ts to choose kiro vs mock from config. The card reveal must show a small label when a mock card was used ("DEMO CARD").
- Before writing the ACP client, actually verify the protocol: run `kiro-cli acp --agent citydex-cardsmith` with a small test (a Node script in scripts/kiro-card-smoke.mjs that sends initialize/session/new/session/prompt with public/icons/icon-192.png or a generated test JPEG) and confirm the response shape. Keep that script as `npm run smoke:kiro`.
- Unit-test the JSON extraction + validation + fallback logic (delegate to citydex-tester), with the kiro process mocked.
- grep the repo (excluding node_modules, .next, .kiro/logs) for "anthropic", "claude-opus", "ANTHROPIC" and remove anything left in app code and docs.
- Delegate a review to citydex-reviewer (focus: no Anthropic SDK left, the photo is never stored when rejected, child process safety: no shell interpolation, args as an array, timeout kills the process).
- Run lint, tsc, tests, build; commit "M2b: generate stamp cards with Kiro (ACP) instead of the Anthropic SDK" with no Co-Authored-By trailer. Append a KIRO_JOURNAL.md entry.
