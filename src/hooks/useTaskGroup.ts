"use client";

import { useMemo, useState } from "react";
import { validateGoalInput } from "@/lib/input-validator";
import type { PageStatus, Task, TaskGroup } from "@/lib/types";

const MOCK_TASK_TITLES = [
  "安装 Python 开发环境",
  "学习变量和数据类型",
  "完成 2 道变量练习题",
];

function createMockTaskGroup(goal: string): TaskGroup {
  const now = new Date().toISOString();

  const tasks: Task[] = MOCK_TASK_TITLES.map((title, index) => ({
    id: `task_${String(index + 1).padStart(3, "0")}`,
    title,
    completed: false,
    createdAt: now,
    updatedAt: now,
  }));

  return {
    id: `task_group_${Date.now()}`,
    goal,
    tasks,
    createdAt: now,
    updatedAt: now,
  };
}

export function useTaskGroup() {
  const [inputGoal, setInputGoal] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pageStatus, setPageStatus] = useState<PageStatus>("idle");
  const [taskGroup, setTaskGroup] = useState<TaskGroup | null>(null);

  const isGenerateDisabled = useMemo(() => false, []);
  const tasks = taskGroup?.tasks ?? [];
  const completedCount = tasks.filter((task) => task.completed).length;
  const totalCount = tasks.length;

  function handleInputGoalChange(goal: string) {
    setInputGoal(goal);
    setErrorMessage(null);
    setPageStatus(goal.length > 0 ? "editing" : "idle");
  }

  function handleGenerate() {
    const validation = validateGoalInput(inputGoal);

    if (!validation.isValid) {
      setErrorMessage(validation.message);
      setPageStatus("error");
      return;
    }

    setErrorMessage(null);
    setTaskGroup(createMockTaskGroup(inputGoal.trim()));
    setPageStatus("success");
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
  };
}
