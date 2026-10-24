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
- The photo is sent to the Kiro card agent (`citydex-cardsmith`) over ACP
  server-side only for card generation; it is EXIF-stripped before storage.
- Reject photos where a person is the main subject (agent `accepted === false`,
  or a refusal / unparseable card): do **not** store the photo; ask the user to
  retake. For the CLI fallback, the temp image file is deleted immediately after
  the card is generated.

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
- `kiro-cli` is spawned server-side only (never from the client), and the app
  does not use the Anthropic SDK or API.
