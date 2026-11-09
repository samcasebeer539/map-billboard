"use client";

import { FormEvent, useState } from "react";
import { CATEGORIES, createPost } from "@/lib/supabase";

type Props = {
  location: { lat: number; lng: number };
  onCancel: () => void;
  onPosted: () => void;
};

export default function PostForm({ location, onCancel, onPosted }: Props) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Give it a title.");
    setSaving(true);
    setError(null);
    const err = await createPost({ title: title.trim(), body: body.trim(), category, ...location });
    setSaving(false);
    if (err) setError(err);
    else onPosted();
  }

  return (
    <form
      onSubmit={submit}
      className="absolute bottom-4 left-1/2 w-[min(92vw,380px)] -translate-x-1/2 space-y-3 rounded-2xl bg-white p-4 shadow-xl"
    >
      <h2 className="font-semibold text-gray-900">New post</h2>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={80}
        placeholder="Title"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        autoFocus
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={500}
        rows={3}
        placeholder="What's going on?"
        className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      >
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
        >
          {saving ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}
