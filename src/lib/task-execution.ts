import { isTaskGroupFromToday } from "@/lib/date-utils";
import type { TaskAdjustment, TaskGroup } from "@/lib/types";

export type TaskExecutionStatus =
  | "completed"
  | "current"
  | "locked"
  | "resolved_today";

type CompletableTask = {
  completed: boolean;
  adjustment?: TaskAdjustment;
};

export function isTaskTodayResolved(adjustment?: TaskAdjustment) {
  return adjustment?.type === "tomorrow" || adjustment?.type === "keep_visible";
}

export function getCurrentTaskIndex(tasks: CompletableTask[]) {
  const currentTaskIndex = tasks.findIndex(
    (task) => !task.completed && !isTaskTodayResolved(task.adjustment),
  );

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

  if (isTaskTodayResolved(task.adjustment)) {
    return "resolved_today";
  }

  const currentTaskIndex = getCurrentTaskIndex(tasks);

  if (currentTaskIndex === null) {
    return "locked";
  }

  return taskIndex === currentTaskIndex ? "current" : "locked";
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

export function clearTodayResolvedAdjustmentsForNewDay(taskGroup: TaskGroup): {
  taskGroup: TaskGroup;
  changed: boolean;
} {
  if (isTaskGroupFromToday(taskGroup)) {
    return { taskGroup, changed: false };
  }

  let changed = false;
  const tasks = taskGroup.tasks.map((task) => {
    if (!isTaskTodayResolved(task.adjustment)) {
      return task;
    }

    changed = true;
    const { adjustment: _adjustment, ...cleanedTask } = task;
    return cleanedTask;
  });

  if (!changed) {
    return { taskGroup, changed: false };
  }

  return {
    taskGroup: {
      ...taskGroup,
      tasks,
    },
    changed: true,
  };
}
