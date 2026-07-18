"use client";

import type { AuthScreen } from "@/types/app";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

interface WelcomePageProps {
  onNavigate: (screen: AuthScreen) => void;
}

export function WelcomePage({ onNavigate }: WelcomePageProps) {
  return (
    <main className="flex h-full min-h-0 flex-col bg-warm-bg px-6 py-7">
      <header className="shrink-0">
        <p className="font-serif text-3xl font-semibold text-brand-blue">清行</p>
      </header>

      <section className="flex min-h-0 flex-1 flex-col items-center justify-center py-4 text-center">
        <h1 className="font-serif text-4xl font-semibold leading-tight text-brand-blue">
          今天，也从一小步开始
        </h1>

        <img
          className="mx-auto my-5 h-auto w-[min(58vw,280px)] object-contain"
          src="/icons/icon-512.png"
          alt="一条通向嫩芽的小径"
        />

        <p className="font-serif text-2xl font-semibold text-brand-blue">
          慢一点，也在向前走。
        </p>
        <p className="mt-3 max-w-[19rem] text-base leading-7 text-text-secondary">
          不用完整计划，先写下今天想推进的事。
        </p>
      </section>

      <footer className="shrink-0 pb-[calc(16px+var(--safe-area-bottom))] pt-2">
        <PrimaryButton onClick={() => onNavigate("otp-login")}>开始使用</PrimaryButton>
      </footer>
    </main>
  );
}
