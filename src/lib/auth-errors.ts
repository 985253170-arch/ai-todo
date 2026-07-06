import { AUTH_TEXT } from "@/lib/constants";

export type AuthOperation =
  | "otp"
  | "password"
  | "forgot_password"
  | "reset_password";

const CAPTCHA_ERROR_MESSAGE = "安全验证失败，请刷新页面后重试。";
const RESET_PASSWORD_FALLBACK_MESSAGE = "重置失败，请重新获取验证码后重试。";

const FALLBACK_MESSAGES: Record<AuthOperation, string> = {
  otp: AUTH_TEXT.OTP_INVALID,
  password: AUTH_TEXT.PASSWORD_LOGIN_ERROR,
  forgot_password: AUTH_TEXT.FORGOT_PASSWORD_SUCCESS,
  reset_password: RESET_PASSWORD_FALLBACK_MESSAGE,
};

const AUTH_ERROR_PATTERNS: Array<{
  patterns: string[];
  messages: Record<AuthOperation, string>;
}> = [
  {
    patterns: ["rate limit", "too many requests"],
    messages: {
      otp: AUTH_TEXT.EMAIL_RATE_LIMITED,
      password: AUTH_TEXT.EMAIL_RATE_LIMITED,
      forgot_password: AUTH_TEXT.EMAIL_RATE_LIMITED,
      reset_password: AUTH_TEXT.EMAIL_RATE_LIMITED,
    },
  },
  {
    patterns: ["captcha", "turnstile", "captcha_token", "captcha verification"],
    messages: {
      otp: CAPTCHA_ERROR_MESSAGE,
      password: CAPTCHA_ERROR_MESSAGE,
      forgot_password: CAPTCHA_ERROR_MESSAGE,
      reset_password: CAPTCHA_ERROR_MESSAGE,
    },
  },
  {
    patterns: ["invalid login credentials"],
    messages: {
      otp: AUTH_TEXT.OTP_INVALID,
      password: AUTH_TEXT.PASSWORD_LOGIN_ERROR,
      forgot_password: AUTH_TEXT.FORGOT_PASSWORD_SUCCESS,
      reset_password: RESET_PASSWORD_FALLBACK_MESSAGE,
    },
  },
  {
    patterns: [
      "invalid otp",
      "invalid token",
      "otp has expired",
      "otp expired",
      "token has expired",
      "token expired",
    ],
    messages: {
      otp: AUTH_TEXT.OTP_INVALID,
      password: AUTH_TEXT.PASSWORD_LOGIN_ERROR,
      forgot_password: AUTH_TEXT.FORGOT_PASSWORD_SUCCESS,
      reset_password: AUTH_TEXT.RESET_PASSWORD_OTP_INVALID,
    },
  },
  {
    patterns: ["token", "otp", "expired"],
    messages: {
      otp: AUTH_TEXT.OTP_INVALID,
      password: AUTH_TEXT.PASSWORD_LOGIN_ERROR,
      forgot_password: AUTH_TEXT.FORGOT_PASSWORD_SUCCESS,
      reset_password: AUTH_TEXT.RESET_PASSWORD_OTP_INVALID,
    },
  },
  {
    patterns: ["unable to validate email address"],
    messages: {
      otp: AUTH_TEXT.EMAIL_INVALID,
      password: AUTH_TEXT.EMAIL_INVALID,
      forgot_password: AUTH_TEXT.FORGOT_PASSWORD_SUCCESS,
      reset_password: RESET_PASSWORD_FALLBACK_MESSAGE,
    },
  },
  {
    patterns: ["user not found"],
    messages: {
      otp: AUTH_TEXT.OTP_INVALID,
      password: AUTH_TEXT.PASSWORD_LOGIN_ERROR,
      forgot_password: AUTH_TEXT.FORGOT_PASSWORD_SUCCESS,
      reset_password: AUTH_TEXT.RESET_PASSWORD_OTP_INVALID,
    },
  },
  {
    patterns: ["email not confirmed", "email not verified"],
    messages: {
      otp: "请先确认你的邮箱地址。",
      password: "请先确认你的邮箱地址。",
      forgot_password: AUTH_TEXT.FORGOT_PASSWORD_SUCCESS,
      reset_password: "请先确认你的邮箱地址。",
    },
  },
];

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "";
}

function redactSensitiveText(value: string) {
  return value
    .replace(/(access_token=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/(refresh_token=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/(captcha_token["':=\s]+)[^&\s,'"}]+/gi, "$1[REDACTED]")
    .replace(/(captchatoken["':=\s]+)[^&\s,'"}]+/gi, "$1[REDACTED]")
    .replace(/(password["':=\s]+)[^&\s,'"}]+/gi, "$1[REDACTED]")
    .replace(/(otp["':=\s]+)[^&\s,'"}]+/gi, "$1[REDACTED]")
    .replace(/(code["':=\s]+)[^&\s,'"}]+/gi, "$1[REDACTED]")
    .replace(/(cookie["':=\s]+)[^&\s,'"}]+/gi, "$1[REDACTED]")
    .replace(/(api[_-]?key["':=\s]+)[^&\s,'"}]+/gi, "$1[REDACTED]")
    .replace(/(service_role["':=\s]+)[^&\s,'"}]+/gi, "$1[REDACTED]")
    .replace(/(bearer\s+)[^&\s,'"}]+/gi, "$1[REDACTED]");
}

export function getSafeAuthErrorMessage(
  error: unknown,
  operation: AuthOperation,
) {
  const message = getErrorMessage(error).toLowerCase();

  for (const errorPattern of AUTH_ERROR_PATTERNS) {
    if (errorPattern.patterns.some((pattern) => message.includes(pattern))) {
      return errorPattern.messages[operation];
    }
  }

  return FALLBACK_MESSAGES[operation];
}

export function logAuthError(error: unknown, operation: AuthOperation) {
  const safeMessage = getSafeAuthErrorMessage(error, operation);

  if (error instanceof Error) {
    console.error("[Auth] operation failed", {
      operation,
      safeMessage,
      name: redactSensitiveText(error.name),
      message: redactSensitiveText(error.message),
    });
    return;
  }

  console.error("[Auth] operation failed", {
    operation,
    safeMessage,
    errorType: typeof error,
  });
}
