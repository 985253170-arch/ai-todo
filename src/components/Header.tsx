"use client";

import { useState } from "react";
import { AuthModal } from "@/components/AuthModal";
import { UI_TEXT } from "@/lib/constants";
import { AUTH_TEXT } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";

export function Header() {
  const { user, isLoading, signIn, signOut } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

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
        onSignIn={signIn}
      />
    </>
  );
}
