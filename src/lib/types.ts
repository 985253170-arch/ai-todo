export type PageStatus =
  | "idle"
  | "editing"
  | "loading"
  | "success"
  | "error"
  | "parse_error";

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaskGroup {
  id: string;
  goal: string;
  tasks: Task[];
  createdAt: string;
  updatedAt: string;
}
