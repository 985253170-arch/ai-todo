import { UI_TEXT } from "@/lib/constants";

type NewDayPromptVariant = "new_day" | "carryover";

interface NewDayPromptProps {
  variant?: NewDayPromptVariant;
  onContinue?: () => void;
  onStartNewDay: () => void;
}

const CARRYOVER_PROMPT = "\u4f60\u8fd8\u6709\u672a\u5b8c\u6210\u7684\u4efb\u52a1\uff0c\u4eca\u5929\u7ee7\u7eed\u5b8c\u6210\u3002";
const CONTINUE_BUTTON_LABEL = "\u7ee7\u7eed\u63a8\u8fdb";
const START_NEW_GOAL_BUTTON_LABEL = "\u5f00\u59cb\u65b0\u76ee\u6807";

export function NewDayPrompt({
  onContinue,
  onStartNewDay,
  variant = "new_day",
}: NewDayPromptProps) {
  if (variant === "carryover") {
    return (
      <section className="flex flex-col gap-3 rounded-2xl border border-amber-100 bg-amber-50/80 p-4 text-sm text-amber-800 shadow-[0_4px_20px_rgba(0,0,0,0.03)] sm:flex-row sm:items-center sm:justify-between">
        <p className="font-medium">{CARRYOVER_PROMPT}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            className="min-h-11 rounded-xl bg-amber-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-800"
            onClick={onContinue}
            type="button"
          >
            {CONTINUE_BUTTON_LABEL}
          </button>
          <button
            className="min-h-11 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100"
            onClick={onStartNewDay}
            type="button"
          >
            {START_NEW_GOAL_BUTTON_LABEL}
          </button>
        </div>
      </section>
    );
  }

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
