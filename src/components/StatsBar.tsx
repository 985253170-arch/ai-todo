import { StatCard } from "@/components/StatCard";
import type { StatsData } from "@/lib/types";

interface StatsBarProps {
  stats: StatsData | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

function formatRate(rate: number | null) {
  if (rate === null) {
    return null;
  }

  return `${Math.round(rate * 100)}%`;
}

function StatsSkeleton() {
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[0, 1, 2, 3].map((item) => (
        <div
          className="h-28 animate-pulse rounded-2xl border border-slate-100 bg-white/70 p-4"
          key={item}
        >
          <div className="h-3 w-16 rounded bg-slate-100" />
          <div className="mt-4 h-6 w-14 rounded bg-slate-100" />
          <div className="mt-3 h-3 w-20 rounded bg-slate-100" />
        </div>
      ))}
    </section>
  );
}

export function StatsBar({ stats, isLoading, error, onRetry }: StatsBarProps) {
  if (isLoading && !stats) {
    return <StatsSkeleton />;
  }

  if (error && !stats) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white/85 px-5 py-4 shadow-[0_4px_18px_rgba(0,0,0,0.04)]">
        <p className="text-sm font-medium text-slate-600">{error}</p>
        <button
          className="mt-3 min-h-10 rounded-full bg-indigo-50 px-4 text-sm font-semibold text-indigo-700 transition duration-150 hover:bg-indigo-100"
          onClick={onRetry}
          type="button"
        >
          重试
        </button>
      </section>
    );
  }

  if (!stats) {
    return null;
  }

  const todayRate = formatRate(stats.today.completionRate);
  const sevenDayRate = formatRate(stats.sevenDay.completionRate);

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard
        helperText={
          stats.today.completionRate === null
            ? undefined
            : `已完成 ${stats.today.completedCount} / ${stats.today.totalCount}`
        }
        title="今日完成率"
        value={todayRate ?? "今天还没有开始"}
      />
      <StatCard
        helperText={
          stats.sevenDay.completionRate === null
            ? undefined
            : `${stats.sevenDay.completedCount} / ${stats.sevenDay.totalCount}`
        }
        title="最近 7 天"
        value={sevenDayRate ?? "还没有数据"}
      />
      <StatCard
        helperText={stats.performanceLabel}
        title="连续行动"
        value={`${stats.total.activeDayStreak} 天`}
      />
      <StatCard
        helperText="累计完成"
        title="总完成任务"
        value={`${stats.total.totalCompleted}`}
      />
    </section>
  );
}
