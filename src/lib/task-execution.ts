import { isTaskGroupFromToday } from "@/lib/date-utils";
import type { TaskGroup } from "@/lib/types";

export type TaskExecutionStatus = "completed" | "current" | "locked";

type CompletableTask = {
  completed: boolean;
};

export function getCurrentTaskIndex(tasks: CompletableTask[]) {
  const currentTaskIndex = tasks.findIndex((task) => !task.completed);

  return currentTaskIndex === -1 ? null : currentTaskIndex;
}

export function getTaskExecutionStatus(
  taskIndex: number,
  tasks: CompletableTask[],
): TaskExecutionStatus {
  const task = tasks[taskIndex];

  if (!task) {
    return "locked";
  }

  if (task.completed) {
    return "completed";
  }

  return taskIndex === getCurrentTaskIndex(tasks) ? "current" : "locked";
}

export function hasIncompleteTasks(tasks: CompletableTask[]) {
  return tasks.some((task) => !task.completed);
}

export function isTaskGroupFullyCompleted(tasks: CompletableTask[]) {
  return tasks.length > 0 && tasks.every((task) => task.completed);
}

export function shouldCarryOverTaskGroup(taskGroup: TaskGroup) {
  return hasIncompleteTasks(taskGroup.tasks) && !isTaskGroupFromToday(taskGroup);
}

export function isTaskLocked(taskIndex: number, tasks: CompletableTask[]) {
  return getTaskExecutionStatus(taskIndex, tasks) === "locked";
}
