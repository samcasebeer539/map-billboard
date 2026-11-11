"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useRef, useState } from "react";

// 20×20 line icons, drawn in the current text color
const icon = (paths: ReactNode) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {paths}
  </svg>
);

const LINKS = [
  {
    href: "/",
    label: "Map",
    // folded map
    icon: icon(<path d="M7.5 3.5 2.5 5.5v11l5-2 5 2 5-2v-11l-5 2-5-2zM7.5 3.5v11M12.5 5.5v11" />),
  },
  {
    href: "/profile",
    label: "Profile",
    // person
    icon: icon(
      <>
        <circle cx="10" cy="7" r="3.25" />
        <path d="M3.75 17c.9-3 3.3-4.5 6.25-4.5s5.35 1.5 6.25 4.5" />
      </>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    // sliders
    icon: icon(
      <>
        <path d="M3 6h7M14 6h3M3 14h3M10 14h7" />
        <circle cx="12" cy="6" r="2" />
        <circle cx="8" cy="14" r="2" />
      </>
    ),
  },
];

export default function NavMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on Escape or on a press anywhere outside the menu. The press still goes through
  // to whatever was under it (e.g. the map), so you don't need an extra click to close first.
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
      {/* While open, an invisible 16px buffer around the button and the menu (below) swallows
          near-misses, so they don't land on the map and drop a pin */}
      {open && <div className="absolute -inset-4" aria-hidden />}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Menu"
        aria-expanded={open}
        className="floating relative flex size-10 items-center justify-center rounded-lg text-fg hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {open ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 5h14M3 10h14M3 15h14" />}
        </svg>
      </button>

      {open && (
        // p-4 is the transparent buffer; top-8 + p-4 keeps the menu 48px below the button's top
        <div className="absolute -left-4 top-8 p-4">
          <nav className="floating flex flex-col gap-1 rounded-lg p-1">
            {LINKS.map((l) => {
              const current = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  aria-label={l.label}
                  title={l.label}
                  aria-current={current ? "page" : undefined}
                  className={`flex size-8 items-center justify-center rounded-md hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent ${
                    current ? "bg-surface-2 text-accent" : "text-fg"
                  }`}
                >
                  {l.icon}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
}