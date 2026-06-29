"use client";

import { useEffect, useMemo, useState } from "react";
import { ERROR_MESSAGES } from "@/lib/constants";
import { getOrCreateDeviceId } from "@/lib/device-id";
import {
  checkRiskInput,
  validateGoalInput,
} from "@/lib/input-validator";
import { isTaskGroupFromToday } from "@/lib/date-utils";
import { loadTaskGroup, removeTaskGroup, saveTaskGroup } from "@/lib/storage";
import type {
  ApiErrorCode,
  CloudTaskGroupResponse,
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

function reportCloudError(action: string, error: unknown) {
  if (process.env.NODE_ENV === "development") {
    console.warn(`Failed to ${action} task group in cloud.`, error);
  }
}

async function saveTaskGroupToCloud(deviceId: string, taskGroup: TaskGroup) {
  try {
    const response = await fetch("/api/task-group/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, taskGroup }),
    });

    if (!response.ok) {
      reportCloudError("save", response.status);
    }
  } catch (error) {
    reportCloudError("save", error);
  }
}

async function loadTaskGroupFromCloud(deviceId: string) {
  try {
    const response = await fetch(
      `/api/task-group/load?deviceId=${encodeURIComponent(deviceId)}`,
    );

    if (!response.ok) {
      reportCloudError("load", response.status);
      return null;
    }

    const result = (await response.json()) as CloudTaskGroupResponse;

    if (!result.success) {
      reportCloudError("load", result.error.code);
      return null;
    }

    return result.data ?? null;
  } catch (error) {
    reportCloudError("load", error);
    return null;
  }
}

async function deleteTaskGroupFromCloud(deviceId: string) {
  try {
    const response = await fetch("/api/task-group/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId }),
    });

    if (!response.ok) {
      reportCloudError("delete", response.status);
    }
  } catch (error) {
    reportCloudError("delete", error);
  }
}

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
    let isCancelled = false;

    const restoreTimer = window.setTimeout(() => {
      const savedTaskGroup = loadTaskGroup();

      if (savedTaskGroup) {
        setTaskGroup(savedTaskGroup);
        setPageStatus("success");
        setShowNewDayPrompt(!isTaskGroupFromToday(savedTaskGroup));
        return;
      }

      void (async () => {
        const deviceId = getOrCreateDeviceId();
        const cloudTaskGroup = await loadTaskGroupFromCloud(deviceId);

        if (!cloudTaskGroup || isCancelled) {
          return;
        }

        setTaskGroup(cloudTaskGroup);
        saveTaskGroup(cloudTaskGroup);
        setPageStatus("success");
        setShowNewDayPrompt(!isTaskGroupFromToday(cloudTaskGroup));
      })();
    }, 0);

    return () => {
      isCancelled = true;
      window.clearTimeout(restoreTimer);
    };
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
      void saveTaskGroupToCloud(getOrCreateDeviceId(), result.data);
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
      void saveTaskGroupToCloud(getOrCreateDeviceId(), result.data);
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
      void saveTaskGroupToCloud(getOrCreateDeviceId(), updatedTaskGroup);
      return updatedTaskGroup;
    });
  }

  function handleClearTasks() {
    setTaskGroup(null);
    removeTaskGroup();
    void deleteTaskGroupFromCloud(getOrCreateDeviceId());
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
    void deleteTaskGroupFromCloud(getOrCreateDeviceId());
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
