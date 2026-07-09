"use client";

import { useState } from "react";
import { IconStar } from "@/components/icons";
import { PaperCard } from "@/components/ui/PaperCard";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { TextInput } from "@/components/ui/TextInput";

interface GoalInputCardProps {
  isGenerating?: boolean;
  onGenerateGoal: (goal: string) => void | Promise<void>;
}

function PencilIcon() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 30 30"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7.4 21.9c.6-2.4 1.2-4.5 1.9-6.2 3.1-3.6 6.1-6.4 9.3-8.9.8-.6 2-.4 2.7.4l1.1 1.2c.6.8.5 1.8-.2 2.5-2.9 2.8-5.8 5.4-9.2 8.2-1.6.8-3.4 1.7-5.6 2.8Z" />
      <path d="M17.3 8.2c1.2.7 2.3 1.8 3.1 3" />
      <path d="M8.2 21.2c1 .2 2.1.2 3.2.1" />
    </svg>
  );
}

export function GoalInputCard({
  isGenerating = false,
  onGenerateGoal,
}: GoalInputCardProps) {
  const [goal, setGoal] = useState("");
  const [error, setError] = useState("");
  const trimmedGoal = goal.trim();

  function handleSubmit() {
    if (!trimmedGoal) {
      setError("先写下一句话就好。");
      return;
    }

    setError("");
    void onGenerateGoal(trimmedGoal);
  }

  return (
    <PaperCard variant="white" padding="large" className="space-y-5">
      <div className="flex items-center justify-between text-brand-blue">
        <PencilIcon />
        <IconStar size={24} />
      </div>

      <TextInput
        value={goal}
        onChange={(value) => {
          setGoal(value);
          if (error) {
            setError("");
          }
        }}
        placeholder="例如：准备明天的面试"
        aria-label="今天想完成的小步"
        error={error}
      />

      <p className="text-sm leading-6 text-text-secondary">
        不用想清全部，先写下一句话。
      </p>

      <PrimaryButton
        disabled={!trimmedGoal}
        loading={isGenerating}
        loadingText="正在整理今天的小步..."
        onClick={handleSubmit}
      >
        迈出全新的一步
      </PrimaryButton>
    </PaperCard>
  );
}