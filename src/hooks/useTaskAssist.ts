"use client";

import { useCallback, useRef, useState } from "react";

import type {
  AssistActionType,
  AssistErrorCode,
  AssistResponse,
} from "@/lib/types";

interface UseTaskAssistOptions {
  taskId: string;
  taskTitle: string;
  goal: string;
}

type TaskAssistStatus = "idle" | "loading" | "result" | "error";

type TaskAssistErrorCode =
  | AssistErrorCode
  | "TASK_TITLE_REQUIRED"
  | "AI_NOT_CONFIGURED";

type TaskAssistResponse =
  | AssistResponse
  | {
      success: false;
      error: {
        code: TaskAssistErrorCode;
        message: string;
      };
    };

interface UseTaskAssistReturn {
  status: TaskAssistStatus;
  result: string | null;
  error: string | null;
  activeActionType: AssistActionType | null;
  fetchAssist: (actionType: AssistActionType) => Promise<void>;
  reset: () => void;
}

const DEFAULT_ERROR_MESSAGE = "AI 辅助生成失败，请稍后重试。";
const NETWORK_ERROR_MESSAGE = "网络连接失败，请检查网络后重试。";

const ASSIST_ERROR_MESSAGES: Record<TaskAssistErrorCode, string> = {
  UNAUTHORIZED: "请先登录后再使用 AI 辅助。",
  INVALID_REQUEST_BODY: "请求参数错误。",
  TASK_TITLE_REQUIRED: "任务内容不能为空。",
  INVALID_ACTION_TYPE: "暂不支持这个辅助类型。",
  AI_NOT_CONFIGURED: "AI 服务暂未配置。",
  AI_ASSIST_FAILED: "AI 辅助生成失败，请稍后重试。",
  AI_RESPONSE_INVALID: "AI 返回内容不可用，请重试。",
  RATE_LIMITED: "操作过于频繁，请稍后再试。",
  INTERNAL_ERROR: "AI 辅助生成失败，请稍后重试。",
};

export function useTaskAssist({
  goal,
  taskTitle,
}: UseTaskAssistOptions): UseTaskAssistReturn {
  const [status, setStatus] = useState<TaskAssistStatus>("idle");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeActionType, setActiveActionType] =
    useState<AssistActionType | null>(null);
  const inflightRef = useRef(false);
  const requestIdRef = useRef(0);

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    inflightRef.current = false;
    setStatus("idle");
    setResult(null);
    setError(null);
    setActiveActionType(null);
  }, []);

  const fetchAssist = useCallback(
    async (actionType: AssistActionType) => {
      if (inflightRef.current) {
        return;
      }

      inflightRef.current = true;
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setStatus("loading");
      setResult(null);
      setError(null);
      setActiveActionType(actionType);

      try {
        const response = await fetch("/api/task-assist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actionType,
            goal,
            taskTitle,
          }),
        });

        const assistResponse = (await response.json()) as TaskAssistResponse;

        if (!response.ok || !assistResponse.success) {
          const errorCode = assistResponse.success
            ? "INTERNAL_ERROR"
            : assistResponse.error.code;
          const message =
            ASSIST_ERROR_MESSAGES[errorCode] ?? DEFAULT_ERROR_MESSAGE;
          throw new Error(message);
        }

        if (requestIdRef.current !== requestId) {
          return;
        }

        setResult(assistResponse.data.result);
        setStatus("result");
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
    [goal, taskTitle],
  );

  return {
    activeActionType,
    error,
    fetchAssist,
    reset,
    result,
    status,
  };
}
