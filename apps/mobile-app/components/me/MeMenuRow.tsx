import { IconBack } from "@/components/icons";

type MeMenuRowVariant = "normal" | "warning" | "danger";

interface MeMenuRowProps {
  label: string;
  value?: string;
  variant?: MeMenuRowVariant;
  onClick?: () => void;
}

const variantClass: Record<MeMenuRowVariant, string> = {
  normal: "text-brand-blue",
  warning: "text-[#9A7352]",
  danger: "text-[#A46A60]",
};

export function MeMenuRow({
  label,
  value,
  variant = "normal",
  onClick,
}: MeMenuRowProps) {
  const content = (
    <>
      <span className={`text-sm font-semibold ${variantClass[variant]}`}>{label}</span>
      {value ? (
        <span className="text-sm font-semibold text-text-tertiary">{value}</span>
      ) : variant === "normal" ? (
        <span className="rotate-180 text-text-tertiary">
          <IconBack size={16} />
        </span>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        className="flex min-h-[44px] w-full items-center justify-between gap-3 py-2.5 text-left transition active:scale-[0.99]"
        type="button"
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return (
    <div className="flex min-h-[44px] items-center justify-between gap-3 py-2.5">
      {content}
    </div>
  );
}
