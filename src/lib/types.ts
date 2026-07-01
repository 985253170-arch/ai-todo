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

export type ApiErrorCode =
  | "EMPTY_INPUT"
  | "INPUT_TOO_SHORT"
  | "INPUT_TOO_LONG"
  | "HIGH_RISK_INPUT"
  | "AI_GENERATION_FAILED"
  | "AI_PARSE_FAILED"
  | "NETWORK_ERROR";

export type CloudTaskGroupErrorCode =
  | "INVALID_DEVICE_ID"
  | "INVALID_TASK_GROUP"
  | "NOT_CONFIGURED"
  | "CLOUD_SAVE_FAILED"
  | "CLOUD_LOAD_FAILED"
  | "CLOUD_DELETE_FAILED";

export type HistoryTaskGroupsErrorCode =
  | "INVALID_DEVICE_ID"
  | "INVALID_LIMIT"
  | "INVALID_CURSOR"
  | "NOT_CONFIGURED"
  | "CLOUD_LOAD_FAILED"
  | "UNKNOWN_ERROR";

export type StatsErrorCode =
  | "INVALID_DEVICE_ID"
  | "INVALID_TIMEZONE_OFFSET"
  | "NOT_CONFIGURED"
  | "STATS_LOAD_FAILED"
  | "UNKNOWN_ERROR";

export interface TodayStats {
  completedCount: number;
  totalCount: number;
  completionRate: number | null;
}

export interface SevenDayStats {
  completedCount: number;
  totalCount: number;
  completionRate: number | null;
}

export interface TotalStats {
  totalCompleted: number;
  activeDayStreak: number;
}

export type PerformanceLabel = "稳定行动" | "有点吃力" | "刚刚开始";

export interface StatsData {
  today: TodayStats;
  sevenDay: SevenDayStats;
  total: TotalStats;
  recentTaskGroupCount: number;
  recentAverageTaskCount: number;
  recentIncompleteTaskCount: number;
  performanceLabel: PerformanceLabel;
}

export interface GenerateTasksRequest {
  goal: string;
}

export interface GenerateTasksSuccessResponse {
  success: true;
  data: TaskGroup;
}

export interface GenerateTasksErrorResponse {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

export type GenerateTasksResponse =
  | GenerateTasksSuccessResponse
  | GenerateTasksErrorResponse;

export interface CloudTaskGroupSuccessResponse {
  success: true;
  data?: TaskGroup | null;
}

export interface CloudTaskGroupErrorResponse {
  success: false;
  error: {
    code: CloudTaskGroupErrorCode;
    message: string;
  };
}

export type CloudTaskGroupResponse =
  | CloudTaskGroupSuccessResponse
  | CloudTaskGroupErrorResponse;

export interface HistoryTaskGroupsSuccessResponse {
  success: true;
  data: TaskGroup[];
  hasMore: boolean;
}

export interface HistoryTaskGroupsErrorResponse {
  success: false;
  error: {
    code: HistoryTaskGroupsErrorCode;
    message: string;
  };
}

export type HistoryTaskGroupsResponse =
  | HistoryTaskGroupsSuccessResponse
  | HistoryTaskGroupsErrorResponse;

export interface StatsSuccessResponse {
  success: true;
  data: StatsData;
}

export interface StatsErrorResponse {
  success: false;
  error: {
    code: StatsErrorCode;
    message: string;
  };
}

export type StatsResponse = StatsSuccessResponse | StatsErrorResponse;

export interface AuthUser {
  id: string;
  email: string | null;
}

export type AuthErrorCode = "AUTH_NOT_CONFIGURED" | "AUTH_OPERATION_FAILED";

export interface AuthMeResponse {
  success: true;
  user: AuthUser | null;
}

export type ReviewErrorCode =
  | "INVALID_REQUEST_BODY"
  | "INVALID_DEVICE_ID"
  | "INVALID_TASK_GROUP_ID"
  | "TASK_GROUP_NOT_FOUND"
  | "UNAUTHORIZED_TASK_GROUP"
  | "NO_ACTIVE_TASK_GROUP"
  | "NO_TASKS_TO_REVIEW"
  | "AI_REVIEW_FAILED"
  | "AI_RESPONSE_INVALID"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export type SuggestedDifficulty = "lighter" | "normal" | "deeper";

export interface ReviewSections {
  summary: string;
  encouragement: string;
  nextStep: string;
}

export interface ReviewData {
  feedbackText: string;
  sections: ReviewSections;
  suggestedDifficulty: SuggestedDifficulty;
  suggestedTaskCountRange: [number, number];
}

export interface ReviewSuccessResponse {
  success: true;
  data: ReviewData;
}

export interface ReviewErrorResponse {
  success: false;
  error: {
    code: ReviewErrorCode;
    message: string;
  };
}

export type ReviewResponse = ReviewSuccessResponse | ReviewErrorResponse;
