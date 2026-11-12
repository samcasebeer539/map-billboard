"use client";

import { KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { Post, searchPosts } from "@/lib/supabase";
import { Place, searchPlaces } from "@/lib/geocode";
import { categoryColor, matchesFilter } from "@/lib/categories";
import { distanceKm, formatDistance } from "@/lib/geo";
import FloatingIconButton from "./FloatingIconButton";

type Mode = "places" | "posts";
const MODES: { id: Mode; label: string; placeholder: string }[] = [
  { id: "places", label: "Places", placeholder: "Search a place or address" },
  { id: "posts", label: "Posts", placeholder: "Search post text" },
];
const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;

type Result = { kind: "place"; place: Place } | { kind: "post"; post: Post };

const searchIcon = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
    <circle cx="8.75" cy="8.75" r="5.25" />
    <path d="M12.75 12.75 16.5 16.5" />
  </svg>
);

// Search beside the menu and filter buttons. A square icon until clicked, then a search
// field with a Places / Posts switch and results underneath. Picking a result moves the map.
export default function SearchBar({
  getCenter,
  loadedPosts,
  filter,
  onPickPlace,
  onPickPost,
}: {
  getCenter: () => { lat: number; lng: number };
  loadedPosts: () => Post[]; // fallback for post search before supabase/009_search.sql is run
  filter: ReadonlySet<string>;
  onPickPlace: (p: Place) => void;
  onPickPost: (p: Post) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("places");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[] | null>(null); // null: nothing searched yet
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const q = query.trim();

  // Close on a press outside (which still goes through to the map), like the menus.
  // The query stays, so reopening shows the same search.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Search as you type, after a short pause. Older, slower responses are dropped.
  useEffect(() => {
    if (!open || q.length < MIN_CHARS) {
      setResults(null);
      setLoading(false);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const center = getCenter();
        let found: Result[];
        if (mode === "places") {
          found = (await searchPlaces(q, center, ctrl.signal)).map((place) => ({ kind: "place", place }));
        } else {
          const posts = (await searchPosts(q, center)) ?? searchLoaded(loadedPosts(), q, center);
          found = posts.filter((p) => matchesFilter(p.category, filter)).map((post) => ({ kind: "post", post }));
        }
        if (ctrl.signal.aborted) return;
        setResults(found);
        setError(null);
        setActive(0);
      } catch (e) {
        if (ctrl.signal.aborted) return;
        console.error(e);
        setResults([]);
        setError(mode === "places" ? "Couldn't reach place search. Try again in a moment." : "Search failed. Try again.");
      }
      setLoading(false);
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [open, q, mode, filter, getCenter, loadedPosts]);

  function close() {
    setOpen(false);
  }

  function pick(r: Result) {
    if (r.kind === "place") onPickPlace(r.place);
    else onPickPost(r.post);
    close();
  }

  function onKeyDown(e: KeyboardEvent) {
    const n = results?.length ?? 0;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown" && n) {
      e.preventDefault();
      setActive((i) => (i + 1) % n);
    } else if (e.key === "ArrowUp" && n) {
      e.preventDefault();
      setActive((i) => (i - 1 + n) % n);
    } else if (e.key === "Enter" && results?.[active]) {
      e.preventDefault();
      pick(results[active]);
    }
  }

  if (!open) {
    return (
      <FloatingIconButton onClick={() => setOpen(true)} aria-label="Search" title="Search">
        {searchIcon}
      </FloatingIconButton>
    );
  }

  const placeholder = MODES.find((m) => m.id === mode)!.placeholder;
  const center = getCenter();

  return (
    // Phones: spans the top of the screen (over the map controls). Larger screens: 320px wide.
    <div ref={rootRef} className="max-sm:fixed max-sm:inset-x-4 max-sm:top-4 max-sm:z-30 relative sm:w-80">
      {/* invisible buffer so near-misses don't drop a pin, like the menus (the left side
          stops at the filter button's edge so it doesn't cover it) */}
      <div className="absolute -top-4 -right-4 -bottom-4 -left-2" aria-hidden />

      <div className="floating relative flex h-10 items-center gap-2 rounded-lg pr-1 pl-3">
        <span className="text-muted">{searchIcon}</span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label={placeholder}
          role="combobox"
          aria-expanded={!!results?.length}
          aria-controls={listId}
          aria-activedescendant={results?.length ? `${listId}-${active}` : undefined}
          autoComplete="off"
          enterKeyHint="search"
          // 16px on phones so iOS doesn't zoom into the field
          className="min-w-0 flex-1 bg-transparent text-base text-fg placeholder:text-muted focus:outline-none sm:text-sm [&::-webkit-search-cancel-button]:hidden"
        />
        <button
          type="button"
          onClick={() => {
            if (query) {
              setQuery("");
              inputRef.current?.focus();
            } else close();
          }}
          aria-label={query ? "Clear search" : "Close search"}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-fg hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
        >
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
            <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
          </svg>
        </button>
      </div>

      <div className="floating relative mt-2 rounded-lg p-1">
        <div role="tablist" aria-label="Search for" className="flex gap-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => {
                setMode(m.id);
                inputRef.current?.focus();
              }}
              className={`h-8 flex-1 rounded-md text-sm font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
                mode === m.id ? "bg-surface-2 text-fg" : "text-muted hover:text-fg"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {q.length >= MIN_CHARS && (
          <div className="no-scrollbar mt-1 max-h-[min(20rem,calc(100dvh-10rem))] overflow-y-auto">
            {results?.length ? (
              <ul id={listId} role="listbox" aria-label="Results">
                {results.map((r, i) => (
                  <li
                    key={r.kind === "place" ? r.place.id : r.post.id}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()} // keep focus in the field
                    onClick={() => pick(r)}
                    className={`cursor-pointer rounded-md px-3 py-2 ${i === active ? "bg-surface-2" : ""}`}
                  >
                    {r.kind === "place" ? (
                      <>
                        <div className="truncate text-sm text-fg">{r.place.name}</div>
                        {r.place.detail && <div className="truncate text-xs text-muted">{r.place.detail}</div>}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: categoryColor(r.post.category) }} />
                          <span className="truncate text-sm text-fg">{r.post.title}</span>
                        </div>
                        <div className="truncate pl-4.5 text-xs text-muted">
                          {formatDistance(distanceKm(center, r.post))} away{r.post.body ? ` · ${r.post.body}` : ""}
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 py-2 text-sm text-muted" role="status">
                {loading || results === null
                  ? "Searching…"
                  : (error ?? (mode === "posts" && filter.size ? "No matching posts in the filtered categories" : "No results"))}
              </p>
            )}
            {mode === "places" && results?.length ? (
              <p className="px-3 pt-1 pb-1.5 text-xs text-muted">Places by Photon · © OpenStreetMap</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

// Before the search function is installed: match the posts already loaded around the map
function searchLoaded(posts: Post[], q: string, center: { lat: number; lng: number }) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return posts
    .filter((p) => {
      const text = `${p.title} ${p.body ?? ""} ${p.category}`.toLowerCase();
      return words.every((w) => text.includes(w));
    })
    .sort((a, b) => distanceKm(center, a) - distanceKm(center, b))
    .slice(0, 30);
}
