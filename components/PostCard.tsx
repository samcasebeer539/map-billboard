"use client";

import { MouseEvent } from "react";
import { imageUrl, Post } from "@/lib/supabase";

type Props = {
  post: Post;
  onExpand: (src: string, alt: string) => void; // open the photo viewer
  onToggleSave: () => void;
};

// The post card shown on the map: optional photo, category, title, details,
// then the date and save button, with a triangle pointing at the post.
// BillboardMap renders one of these into each map marker.
export default function PostCard({ post, onExpand, onToggleSave }: Props) {
  // Clicks inside a card shouldn't reach the map (which would start a new post)
  const stop = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    fn();
  };
  const date = new Date(post.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const src = post.image_path ? imageUrl(post.image_path) : null;

  return (
    <div className="post-card flex flex-col items-center">
      <div className="floating w-60 rounded-lg p-3">
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

        <div className="text-xs text-accent uppercase tracking-wide">{post.category}</div>
        <div className="mt-1 text-sm font-medium">{post.title}</div>
        {post.body && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted">{post.body}</p>}

        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-muted">{date}</span>
          <SaveButton count={post.save_count} saved={post.saved} onClick={stop(onToggleSave)} />
        </div>

      </div>
      <div className="card-tip" />
    </div>
  );
}

function SaveButton({ count, saved, onClick }: { count: number; saved: boolean; onClick: (e: MouseEvent) => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={`${saved ? "Unsave" : "Save"} post, ${count} ${count === 1 ? "save" : "saves"}`}
      title={saved ? "Saved" : "Save"}
      className={`-mr-1.5 flex h-7 items-center gap-1.5 rounded-md px-1.5 text-xs tabular-nums hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent ${
        saved ? "text-accent" : "text-muted"
      }`}
    >
      <span>{count}</span>
      <svg width="16" height="16" viewBox="0 0 16 16" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
        <path d="M4 2.5h8a.5.5 0 0 1 .5.5v10.6a.3.3 0 0 1-.48.24L8 10.9l-4.02 2.94a.3.3 0 0 1-.48-.24V3a.5.5 0 0 1 .5-.5z" />
      </svg>
    </button>
  );
}
