import { UI_TEXT } from "@/lib/constants";

export function EmptyState() {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center">
      <span
        aria-hidden="true"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-2xl"
      >
        📋
      </span>
      <div className="space-y-1.5">
        <p className="text-base font-medium text-slate-700">
          {UI_TEXT.EMPTY_STATE_TITLE}
        </p>
        <p className="text-sm leading-6 text-slate-400">
          {UI_TEXT.EMPTY_STATE_DESCRIPTION}
        </p>
      </div>
    </div>
  );
}
