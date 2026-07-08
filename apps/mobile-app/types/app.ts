export type TaskStatus = "current" | "locked" | "completed";

export interface Task {
  id: string;
  title: string;
  details?: string[];
  estimatedMinutes?: number;
  status: TaskStatus;
  completedAt?: string;
}

export interface TodayState {
  goal: string;
  tasks: Task[];
  completedCount: number;
  totalCount: number;
}

export interface CompanionStep {
  taskId: string;
  taskTitle: string;
  stepTitle: string;
  steps: string[];
  closingText: string;
}

export interface HistoryTask {
  title: string;
  completed: boolean;
}

export interface HistoryItem {
  id: string;
  dateLabel: string;
  goal: string;
  completionRate: number;
  completedCount: number;
  totalCount: number;
  expanded: boolean;
  tasks: HistoryTask[];
}

export type HistoryRange = "7d" | "30d";

export interface GrowthStats {
  todayCompletionRate: number;
  weekCompletionRate: number;
  streakDays: number;
  totalCompleted: number;
  statusLabel: string;
  summaryText: string;
  suggestionTitle: string;
  suggestionText: string;
}

export interface MockUser {
  email: string;
  isLoggedIn: boolean;
  syncStatus: "synced" | "not_synced";
}

export interface RegisterInput {
  email: string;
  code: string;
  password: string;
  confirmPassword: string;
}

export type LoadingState = "idle" | "loading" | "success" | "error";
export type AuthScreen = "welcome" | "otp-login" | "password-login" | "register";
export type AppTab = "today" | "footprint" | "growth" | "me";
