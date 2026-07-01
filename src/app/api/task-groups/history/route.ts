import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedUserId,
  getSupabaseServerClient,
} from "@/lib/supabase-server";
import type {
  HistoryTaskGroupsErrorCode,
  HistoryTaskGroupsErrorResponse,
  HistoryTaskGroupsSuccessResponse,
  Task,
  TaskGroup,
} from "@/lib/types";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;

const HISTORY_ERROR_MESSAGES: Record<HistoryTaskGroupsErrorCode, string> = {
  INVALID_DEVICE_ID: "设备 ID 无效。",
  INVALID_LIMIT: "分页参数无效。",
  INVALID_CURSOR: "分页游标无效。",
  NOT_CONFIGURED: "云端服务暂未配置。",
  CLOUD_LOAD_FAILED: "历史记录加载失败。",
  UNKNOWN_ERROR: "未知错误。",
};

interface TaskGroupRow {
  id: string;
  goal: string;
  created_at: string;
  updated_at: string;
}

interface TaskRow {
  id: string;
  task_group_id: string;
  title: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

function errorResponse(code: HistoryTaskGroupsErrorCode, status: number) {
  const body: HistoryTaskGroupsErrorResponse = {
    success: false,
    error: {
      code,
      message: HISTORY_ERROR_MESSAGES[code],
    },
  };

  return NextResponse.json(body, { status });
}

function parseLimit(value: string | null) {
  if (!value) {
    return DEFAULT_LIMIT;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.trunc(parsed), MAX_LIMIT);
}

function isValidCursor(value: string) {
  return Number.isFinite(Date.parse(value));
}

function buildTaskGroups(
  taskGroupRows: TaskGroupRow[],
  taskRows: TaskRow[] | null,
) {
  const tasksByGroupId = new Map<string, Task[]>();

  for (const task of taskRows ?? []) {
    const tasks = tasksByGroupId.get(task.task_group_id) ?? [];

    tasks.push({
      id: task.id,
      title: task.title,
      completed: task.completed,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
    });
    tasksByGroupId.set(task.task_group_id, tasks);
  }

  return taskGroupRows.map<TaskGroup>((taskGroup) => ({
    id: taskGroup.id,
    goal: taskGroup.goal,
    tasks: tasksByGroupId.get(taskGroup.id) ?? [],
    createdAt: taskGroup.created_at,
    updatedAt: taskGroup.updated_at,
  }));
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const deviceId = searchParams.get("deviceId")?.trim();
  const limit = parseLimit(searchParams.get("limit"));
  const cursor = searchParams.get("cursor")?.trim();

  if (cursor && !isValidCursor(cursor)) {
    return errorResponse("INVALID_CURSOR", 400);
  }

  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return errorResponse("NOT_CONFIGURED", 500);
  }

  const userId = await getAuthenticatedUserId();
  let historyQuery = supabase
    .from("task_groups")
    .select("id, goal, created_at, updated_at")
    .not("archived_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    historyQuery = historyQuery.lt("created_at", cursor);
  }

  if (userId) {
    historyQuery = historyQuery.eq("user_id", userId);
  } else {
    if (!deviceId) {
      return errorResponse("INVALID_DEVICE_ID", 400);
    }

    historyQuery = historyQuery.eq("device_id", deviceId).is("user_id", null);
  }

  const { data: taskGroupRows, error: taskGroupError } =
    await historyQuery.returns<TaskGroupRow[]>();

  if (taskGroupError) {
    return errorResponse("CLOUD_LOAD_FAILED", 500);
  }

  const rows = taskGroupRows ?? [];
  const pageRows = rows.slice(0, limit);
  const hasMore = rows.length > limit;

  if (pageRows.length === 0) {
    const response: HistoryTaskGroupsSuccessResponse = {
      success: true,
      data: [],
      hasMore: false,
    };

    return NextResponse.json(response);
  }

  const taskGroupIds = pageRows.map((taskGroup) => taskGroup.id);
  const { data: taskRows, error: tasksError } = await supabase
    .from("tasks")
    .select("id, task_group_id, title, completed, created_at, updated_at")
    .in("task_group_id", taskGroupIds)
    .order("created_at", { ascending: true })
    .returns<TaskRow[]>();

  if (tasksError) {
    return errorResponse("CLOUD_LOAD_FAILED", 500);
  }

  const response: HistoryTaskGroupsSuccessResponse = {
    success: true,
    data: buildTaskGroups(pageRows, taskRows),
    hasMore,
  };

  return NextResponse.json(response);
}
