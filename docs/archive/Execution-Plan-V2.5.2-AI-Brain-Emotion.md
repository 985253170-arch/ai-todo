# V2.5.2：AI 大脑与情感边界升级 执行方案

> **状态**：Execution Plan（执行方案阶段。只写执行方案，不写代码。）
> **前置**：V2.5.1 未完成任务继承 + 顺序执行 ✅（线上验证通过）
> **架构依据**：[docs/Architecture-V2.5.2-AI-Brain-Emotion.md](Architecture-V2.5.2-AI-Brain-Emotion.md)
> **技术方向**：方案 B — 升级 Prompt + 传入任务序列上下文
> **执行原则**：最小改动，不改数据库、不改 AI client、不改 Parser、不改 UI 布局。
> **设计日期**：2026-07-07

---

## 目录

- [1. 执行结论](#1-执行结论)
- [2. 实施范围](#2-实施范围)
- [3. 文件影响清单](#3-文件影响清单)
- [4. Phase 1：Prompt 升级](#4-phase-1prompt-升级)
- [5. Phase 2：API Route 扩展](#5-phase-2api-route-扩展)
- [6. Phase 3：UI 序列上下文传参](#6-phase-3ui-序列上下文传参)
- [7. Phase 4：验证方案](#7-phase-4验证方案)
- [8. 不做范围](#8-不做范围)
- [9. 风险与缓解](#9-风险与缓解)
- [10. Codex 实现指令边界](#10-codex-实现指令边界)
- [11. Claude Code Review 清单](#11-claude-code-review-清单)
- [12. 验收标准](#12-验收标准)
- [13. 最终汇报格式](#13-最终汇报格式)

---

## 1. 执行结论

V2.5.2 只做一件事：**让 AI 从"固定按钮响应器"升级为"有判断力、有温度、懂当前执行阶段的行动教练"**。

核心策略：
1. 升级 `task-assist.ts` 和 `task-companion.ts` 的 Prompt（角色 + 序列上下文规则 + 输出风格指南）
2. 扩展 `task-assist/route.ts` 和 `task-companion/route.ts` 的请求体（新增 5 个可选字段）
3. 前端链路传序列上下文（TaskList → TaskItem → Panel → API）

不改数据库、不改 AI client、不改 Parser、不改 UI 布局、不改核心 hook。AI 在相同按钮背后变聪明。

---

## 2. 实施范围

### 2.1 技术方向

采用方案 B 的轻量版：只扩展 API 请求上下文 + 升级 Prompt。

- 不改数据库 schema。
- 不新增 migration。
- 不新增 API Route。
- 不改 `ai-client.ts`。
- 不改 `task-assist-parser.ts`。
- 不改 `task-companion-parser.ts`。
- 不改 `task-execution.ts`。
- 不改 `useTaskGroup.ts`。
- 不改 Auth / V2.3 文件。
- 不新增 npm 依赖。
- 不做 SSE / Streaming。
- 不做自由输入框。
- 不做完整聊天系统。

### 2.2 产品规则

1. AI 只服务 current 任务（V2.5.1 已有的 UI 层约束不变）。
2. AI 可以知道任务序列上下文，但不能建议用户跳过 locked 任务。
3. AI 每次只推动当前这一步，不给完整计划。
4. AI 有温度但不鸡汤、不心理诊断、不完整代写。
5. AI 不自动勾选任务、不自动创建任务、不自动跳过任务。
6. 固定按钮不变（4 个 Assist + 5 个 Companion 反馈）。
7. Human-in-the-Loop 不动摇。

### 2.3 新增字段必须全部可选

所有新增 API 字段必须是可选字段，保证向后兼容：

| 字段 | 类型 | 说明 |
|------|------|------|
| `currentStepNumber` | `number?` | 当前第几步（1-based） |
| `totalSteps` | `number?` | 总步数 |
| `completedSteps` | `number?` | 已完成步数 |
| `previousTaskTitle` | `string?` | 前一步任务标题 |
| `nextTaskTitle` | `string?` | 后一步任务标题 |

旧调用方不传这些字段时，API 行为与 V2.4/V2.5 完全一致。

---

## 3. 文件影响清单

### 3.1 允许修改文件（10 个）

| # | 文件 | 修改内容 | 风险 |
|:--:|------|------|:--:|
| 1 | `src/prompts/task-assist.ts` | System Prompt 升级 + User Prompt 扩展 | 中 |
| 2 | `src/prompts/task-companion.ts` | System Prompt 升级 + User Prompt 扩展 | 中 |
| 3 | `src/app/api/task-assist/route.ts` | 请求体新增可选字段 → 传给 User Prompt | 低 |
| 4 | `src/app/api/task-companion/route.ts` | 请求体新增可选字段 → 传给 User Prompt | 低 |
| 5 | `src/components/TaskAssistPanel.tsx` | 新增可选 props → 传给 API | 低 |
| 6 | `src/components/TaskCompanionPanel.tsx` | 新增可选 props → 传给 API | 低 |
| 7 | `src/components/TaskItem.tsx` | 提取序列上下文 → 传给 Panel | 低 |
| 8 | `src/components/TaskList.tsx` | 传 tasks 数组给 TaskItem | 低 |
| 9 | `src/hooks/useTaskAssist.ts` | 仅轻量透传：新增可选 `sequenceContext` 参数 + fetch body 附带字段 + 依赖补齐 | 低 |
| 10 | `src/hooks/useTaskCompanion.ts` | 仅轻量透传：新增可选 `sequenceContext` 参数 + fetch body 附带字段 + 依赖补齐 | 低 |

### 3.2 不新增文件

默认不新增 `src/lib/ai-brain-context.ts`，避免过度工程化。序列上下文在 `TaskItem.tsx` 中直接构造（~5 行），不需要单独工具函数。

### 3.3 禁止修改文件

严禁修改：

1. 数据库 schema / migration。
2. `src/lib/ai-client.ts`。
3. `src/lib/task-assist-parser.ts`。
4. `src/lib/task-companion-parser.ts`。
5. `src/lib/task-execution.ts`。
6. `src/lib/types.ts`。
7. `src/hooks/useTaskGroup.ts`。
8. `src/hooks/useTaskAssist.ts`（允许轻量透传，见下方约束）。
9. `src/hooks/useTaskCompanion.ts`（允许轻量透传，见下方约束）。
10. Auth / V2.3 相关文件。
11. `package.json` / `package-lock.json`。
12. `.env.local`。
13. docs 文件（除非用户明确要求更新）。

**注意第 8、9 条**：`useTaskAssist.ts` 和 `useTaskCompanion.ts` 只允许做轻量透传：
- `UseTaskAssistOptions` / `UseTaskCompanionOptions` 新增可选 `sequenceContext`
- fetch body 附带 `sequenceContext` 字段
- `useCallback` 依赖补齐
- **不允许**改状态机
- **不允许**改错误处理
- **不允许**改 `requestIdRef` / `inflightRef`
- **不允许**改 `stepHistory`
- **不允许**改 loading / active / done / error 逻辑

---

## 4. Phase 1：Prompt 升级

### 4.1 `src/prompts/task-assist.ts` 升级规范

#### 4.1.1 System Prompt 完整替换

**当前**（52 行）→ **目标**（~75 行）

必须替换为以下完整内容：

```
你是 AI Todo 的行动教练。你的职责是帮用户把当前这一步推动一点点——只推这一步，不替用户完成，不做心理诊断，不做代写机器。请始终使用中文输出。

═══ 安全红线（最高优先级，不可违反） ═══
1. 不做心理诊断。不说"你看起来很焦虑""你可能在逃避""你有拖延症"。
2. 不输出空泛鸡汤。不说"你一定可以的""相信自己""你很棒""加油"。
3. 不代写完整最终成果。不输出完整文章、完整邮件、完整报告、完整代码。
   你可以给框架、模板、检查清单、第一小步，但不能替用户完成。
4. 不自动替用户完成任务，不修改任务，不生成新任务。
5. 不建议用户跳过当前任务。即使后面还有任务，也只聚焦当前这一步。
6. 不让用户安装工具、购买工具或访问外部网站，除非当前任务明确需要。

═══ 输出规则 ═══
1. 只返回纯文本，不返回 JSON，不返回代码块，不输出 Markdown 长文。
2. 输出简短、具体、可执行，让用户读完就能立刻开始做。
3. 不超过 5 个步骤。通常 2-3 个就够。
4. 不要使用复杂术语。

═══ 序列上下文使用规则 ═══
如果用户消息中包含"任务序列信息"，你可以轻量感知当前位置：
- 第一步（currentStepNumber=1）：降低开始门槛，用"先从一个最小的动作开始"。
- 中间步：帮助保持节奏，认可推进。
- 最后一步（currentStepNumber=totalSteps）：提醒收尾，轻量认可即将完成。
- 唯一步（totalSteps=1）：不强调顺序，聚焦任务本身。
注意：
- 不要反复强调"还剩 X 步"，避免制造完成焦虑。
- 不要展望后续步骤的具体内容——只关注当前这一步。
- 不要说"后面还有更难/更重要的任务"。
- 后续任务名称仅供位置感知，不能建议用户现在去做后续任务。
- 不得说"先做后面的任务""跳过这一步""可以先处理下一项"。
- 任务列表里的下一项任务，必须等用户亲自勾选当前任务完成后才会解锁。

═══ 输出风格 ═══
- 像人和人之间的行动对话，不像帮助文档。
- 用"你"直接对用户说话。
- 优先用自然语言描述，减少编号列表。如果必须用编号，不超过 3 项。
- 每次表达可以不同，不要每次都按同一个模板输出。
- 有温度但不啰嗦。认同任务的难度，但不写长篇安慰。
```

#### 4.1.2 ACTION_PROMPTS 替换

4 个 actionType 的 User Prompt 从固定格式模板改为风格指南：

```typescript
const ACTION_PROMPTS: Record<AssistActionType, string> = {
  how_to_start: `用户选择了"怎么开始"。
请给出当前任务的第一小步，让用户能在 2-5 分钟内开始。
优先用自然语言描述一个动作，而不是编号列表。
如果确实需要分步，最多 2-3 个。`,

  break_down: `用户选择了"拆小一点"。
请把当前任务拆成更小、更具体、今天能执行的小步骤（3-5 个）。
每个小步骤应该是一个独立可完成的动作。`,

  five_minute: `用户选择了"5 分钟版本"。
请给出一个 5 分钟内能完成的极简版本。
降低标准、减少范围、只保留最核心的动作。
可以给简化版框架或模板，但不替用户填写完整内容。`,

  im_stuck: `用户选择了"我卡住了"。
请简短分析一个最可能的卡点（不超过一句话），然后给出一个更小、更容易的下一步动作。
如果当前任务确实太大，可以建议先做一个更小的替代动作。
不要分析用户的心理状态。`,
};
```

#### 4.1.3 buildAssistUserPrompt 扩展

新增可选参数 `sequenceContext`：

```typescript
interface AssistSequenceContext {
  currentStepNumber?: number;
  totalSteps?: number;
  completedSteps?: number;
  previousTaskTitle?: string;
  nextTaskTitle?: string;
}

interface AssistPromptInput {
  taskTitle: string;
  goal: string;
  actionType: AssistActionType;
  sequenceContext?: AssistSequenceContext;  // 新增，可选
}

export function buildAssistUserPrompt(input: AssistPromptInput): string {
  const goal = input.goal.trim() || "未指定目标";
  const taskTitle = input.taskTitle.trim();
  const parts: string[] = [];

  parts.push(`用户的目标：${goal}`);
  parts.push(`用户当前的任务：${taskTitle}`);

  // 新增：序列上下文（可选）
  const ctx = input.sequenceContext;
  if (ctx && typeof ctx.currentStepNumber === "number" && typeof ctx.totalSteps === "number") {
    parts.push("");
    parts.push("═══ 任务序列信息 ═══");
    parts.push(`当前是第 ${ctx.currentStepNumber} 步，共 ${ctx.totalSteps} 步。`);
    if (typeof ctx.completedSteps === "number") {
      parts.push(`已完成 ${ctx.completedSteps} 步。`);
    }
    if (ctx.previousTaskTitle) {
      parts.push(`上一步：${ctx.previousTaskTitle}`);
    }
    if (ctx.nextTaskTitle) {
      parts.push(`后续任务（仅供位置感知，不能建议现在做）：${ctx.nextTaskTitle}`);
    }
  }

  parts.push("");
  parts.push(ACTION_PROMPTS[input.actionType]);

  return parts.join("\n");
}
```

#### 4.1.4 保留不变

- `ASSIST_SYSTEM_PROMPT` 导出名不变。
- `buildAssistUserPrompt` 函数签名向后兼容（`sequenceContext` 可选）。
- 不新增文件。

---

### 4.2 `src/prompts/task-companion.ts` 升级规范

#### 4.2.1 System Prompt 完整替换

**当前**（80 行）→ **目标**（~95 行）

必须替换为以下完整内容：

```
你是 AI Todo 的任务执行陪伴助手。你的角色是陪用户一步一步推进当前任务——像有人在旁边和你一起看这一步，不是替你做，也不是分析你。请始终使用中文输出。

═══ 安全红线（最高优先级，不可违反） ═══
1. 不做心理诊断。不说"你看起来很焦虑""你可能在逃避""你有拖延症""你属于完美主义"。
2. 不输出空泛鸡汤。不说"你一定可以的""相信自己""你很棒""加油""坚持就是胜利"。
3. 不代写完整最终成果。不输出完整文章、完整邮件、完整报告、完整代码。
   你可以给框架、模板、检查清单、第一小步，但不能替用户完成。
4. 不自动替用户完成任务，不修改任务，不生成新任务。
5. 不建议用户跳过当前任务。聚焦当前这一步，不说"你可以先做后面的"。
6. 你是陪伴者，不是催促者。用户有自己的节奏。

═══ 输出规则 ═══
1. 每次只输出当前一个步骤，80-150 字。
2. 不超过 3 个具体动作。通常 1-2 个就够。
3. 不输出完整计划，不输出后续步骤，不展望"做完这个之后做什么"。
4. 不输出长篇理论，不解释为什么这样做（最多一句话）。
5. 不输出 Markdown 格式，不输出 JSON，不输出代码块，只返回纯文本。

═══ 序列上下文使用规则 ═══
如果用户消息中包含"任务序列信息"，你可以轻量感知当前位置：
- start + 第一步：降低门槛，"先从最小的一步开始"。
- start + 中间步：帮助保持节奏，"这一步做完，离目标又近了一点"。
- start + 最后一步：提醒收尾，"这是最后一步了，收个尾"。
- done：轻量认可完成，"这一步完成。接下来…"——自然过渡，不用每次大段表扬。
- stuck / too_hard：根据当前位置给更小动作，不因为"后面还有任务"而催促。
- encourage：根据当前位置调整鼓励深度。
注意：
- 不要反复强调"还剩 X 步"，避免制造完成焦虑。
- 如果 totalSteps === 1，不要提"第一步/最后一步"。
- 后续任务名称仅供位置感知，不能建议用户现在去做后续任务。
- 不得说"先做后面的任务""跳过这一步""可以先处理下一项"。
- 用户点击 done 时，只推进当前任务内部的下一小步，不跳到后续任务。
- 任务列表里的下一项任务，必须等用户亲自勾选当前任务完成后才会解锁。

═══ 用户反馈处理 ═══
- start：给出当前任务的第一小步，降低开始门槛。不输出全局计划。
- done：简短认可完成，自然过渡到下一步。不需要每次都说"很好/太棒了"。
- stuck：承认卡住很正常，把当前步骤拆成更小、更容易执行的动作。
- too_hard：承认难度，给出降级或简化方案。可以建议只做一部分、降低标准。
- encourage：遵循鼓励分级规则。

═══ 鼓励分级 ═══
鼓励不要每次都走完整 4 步结构，根据场景分级：
- 刚完成一步（done 后自动推进）：轻量认可，"这一步完成"即可，不需要额外鼓励。
- 用户主动请求鼓励：承认感受 → 降低压力 → 缩小范围 → 给一个马上能做的小动作。
- 用户连续卡住或太难：4 步 + 提供替代方案或可选路径。
- 最后一步完成：轻量提醒收尾，不需要长篇表扬。

═══ 收尾判断 ═══
当你认为当前任务已经推进到可以收尾时，在输出末尾加上 [DONE] 标记。
[DONE] 必须是输出的最后一行，独占一行。

═══ 输出风格 ═══
- 用"你"直接对用户说话。
- 自然、温暖、像人和人之间的对话，不像操作手册。
- 每次表达可以不同，不要每次都按同一个框架输出。
- 认同任务的难度和用户的感受，但不写长篇安慰。
```

#### 4.2.2 buildCompanionUserPrompt 扩展

新增可选参数 `sequenceContext`：

```typescript
interface CompanionSequenceContext {
  currentStepNumber?: number;
  totalSteps?: number;
  completedSteps?: number;
  previousTaskTitle?: string;
  nextTaskTitle?: string;
}

interface CompanionPromptInput {
  taskTitle: string;
  goal?: string;
  currentStep?: string;
  stepHistory?: string[];
  userSignal: CompanionUserSignal;
  sequenceContext?: CompanionSequenceContext;  // 新增，可选
}

export function buildCompanionUserPrompt(input: CompanionPromptInput): string {
  const parts: string[] = [];
  const taskTitle = input.taskTitle.trim();
  const goal = input.goal?.trim();
  const currentStep = input.currentStep?.trim();
  const stepHistory = input.stepHistory
    ?.map((step) => step.trim())
    .filter(Boolean)
    .slice(-5);

  parts.push(`用户的任务：${taskTitle}`);

  if (goal) {
    parts.push(`用户的目标：${goal}`);
  }

  if (currentStep) {
    parts.push(`用户当前步骤：${currentStep}`);
  }

  if (stepHistory?.length) {
    parts.push(`最近步骤历史：${stepHistory.join(" -> ")}`);
  }

  // 新增：序列上下文（可选）
  const ctx = input.sequenceContext;
  if (ctx && typeof ctx.currentStepNumber === "number" && typeof ctx.totalSteps === "number") {
    parts.push("");
    parts.push("═══ 任务序列信息 ═══");
    parts.push(`当前是第 ${ctx.currentStepNumber} 步，共 ${ctx.totalSteps} 步。`);
    if (typeof ctx.completedSteps === "number") {
      parts.push(`已完成 ${ctx.completedSteps} 步。`);
    }
    if (ctx.previousTaskTitle) {
      parts.push(`上一步：${ctx.previousTaskTitle}`);
    }
    if (ctx.nextTaskTitle) {
      parts.push(`后续任务（仅供位置感知，不能建议现在做）：${ctx.nextTaskTitle}`);
    }
  }

  parts.push(SIGNAL_PROMPTS[input.userSignal]);

  return parts.join("\n");
}
```

#### 4.2.3 保留不变

- `COMPANION_SYSTEM_PROMPT` 导出名不变。
- `SIGNAL_PROMPTS` 内容不变（5 个信号的 User Prompt 描述已正确）。
- `buildCompanionUserPrompt` 函数签名向后兼容（`sequenceContext` 可选）。
- 不新增文件。

---

## 5. Phase 2：API Route 扩展

### 5.1 `src/app/api/task-assist/route.ts`

#### 5.1.1 改动点

1. 从请求体解构新增 5 个可选字段。
2. 对新增字段做安全校验。
3. 将序列上下文传给 `buildAssistUserPrompt`。

#### 5.1.2 具体实现

**位置**：第 125 行 `const { actionType, goal, taskTitle } = body as Record<string, unknown>;` 之后。

```typescript
// 新增：提取可选序列上下文字段
const sequenceContext = extractSequenceContext(body);
```

**新增 helper 函数**（放在文件内，`errorResponse` 函数附近）：

```typescript
interface AssistSequenceContext {
  currentStepNumber?: number;
  totalSteps?: number;
  completedSteps?: number;
  previousTaskTitle?: string;
  nextTaskTitle?: string;
}

function extractSequenceContext(
  body: Record<string, unknown>,
): AssistSequenceContext | undefined {
  const ctx: AssistSequenceContext = {};

  if (typeof body.currentStepNumber === "number" && body.currentStepNumber > 0 && Number.isInteger(body.currentStepNumber)) {
    ctx.currentStepNumber = body.currentStepNumber;
  }
  if (typeof body.totalSteps === "number" && body.totalSteps > 0 && Number.isInteger(body.totalSteps)) {
    ctx.totalSteps = body.totalSteps;
  }
  if (typeof body.completedSteps === "number" && body.completedSteps >= 0 && Number.isInteger(body.completedSteps)) {
    ctx.completedSteps = body.completedSteps;
  }
  if (typeof body.previousTaskTitle === "string" && body.previousTaskTitle.trim()) {
    ctx.previousTaskTitle = body.previousTaskTitle.trim().slice(0, 200);
  }
  if (typeof body.nextTaskTitle === "string" && body.nextTaskTitle.trim()) {
    ctx.nextTaskTitle = body.nextTaskTitle.trim().slice(0, 200);
  }

  // 至少需要 currentStepNumber + totalSteps 才有意义
  if (ctx.currentStepNumber === undefined || ctx.totalSteps === undefined) {
    return undefined;
  }

  return ctx;
}
```

**修改 `buildAssistUserPrompt` 调用**（第 146-151 行）：

```typescript
const userPrompt = buildAssistUserPrompt({
  actionType,
  goal:
    typeof goal === "string" ? goal.trim().slice(0, MAX_GOAL_LENGTH) : "",
  taskTitle: taskTitle.trim().slice(0, MAX_TASK_TITLE_LENGTH),
  sequenceContext,  // 新增
});
```

#### 5.1.3 保留不变

- auth 逻辑不变。
- rate limit 逻辑不变。
- `callAIWithPlainText` 调用不变（maxTokens=300, temperature=0.4 不变）。
- Parser 调用不变。
- 错误处理不变。
- 所有错误码和错误消息不变。
- 向后兼容：不传新字段时 `sequenceContext` 为 `undefined`，`buildAssistUserPrompt` 中跳过序列信息块。

---

### 5.2 `src/app/api/task-companion/route.ts`

#### 5.2.1 改动点

1. 从请求体解构新增 5 个可选字段。
2. 复用与 assist 相同的 `extractSequenceContext` helper（或内联等价逻辑）。
3. 将序列上下文传给 `buildCompanionUserPrompt`。

#### 5.2.2 具体实现

**新增 helper 函数**（与 assist route 中的 `extractSequenceContext` 逻辑完全一致，放在文件内）：

```typescript
interface CompanionSequenceContext {
  currentStepNumber?: number;
  totalSteps?: number;
  completedSteps?: number;
  previousTaskTitle?: string;
  nextTaskTitle?: string;
}

function extractSequenceContext(
  body: Record<string, unknown>,
): CompanionSequenceContext | undefined {
  const ctx: CompanionSequenceContext = {};

  if (typeof body.currentStepNumber === "number" && body.currentStepNumber > 0 && Number.isInteger(body.currentStepNumber)) {
    ctx.currentStepNumber = body.currentStepNumber;
  }
  if (typeof body.totalSteps === "number" && body.totalSteps > 0 && Number.isInteger(body.totalSteps)) {
    ctx.totalSteps = body.totalSteps;
  }
  if (typeof body.completedSteps === "number" && body.completedSteps >= 0 && Number.isInteger(body.completedSteps)) {
    ctx.completedSteps = body.completedSteps;
  }
  if (typeof body.previousTaskTitle === "string" && body.previousTaskTitle.trim()) {
    ctx.previousTaskTitle = body.previousTaskTitle.trim().slice(0, 200);
  }
  if (typeof body.nextTaskTitle === "string" && body.nextTaskTitle.trim()) {
    ctx.nextTaskTitle = body.nextTaskTitle.trim().slice(0, 200);
  }

  if (ctx.currentStepNumber === undefined || ctx.totalSteps === undefined) {
    return undefined;
  }

  return ctx;
}
```

**在 POST handler 中**（`checkRateLimit` 通过后，build prompt 前）：

```typescript
// 提取序列上下文
const sequenceContext = extractSequenceContext(body);
```

**修改 `buildCompanionUserPrompt` 调用**（第 157-169 行）：

```typescript
const userPrompt = buildCompanionUserPrompt({
  currentStep:
    typeof body.currentStep === "string"
      ? body.currentStep.trim().slice(0, MAX_CURRENT_STEP_LENGTH)
      : undefined,
  goal:
    typeof body.goal === "string"
      ? body.goal.trim().slice(0, MAX_GOAL_LENGTH)
      : undefined,
  stepHistory: normalizeStepHistory(body.stepHistory),
  taskTitle: body.taskTitle.trim().slice(0, MAX_TASK_TITLE_LENGTH),
  userSignal: body.userSignal,
  sequenceContext,  // 新增
});
```

#### 5.2.3 保留不变

- auth 逻辑不变。
- rate limit 逻辑不变。
- `callAIWithPlainText` 调用不变（maxTokens=400, temperature=0.4 不变）。
- `normalizeStepHistory` 逻辑不变。
- Parser 调用不变。
- 错误处理不变。
- 所有错误码和错误消息不变。
- `[DONE]` 检测逻辑不变（在 Parser 中，不动）。
- 向后兼容。

---

## 6. Phase 3：UI 序列上下文传参

### 6.1 总体链路

```
TaskList (tasks[] + index)
  → TaskItem (从 tasks + taskIndex 提取序列上下文)
    → TaskAssistPanel (接收 props → 传 API)
    → TaskCompanionPanel (接收 props → 传 API)
```

### 6.2 `src/components/TaskList.tsx`

#### 6.2.1 改动点

将 `tasks` 数组传给 `TaskItem`。

#### 6.2.2 具体实现

**当前**（第 72-88 行）：`tasks.map` 中传 `taskIndex={index}`，但不传 `tasks`。

**修改**：新增 `tasks={tasks}` prop：

```tsx
tasks.map((task, index) => {
  const executionStatus = getTaskExecutionStatus(index, tasks);

  return (
    <TaskItem
      executionStatus={executionStatus}
      goal={goal}
      isAssistOpen={activeAssistTaskId === task.id}
      isCompanionOpen={activeCompanionTaskId === task.id}
      key={task.id}
      onToggle={onToggleTask}
      onToggleAssist={onToggleAssist}
      onToggleCompanion={onToggleCompanion}
      task={task}
      taskIndex={index}
      tasks={tasks}  // 新增
    />
  );
})
```

#### 6.2.3 保留不变

- `getTaskExecutionStatus` 调用不变。
- `TaskProgress` 不变。
- `CompleteAllPrompt` 不变。
- 不改变 V2.5.1 的 completed/current/locked 推导逻辑。

---

### 6.3 `src/components/TaskItem.tsx`

#### 6.3.1 改动点

1. `TaskItemProps` 新增 `tasks` prop。
2. 提取序列上下文（仅在 `isCurrent` 时）。
3. 将序列上下文传给 `TaskAssistPanel` 和 `TaskCompanionPanel`。

#### 6.3.2 Props 扩展

```typescript
import type { Task } from "@/lib/types";

interface TaskItemProps {
  task: Task;
  taskIndex: number;
  tasks: Task[];  // 新增：完整任务列表，用于提取序列上下文
  executionStatus: TaskExecutionStatus;
  onToggle: (taskId: string) => void;
  isAssistOpen: boolean;
  onToggleAssist: (taskId: string) => void;
  isCompanionOpen: boolean;
  onToggleCompanion: (taskId: string) => void;
  goal: string;
}
```

#### 6.3.3 提取序列上下文

在组件函数体内（`isCurrent` 判断之后），新增序列上下文提取：

```typescript
const sequenceContext = useMemo(() => {
  if (!isCurrent) return undefined;
  
  const currentStepNumber = taskIndex + 1;
  const totalSteps = tasks.length;
  const completedSteps = tasks.filter(t => t.completed).length;
  const previousTaskTitle = taskIndex > 0 ? tasks[taskIndex - 1]?.title : undefined;
  const nextTaskTitle = taskIndex < tasks.length - 1 ? tasks[taskIndex + 1]?.title : undefined;

  return {
    currentStepNumber,
    totalSteps,
    completedSteps,
    previousTaskTitle,
    nextTaskTitle,
  };
}, [isCurrent, taskIndex, tasks]);
```

注意：需要新增 `useMemo` 导入（从 `react`）。

#### 6.3.4 传给 Panel

```tsx
{canUseAI && isAssistOpen ? (
  <div className="mt-2">
    <TaskAssistPanel
      goal={goal}
      onClose={() => onToggleAssist(task.id)}
      onStartCompanion={() => onToggleCompanion(task.id)}
      taskId={task.id}
      taskTitle={task.title}
      sequenceContext={sequenceContext}  // 新增
    />
  </div>
) : null}

{canUseAI && isCompanionOpen ? (
  <div className="mt-2">
    <TaskCompanionPanel
      goal={goal}
      onClose={() => onToggleCompanion(task.id)}
      taskId={task.id}
      taskTitle={task.title}
      sequenceContext={sequenceContext}  // 新增
    />
  </div>
) : null}
```

#### 6.3.5 保留不变

- completed / locked / current 三种视觉状态不变。
- locked 提示逻辑不变。
- checkbox / onToggle 逻辑不变。
- AI 入口只在 current 显示的规则不变（V2.5.1 已有）。
- locked 不渲染 AI 面板的规则不变。

---

### 6.4 `src/components/TaskAssistPanel.tsx`

#### 6.4.1 改动点

1. Props 新增可选 `sequenceContext`。
2. `fetchAssist` 调用时附带序列上下文字段。

#### 6.4.2 Props 扩展

```typescript
interface TaskAssistPanelProps {
  taskId: string;
  taskTitle: string;
  goal: string;
  onClose: () => void;
  onStartCompanion: () => void;
  sequenceContext?: {  // 新增，可选
    currentStepNumber?: number;
    totalSteps?: number;
    completedSteps?: number;
    previousTaskTitle?: string;
    nextTaskTitle?: string;
  };
}
```

#### 6.4.3 API 调用扩展

组件通过 `useTaskAssist` hook 调用 API。**不改 hook 内部逻辑**。在组件中包装 `fetchAssist`，在调用 hook 的 `fetchAssist` 前，通过直接 fetch 替代 hook 的 fetch：

**推荐方式：扩展 hook 接口**

由于 hook 的 `fetchAssist` 内部直接 `fetch("/api/task-assist", { body: JSON.stringify({...}) })`，且 hook 接口不支持额外字段，需要在组件层做适配。

**方案**：在 `useTaskAssist` hook 中新增可选参数 `sequenceContext`（最小修改）：

在 `useTaskAssist.ts` 中：

```typescript
// UseTaskAssistOptions 新增可选字段
interface UseTaskAssistOptions {
  taskId: string;
  taskTitle: string;
  goal: string;
  sequenceContext?: {  // 新增
    currentStepNumber?: number;
    totalSteps?: number;
    completedSteps?: number;
    previousTaskTitle?: string;
    nextTaskTitle?: string;
  };
}
```

在 `fetchAssist` 的 fetch body 中新增：

```typescript
body: JSON.stringify({
  actionType,
  goal,
  taskTitle,
  // 新增：序列上下文（可选）
  ...(sequenceContext && sequenceContext.currentStepNumber !== undefined && sequenceContext.totalSteps !== undefined
    ? {
        currentStepNumber: sequenceContext.currentStepNumber,
        totalSteps: sequenceContext.totalSteps,
        completedSteps: sequenceContext.completedSteps,
        previousTaskTitle: sequenceContext.previousTaskTitle,
        nextTaskTitle: sequenceContext.nextTaskTitle,
      }
    : {}),
}),
```

`fetchAssist` 的 `useCallback` 依赖数组新增 `sequenceContext`：

```typescript
[goal, taskTitle, sequenceContext]
```

**注意**：这属于对 `useTaskAssist.ts` 的极轻量扩展（仅新增可选参数和透传），不改变 hook 的状态管理、race condition 处理、错误处理等核心逻辑。如果认为 hook 不应改动，备选方案是在 `TaskAssistPanel` 中绕过 hook 直接 fetch，但这样更复杂且引入重复代码。推荐上述最小 hook 扩展方案。

#### 6.4.4 TaskAssistPanel 组件修改

```tsx
export function TaskAssistPanel({
  goal,
  onClose,
  onStartCompanion,
  taskId,
  taskTitle,
  sequenceContext,  // 新增
}: TaskAssistPanelProps) {
  const { activeActionType, error, fetchAssist, reset, result, status } =
    useTaskAssist({
      goal,
      taskId,
      taskTitle,
      sequenceContext,  // 新增：传给 hook
    });
  // ... 其余不变
}
```

#### 6.4.5 保留不变

- 4 个按钮不变（怎么开始 / 拆小一点 / 5 分钟版本 / 我卡住了）。
- 按钮布局不变（2x2 grid）。
- "开始陪我做" 按钮不变。
- 复制逻辑不变。
- loading / error / result 状态不变。
- "关闭"按钮不变。
- 不新增自由输入框。

---

### 6.5 `src/components/TaskCompanionPanel.tsx`

#### 6.5.1 改动点

1. Props 新增可选 `sequenceContext`。
2. `startCompanion` 和 `sendSignal` 调用时附带序列上下文字段。

#### 6.5.2 Props 扩展

```typescript
interface TaskCompanionPanelProps {
  taskId: string;
  taskTitle: string;
  goal: string;
  onClose: () => void;
  sequenceContext?: {  // 新增，可选
    currentStepNumber?: number;
    totalSteps?: number;
    completedSteps?: number;
    previousTaskTitle?: string;
    nextTaskTitle?: string;
  };
}
```

#### 6.5.3 Hook 最小扩展

在 `useTaskCompanion.ts` 中：

```typescript
// UseTaskCompanionOptions 新增可选字段
interface UseTaskCompanionOptions {
  taskId: string;
  taskTitle: string;
  goal: string;
  sequenceContext?: {  // 新增
    currentStepNumber?: number;
    totalSteps?: number;
    completedSteps?: number;
    previousTaskTitle?: string;
    nextTaskTitle?: string;
  };
}
```

在 `requestCompanion` 的 fetch body 中新增：

```typescript
body: JSON.stringify({
  currentStep: currentStepMessage,
  goal,
  stepHistory: historySnapshot,
  taskTitle,
  userSignal,
  // 新增：序列上下文（可选）
  ...(sequenceContext && sequenceContext.currentStepNumber !== undefined && sequenceContext.totalSteps !== undefined
    ? {
        currentStepNumber: sequenceContext.currentStepNumber,
        totalSteps: sequenceContext.totalSteps,
        completedSteps: sequenceContext.completedSteps,
        previousTaskTitle: sequenceContext.previousTaskTitle,
        nextTaskTitle: sequenceContext.nextTaskTitle,
      }
    : {}),
}),
```

`requestCompanion` 的 `useCallback` 依赖数组新增 `sequenceContext`。

#### 6.5.4 TaskCompanionPanel 组件修改

```tsx
export function TaskCompanionPanel({
  goal,
  onClose,
  taskId,
  taskTitle,
  sequenceContext,  // 新增
}: TaskCompanionPanelProps) {
  const {
    activeSignal,
    currentStep,
    error,
    exitCompanion,
    sendSignal,
    startCompanion,
    status,
  } = useTaskCompanion({
    goal,
    taskId,
    taskTitle,
    sequenceContext,  // 新增：传给 hook
  });
  // ... 其余不变
}
```

#### 6.5.5 保留不变

- 自动 start 逻辑不变（`useEffect` → `startCompanion`）。
- 5 个反馈按钮不变（我完成了 / 我卡住了 / 太难了 / 鼓励我一下 / 复制当前步骤 / 退出陪伴）。
- done 状态只显示"鼓励我一下"按钮的逻辑不变。
- stepHistory 逻辑不变。
- `inflightRef` / `requestIdRef` 逻辑不变。
- 复制 / 退出逻辑不变。
- emerald 主题色调不变。
- 不新增自由输入框。

---

## 7. Phase 4：验证方案

### 7.1 命令验证

必须运行：

```bash
npm run lint
npm run build
git status --short
```

### 7.2 功能验证

#### V2.4 回归（Assist 四个按钮）

1. "怎么开始" → 返回起步动作，不报错。
2. "拆小一点" → 返回 3-5 个小步骤，不报错。
3. "5 分钟版本" → 返回极简版，不报错。
4. "我卡住了" → 返回卡点分析 + 下一步，不报错。
5. 四个按钮在无序列上下文时功能不变（旧调用方兼容）。

#### V2.5 回归（Companion 陪伴模式）

1. "开始陪我做" → 自动触发 start，返回第一步。
2. "我完成了" → 返回下一步。
3. "我卡住了" → 返回更小步骤。
4. "太难了" → 返回降级方案。
5. "鼓励我一下" → 返回有温度但非鸡汤的鼓励。
6. "复制当前步骤" → 复制成功。
7. "退出陪伴" → 关闭面板。
8. [DONE] 状态 → 三个信号按钮隐藏，仅剩"鼓励我一下"。

#### V2.5.1 回归（顺序执行）

1. locked 任务不显示 AI 入口。
2. current 任务显示 AI 入口。
3. locked 点击显示"请先完成上一步，再继续这一步。"
4. locked checkbox disabled。
5. 完成 current 后下一个自动解锁。

#### AI 输出质量

1. **位置感知**：多任务列表的第一个任务触发 AI 时，输出能体现"第一步"感知。
2. **位置感知**：最后一个任务触发 AI 时，输出能体现"最后一步/收尾"感知。
3. **不跳过 locked**：AI 不会说出"你可以先做后面的任务"。
4. **不鸡汤**：多次"鼓励我一下"，不出现"你一定可以的""相信自己""你很棒"。
5. **不心理诊断**：多次陪伴互动，不出现"你看起来很焦虑""你可能在逃避"。
6. **不完整代写**：不输出完整周报/邮件/文章。
7. **卡住时给更小动作**："我卡住了"返回不超过 2 个具体动作。
8. **太难时降级**："太难了"返回简化/降级方案。
9. **不自动勾选**：AI 输出中不包含"已帮你勾选""任务已完成"等表述。
10. **不自动创建**：AI 输出中不包含新增任务。

#### 其他回归

1. 任务生成正常。
2. 清空任务正常。
3. 重新生成正常。
4. 历史记录正常。
5. 统计正常。
6. AI 复盘正常。
7. 登录 / 忘记密码 / 重置密码不受影响。

---

## 8. 不做范围

V2.5.2 明确不做：

1. 不做 V3.0 页面重构。
2. 不做底部导航。
3. 不做完整聊天系统。
4. 不做自由输入框。
5. 不做长期记忆。
6. 不做数据库 schema 修改。
7. 不做向量库 / embedding。
8. 不做用户画像系统。
9. 不做自动 Agent。
10. 不做自动执行外部操作。
11. 不做心理诊断。
12. 不做任务跳过功能。
13. 不绕过 V2.5.1 顺序执行规则。
14. 不改 `ai-client.ts`。
15. 不改 `task-assist-parser.ts`。
16. 不改 `task-companion-parser.ts`。
17. 不改 `task-execution.ts`。
18. 不改 `useTaskGroup.ts`。
19. 不改 Auth。
20. 不新增 npm 依赖。
21. 不做 SSE / Streaming。
22. 不新增文件（默认不新增 `ai-brain-context.ts`）。
23. 不新增按钮。
24. 不改 UI 布局。

---

## 9. 风险与缓解

### 9.1 P0 风险

| # | 风险 | 缓解 |
|---|------|------|
| **P0-1** | Prompt 升级后 AI 输出变长变空洞 | 保留"简短、具体、可执行"约束；maxTokens 不变（assist 300, companion 400）；Parser 截断不变 |
| **P0-2** | AI 情感表达过度像心理咨询 | Prompt 第一条即"不做心理诊断"；明确"你不是心理咨询师" |
| **P0-3** | AI 基于序列上下文建议跳过 locked | Prompt 明确"不建议用户跳过当前任务"；nextTaskTitle 标注"仅供位置感知，不能建议现在做" |
| **P0-4** | API 新字段导致旧客户端报错 | 所有新字段可选（`?:`）；API route 做 undefined 兜底 |
| **P0-5** | 前端传错 currentStepNumber | 从 `tasks.map` 中直接计算（taskIndex + 1），不经过 state |
| **P0-6** | AI 过度代写完整成果 | Prompt 安全红线第 3 条明确禁止；保留"不替用户完成"约束 |

### 9.2 P1 风险

| # | 风险 | 缓解 |
|---|------|------|
| **P1-1** | AI 变得太自由输出不可控 | 安全红线前置；temperature 保持 0.4；Parser 截断保留 |
| **P1-2** | AI 太热情给用户压力 | Prompt 明确"你是陪伴者不是催促者" |
| **P1-3** | 序列上下文让 AI 过度关注"还剩多少" | Prompt 规则"不要反复强调剩余步骤数" |
| **P1-4** | Prompt 太长导致 AI 忽略关键约束 | 安全红线放在最前面（`═══` 分隔强调） |
| **P1-5** | Token 消耗略增 | 序列上下文 ~100 tokens——影响极小 |

### 9.3 P2 风险

| # | 风险 | 缓解 |
|---|------|------|
| **P2-1** | 纯文本输出偶尔带格式标记 | Parser 已有 Markdown 清理，问题不大 |
| **P2-2** | 不同 DeepSeek 版本理解差异 | 保留 temperature 0.4 降低随机性；上线后监控 |
| **P2-3** | API route 改动 ~20 行/文件 | 改动量小，风险可控 |
| **P2-4** | 后续 Prompt 迭代需要多次调整 | 正常迭代成本 |

---

## 10. Codex 实现指令边界

### 10.1 允许修改文件（10 个）

1. `src/prompts/task-assist.ts` — System Prompt 替换 + User Prompt 扩展
2. `src/prompts/task-companion.ts` — System Prompt 替换 + User Prompt 扩展
3. `src/app/api/task-assist/route.ts` — 新增 `extractSequenceContext` + 传参
4. `src/app/api/task-companion/route.ts` — 新增 `extractSequenceContext` + 传参
5. `src/hooks/useTaskAssist.ts` — 仅轻量透传：`UseTaskAssistOptions` 新增可选 `sequenceContext`，fetch body 透传，`useCallback` 依赖补齐（**不允许**改状态机、错误处理、`requestIdRef`/`inflightRef`、loading/active/done/error 逻辑）
6. `src/hooks/useTaskCompanion.ts` — 仅轻量透传：`UseTaskCompanionOptions` 新增可选 `sequenceContext`，fetch body 透传，`useCallback` 依赖补齐（**不允许**改状态机、错误处理、`requestIdRef`/`inflightRef`、`stepHistory`、loading/active/done/error 逻辑）
7. `src/components/TaskAssistPanel.tsx` — 新增 `sequenceContext` prop + 传 hook
8. `src/components/TaskCompanionPanel.tsx` — 新增 `sequenceContext` prop + 传 hook
9. `src/components/TaskItem.tsx` — 新增 `tasks` prop + 提取序列上下文 + 传 Panel
10. `src/components/TaskList.tsx` — 传 `tasks` 给 TaskItem

### 10.2 禁止修改文件

严禁修改：

1. 数据库 schema / migration。
2. `src/lib/ai-client.ts`。
3. `src/lib/task-assist-parser.ts`。
4. `src/lib/task-companion-parser.ts`。
5. `src/lib/task-execution.ts`。
6. `src/lib/types.ts`。
7. `src/hooks/useTaskGroup.ts`。
8. Auth / V2.3 相关文件。
9. `package.json` / `package-lock.json`。
10. `.env.local`。
11. `next.config.ts`。
12. docs 文件（除非用户明确要求更新）。

### 10.3 每个文件具体改动点

#### `src/prompts/task-assist.ts`

- `ASSIST_SYSTEM_PROMPT` 完整替换为 Phase 4.1.1 内容。
- `ACTION_PROMPTS` 4 个 actionType 替换为 Phase 4.1.2 风格指南。
- `AssistPromptInput` 新增可选 `sequenceContext`。
- `buildAssistUserPrompt` 新增序列上下文拼接逻辑（Phase 4.1.3）。

#### `src/prompts/task-companion.ts`

- `COMPANION_SYSTEM_PROMPT` 完整替换为 Phase 4.2.1 内容。
- `CompanionPromptInput` 新增可选 `sequenceContext`。
- `buildCompanionUserPrompt` 新增序列上下文拼接逻辑（Phase 4.2.2）。

#### `src/app/api/task-assist/route.ts`

- 新增 `AssistSequenceContext` interface + `extractSequenceContext` 函数。
- POST handler 中解构 `sequenceContext`。
- `buildAssistUserPrompt` 调用时传入 `sequenceContext`。

#### `src/app/api/task-companion/route.ts`

- 新增 `CompanionSequenceContext` interface + `extractSequenceContext` 函数。
- POST handler 中解构 `sequenceContext`。
- `buildCompanionUserPrompt` 调用时传入 `sequenceContext`。

#### `src/hooks/useTaskAssist.ts`

- `UseTaskAssistOptions` 新增可选 `sequenceContext`。
- `fetchAssist` 的 fetch body 中展开序列上下文字段。
- `fetchAssist` 依赖数组新增 `sequenceContext`。
- **不允许**改状态机、错误处理、`requestIdRef`/`inflightRef`、loading/active/done/error 逻辑。

#### `src/hooks/useTaskCompanion.ts`

- `UseTaskCompanionOptions` 新增可选 `sequenceContext`。
- `requestCompanion` 的 fetch body 中展开序列上下文字段。
- `requestCompanion` 依赖数组新增 `sequenceContext`。
- **不允许**改状态机、错误处理、`requestIdRef`/`inflightRef`、`stepHistory`、loading/active/done/error 逻辑。

#### `src/components/TaskList.tsx`

- `TaskItem` 调用时新增 `tasks={tasks}` prop。

#### `src/components/TaskItem.tsx`

- `TaskItemProps` 新增 `tasks: Task[]`。
- 新增 `useMemo` 计算 `sequenceContext`。
- `TaskAssistPanel` 和 `TaskCompanionPanel` 调用时传入 `sequenceContext`。

#### `src/components/TaskAssistPanel.tsx`

- `TaskAssistPanelProps` 新增可选 `sequenceContext`。
- 解构 `sequenceContext` 传给 `useTaskAssist`。

#### `src/components/TaskCompanionPanel.tsx`

- `TaskCompanionPanelProps` 新增可选 `sequenceContext`。
- 解构 `sequenceContext` 传给 `useTaskCompanion`。

### 10.4 git status 预期

实现完成后，除长期未跟踪项外，预期只出现：

```text
 M src/prompts/task-assist.ts
 M src/prompts/task-companion.ts
 M src/app/api/task-assist/route.ts
 M src/app/api/task-companion/route.ts
 M src/hooks/useTaskAssist.ts
 M src/hooks/useTaskCompanion.ts
 M src/components/TaskAssistPanel.tsx
 M src/components/TaskCompanionPanel.tsx
 M src/components/TaskItem.tsx
 M src/components/TaskList.tsx
```

长期未跟踪项可能存在但不要处理：

```text
?? .agents/
?? .claude/
?? .codex/
?? skills-lock.json
?? start
?? stop
```

**不会出现新增文件**（不创建 `ai-brain-context.ts`）。

### 10.5 验证命令

```bash
npm run lint
npm run build
git status --short
```

---

## 11. Claude Code Review 清单

1. ✅ 是否未改数据库 schema。
2. ✅ 是否未改 `ai-client.ts`。
3. ✅ 是否未改 `task-assist-parser.ts`。
4. ✅ 是否未改 `task-companion-parser.ts`。
5. ✅ 是否未改 `useTaskGroup.ts`。
6. ✅ 是否未改 `task-execution.ts`。
7. ✅ 是否 API 新字段全部可选（`?:`）。
8. ✅ 是否旧请求仍兼容（不传新字段时行为不变）。
9. ✅ 是否 Prompt 保留安全红线（不做心理诊断、不鸡汤、不代写）。
10. ✅ 是否 AI 不建议跳过 locked 任务（Prompt 明确禁止）。
11. ✅ 是否 AI 不做心理诊断。
12. ✅ 是否 AI 不输出鸡汤（"你一定可以的""相信自己""你很棒"不出现在 Prompt 正面示例中）。
13. ✅ 是否 AI 不完整代写。
14. ✅ 是否 V2.4 四个按钮正常（怎么开始 / 拆小一点 / 5 分钟版本 / 我卡住了）。
15. ✅ 是否 V2.5 Companion 正常（5 个反馈按钮 + 复制 + 退出）。
16. ✅ 是否 V2.5.1 顺序执行正常（locked 不显示 AI、current 显示 AI）。
17. ✅ 是否 `npm run lint` 通过。
18. ✅ 是否 `npm run build` 通过。
19. ✅ 是否 `git status --short` 只包含允许文件。
20. ✅ 是否不包含新增文件（无 `ai-brain-context.ts`）。
21. ✅ 是否 Prompt 的安全红线放在最前面。
22. ✅ 是否序列上下文校验有效（无效值被忽略/归一化）。
23. ✅ 是否 `maxTokens` / `temperature` 未变。
24. ✅ 是否 Parser 截断长度未变。
25. ✅ 是否不引入新依赖。

---

## 12. 验收标准

### 12.1 AI 语气与温度

| # | 验收项 | 验证方式 |
|---|--------|----------|
| **T1** | AI 语气更自然，不像背模板 | 多次点击同一按钮，输出应有表达变化 |
| **T2** | AI 能体现当前任务序号 | 多任务列表第一步/中间步/最后一步分别触发，输出应有位置感知 |
| **T3** | AI 不输出空泛鸡汤 | 多次"鼓励我一下"，不出现"你一定可以的""相信自己""你很棒" |
| **T4** | AI 不做心理诊断 | 多次陪伴，不出现"你看起来很焦虑""你可能在逃避" |
| **T5** | AI 不过度代写 | 不输出完整周报/邮件/文章/代码 |

### 12.2 AI 辅助能力

| # | 验收项 | 验证方式 |
|---|--------|----------|
| **A1** | 卡住时给更小动作 | "我卡住了" → 不超过 2 个动作，且每个动作足够小 |
| **A2** | 太难时降级任务 | "太难了" → 给出简化方案或替代方案 |
| **A3** | 鼓励时有温度但不过度 | "鼓励我一下" → 有温度 + 有具体动作 + 无鸡汤 |
| **A4** | AI 不建议跳过 locked | 输出中不出现"你可以先做后面的""跳过这一步" |
| **A5** | AI 不自动勾选任务 | 输出中不出现"已帮你完成""任务已完成" |
| **A6** | AI 不自动创建任务 | 输出中不出现新任务名 |

### 12.3 回归

| # | 验收项 | 验证方式 |
|---|--------|----------|
| **R1** | V2.4 四个按钮正常 | 怎么开始 / 拆小一点 / 5 分钟版本 / 我卡住了 |
| **R2** | V2.5 Companion 正常 | 5 个反馈按钮 + [DONE] + 复制 + 退出 |
| **R3** | V2.5.1 顺序执行正常 | locked 不显示 AI 入口、current 可打开 AI |
| **R4** | 所有现有功能正常 | 任务生成/勾选/清空/重新生成/历史/统计/复盘 |
| **R5** | 旧调用方兼容 | 不传序列上下文时，API 行为与 V2.4/V2.5 一致 |

### 12.4 技术门禁

```bash
npm run lint     # 零 error
npm run build    # Compiled successfully
git status --short   # 仅 V2.5.2 允许的文件变更，无意外修改，无新增文件
```

---

## 13. 最终汇报格式

实现阶段最终汇报必须包含：

1. 是否已实现 V2.5.2 全部改动。
2. 修改文件清单（含 hook 轻量扩展文件）。
3. 是否只改允许文件（无越界）。
4. 是否未新增文件。
5. 是否未改数据库 schema。
6. 是否未改 ai-client.ts / Parser / task-execution / useTaskGroup。
7. Prompt 升级要点简述（assist + companion 各改了什么）。
8. API 扩展要点简述（新字段全部可选 + 向后兼容）。
9. UI 链路简述（TaskList → TaskItem → Panel → API）。
10. `npm run lint` 结果。
11. `npm run build` 结果。
12. `git status --short` 输出（贴实际输出）。
13. 是否未提交、未 push。
14. 是否发现需要 Claude Code / ChatGPT 决策的问题。

---

> **文档结束**
>
> **下一文档**：本执行方案经 ChatGPT 审查通过后 → Codex 实现。
>
> **关联文档**：
> - [Architecture-V2.5.2-AI-Brain-Emotion.md](Architecture-V2.5.2-AI-Brain-Emotion.md) — V2.5.2 架构方案
> - [Architecture-V2.5.1-Task-Carryover-Sequential.md](Architecture-V2.5.1-Task-Carryover-Sequential.md) — V2.5.1 架构方案
> - [Execution-Plan-V2.5.1-Task-Carryover-Sequential.md](Execution-Plan-V2.5.1-Task-Carryover-Sequential.md) — V2.5.1 执行方案
