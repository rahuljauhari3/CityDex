---
name: kiro-vision-card
description: DELETED. CityDex uses no AI anywhere. The stamp-card generator has been removed; the stamp's name, category and rarity come from the place (seed data, or a user-typed name + category for a new place) and the photo is shown exactly as uploaded. Do not use this skill.
---

# DELETED — CityDex uses no AI

The AI stamp-card generator (Kiro over the Agent Client Protocol, `kiro-cli`,
the `citydex-cardsmith` agent, the deterministic mock, and the "Mystery Spot"
refusal handling) has been **removed entirely**. CityDex no longer calls any
model, SDK, or `kiro-cli` subprocess.

The stamp card is now assembled server-side from the **place** and the uploaded
photo:

- a **seeded place** supplies its stored `name`, `category` and `rarity`;
- a **new user-created place** uses the name + category the user types, with
  rarity `common`;
- the photo is stored and shown **exactly as uploaded** (resized ≤ 1280 px,
  EXIF stripped). A required "No people are the main subject of this photo"
  checkbox replaces any image analysis.

> This folder is a tombstone. Delete it from the repository:
> `rm -rf .kiro/skills/kiro-vision-card`. It is retained only because the
> configuring agent lacked a delete tool.
