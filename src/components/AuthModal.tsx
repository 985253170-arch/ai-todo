"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AUTH_TEXT, ERROR_MESSAGES } from "@/lib/constants";

interface AuthModalProps {
  isOpen: boolean;
  isAuthenticated: boolean;
  onClose: () => void;
  onSendOtp: (email: string) => Promise<void>;
  onVerifyOtp: (email: string, token: string) => Promise<void>;
  onSignInWithPassword: (email: string, password: string) => Promise<void>;
}

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

    return mode === "password" ? AUTH_TEXT.PASSWORD_LOGIN_ERROR : AUTH_TEXT.OTP_INVALID;
  }

  return ERROR_MESSAGES.AUTH_OPERATION_FAILED;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function AuthModal({
  isOpen,
  isAuthenticated,
  onClose,
  onSendOtp,
  onVerifyOtp,
  onSignInWithPassword,
}: AuthModalProps) {
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
    if (isAuthenticated) {
      onClose();
    }
  }, [isAuthenticated, onClose]);

  useEffect(() => {
    if (resendSeconds <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setResendSeconds((currentValue) => Math.max(0, currentValue - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  if (!isOpen) {
    return null;
  }

  function resetForm() {
    setMode("otp");
    setEmail("");
    setPassword("");
    setToken("");
    setOtpSent(false);
    setMessage(null);
    setErrorMessage(null);
    setIsSubmitting(false);
    setIsPasswordVisible(false);
    setResendSeconds(0);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

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

  async function sendOtp() {
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
      await onSendOtp(trimmedEmail);
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

  async function verifyOtp(tokenValue: string) {
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
      await onVerifyOtp(trimmedEmail, tokenValue);
      setToken("");
      handleClose();
    } catch (error) {
      setErrorMessage(getSafeErrorMessage(error, "otp"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleOtpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!otpSent) {
      await sendOtp();
      return;
    }

    await verifyOtp(token);
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
      await onSignInWithPassword(trimmedEmail, password);
      setPassword("");
      handleClose();
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
      void verifyOtp(nextToken);
    }
  }

  const isOtpMode = mode === "otp";

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 py-6 backdrop-blur-sm"
      role="dialog"
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.18)]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              {AUTH_TEXT.MODAL_TITLE}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              {AUTH_TEXT.MODAL_DESCRIPTION}
            </p>
          </div>
          <button
            aria-label={AUTH_TEXT.CLOSE}
            className="rounded-full px-2 py-1 text-lg leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            onClick={handleClose}
            type="button"
          >
            ×
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 rounded-full bg-slate-100 p-1">
          <button
            className={`min-h-10 rounded-full text-sm font-semibold transition ${
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
            className={`min-h-10 rounded-full text-sm font-semibold transition ${
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
                className="min-h-12 rounded-xl border border-slate-200 px-4 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
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
                  className="min-h-12 rounded-xl border border-slate-200 px-4 text-center text-lg font-semibold tracking-[0.35em] text-slate-950 outline-none placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => handleTokenChange(event.target.value)}
                  placeholder={AUTH_TEXT.OTP_PLACEHOLDER}
                  value={token}
                />
              </label>
            ) : null}

            {message ? (
              <p className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
                {message}
              </p>
            ) : null}

            {errorMessage ? (
              <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {errorMessage}
              </p>
            ) : null}

            <button
              className="min-h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 px-5 text-base font-semibold text-white shadow-[0_4px_12px_rgba(79,70,229,0.2)] transition duration-150 hover:-translate-y-px hover:shadow-[0_8px_18px_rgba(79,70,229,0.26)] active:translate-y-0 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-400 disabled:shadow-none"
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
                className="min-h-11 rounded-full px-4 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting || resendSeconds > 0}
                onClick={() => {
                  void sendOtp();
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
                className="min-h-12 rounded-xl border border-slate-200 px-4 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
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
              <div className="flex min-h-12 items-center rounded-xl border border-slate-200 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100">
                <input
                  className="min-h-12 min-w-0 flex-1 rounded-xl px-4 text-base text-slate-950 outline-none placeholder:text-slate-400"
                  minLength={6}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={AUTH_TEXT.PASSWORD_PLACEHOLDER}
                  type={isPasswordVisible ? "text" : "password"}
                  value={password}
                />
                <button
                  className="min-h-12 px-4 text-sm font-semibold text-slate-500 transition hover:text-indigo-700"
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
              <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {errorMessage}
              </p>
            ) : null}

            <button
              className="min-h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 px-5 text-base font-semibold text-white shadow-[0_4px_12px_rgba(79,70,229,0.2)] transition duration-150 hover:-translate-y-px hover:shadow-[0_8px_18px_rgba(79,70,229,0.26)] active:translate-y-0 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-400 disabled:shadow-none"
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
      </div>
    </div>
  );
}
