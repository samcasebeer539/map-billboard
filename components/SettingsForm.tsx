"use client";

import { Accent, ACCENTS } from "@/lib/settings";
import { useSettings } from "./SettingsProvider";

export default function SettingsForm() {
  const { theme, setTheme, accent, setAccent } = useSettings();
  const dark = theme === "dark";

  return (
    <div className="card divide-y divide-line">
      {/* Light / dark */}
      <div className="flex items-center justify-between gap-4 p-4">
        <div>
          <div className="text-sm font-medium">Dark mode</div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={dark}
          aria-label="Dark mode"
          onClick={() => setTheme(dark ? "light" : "dark")}
          className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
            dark ? "border-accent bg-accent" : "border-line bg-surface-2"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 size-4.5 rounded-full shadow transition-transform ${
              dark ? "translate-x-5 bg-on-accent" : "bg-muted"
            }`}
          />
        </button>
      </div>

      {/* Accent color */}
      <div className="p-4">
        <div className="text-sm font-medium">Accent color</div>
        <div className="mt-4 flex flex-wrap gap-3" role="radiogroup" aria-label="Accent color">
          {(Object.keys(ACCENTS) as Accent[]).map((name) => (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={accent === name}
              aria-label={name}
              title={name}
              onClick={() => setAccent(name)}
              style={{ backgroundColor: ACCENTS[name][theme] }}
              className={`size-8 rounded-full ring-offset-2 ring-offset-surface transition-transform focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${
                accent === name ? "ring-2 ring-fg" : "hover:scale-110"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
