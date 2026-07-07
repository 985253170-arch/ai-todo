# V2.4：AI 辅助执行 MVP 执行方案

> **状态**：执行方案阶段，**不写代码，待 ChatGPT 审查通过后交给 Codex 实现**
> **依赖**：V2.3D ✅ 全部完成 · V2.4 架构方案 ✅（[Architecture-V2.4-AI-Assist.md](Architecture-V2.4-AI-Assist.md)）
> **定位**：基于 V2.4 架构方案，输出 Codex 可直接按步骤实施的详细执行方案
> **上一文档**：[Architecture-V2.4-AI-Assist.md](Architecture-V2.4-AI-Assist.md)
> **下一文档**：无（本执行方案实现后 → Claude Code Review → ChatGPT 最终把关 → 提交）
> **设计日期**：2026-07-06

---

## 目录

- [一、执行结论](#一执行结论)
- [二、真实文件结构核验结果](#二真实文件结构核验结果)
- [三、阶段边界](#三阶段边界)
- [四、允许修改 / 新增文件清单](#四允许修改--新增文件清单)
- [五、禁止修改文件清单](#五禁止修改文件清单)
- [六、类型定义实施步骤（types.ts）](#六类型定义实施步骤typests)
- [七、Prompt 实施步骤（task-assist.ts）](#七prompt-实施步骤task-assistts)
- [八、Parser 实施步骤（task-assist-parser.ts）](#八parser-实施步骤task-assist-parserts)
- [九、API Route 实施步骤（task-assist/route.ts）](#九api-route-实施步骤task-assistroutets)
- [十、Hook 实施步骤（useTaskAssist.ts）](#十hook-实施步骤usetaskassistts)
- [十一、组件实施步骤（TaskAssistPanel.tsx）](#十一组件实施步骤taskassistpaneltsx)
- [十二、组件集成实施步骤](#十二组件集成实施步骤)
- [十三、验收标准](#十三验收标准)
- [十四、风险矩阵](#十四风险矩阵)
- [十五、Codex 实现阶段拆分](#十五codex-实现阶段拆分)
- [十六、技术阻塞项](#十六技术阻塞项)

---

## 一、执行结论

| # | 问题 | 结论 |
|---|------|:---:|
| 1 | V2.4 是否可以实现 | ✅ **可以实现**。所有依赖（`callAIWithPrompts`、`getAuthenticatedUserId`、现有组件结构）已就绪 |
| 2 | 是否存在技术阻塞 | ⚠️ **无阻塞性阻塞**。有一个已知摩擦点：`callAIWithPrompts` 第一次尝试使用 `json_object` response_format，与 plain-text prompt 冲突，会 fallback 到第二次调用（无 format），增加约 1-2s 延迟。但因 `ai-client.ts` 禁止修改，MVP 可接受 |
| 3 | 是否需要新增 API Route | ✅ 需要。`POST /api/task-assist` |
| 4 | 是否需要新增数据库表/字段 | ❌ 不需要。零数据库变更 |
| 5 | 是否需要新增 npm 依赖 | ❌ 不需要 |
| 6 | 是否需要修改 Auth / V2.3 安全文件 | ❌ 不需要 |
| 7 | 是否需要修改 useTaskGroup | ❌ 不需要 |
| 8 | 是否持久化 AI 辅助结果 | ❌ 不持久化。仅组件状态，刷新即消失 |
| 9 | 是否做自由输入 / 多轮聊天 | ❌ 不做。V2.4 MVP 仅 4 个固定按钮 |
| 10 | 是否影响任务勾选逻辑 | ❌ 不影响。TaskItem 仅新增按钮 + 条件渲染面板，checkbox/onToggle 零修改 |

### 核心文件核验发现

| 发现 | 影响 | 处理 |
|------|------|------|
| `getAuthenticatedUserId()` **不接受参数**（架构方案中误写为 `getAuthenticatedUserId(request)`） | API Route 实现需修正 | 执行方案中已修正为正确的无参调用 |
| `callAIWithPrompts` 内部首次调用使用 `response_format: json_object` | 与 plain-text prompt 冲突，首次调用可能失败后 fallback | P2 风险项，MVP 可接受，Parser 需处理可能的 JSON-wrapped 输出 |
| `TaskItem.tsx` 真实存在 | 架构方案假设正确 | 按架构方案修改 |
| `MainWorkspace.tsx` 真实存在，`taskGroup.goal` 可用 | 架构方案假设正确 | `activeAssistTaskId` 放在 MainWorkspace |

---

## 二、真实文件结构核验结果

### 2.1 核验通过的文件

| 文件 | 状态 | 行数 | 关键特征 |
|------|:---:|:---:|------|
| `src/components/TaskItem.tsx` | ✅ 存在 | 30 | `TaskItem({ task, onToggle })` — checkbox + title span |
| `src/components/MainWorkspace.tsx` | ✅ 存在 | 196 | `MainWorkspace()` — 使用 `useTaskGroup()` 获取 `taskGroup`，其中包含 `taskGroup.goal` |
| `src/components/TaskList.tsx` | ✅ 存在 | 79 | 当前透传给 TaskItem 的 props：`task` + `onToggle` |
| `src/app/app/page.tsx` | ✅ 存在 | 23 | 路由守卫 + 渲染 `<MainWorkspace />` |
| `src/hooks/useTaskGroup.ts` | ✅ 存在 | 459 | 14 个 handlers，不修改 |
| `src/hooks/useTaskReview.ts` | ✅ 存在 | 151 | 参考模式：`useRef` 防重 + 错误码映射 |
| `src/lib/ai-client.ts` | ✅ 存在 | 171 | `callAIService` + `callAIWithPrompts` 两个导出函数 |
| `src/lib/types.ts` | ✅ 存在 | 222 | 已有 `ReviewErrorCode`、`ReviewResponse` 等模式可参考 |
| `src/lib/supabase-server.ts` | ✅ 存在 | 64 | `getAuthenticatedUserId()` **无参数** |
| `src/prompts/task-generation.ts` | ✅ 存在 | 96 | `SYSTEM_PROMPT` + `buildPrompt(goal, stats?, adjustment?)` |
| `src/prompts/task-review.ts` | ✅ 存在 | 77 | `REVIEW_SYSTEM_PROMPT` + `buildReviewUserPrompt(input)` |
| `src/lib/task-parser.ts` | ✅ 存在 | 72 | `parseAIResponse(rawText)` — JSON 解析 + code block 清理 |
| `src/lib/review-parser.ts` | ✅ 存在 | 118 | `parseReviewAIResponse(rawText)` — JSON 解析 + 字段校验 |
| `src/app/api/generate-tasks/route.ts` | ✅ 存在 | 157 | 认证模式：`await getAuthenticatedUserId()`（无参） |
| `src/app/api/task-groups/review/route.ts` | ✅ 存在 | 315 | 最佳参考：使用 `callAIWithPrompts` + in-memory rate limit |

### 2.2 核验结论

所有架构方案中假设的文件均真实存在。架构方案中的组件树（MainWorkspace → TaskList → TaskItem）准确无误。唯一需要修正的是 `getAuthenticatedUserId()` 的调用方式（无参，不是 `getAuthenticatedUserId(request)`）。

---

## 三、阶段边界

### V2.4 MVP 范围（本次实现）

```
4 个固定辅助按钮 × 每个 TaskItem
    ├── 怎么开始 (how_to_start)
    ├── 拆小一点 (break_down)
    ├── 给我 5 分钟版本 (five_minute)
    └── 我卡住了 (im_stuck)
```

### V2.4 明确不进入

| # | 不做 | 留给 |
|---|------|:---:|
| 1 | 自由文本输入 | V2.5 |
| 2 | 多轮任务聊天 | V2.5 或后续评估 |
| 3 | 动态快捷建议（根据任务自动推荐按钮） | V2.5 |
| 4 | AI 辅助结果持久化 | V2.6 |
| 5 | 历史记录中的 AI 辅助行为 | V2.6 |
| 6 | Streaming (SSE) | V2.5 评估 |
| 7 | 跨任务上下文 | 后续评估 |
| 8 | 数据库变更 | 后续单独评审 |
| 9 | UI 美化 | V3.0 |
| 10 | 页面重构 | V3.0 |

---

## 四、允许修改 / 新增文件清单

### 4.1 新增文件（5 个）

| # | 文件 | 预估行数 | 说明 |
|:--:|------|:--:|------|
| 1 | `src/lib/task-assist-parser.ts` | ~40 | AI 响应纯文本解析 + 安全校验 |
| 2 | `src/prompts/task-assist.ts` | ~70 | 4 种操作的 System/User Prompt |
| 3 | `src/app/api/task-assist/route.ts` | ~60 | POST API Route（session-aware） |
| 4 | `src/hooks/useTaskAssist.ts` | ~80 | AI 辅助状态管理 hook |
| 5 | `src/components/TaskAssistPanel.tsx` | ~160 | AI 辅助面板 UI 组件 |

### 4.2 修改文件（4 个）

| # | 文件 | 预估新增行数 | 说明 |
|:--:|------|:--:|------|
| 1 | `src/lib/types.ts` | +35 | 新增 `AssistActionType`、`AssistErrorCode`、`AssistResponse` 等类型 |
| 2 | `src/components/TaskItem.tsx` | +15 | 新增 `isAssistOpen`、`onToggleAssist`、`goal` props + "AI 帮我一下"按钮 + 条件渲染 TaskAssistPanel |
| 3 | `src/components/TaskList.tsx` | +8 | 新增 `activeAssistTaskId`、`onToggleAssist`、`goal` props + 透传给 TaskItem |
| 4 | `src/components/MainWorkspace.tsx` | +10 | 新增 `activeAssistTaskId` state + 传递给 TaskList |

**预计总改动量**：~478 行（5 个新文件 ~410 行 + 4 个修改文件 ~68 行）。

---

## 五、禁止修改文件清单

以下文件**严禁任何修改**：

| # | 文件 | 原因 |
|:--:|------|------|
| 1 | `.env.local` | 环境变量，Codex 不操作 |
| 2 | `package.json` | 无新依赖 |
| 3 | `package-lock.json` | 无新依赖 |
| 4 | 数据库 schema / migration | 零数据库变更 |
| 5 | `src/hooks/useTaskGroup.ts` | 核心任务状态管理，459 行 |
| 6 | `src/hooks/useAuth.ts` | Auth hook |
| 7 | `src/hooks/useTaskReview.ts` | 复盘 hook |
| 8 | `src/hooks/useTaskStats.ts` | 统计 hook |
| 9 | `src/hooks/useTaskHistory.ts` | 历史 hook |
| 10 | `src/lib/ai-client.ts` | AI 底层调用（`callAIWithPrompts` 已满足需求） |
| 11 | `src/lib/task-parser.ts` | 任务解析器 |
| 12 | `src/lib/review-parser.ts` | 复盘解析器 |
| 13 | `src/lib/supabase-client.ts` | 客户端 Supabase |
| 14 | `src/lib/supabase-server.ts` | 服务端 Supabase + Auth |
| 15 | `src/lib/constants.ts` | 常量文件 |
| 16 | `src/lib/auth-errors.ts` | Auth 错误脱敏 |
| 17 | `src/app/api/generate-tasks/route.ts` | 核心生成 API |
| 18 | `src/app/api/task-group/**` | 所有 task-group API |
| 19 | `src/app/api/task-groups/**` | 所有 task-groups API |
| 20 | `src/app/auth/callback/route.ts` | Auth 回调 |
| 21 | `src/app/login/page.tsx` | 登录页 |
| 22 | `src/components/LoginPageContent.tsx` | 登录表单 |
| 23 | `src/components/TurnstileWidget.tsx` | Turnstile |
| 24 | `src/app/forgot-password/page.tsx` | 忘记密码 |
| 25 | `src/app/reset-password/page.tsx` | 重置密码 |
| 26 | `src/components/GoalInput.tsx` | 目标输入 |
| 27 | `src/components/TaskReviewPanel.tsx` | 复盘面板 |
| 28 | `src/components/StatsBar.tsx` | 统计栏 |
| 29 | `src/components/HistoryPanel.tsx` | 历史面板 |
| 30 | `src/prompts/task-generation.ts` | 任务生成 prompt |
| 31 | `src/prompts/task-review.ts` | 复盘 prompt |
| 32 | `src/app/app/page.tsx` | `/app` 入口（路由守卫），不改 |
| 33 | V2.3 相关全部文件 | 安全增强文件 |

---

## 六、类型定义实施步骤（types.ts）

### 6.1 文件：`src/lib/types.ts`

**操作**：在文件末尾追加（不改动现有任何类型定义）

### 6.2 追加内容

```typescript
// V2.4 — AI 辅助类型

export type AssistActionType =
  | "how_to_start"
  | "break_down"
  | "five_minute"
  | "im_stuck";

export type AssistErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_REQUEST_BODY"
  | "INVALID_ACTION_TYPE"
  | "AI_ASSIST_FAILED"
  | "AI_RESPONSE_INVALID"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface AssistSuccessResponse {
  success: true;
  data: {
    result: string;
  };
}

export interface AssistErrorResponse {
  success: false;
  error: {
    code: AssistErrorCode;
    message: string;
  };
}

export type AssistResponse = AssistSuccessResponse | AssistErrorResponse;
```

### 6.3 实施约束

1. 追加在文件末尾，`ReviewResponse` 类型定义之后
2. 不修改现有 `Task`、`TaskGroup`、`ReviewData`、`ReviewErrorCode` 等任何已有类型
3. 不重构已有类型结构
4. 不影响旧 API 的类型推断

---

## 七、Prompt 实施步骤（task-assist.ts）

### 7.1 文件：`src/prompts/task-assist.ts`（新增）

### 7.2 完整内容规范

#### 7.2.1 类型导入

从 `types.ts` 导入 `AssistActionType`（或者在本文件内重复定义，推荐导入以保持单一真相源）：

```typescript
import type { AssistActionType } from "@/lib/types";
```

#### 7.2.2 ASSIST_SYSTEM_PROMPT

```typescript
export const ASSIST_SYSTEM_PROMPT = `你是一个务实的 AI 行动教练。你的职责是帮助用户推进他们卡住的任务。

核心规则：
1. 只返回纯文本，不返回 Markdown，不返回 JSON，不返回代码块。
2. 输出必须简短（80-150 字）。
3. 输出必须具体、可执行——用户读完就能立刻开始做。
4. 不空泛鼓励，不说鸡汤（如"你一定可以的""相信自己"）。
5. 不替用户完成完整任务，只给出下一步或小步骤。
6. 不超出当前任务范围。
7. 不要建议用户安装软件、购买工具、访问外部网站，除非任务本身明确需要。
8. 不要给 10 步以上的内容。
9. 不要使用复杂术语。

输出格式取决于用户选择的操作类型，详见具体指令。`;
```

#### 7.2.3 buildAssistUserPrompt

```typescript
interface AssistPromptInput {
  taskTitle: string;
  goal: string;
  actionType: AssistActionType;
}

const ACTION_PROMPTS: Record<AssistActionType, string> = {
  how_to_start: `用户不知道如何开始这个任务。请给出 1-3 个非常小的起步动作，让用户能够在 5 分钟内开始。
输出格式：
你现在只需要做这一步：

1. ...（具体动作）
2. ...（具体动作）
3. ...（具体动作）`,

  break_down: `用户觉得这个任务太大，不知道从哪开始。请把任务拆成 3-5 个更小、更具体的步骤。
输出格式：
把这个任务拆成更小的步骤：

1. ...
2. ...
3. ...
...`,

  five_minute: `用户现在时间或精力有限，需要一个 5 分钟内能完成的极简版本。
输出格式：
5 分钟版本：

...（1-2 句话描述极简版本）

具体做法：
1. ...`,

  im_stuck: `用户卡住了，不确定哪里出问题。请简短分析可能的卡点，然后给出 1 个下一步建议。可以鼓励，但不要鸡汤。
输出格式：
你可能卡在：...（1 句话分析）

下一步：...（1 个具体建议）`,
};

export function buildAssistUserPrompt(input: AssistPromptInput): string {
  const actionPrompt = ACTION_PROMPTS[input.actionType];

  return [
    `用户的目标：${input.goal}`,
    `用户当前的任务：${input.taskTitle}`,
    "",
    actionPrompt,
  ].join("\n");
}
```

### 7.3 实施约束

1. 不修改 `task-generation.ts` 和 `task-review.ts`
2. `buildAssistUserPrompt` 是纯函数，不访问环境变量、不访问数据库
3. 所有文案硬编码在 prompt 中，不允许动态拼接不可信内容
4. `goal` 为空时显示"未指定目标"

---

## 八、Parser 实施步骤（task-assist-parser.ts）

### 8.1 文件：`src/lib/task-assist-parser.ts`（新增）

### 8.2 完整实现规范

```typescript
export class ParseAssistAIResponseError extends Error {
  constructor(message = "Failed to parse assist AI response.") {
    super(message);
    this.name = "ParseAssistAIResponseError";
  }
}

const MAX_RESULT_LENGTH = 500;

/**
 * 解析 AI 辅助响应。
 *
 * 注意：因为 callAIWithPrompts 内部首次尝试使用 response_format: json_object，
 * AI 可能在纯文本外层包裹 JSON（如 {"text": "..."} 或直接字符串）。
 * 本 parser 需要处理两种格式。
 */
export function parseAssistAIResponse(rawText: string): string {
  // 1. Trim
  let text = rawText.trim();

  if (!text) {
    throw new ParseAssistAIResponseError("AI response is empty.");
  }

  // 2. 尝试去除代码块标记
  if (text.startsWith("```")) {
    text = text
      .replace(/^```(?:json|text)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  // 3. 尝试 JSON 解析（处理 callAIWithPrompts 的 json_object 模式）
  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>;
        // 尝试常见字段名
        const innerText =
          obj.text ?? obj.result ?? obj.content ?? obj.response ?? obj.message;
        if (typeof innerText === "string" && innerText.trim()) {
          text = innerText.trim();
        }
      }
    } catch {
      // JSON 解析失败，保留原始文本
    }
  }

  // 4. 去掉明显 Markdown 标题符号（# ## ###）
  text = text.replace(/^#{1,6}\s+/gm, "");

  // 5. 去掉粗体/斜体标记（** __ * _）
  text = text.replace(/\*{1,3}([^*]+?)\*{1,3}/g, "$1");
  text = text.replace(/_{1,3}([^_]+?)_{1,3}/g, "$1");

  // 6. Trim
  text = text.trim();

  // 7. 空内容校验
  if (!text) {
    throw new ParseAssistAIResponseError("AI response is empty after cleaning.");
  }

  // 8. 截断超长内容
  if (text.length > MAX_RESULT_LENGTH) {
    text = text.slice(0, MAX_RESULT_LENGTH) + "…";
  }

  return text;
}
```

### 8.3 实施约束

1. 不做复杂 JSON schema 校验（与 `task-parser.ts`、`review-parser.ts` 完全不同）
2. 优先处理纯文本，JSON 解析仅作为 fallback 兼容层
3. 最大输出长度 500 字（截断加 `…`）
4. 不引入新依赖
5. 错误类型继承自 `Error`（与 `ParseAIResponseError`、`ParseReviewAIResponseError` 模式一致）

---

## 九、API Route 实施步骤（task-assist/route.ts）

### 9.1 文件：`src/app/api/task-assist/route.ts`（新增）

### 9.2 目录结构

```
src/app/api/task-assist/
  └── route.ts   ← 新增
```

### 9.3 请求规范

```
POST /api/task-assist
Content-Type: application/json

{
  "taskTitle": "写一页项目介绍",        // 必填，string，trim 后非空
  "goal": "准备项目路演材料",           // 可选，string，可为空字符串
  "actionType": "how_to_start"         // 必填，4 个枚举值之一
}
```

### 9.4 响应规范

**成功**（200）：
```json
{
  "success": true,
  "data": {
    "result": "你现在只需要做这一步：\n\n1. 打开一个空白文档..."
  }
}
```

**失败**：
| HTTP Status | error.code | 触发条件 |
|:--:|------|------|
| 401 | `UNAUTHORIZED` | 未登录（`getAuthenticatedUserId()` 返回 null） |
| 400 | `INVALID_REQUEST_BODY` | 请求体不是合法 JSON、`taskTitle` 缺失或 trim 后为空 |
| 400 | `INVALID_ACTION_TYPE` | `actionType` 不在 4 个枚举值中 |
| 500 | `AI_ASSIST_FAILED` | `callAIWithPrompts` 抛异常、AI API Key 未配置 |
| 500 | `AI_RESPONSE_INVALID` | `parseAssistAIResponse` 抛 `ParseAssistAIResponseError` |
| 429 | `RATE_LIMITED` | 同一用户 60s 内超过 10 次请求 |
| 500 | `INTERNAL_ERROR` | 其他未预期的服务端错误 |

### 9.5 完整实现规范

```typescript
import { NextRequest, NextResponse } from "next/server";
import { callAIWithPrompts } from "@/lib/ai-client";
import { getAuthenticatedUserId } from "@/lib/supabase-server";
import { parseAssistAIResponse, ParseAssistAIResponseError } from "@/lib/task-assist-parser";
import { ASSIST_SYSTEM_PROMPT, buildAssistUserPrompt } from "@/prompts/task-assist";
import type { AssistActionType, AssistErrorCode, AssistResponse } from "@/lib/types";

// ---- 常量 ----

const VALID_ACTION_TYPES: Set<string> = new Set([
  "how_to_start",
  "break_down",
  "five_minute",
  "im_stuck",
]);

const MAX_TASK_TITLE_LENGTH = 200;
const MAX_GOAL_LENGTH = 200;

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

// ---- 错误消息 ----

const ERROR_MESSAGES: Record<AssistErrorCode, string> = {
  UNAUTHORIZED: "请先登录。",
  INVALID_REQUEST_BODY: "请求参数错误。",
  INVALID_ACTION_TYPE: "无效的辅助类型。",
  AI_ASSIST_FAILED: "AI 辅助生成失败，请稍后重试。",
  AI_RESPONSE_INVALID: "AI 返回内容异常，请重试。",
  RATE_LIMITED: "请求过于频繁，请稍后再试。",
  INTERNAL_ERROR: "服务异常，请稍后重试。",
};

// ---- 工具函数 ----

function errorResponse(code: AssistErrorCode, status: number) {
  const body: AssistResponse = {
    success: false,
    error: { code, message: ERROR_MESSAGES[code] },
  };
  return NextResponse.json(body, { status });
}

// ---- 限速（in-memory，serverless 不持久） ----

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(scope: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(scope);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(scope, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

// ---- POST handler ----

export async function POST(request: NextRequest) {
  // ===== 1. 认证 =====
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return errorResponse("UNAUTHORIZED", 401);
  }

  // ===== 2. 限速 =====
  if (!checkRateLimit(`user:${userId}`)) {
    return errorResponse("RATE_LIMITED", 429);
  }

  // ===== 3. 解析请求体 =====
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorResponse("INVALID_REQUEST_BODY", 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return errorResponse("INVALID_REQUEST_BODY", 400);
  }

  // ===== 4. 校验 taskTitle =====
  const taskTitle = typeof body.taskTitle === "string" ? body.taskTitle.trim() : "";
  if (!taskTitle) {
    return errorResponse("INVALID_REQUEST_BODY", 400);
  }
  if (taskTitle.length > MAX_TASK_TITLE_LENGTH) {
    return errorResponse("INVALID_REQUEST_BODY", 400);
  }

  // ===== 5. 校验 actionType =====
  const actionType = typeof body.actionType === "string" ? body.actionType : "";
  if (!VALID_ACTION_TYPES.has(actionType)) {
    return errorResponse("INVALID_ACTION_TYPE", 400);
  }

  // ===== 6. 处理 goal（可选） =====
  const goal = typeof body.goal === "string" ? body.goal.trim() : "";
  const safeGoal = goal.length > MAX_GOAL_LENGTH ? goal.slice(0, MAX_GOAL_LENGTH) : goal;

  // ===== 7. 构造 prompt =====
  const systemPrompt = ASSIST_SYSTEM_PROMPT;
  const userPrompt = buildAssistUserPrompt({
    taskTitle,
    goal: safeGoal,
    actionType: actionType as AssistActionType,
  });

  // ===== 8. 检查 API Key =====
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    return errorResponse("AI_ASSIST_FAILED", 500);
  }

  // ===== 9. 调用 AI =====
  let rawContent: string;
  try {
    rawContent = await callAIWithPrompts({
      apiKey,
      baseUrl: process.env.AI_API_BASE_URL,
      model: process.env.AI_MODEL,
      systemPrompt,
      userPrompt,
      maxTokens: 300,
      temperature: 0.4,
      timeoutMs: 30000,
    });
  } catch {
    return errorResponse("AI_ASSIST_FAILED", 500);
  }

  // ===== 10. 解析 =====
  let result: string;
  try {
    result = parseAssistAIResponse(rawContent);
  } catch (error) {
    if (error instanceof ParseAssistAIResponseError) {
      return errorResponse("AI_RESPONSE_INVALID", 500);
    }
    return errorResponse("AI_RESPONSE_INVALID", 500);
  }

  // ===== 11. 返回 =====
  const response: AssistResponse = {
    success: true,
    data: { result },
  };
  return NextResponse.json(response);
}
```

### 9.6 实施约束

1. **认证**：使用 `getAuthenticatedUserId()` **无参数**调用（不是 `getAuthenticatedUserId(request)`）
2. **API Key**：从 `process.env.AI_API_KEY` 读取（与 `generate-tasks/route.ts` 一致）
3. **环境变量**：复用 `AI_API_KEY`、`AI_API_BASE_URL`、`AI_MODEL`（不新增）
4. **不调用 Turnstile**：已登录用户由 session JWT 保护
5. **不传 prompt 给前端**：`systemPrompt` 和 `userPrompt` 完全在服务端构造
6. **不暴露 API Key**：Key 仅在服务端 `process.env` 中使用
7. **不访问数据库**：不需要任务数据
8. **限速**：复用 `task-groups/review/route.ts` 的 in-memory rate limit 模式
9. **错误响应格式**：与现有 API 统一 `{ success: false, error: { code, message } }`
10. **不使用 `getAuthenticatedUserId(request)`**（真实函数签名无参数）

### 9.7 与现有 API Route 的对齐检查

| 检查项 | generate-tasks | task-groups/review | task-assist (V2.4) |
|------|:---:|:---:|:---:|
| 认证方式 | `getAuthenticatedUserId()` | `getAuthenticatedUserId()` | ✅ `getAuthenticatedUserId()` |
| AI 调用 | `callAIService` | `callAIWithPrompts` | ✅ `callAIWithPrompts` |
| 环境变量 Key | `AI_API_KEY` | `AI_API_KEY` | ✅ `AI_API_KEY` |
| 限速 | ❌ 无限速 | ✅ in-memory map | ✅ in-memory map |
| 响应格式 | `{success, data/error}` | `{success, data/error}` | ✅ `{success, data/error}` |

---

## 十、Hook 实施步骤（useTaskAssist.ts）

### 10.1 文件：`src/hooks/useTaskAssist.ts`（新增）

### 10.2 完整接口定义

```typescript
// 状态类型
type AssistStatus = "idle" | "loading" | "result" | "error";

// Hook options
interface UseTaskAssistOptions {
  taskId: string;
  taskTitle: string;
  goal: string;
}

// Hook return
interface UseTaskAssistReturn {
  status: AssistStatus;
  result: string | null;
  error: string | null;
  activeActionType: AssistActionType | null;
  fetchAssist: (actionType: AssistActionType) => Promise<void>;
  reset: () => void;
}
```

### 10.3 完整实现规范

```typescript
"use client";

import { useCallback, useRef, useState } from "react";
import type { AssistActionType, AssistResponse } from "@/lib/types";
```

**状态管理**：
- `status`：`"idle"` | `"loading"` | `"result"` | `"error"`
- `result`：`string | null`
- `error`：`string | null`
- `activeActionType`：`AssistActionType | null`（当前选中按钮高亮用）

**核心函数**：

```typescript
// 默认错误消息（安全，不暴露原始异常）
const DEFAULT_ERROR = "AI 辅助请求失败，请稍后重试。";
const NETWORK_ERROR = "网络连接失败，请检查网络后重试。";
```

**fetchAssist(actionType)**：
1. 如果 `isFetchingRef.current === true`，直接 return（防重复点击）
2. 设置 `isFetchingRef.current = true`
3. 设置 `status = "loading"`、`activeActionType = actionType`、清空 `error`
4. `fetch("/api/task-assist", { method: "POST", body: JSON.stringify({ taskTitle, goal, actionType }) })`
5. 解析 `AssistResponse`
6. 成功：设置 `result`、`status = "result"`
7. 失败：设置 `error = error.message || DEFAULT_ERROR`、`status = "error"`
8. catch（网络错误）：设置 `error = NETWORK_ERROR`、`status = "error"`
9. finally：`isFetchingRef.current = false`

**reset()**：
- 设置 `status = "idle"`、`result = null`、`error = null`、`activeActionType = null`

**参考模式**：`useTaskReview.ts`（151 行）的 `useRef` 防重 + `useCallback` + 错误处理模式。

### 10.4 实施约束

1. 不持久化（不写 localStorage / sessionStorage / 数据库）
2. 不调用 AI 客户端（全部经过 `/api/task-assist`）
3. 防重复点击（`useRef<boolean>` 标志）
4. 错误展示中文安全消息（不暴露原始异常）
5. 独立 hook，不依赖 `useTaskGroup`、`useTaskReview` 等
6. `"use client"` 指令（客户端 hook）

---

## 十一、组件实施步骤（TaskAssistPanel.tsx）

### 11.1 文件：`src/components/TaskAssistPanel.tsx`（新增）

### 11.2 Props 接口

```typescript
interface TaskAssistPanelProps {
  taskId: string;
  taskTitle: string;
  goal: string;
  onClose: () => void;
}
```

### 11.3 状态机

```
ready → loading → result → (换一个/切换按钮) → loading → result
  │                 │
  │                 └── error → (重试) → loading
  └── 关闭面板 → idle
```

### 11.4 UI 布局

```
┌─────────────────────────────────────────┐
│  🤖 AI 辅助                         [✕] │  ← 标题行
│                                         │
│  ┌─────────┐ ┌──────────┐               │
│  │ 怎么开始  │ │ 拆小一点  │               │  ← 按钮行 1（2×2 网格）
│  └─────────┘ └──────────┘               │
│  ┌──────────┐ ┌─────────┐               │
│  │ 5分钟版本 │ │ 我卡住了 │               │  ← 按钮行 2
│  └──────────┘ └─────────┘               │
│                                         │
│  ── 结果区域 ──                          │
│  （whitespace-pre-line 保留换行）         │
│                                         │
│  [📋 复制]  [🔄 换一个]                  │  ← 操作按钮
└─────────────────────────────────────────┘
```

### 11.5 按钮定义

```typescript
const ASSIST_BUTTONS: Array<{
  actionType: AssistActionType;
  label: string;
  shortDesc: string;
}> = [
  { actionType: "how_to_start", label: "怎么开始", shortDesc: "找到第一步" },
  { actionType: "break_down", label: "拆小一点", shortDesc: "拆成更小步骤" },
  { actionType: "five_minute", label: "5 分钟版本", shortDesc: "极简可执行版" },
  { actionType: "im_stuck", label: "我卡住了", shortDesc: "分析卡点" },
];
```

### 11.6 各状态渲染

| 状态 | UI |
|------|-----|
| `ready`（idle） | 4 个按钮全部可点击，无结果区域 |
| `loading` | 当前选中按钮 disabled + spinner 动画 + 其余按钮 disabled |
| `result` | 结果文本（`whitespace-pre-line`）+ 4 个按钮可切换 + [📋 复制] [🔄 换一个] |
| `error` | 错误消息 + [🔄 重试] + 4 个按钮可用 |

### 11.7 关键交互

1. **点击按钮**：调用 `fetchAssist(actionType)`，当前按钮高亮（`activeActionType`）
2. **"换一个"**：使用当前 `activeActionType` 重新调用 `fetchAssist`
3. **切换按钮**：使用新的 `actionType` 调用 `fetchAssist`
4. **"复制"**：`navigator.clipboard.writeText(result)`，复制成功后临时显示"已复制"
5. **关闭**：调用 `onClose()` → `reset()`
6. **重试**：使用当前 `activeActionType` 重新调用 `fetchAssist`

### 11.8 移动端适配

- 按钮布局：`grid grid-cols-2 gap-2`（2×2 网格）
- 触控区域：按钮 `min-h-11`（≥44px）
- 面板全宽：`w-full`
- 间距：与 TaskItem 视觉一致（圆角 `rounded-xl`，边框 `border-slate-200`）

### 11.9 参考模式

参考 `TaskReviewPanel.tsx`（100 行）的状态机渲染模式：
- `ready` → 按钮组（类似 review 的"生成今日复盘"按钮）
- `loading` → disabled 按钮 + spinner（类似 review 的"正在生成复盘…"）
- `error` → 错误消息 + 重试按钮（类似 review 的 amber 错误面板）
- `result` → 内容展示（类似 review 的 `whitespace-pre-line` 文本）

### 11.10 实施约束

1. 不做复杂 UI 美化（留给 V3.0）
2. 不影响任务勾选（不渲染 checkbox）
3. 不自动关闭
4. 结果文本使用 `whitespace-pre-line`（保留 AI 输出换行）
5. 复制按钮失败时不报错（静默失败）
6. 按钮使用 Tailwind 类，不引入自定义 CSS

---

## 十二、组件集成实施步骤

### 12.1 集成链路

```
MainWorkspace（新增 activeAssistTaskId state）
  └── TaskList（透传 activeAssistTaskId, onToggleAssist, goal）
        └── TaskItem（新增 isAssistOpen, onToggleAssist, goal props）
              └── TaskAssistPanel（条件渲染，isAssistOpen === true）
```

### 12.2 TaskItem.tsx 修改

**文件**：`src/components/TaskItem.tsx`（当前 30 行）

**当前代码**：
```typescript
import type { Task } from "@/lib/types";

interface TaskItemProps {
  task: Task;
  onToggle: (taskId: string) => void;
}

export function TaskItem({ task, onToggle }: TaskItemProps) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:bg-indigo-50/40">
      <input ... />
      <span ...>{task.title}</span>
    </div>
  );
}
```

**修改后**：
```typescript
import type { Task } from "@/lib/types";
import { TaskAssistPanel } from "@/components/TaskAssistPanel";

interface TaskItemProps {
  task: Task;
  onToggle: (taskId: string) => void;
  // V2.4 新增
  isAssistOpen: boolean;
  onToggleAssist: (taskId: string) => void;
  goal: string;
}

export function TaskItem({ task, onToggle, isAssistOpen, onToggleAssist, goal }: TaskItemProps) {
  return (
    <div>
      {/* 原有任务卡片 — 不变 */}
      <div className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:bg-indigo-50/40">
        <input
          aria-label={task.title}
          checked={task.completed}
          className="mt-0.5 h-6 w-6 shrink-0 cursor-pointer rounded border-slate-300 accent-indigo-600 sm:h-5 sm:w-5"
          onChange={() => onToggle(task.id)}
          type="checkbox"
        />
        <span className={task.completed ? "min-w-0 break-words text-sm leading-6 text-slate-400 line-through" : "min-w-0 break-words text-sm leading-6 text-slate-700"}>
          {task.title}
        </span>
        {/* V2.4 新增：AI 帮我一下按钮 */}
        <button
          className="ml-auto shrink-0 rounded-full px-3 py-1 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50"
          onClick={() => onToggleAssist(task.id)}
          type="button"
        >
          AI 帮我一下
        </button>
      </div>
      {/* V2.4 新增：条件渲染 AI 辅助面板 */}
      {isAssistOpen ? (
        <div className="mt-2">
          <TaskAssistPanel
            goal={goal}
            onClose={() => onToggleAssist(task.id)}
            taskId={task.id}
            taskTitle={task.title}
          />
        </div>
      ) : null}
    </div>
  );
}
```

**修改要点**：
1. 原有 `<div>` 外层包裹一个新的 `<div>`（因为面板在下方）
2. 原有 checkbox + title **不做任何修改**
3. 新增"AI 帮我一下"按钮在任务标题右侧（`ml-auto` 推到右边）
4. 按钮样式：轻量（文字链接风格，不抢视觉重点）
5. 面板以 `mt-2` 间距渲染在任务卡片下方

### 12.3 TaskList.tsx 修改

**文件**：`src/components/TaskList.tsx`（当前 79 行）

**修改内容**：

1. `TaskListProps` 新增 3 个属性：
```typescript
interface TaskListProps {
  // ... 现有 10 个 props 不变
  // V2.4 新增
  activeAssistTaskId: string | null;
  onToggleAssist: (taskId: string) => void;
  goal: string;
}
```

2. 函数参数解构新增：
```typescript
export function TaskList({
  tasks, completedCount, totalCount, isAllCompleted,
  regenerateError, onToggleTask, onClearTasks, onRegenerate,
  // V2.4 新增
  activeAssistTaskId, onToggleAssist, goal,
}: TaskListProps) {
```

3. `TaskItem` 渲染新增 3 个 props：
```typescript
<TaskItem
  key={task.id}
  onToggle={onToggleTask}
  task={task}
  // V2.4 新增
  isAssistOpen={activeAssistTaskId === task.id}
  onToggleAssist={onToggleAssist}
  goal={goal}
/>
```

**仅此三处修改，不改 TaskList 的任何其他逻辑。**

### 12.4 MainWorkspace.tsx 修改

**文件**：`src/components/MainWorkspace.tsx`（当前 196 行）

**修改内容**：

1. 新增 import：
```typescript
import { useState } from "react";
```

2. 在 `useTaskGroup()` 解构后新增 state：
```typescript
// V2.4 — AI 辅助面板状态
const [activeAssistTaskId, setActiveAssistTaskId] = useState<string | null>(null);
```

3. `<TaskList>` 渲染新增 3 个 props：
```typescript
<TaskList
  completedCount={completedCount}
  isAllCompleted={isAllCompleted}
  onClearTasks={handleClearTasksWithStats}
  onRegenerate={handleRegenerateWithStats}
  onToggleTask={handleToggleTaskWithStats}
  regenerateError={regenerateError}
  tasks={tasks}
  totalCount={totalCount}
  // V2.4 新增
  activeAssistTaskId={activeAssistTaskId}
  onToggleAssist={(taskId) => {
    setActiveAssistTaskId(prev => prev === taskId ? null : taskId);
  }}
  goal={taskGroup?.goal ?? ""}
/>
```

**切换逻辑**：再次点击同一任务 → 关闭面板（`prev === taskId ? null : taskId`）。点击不同任务 → 关闭旧面板 + 打开新面板（因为 `setActiveAssistTaskId` 直接替换为新 taskId）。

**不改动**：
- 路由守卫逻辑（在 `app/page.tsx` 中，不动）
- `useTaskGroup`、`useTaskReview`、`useTaskStats`、`useTaskHistory` 的任何调用
- 不修改 Header、HeroSection、GoalInput、StatsBar、NewDayPrompt、LoadingState、HistoryPanel 等任何其他组件

---

## 十三、验收标准

### 13.1 功能验收（F1-F18）

| # | 验收项 | 操作 | 预期结果 |
|---|--------|------|------|
| **F1** | "AI 帮我一下"按钮可见 | 有任务时查看 TaskItem | 每个 TaskItem 右侧显示"AI 帮我一下"按钮 |
| **F2** | 面板展开 + 4 个按钮 | 点击"AI 帮我一下" | TaskAssistPanel 展开，显示 4 个辅助按钮（2×2 布局） |
| **F3** | 面板关闭 | 再次点击同一任务的"AI 帮我一下" | 面板关闭，结果清除 |
| **F4** | 单一面板策略 | 打开任务 A 面板 → 点击任务 B 的"AI 帮我一下" | A 面板关闭，B 面板打开 |
| **F5** | "怎么开始"返回结果 | 点击"怎么开始" | AI 返回 1-3 个起步动作，纯文本格式 |
| **F6** | "拆小一点"返回结果 | 点击"拆小一点" | AI 返回 3-5 个小步骤 |
| **F7** | "5 分钟版本"返回结果 | 点击"5 分钟版本" | AI 返回极简可执行版本 |
| **F8** | "我卡住了"返回结果 | 点击"我卡住了" | AI 返回卡点分析 + 下一步建议 |
| **F9** | 结果可复制 | 点击"📋 复制" | 结果文本复制到剪贴板 |
| **F10** | "换一个"重新生成 | 点击"🔄 换一个" | 使用相同 actionType 重新请求，返回新结果 |
| **F11** | 切换按钮新请求 | 在结果展示时点击不同按钮 | 使用新 actionType 请求，loading → 新结果 |
| **F12** | 加载状态 | 点击按钮后等待 AI 返回 | 显示加载动画，当前按钮 disabled |
| **F13** | 错误状态 + 重试 | AI 请求失败 | 显示中文错误提示 + "🔄 重试"按钮 |
| **F14** | 未登录不可访问 | 未登录访问 `/app` | 路由守卫跳转 `/login`（不变） |
| **F15** | API 认证保护 | 不登录直接 curl `/api/task-assist` | 返回 401 `UNAUTHORIZED` |
| **F16** | API Key 不泄露 | 浏览器 Network 面板审查 | 请求/响应中不出现 `AI_API_KEY` / `DEEPSEEK_API_KEY` |
| **F17** | 不持久化 | 展开面板获得结果 → 刷新页面 | AI 面板关闭，结果消失 |
| **F18** | AI 输出无 Markdown | 所有 4 种操作的结果 | 纯文本，无 `#` `**` `` ``` `` 等 Markdown 语法 |

### 13.2 回归验收（R1-R10）

| # | 验收项 | 预期结果 |
|---|--------|---------|
| R1 | 任务生成 | 不受影响，正常生成 3-8 条任务 |
| R2 | 任务勾选 | 不受影响，checkbox 正常切换完成状态 |
| R3 | 清空 / 重新生成 / 开始新一天 | 不受影响 |
| R4 | 历史记录 | 不受影响 |
| R5 | 统计数据 | 不受影响 |
| R6 | AI 复盘 | 不受影响 |
| R7 | 智能调整 | 不受影响 |
| R8 | OTP 登录 | 不受影响 |
| R9 | 密码登录 | 不受影响 |
| R10 | 忘记密码 / 重置密码 | 不受影响 |

### 13.3 门禁

```bash
npm run lint     # 零 error，零 warning
npm run build    # Compiled successfully，TypeScript 类型检查通过
git status --short   # 仅 V2.4 允许的文件变更（5 新 + 4 改），无意外修改
```

---

## 十四、风险矩阵

### P0 — 阻塞（必须解决才能实现）

| # | 风险 | 可能性 | 影响 | 缓解措施 |
|---|------|:--:|:--:|------|
| **P0-1** | 改坏 TaskItem 导致任务勾选失效 | 🟢 极低 | 🔴 高 | TaskItem 仅新增按钮 + 条件渲染面板，checkbox/onChange 零修改。外层包裹 `<div>` 不影响 checkbox 行为 |
| **P0-2** | API Route 未正确认证（`getAuthenticatedUserId()` 无参调用） | 🟢 极低 | 🔴 高 | 复用 `generate-tasks/route.ts` 的认证模式（同样无参调用） |
| **P0-3** | AI API Key 暴露到前端 | 🟢 极低 | 🔴 高 | API Key 仅在服务端 `process.env` 中使用，API Route 不返回 Key |
| **P0-4** | Codex 编造不存在的 ai-client 函数 | 🟡 低 | 🔴 高 | 执行方案明确：使用 `callAIWithPrompts`（真实存在），不使用任何其他函数 |
| **P0-5** | Codex 编造不存在的组件结构 | 🟡 低 | 🔴 高 | 执行方案已核验所有文件存在性，组件树已确认 |
| **P0-6** | 影响任务主闭环（生成→勾选→保存→复盘） | 🟢 极低 | 🔴 高 | AI 辅助是独立功能，不修改任何核心 hook 或 API Route |

### P1 — 必须修复（影响功能或安全）

| # | 风险 | 可能性 | 影响 | 缓解措施 |
|---|------|:--:|:--:|------|
| **P1-1** | `callAIWithPrompts` 首次 json_object 尝试与 plain-text prompt 冲突，导致首次调用失败 | 🟡 中 | 🟡 中 | json_object 模式失败后自动 fallback 到无 format 模式（函数已内置此逻辑）。额外延迟 1-2s 但功能正常。Parser 已设计为兼容 JSON-wrapped 输出 |
| **P1-2** | AI 返回过长或格式异常 | 🟡 中 | 🟡 中 | Parser 截断超长内容（>500 字）+ 清理 Markdown 标记 + 尝试 JSON unwrap |
| **P1-3** | 4 个按钮在窄屏手机上排列不佳 | 🟢 低 | 🟡 中 | 使用 `grid grid-cols-2` 2×2 布局，按钮最小高度 44px |
| **P1-4** | AI 延迟过高导致用户等待焦虑 | 🟡 中 | 🟡 中 | `maxTokens: 300` + `temperature: 0.4` 控制响应时间。前端显示 spinner 加载动画 |
| **P1-5** | 错误处理暴露原始异常给用户 | 🟢 低 | 🟡 中 | API Route 使用预定义错误码 + 中文消息映射。Hook 使用 DEFAULT_ERROR / NETWORK_ERROR fallback |
| **P1-6** | Prompt 被用户注入控制（通过 taskTitle 传恶意内容） | 🟢 低 | 🟡 中 | `taskTitle` 仅作为 User Prompt 的一部分传给 AI（role: "user"），不修改 System Prompt。System Prompt 规则约束 AI 不执行用户注入指令 |

### P2 — 建议修复（不影响核心功能）

| # | 风险 | 缓解措施 |
|---|------|---------|
| **P2-1** | TaskAssistPanel 关闭后结果丢失 | 设计决定：不持久化。后续 V2.6 做轻量行为记录 |
| **P2-2** | 用户不知道点哪个按钮 | 按钮下方显示简短说明文字（`shortDesc`），降低认知成本 |
| **P2-3** | "换一个"生成的结果不如第一次好 | 每次独立请求，AI 输出有随机性。用户可多次换一个 |
| **P2-4** | 复制按钮在部分浏览器失败（非 HTTPS 或旧浏览器） | `navigator.clipboard.writeText` 需要安全上下文。失败时静默处理，不报错 |
| **P2-5** | `callAIWithPrompts` json_object → fallback 增加延迟 | 已知摩擦点。后续可考虑为 plain-text 场景新增第三个导出函数，但需修改 `ai-client.ts`（当前禁止） |

---

## 十五、Codex 实现阶段拆分

### V2.4-1：基础设施层（类型 + Prompt + Parser + API Route）

| 步骤 | 文件 | 操作 | 说明 |
|:---:|------|:---:|------|
| 1.1 | `src/lib/types.ts` | 🔧 修改 | 在文件末尾追加 `AssistActionType`、`AssistErrorCode`、`AssistResponse` 等类型（~35 行） |
| 1.2 | `src/prompts/task-assist.ts` | ✨ 新增 | 创建 `ASSIST_SYSTEM_PROMPT` + `buildAssistUserPrompt`（~70 行） |
| 1.3 | `src/lib/task-assist-parser.ts` | ✨ 新增 | 创建 `parseAssistAIResponse` + `ParseAssistAIResponseError`（~40 行） |
| 1.4 | `src/app/api/task-assist/route.ts` | ✨ 新增 | 创建 POST handler（~60 行） |

**阶段门禁**：
```bash
npm run lint   # 零 error
npm run build  # 通过（类型定义 + 新增文件无语法错误）
```

### V2.4-2：Hook + 组件层

| 步骤 | 文件 | 操作 | 说明 |
|:---:|------|:---:|------|
| 2.1 | `src/hooks/useTaskAssist.ts` | ✨ 新增 | 创建 `useTaskAssist` hook（~80 行） |
| 2.2 | `src/components/TaskAssistPanel.tsx` | ✨ 新增 | 创建 AI 辅助面板组件（~160 行） |

**阶段门禁**：
```bash
npm run lint   # 零 error
npm run build  # 通过
```

### V2.4-3：集成层（TaskItem + TaskList + MainWorkspace）

| 步骤 | 文件 | 操作 | 说明 |
|:---:|------|:---:|------|
| 3.1 | `src/components/TaskItem.tsx` | 🔧 修改 | 新增 `isAssistOpen`/`onToggleAssist`/`goal` props + "AI 帮我一下"按钮 + 条件渲染 TaskAssistPanel（+15 行） |
| 3.2 | `src/components/TaskList.tsx` | 🔧 修改 | 新增 `activeAssistTaskId`/`onToggleAssist`/`goal` props + 透传给 TaskItem（+8 行） |
| 3.3 | `src/components/MainWorkspace.tsx` | 🔧 修改 | 新增 `activeAssistTaskId` state + 传递给 TaskList（+10 行） |
| 3.4 | 全量验证 | — | 执行验收标准 F1-F18 + R1-R10 |

**阶段门禁**：
```bash
npm run lint    # 零 error
npm run build   # Compiled successfully
git status --short  # 确认仅 9 个文件变更（5 新 + 4 改），无意外修改
```

### V2.4-Review：审查层

| 步骤 | 执行者 | 内容 |
|:---:|:---:|------|
| 4.1 | Claude Code | Code Review（git diff 逐文件确认） |
| 4.2 | ChatGPT | 最终把关 |
| 4.3 | — | 提交 |

---

## 十六、技术阻塞项

### 16.1 结论：无阻塞项

V2.4 所有依赖均已就绪：

| 依赖项 | 状态 | 详情 |
|------|:---:|------|
| `callAIWithPrompts` | ✅ 可用 | `ai-client.ts` 已导出，支持 `systemPrompt`/`userPrompt`/`maxTokens`/`temperature`/`timeoutMs` |
| `getAuthenticatedUserId` | ✅ 可用 | `supabase-server.ts` 已导出，无参调用，与现有 API Route 一致 |
| `TaskItem.tsx` | ✅ 存在 | 30 行，结构简单，易于扩展 |
| `MainWorkspace.tsx` | ✅ 存在 | 196 行，已有 `taskGroup.goal` 可用 |
| `TaskList.tsx` | ✅ 存在 | 79 行，已有 props 透传模式 |
| 环境变量 | ✅ 复用 | `AI_API_KEY` / `AI_API_BASE_URL` / `AI_MODEL` 已存在 |
| 类型系统 | ✅ 就绪 | `types.ts` 已有 `ReviewErrorCode`/`ReviewResponse` 等模式可参考 |

### 16.2 已知摩擦点

| 摩擦点 | 影响 | 处理 |
|------|------|------|
| `callAIWithPrompts` 首次尝试 `json_object` response_format | 首次调用可能失败（prompt 要求纯文本 → API 要求 JSON），fallback 增加 1-2s 延迟 | P2 项，MVP 可接受。Parser 已设计 JSON unwrap 兼容层。后续如需优化：为 `ai-client.ts` 新增第三个导出函数（需单独评审） |

### 16.3 不阻塞但需注意

| 注意项 | 说明 |
|------|------|
| `getAuthenticatedUserId()` 无参数 | 架构方案中误写为 `getAuthenticatedUserId(request)`，执行方案已修正。Codex 必须使用无参形式 |
| `types.ts` 在追加位置 | 必须追加在 `ReviewResponse` 类型定义之后、文件末尾，不插入已有类型之间 |
| `useTaskAssist` 不依赖 `useTaskGroup` | 两个 hook 完全独立，通过 props 传递数据（`goal` 从 MainWorkspace 的 `taskGroup?.goal` 获取） |

---

> **文档结束**
>
> **下一阶段**：本文档经 ChatGPT 审查通过后 → Codex 按 §十五「Codex 实现阶段拆分」顺序实施
>
> **关联文档**：
> - [Architecture-V2.4-AI-Assist.md](Architecture-V2.4-AI-Assist.md) — V2.4 架构方案（本文档的设计依据）
> - [Roadmap-Core-First-V2.3-to-V3.0.md](Roadmap-Core-First-V2.3-to-V3.0.md) — 核心能力优先路线总规划
> - [PROJECT-CONTEXT.md](PROJECT-CONTEXT.md) — 项目长期上下文
> - [PROJECT-INDEX.md](PROJECT-INDEX.md) — 项目文件索引
