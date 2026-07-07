"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useTaskCompanion } from "@/hooks/useTaskCompanion";
import type { CompanionUserSignal } from "@/lib/types";

interface TaskCompanionSequenceContext {
  currentStepNumber: number;
  totalSteps: number;
  completedSteps?: number;
  previousTaskTitle?: string;
  nextTaskTitle?: string;
}

interface TaskCompanionPanelProps {
  taskId: string;
  taskTitle: string;
  goal: string;
  sequenceContext?: TaskCompanionSequenceContext;
  onClose: () => void;
}

const SIGNAL_BUTTONS: Array<{
  signal: Exclude<CompanionUserSignal, "start">;
  label: string;
}> = [
  { signal: "done", label: "我完成了" },
  { signal: "stuck", label: "我卡住了" },
  { signal: "too_hard", label: "太难了" },
  { signal: "encourage", label: "鼓励我一下" },
];

const DEFAULT_ERROR_MESSAGE = "AI 陪伴生成失败，请稍后重试。";

export function TaskCompanionPanel({
  goal,
  onClose,
  sequenceContext,
  taskId,
  taskTitle,
}: TaskCompanionPanelProps) {
  const {
    activeSignal,
    currentStep,
    error,
    exitCompanion,
    sendSignal,
    startCompanion,
    status,
  } = useTaskCompanion({
    goal,
    sequenceContext,
    taskId,
    taskTitle,
  });
  const hasStartedRef = useRef(false);
  const [isCopied, setIsCopied] = useState(false);
  const [lastSignal, setLastSignal] = useState<
    Exclude<CompanionUserSignal, "start"> | null
  >(null);
  const isLoading = status === "loading";
  const isDone = status === "done";

  const visibleSignalButtons = useMemo(() => {
    if (!isDone) {
      return SIGNAL_BUTTONS;
    }

    return SIGNAL_BUTTONS.filter((button) => button.signal === "encourage");
  }, [isDone]);

  useEffect(() => {
    if (hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;
    void startCompanion();
  }, [startCompanion]);

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

  const handleExit = () => {
    exitCompanion();
    onClose();
  };

  const handleCopy = async () => {
    if (!currentStep?.message) {
      return;
    }

    try {
      await navigator.clipboard.writeText(currentStep.message);
      setIsCopied(true);
    } catch {
      setIsCopied(false);
    }
  };

  const handleSendSignal = (signal: Exclude<CompanionUserSignal, "start">) => {
    setLastSignal(signal);
    void sendSignal(signal);
  };

  const handleRetry = () => {
    if (currentStep && lastSignal) {
      void sendSignal(lastSignal);
      return;
    }

    void startCompanion();
  };

  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3 shadow-sm sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">AI 陪你做</p>
          <p className="text-xs text-slate-500">
            每次只推进一步，完成与否仍由你自己判断。
          </p>
        </div>
        <button
          className="min-h-11 shrink-0 rounded-full px-3 text-xs font-medium text-slate-500 transition-colors hover:bg-white hover:text-slate-700"
          onClick={handleExit}
          type="button"
        >
          退出陪伴
        </button>
      </div>

      <div className="rounded-xl border border-emerald-100 bg-white px-4 py-3">
        {isLoading ? (
          <p className="text-sm leading-6 text-slate-600">
            AI 正在准备当前这一步...
          </p>
        ) : null}

        {status === "error" ? (
          <div>
            <p className="text-sm leading-6 text-amber-800">
              {error ?? DEFAULT_ERROR_MESSAGE}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="min-h-11 rounded-full bg-amber-100 px-4 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-200"
                onClick={handleRetry}
                type="button"
              >
                重试
              </button>
              <button
                className="min-h-11 rounded-full bg-slate-100 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                onClick={handleExit}
                type="button"
              >
                退出陪伴
              </button>
            </div>
          </div>
        ) : null}

        {(status === "active" || status === "done") && currentStep ? (
          <p className="whitespace-pre-line text-sm leading-6 text-slate-700">
            {currentStep.message}
          </p>
        ) : null}

        {status === "idle" ? (
          <p className="text-sm leading-6 text-slate-600">准备开始陪伴...</p>
        ) : null}
      </div>

      {isDone ? (
        <p className="mt-3 rounded-xl bg-white/80 px-4 py-3 text-xs leading-5 text-emerald-700">
          如果你觉得这条任务已经推进到位，可以回到任务行手动勾选完成。
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2">
        {visibleSignalButtons.map((button) => (
          <button
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-emerald-200 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
            key={button.signal}
            onClick={() => handleSendSignal(button.signal)}
            type="button"
          >
            {activeSignal === button.signal && isLoading
              ? "处理中..."
              : button.label}
          </button>
        ))}
        <button
          className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-emerald-200 hover:text-emerald-700"
          onClick={handleCopy}
          type="button"
        >
          {isCopied ? "已复制" : "复制当前步骤"}
        </button>
        <button
          className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-emerald-200 hover:text-emerald-700"
          onClick={handleExit}
          type="button"
        >
          退出陪伴
        </button>
      </div>
    </div>
  );
}
