"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Select from "./Select";
import ImagePicker from "./ImagePicker";
import PostSummary, { fmtDate, saveLabel } from "./PostSummary";
import { CATEGORIES, deletePost, fetchMyPosts, imageUrl, Post, updatePost } from "@/lib/supabase";

// onCount reports how many posts are listed (shown in the Profile tab)
export default function MyPosts({ onCount }: { onCount?: (n: number) => void }) {
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

  useEffect(() => {
    if (posts) onCount?.(posts.length);
  }, [posts, onCount]);

  return (
    <section className="flex flex-col gap-4">
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
    <PostSummary
      post={post}
      meta={
        <>
          Posted {fmtDate(post.created_at)} · {expired ? "Expired" : "Expires"} {fmtDate(post.expires_at)} ·{" "}
          {saveLabel(post.save_count)}
        </>
      }
      actions={
        <>
          <Link href={`/?lat=${post.lat}&lng=${post.lng}`} className="btn-ghost h-8 px-3">
            View on map
          </Link>
          <button onClick={() => setEditing(true)} className="btn-ghost h-8 px-3">
            Edit
          </button>
          <button onClick={remove} disabled={busy} className="btn-ghost h-8 px-3 text-danger">
            Delete
          </button>
        </>
      }
      error={error}
    />
  );
}
