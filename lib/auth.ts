// Email sign-in on top of guest accounts.
//
// Everyone starts as a guest (an anonymous Supabase account created the first time
// they post or save). Signing in with email works one of two ways:
//  * "upgrade": the guest adds an email to their current account. Same account,
//    so their posts and saves simply stay put.
//  * "signin": the email already has an account (or there's no guest yet). The guest
//    first gets a one-time transfer token; after signing in, the token moves their
//    posts, saves and comments into the email account (supabase/008_email_accounts.sql).
//
// Supabase emails either a code or a link depending on the email template, so both work:
// type the code into the app, or open the link (which lands on /settings and signs in).

import { supabase } from "./supabase";

export type SignInMode = "upgrade" | "signin";

const TRANSFER_KEY = "mb-guest-transfer"; // pending transfer token, kept until claimed
const NOT_CONFIGURED = "Supabase isn't configured yet. See the README.";

const redirectTo = () => `${window.location.origin}/settings`;

function isEmailTaken(error: { code?: string; message: string }) {
  return error.code === "email_exists" || /already (been )?registered|already exists/i.test(error.message);
}

// Step 1: send a sign-in code/link to the email
export async function startEmailSignIn(
  email: string
): Promise<{ mode: SignInMode; existingAccount: boolean; error: null } | { error: string }> {
  if (!supabase) return { error: NOT_CONFIGURED };
  const { data } = await supabase.auth.getSession();
  const isGuest = data.session?.user.is_anonymous ?? false;
  let existingAccount = false;

  if (isGuest) {
    const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: redirectTo() });
    if (!error) return { mode: "upgrade", existingAccount: false, error: null };
    if (!isEmailTaken(error)) return { error: error.message };

    // The email belongs to another account: remember this guest so its posts can move over
    existingAccount = true;
    const { data: token, error: tokenError } = await supabase.rpc("create_guest_transfer");
    if (tokenError) return { error: tokenError.message };
    try {
      localStorage.setItem(TRANSFER_KEY, token as string);
    } catch {}
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo(), shouldCreateUser: true },
  });
  if (error) return { error: error.message };
  return { mode: "signin", existingAccount, error: null };
}

// Step 2: check the code from the email. Returns how many guest posts were moved (if any).
export async function verifyEmailCode(
  email: string,
  code: string,
  mode: SignInMode
): Promise<{ moved: number; error: string | null }> {
  if (!supabase) return { moved: 0, error: NOT_CONFIGURED };
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: code.trim(),
    type: mode === "upgrade" ? "email_change" : "email",
  });
  if (error) {
    return {
      moved: 0,
      error: /expired|invalid/i.test(error.message) ? "That code is wrong or has expired. Try again or resend it." : error.message,
    };
  }
  return { moved: await claimPendingTransfer(), error: null };
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
