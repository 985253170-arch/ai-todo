import { PaperCard } from "@/components/ui/PaperCard";
import { MeMenuRow } from "./MeMenuRow";

interface MeMoreListProps {
  onOpenPrivacy: () => void;
  onOpenFeedback: () => void;
  onLogout: () => void;
}

export function MeMoreList({
  onOpenPrivacy,
  onOpenFeedback,
  onLogout,
}: MeMoreListProps) {
  return (
    <PaperCard variant="white" padding="compact" className="shrink-0 bg-paper/90">
      <h2 className="font-serif text-xl font-semibold text-brand-blue">更多</h2>
      <div className="mt-3 divide-y divide-border-paper/80">
        <MeMenuRow label="隐私与数据说明" onClick={onOpenPrivacy} />
        <MeMenuRow label="说说你的想法" onClick={onOpenFeedback} />
        <MeMenuRow label="当前版本" value="清行 V3.0A" />
        <MeMenuRow label="清除本地缓存" variant="warning" />
        <MeMenuRow label="退出当前账号" variant="danger" onClick={onLogout} />
      </div>
    </PaperCard>
  );
}
