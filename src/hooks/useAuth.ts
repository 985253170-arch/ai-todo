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

  async function signIn(email: string) {
    if (!supabase) {
      throw new Error("AUTH_NOT_CONFIGURED");
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      throw error;
    }
  }

  async function verifyOtp(email: string, token: string) {
    if (!supabase) {
      throw new Error("AUTH_NOT_CONFIGURED");
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });

    if (error) {
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
    signIn,
    verifyOtp,
    signOut,
  };
}
