"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import SidePanel from "./SidePanel";
import { addComment, COMMENT_MAX, Comment, deleteComment, fetchComments, Post } from "@/lib/supabase";

const fmtTime = (d: string) =>
  new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// Who wrote a comment, without revealing accounts: "You", "Poster", or "Anonymous 1, 2, ..."
// (numbered per post by the server, so you can tell commenters apart)
function author(c: Comment) {
  if (c.mine && c.by_poster) return "You (poster)";
  if (c.mine) return "You";
  if (c.by_poster) return "Poster";
  return c.author_no ? `Anonymous ${c.author_no}` : "Anonymous";
}

const HIGHLIGHT_MS = 1200; // after clicking a quote line
const ARRIVAL_HIGHLIGHT_MS = 3000; // after arriving from a notification: long enough to spot

// Comments with their replies underneath (one level: a reply to a reply joins the same thread)
function threads(comments: Comment[]) {
  const ids = new Set(comments.map((c) => c.id));
  const isTop = (c: Comment) => !c.parent_id || !ids.has(c.parent_id);
  return comments.filter(isTop).map((top) => ({ top, replies: comments.filter((c) => !isTop(c) && c.parent_id === top.id) }));
}

// Comment thread for one post, in the same side panel as the post form.
// onCountChange keeps the comment count on the map card in sync.
export default function CommentsPanel({
  post,
  focusCommentId,
  onClose,
  onCountChange,
}: {
  post: Post;
  focusCommentId?: string | null; // scroll to and flash this comment once loaded (from Notifications)
  onClose: () => void;
  onCountChange: (count: number) => void;
}) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [flash, setFlash] = useState<{ id: string; ms: number } | null>(null);
  const flashId = flash?.id;
  const byId = new Map((comments ?? []).map((c) => [c.id, c]));

  // Clicking a reply's quote line: scroll to the comment it answers and flash it
  function jumpTo(id: string, ms = HIGHLIGHT_MS) {
    document.getElementById(`comment-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setFlash({ id, ms });
  }
  // Arriving from a notification: show the comment it's about
  const focusedRef = useRef(false);
  useEffect(() => {
    if (!focusCommentId || focusedRef.current || !comments?.some((c) => c.id === focusCommentId)) return;
    focusedRef.current = true;
    requestAnimationFrame(() => jumpTo(focusCommentId, ARRIVAL_HIGHLIGHT_MS));
  }, [comments, focusCommentId]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), flash.ms);
    return () => clearTimeout(t);
  }, [flash]);

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
    const err = await addComment(post.id, draft.trim(), replyTo?.id);
    setBusy(false);
    if (err) return setError(err);
    setDraft("");
    setReplyTo(null);
    load();
  }

  function reply(c: Comment) {
    setReplyTo(c);
    textareaRef.current?.focus();
  }

  async function remove(c: Comment, replyCount: number) {
    const msg = replyCount
      ? `Delete this comment and its ${replyCount} ${replyCount === 1 ? "reply" : "replies"}?`
      : "Delete this comment?";
    if (!window.confirm(msg)) return;
    const err = await deleteComment(c.id);
    if (err) return setError(err);
    if (replyTo && (replyTo.id === c.id || replyTo.parent_id === c.id)) setReplyTo(null);
    load();
  }

  const item = (c: Comment, replyCount = 0) => {
    const answers = c.reply_to_id ? byId.get(c.reply_to_id) : undefined;
    return (
      <article
        key={c.id}
        id={`comment-${c.id}`}
        className={`-mx-2 rounded-md px-2 transition-colors duration-500 ${flashId === c.id ? "bg-surface" : ""}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs ${c.by_poster ? "text-accent" : "text-muted"}`}>
            {author(c)} · {fmtTime(c.created_at)}
          </span>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => reply(c)}
              className={`text-xs hover:text-fg ${replyTo?.id === c.id ? "text-accent" : "text-muted"}`}
            >
              Reply
            </button>
            {c.can_delete && (
              <button type="button" onClick={() => remove(c, replyCount)} className="text-xs text-muted hover:text-danger">
                Delete
              </button>
            )}
          </div>
        </div>
        {answers && (
          // A reply to a reply: which one it answers (replies to the top comment don't need this)
          <button
            type="button"
            onClick={() => jumpTo(answers.id)}
            className="mt-1 flex w-full min-w-0 items-center gap-1 text-left text-xs text-muted hover:text-fg"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
              <path d="M2 2.5v3a2 2 0 0 0 2 2h6M7.5 5 10 7.5 7.5 10" />
            </svg>
            <span className="truncate">
              <span className={answers.by_poster ? "text-accent" : ""}>{author(answers)}</span>: {answers.body}
            </span>
          </button>
        )}
        <p className="mt-1 whitespace-pre-wrap break-words text-sm">{c.body}</p>
      </article>
    );
  };

  const count = comments?.length ?? post.comment_count;

  return (
    <SidePanel
      title={post.title}
      subtitle={`${count} ${count === 1 ? "comment" : "comments"}`}
      onClose={onClose}
      footer={
        <form onSubmit={submit} className="flex flex-col gap-2">
          {replyTo && (
            <div className="flex items-center justify-between gap-2 text-xs text-muted">
              <span className="min-w-0 truncate">
                Replying to <span className={replyTo.by_poster ? "text-accent" : "text-fg"}>{author(replyTo)}</span>: {replyTo.body}
              </span>
              <button type="button" onClick={() => setReplyTo(null)} className="shrink-0 hover:text-fg">
                Cancel reply
              </button>
            </div>
          )}
          <label htmlFor="comment-body" className="sr-only">
            {replyTo ? "Write a reply" : "Add a comment"}
          </label>
          <textarea
            ref={textareaRef}
            id="comment-body"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter adds a line break
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              } else if (e.key === "Escape" && replyTo) {
                e.preventDefault();
                setReplyTo(null);
              }
            }}
            maxLength={COMMENT_MAX}
            rows={2}
            placeholder={replyTo ? "Write a reply" : "Add a comment"}
            className="input resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">
              {draft.length}/{COMMENT_MAX}
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-ghost">
                Cancel
              </button>
              <button type="submit" disabled={busy || !draft.trim()} className="btn-primary">
                {busy ? "Sending…" : replyTo ? "Reply" : "Comment"}
              </button>
            </div>
          </div>
        </form>
      }
    >
      {comments === null && <p className="text-sm text-muted">Loading…</p>}
      {comments?.length === 0 && <p className="text-sm text-muted">No comments yet. Start the conversation.</p>}

      {comments &&
        threads(comments).map(({ top, replies }) => (
          <div key={top.id}>
            {item(top, replies.length)}
            {replies.length > 0 && (
              // Replies sit indented under the comment they answer
              <div className="mt-3 flex flex-col gap-3 pl-4">{replies.map((r) => item(r))}</div>
            )}
          </div>
        ))}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </SidePanel>
  );
}
