"use client";

import { FormEvent, useState } from "react";
import Select from "./Select";
import ImagePicker from "./ImagePicker";
import Field from "./Field";
import SidePanel from "./SidePanel";
import Switch from "./Switch";
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

// Panel for writing a new post at the clicked location
export default function PostForm({ location, onCancel, onPosted }: Props) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [image, setImage] = useState<File | null>(null);
  const [duration, setDuration] = useState<Duration>(DEFAULT_DURATION);
  const [commentsEnabled, setCommentsEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Give it a title.");
    setSaving(true);
    setError(null);
    const err = await createPost({ title: title.trim(), body: body.trim(), category, image, duration, commentsEnabled, ...location });
    setSaving(false);
    if (err) setError(err);
    else onPosted();
  }

  return (
    <SidePanel
      title="New post"
      subtitle={<span className="tabular-nums">{formatCoords(location)}</span>}
      onSubmit={submit}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={saving || !title.trim()} className="btn-primary">
            {saving ? (image ? "Uploading…" : "Posting…") : "Post"}
          </button>
        </div>
      }
    >
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

      <Field id="post-duration" label="Expires">
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

      <div className="flex items-center justify-between gap-4">
        <label htmlFor="post-comments" className="text-sm">
          Allow comments
        </label>
        <Switch id="post-comments" checked={commentsEnabled} onChange={setCommentsEnabled} />
      </div>

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
    </SidePanel>
  );
}
