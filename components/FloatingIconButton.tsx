"use client";

import { ButtonHTMLAttributes, Ref } from "react";

// Square 40px button that floats over the map or a photo (menu, filter, close).
// The icon is muted and goes to full color on hover; "active" (e.g. a filter is on) is the accent.
export default function FloatingIconButton({
  active,
  className = "",
  children,
  ref,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; ref?: Ref<HTMLButtonElement> }) {
  return (
    <button
      ref={ref}
      type="button"
      {...props}
      className={`floating relative flex size-10 items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        active ? "text-accent" : "text-muted hover:text-fg"
      } ${className}`}
    >
      {children}
    </button>
  );
}
