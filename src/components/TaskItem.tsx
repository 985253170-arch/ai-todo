import { TaskAssistPanel } from "@/components/TaskAssistPanel";
import { TaskCompanionPanel } from "@/components/TaskCompanionPanel";
import type { Task } from "@/lib/types";

interface TaskItemProps {
  task: Task;
  onToggle: (taskId: string) => void;
  isAssistOpen: boolean;
  onToggleAssist: (taskId: string) => void;
  isCompanionOpen: boolean;
  onToggleCompanion: (taskId: string) => void;
  goal: string;
}

export function TaskItem({
  goal,
  isAssistOpen,
  isCompanionOpen,
  onToggle,
  onToggleAssist,
  onToggleCompanion,
  task,
}: TaskItemProps) {
  return (
    <div>
      <div className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:bg-indigo-50/40">
        <input
          aria-label={task.title}
          checked={task.completed}
          className="mt-0.5 h-6 w-6 shrink-0 cursor-pointer rounded border-slate-300 accent-indigo-600 sm:h-5 sm:w-5"
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
        <button
          aria-expanded={isAssistOpen}
          className="ml-auto min-h-11 shrink-0 rounded-full px-3 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50"
          onClick={() => onToggleAssist(task.id)}
          type="button"
        >
          AI 帮我一下
        </button>
      </div>
      {isAssistOpen ? (
        <div className="mt-2">
          <TaskAssistPanel
            goal={goal}
            onClose={() => onToggleAssist(task.id)}
            onStartCompanion={() => onToggleCompanion(task.id)}
            taskId={task.id}
            taskTitle={task.title}
          />
        </div>
      ) : null}
      {isCompanionOpen ? (
        <div className="mt-2">
          <TaskCompanionPanel
            goal={goal}
            onClose={() => onToggleCompanion(task.id)}
            taskId={task.id}
            taskTitle={task.title}
          />
        </div>
      ) : null}
    </div>
  );
}
