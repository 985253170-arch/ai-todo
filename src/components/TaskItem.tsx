export function TaskItem() {
  return (
    <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3">
      <span
        aria-hidden="true"
        className="h-5 w-5 shrink-0 rounded border border-slate-300 bg-white"
      />
      <span className="text-sm text-slate-700">示例任务</span>
    </div>
  );
}
