// Each category gets one of the palette colors (the same 7 as the accent picker),
// used for its label on cards and its dot on the map.

import type { Category } from "./supabase";
import { Accent, ACCENTS, Theme } from "./settings";

// In the same order as the menus list the categories and Settings lists the colors,
// so the dropdowns run through the palette in order
const CATEGORY_COLORS: Record<Category, Accent> = {
  general: "orange",
  event: "red",
  "lost & found": "pink",
  "for sale": "purple",
  free: "blue",
  "help wanted": "teal",
  service: "green",
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

// Map filter: the categories toggled on in the filter menu. None toggled on shows everything.
export const matchesFilter = (category: string, filter: ReadonlySet<string>) => filter.size === 0 || filter.has(category);

// MapLibre can't read CSS variables, so the map gets plain hex values for the current theme:
// a "match" expression from each post's category to its color.
export function categoryColorExpression(theme: Theme, fallback: string) {
  const pairs = Object.entries(CATEGORY_COLORS).flatMap(([cat, name]) => [cat, ACCENTS[name][theme]]);
  return ["match", ["get", "category"], ...pairs, fallback];
}
