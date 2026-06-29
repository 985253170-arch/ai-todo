import { ErrorMessage } from "@/components/ErrorMessage";
import { UI_TEXT } from "@/lib/constants";

interface GoalInputProps {
  value: string;
  errorMessage: string | null;
  isLoading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export function GoalInput({
  value,
  errorMessage,
  isLoading,
  onChange,
  onSubmit,
}: GoalInputProps) {
  return (
    <section className="rounded-2xl border border-white/70 bg-white/90 p-5 shadow-xl shadow-indigo-100/70 sm:p-6">
      <div className="mb-4 space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-slate-950">
          {UI_TEXT.INPUT_CARD_TITLE}
        </h2>
        <p className="text-sm leading-6 text-slate-500">
          {UI_TEXT.INPUT_CARD_DESCRIPTION}
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          aria-label="目标"
          className="min-h-12 min-w-0 flex-1 touch-manipulation rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
          onChange={(event) => onChange(event.target.value)}
          placeholder={UI_TEXT.INPUT_PLACEHOLDER}
          value={value}
        />
        <button
          className="min-h-12 touch-manipulation rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-5 text-base font-medium text-white shadow-lg shadow-indigo-200 transition-colors duration-150 hover:from-indigo-700 hover:to-blue-700 active:from-indigo-800 active:to-blue-800 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-400 disabled:shadow-none"
          disabled={isLoading}
          onClick={onSubmit}
          type="button"
        >
          {isLoading ? UI_TEXT.GENERATING_BUTTON : UI_TEXT.BUTTON_GENERATE}
        </button>
      </div>
      <div className="mt-3 min-h-5">
        <ErrorMessage message={errorMessage} />
      </div>
      <p className="text-xs leading-5 text-slate-400">{UI_TEXT.PRIVACY_NOTICE}</p>
    </section>
  );
}
