"use client";

import { Header } from "@/components/Header";
import { LoginPageContent } from "@/components/LoginPageContent";

export default function LoginPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F8FAFF] bg-gradient-to-b from-indigo-50 via-white to-sky-50 px-4 py-6 pb-[env(safe-area-inset-bottom,1rem)] text-slate-950 sm:px-6 sm:py-10">
      <div className="mx-auto flex max-w-[420px] flex-col gap-6 sm:gap-7">
        <Header variant="login" />
        <LoginPageContent />
      </div>
    </main>
  );
}
