import { ErrorMessage } from "@/components/ErrorMessage";
import { UI_TEXT } from "@/lib/constants";

interface GoalInputProps {
  value: string;
  errorMessage: string | null;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export function GoalInput({
  value,
  errorMessage,
  onChange,
  onSubmit,
}: GoalInputProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          aria-label="目标"
          className="min-h-12 flex-1 rounded-md border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          onChange={(event) => onChange(event.target.value)}
          placeholder={UI_TEXT.INPUT_PLACEHOLDER}
          value={value}
        />
        <button
          className="min-h-12 rounded-md bg-slate-950 px-5 text-base font-medium text-white"
          onClick={onSubmit}
          type="button"
        >
          {UI_TEXT.BUTTON_GENERATE}
        </button>
      </div>
      <div className="mt-3 min-h-5">
        <ErrorMessage message={errorMessage} />
      </div>
    </section>
  );
}
