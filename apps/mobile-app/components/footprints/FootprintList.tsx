import { IconFootprint } from "@/components/icons";
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

interface FootprintListProps {
  footprints: FootprintEntry[];
  onSelect: (id: string) => void;
}

export function FootprintList({ footprints, onSelect }: FootprintListProps) {
  return (
    <PaperCard variant="white" padding="compact" className="flex min-h-0 flex-1 flex-col gap-3 bg-paper/90">
      <h2 className="shrink-0 font-serif text-xl font-semibold text-brand-blue">
        最近留下的足迹
      </h2>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {footprints.map((footprint) => (
          <button
            key={footprint.id}
            className="flex w-full items-start gap-3 rounded-3xl border border-border-paper bg-warm-soft/70 px-3 py-3 text-left transition active:scale-[0.99]"
            type="button"
            onClick={() => onSelect(footprint.id)}
          >
            <span className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-paper text-brand-blue shadow-card">
              <IconFootprint active />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-xs font-semibold text-text-tertiary">{footprint.dateLabel}</span>
              <span className="mt-1 block truncate text-sm font-semibold text-brand-blue">
                {footprint.goal}
              </span>
              <span className="mt-1 block text-sm leading-5 text-text-secondary">
                完成了：{footprint.completedTitle}
              </span>
              <span className="mt-1 block text-xs leading-5 text-text-tertiary">
                {footprint.reflection}
              </span>
            </span>
          </button>
        ))}
      </div>
    </PaperCard>
  );
}
