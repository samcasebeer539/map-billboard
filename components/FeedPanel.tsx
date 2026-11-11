"use client";

import { Post } from "@/lib/supabase";
import { distanceKm, formatDistance, formatRadius } from "@/lib/geo";
import SidePanel from "./SidePanel";
import { PostActions, PostContent } from "./PostCard";

// Posts near the one you clicked, closest first, in the same side panel as the post form.
// Clicking a post (anywhere but its photo or buttons) moves the map to it.
export default function FeedPanel({
  origin,
  posts,
  radiusKm,
  focusedId,
  onFocus,
  onClose,
  actionsFor,
}: {
  origin: Post;
  posts: Post[] | null; // null while loading
  radiusKm: number;
  focusedId: string | null;
  onFocus: (p: Post) => void;
  onClose: () => void;
  actionsFor: (p: Post) => PostActions;
}) {
  return (
    <SidePanel
      title="Nearby"
      subtitle={posts ? `${posts.length} ${posts.length === 1 ? "post" : "posts"} within ${formatRadius(radiusKm)}, closest first` : "Loading…"}
      onClose={onClose}
    >
      {posts?.map((p) => {
        const date = new Date(p.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
        const where = p.id === origin.id ? "Selected" : `${formatDistance(distanceKm(origin, p))} away`;
        return (
          <article
            key={p.id}
            onClick={() => onFocus(p)}
            className={`-mx-1 cursor-pointer rounded-lg p-3 hover:bg-surface-2 ${p.id === focusedId ? "ring-2 ring-accent" : ""}`}
          >
            <PostContent
              post={p}
              meta={
                <>
                  <span className={p.id === origin.id ? "text-accent" : undefined}>{where}</span> · {date}
                </>
              }
              {...actionsFor(p)}
            />
          </article>
        );
      })}
    </SidePanel>
  );
}
