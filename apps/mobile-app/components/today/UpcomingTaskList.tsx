import type { Task } from "@/types/app";
import { PaperCard } from "@/components/ui/PaperCard";

interface UpcomingTaskListProps {
  tasks: Task[];
  onLockedTaskClick: () => void;
}

export function UpcomingTaskList({
  tasks,
  onLockedTaskClick,
}: UpcomingTaskListProps) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <PaperCard
      variant="white"
      padding="compact"
      className="flex min-h-0 flex-1 flex-col gap-3 bg-paper/85"
    >
      <h2 className="shrink-0 font-serif text-xl font-semibold text-brand-blue">后面再做</h2>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex min-h-[54px] items-center justify-between gap-3 rounded-2xl border border-border-paper bg-warm-soft/70 px-3 py-2 text-text-secondary"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="h-2 w-2 shrink-0 rounded-full bg-border-paper" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{task.title}</p>
                <p className="mt-0.5 text-xs text-text-tertiary">
                  {task.estimatedMinutes ? `约 ${task.estimatedMinutes} 分钟` : "等眼前这步完成后再看"}
                </p>
              </div>
            </div>
            <button
              className="min-h-touch shrink-0 rounded-full border border-border-paper bg-paper px-3 text-xs font-semibold text-brand-blue transition active:scale-[0.98]"
              type="button"
              onClick={onLockedTaskClick}
            >
              陪我
            </button>
          </div>
        ))}
      </div>
    </PaperCard>
  );
}