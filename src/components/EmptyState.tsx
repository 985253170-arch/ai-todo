import { UI_TEXT } from "@/lib/constants";

export function EmptyState() {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm text-slate-500">
      {UI_TEXT.EMPTY_STATE}
    </div>
  );
}
