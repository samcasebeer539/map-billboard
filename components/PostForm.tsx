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
      className="absolute inset-y-0 left-0 z-10 flex w-[min(92vw,380px)] flex-col gap-3 overflow-y-auto bg-white dark:bg-gray-900 p-4 shadow-xl"
    >
      <h2 className="font-semibold text-gray-900 dark:text-gray-100">New post</h2>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={80}
        placeholder="Title"
        className="w-full rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 px-3 py-2 text-sm"
        autoFocus
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={500}
        rows={3}
        placeholder="What's going on?"
        className="w-full resize-none rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 px-3 py-2 text-sm"
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="w-full rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 px-3 py-2 text-sm"
      >
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/85 disabled:opacity-50"
        >
          {saving ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}
