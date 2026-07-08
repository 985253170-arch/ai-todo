import type { ButtonHTMLAttributes, ReactNode } from "react";

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  loading?: boolean;
}

export function PrimaryButton({
  children,
  loading = false,
  disabled,
  className = "",
  ...props
}: PrimaryButtonProps) {
  return (
    <button
      className={`min-h-touch w-full rounded-button bg-brand-blue-dark px-6 py-4 text-base font-semibold text-white shadow-button transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55 ${className}`}
      disabled={disabled || loading}
      type="button"
      {...props}
    >
      {loading ? "正在整理今天的小步..." : children}
    </button>
  );
}
