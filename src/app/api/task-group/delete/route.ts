// Phase 12: 此 API 的真实语义是 archive（归档），不再是 delete（物理删除）。
// 路径保留 /api/task-group/delete 是为了兼容现有前端调用方。
// 归档后 task_group.archived_at 被设置为当前时间，tasks 保留不动。
// 归档的数据后续可通过历史 API 查询。

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
  let archiveQuery = supabase
    .from("task_groups")
    .update({ archived_at: new Date().toISOString() })
    .is("archived_at", null)
    .select("id");

  if (userId) {
    archiveQuery = archiveQuery.eq("user_id", userId);
  } else {
    if (!deviceId) {
      return errorResponse("INVALID_DEVICE_ID", 400);
    }

    archiveQuery = archiveQuery.eq("device_id", deviceId).is("user_id", null);
  }

  const { data, error } = await archiveQuery;

  if (error) {
    return errorResponse("CLOUD_DELETE_FAILED", 500);
  }

  const response = {
    success: true,
    archivedCount: data?.length ?? 0,
  };

  return NextResponse.json(response);
}
