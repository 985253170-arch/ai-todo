import { NextRequest, NextResponse } from "next/server";
import { callAIWithPrompts } from "@/lib/ai-client";
import {
  ParseReviewAIResponseError,
  parseReviewAIResponse,
} from "@/lib/review-parser";
import { computeAllStats } from "@/lib/stats-calculator";
import {
  getAuthenticatedUserId,
  getSupabaseServerClient,
} from "@/lib/supabase-server";
import type {
  ReviewErrorCode,
  ReviewErrorResponse,
  ReviewSuccessResponse,
} from "@/lib/types";
import {
  REVIEW_SYSTEM_PROMPT,
  buildReviewUserPrompt,
} from "@/prompts/task-review";

interface ReviewRequestBody {
  deviceId?: unknown;
  taskGroupId?: unknown;
  timezoneOffset?: unknown;
}

interface TaskGroupReviewRow {
  id: string;
  goal: string;
  user_id: string | null;
  device_id: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

interface TaskReviewRow {
  id: string;
  title: string;
  completed: boolean;
  created_at: string;
}

const DEFAULT_TIMEZONE_OFFSET = -480;
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60_000;

const REVIEW_ERROR_MESSAGES: Record<ReviewErrorCode, string> = {
  INVALID_REQUEST_BODY: "请求格式无效。",
  INVALID_DEVICE_ID: "未提供设备标识。",
  INVALID_TASK_GROUP_ID: "任务组 ID 格式无效。",
  TASK_GROUP_NOT_FOUND: "任务组不存在。",
  UNAUTHORIZED_TASK_GROUP: "无权访问该任务组。",
  NO_ACTIVE_TASK_GROUP: "当前没有进行中的目标。",
  NO_TASKS_TO_REVIEW: "当前没有任务可以复盘。",
  AI_REVIEW_FAILED: "AI 复盘生成失败，请稍后重试。",
  AI_RESPONSE_INVALID: "AI 回复格式异常，请重试。",
  RATE_LIMITED: "请求过于频繁，请稍后再试。",
  INTERNAL_ERROR: "服务异常，请稍后重试。",
};

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function errorResponse(code: ReviewErrorCode, status: number) {
  const body: ReviewErrorResponse = {
    success: false,
    error: {
      code,
      message: REVIEW_ERROR_MESSAGES[code],
    },
  };

  return NextResponse.json(body, { status });
}

function isValidTaskGroupId(taskGroupId: string) {
  return (
    /^task_group_[A-Za-z0-9_-]+$/.test(taskGroupId) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      taskGroupId,
    )
  );
}

function parseTimezoneOffset(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return DEFAULT_TIMEZONE_OFFSET;
  }

  if (value < -720 || value > 720) {
    return DEFAULT_TIMEZONE_OFFSET;
  }

  return value;
}

// Best-effort only: in serverless environments this in-memory map is not durable.
function checkRateLimit(scope: string) {
  const now = Date.now();
  const entry = rateLimitMap.get(scope);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(scope, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count += 1;
  return true;
}

async function parseRequestBody(request: NextRequest) {
  try {
    const rawBody = (await request.json()) as unknown;

    if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
      return null;
    }

    return rawBody as ReviewRequestBody;
  } catch {
    return null;
  }
}

function canAccessTaskGroup(
  taskGroup: TaskGroupReviewRow,
  userId: string | null,
  deviceId: string,
) {
  if (userId) {
    return taskGroup.user_id === userId;
  }

  return taskGroup.user_id === null && taskGroup.device_id === deviceId;
}

function formatCompletionRate(rate: number | null) {
  return rate === null ? "暂无数据" : `${Math.round(rate * 100)}%`;
}

