"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getSafeAuthErrorMessage, logAuthError } from "@/lib/auth-errors";
import { AUTH_TEXT } from "@/lib/constants";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isTokenReady, setIsTokenReady] = useState(false);
  const [isTokenInvalid, setIsTokenInvalid] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  useEffect(() => {
    async function initializeRecoverySession() {
      const hash = window.location.hash;

      if (!hash || hash.length < 10) {
        setIsTokenInvalid(true);
        return;
      }

      const params = new URLSearchParams(hash.slice(1));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const type = params.get("type");

      if (!accessToken || !refreshToken || type !== "recovery") {
        setIsTokenInvalid(true);
        return;
      }

      const supabase = createSupabaseBrowserClient();

      if (!supabase) {
        setIsTokenInvalid(true);
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        setIsTokenInvalid(true);
        return;
      }

      setIsTokenReady(true);
    }

    void initializeRecoverySession();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!newPassword) {
      setMessage(null);
      setErrorMessage(AUTH_TEXT.PASSWORD_REQUIRED);
      return;
    }

    if (newPassword.length < 6) {
      setMessage(null);
      setErrorMessage(AUTH_TEXT.PASSWORD_TOO_SHORT);
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage(null);
      setErrorMessage(AUTH_TEXT.PASSWORD_MISMATCH);
      return;
    }

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      setMessage(null);
      setErrorMessage("服务暂未配置，请稍后重试。");
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw error;
      }

      setIsSuccess(true);
      setMessage(AUTH_TEXT.RESET_PASSWORD_SUCCESS);
      await supabase.auth.signOut();
    } catch (error) {
      setErrorMessage(getSafeAuthErrorMessage(error, "reset_password"));
      logAuthError(error, "reset_password");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-gradient-to-b from-indigo-50/60 via-white to-sky-50/40 px-4 py-6 pb-[env(safe-area-inset-bottom,1rem)] text-slate-950 sm:px-6 sm:py-10">
      <div className="mx-auto flex max-w-sm flex-col gap-6 sm:gap-7">
        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xl shadow-indigo-500/5 sm:p-6">
          <div className="mb-5">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              {AUTH_TEXT.RESET_PASSWORD_TITLE}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {AUTH_TEXT.RESET_PASSWORD_DESCRIPTION}
            </p>
          </div>

          <p className="mb-5 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm leading-6 text-indigo-700">
            {AUTH_TEXT.RESET_PASSWORD_LEGACY_HINT}
            <a className="ml-1 font-semibold hover:text-indigo-900" href="/forgot-password">
              {AUTH_TEXT.RESET_PASSWORD_GO_FORGOT}
            </a>
          </p>
          {isTokenInvalid ? (
            <div className="grid gap-4">
              <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                {AUTH_TEXT.RESET_PASSWORD_TOKEN_EXPIRED}
              </p>
              <a
                className="text-center text-sm leading-6 text-slate-500 transition hover:text-indigo-700"
                href="/forgot-password"
              >
                {AUTH_TEXT.RESET_PASSWORD_GO_FORGOT}
              </a>
            </div>
          ) : isSuccess ? (
            <div className="grid gap-4">
              <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {message}
              </p>
              <a
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 px-5 text-center text-base font-semibold text-white shadow-md shadow-indigo-500/20 transition duration-150 hover:-translate-y-px"
                href="/login"
              >
                {AUTH_TEXT.RESET_PASSWORD_GO_LOGIN}
              </a>
            </div>
          ) : !isTokenReady ? (
            <p className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
              正在验证重置链接...
            </p>
          ) : (
            <form className="grid gap-3" onSubmit={handleSubmit}>
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
                      setMessage(null);
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
                    setMessage(null);
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

              <button
                className="min-h-[48px] rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 px-5 text-base font-semibold text-white shadow-md shadow-indigo-500/20 transition duration-150 hover:-translate-y-px hover:shadow-lg hover:shadow-indigo-500/25 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting
                  ? AUTH_TEXT.RESET_PASSWORD_LOADING
                  : AUTH_TEXT.RESET_PASSWORD_BUTTON}
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
      </div>
    </main>
  );
}





