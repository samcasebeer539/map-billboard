"use client";

import { Accent, ACCENTS } from "@/lib/settings";
import { useSettings } from "./SettingsProvider";

export default function SettingsForm() {
  const { theme, setTheme, accent, setAccent } = useSettings();
  const dark = theme === "dark";

  return (
    <div className="divide-y divide-gray-100 rounded-xl bg-white shadow-sm dark:divide-gray-800 dark:bg-gray-900">
      {/* Light / dark */}
      <div className="flex items-center justify-between gap-4 p-5">
        <div>
          <div className="font-medium">Dark mode</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Applies to the whole app, including the map.</div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={dark}
          aria-label="Dark mode"
          onClick={() => setTheme(dark ? "light" : "dark")}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${dark ? "bg-accent" : "bg-gray-300"}`}
        >
          <span
            className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              dark ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>

      {/* Accent color */}
      <div className="p-5">
        <div className="font-medium">Accent color</div>
        <div className="mb-3 text-sm text-gray-500 dark:text-gray-400">Used for buttons, links and map pins.</div>
        <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Accent color">
          {(Object.keys(ACCENTS) as Accent[]).map((name) => (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={accent === name}
              aria-label={name}
              title={name}
              onClick={() => setAccent(name)}
              style={{ backgroundColor: ACCENTS[name] }}
              className={`h-9 w-9 rounded-full ring-offset-2 ring-offset-white transition dark:ring-offset-gray-900 ${
                accent === name ? "ring-2 ring-gray-900 dark:ring-gray-100" : "hover:scale-110"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
