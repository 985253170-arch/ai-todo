import { NextRequest, NextResponse } from "next/server";
import { computeAllStats } from "@/lib/stats-calculator";
import {
  getAuthenticatedUserId,
  getSupabaseServerClient,
} from "@/lib/supabase-server";
import type {
  StatsErrorCode,
  StatsErrorResponse,
  StatsSuccessResponse,
} from "@/lib/types";

const DEFAULT_TIMEZONE_OFFSET = -480;

const STATS_ERROR_MESSAGES: Record<StatsErrorCode, string> = {
  INVALID_DEVICE_ID: "设备 ID 无效。",
  INVALID_TIMEZONE_OFFSET: "时区参数无效。",
  NOT_CONFIGURED: "云端服务暂未配置。",
  STATS_LOAD_FAILED: "统计数据加载失败。",
  UNKNOWN_ERROR: "未知错误。",
};

function errorResponse(code: StatsErrorCode, status: number) {
  const body: StatsErrorResponse = {
    success: false,
    error: {
      code,
      message: STATS_ERROR_MESSAGES[code],
    },
  };

  return NextResponse.json(body, { status });
}

function parseTimezoneOffset(value: string | null) {
  if (!value) {
    return DEFAULT_TIMEZONE_OFFSET;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < -720 || parsed > 720) {
    return DEFAULT_TIMEZONE_OFFSET;
  }

  return parsed;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const deviceId = searchParams.get("deviceId")?.trim() ?? "";
  const timezoneOffset = parseTimezoneOffset(searchParams.get("timezoneOffset"));
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return errorResponse("NOT_CONFIGURED", 500);
  }

  const userId = await getAuthenticatedUserId();

  if (!userId && !deviceId) {
    return errorResponse("INVALID_DEVICE_ID", 400);
  }

  try {
    const data = await computeAllStats(
      supabase,
      {
        userId,
        deviceId,
      },
      timezoneOffset,
    );
    const response: StatsSuccessResponse = {
      success: true,
      data,
    };

    return NextResponse.json(response);
  } catch {
    return errorResponse("STATS_LOAD_FAILED", 500);
  }
}
