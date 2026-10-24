The human asked to include two health features that were P2, and to speed up delivery. Update the spec only (no app code):

1. In .kiro/specs/citydex-core/requirements.md add:
   - REQ-16 Place insights over time: for a place a user has visited at least twice, compare heart rate at a similar pace across visits (pace within ±10%). Show cards like "Your avg HR on the Esplanade loop is down 6 bpm over 2 weeks at the same pace". It also shows resting/recovery trends when WHOOP or Apple data exist. Wellness wording only, no diagnosis. Insights need at least 2 data points and show the sample size ("based on 4 visits"). Demo data is labeled DEMO.
   - REQ-17 County health baseline card: show CDC PLACES (Suffolk County, MA) baseline indicators relevant to activity (e.g. physical inactivity %, obesity %, short sleep %, fair/poor health %). Ship them as a static bundled JSON in data/cdc-places-suffolk.json with the source URL, release year and a "data year" label. Show one card on Profile: "In Suffolk County, X% of adults report no leisure-time physical activity. This week you logged N active minutes." Cite CDC PLACES. Not medical advice.
   - REQ-18 Weekly health summary on Profile: steps, active kcal, zone-2+ minutes, avg SpO2 when available, the source of each value (DEMO / Strava / Apple / est.), and progress against goals.
2. In design.md add sections for the insight algorithm (a pure function `computePlaceInsights(stamps, placeId)` that does pace bucketing and linear trend in bpm per week), the CDC baseline data file format, and the weekly summary aggregation.
3. Restructure tasks.md for speed. Keep M0–M2b as they are. Merge the remaining work into these batches:
   - **B1 = QA fixes + M3 + M4**: QA findings (.kiro/logs/qa-findings-1.md), health snapshot, points, badges, leaderboards.
   - **B2 = M5 + REQ-16/17/18**: goals, progress rings, Today's Quests, place insights, CDC card, weekly summary.
   - **B3a = M6** (friends, feed, kudos) and **B3b = M7** (Strava, Apple Health export, WHOOP stub). These can run in parallel in separate git worktrees: list the files each one owns so they don't overlap, and say which shared files (types.ts, store.ts, memory.ts) need small additive edits only.
   - **B4 = M8**: seed 6 demo users with a week of history (including repeat visits so place insights show up), the demo script, README.
   Each batch ends with lint, tsc, test, build and a commit.
4. Add a KIRO_JOURNAL.md entry about the re-planning for speed (batches + parallel worktrees).
