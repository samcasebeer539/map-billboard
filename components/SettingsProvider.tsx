"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Accent, ACCENTS, applyAccent, applyTheme, DEFAULT_ACCENT, STORAGE_KEYS, Theme } from "@/lib/settings";

type Settings = {
  theme: Theme;
  accent: Accent;
  ready: boolean; // false until stored settings have been read on the client
  setTheme: (t: Theme) => void;
  setAccent: (a: Accent) => void;
};

const SettingsContext = createContext<Settings | null>(null);

function readStored(): { theme: Theme; accent: Accent } {
  // The <head> script already applied these; read them back from the DOM/storage.
  const theme: Theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
  let accent: Accent = DEFAULT_ACCENT;
  try {
    const a = localStorage.getItem(STORAGE_KEYS.accent);
    if (a && a in ACCENTS) accent = a as Accent;
  } catch {}
  return { theme, accent };
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [accent, setAccentState] = useState<Accent>(DEFAULT_ACCENT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = readStored();
    setThemeState(s.theme);
    setAccentState(s.accent);
    setReady(true);
  }, []);

  function setTheme(t: Theme) {
    setThemeState(t);
    applyTheme(t);
    try {
      localStorage.setItem(STORAGE_KEYS.theme, t);
    } catch {}
  }

  function setAccent(a: Accent) {
    setAccentState(a);
    applyAccent(a);
    try {
      localStorage.setItem(STORAGE_KEYS.accent, a);
    } catch {}
  }

  return (
    <SettingsContext.Provider value={{ theme, accent, ready, setTheme, setAccent }}>{children}</SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside <SettingsProvider>");
  return ctx;
}
