// Email + password accounts on top of guest accounts.
//
// Everyone starts as a guest (an anonymous Supabase account created the first time they
// post or save). Creating an account or signing in switches to an email + password account;
// just before that, the guest gets a one-time transfer token, and right after, the token
// moves the guest's posts, saves and comments into the account (supabase/008_email_accounts.sql).
//
// No email is needed to create an account or sign in when "Confirm email" is off in Supabase.
// If it's on, new accounts get a confirmation link (it lands on /settings, signed in), and the
// transfer finishes then. Password resets always send an email.

import { supabase } from "./supabase";

const TRANSFER_KEY = "mb-guest-transfer"; // pending transfer token, kept until claimed
const NOT_CONFIGURED = "Supabase isn't configured yet. See the README.";
export const PASSWORD_MIN = 8;

const redirectTo = () => `${window.location.origin}/settings`;

type AuthError = { code?: string; message: string; status?: number };

function friendly(error: AuthError) {
  switch (error.code) {
    case "invalid_credentials":
      return "Wrong email or password.";
    case "email_not_confirmed":
      return "Confirm your email first: open the link we sent you.";
    case "user_already_exists":
    case "email_exists":
      return "That email already has an account. Sign in instead.";
    case "weak_password":
      return error.message || `Use at least ${PASSWORD_MIN} characters.`;
    case "same_password":
      return "That's your current password. Pick a new one.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Wait a minute and try again.";
  }
  return error.message;
}

// If this browser is a guest, remember it so its posts can move into the account after
// signing in. Never blocks signing in: worst case the guest's posts stay with the guest.
async function prepareGuestTransfer() {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session?.user.is_anonymous) return;
  const { data: token, error } = await supabase.rpc("create_guest_transfer");
  if (error) return console.error("Couldn't prepare guest transfer:", error.message);
  try {
    localStorage.setItem(TRANSFER_KEY, token as string);
  } catch {}
}

export type AuthResult = { error: string } | { error: null; moved: number; needsConfirmation?: boolean };

export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  if (!supabase) return { error: NOT_CONFIGURED };
  await prepareGuestTransfer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: friendly(error) };
  return { error: null, moved: await claimPendingTransfer() };
}

export async function createAccount(email: string, password: string): Promise<AuthResult> {
  if (!supabase) return { error: NOT_CONFIGURED };
  await prepareGuestTransfer();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo() } });
  if (error) return { error: friendly(error) };
  // With "Confirm email" on, Supabase doesn't reveal whether an email is taken: it returns
  // a user with no identities instead of an error
  if (data.user && data.user.identities?.length === 0) return { error: friendly({ code: "user_already_exists", message: "" }) };
  if (!data.session) return { error: null, moved: 0, needsConfirmation: true };
  return { error: null, moved: await claimPendingTransfer() };
}

// Emails a link that lands on /settings, where AccountCard asks for a new password
export async function sendPasswordReset(email: string): Promise<string | null> {
  if (!supabase) return NOT_CONFIGURED;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() });
  return error ? friendly(error) : null;
}

// After a reset link, or to change the password while signed in
export async function setPassword(password: string): Promise<string | null> {
  if (!supabase) return NOT_CONFIGURED;
  const { error } = await supabase.auth.updateUser({ password });
  return error ? friendly(error) : null;
}

// Moves a remembered guest's posts into the signed-in email account. Safe to call any time:
// does nothing unless a transfer is pending and the user has signed in with email.
// Concurrent callers (the code form and the sign-in listener) share one request.
let claiming: Promise<number> | null = null;

export function claimPendingTransfer(): Promise<number> {
  claiming ??= doClaim().finally(() => (claiming = null));
  return claiming;
}

async function doClaim(): Promise<number> {
  if (!supabase) return 0;
  let token: string | null = null;
  try {
    token = localStorage.getItem(TRANSFER_KEY);
  } catch {}
  if (!token) return 0;

  const { data } = await supabase.auth.getSession();
  if (!data.session || data.session.user.is_anonymous) return 0;

  const { data: moved, error } = await supabase.rpc("claim_guest_transfer", { p_token: token });
  if (error) {
    console.error("Couldn't move guest posts:", error.message);
    return 0;
  }
  try {
    localStorage.removeItem(TRANSFER_KEY);
  } catch {}
  return (moved as number) ?? 0;
}

export async function signOut(): Promise<string | null> {
  if (!supabase) return NOT_CONFIGURED;
  const { error } = await supabase.auth.signOut();
  return error?.message ?? null;
}
