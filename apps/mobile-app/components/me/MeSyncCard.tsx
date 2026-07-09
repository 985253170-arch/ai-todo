import { IconCheck, IconLeaf } from "@/components/icons";
import { PaperCard } from "@/components/ui/PaperCard";

export function MeSyncCard() {
  return (
    <PaperCard variant="warm" padding="compact" className="shrink-0 bg-paper-warm/95">
      <p className="text-sm font-semibold text-brand-blue">记录保存方式</p>
      <div className="mt-3 flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-paper text-brand-blue shadow-card">
          <IconLeaf size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-brand-blue">账号同步</h2>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#E6F1E7] px-2.5 py-1 text-xs font-semibold text-[#5F7F65]">
              <IconCheck size={14} />
              已同步
            </span>
          </div>
          <p className="mt-2 text-sm leading-5 text-text-secondary">
            你的行动记录会跟随账号保存，换设备也能继续。
          </p>
        </div>
      </div>
    </PaperCard>
  );
}
