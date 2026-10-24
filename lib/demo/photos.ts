/**
 * Demo stamp photos. Seeded demo stamps get an original pixel-style postcard
 * illustration (SVG, generated here: no third-party images) so the Dex and
 * feed aren't empty. Places with a real photo in /public/demo use it instead.
 */

import type { PhotoCredit, Place, PlaceCategory } from "@/lib/db/types";
import { seededRandom } from "@/lib/health/demo";
import placePhotos from "@/data/seed/place-photos.json";

/** Real photos taken on site by the team, served from /public/demo. */
export const REAL_DEMO_PHOTOS: Record<string, string> = {
  seed_bc_gasson_hall: "/demo/gasson-hall.jpg",
  seed_boston_common: "/demo/boston-common.jpg",
};

export interface PlacePhoto {
  url: string;
  credit: PhotoCredit;
  article?: string;
}

const COMMONS = (placePhotos as { photos: Record<string, { url: string; author: string; license: string; licenseUrl: string | null; source: string; article: string }> }).photos;

/** A real, freely licensed photo of the place (team photo or Wikimedia Commons), if we have one. */
export function placePhoto(placeId: string): PlacePhoto | null {
  const team = REAL_DEMO_PHOTOS[placeId];
  if (team) {
    return { url: team, credit: { author: "CityDex team", license: "Provided by the team", licenseUrl: null, source: team } };
  }
  const c = COMMONS[placeId];
  if (!c) return null;
  return { url: c.url, credit: { author: c.author, license: c.license, licenseUrl: c.licenseUrl, source: c.source }, article: c.article };
}

/** Every Wikimedia-sourced photo, for the credits page. */
export function allPlacePhotos(): (PlacePhoto & { placeId: string })[] {
  return Object.keys(COMMONS)
    .filter((id) => !REAL_DEMO_PHOTOS[id])
    .map((id) => ({ placeId: id, ...placePhoto(id)! }));
}

