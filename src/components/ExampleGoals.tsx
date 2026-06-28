import { UI_TEXT } from "@/lib/constants";

export function ExampleGoals() {
  return (
    <section className="space-y-3">
      <p className="text-sm font-medium text-slate-500">
        {UI_TEXT.EXAMPLE_LABEL}
      </p>
      <div className="flex flex-wrap gap-2">
        {UI_TEXT.EXAMPLE_GOALS.map((goal) => (
          <span
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
            key={goal}
          >
            {goal}
          </span>
        ))}
      </div>
    </section>
  );
}
