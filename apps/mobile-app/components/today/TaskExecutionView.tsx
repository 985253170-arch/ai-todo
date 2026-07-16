import { useEffect, useState } from "react";
import { IconBack } from "@/components/icons";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { getCompanionStep } from "@/services/taskService.mock";
import type { CompanionStep, Task } from "@/types/app";
import { ExecutionFeedbackBox } from "./ExecutionFeedbackBox";
import { ExecutionGuideCard } from "./ExecutionGuideCard";
import { ExecutionTaskCard } from "./ExecutionTaskCard";

interface TaskExecutionViewProps {
  task: Task;
  onBack: () => void;
  onComplete: (taskId: string) => void | Promise<void>;
}

export function TaskExecutionView({
  task,
  onBack,
  onComplete,
}: TaskExecutionViewProps) {
  const [guide, setGuide] = useState<CompanionStep | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasSubmittedFeedback, setHasSubmittedFeedback] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialGuide() {
      setIsProcessing(true);
      try {
        const nextGuide = await getCompanionStep(task.id);
        if (isMounted) {
          setGuide(nextGuide);
        }
      } finally {
        if (isMounted) {
          setIsProcessing(false);
        }
      }
    }

    void loadInitialGuide();

    return () => {
      isMounted = false;
    };
  }, [task.id]);

  async function handleFeedback(feedback: string) {
    setIsProcessing(true);
    try {
      const nextGuide = await getCompanionStep(task.id, feedback);
      setGuide(nextGuide);
      setHasSubmittedFeedback(true);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <header className="shrink-0 space-y-2 pt-1">
        <div className="grid grid-cols-3 items-center text-sm font-semibold text-brand-blue">
          <button
            className="inline-flex min-h-touch items-center gap-1 justify-self-start rounded-full bg-paper px-3 shadow-card"
            type="button"
            onClick={onBack}
          >
            <IconBack size={18} />
            回到任务
          </button>
          <p className="justify-self-center whitespace-nowrap">任务执行</p>
          <button
            className="min-h-touch justify-self-end rounded-full bg-paper px-3 text-sm shadow-card"
            type="button"
            onClick={onBack}
          >
            先退出
          </button>
        </div>

        <div>
          <h1 className="font-serif text-3xl font-semibold leading-tight text-brand-blue">
            陪你走这一步
          </h1>
          <p className="mt-1 text-sm leading-5 text-text-secondary">
            不用一次做好，只把这一小步推进一点。
          </p>
        </div>
      </header>

      <ExecutionTaskCard task={task} />
      <ExecutionGuideCard
        guide={guide}
        isProcessing={isProcessing}
        hasSubmittedFeedback={hasSubmittedFeedback}
      />
      <ExecutionFeedbackBox isProcessing={isProcessing} onSubmit={handleFeedback} />
      <PrimaryButton
        className="shrink-0 min-h-[44px] py-3 text-sm"
        onClick={() => onComplete(task.id)}
      >
        我完成了这一小步
      </PrimaryButton>
    </div>
  );
}
