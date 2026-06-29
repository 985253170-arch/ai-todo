import { UI_TEXT } from "@/lib/constants";

export function EmptyState() {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50/80 px-6 text-center text-sm text-slate-400">
      <span aria-hidden="true" className="text-2xl">
        📋
      </span>
      <span>{UI_TEXT.EMPTY_STATE}</span>
    </div>
  );
}
