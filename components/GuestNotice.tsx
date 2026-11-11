"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";

// Shown on Profile to guests: their posts only live in this browser until they sign in
export default function GuestNotice() {
  const { ready, isGuest } = useAuth();
  if (!ready || !isGuest) return null;
  return (
    <p className="text-sm text-muted">
      You&apos;re using a guest account, so your posts and saves only live in this browser.{" "}
      <Link href="/settings" className="link">
        Sign in with email
      </Link>{" "}
      to keep them on any device.
    </p>
  );
}
