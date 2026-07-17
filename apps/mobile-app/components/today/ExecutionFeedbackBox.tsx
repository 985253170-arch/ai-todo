import type { RefObject } from "react";
import { PaperCard } from "@/components/ui/PaperCard";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

interface ExecutionFeedbackBoxProps {
  value: string;
  focused: boolean;
  isProcessing: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onSubmit: (feedback: string) => void | Promise<void>;
}

export function ExecutionFeedbackBox({
  value,
  focused,
  isProcessing,
  textareaRef,
  onChange,
  onFocus,
  onBlur,
  onSubmit,
}: ExecutionFeedbackBoxProps) {
  const trimmedFeedback = value.trim();

  async function handleSubmit() {
    if (!trimmedFeedback || isProcessing) {
      return;
    }

    await onSubmit(trimmedFeedback);
  }

  return (
    <PaperCard
      variant="warm"
      padding="compact"
      className={
        focused
          ? "flex min-h-0 flex-1 flex-col overflow-hidden"
          : "shrink-0 space-y-2"
      }
    >
      <div className={focused ? "flex min-h-0 flex-1 flex-col gap-2" : "space-y-2"}>
        <h2 className="font-serif text-lg font-semibold leading-snug text-brand-blue">
          把现在的情况告诉我
        </h2>
        <p className="text-xs leading-5 text-text-secondary">
          不用写很多，一句话也可以。
        </p>

        <textarea
          ref={textareaRef}
          className={`w-full resize-none overflow-y-auto rounded-3xl border border-border-paper bg-paper px-4 py-3 text-sm leading-5 text-text-primary outline-none transition placeholder:text-text-tertiary focus:border-brand-blue/50 ${
            focused ? "min-h-[112px] flex-1" : "h-28"
          }`}
          maxLength={300}
          placeholder="写下你做到哪了、卡在哪里，或贴一小段草稿。"
          value={value}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
          onFocus={onFocus}
        />

        <PrimaryButton
          className="min-h-touch shrink-0 py-3 text-sm"
          disabled={!trimmedFeedback || isProcessing}
          loading={isProcessing}
          loadingText="正在整理下一小步"
          onClick={handleSubmit}
        >
          继续陪我推进
        </PrimaryButton>
      </div>
    </PaperCard>
  );
}
