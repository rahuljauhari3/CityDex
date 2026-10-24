# CityDex: 2-minute demo script

Run on a phone, or in a desktop browser's device toolbar at **375×812**.

## Before you present

1. `npm run dev` with no keys (demo mode is on by default).
2. Open **Profile → Privacy → Reset demo data**. This restores the seeded world:
   `@you` is not onboarded yet, with two murals collected and four runs on the
   Esplanade loop, plus friends maya, theo and priya with a week of history.
3. Don't allow location access in the demo browser. Without GPS, the map offers
   **Demo walk** buttons that simulate the walk at ×20 (labeled DEMO).

## The script

| Time | Beat | Do this | Say this |
|---|---|---|---|
| 0:00 | **Hook** | Show the Map. | "Your watch knows your heart rate. Strava knows your route. Nobody tells you how a place affects your body, or makes walking to it fun." |
| 0:15 | **Onboard** | Tap **Set your health goals →**. Keep steps, set **400 kcal** and **explore 3/week** → **Next** (demo watch connected; Strava connects here when keys are set) → read one consent line → tick consent → **Start exploring**. | "Goals first, then sources. Apple and Samsung have no web API, so Apple comes in as an export and Samsung is on the roadmap. Consent says exactly what we store, and leaderboards never show location." |
| 0:35 | **Quests** | You land on **Today's Quests**. Point at quest 1. | "Quests are picked for today's remaining goals. This one: *3 friends burned avg 168 kcal getting here*, and it fills today's calorie goal." |
| 0:50 | **Walk** | Tap the quest → **▶ Demo walk here**. The live panel ticks: time, distance, est. steps, pace, kcal, heart rate and zone. | "While you walk, CityDex tracks the route on your phone and reads your watch live." |
| 1:20 | **Collect** | **Arrived! Collect →** → tick *No people…* → **Collect! Snap a photo** → pick a photo. | "The photo stays exactly as you took it. The card shows what your body did to get here: 0.9 km, about 1,200 steps, avg 122 bpm, minutes in each zone, and what it added to today's goals." |
| 1:35 | **Social** | On the card: **Badge unlocked: Mural Hunter I**. Close it → **Feed**: your stamp already has 2 high fives, plus the weekly *150 Club* challenge → **Leaderboard** (Friends · This week). | "Friends see the effort, never the location." |
| 1:50 | **Insight + honesty** | **Profile**: *Your health story* → "Your avg HR at Charles River Esplanade is down 6 bpm over 12 days at the same pace" → scroll to the **Suffolk County baseline** (CDC PLACES). | "Repeat visits turn into fitness insights, put next to real county data. Wellness insights only, not medical advice. Apple and Samsung need a native wrapper, and that's our roadmap." |

## If something goes wrong

- **No Demo walk button:** the browser has a GPS fix. Use the sheet's
  **DEMO Teleport** checkbox instead. The walk is simulated from downtown.
- **The quest changed:** quests follow today's demo goal progress. Any quest
  works; the reason text changes with it.
- **Stale state from a rehearsal:** Profile → Reset demo data.
- **Server restarted:** demo data is in memory and re-seeds on start, so it's
  the same as a reset.

## What's real vs demo

- **Real:** route distance from GPS, the points/badge/quest/insight logic, the
  Apple Health `export.xml` parser, Strava OAuth (with keys), and the CDC
  PLACES numbers (2025 release).
- **Demo:** the demo watch's heart rate, SpO₂, sleep and daily totals, the 6
  friends and their history, and simulated walks. All of it is labeled DEMO in
  the UI.
