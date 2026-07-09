import { PaperCard } from "@/components/ui/PaperCard";

interface TaskProgressCardProps {
  goal: string;
  completedCount: number;
  totalCount: number;
}

export function TaskProgressCard({
  goal,
  completedCount,
  totalCount,
}: TaskProgressCardProps) {
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <PaperCard variant="white" padding="compact" className="shrink-0 space-y-3">
      <div>
        <p className="text-xs font-semibold text-text-secondary">今天的小目标</p>
        <p className="mt-1 line-clamp-1 font-serif text-xl font-semibold text-brand-blue">
          {goal}
        </p>
        <p className="mt-1 text-xs leading-5 text-text-secondary">
          已经拆好了，我们一步一步来。
        </p>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-brand-blue">今天走到这里</p>
          <p className="shrink-0 text-xs font-semibold text-brand-blue">
            已完成 {completedCount} / {totalCount} 小步
          </p>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full border border-border-paper bg-paper shadow-inner">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#E9A84C,#F5D18A)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </PaperCard>
  );
}