import { UI_TEXT } from "@/lib/constants";

interface ExampleGoalsProps {
  onExampleClick: (goal: string) => void;
}

export function ExampleGoals({ onExampleClick }: ExampleGoalsProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-500">
        {UI_TEXT.EXAMPLE_LABEL}
      </p>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
        {UI_TEXT.EXAMPLE_GOALS.map((goal) => (
          <button
            className="min-h-10 shrink-0 touch-manipulation rounded-full bg-slate-100 px-4 py-2 text-[13px] font-medium text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
            key={goal}
            onClick={() => onExampleClick(goal)}
            type="button"
          >
            {goal}
          </button>
        ))}
      </div>
    </div>
  );
}
