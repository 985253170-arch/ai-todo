"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AUTH_TEXT, ERROR_MESSAGES } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";

type AuthMode = "otp" | "password";

function getSafeErrorMessage(error: unknown, mode: AuthMode) {
  if (error instanceof Error && error.message) {
    const message = error.message.toLowerCase();

    if (
      message.includes("email rate limit exceeded") ||
      message.includes("rate limit")
    ) {
      return AUTH_TEXT.EMAIL_RATE_LIMITED;
    }

    if (message.includes("invalid login credentials")) {
      return AUTH_TEXT.PASSWORD_LOGIN_ERROR;
    }

    if (
      message.includes("token") ||
      message.includes("otp") ||
      message.includes("expired")
    ) {
      return AUTH_TEXT.OTP_INVALID;
    }

    if (message.includes("unable to validate email address")) {
      return AUTH_TEXT.EMAIL_INVALID;
    }

    return mode === "password"
      ? AUTH_TEXT.PASSWORD_LOGIN_ERROR
      : AUTH_TEXT.OTP_INVALID;
  }

  return ERROR_MESSAGES.AUTH_OPERATION_FAILED;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function LoginPageContent() {
  const router = useRouter();
  const { user, isLoading, sendOtp, verifyOtp, signInWithPassword } = useAuth();
  const [mode, setMode] = useState<AuthMode>("otp");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/app");
    }
  }, [isLoading, router, user]);

  useEffect(() => {
    if (resendSeconds <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setResendSeconds((currentValue) => Math.max(0, currentValue - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setPassword("");
    setToken("");
    setOtpSent(false);
    setMessage(null);
    setErrorMessage(null);
    setIsSubmitting(false);
    setIsPasswordVisible(false);
    setResendSeconds(0);
  }

  function validateEmail(trimmedEmail: string) {
    if (!trimmedEmail) {
      return AUTH_TEXT.EMAIL_REQUIRED;
    }

    if (!isValidEmail(trimmedEmail)) {
      return AUTH_TEXT.EMAIL_INVALID;
    }

    return null;
  }

  async function handleSendOtp() {
    const trimmedEmail = email.trim();
    const validationMessage = validateEmail(trimmedEmail);

    if (validationMessage) {
      setMessage(null);
      setErrorMessage(validationMessage);
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      await sendOtp(trimmedEmail);
      setOtpSent(true);
      setToken("");
      setMessage(AUTH_TEXT.OTP_SENT_MESSAGE);
      setResendSeconds(60);
    } catch (error) {
      setErrorMessage(getSafeErrorMessage(error, "otp"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtp(tokenValue: string) {
    const trimmedEmail = email.trim();
    const validationMessage = validateEmail(trimmedEmail);

    if (validationMessage) {
      setMessage(null);
      setErrorMessage(validationMessage);
      return;
    }

    if (!tokenValue) {
      setMessage(null);
      setErrorMessage(AUTH_TEXT.OTP_REQUIRED);
      return;
    }

    if (tokenValue.length !== 6) {
      setMessage(null);
      setErrorMessage(AUTH_TEXT.OTP_INVALID_LENGTH);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await verifyOtp(trimmedEmail, tokenValue);
      setToken("");
      router.replace("/app");
    } catch (error) {
      setErrorMessage(getSafeErrorMessage(error, "otp"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleOtpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!otpSent) {
      await handleSendOtp();
      return;
    }

    await handleVerifyOtp(token);
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim();
    const validationMessage = validateEmail(trimmedEmail);

    if (validationMessage) {
      setMessage(null);
      setErrorMessage(validationMessage);
      return;
    }

    if (!password) {
      setMessage(null);
      setErrorMessage(AUTH_TEXT.PASSWORD_REQUIRED);
      return;
    }

    if (password.length < 6) {
      setMessage(null);
      setErrorMessage(AUTH_TEXT.PASSWORD_TOO_SHORT);
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      await signInWithPassword(trimmedEmail, password);
      setPassword("");
      router.replace("/app");
    } catch (error) {
      setErrorMessage(getSafeErrorMessage(error, "password"));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleTokenChange(value: string) {
    const nextToken = value.replace(/\D/g, "").slice(0, 6);
    setToken(nextToken);
    setErrorMessage(null);

    if (nextToken.length === 6 && !isSubmitting) {
      void handleVerifyOtp(nextToken);
    }
  }

  if (isLoading || user) {
    return null;
  }

  const isOtpMode = mode === "otp";

  return (
    <>
      <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xl shadow-indigo-500/5 sm:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          {AUTH_TEXT.MODAL_TITLE}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {AUTH_TEXT.MODAL_DESCRIPTION}
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 rounded-full bg-slate-100 p-1">
        <button
          className={`min-h-[42px] rounded-full text-sm font-semibold transition active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed ${
            isOtpMode
              ? "bg-white text-indigo-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
          onClick={() => switchMode("otp")}
          type="button"
        >
          {AUTH_TEXT.OTP_LOGIN_TAB}
        </button>
        <button
          className={`min-h-[42px] rounded-full text-sm font-semibold transition active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed ${
            !isOtpMode
              ? "bg-white text-indigo-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
          onClick={() => switchMode("password")}
          type="button"
        >
          {AUTH_TEXT.PASSWORD_LOGIN_TAB}
        </button>
      </div>

      {isOtpMode ? (
        <form className="grid gap-3" onSubmit={handleOtpSubmit}>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">
              {AUTH_TEXT.EMAIL_LABEL}
            </span>
            <input
              className="min-h-[48px] rounded-xl border border-slate-200 px-4 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
              onChange={(event) => {
                setEmail(event.target.value);
                setToken("");
                setOtpSent(false);
                setMessage(null);
                setErrorMessage(null);
                setResendSeconds(0);
              }}
              placeholder={AUTH_TEXT.EMAIL_PLACEHOLDER}
              type="email"
              value={email}
            />
          </label>

          {otpSent ? (
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">
                {AUTH_TEXT.OTP_LABEL}
              </span>
              <input
                className="min-h-[48px] rounded-xl border border-slate-200 px-4 text-center text-lg font-semibold tracking-[0.35em] text-slate-950 outline-none placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => handleTokenChange(event.target.value)}
                placeholder={AUTH_TEXT.OTP_PLACEHOLDER}
                value={token}
              />
            </label>
          ) : null}

          {message ? (
            <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {message}
            </p>
          ) : null}

          {errorMessage ? (
            <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}

          <button
            className="min-h-[48px] rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 px-5 text-base font-semibold text-white shadow-md shadow-indigo-500/20 transition duration-150 hover:-translate-y-px hover:shadow-lg hover:shadow-indigo-500/25 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting
              ? otpSent
                ? AUTH_TEXT.OTP_VERIFY_LOADING
                : AUTH_TEXT.OTP_SEND_LOADING
              : otpSent
                ? AUTH_TEXT.OTP_VERIFY_BUTTON
                : AUTH_TEXT.OTP_SEND_BUTTON}
          </button>

          {otpSent ? (
            <button
              className="min-h-[44px] rounded-full px-4 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting || resendSeconds > 0}
              onClick={() => {
                void handleSendOtp();
              }}
              type="button"
            >
              {resendSeconds > 0
                ? `${AUTH_TEXT.OTP_RESEND_COUNTDOWN} ${resendSeconds}s`
                : AUTH_TEXT.OTP_RESEND_BUTTON}
            </button>
          ) : null}

          <button
            className="text-center text-sm leading-6 text-slate-500 transition hover:text-indigo-700"
            onClick={() => switchMode("password")}
            type="button"
          >
            {AUTH_TEXT.OTP_SWITCH_HINT}
          </button>
        </form>
      ) : (
        <form className="grid gap-3" onSubmit={handlePasswordSubmit}>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">
              {AUTH_TEXT.EMAIL_LABEL}
            </span>
            <input
              className="min-h-[48px] rounded-xl border border-slate-200 px-4 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
              onChange={(event) => setEmail(event.target.value)}
              placeholder={AUTH_TEXT.EMAIL_PLACEHOLDER}
              type="email"
              value={email}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">
              {AUTH_TEXT.PASSWORD_LABEL}
            </span>
            <div className="flex min-h-[48px] items-center rounded-xl border border-slate-200 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10">
              <input
                className="min-h-[48px] min-w-0 flex-1 rounded-xl px-4 text-base text-slate-950 outline-none placeholder:text-slate-400"
                minLength={6}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={AUTH_TEXT.PASSWORD_PLACEHOLDER}
                type={isPasswordVisible ? "text" : "password"}
                value={password}
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

          {errorMessage ? (
            <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}

          <button
            className="min-h-[48px] rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 px-5 text-base font-semibold text-white shadow-md shadow-indigo-500/20 transition duration-150 hover:-translate-y-px hover:shadow-lg hover:shadow-indigo-500/25 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting
              ? AUTH_TEXT.PASSWORD_LOGIN_LOADING
              : AUTH_TEXT.PASSWORD_LOGIN_BUTTON}
          </button>

          <button
            className="text-center text-sm leading-6 text-slate-500 transition hover:text-indigo-700"
            onClick={() => switchMode("otp")}
            type="button"
          >
            {AUTH_TEXT.PASSWORD_LOGIN_SWITCH_HINT}
          </button>
        </form>
      )}
      </section>

      <p className="mt-6 text-center text-xs text-slate-400">
        登录后即可同步你的任务记录与行动数据
      </p>
    </>
  );
}


