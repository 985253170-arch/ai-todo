import type { ReactNode } from "react";

interface AuthShellProps {
  children: ReactNode;
  bottomInsetHandledByChild?: boolean;
}

export function AuthShell({
  children,
  bottomInsetHandledByChild = false,
}: AuthShellProps) {
  const bottomInsetClass = bottomInsetHandledByChild
    ? "pb-0"
    : "pb-[var(--safe-area-bottom)]";

  return (
    <div className="relative h-[100svh] overflow-hidden bg-warm-bg">
      <div className="mx-auto flex h-full w-full max-w-mobile flex-col overflow-hidden">
        <div
          className={[
            "min-h-0 flex-1 overflow-y-auto overscroll-y-contain",
            "pt-[var(--safe-area-top)] pr-[var(--safe-area-right)]",
            "pl-[var(--safe-area-left)]",
            bottomInsetClass,
            "[-ms-overflow-style:none] [scrollbar-width:none]",
            "[&::-webkit-scrollbar]:hidden",
          ].join(" ")}
        >
          {children}
        </div>
      </div>
      <p className="orientation-hint">横屏会有一点挤，转回竖屏会更舒服。</p>
    </div>
  );
}
