import { NextRequest, NextResponse } from "next/server";

import { callAIWithPlainText } from "@/lib/ai-client";
import { getAuthenticatedUserId } from "@/lib/supabase-server";
import {
  ParseAssistAIResponseError,
  parseAssistAIResponse,
} from "@/lib/task-assist-parser";
import type {
  AssistActionType,
  AssistErrorCode,
  AssistResponse,
} from "@/lib/types";
import {
  ASSIST_SYSTEM_PROMPT,
  buildAssistUserPrompt,
} from "@/prompts/task-assist";

const VALID_ACTION_TYPES = new Set<AssistActionType>([
  "how_to_start",
  "break_down",
  "five_minute",
  "im_stuck",
]);

const MAX_TASK_TITLE_LENGTH = 200;
const MAX_GOAL_LENGTH = 200;
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

type TaskAssistErrorCode =
  | AssistErrorCode
  | "TASK_TITLE_REQUIRED"
  | "AI_NOT_CONFIGURED";

type TaskAssistResponse =
  | AssistResponse
  | {
      success: false;
      error: {
        code: TaskAssistErrorCode;
        message: string;
      };
    };

const ASSIST_ERROR_MESSAGES: Record<TaskAssistErrorCode, string> = {
  UNAUTHORIZED: "请先登录后再使用 AI 辅助。",
  INVALID_REQUEST_BODY: "请求参数错误。",
  TASK_TITLE_REQUIRED: "任务内容不能为空。",
  INVALID_ACTION_TYPE: "暂不支持这个辅助类型。",
  AI_NOT_CONFIGURED: "AI 服务暂未配置。",
  AI_ASSIST_FAILED: "AI 辅助生成失败，请稍后重试。",
  AI_RESPONSE_INVALID: "AI 返回内容不可用，请重试。",
  RATE_LIMITED: "操作过于频繁，请稍后再试。",
  INTERNAL_ERROR: "服务异常，请稍后重试。",
};

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

function errorResponse(code: TaskAssistErrorCode, status: number) {
  const response: TaskAssistResponse = {
    success: false,
    error: {
      code,
      message: ASSIST_ERROR_MESSAGES[code],
    },
  };

  return NextResponse.json(response, { status });
}

function isAssistActionType(value: unknown): value is AssistActionType {
  return (
    typeof value === "string" &&
    VALID_ACTION_TYPES.has(value as AssistActionType)
  );
}

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const currentEntry = rateLimitMap.get(userId);

  if (!currentEntry || currentEntry.resetAt <= now) {
    rateLimitMap.set(userId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return true;
  }

  if (currentEntry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  currentEntry.count += 1;
  return true;
}

async function parseRequestBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return errorResponse("UNAUTHORIZED", 401);
  }

  const body = await parseRequestBody(request);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return errorResponse("INVALID_REQUEST_BODY", 400);
  }

  const { actionType, goal, taskTitle } = body as Record<string, unknown>;

  if (typeof taskTitle !== "string" || !taskTitle.trim()) {
    return errorResponse("TASK_TITLE_REQUIRED", 400);
  }

  if (!isAssistActionType(actionType)) {
    return errorResponse("INVALID_ACTION_TYPE", 400);
  }

  if (!checkRateLimit(userId)) {
    return errorResponse("RATE_LIMITED", 429);
  }

  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) {
    return errorResponse("AI_NOT_CONFIGURED", 500);
  }

  try {
    const userPrompt = buildAssistUserPrompt({
      actionType,
      goal:
        typeof goal === "string" ? goal.trim().slice(0, MAX_GOAL_LENGTH) : "",
      taskTitle: taskTitle.trim().slice(0, MAX_TASK_TITLE_LENGTH),
    });

    const aiResponse = await callAIWithPlainText({
      apiKey,
      baseUrl: process.env.AI_API_BASE_URL,
      maxTokens: 300,
      model: process.env.AI_MODEL,
      systemPrompt: ASSIST_SYSTEM_PROMPT,
      temperature: 0.4,
      timeoutMs: 30_000,
      userPrompt,
    });

    const result = parseAssistAIResponse(aiResponse);
    const response: AssistResponse = {
      success: true,
      data: {
        result,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ParseAssistAIResponseError) {
      return errorResponse("AI_RESPONSE_INVALID", 500);
    }

    if (error instanceof Error) {
      return errorResponse("AI_ASSIST_FAILED", 500);
    }

    return errorResponse("INTERNAL_ERROR", 500);
  }
}
