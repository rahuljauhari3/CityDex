# QA findings round 1 (independent test by the overseer, 375x812, after M2)

Tested: /map in the browser at mobile size, place sheet, /api/dex, POST /api/stamps with curl.

## Must fix
1. **Demo mode is off by default.** With no `.env.local`, `DEMO_MODE` is unset, so the "DEMO Teleport" checkbox is hidden and nobody can collect anything without physically being at a place. Treat demo mode as ON when `DEMO_MODE` is unset AND Supabase is not configured (only `DEMO_MODE=false` turns it off). Show a small "DEMO" chip in the header whenever demo mode is on.
2. **The Next.js dev indicator ("N" badge) covers the Map tab** in the bottom bar. Set `devIndicators: false` in next.config.ts. Also make sure the active tab's icon and label are always visible above the iOS home-indicator safe area (`env(safe-area-inset-bottom)`).
3. **The Collect button looks disabled** (pale orange, low contrast) and there is no clear reason shown. When the user is out of range and teleport is off: show the distance ("You are 1.2 km away") and a disabled style that still passes AA contrast. When teleport is checked, or the user is within 75 m: the button is full orange and enabled.
4. **Check-in must work end to end in demo mode.** After your changes, POST /api/stamps with a JPEG, `teleport=true` and `placeId=seed_boston_common` must return 200 with a card. Without teleport and far away it must return a clear 4xx JSON error, not an HTML page. Add a route-level test for both cases.

## Should fix
5. **Markers overlap heavily downtown** at the default zoom (about 15 pins stacked around Downtown/Back Bay). Use smaller pins at low zoom or simple clustering, and add a compact rarity legend (common → legendary colors).
6. **There is no header on the map.** M5 adds the clock, day counter and goal rings. Until then, at least show the app name and the DEMO chip.

## Verify after the fixes
- `npm run dev`, open /map at 375x812: no console errors, all 5 tabs readable, the sheet opens, teleport + collect produces a card reveal, and the stamp shows in /dex.
