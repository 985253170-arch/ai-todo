import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import { createAuthError, toAuthError } from "@/lib/auth-errors";
import type { AuthResult, AuthSessionEvent, AuthUser, PasswordSignInInput, SendOtpInput, SendRecoveryOtpInput, SetPasswordInput, UpdateRecoveryPasswordInput, VerifyOtpInput, VerifyRecoveryOtpInput, RecoveryOtpDelivery } from "@/types/app";

const unavailable = <T,>(operation: string): AuthResult<T> => ({ ok: false, error: toAuthError(new Error("not-configured"), operation) });
const mapUser = (user: { id?: string; email?: string | null; user_metadata?: Record<string, unknown> } | null): AuthUser | null => {
  const id = user?.id?.trim();
  const email = user?.email?.trim();
  return id && email
    ? { id, email, passwordSet: user?.user_metadata?.password_set === true }
    : null;
};

export const realAuthAdapter = {
  async sendOtp(input: SendOtpInput): Promise<AuthResult<void>> { const client = getSupabaseBrowserClient(); if (!client) return unavailable("send-otp"); const { error } = await client.auth.signInWithOtp({ email: input.email, options: { shouldCreateUser: input.intent === "sign-up" } }); return error ? { ok: false, error: toAuthError(error, "send-otp") } : { ok: true, data: undefined }; },
  async verifyOtp(input: VerifyOtpInput): Promise<AuthResult<AuthUser>> { const client = getSupabaseBrowserClient(); if (!client) return unavailable("verify-otp"); const { data, error } = await client.auth.verifyOtp({ email: input.email, token: input.code, type: "email" }); const user = mapUser(data.user); return error || !user || !data.session ? { ok: false, error: toAuthError(error ?? new Error("session-expired"), "verify-otp") } : { ok: true, data: user }; },
  async signInWithPassword(input: PasswordSignInInput): Promise<AuthResult<AuthUser>> { const client = getSupabaseBrowserClient(); if (!client) return unavailable("password-sign-in"); const { data, error } = await client.auth.signInWithPassword(input); const user = mapUser(data.user); if (error || !user) return { ok: false, error: toAuthError(error ?? new Error("session-expired"), "password-sign-in") }; void client.auth.updateUser({ data: { password_set: true } }).catch(() => undefined); return { ok: true, data: { ...user, passwordSet: true } }; },
  async setPassword(input: SetPasswordInput): Promise<AuthResult<AuthUser>> { const client = getSupabaseBrowserClient(); if (!client) return unavailable("set-password"); const { data, error } = await client.auth.updateUser({ password: input.password, data: { password_set: true } }); const user = mapUser(data.user); return error || !user ? { ok: false, error: toAuthError(error ?? new Error("session-expired"), "set-password") } : { ok: true, data: { ...user, passwordSet: true } }; },
  async sendRecoveryOtp(input: SendRecoveryOtpInput): Promise<AuthResult<RecoveryOtpDelivery>> { const client = getSupabaseBrowserClient(); if (!client) return unavailable("send-recovery-otp"); const { error } = await client.auth.resetPasswordForEmail(input.email); return error ? { ok: false, error: toAuthError(error, "send-recovery-otp") } : { ok: true, data: { resendAfterSeconds: 60 } }; },
  async verifyRecoveryOtp(input: VerifyRecoveryOtpInput): Promise<AuthResult<AuthUser>> { const client = getSupabaseBrowserClient(); if (!client) return unavailable("verify-recovery-otp"); const { data, error } = await client.auth.verifyOtp({ email: input.email, token: input.code, type: "recovery" }); const user = mapUser(data.user); if (error) return { ok: false, error: toAuthError(error, "verify-recovery-otp") }; return !user || !data.session ? { ok: false, error: createAuthError("recovery-session-invalid", "verify-recovery-otp") } : { ok: true, data: user }; },
  async updateRecoveryPassword(input: UpdateRecoveryPasswordInput): Promise<AuthResult<AuthUser>> { const client = getSupabaseBrowserClient(); if (!client) return unavailable("update-recovery-password"); const { data, error } = await client.auth.updateUser({ password: input.password, data: { password_set: true } }); const user = mapUser(data.user); return error || !user ? { ok: false, error: toAuthError(error ?? new Error("session-expired"), "update-recovery-password") } : { ok: true, data: { ...user, passwordSet: true } }; },
  async getCurrentUser(): Promise<AuthResult<AuthUser | null>> { const client = getSupabaseBrowserClient(); if (!client) return unavailable("get-current-user"); const { data, error } = await client.auth.getUser(); return error ? { ok: false, error: toAuthError(error, "get-current-user") } : { ok: true, data: mapUser(data.user) }; },
  async signOut(): Promise<AuthResult<void>> { const client = getSupabaseBrowserClient(); if (!client) return unavailable("sign-out"); const { error } = await client.auth.signOut({ scope: "local" }); return error ? { ok: false, error: toAuthError(error, "sign-out") } : { ok: true, data: undefined }; },
  subscribeAuthState(listener: (event: AuthSessionEvent) => void) {
    const client = getSupabaseBrowserClient();
    if (!client) return () => {};

    const supportedEvents = new Set<AuthSessionEvent["type"]>([
      "INITIAL_SESSION", "SIGNED_IN", "SIGNED_OUT", "TOKEN_REFRESHED", "USER_UPDATED", "PASSWORD_RECOVERY",
    ]);
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (!supportedEvents.has(event as AuthSessionEvent["type"])) return;
      listener({ type: event as AuthSessionEvent["type"], user: mapUser(session?.user ?? null) });
    });
    return () => subscription.unsubscribe();
  },
};
