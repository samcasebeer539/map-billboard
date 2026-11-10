"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import SidePanel from "./SidePanel";
import { addComment, COMMENT_MAX, Comment, deleteComment, fetchComments, Post } from "@/lib/supabase";

const fmtTime = (d: string) =>
  new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// Who wrote a comment, without revealing accounts: "You", "Poster", or "Anonymous"
function author(c: Comment) {
  if (c.mine && c.by_poster) return "You (poster)";
  if (c.mine) return "You";
  if (c.by_poster) return "Poster";
  return "Anonymous";
}

// Comment thread for one post, in the same side panel as the post form.
// onCountChange keeps the comment count on the map card in sync.
export default function CommentsPanel({
  post,
  onClose,
  onCountChange,
}: {
  post: Post;
  onClose: () => void;
  onCountChange: (count: number) => void;
}) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetchComments(post.id);
    setComments(res.comments);
    if (res.error) setError(res.error);
    else onCountChange(res.comments.length);
  }, [post.id, onCountChange]);

  useEffect(() => {
    setComments(null);
    setError(null);
    load();
  }, [load]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    setError(null);
    const err = await addComment(post.id, draft.trim());
    setBusy(false);
    if (err) return setError(err);
    setDraft("");
    load();
  }

  async function remove(c: Comment) {
    if (!window.confirm("Delete this comment?")) return;
    const err = await deleteComment(c.id);
    if (err) return setError(err);
    load();
  }

  const count = comments?.length ?? post.comment_count;

  return (
    <SidePanel
      title={post.title}
      subtitle={`${count} ${count === 1 ? "comment" : "comments"}`}
      onClose={onClose}
      footer={
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label htmlFor="comment-body" className="sr-only">
            Add a comment
          </label>
          <textarea
            id="comment-body"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter adds a line break
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            maxLength={COMMENT_MAX}
            rows={2}
            placeholder="Add a comment"
            className="input resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">
              {draft.length}/{COMMENT_MAX}
            </span>
            <button type="submit" disabled={busy || !draft.trim()} className="btn-primary">
              {busy ? "Sending…" : "Comment"}
            </button>
          </div>
        </form>
      }
    >
      {comments === null && <p className="text-sm text-muted">Loading…</p>}
      {comments?.length === 0 && <p className="text-sm text-muted">No comments yet. Start the conversation.</p>}

      {comments?.map((c) => (
        <article key={c.id}>
          <div className="flex items-center justify-between gap-2">
            <span className={`text-xs ${c.by_poster ? "text-accent" : "text-muted"}`}>
              {author(c)} · {fmtTime(c.created_at)}
            </span>
            {c.can_delete && (
              <button type="button" onClick={() => remove(c)} className="text-xs text-muted hover:text-danger">
                Delete
              </button>
            )}
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm">{c.body}</p>
        </article>
      ))}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </SidePanel>
  );
}
