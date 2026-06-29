import { UI_TEXT } from "@/lib/constants";

export function LoadingState() {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-white/95 px-4 py-3 text-sm font-medium text-slate-500 shadow-sm"
      role="status"
    >
      <span
        aria-hidden="true"
        className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-100 border-t-indigo-600"
      />
      {UI_TEXT.LOADING_TEXT}
    </div>
  );
}
