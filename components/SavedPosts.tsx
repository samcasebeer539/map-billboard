"use client";

import Link from "next/link";
import { useState } from "react";
import PostSummary, { fmtDate, isExpired, saveLabel } from "./PostSummary";
import { PostList, usePostList } from "./PostList";
import { fetchSavedPosts, Post, setSaved } from "@/lib/supabase";

// Posts the visitor has bookmarked. onCount reports how many are listed (shown in the Profile tab).
export default function SavedPosts({ onCount }: { onCount?: (n: number) => void }) {
  const { posts, setPosts, error } = usePostList(fetchSavedPosts, onCount);

  return (
    <PostList posts={posts} error={error} empty="Nothing saved yet. Tap the bookmark on any post on the map to keep it here.">
      {(p) => <SavedRow key={p.id} post={p} onUnsaved={() => setPosts((ps) => ps?.filter((x) => x.id !== p.id) ?? null)} />}
    </PostList>
  );
}

function SavedRow({ post, onUnsaved }: { post: Post; onUnsaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function unsave() {
    setBusy(true);
    const err = await setSaved(post.id, false);
    setBusy(false);
    if (err) return setError(err);
    onUnsaved();
  }

  return (
    <PostSummary
      post={post}
      meta={
        <>
          Posted {fmtDate(post.created_at)} · {saveLabel(post.save_count)}
        </>
      }
      actions={
        <>
          {/* Expired posts are no longer on the map */}
          {!isExpired(post) && (
            <Link href={`/?lat=${post.lat}&lng=${post.lng}`} className="btn-ghost-sm">
              View on map
            </Link>
          )}
          <button onClick={unsave} disabled={busy} className="btn-ghost-sm">
            Unsave
          </button>
        </>
      }
      error={error}
    />
  );
}
