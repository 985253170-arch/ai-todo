"use client";

import { useEffect, useState } from "react";
import { AUTH_TEXT, ERROR_MESSAGES } from "@/lib/constants";

interface AuthModalProps {
  isOpen: boolean;
  isAuthenticated: boolean;
  onClose: () => void;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
}

type AuthMode = "login" | "signup";

function getSafeErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    const message = error.message.toLowerCase();

    if (message.includes("email rate limit exceeded")) {
      return AUTH_TEXT.EMAIL_RATE_LIMITED;
    }

    if (message.includes("invalid login credentials")) {
      return "邮箱或密码错误，请重试。";
    }

    if (message.includes("user already registered")) {
      return "该邮箱已注册，请直接登录。";
    }

    if (message.includes("password should be at least 6 characters")) {
      return AUTH_TEXT.PASSWORD_TOO_SHORT;
    }

    if (message.includes("unable to validate email address")) {
      return "邮箱格式不正确。";
    }

    if (message.includes("email not confirmed")) {
      return "邮箱尚未确认，请先点击确认邮件中的链接。";
    }

    return error.message;
  }

  return ERROR_MESSAGES.AUTH_OPERATION_FAILED;
}

export function AuthModal({
  isOpen,
  isAuthenticated,
  onClose,
  onSignIn,
  onSignUp,
}: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      onClose();
    }
  }, [isAuthenticated, onClose]);

  if (!isOpen) {
    return null;
  }

  function resetForm() {
    setMode("login");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setMessage(null);
    setErrorMessage(null);
    setIsSubmitting(false);
    setIsPasswordVisible(false);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setPassword("");
    setConfirmPassword("");
    setMessage(null);
    setErrorMessage(null);
    setIsPasswordVisible(false);
  }

  function validateForm(trimmedEmail: string) {
    if (!trimmedEmail) {
      return AUTH_TEXT.EMAIL_REQUIRED;
    }

    if (!password) {
      return AUTH_TEXT.PASSWORD_REQUIRED;
    }

    if (password.length < 6) {
      return AUTH_TEXT.PASSWORD_TOO_SHORT;
    }

    if (mode === "signup" && password !== confirmPassword) {
      return AUTH_TEXT.PASSWORD_MISMATCH;
    }

    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim();
    const validationMessage = validateForm(trimmedEmail);

    if (validationMessage) {
      setMessage(null);
      setErrorMessage(validationMessage);
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      if (mode === "signup") {
        await onSignUp(trimmedEmail, password);
        setMessage(AUTH_TEXT.SIGNUP_SUCCESS_MESSAGE);
        setPassword("");
        setConfirmPassword("");
        return;
      }

      await onSignIn(trimmedEmail, password);
      setPassword("");
    } catch (error) {
      setErrorMessage(getSafeErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  const isSignup = mode === "signup";

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

        {message ? (
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-5 text-center">
            <p className="text-base font-semibold text-indigo-800">
              {AUTH_TEXT.SIGNUP_SUCCESS_TITLE}
            </p>
            <p className="mt-2 text-sm leading-6 text-indigo-700">{message}</p>
            <button
              className="mt-4 min-h-11 rounded-full bg-white px-5 text-sm font-semibold text-indigo-700 transition duration-150 hover:bg-indigo-100"
              onClick={handleClose}
              type="button"
            >
              {AUTH_TEXT.CLOSE}
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 rounded-full bg-slate-100 p-1">
              <button
                className={`min-h-10 rounded-full text-sm font-semibold transition ${
                  mode === "login"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
                onClick={() => switchMode("login")}
                type="button"
              >
                {AUTH_TEXT.LOGIN_TAB}
              </button>
              <button
                className={`min-h-10 rounded-full text-sm font-semibold transition ${
                  mode === "signup"
                    ? "bg-white text-indigo-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
                onClick={() => switchMode("signup")}
                type="button"
              >
                {AUTH_TEXT.SIGNUP_TAB}
              </button>
            </div>

            <form className="grid gap-3" onSubmit={handleSubmit}>
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

              {isSignup ? (
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-700">
                    {AUTH_TEXT.CONFIRM_PASSWORD_LABEL}
                  </span>
                  <input
                    className="min-h-12 rounded-xl border border-slate-200 px-4 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                    minLength={6}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder={AUTH_TEXT.CONFIRM_PASSWORD_PLACEHOLDER}
                    type={isPasswordVisible ? "text" : "password"}
                    value={confirmPassword}
                  />
                </label>
              ) : null}

              <button
                className="min-h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 px-5 text-base font-semibold text-white shadow-[0_4px_12px_rgba(79,70,229,0.2)] transition duration-150 hover:-translate-y-px hover:shadow-[0_8px_18px_rgba(79,70,229,0.26)] active:translate-y-0 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-400 disabled:shadow-none"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting
                  ? isSignup
                    ? AUTH_TEXT.SIGNUP_LOADING
                    : AUTH_TEXT.LOGIN_LOADING
                  : isSignup
                    ? AUTH_TEXT.SIGNUP_BUTTON
                    : AUTH_TEXT.LOGIN_BUTTON}
              </button>
            </form>

            <p className="mt-4 text-center text-sm leading-6 text-slate-500">
              {isSignup
                ? AUTH_TEXT.SIGNUP_SWITCH_HINT
                : AUTH_TEXT.LOGIN_SWITCH_HINT}
            </p>
          </>
        )}

        {errorMessage ? (
          <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
