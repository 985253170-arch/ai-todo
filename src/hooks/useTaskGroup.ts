"use client";

import { useEffect, useMemo, useState } from "react";
import { ERROR_MESSAGES } from "@/lib/constants";
import {
  checkRiskInput,
  validateGoalInput,
} from "@/lib/input-validator";
import { isTaskGroupFromToday } from "@/lib/date-utils";
import { loadTaskGroup, removeTaskGroup, saveTaskGroup } from "@/lib/storage";
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
  const [showNewDayPrompt, setShowNewDayPrompt] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);

  const isGenerateDisabled = useMemo(() => pageStatus === "loading", [pageStatus]);
  const tasks = taskGroup?.tasks ?? [];
  const completedCount = tasks.filter((task) => task.completed).length;
  const totalCount = tasks.length;
  const isAllCompleted = totalCount > 0 && completedCount === totalCount;

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      const savedTaskGroup = loadTaskGroup();

      if (savedTaskGroup) {
        setTaskGroup(savedTaskGroup);
        setPageStatus("success");
        setShowNewDayPrompt(!isTaskGroupFromToday(savedTaskGroup));
      }
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, []);

  function handleInputGoalChange(goal: string) {
    setInputGoal(goal);
    setErrorMessage(null);
    setRegenerateError(null);
    setPageStatus(goal.length > 0 ? "editing" : "idle");
  }

  async function requestTaskGroup(goal: string) {
    const response = await fetch("/api/generate-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: goal.trim() }),
    });
    const result = (await response.json()) as GenerateTasksResponse;

    if (!response.ok || !result.success) {
      const errorCode = result.success
        ? "AI_GENERATION_FAILED"
        : result.error.code;

      return { success: false as const, errorCode };
    }

    return { success: true as const, data: result.data };
  }

  async function handleGenerate() {
    if (pageStatus === "loading") {
      return;
    }

    const validation = validateGoalInput(inputGoal);

    if (!validation.isValid) {
      setErrorMessage(validation.message);
      setPageStatus("error");
      return;
    }

    if (checkRiskInput(inputGoal)) {
      setErrorMessage(ERROR_MESSAGES.HIGH_RISK_INPUT);
      setPageStatus("error");
      return;
    }

    setErrorMessage(null);
    setRegenerateError(null);
    setPageStatus("loading");

    try {
      const result = await requestTaskGroup(inputGoal);

      if (!result.success) {
        setErrorMessage(API_ERROR_MESSAGES[result.errorCode]);
        setPageStatus(result.errorCode === "AI_PARSE_FAILED" ? "parse_error" : "error");
        return;
      }

      setTaskGroup(result.data);
      saveTaskGroup(result.data);
      setShowNewDayPrompt(false);
      setPageStatus("success");
    } catch {
      setErrorMessage(ERROR_MESSAGES.NETWORK_ERROR);
      setPageStatus("error");
    }
  }

  async function handleRegenerate() {
    if (pageStatus === "loading") {
      return;
    }

    const goal = inputGoal.trim() || taskGroup?.goal || "";
    const validation = validateGoalInput(goal);

    if (!validation.isValid) {
      setRegenerateError(validation.message);
      setPageStatus(taskGroup ? "success" : "error");
      return;
    }

    if (checkRiskInput(goal)) {
      setRegenerateError(ERROR_MESSAGES.HIGH_RISK_INPUT);
      setPageStatus(taskGroup ? "success" : "error");
      return;
    }

    setErrorMessage(null);
    setRegenerateError(null);
    setPageStatus("loading");

    try {
      const result = await requestTaskGroup(goal);

      if (!result.success) {
        setRegenerateError(ERROR_MESSAGES.REGENERATE_FAILED);
        setPageStatus(taskGroup ? "success" : "error");
        return;
      }

      setTaskGroup(result.data);
      saveTaskGroup(result.data);
      setShowNewDayPrompt(false);
      setPageStatus("success");
    } catch {
      setRegenerateError(ERROR_MESSAGES.REGENERATE_FAILED);
      setPageStatus(taskGroup ? "success" : "error");
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

  function handleClearTasks() {
    setTaskGroup(null);
    removeTaskGroup();
    setPageStatus("idle");
    setShowNewDayPrompt(false);
    setRegenerateError(null);
  }

  function handleExampleClick(goal: string) {
    setInputGoal(goal);
    setErrorMessage(null);
    setRegenerateError(null);
    setPageStatus("editing");
  }

  function handleStartNewDay() {
    setTaskGroup(null);
    removeTaskGroup();
    setInputGoal("");
    setErrorMessage(null);
    setPageStatus("idle");
    setShowNewDayPrompt(false);
    setRegenerateError(null);
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
    showNewDayPrompt,
    regenerateError,
    isAllCompleted,
    setInputGoal: handleInputGoalChange,
    handleGenerate,
    handleToggleTask,
    handleClearTasks,
    handleRegenerate,
    handleExampleClick,
    handleStartNewDay,
  };
}
