"use client";

import { ReactNode, useCallback, useState } from "react";
import Lightbox from "./Lightbox";
import { imageUrl, Post } from "@/lib/supabase";

export const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export const isExpired = (post: Post) => new Date(post.expires_at) < new Date();

export const saveLabel = (n: number) => `${n} ${n === 1 ? "save" : "saves"}`;
export const commentLabel = (n: number) => `${n} ${n === 1 ? "comment" : "comments"}`;

// Read-only post card used on the Profile page: content + thumbnail on top,
// a meta line and action buttons underneath.
export default function PostSummary({
  post,
  meta,
  actions,
  error,
}: {
  post: Post;
  meta: ReactNode;
  actions: ReactNode;
  error?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const closeExpanded = useCallback(() => setExpanded(false), []);
  const expired = isExpired(post);

  return (
    <article className="card p-4">
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="text-accent uppercase tracking-wide">{post.category}</span>
            {expired && <span className="rounded-full bg-surface-2 px-2 py-0.5">Expired</span>}
            {post.hidden && (
              <span className="rounded-full bg-danger/10 px-2 py-0.5 text-danger" title="Hidden from the map after several reports">
                Hidden
              </span>
            )}
          </div>
          <h3 className="mt-1 text-sm font-medium">{post.title}</h3>
          {post.body && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted">{post.body}</p>}
        </div>
        {post.image_path && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-label="Expand photo"
            className="shrink-0 cursor-zoom-in rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl(post.image_path)}
              alt=""
              loading="lazy"
              className="size-20 rounded-lg object-cover"
            />
          </button>
        )}
        <Lightbox
          image={expanded && post.image_path ? { src: imageUrl(post.image_path), alt: post.title } : null}
          onClose={closeExpanded}
        />
      </div>

      <div className="mt-4 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-muted">{meta}</span>
        {/* Negative margin lines the buttons' text up with the content edge (buttons have 12px padding) */}
        <div className="-ml-3 flex gap-1 sm:-mr-3 sm:ml-0">{actions}</div>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </article>
  );
}
