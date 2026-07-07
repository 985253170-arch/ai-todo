"use client";

import { useEffect, useMemo, useState } from "react";

import { useTaskAssist } from "@/hooks/useTaskAssist";
import type { AssistActionType } from "@/lib/types";

interface TaskAssistPanelProps {
  taskId: string;
  taskTitle: string;
  goal: string;
  onClose: () => void;
  onStartCompanion: () => void;
}

const DEFAULT_ERROR_MESSAGE = "AI 辅助生成失败，请稍后重试。";

const ASSIST_BUTTONS: Array<{
  actionType: AssistActionType;
  label: string;
  shortDesc: string;
}> = [
  {
    actionType: "how_to_start",
    label: "怎么开始",
    shortDesc: "找到第一步",
  },
  {
    actionType: "break_down",
    label: "拆小一点",
    shortDesc: "拆成更小步骤",
  },
  {
    actionType: "five_minute",
    label: "5 分钟版本",
    shortDesc: "降到 5 分钟可做",
  },
  {
    actionType: "im_stuck",
    label: "我卡住了",
    shortDesc: "给我一个下一步",
  },
];

export function TaskAssistPanel({
  goal,
  onClose,
  onStartCompanion,
  taskId,
  taskTitle,
}: TaskAssistPanelProps) {
  const { activeActionType, error, fetchAssist, reset, result, status } =
    useTaskAssist({
      goal,
      taskId,
      taskTitle,
    });
  const [isCopied, setIsCopied] = useState(false);

  const activeButtonLabel = useMemo(() => {
    return (
      ASSIST_BUTTONS.find((button) => button.actionType === activeActionType)
        ?.label ?? "AI 辅助"
    );
  }, [activeActionType]);

  useEffect(() => {
    if (!isCopied) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setIsCopied(false);
    }, 1600);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [isCopied]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCopy = async () => {
    if (!result) {
      return;
    }

    try {
      await navigator.clipboard.writeText(result);
      setIsCopied(true);
    } catch {
      setIsCopied(false);
    }
  };

  const handleRegenerate = () => {
    if (!activeActionType) {
      return;
    }

    void fetchAssist(activeActionType);
  };

  const isLoading = status === "loading";

  return (
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3 shadow-sm sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">AI 辅助</p>
          <p className="text-xs text-slate-500">
            选择一个方式，让 AI 帮你把这条任务往前推一步。
          </p>
        </div>
        <button
          className="min-h-11 shrink-0 rounded-full px-3 text-xs font-medium text-slate-500 transition-colors hover:bg-white hover:text-slate-700"
          onClick={handleClose}
          type="button"
        >
          关闭
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {ASSIST_BUTTONS.map((button) => {
          const isActive = activeActionType === button.actionType;

          return (
            <button
              className={
                isActive
                  ? "min-h-11 rounded-xl border border-indigo-300 bg-white px-3 py-2 text-left text-sm font-semibold text-indigo-700 shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                  : "min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 transition-colors hover:border-indigo-200 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              }
              disabled={isLoading}
              key={button.actionType}
              onClick={() => void fetchAssist(button.actionType)}
              type="button"
            >
              <span className="block">{button.label}</span>
              <span className="mt-0.5 block text-xs font-normal text-slate-500">
                {button.shortDesc}
              </span>
            </button>
          );
        })}
      </div>

      {status === "idle" ? (
        <p className="mt-3 text-xs leading-5 text-slate-500">
          选择一个方式，让 AI 帮你把这条任务往前推一步。
        </p>
      ) : null}

      {isLoading ? (
        <div className="mt-3 rounded-xl bg-white px-4 py-3 text-sm text-slate-600">
          AI 正在想一个更容易执行的版本...
        </div>
      ) : null}

      {status === "error" ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm leading-6 text-amber-800">
            {error ?? DEFAULT_ERROR_MESSAGE}
          </p>
          <button
            className="mt-3 min-h-11 rounded-full bg-amber-100 px-4 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-200"
            onClick={handleRegenerate}
            type="button"
          >
            重试
          </button>
        </div>
      ) : null}

      {status === "result" && result ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="whitespace-pre-line text-sm leading-6 text-slate-700">
            {result}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="min-h-11 rounded-full bg-slate-100 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200"
              onClick={handleCopy}
              type="button"
            >
              {isCopied ? "已复制" : "复制"}
            </button>
            <button
              className="min-h-11 rounded-full bg-indigo-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
              onClick={handleRegenerate}
              type="button"
            >
              换一个
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 border-t border-indigo-100 pt-3">
        <button
          className="min-h-11 w-full rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          onClick={onStartCompanion}
          type="button"
        >
          开始陪我做
        </button>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          一步一步来，AI 陪你推进当前任务。
        </p>
      </div>
    </div>
  );
}
