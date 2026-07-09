import type { Task } from "@/types/app";
import { PaperCard } from "@/components/ui/PaperCard";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SecondaryButton } from "@/components/ui/SecondaryButton";

interface CurrentTaskCardProps {
  task: Task;
  onStartTask: (taskId: string) => void;
  onCompleteTask: (taskId: string) => void;
}

function getTaskDetails(task: Task): string[] {
  const details = task.details ?? [];
  const timeText = task.estimatedMinutes ? `约 ${task.estimatedMinutes} 分钟` : "先做这一小步";
  return details.length > 0 ? details : [timeText];
}

export function CurrentTaskCard({
  task,
  onStartTask,
  onCompleteTask,
}: CurrentTaskCardProps) {
  const details = getTaskDetails(task);

  return (
    <PaperCard variant="yellow" padding="compact" className="shrink-0 space-y-3">
      <span className="inline-flex rounded-full bg-paper px-3 py-1.5 text-xs font-semibold text-brand-blue shadow-inner">
        先做这一件
      </span>

      <div>
        <h2 className="line-clamp-2 font-serif text-2xl font-semibold leading-snug text-brand-blue">
          {task.title}
        </h2>
        <div className="mt-2 flex flex-wrap gap-2 text-xs leading-5 text-text-secondary">
          {details.slice(0, 2).map((item) => (
            <span key={item} className="rounded-full bg-paper/70 px-3 py-1">
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <PrimaryButton className="min-h-[48px] py-3 text-sm" onClick={() => onStartTask(task.id)}>
          陪我做这一步
        </PrimaryButton>
        <SecondaryButton
          className="min-h-[48px] w-auto whitespace-nowrap px-4 py-3 text-sm"
          onClick={() => onCompleteTask(task.id)}
        >
          我完成了
        </SecondaryButton>
      </div>
    </PaperCard>
  );
}