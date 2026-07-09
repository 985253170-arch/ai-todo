import { IconGrowth, IconLeaf, IconSeed } from "@/components/icons";
import { PaperCard } from "@/components/ui/PaperCard";
import { SecondaryButton } from "@/components/ui/SecondaryButton";

interface GrowthEmptyStateProps {
  onNavigateToToday: () => void;
}

export function GrowthEmptyState({ onNavigateToToday }: GrowthEmptyStateProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <header className="shrink-0 space-y-1 pt-1">
        <h1 className="font-serif text-3xl font-semibold leading-tight text-brand-blue">
          成长
        </h1>
        <p className="text-sm leading-5 text-text-secondary">
          慢慢来，你的变化会被看见。
        </p>
      </header>

      <PaperCard variant="warm" padding="compact" className="relative flex min-h-0 flex-1 flex-col justify-center overflow-hidden">
        <div className="absolute right-5 top-5 text-brand-blue/40">
          <IconLeaf size={44} />
        </div>
        <div className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-paper text-brand-blue shadow-card">
          <IconGrowth active />
        </div>
        <h2 className="font-serif text-2xl font-semibold leading-snug text-brand-blue">
          还在积累你的行动节奏
        </h2>
        <div className="mt-3 space-y-1 text-sm leading-6 text-text-secondary">
          <p>完成几个小步骤后，这里会帮你看见：</p>
          <p>你更容易开始的时刻，</p>
          <p>你适合的任务大小，</p>
          <p>以及下一步可以怎么轻轻调整。</p>
        </div>
        <div className="mt-5 text-brand-blue/70">
          <IconSeed size={30} />
        </div>
      </PaperCard>

      <SecondaryButton className="shrink-0" onClick={onNavigateToToday}>
        先回到今日
      </SecondaryButton>
    </div>
  );
}
