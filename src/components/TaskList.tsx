import { EmptyState } from "@/components/EmptyState";

export function TaskList() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-950">今日任务</h2>
      </div>
      <EmptyState />
    </section>
  );
}
