---
name: kiro-vision-card
description: Exact pattern for generating a CityDex stamp card from a photo using Kiro as the app's AI runtime over the Agent Client Protocol (ACP, JSON-RPC 2.0 over stdio) — spawn kiro-cli acp --agent citydex-cardsmith, send an image content block before the text block, collect agent_message_chunk updates, extract the first JSON object and zod safeParse it. Includes the kiro-cli chat --no-interactive CLI fallback, refusal/reject → "Mystery Spot" handling, a per-card timeout + process kill, a single in-process queue, and the deterministic mock used when AI_PROVIDER=mock or kiro-cli is unavailable. Use whenever implementing or editing the stamp-card AI call in lib/ai.
---

# Kiro (ACP) → stamp card

The app's AI runtime is **Kiro itself**, not the Anthropic SDK. The Next.js
server reaches Kiro over the **Agent Client Protocol (ACP)**: it spawns
`kiro-cli acp --agent $KIRO_CARD_AGENT` as a child process and drives it with
JSON-RPC 2.0 messages over stdio. kiro-cli is spawned **server-side only** and
never from the client.

Three layers, in priority order:

1. **ACP (primary):** spawn `kiro-cli acp`, send the photo as an image content
   block, read the agent's text, parse the JSON card.
2. **CLI fallback:** if ACP image input is unavailable, save the photo to a temp
   file and run `kiro-cli chat --no-interactive --agent $KIRO_CARD_AGENT`,
   telling the agent to read that file.
3. **Mock fallback:** if `AI_PROVIDER=mock`, or `kiro-cli` is not found, or any
   of the above fails/times out, return a deterministic mock card so demo mode
   always works.

Resolution: `AI_PROVIDER=mock` → mock. Otherwise try ACP; on failure fall back
to CLI; on failure fall back to mock. Default `AI_PROVIDER` is `kiro` when a
`kiro-cli` binary is found on `KIRO_CLI_PATH`, else `mock`.

## Schema (PLAN.md §6)

```ts
import { z } from "zod";

export const StampCardSchema = z.object({
  accepted: z.boolean(),            // false if main subject is a person, a screen,
                                    // private interior, or unrecognizable
  rejectReason: z.string().nullable(),
  name: z.string(),                 // e.g. "The Door That Judges You"
  category: z.enum([
    "mural","statue","cafe","door","park","building",
    "transit","water","nature","shop","oddity","other",
  ]),
  rarity: z.enum(["common","uncommon","rare","epic","legendary"]), // AI suggestion
  lore: z.string(),                 // <= 220 chars, funny, kind, no real-people claims
  tags: z.array(z.string()).max(4), // e.g. ["red-brick","cozy","historic"]
  colorHex: z.string(),             // dominant color for card frame tint
});

export type StampCard = z.infer<typeof StampCardSchema>;
```

Final rarity is adjusted **server-side** by collector count (PLAN.md §6); this
call only produces the AI suggestion.

## Config (env)

```
AI_PROVIDER=kiro            # kiro | mock (default kiro if kiro-cli found, else mock)
KIRO_CLI_PATH=kiro-cli      # path to the kiro-cli binary
KIRO_CARD_AGENT=citydex-cardsmith
KIRO_CARD_TIMEOUT_MS=45000  # per-card timeout before the process is killed
```

## ACP message sequence (JSON-RPC 2.0 over stdio)

> Verify the exact field names against the running `kiro-cli acp` build before
> relying on them; ACP is evolving. The shapes below are the contract this skill
> assumes. If a field differs, correct it here rather than guessing elsewhere.

All messages are newline-delimited JSON-RPC 2.0 objects written to the child's
stdin; responses and notifications arrive on its stdout.

1. **initialize** (request → response). Negotiate the protocol version and
   advertise client capabilities.

   ```json
   { "jsonrpc": "2.0", "id": 1, "method": "initialize",
     "params": {
       "protocolVersion": 1,
       "clientCapabilities": { "fs": { "readTextFile": false, "writeTextFile": false } }
     } }
   ```

   The response returns the agent's `protocolVersion` and `agentCapabilities`
   (including whether image content is accepted in a prompt).

2. **session/new** (request → response). Create a session; capture the returned
   `sessionId`.

   ```json
   { "jsonrpc": "2.0", "id": 2, "method": "session/new",
     "params": { "cwd": "<repo-or-temp-dir>", "mcpServers": [] } }
   ```

   ```json
   { "jsonrpc": "2.0", "id": 2, "result": { "sessionId": "sess_..." } }
   ```

