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
    <div className="relative flex h-[100svh] flex-col overflow-hidden bg-warm-bg">
      <main className="mx-auto flex min-h-0 w-full max-w-mobile flex-1 flex-col overflow-hidden pl-[max(var(--app-page-gutter),var(--safe-area-left))] pr-[max(var(--app-page-gutter),var(--safe-area-right))] pb-[var(--app-content-bottom-reserve)] pt-[calc(var(--app-top-spacing)+var(--safe-area-top))]">
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </main>
      <p className="orientation-hint">横屏会有一点挤，转回竖屏会更舒服。</p>
      <BottomTabBar activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
}
