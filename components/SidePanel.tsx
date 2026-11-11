"use client";

import { FormEvent, ReactNode } from "react";

// Panel on the left of the map (full screen on phones), used for the post form and comments.
// Pass onSubmit to make it a <form>; pass onClose to show a × in the header.
export default function SidePanel({
  title,
  subtitle,
  onClose,
  onSubmit,
  footer,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose?: () => void;
  onSubmit?: (e: FormEvent) => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const className = "side-panel elevated bg-bg absolute inset-y-0 left-0 z-10 flex w-full flex-col sm:w-95";
  const content = (
    <>
      <header className="flex items-start justify-between gap-4 px-4 pt-4 pb-2">
        <div className="min-w-0">
          <h2 className="text-lg font-medium">{title}</h2>
          {subtitle && <div className="text-xs text-muted">{subtitle}</div>}
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 flex size-8 shrink-0 items-center justify-center rounded-md text-fg hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent">
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
              <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
            </svg>
          </button>
        )}
      </header>
      <div className="no-scrollbar flex flex-1 flex-col gap-4 overflow-y-auto p-4">{children}</div>
      {footer && <footer className="p-4 pt-0">{footer}</footer>}
    </>
  );

  return onSubmit ? (
    <form onSubmit={onSubmit} className={className}>
      {content}
    </form>
  ) : (
    <section className={className}>{content}</section>
  );
}
