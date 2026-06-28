"use client";

import { useMemo, useState } from "react";
import { validateGoalInput } from "@/lib/input-validator";
import type { PageStatus } from "@/lib/types";

export function useTaskGroup() {
  const [inputGoal, setInputGoal] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pageStatus, setPageStatus] = useState<PageStatus>("idle");

  const isGenerateDisabled = useMemo(() => false, []);

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
    setPageStatus("editing");
  }

  return {
    pageStatus,
    inputGoal,
    errorMessage,
    isGenerateDisabled,
    setInputGoal: handleInputGoalChange,
    handleGenerate,
  };
}
