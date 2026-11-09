export type Theme = "light" | "dark";

export const ACCENTS = {
  orange: "#e8590c",
  red: "#e03131",
  pink: "#d6336c",
  purple: "#7048e8",
  blue: "#1c7ed6",
  teal: "#0c8599",
  green: "#2f9e44",
} as const;

export type Accent = keyof typeof ACCENTS;

export const DEFAULT_ACCENT: Accent = "orange";

export const STORAGE_KEYS = { theme: "mb-theme", accent: "mb-accent" } as const;

// Runs in <head> before the page paints, so there's no flash of the wrong theme.
// Keep it in sync with applyTheme/applyAccent below.
export const themeInitScript = `(function(){try{
var t=localStorage.getItem("${STORAGE_KEYS.theme}");
if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
document.documentElement.classList.toggle("dark",t==="dark");
var a=${JSON.stringify(ACCENTS)}[localStorage.getItem("${STORAGE_KEYS.accent}")]||"${ACCENTS[DEFAULT_ACCENT]}";
document.documentElement.style.setProperty("--accent",a);
}catch(e){}})();`;

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function applyAccent(accent: Accent) {
  document.documentElement.style.setProperty("--accent", ACCENTS[accent]);
}
