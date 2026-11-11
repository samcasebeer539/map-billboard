"use client";

import { FormEvent, useEffect, useState } from "react";
import Field from "./Field";
import { useAuth } from "./AuthProvider";
import { SignInMode, signOut, startEmailSignIn, verifyEmailCode } from "@/lib/auth";

const RESEND_SECONDS = 60; // Supabase allows one email per minute per address

// Settings → account: sign in with an email code, or show who's signed in.
export default function AccountCard() {
  const { ready, email: signedInEmail, isGuest } = useAuth();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<SignInMode>("upgrade");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Count down until "Resend" is allowed again
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    const res = await startEmailSignIn(email.trim());
    setBusy(false);
    if ("mode" in res) {
      setMode(res.mode);
      setNotice(res.existingAccount ? "That email already has an account. Signing in will move your posts from this device into it." : null);
      setStep("code");
      setCode("");
      setCooldown(RESEND_SECONDS);
    } else {
      setError(res.error);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await verifyEmailCode(email.trim(), code, mode);
    setBusy(false);
    if (res.error) return setError(res.error);
    setStep("email");
    setNotice(res.moved > 0 ? `Moved ${res.moved} ${res.moved === 1 ? "post" : "posts"} from this device into your account.` : null);
  }

  async function handleSignOut() {
    setBusy(true);
    const err = await signOut();
    setBusy(false);
    if (err) setError(err);
    setNotice(null);
  }

  if (!ready) return null;

  // Signed in with email
  if (!isGuest && signedInEmail) {
    return (
      <div className="card flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm">Signed in</div>
            <div className="truncate text-xs text-muted">{signedInEmail}</div>
          </div>
          <button type="button" onClick={handleSignOut} disabled={busy} className="btn-ghost -mr-2">
            Sign out
          </button>
        </div>
        {notice && <p className="text-sm text-muted">{notice}</p>}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }

  // Guest (or not signed in yet)
  return (
    <div className="card flex flex-col gap-4 p-4">
      <div>
        <div className="text-sm">Sign in with email</div>
        <p className="text-xs text-muted">
          Keep your posts and saves on any device. No password, we&apos;ll email you a code.
        </p>
      </div>

      {step === "email" ? (
        <form onSubmit={send} className="flex flex-col gap-4">
          <Field id="account-email" label="Email">
            <input
              id="account-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input"
            />
          </Field>
          <div className="flex justify-end">
            <button type="submit" disabled={busy || !email.trim()} className="btn-primary">
              {busy ? "Sending…" : "Send code"}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            We emailed <span className="text-fg">{email}</span>. Enter the code, or open the link in that email on this
            device.
          </p>
          {notice && <p className="text-sm text-muted">{notice}</p>}
          <Field id="account-code" label="Code">
            <input
              id="account-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="input tracking-widest tabular-nums"
              autoFocus
            />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="-ml-3 flex gap-1">
              <button type="button" onClick={() => setStep("email")} className="btn-ghost-sm">
                Change email
              </button>
              <button type="button" onClick={() => send()} disabled={busy || cooldown > 0} className="btn-ghost-sm">
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend"}
              </button>
            </div>
            <button type="submit" disabled={busy || code.length < 6} className="btn-primary">
              {busy ? "Checking…" : "Verify"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
