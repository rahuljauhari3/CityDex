---
inclusion: always
---

# CityDex — Product

CityDex is a mobile-first web app (PWA) that turns walking and running around a
city into a collecting game. Users move around Boston, find interesting
real-world spots (murals, statues, cafés, weird doors), photograph them, and AI
turns each photo into a collectible "stamp" card with a name, rarity, and short
funny lore. Wearable health data (steps, heart rate and zones, calories, SpO₂)
is attached to every check-in and powers points, badges, leaderboards, and
goal-based place recommendations.

## The core selling point

"How does this place affect your body?" Wearables track the body over time;
Strava tracks where you went. CityDex connects the two: every collected place
stores a snapshot of what your body did to get there and while there. This
drives:

1. Goal-driven place recommendations ("your friends burned avg 310 kcal getting
   here").
2. A collection game that makes healthy movement fun (stamps, rarity, tags,
   leaderboards).
3. Personal insight over time ("HR on this loop down 6 bpm over 2 weeks").

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
4. Collect: arrive at a place, snap a photo, card flips with name · rarity ·
   distance · steps · avg HR · kcal · points.
5. Social: badge unlock, friends leaderboard, a friend high-fives.
6. Insight + honesty: place-insight card, CDC PLACES county baseline, and the
   honest "not medical advice; Apple/Samsung need a native wrapper" caveat.

## Feature priorities

### P0 (demo-critical, must work in demo mode)
- Map with places and live position.
- Check-in with geofence + photo capture.
- AI stamp card from the photo.
- Collection book ("Dex").
- Demo health provider (seeded realistic data, labeled DEMO).
- Points + global leaderboard.

### P1
- Strava OAuth provider.
- Apple Health export (`export.xml`) upload + parser.
- Goals onboarding + progress rings.
- Friends + friends leaderboard + feed with kudos.
- Tags / badges.
- Goal-based recommendations.

### P2
- WHOOP OAuth provider.
- Fitbit Web API provider.
- Place insights over time.
- County baseline card (CDC PLACES, Suffolk County).

### Stubs
- Garmin, Samsung Health — shown as "coming soon" with the honest reason (no web
  API / needs business approval).
