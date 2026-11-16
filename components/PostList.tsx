"use client";

import { Dispatch, ReactNode, SetStateAction, useCallback, useEffect, useState } from "react";

type Fetcher<T> = () => Promise<{ items: T[]; error: string | null }>;

// Loads a list (posts, comments...) and reports its length (for the Profile tab counts).
// `reload` refetches after a change, e.g. editing a post.
export function useList<T>(
  fetcher: Fetcher<T>,
  onCount?: (n: number) => void
): {
  items: T[] | null; // null while loading
  setItems: Dispatch<SetStateAction<T[] | null>>;
  error: string | null;
  reload: () => Promise<void>;
} {
  const [items, setItems] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await fetcher();
    setItems(res.items);
    setError(res.error);
  }, [fetcher]);

  // First load. State is only set once the request finishes (and not after unmounting).
  useEffect(() => {
    let alive = true;
    fetcher().then((res) => {
      if (!alive) return;
      setItems(res.items);
      setError(res.error);
    });
    return () => {
      alive = false;
    };
  }, [fetcher]);

  useEffect(() => {
    if (items) onCount?.(items.length);
  }, [items, onCount]);

  return { items, setItems, error, reload };
}

// Loading / error / empty states around a list of rows
export function ListState<T>({
  items,
  error,
  empty,
  children,
}: {
  items: T[] | null;
  error: string | null;
  empty: ReactNode;
  children: (item: T) => ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      {items === null && <p className="text-sm text-muted">Loading…</p>}
      {error && (
        <p role="alert" className="rounded-lg bg-danger/10 p-4 text-sm text-danger">
          {error}
        </p>
      )}
      {items && !error && items.length === 0 && <div className="card p-6 text-center text-sm text-muted">{empty}</div>}
      {items?.map(children)}
    </section>
  );
}
