# V2.4：任务级 AI 辅助执行 MVP 架构方案

> **状态**：架构设计阶段，**不写代码，待 ChatGPT 审查通过后交给 Codex 实现**
> **依赖**：V2.3 安全增强 ✅（V2.3A/B/C/D 全部完成）
> **定位**：AI 辅助用户执行任务——在用户卡住时提供 4 种定向辅助，不做全自动 Agent
> **上一文档**：[Execution-Plan-V2.3D-Reset-Password-OTP.md](Execution-Plan-V2.3D-Reset-Password-OTP.md)（V2.3D 执行方案，✅ 已完成）
> **下一文档**：`docs/Execution-Plan-V2.4-AI-Assist.md`（V2.4 执行方案，待本架构审查通过后编写）
> **设计日期**：2026-07-06

---

## 目录

- [一、产品边界与 MVP 定义](#一产品边界与-mvp-定义)
- [二、核心交互流程](#二核心交互流程)
- [三、组件架构](#三组件架构)
- [四、Hook 架构](#四hook-架构)
- [五、API Route 架构](#五api-route-架构)
- [六、Prompt 架构](#六prompt-架构)
- [七、数据模型与类型](#七数据模型与类型)
- [八、文件影响范围](#八文件影响范围)
- [九、安全边界](#九安全边界)
- [十、Human-in-the-Loop 边界](#十human-in-the-loop-边界)
- [十一、V2.4 不做事项](#十一v24-不做事项)
- [十二、验收标准](#十二验收标准)
- [十三、风险矩阵](#十三风险矩阵)
- [十四、与 Roadmap 的关系](#十四与-roadmap-的关系)
- [十五、后续衔接](#十五后续衔接)

---

## 一、产品边界与 MVP 定义

### 1.1 V2.4 是什么

V2.4 是 **任务级 AI 辅助执行 MVP**。用户当前有一条任务（如"写一页项目介绍"），当卡住时，AI 提供定向的辅助动作——但不能替用户完整完成任务。

**一句话**：用户看到每一条任务时，点击"AI 帮我一下"，选择一种辅助方式，AI 返回一段简短、具体、可执行的指导。

### 1.2 V2.4 不是什么

| 不是 | 原因 |
|------|------|
| 不是全自动 Agent | AI 只辅助，不替代用户执行 |
| 不是多轮任务聊天 | 零对话轮次，单次点击 → 单次返回 |
| 不是自由文本输入 | MVP 只提供 4 个固定按钮，不走自由输入 |
| 不是任务完成自动化 | 完成权始终在用户手里，AI 不替代勾选 |
| 不是 UI 美化 | 全部留在 V3.0 |
| 不是数据库变更 | 不需要新表或字段 |
| 不是页面重构 | 基于现有 `/app` 单页 |

### 1.3 四个辅助按钮（V2.4 MVP）

| # | 按钮 | 中文 | 含义 | AI 输出 |
|---|------|------|------|------|
| 1 | **how_to_start** | 怎么开始 | 帮用户找到第一步 | 1-3 个很小的起步动作 |
| 2 | **break_down** | 拆小一点 | 把当前任务拆成更小步骤 | 3-5 个小步骤 |
| 3 | **five_minute** | 给我 5 分钟版本 | 把任务降级成 5 分钟可执行版本 | 一个极小可执行版本 |
| 4 | **im_stuck** | 我卡住了 | 分析卡住原因 + 给下一步建议 | 1 个下一步建议（可鼓励，不鸡汤） |

### 1.4 MVP 为什么不做自由输入

| # | 理由 |
|---|------|
| 1 | 自由输入 = 聊天对话框，聊天对话框 = 用户期待多轮，多轮 = 对话管理 + 上下文窗口。V2.4 必须先验证"用户是否会点 AI 辅助" |
| 2 | 4 个固定按钮降低用户认知成本——比"输入任何问题"更容易理解和尝试 |
| 3 | 固定按钮的 AI 输出质量可控——每个按钮对应一种精心设计的 prompt 模板 |
| 4 | 如果 4 个按钮点击率低，说明"任务级 AI 辅助"这个方向需要重新思考，不需要投入自由输入的开发成本 |
| 5 | 如果 4 个按钮点击率高，V2.5 再加入自由输入和动态快捷建议 |

---

## 二、核心交互流程

### 2.1 主流程

```
┌──────────────────────────────────────────────────────┐
│  ☐ 写一页项目介绍                            [AI 帮我一下] │  ← TaskItem
├──────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────┐  │
│  │  🤖 AI 辅助                                    │  │  ← TaskAssistPanel
│  │                                                │  │
│  │  [怎么开始] [拆小一点] [5分钟版本] [我卡住了]    │  │  ← 4 个按钮
│  │                                                │  │
│  │  ── 结果区域 ──                                │  │
│  │  你现在只需要做这一步：                          │  │
│  │                                                │  │
│  │  1. 打开一个空白文档，标题写"项目介绍"            │  │
│  │  2. 写下第一句话：这个项目是什么                 │  │
│  │  3. 写下第二句话：这个项目为什么重要              │  │
│  │                                                │  │
│  │  [📋 复制]  [🔄 换一个]                        │  │  ← 操作按钮
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### 2.2 状态机

```
┌──────────┐  点击"AI 帮我一下"  ┌──────────┐
│  idle    │ ─────────────────→ │  ready   │
│ (面板关闭)│                    │ (按钮可见)│
└──────────┘                    └────┬─────┘
      ↑                              │ 点击某个按钮
      │ 点击 ✕ 关闭                  ↓
      │                        ┌──────────┐
      │                        │ loading  │
      │                        │ (等待 AI) │
      │                        └────┬─────┘
      │                             │ AI 返回
      │                             ↓
      │                        ┌──────────┐
      │                        │  result  │
      │                        │ (展示结果) │
      │                        └────┬─────┘
      │                             │ 点击"换一个"(同一按钮)
      │                             ↓
      │                        ┌──────────┐
      │                        │ loading  │ ← 循环
      │                        └──────────┘
      │                             │ 点击不同按钮
      │                             ↓
      │                        ┌──────────┐
      │                        │ loading  │ ← 新请求
      │                        └──────────┘
```

**关键设计**：
- 每个任务独立一个面板。打开任务 A 的面板时，任务 B 的面板自动关闭（单一面板策略）。
- 关闭面板 → 清除当前结果（不持久化）。
- 同一按钮可多次点击 → 每次重新调用 AI（`换一个` = 重新请求同一 actionType）。

---

## 三、组件架构

### 3.1 组件树变更

```
MainWorkspace
  └── TaskList (修改：透传 assist 相关 props)
        └── TaskItem (修改：新增"AI 帮我一下"按钮)
              └── TaskAssistPanel (新增：条件渲染)
```

### 3.2 TaskItem 修改（最小化）

**当前**：`TaskItem` 接收 `task: Task` + `onToggle`。

**V2.4 修改后**：

```typescript
// TaskItem.tsx — 新增 props
interface TaskItemProps {
  task: Task;
  onToggle: (taskId: string) => void;
  // V2.4 新增
  isAssistOpen: boolean;
  onToggleAssist: (taskId: string) => void;
  goal: string;
}
```

**UI 变更**：
- 在任务标题右侧新增一个小按钮：`AI 帮我一下`
- 点击后展开/收起 `TaskAssistPanel`（在 task 卡片下方）
- 按钮使用轻量样式（不抢视觉重点）：文字链接或小图标 + 文字

### 3.3 TaskAssistPanel（新增组件）

```typescript
// src/components/TaskAssistPanel.tsx

interface TaskAssistPanelProps {
  taskId: string;
  taskTitle: string;
  goal: string;
  onClose: () => void;
}

type AssistActionType = "how_to_start" | "break_down" | "five_minute" | "im_stuck";
type PanelStatus = "ready" | "loading" | "result" | "error";

// 内部使用 useTaskAssist hook
```

**渲染状态**：

| 状态 | UI |
|------|-----|
| `ready` | 4 个按钮（水平排列，移动端可 2×2 网格） |
| `loading` | 4 个按钮（当前选中的 disabled）+ 加载动画（骨架屏或 spinner） |
| `result` | 结果文本 + [📋 复制] [🔄 换一个] + 4 个按钮（可切换） |
| `error` | 错误提示 + [🔄 重试] + 4 个按钮 |

**关键交互**：
- 结果文本使用 `whitespace-pre-line` 保留 AI 输出中的换行
- "复制"按钮调用 `navigator.clipboard.writeText()`
- "换一个"使用相同 `actionType` 重新请求（不改变当前选中的按钮）
- 切换到不同按钮 → 新请求（新的 `actionType`）

### 3.4 TaskList 修改

**V2.4 修改**：

```typescript
// TaskList.tsx — 新增 props
interface TaskListProps {
  // ... 现有 props 不变
  // V2.4 新增
  activeAssistTaskId: string | null;
  onToggleAssist: (taskId: string) => void;
  goal: string;
}
```

在 `tasks.map` 中传递给 `TaskItem`。

### 3.5 MainWorkspace 修改

在 `MainWorkspace` 中新增一个 state：
```typescript
const [activeAssistTaskId, setActiveAssistTaskId] = useState<string | null>(null);
```

传递给 `TaskList`：
```tsx
<TaskList
  // ... 现有 props
  activeAssistTaskId={activeAssistTaskId}
  onToggleAssist={(taskId) => {
    setActiveAssistTaskId(prev => prev === taskId ? null : taskId);
  }}
  goal={taskGroup?.goal ?? ""}
/>
```

---

## 四、Hook 架构

### 4.1 useTaskAssist（新增）

```typescript
// src/hooks/useTaskAssist.ts

interface UseTaskAssistOptions {
  taskId: string;
  taskTitle: string;
  goal: string;
}

interface UseTaskAssistReturn {
  status: "idle" | "loading" | "result" | "error";
  result: string | null;
  error: string | null;
  activeActionType: AssistActionType | null;
  fetchAssist: (actionType: AssistActionType) => Promise<void>;
  reset: () => void;
}
```

**职责**：
1. 管理单次 AI 辅助请求的完整生命周期
2. 调用 `POST /api/task-assist`
3. 错误映射为中文提示
4. 支持重新请求（相同或不同 actionType）

**实现要点**：
- 使用 `useRef` 防止重复请求（`isFetching` 标志）
- `fetchAssist` 设置 `activeActionType`，供 Panel 高亮当前选中按钮
- `reset` 回到 idle 状态（切换任务时调用）

### 4.2 为什么不在 useTaskGroup 中管理

| 方案 | 优点 | 缺点 | 推荐 |
|------|------|------|:--:|
| 放入 useTaskGroup | 统一状态管理 | useTaskGroup 已 459 行，职责是任务生成/勾选/保存，加入 AI 辅助会增加复杂度 | ❌ |
| 独立 useTaskAssist | 职责单一、易测试、不影响现有逻辑 | 多一个 hook 文件 | ✅ |

---

## 五、API Route 架构

### 5.1 POST /api/task-assist（新增）

#### 请求

```
POST /api/task-assist
Content-Type: application/json

{
  "taskTitle": "写一页项目介绍",
  "goal": "准备项目路演材料",
  "actionType": "how_to_start" | "break_down" | "five_minute" | "im_stuck"
}
```

**不需要 `taskId`**（服务端不需要，仅客户端用于状态管理）。
**不需要 `deviceId`**（使用服务端 session 获取 userId，与现有 API Route 一致）。

#### 响应（成功）

```json
{
  "success": true,
  "data": {
    "result": "你现在只需要做这一步：\n\n1. 打开一个空白文档，标题写"项目介绍"\n2. 写下第一句话：这个项目是什么\n3. 写下第二句话：这个项目为什么重要"
  }
}
```

#### 响应（失败）

```json
{
  "success": false,
  "error": {
    "code": "AI_ASSIST_FAILED",
    "message": "AI 辅助生成失败，请稍后重试。"
  }
}
```

#### 错误码

| Code | 说明 | 前端展示 |
|------|------|------|
| `UNAUTHORIZED` | 用户未登录 | 不展示（路由守卫已拦截） |
| `INVALID_REQUEST_BODY` | 缺少必填字段 | "请求参数错误。" |
| `INVALID_ACTION_TYPE` | actionType 不在 4 个值中 | "无效的辅助类型。" |
| `AI_ASSIST_FAILED` | AI API 调用失败 | "AI 辅助生成失败，请稍后重试。" |
| `AI_RESPONSE_INVALID` | AI 返回内容无法解析 | "AI 返回内容异常，请重试。" |
| `RATE_LIMITED` | 请求过于频繁 | "请求过于频繁，请稍后再试。" |
| `INTERNAL_ERROR` | 服务端内部错误 | "服务异常，请稍后重试。" |

### 5.2 服务端实现架构

```typescript
// src/app/api/task-assist/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/supabase-server";
import { callAIWithPrompts } from "@/lib/ai-client";
import { buildAssistUserPrompt, ASSIST_SYSTEM_PROMPT } from "@/prompts/task-assist";
import { parseAssistAIResponse } from "@/lib/task-assist-parser";

export async function POST(request: NextRequest) {
  // 1. 认证
  const userId = await getAuthenticatedUserId(request);
  if (!userId) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "请先登录。" } },
      { status: 401 }
    );
  }

  // 2. 解析请求
  const { taskTitle, goal, actionType } = await request.json();
  // 校验...

  // 3. 构造 prompt
  const systemPrompt = ASSIST_SYSTEM_PROMPT;
  const userPrompt = buildAssistUserPrompt({ taskTitle, goal, actionType });

  // 4. 调用 AI
  const content = await callAIWithPrompts({
    apiKey: process.env.DEEPSEEK_API_KEY!,
    baseUrl: process.env.DEEPSEEK_API_BASE_URL,
    systemPrompt,
    userPrompt,
    maxTokens: 300,
    temperature: 0.4,
  });

  // 5. 解析
  const result = parseAssistAIResponse(content);

  // 6. 返回
  return NextResponse.json({ success: true, data: { result } });
}
```

**关键设计**：
- **Session-aware**：复用 `getAuthenticatedUserId()`，与现有 API Route 一致。
- **API Key 来自服务端环境变量**：不暴露给前端。
- **复用 `callAIWithPrompts`**：与 AI 复盘使用相同的底层调用（max_tokens=300, temperature=0.4）。
- **不调用 `verify-turnstile`**：已登录用户由 session JWT 保护，不需要 Turnstile。
- **不访问数据库**：不需要任务数据（仅用前端传来的 taskTitle + goal）。

---

## 六、Prompt 架构

### 6.1 新增文件：`src/prompts/task-assist.ts`

#### 6.1.1 公共 System Prompt

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

#### 6.1.2 四种操作的 User Prompt 构建

```typescript
export type AssistActionType = "how_to_start" | "break_down" | "five_minute" | "im_stuck";

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

### 6.2 为什么不复用 task-review.ts

| 维度 | task-review | task-assist |
|------|------------|-------------|
| 输入 | 完整任务组 + 7 天统计 | 单个任务 + goal + actionType |
| 输出 | JSON（feedbackText + sections + difficulty） | 纯文本 |
| 温度 | 0.3 | 0.4（需要更多创造性） |
| 最大 token | 400 | 300 |
| 职责 | 复盘已完成的工作 | 帮助推进未完成的任务 |

**结论：必须新增独立 prompt 文件。**

---

## 七、数据模型与类型

### 7.1 类型新增（`src/lib/types.ts`）

```typescript
// V2.4 新增 — AI 辅助类型

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

**总计新增**：~30 行（一个 union type + 一个 error code union type + 两个 response interface + 一个 response union type）。

### 7.2 零数据库变更

V2.4 **不新增任何数据库表或字段**。AI 辅助结果不持久化。

---

## 八、文件影响范围

### 8.1 预计修改文件总表

| # | 文件 | 操作 | 预估改动 | 说明 |
|:--:|------|:--:|:--:|------|
| 1 | `src/components/TaskAssistPanel.tsx` | **新增** | ~150 行 | 核心面板组件 |
| 2 | `src/hooks/useTaskAssist.ts` | **新增** | ~70 行 | AI 辅助状态管理 |
| 3 | `src/app/api/task-assist/route.ts` | **新增** | ~50 行 | API Route |
| 4 | `src/prompts/task-assist.ts` | **新增** | ~60 行 | 4 种操作的 System/User Prompt |
| 5 | `src/lib/task-assist-parser.ts` | **新增** | ~30 行 | AI 响应解析（纯文本，简单校验） |
| 6 | `src/lib/types.ts` | 🔧 修改 | +30 行 | 新增 AssistActionType / AssistResponse 等类型 |
| 7 | `src/components/TaskItem.tsx` | 🔧 修改 | +10 行 | 新增"AI 帮我一下"按钮 + 展开面板 |
| 8 | `src/components/TaskList.tsx` | 🔧 修改 | +5 行 | 透传 assist 相关 props |
| 9 | `src/components/MainWorkspace.tsx` | 🔧 修改 | +8 行 | 新增 `activeAssistTaskId` state |

**预计总改动量**：~413 行（含 5 个新文件 + 4 个修改文件）。

### 8.2 禁止修改文件

| # | 文件 | 原因 |
|---|------|------|
| 1 | `src/hooks/useTaskGroup.ts` | 核心任务状态，不改 |
| 2 | `src/hooks/useAuth.ts` | Auth hook，不改 |
| 3 | `src/hooks/useTaskReview.ts` | 复盘 hook，不改 |
| 4 | `src/hooks/useTaskStats.ts` | 统计 hook，不改 |
| 5 | `src/hooks/useTaskHistory.ts` | 历史 hook，不改 |
| 6 | `src/lib/ai-client.ts` | AI 底层调用，不改 |
| 7 | `src/lib/task-parser.ts` | 任务解析器，不改 |
| 8 | `src/lib/review-parser.ts` | 复盘解析器，不改 |
| 9 | `src/lib/supabase-client.ts` | 客户端 Supabase，不改 |
| 10 | `src/lib/supabase-server.ts` | 服务端 Supabase，不改 |
| 11 | `src/lib/constants.ts` | 常量文件，不改 |
| 12 | `src/lib/auth-errors.ts` | Auth 错误脱敏，不改 |
| 13 | `src/components/GoalInput.tsx` | 目标输入，不改 |
| 14 | `src/components/TaskReviewPanel.tsx` | 复盘面板，不改 |
| 15 | `src/components/StatsBar.tsx` | 统计栏，不改 |
| 16 | `src/components/HistoryPanel.tsx` | 历史面板，不改 |
| 17 | `src/components/Header.tsx` | Header，不改 |
| 18 | `src/components/HeroSection.tsx` | 引导区，不改 |
| 19 | `src/components/LoginPageContent.tsx` | 登录表单，不改 |
| 20 | `src/components/TurnstileWidget.tsx` | Turnstile，不改 |
| 21 | `src/app/app/page.tsx` | `/app` 入口（路由守卫），不改 |
| 22 | `src/app/api/**`（全部现有 8 个 Route） | 不改 |
| 23 | `src/prompts/task-generation.ts` | 任务生成 prompt，不改 |
| 24 | `src/prompts/task-review.ts` | 复盘 prompt，不改 |
| 25 | `package.json` / `package-lock.json` | 无新依赖 |
| 26 | `.env.local` | Codex 不操作 |
| 27 | 数据库 schema / migration | 零变更 |

---

## 九、安全边界

| # | 原则 | V2.4 遵守 |
|---|------|:--:|
| 1 | API Route 必须 session-aware | ✅ `getAuthenticatedUserId()` |
| 2 | 不暴露 AI API Key 到前端 | ✅ Key 仅在服务端 `process.env` |
| 3 | 不把 taskTitle / goal 写入数据库 | ✅ V2.4 不持久化 |
| 4 | 不做客户端 AI 调用 | ✅ 全部经过 `/api/task-assist` |
| 5 | 需要防刷 | ✅ 已登录用户由 session JWT 保护；rate limit 由 API Route 逻辑 + Supabase 原生限速保护 |
| 6 | 不需要 Turnstile | ✅ 只有登录用户能访问 `/app`，不需要额外人机验证 |
| 7 | 不新增环境变量 | ✅ 复用现有 `DEEPSEEK_API_KEY` / `DEEPSEEK_API_BASE_URL` |
| 8 | 不修改 `.env.local` | ✅ Codex 不操作 |

---

## 十、Human-in-the-Loop 边界

| 谁做 | 什么 |
|------|------|
| **用户** | 判断任务是否完成、勾选完成、执行关键操作、做最终决定 |
| **AI** | 建议第一步、拆分步骤、给出 5 分钟版本、分析卡点 |

**AI 永远不替用户完成任务，只帮用户看清怎么做。**

**V2.4 不做的自动化**：
- ❌ AI 不自动勾选任务
- ❌ AI 不自动修改任务标题
- ❌ AI 不自动生成新任务
- ❌ AI 不自动执行任何操作
- ❌ AI 不访问外部网站或工具

---

## 十一、V2.4 不做事项

| # | 不做 | 原因 |
|---|------|------|
| 1 | 不做自由文本输入 | 留给 V2.5（MVP 先验证固定按钮） |
| 2 | 不做多轮任务聊天 | 留给 V2.5 或后续评估 |
| 3 | 不做动态快捷建议 | 留给 V2.5（根据任务标题自动推荐按钮） |
| 4 | 不做 AI 辅助结果持久化 | 留给 V2.6（轻量行为记录） |
| 5 | 不做历史记录 | 同上 |
| 6 | 不做数据库变更 | V2.4 不新增表/字段 |
| 7 | 不做 Streaming（SSE） | 留给 V2.5 评估（V2.4 用标准 request-response） |
| 8 | 不做跨任务上下文 | 每次辅助只针对单个任务 |
| 9 | 不做 UI 美化 | 全部留给 V3.0 |
| 10 | 不做页面重构 | `/app` 保持现有单页结构 |
| 11 | 不做生成模板/初稿 | 超出"辅助执行"范围 |
| 12 | 不做完成标准 | 同上 |
| 13 | 不做"下一步做什么"（跨任务推荐） | 超出单个任务范围 |
| 14 | 不做任务级 Agent | 不做全自动执行 |
| 15 | 不做文件生成 | 不涉及文件系统 |
| 16 | 不做外部工具调用 | 不调用第三方 API |

---

## 十二、验收标准

### 12.1 功能验收

| # | 验收项 | 操作 | 预期结果 |
|---|--------|------|------|
| **F1** | "AI 帮我一下"按钮可见 | 有任务时，每个 TaskItem 右侧显示按钮 | 按钮可见、可点击 |
| **F2** | 面板展开 | 点击"AI 帮我一下" | TaskAssistPanel 展开在任务下方，显示 4 个按钮 |
| **F3** | 面板关闭 | 再次点击"AI 帮我一下"或点击 ✕ | 面板关闭，结果清除 |
| **F4** | 单一面板 | 打开任务 A 面板 → 点击任务 B 的"AI 帮我一下" | A 面板关闭，B 面板打开 |
| **F5** | "怎么开始"返回结果 | 点击"怎么开始" | AI 返回 1-3 个起步动作 |
| **F6** | "拆小一点"返回结果 | 点击"拆小一点" | AI 返回 3-5 个小步骤 |
| **F7** | "给我 5 分钟版本"返回结果 | 点击"给我 5 分钟版本" | AI 返回极简可执行版本 |
| **F8** | "我卡住了"返回结果 | 点击"我卡住了" | AI 返回卡点分析 + 下一步建议 |
| **F9** | 结果可复制 | 点击"📋 复制" | 结果文本复制到剪贴板 |
| **F10** | "换一个"可重新生成 | 点击"🔄 换一个" | 使用相同 actionType 重新请求，返回新结果 |
| **F11** | 切换按钮可新请求 | 在结果展示时点击不同按钮 | 使用新 actionType 请求，返回新结果 |
| **F12** | 加载状态 | 点击按钮后等待 AI 返回 | 显示加载动画（当前按钮 disabled） |
| **F13** | 错误状态 | AI 请求失败 | 显示错误提示 + "🔄 重试"按钮 |
| **F14** | 未登录不可访问 | 未登录访问 `/app` | 路由守卫跳转 `/login`（不变） |
| **F15** | AI 输出不包含 Markdown | 所有 4 种操作的结果 | 纯文本，无 `#` `**` `- ` 等 Markdown 语法 |

### 12.2 安全验收

| # | 验收项 | 验证方式 | 预期结果 |
|---|--------|------|------|
| S1 | API Route 需认证 | 不登录直接 curl `/api/task-assist` | 返回 401 |
| S2 | API Key 不泄露 | 浏览器 Network 面板 | 请求/响应中不出现 `DEEPSEEK_API_KEY` |
| S3 | 不持久化 | 刷新页面后 | AI 辅助面板关闭，结果消失 |
| S4 | AI 输出不包含敏感内容 | 多种任务测试 | 不出现越权内容 |

### 12.3 回归验收

| # | 验收项 | 预期结果 |
|---|--------|---------|
| R1 | 任务生成 | 不受影响 |
| R2 | 任务勾选 | 不受影响 |
| R3 | 清空/重新生成/开始新一天 | 不受影响 |
| R4 | 历史记录 | 不受影响 |
| R5 | 统计数据 | 不受影响 |
| R6 | AI 复盘 | 不受影响 |
| R7 | 智能调整 | 不受影响 |
| R8 | OTP 登录 | 不受影响 |
| R9 | 密码登录 | 不受影响 |
| R10 | 忘记密码/重置密码 | 不受影响 |

### 12.4 门禁

```bash
npm run lint     # 零 error
npm run build    # Compiled successfully，TypeScript 检查通过
git status --short   # 仅 V2.4 允许的文件变更，无意外修改
```

---

## 十三、风险矩阵

### P0（阻塞 — 必须解决才能实现）

| # | 风险 | 可能性 | 影响 | 缓解措施 |
|---|------|:--:|:--:|------|
| **P0-1** | 改坏 TaskItem 导致任务勾选失效 | 🟢 极低 | 🔴 高 | TaskItem 仅新增一个按钮 + 条件渲染面板，不修改 checkbox/onToggle |
| **P0-2** | API Route 未正确使用 getAuthenticatedUserId | 🟢 极低 | 🔴 高 | 复用现有 generate-tasks route 的认证模式 |
| **P0-3** | AI 输出包含不受控的内容（如越权建议） | 🟢 极低 | 🟡 中 | System Prompt 严格约束输出范围 + parser 做长度校验 |

### P1（必须修复 — 影响功能或安全）

| # | 风险 | 可能性 | 影响 | 缓解措施 |
|---|------|:--:|:--:|------|
| **P1-1** | AI 返回过长或格式异常 | 🟡 中 | 🟡 中 | parser 截断超长内容（>500 字） + 清理 Markdown 标记 |
| **P1-2** | 4 个按钮在窄屏手机上排列不佳 | 🟡 低 | 🟡 中 | 移动端使用 2×2 网格布局 |
| **P1-3** | AI 延迟过高导致用户等待焦虑 | 🟡 中 | 🟡 中 | 使用 `max_tokens: 300` + `temperature: 0.4` 控制响应时间；前端显示加载动画 |

### P2（建议修复 — 不影响功能）

| # | 风险 | 缓解措施 |
|---|------|---------|
| **P2-1** | TaskAssistPanel 关闭后结果丢失 | 设计决定：不持久化。后续 V2.6 做轻量行为记录 |
| **P2-2** | 用户不知道点哪个按钮 | 按钮上显示简短说明文字（如"怎么开始"下方小字"找到第一步"） |
| **P2-3** | 换一个生成的结果不如第一次好 | 每次独立请求，AI 输出有一定随机性。用户可多次换一个 |

---

## 十四、与 Roadmap 的关系

### 14.1 本架构文档 vs Roadmap-Core-First-V2.3-to-V3.0

| 维度 | Roadmap V2.4（§五） | 本架构文档 V2.4 |
|------|---------------------|-----------------|
| 入口 | "AI 帮我推进" 按钮 + 自由输入 | "AI 帮我一下" 按钮 + 4 个固定按钮 |
| 交互方式 | 自由文本输入 + 意图识别 | 4 个预设按钮（无自由输入） |
| 追问 | 最多一次追问 | 零追问 |
| 输出类型 | 步骤/模板/初稿/检查清单/建议 | 4 种固定输出格式 |
| 复制 | ✅ | ✅ |
| 重新生成 | ✅ | ✅（"换一个"） |

**差异原因**：本架构基于用户最新产品决策——V2.4 必须小步上线，先验证"用户是否真的会点 AI 辅助执行"。自由输入 + 意图识别的开发成本远高于固定按钮，且固定按钮降低了用户认知成本。

**本架构文档以用户最新指令为准，替代 Roadmap 中 V2.4 的交互设计细节。**

### 14.2 Roadmap 中的 V2.5 内容不受影响

Roadmap V2.5（动态快捷建议、意图识别增强、输出优化、Streaming 评估）仍然排在本 V2.4 之后。如果 V2.4 验证有效，V2.5 再引入自由输入。

---

## 十五、后续衔接

### 15.1 V2.4 完成后

```
V2.4 AI 辅助执行 MVP ✅
    ↓
V2.5 AI 辅助执行增强
    ├── 动态快捷建议（根据任务标题自动生成 2-3 个推荐按钮）
    ├── 意图识别增强（支持自由文本输入）
    ├── 输出类型优化
    └── Streaming 评估
    ↓
V2.6 AI 辅助沉淀
    ├── 轻量行为记录（taskId + assistIntent + wasCopied + wasRegenerated + wasHelpful）
    └── 数据用于后续复盘和 AI 质量优化
    ↓
V3.0 正式 App 架构重构
```

### 15.2 标准工作流

```
Claude Code 写架构方案（本文档）
    → ChatGPT 审查
    → Claude Code 写执行方案（docs/Execution-Plan-V2.4-AI-Assist.md）
    → ChatGPT 审查
    → Codex 按执行方案实现
    → Claude Code Review
    → ChatGPT 最终把关
    → 提交
```

### 15.3 V2.4 不进入

- ❌ V2.5 自由输入 / 动态快捷建议 → V2.5
- ❌ V2.6 AI 辅助沉淀 → V2.6
- ❌ V3.0 页面重构 / UI 美化 → V3.0
- ❌ 数据库 schema 变更 → 除非单独评审

---

> **文档结束**
>
> **下一文档**：`docs/Execution-Plan-V2.4-AI-Assist.md`（V2.4 AI 辅助执行 执行方案，待本文档经 ChatGPT 审查通过后启动）
>
> **关联文档**：
> - [Roadmap-Core-First-V2.3-to-V3.0.md](Roadmap-Core-First-V2.3-to-V3.0.md) — 核心能力优先路线总规划
> - [Architecture-V2.3-Security.md](Architecture-V2.3-Security.md) — V2.3 安全增强架构方案（✅ 已完成）
> - [Execution-Plan-V2.3-Security.md](Execution-Plan-V2.3-Security.md) — V2.3A/B/C 执行方案（✅ 已完成）
> - [Architecture-V2.3D-Reset-Password-OTP.md](Architecture-V2.3D-Reset-Password-OTP.md) — V2.3D 架构方案（✅ 已完成）
> - [Execution-Plan-V2.3D-Reset-Password-OTP.md](Execution-Plan-V2.3D-Reset-Password-OTP.md) — V2.3D 执行方案（✅ 已完成）
> - [PROJECT-CONTEXT.md](PROJECT-CONTEXT.md) — 项目长期上下文
> - [PROJECT-INDEX.md](PROJECT-INDEX.md) — 项目文件索引
