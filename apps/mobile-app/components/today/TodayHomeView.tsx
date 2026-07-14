import { IconFire, IconPaperPlane, IconSettings, IconStar } from "@/components/icons";
import { PaperCard } from "@/components/ui/PaperCard";
import { GoalInputCard } from "./GoalInputCard";
import { ReadyCard } from "./ReadyCard";

interface TodayHomeViewProps {
  isGenerating?: boolean;
  hasUnfinishedTasks: boolean;
  onGenerateGoal: (goal: string) => void | Promise<void>;
  onNavigateToMe: () => void;
  onResumeTasks: () => void;
}

export function TodayHomeView({
  isGenerating = false,
  hasUnfinishedTasks,
  onGenerateGoal,
  onNavigateToMe,
  onResumeTasks,
}: TodayHomeViewProps) {
  return (
    <div className="relative flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <header className="relative shrink-0 pt-1">
        <button
          className="absolute right-0 top-0 grid min-h-touch min-w-touch place-items-center rounded-full border border-border-paper bg-paper text-brand-blue shadow-card"
          type="button"
          aria-label="设置"
          onClick={onNavigateToMe}
        >
          <IconSettings size={24} />
        </button>

        <p className="max-w-[17rem] text-sm font-medium leading-6 text-text-secondary">
          早上好，今天我们一起向前一点点
        </p>
        <h1 className="mt-2 max-w-[18rem] font-serif text-3xl font-semibold leading-tight text-brand-blue">
          今天，想完成哪一小步？
        </h1>

        <div className="absolute right-8 top-16 rotate-6 text-brand-blue/80">
          <IconPaperPlane size={46} />
        </div>
        <div className="absolute right-2 top-28 text-brand-blue/45">
          <IconStar size={24} />
        </div>
      </header>

      <div className="shrink-0"><GoalInputCard isGenerating={isGenerating} onGenerateGoal={onGenerateGoal} /></div>
      {hasUnfinishedTasks ? (
        <div className="shrink-0">
          <ReadyCard onReady={onResumeTasks} />
        </div>
      ) : null}

      <PaperCard padding="compact" className="shrink-0 space-y-2 bg-paper/85">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold leading-5 text-brand-blue">今天走到了这里</p>
            <p className="mt-1 text-xs leading-4 text-text-secondary">
              已经完成 2 个小步骤，继续保持这个节奏。
            </p>
          </div>
          <IconFire size={24} />
        </div>
        <div className="h-1.5 overflow-hidden rounded-full border border-border-paper bg-paper shadow-inner">
          <div className="h-full w-1/2 rounded-full bg-[linear-gradient(90deg,#E9A84C,#F5D18A)]" />
        </div>
      </PaperCard>
    </div>
  );
}