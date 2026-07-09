import type { TodayState } from "@/types/app";
import { IconBack, IconStar } from "@/components/icons";
import { PaperCard } from "@/components/ui/PaperCard";
import { CurrentTaskCard } from "./CurrentTaskCard";
import { TaskProgressCard } from "./TaskProgressCard";
import { UpcomingTaskList } from "./UpcomingTaskList";

interface TaskListViewProps {
  todayState: TodayState;
  hint?: string;
  onBackHome: () => void;
  onStartTask: (taskId: string) => void;
  onCompleteTask: (taskId: string) => void;
  onLockedTaskClick: () => void;
}

export function TaskListView({
  todayState,
  hint,
  onBackHome,
  onStartTask,
  onCompleteTask,
  onLockedTaskClick,
}: TaskListViewProps) {
  const currentTask = todayState.tasks.find((task) => task.status === "current");
  const upcomingTasks = todayState.tasks.filter((task) => task.status === "locked");
  const allCompleted = todayState.totalCount > 0 && todayState.completedCount === todayState.totalCount;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <header className="shrink-0 space-y-3 pt-1">
        <div className="grid grid-cols-3 items-center text-sm font-semibold text-brand-blue">
          <button
            className="inline-flex min-h-[40px] items-center gap-1 justify-self-start rounded-full bg-paper px-3 shadow-card"
            type="button"
            onClick={onBackHome}
          >
            <IconBack size={18} />
            退出
          </button>
          <p className="justify-self-center whitespace-nowrap">任务执行</p>
          <span aria-hidden="true" />
        </div>

        <div className="relative pr-10">
          <h1 className="font-serif text-3xl font-semibold leading-tight text-brand-blue">
            已经开始了，今天慢慢来
          </h1>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            不用看完整清单，先把眼前这一小步做好。
          </p>
          <div className="absolute right-1 top-0 text-brand-blue/50">
            <IconStar size={28} />
          </div>
        </div>
      </header>

      <TaskProgressCard
        goal={todayState.goal}
        completedCount={todayState.completedCount}
        totalCount={todayState.totalCount}
      />

      {hint ? (
        <div className="shrink-0 rounded-full bg-paper-yellow px-3 py-2 text-center text-xs font-semibold text-brand-blue shadow-card">
          {hint}
        </div>
      ) : null}

      {currentTask ? (
        <CurrentTaskCard
          task={currentTask}
          onStartTask={onStartTask}
          onCompleteTask={onCompleteTask}
        />
      ) : null}

      {allCompleted ? (
        <PaperCard variant="yellow" padding="compact" className="shrink-0">
          <p className="font-serif text-xl font-semibold leading-snug text-brand-blue">
            今天这些小步已经走完了，辛苦了。
          </p>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            可以停在这里，也可以明天再慢慢继续。
          </p>
        </PaperCard>
      ) : null}

      <UpcomingTaskList
        tasks={upcomingTasks}
        onLockedTaskClick={onLockedTaskClick}
      />
    </div>
  );
}