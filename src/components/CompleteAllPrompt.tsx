import { UI_TEXT } from "@/lib/constants";

export function CompleteAllPrompt() {
  return (
    <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
      {UI_TEXT.COMPLETE_ALL_MESSAGE}
    </p>
  );
}
