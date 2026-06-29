import type { TaskGroup } from "@/lib/types";

export function isTaskGroupFromToday(taskGroup: TaskGroup) {
  const createdDate = new Date(taskGroup.createdAt);
  const today = new Date();

  return (
    createdDate.getFullYear() === today.getFullYear() &&
    createdDate.getMonth() === today.getMonth() &&
    createdDate.getDate() === today.getDate()
  );
}
