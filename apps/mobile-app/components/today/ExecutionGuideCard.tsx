import { IconPaperPlane, IconStar } from "@/components/icons";
import { PaperCard } from "@/components/ui/PaperCard";
import type { CompanionStep } from "@/types/app";

interface ExecutionGuideCardProps {
  guide: CompanionStep | null;
  isProcessing: boolean;
}

export function ExecutionGuideCard({ guide, isProcessing }: ExecutionGuideCardProps) {
  const steps = guide?.steps.slice(0, 3) ?? [];

  return (
    <PaperCard variant="white" padding="compact" className="min-h-0 flex-1 overflow-hidden bg-paper/90">
      <div className="flex h-full min-h-0 flex-col gap-2">
        <div className="flex shrink-0 items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-brand-blue/70">先做这一小步</p>
            <h2 className="mt-1 font-serif text-xl font-semibold leading-snug text-brand-blue">
              {isProcessing ? "正在整理下一小步…" : guide?.stepTitle ?? "先做这一小步"}
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
          ) : (
            <>
              <p className="text-sm leading-6 text-text-secondary">
                不用一次做好，先照着下面这几步慢慢来。
              </p>
              <ol className="mt-2 space-y-1.5 text-sm leading-5 text-text-secondary">
                {steps.map((step, index) => (
                  <li key={`${step}-${index}`} className="flex gap-2">
                    <span className="font-semibold text-brand-blue">{index + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              {guide?.closingText ? (
                <p className="mt-2 rounded-2xl bg-warm-soft px-3 py-2 text-xs leading-5 text-text-secondary">
                  {guide.closingText}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </PaperCard>
  );
}
