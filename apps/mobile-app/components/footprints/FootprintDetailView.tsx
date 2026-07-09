import { IconBack, IconCheck, IconStar } from "@/components/icons";
import { PaperCard } from "@/components/ui/PaperCard";

interface FootprintEntry {
  id: string;
  dateLabel: string;
  goal: string;
  completedTitle: string;
  completedAt: string;
  reflection: string;
  details: string[];
}

interface FootprintDetailViewProps {
  footprint: FootprintEntry;
  onBack: () => void;
}

export function FootprintDetailView({ footprint, onBack }: FootprintDetailViewProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <header className="shrink-0 space-y-2 pt-1">
        <button
          className="inline-flex min-h-[38px] items-center gap-1 rounded-full bg-paper px-3 text-sm font-semibold text-brand-blue shadow-card"
          type="button"
          onClick={onBack}
        >
          <IconBack size={18} />
          回到足迹
        </button>
        <div>
          <h1 className="font-serif text-3xl font-semibold leading-tight text-brand-blue">
            这一步，你已经走过了
          </h1>
          <p className="mt-1 text-sm leading-5 text-text-secondary">{footprint.dateLabel}</p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <PaperCard variant="warm" padding="compact" className="shrink-0">
          <p className="text-xs font-semibold text-brand-blue/70">当时的目标</p>
          <h2 className="mt-1 font-serif text-xl font-semibold leading-snug text-brand-blue">
            {footprint.goal}
          </h2>
        </PaperCard>

        <PaperCard variant="white" padding="compact" className="shrink-0 space-y-2 bg-paper/90">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-brand-blue/70">完成的小步</p>
            <IconCheck size={24} />
          </div>
          <h2 className="font-serif text-xl font-semibold leading-snug text-brand-blue">
            {footprint.completedTitle}
          </h2>
          <p className="text-sm leading-5 text-text-secondary">当时的记录：</p>
          <p className="rounded-2xl bg-warm-soft px-3 py-2 text-sm leading-5 text-text-secondary">
            {footprint.reflection}
          </p>
        </PaperCard>

        <PaperCard variant="yellow" padding="compact" className="min-h-0 flex-1 overflow-hidden">
          <div className="flex h-full min-h-0 flex-col gap-2">
            <div className="flex shrink-0 items-center justify-between gap-3">
              <p className="text-sm font-semibold text-brand-blue">留下来的小线索</p>
              <IconStar size={22} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1 text-sm leading-5 text-text-secondary [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <ul className="space-y-1.5">
                {footprint.details.map((detail) => (
                  <li key={detail}>· {detail}</li>
                ))}
              </ul>
              <p className="mt-3">
                这一小步不是很大，但它已经让目标更近了一点。
              </p>
            </div>
          </div>
        </PaperCard>
      </div>
    </div>
  );
}
