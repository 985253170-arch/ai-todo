import { NextRequest, NextResponse } from "next/server";
import { ERROR_MESSAGES } from "@/lib/constants";
import {
  getAuthenticatedUserId,
  getSupabaseServerClient,
} from "@/lib/supabase-server";
import type {
  CloudTaskGroupErrorCode,
  CloudTaskGroupErrorResponse,
  CloudTaskGroupSuccessResponse,
  Task,
  TaskGroup,
} from "@/lib/types";

interface SaveTaskGroupRequest {
  deviceId: string;
  taskGroup: TaskGroup;
}

interface ExistingTaskGroupOwnerRow {
  user_id: string | null;
  device_id: string | null;
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

function isValidDeviceId(deviceId: unknown): deviceId is string {
  return typeof deviceId === "string" && deviceId.trim().length > 0;
}

function isValidTask(task: unknown): task is Task {
  if (!task || typeof task !== "object") {
    return false;
  }

  const value = task as Partial<Task>;

  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.completed === "boolean" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isValidTaskGroup(taskGroup: unknown): taskGroup is TaskGroup {
  if (!taskGroup || typeof taskGroup !== "object") {
    return false;
  }

  const value = taskGroup as Partial<TaskGroup>;

  return (
    typeof value.id === "string" &&
    value.id.trim().length > 0 &&
    typeof value.goal === "string" &&
    value.goal.trim().length > 0 &&
    Array.isArray(value.tasks) &&
    value.tasks.every(isValidTask) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

export async function POST(request: NextRequest) {
  let body: Partial<SaveTaskGroupRequest>;

  try {
    body = (await request.json()) as Partial<SaveTaskGroupRequest>;
  } catch {
    return errorResponse("INVALID_TASK_GROUP", 400);
  }

  if (!isValidTaskGroup(body.taskGroup)) {
    return errorResponse("INVALID_TASK_GROUP", 400);
  }

  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return errorResponse("NOT_CONFIGURED", 500);
  }

  const userId = await getAuthenticatedUserId();
  const { deviceId, taskGroup } = body;
  const normalizedDeviceId =
    typeof deviceId === "string" ? deviceId.trim() : "";

  if (!userId && !isValidDeviceId(normalizedDeviceId)) {
    return errorResponse("INVALID_DEVICE_ID", 400);
  }

  const { data: existingTaskGroup, error: existingTaskGroupError } =
    await supabase
      .from("task_groups")
      .select("user_id, device_id")
      .eq("id", taskGroup.id)
      .maybeSingle<ExistingTaskGroupOwnerRow>();

  if (existingTaskGroupError) {
    return errorResponse("CLOUD_SAVE_FAILED", 500);
  }

  if (existingTaskGroup) {
    const canSave = userId
      ? existingTaskGroup.user_id === userId
      : existingTaskGroup.user_id === null &&
        existingTaskGroup.device_id === normalizedDeviceId;

    if (!canSave) {
      return errorResponse("CLOUD_SAVE_FAILED", 403);
    }
  }

  const taskGroupRow = {
    id: taskGroup.id,
    device_id: userId ? null : normalizedDeviceId,
    user_id: userId,
    goal: taskGroup.goal,
    created_at: taskGroup.createdAt,
    updated_at: taskGroup.updatedAt,
  };

  const { error: upsertTaskGroupError } = await supabase
    .from("task_groups")
    .upsert(taskGroupRow);

  if (upsertTaskGroupError) {
    return errorResponse("CLOUD_SAVE_FAILED", 500);
  }

  const { error: deleteTasksError } = await supabase
    .from("tasks")
    .delete()
    .eq("task_group_id", taskGroup.id);

  if (deleteTasksError) {
    return errorResponse("CLOUD_SAVE_FAILED", 500);
  }

  if (taskGroup.tasks.length > 0) {
    const taskRows = taskGroup.tasks.map((task) => ({
      id: task.id,
      task_group_id: taskGroup.id,
      title: task.title,
      completed: task.completed,
      created_at: task.createdAt,
      updated_at: task.updatedAt,
    }));
    const { error: insertTasksError } = await supabase
      .from("tasks")
      .insert(taskRows);

    if (insertTasksError) {
      return errorResponse("CLOUD_SAVE_FAILED", 500);
    }
  }

  const response: CloudTaskGroupSuccessResponse = { success: true };

  return NextResponse.json(response);
}
