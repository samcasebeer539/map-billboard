"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fmtDate } from "./PostSummary";
import { deleteComment, fetchMyComments, MyComment } from "@/lib/supabase";
import { categoryColor } from "@/lib/categories";

// Your comments and replies across all posts, newest first.
// onCount reports how many are listed (shown in the Profile tab).
export default function MyComments({ onCount }: { onCount?: (n: number) => void }) {
  const [comments, setComments] = useState<MyComment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetchMyComments();
    setComments(res.comments);
    setError(res.error);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (comments) onCount?.(comments.length);
  }, [comments, onCount]);

  return (
    <section className="flex flex-col gap-4">
      {comments === null && <p className="text-sm text-muted">Loading…</p>}
      {error && (
        <p role="alert" className="rounded-lg bg-danger/10 p-4 text-sm text-danger">
          {error}
        </p>
      )}
      {comments && !error && comments.length === 0 && (
        <div className="card p-6 text-center text-sm text-muted">
          No comments yet. Your comments and replies on posts will show up here.
        </div>
      )}
      {comments?.map((c) => (
        <CommentRow key={c.id} comment={c} onDeleted={() => setComments((cs) => cs?.filter((x) => x.id !== c.id) ?? null)} />
      ))}
    </section>
  );
}

function CommentRow({ comment: c, onDeleted }: { comment: MyComment; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm(c.is_reply ? "Delete this reply?" : "Delete this comment and any replies to it?")) return;
    setBusy(true);
    const err = await deleteComment(c.id);
    setBusy(false);
    if (err) return setError(err);
    onDeleted();
  }

  return (
    <article className="card p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <span className="uppercase tracking-wide" style={{ color: categoryColor(c.post_category) }}>
          {c.post_category}
        </span>
        {!c.post_live && <span className="rounded-full bg-surface-2 px-2 py-0.5">No longer on the map</span>}
      </div>
      <div className="mt-1 text-sm">
        <span className="text-muted">{c.is_reply ? "Reply on " : "Comment on "}</span>
        <span className="font-medium">{c.post_title}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm">{c.body}</p>
      <div className="mt-2 text-xs text-muted">{fmtDate(c.created_at)}</div>

      <div className="mt-4 flex flex-col items-start gap-2">
        <div className="-ml-3 flex gap-1">
          {/* Opens the map at the post with its comments showing */}
          {c.post_live && c.comments_enabled && (
            <Link href={`/?lat=${c.lat}&lng=${c.lng}&post=${c.post_id}&comments=1`} className="btn-ghost-sm">
              View on map
            </Link>
          )}
          <button type="button" onClick={remove} disabled={busy} className="btn-ghost-sm">
            Delete
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </article>
  );
}
