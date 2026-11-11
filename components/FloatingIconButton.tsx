"use client";

import { ButtonHTMLAttributes, Ref } from "react";

// Square 40px button that floats over the map or a photo (menu, filter, close).
// Hover and "active" show as a 32px inset box, the same as the items in the nav menu.
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
      className={`floating group relative flex size-10 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
    >
      <span
        className={`flex size-8 items-center justify-center rounded-md group-hover:bg-surface-2 ${
          active ? "bg-surface-2 text-accent" : "text-fg"
        }`}
      >
        {children}
      </span>
    </button>
  );
}
