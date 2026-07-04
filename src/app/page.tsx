"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { LandingPage } from "@/components/LandingPage";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/app");
    }
  }, [isLoading, router, user]);

  if (isLoading || user) {
    return null;
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F8FAFF] bg-gradient-to-b from-indigo-50 via-white to-sky-50 px-4 py-6 pb-[env(safe-area-inset-bottom,1rem)] text-slate-950 sm:px-6 sm:py-10">
      <div className="mx-auto flex max-w-[720px] flex-col gap-6 sm:gap-7">
        <Header variant="landing" />
        <LandingPage />
      </div>
    </main>
  );
}
