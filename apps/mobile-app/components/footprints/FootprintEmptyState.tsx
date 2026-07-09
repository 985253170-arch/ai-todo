import { IconFootprint, IconPaperPlane } from "@/components/icons";
import { PaperCard } from "@/components/ui/PaperCard";
import { SecondaryButton } from "@/components/ui/SecondaryButton";

interface FootprintEmptyStateProps {
  onNavigateToToday: () => void;
}

export function FootprintEmptyState({ onNavigateToToday }: FootprintEmptyStateProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <header className="shrink-0 space-y-1 pt-1">
        <h1 className="font-serif text-3xl font-semibold leading-tight text-brand-blue">
          足迹
        </h1>
        <p className="text-sm leading-5 text-text-secondary">
          走过的小步，都会在这里留下痕迹。
        </p>
      </header>

      <PaperCard variant="warm" padding="compact" className="relative flex min-h-0 flex-1 flex-col justify-center overflow-hidden">
        <div className="absolute right-5 top-5 rotate-6 text-brand-blue/55">
          <IconPaperPlane size={44} />
        </div>
        <div className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-paper text-brand-blue shadow-card">
          <IconFootprint active />
        </div>
        <h2 className="font-serif text-2xl font-semibold leading-snug text-brand-blue">
          还没有留下足迹
        </h2>
        <p className="mt-3 text-sm leading-6 text-text-secondary">
          完成一个小步骤后，这里会慢慢亮起来。
        </p>
      </PaperCard>

      <SecondaryButton className="shrink-0" onClick={onNavigateToToday}>
        先回到今日
      </SecondaryButton>
    </div>
  );
}
