export type TaskStatus = "current" | "locked" | "completed";

export interface Task {
  id: string;
  title: string;
  details?: string[];
  estimatedMinutes?: number;
  status: TaskStatus;
  completedAt?: string;
}

export interface TodayState {
  goal: string;
  tasks: Task[];
  completedCount: number;
  totalCount: number;
}

export interface CompanionStep {
  taskId: string;
  taskTitle: string;
  stepTitle: string;
  steps: string[];
  closingText: string;
}

export interface HistoryTask {
  title: string;
  completed: boolean;
}

export interface HistoryItem {
  id: string;
  dateLabel: string;
  goal: string;
  completionRate: number;
  completedCount: number;
  totalCount: number;
  expanded: boolean;
  tasks: HistoryTask[];
}

export type HistoryRange = "7d" | "30d";

export interface GrowthStats {
  todayCompletionRate: number;
  weekCompletionRate: number;
  streakDays: number;
  totalCompleted: number;
  statusLabel: string;
  summaryText: string;
  suggestionTitle: string;
  suggestionText: string;
}

export interface MockUser {
  email: string;
  isLoggedIn: boolean;
  syncStatus: "synced" | "not_synced";
}

export interface RegisterInput {
  email: string;
  code: string;
  password: string;
  confirmPassword: string;
}

export type LoadingState = "idle" | "loading" | "success" | "error";
export type AuthMode = "mock" | "real";
export type AuthStatus = "initializing" | "guest" | "authenticating" | "authenticated-needs-password" | "authenticated" | "signing-out" | "recovery-signout-pending" | "error";
export type AuthScreen = "welcome" | "otp-login" | "password-login" | "register" | "password-setup";
export type OtpIntent = "sign-in" | "sign-up";
export interface AuthUser { id: string; email: string; passwordSet: boolean; }
export type AuthErrorCode =
  | "not-configured"
  | "rate-limited"
  | "network-error"
  | "session-expired"
  | "invalid-otp"
  | "invalid-credentials"
  | "invalid-email"
  | "unknown-auth-error"
  | "recovery-request-failed"
  | "recovery-verify-failed"
  | "recovery-session-invalid"
  | "recovery-password-update-failed"
  | "recovery-marker-invalid"
  | "recovery-sign-out-failed"
  | "recovery-evidence-timeout"
  | "recovery-storage-unavailable";
export interface AuthError { code: AuthErrorCode; userMessage: string; retryable: boolean; operation: string; }
export type AuthResult<T> = { ok: true; data: T } | { ok: false; error: AuthError };
export interface SendOtpInput { email: string; intent: OtpIntent; }
export interface VerifyOtpInput { email: string; code: string; intent: OtpIntent; }
export interface PasswordSignInInput { email: string; password: string; }
export interface SetPasswordInput { password: string; }
export interface SendRecoveryOtpInput { email: string; }
export interface VerifyRecoveryOtpInput { email: string; code: string; }
export interface UpdateRecoveryPasswordInput { password: string; }
export interface RecoveryOtpDelivery { resendAfterSeconds: 60; }
export type AuthSessionEventType =
  | "INITIAL_SESSION"
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "USER_UPDATED"
  | "PASSWORD_RECOVERY";
export interface AuthSessionEvent { type: AuthSessionEventType; user: AuthUser | null; }
export interface AuthState { status: AuthStatus; user: AuthUser | null; error: AuthError | null; }
export type AppTab = "today" | "footprint" | "growth" | "me";
