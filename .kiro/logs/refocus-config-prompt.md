DIRECTION CHANGE from the human (final):
(a) The main point of CityDex is the HEALTHCARE track (H1: turning wearable data into better healthcare). Health features are the priority. The collecting game is the motivation layer on top.
(b) There is NO AI in the app. Drop AI stamp-card generation completely (no Kiro ACP, no cardsmith). At check-in the user just adds a photo and it is shown on the stamp exactly as uploaded (no pixel filter, no AI). The stamp's name, category and rarity come from the place (seed data). For a new user-created place, the user types a name and picks a category, and rarity is "common". Keep client-side resize to ≤1280 px and EXIF/location stripping (privacy rule). Replace the AI "person is the main subject" check with a required checkbox: "No people are the main subject of this photo".

Update configuration and docs only (no app code in this run):
1. Remove from .kiro/steering/*.md, PLAN.md, AGENT_PROMPT.md, README.md and .kiro/specs/citydex-core/{requirements,design,tasks}.md every mention of AI card generation, the, Kiro ACP card generation, cardsmith, AI_PROVIDER/KIRO_CARD_* env vars, lore and the mock card. Delete .kiro/agents/citydex-cardsmith.json and the .kiro/skills/kiro-vision-card folder. Update the citydex-builder resources so they don't point at deleted skills.
2. In .kiro/steering/product.md, make the healthcare focus explicit: the pitch is "How does this place affect your body?". List the health features in priority order: health snapshot per check-in (steps, HR avg/max, HR zones, active kcal, SpO2, source label), weekly health summary, goals + progress rings, goal-based Today's Quests, place insights over time (HR at the same pace trending across visits), CDC PLACES Suffolk County baseline card, Strava + Apple Health export, plus the privacy/consent/not-medical-advice rules.
3. Also apply everything in .kiro/logs/spec-health-p2-prompt.md (add REQ-16/17/18, design sections, restructure tasks into batches), with these batches:
   - **B0**: remove all AI code and switch the stamp to photo-as-uploaded + place data; fix the QA findings in .kiro/logs/qa-findings-1.md.
   - **B1**: M3 health snapshot + M4 points/badges/leaderboards.
   - **B2**: M5 goals/quests + REQ-16/17/18.
   - **B3a**: M6 friends/feed.
   - **B3b**: M7 Strava/Apple Health export (parallel worktrees).
   - **B4**: M8 demo seed + README.
4. Add a KIRO_JOURNAL.md entry about this re-scope (and why: healthcare track focus, simpler and more reliable demo, no AI dependency).
