"use client";

import { useEffect, useMemo, useState } from "react";

import { TaskAssistPanel } from "@/components/TaskAssistPanel";
import { TaskCompanionPanel } from "@/components/TaskCompanionPanel";
import type { TaskExecutionStatus } from "@/lib/task-execution";
import type { Task } from "@/lib/types";

interface TaskItemSequenceContext {
  currentStepNumber: number;
  totalSteps: number;
  completedSteps: number;
  previousTaskTitle?: string;
  nextTaskTitle?: string;
}

interface TaskItemProps {
  task: Task;
  tasks: Task[];
  taskIndex: number;
  executionStatus: TaskExecutionStatus;
  onToggle: (taskId: string) => void;
  isAssistOpen: boolean;
  onToggleAssist: (taskId: string) => void;
  isCompanionOpen: boolean;
  onToggleCompanion: (taskId: string) => void;
  goal: string;
}

const LOCKED_HINT = "\u8bf7\u5148\u5b8c\u6210\u4e0a\u4e00\u6b65\uff0c\u518d\u7ee7\u7eed\u8fd9\u4e00\u6b65\u3002";
const AI_ASSIST_LABEL = "AI \u5e2e\u6211\u4e00\u4e0b";

export function TaskItem({
  executionStatus,
  goal,
  isAssistOpen,
  isCompanionOpen,
  onToggle,
  onToggleAssist,
  onToggleCompanion,
  task,
  taskIndex,
  tasks,
}: TaskItemProps) {
  const [showLockedHint, setShowLockedHint] = useState(false);
  const isCompleted = executionStatus === "completed";
  const isCurrent = executionStatus === "current";
  const isLocked = executionStatus === "locked";
  const canUseAI = isCurrent;
  const sequenceContext = useMemo<TaskItemSequenceContext | undefined>(() => {
    if (!isCurrent) {
      return undefined;
    }

    return {
      completedSteps: tasks.filter((currentTask) => currentTask.completed)
        .length,
      currentStepNumber: taskIndex + 1,
      nextTaskTitle:
        taskIndex < tasks.length - 1 ? tasks[taskIndex + 1]?.title : undefined,
      previousTaskTitle: taskIndex > 0 ? tasks[taskIndex - 1]?.title : undefined,
      totalSteps: tasks.length,
    };
  }, [isCurrent, taskIndex, tasks]);

  useEffect(() => {
    if (!showLockedHint) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setShowLockedHint(false);
    }, 2000);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [showLockedHint]);

  const handleLockedInteraction = () => {
    if (!isLocked) {
      return;
    }

    setShowLockedHint(true);
  };

  const rowClassName = isLocked
    ? "flex min-w-0 cursor-not-allowed items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 opacity-70 transition-colors"
    : isCurrent
      ? "flex min-w-0 items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50/40 px-4 py-3 transition-colors hover:bg-indigo-50/60"
      : "flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:bg-indigo-50/40";

  const titleClassName = isCompleted
    ? "min-w-0 break-words text-sm leading-6 text-slate-400 line-through"
    : isLocked
      ? "min-w-0 break-words text-sm leading-6 text-slate-400"
      : "min-w-0 break-words text-sm leading-6 text-slate-700";

  return (
    <div>
      <div
        className={rowClassName}
        onClick={handleLockedInteraction}
        onKeyDown={(event) => {
          if (!isLocked) {
            return;
          }

          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleLockedInteraction();
          }
        }}
        role={isLocked ? "button" : undefined}
        tabIndex={isLocked ? 0 : undefined}
      >
        <input
          aria-label={`${taskIndex + 1}. ${task.title}`}
          checked={task.completed}
          className={
            isLocked
              ? "pointer-events-none mt-0.5 h-6 w-6 shrink-0 cursor-not-allowed rounded border-slate-300 accent-indigo-600 sm:h-5 sm:w-5"
              : "mt-0.5 h-6 w-6 shrink-0 cursor-pointer rounded border-slate-300 accent-indigo-600 sm:h-5 sm:w-5"
          }
          disabled={isLocked}
          onChange={() => {
            if (!isLocked) {
              onToggle(task.id);
            }
          }}
          type="checkbox"
        />
        <span className={titleClassName}>{task.title}</span>
        {canUseAI ? (
          <button
            aria-expanded={isAssistOpen}
            className="ml-auto min-h-11 shrink-0 rounded-full px-3 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50"
            onClick={() => onToggleAssist(task.id)}
            type="button"
          >
            {AI_ASSIST_LABEL}
          </button>
        ) : null}
      </div>
      {showLockedHint ? (
        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          {LOCKED_HINT}
        </p>
      ) : null}
      {canUseAI && isAssistOpen ? (
        <div className="mt-2">
          <TaskAssistPanel
            goal={goal}
            onClose={() => onToggleAssist(task.id)}
            onStartCompanion={() => onToggleCompanion(task.id)}
            sequenceContext={sequenceContext}
            taskId={task.id}
            taskTitle={task.title}
          />
        </div>
      ) : null}
      {canUseAI && isCompanionOpen ? (
        <div className="mt-2">
          <TaskCompanionPanel
            goal={goal}
            onClose={() => onToggleCompanion(task.id)}
            sequenceContext={sequenceContext}
            taskId={task.id}
            taskTitle={task.title}
          />
        </div>
      ) : null}
    </div>
  );
}
