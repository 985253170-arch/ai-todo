import type { InputHTMLAttributes, ReactNode } from "react";

interface TextInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  icon?: ReactNode;
  error?: string;
}

export function TextInput({
  value,
  onChange,
  icon,
  error,
  className = "",
  ...props
}: TextInputProps) {
  return (
    <label className="block">
      <span
        className={`flex min-h-[60px] items-center gap-3 rounded-input border bg-paper px-5 text-text-primary shadow-inner ${
          error ? "border-danger-soft" : "border-border-paper"
        } ${className}`}
      >
        {icon ? <span className="shrink-0 text-brand-blue">{icon}</span> : null}
        <input
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-text-tertiary"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          {...props}
        />
      </span>
      {error ? (
        <span className="mt-2 block px-2 text-sm text-danger-soft">{error}</span>
      ) : null}
    </label>
  );
}
