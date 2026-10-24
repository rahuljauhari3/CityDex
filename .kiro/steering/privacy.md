---
inclusion: always
---

# CityDex — Privacy & Honesty (hard requirements, PLAN.md §11)

These are requirements, not nice-to-haves. Judges will check them. Treat a
violation as a build failure.

## Consent & provider control
- Explicit opt-in per health provider. Show exactly which fields are pulled.
- A disconnect button deletes the provider tokens.
- Consent screen explains what is stored (check-in location, health snapshot,
  photo) before any data is captured.

## Location
- Store check-in coordinates rounded to ~10 m.
- Routes are private by default. The feed shows a route mini-map only if the
  user turns it on.
- **Home-zone blur:** hide the first and last 200 m of any shared route.
- **Never show location or routes on leaderboards. Ever.**

## Photos
- Resize client-side (≤ 1280 px long edge, JPEG ~0.8) and strip EXIF (including
  location) before the photo leaves the browser.
- The photo is stored and shown **exactly as uploaded** (no AI, no pixel/dither
  filter); it is EXIF-stripped before storage.
- Require a **"No people are the main subject of this photo"** checkbox at
  check-in. If it is not set, the server returns a 4xx and does **not** store
  the photo. This checkbox replaces any image analysis.

## Health data honesty
- "Not medical advice" footer on every health screen. Wellness language only;
  no diagnoses or clinical claims.
- Label all demo, synthetic, and estimated data clearly ("DEMO", "est.").
- Health tokens are readable only by the service role; encrypt provider tokens
  at rest (AES-GCM with a server key or Supabase Vault).

## Access control
- Supabase RLS on every table: users read/write only their own private rows.
- `stamps` and `profiles` visible to friends (and globally only as leaderboard
  aggregates).
- Account deletion removes photos, stamps, snapshots, and tokens.

## Secrets
- All provider tokens stay server-side only; never shipped to the client.
- The app uses **no AI** — no Anthropic SDK or API, and no `kiro-cli`
  subprocess.
