import { CompleteAllPrompt } from "@/components/CompleteAllPrompt";
import { EmptyState } from "@/components/EmptyState";
import { ErrorMessage } from "@/components/ErrorMessage";
import { TaskItem } from "@/components/TaskItem";
import { TaskProgress } from "@/components/TaskProgress";
import { UI_TEXT } from "@/lib/constants";
import { getTaskExecutionStatus } from "@/lib/task-execution";
import type { Task, TaskAdjustmentSuggestion } from "@/lib/types";

interface TaskListProps {
  tasks: Task[];
  completedCount: number;
  totalCount: number;
  isAllCompleted: boolean;
  regenerateError: string | null;
  onToggleTask: (taskId: string) => void;
  onClearTasks: () => void;
  onRegenerate: () => void;
  activeAssistTaskId: string | null;
  onToggleAssist: (taskId: string) => void;
  activeCompanionTaskId: string | null;
  onToggleCompanion: (taskId: string) => void;
  onAcceptAdjustment: (
    taskId: string,
    suggestion: TaskAdjustmentSuggestion,
  ) => void;
  goal: string;
}

export function TaskList({
  tasks,
  completedCount,
  totalCount,
  isAllCompleted,
  regenerateError,
  onToggleTask,
  onClearTasks,
  onRegenerate,
  activeAssistTaskId,
  activeCompanionTaskId,
  onAcceptAdjustment,
  onToggleAssist,
  onToggleCompanion,
  goal,
}: TaskListProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-slate-700">
          {UI_TEXT.TASK_LIST_TITLE}
        </h2>
        {totalCount > 0 ? (
          <div className="flex items-center gap-2">
            <button
              className="min-h-10 rounded-full px-3 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-indigo-600"
              onClick={onRegenerate}
              type="button"
            >
              {UI_TEXT.REGENERATE_BUTTON}
            </button>
            <button
              className="min-h-10 rounded-full px-3 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              onClick={onClearTasks}
              type="button"
            >
              {UI_TEXT.CLEAR_TASKS_BUTTON}
            </button>
          </div>
        ) : null}
      </div>

      {tasks.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            {tasks.map((task, index) => {
              const executionStatus = getTaskExecutionStatus(index, tasks);

              return (
                <TaskItem
                  executionStatus={executionStatus}
                  goal={goal}
                  isAssistOpen={activeAssistTaskId === task.id}
                  isCompanionOpen={activeCompanionTaskId === task.id}
                  key={task.id}
                  onAcceptAdjustment={onAcceptAdjustment}
                  onToggle={onToggleTask}
                  onToggleAssist={onToggleAssist}
                  onToggleCompanion={onToggleCompanion}
                  task={task}
                  taskIndex={index}
                  tasks={tasks}
                />
              );
            })}
          </div>
          <TaskProgress
            completedCount={completedCount}
            totalCount={totalCount}
          />
          {isAllCompleted ? <CompleteAllPrompt /> : null}
          <ErrorMessage message={regenerateError} />
        </div>
      )}
    </section>
  );
}



