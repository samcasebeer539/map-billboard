"use client";

import Link from "next/link";
import { useState } from "react";
import Select from "./Select";
import Field from "./Field";
import ImagePicker from "./ImagePicker";
import PostSummary, { fmtDate, isExpired, saveLabel } from "./PostSummary";
import { PostList, usePostList } from "./PostList";
import { BODY_MAX, CATEGORIES, deletePost, fetchMyPosts, imageUrl, Post, TITLE_MAX, updatePost } from "@/lib/supabase";

// The signed-in visitor's own posts, with edit and delete.
// onCount reports how many posts are listed (shown in the Profile tab).
export default function MyPosts({ onCount }: { onCount?: (n: number) => void }) {
  const { posts, error, reload } = usePostList(fetchMyPosts, onCount);

  return (
    <PostList
      posts={posts}
      error={error}
      empty={
        <>
          You haven&apos;t posted anything yet.{" "}
          <Link href="/" className="link">
            Open the map
          </Link>{" "}
          and click anywhere to make your first post.
        </>
      }
    >
      {(p) => <PostRow key={p.id} post={p} onChanged={reload} />}
    </PostList>
  );
}

function PostRow({ post, onChanged }: { post: Post; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm(`Delete "${post.title}"?`)) return;
    setBusy(true);
    const err = await deletePost(post);
    setBusy(false);
    if (err) return setError(err);
    onChanged();
  }

  if (editing) {
    return (
      <EditPost
        post={post}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          onChanged();
        }}
      />
    );
  }

  const expired = isExpired(post);
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
          <Link href={`/?lat=${post.lat}&lng=${post.lng}`} className="btn-ghost-sm">
            View on map
          </Link>
          <button onClick={() => setEditing(true)} className="btn-ghost-sm">
            Edit
          </button>
          <button onClick={remove} disabled={busy} className="btn-ghost-sm text-danger">
            Delete
          </button>
        </>
      }
      error={error}
    />
  );
}

// Inline edit form. Mounted fresh each time Edit is clicked, so it always starts from the saved post.
function EditPost({ post, onCancel, onSaved }: { post: Post; onCancel: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const [category, setCategory] = useState(post.category);
  const [image, setImage] = useState<File | null | undefined>(undefined); // undefined = unchanged
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = `edit-${post.id}`;

  async function save() {
    if (!title.trim()) return setError("Title can't be empty.");
    setBusy(true);
    setError(null);
    const err = await updatePost(post, { title: title.trim(), body: body.trim(), category, image });
    setBusy(false);
    if (err) return setError(err);
    onSaved();
  }

  return (
    <div className="card flex flex-col gap-4 p-4">
      <Field id={`${id}-title`} label="Title">
        <input
          id={`${id}-title`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={TITLE_MAX}
          className="input"
        />
      </Field>
      <Field id={`${id}-category`} label="Category">
        <Select id={`${id}-category`} value={category} options={CATEGORIES} onChange={setCategory} />
      </Field>
      <Field id={`${id}-image`} label="Photo" optional>
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
      </Field>
      <Field id={`${id}-body`} label="Details" className="flex flex-col">
        <textarea
          id={`${id}-body`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={BODY_MAX}
          rows={4}
          className="input resize-none"
        />
        <span className="mt-1.5 self-end text-xs text-muted">
          {body.length}/{BODY_MAX}
        </span>
      </Field>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="btn-ghost">
          Cancel
        </button>
        <button onClick={save} disabled={busy} className="btn-primary">
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
