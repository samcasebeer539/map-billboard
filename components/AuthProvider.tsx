"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { claimPendingTransfer } from "@/lib/auth";

// Who's signed in. `email` is null for guests and for visitors who haven't posted yet.
// `recovering`: arrived from a password reset link, so Settings should ask for a new password.
type Account = { ready: boolean; email: string | null; isGuest: boolean; recovering: boolean; endRecovery: () => void };

const AuthContext = createContext<Account>({ ready: false, email: null, isGuest: true, recovering: false, endRecovery: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState({ ready: false, email: null as string | null, isGuest: true });
  const [recovering, setRecovering] = useState(false);
  const endRecovery = useCallback(() => setRecovering(false), []);

  useEffect(() => {
    if (!supabase) {
      setAccount({ ready: true, email: null, isGuest: true });
      return;
    }
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      if (event === "SIGNED_OUT") setRecovering(false);
      const user = session?.user;
      setAccount({ ready: true, email: user && !user.is_anonymous ? (user.email ?? null) : null, isGuest: !user || !!user.is_anonymous });
      // Signed in, possibly by opening a confirmation link: finish any guest transfer.
      // Deferred so it runs outside Supabase's auth callback.
      if (user && !user.is_anonymous) setTimeout(() => claimPendingTransfer(), 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo(() => ({ ...account, recovering, endRecovery }), [account, recovering, endRecovery]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
