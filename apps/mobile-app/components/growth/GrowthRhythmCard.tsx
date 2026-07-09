import { IconLeaf } from "@/components/icons";
import { PaperCard } from "@/components/ui/PaperCard";

interface GrowthRhythmCardProps {
  preferredStartActions: string[];
}

export function GrowthRhythmCard({ preferredStartActions }: GrowthRhythmCardProps) {
  return (
    <PaperCard variant="white" padding="compact" className="min-h-0 overflow-hidden bg-paper/90">
      <div className="flex h-full min-h-0 flex-col justify-between gap-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl font-semibold leading-snug text-brand-blue">
              你的节奏
            </h2>
            <p className="mt-1 text-sm leading-5 text-text-secondary">
              更适合从 5-10 分钟的小动作开始。
            </p>
          </div>
          <span className="shrink-0 text-brand-blue/65">
            <IconLeaf size={28} />
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {preferredStartActions.map((action) => (
            <span
              key={action}
              className="rounded-full bg-warm-soft px-3 py-1 text-xs font-semibold text-brand-blue"
            >
              {action}
            </span>
          ))}
        </div>
      </div>
    </PaperCard>
  );
}
