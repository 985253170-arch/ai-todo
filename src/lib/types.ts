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
