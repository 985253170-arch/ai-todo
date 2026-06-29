import { UI_TEXT } from "@/lib/constants";

interface ExampleGoalsProps {
  onExampleClick: (goal: string) => void;
}

export function ExampleGoals({ onExampleClick }: ExampleGoalsProps) {
  return (
    <section className="space-y-3">
      <p className="text-sm font-medium text-slate-500">
        {UI_TEXT.EXAMPLE_LABEL}
      </p>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
        {UI_TEXT.EXAMPLE_GOALS.map((goal) => (
          <button
            className="min-h-11 shrink-0 touch-manipulation rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm transition-colors hover:border-blue-200 hover:text-blue-700"
            key={goal}
            onClick={() => onExampleClick(goal)}
            type="button"
          >
            {goal}
          </button>
        ))}
      </div>
    </section>
  );
}
