"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ERROR_MESSAGES } from "@/lib/constants";
import { getOrCreateDeviceId } from "@/lib/device-id";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import {
  checkRiskInput,
  validateGoalInput,
} from "@/lib/input-validator";
import { isTaskGroupFromToday } from "@/lib/date-utils";
import { loadTaskGroup, removeTaskGroup, saveTaskGroup } from "@/lib/storage";
import {
  clearTodayResolvedAdjustmentsForNewDay,
  isTaskLocked,
  shouldCarryOverTaskGroup,
} from "@/lib/task-execution";
import type {
  ApiErrorCode,
  ApplyTaskAdjustmentInput,
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

async function migrateDeviceTaskGroupsToUser(deviceId: string) {
  try {
    const response = await fetch("/api/task-group/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId }),
    });

    if (!response.ok) {
      reportCloudError("migrate", response.status);
      return null;
    }

    const result = (await response.json()) as {
      success: true;
      migratedCount: number;
    };

    return result.migratedCount;
  } catch (error) {
    reportCloudError("migrate", error);
    return null;
  }
}

function getDeviceStorageScope(deviceId: string) {
  return `device:${deviceId}`;
}

function getUserStorageScope(userId: string) {
  return `user:${userId}`;
}

function reportTaskGroupRestore(
  authScope: "user" | "device",
  source: "local" | "cloud" | "empty" | "start" | "stale",
) {
  if (process.env.NODE_ENV === "development") {
    console.info("Task group restore", {
      authScope,
      storageScopePrefix: authScope,
      source,
    });
  }
}

