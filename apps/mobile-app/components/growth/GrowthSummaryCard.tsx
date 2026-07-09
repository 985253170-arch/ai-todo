import { IconGrowth, IconStar } from "@/components/icons";
import { PaperCard } from "@/components/ui/PaperCard";

interface GrowthSummaryCardProps {
  weeklySteps: number;
  quickStartCount: number;
}

export function GrowthSummaryCard({
  weeklySteps,
  quickStartCount,
}: GrowthSummaryCardProps) {
  return (
    <PaperCard variant="yellow" padding="compact" className="shrink-0 overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-brand-blue/70">这周，你有在往前走</p>
          <h2 className="mt-1 font-serif text-2xl font-semibold leading-snug text-brand-blue">
            这周走了 {weeklySteps} 小步
          </h2>
          <p className="mt-1 text-sm leading-5 text-text-secondary">
            其中 {quickStartCount} 次是在 10 分钟内开始的。
          </p>
        </div>
        <div className="relative shrink-0 text-brand-blue">
          <IconGrowth active />
          <span className="absolute -right-2 -top-2 text-brand-blue/45">
            <IconStar size={18} />
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-brand-blue shadow-card">
          更容易开始
        </span>
        <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-brand-blue shadow-card">
          小步更稳定
        </span>
      </div>
    </PaperCard>
  );
}