const SKIES = [
  ["#7ec8e3", "#cdeefa"],
  ["#5aa9e6", "#bfe3f5"],
  ["#f6a96b", "#fde3c3"],
  ["#8e7cc3", "#f3c6d8"],
];

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function scene(category: PlaceCategory, r: () => number): string {
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const stone = pick(["#c9b79c", "#b9a58a", "#d8c7a8", "#a88f73"]);
  const brick = pick(["#a0503c", "#8f3f2e", "#b5654a"]);
  switch (category) {
    case "building": {
      const w = 180 + Math.floor(r() * 60);
      const x = 200 - w / 2;
      let s = `<rect x="${x}" y="110" width="${w}" height="120" fill="${stone}" stroke="#5b3a29" stroke-width="4"/>`;
      s += `<rect x="180" y="60" width="40" height="60" fill="${stone}" stroke="#5b3a29" stroke-width="4"/><path d="M176 60 L200 30 L224 60 Z" fill="#6daa2c" stroke="#5b3a29" stroke-width="4"/>`;
      for (let i = 0; i < Math.floor(w / 30); i++) {
        for (let j = 0; j < 3; j++) s += `<rect x="${x + 12 + i * 30}" y="${124 + j * 32}" width="14" height="18" fill="#5b3a29" opacity="0.75"/>`;
      }
      return s + `<rect x="188" y="196" width="24" height="34" fill="#c0392b" stroke="#5b3a29" stroke-width="3"/>`;
    }
    case "statue":
      return `<rect x="160" y="170" width="80" height="60" fill="${stone}" stroke="#5b3a29" stroke-width="4"/><rect x="186" y="110" width="28" height="60" fill="#4f7d6b" stroke="#2f4a40" stroke-width="3"/><rect x="190" y="90" width="20" height="20" fill="#4f7d6b" stroke="#2f4a40" stroke-width="3"/><rect x="214" y="118" width="22" height="8" fill="#4f7d6b"/>`;
    case "park":
    case "nature": {
      let s = "";
      for (let i = 0; i < 5; i++) {
        const x = 30 + i * 80 + r() * 20;
        const h = 60 + r() * 40;
        s += `<rect x="${x + 14}" y="${230 - 30}" width="10" height="30" fill="#5b3a29"/><rect x="${x}" y="${230 - 30 - h}" width="38" height="${h}" fill="${pick(["#3f8a2a", "#6daa2c", "#2e6b1f", "#c06b2c"])}" stroke="#2e4a1f" stroke-width="3"/>`;
      }
      return s + `<rect x="0" y="222" width="400" height="8" fill="#a0703c"/>`;
    }
    case "water": {
      let s = `<rect x="0" y="160" width="400" height="70" fill="#2f7fbf"/>`;
      for (let i = 0; i < 6; i++) s += `<rect x="${20 + i * 64 + r() * 10}" y="${176 + (i % 2) * 18}" width="30" height="5" fill="#cdeefa"/>`;
      return s + `<rect x="150" y="140" width="90" height="20" fill="#f4e4c1" stroke="#5b3a29" stroke-width="3"/><rect x="190" y="96" width="6" height="44" fill="#5b3a29"/><path d="M196 100 L232 136 L196 136 Z" fill="#fff" stroke="#5b3a29" stroke-width="3"/>`;
    }
    case "mural": {
      let s = `<rect x="30" y="70" width="340" height="160" fill="${brick}" stroke="#5b3a29" stroke-width="4"/>`;
      const colors = ["#c0392b", "#f0b429", "#2196f3", "#6daa2c", "#9c27b0", "#fc5200"];
      for (let i = 0; i < 9; i++) s += `<rect x="${44 + r() * 280}" y="${82 + r() * 110}" width="${30 + r() * 50}" height="${20 + r() * 30}" fill="${pick(colors)}"/>`;
      return s + `<circle cx="${120 + r() * 160}" cy="140" r="26" fill="#f4e4c1" stroke="#5b3a29" stroke-width="4"/>`;
    }
    case "cafe":
    case "shop":
      return `<rect x="90" y="100" width="220" height="130" fill="${brick}" stroke="#5b3a29" stroke-width="4"/><rect x="84" y="96" width="232" height="26" fill="#f4e4c1"/>${[0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="${84 + i * 33}" y="96" width="17" height="26" fill="#c0392b"/>`).join("")}<rect x="110" y="140" width="80" height="60" fill="#cdeefa" stroke="#5b3a29" stroke-width="4"/><rect x="220" y="150" width="50" height="80" fill="#5b3a29"/>`;
    case "transit":
      return `<rect x="60" y="150" width="280" height="60" fill="#c0392b" stroke="#5b3a29" stroke-width="4"/>${[0, 1, 2, 3, 4].map((i) => `<rect x="${78 + i * 52}" y="162" width="34" height="22" fill="#cdeefa"/>`).join("")}<rect x="0" y="214" width="400" height="6" fill="#5b3a29"/>`;
    default:
      return `<path d="M0 230 L140 120 L260 170 L400 90 L400 230 Z" fill="#6daa2c" stroke="#2e4a1f" stroke-width="4"/><path d="M200 70 l8 18 l20 2 l-15 13 l5 20 l-18 -10 l-18 10 l5 -20 l-15 -13 l20 -2 Z" fill="#ffc107" stroke="#5b3a29" stroke-width="3"/>`;
  }
}

/** An original pixel-style postcard for a place, as an SVG data URI. */
export function demoIllustration(place: Pick<Place, "id" | "name" | "category">): string {
  const r = seededRandom(`photo:${place.id}`);
  const [top, bottom] = SKIES[Math.floor(r() * SKIES.length)];
  const name = esc(place.name.length > 30 ? `${place.name.slice(0, 29)}…` : place.name);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" shape-rendering="crispEdges">` +
    `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>` +
    `<rect width="400" height="300" fill="url(#s)"/>` +
    `<rect x="${300 + r() * 60}" y="${24 + r() * 20}" width="28" height="28" fill="#ffe08a"/>` +
    `<rect x="0" y="230" width="400" height="70" fill="#6daa2c"/>` +
    scene(place.category, r) +
    `<rect x="0" y="258" width="400" height="42" fill="#f4e4c1" stroke="#5b3a29" stroke-width="4"/>` +
    `<text x="200" y="285" font-family="monospace" font-size="18" font-weight="bold" text-anchor="middle" fill="#5b3a29">${name}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Photo for a seeded demo stamp: a real photo of the place if we have one, else an illustration. */
export function demoPhotoFor(place: Pick<Place, "id" | "name" | "category">): { url: string; credit: PhotoCredit | null } {
  const real = placePhoto(place.id);
  return real ? { url: real.url, credit: real.credit } : { url: demoIllustration(place), credit: null };
}
