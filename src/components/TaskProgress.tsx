interface TaskProgressProps {
  completedCount: number;
  totalCount: number;
}

export function TaskProgress({
  completedCount,
  totalCount,
}: TaskProgressProps) {
  return (
    <p className="pt-1 text-sm font-medium text-slate-500">
      已完成 {completedCount} / {totalCount}
    </p>
  );
}
