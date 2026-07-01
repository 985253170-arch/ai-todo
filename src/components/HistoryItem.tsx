import type { TaskGroup } from "@/lib/types";

interface HistoryItemProps {
  taskGroup: TaskGroup;
  isExpanded: boolean;
  onToggle: (taskGroupId: string) => void;
}

function formatHistoryDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(value));
}

export function HistoryItem({
  taskGroup,
  isExpanded,
  onToggle,
}: HistoryItemProps) {
  const totalCount = taskGroup.tasks.length;
  const completedCount = taskGroup.tasks.filter((task) => task.completed).length;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition-colors hover:bg-slate-50/70">
      <button
        aria-expanded={isExpanded}
        className="flex w-full flex-col gap-3 px-4 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 sm:px-5"
        onClick={() => onToggle(taskGroup.id)}
        type="button"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-slate-900">
              {formatHistoryDate(taskGroup.createdAt)}
            </p>
            <p className="break-words text-sm leading-6 text-slate-600">
              目标：{taskGroup.goal}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            {isExpanded ? "收起" : "展开"}
          </span>
        </div>

        <p className="text-xs font-medium text-slate-500">
          完成了 {completedCount} / {totalCount} 项
        </p>
      </button>

      <div
        className={`grid transition-all duration-200 ${
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-2 border-t border-slate-100 px-4 py-4 sm:px-5">
            {taskGroup.tasks.map((task) => (
              <div
                className="flex min-w-0 items-start gap-3 rounded-xl bg-slate-50 px-3 py-3"
                key={task.id}
              >
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${
                    task.completed
                      ? "border-indigo-500 bg-indigo-600 text-white"
                      : "border-slate-300 bg-white text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span
                  className={
                    task.completed
                      ? "min-w-0 break-words text-sm leading-6 text-slate-400 line-through"
                      : "min-w-0 break-words text-sm leading-6 text-slate-700"
                  }
                >
                  {task.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
