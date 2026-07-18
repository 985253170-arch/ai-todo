import type { Task, TodayState } from "@/types/app";
import { IconBack } from "@/components/icons";
import { PaperCard } from "@/components/ui/PaperCard";
import { TaskProgressCard } from "./TaskProgressCard";

interface ActionListViewProps {
  todayState: TodayState;
  onBack: () => void;
}

interface ActionListTaskCardProps {
  task: Task;
  variant: "yellow" | "white";
}

function ActionListTaskCard({ task, variant }: ActionListTaskCardProps) {
  const detail = task.details
    ?.find((item) => item.trim())
    ?.trim();

  return (
    <PaperCard variant={variant} padding="compact" className="space-y-2">
      <h3 className="font-serif text-xl font-semibold leading-snug text-brand-blue">
        {task.title}
      </h3>
      {detail ? <p className="text-sm leading-6 text-text-secondary">{detail}</p> : null}
      {task.estimatedMinutes !== undefined ? (
        <p className="text-sm font-semibold text-text-secondary">
          约 {task.estimatedMinutes} 分钟
        </p>
      ) : null}
    </PaperCard>
  );
}

export function ActionListView({ todayState, onBack }: ActionListViewProps) {
  const currentTask = todayState.tasks.find((task) => task.status === "current");
  const upcomingTasks = todayState.tasks.filter(
    (task) => task.status !== "completed" && task.status !== "current",
  );
  const nextTask = upcomingTasks[0];
  const remainingTasks = upcomingTasks.slice(1);
  const remainingCount = upcomingTasks.length;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <header className="shrink-0 space-y-3 pt-1">
        <button
          className="inline-flex min-h-touch items-center gap-1 rounded-full bg-paper px-3 text-sm font-semibold text-brand-blue shadow-card"
          type="button"
          onClick={onBack}
        >
          <IconBack size={18} />
          回到任务
        </button>
        <div>
          <h1 className="font-serif text-3xl font-semibold leading-tight text-brand-blue">
            今天的其他小步
          </h1>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            不用一次看完，
            <br />
            先把眼前这一小步做好。
          </p>
        </div>
      </header>

      <TaskProgressCard
        goal={todayState.goal}
        completedCount={todayState.completedCount}
        totalCount={todayState.totalCount}
      />

      {currentTask ? (
        <section className="shrink-0 space-y-3">
          <h2 className="font-serif text-xl font-semibold text-brand-blue">正在做</h2>
          <ActionListTaskCard task={currentTask} variant="yellow" />
        </section>
      ) : null}

      {nextTask ? (
        <section className="shrink-0 space-y-3">
          <h2 className="font-serif text-xl font-semibold text-brand-blue">接下来</h2>
          <ActionListTaskCard task={nextTask} variant="white" />
        </section>
      ) : null}

      {remainingCount >= 2 ? (
        <section className="shrink-0 space-y-3">
          <h2 className="font-serif text-xl font-semibold text-brand-blue">后面再做</h2>
          <div className="space-y-3">
            {remainingTasks.map((task) => (
              <ActionListTaskCard key={task.id} task={task} variant="white" />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
