"use client";

import { MouseEvent, ReactNode } from "react";
import { imageUrl, Post } from "@/lib/supabase";
import { categoryColor } from "@/lib/categories";

export type PostActions = {
  onExpand: (src: string, alt: string) => void; // open the photo viewer
  onToggleSave: () => void;
  onOpenComments: () => void;
  onShare: () => void;
  onReport: () => void;
};

type Props = PostActions & {
  post: Post;
  highlighted?: boolean; // the post a share link pointed to, or picked in the feed
  onOpen: () => void; // clicked anywhere but the photo or a button: open the nearby feed
};

// The post card shown on the map: the post's contents with a triangle pointing at it.
// BillboardMap renders one of these into each map marker.
export default function PostCard({ post, highlighted, onOpen, ...actions }: Props) {
  return (
    <div className="post-card flex flex-col items-center">
      <div
        onClick={(e) => {
          e.stopPropagation(); // don't reach the map (which would start a new post)
          onOpen();
        }}
        className={`floating w-60 cursor-pointer rounded-lg p-3 ${highlighted ? "ring-2 ring-accent" : ""}`}
      >
        <PostContent post={post} {...actions} />
      </div>
      <div className="card-tip" />
    </div>
  );
}

// A post's photo, category, title, details, then a meta line (date by default) and action
// buttons. Shared by map cards and the feed; expects a p-3 container (the photo bleeds to its edges).
export function PostContent({
  post,
  meta,
  onExpand,
  onToggleSave,
  onOpenComments,
  onShare,
  onReport,
}: PostActions & { post: Post; meta?: ReactNode }) {
  // The photo and buttons do their own thing; the click shouldn't also open/focus the post
  const stop = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    fn();
  };
  const date = new Date(post.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const src = post.image_path ? imageUrl(post.image_path) : null;

  return (
    <>
      {src && (
        // Photo at its natural aspect ratio (very tall photos are capped); click to expand
        <button
          type="button"
          aria-label="Expand photo"
          onClick={stop(() => onExpand(src, post.title))}
          className="-mx-3 -mt-3 mb-3 block w-[calc(100%+1.5rem)] cursor-zoom-in overflow-hidden rounded-t-lg bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={post.title} loading="lazy" className="block h-auto max-h-80 w-full object-cover" />
        </button>
      )}

      <div className="text-xs uppercase tracking-wide" style={{ color: categoryColor(post.category) }}>
        {post.category}
      </div>
      <div className="mt-1 text-sm font-medium">{post.title}</div>
      {post.body && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted">{post.body}</p>}

      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-muted">{meta ?? date}</span>
        <div className="-mr-1.5 flex items-center">
          {post.comments_enabled && (
            <IconButton
              label={`Comments (${post.comment_count})`}
              onClick={stop(onOpenComments)}
              count={post.comment_count || undefined}
            >
              {/* speech bubble */}
              <path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h7A1.5 1.5 0 0 1 13 4.5v5a1.5 1.5 0 0 1-1.5 1.5H7.5L4.5 13.5V11h0A1.5 1.5 0 0 1 3 9.5z" />
            </IconButton>
          )}
          <IconButton label="Share post" onClick={stop(onShare)}>
            {/* arrow out of a tray */}
            <path d="M8 2.5v7.5M5 5.5l3-3 3 3M3.5 9.5v2.5a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V9.5" />
          </IconButton>
          <IconButton label={post.saved ? "Unsave post" : "Save post"} pressed={post.saved} onClick={stop(onToggleSave)}>
            {/* bookmark */}
            <path
              fill={post.saved ? "currentColor" : "none"}
              d="M4 2.5h8a.5.5 0 0 1 .5.5v10.6a.3.3 0 0 1-.48.24L8 10.9l-4.02 2.94a.3.3 0 0 1-.48-.24V3a.5.5 0 0 1 .5-.5z"
            />
          </IconButton>
          {!post.mine && (
            <IconButton label="Report post" onClick={stop(onReport)}>
              {/* flag */}
              <path d="M4 13.5V2.5M4 3h7.5l-1.75 2.75L11.5 8.5H4" />
            </IconButton>
          )}
        </div>
      </div>
    </>
  );
}

// Small icon button for the card footer. `pressed` shows it in the accent color.
function IconButton({
  label,
  pressed,
  count,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  count?: number;
  onClick: (e: MouseEvent) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={`flex h-7 min-w-7 items-center justify-center gap-1 rounded-md px-1.5 text-xs tabular-nums hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent ${
        pressed ? "text-accent" : "text-muted"
      }`}
    >
      {count !== undefined && <span>{count}</span>}
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </button>
  );
}