export async function POST(request: NextRequest) {
  const body = await parseRequestBody(request);

  if (!body) {
    return errorResponse("INVALID_REQUEST_BODY", 400);
  }

  const userId = await getAuthenticatedUserId();
  const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";

  if (!userId && !deviceId) {
    return errorResponse("INVALID_DEVICE_ID", 400);
  }

  const taskGroupId =
    typeof body.taskGroupId === "string" ? body.taskGroupId.trim() : "";

  if (taskGroupId && !isValidTaskGroupId(taskGroupId)) {
    return errorResponse("INVALID_TASK_GROUP_ID", 400);
  }

  const rateLimitScope = userId ? `user:${userId}` : `device:${deviceId}`;

  if (!checkRateLimit(rateLimitScope)) {
    return errorResponse("RATE_LIMITED", 429);
  }

  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return errorResponse("INTERNAL_ERROR", 500);
  }

  try {
    let taskGroup: TaskGroupReviewRow | null = null;

    if (taskGroupId) {
      const { data, error } = await supabase
        .from("task_groups")
        .select("id, goal, user_id, device_id, created_at, updated_at, archived_at")
        .eq("id", taskGroupId)
        .maybeSingle<TaskGroupReviewRow>();

      if (error) {
        return errorResponse("INTERNAL_ERROR", 500);
      }

      if (!data) {
        return errorResponse("TASK_GROUP_NOT_FOUND", 404);
      }

      if (!canAccessTaskGroup(data, userId, deviceId)) {
        return errorResponse("UNAUTHORIZED_TASK_GROUP", 403);
      }

      taskGroup = data;
    } else {
      let query = supabase
        .from("task_groups")
        .select("id, goal, user_id, device_id, created_at, updated_at, archived_at")
        .is("archived_at", null)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (userId) {
        query = query.eq("user_id", userId);
      } else {
        query = query.eq("device_id", deviceId).is("user_id", null);
      }

      const { data, error } = await query.returns<TaskGroupReviewRow[]>();

      if (error) {
        return errorResponse("INTERNAL_ERROR", 500);
      }

      taskGroup = data?.[0] ?? null;

      if (!taskGroup) {
        return errorResponse("NO_ACTIVE_TASK_GROUP", 404);
      }
    }

    const { data: taskRows, error: taskRowsError } = await supabase
      .from("tasks")
      .select("id, title, completed, created_at")
      .eq("task_group_id", taskGroup.id)
      .order("created_at", { ascending: true })
      .returns<TaskReviewRow[]>();

    if (taskRowsError) {
      return errorResponse("INTERNAL_ERROR", 500);
    }

    const tasks = taskRows ?? [];

    if (tasks.length === 0) {
      return errorResponse("NO_TASKS_TO_REVIEW", 400);
    }

    const timezoneOffset = parseTimezoneOffset(body.timezoneOffset);
    const stats = await computeAllStats(
      supabase,
      {
        userId,
        deviceId,
      },
      timezoneOffset,
    );
    const userPrompt = buildReviewUserPrompt({
      goal: taskGroup.goal,
      tasks: tasks.map((task) => ({
        title: task.title,
        completed: task.completed,
      })),
      todayCompletedCount: stats.today.completedCount,
      todayTotalCount: stats.today.totalCount,
      todayCompletionRate: formatCompletionRate(stats.today.completionRate),
      sevenDayCompletionRate: formatCompletionRate(stats.sevenDay.completionRate),
      totalCompleted: stats.total.totalCompleted,
      activeDayStreak: stats.total.activeDayStreak,
      recentIncompleteTaskCount: stats.recentIncompleteTaskCount,
      recentAverageTaskCount: stats.recentAverageTaskCount,
      performanceLabel: stats.performanceLabel,
    });
    const apiKey = process.env.AI_API_KEY;

    if (!apiKey) {
      return errorResponse("AI_REVIEW_FAILED", 500);
    }

    let rawAIResponse: string;

    try {
      rawAIResponse = await callAIWithPrompts({
        apiKey,
        baseUrl: process.env.AI_API_BASE_URL,
        model: process.env.AI_MODEL,
        systemPrompt: REVIEW_SYSTEM_PROMPT,
        userPrompt,
        maxTokens: 400,
        temperature: 0.3,
        timeoutMs: 30000,
      });
    } catch {
      return errorResponse("AI_REVIEW_FAILED", 500);
    }

    try {
      const response: ReviewSuccessResponse = {
        success: true,
        data: parseReviewAIResponse(rawAIResponse),
      };

      return NextResponse.json(response);
    } catch (error) {
      if (error instanceof ParseReviewAIResponseError) {
        return errorResponse("AI_RESPONSE_INVALID", 500);
      }

      return errorResponse("AI_RESPONSE_INVALID", 500);
    }
  } catch {
    return errorResponse("INTERNAL_ERROR", 500);
  }
}
