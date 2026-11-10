"use client";

import { KeyboardEvent, useEffect, useId, useRef, useState } from "react";

type Props = {
  id?: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  capitalize?: boolean; // title-case the option text (on by default, e.g. categories)
};

// Custom dropdown styled with the app's tokens (replaces the native <select>).
// Keyboard: Up/Down to move, Enter/Space to pick, Escape to close, Home/End, type to jump.
export default function Select({ id, value, options, onChange, capitalize = true }: Props) {
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
      <button
        ref={buttonRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={`input flex items-center justify-between text-left ${cap}`}
      >
        <span>{value}</span>
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
        <ul id={listId} role="listbox" className="floating absolute inset-x-0 top-full z-30 mt-1 rounded-lg p-1">
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
              } ${o === value ? "font-medium text-accent" : "text-fg"}`}
            >
              {o}
              {o === value && (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3.5 8.5l3 3 6-7" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
