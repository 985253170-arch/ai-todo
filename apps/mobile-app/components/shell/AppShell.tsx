import type { ReactNode } from "react";
import type { AppTab } from "@/types/app";
import { BottomTabBar } from "./BottomTabBar";

interface AppShellProps {
  children: ReactNode;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

export function AppShell({ children, activeTab, onTabChange }: AppShellProps) {
  return (
    <div className="min-h-screen bg-warm-bg">
      <main className="mx-auto min-h-screen max-w-mobile px-6 pb-28 pt-8">
        {children}
      </main>
      <BottomTabBar activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
}
