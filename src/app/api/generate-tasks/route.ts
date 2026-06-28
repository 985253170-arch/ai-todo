import { NextRequest, NextResponse } from "next/server";
import { callAIService } from "@/lib/ai-client";
import { ERROR_MESSAGES } from "@/lib/constants";
import {
  checkRiskInput,
  validateGoalInput,
} from "@/lib/input-validator";
import {
  parseAIResponse,
  ParseAIResponseError,
} from "@/lib/task-parser";
import type {
  ApiErrorCode,
  GenerateTasksErrorResponse,
  GenerateTasksRequest,
  GenerateTasksSuccessResponse,
  Task,
  TaskGroup,
} from "@/lib/types";

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

  try {
    const rawAIResponse = await callAIService({
      apiKey,
      baseUrl: process.env.AI_API_BASE_URL,
      model: process.env.AI_MODEL,
      goal,
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
