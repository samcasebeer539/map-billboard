"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";

const MAX_BYTES = 20 * 1024 * 1024; // before resizing; big phone photos are fine

type Props = {
  id?: string;
  file: File | null; // newly picked file, if any
  existingUrl?: string | null; // current image when editing
  onPick: (file: File) => void;
  onRemove: () => void;
  onError: (message: string) => void;
};

// Photo picker with preview. Shows a dashed "Add a photo" button when empty,
// otherwise the image with Replace and Remove buttons.
export default function ImagePicker({ id, file, existingUrl, onPick, onRemove, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Object URLs for local previews must be revoked when they change
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!f) return;
    if (!f.type.startsWith("image/")) return onError("Please choose an image file.");
    if (f.size > MAX_BYTES) return onError("That image is over 20 MB.");
    onPick(f);
  }

  const shown = previewUrl ?? existingUrl ?? null;

  return (
    <div>
      <input id={id} ref={inputRef} type="file" accept="image/*" onChange={handleChange} className="sr-only" />

      {shown ? (
        <div className="relative overflow-hidden rounded-lg bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shown} alt="Selected photo" className="block h-auto max-h-80 w-full object-cover" />
          <div className="absolute top-2 right-2 flex gap-1">
            <button type="button" onClick={() => inputRef.current?.click()} className="btn floating h-8 px-3">
              Replace
            </button>
            <button type="button" onClick={onRemove} aria-label="Remove photo" className="btn floating size-8 px-0">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
                <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-24 w-full flex-col items-center justify-center gap-1 rounded-lg bg-surface-2 text-sm text-muted transition-colors hover:bg-line/60 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="2.5" y="4" width="15" height="12" rx="2" />
            <circle cx="7" cy="8.5" r="1.5" />
            <path d="M17.5 13l-4-4-7 7" />
          </svg>
          Add a photo
        </button>
      )}
    </div>
  );
}
