"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import { Accent, ACCENTS, applyAccent, applyTheme, appliedTheme, DEFAULT_ACCENT, STORAGE_KEYS, Theme } from "@/lib/settings";

type Settings = {
  theme: Theme;
  accent: Accent;
  ready: boolean; // false until stored settings have been read on the client
  setTheme: (t: Theme) => void;
  setAccent: (a: Accent) => void;
};

const SettingsContext = createContext<Settings | null>(null);
// The <head> script applies the stored theme and accent before first paint; these read them
// back. Changes made through setTheme/setAccent notify subscribers so the UI follows.
const listeners = new Set<() => void>();
function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}
const notify = () => listeners.forEach((l) => l());

function storedAccent(): Accent {
  try {
    const a = localStorage.getItem(STORAGE_KEYS.accent);
    if (a && a in ACCENTS) return a as Accent;
  } catch {}
  return DEFAULT_ACCENT;
}

const noSubscription = () => () => {};

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  // The server can't see the browser's settings, so it renders the defaults and the client
  // switches to the real values right after hydration (that's what `ready` reports)
  const theme = useSyncExternalStore<Theme>(subscribe, appliedTheme, () => "light");
  const accent = useSyncExternalStore<Accent>(subscribe, storedAccent, () => DEFAULT_ACCENT);
  const ready = useSyncExternalStore(noSubscription, () => true, () => false);

  function setTheme(t: Theme) {
    applyTheme(t);
    try {
      localStorage.setItem(STORAGE_KEYS.theme, t);
    } catch {}
    notify();
  }

  function setAccent(a: Accent) {
    applyAccent(a);
    try {
      localStorage.setItem(STORAGE_KEYS.accent, a);
    } catch {}
    notify();
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
