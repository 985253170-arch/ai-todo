import type { Task } from "@/types/app";
import { PaperCard } from "@/components/ui/PaperCard";

interface ExecutionTaskCardProps {
  task: Task;
  compact?: boolean;
}

export function ExecutionTaskCard({
  task,
  compact = false,
}: ExecutionTaskCardProps) {
  const details = task.details?.slice(0, 2) ?? [];
  const compactDetail = task.details
    ?.find((detail) => detail.trim())
    ?.trim();

  if (compact) {
    return (
      <PaperCard variant="yellow" padding="compact" className="shrink-0 space-y-2">
        <h2 className="font-serif text-xl font-semibold leading-snug text-brand-blue">
          {task.title}
        </h2>
        {compactDetail ? (
          <p className="text-sm leading-5 text-text-secondary">{compactDetail}</p>
        ) : null}
        {typeof task.estimatedMinutes === "number" ? (
          <p className="text-xs text-text-tertiary">约 {task.estimatedMinutes} 分钟</p>
        ) : null}
      </PaperCard>
    );
  }

  return (
    <PaperCard variant="yellow" padding="compact" className="shrink-0 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-brand-blue/75">现在这件事</p>
        <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-brand-blue shadow-card">
          正在做
        </span>
      </div>

      <div>
        <h2 className="font-serif text-xl font-semibold leading-snug text-brand-blue">
          {task.title}
        </h2>
        {details.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm leading-5 text-text-secondary">
            {details.map((detail) => (
              <li key={detail}>· {detail}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm leading-5 text-text-secondary">
            先把眼前这一点点推进就好。
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-text-tertiary">
        <span>完成要不要打勾，最后由你决定。</span>
        {task.estimatedMinutes ? <span>约 {task.estimatedMinutes} 分钟</span> : null}
      </div>
    </PaperCard>
  );
}
