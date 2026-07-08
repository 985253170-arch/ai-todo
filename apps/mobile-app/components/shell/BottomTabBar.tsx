import type { AppTab } from "@/types/app";
import { IconFootprint, IconGrowth, IconMe, IconToday } from "@/components/icons";

interface BottomTabBarProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

const tabs: Array<{
  key: AppTab;
  label: string;
  icon: (active: boolean) => React.ReactNode;
}> = [
  { key: "today", label: "今日", icon: (active) => <IconToday active={active} /> },
  {
    key: "footprint",
    label: "足迹",
    icon: (active) => <IconFootprint active={active} />,
  },
  { key: "growth", label: "成长", icon: (active) => <IconGrowth active={active} /> },
  { key: "me", label: "我的", icon: (active) => <IconMe active={active} /> },
];

export function BottomTabBar({ activeTab, onTabChange }: BottomTabBarProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-mobile border-t border-border-paper bg-paper/95 px-3 pb-safe-bottom shadow-bottom-bar backdrop-blur">
      <div className="grid min-h-[76px] grid-cols-4 items-center gap-1">
        {tabs.map((tab) => {
          const active = tab.key === activeTab;

          return (
            <button
              key={tab.key}
              className={`flex min-h-touch flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-xs font-semibold transition active:scale-[0.98] ${
                active ? "text-brand-blue" : "text-text-inactive"
              }`}
              type="button"
              onClick={() => onTabChange(tab.key)}
              aria-current={active ? "page" : undefined}
            >
              {tab.icon(active)}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
