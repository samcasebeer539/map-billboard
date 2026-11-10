"use client";

import { Dispatch, ReactNode, SetStateAction, useCallback, useEffect, useState } from "react";
import type { Post } from "@/lib/supabase";

// Loads a list of posts and reports its length (for the Profile tab counts)
export function usePostList(
  fetcher: () => Promise<{ posts: Post[]; error: string | null }>,
  onCount?: (n: number) => void
): {
  posts: Post[] | null;
  setPosts: Dispatch<SetStateAction<Post[] | null>>;
  error: string | null;
  reload: () => Promise<void>;
} {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await fetcher();
    setPosts(res.posts);
    setError(res.error);
  }, [fetcher]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (posts) onCount?.(posts.length);
  }, [posts, onCount]);

  return { posts, setPosts, error, reload };
}

// Loading / error / empty states around a list of post rows
export function PostList({
  posts,
  error,
  empty,
  children,
}: {
  posts: Post[] | null;
  error: string | null;
  empty: ReactNode;
  children: (post: Post) => ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      {posts === null && <p className="text-sm text-muted">Loading…</p>}
      {error && (
        <p role="alert" className="rounded-lg bg-danger/10 p-4 text-sm text-danger">
          {error}
        </p>
      )}
      {posts && !error && posts.length === 0 && <div className="card p-6 text-center text-sm text-muted">{empty}</div>}
      {posts?.map(children)}
    </section>
  );
}
