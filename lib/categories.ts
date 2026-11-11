// Each category gets one of the palette colors (the same 7 as the accent picker),
// used for its label on cards and its dot on the map.

import type { Category } from "./supabase";
import { Accent, ACCENTS, Theme } from "./settings";

export const CATEGORY_COLORS: Record<Category, Accent> = {
  general: "pink",
  event: "purple",
  "lost & found": "red",
  "for sale": "blue",
  free: "green",
  "help wanted": "orange",
  service: "teal",
};

function paletteName(category: string): Accent | null {
  return CATEGORY_COLORS[category as Category] ?? null;
}

// CSS color for text/backgrounds; follows light/dark automatically.
// Unknown (old) categories fall back to the user's accent color.
export function categoryColor(category: string): string {
  const name = paletteName(category);
  return name ? `var(--pal-${name})` : "var(--accent)";
}

// MapLibre can't read CSS variables, so the map gets plain hex values for the current theme:
// a "match" expression from each post's category to its color.
export function categoryColorExpression(theme: Theme, fallback: string) {
  const pairs = Object.entries(CATEGORY_COLORS).flatMap(([cat, name]) => [cat, ACCENTS[name][theme]]);
  return ["match", ["get", "category"], ...pairs, fallback];
}
