import { IconPaperPlane } from "@/components/icons";
import { PaperCard } from "@/components/ui/PaperCard";
import { SecondaryButton } from "@/components/ui/SecondaryButton";

interface ReadyCardProps {
  onReady?: () => void;
}

export function ReadyCard({ onReady }: ReadyCardProps) {
  return (
    <PaperCard
      variant="yellow"
      padding="normal"
      className="relative -mt-3 overflow-hidden"
    >
      <div className="absolute -right-2 top-4 rotate-6 text-brand-blue/40">
        <IconPaperPlane size={52} />
      </div>
      <div className="relative pr-12">
        <p className="font-serif text-2xl font-semibold leading-snug text-brand-blue">
          准备好了吗？
          <br />
          我们一起迈出今天一小步
        </p>
        <SecondaryButton className="mt-5 bg-paper/85" onClick={onReady}>
          迈入新的一天
        </SecondaryButton>
      </div>
    </PaperCard>
  );
}