3. **session/prompt** (request). Send the prompt as an ordered content array,
   with the **image content block BEFORE the text block**. The image block is
   `{ "type": "image", "mimeType": "image/jpeg", "data": "<base64>" }` where
   `data` is raw base64 with **no `data:` prefix**.

   ```json
   { "jsonrpc": "2.0", "id": 3, "method": "session/prompt",
     "params": {
       "sessionId": "sess_...",
       "prompt": [
         { "type": "image", "mimeType": "image/jpeg", "data": "<base64, no data: prefix>" },
         { "type": "text", "text": "Catalog this city spot as a collectible stamp card. Reply with ONLY the JSON object." }
       ]
     } }
   ```

   If `initialize` reported that the agent does not accept image content, skip
   ACP and use the CLI fallback below.

4. **session/update** notifications (streamed). While the turn runs, the agent
   emits `session/update` notifications. Collect the text from
   `agent_message_chunk` updates:

   ```json
   { "jsonrpc": "2.0", "method": "session/update",
     "params": {
       "sessionId": "sess_...",
       "update": {
         "sessionUpdate": "agent_message_chunk",
         "content": { "type": "text", "text": "{\"accepted\":true, ..." }
       }
     } }
   ```

   Concatenate every `agent_message_chunk` text in arrival order.

5. **session/prompt** response. The turn ends with the response to the id-3
   request, carrying a `stopReason` (e.g. `end_turn`, `refusal`, `cancelled`).
   Treat `refusal`/`cancelled` as a refusal.

6. Dispose: close stdin / kill the child after the turn (or reuse the process
   for the next queued job — see the queue below).

### Sketch

```ts
// lib/ai/kiro-acp.ts (shape only; verify ACP fields against the live binary)
import { spawn } from "node:child_process";
import { StampCardSchema, type StampCard } from "./schema";
import { extractFirstJsonObject } from "./parse";
import { mysterySpotCard } from "./mystery";

export async function generateCardAcp(
  base64: string,
  mimeType: "image/jpeg" | "image/png",
  opts: { cliPath: string; agent: string; cwd: string; timeoutMs: number },
): Promise<StampCard> {
  const child = spawn(opts.cliPath, ["acp", "--agent", opts.agent], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  const kill = () => { try { child.kill("SIGKILL"); } catch {} };
  const timer = setTimeout(kill, opts.timeoutMs);

  try {
    await rpc(child, 1, "initialize", {
      protocolVersion: 1,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false } },
    });
    const { sessionId } = await rpc(child, 2, "session/new", {
      cwd: opts.cwd, mcpServers: [],
    });

    let text = "";
    onNotification(child, "session/update", (p) => {
      const u = p.update;
      if (u?.sessionUpdate === "agent_message_chunk" && u.content?.type === "text") {
        text += u.content.text;
      }
    });

    const result = await rpc(child, 3, "session/prompt", {
      sessionId,
      prompt: [
        { type: "image", mimeType, data: base64 },
        { type: "text", text: "Catalog this city spot as a collectible stamp card. Reply with ONLY the JSON object." },
      ],
    });

    if (result?.stopReason === "refusal" || result?.stopReason === "cancelled") {
      return mysterySpotCard("refusal");
    }

    const json = extractFirstJsonObject(text);
    if (!json) return mysterySpotCard("no_json");

    const parsed = StampCardSchema.safeParse(json);
    if (!parsed.success) return mysterySpotCard("schema");
    return parsed.data;
  } finally {
    clearTimeout(timer);
    kill();
  }
}
```

`rpc()` writes a JSON-RPC request line, resolves on the matching `id` response,
and rejects on timeout; `onNotification()` dispatches id-less messages. On any
thrown error (spawn failure, timeout, broken pipe), the caller falls back to the
CLI path and then the mock.

## CLI fallback (`kiro-cli chat --no-interactive`)

Used when ACP image input is unavailable or the ACP path throws.

1. Write the resized, EXIF-stripped JPEG to a unique file in the OS temp dir
   (e.g. `os.tmpdir()/citydex-card-<uuid>.jpg`).
2. Run `kiro-cli chat --no-interactive --agent $KIRO_CARD_AGENT` with a prompt
   that names the temp file and tells the agent to read it and reply with ONLY
   the JSON card. The `citydex-cardsmith` agent has read access restricted to
   the OS temp dir for exactly this.
3. Capture stdout, `extractFirstJsonObject` + `StampCardSchema.safeParse`.
4. Always delete the temp file in a `finally` (even on timeout/kill).
5. Enforce the same `KIRO_CARD_TIMEOUT_MS` and kill the process on timeout.

Run kiro-cli as a single argv array (no shell string interpolation) to avoid
command injection; never pass untrusted text through a shell.

## Output parsing

```ts
// lib/ai/parse.ts
export function extractFirstJsonObject(text: string): unknown | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)); }
        catch { return null; }
      }
    }
  }
  return null;
}
```

