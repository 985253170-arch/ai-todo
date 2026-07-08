import type { ReactNode } from "react";

type PaperCardVariant = "white" | "warm" | "yellow";
type PaperCardPadding = "normal" | "large" | "compact";

interface PaperCardProps {
  children: ReactNode;
  variant?: PaperCardVariant;
  padding?: PaperCardPadding;
  className?: string;
}

const variantClass: Record<PaperCardVariant, string> = {
  white: "bg-paper",
  warm: "bg-paper-warm",
  yellow: "bg-paper-yellow",
};

const paddingClass: Record<PaperCardPadding, string> = {
  compact: "p-4",
  normal: "p-6",
  large: "p-8",
};

export function PaperCard({
  children,
  variant = "white",
  padding = "normal",
  className = "",
}: PaperCardProps) {
  return (
    <section
      className={`rounded-card border border-border-paper shadow-card ${variantClass[variant]} ${paddingClass[padding]} ${className}`}
    >
      {children}
    </section>
  );
}
