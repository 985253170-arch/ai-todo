import { NextRequest, NextResponse } from "next/server";

import { callAIWithPlainText } from "@/lib/ai-client";
import { getAuthenticatedUserId } from "@/lib/supabase-server";
import {
  ParseCompanionAIResponseError,
  parseCompanionAIResponse,
} from "@/lib/task-companion-parser";
import type {
  CompanionErrorCode,
  CompanionResponse,
  CompanionUserSignal,
} from "@/lib/types";
import {
  COMPANION_SYSTEM_PROMPT,
  buildCompanionUserPrompt,
} from "@/prompts/task-companion";

const VALID_USER_SIGNALS = new Set<CompanionUserSignal>([
  "start",
  "done",
  "stuck",
  "too_hard",
  "encourage",
]);

const MAX_TASK_TITLE_LENGTH = 200;
const MAX_GOAL_LENGTH = 200;
const MAX_CURRENT_STEP_LENGTH = 500;
const MAX_SEQUENCE_TASK_TITLE_LENGTH = 200;
const MAX_STEP_HISTORY_ITEMS = 5;
const MAX_STEP_HISTORY_ITEM_LENGTH = 300;
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

const COMPANION_ERROR_MESSAGES: Record<CompanionErrorCode, string> = {
  UNAUTHORIZED: "请先登录后再使用陪伴模式。",
  INVALID_REQUEST_BODY: "请求参数错误。",
  INVALID_SIGNAL: "暂不支持这个陪伴反馈。",
  AI_COMPANION_FAILED: "AI 陪伴生成失败，请稍后重试。",
  AI_RESPONSE_INVALID: "AI 返回内容不可用，请重试。",
  RATE_LIMITED: "操作过于频繁，请稍后再试。",
  INTERNAL_ERROR: "服务异常，请稍后重试。",
};

interface CompanionRequestBody {
  taskTitle?: unknown;
  goal?: unknown;
  currentStep?: unknown;
  stepHistory?: unknown;
  userSignal?: unknown;
  currentStepNumber?: unknown;
  totalSteps?: unknown;
  completedSteps?: unknown;
  previousTaskTitle?: unknown;
  nextTaskTitle?: unknown;
}

interface CompanionSequenceContext {
  currentStepNumber: number;
  totalSteps: number;
  completedSteps?: number;
  previousTaskTitle?: string;
  nextTaskTitle?: string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

function errorResponse(code: CompanionErrorCode, status: number) {
  const response: CompanionResponse = {
    success: false,
    error: {
      code,
      message: COMPANION_ERROR_MESSAGES[code],
    },
  };

  return NextResponse.json(response, { status });
}

function isCompanionUserSignal(value: unknown): value is CompanionUserSignal {
  return (
    typeof value === "string" &&
    VALID_USER_SIGNALS.has(value as CompanionUserSignal)
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

async function parseRequestBody(request: NextRequest): Promise<CompanionRequestBody | null> {
  try {
    const body = (await request.json()) as unknown;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return null;
    }

    return body as CompanionRequestBody;
  } catch {
    return null;
  }
}

function normalizeStepHistory(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, MAX_STEP_HISTORY_ITEM_LENGTH))
    .filter(Boolean)
    .slice(-MAX_STEP_HISTORY_ITEMS);
}

function normalizePositiveInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function normalizeNonNegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : undefined;
}

function normalizeSequenceTaskTitle(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim().slice(0, MAX_SEQUENCE_TASK_TITLE_LENGTH);

  return trimmedValue || undefined;
}

function normalizeSequenceContext(
  body: CompanionRequestBody,
): CompanionSequenceContext | undefined {
  const currentStepNumber = normalizePositiveInteger(body.currentStepNumber);
  const totalSteps = normalizePositiveInteger(body.totalSteps);

  if (!currentStepNumber || !totalSteps) {
    return undefined;
  }

  return {
    completedSteps: normalizeNonNegativeInteger(body.completedSteps),
    currentStepNumber,
    nextTaskTitle: normalizeSequenceTaskTitle(body.nextTaskTitle),
    previousTaskTitle: normalizeSequenceTaskTitle(body.previousTaskTitle),
    totalSteps,
  };
}

export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return errorResponse("UNAUTHORIZED", 401);
  }

  const body = await parseRequestBody(request);

  if (!body) {
    return errorResponse("INVALID_REQUEST_BODY", 400);
  }

  if (typeof body.taskTitle !== "string" || !body.taskTitle.trim()) {
    return errorResponse("INVALID_REQUEST_BODY", 400);
  }

  if (!isCompanionUserSignal(body.userSignal)) {
    return errorResponse("INVALID_SIGNAL", 400);
  }

  if (!checkRateLimit(userId)) {
    return errorResponse("RATE_LIMITED", 429);
  }

  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) {
    return errorResponse("AI_COMPANION_FAILED", 500);
  }

  try {
    const userPrompt = buildCompanionUserPrompt({
      currentStep:
        typeof body.currentStep === "string"
          ? body.currentStep.trim().slice(0, MAX_CURRENT_STEP_LENGTH)
          : undefined,
      goal:
        typeof body.goal === "string"
          ? body.goal.trim().slice(0, MAX_GOAL_LENGTH)
          : undefined,
      sequenceContext: normalizeSequenceContext(body),
      stepHistory: normalizeStepHistory(body.stepHistory),
      taskTitle: body.taskTitle.trim().slice(0, MAX_TASK_TITLE_LENGTH),
      userSignal: body.userSignal,
    });

    const aiResponse = await callAIWithPlainText({
      apiKey,
      baseUrl: process.env.AI_API_BASE_URL,
      maxTokens: 400,
      model: process.env.AI_MODEL,
      systemPrompt: COMPANION_SYSTEM_PROMPT,
      temperature: 0.4,
      timeoutMs: 30_000,
      userPrompt,
    });

    const response: CompanionResponse = {
      success: true,
      data: parseCompanionAIResponse(aiResponse),
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ParseCompanionAIResponseError) {
      return errorResponse("AI_RESPONSE_INVALID", 500);
    }

    if (error instanceof Error) {
      return errorResponse("AI_COMPANION_FAILED", 500);
    }

    return errorResponse("INTERNAL_ERROR", 500);
  }
}
