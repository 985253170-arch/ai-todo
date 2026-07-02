# Phase 14A 执行方案 — AI 复盘 API

> **状态**：已通过 Review，等待 Codex 实现
> **依赖**：Phase 13（全部完成并通过验收）
> **上级文档**：[Architecture-Phase14.md](./Architecture-Phase14.md)
> **制定日期**：2026-07-01
> **最后修正**：2026-07-01（Review 修正：P1-1 / P1-2 / P1-3 / P2-1 / P2-2 / P2-3）

---

## 目录

- [1. Phase 14A 目标](#1-phase-14a-目标)
- [2. 允许修改文件](#2-允许修改文件)
- [3. 禁止修改文件](#3-禁止修改文件)
- [4. API 设计确认](#4-api-设计确认)
- [5. 数据读取流程](#5-数据读取流程)
- [6. 权限校验流程](#6-权限校验流程)
- [7. AI Prompt 方案](#7-ai-prompt-方案)
- [8. AI 调用方案](#8-ai-调用方案)
- [9. AI 响应解析方案](#9-ai-响应解析方案)
- [10. Rate Limit 决策](#10-rate-limit-决策)
- [11. 文件级改动计划](#11-文件级改动计划)
- [12. 手动测试清单](#12-手动测试清单)
- [13. P0/P1/P2 风险自查](#13-p0p1p2-风险自查)
- [14. 是否建议进入 Codex 实现](#14-是否建议进入-codex-实现)
- [15. 给 Codex 的实现边界提醒](#15-给-codex-的实现边界提醒)

---

## 1. Phase 14A 目标

### 1.1 一句话目标

实现 `POST /api/task-groups/review` API Route，支持 session-aware AI 复盘。**只做后端 API，不做前端 UI。**

### 1.2 交付物

| # | 交付物 | 类型 |
|---|--------|------|
| 1 | `src/app/api/task-groups/review/route.ts` | 新建 — 核心 API Route |
| 2 | `src/prompts/task-review.ts` | 新建 — AI System Prompt + User Prompt 构建函数 |
| 3 | `src/lib/review-parser.ts` | 新建 — AI 响应解析 + 字段校验 + fallback |
| 4 | `src/lib/ai-client.ts`（修改） | 新增 `callAIWithPrompts()` 通用函数 |
| 5 | `src/lib/types.ts`（追加） | 追加 Review 相关类型定义（文件末尾） |

### 1.3 验收标准

1. `POST /api/task-groups/review` 返回 200 + 完整 `ReviewData`
2. 已登录复盘 `user_id` 数据，未登录复盘 `device_id` 数据
3. 无活跃 `task_group` 时返回 `NO_ACTIVE_TASK_GROUP`
4. `tasks` 为空时返回 `NO_TASKS_TO_REVIEW`（不调用 AI）
5. `suggestedDifficulty` 和 `suggestedTaskCountRange` 正确返回
6. AI 响应格式非法时返回 `AI_RESPONSE_INVALID`（不崩溃）
7. 越权访问返回 403 `UNAUTHORIZED_TASK_GROUP`
8. `RATE_LIMITED` 错误码已定义且前端有对应文案（后端 best-effort 内存计数可选）
9. 不暴露 AI_API_KEY / 系统 Prompt
10. `npm run lint` + `npm run build` 通过

### 1.4 Phase 14A 不做

```
❌ 不创建前端 hook / 组件
❌ 不修改 useTaskGroup / useTaskStats / useTaskHistory
❌ 不修改 page.tsx
❌ 不修改数据库 schema
❌ 不新增 npm 依赖
❌ 不持久化复盘结果（复盘只返回给前端 state）
❌ 不进入 Phase 14B（UI）/ Phase 14C（集成）/ Phase 14D（验收）
```

---

## 2. 允许修改文件

### 2.1 最终允许修改列表（共 5 个）

| # | 文件 | 操作 | 改动量估算 | 性质 |
|---|------|------|:---:|------|
| 1 | `src/lib/types.ts` | 追加 Review 类型定义（文件末尾 ~50 行） | ~55 行 | 只追加，不修改已有代码 |
| 2 | `src/lib/ai-client.ts` | 新增 `callAIWithPrompts()` 通用函数（~60 行） | ~60 行 | 不动 `callAIService` 函数 |
| 3 | `src/prompts/task-review.ts` | 新建 | ~100 行 | Phase 14A 后端辅助模块 |
| 4 | `src/lib/review-parser.ts` | 新建 | ~80 行 | Phase 14A 后端辅助模块 |
| 5 | `src/app/api/task-groups/review/route.ts` | 新建 | ~200 行 | 核心实现 |

**总计**：~500 行新增代码，零行删除或重构现有代码。

### 2.2 各文件详细说明

#### 2.2.1 `src/lib/types.ts`（追加，文件末尾）

在现有 `AuthMeResponse` 类型之后追加：

```typescript
// ─── Phase 14A: AI 复盘 ───

export type ReviewErrorCode =
  | "INVALID_REQUEST_BODY"        // ← 请求体不是合法 JSON
  | "INVALID_DEVICE_ID"           // 未登录且未传 deviceId
  | "INVALID_TASK_GROUP_ID"       // taskGroupId 格式无效
  | "TASK_GROUP_NOT_FOUND"        // taskGroupId 对应的记录不存在
  | "UNAUTHORIZED_TASK_GROUP"     // taskGroupId 属于其他用户/设备
  | "NO_ACTIVE_TASK_GROUP"        // 未传 taskGroupId 且无活跃任务组
  | "NO_TASKS_TO_REVIEW"          // 活跃任务组存在但 tasks 为空
  | "AI_REVIEW_FAILED"            // AI 调用失败（网络、超时、模型错误）
  | "AI_RESPONSE_INVALID"         // AI 返回非 JSON / 字段校验失败
  | "RATE_LIMITED"                // 请求过于频繁
  | "INTERNAL_ERROR";             // 未知内部错误

export type SuggestedDifficulty = "lighter" | "normal" | "deeper";

export interface ReviewSections {
  summary: string;
  encouragement: string;
  nextStep: string;
}

export interface ReviewData {
  feedbackText: string;
  sections: ReviewSections;
  suggestedDifficulty: SuggestedDifficulty;
  suggestedTaskCountRange: [number, number];
}

export interface ReviewSuccessResponse {
  success: true;
  data: ReviewData;
}

export interface ReviewErrorResponse {
  success: false;
  error: {
    code: ReviewErrorCode;
    message: string;
  };
}

export type ReviewResponse = ReviewSuccessResponse | ReviewErrorResponse;
```

**重要约束**：
- `INVALID_REQUEST_BODY` 是新增的第 11 个错误码（Review 修正 P1-3）
- 追加位置在文件末尾，不修改任何已有类型定义
- `ReviewErrorCode` 不包含 `NOT_CONFIGURED`——项目未配置 SUPABASE_URL 时整个项目不可用，Phase 14A 不单独处理

#### 2.2.2 `src/lib/ai-client.ts`（新增函数，不修改已有代码）

在现有 `callAIService` 函数之后（文件末尾）追加 `callAIWithPrompts`：

```typescript
interface CallAIWithPromptsOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

/**
 * 通用 AI 调用函数。
 * 与 callAIService 解耦——不引入 task-generation 的 System Prompt 或 JSON Schema。
 * 轻量 2 层 fallback：
 *   Layer 1: response_format: { type: "json_object" }
 *   Layer 2: 不带 response_format（纯文本 JSON prompt）
 *   两层都失败 → 抛出 Error → 调用方映射为 AI_REVIEW_FAILED
 */
export async function callAIWithPrompts(
  options: CallAIWithPromptsOptions,
): Promise<string> {
  const {
    apiKey,
    baseUrl,
    model = "gpt-4o-mini",
    systemPrompt,
    userPrompt,
    maxTokens = 400,
    temperature = 0.3,
    timeoutMs = 30000,
  } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  async function tryFetch(format: Record<string, unknown> | undefined) {
    const response = await fetch(
      `${normalizeBaseUrl(baseUrl)}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature,
          max_tokens: maxTokens,
          ...(format ? { response_format: format } : {}),
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(`AI request failed with status ${response.status}.`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("AI response content is empty.");
    }

    return content;
  }

  try {
    return await tryFetch({ type: "json_object" });
  } catch {
    try {
      return await tryFetch(undefined);
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  } finally {
    clearTimeout(timeout);
  }
}
```

**关键设计决策**：
- 不修改现有 `callAIService`——它是 task generation 专用的，与 JSON Schema 耦合
- `callAIWithPrompts` 接收自定义 systemPrompt + userPrompt，不引入 task-generation 的上下文
- 不使用 `json_schema`（structured output）——复盘 JSON 结构简单，`json_object` 足够
- 2 层 fallback：`json_object` → 无 `response_format`（Review 修正 P1-2）
- `max_tokens` 默认 400（复盘文案 ≤ 180 字，远小于 generate-tasks 的 700）
- `temperature` 默认 0.3（比 generate-tasks 的 0.2 稍高，复盘需要一定自然语言的多样性）

#### 2.2.3 `src/prompts/task-review.ts`（新建）

**文件定位**：Phase 14A 后端辅助模块。在服务端执行（API Route 内引用），不进入前端 bundle。遵循 `src/prompts/task-generation.ts` 的既有模式——该目录已是项目约定。

```typescript
export const REVIEW_SYSTEM_PROMPT = `你是一个温和的 AI 行动教练。你的任务是根据用户今天的任务完成情况和近期统计数据，给出一段简短、温和、行动导向的复盘反馈。

规则：
1. 使用中文。
2. 最多 120-180 字。
3. 不批评用户，不使用"失败""落后""拖延""太差""做得不好"等压力词汇。
4. 如果全部完成（100%）：给予简短正反馈，不夸张。
5. 如果部分完成（> 0%）：先肯定已完成部分，再指出下一步。
6. 如果零完成（有任务但 0%）：不批评，建议从最小一步开始。
7. 如果用户连续行动 ≥ 3 天且完成率 ≥ 70%：认可节奏稳定性。
8. 如果用户完成率 < 50%：温和建议减少任务或从更小目标开始。
9. 最多 3 段短句。
10. 不做心理诊断，不做医疗建议。
11. 根据数据的实际内容给出具体反馈，不要使用空洞的模板话术。

你必须以 JSON 格式输出，格式如下：
{
  "feedbackText": "完整复盘文案，120-180字",
  "sections": {
    "summary": "今天完成了什么，1-2句",
    "encouragement": "温和鼓励，1句",
    "nextStep": "下一步建议，1句"
  },
  "suggestedDifficulty": "lighter" | "normal" | "deeper",
  "suggestedTaskCountRange": [min数量, max数量]
}

suggestedDifficulty 判断标准：
- "lighter"：最近7天完成率 < 50%，或 totalCompleted 极低，建议更轻量的任务
- "deeper"：最近7天完成率 ≥ 80%，连续行动 ≥ 7 天，可以适度增加挑战
- "normal"：其他情况，保持当前节奏

suggestedTaskCountRange 判断标准：
- 默认 [3, 5]
- 最近7天完成率 < 50% → [2, 3]
- 最近7天完成率 ≥ 80% 且 streak ≥ 7 → [5, 7]
- 不要超过 [2, 8] 的范围`;

export interface ReviewPromptInput {
  goal: string;
  tasks: Array<{ title: string; completed: boolean }>;
  todayCompletedCount: number;
  todayTotalCount: number;
  todayCompletionRate: string;
  sevenDayCompletionRate: string;
  totalCompleted: number;
  activeDayStreak: number;
  recentIncompleteTaskCount: number;
  recentAverageTaskCount: number;
  performanceLabel: string;
}

export function buildReviewUserPrompt(input: ReviewPromptInput): string {
  const tasksList = input.tasks
    .map((t) => `- ${t.completed ? "✅" : "☐"} ${t.title}`)
    .join("\n");

  return `用户今天的目标："${input.goal}"

任务列表：
${tasksList}

今日统计：
- 完成任务数：${input.todayCompletedCount}/${input.todayTotalCount}
- 完成率：${input.todayCompletionRate}

最近 7 天统计：
- 完成率：${input.sevenDayCompletionRate}
- 总完成任务数：${input.totalCompleted}
- 连续行动天数：${input.activeDayStreak} 天
- 最近未完成任务数：${input.recentIncompleteTaskCount}
- 最近平均任务数：${input.recentAverageTaskCount}
- 表现状态：${input.performanceLabel}

请根据以上数据生成今日复盘反馈。`;
}
```

**Pattern 对齐**：与 `src/prompts/task-generation.ts` 完全一致——导出 `SYSTEM_PROMPT` 常量和 `buildPrompt()` 函数。

#### 2.2.4 `src/lib/review-parser.ts`（新建）

**文件定位**：Phase 14A 后端辅助模块。在服务端执行（API Route 内引用），不进入前端 bundle。遵循 `src/lib/task-parser.ts` 的既有模式——该目录已是项目约定。

```typescript
import type { ReviewData, SuggestedDifficulty } from "@/lib/types";

export class ParseReviewAIResponseError extends Error {
  constructor(message = "Failed to parse review AI response.") {
    super(message);
    this.name = "ParseReviewAIResponseError";
  }
}

// --- 辅助校验函数 ---

export function isSuggestedDifficulty(
  value: unknown,
): value is SuggestedDifficulty {
  return (
    value === "lighter" ||
    value === "normal" ||
    value === "deeper"
  );
}

export function normalizeTaskCountRange(
  value: unknown,
): [number, number] {
  if (!Array.isArray(value) || value.length !== 2) {
    return [3, 5];
  }

  const [min, max] = value;
  if (
    typeof min !== "number" ||
    typeof max !== "number" ||
    !Number.isInteger(min) ||
    !Number.isInteger(max) ||
    min < 2 ||
    max > 8 ||
    min > max
  ) {
    return [3, 5];
  }

  return [min, max];
}

// --- 核心解析函数 ---

function cleanReviewAIResponse(rawText: string): string {
  let cleaned = rawText.trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  return cleaned;
}

/**
 * 解析 AI 复盘响应，返回 ReviewData。
 * 丢失的字段按 fallback 策略填充：
 *   - feedbackText 缺失 → 抛出 ParseReviewAIResponseError
 *   - sections 缺失 → { summary: "", encouragement: "", nextStep: "" }
 *   - suggestedDifficulty 缺失/非法 → "normal"
 *   - suggestedTaskCountRange 缺失/非法 → [3, 5]
 */
export function parseReviewAIResponse(rawText: string): ReviewData {
  let parsed: unknown;

  try {
    parsed = JSON.parse(cleanReviewAIResponse(rawText));
  } catch {
    // 备选：尝试提取首个 JSON 对象
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        throw new ParseReviewAIResponseError(
          "Review AI response is not valid JSON.",
        );
      }
    } else {
      throw new ParseReviewAIResponseError(
        "Review AI response is not valid JSON.",
      );
    }
  }

  if (!parsed || typeof parsed !== "object") {
    throw new ParseReviewAIResponseError(
      "Review AI response is not an object.",
    );
  }

  const obj = parsed as Record<string, unknown>;

  // ─── feedbackText（硬必填）───
  const feedbackText =
    typeof obj.feedbackText === "string" ? obj.feedbackText.trim() : "";

  if (!feedbackText || feedbackText.length > 300) {
    throw new ParseReviewAIResponseError(
      "Review AI response feedbackText is missing or too long.",
    );
  }

  // ─── sections（必填——缺失时 fallback 为空字符串）───
  const sectionsObj =
    typeof obj.sections === "object" && obj.sections !== null
      ? (obj.sections as Record<string, unknown>)
      : {};

  const summary =
    typeof sectionsObj.summary === "string"
      ? sectionsObj.summary.trim()
      : "";
  const encouragement =
    typeof sectionsObj.encouragement === "string"
      ? sectionsObj.encouragement.trim()
      : "";
  const nextStep =
    typeof sectionsObj.nextStep === "string"
      ? sectionsObj.nextStep.trim()
      : "";

  // ─── suggestedDifficulty（非法时 fallback 为 "normal"）───
  const suggestedDifficulty: SuggestedDifficulty = isSuggestedDifficulty(
    obj.suggestedDifficulty,
  )
    ? obj.suggestedDifficulty
    : "normal";

  // ─── suggestedTaskCountRange（非法时 fallback 为 [3, 5]）───
  const suggestedTaskCountRange = normalizeTaskCountRange(
    obj.suggestedTaskCountRange,
  );

  return {
    feedbackText,
    sections: { summary, encouragement, nextStep },
    suggestedDifficulty,
    suggestedTaskCountRange,
  };
}
```

**Pattern 对齐**：与 `src/lib/task-parser.ts` 一致——`ParseAIResponseError` 类、`cleanAIResponse`、`parseJsonObject` 模式。名称区分：`ParseReviewAIResponseError` 避免混淆。

#### 2.2.5 `src/app/api/task-groups/review/route.ts`（新建，核心）

```typescript
import { NextResponse } from "next/server";
import { getAuthenticatedUserId, getSupabaseServerClient } from "@/lib/supabase-server";
import { computeAllStats } from "@/lib/stats-calculator";
import { callAIWithPrompts } from "@/lib/ai-client";
import { REVIEW_SYSTEM_PROMPT, buildReviewUserPrompt } from "@/prompts/task-review";
import { parseReviewAIResponse, ParseReviewAIResponseError } from "@/lib/review-parser";
import type { ReviewErrorCode, ReviewResponse } from "@/lib/types";

// ─── 局部错误文案映射（不放入 constants.ts）───
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

function errorResponse(code: ReviewErrorCode, status: number) {
  const body = {
    success: false as const,
    error: { code, message: REVIEW_ERROR_MESSAGES[code] },
  };
  return NextResponse.json(body, { status });
}

// ─── 可选 best-effort rate limit ───
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(scope: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(scope);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(scope, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false; // 超过限制
  }

  entry.count += 1;
  return true;
}

// ─── POST handler ───
export async function POST(request: Request) {
  try {
    // ─── Step 1: 解析请求体 ───
    let body: Record<string, unknown>;
    try {
      const raw = await request.json();
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return errorResponse("INVALID_REQUEST_BODY", 400);
      }
      body = raw as Record<string, unknown>;
    } catch {
      return errorResponse("INVALID_REQUEST_BODY", 400);
    }

    // ─── Step 2: 认证 ───
    const userId = await getAuthenticatedUserId();

    // ─── Step 3: 参数校验 ───
    const deviceId =
      typeof body.deviceId === "string" && body.deviceId.length > 0
        ? body.deviceId
        : null;

    if (!userId && !deviceId) {
      return errorResponse("INVALID_DEVICE_ID", 400);
    }

    const taskGroupId =
      typeof body.taskGroupId === "string" && body.taskGroupId.length > 0
        ? body.taskGroupId
        : null;

    if (taskGroupId) {
      // 简单 UUID 格式校验
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          taskGroupId,
        )
      ) {
        return errorResponse("INVALID_TASK_GROUP_ID", 400);
      }
    }

    const timezoneOffset =
      typeof body.timezoneOffset === "number" &&
      body.timezoneOffset >= -720 &&
      body.timezoneOffset <= 720
        ? body.timezoneOffset
        : -480;

    // ─── Step 4: 可选 rate limit ───
    const rateScope = userId ? `user:${userId}` : `device:${deviceId!}`;
    if (!checkRateLimit(rateScope)) {
      return errorResponse("RATE_LIMITED", 429);
    }

    // ─── Step 5: Supabase ───
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return errorResponse("INTERNAL_ERROR", 500);
    }

    // ─── Step 6: 查询 task_group ───
    let taskGroupQuery = supabase.from("task_groups").select("*");

    if (taskGroupId) {
      taskGroupQuery = taskGroupQuery.eq("id", taskGroupId);
    } else {
      taskGroupQuery = taskGroupQuery.is("archived_at", null);
    }

    // 归属过滤
    if (userId) {
      taskGroupQuery = taskGroupQuery.eq("user_id", userId);
    } else {
      taskGroupQuery = taskGroupQuery
        .eq("device_id", deviceId!)
        .is("user_id", null);
    }

    if (!taskGroupId) {
      taskGroupQuery = taskGroupQuery
        .order("updated_at", { ascending: false })
        .limit(1);
    }

    const { data: taskGroupRows, error: tgError } = await taskGroupQuery;

    if (tgError) {
      return errorResponse("INTERNAL_ERROR", 500);
    }

    if (!taskGroupRows || taskGroupRows.length === 0) {
      if (taskGroupId) {
        return errorResponse("TASK_GROUP_NOT_FOUND", 404);
      }
      return errorResponse("NO_ACTIVE_TASK_GROUP", 404);
    }

    const tgRow = taskGroupRows[0] as {
      id: string;
      goal: string;
      user_id: string | null;
      device_id: string | null;
    };

    // ─── Step 7: 归属校验（传入 taskGroupId 时）───
    if (taskGroupId) {
      if (userId) {
        if (tgRow.user_id !== userId) {
          return errorResponse("UNAUTHORIZED_TASK_GROUP", 403);
        }
      } else {
        if (tgRow.device_id !== deviceId || tgRow.user_id !== null) {
          return errorResponse("UNAUTHORIZED_TASK_GROUP", 403);
        }
      }
    }

    // ─── Step 8: 查询 tasks（两步查询）───
    const { data: tasksRows, error: tasksError } = await supabase
      .from("tasks")
      .select("*")
      .eq("task_group_id", tgRow.id)
      .order("created_at", { ascending: true });

    if (tasksError) {
      return errorResponse("INTERNAL_ERROR", 500);
    }

    if (!tasksRows || tasksRows.length === 0) {
      return errorResponse("NO_TASKS_TO_REVIEW", 400);
    }

    // ─── Step 9: 查询 stats ───
    const ownerFilter = {
      userId: userId ?? null,
      deviceId: deviceId!,
    };
    const stats = computeAllStats(supabase, ownerFilter, timezoneOffset);

    // ─── Step 10: 构建 AI Prompt ───
    const userPrompt = buildReviewUserPrompt({
      goal: tgRow.goal,
      tasks: tasksRows.map(
        (t: { title: string; completed: boolean }) => ({
          title: t.title,
          completed: t.completed,
        }),
      ),
      todayCompletedCount: stats.today.completedCount,
      todayTotalCount: stats.today.totalCount,
      todayCompletionRate:
        stats.today.completionRate !== null
          ? `${Math.round(stats.today.completionRate * 100)}%`
          : "暂无数据",
      sevenDayCompletionRate:
        stats.sevenDay.completionRate !== null
          ? `${Math.round(stats.sevenDay.completionRate * 100)}%`
          : "暂无数据",
      totalCompleted: stats.total.totalCompleted,
      activeDayStreak: stats.total.activeDayStreak,
      recentIncompleteTaskCount: stats.recentIncompleteTaskCount,
      recentAverageTaskCount: stats.recentAverageTaskCount,
      performanceLabel: stats.performanceLabel,
    });

    // ─── Step 11: 调用 AI ───
    const apiKey = process.env.AI_API_KEY;
    const baseUrl = process.env.AI_API_BASE_URL;
    const model = process.env.AI_MODEL || "gpt-4o-mini";

    if (!apiKey) {
      return errorResponse("AI_REVIEW_FAILED", 500);
    }

    let rawAIResponse: string;
    try {
      rawAIResponse = await callAIWithPrompts({
        apiKey,
        baseUrl,
        model,
        systemPrompt: REVIEW_SYSTEM_PROMPT,
        userPrompt,
        maxTokens: 400,
        temperature: 0.3,
        timeoutMs: 30000,
      });
    } catch {
      return errorResponse("AI_REVIEW_FAILED", 500);
    }

    // ─── Step 12: 解析 AI 响应 ───
    let reviewData;
    try {
      reviewData = parseReviewAIResponse(rawAIResponse);
    } catch (e) {
      if (e instanceof ParseReviewAIResponseError) {
        return errorResponse("AI_RESPONSE_INVALID", 500);
      }
      return errorResponse("AI_RESPONSE_INVALID", 500);
    }

    // ─── Step 13: 返回成功响应 ───
    const successBody = {
      success: true as const,
      data: reviewData,
    };
    return NextResponse.json(successBody, { status: 200 });
  } catch {
    return errorResponse("INTERNAL_ERROR", 500);
  }
}
```

**关键实现细节**：
- 错误文案在 `route.ts` 内部以局部 `REVIEW_ERROR_MESSAGES` 映射表定义，不放入 `constants.ts`（Review 修正 P1-1）
- `INVALID_REQUEST_BODY` 覆盖两种场景：JSON 解析异常 + 解析结果不是 object（Review 修正 P1-3）
- `checkRateLimit()` 使用简单的内存 Map，scope = `user:{id}` 或 `device:{id}`。注解 best-effort 并说明 Vercel/Serverless 限制
- `computeAllStats()` 是同步函数，不需要 `await`（Phase 13 已验证）
- 两步查询：task_groups → 收集 ID → tasks。与 history API 一致

---

## 3. 禁止修改文件

Phase 14A 严格限定只修改上述 5 个文件。以下文件**绝不允许修改**：

```
src/lib/constants.ts                    ← 不放入 Review 错误文案，保持现有结构
src/app/page.tsx
src/components/GoalInput.tsx
src/components/Header.tsx
src/components/HeroSection.tsx
src/components/HistoryPanel.tsx
src/components/LoadingState.tsx
src/components/NewDayPrompt.tsx
src/components/StatCard.tsx
src/components/StatsBar.tsx
src/components/TaskList.tsx
src/hooks/useTaskGroup.ts
src/hooks/useTaskStats.ts
src/hooks/useTaskHistory.ts
src/hooks/useAuth.ts
src/app/api/generate-tasks/route.ts
src/app/api/task-group/load/route.ts
src/app/api/task-groups/stats/route.ts
src/app/api/task-groups/history/route.ts
src/lib/stats-calculator.ts              ← 完全复用，不修改
src/lib/task-parser.ts                   ← 完全复用，不修改
src/lib/supabase-server.ts               ← 完全复用，不修改
src/lib/device-id.ts                     ← 完全复用，不修改
src/prompts/task-generation.ts           ← 完全复用，不修改
任何数据库 schema / migration 文件
package.json
```

---

## 4. API 设计确认

### 4.1 路由

```
Method:  POST
Path:    /api/task-groups/review
Auth:    getAuthenticatedUserId() 决定归属
```

### 4.2 请求参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:---:|--------|------|
| `deviceId` | `string` | 未登录时必填 | — | 前端从 `getOrCreateDeviceId()` 获取 |
| `taskGroupId` | `string` | 否 | — | 不传时默认取当前活跃 task_group |
| `timezoneOffset` | `number` | 否 | `-480` | 范围 -720 ~ 720，超出用默认值 |

### 4.3 返回格式

```typescript
// 成功
{ success: true, data: ReviewData }

// 错误
{ success: false, error: { code: ReviewErrorCode, message: string } }
```

### 4.4 11 个错误码

| 错误码 | HTTP | 触发场景 | 调用 AI? |
|------|:---:|------|:---:|
| `INVALID_REQUEST_BODY` | 400 | 请求体不是合法 JSON | 否 |
| `INVALID_DEVICE_ID` | 400 | 未登录且未传 deviceId | 否 |
| `INVALID_TASK_GROUP_ID` | 400 | taskGroupId 格式无效 | 否 |
| `NO_TASKS_TO_REVIEW` | 400 | tasks 数组为空 | 否 |
| `UNAUTHORIZED_TASK_GROUP` | 403 | 越权访问其他用户/设备的数据 | 否 |
| `TASK_GROUP_NOT_FOUND` | 404 | taskGroupId 不存在 | 否 |
| `NO_ACTIVE_TASK_GROUP` | 404 | 无活跃任务组 | 否 |
| `RATE_LIMITED` | 429 | 请求过于频繁 | 否 |
| `AI_REVIEW_FAILED` | 500 | AI HTTP 调用失败（2 层全失败） | 是 |
| `AI_RESPONSE_INVALID` | 500 | AI 返回了内容但 parser 校验失败 | 是 |
| `INTERNAL_ERROR` | 500 | Supabase 错误 / 未知异常 | 视阶段 |

### 4.5 服务端流程（13 步）

```
Step 1:  解析请求 JSON → 失败 → 400 INVALID_REQUEST_BODY
Step 2:  getAuthenticatedUserId() → userId
Step 3:  参数校验（deviceId、taskGroupId 格式、timezoneOffset）
Step 4:  可选 rate limit 检查
Step 5:  getSupabaseServerClient()
Step 6:  查询 task_group（归属过滤 + 活跃/指定逻辑）
Step 7:  归属校验（传入 taskGroupId 时）
Step 8:  查询 tasks（两步查询）
Step 9:  computeAllStats(supabase, ownerFilter, timezoneOffset)
Step 10: buildReviewUserPrompt(goal, tasks, stats)
Step 11: callAIWithPrompts({ systemPrompt, userPrompt })
           ├── 第 1 层：json_object
           ├── 第 2 层：无 response_format
           └── 两层都失败 → 500 AI_REVIEW_FAILED
Step 12: parseReviewAIResponse(rawAIResponse)
           ├── feedbackText 缺失 → 500 AI_RESPONSE_INVALID
           ├── sections 缺失 → fallback 空字符串
           ├── suggestedDifficulty 非法 → fallback "normal"
           └── suggestedTaskCountRange 非法 → fallback [3, 5]
Step 13: 200 + ReviewData
```

---

## 5. 数据读取流程

### 5.1 数据来源

Phase 14A 使用**两条独立查询路径**，均复用现有 Phase 12 / 13 基础设施：

| 数据 | 来源 | 操作 |
|------|------|------|
| active task_group | Supabase `task_groups` 表 | 归属过滤 + `archived_at IS NULL` + 最新一条 |
| tasks | Supabase `tasks` 表 | 两步查询：`task_group_id = tg.id` |
| stats | `computeAllStats()` | Phase 13 函数，完全复用，零改动 |

### 5.2 两步查询策略

```
Step A: supabase.from("task_groups").select("*")
        ├── 已登录: .eq("user_id", userId)
        ├── 未登录: .eq("device_id", deviceId).is("user_id", null)
        ├── 指定 ID: .eq("id", taskGroupId)
        └── 取活跃: .is("archived_at", null).order("updated_at").limit(1)

Step B: supabase.from("tasks").select("*")
        .eq("task_group_id", tgRow.id)
        .order("created_at", { ascending: true })
```

**为什么用两步查询**：项目 Supabase 实例不支持嵌套 select（`task_groups(*, tasks(*))`）。与 [src/app/api/task-groups/history/route.ts](../src/app/api/task-groups/history/route.ts) 的两步查询模式一致。

### 5.3 Stats 数据复用

`computeAllStats(supabase, ownerFilter, timezoneOffset)` 返回 `StatsData`，包含：

| 字段 | 类型 | 传给 AI Prompt |
|------|------|:---:|
| `today.completedCount` | `number` | ✅ |
| `today.totalCount` | `number` | ✅ |
| `today.completionRate` | `number \| null` | ✅ |
| `sevenDay.completedCount` | `number` | ✅ |
| `sevenDay.totalCount` | `number` | ✅ |
| `sevenDay.completionRate` | `number \| null` | ✅ |
| `total.totalCompleted` | `number` | ✅ |
| `total.activeDayStreak` | `number` | ✅ |
| `recentIncompleteTaskCount` | `number` | ✅ |
| `recentAverageTaskCount` | `number` | ✅ |
| `performanceLabel` | `"稳定行动" \| "有点吃力" \| "刚刚开始"` | ✅ |

全部 12 个字段传给 AI。

---

## 6. 权限校验流程

### 6.1 Session-Aware 归属模型

与 Phase 11–13 完全一致：

```
getAuthenticatedUserId()
  ├── 已登录 → userId = session.user.id
  └── 未登录 → userId = null

已登录：
  task_groups 查询: .eq("user_id", userId)
  stats 查询: { userId, deviceId: "dummy" } ← computeAllStats 内部忽略 deviceId

未登录：
  task_groups 查询: .eq("device_id", deviceId).is("user_id", null)
  stats 查询: { userId: null, deviceId }
```

### 6.2 归属校验矩阵

| 场景 | 条件 | 行为 |
|------|------|------|
| 不传 `taskGroupId` | — | 取 active task_group（归属过滤已自动隔离） |
| 传入 `taskGroupId` + 已登录 + `user_id` 匹配 | `tgRow.user_id === userId` | 允许复盘 |
| 传入 `taskGroupId` + 已登录 + `user_id` 不匹配 | — | 403 `UNAUTHORIZED_TASK_GROUP` |
| 传入 `taskGroupId` + 未登录 + `device_id` 匹配 + `user_id IS NULL` | 双重匹配 | 允许复盘 |
| 传入 `taskGroupId` + 未登录 + 不匹配 | — | 403 `UNAUTHORIZED_TASK_GROUP` |
| 传入 `taskGroupId` + 记录不存在 | — | 404 `TASK_GROUP_NOT_FOUND` |

### 6.3 对 archived task_group 的态度

API 允许复盘 archived task_group（传入 `taskGroupId` + 归属验证通过即可）。Phase 14B 首版 UI 不提供复盘历史入口，但 API 不阻塞。

### 6.4 安全约束

| # | 约束 | 实现 |
|---|------|------|
| 1 | userId 从 cookie 读取，不从前端 body 传入 | `getAuthenticatedUserId()` |
| 2 | 前端不传 userId | 请求体中只有 `deviceId`、`taskGroupId`、`timezoneOffset` |
| 3 | API Key 只在服务端 | `process.env.AI_API_KEY` 不在前端 bundle |
| 4 | 错误不泄露栈/SQL/Key | 统一 `REVIEW_ERROR_MESSAGES` 映射 |
| 5 | 不允许跨用户/跨设备复盘 | Step 7 归属校验 |

---

## 7. AI Prompt 方案

### 7.1 System Prompt 设计

文件：[src/prompts/task-review.ts](../src/prompts/task-review.ts)

核心约束：

| # | 约束 | 说明 |
|---|------|------|
| 1 | 语言 | 中文 |
| 2 | 长度 | 120–180 字 |
| 3 | 语调 | 不批评、不制造压力 |
| 4 | 结构 | 最多 3 段短句 |
| 5 | 内容 | 基于实际数据，拒绝空洞模板 |
| 6 | 边界 | 不做心理诊断，不做医疗建议 |
| 7 | 输出格式 | 严格 JSON（json_object mode） |

### 7.2 User Prompt 构建

函数 `buildReviewUserPrompt(input)` 接收：

```
goal                 → 目标文本
tasks[]              → { title, completed } 数组
today stats          → 完成数、总数、完成率
sevenDay stats       → 完成率
total stats          → 累计完成、连续行动天数
recent stats         → 未完成任务数、平均任务数
performanceLabel     → 表现状态标签
```

输出为结构化文本（非 JSON），作为 AI 的 user message。

### 7.3 Token 预算

| 模块 | 估计 token |
|------|:---:|
| System Prompt | ~250 tokens |
| User Prompt（含数据） | ~150 tokens |
| AI 输出 | ~200 tokens |
| `max_tokens` 设置 | 400 |

**单次复盘 ~600 total tokens**，低于 generate-tasks 的 ~1000 tokens。

---

## 8. AI 调用方案

### 8.1 函数选择：`callAIWithPrompts()`（新增）

**不复用 `callAIService()`**——现有函数内部引用了 task-generation 的 `SYSTEM_PROMPT` 和 `buildPrompt`，且 `callAIService` 的 3 层 fallback 针对 `json_schema` 设计，复盘不需要。

**在 `ai-client.ts` 中新增 `callAIWithPrompts()`**——通用函数，接收自定义 systemPrompt + userPrompt，不与 task generation 耦合。

### 8.2 两层 Fallback（Review 修正 P1-2）

```
第 1 层：fetch(..., { response_format: { type: "json_object" } })
  ├── HTTP 成功 + content 非空 → 返回 content → 交给 review-parser
  ├── HTTP 成功 + content 为空 → 进入第 2 层
  └── HTTP 失败（网络/超时/401/5xx）→ 进入第 2 层

第 2 层：fetch(..., { /* 不传 response_format */ })
  ├── HTTP 成功 + content 非空 → 返回 content → 交给 review-parser
  ├── HTTP 成功 + content 为空 → 抛出 Error → AI_REVIEW_FAILED
  └── HTTP 失败 → 抛出 Error → AI_REVIEW_FAILED
```

### 8.3 错误码区分（关键）

| AI 调用结果 | Route 返回 |
|------------|-----------|
| 2 层 HTTP 都失败 / content 为空 | `AI_REVIEW_FAILED` |
| AI 返回了内容但 parser 校验失败（非 JSON、缺 feedbackText） | `AI_RESPONSE_INVALID` |

**不混淆**：AI HTTP 调用失败 ≠ AI 返回了无效内容。

### 8.4 超时

使用 `AbortController` + `setTimeout(30s)`。Node.js 18+ 原生支持 `fetch` 的 `signal` 参数。

### 8.5 不重试

AI 调用只试 1 次（不含 fallback）。第 2 层不是重试——是降级策略（去掉 `response_format`）。失败后返回错误，让用户手动点击重试。

---

## 9. AI 响应解析方案

### 9.1 Parser 文件

文件：[src/lib/review-parser.ts](../src/lib/review-parser.ts)

**Pattern 对齐**：[src/lib/task-parser.ts](../src/lib/task-parser.ts)——`ParseError` 类、`cleanResponse`、`parseJson` 三步模式。

### 9.2 解析流程

```
parseReviewAIResponse(rawText)
  │
  ├── 1. cleanReviewAIResponse(rawText)
  │     ├── 去除 ```json 代码块包装
  │     └── 返回纯 JSON 字符串
  │
  ├── 2. JSON.parse(cleaned)
  │     ├── 成功 → 进入字段校验
  │     └── 失败 → 尝试正则提取 { ... } → 再 parse
  │           ├── 成功 → 进入字段校验
  │           └── 失败 → ParseReviewAIResponseError
  │
  ├── 3. 字段校验
  │     ├── feedbackText: string, 非空, ≤ 300 字
  │     │     └── 缺失 → ParseReviewAIResponseError（硬必填）
  │     ├── sections: object
  │     │     ├── 缺失 → { summary: "", encouragement: "", nextStep: "" }
  │     │     ├── summary: string → 否则 ""
  │     │     ├── encouragement: string → 否则 ""
  │     │     └── nextStep: string → 否则 ""
  │     ├── suggestedDifficulty: "lighter" | "normal" | "deeper"
  │     │     └── 非法 → "normal"
  │     └── suggestedTaskCountRange: [number, number]
  │           └── 非法 → [3, 5]
  │
  └── 4. 返回 ReviewData
```

### 9.3 Fallback 策略汇总

| 字段 | 缺失/非法行为 | 默认值 |
|------|------|------|
| `feedbackText` | 抛出 `ParseReviewAIResponseError` → `AI_RESPONSE_INVALID` | 无（硬失败） |
| `sections` | 所有 3 个字段设为空字符串 | `{ summary: "", encouragement: "", nextStep: "" }` |
| `suggestedDifficulty` | 设为 `"normal"` | `"normal"` |
| `suggestedTaskCountRange` | 设为 `[3, 5]` | `[3, 5]` |

### 9.4 导出函数

| 导出 | 用途 |
|------|------|
| `parseReviewAIResponse(rawText): ReviewData` | 核心解析函数 |
| `ParseReviewAIResponseError` | 自定义错误类 |
| `isSuggestedDifficulty(value): type guard` | 校验难度枚举 |
| `normalizeTaskCountRange(value): [number, number]` | 标准化范围数组 |

---

## 10. Rate Limit 决策

### 10.1 分层防护

| 层级 | 机制 | 可靠性 | Phase 14A |
|------|------|:---:|:---:|
| **前端防重复点击** | loading 时按钮禁用 + inflightRef 防并发 | ✅ 可靠 | Phase 14B 实现 |
| **RATE_LIMITED 错误码** | 保留在类型定义和错误码表中 | — | ✅ 必须保留 |
| **后端 best-effort 内存计数** | 服务端内存 Map，同一 scope 60 秒内最多 3 次 | ⚠️ 不可靠 | 可选实现 |

### 10.2 为什么可选后端限流不可靠

在 Vercel / Serverless 环境中：
- 每个请求可能命中不同的函数实例（冷启动）
- 内存 Map 不在实例间共享
- 实例可能随时被回收
- **结论**：内存计数只能作为低成本的防重复请求保护，不是可靠的生产级限流

### 10.3 Phase 14A 要求

**必须做**：
- ✅ `RATE_LIMITED` 在 types.ts 中定义
- ✅ `RATE_LIMITED` 在错误码表中有完整映射
- ✅ route.ts 中包含 `checkRateLimit()` 骨架代码（标注 best-effort）

**如果实现后端限流**：
- 代码 < 20 行（内存 Map + scope key + 时间窗口检查）
- 超过阈值返回 429 `RATE_LIMITED`

**如果不实现后端限流**：
- 保留错误码定义和文案映射（预留）
- 不把 rate limit 写入 Phase 14A 验收标准
- 前端防重复点击机制在 Phase 14B 实现

### 10.4 可靠限流方案（后续评审，非 Phase 14 范围）

| 方案 | 复杂度 | 可靠性 |
|------|:---:|:---:|
| Redis / Upstash Redis | 中 | ✅ 可靠 |
| Supabase 表 + 时间窗口查询 | 中 | ✅ 可靠 |
| Vercel KV | 低 | ✅ 可靠 |

---

## 11. 文件级改动计划

### 11.1 实现顺序

```
Step 1: src/lib/types.ts
  └── 追加 ReviewErrorCode、SuggestedDifficulty、ReviewSections、
      ReviewData、ReviewResponse 等类型（文件末尾，~55 行）

Step 2: src/lib/ai-client.ts
  └── 追加 CallAIWithPromptsOptions 接口 + callAIWithPrompts 函数
      （文件末尾，~60 行）

Step 3: src/prompts/task-review.ts（新建）
  └── REVIEW_SYSTEM_PROMPT + ReviewPromptInput + buildReviewUserPrompt
      （~100 行）

Step 4: src/lib/review-parser.ts（新建）
  └── ParseReviewAIResponseError + isSuggestedDifficulty +
      normalizeTaskCountRange + parseReviewAIResponse
      （~80 行）

Step 5: src/app/api/task-groups/review/route.ts（新建）
  └── REVIEW_ERROR_MESSAGES + errorResponse + checkRateLimit + POST handler
      （~200 行）
```

**推荐实现顺序**：1 → 2 → 3 → 4 → 5。每一步可以在同一次代码生成中完成。

### 11.2 各文件与现有代码的关系

| 文件 | 引用 | 被引用 |
|------|------|------|
| `types.ts`（追加） | — | review-parser.ts、route.ts、Phase 14B 前端 |
| `ai-client.ts`（追加） | — | route.ts（调用 `callAIWithPrompts`） |
| `task-review.ts`（新建） | — | route.ts（`REVIEW_SYSTEM_PROMPT` + `buildReviewUserPrompt`） |
| `review-parser.ts`（新建） | types.ts（`ReviewData`、`SuggestedDifficulty`） | route.ts（`parseReviewAIResponse`） |
| `route.ts`（新建） | supabase-server.ts、stats-calculator.ts、ai-client.ts、task-review.ts、review-parser.ts、types.ts | 前端 Phase 14B 通过 HTTP 调用 |

### 11.3 `stats-calculator.ts` 完全复用

```
✅ computeAllStats() — 同步函数，直接调用
✅ StatsOwnerFilter — 已在 stats-calculator.ts 中导出
✅ 两步查询逻辑 — 与 history API 一致
```

**性能考虑**（P2 风险）：
- `computeAllStats` 在内部 `fetchTaskGroups()` 查询**所有历史 task_groups**（无分页）
- Phase 14A 不修改 stats-calculator，复用 Phase 13 口径
- 如果后续发现超时，单独评估查询窗口或缓存方案
- 不在 Phase 14A 范围

---

## 12. 手动测试清单

### 12.1 单元级测试（本地运行或 curl）

| # | 场景 | 预期 HTTP | 预期 code | 验证重点 |
|:---:|------|:---:|------|------|
| 0 | 请求体不是合法 JSON（`"not json"`） | 400 | `INVALID_REQUEST_BODY` | `request.json()` 抛异常 |
| 1 | 未登录 + 不传 deviceId | 400 | `INVALID_DEVICE_ID` | 参数校验 |
| 2 | 传入无效格式的 taskGroupId（如 `"abc"`） | 400 | `INVALID_TASK_GROUP_ID` | UUID 格式校验 |
| 3 | 有活跃 task_group 但 tasks 为空 | 400 | `NO_TASKS_TO_REVIEW` | 不调用 AI |
| 4 | 传入其他用户的 taskGroupId（越权已登录） | 403 | `UNAUTHORIZED_TASK_GROUP` | 归属校验 |
| 5 | 传入其他设备的 taskGroupId（越权未登录） | 403 | `UNAUTHORIZED_TASK_GROUP` | 归属校验 |
| 6 | 传入不存在的 taskGroupId | 404 | `TASK_GROUP_NOT_FOUND` | 记录存在性 |
| 7 | 未登录 + 无活跃 task_group | 404 | `NO_ACTIVE_TASK_GROUP` | 空数据 |
| 8 | 已登录 + 正常复盘（有 tasks + stats） | 200 | — | 返回完整 `ReviewData` |
| 9 | 未登录 + deviceId + 正常复盘 | 200 | — | session-aware 隔离 |
| 10 | AI 返回非法 JSON（通过 mock `callAIWithPrompts` 返回 `"not json"`） | 500 | `AI_RESPONSE_INVALID` | Parser 兜底 |

> **注意 #10**：通过临时 mock `callAIWithPrompts` 返回非法字符串来测试（mock 不提交）。另一个验证方式是本地 import `parseReviewAIResponse("not json")` 测试 parser 函数自身行为。不要求修改正式 prompt 来触发非法 JSON。

### 12.2 端到端验证（人工，Phase 14A + curl）

| # | 场景 | 验证点 |
|:---:|------|------|
| 11 | 已登录用户完整链路 | goal → tasks → POST /api/task-groups/review → 返回 ReviewData |
| 12 | 未登录用户完整链路 | goal → tasks → POST → 返回 ReviewData |
| 13 | 全部完成 → 复盘语气 | feedbackText 包含正反馈（"节奏很好""全部完成"） |
| 14 | 部分完成 → 复盘语气 | feedbackText 包含"完成了 X 个""可以继续" |
| 15 | 零完成 → 复盘语气 | feedbackText 温和、不批评、建议最小一步 |
| 16 | 连续 7 天 → 复盘提到节奏 | feedbackText 或 sections.encouragement 包含"连续""节奏" |
| 17 | 0 完成率 < 50% → suggestedDifficulty 为 "lighter" | suggestedDifficulty 正确 |
| 18 | AI_API_KEY 未配置 | 500 `AI_REVIEW_FAILED` |
| 19 | AI 不可达（mock baseUrl 为 invalid） | 500 `AI_REVIEW_FAILED`（2 层 fallback 后失败） |

### 12.3 后端 parser 单元测试（本地）

| # | 测试 | 输入 | 预期 |
|:---:|------|------|------|
| 20 | `parseReviewAIResponse("not json")` | 非 JSON 字符串 | 抛出 `ParseReviewAIResponseError` |
| 21 | `parseReviewAIResponse({})` | 空对象 | 抛出 `ParseReviewAIResponseError`（缺 feedbackText） |
| 22 | `parseReviewAIResponse(feedbackText 超长)` | `{ feedbackText: "x".repeat(400) }` | 抛出 `ParseReviewAIResponseError` |
| 23 | `parseReviewAIResponse(最小合法)` | `{ feedbackText: "好" }` | 返回完整 ReviewData，sections 全空串，difficulty="normal"，range=[3,5] |
| 24 | `parseReviewAIResponse(含非法 difficulty)` | `{ feedbackText: "好", suggestedDifficulty: "hard" }` | `suggestedDifficulty` → `"normal"` |
| 25 | `parseReviewAIResponse(含非法 range)` | `{ feedbackText: "好", suggestedTaskCountRange: [1, 10] }` | `suggestedTaskCountRange` → `[3, 5]` |

### 12.4 质量验收

| # | 验证项 | 方法 |
|:---:|------|------|
| 26 | `npm run lint` 通过 | 命令行 |
| 27 | `npm run build` 通过 | 命令行 |
| 28 | `AI_API_KEY` 不出现在前端 bundle | build 后 grep dist 或 standalone |
| 29 | `SUPABASE_SERVICE_ROLE_KEY` 不出现在前端 bundle | 同上 |
| 30 | 系统 Prompt 不出现在前端 bundle | 同上 |

---

## 13. P0/P1/P2 风险自查

### 13.1 风险矩阵

| # | 风险 | 等级 | 概率 | 影响 | 缓解措施 |
|---|------|:---:|:---:|------|------|
| 1 | `callAIWithPrompts` 修改 `ai-client.ts` 时意外破坏 `callAIService` | P1 | 低 | 高 — generate-tasks 不可用 | **只追加，不动继承代码**。`callAIService` 原样保留不动。Code Review 重点检查。 |
| 2 | AI 返回非 JSON / 缺字段 导致 500 | P1 | 中 | 中 — 用户看到错误 | 2 层 fallback + parser 有完整的 JSON 校验 + 正则兜底。feedbackText 缺失才算失败，其他字段有默认值。 |
| 3 | 解析请求体时未处理 JSON 异常 | P1 | 低 | 中 — `request.json()` 抛异常导致 500 | wrap 在 try-catch 中 → 400 `INVALID_REQUEST_BODY`（Review 修正 P1-3）。已在上游 route.ts 落地。 |
| 4 | `types.ts` 追加代码位置不当破坏已有导出 | P1 | 低 | 高 — TypeScript 编译失败 | 追加在文件末尾，不修改任何已有类型。CI build 会立即发现。 |
| 5 | `computeAllStats` 查询全部历史数据导致超时（Serverless 冷启动 + 大量历史） | P2 | 低 | 低 — 长历史用户的 API 响应慢 | Phase 14A 不修改 stats-calculator，复用 Phase 13 口径。如果 Phase 14C 发现超时，再单独评估查询窗口或缓存方案。不在 Phase 14A 范围。 |
| 6 | Serverless 冷启动下 `callAIWithPrompts` 超时（30s 可能不够） | P2 | 低 | 中 — 连续超时影响体验 | 30s 超时合理（review AI 输出短）。如果一直超时，先检查 API 可用性。Vercel hobby plan 函数超时 10s 可能不够——需用 pro plan 或 edge 函数。 |
| 7 | Rate limit 内存 Map 在 Serverless 环境无效 | P2 | 高 | 极低 — 最多不限制而是文档不足 | 明确标注 best-effort，前端 inflightRef 才是真正的防重复保护（Phase 14B）。 |
| 8 | 未登录用户 deviceId 伪造 | P2 | 低 | 低 — 可看到他人匿名数据 | 与 Phase 11–13 一致——deviceId 是 UUID v4，非登录态没有更强验证方法。用户登录后自动迁移到 user_id 验证。 |
| 9 | `INVALID_REQUEST_BODY` 与已有 `INVALID_XXX` 错误码命名冲突 | P2 | 极低 | 极低 — 类型系统会捕获 | 已有 `INVALID_DEVICE_ID`（CloudTaskGroup / History / Stats），新增 `INVALID_REQUEST_BODY`（仅 Review），TypeScript 编译时检查。 |
| 10 | AI Response 结构与 prompt 指定格式不一致 | P2 | 中 | 低 — sections/枚举有 fallback | parser 对非 feedbackText 字段都有 fallback，AI 输出不稳只影响复盘文案质量不影响 API 稳定性。 |

### 13.2 无 P0 风险

Phase 14A 是后端 API——不影响现有 TaskList 勾选、StatsBar 统计、HistoryPanel 历史、generate-tasks 任务生成。最坏情况：review API 500 → 用户重试。不涉及数据库写入或 schema 变更。

---

## 14. 是否建议进入 Codex 实现

✅ **建议进入 Phase 14A Codex 实现。**

**理由**：

1. **所有 P1 已修复**（P1-1 文件范围收敛、P1-2 AI fallback 加固、P1-3 新增 INVALID_REQUEST_BODY）
2. **所有 P2 已修复**（P2-1 测试方式合理、P2-2 computeAllStats 风险降级、P2-3 prompt/parser 定位明确）
3. **修改范围明确**：5 个文件，~500 行新增代码，零行删除重构
4. **所有已存在文件只追加不修改**：`types.ts` 末尾追加，`ai-client.ts` 末尾追加新函数
5. **复用已有基础设施**：`stats-calculator.ts`、`supabase-server.ts`、`device-id.ts` 完全不动
6. **Pattern 对齐**：review-parser 对标 task-parser，task-review.ts 对标 task-generation.ts，route.ts 对标 stats/route.ts 和 history/route.ts
7. **无新增依赖**：不装 npm 包，不建数据库表
8. **向后兼容**：不破坏任何现有 API 或组件

---

## 15. 给 Codex 的实现边界提醒

### 15.1 文件操作红线

```
✅ 允许新建：
   • src/prompts/task-review.ts
   • src/lib/review-parser.ts
   • src/app/api/task-groups/review/route.ts

✅ 允许追加（文件末尾，不动已有代码）：
   • src/lib/types.ts
   • src/lib/ai-client.ts

❌ 绝不允许修改：
   • src/lib/constants.ts（错误文案在 route.ts 内局部定义）
   • src/lib/stats-calculator.ts（完全复用，零改动）
   • src/lib/task-parser.ts
   • src/lib/supabase-server.ts
   • src/app/page.tsx
   • src/components/*（所有组件）
   • src/hooks/*（所有 hooks）
   • 任何其他 API Route
   • package.json
```

### 15.2 代码风格对齐

| 模块 | 对齐目标 | 要点 |
|------|---------|------|
| `types.ts` | 已有类型定义 | `type` + `interface` + `export`，文件末尾追加，空行分隔 |
| `ai-client.ts` | 已有 `callAIService` | 函数签名风格、`interface` 定义、JSDoc 注释 |
| `task-review.ts` | `src/prompts/task-generation.ts` | 导出常量 `SYSTEM_PROMPT` + 构建函数 `buildPrompt` |
| `review-parser.ts` | `src/lib/task-parser.ts` | `ParseError` 类、`cleanResponse` 函数、`parseAIResponse` 函数 |
| `route.ts` | `src/app/api/task-groups/stats/route.ts` | 错误处理模式：`errorResponse(code, status)` + `REVIEW_ERROR_MESSAGES` 局部映射 |

### 15.3 关键实现注意事项

1. **`callAIWithPrompts` 不动 `callAIService`**：两个函数独立，各自定义接口
2. **错误文案在 `route.ts` 内部**：使用 `const REVIEW_ERROR_MESSAGES: Record<ReviewErrorCode, string>`，不放入 `constants.ts`
3. **`INVALID_REQUEST_BODY` 覆盖两种场景**：`request.json()` 抛 SyntaxError + 解析结果不是 object/是 array
4. **`computeAllStats` 是同步函数**：不要加 `await`——Phase 13 stats-calculator 全部是同步的
5. **两步查询**：task_groups → 收集 ID → tasks。与 `history/route.ts` 一致
6. **AI 2 层 fallback 不对外暴露**：`callAIWithPrompts` 内部静默处理，route.ts 只关心最终结果
7. **`ParseReviewAIResponseError` 与 `ParseAIResponseError` 是不同的类**：名称区分，避免与 task-parser 混淆
8. **feedbackText 是唯一硬必填字段**：缺失 → `AI_RESPONSE_INVALID`。其他字段都有 fallback
9. **`checkRateLimit` 可选实现**：如果不实现，删除调用代码但保留错误码定义。如果实现，加 `// best-effort: not production-grade in Vercel/Serverless` 注释
10. **禁止修改 `stats-calculator.ts`**：`computeAllStats` 查询全部历史数据是已知的 P2 长期风险，Phase 14A 不在此文件做任何改动

### 15.4 不要做的事

```
❌ 不要给 computeAllStats 加 await
❌ 不要把 review 错误文案加到 constants.ts
❌ 不要在 ai-client.ts 中修改 callAIService
❌ 不要创建任何新的 npm 依赖
❌ 不要创建新的 Supabase 表
❌ 不要创建测试文件（test/review.test.ts）——除非用户明确要求
❌ 不要修改 TaskList / Header / StatsBar / HistoryPanel
❌ 不要实现前端 hook 或组件（Phase 14B 的事）
❌ 不要给 ai-client.ts 添加 json_schema 结构化输出逻辑
❌ 不要用 zod 校验——与 task-parser 模式一致（手写校验）
```

### 15.5 build 验证

实现完成后必须通过：

```
npm run lint    # 零错误
npm run build   # 成功
```

---

> **文档结束**
>
> **下一文档**：Phase 14B UI 执行方案（待 Phase 14A 实现并通过验收后制定）
>
> **关联文档**：
> - `docs/Architecture-Phase14.md` — Phase 14 完整架构（本文档的上游设计）
> - `docs/PRD-V2.0.md` — V2.0 产品规划
> - `docs/Roadmap-Phase12-15.md` — Phase 12-15 中期路线图
> - `docs/Architecture-Phase13.md` — Phase 13 统计架构（stats-calculator 来源）
