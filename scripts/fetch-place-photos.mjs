#!/usr/bin/env node
/**
 * Looks up a real, freely licensed photo for each seeded place: the lead image
 * of its English Wikipedia article, if that image lives on Wikimedia Commons
 * under CC BY / CC BY-SA / CC0 / public domain. Non-free images (logos, book
 * covers) aren't on Commons and are skipped.
 *
 * Writes data/seed/place-photos.json with the thumbnail URL, author, license
 * and source page so the app can credit each photo. Only metadata is fetched;
 * images load from upload.wikimedia.org at runtime.
 *
 *   node scripts/fetch-place-photos.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";

const UA = "CityDex/0.1 (Hackachusetts 2026 student hackathon demo; metadata lookup only)";
const WIDTH = 640;

/** Seed place id → English Wikipedia article title. */
const TITLES = {
  seed_boston_common: "Boston Common",
  seed_public_garden: "Public Garden (Boston)",
  seed_make_way_ducklings: "Make Way for Ducklings",
  seed_swan_boats: "Swan Boats",
  seed_shaw_memorial: "Robert Gould Shaw Memorial",
  seed_mass_state_house: "Massachusetts State House",
  seed_acorn_street: "Acorn Street",
  seed_faneuil_hall: "Faneuil Hall",
  seed_quincy_market: "Quincy Market",
  seed_old_north_church: "Old North Church",
  seed_paul_revere_statue: "Paul Revere Mall",
  seed_mikes_pastry: "Mike's Pastry",
  seed_caffe_vittoria: "Caffè Vittoria",
  seed_td_garden: "TD Garden",
  seed_zakim_bridge: "Leonard P. Zakim Bunker Hill Memorial Bridge",
  seed_bunker_hill_monument: "Bunker Hill Monument",
  seed_uss_constitution: "USS Constitution",
  seed_rose_kennedy_greenway: "Rose Kennedy Greenway",
  seed_greenway_carousel: "Greenway Carousel",
  seed_boston_harborwalk: "HarborWalk",
  seed_ica_boston: "Institute of Contemporary Art, Boston",
  seed_trinity_church: "Trinity Church (Boston)",
  seed_boston_public_library: "McKim Building",
  seed_copley_square: "Copley Square",
  seed_newbury_street: "Newbury Street",
  seed_pru_skywalk: "Prudential Tower",
  seed_esplanade_hatch_shell: "Hatch Shell",
  seed_charles_esplanade: "Charles River Esplanade",
  seed_fenway_park: "Fenway Park",
  seed_citgo_sign: "Citgo sign",
  seed_fenway_victory_gardens: "Fenway Victory Gardens",
  seed_mfa_boston: "Museum of Fine Arts, Boston",
  seed_isabella_gardner: "Isabella Stewart Gardner Museum",
  seed_arnold_arboretum: "Arnold Arboretum",
  seed_castle_island: "Castle Island (Massachusetts)",
  seed_sam_adams_statue: "Samuel Adams (Whitney)",
  seed_tortoise_hare_statues: "Tortoise and Hare (sculpture)",
  seed_harvard_yard: "Harvard Yard",
  seed_john_harvard_statue: "John Harvard (statue)",
  seed_mit_great_dome: "Great Dome",
  seed_mit_stata_center: "Ray and Maria Stata Center",
  seed_kendall_square: "Kendall Square",
  seed_harvard_bridge: "Harvard Bridge",
  seed_dewey_square_mural: "Dewey Square",
  seed_graffiti_alley: "Graffiti Alley (Cambridge, Massachusetts)",
  seed_bc_bapst_library: "Bapst Library",
  seed_bc_st_ignatius: "St. Ignatius Church (Chestnut Hill, Massachusetts)",
  seed_bc_alumni_stadium: "Alumni Stadium",
  seed_chestnut_hill_reservoir: "Chestnut Hill Reservoir",
  seed_heartbreak_hill: "Heartbreak Hill",
  seed_walden_pond: "Walden Pond",
  seed_old_north_bridge: "Old North Bridge",
  seed_great_blue_hill: "Great Blue Hill",
  seed_salem_witch_house: "Jonathan Corwin House",
  seed_gloucester_fisherman: "Gloucester Fisherman's Memorial",
  seed_lowell_boott_mills: "Boott Cotton Mills",
  seed_plymouth_rock: "Plymouth Rock",
  seed_race_point_beach: "Race Point Beach",
  seed_mass_moca: "Massachusetts Museum of Contemporary Art",
  seed_mount_greylock: "Mount Greylock",
  seed_basketball_hall_of_fame: "Naismith Memorial Basketball Hall of Fame",
  seed_worcester_elm_park: "Elm Park (Worcester, Massachusetts)",
};

