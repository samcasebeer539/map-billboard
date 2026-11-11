export type Theme = "light" | "dark";

// Each accent has a darker shade for light mode and a lighter one for dark mode,
// so text and buttons stay above WCAG AA contrast (4.5:1) in both themes.
export const ACCENTS = {
  orange: { light: "#b83c0a", dark: "#fb923c" },
  red: { light: "#b91c1c", dark: "#f87171" },
  pink: { light: "#be185d", dark: "#f472b6" },
  purple: { light: "#6d28d9", dark: "#a78bfa" },
  blue: { light: "#1d4ed8", dark: "#60a5fa" },
  teal: { light: "#0f766e", dark: "#2dd4bf" },
  green: { light: "#137a3a", dark: "#4ade80" },
} as const;

export type Accent = keyof typeof ACCENTS;

export const DEFAULT_ACCENT: Accent = "orange";

export const STORAGE_KEYS = { theme: "mb-theme", accent: "mb-accent" } as const;

// Runs in <head> before the page paints, so there's no flash of the wrong theme.
// Keep it in sync with applyTheme/applyAccent below.
export const themeInitScript = `(function(){try{
var d=document.documentElement,t=localStorage.getItem("${STORAGE_KEYS.theme}");
if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
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
