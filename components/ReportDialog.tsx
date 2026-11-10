"use client";

import { useEffect, useRef, useState } from "react";
import { Post, REPORT_REASONS, ReportReason, reportPost } from "@/lib/supabase";

// Modal for reporting a post. The post disappears for the reporter right away,
// and for everyone once 3 people have reported it.
export default function ReportDialog({
  post,
  onClose,
  onReported,
}: {
  post: Post | null;
  onClose: () => void;
  onReported: (post: Post) => void;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRef = useRef<HTMLButtonElement>(null);

  // Reset when opened for a new post; Escape closes
  useEffect(() => {
    if (!post) return;
    setReason(null);
    setError(null);
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [post, onClose]);

  if (!post) return null;

  async function submit() {
    if (!post || !reason) return;
    setBusy(true);
    const err = await reportPost(post.id, reason);
    setBusy(false);
    if (err) return setError(err);
    onReported(post);
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        onClick={(e) => e.stopPropagation()}
        className="floating flex w-full max-w-sm flex-col gap-4 rounded-lg p-4"
      >
        <div>
          <h2 id="report-title" className="text-lg font-medium">
            Report post
          </h2>
          <p className="text-sm text-muted">It&apos;ll be hidden for you right away, and for everyone if others report it too.</p>
        </div>

        <div role="radiogroup" aria-label="Reason" className="flex flex-col gap-1">
          {(Object.keys(REPORT_REASONS) as ReportReason[]).map((r, i) => (
            <button
              key={r}
              ref={i === 0 ? firstRef : undefined}
              type="button"
              role="radio"
              aria-checked={reason === r}
              onClick={() => setReason(r)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent ${
                reason === r ? "bg-surface-2" : ""
              }`}
            >
              <span
                aria-hidden
                className={`flex size-4 shrink-0 items-center justify-center rounded-full ${reason === r ? "bg-accent" : "bg-line"}`}
              >
                {reason === r && <span className="size-1.5 rounded-full bg-on-accent" />}
              </span>
              {REPORT_REASONS[r]}
            </button>
          ))}
        </div>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={!reason || busy} className="btn-primary">
            {busy ? "Reporting…" : "Report"}
          </button>
        </div>
      </div>
    </div>
  );
}
