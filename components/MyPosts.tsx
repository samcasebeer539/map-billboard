"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CATEGORIES, deletePost, fetchMyPosts, Post, updatePost } from "@/lib/supabase";

export default function MyPosts() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetchMyPosts();
    setPosts(res.posts);
    setError(res.error);
  }

  useEffect(() => {
    load();
  }, []);

  if (posts === null) return <p className="text-gray-500">Loading…</p>;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Your posts</h2>
        <span className="text-sm text-gray-500">{posts.length} total</span>
      </div>

      {error && <p className="rounded-lg bg-red-50 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>}

      {!error && posts.length === 0 && (
        <div className="rounded-xl bg-white dark:bg-gray-900 p-6 text-gray-600 dark:text-gray-400 shadow-sm">
          You haven&apos;t posted anything yet.{" "}
          <Link href="/" className="text-accent hover:underline">
            Go to the map
          </Link>{" "}
          and click anywhere to make your first post.
        </div>
      )}

      {posts.map((p) => (
        <PostRow key={p.id} post={p} onChanged={load} />
      ))}
    </section>
  );
}

function PostRow({ post, onChanged }: { post: Post; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const [category, setCategory] = useState(post.category);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expired = new Date(post.expires_at) < new Date();

  async function save() {
    if (!title.trim()) return setError("Title can't be empty.");
    setBusy(true);
    const err = await updatePost(post.id, { title: title.trim(), body: body.trim(), category });
    setBusy(false);
    if (err) return setError(err);
    setEditing(false);
    onChanged();
  }

  async function remove() {
    if (!window.confirm(`Delete "${post.title}"?`)) return;
    setBusy(true);
    const err = await deletePost(post.id);
    setBusy(false);
    if (err) return setError(err);
    onChanged();
  }

  if (editing) {
    return (
      <div className="space-y-2 rounded-xl bg-white dark:bg-gray-900 p-4 shadow-sm">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 px-3 py-2 text-sm"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={500}
          rows={3}
          className="w-full resize-none rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 px-3 py-2 text-sm"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 px-3 py-2 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={() => setEditing(false)} className="rounded-lg px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/85 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white dark:bg-gray-900 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-gray-500">
            {post.category}
            {expired && <span className="ml-2 rounded bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 normal-case text-gray-600 dark:text-gray-400">expired</span>}
          </div>
          <div className="font-semibold text-gray-900 dark:text-gray-100">{post.title}</div>
          {post.body && <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{post.body}</p>}
          <div className="mt-2 text-xs text-gray-400">
            Posted {new Date(post.created_at).toLocaleDateString()} · {expired ? "expired" : "expires"}{" "}
            {new Date(post.expires_at).toLocaleDateString()}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
          <Link href={`/?lat=${post.lat}&lng=${post.lng}`} className="text-accent hover:underline">
            View on map
          </Link>
          <button onClick={() => setEditing(true)} className="text-gray-600 dark:text-gray-400 hover:underline">
            Edit
          </button>
          <button onClick={remove} disabled={busy} className="text-red-600 hover:underline disabled:opacity-50">
            Delete
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
