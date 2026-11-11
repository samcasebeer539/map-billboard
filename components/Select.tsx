"use client";

import { KeyboardEvent, useEffect, useId, useRef, useState } from "react";

type Props = {
  id?: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  capitalize?: boolean; // title-case the option text (on by default, e.g. categories)
  swatch?: (option: string) => string; // optional color dot (any CSS background) before each option
  floating?: boolean; // over the map: floating button style, and a buffer that catches near-miss clicks
  ariaLabel?: string; // when there's no visible <label>
};

// Custom dropdown styled with the app's tokens (replaces the native <select>).
// Keyboard: Up/Down to move, Enter/Space to pick, Escape to close, Home/End, type to jump.
export default function Select({ id, value, options, onChange, capitalize = true, swatch, floating, ariaLabel }: Props) {
  const cap = capitalize ? "capitalize" : "";
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => Math.max(0, options.indexOf(value)));
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function openList() {
    setActive(Math.max(0, options.indexOf(value)));
    setOpen(true);
  }

  function choose(i: number) {
    onChange(options[i]);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => Math.min(options.length - 1, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(active);
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        // Type a letter to jump to the first matching option
        if (e.key.length === 1) {
          const i = options.findIndex((o) => o.toLowerCase().startsWith(e.key.toLowerCase()));
          if (i >= 0) setActive(i);
        }
    }
  }

  return (
    <div ref={rootRef} className="relative">
      {/* Over the map, an invisible 16px buffer around the open dropdown keeps near-misses
          from landing on the map and dropping a pin (same as the nav menu) */}
      {floating && open && <div className="absolute -inset-4" aria-hidden />}
      <button
        ref={buttonRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={`flex items-center justify-between text-left ${cap} ${
          floating
            ? "floating relative h-10 w-full gap-2 rounded-lg px-3 text-sm text-fg hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            : "input"
        }`}
      >
        <span className="flex items-center gap-2">
          {swatch && <Dot color={swatch(value)} />}
          {value}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div className={`absolute inset-x-0 top-full z-30 ${floating ? "-mx-4 px-4 pt-2 pb-4" : "mt-1"}`}>
          <ul id={listId} role="listbox" className="floating rounded-lg p-1">
            {options.map((o, i) => (
              <li
                key={o}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={o === value}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()} // keep focus on the button
                onClick={() => choose(i)}
                className={`flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm ${cap} ${
                  i === active ? "bg-surface-2" : ""
                } ${o === value ? "text-accent" : "text-fg"}`}
              >
                <span className="flex items-center gap-2">
                  {swatch && <Dot color={swatch(o)} />}
                  {o}
                </span>
                {o === value && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M3.5 8.5l3 3 6-7" />
                  </svg>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const Dot = ({ color }: { color: string }) => (
  <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
);
