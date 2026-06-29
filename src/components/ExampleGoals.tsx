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
      <div className="flex flex-wrap gap-2">
        {UI_TEXT.EXAMPLE_GOALS.map((goal) => (
          <button
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
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
