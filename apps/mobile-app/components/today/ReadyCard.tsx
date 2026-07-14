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
          你之前的小步还在这里。
        </p>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          进度还在，接着往前走就好，不用从头再来。
        </p>
        <SecondaryButton className="mt-5 bg-paper/85" onClick={onReady}>
          迈入新的一天
        </SecondaryButton>
      </div>
    </PaperCard>
  );
}