import { IconMe } from "@/components/icons";
import { PaperCard } from "@/components/ui/PaperCard";

export function MeAccountCard() {
  return (
    <PaperCard variant="white" padding="compact" className="shrink-0 bg-paper/90">
      <div className="flex items-center gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-paper-yellow text-brand-blue shadow-card">
          <IconMe active />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-brand-blue">user@example.com</p>
          <span className="mt-2 inline-flex rounded-full bg-warm-soft px-3 py-1 text-xs font-semibold text-brand-blue/75">
            已登录
          </span>
        </div>
      </div>
    </PaperCard>
  );
}
