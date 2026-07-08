import type { ReactNode } from "react";

interface SectionTitleProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function SectionTitle({
  title,
  subtitle,
  action,
  className = "",
}: SectionTitleProps) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div>
        <h2 className="font-serif text-2xl font-semibold text-brand-blue">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-2 text-sm leading-6 text-text-secondary">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
