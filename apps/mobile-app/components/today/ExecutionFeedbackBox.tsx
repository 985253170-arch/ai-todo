import { useState } from "react";
import { PaperCard } from "@/components/ui/PaperCard";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

interface ExecutionFeedbackBoxProps {
  isProcessing: boolean;
  onSubmit: (feedback: string) => void | Promise<void>;
}

export function ExecutionFeedbackBox({
  isProcessing,
  onSubmit,
}: ExecutionFeedbackBoxProps) {
  const [feedback, setFeedback] = useState("");
  const trimmedFeedback = feedback.trim();

  async function handleSubmit() {
    if (!trimmedFeedback || isProcessing) {
      return;
    }

    await onSubmit(trimmedFeedback);
    setFeedback("");
  }

  return (
    <PaperCard variant="warm" padding="compact" className="shrink-0 space-y-2">
      <div>
        <h2 className="font-serif text-lg font-semibold leading-snug text-brand-blue">
          把现在的情况告诉我
        </h2>
        <p className="mt-1 text-xs leading-5 text-text-secondary">
          不用写很多，一句话也可以。
        </p>
      </div>

      <textarea
        className="h-20 w-full resize-none rounded-3xl border border-border-paper bg-paper px-4 py-3 text-sm leading-5 text-text-primary outline-none transition placeholder:text-text-tertiary focus:border-brand-blue/50"
        maxLength={300}
        placeholder="写下你做到哪了、卡在哪里，或贴一小段草稿。"
        value={feedback}
        onChange={(event) => setFeedback(event.target.value)}
      />

      <PrimaryButton
        className="min-h-[42px] py-3 text-sm"
        disabled={!trimmedFeedback}
        loading={isProcessing}
        loadingText="正在整理下一小步"
        onClick={handleSubmit}
      >
        继续陪我推进
      </PrimaryButton>
    </PaperCard>
  );
}
