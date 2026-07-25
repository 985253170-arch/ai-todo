import type { AuthError, AuthErrorCode } from "@/types/app";

const recoveryOperationCodes: Partial<Record<string, AuthErrorCode>> = {
  "send-recovery-otp": "recovery-request-failed",
  "verify-recovery-otp": "recovery-verify-failed",
  "update-recovery-password": "recovery-password-update-failed",
};

const userMessages: Record<AuthErrorCode, string> = {
  "not-configured": "登录暂未准备好，请稍后再试。",
  "rate-limited": "操作有些频繁，请稍后再试。",
  "network-error": "网络似乎不太稳定，请检查后重试。",
  "session-expired": "登录状态已过期，请重新开始。",
  "invalid-otp": "验证码不正确或已过期，请重新输入。",
  "invalid-credentials": "邮箱或密码不正确，请再试一次。",
  "invalid-email": "邮箱地址好像不太对，请检查后重试。",
  "unknown-auth-error": "暂时没能完成，请稍后再试。",
  "recovery-request-failed": "暂时无法发送恢复验证码，请稍后再试。",
  "recovery-verify-failed": "恢复验证码验证失败，请重新获取后再试。",
  "recovery-session-invalid": "恢复登录状态已失效，请重新开始。",
  "recovery-password-update-failed": "暂时无法更新密码，请稍后再试。",
  "recovery-marker-invalid": "恢复登录状态已失效，请重新开始。",
  "recovery-sign-out-failed": "暂时无法安全退出当前登录状态，请稍后再试。",
  "recovery-evidence-timeout": "暂时无法确认恢复登录状态，请重新开始。",
  "recovery-storage-unavailable": "当前浏览器无法保存恢复登录状态，请检查后重试。",
};

export function createAuthError(code: AuthErrorCode, operation: string, retryable = true): AuthError {
  return { code, userMessage: userMessages[code], retryable, operation };
}

export function toAuthError(error: unknown, operation: string): AuthError {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("not-configured")) return createAuthError("not-configured", operation, false);

  const recoveryCode = recoveryOperationCodes[operation];
  if (recoveryCode) return createAuthError(recoveryCode, operation);

  if (message.includes("rate") || message.includes("too many")) return createAuthError("rate-limited", operation);
  if (message.includes("network") || message.includes("fetch")) return createAuthError("network-error", operation);
  if (message.includes("expired") || message.includes("session")) return createAuthError("session-expired", operation);
  if (message.includes("otp") || message.includes("token")) return createAuthError("invalid-otp", operation);
  if (message.includes("credential") || message.includes("password")) return createAuthError("invalid-credentials", operation);
  if (message.includes("email")) return createAuthError("invalid-email", operation);
  return createAuthError("unknown-auth-error", operation);
}
