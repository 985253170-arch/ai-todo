import { STORAGE_KEY } from "@/lib/constants";
import type { Task, TaskGroup } from "@/lib/types";

function isBrowser() {
  return typeof window !== "undefined";
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

export function saveTaskGroup(taskGroup: TaskGroup) {
  if (!isBrowser()) {
    return false;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(taskGroup));
    return true;
  } catch (error) {
    console.warn("Failed to save task group.", error);
    return false;
  }
}

export function loadTaskGroup() {
  if (!isBrowser()) {
    return null;
  }

  try {
    const rawTaskGroup = window.localStorage.getItem(STORAGE_KEY);

    if (!rawTaskGroup) {
      return null;
    }

    const parsedTaskGroup: unknown = JSON.parse(rawTaskGroup);

    if (!isTaskGroup(parsedTaskGroup)) {
      removeTaskGroup();
      return null;
    }

    return parsedTaskGroup;
  } catch (error) {
    console.warn("Failed to load task group.", error);
    removeTaskGroup();
    return null;
  }
}

export function removeTaskGroup() {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to remove task group.", error);
  }
}
