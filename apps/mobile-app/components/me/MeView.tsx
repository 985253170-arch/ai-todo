import { useState } from "react";
import { IconLeaf } from "@/components/icons";
import { MeAccountCard } from "./MeAccountCard";
import { MeFeedbackPage } from "./MeFeedbackPage";
import { MeMoreList } from "./MeMoreList";
import { MePrivacyPage } from "./MePrivacyPage";
import { MeSyncCard } from "./MeSyncCard";

interface MeViewProps {
  onLogout: () => void;
}

type MeMode = "home" | "privacy" | "feedback";

export function MeView({ onLogout }: MeViewProps) {
  const [meMode, setMeMode] = useState<MeMode>("home");

  if (meMode === "privacy") {
    return <MePrivacyPage onBack={() => setMeMode("home")} />;
  }

  if (meMode === "feedback") {
    return <MeFeedbackPage onBack={() => setMeMode("home")} />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <header className="shrink-0 space-y-1 pt-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl font-semibold leading-tight text-brand-blue">
              我的小空间
            </h1>
            <p className="mt-1 text-sm leading-5 text-text-secondary">
              账号、同步和记录，都安静放在这里。
            </p>
          </div>
          <span className="shrink-0 rotate-6 text-brand-blue/65">
            <IconLeaf size={34} />
          </span>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-3 pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <MeAccountCard />
        <MeSyncCard />
        <MeMoreList
          onOpenPrivacy={() => setMeMode("privacy")}
          onOpenFeedback={() => setMeMode("feedback")}
          onLogout={onLogout}
        />
      </div>
    </div>
  );
}
