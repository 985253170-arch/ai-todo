import type { Task } from "@/lib/types";

interface TaskItemProps {
  task: Task;
  onToggle: (taskId: string) => void;
}

export function TaskItem({ task, onToggle }: TaskItemProps) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3">
      <input
        aria-label={task.title}
        checked={task.completed}
        className="h-5 w-5 shrink-0 rounded border-slate-300"
        onChange={() => onToggle(task.id)}
        type="checkbox"
      />
      <span
        className={
          task.completed
            ? "text-sm text-slate-400 line-through"
            : "text-sm text-slate-700"
        }
      >
        {task.title}
      </span>
    </div>
  );
}
