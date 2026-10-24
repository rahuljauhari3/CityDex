
- Implement lib/ai/kiro.ts (server-only): spawn kiro-cli acp --agent citydex-cardsmith, JSON-RPC over stdio, send the photo as an image content block, collect the text reply, extract JSON, zod-validate with StampCardSchema, timeout + kill, one-at-a-time queue. CLI fallback as in the skill. On any failure return the mock card and log why (server-side only, never the photo).
- Wire lib/ai/index.ts to choose kiro vs mock from config. The card reveal must show a small label when a mock card was used ("DEMO CARD").
- Before writing the ACP client, actually verify the protocol: run `kiro-cli acp --agent citydex-cardsmith` with a small test (a Node script in scripts/kiro-card-smoke.mjs that sends initialize/session/new/session/prompt with public/icons/icon-192.png or a generated test JPEG) and confirm the response shape. Keep that script as `npm run smoke:kiro`.
- Unit-test the JSON extraction + validation + fallback logic (delegate to citydex-tester), with the kiro process mocked.
