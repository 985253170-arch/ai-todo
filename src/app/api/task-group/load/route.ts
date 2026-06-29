import { NextRequest, NextResponse } from "next/server";
import { ERROR_MESSAGES } from "@/lib/constants";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import type {
  CloudTaskGroupErrorCode,
  CloudTaskGroupErrorResponse,
  CloudTaskGroupSuccessResponse,
  Task,
  TaskGroup,
} from "@/lib/types";

interface TaskGroupRow {
  id: string;
  goal: string;
  created_at: string;
  updated_at: string;
}

interface TaskRow {
  id: string;
  title: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

function errorResponse(code: CloudTaskGroupErrorCode, status: number) {
  const messages: Record<CloudTaskGroupErrorCode, string> = {
    INVALID_DEVICE_ID: ERROR_MESSAGES.INVALID_DEVICE_ID,
    INVALID_TASK_GROUP: ERROR_MESSAGES.INVALID_TASK_GROUP,
    NOT_CONFIGURED: ERROR_MESSAGES.NOT_CONFIGURED,
    CLOUD_SAVE_FAILED: ERROR_MESSAGES.CLOUD_SAVE_FAILED,
    CLOUD_LOAD_FAILED: ERROR_MESSAGES.CLOUD_LOAD_FAILED,
    CLOUD_DELETE_FAILED: ERROR_MESSAGES.CLOUD_DELETE_FAILED,
  };
  const body: CloudTaskGroupErrorResponse = {
    success: false,
    error: {
      code,
      message: messages[code],
    },
  };

  return NextResponse.json(body, { status });
}

export async function GET(request: NextRequest) {
  const deviceId = request.nextUrl.searchParams.get("deviceId")?.trim();

  if (!deviceId) {
    return errorResponse("INVALID_DEVICE_ID", 400);
  }

  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return errorResponse("NOT_CONFIGURED", 500);
  }

  const { data: taskGroupRow, error: taskGroupError } = await supabase
    .from("task_groups")
    .select("id, goal, created_at, updated_at")
    .eq("device_id", deviceId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<TaskGroupRow>();

  if (taskGroupError) {
    return errorResponse("CLOUD_LOAD_FAILED", 500);
  }

  if (!taskGroupRow) {
    const response: CloudTaskGroupSuccessResponse = {
      success: true,
      data: null,
    };

    return NextResponse.json(response);
  }

  const { data: taskRows, error: tasksError } = await supabase
    .from("tasks")
    .select("id, title, completed, created_at, updated_at")
    .eq("task_group_id", taskGroupRow.id)
    .order("created_at", { ascending: true })
    .returns<TaskRow[]>();

  if (tasksError) {
    return errorResponse("CLOUD_LOAD_FAILED", 500);
  }

  const tasks: Task[] = (taskRows ?? []).map((task) => ({
    id: task.id,
    title: task.title,
    completed: task.completed,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  }));
  const taskGroup: TaskGroup = {
    id: taskGroupRow.id,
    goal: taskGroupRow.goal,
    tasks,
    createdAt: taskGroupRow.created_at,
    updatedAt: taskGroupRow.updated_at,
  };
  const response: CloudTaskGroupSuccessResponse = {
    success: true,
    data: taskGroup,
  };

  return NextResponse.json(response);
}
