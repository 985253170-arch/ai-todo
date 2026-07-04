"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthModal } from "@/components/AuthModal";
import { SetPasswordPrompt } from "@/components/SetPasswordPrompt";
import { UI_TEXT } from "@/lib/constants";
import { AUTH_TEXT } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";

interface HeaderProps {
  variant?: "landing" | "login" | "app";
  historyPanelId?: string;
  isHistoryOpen?: boolean;
  onToggleHistory?: () => void;
}

export function Header({
  variant,
  historyPanelId,
  isHistoryOpen,
  onToggleHistory,
}: HeaderProps) {
  const resolvedVariant = variant ?? "app";
  const {
    user,
    isLoading,
    sendOtp,
    verifyOtp,
    signInWithPassword,
    setPassword,
    signOut,
  } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [skippedPasswordPromptUserId, setSkippedPasswordPromptUserId] =
    useState<string | null>(null);

  const shouldShowSetPasswordPrompt =
    Boolean(user) &&
    user?.metadata?.password_set !== true &&
    skippedPasswordPromptUserId !== user?.id;

  if (resolvedVariant === "landing") {
    return (
      <header className="mb-6 flex flex-col gap-4 pt-[env(safe-area-inset-top,0px)] sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <p className="border-l-2 border-indigo-500 pl-3 text-xl font-semibold tracking-tight text-slate-950">
            {UI_TEXT.APP_NAME}
          </p>
          <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            {UI_TEXT.APP_ROLE}
          </span>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            className="rounded-full border border-slate-200 bg-white/80 px-4 py-1.5 text-sm font-semibold text-slate-600 transition duration-150 hover:border-indigo-100 hover:text-indigo-700"
            href="/login"
          >
            {AUTH_TEXT.LOGIN}
          </Link>
          <Link
            className="rounded-full border border-indigo-100 bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(79,70,229,0.16)] transition duration-150 hover:-translate-y-px hover:bg-indigo-700"
            href="/login"
          >
            免费开始使用
          </Link>
        </div>
      </header>
    );
  }

  if (resolvedVariant === "login") {
    return (
      <header className="mb-6 flex items-center justify-between pt-[env(safe-area-inset-top,0px)] sm:mb-8">
        <Link
          className="text-sm font-semibold text-slate-500 transition duration-150 hover:text-indigo-700"
          href="/"
        >
          返回首页
        </Link>
        <p className="border-l-2 border-indigo-500 pl-3 text-xl font-semibold tracking-tight text-slate-950">
          {UI_TEXT.APP_NAME}
        </p>
      </header>
    );
  }

  const appHistoryPanelId = historyPanelId ?? "history-panel";
  const appIsHistoryOpen = Boolean(isHistoryOpen);

  return (
    <>
      <header className="mb-6 flex flex-col gap-4 pt-[env(safe-area-inset-top,0px)] sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <p className="border-l-2 border-indigo-500 pl-3 text-xl font-semibold tracking-tight text-slate-950">
            {UI_TEXT.APP_NAME}
          </p>
          <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            {UI_TEXT.APP_ROLE}
          </span>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            aria-controls={appHistoryPanelId}
            aria-pressed={appIsHistoryOpen}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition duration-150 hover:-translate-y-px ${
              appIsHistoryOpen
                ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                : "border-slate-200 bg-white/80 text-slate-600 hover:border-indigo-100 hover:text-indigo-700"
            }`}
            onClick={onToggleHistory}
            type="button"
          >
            历史
          </button>
          {isLoading ? (
            <span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs font-medium text-slate-500">
              {AUTH_TEXT.LOGGING_STATUS}
            </span>
          ) : user ? (
            <>
              <span className="max-w-44 truncate rounded-full border border-indigo-100 bg-white/80 px-3 py-1.5 text-xs font-medium text-indigo-700 sm:max-w-56">
                {user.email ?? AUTH_TEXT.LOGGED_IN}
              </span>
              <button
                className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-600 transition duration-150 hover:border-slate-300 hover:text-slate-900"
                onClick={() => {
                  void signOut();
                }}
                type="button"
              >
                {AUTH_TEXT.LOGOUT}
              </button>
            </>
          ) : (
            <button
              className="rounded-full border border-indigo-100 bg-white/80 px-4 py-1.5 text-sm font-semibold text-indigo-700 shadow-[0_4px_14px_rgba(79,70,229,0.08)] transition duration-150 hover:-translate-y-px hover:border-indigo-200 hover:bg-indigo-50"
              onClick={() => setIsAuthModalOpen(true)}
              type="button"
            >
              {AUTH_TEXT.LOGIN}
            </button>
          )}
        </div>
      </header>

      <AuthModal
        isAuthenticated={Boolean(user)}
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSendOtp={sendOtp}
        onSignInWithPassword={signInWithPassword}
        onVerifyOtp={verifyOtp}
      />

      <SetPasswordPrompt
        isOpen={shouldShowSetPasswordPrompt}
        onClose={() => {
          if (user) {
            setSkippedPasswordPromptUserId(user.id);
          }
        }}
        onSetPassword={setPassword}
        onSkip={() => {
          if (user) {
            setSkippedPasswordPromptUserId(user.id);
          }
        }}
      />
    </>
  );
}

