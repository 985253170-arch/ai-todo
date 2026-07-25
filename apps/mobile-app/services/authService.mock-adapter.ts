import { getCurrentUser, loginWithOtp, loginWithPassword, logout } from "./authService.mock";
import { delay } from "./serviceDelay";
import { createAuthError, toAuthError } from "@/lib/auth-errors";
import type { AuthResult, AuthSessionEvent, AuthUser, OtpIntent, PasswordSignInInput, SendOtpInput, SendRecoveryOtpInput, SetPasswordInput, UpdateRecoveryPasswordInput, VerifyOtpInput, VerifyRecoveryOtpInput, RecoveryOtpDelivery } from "@/types/app";

let currentSession: AuthUser | null = null;
let pendingOtp: { normalizedEmail: string; intent: OtpIntent | "recovery" } | null = null;
let activeRecoveryUserId: string | null = null;
const listeners = new Set<(event: AuthSessionEvent) => void>();
const emailPattern = /^\S+@\S+\.\S+$/;
const notify = (type: AuthSessionEvent["type"]) => listeners.forEach((listener) => listener({ type, user: currentSession }));
const normalized = (email: string) => email.trim().toLowerCase();
const user = (email: string, passwordSet: boolean): AuthUser => ({ id: `mock:${email}`, email, passwordSet });
const invalid = <T,>(operation: string, code: "invalid-email" | "invalid-otp" | "session-expired") => ({ ok: false as const, error: toAuthError(new Error(code), operation) }) as AuthResult<T>;

export const mockAuthAdapter = {
  async sendOtp(input: SendOtpInput): Promise<AuthResult<void>> { const email = normalized(input.email); if (!emailPattern.test(email)) return invalid("send-otp", "invalid-email"); await delay(); pendingOtp = { normalizedEmail: email, intent: input.intent }; return { ok: true, data: undefined }; },
  async verifyOtp(input: VerifyOtpInput): Promise<AuthResult<AuthUser>> { const email = normalized(input.email); if (!pendingOtp) return invalid("verify-otp", "session-expired"); if (!/^\d{6}$/.test(input.code) || !emailPattern.test(email) || email !== pendingOtp.normalizedEmail || input.intent !== pendingOtp.intent) return invalid("verify-otp", !emailPattern.test(email) ? "invalid-email" : "invalid-otp"); await loginWithOtp(email); currentSession = user(email, false); activeRecoveryUserId = null; pendingOtp = null; notify("SIGNED_IN"); return { ok: true, data: currentSession }; },
  async signInWithPassword(input: PasswordSignInInput): Promise<AuthResult<AuthUser>> { const email = normalized(input.email); if (!emailPattern.test(email)) return invalid("password-sign-in", "invalid-email"); await loginWithPassword(email, input.password); currentSession = user(email, true); activeRecoveryUserId = null; notify("SIGNED_IN"); return { ok: true, data: currentSession }; },
  async setPassword(input: SetPasswordInput): Promise<AuthResult<AuthUser>> { void input.password; if (!currentSession) return invalid("set-password", "session-expired"); currentSession = { ...currentSession, passwordSet: true }; notify("USER_UPDATED"); return { ok: true, data: currentSession }; },
  async sendRecoveryOtp(input: SendRecoveryOtpInput): Promise<AuthResult<RecoveryOtpDelivery>> { const email = normalized(input.email); if (!emailPattern.test(email)) return invalid("send-recovery-otp", "invalid-email"); await delay(); pendingOtp = { normalizedEmail: email, intent: "recovery" }; return { ok: true, data: { resendAfterSeconds: 60 } }; },
  async verifyRecoveryOtp(input: VerifyRecoveryOtpInput): Promise<AuthResult<AuthUser>> { const email = normalized(input.email); if (!pendingOtp || pendingOtp.intent !== "recovery") return { ok: false, error: createAuthError("recovery-session-invalid", "verify-recovery-otp") }; if (!/^\d{6}$/.test(input.code) || !emailPattern.test(email) || email !== pendingOtp.normalizedEmail) return { ok: false, error: toAuthError(new Error(!emailPattern.test(email) ? "invalid-email" : "invalid-otp"), "verify-recovery-otp") }; currentSession = user(email, false); activeRecoveryUserId = currentSession.id; pendingOtp = null; notify("PASSWORD_RECOVERY"); return { ok: true, data: currentSession }; },
  async updateRecoveryPassword(input: UpdateRecoveryPasswordInput): Promise<AuthResult<AuthUser>> { void input.password; if (!currentSession || activeRecoveryUserId !== currentSession.id) return { ok: false, error: createAuthError("recovery-session-invalid", "update-recovery-password") }; currentSession = { ...currentSession, passwordSet: true }; notify("USER_UPDATED"); return { ok: true, data: currentSession }; },
  async getCurrentUser(): Promise<AuthResult<AuthUser | null>> { if (!currentSession) return { ok: true, data: null }; await getCurrentUser(); return { ok: true, data: currentSession }; },
  async signOut(): Promise<AuthResult<void>> { await logout(); currentSession = null; activeRecoveryUserId = null; pendingOtp = null; notify("SIGNED_OUT"); return { ok: true, data: undefined }; },
  subscribeAuthState(listener: (event: AuthSessionEvent) => void) {
    listeners.add(listener);
    listener({ type: "INITIAL_SESSION", user: currentSession });
    return () => listeners.delete(listener);
  },
};
