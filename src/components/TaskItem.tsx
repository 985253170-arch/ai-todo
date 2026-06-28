import type { Task } from "@/lib/types";

interface TaskItemProps {
  task: Task;
  onToggle: (taskId: string) => void;
}

export function TaskItem({ task, onToggle }: TaskItemProps) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-white px-4 py-3">
      <input
        aria-label={task.title}
        checked={task.completed}
        className="mt-0.5 h-6 w-6 shrink-0 rounded border-slate-300 sm:h-5 sm:w-5"
        onChange={() => onToggle(task.id)}
        type="checkbox"
      />
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
  );
}
