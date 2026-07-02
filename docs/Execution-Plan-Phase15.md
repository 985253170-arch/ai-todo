# Phase 15 执行方案 — 智能任务调整

> **状态**：执行方案，待 ChatGPT Review 通过后由 Codex 实现
> **依赖**：Phase 14（全部完成并通过验收）
> **上级文档**：[Architecture-Phase15.md](./Architecture-Phase15.md)
> **制定日期**：2026-07-02

---

## 目录

- [一、阶段目标](#一阶段目标)
- [二、允许修改文件](#二允许修改文件)
- [三、禁止修改文件](#三禁止修改文件)
- [四、文件级实现计划](#四文件级实现计划)
  - [4.1 `src/lib/adjust-task-strategy.ts` — 新建](#41-srclibadjust-task-strategyts--新建)
  - [4.2 `src/lib/types.ts` — 类型扩展](#42-srclibtypests--类型扩展)
  - [4.3 `src/prompts/task-generation.ts` — Prompt 增强](#43-srcpromptstask-generationts--prompt-增强)
  - [4.4 `src/lib/ai-client.ts` — 支持 Prompt override](#44-srclibai-clientts--支持-prompt-override)
  - [4.5 `src/app/api/generate-tasks/route.ts` — stats 读取 + 注入](#45-srcappapigenerate-tasksroutets--stats-读取--注入)
  - [4.6 `src/hooks/useTaskGroup.ts` — 前端传参](#46-srchooksusetaskgroupts--前端传参)
- [五、实施顺序](#五实施顺序)
- [六、验收标准](#六验收标准)
- [七、风险自查](#七风险自查)
- [八、给 Codex 的执行边界提醒](#八给-codex-的执行边界提醒)

---

## 一、阶段目标

### 1.1 一句话目标

修改 `POST /api/generate-tasks`，使服务端读取用户历史统计并自动调整任务生成策略。

### 1.2 四条核心行为

| 场景 | 当前行为（Phase 14） | Phase 15 行为 |
|------|---------------------|--------------|
| **新用户 / 无历史** | 固定生成 3-8 条 | 行为不变（回退 V1.0，3-5 条正常难度） |
| **低完成率**（7 天 < 50%） | 固定生成 3-8 条 | 生成 3-4 条更轻量、更具体、低门槛任务 |
| **高完成率**（7 天 ≥ 80% + 连续 ≥ 7 天） | 固定生成 3-8 条 | 生成 5-7 条适度深入的任务 |
| **stats 读取失败** | N/A | 静默回退 V1.0，不阻断任务生成 |

### 1.3 实现策略

```
服务端路径：
  request body { goal, deviceId?, timezoneOffset? }
    → getAuthenticatedUserId()              ← 新增
    → computeAllStats(supabase, ...)        ← 新增
    → computeAdjustment(stats)              ← 新增
    → buildPrompt(goal, stats, adjustment)  ← 增强
    → callAIService({ goal, userPrompt })   ← 支持 override
    → parseAIResponse()                     ← 不变
    → 返回 TaskGroup                        ← 不变

前端路径（useTaskGroup.generateTasks）：
  fetch body 新增 deviceId + timezoneOffset
  其余完全不变
```

---

## 二、允许修改文件

经审查，架构方案列出的 6 个文件是必要且充分的：

| # | 文件 | 操作 | 理由 |
|---|------|:---:|------|
| 1 | `src/lib/adjust-task-strategy.ts` | **新建** | 纯函数封装调整策略，独立可测试 |
| 2 | `src/lib/types.ts` | **修改** | `GenerateTasksRequest` 需新增 2 个可选字段 |
| 3 | `src/prompts/task-generation.ts` | **修改** | `buildPrompt` 需接受 stats + adjustment |
| 4 | `src/lib/ai-client.ts` | **修改** | `callAIService` 需支持 userPrompt override |
| 5 | `src/app/api/generate-tasks/route.ts` | **修改** | 核心改动：读取 stats → 注入 Prompt |
| 6 | `src/hooks/useTaskGroup.ts` | **修改** | fetch body 新增 deviceId + timezoneOffset |

### 2.1 是否可以减少修改面

| 文件 | 是否可以跳过 | 分析 |
|------|:---:|------|
| `ai-client.ts` | ❌ 不可跳过 | `callAIService` 内部硬编码 `buildPrompt(options.goal)` 构建 user message。不提供 override 机制则无法注入增强 Prompt。改动极小（接口 +2 字段，函数体改 2 行） |
| `types.ts` | ❌ 不可跳过 | 没有类型定义 Codex 无法在 generate-tasks route 中安全读取 `deviceId` / `timezoneOffset` |
| `useTaskGroup.ts` | ❌ 不可跳过 | 前端不传参则服务端收不到 `deviceId` / `timezoneOffset`，stats 无法查询 |

**结论**：6 个文件全部必要，无冗余。

---

## 三、禁止修改文件

以下文件**严禁修改**：

```
# ═══ 复用模块（只读调用，不改） ═══
src/lib/stats-calculator.ts          ← computeAllStats() 已稳定，只调用不改
src/lib/task-parser.ts               ← parseAIResponse() JSON 解析不变
src/lib/review-parser.ts             ← Phase 14 产物，与 Phase 15 无关
src/lib/input-validator.ts           ← 参数校验不变
src/lib/constants.ts                 ← 错误消息不变
src/lib/supabase-server.ts           ← getAuthenticatedUserId / getSupabaseServerClient 已稳定
src/lib/supabase-client.ts           ← 客户端 Supabase，不需要改
src/lib/device-id.ts                 ← getOrCreateDeviceId 已稳定

# ═══ Phase 14 产物（不改） ═══
src/prompts/task-review.ts           ← Phase 14A 产物
src/app/api/task-groups/review/route.ts  ← Phase 14A 产物（核心红线）

# ═══ 其他 API（不改） ═══
src/app/api/task-groups/stats/route.ts
src/app/api/task-groups/history/route.ts
src/app/api/task-group/save/route.ts
src/app/api/task-group/load/route.ts
src/app/api/task-group/delete/route.ts
src/app/api/task-group/migrate/route.ts

# ═══ 前端组件（不改） ═══
src/components/TaskList.tsx
src/components/StatsBar.tsx
src/components/HistoryPanel.tsx
src/components/TaskReviewPanel.tsx
src/components/Header.tsx
src/components/HeroSection.tsx
src/components/GoalInput.tsx
src/components/NewDayPrompt.tsx
src/components/LoadingState.tsx
src/components/StatCard.tsx
src/components/TaskItem.tsx
src/components/TaskProgress.tsx
src/components/CompleteAllPrompt.tsx
src/components/EmptyState.tsx
src/components/ErrorMessage.tsx

# ═══ 前端 hooks（不改） ═══
src/hooks/useTaskReview.ts
src/hooks/useTaskStats.ts
src/hooks/useTaskHistory.ts
src/hooks/useAuth.ts

# ═══ 主页面（不改） ═══
src/app/page.tsx

# ═══ 基础设施（不改） ═══
package.json
.env.local
数据库 schema / migration 文件
```

---

## 四、文件级实现计划

### 4.1 `src/lib/adjust-task-strategy.ts` — 新建

#### 4.1.1 文件定位

纯函数模块。输入 `StatsData`，输出调整策略。无副作用、无 DB 访问、无环境变量、无 AI 调用。

#### 4.1.2 导出接口

```typescript
export interface AdjustmentResult {
  difficulty: "lighter" | "normal" | "deeper";
  countRange: [number, number];  // [min, max]，始终在 [3, 7] 范围内
  reason: string;                // 中文说明，注入 Prompt 给 AI 参考
}
```

#### 4.1.3 导出函数

```typescript
export function computeAdjustment(stats: StatsData): AdjustmentResult
```

#### 4.1.4 实现逻辑（5 级阶梯）

```
输入：stats.sevenDay.completionRate（number | null）
      stats.total.activeDayStreak（number）
      stats.total.totalCompleted（number）

判断顺序（从上到下，命中即返回）：

1. totalCompleted === 0 || rate === null
   → { difficulty: "normal", countRange: [3, 5],
       reason: "新用户，无历史数据，使用默认策略。" }

2. rate < 0.3
   → { difficulty: "lighter", countRange: [3, 3],
       reason: "最近7天完成率偏低，建议生成最少量的轻量任务，降低完成门槛。" }

3. rate < 0.5
   → { difficulty: "lighter", countRange: [3, 4],
       reason: "最近7天完成率偏低，建议减少任务数量并降低每条的完成门槛。" }

4. rate >= 0.8 && streak >= 7
   → { difficulty: "deeper", countRange: [5, 7],
       reason: "近期完成率高且连续行动稳定，可以适度增加挑战。" }

5. rate >= 0.7
   → { difficulty: "normal", countRange: [4, 6],
       reason: "近期完成率不错，可以稍微增加任务量。" }

6. 默认（50%-69%）
   → { difficulty: "normal", countRange: [3, 5],
       reason: "保持当前节奏。" }
```

#### 4.1.5 依赖

```typescript
import type { StatsData } from "@/lib/types";
```

仅依赖类型，无运行时依赖。

#### 4.1.6 注意事项

- `rate` 的类型是 `number | null`，务必先检查 `rate === null` 再比较数值
- `streak` 的类型是 `number`，直接比较即可
- `countRange` 是 tuple `[number, number]`，不是 `number[]`
- 所有分支必须有 `reason` 字符串，用于注入 Prompt
- 纯函数，不抛异常

---

### 4.2 `src/lib/types.ts` — 类型扩展

#### 4.2.1 修改位置

找到 `GenerateTasksRequest` 接口定义（当前约第 86-88 行）：

```typescript
export interface GenerateTasksRequest {
  goal: string;
}
```

#### 4.2.2 修改后

```typescript
export interface GenerateTasksRequest {
  goal: string;
  deviceId?: string;        // Phase 15: 匿名态标识（已登录时忽略）
  timezoneOffset?: number;  // Phase 15: 本地时区偏移量（分钟），默认 -480（UTC+8）
}
```

#### 4.2.3 不改的内容

- `GenerateTasksSuccessResponse` — 不变
- `GenerateTasksErrorResponse` — 不变
- `GenerateTasksResponse` — 不变
- `ApiErrorCode` — 不变
- `Task` / `TaskGroup` — 不变
- `StatsData` / `TodayStats` / `SevenDayStats` / `TotalStats` — 不变
- 所有 Phase 14 类型（`ReviewData` 等） — 不变

#### 4.2.4 注意事项

- 两个新字段都是可选的（`?`），确保向后兼容
- `deviceId` 的类型是 `string`，不是 `string | undefined`（与 `StatsOwnerFilter.deviceId` 一致）
- 不新增 `userId` 字段（安全红线）

---

### 4.3 `src/prompts/task-generation.ts` — Prompt 增强

#### 4.3.1 当前文件结构

```
export const SYSTEM_PROMPT = `...`;       // 约 19 行
const bigGoalKeywords = [...];            // 1 行
export function buildPrompt(goal) { ... } // 约 15 行
```

#### 4.3.2 System Prompt 修改

在 SYSTEM_PROMPT 中修改 1 行 + 新增 1 行：

**修改**（规则 3）：
```
3. 生成 3 到 8 条任务。
```
→
```
3. 生成 3 到 8 条任务，根据用户近期的完成情况调整数量和难度。
```

**新增**（规则 8，在禁止事项之前）：
```
8. 如果用户提示中建议了任务数量和难度方向，请优先遵循该建议。
```

其余 System Prompt 内容完全不变。

#### 4.3.3 `buildPrompt` 函数签名修改

```typescript
// 当前
export function buildPrompt(goal: string): string

// Phase 15 — 注意保持向后兼容
export function buildPrompt(
  goal: string,
  stats?: StatsData,
  adjustment?: AdjustmentResult,
): string
```

> **关键**：`stats` 和 `adjustment` 都是可选参数。调用方不传时函数行为与当前完全一致。

#### 4.3.4 `buildPrompt` 函数体修改

**保留**现有逻辑：
```typescript
const trimmedGoal = goal.trim();
const isBigGoal = bigGoalKeywords.some((keyword) => trimmedGoal.includes(keyword));
const guidance = isBigGoal
  ? "这个目标可能较大，请只生成今天可以开始执行的第一组轻量任务。"
  : "请直接生成今天可以执行的轻量任务。";
```

**新增**历史上下文构建（在 `guidance` 之后、最终拼接之前）：

```typescript
let historyContext = "";

if (stats && adjustment) {
  const rateDisplay = stats.sevenDay.completionRate !== null
    ? `${Math.round(stats.sevenDay.completionRate * 100)}%`
    : "暂无数据";

  historyContext = [
    "",
    "历史统计（仅供你参考，不要展示给用户）：",
    `- 最近 7 天完成率：${rateDisplay}`,
    `- 连续行动天数：${stats.total.activeDayStreak} 天`,
    `- 最近 7 天未完成任务：${stats.recentIncompleteTaskCount} 个`,
    `- 表现状态：${stats.performanceLabel}`,
    "",
    "调整建议：",
    `- 建议任务难度：${adjustment.difficulty === "lighter" ? "更轻量" : adjustment.difficulty === "deeper" ? "可稍深入" : "正常难度"}`,
    `- 建议生成 ${adjustment.countRange[0]}-${adjustment.countRange[1]} 条任务`,
    `- 调整原因：${adjustment.reason}`,
  ].join("\n");

  // ═══ 特殊场景追加文案 ═══
  if (adjustment.difficulty === "lighter") {
    historyContext += "\n\n特别提醒：用户近期完成率偏低。请生成更容易开始的任务——每条任务门槛极低（15分钟内能完成），不需要前置条件，完成感强。避免生成模糊的\"学习/了解/掌握 X\"类任务。";
  }

  if (adjustment.difficulty === "deeper") {
    historyContext += "\n\n特别提醒：用户近期完成率很高且连续行动稳定。可以适度增加任务挑战——每条任务仍应今天可完成，但可以包含 1-2 条需要更多专注或思考的任务。不要为了增加难度而生成模糊或不可操作的任务。";
  }
}
```

**修改**返回语句（使用 `.filter(Boolean).join("\n\n")` 确保无 stats 时不出现空行）：

```typescript
return [
  `用户目标：${trimmedGoal}`,
  guidance,
  historyContext,                                              // Phase 15 新增
  `请返回 3 到 8 条任务，严格使用 JSON 格式：{"tasks":[{"title":"任务标题"}]}`,
]
  .filter(Boolean)
  .join("\n\n");
```

> `historyContext` 为空字符串时被 `.filter(Boolean)` 过滤掉，输出与当前 `buildPrompt(goal)` 完全一致。

#### 4.3.5 新增 import

```typescript
import type { AdjustmentResult, StatsData } from "@/lib/types";
```

> 注意：`AdjustmentResult` 是在 `adjust-task-strategy.ts` 中定义的，但 `task-generation.ts` 只使用其类型（TypeScript 的 `import type` 不会产生运行时依赖）。两个文件也可以选择都在 `types.ts` 中定义类型来避免跨文件类型引用。**推荐**：将 `AdjustmentResult` 类型也放入 `types.ts`，因为 `task-generation.ts` 和 `generate-tasks/route.ts` 都需要使用它。详见 §4.2 的补充说明。

#### 4.3.6 关键验证点

- `stats` 为 `undefined` 时 → 输出与当前完全一致
- `stats.sevenDay.completionRate` 为 `null` 时 → 显示"暂无数据"，不报错
- `adjustment.difficulty` 为 `"normal"` 时 → 不追加特殊场景文案
- 中文字符串不出现在 `historyContext` 外的用户可见位置

---

### 4.4 `src/lib/ai-client.ts` — 支持 Prompt override

#### 4.4.1 修改位置

`AIClientOptions` 接口（当前约第 3-8 行）：

```typescript
interface AIClientOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  goal: string;
}
```

#### 4.4.2 修改后

```typescript
interface AIClientOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  goal: string;
  systemPrompt?: string;  // Phase 15: 可选 override，不传则使用默认 SYSTEM_PROMPT
  userPrompt?: string;    // Phase 15: 可选 override，不传则使用 buildPrompt(goal)
}
```

#### 4.4.3 `requestChatCompletion` 函数体修改

找到 messages 数组构建位置（当前约第 53-58 行）：

```typescript
messages: [
  { role: "system", content: SYSTEM_PROMPT },
  { role: "user", content: buildPrompt(options.goal) },
],
```

修改为：

```typescript
messages: [
  { role: "system", content: options.systemPrompt ?? SYSTEM_PROMPT },
  { role: "user", content: options.userPrompt ?? buildPrompt(options.goal) },
],
```

**仅改 2 行**。其余 `requestChatCompletion` 逻辑（API 请求、错误处理、response_format）不变。

#### 4.4.4 兼容性保障

| 调用方 | 是否传 override | 行为 |
|--------|:---:|------|
| Phase 14 generate-tasks | 不传 | `SYSTEM_PROMPT` + `buildPrompt(goal)`（不变） |
| Phase 15 generate-tasks | 传 `userPrompt` | `SYSTEM_PROMPT`（不变）+ 增强版 userPrompt |
| 未来其他调用方 | 不传 | 默认行为（不变） |

> Phase 14 的 `callAIWithPrompts` 使用独立的代码路径（`requestChatCompletionWithPrompts`），完全不受此修改影响。

#### 4.4.5 注意事项

- `SYSTEM_PROMPT` 的 import 保持在文件顶部不变
- `buildPrompt` 的 import 保持在文件顶部不变
- 不要修改 `callAIWithPrompts` 及其相关函数
- 不要修改 `taskJsonSchema`
- 不要修改 `normalizeBaseUrl`

---

### 4.5 `src/app/api/generate-tasks/route.ts` — stats 读取 + 注入

#### 4.5.1 当前文件结构

```
import { callAIService } from "@/lib/ai-client";
import { ERROR_MESSAGES } from "@/lib/constants";
import { checkRiskInput, validateGoalInput } from "@/lib/input-validator";
import { parseAIResponse, ParseAIResponseError } from "@/lib/task-parser";
import type { ApiErrorCode, GenerateTasksErrorResponse, GenerateTasksRequest,
              GenerateTasksSuccessResponse, Task, TaskGroup } from "@/lib/types";

function errorResponse(code, status) { ... }
function createTaskGroup(goal, taskTitles) { ... }
export async function POST(request: NextRequest) { ... }
```

#### 4.5.2 新增 import

```typescript
import { computeAdjustment } from "@/lib/adjust-task-strategy";         // Phase 15 新增
import { computeAllStats } from "@/lib/stats-calculator";               // Phase 15 新增
import { getAuthenticatedUserId, getSupabaseServerClient } from "@/lib/supabase-server";  // Phase 15 新增
import { buildPrompt } from "@/prompts/task-generation";                // Phase 15 新增
import type { StatsData } from "@/lib/types";                           // Phase 15 新增
```

#### 4.5.3 新增辅助函数 `parseTimezoneOffset`

```typescript
// 放在 errorResponse 和 createTaskGroup 之后、POST 之前
const DEFAULT_TIMEZONE_OFFSET = -480; // UTC+8

function parseTimezoneOffset(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return DEFAULT_TIMEZONE_OFFSET;
  }
  if (value < -720 || value > 720) {
    return DEFAULT_TIMEZONE_OFFSET;
  }
  return value;
}
```

> 与 Phase 14 review API 的 `parseTimezoneOffset` 逻辑完全一致。

#### 4.5.4 POST 函数修改（核心）

在**参数校验通过后、AI 调用前**插入 stats 读取块：

**当前位置**（约第 82-88 行）：
```typescript
const apiKey = process.env.AI_API_KEY;
if (!apiKey) {
  return errorResponse("AI_GENERATION_FAILED", 500);
}

try {
  const rawAIResponse = await callAIService({ ... });
```

**插入位置**：在 `apiKey` 检查之后、`try { callAIService }` 之前。

**插入代码**：

```typescript
// ═══════════════════════════════════════════
// Phase 15: 读取用户历史统计
// ═══════════════════════════════════════════
const timezoneOffset = parseTimezoneOffset(body.timezoneOffset);
const supabase = getSupabaseServerClient();
const userId = await getAuthenticatedUserId();
const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";

let stats: StatsData | undefined;
let adjustment: import("@/lib/adjust-task-strategy").AdjustmentResult | undefined;
let userPrompt: string | undefined;

if (supabase && (userId || deviceId)) {
  try {
    stats = await computeAllStats(supabase, { userId, deviceId }, timezoneOffset);
    if (stats.total.totalCompleted > 0) {
      adjustment = computeAdjustment(stats);
    }
  } catch {
    // 静默回退：stats 读取失败不阻断任务生成
    // stats 和 adjustment 保持 undefined → buildPrompt 走无历史路径
  }
}

// 构建 User Prompt（增强或默认）
userPrompt = buildPrompt(goal, stats, adjustment);
// ═══════════════════════════════════════════
// Phase 15 新增结束
// ═══════════════════════════════════════════
```

**修改 `callAIService` 调用**（在 try 块内）：

```typescript
// 当前：
const rawAIResponse = await callAIService({
  apiKey,
  baseUrl: process.env.AI_API_BASE_URL,
  model: process.env.AI_MODEL,
  goal,
});

// Phase 15：
const rawAIResponse = await callAIService({
  apiKey,
  baseUrl: process.env.AI_API_BASE_URL,
  model: process.env.AI_MODEL,
  goal,
  userPrompt,  // Phase 15 新增：传入增强 prompt
});
```

#### 4.5.5 完整 POST 函数流程（Phase 15 最终态）

```
1. 解析 request body → { goal, deviceId?, timezoneOffset? }
2. 参数校验（validateGoalInput + checkRiskInput）         ← 不变
3. 检查 AI_API_KEY                                         ← 不变
4. ═══ Phase 15 新增 ═══
   a. parseTimezoneOffset(body.timezoneOffset)
   b. getSupabaseServerClient()
   c. getAuthenticatedUserId()
   d. if (supabase && (userId || deviceId)):
        try: stats = await computeAllStats(...)
             if totalCompleted > 0: adjustment = computeAdjustment(stats)
        catch: 静默回退
   e. userPrompt = buildPrompt(goal, stats, adjustment)
   ═══ Phase 15 新增结束 ═══
5. callAIService({ goal, userPrompt })                     ← 传入 override
6. parseAIResponse(rawAIResponse)                          ← 不变
7. createTaskGroup(goal, taskTitles)                       ← 不变
8. 返回 TaskGroup                                          ← 不变
```

#### 4.5.6 注意事项

- `adjustment` 的类型使用 `import("@/lib/adjust-task-strategy").AdjustmentResult` 或从 `types.ts` 导入（如将类型移至 types.ts）
- `getAuthenticatedUserId()` 是 async 函数，必须 `await`
- `computeAllStats` 的 `ownerFilter` 参数格式为 `{ userId: string | null, deviceId: string }`
- `StatsOwnerFilter` 要求 `deviceId` 为 `string`（非 `string | undefined`），未登录但无 deviceId 时传入空字符串
- `try-catch` 包裹 `computeAllStats` 而不是包裹整个 POST 逻辑——只有 stats 读取失败时才回退
- `parseAIResponse` 和错误处理完全不动
- `createTaskGroup` 完全不动

#### 4.5.7 静默回退的所有触发条件

| 条件 | 结果 |
|------|------|
| `supabase === null`（环境变量未配置） | stats=undefined → V1.0 行为 |
| `!userId && !deviceId`（未登录且前端未传 deviceId） | stats=undefined → V1.0 行为 |
| `computeAllStats` 抛异常（DB 超时/错误） | stats=undefined → V1.0 行为 |
| `stats.total.totalCompleted === 0`（新用户） | adjustment=undefined → V1.0 行为 |

所有路径下 `generate-tasks` 都正常返回任务，不报 500。

---

### 4.6 `src/hooks/useTaskGroup.ts` — 前端传参

#### 4.6.1 修改位置

找到 `requestTaskGroup` 函数内的 fetch 调用（当前约第 279-283 行）：

```typescript
const response = await fetch("/api/generate-tasks", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ goal: goal.trim() }),
});
```

#### 4.6.2 修改后

```typescript
const response = await fetch("/api/generate-tasks", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    goal: goal.trim(),
    deviceId: getOrCreateDeviceId(),               // Phase 15 新增
    timezoneOffset: new Date().getTimezoneOffset(), // Phase 15 新增
  }),
});
```

#### 4.6.3 依赖检查

- `getOrCreateDeviceId` — ✅ 已在文件第 5 行 import
- `new Date().getTimezoneOffset()` — ✅ 浏览器原生 API，无需 import

#### 4.6.4 注意事项

- 仅修改 `requestTaskGroup` 中的 fetch body
- 不修改 `useTaskGroup` 的状态管理逻辑
- 不修改 `generateTasks`、`handleToggleTask`、`handleClearTasks` 等其他函数
- 不修改 localStorage 相关逻辑
- 不修改 Supabase 同步逻辑

---

## 五、实施顺序

Codex 必须严格按以下顺序实现，不可并行、不可跳步：

```
第 1 步：src/lib/types.ts
  → 扩展 GenerateTasksRequest（新增 deviceId? / timezoneOffset?）
  → 新增 AdjustmentResult 接口（可选，也可放在 adjust-task-strategy.ts）
  → npm run lint 验证类型

第 2 步：src/lib/adjust-task-strategy.ts
  → 新建文件，实现 computeAdjustment()
  → npm run lint 验证

第 3 步：src/prompts/task-generation.ts
  → 修改 SYSTEM_PROMPT（2 处）
  → 修改 buildPrompt() 签名和函数体
  → npm run lint 验证

第 4 步：src/lib/ai-client.ts
  → 修改 AIClientOptions（+2 字段）
  → 修改 requestChatCompletion（改 2 行）
  → npm run lint 验证

第 5 步：src/app/api/generate-tasks/route.ts
  → 新增 imports
  → 新增 parseTimezoneOffset 辅助函数
  → 新增 stats 读取块（在 apiKey 检查之后、callAIService 之前）
  → 修改 callAIService 调用（传入 userPrompt）
  → npm run lint 验证

第 6 步：src/hooks/useTaskGroup.ts
  → 修改 fetch body（+2 行）
  → npm run lint 验证

第 7 步：npm run build
  → 全量构建验证
```

### 5.1 依赖图

```
types.ts ─────────────────────────────────────────┐
    │                                              │
    ├── adjust-task-strategy.ts ──┐                │
    │       (依赖 types.ts)        │                │
    │                              │                │
    ├── task-generation.ts ───────┤                │
    │       (依赖 types.ts +       │                │
    │        adjust-task-strategy) │                │
    │                              │                │
    ├── ai-client.ts               │                │
    │       (独立，用 ?? 兼容)       │                │
    │                              │                │
    ├── generate-tasks/route.ts ───┘                │
    │       (依赖以上全部)                            │
    │                                              │
    └── useTaskGroup.ts ───────────────────────────┘
            (依赖 types.ts 的类型推断)
```

---

## 六、验收标准

### 6.1 功能验收（10 项）

| # | 验收项 | 验证方法 | 预期结果 |
|---|--------|---------|---------|
| 1 | 新用户 / 无历史 → 行为回退 | 清空 DB → 输入目标 → 生成任务 | 任务 3-5 条，正常难度，无异常 |
| 2 | 低完成率 < 30% → 生成更少更轻任务 | 构造低完成率历史 → 生成任务 | 任务 3 条，粒度细、门槛低、可操作性强 |
| 3 | 低完成率 30-49% → 生成 3-4 条 | 构造中低完成率历史 → 生成任务 | 任务 3-4 条，比普通更轻 |
| 4 | 中等完成率 50-69% → 保持正常 | 构造中等完成率历史 → 生成任务 | 任务 3-5 条，与 Phase 14 行为无显著差异 |
| 5 | 中高完成率 70-79% → 略多任务 | 构造中高完成率 + streak≥3 → 生成任务 | 任务 4-6 条 |
| 6 | 高完成率 + 连续 ≥ 7 天 → 更深任务 | 构造 ≥80% + streak≥7 → 生成任务 | 任务 5-7 条，适度深入但不牺牲可操作性 |
| 7 | stats 读取失败 → 仍能生成任务 | 断网或 Supabase 不可用 → 生成任务 | 正常返回任务，不报 500 |
| 8 | 已登录 → 基于 user_id stats | 登录后生成任务（有历史） | 调整策略反映 user_id 的 stats |
| 9 | 未登录 → 基于 device_id stats | 未登录生成任务（有历史） | 调整策略反映 device_id 的 stats |
| 10 | AI JSON 返回结构不变 | 各种场景下观察 API 返回 | `{ success: true, data: { goal, tasks } }` 格式不变 |

### 6.2 安全验收（5 项）

| # | 验收项 | 验证方法 |
|---|--------|---------|
| 11 | generate-tasks 请求体不含 `userId` | 检查 Network 面板 POST body |
| 12 | generate-tasks 不从 body 读取 `stats` 数据 | Code Review 确认 |
| 13 | `AI_API_KEY` 不出现在前端 bundle | `npm run build` 后搜索 `.next/static` |
| 14 | 登出后 stats 不读到 user_id 数据 | 登录 → 完成任务 → 登出 → 生成任务，验证调整策略切换 |
| 15 | 前端不展示调整策略细节（difficulty/countRange/reason） | 检查 UI，不应出现这些字样 |

### 6.3 回归验收（7 项）

| # | 验收项 | 验证方法 |
|---|--------|---------|
| 16 | TaskList 勾选功能正常 | 生成任务 → 勾选/取消勾选 |
| 17 | StatsBar 统计数据正常 | 查看统计卡片数字更新 |
| 18 | HistoryPanel 历史记录正常 | 打开历史面板验证 |
| 19 | TaskReviewPanel 复盘功能正常 | 生成复盘，验证反馈卡片 |
| 20 | generate-tasks 重新生成正常 | 在同一 taskGroup 下重新生成 |
| 21 | 清空任务正常 | 清空后验证 taskGroup 重置 |
| 22 | 登录/登出切换后功能正常 | 完整走一遍登录→登出→匿名流程 |

### 6.4 质量验收（3 项）

| # | 验收项 |
|---|--------|
| 23 | `npm run lint` 通过 |
| 24 | `npm run build` 通过 |
| 25 | `git status --short` 仅显示允许修改的 6 个文件 |

---

## 七、风险自查

### 7.1 类型安全

| 自查项 | 结论 |
|--------|------|
| `StatsData` 类型是否已在 `types.ts` 中存在？ | ✅ 是，第 76-84 行，Phase 13 产物 |
| `StatsOwnerFilter` 类型是否已有？ | ✅ 是，`stats-calculator.ts` 第 30-33 行导出 |
| `AdjustmentResult` 类型是否需要放入 `types.ts`？ | ⚠️ 推荐放入，避免 `task-generation.ts` 和 `generate-tasks/route.ts` 都需要 `import type` 跨文件引用。在 `types.ts` 中新增：`export interface AdjustmentResult { difficulty: "lighter" \| "normal" \| "deeper"; countRange: [number, number]; reason: string; }` |
| `GenerateTasksRequest` 改后是否破坏现有调用？ | ✅ 否，新字段均为可选（`?`），`{ goal }` 仍合法 |
| `useTaskGroup.ts` 中 `response.json()` 的类型推断是否仍正确？ | ✅ 是，返回类型 `GenerateTasksResponse` 未变 |

### 7.2 异步调用

| 自查项 | 结论 |
|--------|------|
| `computeAllStats` 是否 async？ | ✅ 是（`export async function computeAllStats`），必须 `await` |
| `getAuthenticatedUserId` 是否 async？ | ✅ 是（`export async function getAuthenticatedUserId`），必须 `await` |
| `getSupabaseServerClient` 是否同步？ | ✅ 是（`export function getSupabaseServerClient`），不需要 `await` |
| stats 读取是否阻塞 AI 调用？ | ✅ 是（`await` 在 `callAIService` 之前），但 DB 查询 < 100ms，用户无感知 |

### 7.3 回退安全

| 自查项 | 结论 |
|--------|------|
| `getSupabaseServerClient()` 返回 `null` 时如何回退？ | ✅ `if (supabase && ...)` 短路，stats=undefined → 走无历史路径 |
| `!userId && !deviceId`（未登录且前端未传 deviceId）时如何回退？ | ✅ `if (... && (userId || deviceId))` 短路，stats=undefined |
| `computeAllStats` 抛异常时如何回退？ | ✅ try-catch 包裹，catch 块为空（静默回退） |
| `totalCompleted === 0` 时如何回退？ | ✅ `computeAdjustment` 不被调用，`buildPrompt(goal, undefined, undefined)` → V1.0 等价 |
| 回退后任务生成是否仍然可用？ | ✅ 是，stats 读取失败完全不影响 AI 调用和 JSON 解析 |

### 7.4 循环依赖

| 自查项 | 结论 |
|--------|------|
| `adjust-task-strategy.ts` → `types.ts` | ✅ 单向，types.ts 不依赖 adjust-task-strategy.ts |
| `task-generation.ts` → `types.ts` | ✅ 单向 |
| `generate-tasks/route.ts` → 其他模块 | ✅ 单向（route → lib / prompts），route 不被其他模块 import |
| `ai-client.ts` ↔ `task-generation.ts` | ✅ ai-client.ts import task-generation.ts（已有），方向不变 |
| `useTaskGroup.ts` → `types.ts` | ✅ 单向（已有） |

**结论**：无循环依赖。

### 7.5 AI 调用兼容性

| 自查项 | 结论 |
|--------|------|
| `ai-client.ts` 的 override 是否破坏现有调用？ | ✅ 否，字段可选（`?`），不传时 `??` 回退到默认值 |
| `callAIWithPrompts` 是否受影响？ | ✅ 否，使用独立的 `requestChatCompletionWithPrompts` |
| JSON Schema（`taskJsonSchema`）是否改变？ | ✅ 否，`minItems: 3, maxItems: 8` 不变 |
| 三段式 fallback 是否保持？ | ✅ 是（json_schema → json_object → 无 format） |
| DeepSeek API 是否兼容？ | ✅ 是，OpenAI-compatible，`response_format: json_schema` 不变 |

### 7.6 Prompt 长度

| 自查项 | 结论 |
|--------|------|
| 历史上下文有多长？ | `historyContext` ~280 chars（中文） |
| lighter 追加文案有多长？ | 约 70 chars |
| deeper 追加文案有多长？ | 约 70 chars |
| 最大增加量？ | ~350 chars ≈ ~120 tokens |
| 总 input tokens？ | ~400 tokens（远低于 DeepSeek 64K 上下文窗口） |
| 是否可能超过 AI API 限制？ | ❌ 不可能。V1.0 prompt ~100 chars + history ~350 chars = ~450 chars |

### 7.7 Vercel 部署

| 自查项 | 结论 |
|--------|------|
| 是否新增 npm 依赖？ | ✅ 否 |
| 是否新增环境变量？ | ✅ 否 |
| 是否新增数据库表/字段？ | ✅ 否 |
| 是否改变 API Route 签名（方法/路径）？ | ✅ 否，仍为 `POST /api/generate-tasks` |
| 是否引入文件系统操作？ | ✅ 否 |
| 是否改变构建产物大小？ | ✅ 增量 < 5KB（纯逻辑代码） |

---

## 八、给 Codex 的执行边界提醒

### 8.1 绝对禁止

```
❌ 不要修改 stats-calculator.ts
❌ 不要修改 task-parser.ts
❌ 不要修改 review-parser.ts
❌ 不要修改 review API route
❌ 不要修改任何前端组件（TaskList / StatsBar / HistoryPanel / TaskReviewPanel / ...）
❌ 不要修改 useTaskReview / useTaskStats / useTaskHistory / useAuth
❌ 不要修改 page.tsx
❌ 不要修改 package.json
❌ 不要新增 npm 依赖
❌ 不要修改数据库 schema / migration
❌ 不要修改 .env.local
❌ 不要修改 JSON Schema 的 minItems / maxItems
❌ 不要让 generate-tasks request body 包含 userId
❌ 不要让 generate-tasks request body 包含 stats 数据
❌ 不要修改 generate-tasks 的成功/错误响应格式
❌ 不要在客户端暴露 adjust-task-strategy 逻辑
❌ 不要新增 UI 展示调整策略细节
```

### 8.2 如果发现 bug 的处理流程

| Bug 等级 | 处理方式 |
|---------|---------|
| **P0**（generate-tasks 不可用） | 停止实现，汇报 Claude Code，不自行修复 |
| **P1**（某个边界场景行为异常） | 记录在代码注释中，完成全部 6 步后一次性汇报 |
| **P2**（文案可优化、命名建议） | 记录，不在此 Phase 修改 |

### 8.3 实现完成后必做

```bash
npm run lint
npm run build
git status --short
```

期望 `git status --short` 输出仅包含 6 个文件：

```
M  src/lib/types.ts
M  src/prompts/task-generation.ts
M  src/lib/ai-client.ts
M  src/app/api/generate-tasks/route.ts
M  src/hooks/useTaskGroup.ts
?? src/lib/adjust-task-strategy.ts
```

---

> **文档结束**
>
> **下一阶段**：本文档经 ChatGPT Review 通过后，由 Codex 按 §五 顺序实现。
>
> **关联文档**：
> - `docs/Architecture-Phase15.md` — Phase 15 架构方案
> - `docs/PRD-V2.0.md` — V2.0 产品规划（§15: Phase 15 拆分建议）
> - `docs/Roadmap-Phase12-15.md` — Phase 12-15 中期路线图（§7: Phase 15 定义）
> - `docs/Architecture-Phase13.md` — Phase 13 stats-calculator 架构
> - `docs/Architecture-Phase14.md` — Phase 14 架构（§19: 为 Phase 15 预留）
> - `docs/PROJECT-CONTEXT.md` — 项目长期上下文
