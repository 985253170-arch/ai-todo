import { UI_TEXT } from "@/lib/constants";

export function CompleteAllPrompt() {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
      <p className="text-sm font-semibold text-emerald-800">
        {UI_TEXT.COMPLETE_ALL_TITLE}
      </p>
      <p className="mt-1 text-sm leading-6 text-emerald-700">
        {UI_TEXT.COMPLETE_ALL_DESCRIPTION}
      </p>
    </div>
  );
}
