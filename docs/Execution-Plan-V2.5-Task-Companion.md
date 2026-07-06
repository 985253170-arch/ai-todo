# V2.5：Task Companion Mode / 任务执行陪伴模式 执行方案

> **状态**：执行方案阶段，**不写代码，待 ChatGPT 审查通过后交给 Codex 实现**
> **依赖**：V2.4 AI 辅助执行 MVP ✅（含 V2.4 Hotfix — `callAIWithPlainText` 已就绪）
> **定位**：基于 V2.5 架构方案，输出 Codex 可直接按步骤实施的详细执行方案
> **上一文档**：[Architecture-V2.5-Task-Companion.md](Architecture-V2.5-Task-Companion.md)
> **下一文档**：无（本执行方案实现后 → Claude Code Review → ChatGPT 最终把关 → 提交）
> **设计日期**：2026-07-06

---

## 目录

- [一、执行结论](#一执行结论)
- [二、V2.4 Hotfix 对 V2.5 的关键影响](#二v24-hotfix-对-v25-的关键影响)
- [三、真实文件结构核验结果](#三真实文件结构核验结果)
- [四、阶段边界](#四阶段边界)
- [五、允许修改 / 新增文件清单](#五允许修改--新增文件清单)
- [六、明确不改文件清单](#六明确不改文件清单)
- [七、类型定义实施步骤（types.ts）](#七类型定义实施步骤typests)
- [八、Prompt 实施步骤（task-companion.ts）](#八prompt-实施步骤task-companionts)
- [九、Parser 实施步骤（task-companion-parser.ts）](#九parser-实施步骤task-companion-parserts)
- [十、API Route 实施步骤（task-companion/route.ts）](#十api-route-实施步骤task-companionroutets)
- [十一、Hook 实施步骤（useTaskCompanion.ts）](#十一hook-实施步骤usetaskcompanionts)
- [十二、UI 组件实施步骤（TaskCompanionPanel.tsx）](#十二ui-组件实施步骤taskcompanionpaneltsx)
- [十三、组件集成实施步骤](#十三组件集成实施步骤)
- [十四、验收标准](#十四验收标准)
- [十五、风险矩阵](#十五风险矩阵)
- [十六、Codex 实施步骤](#十六codex-实施步骤)
- [十七、Claude Code Review 清单](#十七claude-code-review-清单)

---

## 一、执行结论

| # | 问题 | 结论 |
|---|------|:---:|
| 1 | V2.5 是否可以实现 | ✅ **可以实现**。所有依赖（`callAIWithPlainText`、`getAuthenticatedUserId`、现有组件结构）已就绪 |
| 2 | 是否存在技术阻塞 | ✅ **无阻塞**。V2.4 Hotfix 已新增 `callAIWithPlainText`，V2.5 直接复用 |
| 3 | 是否需要新增 API Route | ✅ 需要。`POST /api/task-companion` |
| 4 | 是否需要新增数据库表/字段 | ❌ 不需要。零数据库变更 |
| 5 | 是否需要新增 npm 依赖 | ❌ 不需要 |
| 6 | 是否需要修改 Auth / V2.3 安全文件 | ❌ 不需要 |
| 7 | 是否需要修改 useTaskGroup | ❌ 不需要 |
| 8 | 是否持久化陪伴状态 | ❌ 不持久化。仅组件状态，刷新即消失 |
| 9 | 是否做自由输入 / SSE / Streaming | ❌ 不做。V2.5 MVP 仅 5 个固定反馈按钮，标准 request-response |
| 10 | 是否影响 V2.4 4 个按钮行为 | ❌ 不影响。V2.4 4 个按钮行为完全保留 |
| 11 | 是否影响任务勾选逻辑 | ❌ 不影响。TaskItem checkbox/onToggle 零修改 |
| 12 | 是否影响 review API | ❌ 不影响。review API 继续使用 `callAIWithPrompts` |

### 核心发现

| 发现 | 影响 | 处理 |
|------|------|------|
| V2.4 Hotfix 已新增 `callAIWithPlainText` | V2.5 必须使用此函数，不能用 `callAIWithPrompts` | 架构文档 §八.4 中的 `callAIWithPrompts` 引用需在执行方案中修正为 `callAIWithPlainText` |
| `getAuthenticatedUserId()` 无参数 | API Route 实现需使用无参形式 | 与 V2.4 task-assist route 保持一致 |
| `ai-client.ts` 禁止修改 | V2.5 复用现有 `callAIWithPlainText`，不修改 `ai-client.ts` | 已在 V2.4 Hotfix 中新增，无需进一步改动 |
| TaskItem 当前已有 `isAssistOpen`/`onToggleAssist`/`goal` props | V2.5 新增 `isCompanionOpen`/`onToggleCompanion` props，不冲突 | 并行新增，互斥渲染 |

---

## 二、V2.4 Hotfix 对 V2.5 的关键影响

### 2.1 Hotfix 做了什么

V2.4 上线后发现 `ASSIST_SYSTEM_PROMPT`（"只返回纯文本"）与 `callAIWithPrompts`（首次强制 `json_object`）冲突，导致 AI 返回不可预测内容。

Hotfix 在 `ai-client.ts` 中新增了：

```typescript
// src/lib/ai-client.ts:172-176
export async function callAIWithPlainText(
  options: CallAIWithPromptsOptions,
): Promise<string> {
  return requestChatCompletionWithPrompts(options, undefined);
}
```

`task-assist/route.ts` 已改为使用 `callAIWithPlainText`。

### 2.2 V2.5 必须遵守的规则

| # | 规则 | 原因 |
|---|------|------|
| 1 | **task-companion API 必须使用 `callAIWithPlainText`** | 陪伴输出是纯文本，不能用 `json_object` response_format |
| 2 | **不要使用 `callAIWithPrompts`** | 该函数首次尝试 `json_object`，与纯文本 prompt 冲突 |
| 3 | **不要修改 `callAIWithPrompts` 旧行为** | review API 依赖其 `json_object` + fallback 行为 |
| 4 | **不要修改 `callAIService`** | generate-tasks API 依赖其 `json_schema` 行为 |
| 5 | **不要影响 review API** | review API 仍使用 `callAIWithPrompts`，prompt 明确要求 JSON → 与 `json_object` 对齐 |

### 2.3 架构文档中的一处修正

架构文档 `Architecture-V2.5-Task-Companion.md` §八.4 中第 5 步写的是 `callAIWithPrompts`。**执行方案中修正为 `callAIWithPlainText`**。

架构文档中该段落仅作为流程示意，不影响 V2.5 的实际实现。本执行方案的所有 API 调用均使用 `callAIWithPlainText`。

---

## 三、真实文件结构核验结果

### 3.1 核验通过的文件

| 文件 | 状态 | 行数 | 关键特征 |
|------|:---:|:---:|------|
| `src/components/TaskItem.tsx` | ✅ 存在 | 59 | 已有 `isAssistOpen`/`onToggleAssist`/`goal` props + "AI 帮我一下"按钮 + 条件渲染 TaskAssistPanel |
| `src/components/TaskList.tsx` | ✅ 存在 | 88 | 已有 `activeAssistTaskId`/`onToggleAssist`/`goal` props 透传 |
| `src/components/MainWorkspace.tsx` | ✅ 存在 | 203 | 已有 `activeAssistTaskId` state + `handleToggleAssist` |
| `src/components/TaskAssistPanel.tsx` | ✅ 存在 | 202 | V2.4 4 个按钮 + loading/error/result 状态渲染 |
| `src/hooks/useTaskAssist.ts` | ✅ 存在 | 152 | `requestIdRef` + `inflightRef` 防竞态模式 |
| `src/app/api/task-assist/route.ts` | ✅ 存在 | 184 | 使用 `callAIWithPlainText`（Hotfix 后）+ in-memory rate limit |
| `src/prompts/task-assist.ts` | ✅ 存在 | 52 | `ASSIST_SYSTEM_PROMPT` + `buildAssistUserPrompt` + `ACTION_PROMPTS` |
| `src/lib/task-assist-parser.ts` | ✅ 存在 | 60 | `parseAssistAIResponse` + `ParseAssistAIResponseError` |
| `src/lib/ai-client.ts` | ✅ 存在 | 176 | `callAIWithPlainText`（V2.4 Hotfix 新增）+ `callAIWithPrompts` + `callAIService` |
| `src/lib/types.ts` | ✅ 存在 | 253 | 已有 V2.4 类型（AssistActionType 等），追加位置明确 |
| `src/lib/supabase-server.ts` | ✅ 存在 | 64 | `getAuthenticatedUserId()` 无参数 |

### 3.2 核验结论

所有架构方案中假设的文件均真实存在。V2.4 Hotfix 已完成，`callAIWithPlainText` 可直接使用。组件树（MainWorkspace → TaskList → TaskItem → TaskAssistPanel）准确无误。V2.5 在此基础上增量添加 TaskCompanionPanel。

---

## 四、阶段边界

### V2.5 本次实现

```
V2.4 TaskAssistPanel 底部新增"开始陪我做"按钮
    └── 进入 TaskCompanionPanel
        ├── AI 给出当前第一小步（80-150 字）
        ├── 5 个固定反馈按钮：
        │   ├── 我完成了 (done)
        │   ├── 我卡住了 (stuck)
        │   ├── 太难了 (too_hard)
        │   ├── 鼓励我一下 (encourage)
        │   └── 退出陪伴 (退出面板)
        ├── AI 根据反馈给下一步
        └── AI 判断可以收尾时标记 companionState: "done"
```

### V2.5 明确不进入

| # | 不做 | 留给 |
|---|------|:---:|
| 1 | 不做自由文本输入 / 聊天框 | 后续评估 |
| 2 | 不做多轮对话历史持久化 | 后续评估 |
| 3 | 不做 AI 自动勾选任务 | 永远不做（Human-in-the-Loop） |
| 4 | 不做 AI 自动创建新任务 | 永远不做 |
| 5 | 不做 AI 自动拆分任务入库 | 永远不做 |
| 6 | 不做心理诊断 | 永远不做 |
| 7 | 不做 SSE Streaming | 后续评估 |
| 8 | 不做长期记忆 | 后续评估 |
| 9 | 不做数据库变更 | 零数据库操作 |
| 10 | 不做 UI 美化 | V3.0 |
| 11 | 不做页面重构 | V3.0 |
| 12 | 不替用户写完整文章/邮件/文件 | 永远不做 |

---

## 五、允许修改 / 新增文件清单

### 5.1 新增文件（5 个）

| # | 文件 | 预估行数 | 说明 |
|:--:|------|:--:|------|
| 1 | `src/prompts/task-companion.ts` | ~90 | `COMPANION_SYSTEM_PROMPT` + `buildCompanionUserPrompt`（5 种信号处理） |
| 2 | `src/lib/task-companion-parser.ts` | ~70 | `parseCompanionAIResponse`：trim / 代码块清理 / Markdown 清理 / [DONE] 检测 / 截断 |
| 3 | `src/app/api/task-companion/route.ts` | ~100 | POST API Route（session-aware，使用 `callAIWithPlainText`） |
| 4 | `src/hooks/useTaskCompanion.ts` | ~120 | 陪伴状态管理 hook（状态机：idle → loading → active → done → error） |
| 5 | `src/components/TaskCompanionPanel.tsx` | ~220 | 陪伴面板 UI（5 个反馈按钮 + 步骤展示 + 复制 + 退出） |

### 5.2 修改文件（5 个）

| # | 文件 | 预估新增行数 | 修改内容 |
|:--:|------|:--:|------|
| 1 | `src/lib/types.ts` | +30 | 在文件末尾（`AssistResponse` 之后）追加 V2.5 类型 |
| 2 | `src/components/TaskAssistPanel.tsx` | +20 | 底部新增"开始陪我做"入口按钮 + `onStartCompanion` prop |
| 3 | `src/components/TaskItem.tsx` | +15 | 新增 `isCompanionOpen`/`onToggleCompanion` props + 条件渲染 TaskCompanionPanel |
| 4 | `src/components/TaskList.tsx` | +8 | 新增 `activeCompanionTaskId`/`onToggleCompanion` props + 透传 |
| 5 | `src/components/MainWorkspace.tsx` | +10 | 新增 `activeCompanionTaskId` state + `handleToggleCompanion` |

**预计总改动量**：~653 行（5 个新文件 ~600 行 + 5 个修改文件 ~53 行新增 + 少量修改）。

---

## 六、明确不改文件清单

以下文件**严禁任何修改**：

### 6.1 核心逻辑

| # | 文件 | 原因 |
|:--:|------|------|
| 1 | `src/hooks/useTaskGroup.ts` | 核心任务状态管理，459 行 |
| 2 | `src/hooks/useAuth.ts` | Auth hook |
| 3 | `src/hooks/useTaskAssist.ts` | V2.4 hook，独立运行 |
| 4 | `src/hooks/useTaskReview.ts` | 复盘 hook |
| 5 | `src/hooks/useTaskStats.ts` | 统计 hook |
| 6 | `src/hooks/useTaskHistory.ts` | 历史 hook |

### 6.2 AI 底层

| # | 文件 | 原因 |
|:--:|------|------|
| 7 | `src/lib/ai-client.ts` | **V2.5 只复用 `callAIWithPlainText`，不修改** |
| 8 | `src/lib/task-assist-parser.ts` | V2.4 parser，独立运行 |
| 9 | `src/lib/task-parser.ts` | 任务解析器 |
| 10 | `src/lib/review-parser.ts` | 复盘解析器 |

### 6.3 Prompt

| # | 文件 | 原因 |
|:--:|------|------|
| 11 | `src/prompts/task-assist.ts` | V2.4 prompt，独立运行 |
| 12 | `src/prompts/task-generation.ts` | 任务生成 prompt |
| 13 | `src/prompts/task-review.ts` | 复盘 prompt |

### 6.4 API Route

| # | 文件 | 原因 |
|:--:|------|------|
| 14 | `src/app/api/task-assist/route.ts` | V2.4 API，独立运行 |
| 15 | `src/app/api/generate-tasks/route.ts` | 核心生成 API |
| 16 | `src/app/api/task-groups/review/route.ts` | 复盘 API |
| 17 | `src/app/api/task-group/**` | 所有 task-group API |
| 18 | `src/app/api/task-groups/**` | 所有 task-groups API |

### 6.5 Auth / Security（V2.3）

| # | 文件 | 原因 |
|:--:|------|------|
| 19 | `src/lib/supabase-server.ts` | 复用 `getAuthenticatedUserId`，不修改 |
| 20 | `src/lib/supabase-client.ts` | 客户端 Supabase |
| 21 | `src/lib/auth-errors.ts` | Auth 错误脱敏 |
| 22 | `src/lib/constants.ts` | 常量文件 |
| 23 | `src/app/auth/callback/route.ts` | Auth 回调 |
| 24 | `src/app/login/page.tsx` | 登录页 |
| 25 | `src/app/forgot-password/page.tsx` | 忘记密码 |
| 26 | `src/app/reset-password/page.tsx` | 重置密码 |
| 27 | `src/components/LoginPageContent.tsx` | 登录表单 |
| 28 | `src/components/TurnstileWidget.tsx` | Turnstile |
| 29 | `src/app/app/page.tsx` | `/app` 入口（路由守卫） |

### 6.6 配置 / 环境

| # | 文件 | 原因 |
|:--:|------|------|
| 30 | `package.json` | 无新依赖 |
| 31 | `package-lock.json` | 无新依赖 |
| 32 | `.env.local` | 复用现有 `AI_API_KEY` / `AI_API_BASE_URL` / `AI_MODEL` |
| 33 | 数据库 schema / migration | 零数据库变更 |

---

## 七、类型定义实施步骤（types.ts）

### 7.1 文件：`src/lib/types.ts`

**操作**：在文件末尾追加（`AssistResponse` 类型定义之后，第 253 行之后）

**不改动任何现有类型定义。**

### 7.2 追加内容

```typescript
// V2.5 — 任务执行陪伴类型

export type CompanionUserSignal =
  | "start"
  | "done"
  | "stuck"
  | "too_hard"
  | "encourage";

export type CompanionStatus = "active" | "done";

export type CompanionErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_REQUEST_BODY"
  | "INVALID_SIGNAL"
  | "AI_COMPANION_FAILED"
  | "AI_RESPONSE_INVALID"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface CompanionStep {
  message: string;
  companionState: CompanionStatus;
}

export interface CompanionSuccessResponse {
  success: true;
  data: CompanionStep;
}

export interface CompanionErrorResponse {
  success: false;
  error: {
    code: CompanionErrorCode;
    message: string;
  };
}

export type CompanionResponse =
  | CompanionSuccessResponse
  | CompanionErrorResponse;
```

### 7.3 实施约束

1. 追加在文件末尾，`AssistResponse` 类型定义之后
2. 不修改现有 `Task`、`TaskGroup`、`AssistActionType`、`AssistErrorCode`、`AssistResponse`、`ReviewData`、`ReviewErrorCode` 等任何已有类型
3. 不重构已有类型结构
4. 不影响旧 API 的类型推断
5. `CompanionUserSignal` 与 `AssistActionType` 独立——前者是陪伴模式用户反馈信号，后者是 V2.4 辅助按钮类型

---

## 八、Prompt 实施步骤（task-companion.ts）

### 8.1 文件：`src/prompts/task-companion.ts`（新增）

### 8.2 导入

```typescript
import type { CompanionUserSignal } from "@/lib/types";
```

### 8.3 COMPANION_SYSTEM_PROMPT

```typescript
export const COMPANION_SYSTEM_PROMPT = `你是 AI Todo 的任务执行陪伴助手。你的角色是陪用户一步一步推进任务，不是替用户完成任务。请始终使用中文输出。

## 核心规则
1. 每次只输出当前一个步骤，80-150 字。
2. 不超过 3 个具体动作。
3. 不输出完整计划，不输出后续步骤。
4. 不输出长篇理论（不解释"为什么这样做"）。
5. 不输出空泛鸡汤（不说"你一定可以的""相信自己""你很棒"）。
6. 不替用户完成完整任务，不生成完整文章/邮件/简历/文件。
7. 不输出复杂术语。
8. 不输出 Markdown 格式。
9. 只返回纯文本。

## 用户反馈处理
- "start" → 给出第一步，承认任务并降低开始门槛。
- "done" → 简短认可完成，推进到下一步。
- "stuck" → 承认卡住的正常性，把当前步骤拆成更小动作（1-2 个）。
- "too_hard" → 承认难度，给降级/简化方案。
- "encourage" → 遵循鼓励规则（见下）。

## 鼓励规则
当用户请求鼓励时，必须遵循 4 步结构：
1. 承认用户的感受（如"我感觉到这个任务让你有点不知道怎么下手"）
2. 降低压力（如"这很正常，大部分类似的任务刚开始都是这样"）
3. 缩小任务范围（如"我们不需要现在就做完，只需要做一件很小的事"）
4. 给一个马上能做的小动作（如"先打开一个空白文档，标题写上'xxx'，就这一步"）

不做：
- 不做心理诊断（不说"你看起来很焦虑"）
- 不写长篇鸡汤
- 不说"你一定可以的""相信自己""你很棒"

## 收尾判断
当你认为任务已经推进到可以收尾时，在输出末尾加上 [DONE] 标记，告诉用户可以去勾选完成了。注意：[DONE] 必须是输出的最后一行，独占一行。

## 输出格式
直接输出给用户看的文案，不需要 JSON，不需要标题，不需要格式标记。纯文本即可。`;
```

### 8.4 buildCompanionUserPrompt

```typescript
interface CompanionPromptInput {
  taskTitle: string;
  goal?: string;
  currentStep?: string;
  stepHistory?: string[];
  userSignal: CompanionUserSignal;
}

const SIGNAL_INSTRUCTIONS: Record<CompanionUserSignal, string> = {
  start: "用户刚开始做这个任务，请给出当前第一小步。承认这个任务的存在，降低开始门槛。",
  done: "用户完成了你上一步给出的步骤，请简短认可后给出下一步。",
  stuck: "用户在上一步卡住了，请先承认卡住的正常性，然后把当前步骤拆成更小的动作。",
  too_hard: "用户觉得当前步骤太难了，请先承认难度，然后给出一个降级/简化方案。",
  encourage: "用户需要鼓励，请严格按照鼓励规则（承认感受→降低压力→缩小范围→给动作）给出简短、具体、行动导向的鼓励。",
};

export function buildCompanionUserPrompt(input: CompanionPromptInput): string {
  const parts: string[] = [];

  parts.push(`用户的任务：${input.taskTitle.trim()}`);

  if (input.goal?.trim()) {
    parts.push(`用户的目标：${input.goal.trim()}`);
  }

  if (input.currentStep?.trim()) {
    parts.push(`用户当前步骤：${input.currentStep.trim()}`);
  }

  if (input.stepHistory && input.stepHistory.length > 0) {
    parts.push(`已完成步骤：${input.stepHistory.join(" → ")}`);
  }

  parts.push("");
  parts.push(SIGNAL_INSTRUCTIONS[input.userSignal]);

  return parts.join("\n");
}
```

### 8.5 实施约束

1. `buildCompanionUserPrompt` 是纯函数，不访问环境变量、不访问数据库
2. 所有文案硬编码在 prompt 中，不允许动态拼接不可信内容
3. `goal` 为空时不输出"用户的目标"行
4. `currentStep` 为空时不输出"用户当前步骤"行
5. `stepHistory` 为空时不输出"已完成步骤"行
6. 不修改 `task-assist.ts`、`task-generation.ts`、`task-review.ts`

---

## 九、Parser 实施步骤（task-companion-parser.ts）

### 9.1 文件：`src/lib/task-companion-parser.ts`（新增）

### 9.2 完整实现规范

```typescript
import type { CompanionStatus, CompanionStep } from "@/lib/types";

export class ParseCompanionAIResponseError extends Error {
  constructor(message = "Failed to parse companion AI response.") {
    super(message);
    this.name = "ParseCompanionAIResponseError";
  }
}

const MAX_MESSAGE_LENGTH = 300;

/**
 * 解析 AI 陪伴响应。
 *
 * V2.5 使用 callAIWithPlainText（无 response_format），
 * AI 返回纯文本。Parser 负责：
 * 1. 清理代码块 / Markdown
 * 2. 检测 [DONE] 标记
 * 3. 截断超长内容
 */
export function parseCompanionAIResponse(rawText: string): CompanionStep {
  // 1. Trim
  let text = rawText.trim();

  if (!text) {
    throw new ParseCompanionAIResponseError("AI response is empty.");
  }

  // 2. 检测 [DONE] 标记（独立一行，可能位于末尾）
  let companionState: CompanionStatus = "active";
  const donePattern = /\[DONE\]\s*$/i;
  if (donePattern.test(text)) {
    companionState = "done";
    // 去掉 [DONE] 标记，保留前面的文案
    text = text.replace(/\s*\[DONE\]\s*$/i, "").trim();
  }

  // 3. 去掉代码块标记
  if (text.startsWith("```")) {
    text = text
      .replace(/^```(?:json|text|plain)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  // 4. 去掉 Markdown 标题符号（# ## ###）
  text = text.replace(/^#{1,6}\s+/gm, "");

  // 5. 去掉粗体/斜体标记（** __ * _）
  text = text.replace(/\*{1,3}([^*]+?)\*{1,3}/g, "$1");
  text = text.replace(/_{1,3}([^_]+?)_{1,3}/g, "$1");

  // 6. Trim
  text = text.trim();

  // 7. 空内容校验
  if (!text) {
    throw new ParseCompanionAIResponseError(
      "AI response is empty after cleaning.",
    );
  }

  // 8. 截断超长内容
  if (text.length > MAX_MESSAGE_LENGTH) {
    text = text.slice(0, MAX_MESSAGE_LENGTH) + "…";
  }

  return { message: text, companionState };
}
```

### 9.3 关键差异（vs task-assist-parser.ts）

| 维度 | task-assist-parser | task-companion-parser |
|------|-------------------|----------------------|
| 输出 | `string` | `CompanionStep { message, companionState }` |
| [DONE] 检测 | 无 | ✅ 检测 `[DONE]` 标记并设置 `companionState: "done"` |
| JSON unwrap | ✅ 兼容 json_object | ❌ 不需要（使用 `callAIWithPlainText`） |
| 最大长度 | 500 字 | 300 字 |
| 截断标记 | `…` | `…`（同） |

### 9.4 实施约束

1. 不做 JSON 解析（与 `task-assist-parser.ts` 的关键区别）
2. 不引入新依赖
3. 错误类型继承自 `Error`（与 `ParseAssistAIResponseError` 模式一致）
4. `[DONE]` 检测大小写不敏感
5. 截断后若 `companionState` 是 `"done"` 但截断了 `[DONE]` 标记 → 优先级：先检测 `[DONE]`，再截断
6. **V2.5 MVP 暂不做启发式 done 判断**：只识别明确的 `[DONE]` 标记，不通过关键词（如"可以去勾选完成了"）做启发式兜底，避免误判任务已完成

---

## 十、API Route 实施步骤（task-companion/route.ts）

### 10.1 文件：`src/app/api/task-companion/route.ts`（新增）

### 10.2 目录结构

```
src/app/api/task-companion/
  └── route.ts   ← 新增
```

### 10.3 请求规范

```
POST /api/task-companion
Content-Type: application/json

{
  "taskTitle": "撰写项目周报",           // 必填，string，trim 后非空，≤200 字
  "goal": "完成本周工作汇报",            // 可选，string，可为空，≤200 字
  "currentStep": "打开文档工具...",      // 可选，当前步骤文案
  "stepHistory": ["步骤1", "步骤2"],     // 可选，历史步骤摘要（前端最多传 5 条）
  "userSignal": "start"                  // 必填，"start" | "done" | "stuck" | "too_hard" | "encourage"
}
```

### 10.4 响应规范

**成功**（200）：
```json
{
  "success": true,
  "data": {
    "message": "好的，我们开始"撰写项目周报"。现在只做第一步：...",
    "companionState": "active"
  }
}
```

**失败**：
| HTTP Status | error.code | 触发条件 |
|:--:|------|------|
| 401 | `UNAUTHORIZED` | 未登录（`getAuthenticatedUserId()` 返回 null） |
| 400 | `INVALID_REQUEST_BODY` | 请求体不是合法 JSON、`taskTitle` 缺失或 trim 后为空 |
| 400 | `INVALID_SIGNAL` | `userSignal` 不在 5 个枚举值中 |
| 500 | `AI_COMPANION_FAILED` | `callAIWithPlainText` 抛异常、AI API Key 未配置 |
| 500 | `AI_RESPONSE_INVALID` | `parseCompanionAIResponse` 抛 `ParseCompanionAIResponseError` |
| 429 | `RATE_LIMITED` | 同一用户 60s 内超过 10 次请求 |
| 500 | `INTERNAL_ERROR` | 其他未预期的服务端错误 |

### 10.5 完整实现规范

```typescript
import { NextRequest, NextResponse } from "next/server";

import { callAIWithPlainText } from "@/lib/ai-client";
import { getAuthenticatedUserId } from "@/lib/supabase-server";
import {
  parseCompanionAIResponse,
  ParseCompanionAIResponseError,
} from "@/lib/task-companion-parser";
import type {
  CompanionErrorCode,
  CompanionResponse,
  CompanionStep,
  CompanionUserSignal,
} from "@/lib/types";
import {
  COMPANION_SYSTEM_PROMPT,
  buildCompanionUserPrompt,
} from "@/prompts/task-companion";

// ---- 常量 ----

const VALID_SIGNALS = new Set<CompanionUserSignal>([
  "start",
  "done",
  "stuck",
  "too_hard",
  "encourage",
]);

const MAX_TASK_TITLE_LENGTH = 200;
const MAX_GOAL_LENGTH = 200;
const MAX_CURRENT_STEP_LENGTH = 500;
const MAX_STEP_HISTORY_LENGTH = 5;

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

// ---- 错误消息 ----

const ERROR_MESSAGES: Record<CompanionErrorCode, string> = {
  UNAUTHORIZED: "请先登录后再使用 AI 陪伴。",
  INVALID_REQUEST_BODY: "请求参数错误。",
  INVALID_SIGNAL: "暂不支持这个反馈类型。",
  AI_COMPANION_FAILED: "AI 陪伴生成失败，请稍后重试。",
  AI_RESPONSE_INVALID: "AI 返回内容不可用，请重试。",
  RATE_LIMITED: "操作过于频繁，请稍后再试。",
  INTERNAL_ERROR: "服务异常，请稍后重试。",
};

// ---- 工具函数 ----

function errorResponse(code: CompanionErrorCode, status: number) {
  const body: CompanionResponse = {
    success: false,
    error: { code, message: ERROR_MESSAGES[code] },
  };
  return NextResponse.json(body, { status });
}

// ---- 限速（in-memory） ----

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || entry.resetAt <= now) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

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
  if (!checkRateLimit(userId)) {
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

  // ===== 4. 校验 taskTitle（必填） =====
  const taskTitle =
    typeof body.taskTitle === "string" ? body.taskTitle.trim() : "";
  if (!taskTitle) {
    return errorResponse("INVALID_REQUEST_BODY", 400);
  }
  const safeTaskTitle = taskTitle.slice(0, MAX_TASK_TITLE_LENGTH);

  // ===== 5. 校验 userSignal（必填） =====
  const userSignal = body.userSignal;
  if (
    typeof userSignal !== "string" ||
    !VALID_SIGNALS.has(userSignal as CompanionUserSignal)
  ) {
    return errorResponse("INVALID_SIGNAL", 400);
  }

  // ===== 6. 处理可选字段 =====
  const goal =
    typeof body.goal === "string" ? body.goal.trim().slice(0, MAX_GOAL_LENGTH) : "";

  const currentStep =
    typeof body.currentStep === "string"
      ? body.currentStep.trim().slice(0, MAX_CURRENT_STEP_LENGTH)
      : "";

  let stepHistory: string[] = [];
  if (Array.isArray(body.stepHistory)) {
    stepHistory = body.stepHistory
      .filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
      .slice(0, MAX_STEP_HISTORY_LENGTH)
      .map((item) => item.trim());
  }

  // ===== 7. 构造 prompt =====
  // System Prompt 和 User Prompt 完全在服务端构造，前端不可控
  const systemPrompt = COMPANION_SYSTEM_PROMPT;
  const userPrompt = buildCompanionUserPrompt({
    taskTitle: safeTaskTitle,
    goal,
    currentStep,
    stepHistory,
    userSignal: userSignal as CompanionUserSignal,
  });

  // ===== 8. 检查 API Key =====
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    return errorResponse("AI_COMPANION_FAILED", 500);
  }

  // ===== 9. 调用 AI（纯文本模式） =====
  let rawContent: string;
  try {
    rawContent = await callAIWithPlainText({
      apiKey,
      baseUrl: process.env.AI_API_BASE_URL,
      model: process.env.AI_MODEL,
      systemPrompt,
      userPrompt,
      maxTokens: 400,
      temperature: 0.4,
      timeoutMs: 30_000,
    });
  } catch {
    return errorResponse("AI_COMPANION_FAILED", 500);
  }

  // ===== 10. 解析 =====
  let companionStep: CompanionStep;
  try {
    companionStep = parseCompanionAIResponse(rawContent);
  } catch (error) {
    if (error instanceof ParseCompanionAIResponseError) {
      return errorResponse("AI_RESPONSE_INVALID", 500);
    }
    return errorResponse("AI_RESPONSE_INVALID", 500);
  }

  // ===== 11. 返回 =====
  const response: CompanionResponse = {
    success: true,
    data: companionStep,
  };
  return NextResponse.json(response);
}
```

### 10.6 实施约束

1. **认证**：使用 `getAuthenticatedUserId()` **无参数**调用（与 V2.4 task-assist 保持一致）
2. **AI 调用**：使用 `callAIWithPlainText`（不是 `callAIWithPrompts`）
3. **API Key**：从 `process.env.AI_API_KEY` 读取
4. **环境变量**：复用 `AI_API_KEY`、`AI_API_BASE_URL`、`AI_MODEL`（不新增）
5. **不调用 Turnstile**：已登录用户由 session JWT 保护
6. **不传 prompt 给前端**：`systemPrompt` 和 `userPrompt` 完全在服务端构造
7. **不暴露 API Key**：Key 仅在服务端 `process.env` 中使用
8. **不访问数据库**：不需要任务数据，不做任何读取或写入
9. **不修改任务完成状态**：陪伴 API 不读/不写 Supabase 任务表
10. **包含 AI_API_KEY 检查**：复用现有 AI_API_KEY 逻辑，未配置时返回 AI_COMPANION_FAILED（与 task-assist 一致）
11. **错误响应格式**：与现有 API 统一 `{ success: false, error: { code, message } }`
12. **maxTokens: 400**：比 V2.4（300）稍大，因为陪伴输出需要 80-150 字 + 可能需要 4 步结构
13. **temperature: 0.4**：与 V2.4 相同

### 10.7 与现有 API Route 的对齐检查

| 检查项 | task-assist (V2.4) | task-companion (V2.5) |
|------|:---:|:---:|
| 认证方式 | `getAuthenticatedUserId()` | ✅ `getAuthenticatedUserId()` |
| AI 调用 | `callAIWithPlainText` | ✅ `callAIWithPlainText` |
| 环境变量 Key | `AI_API_KEY` | ✅ `AI_API_KEY` |
| 限速 | 10次/60s/userId | ✅ 10次/60s/userId |
| 响应格式 | `{success, data/error}` | ✅ `{success, data/error}` |
| 不访问数据库 | ✅ | ✅ |

---

## 十一、Hook 实施步骤（useTaskCompanion.ts）

### 11.1 文件：`src/hooks/useTaskCompanion.ts`（新增）

### 11.2 完整接口定义

```typescript
"use client";

import { useCallback, useRef, useState } from "react";
import type {
  CompanionResponse,
  CompanionStep,
  CompanionUserSignal,
} from "@/lib/types";

// ---- 类型 ----

type CompanionUIStatus = "idle" | "loading" | "active" | "done" | "error";

interface UseTaskCompanionOptions {
  taskId: string;
  taskTitle: string;
  goal: string;
}

interface UseTaskCompanionReturn {
  status: CompanionUIStatus;
  currentStep: CompanionStep | null;
  error: string | null;
  stepHistory: string[];
  startCompanion: () => Promise<void>;
  sendSignal: (signal: CompanionUserSignal) => Promise<void>;
  exitCompanion: () => void;
  reset: () => void;
}
```

### 11.3 状态管理

| 状态 | 含义 | 转换条件 |
|------|------|----------|
| `idle` | 初始状态，未进入陪伴 | 面板关闭 / reset / exit |
| `loading` | 等待 AI 返回 | startCompanion / sendSignal 调用中 |
| `active` | AI 返回当前步骤，等待用户反馈 | AI 返回 `companionState: "active"` |
| `done` | AI 建议收尾 | AI 返回 `companionState: "done"` |
| `error` | AI 调用失败，可重试 | API 异常 / parser 异常 |

### 11.4 核心逻辑

```typescript
const DEFAULT_ERROR = "AI 陪伴请求失败，请稍后重试。";
const NETWORK_ERROR = "网络连接失败，请检查网络后重试。";

const COMPANION_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "请先登录后再使用 AI 陪伴。",
  INVALID_REQUEST_BODY: "请求参数错误。",
  INVALID_SIGNAL: "暂不支持这个反馈类型。",
  AI_COMPANION_FAILED: "AI 陪伴生成失败，请稍后重试。",
  AI_RESPONSE_INVALID: "AI 返回内容不可用，请重试。",
  RATE_LIMITED: "操作过于频繁，请稍后再试。",
  INTERNAL_ERROR: "AI 陪伴生成失败，请稍后重试。",
};
```

**startCompanion()**：
1. 防竞态：`if (inflightRef.current) return;`
2. 设置 `inflightRef.current = true`、`requestId += 1`
3. 设置 `status = "loading"`、清空 `error`、清空 `stepHistory`
4. POST `/api/task-companion` → `{ taskTitle, goal, userSignal: "start" }`
5. 成功：`setCurrentStep(data)`、`status = data.companionState === "done" ? "done" : "active"`
6. 失败：`setError(mappedMessage)`、`status = "error"`
7. finally：`inflightRef.current = false`

**sendSignal(signal)**：
1. 防竞态：`if (inflightRef.current) return;`
2. 设置 `inflightRef.current = true`、`requestId += 1`
3. 设置 `status = "loading"`、清空 `error`
4. POST `/api/task-companion` → `{ taskTitle, goal, currentStep: currentStep?.message, stepHistory, userSignal: signal }`
5. 成功后：`setStepHistory(prev => [...prev, currentStep.message].slice(-5))`
6. 成功后：`setCurrentStep(newStep)`、`status = newStep.companionState === "done" ? "done" : "active"`
7. 失败：`setError(mappedMessage)`、`status = "error"`
8. finally：`inflightRef.current = false`

**exitCompanion()**：
- 清空所有状态：status → "idle"、currentStep → null、error → null、stepHistory → []

**reset()**：
- 同 exitCompanion

### 11.5 实施约束

1. **不持久化**：不写 localStorage / sessionStorage / 数据库
2. **不调用 AI 客户端直接**：全部经过 `/api/task-companion`
3. **防竞态**：`inflightRef` + `requestIdRef`（与 useTaskAssist 相同模式）
4. **stepHistory 只保留最近 5 条**：`[...prev, message].slice(-5)`。V2.5 MVP 保持最近 5 条 stepHistory，后续 V2.6 再根据真实使用数据评估是否扩展到 10 条
5. **错误展示中文安全消息**：不暴露原始异常
6. **独立 hook**：不依赖 `useTaskGroup`、`useTaskAssist`、`useTaskReview` 等
7. **`"use client"` 指令**：客户端 hook
8. **参考模式**：`useTaskAssist.ts` 的 `requestIdRef` + `inflightRef` 防竞态模式

---

## 十二、UI 组件实施步骤（TaskCompanionPanel.tsx）

### 12.1 文件：`src/components/TaskCompanionPanel.tsx`（新增）

### 12.2 Props 接口

```typescript
interface TaskCompanionPanelProps {
  taskId: string;
  taskTitle: string;
  goal: string;
  onClose: () => void;
}
```

### 12.3 状态机

```
idle ──→ loading ──→ active ──→ done
  │        │          │  │        │
  │        └─→ error  │  │        │
  │        ←──┘       │  │        │
  │              ←────┘  │        │
  │        ←─────────────┘        │
  └──────────────────────────────┘
          (exit → idle)
```

### 12.4 UI 布局

```
┌──────────────────────────────────────────┐
│  🧑‍🏫 AI 陪你做                      [关闭] │  ← 标题行
│                                          │
│  ┌──────────────────────────────────────┐│
│  │                                      ││
│  │  AI 当前步骤输出区域                   ││  ← whitespace-pre-line
│  │  （80-150 字）                        ││
│  │                                      ││
│  └──────────────────────────────────────┘│
│                                          │
│  用户反馈按钮：                            │
│  ┌─────────────┐ ┌──────────────┐       │
│  │ ✅ 我完成了   │ │ 🆘 我卡住了   │       │  ← 2×2 网格（移动端）
│  ├─────────────┤ ├──────────────┤       │     sm+ 横排
│  │ 😰 太难了    │ │ 💪 鼓励我一下  │       │
│  ├─────────────┤ └──────────────┘       │
│  │ 🚪 退出陪伴  │                        │
│  └─────────────┘                        │
│                                          │
│  [📋 复制当前步骤]                         │  ← 辅助操作
└──────────────────────────────────────────┘
```

### 12.5 反馈按钮定义

```typescript
const SIGNAL_BUTTONS: Array<{
  signal: CompanionUserSignal;
  label: string;
  icon: string; // emoji
}> = [
  { signal: "done", label: "我完成了", icon: "✅" },
  { signal: "stuck", label: "我卡住了", icon: "🆘" },
  { signal: "too_hard", label: "太难了", icon: "😰" },
  { signal: "encourage", label: "鼓励我一下", icon: "💪" },
];
```

"退出陪伴"是独立按钮，样式不同（次要按钮，放在 4 个主按钮下方）。

### 12.6 各状态渲染

| 状态 | UI |
|------|-----|
| `idle` | 空面板（理论上不会渲染，进入面板即触发 `startCompanion`） |
| `loading` | spinner + "AI 正在思考下一步..." |
| `active` | 当前步骤文本（`whitespace-pre-line`）+ 5 个按钮全部可用 |
| `done` | 当前步骤文本 + 浅色提示"任务已可以收尾，去勾选完成吧" + 仅保留"鼓励我一下"和"退出陪伴"按钮 |
| `error` | 错误消息（amber 面板）+ "重试"按钮 + "退出陪伴"按钮 |

### 12.7 关键交互

1. **进入面板**：组件 mount 时自动调用 `startCompanion()`（useEffect）
2. **点击反馈按钮**：调用 `sendSignal(signal)`，进入 loading → active
3. **"退出陪伴"**：调用 `exitCompanion()` + `onClose()`
4. **"复制当前步骤"**：`navigator.clipboard.writeText(currentStep.message)`，复制成功后临时显示"已复制"（1.6s）
5. **重试**：使用当前上下文调用 `sendSignal(lastSignal)` 或 `startCompanion()`
6. **done 状态**：隐藏"我完成了/我卡住了/太难了"按钮，仅保留"鼓励我一下"和"退出陪伴"

### 12.8 移动端适配

- 按钮布局：`grid grid-cols-2 gap-2`（2×2 网格，与 TaskAssistPanel 一致）
- "退出陪伴"按钮占一半宽度
- "复制当前步骤"为文字链接样式
- 触控区域：按钮 `min-h-11`（≥44px）
- 面板全宽：`w-full`
- 间距：与 TaskItem 视觉一致

### 12.9 样式参考

参考 `TaskAssistPanel.tsx` 的样式系统：
- 外层容器：`rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3 shadow-sm sm:p-4`
- 按钮（默认）：`min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700`
- 按钮（disabled）：`disabled:cursor-not-allowed disabled:opacity-60`
- 错误面板：`rounded-xl border border-amber-200 bg-amber-50 px-4 py-3`
- 结果区域：`rounded-xl border border-slate-200 bg-white px-4 py-3`
- 结果文本：`whitespace-pre-line text-sm leading-6 text-slate-700`

### 12.10 实施约束

1. 组件 mount 时自动调用 `startCompanion()`（useEffect 空依赖）
2. 不渲染 checkbox（不操作任务完成状态）
3. 结果文本使用 `whitespace-pre-line`（保留 AI 输出换行）
4. 不自动关闭（用户主动点"退出陪伴"）
5. "退出陪伴"按钮在 done 和非 done 状态都可见
6. 复制按钮失败时不报错（静默失败）
7. 按钮使用 Tailwind 类，不引入自定义 CSS
8. 禁止使用未经 `src/lib/types.ts` 定义的类型（确保类型导入路径正确）

---

## 十三、组件集成实施步骤

### 13.1 集成链路

```
MainWorkspace（新增 activeCompanionTaskId state）
  └── TaskList（透传 activeCompanionTaskId, onToggleCompanion）
        └── TaskItem（新增 isCompanionOpen, onToggleCompanion props）
              └── TaskCompanionPanel（条件渲染，isCompanionOpen === true）
```

### 13.2 互斥逻辑

**同一任务不能同时打开 TaskAssistPanel 和 TaskCompanionPanel。**

实现方式：
- 当 `activeCompanionTaskId === task.id` 时 → 关闭 TaskAssistPanel（`isAssistOpen = false`），打开 TaskCompanionPanel
- 当 `activeAssistTaskId === task.id` 时 → 关闭 TaskCompanionPanel（`isCompanionOpen = false`），打开 TaskAssistPanel
- 在 `MainWorkspace` 的 `handleToggleCompanion` 中同时设置 `activeCompanionTaskId` 并清除 `activeAssistTaskId`
- 在 `MainWorkspace` 的 `handleToggleAssist` 中同时设置 `activeAssistTaskId` 并清除 `activeCompanionTaskId`

### 13.3 TaskAssistPanel.tsx 修改

**文件**：`src/components/TaskAssistPanel.tsx`（当前 202 行）

**修改内容**：

1. Props 接口新增 `onStartCompanion`：
```typescript
interface TaskAssistPanelProps {
  taskId: string;
  taskTitle: string;
  goal: string;
  onClose: () => void;
  // V2.5 新增
  onStartCompanion?: () => void;
}
```

2. 在 4 个 V2.4 按钮下方新增"开始陪我做"入口：
```tsx
{/* V2.5 新增：开始陪我做入口 */}
{onStartCompanion ? (
  <>
    <div className="mt-3 border-t border-indigo-100 pt-3">
      <button
        className="min-h-11 w-full rounded-xl border-2 border-indigo-300 bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-3 text-left transition-colors hover:from-indigo-100 hover:to-purple-100"
        onClick={onStartCompanion}
        type="button"
      >
        <span className="block text-sm font-semibold text-indigo-700">
          🧑‍🏫 开始陪我做
        </span>
        <span className="mt-0.5 block text-xs text-indigo-500">
          一步一步来，我陪你做
        </span>
      </button>
    </div>
  </>
) : null}
```

3. **不改动**：
   - 4 个 V2.4 按钮的渲染逻辑
   - loading / error / result 状态渲染
   - 复制 / 换一个逻辑
   - `useTaskAssist` hook 调用

### 13.4 TaskItem.tsx 修改

**文件**：`src/components/TaskItem.tsx`（当前 59 行）

**修改内容**：

1. Props 接口新增：
```typescript
interface TaskItemProps {
  task: Task;
  onToggle: (taskId: string) => void;
  isAssistOpen: boolean;
  onToggleAssist: (taskId: string) => void;
  goal: string;
  // V2.5 新增
  isCompanionOpen: boolean;
  onToggleCompanion: (taskId: string) => void;
}
```

2. 函数参数解构新增：
```typescript
export function TaskItem({
  goal,
  isAssistOpen,
  isCompanionOpen,
  onToggle,
  onToggleAssist,
  onToggleCompanion,
  task,
}: TaskItemProps) {
```

3. 新增 import：
```typescript
import { TaskCompanionPanel } from "@/components/TaskCompanionPanel";
```

4. TaskAssistPanel 渲染处修改（增加 `onStartCompanion` prop）：
```tsx
{isAssistOpen ? (
  <div className="mt-2">
    <TaskAssistPanel
      goal={goal}
      onClose={() => onToggleAssist(task.id)}
      onStartCompanion={() => onToggleCompanion(task.id)}
      taskId={task.id}
      taskTitle={task.title}
    />
  </div>
) : null}
```

5. 新增 TaskCompanionPanel 条件渲染：
```tsx
{isCompanionOpen ? (
  <div className="mt-2">
    <TaskCompanionPanel
      goal={goal}
      onClose={() => onToggleCompanion(task.id)}
      taskId={task.id}
      taskTitle={task.title}
    />
  </div>
) : null}
```

6. **不改动**：
   - checkbox + onToggle
   - title span
   - "AI 帮我一下"按钮

### 13.5 TaskList.tsx 修改

**文件**：`src/components/TaskList.tsx`（当前 88 行）

**修改内容**：

1. Props 接口新增：
```typescript
interface TaskListProps {
  // ... 现有 13 个 props 不变
  // V2.5 新增
  activeCompanionTaskId: string | null;
  onToggleCompanion: (taskId: string) => void;
}
```

2. 函数参数解构新增：
```typescript
export function TaskList({
  // ... 现有属性
  activeAssistTaskId,
  onToggleAssist,
  goal,
  // V2.5 新增
  activeCompanionTaskId,
  onToggleCompanion,
}: TaskListProps) {
```

3. TaskItem 渲染新增 2 个 props：
```typescript
<TaskItem
  goal={goal}
  isAssistOpen={activeAssistTaskId === task.id}
  isCompanionOpen={activeCompanionTaskId === task.id}
  key={task.id}
  onToggle={onToggleTask}
  onToggleAssist={onToggleAssist}
  onToggleCompanion={onToggleCompanion}
  task={task}
/>
```

**仅此三处修改，不改 TaskList 的任何其他逻辑。**

### 13.6 MainWorkspace.tsx 修改

**文件**：`src/components/MainWorkspace.tsx`（当前 203 行）

**修改内容**：

1. 新增 state（在 `activeAssistTaskId` 后面）：
```typescript
// V2.5 — 任务陪伴面板状态
const [activeCompanionTaskId, setActiveCompanionTaskId] = useState<
  string | null
>(null);
```

2. 新增 handler（在 `handleToggleAssist` 后面）：
```typescript
// V2.5 — 打开陪伴模式时清除 assist，确保互斥
function handleToggleCompanion(taskId: string) {
  setActiveCompanionTaskId((currentTaskId) =>
    currentTaskId === taskId ? null : taskId,
  );
  // 关闭 assist 面板（互斥）
  setActiveAssistTaskId(null);
}
```

3. 修改 `handleToggleAssist`，增加互斥逻辑：
```typescript
function handleToggleAssist(taskId: string) {
  setActiveAssistTaskId((currentTaskId) =>
    currentTaskId === taskId ? null : taskId,
  );
  // 关闭 companion 面板（互斥）
  setActiveCompanionTaskId(null);
}
```

4. `<TaskList>` 渲染新增 2 个 props：
```typescript
<TaskList
  // ... 现有 props
  activeAssistTaskId={activeAssistTaskId}
  onToggleAssist={handleToggleAssist}
  goal={taskGroup?.goal ?? ""}
  // V2.5 新增
  activeCompanionTaskId={activeCompanionTaskId}
  onToggleCompanion={handleToggleCompanion}
/>
```

**不改动**：
- 路由守卫逻辑（在 `app/page.tsx` 中，不动）
- `useTaskGroup`、`useTaskReview`、`useTaskStats`、`useTaskHistory` 的任何调用
- 不修改 Header、HeroSection、GoalInput、StatsBar、NewDayPrompt、LoadingState、HistoryPanel 等任何其他组件
- `scheduleStatsRefresh` 等统计相关逻辑

---

## 十四、验收标准

### 14.1 功能验收

| # | 验收项 | 操作 | 预期结果 |
|---|--------|------|------|
| **F1** | "开始陪我做"按钮可见 | 展开 TaskAssistPanel，滚动到底部 | 在 V2.4 4 个按钮下方看到"开始陪我做"入口 |
| **F2** | 点击后进入陪伴面板 | 点击"开始陪我做" | TaskAssistPanel 关闭，TaskCompanionPanel 打开 |
| **F3** | AI 给出第一步 | 进入陪伴面板后自动请求 | loading → AI 返回第一个步骤（80-150 字，1-3 个动作） |
| **F4** | "我完成了"反馈 | 点击"我完成了" | AI 认可完成 + 给出下一步 |
| **F5** | "我卡住了"反馈 | 点击"我卡住了" | AI 承认状态 + 把步骤拆成更小动作 |
| **F6** | "太难了"反馈 | 点击"太难了" | AI 承认难度 + 给出降级/简化方案 |
| **F7** | "鼓励我一下"反馈 | 点击"鼓励我一下" | AI 遵循 4 步结构（承认感受→降低压力→缩小范围→给动作） |
| **F8** | AI 不收鸡汤鼓励 | 多次点击"鼓励我一下" | 不出现"你一定可以的""相信自己""你很棒" |
| **F9** | AI 不收心理诊断 | 多次使用陪伴功能 | 不出现"你看起来很焦虑"等诊断语句 |
| **F10** | "退出陪伴" | 点击"退出陪伴" | 面板关闭，回到 TaskItem 初始状态 |
| **F11** | AI 判断收尾 | 多轮"我完成了"推进任务 | AI 输出 `[DONE]` → UI 显示 done 状态 + "去勾选完成吧" |
| **F12** | done 状态按钮变化 | 进入 done 状态 | "我完成了/我卡住了/太难了"按钮隐藏，保留"鼓励我一下"和"退出陪伴" |
| **F13** | 复制当前步骤 | 点击"复制当前步骤" | 步骤文本复制到剪贴板，临时显示"已复制" |
| **F14** | 退出后再进入 | 退出陪伴 → 再次点击"开始陪我做" | 重新开始，不保留上次上下文 |
| **F15** | 陪伴不自动完成任务 | 使用陪伴模式多轮后 | TaskItem checkbox 仍然未勾选（除非用户手动勾选） |
| **F16** | 陪伴不自动创建任务 | 使用陪伴模式后 | 任务列表不变（无新任务出现） |
| **F17** | 面板互斥（companion → assist） | 打开陪伴面板 → 点击同一任务的"AI 帮我一下" | 陪伴面板关闭，assist 面板打开 |
| **F18** | 面板互斥（assist → companion） | 打开 assist 面板 → 点击"开始陪我做" | assist 面板关闭，陪伴面板打开 |

### 14.2 回归验收

| # | 验收项 | 预期结果 |
|---|--------|---------|
| R1 | V2.4 的 4 个辅助按钮（怎么开始/拆小一点/5分钟版本/我卡住了） | 行为完全不变 |
| R2 | 任务生成 | 不受影响 |
| R3 | 任务勾选 | 不受影响 |
| R4 | 清空 / 重新生成 / 开始新一天 | 不受影响 |
| R5 | 历史记录 | 不受影响 |
| R6 | 统计数据 | 不受影响 |
| R7 | AI 复盘 | 不受影响 |
| R8 | 智能调整 | 不受影响 |
| R9 | OTP 登录 | 不受影响 |
| R10 | 密码登录 | 不受影响 |
| R11 | 忘记密码 / 重置密码 | 不受影响 |
| R12 | Turnstile 人机验证 | 不受影响 |
| R13 | AI 辅助面板（V2.4 TaskAssistPanel） | 不受影响 |

### 14.3 安全验收

| # | 验收项 | 验证方式 | 预期结果 |
|---|--------|------|------|
| S1 | API Route 需认证 | 不登录直接 curl `/api/task-companion` | 返回 401 `UNAUTHORIZED` |
| S2 | API Key 不泄露 | 浏览器 Network 面板审查 | 请求/响应中不出现 `AI_API_KEY` |
| S3 | 不持久化 | 进入陪伴模式 → 刷新页面 | 陪伴面板关闭，状态丢失 |
| S4 | System Prompt 不来自前端 | 审查 API Route 代码 | System Prompt 完全在服务端构造 |
| S5 | 原始 AI 异常不暴露 | 模拟 AI 调用失败 | 返回中文错误消息，不包含原始异常信息 |
| S6 | 不访问任务完成状态 | 审查 API Route 代码 | 无 Supabase 读写操作 |

### 14.4 技术门禁

```bash
npm run lint     # 零 error，零 warning
npm run build    # Compiled successfully，TypeScript 类型检查通过
git status --short   # 仅 V2.5 允许的文件变更（5 新 + 5 改），无意外修改
```

---

## 十五、风险矩阵

### P0 — 阻塞（必须杜绝）

| # | 风险 | 影响 | 缓解措施 |
|---|------|------|----------|
| **P0-1** | AI 替用户完整完成任务 | 产品定位崩塌 | Prompt 明确禁止 + 验收测试 F9/F15/F16 |
| **P0-2** | 自动勾选任务 | 破坏 Human-in-the-Loop | API 不访问 Task 完成状态；组件不渲染 checkbox |
| **P0-3** | 改坏 V2.4 任务勾选逻辑 | 核心功能受损 | TaskItem checkbox/onToggle 零修改 |
| **P0-4** | task-companion API 未校验登录 | 安全漏洞 | `getAuthenticatedUserId()` 校验，与 task-assist 一致 |
| **P0-5** | AI API Key 暴露到前端 | 账单/安全风险 | Key 仅在服务端 `process.env` 中使用 |
| **P0-6** | 使用 `callAIWithPrompts` 而非 `callAIWithPlainText` | 重现 V2.4 Hotfix 根因 | 执行方案明确指定 `callAIWithPlainText`；Code Review 重点检查 |
| **P0-7** | 影响 review API | 回归 Bug | `ai-client.ts` 不修改；review API 使用 `callAIWithPrompts` 不变 |
| **P0-8** | 影响 V2.4 4 个辅助按钮 | 回归 Bug | TaskAssistPanel 仅新增底部入口按钮，4 个按钮逻辑零修改 |

### P1 — 严重影响体验

| # | 风险 | 影响 | 缓解措施 |
|---|------|------|----------|
| **P1-1** | AI 输出太长（超过 150 字/3 个动作） | 用户不读、不执行 | Prompt 明确长度约束 + parser 截断 300 字 |
| **P1-2** | 陪伴状态混乱（assist/companion 同时可见） | 用户困惑 | MainWorkspace 互斥逻辑：打开 companion 清除 assist，打开 assist 清除 companion |
| **P1-3** | AI 不按反馈信号调整 | 陪伴无效 | Prompt 明确 5 种信号处理策略 + 验收测试 F4-F7 |
| **P1-4** | 鼓励变成空泛鸡汤 | 用户反感 | 4 步结构在 System Prompt 中硬约束 + Prompt 示例 + 验收测试 F8 |
| **P1-5** | 暴露原始 AI 异常 | 安全 + 体验风险 | API Route catch 所有异常统一映射中文错误码 |
| **P1-6** | 陪伴状态刷新后丢失导致用户困惑 | 体验中断 | MVP 接受（架构文档明确）。Panel mount 时自动 startCompanion 重新开始 |
| **P1-7** | 复制按钮在非 HTTPS 环境失败 | 体验小问题 | `navigator.clipboard.writeText` 失败时静默处理，不报错 |

### P2 — 可接受但建议后续优化

| # | 风险 | 后续建议 |
|---|------|----------|
| **P2-1** | 不持久化导致刷新丢失 | V2.6 轻量行为记录 |
| **P2-2** | 移动端按钮布局可优化 | 后续 UI 打磨 |
| **P2-3** | 陪伴文案还需调优 | 上线后收集反馈迭代 Prompt |
| **P2-4** | stepHistory 仅 5 条可能不够上下文 | V2.5 MVP 保持最近 5 条 stepHistory，后续 V2.6 再根据真实使用数据评估是否扩展到 10 条 |
| **P2-5** | `[DONE]` 检测依赖 AI 遵守格式 | 若 AI 不输出 `[DONE]`，任务永不进入 done 状态。V2.5 MVP 暂不做启发式 done 判断，只识别明确的 `[DONE]` 标记，避免误判任务已完成。后续 V2.6 再评估是否需要启发式 fallback |

---

## 十六、Codex 实施步骤

### V2.5-1：基础设施层（类型 + Prompt + Parser）

| 步骤 | 文件 | 操作 | 说明 |
|:---:|------|:---:|------|
| 1.1 | `src/lib/types.ts` | 🔧 修改 | 在文件末尾（`AssistResponse` 之后）追加 V2.5 类型（~30 行） |
| 1.2 | `src/prompts/task-companion.ts` | ✨ 新增 | 创建 `COMPANION_SYSTEM_PROMPT` + `buildCompanionUserPrompt`（~90 行） |
| 1.3 | `src/lib/task-companion-parser.ts` | ✨ 新增 | 创建 `parseCompanionAIResponse` + `ParseCompanionAIResponseError`（~70 行） |

**阶段门禁**：
```bash
npm run lint   # 零 error
npm run build  # 通过（类型定义 + 新增文件无语法错误）
```

### V2.5-2：API Route

| 步骤 | 文件 | 操作 | 说明 |
|:---:|------|:---:|------|
| 2.1 | `src/app/api/task-companion/route.ts` | ✨ 新增 | 创建 POST handler，使用 `callAIWithPlainText`（~100 行） |

**阶段门禁**：
```bash
npm run lint   # 零 error
npm run build  # 通过（/api/task-companion 在 build output 中注册）
```

### V2.5-3：Hook + UI 组件

| 步骤 | 文件 | 操作 | 说明 |
|:---:|------|:---:|------|
| 3.1 | `src/hooks/useTaskCompanion.ts` | ✨ 新增 | 创建 `useTaskCompanion` hook（~120 行） |
| 3.2 | `src/components/TaskCompanionPanel.tsx` | ✨ 新增 | 创建陪伴面板 UI 组件（~220 行） |

**阶段门禁**：
```bash
npm run lint   # 零 error
npm run build  # 通过
```

### V2.5-4：集成层

| 步骤 | 文件 | 操作 | 说明 |
|:---:|------|:---:|------|
| 4.1 | `src/components/TaskAssistPanel.tsx` | 🔧 修改 | 新增 `onStartCompanion` prop + 底部"开始陪我做"入口按钮（+20 行） |
| 4.2 | `src/components/TaskItem.tsx` | 🔧 修改 | 新增 `isCompanionOpen`/`onToggleCompanion` props + TaskCompanionPanel 条件渲染（+15 行） |
| 4.3 | `src/components/TaskList.tsx` | 🔧 修改 | 新增 `activeCompanionTaskId`/`onToggleCompanion` props + 透传（+8 行） |
| 4.4 | `src/components/MainWorkspace.tsx` | 🔧 修改 | 新增 `activeCompanionTaskId` state + `handleToggleCompanion` + 互斥逻辑（+10 行） |

**阶段门禁**：
```bash
npm run lint    # 零 error
npm run build   # Compiled successfully
git status --short  # 确认仅 10 个文件变更（5 新 + 5 改），无意外修改
```

### V2.5-5：全量验证

| 步骤 | 内容 |
|:---:|------|
| 5.1 | 执行验收标准 F1-F18（功能验收） |
| 5.2 | 执行验收标准 R1-R13（回归验收） |
| 5.3 | 执行验收标准 S1-S6（安全验收） |
| 5.4 | 执行技术门禁（lint + build + git status） |

### V2.5-Review：审查层

| 步骤 | 执行者 | 内容 |
|:---:|:---:|------|
| 6.1 | Claude Code | Code Review（git diff 逐文件确认） |
| 6.2 | ChatGPT | 最终把关 |
| 6.3 | — | 提交 |

---

## 十七、Claude Code Review 清单

后续 Claude Code 进行 V2.5 Code Review 时，必须逐项检查以下清单：

### 17.1 API 层

| # | 检查项 |
|---|--------|
| 1 | `task-companion/route.ts` 是否使用 `callAIWithPlainText`（不是 `callAIWithPrompts`） |
| 2 | `getAuthenticatedUserId()` 是否无参调用 |
| 3 | System Prompt 是否完全在服务端构造（不来自前端） |
| 4 | User Prompt 是否仅使用前端传来的 `taskTitle`/`goal`/`currentStep`/`stepHistory`/`userSignal` |
| 5 | `userSignal` 是否有枚举校验（5 个值） |
| 6 | API Key 是否仅在 `process.env` 中读取 |
| 7 | 是否不访问数据库（不读/不写 Supabase） |
| 8 | 错误响应是否使用预定义中文错误码 |
| 9 | 是否不返回原始 AI 异常 |
| 10 | 是否有 rate limit |

### 17.2 Prompt 层

| # | 检查项 |
|---|--------|
| 11 | `COMPANION_SYSTEM_PROMPT` 是否明确要求纯文本输出 |
| 12 | 是否包含鼓励 4 步结构（承认感受→降低压力→缩小范围→给动作） |
| 13 | 是否禁止空泛鸡汤（"你一定可以的""相信自己""你很棒"） |
| 14 | 是否禁止心理诊断 |
| 15 | 是否禁止完整代写 |
| 16 | 是否禁止输出完整计划（每次只给一个步骤） |
| 17 | `buildCompanionUserPrompt` 是否为纯函数 |
| 18 | 5 种 userSignal 是否都有对应的处理指令 |

### 17.3 Parser 层

| # | 检查项 |
|---|--------|
| 19 | 是否不包含 JSON 解析逻辑（与 task-assist-parser 的区别） |
| 20 | `[DONE]` 检测是否大小写不敏感 |
| 21 | 截断是否在 `[DONE]` 检测之后 |
| 22 | 空内容是否抛 `ParseCompanionAIResponseError` |
| 23 | 截断后缀是否为 `…` |
| 24 | 是否清理代码块标记 |
| 25 | 是否清理 Markdown 标题/粗体/斜体符号 |
| 26 | 是否返回 `CompanionStep { message, companionState }` 而非 `string` |

### 17.4 Hook 层

| # | 检查项 |
|---|--------|
| 27 | 是否有 `inflightRef` 防重复请求 |
| 28 | 是否有 `requestIdRef` 防竞态 |
| 29 | `startCompanion` 是否自动 POST `userSignal: "start"` |
| 30 | `sendSignal` 是否携带 `currentStep` 和 `stepHistory` |
| 31 | `stepHistory` 是否只保留最近 5 条 |
| 32 | 是否不写 localStorage / sessionStorage / 数据库 |
| 33 | 错误是否映射为中文 |
| 34 | 是否不暴露原始异常 |
| 35 | status 状态机是否完整（idle/loading/active/done/error） |

### 17.5 UI 组件层

| # | 检查项 |
|---|--------|
| 36 | TaskCompanionPanel mount 时是否自动调用 `startCompanion()` |
| 37 | 5 个反馈按钮是否全部可用（done/stuck/too_hard/encourage + 退出陪伴） |
| 38 | done 状态下是否隐藏"我完成了/我卡住了/太难了"按钮 |
| 39 | 是否保留"鼓励我一下"和"退出陪伴"按钮在 done 状态 |
| 40 | "退出陪伴"按钮是否调用 `exitCompanion()` + `onClose()` |
| 41 | 复制按钮是否有"已复制"临时反馈 |
| 42 | 步骤文本是否使用 `whitespace-pre-line` |
| 43 | 按钮最小高度是否 ≥44px（`min-h-11`） |
| 44 | 移动端是否使用 2×2 网格布局 |

### 17.6 集成层

| # | 检查项 |
|---|--------|
| 45 | MainWorkspace 是否有 `handleToggleCompanion` |
| 46 | `handleToggleCompanion` 是否同时清除 `activeAssistTaskId`（互斥） |
| 47 | `handleToggleAssist` 是否同时清除 `activeCompanionTaskId`（互斥） |
| 48 | TaskItem 是否同时条件渲染 TaskAssistPanel 和 TaskCompanionPanel（互斥渲染） |
| 49 | TaskAssistPanel 是否新增 `onStartCompanion` prop 并传递给"开始陪我做"按钮 |
| 50 | V2.4 的 4 个按钮行为是否完全保留 |

### 17.7 不对文件

| # | 检查项 |
|---|--------|
| 51 | `ai-client.ts` 是否未被修改 |
| 52 | review API 是否未被修改 |
| 53 | generate-tasks API 是否未被修改 |
| 54 | 数据库 schema / migration 是否未被修改 |
| 55 | `package.json` 是否未被修改 |
| 56 | `.env.local` 是否未被修改 |

### 17.8 门禁

| # | 检查项 |
|---|--------|
| 57 | `npm run lint` 是否零 error |
| 58 | `npm run build` 是否通过 |
| 59 | `git status --short` 是否仅含预期文件（5 新 + 5 改） |

---

> **文档结束**
>
> **下一阶段**：本文档经 ChatGPT 审查通过后 → Codex 按 §十六「Codex 实施步骤」顺序实施
>
> **关联文档**：
> - [Architecture-V2.5-Task-Companion.md](Architecture-V2.5-Task-Companion.md) — V2.5 架构方案（本文档的设计依据）
> - [Architecture-V2.4-AI-Assist.md](Architecture-V2.4-AI-Assist.md) — V2.4 架构方案（V2.5 的依赖）
> - [Execution-Plan-V2.4-AI-Assist.md](Execution-Plan-V2.4-AI-Assist.md) — V2.4 执行方案（参考格式和模式）
> - [Roadmap-Core-First-V2.3-to-V3.0.md](Roadmap-Core-First-V2.3-to-V3.0.md) — 核心能力优先路线总规划
> - [PROJECT-CONTEXT.md](PROJECT-CONTEXT.md) — 项目长期上下文
> - [PROJECT-INDEX.md](PROJECT-INDEX.md) — 项目文件索引
