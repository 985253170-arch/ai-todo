import { MOCK_TODAY_STATE } from "@/mockData/mockData";
import type { CompanionStep, Task, TodayState } from "@/types/app";
import { delay } from "./serviceDelay";

let todayState: TodayState = structuredClone(MOCK_TODAY_STATE);

function cloneTodayState(): TodayState {
  return structuredClone(todayState);
}

function advanceTask(tasks: Task[], taskId: string): Task[] {
  let completedCurrent = false;

  return tasks.map((task) => {
    if (task.id === taskId && task.status !== "completed") {
      completedCurrent = true;
      return {
        ...task,
        status: "completed",
        completedAt: new Date().toISOString(),
      };
    }

    if (completedCurrent && task.status === "locked") {
      completedCurrent = false;
      return { ...task, status: "current" };
    }

    return task;
  });
}

export async function getTodayState(): Promise<TodayState> {
  await delay();
  return cloneTodayState();
}

export async function generateTasks(goal: string): Promise<TodayState> {
  await delay(320);
  todayState = {
    ...structuredClone(MOCK_TODAY_STATE),
    goal,
  };
  return cloneTodayState();
}

export async function completeTask(taskId: string): Promise<TodayState> {
  await delay(260);
  const tasks = advanceTask(todayState.tasks, taskId);
  todayState = {
    ...todayState,
    tasks,
    completedCount: tasks.filter((task) => task.status === "completed").length,
  };

  return cloneTodayState();
}

export async function getCompanionStep(
  taskId: string,
  feedback?: string,
): Promise<CompanionStep> {
  await delay(300);
  const task = todayState.tasks.find((item) => item.id === taskId);
  const taskTitle = task?.title ?? "今天这一小步";

  if (feedback?.trim()) {
    return {
      taskId,
      taskTitle,
      stepTitle: "先顺着现在的进展往前一点",
      steps: ["保留已经完成的部分。", "只补一个最小缺口。", "写完后回来自己确认是否可以勾选。"],
      closingText: "不用一次做到完美，先让这一步能继续往前。",
    };
  }

  return {
    taskId,
    taskTitle,
    stepTitle: "先做这一小步",
    steps: ["打开相关材料。", "圈出一个最重要的信息。", "把它写成一句自己的话。"],
    closingText: "写完这一句，回来告诉我你写到哪了。",
  };
}
