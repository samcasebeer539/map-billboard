"use client";

import { useEffect } from "react";

// Short confirmation message at the bottom of the screen ("Link copied").
// Hides itself after a few seconds by calling onDone.
export default function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [message, onDone]);

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-8 z-40 flex justify-center px-4">
      {message && <div className="floating rounded-lg px-4 py-2 text-sm">{message}</div>}
    </div>
  );
}
