export type Theme = "light" | "dark";

// Each accent has a darker shade for light mode and a lighter one for dark mode,
// so text and buttons stay above WCAG AA contrast (4.5:1) in both themes.
// Light shades share one brightness and saturation (OKLCH lightness ~0.54) so they read as
// a family, with hues spread so every pair stays easy to tell apart (CIEDE2000 ΔE ≥ ~20).
// They're dark enough to read as text on white (orange is slightly under 4.5:1, by choice,
// so it can look orange rather than brown).
export const ACCENTS = {
  orange: { light: "#c46009", dark: "#fb923c" },
  red: { light: "#c13330", dark: "#f87171" },
  pink: { light: "#b73278", dark: "#f472b6" },
  purple: { light: "#7e4fc7", dark: "#a78bfa" },
  blue: { light: "#086fc8", dark: "#60a5fa" },
  teal: { light: "#097f7c", dark: "#2dd4bf" },
  green: { light: "#0a8708", dark: "#4ade80" },
} as const;

export type Accent = keyof typeof ACCENTS;

export const DEFAULT_ACCENT: Accent = "orange";

export const STORAGE_KEYS = { theme: "mb-theme", accent: "mb-accent", basemap: "mb-basemap" } as const;

// Runs in <head> before the page paints, so there's no flash of the wrong theme.
// Keep it in sync with applyTheme/applyAccent below.
export const themeInitScript = `(function(){try{
var d=document.documentElement,t=localStorage.getItem("${STORAGE_KEYS.theme}");
if(t!=="light"&&t!=="dark")t="dark";
d.classList.toggle("dark",t==="dark");
var A=${JSON.stringify(ACCENTS)},a=A[localStorage.getItem("${STORAGE_KEYS.accent}")]||A["${DEFAULT_ACCENT}"];
for(var k in A)d.style.setProperty("--pal-"+k,A[k][t]);
d.style.setProperty("--accent-light",a.light);d.style.setProperty("--accent-dark",a.dark);
}catch(e){}})();`;

// Theme currently applied to <html> (set before first paint by themeInitScript)
export function appliedTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  applyPalette(theme);
}

// Every palette color as a CSS variable for the current theme (--pal-orange, --pal-teal…),
// used for category colors. Set before first paint by themeInitScript, then on theme changes.
function applyPalette(theme: Theme) {
  for (const [name, shades] of Object.entries(ACCENTS)) {
    document.documentElement.style.setProperty(`--pal-${name}`, shades[theme]);
  }
}

export function applyAccent(accent: Accent) {
  const s = document.documentElement.style;
  s.setProperty("--accent-light", ACCENTS[accent].light);
  s.setProperty("--accent-dark", ACCENTS[accent].dark);
}

// Resolved value of a CSS color token for the current theme (used by the map)
export function cssToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
