import { IconCheck, IconStar } from "@/components/icons";
import { PaperCard } from "@/components/ui/PaperCard";

interface FootprintSummaryCardProps {
  totalCompletedToday: number;
}

export function FootprintSummaryCard({ totalCompletedToday }: FootprintSummaryCardProps) {
  return (
    <PaperCard variant="yellow" padding="compact" className="shrink-0 overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-brand-blue/70">今天</p>
          <h2 className="mt-1 font-serif text-2xl font-semibold leading-snug text-brand-blue">
            今天走了 {totalCompletedToday} 小步
          </h2>
          <p className="mt-1 text-sm leading-5 text-text-secondary">
            已经很好了，保持这个节奏就够了。
          </p>
        </div>
        <div className="relative shrink-0 text-brand-blue">
          <IconCheck size={34} />
          <span className="absolute -right-2 -top-2 text-brand-blue/45">
            <IconStar size={18} />
          </span>
        </div>
      </div>
    </PaperCard>
  );
}
