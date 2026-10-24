import type { Rarity } from "@/lib/db/types";

/**
 * Hex values for Leaflet `divIcon` markup. The icon HTML is a raw string, so we
 * can't use Tailwind JIT classes there — use these hex values inline.
 * Mirrors the rarity palette in ui.md / globals.css.
 */
export const RARITY_HEX: Record<Rarity, string> = {
  common: "#9e9e9e",
  uncommon: "#4caf50",
  rare: "#2196f3",
  epic: "#9c27b0",
  legendary: "#ffc107",
};

export function rarityHex(rarity: Rarity): string {
  return RARITY_HEX[rarity] ?? RARITY_HEX.common;
}

/**
 * Readable-on-parchment label text per rarity. Legendary gold is darkened so
 * the rarity label still meets AA contrast on the parchment background.
 */
export const RARITY_LABEL_HEX: Record<Rarity, string> = {
  common: "#6b6b6b",
  uncommon: "#2f7d32",
  rare: "#1565c0",
  epic: "#7b1fa2",
  legendary: "#8a6300",
};
