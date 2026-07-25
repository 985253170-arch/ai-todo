import { mockAuthAdapter } from "./authService.mock-adapter";
import { realAuthAdapter } from "./authService.real";
import { toAuthError } from "@/lib/auth-errors";
import type {
  AuthResult,
  AuthSessionEvent,
  AuthUser,
  PasswordSignInInput,
  SendOtpInput,
  SetPasswordInput,
  VerifyOtpInput,
  SendRecoveryOtpInput, VerifyRecoveryOtpInput, UpdateRecoveryPasswordInput, RecoveryOtpDelivery,
} from "@/types/app";

export type AuthFacade = {
  sendOtp(input: SendOtpInput): Promise<AuthResult<void>>;
  verifyOtp(input: VerifyOtpInput): Promise<AuthResult<AuthUser>>;
  signInWithPassword(input: PasswordSignInInput): Promise<AuthResult<AuthUser>>;
  setPassword(input: SetPasswordInput): Promise<AuthResult<AuthUser>>;
  sendRecoveryOtp(input: SendRecoveryOtpInput): Promise<AuthResult<RecoveryOtpDelivery>>;
  verifyRecoveryOtp(input: VerifyRecoveryOtpInput): Promise<AuthResult<AuthUser>>;
  updateRecoveryPassword(input: UpdateRecoveryPasswordInput): Promise<AuthResult<AuthUser>>;
  getCurrentUser(): Promise<AuthResult<AuthUser | null>>;
  signOut(): Promise<AuthResult<void>>;
  subscribeAuthState(listener: (event: AuthSessionEvent) => void): () => void;
};

const configured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
const requestedMode = process.env.NEXT_PUBLIC_QINGXING_AUTH_MODE;
const production = process.env.NODE_ENV === "production";
const unavailable: AuthFacade = {
  async sendOtp() { return { ok: false, error: toAuthError(new Error("not-configured"), "send-otp") }; },
  async verifyOtp() { return { ok: false, error: toAuthError(new Error("not-configured"), "verify-otp") }; },
  async signInWithPassword() { return { ok: false, error: toAuthError(new Error("not-configured"), "password-sign-in") }; },
  async setPassword() { return { ok: false, error: toAuthError(new Error("not-configured"), "set-password") }; },
  async sendRecoveryOtp() { return { ok: false, error: toAuthError(new Error("not-configured"), "send-recovery-otp") }; },
  async verifyRecoveryOtp() { return { ok: false, error: toAuthError(new Error("not-configured"), "verify-recovery-otp") }; },
  async updateRecoveryPassword() { return { ok: false, error: toAuthError(new Error("not-configured"), "update-recovery-password") }; },
  async getCurrentUser() { return { ok: false, error: toAuthError(new Error("not-configured"), "get-current-user") }; },
  async signOut() { return { ok: false, error: toAuthError(new Error("not-configured"), "sign-out") }; },
  subscribeAuthState() { return () => {}; },
};

const facade: AuthFacade = production
  ? requestedMode === "real" && configured ? realAuthAdapter : unavailable
  : requestedMode === undefined || requestedMode === "mock"
    ? mockAuthAdapter
    : requestedMode === "real" && configured
      ? realAuthAdapter
      : unavailable;

export function getAuthFacade(): AuthFacade {
  return facade;
}
