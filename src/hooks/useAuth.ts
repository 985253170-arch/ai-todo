"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type { AuthUser } from "@/lib/types";

function toAuthUser(user: { id: string; email?: string } | null): AuthUser | null {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? null,
  };
}

function logSafeAuthError(error: { message?: string; name?: string; status?: number }) {
  console.error("Supabase auth error", {
    message: error.message,
    name: error.name,
    status: error.status,
  });
}

export function useAuth() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(() => Boolean(supabase));

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isMounted = true;

    void supabase.auth.getUser().then(({ data }) => {
      if (!isMounted) {
        return;
      }

      setUser(toAuthUser(data.user));
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(toAuthUser(session?.user ?? null));
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function signUp(email: string, password: string) {
    if (!supabase) {
      throw new Error("AUTH_NOT_CONFIGURED");
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      logSafeAuthError(error);
      throw error;
    }
  }

  async function signIn(email: string, password: string) {
    if (!supabase) {
      throw new Error("AUTH_NOT_CONFIGURED");
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      logSafeAuthError(error);
      throw error;
    }

    setUser(toAuthUser(data.user));
  }

  async function signOut() {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    setUser(null);
  }

  return {
    user,
    isLoading,
    signUp,
    signIn,
    signOut,
  };
}
