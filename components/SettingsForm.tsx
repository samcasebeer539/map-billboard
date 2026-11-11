"use client";

import { Accent, ACCENTS } from "@/lib/settings";
import { useSettings } from "./SettingsProvider";
import Switch from "./Switch";

export default function SettingsForm() {
  const { theme, setTheme, accent, setAccent } = useSettings();
  const dark = theme === "dark";

  return (
    <div className="card">
      {/* Light / dark */}
      <div className="flex items-center justify-between gap-4 p-4">
        <div>
          <div className="text-sm">Dark mode</div>
        </div>
        <Switch checked={dark} onChange={(on) => setTheme(on ? "dark" : "light")} label="Dark mode" />
      </div>

      {/* Accent color */}
      <div className="p-4">
        <div className="text-sm">Accent color</div>
        <div className="mt-3 flex flex-wrap gap-3" role="radiogroup" aria-label="Accent color">
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
