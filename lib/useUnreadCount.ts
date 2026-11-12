"use client";

import { useEffect, useState } from "react";
import { fetchUnreadCount, NOTIFICATIONS_READ_EVENT, supabase } from "./supabase";

const POLL_MS = 60_000;

// Unread notifications for the menu dot. Checks on load, every minute while the tab is
// visible, when you come back to the tab, after signing in/out, and after Notifications is opened.
export function useUnreadCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const check = () => {
      if (document.visibilityState === "visible") fetchUnreadCount().then((n) => alive && setCount(n));
    };
    check();
    const t = setInterval(check, POLL_MS);
    document.addEventListener("visibilitychange", check);
    window.addEventListener(NOTIFICATIONS_READ_EVENT, check);
    const sub = supabase?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") setTimeout(check, 0);
    });
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener(NOTIFICATIONS_READ_EVENT, check);
      sub?.data.subscription.unsubscribe();
    };
  }, []);

  return count;
}