Scan from the first `{`, track brace depth while respecting string literals, and
`JSON.parse` the first balanced object. Then `StampCardSchema.safeParse`. A
missing/unparseable/invalid object is treated as a **refusal**.

## Refusal / reject handling → "Mystery Spot"

If the agent refuses (`stopReason`), returns no parseable JSON, fails schema
validation, or sets `accepted === false` (person as main subject, a screen, a
private interior, or unrecognizable), return a generic "Mystery Spot" card and
**do not store the photo** — prompt the user to retake.

```ts
// lib/ai/mystery.ts
import type { StampCard } from "./schema";
export function mysterySpotCard(reason: string): StampCard {
  return {
    accepted: false,
    rejectReason: reason,
    name: "Mystery Spot",
    category: "oddity",
    rarity: "common",
    lore: "Something here resisted cataloging. The naturalist shrugs and moves on.",
    tags: ["mysterious"],
    colorHex: "#9E9E9E",
  };
}
```

## Timeout + process kill

- Enforce `KIRO_CARD_TIMEOUT_MS` (default 45000) per card job.
- On timeout, `SIGKILL` the kiro-cli child (ACP or CLI), clear the timer in a
  `finally`, delete any temp file, and fall back to the mock.
- Never leave an orphaned kiro-cli process.

## Single in-process queue

Only **one** kiro-cli card job may run at a time in the Node server; new
requests queue behind the active one. This bounds memory/CPU and avoids
interleaved stdio on reused processes.

```ts
// lib/ai/queue.ts
let tail: Promise<unknown> = Promise.resolve();
export function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = tail.then(job, job); // run even if the previous job rejected
  tail = run.catch(() => {});
  return run;
}
```

Wrap the ACP/CLI card generation in `enqueue(...)`. The mock does not need the
queue.

## Mock (deterministic, demo mode)

Used when `AI_PROVIDER=mock` or kiro-cli is unavailable/failed. Pick the card
deterministically from a hash of the image bytes so the same photo always yields
the same card.

```ts
// lib/ai/mock.ts
import { StampCardSchema, type StampCard } from "./schema";

const MOCKS: StampCard[] = [
  { accepted: true, rejectReason: null, name: "The Wall That Ate Tuesday",
    category: "mural", rarity: "rare",
    lore: "A mural so vivid it allegedly swallowed a whole Tuesday. No refunds.",
    tags: ["colorful","street-art","bold"], colorHex: "#2196F3" },
  { accepted: true, rejectReason: null, name: "The Door That Judges You",
    category: "door", rarity: "uncommon",
    lore: "It has seen your posture. It is not impressed, but it wishes you well.",
    tags: ["red-brick","historic","cozy"], colorHex: "#C0392B" },
  { accepted: true, rejectReason: null, name: "Bench of Quiet Reckonings",
    category: "park", rarity: "common",
    lore: "Where big decisions go to be postponed in the shade of a kind tree.",
    tags: ["green","calm","restful"], colorHex: "#6DAA2C" },
];

function hash(bytes: Uint8Array): number {
  let h = 2166136261;
  for (const b of bytes) { h ^= b; h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function mockStampCard(bytes: Uint8Array): StampCard {
  const card = MOCKS[hash(bytes) % MOCKS.length];
  return StampCardSchema.parse(card); // validate the mock too
}
```

## Rules checklist

- Transport is **kiro-cli over ACP**; there is **no Anthropic SDK or API**.
- Spawn `kiro-cli acp --agent $KIRO_CARD_AGENT`; `initialize` → `session/new` →
  `session/prompt` → collect `agent_message_chunk` → read `stopReason`.
- Image content block **before** the text block; `data` is base64 with **no
  `data:` prefix**; set the correct `mimeType`.
- CLI fallback writes the photo to the OS temp dir, runs
  `kiro-cli chat --no-interactive --agent $KIRO_CARD_AGENT`, and always deletes
  the temp file.
- Parse the **first balanced JSON object**, then `StampCardSchema.safeParse`.
- Refusal / no JSON / schema fail / `accepted === false` → Mystery Spot card;
  **do not store the photo**.
- Enforce `KIRO_CARD_TIMEOUT_MS`; kill the child on timeout; no orphans.
- Single in-process queue: one card job at a time.
- `AI_PROVIDER=mock` or kiro-cli unavailable → deterministic `mockStampCard`.
- kiro-cli is spawned **server-side only**; never from the client. Resize ≤ 1280
  px / JPEG ~0.8 and strip EXIF before the photo reaches the agent or storage.
- Final rarity is adjusted server-side by collector count (PLAN.md §6).
