"use client";

import { FormEvent, useState } from "react";
import Select from "./Select";
import ImagePicker from "./ImagePicker";
import Field from "./Field";
import { BODY_MAX, CATEGORIES, createPost, DEFAULT_DURATION, Duration, DURATIONS, TITLE_MAX } from "@/lib/supabase";

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

// Side panel (full screen on phones) for writing a new post at the clicked location
export default function PostForm({ location, onCancel, onPosted }: Props) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [image, setImage] = useState<File | null>(null);
  const [duration, setDuration] = useState<Duration>(DEFAULT_DURATION);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Give it a title.");
    setSaving(true);
    setError(null);
    const err = await createPost({ title: title.trim(), body: body.trim(), category, image, duration, ...location });
    setSaving(false);
    if (err) setError(err);
    else onPosted();
  }

  return (
    <form
      onSubmit={submit}
      className="floating absolute inset-y-0 left-0 z-10 flex w-full flex-col sm:w-95"
    >
      <header className="px-4 pt-4">
        <h2 className="text-lg font-semibold">New post</h2>
        <p className="text-xs tabular-nums text-muted">{formatCoords(location)}</p>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <Field id="post-title" label="Title">
          <input
            id="post-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={TITLE_MAX}
            placeholder="Garage sale this Saturday"
            className="input"
            autoFocus
          />
        </Field>

        <Field id="post-category" label="Category">
          <Select id="post-category" value={category} options={CATEGORIES} onChange={setCategory} />
        </Field>

        <Field id="post-duration" label="Keep it up for">
          <Select
            id="post-duration"
            value={duration}
            options={Object.keys(DURATIONS)}
            onChange={(v) => setDuration(v as Duration)}
            capitalize={false}
          />
        </Field>

        <Field id="post-image" label="Photo" optional>
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
        </Field>

        {/* Grows to fill the rest of the panel */}
        <Field id="post-body" label="Details" className="flex flex-1 flex-col">
          <textarea
            id="post-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={BODY_MAX}
            placeholder="What's going on?"
            className="input min-h-32 flex-1 resize-none"
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
      </div>

      <footer className="flex justify-end gap-2 p-4">
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
