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
} from "@/lib/types";

interface DeleteTaskGroupRequest {
  deviceId: string;
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

export async function POST(request: NextRequest) {
  let body: Partial<DeleteTaskGroupRequest>;

  try {
    body = (await request.json()) as Partial<DeleteTaskGroupRequest>;
  } catch {
    return errorResponse("INVALID_DEVICE_ID", 400);
  }

  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return errorResponse("NOT_CONFIGURED", 500);
  }

  const userId = await getAuthenticatedUserId();
  const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
  let deleteQuery = supabase.from("task_groups").delete();

  if (userId) {
    deleteQuery = deleteQuery.eq("user_id", userId);
  } else {
    if (!deviceId) {
      return errorResponse("INVALID_DEVICE_ID", 400);
    }

    deleteQuery = deleteQuery.eq("device_id", deviceId).is("user_id", null);
  }

  const { error } = await deleteQuery;

  if (error) {
    return errorResponse("CLOUD_DELETE_FAILED", 500);
  }

  const response: CloudTaskGroupSuccessResponse = { success: true };

  return NextResponse.json(response);
}
