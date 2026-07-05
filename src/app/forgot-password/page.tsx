"use client";

import { useState, type FormEvent } from "react";
import { Header } from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { AUTH_TEXT } from "@/lib/constants";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function ForgotPasswordPage() {
  const { sendResetPasswordEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  function validateEmail(trimmedEmail: string) {
    if (!trimmedEmail) {
      return AUTH_TEXT.EMAIL_REQUIRED;
    }

    if (!isValidEmail(trimmedEmail)) {
      return AUTH_TEXT.EMAIL_INVALID;
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

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
      await sendResetPasswordEmail(trimmedEmail);
      setIsSuccess(true);
      setMessage(AUTH_TEXT.FORGOT_PASSWORD_SUCCESS);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.toLowerCase().includes("rate limit") ||
          error.message.toLowerCase().includes("too many requests"))
      ) {
        setErrorMessage(AUTH_TEXT.EMAIL_RATE_LIMITED);
      } else {
        setIsSuccess(true);
        setMessage(AUTH_TEXT.FORGOT_PASSWORD_SUCCESS);
      }
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
              {AUTH_TEXT.FORGOT_PASSWORD_TITLE}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {AUTH_TEXT.FORGOT_PASSWORD_DESCRIPTION}
            </p>
          </div>

          {isSuccess ? (
            <div className="grid gap-4">
              <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {message}
              </p>
              <a
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 px-5 text-center text-base font-semibold text-white shadow-md shadow-indigo-500/20 transition duration-150 hover:-translate-y-px"
                href="/login"
              >
                {AUTH_TEXT.FORGOT_PASSWORD_BACK}
              </a>
            </div>
          ) : (
            <form className="grid gap-3" onSubmit={handleSubmit}>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">
                  {AUTH_TEXT.EMAIL_LABEL}
                </span>
                <input
                  className="min-h-[48px] rounded-xl border border-slate-200 px-4 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setMessage(null);
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

              <button
                className="min-h-[48px] rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 px-5 text-base font-semibold text-white shadow-md shadow-indigo-500/20 transition duration-150 hover:-translate-y-px hover:shadow-lg hover:shadow-indigo-500/25 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting
                  ? AUTH_TEXT.FORGOT_PASSWORD_LOADING
                  : AUTH_TEXT.FORGOT_PASSWORD_BUTTON}
              </button>

              <a
                className="text-center text-sm leading-6 text-slate-500 transition hover:text-indigo-700"
                href="/login"
              >
                {AUTH_TEXT.FORGOT_PASSWORD_BACK}
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
