# V2.5：Task Companion Mode / 任务执行陪伴模式 架构方案

> **状态**：架构设计阶段，当前仅用于方向锁定，不在 V2.4 返修 / Review 阶段实现。待 ChatGPT 审查通过后，由 Claude Code 编写 V2.5 执行方案；执行方案经 ChatGPT 审查后，再交给 Codex 实现。
> **依赖**：V2.4 AI 辅助执行 MVP ✅（4 个固定按钮：怎么开始 / 拆小一点 / 5 分钟版本 / 我卡住了）
> **定位**：在 V2.4 TaskAssistPanel 基础上新增"开始陪我做"入口，AI 陪用户一步一步推进任务，不做全自动 Agent
> **上一文档**：[Architecture-V2.4-AI-Assist.md](Architecture-V2.4-AI-Assist.md)（V2.4 AI 辅助执行 MVP）
> **下一文档**：`docs/Execution-Plan-V2.5-Task-Companion.md`（V2.5 执行方案，待本架构审查通过后编写）
> **设计日期**：2026-07-06

---

## 目录

- [一、核心定位](#一核心定位)
- [二、与 V2.4 的关系](#二与-v24-的关系)
- [三、用户主流程](#三用户主流程)
- [四、情绪鼓励规则](#四情绪鼓励规则)
- [五、AI 输出规则](#五ai-输出规则)
- [六、组件架构](#六组件架构)
- [七、Hook 架构](#七hook-架构)
- [八、API Route 架构](#八api-route-架构)
- [九、Prompt 架构](#九prompt-架构)
- [十、数据模型与类型](#十数据模型与类型)
- [十一、文件影响范围](#十一文件影响范围)
- [十二、安全边界](#十二安全边界)
- [十三、Human-in-the-Loop 边界](#十三human-in-the-loop-边界)
- [十四、V2.5 不做事项](#十四v25-不做事项)
- [十五、验收标准](#十五验收标准)
- [十六、风险矩阵](#十六风险矩阵)
- [十七、与 Roadmap 的关系](#十七与-roadmap-的关系)
- [十八、后续衔接](#十八后续衔接)

---

## 一、核心定位

### 1.1 一句话

**V2.5 不是让 AI 替用户完成任务，而是让 AI 陪用户一步一步推进任务。**

### 1.2 核心目标

帮助用户在以下时刻继续行动：

| 用户状态 | 陪伴策略 |
|----------|----------|
| **卡住了**，不知道下一步做什么 | 给出当前最小可执行动作 |
| **气馁了**，觉得做不完 | 承认状态 + 降低压力 + 缩小任务 |
| **拖延了**，不想开始 | 给出一个 30 秒就能做的小动作 |
| **觉得任务太大**，无从下手 | 只给第一步，不展示全貌 |

### 1.3 核心原则

```
用户主导执行 → AI 陪伴推进 → 用户自己勾选完成
```

- AI 每次只给**一个当前步骤**，不给完整计划
- 用户执行后给反馈，AI 根据反馈调整下一步
- **完成权始终在用户手里**：AI 不自动勾选、不自动生成任务

---

## 二、与 V2.4 的关系

### 2.1 定位差异

| 维度 | V2.4 — AI 帮我一下 | V2.5 — AI 陪我一步一步做 |
|------|---------------------|---------------------------|
| **交互模式** | 单次请求 → 单次输出 | 持续对话 → 逐步推进 |
| **用户动作** | 选一个按钮，拿到结果 | 持续反馈（完成/卡住/太难/鼓励） |
| **AI 输出** | 单次建议/步骤/模板 | 每次只给一个当前步骤 |
| **时间跨度** | 瞬时（点一下就走） | 持续（陪到用户退出或完成） |
| **入口** | "AI 帮我一下" → 4 个按钮 | TaskAssistPanel 内新增"开始陪我做" |
| **状态管理** | 无状态（每次独立请求） | 有状态（步骤历史 + 用户反馈上下文） |

### 2.2 互补关系

**V2.5 不推翻 V2.4，而是在 V2.4 基础上增加新模式。**

```
TaskAssistPanel
├── V2.4 快速辅助（保留）
│   ├── 怎么开始
│   ├── 拆小一点
│   ├── 5 分钟版本
│   └── 我卡住了
│
└── V2.5 新增：开始陪我做 ──→ TaskCompanionPanel
    ├── 我完成了
    ├── 我卡住了
    ├── 太难了
    ├── 鼓励我一下
    └── 退出陪伴
```

- 用户可以先点"怎么开始"了解方向，再点"开始陪我做"逐步执行
- V2.4 的 4 个按钮行为完全不变
- V2.5 入口放在 V2.4 TaskAssistPanel 底部，作为独立 CTA

---

## 三、用户主流程

### 3.1 完整流程

```
用户在 TaskList 看到任务
        │
        ▼
点击 "AI 帮我一下" 按钮（V2.4 已有）
        │
        ▼
打开 TaskAssistPanel（V2.4 已有）
  展示 4 个辅助按钮（V2.4 已有）
        │
        ├── 点击 V2.4 按钮 → 单次 AI 辅助（不变）
        │
        └── 点击 "开始陪我做"（V2.5 新增入口）
                │
                ▼
        进入 TaskCompanionPanel
                │
        ┌───────────────────────────────┐
        │                               │
        ▼                               │
   AI 给出当前第一小步                   │
   （80-150 字，不超过 3 个动作）        │
        │                               │
        ▼                               │
   用户执行（在真实世界做）              │
        │                               │
        ▼                               │
   用户点击反馈按钮：                     │
   ┌─────────────────────────────┐      │
   │ 我完成了  │  我卡住了       │      │
   │ 太难了    │  鼓励我一下     │      │
   │           │  退出陪伴       │      │
   └─────────────────────────────┘      │
        │                               │
        ▼                               │
   AI 根据反馈给下一步                   │
   - "我完成了" → 推进到下一步           │
   - "我卡住了" → 给更小动作             │
   - "太难了" → 降低难度/拆解            │
   - "鼓励我一下" → 短、具体、行动导向   │
        │                               │
        └────── 循环 ──────────────────┘
                │
                ▼
         用户自己勾选任务完成
         （TaskItem checkbox，V2.0 已有）
```

### 3.2 关键决策点

| 时刻 | 谁决定 | 说明 |
|------|--------|------|
| 是否进入陪伴模式 | **用户** | 从 TaskAssistPanel 主动点击"开始陪我做" |
| 步骤是否完成 | **用户** | 点击"我完成了" |
| 是否卡住 | **用户** | 点击"我卡住了" |
| 是否太难 | **用户** | 点击"太难了" |
| 任务是否最终完成 | **用户** | 自己勾选 TaskItem checkbox |
| 何时退出 | **用户** | 点击"退出陪伴" |

**AI 不做任何自动判断。**

---

## 四、情绪鼓励规则

### 4.1 总则

**可以鼓励，但不能鸡汤。可以承认用户卡住/气馁/拖延，不做心理诊断。**

### 4.2 禁止事项

| # | 禁止 | 原因 |
|---|------|------|
| 1 | 不做心理诊断 | 不是心理咨询工具 |
| 2 | 不做情绪分析报告 | 不给用户贴标签（"你看起来焦虑"） |
| 3 | 不写长篇鸡汤 | 用户需要下一步动作，不需要被教育 |
| 4 | 不说"你一定可以的" | 空泛鼓励反而增加压力 |
| 5 | 不说"相信自己" | 同上，缺乏可操作性 |
| 6 | 不说"你很棒" | 没有行动锚点的夸奖是噪音 |

### 4.3 标准鼓励结构

每次鼓励遵循 **4 步结构**，缺一不可：

```
1. 承认状态    "我感觉到这个任务让你有点不知道怎么下手"
2. 降低压力    "这很正常，大部分类似的任务刚开始都是这样"
3. 缩小任务    "我们不需要现在就做完，只需要做一件很小的事"
4. 给动作       "先打开一个空白文档，标题写上'xxx'，就这一步"
```

### 4.4 鼓励示例

**✅ 好的鼓励：**
> 我感觉到这个任务让你有点不知道怎么下手。这很正常——大部分人面对新任务都会这样。我们先不想完整方案，就做一件事：打开备忘录，写下你脑子里关于这个任务的任何三个词。就三个词，写完就停。

**❌ 差的鼓励：**
> 相信自己！你一定可以的！加油！💪 每个人都有自己的节奏，重要的是保持积极心态。困难只是暂时的，成功属于坚持的人。你可以的！

两者区别：

| 维度 | ✅ 好的鼓励 | ❌ 差的鼓励 |
|------|------------|------------|
| 是否承认状态 | 明确承认"不知道怎么下手" | 没有承认 |
| 是否降低压力 | 明确说"很正常" | 没有 |
| 是否缩小任务 | 只做"写下三个词" | 没有具体动作 |
| 是否有行动锚点 | "打开备忘录，写下" | 全部是空泛口号 |

---

## 五、AI 输出规则

### 5.1 核心约束

| # | 规则 | 说明 |
|---|------|------|
| 1 | **每次只输出一个当前步骤** | 不给完整计划，不展示后续步骤 |
| 2 | **80-150 字左右** | 短小精悍，用户能一眼看完 |
| 3 | **不超过 3 个动作** | 一个步骤内最多 3 个小动作 |
| 4 | **不输出长篇理论** | 不解释"为什么这样做" |
| 5 | **不输出完整代写内容** | 不给完整文章/邮件/简历/文件 |
| 6 | **不输出复杂计划** | 不给甘特图、不给 5 步路线图 |
| 7 | **不输出空泛鸡汤** | 每条输出都有具体动作 |

### 5.2 首次输出格式（userSignal: "start"）

```
[承认任务/目标] [给出当前第一步]
[1-2 个非常具体的动作描述]
[一句轻量鼓励收尾]
```

示例：
> 好的，我们开始"撰写项目周报"。现在只做第一步：打开你的文档工具（飞书/Notion/Word 都行），新建一个文件，标题写"项目周报 - 本周"加上今天的日期。就这一步，打开建好就行。

### 5.3 用户反馈后输出格式

| 反馈 | AI 响应策略 | 示例 |
|------|------------|------|
| **我完成了** | 认可 + 推进下一步 | "很好，第一步完成了。接下来做这个：..." |
| **我卡住了** | 承认状态 + 把当前步骤拆成更小动作 | "没关系，卡住很正常。我们把这一步再拆小一点：..." |
| **太难了** | 承认难度 + 降级方案 | "确实，这个任务本身就有难度。我们换个思路，先做一个简化版：..." |
| **鼓励我一下** | 遵循 §四 4 步结构 | "我感觉到你有点累了..." |

### 5.4 完成信号

当 AI 判断当前任务已经推进到可以收尾时，输出以 `[companionState: "done"]` 标记结束，并引导用户自己勾选完成：

> 到这一步，周报的核心内容已经有了。剩下的你可以自己补充和润色。如果觉得差不多了，就去勾选"撰写项目周报"为完成吧。你做到了。

**注意**：AI 只是"建议可以收尾"，**勾选完成仍然由用户手动操作**。

---

## 六、组件架构

### 6.1 新增组件

#### TaskCompanionPanel.tsx

```
┌──────────────────────────────────────┐
│  🧑‍🏫 AI 陪你做                        │  ← 标题
│                                      │
│  ┌──────────────────────────────────┐│
│  │                                  ││
│  │  AI 当前步骤输出区域              ││  ← whitespace-pre-line
│  │  （80-150 字）                    ││
│  │                                  ││
│  └──────────────────────────────────┘│
│                                      │
│  用户反馈按钮（5 个）：               │
│  ┌──────────┐  ┌──────────┐         │
│  │ ✅ 我完成了│  │ 🆘 我卡住了│        │  ← 2×3 网格（移动端）或横排
│  ├──────────┤  ├──────────┤         │
│  │ 😰 太难了 │  │ 💪 鼓励我一下│       │
│  ├──────────┤  ├──────────┤         │
│  │ 🚪 退出陪伴│                      │
│  └──────────┘  └──────────┘         │
│                                      │
│  [📋 复制当前步骤]                    │  ← 辅助操作
└──────────────────────────────────────┘
```

状态机：

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

- `idle`：初始状态，等待首次请求
- `loading`：等待 AI 返回
- `active`：展示当前步骤，等待用户反馈
- `done`：AI 建议可以收尾
- `error`：请求失败，可重试

### 6.2 修改组件（范围最小化）

#### TaskAssistPanel.tsx

在现有 4 个 V2.4 按钮下方新增：

```
┌──────────────────────────────────────┐
│  V2.4 4 个按钮（不变）                │
│  ┌────────┐ ┌──────────┐            │
│  │ 怎么开始│ │ 拆小一点  │            │
│  └────────┘ └──────────┘            │
│  ┌────────┐ ┌──────────┐            │
│  │5分钟版本│ │ 我卡住了  │            │
│  └────────┘ └──────────┘            │
│                                      │
│  ──────────── 或 ────────────        │
│                                      │
│  ┌──────────────────────────────┐   │
│  │     🧑‍🏫 开始陪我做             │   │  ← V2.5 新增入口
│  │     一步一步来，我陪你做       │   │
│  └──────────────────────────────┘   │
└──────────────────────────────────────┘
```

- 新增 `onStartCompanion` prop
- 当 `onStartCompanion` 被调用时，父组件切换到 TaskCompanionPanel
- V2.4 现有逻辑**零修改**

#### TaskItem.tsx

- 新增 `isCompanionOpen` prop
- 新增 `onToggleCompanion` prop
- 条件渲染 TaskCompanionPanel（当 `isCompanionOpen` 为 true 时取代 TaskAssistPanel，或作为独立区块）
- 现有 checkbox、onToggle、V2.4 按钮逻辑**零修改**

#### TaskList.tsx

- 新增 `activeCompanionTaskId` prop
- 新增 `onToggleCompanion` prop
- 透传给 TaskItem

#### MainWorkspace.tsx

- 新增 `useState<string | null>(null)` 管理 `activeCompanionTaskId`
- 新增 `handleToggleCompanion` 函数（与 `handleToggleAssist` 同理）
- 传递 props 到 TaskList

### 6.3 组件关系图

```
MainWorkspace
├── activeAssistTaskId    (V2.4)
├── activeCompanionTaskId (V2.5 新增)
├── handleToggleAssist    (V2.4)
├── handleToggleCompanion (V2.5 新增)
│
└── TaskList
    ├── activeAssistTaskId    → TaskItem → TaskAssistPanel  (V2.4)
    └── activeCompanionTaskId → TaskItem → TaskCompanionPanel (V2.5)
```

**关键约束**：同一任务不能同时打开 TaskAssistPanel 和 TaskCompanionPanel。当 `activeCompanionTaskId === task.id` 时，TaskAssistPanel 关闭，TaskCompanionPanel 打开。当 `activeAssistTaskId === task.id` 时，TaskCompanionPanel 关闭，TaskAssistPanel 打开。

---

## 七、Hook 架构

### 7.1 useTaskCompanion.ts

```typescript
// 状态定义
type CompanionStatus = "idle" | "loading" | "active" | "done" | "error";

type UserSignal = "start" | "done" | "stuck" | "too_hard" | "encourage";

interface CompanionStep {
  message: string;       // 给用户看的文案（80-150 字）
  companionState: "active" | "done";
}

interface UseTaskCompanionOptions {
  taskId: string;
  taskTitle: string;
  goal: string;
}

interface UseTaskCompanionReturn {
  status: CompanionStatus;
  currentStep: CompanionStep | null;
  error: string | null;
  stepHistory: CompanionStep[];   // 用于上下文但不持久化
  startCompanion: () => Promise<void>;
  sendSignal: (signal: UserSignal) => Promise<void>;
  exitCompanion: () => void;
  reset: () => void;
}
```

关键行为：

| 行为 | 说明 |
|------|------|
| `startCompanion()` | POST `/api/task-companion` 带 `userSignal: "start"`，进入 `loading → active` |
| `sendSignal(signal)` | POST `/api/task-companion` 带当前步骤上下文 + 用户反馈，AI 返回下一步 |
| `exitCompanion()` | 清空当前状态，回到 `idle` |
| `reset()` | 同 exitCompanion |
| 竞态处理 | `requestIdRef` + `inflightRef`（与 useTaskAssist 相同模式） |
| 错误映射 | 网络错误 → 中文提示；API 错误 → 中文错误码映射 |
| **不持久化** | 不用 localStorage/sessionStorage/数据库 |

---

## 八、API Route 架构

### 8.1 路由

`POST /api/task-companion`

### 8.2 请求体

```typescript
interface TaskCompanionRequest {
  taskTitle: string;          // 必填，任务标题，trim + ≤200 字
  goal?: string;              // 可选，任务目标，trim + ≤200 字
  currentStep?: string;       // 可选，当前步骤文案（用于上下文）
  stepHistory?: string[];     // 可选，历史步骤摘要（最多保留最近 5 条）
  userSignal: UserSignal;     // "start" | "done" | "stuck" | "too_hard" | "encourage"
}
```

### 8.3 响应体

成功：
```typescript
interface TaskCompanionSuccessResponse {
  success: true;
  data: {
    message: string;                   // 当前步骤文案（80-150 字）
    companionState: "active" | "done";  // active = 继续，done = 建议收尾
  };
}
```

失败：
```typescript
interface TaskCompanionErrorResponse {
  success: false;
  error: {
    code: CompanionErrorCode;
    message: string;
  };
}

type CompanionErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_REQUEST_BODY"
  | "INVALID_SIGNAL"
  | "AI_COMPANION_FAILED"
  | "AI_RESPONSE_INVALID"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";
```

### 8.4 服务端处理流程

```
1. getAuthenticatedUserId() → 无参数
2. if (!userId) → 401
3. 校验请求体：
   - taskTitle: 必填, trim, ≤200 字
   - goal: 可选, trim, ≤200 字
   - userSignal: 必填, 枚举校验
4. 构造 Prompt（服务端，不来自前端）
5. 调用 callAIWithPrompts({
     apiKey: process.env.AI_API_KEY,
     baseUrl: process.env.AI_API_BASE_URL,
     model: process.env.AI_MODEL,
     systemPrompt: COMPANION_SYSTEM_PROMPT,
     userPrompt: buildCompanionUserPrompt(input),
   })
6. 用 taskCompanionParser 解析 AI 返回的原始文本
7. 返回 { success: true, data: { message, companionState } }
8. catch 所有异常 → 不暴露原始 AI 异常 → 返回中文错误消息
```

### 8.5 频率限制

与 V2.4 使用同一个 in-memory rate limiter 或独立实现：
- 10 次 / 60 秒 / userId
- 超过返回 `RATE_LIMITED`

### 8.6 不存储

- 不做数据库写入
- 不记录步骤历史到 Supabase
- 上下文由前端 `stepHistory` 携带（每次请求带上最近步骤）
- 刷新页面后陪伴状态丢失（MVP 接受）

---

## 九、Prompt 架构

### 9.1 文件

`src/prompts/task-companion.ts`

### 9.2 导出

```typescript
export const COMPANION_SYSTEM_PROMPT: string;
// AI 角色定义 + 输出约束 + 鼓励规则 + 禁止事项

export function buildCompanionUserPrompt(input: {
  taskTitle: string;
  goal?: string;
  currentStep?: string;
  stepHistory?: string[];
  userSignal: UserSignal;
}): string;
// 根据 userSignal 动态构造用户 Prompt
```

### 9.3 System Prompt 结构

```
你是 AI Todo 的任务执行陪伴助手。
你的角色是陪用户一步一步推进任务，不是替用户完成任务。

## 核心规则
1. 每次只输出当前一个步骤，80-150 字
2. 不超过 3 个具体动作
3. 不输出完整计划，不输出后续步骤
4. 不输出长篇理论
5. 不输出空泛鸡汤
6. 不替用户完成完整任务
7. 不生成完整文章/邮件/简历/文件

## 用户反馈处理
- "start" → 给出第一步，承认任务并降低开始门槛
- "done" → 认可完成，推进到下一步
- "stuck" → 承认卡住的正常性，把当前步骤拆成更小动作
- "too_hard" → 承认难度，给降级方案
- "encourage" → 遵循鼓励规则（见下）

## 鼓励规则
当用户请求鼓励时：
1. 先承认用户的感受
2. 降低压力（"这很正常"）
3. 缩小任务范围
4. 给一个马上能做的小动作

不做：
- 不做心理诊断
- 不写长篇鸡汤
- 不说"你一定可以的""相信自己""你很棒"

## 收尾判断
当你认为任务已经推进到可以收尾时，输出 [DONE] 标记，告诉用户可以去勾选完成了。

## 输出格式
直接输出给用户看的文案，不需要 JSON，不需要标题，不需要格式标记。
```

### 9.4 User Prompt 构造逻辑

```typescript
function buildCompanionUserPrompt(input): string {
  const parts: string[] = [];

  parts.push(`用户的任务：${input.taskTitle}`);
  if (input.goal) parts.push(`用户的目标：${input.goal}`);
  if (input.currentStep) parts.push(`用户当前步骤：${input.currentStep}`);
  if (input.stepHistory?.length) {
    parts.push(`已完成步骤：${input.stepHistory.join(" → ")}`);
  }

  switch (input.userSignal) {
    case "start":
      parts.push("用户刚开始做这个任务，请给出当前第一小步。");
      break;
    case "done":
      parts.push("用户完成了你上一步给出的步骤，请给出下一步。");
      break;
    case "stuck":
      parts.push("用户在上一步卡住了，请把当前步骤拆成更小的动作。");
      break;
    case "too_hard":
      parts.push("用户觉得当前步骤太难了，请给出一个降级/简化方案。");
      break;
    case "encourage":
      parts.push("用户需要鼓励，请按照鼓励规则给出简短、具体、行动导向的鼓励。");
      break;
  }

  return parts.join("\n");
}
```

---

## 十、数据模型与类型

### 10.1 新增类型（追加到 src/lib/types.ts）

```typescript
// V2.5 任务执行陪伴

export type CompanionUserSignal = "start" | "done" | "stuck" | "too_hard" | "encourage";

export type CompanionStatus = "active" | "done";

export type CompanionErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_REQUEST_BODY"
  | "INVALID_SIGNAL"
  | "AI_COMPANION_FAILED"
  | "AI_RESPONSE_INVALID"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface CompanionSuccessResponse {
  success: true;
  data: {
    message: string;
    companionState: CompanionStatus;
  };
}

export interface CompanionErrorResponse {
  success: false;
  error: {
    code: CompanionErrorCode;
    message: string;
  };
}

export type CompanionResponse = CompanionSuccessResponse | CompanionErrorResponse;
```

### 10.2 不做

- 不修改现有类型（AssistActionType, AssistErrorCode, AssistResponse 等）
- 不新增数据库字段
- 不新增数据库表
- 不做 migration

---

## 十一、文件影响范围

### 11.1 新增文件（5 个）

| # | 文件 | 职责 |
|---|------|------|
| 1 | `src/components/TaskCompanionPanel.tsx` | 陪伴面板 UI |
| 2 | `src/hooks/useTaskCompanion.ts` | 陪伴状态管理 hook |
| 3 | `src/app/api/task-companion/route.ts` | 陪伴 API POST handler |
| 4 | `src/prompts/task-companion.ts` | 陪伴 System Prompt + User Prompt 构造 |
| 5 | `src/lib/task-companion-parser.ts` | AI 响应解析（trim、截断、空内容检测） |

### 11.2 修改文件（5 个）

| # | 文件 | 修改内容 | 风险 |
|---|------|----------|:--:|
| 1 | `src/components/TaskAssistPanel.tsx` | 底部新增"开始陪我做"入口按钮 + `onStartCompanion` prop | 低 |
| 2 | `src/components/TaskItem.tsx` | 新增 `isCompanionOpen` / `onToggleCompanion` props + 条件渲染 TaskCompanionPanel | 低 |
| 3 | `src/components/TaskList.tsx` | 新增 `activeCompanionTaskId` / `onToggleCompanion` props 透传 | 低 |
| 4 | `src/components/MainWorkspace.tsx` | 新增 `activeCompanionTaskId` state + `handleToggleCompanion` | 低 |
| 5 | `src/lib/types.ts` | 追加 V2.5 类型（CompanionUserSignal、CompanionStatus、CompanionErrorCode、CompanionResponse） | 低 |

### 11.3 明确不改

| # | 不改 | 原因 |
|---|------|------|
| 1 | `useTaskGroup.ts` | 核心任务状态，不引入陪伴依赖 |
| 2 | `useAuth.ts` | Auth 逻辑与陪伴无关 |
| 3 | `useTaskAssist.ts` | V2.4 hook，独立运行 |
| 4 | `useTaskReview.ts` / `useTaskStats.ts` / `useTaskHistory.ts` | 复盘/统计/历史与陪伴无关 |
| 5 | 所有 Auth / V2.3 安全文件 | 不引入新安全依赖 |
| 6 | 数据库 schema / migration | 陪伴不持久化 |
| 7 | `src/app/api/generate-tasks/route.ts` | 任务生成与陪伴无关 |
| 8 | 历史 / 统计 / 复盘 API | 不受影响 |
| 9 | `src/lib/ai-client.ts` | 复用现有 `callAIWithPrompts`，不修改 |
| 10 | `src/lib/supabase-server.ts` | 复用现有 `getAuthenticatedUserId`，不修改 |
| 11 | `package.json` | 不新增依赖 |
| 12 | `.env.local` | 复用现有 `AI_API_KEY` / `AI_API_BASE_URL` / `AI_MODEL` |

---

## 十二、安全边界

| # | 检查项 | 说明 |
|---|--------|------|
| 1 | **必须校验登录** | `getAuthenticatedUserId()` 无参数调用，未登录返回 401 |
| 2 | **不允许前端传 Prompt** | 前端只传 taskTitle/goal/currentStep/stepHistory/userSignal |
| 3 | **不允许前端传 systemPrompt** | System Prompt 由服务端 `task-companion.ts` 构造 |
| 4 | **不暴露 AI API Key** | 仅服务端 `process.env.AI_API_KEY` 读取 |
| 5 | **不记录 token/cookie/secret** | 无持久化存储 |
| 6 | **不返回原始 AI 异常** | catch 所有异常，返回中文错误消息 |
| 7 | **不访问或修改任务完成状态** | 陪伴 API 不读/不写 Supabase 任务表 |
| 8 | **不自动勾选任务** | 完成权始终在用户 |
| 9 | **不修改 V2.3 Turnstile / 忘记密码 / 重置密码** | V2.3 安全边界完整保留 |
| 10 | **不修改 Auth 中间件 / 路由守卫** | 陪伴 API 复用现有 session 校验 |

---

## 十三、Human-in-the-Loop 边界

| 谁做 | 什么 |
|------|------|
| **用户** | 决定何时进入陪伴模式、判断步骤是否完成、点击反馈按钮、勾选任务完成、决定何时退出 |
| **AI** | 给出当前步骤、根据反馈调整下一步、识别何时可以收尾、给出轻量鼓励 |

**AI 永远不替用户完成任务，只陪用户一步一步推进。**

### 关键红线

```
AI 不做的：
  ✗ 自动勾选任务完成
  ✗ 自动生成新任务
  ✗ 自动拆分任务入库
  ✗ 替用户写完整文章/邮件/文件
  ✗ 自动判断用户完成（不读 checkbox 状态）
  ✗ 诊断用户心理状态
  ✗ 做超过 1 步的规划
```

---

## 十四、V2.5 不做事项

| # | 不做 | 说明 |
|---|------|------|
| 1 | 不做全自动 Agent | 所有行动由用户触发 |
| 2 | 不替用户完成完整任务 | 不写完整文章/邮件/简历/文件 |
| 3 | 不做自由聊天入口 | 没有聊天输入框，只有 5 个固定反馈按钮 |
| 4 | 不做复杂多轮对话历史 | 前端最多保留最近 5 步摘要，不存数据库 |
| 5 | 不做长期心理陪伴 | 陪伴生命周期 = 单任务 + 单次进入 |
| 6 | 不做情绪诊断 | 不输出"你看起来很焦虑"之类的判断 |
| 7 | 不做任务自动完成 | 不调用 taskToggle API |
| 8 | 不做任务自动拆分入库 | 不调用 generate-tasks API |
| 9 | 默认不做数据库持久化 | 刷新页面后陪伴状态丢失（MVP 接受） |
| 10 | 不做团队协作 | 个人工具定位 |
| 11 | 不做会员/支付 | 产品早期 |
| 12 | 不做排行榜/社交 | 与产品定位无关 |
| 13 | 不做 SSE Streaming | 本次 MVP 用标准 request-response |
| 14 | 不做语音输入/输出 | 文本交互 |

---

## 十五、验收标准

### 15.1 功能验收

| # | 验收项 | 预期行为 |
|---|--------|----------|
| 1 | 用户能在 TaskAssistPanel 看到"开始陪我做"入口 | 按钮位于 V2.4 4 个按钮下方 |
| 2 | 点击后进入 TaskCompanionPanel | 单任务陪伴面板打开 |
| 3 | AI 第一次只给一个小步骤 | 80-150 字，1-3 个动作，无完整计划 |
| 4 | 用户点"我完成了" | AI 认可完成 + 给出下一步 |
| 5 | 用户点"我卡住了" | AI 承认状态 + 把步骤拆成更小动作 |
| 6 | 用户点"太难了" | AI 承认难度 + 给出降级/简化方案 |
| 7 | 用户点"鼓励我一下" | AI 遵循 4 步结构，短、具体、非鸡汤 |
| 8 | 用户点"退出陪伴" | 面板关闭，回到初始状态 |
| 9 | AI 判断可以收尾 | 输出带 done 标记，引导用户手动勾选 |
| 10 | 陪伴模式不自动完成任务 | 不调 toggle API，不写 checkbox |
| 11 | 陪伴模式不自动修改任务 | 不调 generate-tasks API |
| 12 | 陪伴模式不自动生成新任务 | 不创建 Task |
| 13 | 退出后再进入同一任务 | 重新开始，不保留上次上下文 |

### 15.2 回归验收

| # | 验收项 | 预期行为 |
|---|--------|----------|
| 1 | V2.4 的 4 个辅助按钮正常工作 | 行为不变 |
| 2 | 任务生成正常 | 不受影响 |
| 3 | 任务勾选正常 | 不受影响 |
| 4 | 历史记录正常 | 不受影响 |
| 5 | 统计数据正常 | 不受影响 |
| 6 | AI 复盘正常 | 不受影响 |
| 7 | 智能调整正常 | 不受影响 |
| 8 | 登录/注册/忘记密码/重置密码正常 | 不受影响 |
| 9 | Turnstile 人机验证正常 | 不受影响 |
| 10 | /app 路由守卫正常 | 不受影响 |

### 15.3 技术验收

| # | 验收项 |
|---|--------|
| 1 | `npm run lint` 零 error |
| 2 | `npm run build` 编译通过 |
| 3 | `/api/task-companion` 在 build output 中注册 |
| 4 | 所有中文文件为 UTF-8 编码 |
| 5 | `git status --short` 仅含预期文件 |

---

## 十六、风险矩阵

### P0 — 阻塞（必须杜绝）

| # | 风险 | 影响 | 缓解措施 |
|---|------|------|----------|
| 1 | AI 替用户完整完成任务 | 产品定位崩塌 | Prompt 明确禁止 + 验收测试 |
| 2 | 自动勾选任务 | 破坏 Human-in-the-Loop | API 不访问 Task 完成状态 |
| 3 | 改坏任务勾选逻辑 | 核心功能受损 | TaskItem checkbox 零修改 |
| 4 | API 未校验登录 | 安全漏洞 | getAuthenticatedUserId 校验 |
| 5 | AI API Key 暴露 | 账单/安全风险 | 仅服务端读取 env |
| 6 | 影响 V2.4 / V2.0 主流程 | 回归 Bug | 修改范围最小化 + 回归测试 |

### P1 — 严重影响体验

| # | 风险 | 影响 | 缓解措施 |
|---|------|------|----------|
| 1 | AI 输出太长（超过 150 字/3 个动作） | 用户不读、不执行 | Prompt 约束 + parser 截断 |
| 2 | 陪伴状态混乱 | 用户困惑 | 状态机设计 + 单一面板策略 |
| 3 | 用户反馈后 AI 不按反馈调整 | 陪伴无效 | Prompt 明确 5 种反馈处理策略 |
| 4 | 鼓励变成空泛鸡汤 | 用户反感 | 4 步结构硬约束 + Prompt 示例 |
| 5 | 暴露原始 AI 异常 | 安全 + 体验风险 | catch 所有异常统一映射 |
| 6 | 提前做自由聊天 | 超出 MVP 范围 | 只有 5 个固定按钮，无输入框 |

### P2 — 可接受但建议后续优化

| # | 风险 | 后续建议 |
|---|------|----------|
| 1 | 不持久化导致刷新丢失 | V2.6 轻量行为记录 |
| 2 | 移动端样式可优化 | 后续 UI 打磨 |
| 3 | 陪伴文案还需调优 | 上线后收集反馈迭代 Prompt |
| 4 | 复制/退出体验可优化 | 后续 UX 迭代 |

---

## 十七、与 Roadmap 的关系

### 17.1 定位更新

本文档**取代** [Roadmap-Core-First-V2.3-to-V3.0.md](Roadmap-Core-First-V2.3-to-V3.0.md) §六 "V2.5：AI 辅助执行增强" 中的候选范围。

| 维度 | Roadmap 原 V2.5 规划 | 本架构 V2.5 |
|------|----------------------|-------------|
| **定位** | V2.4 的增强（动态快捷建议、意图增强等） | 独立的陪伴模式 |
| **交互模式** | 仍然是单次请求-响应 | 多轮逐步推进 |
| **核心价值** | 让 V2.4 更聪明 | 让 AI 陪用户一步一步做 |
| **与 V2.4 关系** | 在 V2.4 基础上增量优化 | 在 V2.4 基础上新增独立模式 |

### 17.2 后续阶段衔接

V2.5 完成后 → V2.6 轻量行为记录（记录用户是否使用了陪伴模式、用了多久、陪伴了几步），为后续复盘和产品迭代提供数据。

---

## 十八、后续衔接

### 18.1 下一步

> **V2.5 当前只是方向锁定和架构文档阶段，不在 V2.4 返修 / Review 阶段实现。必须等 V2.4 完成提交后，再进入 V2.5 执行方案阶段。**

标准流程：

1. ChatGPT 审查 V2.5 架构文档
2. Claude Code 编写 V2.5 执行方案
3. ChatGPT 审查 V2.5 执行方案
4. Codex 按执行方案实现
5. Claude Code Code Review
6. ChatGPT 最终把关
7. 通过后提交

### 18.2 相关文档

- [Architecture-V2.4-AI-Assist.md](Architecture-V2.4-AI-Assist.md) — V2.4 架构（本 V2.5 的依赖）
- [Execution-Plan-V2.4-AI-Assist.md](Execution-Plan-V2.4-AI-Assist.md) — V2.4 执行方案
- [Roadmap-Core-First-V2.3-to-V3.0.md](Roadmap-Core-First-V2.3-to-V3.0.md) — 总路线（V2.5 部分被本文档更新）
- [PROJECT-INDEX.md](PROJECT-INDEX.md) — 项目文件索引（需随 V2.5 实现更新）

---

> **V2.5 只作为后续阶段方向锁定，不在当前 V2.4 返修 / Review 阶段实现。**
>
> 本文档定义 V2.5 的产品边界、交互流程、技术架构和安全红线。
> 后续流程：ChatGPT 审查本架构文档 → Claude Code 编写执行方案 → ChatGPT 审查执行方案 → Codex 实现 → Claude Code Review → ChatGPT 最终把关 → 提交。
