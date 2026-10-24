# Prompt for a new Claude Code session

Copy everything below the line into a new Claude Code session opened in `/Users/raj/coding/CityDex`.

---

You are building **CityDex** for a one-day hackathon (Hackachusetts 2026, Healthcare track H1: "Turning wearable data into better healthcare").

CityDex is a mobile-first web app (PWA) that turns walking and running around a city into a collecting game. Users move around Boston, find interesting real-world spots (murals, statues, cafés, weird doors), photograph them, and AI turns each photo into a collectible "stamp" card with a name, rarity and short funny lore. Health metrics from the user's wearables (steps, heart rate and zones, calories, SpO₂) are attached to every check-in. They power points, badges, global and friends leaderboards, and goal-based place recommendations ("your friends burned avg 310 kcal getting here"). The look is a cozy, original pixel-art farming-sim style (Stardew Valley-inspired, no copied assets) mixed with Strava-style activity stats, feed and leaderboards.

## Read first
1. **`PLAN.md` in this folder is the source of truth.** Read all of it before writing code. It has the user flow, feature priorities, the provider adapter interface, the stamp card schema, points and badge rules, the recommendation formula, UI tokens, the data model, privacy rules and milestones M0–M8.
2. The app's AI runtime is **Kiro only** — it does **not** use the Anthropic SDK or API. For the stamp-card generator, **use the `kiro-vision-card` skill**: the Next.js server spawns `kiro-cli acp --agent citydex-cardsmith` and drives it over the Agent Client Protocol (ACP, JSON-RPC 2.0 over stdio) — `initialize` → `session/new` → `session/prompt` with the base64 image content block before the text block → collect `agent_message_chunk` updates → extract the first JSON object and zod `safeParse` it. There is a `kiro-cli chat --no-interactive` CLI fallback and a deterministic mock. Do not guess the protocol shapes.

## How to work
- Build the milestones **in order (M0 → M8)**. Each milestone must end in a running app. Commit after each one with a clear message. **Do not add any `Co-Authored-By` trailer to commits.** Don't push or create remote repos unless I ask.
- **Demo mode must always work:** with only `DEMO_MODE=true` and no API keys, the full flow (map → check-in → photo → card → points → leaderboard) must run, using the demo health provider and a mock card generator. Real keys switch on the real integrations.
- Stack: Next.js (App Router) + TypeScript + Tailwind, Supabase (Auth, Postgres with RLS, Storage), react-leaflet + OpenStreetMap tiles (keep attribution), zod. The app's AI runs through **Kiro only** (no `@anthropic-ai/sdk`): the server spawns `kiro-cli` over ACP server-side only. Keep all provider tokens and the kiro-cli subprocess server-side only.
- Health integrations: follow PLAN.md section 4 exactly. Apple Health and Samsung Health have **no web API**. Apple uses an uploaded `export.xml` parser, Samsung and Garmin are "coming soon" stubs, Strava (P1) and WHOOP/Fitbit (P2) use web OAuth. Label demo and estimated values clearly ("DEMO", "est.").
- Privacy rules in PLAN.md section 11 are requirements, not nice-to-haves: no location on leaderboards, strip photo EXIF, reject photos where a person is the main subject, consent screen, "not medical advice" footer.
- Mobile first: design and test at 375×812. After each UI milestone, run the dev server through the preview tools, check the console for errors, and screenshot the main screens at mobile size to verify. Fix issues before moving on.
- Write a small number of focused tests for the pure logic: points formula, badge rules, recommendation scoring, haversine/geofence, Apple Health XML parsing.
- Keep a `README.md` updated: setup, env vars (`.env.example`), how to run demo mode, data sources with citations (OpenStreetMap ODbL, any hackathon kit datasets), and known limitations.

## Things only I (the human) can do. Ask me, don't attempt them yourself
- Creating the Supabase project and the Strava / WHOOP / Fitbit developer apps, and pasting secrets into `.env.local`.
- Installing and logging in `kiro-cli` on the host that runs the server (needed for real card generation; demo mode uses the mock instead).
- Deploying to Vercel or any public URL.
- Anything that posts or sends data to an external service beyond the APIs listed in PLAN.md.

When a milestone needs one of these, build it behind the demo fallback, tell me exactly which keys or settings you need, and keep going with the next milestone.

## Definition of done
M0–M6 working in demo mode on a phone-sized viewport, M7 Strava + Apple Health export working when keys and files are provided, M8 demo data seeded so the 2-minute demo script in PLAN.md section 13 runs start to finish without errors.

Start by reading `PLAN.md`, then give me a short build plan for M0–M2 and begin M0.
