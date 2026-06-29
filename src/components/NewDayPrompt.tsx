import { UI_TEXT } from "@/lib/constants";

interface NewDayPromptProps {
  onStartNewDay: () => void;
}

export function NewDayPrompt({ onStartNewDay }: NewDayPromptProps) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-amber-100 bg-amber-50/80 p-4 text-sm text-amber-800 shadow-[0_4px_20px_rgba(0,0,0,0.03)] sm:flex-row sm:items-center sm:justify-between">
      <p className="font-medium">{UI_TEXT.NEW_DAY_PROMPT}</p>
      <button
        className="min-h-11 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100"
        onClick={onStartNewDay}
        type="button"
      >
        {UI_TEXT.START_NEW_DAY_BUTTON}
      </button>
    </section>
  );
}
