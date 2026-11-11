"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { claimPendingTransfer } from "@/lib/auth";

// Who's signed in. `email` is null for guests and for visitors who haven't posted yet.
type Account = { ready: boolean; email: string | null; isGuest: boolean };

const AuthContext = createContext<Account>({ ready: false, email: null, isGuest: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<Account>({ ready: false, email: null, isGuest: true });

  useEffect(() => {
    if (!supabase) {
      setAccount({ ready: true, email: null, isGuest: true });
      return;
    }
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      setAccount({ ready: true, email: user && !user.is_anonymous ? (user.email ?? null) : null, isGuest: !user || !!user.is_anonymous });
      // Signed in by opening the email link (rather than typing the code): finish any guest transfer.
      // Deferred so it runs outside Supabase's auth callback.
      if (user && !user.is_anonymous) setTimeout(() => claimPendingTransfer(), 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={account}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
