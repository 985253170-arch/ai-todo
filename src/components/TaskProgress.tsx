interface TaskProgressProps {
  completedCount: number;
  totalCount: number;
}

export function TaskProgress({
  completedCount,
  totalCount,
}: TaskProgressProps) {
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-2 pt-1">
      <p className="text-sm font-medium text-slate-500">
        已完成 {completedCount} / {totalCount}
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-indigo-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
