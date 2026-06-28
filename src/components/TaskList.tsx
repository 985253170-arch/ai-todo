import { EmptyState } from "@/components/EmptyState";
import { TaskItem } from "@/components/TaskItem";
import { TaskProgress } from "@/components/TaskProgress";
import type { Task } from "@/lib/types";

interface TaskListProps {
  tasks: Task[];
  completedCount: number;
  totalCount: number;
}

export function TaskList({
  tasks,
  completedCount,
  totalCount,
}: TaskListProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-950">今日任务</h2>
      </div>

      {tasks.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            {tasks.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </div>
          <TaskProgress
            completedCount={completedCount}
            totalCount={totalCount}
          />
        </div>
      )}
    </section>
  );
}
