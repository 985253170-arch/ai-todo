interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  helperText?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  helperText,
}: StatCardProps) {
  return (
    <article className="min-w-0 rounded-2xl border border-indigo-100 bg-white/85 px-4 py-4 shadow-[0_4px_18px_rgba(79,70,229,0.05)]">
      <p className="truncate text-xs font-medium text-slate-400">{title}</p>
      <p className="mt-2 break-words text-xl font-semibold tracking-tight text-slate-800">
        {value}
      </p>
      {subtitle ? (
        <p className="mt-1 truncate text-xs font-medium text-indigo-600">
          {subtitle}
        </p>
      ) : null}
      {helperText ? (
        <p className="mt-1 text-xs leading-5 text-slate-400">{helperText}</p>
      ) : null}
    </article>
  );
}
