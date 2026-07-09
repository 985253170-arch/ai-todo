import { IconSeed } from "@/components/icons";
import { PaperCard } from "@/components/ui/PaperCard";

interface GrowthTaskSizeCardProps {
  recommendedMinutes: string;
  tips: string[];
}

export function GrowthTaskSizeCard({
  recommendedMinutes,
  tips,
}: GrowthTaskSizeCardProps) {
  return (
    <PaperCard variant="warm" padding="compact" className="min-h-0 overflow-hidden bg-paper-warm/95">
      <div className="flex h-full min-h-0 flex-col justify-between gap-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl font-semibold leading-snug text-brand-blue">
              适合你的小步大小
            </h2>
            <p className="mt-1 text-sm font-semibold leading-5 text-brand-blue">
              推荐：{recommendedMinutes}
            </p>
          </div>
          <span className="shrink-0 text-brand-blue/70">
            <IconSeed size={30} />
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {tips.map((tip) => (
            <span
              key={tip}
              className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-brand-blue shadow-card"
            >
              {tip}
            </span>
          ))}
        </div>
      </div>
    </PaperCard>
  );
}