export function useTaskGroup() {
  const [inputGoal, setInputGoal] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pageStatus, setPageStatus] = useState<PageStatus>("idle");
  const [taskGroup, setTaskGroup] = useState<TaskGroup | null>(null);
  const [showNewDayPrompt, setShowNewDayPrompt] = useState(false);
  const [showCarryoverPrompt, setShowCarryoverPrompt] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const storageScopeRef = useRef<string | null>(null);
  const migratedScopeRef = useRef<Set<string>>(new Set());

  const isGenerateDisabled = useMemo(() => pageStatus === "loading", [pageStatus]);
  const tasks = taskGroup?.tasks ?? [];
  const completedCount = tasks.filter((task) => task.completed).length;
  const totalCount = tasks.length;
  const isAllCompleted = totalCount > 0 && completedCount === totalCount;

  useEffect(() => {
    let isCancelled = false;
    let restoreRunId = 0;
    const supabase = createSupabaseBrowserClient();

    function applyRestoredTaskGroup(restoredTaskGroup: TaskGroup) {
      const cleanupResult =
        clearTodayResolvedAdjustmentsForNewDay(restoredTaskGroup);
      const taskGroupToApply = cleanupResult.taskGroup;
      const shouldCarryOver = shouldCarryOverTaskGroup(taskGroupToApply);

      if (cleanupResult.changed) {
        saveTaskGroup(taskGroupToApply, storageScopeRef.current ?? getDeviceStorageScope(getOrCreateDeviceId()));
      }

      setTaskGroup(taskGroupToApply);
      setPageStatus("success");
      setShowCarryoverPrompt(shouldCarryOver);
      setShowNewDayPrompt(
        !shouldCarryOver && !isTaskGroupFromToday(taskGroupToApply),
      );

      return taskGroupToApply;
    }

    async function restoreForAuthUser(userId: string | null) {
      const currentRestoreRunId = ++restoreRunId;
      const deviceId = getOrCreateDeviceId();
      const authScope = userId ? "user" : "device";
      const deviceStorageScope = getDeviceStorageScope(deviceId);
      const storageScope = userId
        ? getUserStorageScope(userId)
        : deviceStorageScope;

      storageScopeRef.current = storageScope;
      setTaskGroup(null);
      setPageStatus("idle");
      setShowNewDayPrompt(false);
      setShowCarryoverPrompt(false);
      removeTaskGroup();
      reportTaskGroupRestore(authScope, "start");

      if (userId) {
        const migratedScopeKey = `${userId}:${deviceId}`;

        if (!migratedScopeRef.current.has(migratedScopeKey)) {
          migratedScopeRef.current.add(migratedScopeKey);

          const migratedCount = await migrateDeviceTaskGroupsToUser(deviceId);

          if (isCancelled || currentRestoreRunId !== restoreRunId) {
            reportTaskGroupRestore(authScope, "stale");
            return;
          }

          removeTaskGroup(deviceStorageScope);

          if (migratedCount && migratedCount > 0) {
            removeTaskGroup(storageScope);
          }
        }
      }

      const savedTaskGroup = loadTaskGroup(storageScope);

      if (savedTaskGroup) {
        if (isCancelled || currentRestoreRunId !== restoreRunId) {
          reportTaskGroupRestore(authScope, "stale");
          return;
        }

        applyRestoredTaskGroup(savedTaskGroup);
        reportTaskGroupRestore(authScope, "local");
        return;
      }

      const cloudTaskGroup = await loadTaskGroupFromCloud(deviceId);

      if (isCancelled || currentRestoreRunId !== restoreRunId) {
        reportTaskGroupRestore(authScope, "stale");
        return;
      }

      if (!cloudTaskGroup) {
        setTaskGroup(null);
        setPageStatus("idle");
        setShowNewDayPrompt(false);
        setShowCarryoverPrompt(false);
        reportTaskGroupRestore(authScope, "empty");
        return;
      }

      const restoredCloudTaskGroup = applyRestoredTaskGroup(cloudTaskGroup);
      saveTaskGroup(restoredCloudTaskGroup, storageScope);
      reportTaskGroupRestore(authScope, "cloud");
    }

    const restoreTimer = window.setTimeout(() => {
      if (!supabase) {
        void restoreForAuthUser(null);
        return;
      }

      void supabase.auth.getUser().then(({ data }) => {
        void restoreForAuthUser(data.user?.id ?? null);
      });
    }, 0);

    const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
      void restoreForAuthUser(session?.user.id ?? null);
    }).data.subscription;

    return () => {
      isCancelled = true;
      window.clearTimeout(restoreTimer);
      subscription?.unsubscribe();
    };
  }, []);

  function getCurrentStorageScope() {
    const deviceId = getOrCreateDeviceId();

    return storageScopeRef.current ?? getDeviceStorageScope(deviceId);
  }

  function saveCurrentTaskGroup(taskGroupToSave: TaskGroup) {
    saveTaskGroup(taskGroupToSave, getCurrentStorageScope());
  }

  function removeCurrentTaskGroup() {
    removeTaskGroup(getCurrentStorageScope());
  }

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
      body: JSON.stringify({
        goal: goal.trim(),
        deviceId: getOrCreateDeviceId(),
        timezoneOffset: new Date().getTimezoneOffset(),
      }),
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
      saveCurrentTaskGroup(result.data);
      void saveTaskGroupToCloud(getOrCreateDeviceId(), result.data);
      setShowNewDayPrompt(false);
      setShowCarryoverPrompt(false);
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
      saveCurrentTaskGroup(result.data);
      void saveTaskGroupToCloud(getOrCreateDeviceId(), result.data);
      setShowNewDayPrompt(false);
      setShowCarryoverPrompt(false);
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

      const taskIndex = currentTaskGroup.tasks.findIndex(
        (task) => task.id === taskId,
      );

      if (
        taskIndex === -1 ||
        isTaskLocked(taskIndex, currentTaskGroup.tasks)
      ) {
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

      saveCurrentTaskGroup(updatedTaskGroup);
      void saveTaskGroupToCloud(getOrCreateDeviceId(), updatedTaskGroup);
      return updatedTaskGroup;
    });
  }


  function applyTaskAdjustment(
    taskId: string,
    input: ApplyTaskAdjustmentInput,
  ) {
    setTaskGroup((currentTaskGroup) => {
      if (!currentTaskGroup) {
        return currentTaskGroup;
      }

      const taskToAdjust = currentTaskGroup.tasks.find(
        (task) => task.id === taskId,
      );

      if (!taskToAdjust) {
        return currentTaskGroup;
      }

      if (input.type === "downgraded" && !input.alternativeTitle?.trim()) {
        return currentTaskGroup;
      }

      const now = new Date().toISOString();
      const updatedTaskGroup: TaskGroup = {
        ...currentTaskGroup,
        tasks: currentTaskGroup.tasks.map((task) => {
          if (task.id !== taskId) {
            return task;
          }

          const reason = input.reason?.trim() || undefined;

          if (input.type === "downgraded") {
            const alternativeTitle = input.alternativeTitle?.trim();

            if (!alternativeTitle) {
              return task;
            }

            return {
              ...task,
              adjustment: {
                adjustedAt: now,
                originalTitle: task.adjustment?.originalTitle ?? task.title,
                reason,
                type: "downgraded",
              },
              title: alternativeTitle,
              updatedAt: now,
            };
          }

          return {
            ...task,
            adjustment: {
              adjustedAt: now,
              reason,
              type: input.type,
            },
            updatedAt: now,
          };
        }),
        updatedAt: now,
      };

      saveCurrentTaskGroup(updatedTaskGroup);
      void saveTaskGroupToCloud(getOrCreateDeviceId(), updatedTaskGroup);
      return updatedTaskGroup;
    });
  }

  function handleClearTasks() {
    setTaskGroup(null);
    removeCurrentTaskGroup();
    void deleteTaskGroupFromCloud(getOrCreateDeviceId());
    setPageStatus("idle");
    setShowNewDayPrompt(false);
    setShowCarryoverPrompt(false);
    setRegenerateError(null);
  }

  function handleContinueCarryover() {
    setShowCarryoverPrompt(false);
  }

  function handleExampleClick(goal: string) {
    setInputGoal(goal);
    setErrorMessage(null);
    setRegenerateError(null);
    setPageStatus("editing");
  }

  function handleStartNewDay() {
    setTaskGroup(null);
    removeCurrentTaskGroup();
    void deleteTaskGroupFromCloud(getOrCreateDeviceId());
    setInputGoal("");
    setErrorMessage(null);
    setPageStatus("idle");
    setShowNewDayPrompt(false);
    setShowCarryoverPrompt(false);
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
    showCarryoverPrompt,
    regenerateError,
    isAllCompleted,
    setInputGoal: handleInputGoalChange,
    handleGenerate,
    handleToggleTask,
    applyTaskAdjustment,
    handleClearTasks,
    handleContinueCarryover,
    handleRegenerate,
    handleExampleClick,
    handleStartNewDay,
  };
}
