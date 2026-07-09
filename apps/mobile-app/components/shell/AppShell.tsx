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
    <div className="flex h-[100svh] flex-col overflow-hidden bg-warm-bg">
      <main className="mx-auto flex min-h-0 w-full max-w-mobile flex-1 flex-col overflow-hidden px-6 pb-[84px] pt-8">
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </main>
      <BottomTabBar activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
}
