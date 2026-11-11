"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORIES } from "@/lib/supabase";
import { categoryColor } from "@/lib/categories";

// Filter button for the map, beside the menu button. Each category toggles on and off;
// with any on, the map shows only those and the button turns the accent color.
export default function CategoryFilter({
  selected,
  onToggle,
}: {
  selected: ReadonlySet<string>;
  onToggle: (category: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = selected.size > 0;

  // Close on Escape or a press outside (which still goes through to the map), like the nav menu
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      {/* While open, an invisible buffer around the button catches near-misses (the left
          side only reaches the menu button's edge, so it doesn't cover that button) */}
      {open && <div className="absolute -top-4 -right-4 -bottom-4 -left-2" aria-hidden />}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={active ? `Filter categories (${selected.size} on)` : "Filter categories"}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Filter categories"
        className={`floating relative flex size-10 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          active ? "bg-accent! text-on-accent hover:opacity-90" : "text-fg hover:bg-surface-2"
        }`}
      >
        {/* funnel */}
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 4.5h14l-5.5 6.5v4.5l-3 1.5v-6z" />
        </svg>
      </button>

      {open && (
        // p-4 is a transparent buffer; top-8 + p-4 puts the list 48px below the button's top
        <div className="absolute -left-4 top-8 p-4">
          <ul role="menu" aria-label="Categories" className="floating w-44 rounded-lg p-1">
            {CATEGORIES.map((c) => {
              const on = selected.has(c);
              return (
                <li key={c} role="none">
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={on}
                    onClick={() => onToggle(c)}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm capitalize hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
                      on ? "text-accent" : "text-fg"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: categoryColor(c) }} />
                      {c}
                    </span>
                    {on && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M3.5 8.5l3 3 6-7" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
