import { IconPaperPlane, IconStar } from "@/components/icons";
import { PaperCard } from "@/components/ui/PaperCard";
import type { CompanionStep } from "@/types/app";

interface ExecutionGuideCardProps {
  guide: CompanionStep | null;
  isProcessing: boolean;
  hasSubmittedFeedback: boolean;
}

export function ExecutionGuideCard({
  guide,
  isProcessing,
  hasSubmittedFeedback,
}: ExecutionGuideCardProps) {
  return (
    <PaperCard variant="white" padding="compact" className="min-h-0 flex-1 overflow-hidden bg-paper/90">
      <div className="flex h-full min-h-0 flex-col gap-2">
        <div className="flex shrink-0 items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-brand-blue/70">
              {guide?.taskTitle ?? "陪你走这一步"}
            </p>
            <h2 className="mt-1 font-serif text-xl font-semibold leading-snug text-brand-blue">
              给你一个更轻的下一步
            </h2>
          </div>
          <div className="relative shrink-0 text-brand-blue/75">
            <IconPaperPlane size={32} />
            <span className="absolute -right-1 -top-1 text-brand-blue/45">
              <IconStar size={14} />
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {isProcessing ? (
            <p className="text-sm leading-6 text-text-secondary">
              我正在把你现在的情况整理成更轻的一步。
            </p>
          ) : hasSubmittedFeedback ? (
            <div className="space-y-2 text-sm leading-6 text-text-secondary">
              <p>我看到你已经开始推进了。</p>
              <p>现在不用扩展太多，先把其中一个点写清楚就好。</p>
              <div className="rounded-3xl bg-warm-soft px-3 py-2">
                <p className="text-xs font-semibold text-brand-blue">下一小步：</p>
                <p className="mt-1 text-sm leading-6 text-text-primary">
                  把你刚才提到的内容，写成一句完整的话。
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-sm leading-6 text-text-secondary">
              <p>先不用想完整答案。</p>
              <p>你可以告诉我：你做到哪了、卡在哪里，或者只写一句现在的想法。</p>
              <p>我会帮你把它变成一个更容易继续的小动作。</p>
            </div>
          )}
        </div>
      </div>
    </PaperCard>
  );
}
