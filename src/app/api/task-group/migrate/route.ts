import { NextRequest, NextResponse } from "next/server";
import { ERROR_MESSAGES } from "@/lib/constants";
import {
  getAuthenticatedUserId,
  getSupabaseServerClient,
} from "@/lib/supabase-server";

interface MigrateTaskGroupRequest {
  deviceId: string;
}

interface MigratedTaskGroupRow {
  id: string;
}

function isValidDeviceId(deviceId: unknown): deviceId is string {
  return typeof deviceId === "string" && deviceId.trim().length > 0;
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

export async function POST(request: NextRequest) {
  let body: Partial<MigrateTaskGroupRequest>;

  try {
    body = (await request.json()) as Partial<MigrateTaskGroupRequest>;
  } catch {
    return errorResponse(
      "INVALID_DEVICE_ID",
      ERROR_MESSAGES.INVALID_DEVICE_ID,
      400,
    );
  }

  if (!isValidDeviceId(body.deviceId)) {
    return errorResponse(
      "INVALID_DEVICE_ID",
      ERROR_MESSAGES.INVALID_DEVICE_ID,
      400,
    );
  }

  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return errorResponse("AUTH_REQUIRED", "请先登录后再迁移任务。", 401);
  }

  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return errorResponse("NOT_CONFIGURED", ERROR_MESSAGES.NOT_CONFIGURED, 500);
  }

  const { data, error } = await supabase
    .from("task_groups")
    .update({
      user_id: userId,
      device_id: null,
    })
    .eq("device_id", body.deviceId.trim())
    .is("user_id", null)
    .select("id")
    .returns<MigratedTaskGroupRow[]>();

  if (error) {
    return errorResponse(
      "CLOUD_SAVE_FAILED",
      ERROR_MESSAGES.CLOUD_SAVE_FAILED,
      500,
    );
  }

  return NextResponse.json({
    success: true,
    migratedCount: data?.length ?? 0,
  });
}
