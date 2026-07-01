import type { ReviewData } from "@/lib/types";

interface TaskReviewPanelProps {
  taskCount: number;
  review: ReviewData | null;
  isLoading: boolean;
  error: string | null;
  isStale: boolean;
  onGenerate: () => void;
  onReset: () => void;
}

export function TaskReviewPanel({
  taskCount,
  review,
  isLoading,
  error,
  isStale,
  onGenerate,
}: TaskReviewPanelProps) {
  if (taskCount === 0) {
    return null;
  }

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] sm:p-6">
        <button
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-indigo-50 px-5 text-sm font-semibold text-indigo-700 opacity-70"
          disabled
          type="button"
        >
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600"
          />
          正在生成复盘…
        </button>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 shadow-[0_4px_18px_rgba(0,0,0,0.04)] sm:px-6 sm:py-5">
        <p className="text-sm font-medium leading-6 text-amber-800">{error}</p>
        <button
          className="mt-3 min-h-11 rounded-full bg-white px-5 text-sm font-semibold text-amber-800 transition duration-150 hover:bg-amber-100"
          onClick={onGenerate}
          type="button"
        >
          重试
        </button>
      </section>
    );
  }

  if (!review) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] sm:p-6">
        <button
          className="min-h-11 w-full rounded-full bg-indigo-50 px-5 text-sm font-semibold text-indigo-700 transition duration-150 hover:bg-indigo-100"
          onClick={onGenerate}
          type="button"
        >
          💬 生成今日复盘
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] sm:p-6">
      {isStale ? (
        <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-800">
            任务状态已变化，可重新生成复盘
          </p>
          <button
            className="mt-3 min-h-11 rounded-full bg-white px-5 text-sm font-semibold text-amber-800 transition duration-150 hover:bg-amber-100"
            onClick={onGenerate}
            type="button"
          >
            重新生成
          </button>
        </div>
      ) : null}

      <div className={isStale ? "opacity-50" : undefined}>
        <h2 className="text-lg font-semibold tracking-tight text-slate-700">
          💬 今日复盘
        </h2>
        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">
          {review.feedbackText}
        </p>
      </div>
    </section>
  );
}
