import { UI_TEXT } from "@/lib/constants";

export function EmptyState() {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-indigo-100 bg-indigo-50/40 px-6 text-center">
      <span aria-hidden="true" className="text-3xl">
        📋
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-700">
          {UI_TEXT.EMPTY_STATE_TITLE}
        </p>
        <p className="text-sm leading-6 text-slate-400">
          {UI_TEXT.EMPTY_STATE_DESCRIPTION}
        </p>
      </div>
    </div>
  );
}
