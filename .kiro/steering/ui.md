---
inclusion: always
---

# CityDex — UI / Visual Direction (PLAN.md §9)

Cozy pixel-art farming-sim aesthetic × Strava-style activity stats. **Original
artwork only.** Do not copy any game's sprites, fonts, or logos, or use Strava
branding.

## Fonts (Google Fonts)
- `Pixelify Sans` — headings and numbers.
- `VT323` or `Silkscreen` — small labels.
- A readable system font for long body text.

## Palette (define as Tailwind tokens)
- Parchment `#F4E4C1`, Wood dark `#5B3A29`, Wood light `#A0703C`,
  Grass `#6DAA2C`, Sky `#7EC8E3`, Berry `#C0392B`.
- Activity accent (Strava-like energy): `#FC5200`-ish orange for stats and CTA
  buttons.
- Rarity colors: common gray `#9E9E9E`, uncommon green `#4CAF50`,
  rare blue `#2196F3`, epic purple `#9C27B0`, legendary gold `#FFC107`.

## Components
- Wooden-panel cards: chunky 2–4 px borders, stepped pixel `box-shadow`,
  `image-rendering: pixelated` on sprites.
- **Stamp card:** parchment card, rarity-colored frame with a glow animation,
  photo with a subtle pixelation/dither filter, name in a pixel font, lore in
  italics, stats row with orange numbers.
- **Dex / Collection book:** inventory grid (4 columns on mobile), locked slots
  as dark silhouettes with "???".
- **Home header:** in-game clock + weather chip, day counter ("Day 12 of your
  journey"), goal progress rings as pixel hearts/energy bars.
- **Feed:** Strava-style activity cards (avatar, route mini-map, distance · time
  · kcal · avg HR, stamp thumbnail, high-five button).
- **Leaderboard:** wooden notice-board style with pinned paper rows.
- **Bottom tab bar:** Map · Quests · Dex · Feed · Profile.

## Feedback
- Optional little "pop" on card reveal (muted by default).
- `navigator.vibrate` on collect.

## Mobile-first & accessibility
- Design and test at **375×812**.
- Minimum **16 px** body text; contrast **AA**.
- `prefers-reduced-motion` disables the glow and flip animations.
- Keep the © OpenStreetMap attribution visible on the map.
- After each UI milestone: run the dev server, check the console for errors,
  and screenshot the main screens at mobile size before moving on.
