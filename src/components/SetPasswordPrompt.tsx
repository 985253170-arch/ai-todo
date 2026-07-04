"use client";

import { useState, type FormEvent } from "react";
import { AUTH_TEXT, ERROR_MESSAGES } from "@/lib/constants";

interface SetPasswordPromptProps {
  isOpen: boolean;
  onSetPassword: (password: string) => Promise<void>;
  onSkip: () => void;
  onClose?: () => void;
}

function getSafeErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    const message = error.message.toLowerCase();

    if (message.includes("password should be at least 6 characters")) {
      return AUTH_TEXT.PASSWORD_TOO_SHORT;
    }

    if (message.includes("auth")) {
      return ERROR_MESSAGES.AUTH_OPERATION_FAILED;
    }

    return error.message;
  }

  return ERROR_MESSAGES.AUTH_OPERATION_FAILED;
}

export function SetPasswordPrompt({
  isOpen,
  onSetPassword,
  onSkip,
  onClose,
}: SetPasswordPromptProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) {
    return null;
  }

  function resetForm() {
    setPassword("");
    setConfirmPassword("");
    setErrorMessage(null);
    setIsSubmitting(false);
  }

  function handleSkip() {
    resetForm();
    onSkip();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!password) {
      setErrorMessage(AUTH_TEXT.PASSWORD_REQUIRED);
      return;
    }

    if (password.length < 6) {
      setErrorMessage(AUTH_TEXT.PASSWORD_TOO_SHORT);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(AUTH_TEXT.PASSWORD_MISMATCH);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onSetPassword(password);
      resetForm();
      onClose?.();
    } catch (error) {
      setErrorMessage(getSafeErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 py-6 backdrop-blur-sm"
      role="dialog"
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.18)]">
        <div className="mb-5">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            {AUTH_TEXT.SET_PASSWORD_TITLE}
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {AUTH_TEXT.SET_PASSWORD_DESCRIPTION}
          </p>
        </div>

        <form className="grid gap-3" onSubmit={handleSubmit}>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">
              {AUTH_TEXT.PASSWORD_LABEL}
            </span>
            <input
              className="min-h-12 rounded-xl border border-slate-200 px-4 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={AUTH_TEXT.PASSWORD_PLACEHOLDER}
              type="password"
              value={password}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">
              {AUTH_TEXT.CONFIRM_PASSWORD_LABEL}
            </span>
            <input
              className="min-h-12 rounded-xl border border-slate-200 px-4 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              minLength={6}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder={AUTH_TEXT.CONFIRM_PASSWORD_PLACEHOLDER}
              type="password"
              value={confirmPassword}
            />
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
              ? AUTH_TEXT.SET_PASSWORD_LOADING
              : AUTH_TEXT.SET_PASSWORD_BUTTON}
          </button>
        </form>

        <button
          className="mt-3 min-h-11 w-full rounded-full px-4 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          disabled={isSubmitting}
          onClick={handleSkip}
          type="button"
        >
          {AUTH_TEXT.SET_PASSWORD_SKIP}
        </button>
      </div>
    </div>
  );
}
