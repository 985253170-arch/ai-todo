import { NextRequest, NextResponse } from "next/server";
import { callAIService } from "@/lib/ai-client";
import { computeAdjustment } from "@/lib/adjust-task-strategy";
import { ERROR_MESSAGES } from "@/lib/constants";
import {
  checkRiskInput,
  validateGoalInput,
} from "@/lib/input-validator";
import { computeAllStats } from "@/lib/stats-calculator";
import {
  getAuthenticatedUserId,
  getSupabaseServerClient,
} from "@/lib/supabase-server";
import {
  parseAIResponse,
  ParseAIResponseError,
} from "@/lib/task-parser";
import { buildPrompt } from "@/prompts/task-generation";
import type {
  ApiErrorCode,
  GenerateTasksErrorResponse,
  GenerateTasksRequest,
  GenerateTasksSuccessResponse,
  StatsData,
  Task,
  TaskGroup,
} from "@/lib/types";

const DEFAULT_TIMEZONE_OFFSET = -480;

function errorResponse(code: ApiErrorCode, status: number) {
  const messages: Record<ApiErrorCode, string> = {
    EMPTY_INPUT: ERROR_MESSAGES.EMPTY_INPUT,
    INPUT_TOO_SHORT: ERROR_MESSAGES.INPUT_TOO_SHORT,
    INPUT_TOO_LONG: ERROR_MESSAGES.INPUT_TOO_LONG,
    HIGH_RISK_INPUT: ERROR_MESSAGES.HIGH_RISK_INPUT,
    AI_GENERATION_FAILED: ERROR_MESSAGES.AI_GENERATION_FAILED,
    AI_PARSE_FAILED: ERROR_MESSAGES.AI_PARSE_FAILED,
    NETWORK_ERROR: ERROR_MESSAGES.NETWORK_ERROR,
  };

  const body: GenerateTasksErrorResponse = {
    success: false,
    error: {
      code,
      message: messages[code],
    },
  };

  return NextResponse.json(body, { status });
}

function createTaskGroup(goal: string, taskTitles: string[]): TaskGroup {
  const now = new Date().toISOString();
  const tasks: Task[] = taskTitles.map((title, index) => ({
    id: `task_${String(index + 1).padStart(3, "0")}`,
    title,
    completed: false,
    createdAt: now,
    updatedAt: now,
  }));

  return {
    id: `task_group_${Date.now()}`,
    goal,
    tasks,
    createdAt: now,
    updatedAt: now,
  };
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

export async function POST(request: NextRequest) {
  let body: GenerateTasksRequest;

  try {
    body = (await request.json()) as GenerateTasksRequest;
  } catch {
    return errorResponse("EMPTY_INPUT", 400);
  }

  const goal = typeof body.goal === "string" ? body.goal.trim() : "";
  const validation = validateGoalInput(goal);

  if (!validation.isValid) {
    return errorResponse(validation.code, 400);
  }

  if (checkRiskInput(goal)) {
    return errorResponse("HIGH_RISK_INPUT", 400);
  }

  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) {
    return errorResponse("AI_GENERATION_FAILED", 500);
  }

  const timezoneOffset = parseTimezoneOffset(body.timezoneOffset);
  const supabase = getSupabaseServerClient();
  const userId = await getAuthenticatedUserId();
  const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";

  let stats: StatsData | undefined;
  let userPrompt: string | undefined;

  if (supabase && (userId || deviceId)) {
    try {
      const computedStats = await computeAllStats(
        supabase,
        { userId, deviceId },
        timezoneOffset,
      );

      if (computedStats.total.totalCompleted > 0) {
        stats = computedStats;
        userPrompt = buildPrompt(goal, stats, computeAdjustment(stats));
      }
    } catch {
      // Stats failures should not block task generation.
    }
  }

  try {
    const rawAIResponse = await callAIService({
      apiKey,
      baseUrl: process.env.AI_API_BASE_URL,
      model: process.env.AI_MODEL,
      goal,
      userPrompt,
    });
    const taskTitles = parseAIResponse(rawAIResponse);
    const response: GenerateTasksSuccessResponse = {
      success: true,
      data: createTaskGroup(goal, taskTitles),
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ParseAIResponseError) {
      return errorResponse("AI_PARSE_FAILED", 500);
    }

    return errorResponse("AI_GENERATION_FAILED", 500);
  }
}
