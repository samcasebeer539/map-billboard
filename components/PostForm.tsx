"use client";

import { FormEvent, useState } from "react";
import Select from "./Select";
import ImagePicker from "./ImagePicker";
import { CATEGORIES, createPost } from "@/lib/supabase";

// e.g. 38.58160° N, 121.49440° W (5 decimals ≈ 1 m precision)
function formatCoords({ lat, lng }: { lat: number; lng: number }) {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(5)}° ${ns}, ${Math.abs(lng).toFixed(5)}° ${ew}`;
}

type Props = {
  location: { lat: number; lng: number };
  onCancel: () => void;
  onPosted: () => void;
};

export default function PostForm({ location, onCancel, onPosted }: Props) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [image, setImage] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Give it a title.");
    setSaving(true);
    setError(null);
    const err = await createPost({ title: title.trim(), body: body.trim(), category, image, ...location });
    setSaving(false);
    if (err) setError(err);
    else onPosted();
  }

  return (
    <form
      onSubmit={submit}
      className="floating absolute inset-y-0 left-0 z-10 flex w-[min(92vw,380px)] flex-col border-y-0 border-l-0"
    >
      <header className="border-b border-line p-4">
        <h2 className="text-lg font-semibold">New post</h2>
        <p className="text-xs tabular-nums text-muted">{formatCoords(location)}</p>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div>
          <label htmlFor="post-title" className="field-label">
            Title
          </label>
          <input
            id="post-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="Garage sale this Saturday"
            className="input"
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="post-category" className="field-label">
            Category
          </label>
          <Select id="post-category" value={category} options={CATEGORIES} onChange={setCategory} />
        </div>

        <div>
          <label htmlFor="post-image" className="field-label">
            Photo <span className="font-normal">(optional)</span>
          </label>
          <ImagePicker
            id="post-image"
            file={image}
            onPick={(f) => {
              setImage(f);
              setError(null);
            }}
            onRemove={() => setImage(null)}
            onError={setError}
          />
        </div>

        <div className="flex flex-1 flex-col">
          <label htmlFor="post-body" className="field-label">
            Details
          </label>
          <textarea
            id="post-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={500}
            placeholder="What's going on?"
            className="input min-h-32 flex-1 resize-none"
          />
          <span className="mt-1.5 self-end text-xs text-muted">{body.length}/500</span>
        </div>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      <footer className="flex justify-end gap-2 border-t border-line p-4">
        <button type="button" onClick={onCancel} className="btn-ghost">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? (image ? "Uploading…" : "Posting…") : "Post"}
        </button>
      </footer>
    </form>
  );
}
