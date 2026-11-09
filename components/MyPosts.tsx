"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Select from "./Select";
import ImagePicker from "./ImagePicker";
import { CATEGORIES, deletePost, fetchMyPosts, imageUrl, Post, updatePost } from "@/lib/supabase";

const fmtDate = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

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

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Your posts</h2>
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
          You haven&apos;t posted anything yet.{" "}
          <Link href="/" className="link">
            Open the map
          </Link>{" "}
          and click anywhere to make your first post.
        </div>
      )}

      {posts?.map((p) => (
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
  const [image, setImage] = useState<File | null | undefined>(undefined); // undefined = unchanged
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expired = new Date(post.expires_at) < new Date();

  async function save() {
    if (!title.trim()) return setError("Title can't be empty.");
    setBusy(true);
    setError(null);
    const err = await updatePost(post, { title: title.trim(), body: body.trim(), category, image });
    setBusy(false);
    if (err) return setError(err);
    setEditing(false);
    setImage(undefined);
    onChanged();
  }

  function cancelEdit() {
    setTitle(post.title);
    setBody(post.body);
    setCategory(post.category);
    setImage(undefined);
    setError(null);
    setEditing(false);
  }

  async function remove() {
    if (!window.confirm(`Delete "${post.title}"?`)) return;
    setBusy(true);
    const err = await deletePost(post);
    setBusy(false);
    if (err) return setError(err);
    onChanged();
  }

  if (editing) {
    const id = `edit-${post.id}`;
    return (
      <div className="card flex flex-col gap-4 p-4">
        <div>
          <label htmlFor={`${id}-title`} className="field-label">
            Title
          </label>
          <input id={`${id}-title`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className="input" />
        </div>
        <div>
          <label htmlFor={`${id}-category`} className="field-label">
            Category
          </label>
          <Select id={`${id}-category`} value={category} options={CATEGORIES} onChange={setCategory} />
        </div>
        <div>
          <label htmlFor={`${id}-image`} className="field-label">
            Photo
          </label>
          <ImagePicker
            id={`${id}-image`}
            file={image instanceof File ? image : null}
            existingUrl={image === null || !post.image_path ? null : imageUrl(post.image_path)}
            onPick={(f) => {
              setImage(f);
              setError(null);
            }}
            onRemove={() => setImage(null)}
            onError={setError}
          />
        </div>
        <div>
          <label htmlFor={`${id}-body`} className="field-label">
            Details
          </label>
          <textarea
            id={`${id}-body`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={500}
            rows={4}
            className="input resize-none"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={cancelEdit} className="btn-ghost">
            Cancel
          </button>
          <button onClick={save} disabled={busy} className="btn-primary">
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <article className="card p-4">
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="font-medium uppercase tracking-wide">{post.category}</span>
            {expired && <span className="rounded-full border border-line px-2 py-0.5">Expired</span>}
          </div>
          <h3 className="mt-1 text-sm font-semibold">{post.title}</h3>
          {post.body && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted">{post.body}</p>}
        </div>
        {post.image_path && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl(post.image_path)}
            alt=""
            loading="lazy"
            className="size-20 shrink-0 rounded-lg border border-line object-cover"
          />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <span className="text-xs text-muted">
          Posted {fmtDate(post.created_at)} · {expired ? "Expired" : "Expires"} {fmtDate(post.expires_at)}
        </span>
        <div className="flex gap-1">
          <Link href={`/?lat=${post.lat}&lng=${post.lng}`} className="btn-ghost h-8 px-3">
            View on map
          </Link>
          <button onClick={() => setEditing(true)} className="btn-ghost h-8 px-3">
            Edit
          </button>
          <button onClick={remove} disabled={busy} className="btn-ghost h-8 px-3 text-danger">
            Delete
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </article>
  );
}