/** Lead images reviewed by hand and rejected as the wrong subject. */
const EXCLUDE = {
  seed_sam_adams_statue: "photo is the Samuel Adams statue in the US Capitol, not Boston's",
  seed_fenway_park: "crowd/pregame ceremony, not the ballpark",
  seed_esplanade_hatch_shell: "orchestra and audience, not the shell",
  seed_kendall_square: "1903 atlas map, not a photo",
  seed_dewey_square_mural: "shows surrounding buildings, not the mural",
};

const FREE = /^(CC0|CC BY(-SA)? [\d.]+|CC BY(-SA)?|Public domain|PD.*)/i;

async function api(host, params) {
  const url = `https://${host}/w/api.php?${new URLSearchParams({ format: "json", formatversion: "2", origin: "*", ...params })}`;
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`${host} ${res.status}`);
  return res.json();
}

function strip(html) {
  return String(html ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const chunk = (xs, n) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** title → lead image file name, in batches of 40 titles per request. */
async function leadImages(titles) {
  const map = new Map();
  for (const batch of chunk(titles, 40)) {
    const q = (await api("en.wikipedia.org", {
      action: "query", titles: batch.join("|"), prop: "pageimages", piprop: "name", pilimit: "50", redirects: "1",
    })).query ?? {};
    // Follow normalization + redirects back to the title we asked for.
    const back = new Map();
    for (const n of q.normalized ?? []) back.set(n.to, n.from);
    for (const r of q.redirects ?? []) back.set(r.to, back.get(r.from) ?? r.from);
    for (const page of q.pages ?? []) {
      const asked = back.get(page.title) ?? page.title;
      map.set(asked, page.pageimage ? { file: page.pageimage, title: page.title } : null);
    }
    await sleep(1000);
  }
  return map;
}

/** file name → Commons imageinfo (missing = not on Commons, i.e. likely non-free). */
async function commonsInfo(files) {
  const map = new Map();
  for (const batch of chunk(files, 40)) {
    const q = (await api("commons.wikimedia.org", {
      action: "query", titles: batch.map((f) => `File:${f}`).join("|"), prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: String(WIDTH),
    })).query ?? {};
    const back = new Map((q.normalized ?? []).map((n) => [n.to, n.from]));
    for (const page of q.pages ?? []) {
      const asked = (back.get(page.title) ?? page.title).replace(/^File:/, "");
      map.set(asked.replace(/ /g, "_"), page.imageinfo?.[0] ?? null);
      map.set(asked.replace(/_/g, " "), page.imageinfo?.[0] ?? null);
    }
    await sleep(1000);
  }
  return map;
}

const seed = JSON.parse(readFileSync("data/seed/boston-places.json", "utf8"));
const out = {
  _about:
    "Real photos for seeded places: lead images of each place's English Wikipedia article, hosted on Wikimedia Commons under free licenses. Generated by scripts/fetch-place-photos.mjs. Credit the author and license wherever a photo is shown.",
  photos: {},
};
const skipped = [];
const wanted = seed.places.filter((p) => TITLES[p.id] && !EXCLUDE[p.id]);
for (const p of seed.places) {
  if (!TITLES[p.id]) skipped.push(`${p.id}: no article mapped`);
  else if (EXCLUDE[p.id]) skipped.push(`${p.id}: excluded (${EXCLUDE[p.id]})`);
}
const leads = await leadImages(wanted.map((p) => TITLES[p.id]));
const files = [...new Set([...leads.values()].filter(Boolean).map((l) => l.file))];
const infos = await commonsInfo(files);
for (const p of wanted) {
  const title = TITLES[p.id];
  const lead = leads.get(title);
  if (!lead) {
    skipped.push(`${p.id} (${title}): no lead image`);
    continue;
  }
  const info = infos.get(lead.file) ?? infos.get(lead.file.replace(/_/g, " "));
  if (!info) {
    skipped.push(`${p.id} (${title}): not on Commons (likely non-free)`);
    continue;
  }
  const meta = info.extmetadata ?? {};
  const license = strip(meta.LicenseShortName?.value);
  if (!FREE.test(license)) {
    skipped.push(`${p.id} (${title}): license ${license || "unknown"}`);
    continue;
  }
  if (/logo|map|seal|flag|diagram/i.test(lead.file)) {
    skipped.push(`${p.id} (${title}): logo/map image`);
    continue;
  }
  out.photos[p.id] = {
    url: info.thumburl ?? info.url,
    file: lead.file,
    author: strip(meta.Artist?.value) || "Unknown author",
    license,
    licenseUrl: meta.LicenseUrl?.value ?? null,
    source: info.descriptionurl,
    article: `https://en.wikipedia.org/wiki/${encodeURIComponent(lead.title.replace(/ /g, "_"))}`,
  };
}
writeFileSync("data/seed/place-photos.json", `${JSON.stringify(out, null, 2)}\n`);
console.log(`photos: ${Object.keys(out.photos).length}, skipped: ${skipped.length}`);
for (const s of skipped) console.log(`  skip ${s}`);
