"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { fetchNotifications, markNotificationsRead, Notification } from "@/lib/supabase";
import { categoryColor } from "@/lib/categories";

// "just now", "5m ago", "3h ago", "2d ago", then the date
function ago(d: string) {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 24 * 60) return `${Math.floor(mins / 60)}h ago`;
  if (mins < 7 * 24 * 60) return `${Math.floor(mins / (24 * 60))}d ago`;
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const who = (n: Notification) => (n.by_poster ? "The poster" : n.author_no ? `Anonymous ${n.author_no}` : "Someone");

// Replies to your comments and comments on your posts, newest first. Opening the page
// marks them read (the "new" dots stay until you leave, so you can see what's new).
export default function NotificationsList() {
  const [items, setItems] = useState<Notification[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchNotifications().then((res) => {
      if (!alive) return;
      setItems(res.items);
      setError(res.error);
      if (!res.error && res.items.some((n) => n.unread)) markNotificationsRead();
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="flex flex-col gap-4">
      {items === null && <p className="text-sm text-muted">Loading…</p>}
      {error && (
        <p role="alert" className="rounded-lg bg-danger/10 p-4 text-sm text-danger">
          {error}
        </p>
      )}
      {items && !error && items.length === 0 && (
        <div className="card p-6 text-center text-sm text-muted">
          Nothing yet. Replies to your comments and comments on your posts will show up here.
        </div>
      )}
      {items?.map((n) => (
        <Row key={n.id} n={n} />
      ))}
    </section>
  );
}

function Row({ n }: { n: Notification }) {
  const linked = n.post_live && n.comments_enabled;
  // Same order as the other cards: category (and badges), headline, text, then the time
  const content = (
    <>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <span className="uppercase tracking-wide" style={{ color: categoryColor(n.post_category) }}>
          {n.post_category}
        </span>
        {n.unread && (
          <span className="flex items-center gap-1.5 text-accent">
            <span aria-hidden className="size-2 rounded-full bg-accent" />
            New
          </span>
        )}
        {!linked && <span className="rounded-full bg-surface-2 px-2 py-0.5">No longer on the map</span>}
      </div>
      <div className="mt-1 text-sm">
        <span className={n.by_poster ? "text-accent" : ""}>{who(n)}</span>
        <span className="text-muted">{n.kind === "reply" ? " replied to your comment on " : " commented on your post "}</span>
        <span className="font-medium">{n.post_title}</span>
      </div>
      {n.your_comment && (
        // What they replied to
        <p className="mt-2 truncate text-xs text-muted">
          <span aria-hidden>↳ </span>You: {n.your_comment}
        </p>
      )}
      <p className="mt-1 whitespace-pre-wrap break-words text-sm">{n.body}</p>
      <div className="mt-2 text-xs text-muted">{ago(n.created_at)}</div>
    </>
  );

  return linked ? (
    // Opens the map at the post with its comments showing and this comment highlighted
    <Link
      href={`/?lat=${n.lat}&lng=${n.lng}&post=${n.post_id}&comments=1&comment=${n.id}`}
      className="card block p-4 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-accent"
    >
      {content}
    </Link>
  ) : (
    <Card>{content}</Card>
  );
}

const Card = ({ children }: { children: ReactNode }) => <article className="card p-4">{children}</article>;
