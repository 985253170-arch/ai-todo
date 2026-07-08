import type { ButtonHTMLAttributes, ReactNode } from "react";

interface SecondaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function SecondaryButton({
  children,
  className = "",
  ...props
}: SecondaryButtonProps) {
  return (
    <button
      className={`min-h-touch w-full rounded-button border border-border-paper bg-paper px-6 py-4 text-base font-semibold text-brand-blue transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55 ${className}`}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}
