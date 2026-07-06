"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import type { AuthUser } from "@/lib/types";

function toAuthUser(
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null,
): AuthUser | null {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? null,
    metadata: {
      password_set: Boolean(user.user_metadata?.password_set),
    },
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

  async function sendOtp(email: string, captchaToken?: string) {
    if (!supabase) {
      throw new Error("AUTH_NOT_CONFIGURED");
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, captchaToken },
    });

    if (error) {
      logSafeAuthError(error);
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
      logSafeAuthError(error);
      throw error;
    }

    setUser(toAuthUser(data.user));
  }

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

  async function signInWithPassword(
    email: string,
    password: string,
    captchaToken?: string,
  ) {
    if (!supabase) {
      throw new Error("AUTH_NOT_CONFIGURED");
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken },
    });

    if (error) {
      logSafeAuthError(error);
      throw error;
    }

    let signedInUser = data.user;

    if (!data.user.user_metadata?.password_set) {
      await supabase.auth
        .updateUser({
          data: { password_set: true },
        })
        .then(({ data: updateData }) => {
          signedInUser = updateData.user ?? signedInUser;
        })
        .catch(() => {
          signedInUser = {
            ...signedInUser,
            user_metadata: {
              ...signedInUser.user_metadata,
              password_set: true,
            },
          };
        });
    }

    setUser(toAuthUser(signedInUser));
  }

  async function setPassword(password: string) {
    if (!supabase) {
      throw new Error("AUTH_NOT_CONFIGURED");
    }

    const { data, error } = await supabase.auth.updateUser({
      password,
      data: { password_set: true },
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

  async function sendResetPasswordOtp(email: string, captchaToken?: string) {
    if (!supabase) {
      throw new Error("AUTH_NOT_CONFIGURED");
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      captchaToken,
    });

    if (error) {
      logSafeAuthError(error);

      if (
        error.message?.toLowerCase().includes("rate limit") ||
        error.message?.toLowerCase().includes("too many requests")
      ) {
        throw error;
      }

      return;
    }
  }

  async function sendResetPasswordEmail(email: string, captchaToken?: string) {
    return sendResetPasswordOtp(email, captchaToken);
  }

  return {
    user,
    isLoading,
    sendOtp,
    verifyOtp,
    signInWithPassword,
    signUp,
    setPassword,
    signOut,
    sendResetPasswordEmail,
    sendResetPasswordOtp,
  };
}



