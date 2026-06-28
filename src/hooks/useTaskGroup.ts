"use client";

import { useEffect, useMemo, useState } from "react";
import { ERROR_MESSAGES } from "@/lib/constants";
import { validateGoalInput } from "@/lib/input-validator";
import { loadTaskGroup, saveTaskGroup } from "@/lib/storage";
import type {
  ApiErrorCode,
  GenerateTasksResponse,
  PageStatus,
  TaskGroup,
} from "@/lib/types";

const API_ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  EMPTY_INPUT: ERROR_MESSAGES.EMPTY_INPUT,
  INPUT_TOO_SHORT: ERROR_MESSAGES.INPUT_TOO_SHORT,
  INPUT_TOO_LONG: ERROR_MESSAGES.INPUT_TOO_LONG,
  HIGH_RISK_INPUT: ERROR_MESSAGES.HIGH_RISK_INPUT,
  AI_GENERATION_FAILED: ERROR_MESSAGES.AI_GENERATION_FAILED,
  AI_PARSE_FAILED: ERROR_MESSAGES.AI_PARSE_FAILED,
  NETWORK_ERROR: ERROR_MESSAGES.NETWORK_ERROR,
};

export function useTaskGroup() {
  const [inputGoal, setInputGoal] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pageStatus, setPageStatus] = useState<PageStatus>("idle");
  const [taskGroup, setTaskGroup] = useState<TaskGroup | null>(null);

  const isGenerateDisabled = useMemo(() => pageStatus === "loading", [pageStatus]);
  const tasks = taskGroup?.tasks ?? [];
  const completedCount = tasks.filter((task) => task.completed).length;
  const totalCount = tasks.length;

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      const savedTaskGroup = loadTaskGroup();

      if (savedTaskGroup) {
        setTaskGroup(savedTaskGroup);
        setPageStatus("success");
      }
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, []);

  function handleInputGoalChange(goal: string) {
    setInputGoal(goal);
    setErrorMessage(null);
    setPageStatus(goal.length > 0 ? "editing" : "idle");
  }

  async function handleGenerate() {
    const validation = validateGoalInput(inputGoal);

    if (!validation.isValid) {
      setErrorMessage(validation.message);
      setPageStatus("error");
      return;
    }

    setErrorMessage(null);
    setPageStatus("loading");

    try {
      const response = await fetch("/api/generate-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: inputGoal.trim() }),
      });
      const result = (await response.json()) as GenerateTasksResponse;

      if (!response.ok || !result.success) {
        const errorCode = result.success
          ? "AI_GENERATION_FAILED"
          : result.error.code;

        setErrorMessage(API_ERROR_MESSAGES[errorCode]);
        setPageStatus(errorCode === "AI_PARSE_FAILED" ? "parse_error" : "error");
        return;
      }

      setTaskGroup(result.data);
      saveTaskGroup(result.data);
      setPageStatus("success");
    } catch {
      setErrorMessage(ERROR_MESSAGES.NETWORK_ERROR);
      setPageStatus("error");
    }
  }

  function handleToggleTask(taskId: string) {
    setTaskGroup((currentTaskGroup) => {
      if (!currentTaskGroup) {
        return currentTaskGroup;
      }

      const now = new Date().toISOString();
      const updatedTaskGroup: TaskGroup = {
        ...currentTaskGroup,
        tasks: currentTaskGroup.tasks.map((task) =>
          task.id === taskId
            ? { ...task, completed: !task.completed, updatedAt: now }
            : task,
        ),
        updatedAt: now,
      };

      saveTaskGroup(updatedTaskGroup);
      return updatedTaskGroup;
    });
  }

  return {
    pageStatus,
    taskGroup,
    inputGoal,
    errorMessage,
    tasks,
    completedCount,
    totalCount,
    isGenerateDisabled,
    setInputGoal: handleInputGoalChange,
    handleGenerate,
    handleToggleTask,
  };
}
