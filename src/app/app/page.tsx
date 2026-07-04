"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MainWorkspace } from "@/components/MainWorkspace";
import { useAuth } from "@/hooks/useAuth";

export default function AppPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, router, user]);

  if (isLoading || !user) {
    return null;
  }

  return <MainWorkspace />;
}
