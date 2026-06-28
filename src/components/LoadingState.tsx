import { UI_TEXT } from "@/lib/constants";

export function LoadingState() {
  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm"
      role="status"
    >
      <span
        aria-hidden="true"
        className="h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-950"
      />
      {UI_TEXT.LOADING_TEXT}
    </div>
  );
}
