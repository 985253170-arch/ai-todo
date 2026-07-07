"use client";

import { useCallback, useRef, useState } from "react";

import type {
  CompanionErrorCode,
  CompanionResponse,
  CompanionStep,
  CompanionUserSignal,
} from "@/lib/types";

interface TaskCompanionSequenceContext {
  currentStepNumber: number;
  totalSteps: number;
  completedSteps?: number;
  previousTaskTitle?: string;
  nextTaskTitle?: string;
}

interface UseTaskCompanionOptions {
  taskId: string;
  taskTitle: string;
  goal: string;
  sequenceContext?: TaskCompanionSequenceContext;
}

type TaskCompanionStatus = "idle" | "loading" | "active" | "done" | "error";

interface UseTaskCompanionReturn {
  status: TaskCompanionStatus;
  currentStep: CompanionStep | null;
  error: string | null;
  stepHistory: string[];
  activeSignal: CompanionUserSignal | null;
  startCompanion: () => Promise<void>;
  sendSignal: (
    userSignal: Exclude<CompanionUserSignal, "start" | "user_feedback">,
  ) => Promise<void>;
  sendFeedback: (text: string) => Promise<void>;
  exitCompanion: () => void;
  reset: () => void;
}

const DEFAULT_ERROR_MESSAGE = "AI 陪伴生成失败，请稍后重试。";
const NETWORK_ERROR_MESSAGE = "网络连接失败，请检查网络后重试。";

const COMPANION_ERROR_MESSAGES: Record<CompanionErrorCode, string> = {
  UNAUTHORIZED: "请先登录后再使用陪伴模式。",
  INVALID_REQUEST_BODY: "请求参数错误。",
  INVALID_SIGNAL: "暂不支持这个陪伴反馈。",
  AI_COMPANION_FAILED: "AI 陪伴生成失败，请稍后重试。",
  AI_RESPONSE_INVALID: "AI 返回内容不可用，请重试。",
  RATE_LIMITED: "操作过于频繁，请稍后再试。",
  INTERNAL_ERROR: "AI 陪伴生成失败，请稍后重试。",
};

function keepRecentSteps(steps: string[]) {
  return steps.slice(-5);
}

export function useTaskCompanion({
  goal,
  sequenceContext,
  taskTitle,
}: UseTaskCompanionOptions): UseTaskCompanionReturn {
  const [status, setStatus] = useState<TaskCompanionStatus>("idle");
  const [currentStep, setCurrentStep] = useState<CompanionStep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stepHistory, setStepHistory] = useState<string[]>([]);
  const [activeSignal, setActiveSignal] = useState<CompanionUserSignal | null>(
    null,
  );
  const inflightRef = useRef(false);
  const requestIdRef = useRef(0);

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    inflightRef.current = false;
    setStatus("idle");
    setCurrentStep(null);
    setError(null);
    setStepHistory([]);
    setActiveSignal(null);
  }, []);

  const requestCompanion = useCallback(
    async (userSignal: CompanionUserSignal, userFeedback?: string) => {
      if (inflightRef.current) {
        return;
      }

      inflightRef.current = true;
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      const currentStepMessage = currentStep?.message ?? "";
      const historySnapshot = keepRecentSteps(stepHistory);

      setStatus("loading");
      setError(null);
      setActiveSignal(userSignal);

      try {
        const response = await fetch("/api/task-companion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            completedSteps: sequenceContext?.completedSteps,
            currentStep: currentStepMessage,
            currentStepNumber: sequenceContext?.currentStepNumber,
            goal,
            nextTaskTitle: sequenceContext?.nextTaskTitle,
            previousTaskTitle: sequenceContext?.previousTaskTitle,
            stepHistory: historySnapshot,
            taskTitle,
            totalSteps: sequenceContext?.totalSteps,
            userFeedback: userFeedback?.trim() || undefined,
            userSignal,
          }),
        });

        const companionResponse = (await response.json()) as CompanionResponse;

        if (!response.ok || !companionResponse.success) {
          const errorCode = companionResponse.success
            ? "INTERNAL_ERROR"
            : companionResponse.error.code;
          const message =
            COMPANION_ERROR_MESSAGES[errorCode] ?? DEFAULT_ERROR_MESSAGE;
          throw new Error(message);
        }

        if (requestIdRef.current !== requestId) {
          return;
        }

        setCurrentStep(companionResponse.data);
        setStepHistory((currentHistory) =>
          keepRecentSteps([...currentHistory, companionResponse.data.message]),
        );
        setStatus(companionResponse.data.companionState);
      } catch (caughtError) {
        if (requestIdRef.current !== requestId) {
          return;
        }

        const message =
          caughtError instanceof TypeError
            ? NETWORK_ERROR_MESSAGE
            : caughtError instanceof Error
              ? caughtError.message
              : DEFAULT_ERROR_MESSAGE;

        setError(message);
        setStatus("error");
      } finally {
        if (requestIdRef.current === requestId) {
          inflightRef.current = false;
        }
      }
    },
    [currentStep?.message, goal, sequenceContext, stepHistory, taskTitle],
  );

  const startCompanion = useCallback(async () => {
    await requestCompanion("start");
  }, [requestCompanion]);

  const sendSignal = useCallback(
    async (
      userSignal: Exclude<CompanionUserSignal, "start" | "user_feedback">,
    ) => {
      await requestCompanion(userSignal);
    },
    [requestCompanion],
  );

  const sendFeedback = useCallback(
    async (text: string) => {
      const trimmedText = text.trim();

      if (!trimmedText) {
        return;
      }

      await requestCompanion("user_feedback", trimmedText);
    },
    [requestCompanion],
  );

  const exitCompanion = useCallback(() => {
    reset();
  }, [reset]);

  return {
    activeSignal,
    currentStep,
    error,
    exitCompanion,
    reset,
    sendFeedback,
    sendSignal,
    startCompanion,
    status,
    stepHistory,
  };
}
