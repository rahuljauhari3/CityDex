---
inclusion: always
---

# CityDex — Product

CityDex is a mobile-first web app (PWA) for the **Healthcare & Biotech track
(H1: turning wearable data into better healthcare)**. **Health is the point.**
Every check-in captures a health snapshot from the user's wearables and feeds a
weekly health summary, wellness goals and progress rings, goal-based
recommendations, and place insights over time.

The collecting game is the **motivation layer** on top: users move around
Boston, find interesting real-world spots (murals, statues, cafés, weird doors),
photograph them, and each becomes a collectible "stamp" card. The stamp's name,
category and rarity come from the place — seed data for a seeded place, or a
name + category the user types for a new place (rarity `common`). The photo is
shown exactly as uploaded. **No AI is used anywhere in the app.**

## The core selling point

**"How does this place affect your body?"** Wearables track the body over time;
Strava tracks where you went. CityDex connects the two: every collected place
stores a snapshot of what your body did to get there and while there, and turns
that into wellness insight. Collecting makes the healthy movement fun; the health
features are what the app is for.

## Health features (priority order — this is the product)

1. **Health snapshot per check-in** — steps, HR avg/max, HR zone minutes, active
   kcal, SpO₂ when available, each tagged with its source (DEMO / Strava / Apple
   / est.). Attached to every stamp and shown on the card.
2. **Weekly health summary** (Profile) — steps, active kcal, zone-2+ minutes, avg
   SpO₂ when available, each value's source, and progress against goals.
3. **Goals + progress rings** — onboarding picks wellness goals (steps, active
   kcal, zone minutes, explore, recovery) with targets; Home shows pixel progress
   rings.
4. **Goal-based "Today's Quests"** — explainable, heuristic place recommendations
   tied to remaining goals ("Fills 80% of today's step goal", "3 friends burned
   avg 310 kcal getting here").
5. **Place insights over time** — for places visited 2+ times, compare HR at a
   similar pace across visits and show a wellness-worded trend ("avg HR on the
   Esplanade loop down 6 bpm over 2 weeks at the same pace, based on 4 visits").
6. **CDC PLACES Suffolk County baseline card** (Profile) — county activity
   indicators from a bundled static dataset, cited, with the data year labeled.
7. **Real providers** — Strava OAuth and Apple Health `export.xml` upload; WHOOP
   and Fitbit later; Garmin and Samsung Health are honest "coming soon" stubs.

All of the above honor the privacy/consent rules and carry a **"not medical
advice"** footer; demo, synthetic and estimated values are always labeled
("DEMO", "est.").

## Users

- City walkers/runners who want their everyday movement to feel like a game.
- People with wellness goals (steps, active calories, cardio zone minutes,
  exploration, stress/recovery) who want encouragement, not medical advice.

## Hackathon context

- Event: Hackachusetts 2026.
- Primary track: Healthcare & Biotech → **H1: Turning wearable data into better
  healthcare**.
- Framing: wellness insights only, never medical advice. "Clinical decisions
  stay with qualified professionals."

## Two-minute demo (what must work end to end)

1. Hook: watch knows HR, Strava knows route, nobody connects them or makes it
   fun.
2. Onboard: pick goals (e.g. 400 kcal/day, explore 3 places/week), connect
   Strava or the demo provider.
3. Quests: Home shows "Today's Quests" with reasons.
4. Collect: arrive at a place, snap a photo (confirm "no people are the main
   subject"), card flips with name · rarity · distance · steps · avg HR · kcal ·
   points.
5. Social: badge unlock, friends leaderboard, a friend high-fives.
6. Insight + honesty: place-insight card, CDC PLACES county baseline, and the
   honest "not medical advice; Apple/Samsung need a native wrapper" caveat.

## Feature priorities

### P0 (demo-critical, must work in demo mode)
- Map with places and live position.
- Check-in with geofence + photo capture (required "no people" checkbox).
- Stamp card built from place data + the uploaded photo (no AI).
- Collection book ("Dex").
- Demo health provider (seeded realistic data, labeled DEMO).
- Points + global leaderboard.

### P1
- Health snapshot per check-in + weekly health summary.
- Strava OAuth provider.
- Apple Health export (`export.xml`) upload + parser.
- Goals onboarding + progress rings.
- Goal-based recommendations ("Today's Quests").
- Friends + friends leaderboard + feed with kudos.
- Tags / badges.

### P2
- Place insights over time.
- CDC PLACES Suffolk County baseline card.
- WHOOP OAuth provider.
- Fitbit Web API provider.

### Stubs
- Garmin, Samsung Health — shown as "coming soon" with the honest reason (no web
  API / needs business approval).
