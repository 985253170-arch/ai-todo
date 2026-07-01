"use client";

import { useState } from "react";
import { HistoryItem } from "@/components/HistoryItem";
import type { TaskGroup } from "@/lib/types";

interface HistoryPanelProps {
  historyList: TaskGroup[];
  isOpen: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  onLoadMore: () => void;
  onRetry: () => void;
}

function HistorySkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((item) => (
        <div
          className="animate-pulse rounded-2xl border border-slate-200 bg-white px-5 py-4"
          key={item}
        >
          <div className="mb-3 h-4 w-28 rounded bg-slate-100" />
          <div className="mb-3 h-4 w-4/5 rounded bg-slate-100" />
          <div className="h-3 w-24 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export function HistoryPanel({
  historyList,
  isOpen,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  onLoadMore,
  onRetry,
}: HistoryPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-700">
            📋 历史记录
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            查看已清空或开始新一天后归档的任务。
          </p>
        </div>
      </div>

      {isLoading ? <HistorySkeleton /> : null}

      {!isLoading && error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-5">
          <p className="text-sm font-medium text-red-700">{error}</p>
          <button
            className="mt-3 min-h-10 rounded-full bg-white px-4 text-sm font-semibold text-red-700 transition duration-150 hover:bg-red-100"
            onClick={onRetry}
            type="button"
          >
            重试
          </button>
        </div>
      ) : null}

      {!isLoading && !error && historyList.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-2xl"
          >
            📋
          </span>
          <div className="space-y-1.5">
            <p className="text-base font-medium text-slate-700">
              还没有历史记录
            </p>
            <p className="text-sm leading-6 text-slate-400">
              完成今天的任务后，清空时任务会自动保存到历史。
            </p>
          </div>
        </div>
      ) : null}

      {!isLoading && !error && historyList.length > 0 ? (
        <div className="space-y-3">
          {historyList.map((taskGroup) => (
            <HistoryItem
              isExpanded={expandedId === taskGroup.id}
              key={taskGroup.id}
              onToggle={(taskGroupId) =>
                setExpandedId((currentId) =>
                  currentId === taskGroupId ? null : taskGroupId,
                )
              }
              taskGroup={taskGroup}
            />
          ))}

          <div className="flex justify-center pt-2">
            {hasMore ? (
              <button
                className="min-h-11 rounded-full border border-indigo-100 bg-indigo-50 px-5 text-sm font-semibold text-indigo-700 transition duration-150 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoadingMore}
                onClick={onLoadMore}
                type="button"
              >
                {isLoadingMore ? "加载中..." : "加载更多"}
              </button>
            ) : (
              <p className="text-xs font-medium text-slate-400">
                已加载全部历史记录
              </p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
