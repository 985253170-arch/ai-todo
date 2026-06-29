import { ErrorMessage } from "@/components/ErrorMessage";
import { ExampleGoals } from "@/components/ExampleGoals";
import { UI_TEXT } from "@/lib/constants";

interface GoalInputProps {
  value: string;
  errorMessage: string | null;
  isLoading: boolean;
  onChange: (value: string) => void;
  onExampleClick: (goal: string) => void;
  onSubmit: () => void;
}

export function GoalInput({
  value,
  errorMessage,
  isLoading,
  onChange,
  onExampleClick,
  onSubmit,
}: GoalInputProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] sm:p-6">
      <div className="mb-4 space-y-1.5">
        <h2 className="text-lg font-semibold tracking-tight text-slate-700">
          {UI_TEXT.INPUT_CARD_TITLE}
        </h2>
        <p className="text-sm leading-6 text-slate-500">
          {UI_TEXT.INPUT_CARD_DESCRIPTION}
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          aria-label="目标"
          className="min-h-12 min-w-0 flex-1 touch-manipulation rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          onChange={(event) => onChange(event.target.value)}
          placeholder={UI_TEXT.INPUT_PLACEHOLDER}
          value={value}
        />
        <button
          className="min-h-12 touch-manipulation rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 px-5 text-base font-semibold text-white shadow-[0_4px_12px_rgba(79,70,229,0.2)] transition duration-150 hover:-translate-y-px hover:shadow-[0_8px_18px_rgba(79,70,229,0.26)] active:translate-y-0 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-400 disabled:shadow-none"
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
      <div className="mt-5 border-t border-slate-100 pt-4">
        <ExampleGoals onExampleClick={onExampleClick} />
      </div>
    </section>
  );
}
