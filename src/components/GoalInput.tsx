import { UI_TEXT } from "@/lib/constants";

export function GoalInput() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          aria-label="目标"
          className="min-h-12 flex-1 rounded-md border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none placeholder:text-slate-400"
          placeholder={UI_TEXT.INPUT_PLACEHOLDER}
          readOnly
        />
        <button
          className="min-h-12 rounded-md bg-slate-950 px-5 text-base font-medium text-white"
          type="button"
        >
          {UI_TEXT.BUTTON_GENERATE}
        </button>
      </div>
    </section>
  );
}
