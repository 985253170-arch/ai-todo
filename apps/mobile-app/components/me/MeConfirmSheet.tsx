import { PrimaryButton } from "@/components/ui/PrimaryButton";

export type ConfirmMode = "clear-cache" | "clear-cache-success" | "logout";

interface MeConfirmSheetProps {
  mode: ConfirmMode;
  onClose: () => void;
  onClearCacheSuccess: () => void;
  onLogout: () => void;
}

interface SheetContent {
  title: string;
  description: string;
  helper?: string;
  primaryLabel: string;
  secondaryLabel?: string;
}

const sheetContent: Record<ConfirmMode, SheetContent> = {
  "clear-cache": {
    title: "要清理本地缓存吗？",
    description:
      "这只会清理这台设备上临时保存的内容。\n你的账号和已经同步的记录不会因为这一步消失。",
    helper: "如果只是想重新开始今天，也可以先回到“今日”重新整理。",
    primaryLabel: "先不清理",
    secondaryLabel: "确认清理",
  },
  "clear-cache-success": {
    title: "已经清理好了",
    description: "这台设备上的临时内容已经清空。\n你可以继续轻轻往前走。",
    primaryLabel: "知道了",
  },
  logout: {
    title: "要退出当前账号吗？",
    description:
      "退出后，你可以稍后再用这个邮箱回来。\n已经同步的行动记录会继续保留。",
    helper: "如果只是想休息一下，也可以直接关闭清行。",
    primaryLabel: "先留下",
    secondaryLabel: "确认退出",
  },
};

export function MeConfirmSheet({
  mode,
  onClose,
  onClearCacheSuccess,
  onLogout,
}: MeConfirmSheetProps) {
  const content = sheetContent[mode];

  const handleSecondaryAction = () => {
    if (mode === "clear-cache") {
      onClearCacheSuccess();
      return;
    }

    if (mode === "logout") {
      onLogout();
    }
  };

  return (
    <div
      className="fixed inset-y-0 left-1/2 z-50 flex w-full max-w-mobile -translate-x-1/2 flex-col"
      role="presentation"
    >
      <button
        aria-label="关闭确认弹层"
        className="absolute inset-0 bg-black/15"
        type="button"
        onClick={onClose}
      />
      <section
        aria-labelledby="me-confirm-sheet-title"
        aria-modal="true"
        className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-[24px] bg-paper-warm px-6 pb-[calc(24px+env(safe-area-inset-bottom))] pt-6 shadow-card-strong"
        role="dialog"
      >
        <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-border-paper" />
        <h2
          className="font-serif text-xl font-semibold text-brand-blue"
          id="me-confirm-sheet-title"
        >
          {content.title}
        </h2>
        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-text-secondary">
          {content.description}
        </p>
        {content.helper ? (
          <p className="mt-3 text-xs leading-5 text-text-tertiary">{content.helper}</p>
        ) : null}

        <div className="mt-6 space-y-3">
          <PrimaryButton onClick={onClose}>{content.primaryLabel}</PrimaryButton>
          {content.secondaryLabel ? (
            <button
              className="min-h-touch w-full rounded-button px-6 py-3 text-sm font-semibold text-[#A46A60] transition active:scale-[0.99]"
              type="button"
              onClick={handleSecondaryAction}
            >
              {content.secondaryLabel}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
