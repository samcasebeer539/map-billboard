"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PostSummary, { fmtDate, saveLabel } from "./PostSummary";
import { fetchSavedPosts, Post, setSaved } from "@/lib/supabase";

export default function SavedPosts() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSavedPosts().then((res) => {
      setPosts(res.posts);
      setError(res.error);
    });
  }, []);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Saved posts</h2>
        {posts && <span className="text-xs text-muted">{posts.length} total</span>}
      </div>

      {posts === null && <p className="text-sm text-muted">Loading…</p>}

      {error && (
        <p role="alert" className="card border-danger/40 p-4 text-sm text-danger">
          {error}
        </p>
      )}

      {posts && !error && posts.length === 0 && (
        <div className="card p-6 text-center text-sm text-muted">
          Nothing saved yet. Tap the bookmark on any post on the map to keep it here.
        </div>
      )}

      {posts?.map((p) => (
        <SavedRow key={p.id} post={p} onUnsaved={() => setPosts((ps) => ps?.filter((x) => x.id !== p.id) ?? null)} />
      ))}
    </section>
  );
}

function SavedRow({ post, onUnsaved }: { post: Post; onUnsaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expired = new Date(post.expires_at) < new Date();

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
          {!expired && (
            <Link href={`/?lat=${post.lat}&lng=${post.lng}`} className="btn-ghost h-8 px-3">
              View on map
            </Link>
          )}
          <button onClick={unsave} disabled={busy} className="btn-ghost h-8 px-3">
            Unsave
          </button>
        </>
      }
      error={error}
    />
  );
}
