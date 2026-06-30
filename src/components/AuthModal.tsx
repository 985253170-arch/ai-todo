"use client";

import { useEffect, useState } from "react";
import { AUTH_TEXT, ERROR_MESSAGES } from "@/lib/constants";

interface AuthModalProps {
  isOpen: boolean;
  isAuthenticated: boolean;
  onClose: () => void;
  onSignIn: (email: string) => Promise<void>;
}

function getSafeErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    if (error.message.toLowerCase().includes("email rate limit exceeded")) {
      return AUTH_TEXT.EMAIL_RATE_LIMITED;
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
}: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      onClose();
    }
  }, [isAuthenticated, onClose]);

  if (!isOpen) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setMessage(null);
      setErrorMessage(AUTH_TEXT.EMAIL_REQUIRED);
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      await onSignIn(trimmedEmail);
      setMessage(AUTH_TEXT.MAGIC_LINK_SENT);
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
            onClick={onClose}
            type="button"
          >
            ×
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

          <button
            className="min-h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 px-5 text-base font-semibold text-white shadow-[0_4px_12px_rgba(79,70,229,0.2)] transition duration-150 hover:-translate-y-px hover:shadow-[0_8px_18px_rgba(79,70,229,0.26)] active:translate-y-0 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-400 disabled:shadow-none"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? AUTH_TEXT.SENDING_LINK : AUTH_TEXT.SEND_LINK}
          </button>
        </form>

        {message ? (
          <p className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
            {message}
          </p>
        ) : null}

        {errorMessage ? (
          <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
