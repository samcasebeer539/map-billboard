"use client";

import { FormEvent, ReactNode, useState } from "react";
import Field from "./Field";
import { useAuth } from "./AuthProvider";
import { AuthResult, createAccount, PASSWORD_MIN, sendPasswordReset, setPassword, signInWithPassword, signOut } from "@/lib/auth";

type View = "signin" | "create" | "reset";

const movedNotice = (n: number) => (n > 0 ? `Moved ${n} ${n === 1 ? "post" : "posts"} from this device into your account.` : null);

// Settings → account: sign in or create an account with email + password, reset a forgotten
// password, or (signed in) show who you are, change your password and sign out.
export default function AccountCard() {
  const { ready, email: signedInEmail, isGuest, recovering, endRecovery } = useAuth();
  const [view, setView] = useState<View>("signin");
  const [email, setEmail] = useState("");
  const [password, setPasswordValue] = useState("");
  const [changing, setChanging] = useState(false); // signed in: change-password form open
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function switchView(v: View) {
    setView(v);
    setError(null);
    setNotice(null);
    setPasswordValue("");
  }

  async function run(fn: () => Promise<string | null>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    const err = await fn();
    setBusy(false);
    if (err) setError(err);
  }

  const fromResult = (res: AuthResult) => {
    if (res.error !== null) return res.error;
    setPasswordValue("");
    setNotice(
      res.needsConfirmation
        ? `Almost done: open the link we sent to ${email.trim()} to finish creating your account.`
        : movedNotice(res.moved)
    );
    return null;
  };

  function submitGuest(e: FormEvent) {
    e.preventDefault();
    const em = email.trim();
    if (view === "signin") run(async () => fromResult(await signInWithPassword(em, password)));
    else if (view === "create") run(async () => fromResult(await createAccount(em, password)));
    else
      run(async () => {
        const err = await sendPasswordReset(em);
        if (!err) setNotice(`If ${em} has an account, we've emailed it a link to set a new password.`);
        return err;
      });
  }

  function submitNewPassword(e: FormEvent) {
    e.preventDefault();
    run(async () => {
      const err = await setPassword(password);
      if (err) return err;
      setPasswordValue("");
      setChanging(false);
      endRecovery();
      setNotice("Password updated.");
      return null;
    });
  }

  const errorLine = error && (
    <p role="alert" className="text-sm text-danger">
      {error}
    </p>
  );
  const noticeLine = notice && <p className="text-sm text-muted">{notice}</p>;

  const passwordField = (id: string, label: string, isNew: boolean) => (
    <Field id={id} label={label}>
      <input
        id={id}
        type="password"
        autoComplete={isNew ? "new-password" : "current-password"}
        required
        minLength={isNew ? PASSWORD_MIN : undefined}
        value={password}
        onChange={(e) => setPasswordValue(e.target.value)}
        className="input"
      />
      {isNew && <p className="mt-1.5 text-xs text-muted">At least {PASSWORD_MIN} characters.</p>}
    </Field>
  );

  const newPasswordForm = (submitLabel: string, onCancel?: () => void) => (
    <form onSubmit={submitNewPassword} className="flex flex-col gap-4">
      {passwordField("account-new-password", "New password", true)}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost">
            Cancel
          </button>
        )}
        <button type="submit" disabled={busy || password.length < PASSWORD_MIN} className="btn-primary">
          {busy ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );

  if (!ready) return null;

  // Arrived from a password reset email
  if (recovering) {
    return (
      <Card title="Set a new password" subtitle={signedInEmail ?? undefined}>
        {newPasswordForm("Save password")}
        {errorLine}
      </Card>
    );
  }

  // Signed in with an account
  if (!isGuest && signedInEmail) {
    return (
      <Card
        title="Signed in"
        subtitle={signedInEmail}
        action={
          <button type="button" onClick={() => run(signOut)} disabled={busy} className="btn-ghost -mr-2">
            Sign out
          </button>
        }
      >
        {changing ? (
          newPasswordForm("Change password", () => {
            setChanging(false);
            setPasswordValue("");
            setError(null);
          })
        ) : (
          <div>
            <button
              type="button"
              onClick={() => {
                setChanging(true);
                setNotice(null);
              }}
              className="btn-ghost-sm -ml-3"
            >
              Change password
            </button>
          </div>
        )}
        {noticeLine}
        {errorLine}
      </Card>
    );
  }

  // Guest (or hasn't posted yet)
  const isReset = view === "reset";
  return (
    <Card
      title={isReset ? "Reset your password" : "Account"}
      subtitle={
        isReset
          ? "We'll email you a link to set a new password."
          : "Use your posts and saves on any device. Anything you've posted from this device moves into your account."
      }
    >
      {!isReset && (
        <div role="tablist" aria-label="Account" className="flex gap-1">
          {(
            [
              ["signin", "Sign in"],
              ["create", "Create account"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => switchView(v)}
              className={`h-8 flex-1 rounded-md text-sm font-medium focus-visible:outline-2 focus-visible:outline-accent ${
                view === v ? "bg-surface-2 text-fg" : "text-muted hover:text-fg"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submitGuest} className="flex flex-col gap-4">
        <Field id="account-email" label="Email">
          <input
            id="account-email"
            type="email"
            autoComplete={isReset || view === "signin" ? "username" : "email"}
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="input"
          />
        </Field>
        {view === "signin" && passwordField("account-password", "Password", false)}
        {view === "create" && passwordField("account-password", "Password", true)}

        <div className="flex items-center justify-between gap-2">
          {view === "signin" ? (
            <button type="button" onClick={() => switchView("reset")} className="btn-ghost-sm -ml-3">
              Forgot password?
            </button>
          ) : isReset ? (
            <button type="button" onClick={() => switchView("signin")} className="btn-ghost-sm -ml-3">
              Back to sign in
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={busy || !email.trim() || (view === "signin" && !password) || (view === "create" && password.length < PASSWORD_MIN)}
            className="btn-primary"
          >
            {busy ? "Working…" : view === "signin" ? "Sign in" : view === "create" ? "Create account" : "Send link"}
          </button>
        </div>
      </form>

      {noticeLine}
      {errorLine}
    </Card>
  );
}

function Card({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="card flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm">{title}</div>
          {subtitle && <p className="text-xs break-words text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
