"use client";

import { ButtonHTMLAttributes, Ref } from "react";

// Square 40px button that floats over the map or a photo (menu, filter, close).
// Hover and "active" fill the whole button, like the items in the nav menu.
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
      className={`floating relative flex size-10 items-center justify-center rounded-lg hover:bg-surface-2! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        active ? "bg-surface-2! text-accent" : "text-fg"
      } ${className}`}
    >
      {children}
    </button>
  );
}
