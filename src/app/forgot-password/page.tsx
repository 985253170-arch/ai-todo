"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Header } from "@/components/Header";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { useAuth } from "@/hooks/useAuth";
import { getSafeAuthErrorMessage, logAuthError } from "@/lib/auth-errors";
import { AUTH_TEXT } from "@/lib/constants";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

type ResetStep = "request" | "reset";

const CAPTCHA_REQUIRED_MESSAGE = "\u5b89\u5168\u9a8c\u8bc1\u5931\u8d25\uff0c\u8bf7\u5237\u65b0\u9875\u9762\u540e\u91cd\u8bd5\u3002";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");

  if (!name || !domain) {
    return email;
  }

  const visibleName = name.slice(0, Math.min(2, name.length));
  return `${visibleName}***@${domain}`;
}

export default function ForgotPasswordPage() {
  const { sendResetPasswordOtp } = useAuth();
  const [step, setStep] = useState<ResetStep>("request");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [turnstileKey, setTurnstileKey] = useState(0);

  useEffect(() => {
    if (resendSeconds <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setResendSeconds((currentValue) => Math.max(0, currentValue - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  function validateEmail(trimmedEmail: string) {
    if (!trimmedEmail) {
      return AUTH_TEXT.EMAIL_REQUIRED;
    }

    if (!isValidEmail(trimmedEmail)) {
      return AUTH_TEXT.EMAIL_INVALID;
    }

    return null;
  }

  function enterResetStep(trimmedEmail: string) {
    setEmail(trimmedEmail);
    setStep("reset");
    setToken("");
    setNewPassword("");
    setConfirmPassword("");
    setErrorMessage(null);
    setSuccessMessage(AUTH_TEXT.RESET_PASSWORD_CODE_SENT);
    setResendSeconds(60);
    setTurnstileToken(null);
    setTurnstileKey((currentValue) => currentValue + 1);
  }

  function handleTokenChange(value: string) {
    setToken(value.replace(/\D/g, "").slice(0, 6));
    setErrorMessage(null);
  }

  async function handleRequestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim();
    const validationMessage = validateEmail(trimmedEmail);

    if (validationMessage) {
      setSuccessMessage(null);
      setErrorMessage(validationMessage);
      return;
    }

    if (!turnstileToken) {
      setSuccessMessage(null);
      setErrorMessage(CAPTCHA_REQUIRED_MESSAGE);
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await sendResetPasswordOtp(trimmedEmail, turnstileToken);
      enterResetStep(trimmedEmail);
    } catch (error) {
      const safeMessage = getSafeAuthErrorMessage(error, "forgot_password");
      logAuthError(error, "forgot_password");

      if (
        safeMessage === AUTH_TEXT.EMAIL_RATE_LIMITED ||
        safeMessage === "安全验证失败，请刷新页面后重试。"
      ) {
        setErrorMessage(safeMessage);
      } else {
        enterResetStep(trimmedEmail);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendCode() {
    if (resendSeconds > 0) {
      return;
    }

    const trimmedEmail = email.trim();
    const validationMessage = validateEmail(trimmedEmail);

    if (validationMessage) {
      setSuccessMessage(null);
      setErrorMessage(validationMessage);
      return;
    }

    if (!turnstileToken) {
      setSuccessMessage(null);
      setErrorMessage(CAPTCHA_REQUIRED_MESSAGE);
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await sendResetPasswordOtp(trimmedEmail, turnstileToken);
      setToken("");
      setSuccessMessage(AUTH_TEXT.RESET_PASSWORD_CODE_SENT);
      setResendSeconds(60);
      setTurnstileToken(null);
      setTurnstileKey((currentValue) => currentValue + 1);
    } catch (error) {
      const safeMessage = getSafeAuthErrorMessage(error, "forgot_password");
      logAuthError(error, "forgot_password");

      if (
        safeMessage === AUTH_TEXT.EMAIL_RATE_LIMITED ||
        safeMessage === "安全验证失败，请刷新页面后重试。"
      ) {
        setErrorMessage(safeMessage);
      } else {
        setToken("");
        setSuccessMessage(AUTH_TEXT.RESET_PASSWORD_CODE_SENT);
        setResendSeconds(60);
        setTurnstileToken(null);
        setTurnstileKey((currentValue) => currentValue + 1);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim();
    const trimmedToken = token.trim();

    if (!trimmedToken) {
      setSuccessMessage(null);
      setErrorMessage(AUTH_TEXT.OTP_REQUIRED);
      return;
    }

    if (trimmedToken.length !== 6) {
      setSuccessMessage(null);
      setErrorMessage(AUTH_TEXT.OTP_INVALID_LENGTH);
      return;
    }

    if (!newPassword) {
      setSuccessMessage(null);
      setErrorMessage(AUTH_TEXT.PASSWORD_REQUIRED);
      return;
    }

    if (newPassword.length < 6) {
      setSuccessMessage(null);
      setErrorMessage(AUTH_TEXT.PASSWORD_TOO_SHORT);
      return;
    }

    if (newPassword !== confirmPassword) {
      setSuccessMessage(null);
      setErrorMessage(AUTH_TEXT.PASSWORD_MISMATCH);
      return;
    }

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      setSuccessMessage(null);
      setErrorMessage("服务暂未配置，请稍后重试。");
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token: trimmedToken,
        type: "recovery",
      });

      if (verifyError) {
        throw verifyError;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      await supabase.auth.signOut();
      setIsSuccess(true);
      setToken("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccessMessage(AUTH_TEXT.RESET_PASSWORD_SUCCESS_V2);
    } catch (error) {
      setSuccessMessage(null);
      setErrorMessage(getSafeAuthErrorMessage(error, "reset_password"));
      logAuthError(error, "reset_password");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-gradient-to-b from-indigo-50/60 via-white to-sky-50/40 px-4 py-6 pb-[env(safe-area-inset-bottom,1rem)] text-slate-950 sm:px-6 sm:py-10">
      <div className="mx-auto flex max-w-sm flex-col gap-6 sm:gap-7">
        <Header variant="login" />

        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xl shadow-indigo-500/5 sm:p-6">
          <div className="mb-5">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              {isSuccess
                ? AUTH_TEXT.RESET_PASSWORD_TITLE
                : step === "request"
                  ? AUTH_TEXT.FORGOT_PASSWORD_TITLE
                  : AUTH_TEXT.RESET_PASSWORD_TITLE}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {step === "request"
                ? AUTH_TEXT.FORGOT_PASSWORD_DESCRIPTION
                : `验证码已发送至 ${maskEmail(email)}。`}
            </p>
          </div>

          {isSuccess ? (
            <div className="grid gap-4">
              <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {successMessage}
              </p>
              <a
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 px-5 text-center text-base font-semibold text-white shadow-md shadow-indigo-500/20 transition duration-150 hover:-translate-y-px"
                href="/login"
              >
                {AUTH_TEXT.RESET_PASSWORD_GO_LOGIN}
              </a>
            </div>
          ) : step === "request" ? (
            <form className="grid gap-3" onSubmit={handleRequestSubmit}>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">
                  {AUTH_TEXT.EMAIL_LABEL}
                </span>
                <input
                  className="min-h-[48px] rounded-xl border border-slate-200 px-4 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setSuccessMessage(null);
                    setErrorMessage(null);
                  }}
                  placeholder={AUTH_TEXT.EMAIL_PLACEHOLDER}
                  type="email"
                  value={email}
                />
              </label>

              {errorMessage ? (
                <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {errorMessage}
                </p>
              ) : null}

              <TurnstileWidget
                key={`request-${turnstileKey}`}
                onTokenChange={setTurnstileToken}
              />

              <button
                className="min-h-[48px] rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 px-5 text-base font-semibold text-white shadow-md shadow-indigo-500/20 transition duration-150 hover:-translate-y-px hover:shadow-lg hover:shadow-indigo-500/25 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting
                  ? AUTH_TEXT.RESET_PASSWORD_CODE_SEND_LOADING
                  : AUTH_TEXT.RESET_PASSWORD_CODE_SEND_BUTTON}
              </button>

              <a
                className="text-center text-sm leading-6 text-slate-500 transition hover:text-indigo-700"
                href="/login"
              >
                {AUTH_TEXT.FORGOT_PASSWORD_BACK}
              </a>
            </form>
          ) : (
            <form className="grid gap-3" onSubmit={handleResetSubmit}>
              {successMessage ? (
                <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {successMessage}
                </p>
              ) : null}

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">
                  {AUTH_TEXT.RESET_PASSWORD_CODE_LABEL}
                </span>
                <input
                  className="min-h-[48px] rounded-xl border border-slate-200 px-4 text-center text-lg font-semibold tracking-[0.35em] text-slate-950 outline-none placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => handleTokenChange(event.target.value)}
                  placeholder={AUTH_TEXT.RESET_PASSWORD_CODE_PLACEHOLDER}
                  value={token}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">
                  {AUTH_TEXT.RESET_PASSWORD_NEW_PASSWORD_LABEL}
                </span>
                <div className="flex min-h-[48px] items-center rounded-xl border border-slate-200 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10">
                  <input
                    className="min-h-[48px] min-w-0 flex-1 rounded-xl px-4 text-base text-slate-950 outline-none placeholder:text-slate-400"
                    minLength={6}
                    onChange={(event) => {
                      setNewPassword(event.target.value);
                      setSuccessMessage(null);
                      setErrorMessage(null);
                    }}
                    placeholder={AUTH_TEXT.PASSWORD_PLACEHOLDER}
                    type={isPasswordVisible ? "text" : "password"}
                    value={newPassword}
                  />
                  <button
                    className="min-h-[48px] px-4 text-sm font-semibold text-slate-500 transition hover:text-indigo-700"
                    onClick={() =>
                      setIsPasswordVisible((currentValue) => !currentValue)
                    }
                    type="button"
                  >
                    {isPasswordVisible ? "隐藏" : "显示"}
                  </button>
                </div>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">
                  {AUTH_TEXT.RESET_PASSWORD_CONFIRM_LABEL}
                </span>
                <input
                  className="min-h-[48px] rounded-xl border border-slate-200 px-4 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                  minLength={6}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setSuccessMessage(null);
                    setErrorMessage(null);
                  }}
                  placeholder={AUTH_TEXT.CONFIRM_PASSWORD_PLACEHOLDER}
                  type={isPasswordVisible ? "text" : "password"}
                  value={confirmPassword}
                />
              </label>

              {errorMessage ? (
                <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {errorMessage}
                </p>
              ) : null}

              <TurnstileWidget
                key={`reset-${turnstileKey}`}
                onTokenChange={setTurnstileToken}
              />

              <button
                className="min-h-[44px] rounded-full px-4 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting || resendSeconds > 0 || !turnstileToken}
                onClick={() => {
                  void handleResendCode();
                }}
                type="button"
              >
                {resendSeconds > 0
                  ? `${AUTH_TEXT.OTP_RESEND_COUNTDOWN} ${resendSeconds}s`
                  : AUTH_TEXT.RESET_PASSWORD_CODE_RESEND_BUTTON}
              </button>

              <button
                className="min-h-[48px] rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 px-5 text-base font-semibold text-white shadow-md shadow-indigo-500/20 transition duration-150 hover:-translate-y-px hover:shadow-lg hover:shadow-indigo-500/25 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting
                  ? AUTH_TEXT.RESET_PASSWORD_SET_LOADING
                  : AUTH_TEXT.RESET_PASSWORD_SET_BUTTON}
              </button>

              <a
                className="text-center text-sm leading-6 text-slate-500 transition hover:text-indigo-700"
                href="/login"
              >
                {AUTH_TEXT.RESET_PASSWORD_GO_LOGIN}
              </a>
            </form>
          )}
        </section>

        <p className="mt-6 text-center text-xs text-slate-400">
          登录后即可同步你的任务记录与行动数据
        </p>
      </div>
    </main>
  );
}