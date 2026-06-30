import { STORAGE_KEY } from "@/lib/constants";
import type { Task, TaskGroup } from "@/lib/types";

type TaskGroupStorageScope = string;
type TaskGroupStorageScopeType = "user" | "device";

interface TaskGroupStorageEnvelope {
  scopeType: TaskGroupStorageScopeType;
  scopeKey: string;
  taskGroup: TaskGroup;
}

function isBrowser() {
  return typeof window !== "undefined";
}

function getStorageKey(scope?: TaskGroupStorageScope | null) {
  return scope ? `${STORAGE_KEY}:${scope}` : STORAGE_KEY;
}

function parseStorageScope(
  scope?: TaskGroupStorageScope | null,
): { scopeType: TaskGroupStorageScopeType; scopeKey: string } | null {
  if (!scope) {
    return null;
  }

  const separatorIndex = scope.indexOf(":");

  if (separatorIndex <= 0) {
    return null;
  }

  const scopeType = scope.slice(0, separatorIndex);
  const scopeKey = scope.slice(separatorIndex + 1);

  if ((scopeType !== "user" && scopeType !== "device") || !scopeKey) {
    return null;
  }

  return {
    scopeType,
    scopeKey,
  };
}

function reportStorageScope(
  action: "ignored" | "loaded" | "removed",
  reason: "missing_scope" | "scope_mismatch" | "invalid_data" | "valid",
  scopeType?: TaskGroupStorageScopeType,
) {
  if (process.env.NODE_ENV === "development") {
    console.info("Task group storage", {
      action,
      reason,
      scopeType,
    });
  }
}

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== "object") {
    return false;
  }

  const task = value as Partial<Task>;

  return (
    typeof task.id === "string" &&
    typeof task.title === "string" &&
    typeof task.completed === "boolean" &&
    typeof task.createdAt === "string" &&
    typeof task.updatedAt === "string"
  );
}

function isTaskGroup(value: unknown): value is TaskGroup {
  if (!value || typeof value !== "object") {
    return false;
  }

  const taskGroup = value as Partial<TaskGroup>;

  return (
    typeof taskGroup.id === "string" &&
    typeof taskGroup.goal === "string" &&
    Array.isArray(taskGroup.tasks) &&
    taskGroup.tasks.every(isTask) &&
    typeof taskGroup.createdAt === "string" &&
    typeof taskGroup.updatedAt === "string"
  );
}

function isTaskGroupStorageEnvelope(
  value: unknown,
): value is TaskGroupStorageEnvelope {
  if (!value || typeof value !== "object") {
    return false;
  }

  const envelope = value as Partial<TaskGroupStorageEnvelope>;

  return (
    (envelope.scopeType === "user" || envelope.scopeType === "device") &&
    typeof envelope.scopeKey === "string" &&
    envelope.scopeKey.length > 0 &&
    isTaskGroup(envelope.taskGroup)
  );
}

export function saveTaskGroup(taskGroup: TaskGroup, scope?: TaskGroupStorageScope | null) {
  if (!isBrowser()) {
    return false;
  }

  const parsedScope = parseStorageScope(scope);

  if (!parsedScope) {
    return false;
  }

  try {
    const value: TaskGroupStorageEnvelope = {
      scopeType: parsedScope.scopeType,
      scopeKey: parsedScope.scopeKey,
      taskGroup,
    };

    window.localStorage.setItem(getStorageKey(scope), JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn("Failed to save task group.", error);
    return false;
  }
}

export function loadTaskGroup(scope?: TaskGroupStorageScope | null) {
  if (!isBrowser()) {
    return null;
  }

  const parsedScope = parseStorageScope(scope);

  if (!parsedScope) {
    removeTaskGroup(scope);
    reportStorageScope("ignored", "missing_scope");
    return null;
  }

  try {
    const rawTaskGroup = window.localStorage.getItem(getStorageKey(scope));

    if (!rawTaskGroup) {
      return null;
    }

    const parsedTaskGroup: unknown = JSON.parse(rawTaskGroup);

    if (!isTaskGroupStorageEnvelope(parsedTaskGroup)) {
      removeTaskGroup(scope);
      reportStorageScope("removed", "invalid_data", parsedScope.scopeType);
      return null;
    }

    if (
      parsedTaskGroup.scopeType !== parsedScope.scopeType ||
      parsedTaskGroup.scopeKey !== parsedScope.scopeKey
    ) {
      removeTaskGroup(scope);
      reportStorageScope("ignored", "scope_mismatch", parsedScope.scopeType);
      return null;
    }

    reportStorageScope("loaded", "valid", parsedScope.scopeType);
    return parsedTaskGroup.taskGroup;
  } catch (error) {
    console.warn("Failed to load task group.", error);
    removeTaskGroup(scope);
    reportStorageScope("removed", "invalid_data", parsedScope.scopeType);
    return null;
  }
}

export function removeTaskGroup(scope?: TaskGroupStorageScope | null) {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.removeItem(getStorageKey(scope));
  } catch (error) {
    console.warn("Failed to remove task group.", error);
  }
}
