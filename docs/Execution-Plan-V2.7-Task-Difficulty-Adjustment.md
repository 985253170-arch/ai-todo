# V2.7：任务难度与数量动态调整 执行方案

> **状态**：执行方案阶段。**只写文档，不写代码。**
> **前置**：架构方案 [Architecture-V2.7-Task-Difficulty-Adjustment.md](Architecture-V2.7-Task-Difficulty-Adjustment.md) 经 ChatGPT 第三轮审查通过
> **定位**：Codex 实现 V2.7 的精确操作手册——改哪一行、加什么、删什么
> **设计日期**：2026-07-08
> **代码核验日期**：2026-07-08（基于当前 `main` 分支代码，commit `9ca4728`）
> **版本锁定**：遵守 [Upgrade-Lock-V2.6-to-V3.0A.md](Upgrade-Lock-V2.6-to-V3.0A.md) 第 5 节 V2.7 锁定范围

---

## 目录

- [1. 执行目标](#1-执行目标)
- [2. 当前代码核验结果](#2-当前代码核验结果)
- [3. 文件修改总览](#3-文件修改总览)
- [4. 类型扩展方案（types.ts）](#4-类型扩展方案typests)
- [5. task-execution 四态执行方案](#5-task-execution-四态执行方案)
- [6. [ADJUST] Parser 执行方案](#6-adjust-parser-执行方案)
- [7. Prompt 执行方案](#7-prompt-执行方案)
- [8. API Route 执行方案](#8-api-route-执行方案)
- [9. useTaskCompanion 执行方案](#9-usetaskcompanion-执行方案)
- [10. useTaskGroup 执行方案](#10-usetaskgroup-执行方案)
- [11. Props 链路执行方案](#11-props-链路执行方案)
- [12. TaskCompanionPanel UI 执行方案](#12-taskcompanionpanel-ui-执行方案)
- [13. TaskItem / TaskList / MainWorkspace 执行方案](#13-taskitem--tasklist--mainworkspace-执行方案)
- [14. 跨天恢复与 adjustment 清理方案](#14-跨天恢复与-adjustment-清理方案)
- [15. 不修改 save/load route 的代码依据](#15-不修改-saveload-route-的代码依据)
- [16. 不改统计口径说明](#16-不改统计口径说明)
- [17. 安全边界与产品红线](#17-安全边界与产品红线)
- [18. Codex 实现顺序](#18-codex-实现顺序)
- [19. 验证命令](#19-验证命令)
- [20. 手动验收场景](#20-手动验收场景)
- [21. 回归验收清单](#21-回归验收清单)
- [22. 风险与 Review 重点](#22-风险与-review-重点)

---

## 1. 执行目标

### 1.1 一句话目标

当用户在当前任务内多次反馈"太难 / 卡住 / 没时间 / 任务太大"后，AI 不只是安慰，而是给出当前任务的调整建议（降级版 / 明日继续 / 保留但不要求今天完成）。用户点击"接受调整"后，系统才执行调整。

### 1.2 必须达成的 17 项

| # | 目标 | 验收方式 |
|---|------|----------|
| 1 | AI 基于 signalStats + userFeedback 识别调整触发条件 | 连续 stuck 2+ 次 → AI 输出含 [ADJUST] |
| 2 | AI 通过 [ADJUST]...[/ADJUST] 输出三类调整建议 | downgraded / tomorrow / keep_visible |
| 3 | parser 统一解析 [ADJUST]，输出 adjustmentSuggestion | CompanionStep.adjustmentSuggestion 不为空 |
| 4 | TaskCompanionPanel 渲染调整建议卡片 + 接受/拒绝按钮 | 视觉确认卡片 + 两个按钮 |
| 5 | 点击"接受调整"→ 完整数据更新闭环 | setTaskGroup → localStorage → cloud save |
| 6 | 点击"不用，继续"→ 只隐藏卡片，不发送 done | 不调用 sendSignal，不自动请求 AI，不修改任务 |
| 7 | dismissedAdjustmentTypesRef 去重机制 | 拒绝后同类型不再出现 |
| 8 | TaskExecutionStatus 四态：completed / current / locked / resolved_today | downgraded → current；tomorrow/keep_visible → resolved_today |
| 9 | 跨天恢复时清除 tomorrow/keep_visible adjustment | 新一天 → 任务变为普通未完成 |
| 10 | downgraded 跨天保留（title + adjustment） | 降级后的标题跨天仍有效 |
| 11 | 不改数据库 | `git diff` 零 schema/migration 变更 |
| 12 | 不改 save/load route | `git diff` 无 save/load 变更 |
| 13 | 不实现 postponed | postponed 仅在 V2.7B |
| 14 | 不做批量调整 | V2.7A 只调整当前任务 |
| 15 | AI 不自动勾选/删除任务 | 任何情况下 checkbox 仅用户手动操作 |
| 16 | 原有陪伴功能不受影响 | done/stuck/too_hard + 反馈输入框均正常 |
| 17 | 不改统计口径 | completedCount / totalCount 计算不变 |

### 1.3 改动范围

**11 个文件**，预计新增 ~320 行（~280 新增 + ~40 修改）。

---

## 2. 当前代码核验结果

> 以下核验基于 2026-07-08 的 `main` 分支代码（commit `9ca4728`）。架构方案中的代码引用均经逐行核对。

### 2.1 types.ts（`src/lib/types.ts`）

| 项目 | 位置 | 当前内容 |
|------|------|----------|
| `Task` 接口 | 第 9-15 行 | `{ id, title, completed, createdAt, updatedAt }` — **无 adjustment 字段** |
| `TaskGroup` 接口 | 第 17-23 行 | `{ id, goal, tasks: Task[], createdAt, updatedAt }` |
| `CompanionUserSignal` | 第 255-261 行 | 6 个值，含 `"user_feedback"` ✅ V2.6 已完成 |
| `CompanionStep` | 第 274-277 行 | `{ message: string; companionState: CompanionStatus }` — **无 adjustmentSuggestion** |
| `TaskExecutionStatus` | ❌ 不在 types.ts | **定义在 task-execution.ts 第 4 行**，V2.7 继续保留在 task-execution.ts |

**核验结论**：`TaskExecutionStatus` 不在此文件——它在 `task-execution.ts` 中定义。V2.7 只在 task-execution.ts 中从三态扩展为四态，不移入 types.ts。

### 2.2 task-execution.ts（`src/lib/task-execution.ts`）

| 项目 | 位置 | 当前内容 |
|------|------|----------|
| `TaskExecutionStatus` | 第 4 行 | `"completed" \| "current" \| "locked"` — **三态** |
| `CompletableTask` | 第 6-8 行 | `{ completed: boolean }` — **无 adjustment** |
| `getCurrentTaskIndex` | 第 10-14 行 | `tasks.findIndex(t => !t.completed)` — **不跳过 todayResolved** |
| `getTaskExecutionStatus` | 第 16-31 行 | 三态逻辑：completed → current → locked |
| `hasIncompleteTasks` | 第 33-35 行 | `tasks.some(t => !t.completed)` |
| `isTaskGroupFullyCompleted` | 第 37-39 行 | `tasks.every(t => t.completed)` |
| `shouldCarryOverTaskGroup` | 第 41-43 行 | `hasIncompleteTasks && !isTaskGroupFromToday` |
| `isTaskLocked` | 第 45-47 行 | 基于 `getTaskExecutionStatus` |

**核验结论**：这是 V2.7 最关键的修改文件。需要：
- 扩展 `TaskExecutionStatus` 为四态（含 `"resolved_today"`）
- 扩展 `CompletableTask` 含 `adjustment?`
- 新增 `isTaskTodayResolved(adjustment?)` helper
- 重写 `getCurrentTaskIndex`：跳过 todayResolved 任务
- 重写 `getTaskExecutionStatus`：四态优先级判断
- 新增 `clearTodayResolvedAdjustmentsForNewDay(taskGroup)`

### 2.3 task-companion-parser.ts（`src/lib/task-companion-parser.ts`）

| 项目 | 位置 | 当前内容 |
|------|------|----------|
| `MAX_MESSAGE_LENGTH` | 第 10 行 | `300` |
| `DONE_MARKER_PATTERN` | 第 11 行 | `/^\[DONE\]$/im` |
| `parseCompanionAIResponse` | 第 13-48 行 | 只解析 [DONE] + 清理 → 返回 `CompanionStep { companionState, message }` |
| 输出清理 | 第 20-34 行 | 去除 codeblock / markdown / markup |
| message 截断 | 第 40-42 行 | `text.slice(0, MAX_MESSAGE_LENGTH) + "…"` — **在截断前无 [ADJUST] 提取** |

**核验结论**：需要新增 [ADJUST] 解析逻辑，且在 message 截断**之前**提取 [ADJUST] 段落（避免被 `slice(0,300)` 截断）。

### 2.4 task-companion/route.ts（`src/app/api/task-companion/route.ts`）

| 项目 | 位置 | 当前内容 |
|------|------|----------|
| `VALID_USER_SIGNALS` | 第 19-26 行 | 6 个值，含 `"user_feedback"` ✅ |
| `CompanionRequestBody` | 第 48-60 行 | 含 `userFeedback?: unknown` ✅ — **无 signalStats / declinedAdjustmentTypes** |
| `normalizeUserFeedback` | 第 164-172 行 | 截断 300 字 ✅ |
| `buildCompanionUserPrompt` 调用 | 第 225-239 行 | 传入 userFeedback ✅ — **未传入 signalStats / declinedAdjustmentTypes** |

**核验结论**：需要新增 `signalStats?: unknown` + `declinedAdjustmentTypes?: unknown` 字段、新增两个 normalize 函数、传入 Prompt。

### 2.5 task-companion.ts Prompt（`src/prompts/task-companion.ts`）

| 项目 | 位置 | 当前内容 |
|------|------|----------|
| `COMPANION_SYSTEM_PROMPT` | 第 3-98 行 | 12 个分节（含 V2.6 新增的"用户反馈输入处理"和"AI 验收规则"） |
| `SIGNAL_PROMPTS` | 第 118-129 行 | 6 个信号，含 `user_feedback` ✅ |
| `CompanionPromptInput` | 第 108-116 行 | 含 `userFeedback?: string` ✅ — **无 signalStats / declinedAdjustmentTypes** |
| `buildCompanionUserPrompt` | 第 158-192 行 | 拼接 taskTitle + goal + sequenceContext + currentStep + stepHistory + userFeedback + signalPrompt — **无 signalStats 行 / declinedAdjustmentTypes 行** |

**核验结论**：需要新增：
- COMPANION_SYSTEM_PROMPT 新增 3 个分节（调整触发规则 + [ADJUST] 输出格式 + 调整建议去重）
- CompanionPromptInput 新增 `signalStats?` + `declinedAdjustmentTypes?`
- buildCompanionUserPrompt 新增 signalStats 行 + declinedAdjustmentTypes 行

### 2.6 useTaskCompanion.ts（`src/hooks/useTaskCompanion.ts`）

| 项目 | 位置 | 当前内容 |
|------|------|----------|
| `requestCompanion` 请求体 | 第 103-119 行 | 含 `userFeedback` ✅ — **无 signalStats / declinedAdjustmentTypes** |
| ref | 第 73-74 行 | `inflightRef` + `requestIdRef` — **无 signalStatsRef / dismissedAdjustmentTypesRef** |
| 返回类型 | 第 29-42 行 | 无 adjustment 相关方法 |

**核验结论**：需要新增 `signalStatsRef` + `dismissedAdjustmentTypesRef`，每次 `requestCompanion` 传入这两个数据。

### 2.7 useTaskGroup.ts（`src/hooks/useTaskGroup.ts`）

| 项目 | 位置 | 当前内容 |
|------|------|----------|
| `handleToggleTask` | 第 404-436 行 | setTaskGroup → saveCurrentTaskGroup → saveTaskGroupToCloud — **这是 applyTaskAdjustment 的参考模板** |
| `handleContinueCarryover` | 第 448-450 行 | `setShowCarryoverPrompt(false)` — **只隐藏 prompt，不做任何数据处理** |
| `applyRestoredTaskGroup` | 第 166-175 行 | 设置 taskGroup + 判断 carryover/newDay — **这里可以插入 clearTodayResolvedAdjustmentsForNewDay 调用** |
| `applyTaskAdjustment` | ❌ 无 | **需要新增** |

**核验结论**：
- `applyTaskAdjustment` 参考 `handleToggleTask` 的 setTaskGroup → saveLocal → saveCloud 模式
- `clearTodayResolvedAdjustmentsForNewDay` 应在 `applyRestoredTaskGroup` 中调用（恢复任务组时清理跨天 adjustment）
- `handleContinueCarryover` 中目前只是隐藏 prompt——V2.7 不修改此函数，adjustment 清理在 `applyRestoredTaskGroup` 中统一完成

### 2.8 TaskCompanionPanel.tsx（`src/components/TaskCompanionPanel.tsx`）

| 项目 | 位置 | 当前内容 |
|------|------|----------|
| Props 接口 | 第 22-28 行 | `{ taskId, taskTitle, goal, sequenceContext?, onClose }` — **无 onAcceptAdjustment** |
| `currentStep` 使用 | 第 223-227 行 | 渲染 `currentStep.message` — **不检查 adjustmentSuggestion** |
| `SIGNAL_BUTTONS` | 第 35-42 行 | 3 个按钮：done / stuck / too_hard |
| 按钮区域 | 第 266-296 行 | 2 列网格，5 个按钮 |

**核验结论**：需要新增：
- Props 新增 `onAcceptAdjustment?`
- 调整建议卡片 JSX（基于 `currentStep.adjustmentSuggestion`）
- 接受/拒绝按钮 + dismissed 本地状态
- "不用，继续"不发送任何信号

### 2.9 TaskItem.tsx（`src/components/TaskItem.tsx`）

| 项目 | 位置 | 当前内容 |
|------|------|----------|
| Props 接口 | 第 18-29 行 | 含 `executionStatus: TaskExecutionStatus` — **无 onAcceptAdjustment** |
| executionStatus 判断 | 第 47-49 行 | 只判断 3 种：completed / current / locked — **无 resolved_today** |
| rowClassName | 第 89-93 行 | 三态样式：locked=灰底低透明度, current=indigo, completed/default=白色 |
| TaskCompanionPanel 渲染 | 第 164-173 行 | 传入 goal, onClose, sequenceContext, taskId, taskTitle — **无 onAcceptAdjustment** |

**核验结论**：需要新增：
- Props 新增 `onAcceptAdjustment?`，转发给 TaskCompanionPanel
- 新增 `"resolved_today"` 状态判断和视觉渲染
- 新增 adjustment 标记标签（downgraded / tomorrow / keep_visible）

### 2.10 TaskList.tsx（`src/components/TaskList.tsx`）

| 项目 | 位置 | 当前内容 |
|------|------|----------|
| Props 接口 | 第 10-24 行 | 含 onToggleTask / onToggleAssist / onToggleCompanion — **无 onAcceptAdjustment** |
| TaskItem 渲染 | 第 72-91 行 | `tasks.map(...)` → `getTaskExecutionStatus(index, tasks)` → `<TaskItem>` |

**核验结论**：需要新增 `onAcceptAdjustment` prop 声明 + 转发给每个 TaskItem（~3 行改动）。

### 2.11 MainWorkspace.tsx（`src/components/MainWorkspace.tsx`）

| 项目 | 位置 | 当前内容 |
|------|------|----------|
| useTaskGroup 解构 | 第 23-44 行 | 含 handleToggleTask 等 — **无 applyTaskAdjustment** |
| TaskList 渲染 | 第 186-200 行 | 传入 onToggleTask 等 — **无 onAcceptAdjustment** |

**核验结论**：需要新增 `handleAcceptAdjustment` 回调（调用 `applyTaskAdjustment`）→ 传给 TaskList。

### 2.12 save/route.ts（`src/app/api/task-group/save/route.ts`）

| 项目 | 位置 | 核验结果 |
|------|------|----------|
| `isValidTask` | 第 54-68 行 | 只检查 `id, title, completed, createdAt, updatedAt` 五字段类型——**不拒绝多余字段** ✅ |
| DB insert 映射 | 第 189-198 行 | 只映射 `id, task_group_id, title, completed, completed_at, created_at, updated_at` 7 列——`adjustment` 自然丢弃 ✅ |

**核验结论**：**零改动。** 前端发送含 `adjustment` 的 Task → `isValidTask` 通过 → DB insert 忽略 adjustment → 云端不存 adjustment。

### 2.13 load/route.ts（`src/app/api/task-group/load/route.ts`）

| 项目 | 位置 | 核验结果 |
|------|------|----------|
| Task 映射 | 第 104-110 行 | 返回 `{ id, title, completed, createdAt, updatedAt }` — 不含 `adjustment` ✅ |

**核验结论**：**零改动。** 加载时 adjustment 从 localStorage 恢复，不需要云端返回。

### 2.14 架构方案与真实代码一致性结论

**一致。** 架构方案中所有代码引用（行号、结构、字段名）均通过核验。以下关键发现：

| 发现 | 说明 |
|------|------|
| `TaskExecutionStatus` 定义在 `task-execution.ts` 而非 `types.ts` | V2.7 继续保留在 task-execution.ts 中扩展，不移入 types.ts |
| `handleContinueCarryover` 当前只隐藏 prompt | V2.7 不修改此函数——adjustment 清理在 `applyRestoredTaskGroup` 中统一完成 |
| `applyRestoredTaskGroup` 是跨天恢复的入口 | 在此函数中调用 `clearTodayResolvedAdjustmentsForNewDay` 最合适，且清理后需保存到 localStorage |
| `isValidTask` 不拒绝多余字段 ✅ | 架构方案验证结论准确 |
| load route Task 映射无 adjustment ✅ | 架构方案验证结论准确 |

---

## 3. 文件修改总览

| # | 文件 | 新增行 | 修改行 | 风险 |
|:--:|------|:--:|:--:|:--:|
| 1 | `src/lib/types.ts` | ~25 | ~0 | 低 |
| 2 | `src/lib/task-execution.ts` | ~45 | ~20 | **高** |
| 3 | `src/lib/task-companion-parser.ts` | ~30 | ~5 | 中 |
| 4 | `src/prompts/task-companion.ts` | ~60 | ~8 | 中 |
| 5 | `src/app/api/task-companion/route.ts` | ~25 | ~3 | 低 |
| 6 | `src/hooks/useTaskCompanion.ts` | ~40 | ~5 | 中 |
| 7 | `src/hooks/useTaskGroup.ts` | ~40 | ~5 | 中 |
| 8 | `src/components/TaskCompanionPanel.tsx` | ~60 | ~3 | 中 |
| 9 | `src/components/TaskItem.tsx` | ~25 | ~5 | 低 |
| 10 | `src/components/TaskList.tsx` | ~5 | ~1 | 低 |
| 11 | `src/components/MainWorkspace.tsx` | ~12 | ~2 | 低 |
| **合计** | | **~367** | **~57** | |

预计总改动量 ~424 行（~367 新增 + ~57 修改），属于中 Phase。

---

## 4. 类型扩展方案（types.ts）

### 4.1 文件

`src/lib/types.ts`

### 4.2 变更 1：新增 TaskAdjustment 存储类型

**当前状态**：无。

**位置**：在 `Task` 接口（第 9-15 行）之前或之后插入。

```typescript
// V2.7 新增：任务调整标记（存储结构）
export interface TaskAdjustment {
  type: "downgraded" | "tomorrow" | "keep_visible";
  originalTitle?: string;        // 降级时保留原标题
  reason?: string;               // AI 给出的调整原因（一句话）
  adjustedAt: string;            // ISO timestamp
}
```

### 4.3 变更 2：扩展 Task 接口

**当前代码**（第 9-15 行）：
```typescript
export interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}
```

**目标代码**：
```typescript
export interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  adjustment?: TaskAdjustment;   // V2.7 新增
}
```

### 4.4 变更 3：新增 TaskAdjustmentSuggestion（Parser 输出类型）

**位置**：紧接 `TaskAdjustment` 之后。

```typescript
// V2.7 新增：AI 调整建议（从 [ADJUST] 解析出来）
export interface TaskAdjustmentSuggestion {
  type: "downgraded" | "tomorrow" | "keep_visible";
  suggestion: string;            // AI 给出的一句话建议文本
  alternativeTitle?: string;     // downgraded 时的替代标题
}
```

### 4.5 变更 4：新增 ApplyTaskAdjustmentInput（Props 链输入类型）

**位置**：紧接 `TaskAdjustmentSuggestion` 之后。

```typescript
// V2.7 新增：用户确认后的调整执行参数（流经 Props 链）
export interface ApplyTaskAdjustmentInput {
  type: "downgraded" | "tomorrow" | "keep_visible";
  reason?: string;               // AI 给出的调整原因
  alternativeTitle?: string;     // downgraded 时的替代标题
}
```

### 4.6 变更 5：扩展 CompanionStep 接口

**当前代码**（第 274-277 行）：
```typescript
export interface CompanionStep {
  message: string;
  companionState: CompanionStatus;
}
```

**目标代码**：
```typescript
export interface CompanionStep {
  message: string;
  companionState: CompanionStatus;
  adjustmentSuggestion?: TaskAdjustmentSuggestion;  // V2.7 新增
}
```

### 4.7 变更 6：扩展 TaskExecutionStatus 类型

**重要**：`TaskExecutionStatus` 当前定义在 `src/lib/task-execution.ts` 第 4 行，不在 `types.ts`。

**方案**：不移入 types.ts。在 task-execution.ts 中直接扩展（见第 5 节）。types.ts 不新增 TaskExecutionStatus 定义——保持现有引用关系不变。

### 4.8 Codex 操作指令

```
在 src/lib/types.ts 中：

Step 1: 在 Task 接口之前（第 9 行之前），新增 TaskAdjustment 接口定义

Step 2: 在 Task 接口的 updatedAt 之后，新增 adjustment?: TaskAdjustment;

Step 3: 在 TaskAdjustment 之后，新增 TaskAdjustmentSuggestion 接口

Step 4: 在 TaskAdjustmentSuggestion 之后，新增 ApplyTaskAdjustmentInput 接口

Step 5: 在 CompanionStep 接口中，companionState 之后新增 adjustmentSuggestion 可选字段

不要修改任何现有类型定义。不要删除任何现有字段。
```

---

## 5. task-execution 四态执行方案

### 5.1 文件

`src/lib/task-execution.ts`

### 5.2 变更 1：扩展 TaskExecutionStatus 为四态

**当前代码**（第 4 行）：
```typescript
export type TaskExecutionStatus = "completed" | "current" | "locked";
```

**目标代码**：
```typescript
export type TaskExecutionStatus =
  | "completed"
  | "current"
  | "locked"
  | "resolved_today";  // V2.7 新增
```

### 5.3 变更 2：扩展 CompletableTask 类型

**当前代码**（第 6-8 行）：
```typescript
type CompletableTask = {
  completed: boolean;
};
```

**目标代码**：
```typescript
type CompletableTask = {
  completed: boolean;
  adjustment?: { type: string };  // V2.7 新增：只需 type 字段判断 todayResolved
};
```

**说明**：`CompletableTask` 只需要 `adjustment?.type` 来执行 `isTaskTodayResolved` 判断。完整 `TaskAdjustment` 类型不需要在这里引用——此类型仅在 task-execution 内部使用，最小化依赖。

### 5.4 变更 3：新增 isTaskTodayResolved helper

**位置**：`CompletableTask` 类型之后（第 8 行之后）、`getCurrentTaskIndex` 之前。

```typescript
/**
 * V2.7 新增：判断任务是否"今天已解除"。
 * tomorrow / keep_visible → todayResolved = true（今天不再阻塞后续）
 * downgraded → todayResolved = false（仍是活跃任务，仍阻塞后续）
 */
function isTaskTodayResolved(adjustment?: { type: string }): boolean {
  if (!adjustment) return false;
  return adjustment.type === "tomorrow"
    || adjustment.type === "keep_visible";
}
```

### 5.5 变更 4：重写 getCurrentTaskIndex（跳过 todayResolved）

**当前代码**（第 10-14 行）：
```typescript
export function getCurrentTaskIndex(tasks: CompletableTask[]) {
  const currentTaskIndex = tasks.findIndex((task) => !task.completed);

  return currentTaskIndex === -1 ? null : currentTaskIndex;
}
```

**目标代码**：
```typescript
export function getCurrentTaskIndex(tasks: CompletableTask[]) {
  // V2.7: 跳过 completed 和 todayResolved 任务
  const currentTaskIndex = tasks.findIndex(
    (task) => !task.completed && !isTaskTodayResolved(task.adjustment)
  );

  return currentTaskIndex === -1 ? null : currentTaskIndex;
}
```

### 5.6 变更 5：重写 getTaskExecutionStatus（四态优先级）

**当前代码**（第 16-31 行）：
```typescript
export function getTaskExecutionStatus(
  taskIndex: number,
  tasks: CompletableTask[],
): TaskExecutionStatus {
  const task = tasks[taskIndex];

  if (!task) {
    return "locked";
  }

  if (task.completed) {
    return "completed";
  }

  return taskIndex === getCurrentTaskIndex(tasks) ? "current" : "locked";
}
```

**目标代码**：
```typescript
export function getTaskExecutionStatus(
  taskIndex: number,
  tasks: CompletableTask[],
): TaskExecutionStatus {
  const task = tasks[taskIndex];

  if (!task) {
    return "locked";
  }

  // 优先级 1: completed（用户手动勾选 checkbox）
  if (task.completed) {
    return "completed";
  }

  // 优先级 2: todayResolved（V2.7 新增：用户接受调整，今天不再要求）
  if (isTaskTodayResolved(task.adjustment)) {
    return "resolved_today";
  }

  // 优先级 3: current（第一个 active 任务）
  // 优先级 4: locked（前面有 active 任务阻塞）
  return taskIndex === getCurrentTaskIndex(tasks) ? "current" : "locked";
}
```

**优先级判断逻辑**：
```
completed = true                      → "completed"
!completed && isTaskTodayResolved     → "resolved_today"
!completed && !todayResolved && 第一个 active → "current"
!completed && !todayResolved && 非第一个       → "locked"
```

### 5.7 变更 6：新增 clearTodayResolvedAdjustmentsForNewDay

**位置**：在 `isTaskLocked` 函数之后（第 47 行之后），作为文件最后一个 export。

```typescript
/**
 * V2.7 新增：跨天恢复任务组时调用。
 * 清除只属于"今天"的 adjustment 标记：
 * - tomorrow / keep_visible → 清除 adjustment（回归普通未完成任务）
 * - downgraded → 保留 adjustment（降级是持久修改）
 *
 * 纯函数：不修改传入对象，返回清理后的新 taskGroup + changed 标记。
 */
export function clearTodayResolvedAdjustmentsForNewDay<T extends {
  tasks: Array<{ adjustment?: { type: string } }>;
}>(taskGroup: T): { taskGroup: T; changed: boolean } {
  let changed = false;

  const cleanedTasks = taskGroup.tasks.map((task) => {
    if (!task.adjustment) return task;
    if (task.adjustment.type === "downgraded") return task;
    // tomorrow / keep_visible: 清除 adjustment
    changed = true;
    const { adjustment: _removed, ...rest } = task;
    return rest as typeof task;
  });

  if (!changed) {
    return { taskGroup, changed: false };
  }

  return {
    taskGroup: {
      ...taskGroup,
      tasks: cleanedTasks,
    } as T,
    changed: true,
  };
}
```

**说明**：此函数是纯函数——不修改传入的 taskGroup，返回 `{ taskGroup: cleanedTaskGroup, changed: boolean }`。调用方（useTaskGroup）在 `changed === true` 时保存 cleanedTaskGroup 到 localStorage。

### 5.8 变更 7：更新 hasIncompleteTasks

**当前代码**（第 33-35 行）：
```typescript
export function hasIncompleteTasks(tasks: CompletableTask[]) {
  return tasks.some((task) => !task.completed);
}
```

**不需要改。** `hasIncompleteTasks` 只判断是否有未完成任务——todayResolved 任务仍是未完成（`completed = false`），语义正确。`shouldCarryOverTaskGroup` 依赖此函数——todayResolved 任务确实需要 carryover（它们明天应该作为普通任务重新出现）。跨天时 `clearTodayResolvedAdjustmentsForNewDay` 会清除 adjustment，所以 carryover 逻辑不变。

### 5.9 测试矩阵（task-execution）

以下为 `getTaskExecutionStatus` 的完整测试矩阵，Code Review 时逐条验证：

| # | completed | adjustment.type | 是否 first active | 预期 status |
|---|:--:|------|:--:|---|
| 1 | true | — | — | `"completed"` |
| 2 | false | `undefined` | 是 | `"current"` |
| 3 | false | `undefined` | 否 | `"locked"` |
| 4 | false | `"downgraded"` | 是 | `"current"` |
| 5 | false | `"downgraded"` | 否 | `"locked"` |
| 6 | false | `"tomorrow"` | — | `"resolved_today"` |
| 7 | false | `"keep_visible"` | — | `"resolved_today"` |

**关键验证点**：
- 用例 4：downgraded 仍是 current（阻塞后续）
- 用例 6-7：tomorrow / keep_visible 是 resolved_today（不阻塞后续）
- 用例 1：completed 优先级最高（即使有 adjustment 也返回 completed）

`getCurrentTaskIndex` 测试：

| # | tasks | 预期 index |
|---|-------|:--:|
| 1 | [completed, active, active] | 1 |
| 2 | [completed, resolved_today, active] | 2 |
| 3 | [completed, resolved_today, resolved_today] | null |
| 4 | [active, active, active] | 0 |

`clearTodayResolvedAdjustmentsForNewDay` 测试：

| # | 输入 | 预期 |
|---|------|------|
| 1 | [{ adjustment: { type: "tomorrow" } }] | changed=true, taskGroup.tasks[0].adjustment = undefined |
| 2 | [{ adjustment: { type: "keep_visible" } }] | changed=true, taskGroup.tasks[0].adjustment = undefined |
| 3 | [{ adjustment: { type: "downgraded" } }] | changed=false, taskGroup.tasks[0].adjustment 保留 |
| 4 | [{ adjustment: undefined }] | changed=false, 不变 |

### 5.10 Codex 操作指令

```
在 src/lib/task-execution.ts 中：

Step 1: 第 4 行 TaskExecutionStatus 类型：新增 "resolved_today" union member

Step 2: 第 6-8 行 CompletableTask 类型：新增 adjustment?: { type: string }

Step 3: 第 8 行之后，插入 isTaskTodayResolved 函数

Step 4: 第 10-14 行 getCurrentTaskIndex：findIndex 条件新增 && !isTaskTodayResolved(task.adjustment)

Step 5: 第 16-31 行 getTaskExecutionStatus：在 completed 判断之后、current/locked 判断之前，
        插入 todayResolved 判断分支

Step 6: 文件末尾（第 47 行之后），新增 clearTodayResolvedAdjustmentsForNewDay 纯函数
        返回 { taskGroup: cleanedTaskGroup, changed: boolean }
        tomorrow / keep_visible → 清除 adjustment
        downgraded → 保留 adjustment
        不修改传入对象（纯函数）

不要修改 hasIncompleteTasks / isTaskGroupFullyCompleted / shouldCarryOverTaskGroup 函数。
不要修改 isTaskLocked 函数（它基于 getTaskExecutionStatus，自动适配四态）。
不要修改 import 语句。
```

---

## 6. [ADJUST] Parser 执行方案

### 6.1 文件

`src/lib/task-companion-parser.ts`

### 6.2 设计要点

**唯一解析入口**：`parseCompanionAIResponse` 是 [ADJUST] 的唯一解析位置。UI 层不自己解析 AI 文本。

**[ADJUST] 提取在截断之前**：当前的 `slice(0, MAX_MESSAGE_LENGTH)` 在最后执行。解析 [ADJUST] 必须在截断之前，确保调整建议不会被截成一半。

### 6.3 变更 1：新增 type import 和 [ADJUST] 解析正则/函数

**位置**：文件顶部 import 区域新增一行；在 `DONE_MARKER_PATTERN`（第 11 行）之后、`parseCompanionAIResponse`（第 13 行）之前新增解析函数。

```typescript
// V2.7 新增：文件顶部 import 区域新增
import type { TaskAdjustmentSuggestion } from "@/lib/types";
```

```typescript
// V2.7 新增：解析 [ADJUST]...[/ADJUST] 调整建议标记
const ADJUST_SECTION_PATTERN = /\[ADJUST\]([\s\S]*?)\[\/ADJUST\]/i;

function parseAdjustmentSection(adjustText: string): TaskAdjustmentSuggestion | null {
  const trimmed = adjustText.trim();
  if (!trimmed) return null;

  // 提取类型行：如 "类型：downgraded" 或 "downgraded"
  const typeMatch = trimmed.match(/类型[：:]\s*(downgraded|tomorrow|keep_visible)/i)
    || trimmed.match(/^(downgraded|tomorrow|keep_visible)/im);
  if (!typeMatch) return null;

  const type = typeMatch[1].toLowerCase() as TaskAdjustmentSuggestion["type"];

  // 提取 alt_title 行（可选，仅 downgraded 有意义）
  const altTitleMatch = trimmed.match(/alt_title[：:]\s*(.+?)(?:\n|$)/i);
  const alternativeTitle = altTitleMatch ? altTitleMatch[1].trim() : undefined;

  // 剩余文本作为 suggestion（移除类型行和 alt_title 行后）
  const suggestion = trimmed
    .replace(/^[^\n]*类型[：:][^\n]*\n?/im, "")
    .replace(/^[^\n]*alt_title[：:][^\n]*\n?/im, "")
    .replace(/^(downgraded|tomorrow|keep_visible)\s*\n?/im, "")
    .trim();

  if (!suggestion) return null;

  return { type, suggestion, alternativeTitle };
}
```

### 6.4 变更 2：扩展 parseCompanionAIResponse 返回类型

**当前返回**：`CompanionStep`（第 13 行签名）。

**修改**：返回类型从 `CompanionStep` 扩展为含 `adjustmentSuggestion?`。

由于 `CompanionStep` 已在 types.ts 中扩展（新增 `adjustmentSuggestion?: TaskAdjustmentSuggestion`），parser 层只需在返回对象中包含此字段。`parseAdjustmentSection` 直接返回 `TaskAdjustmentSuggestion | null`，无需类型转换。

### 6.5 变更 3：重写 parseCompanionAIResponse 核心逻辑

**当前代码**（第 13-48 行）的流程：
```
rawText → trim → 去除 codeblock → 检测 [DONE] → 去除 markdown → 截断 300 字 → 返回
```

**目标流程**：
```
rawText → trim → 去除 codeblock → 【V2.7: 提取 [ADJUST] 段落】→ 从 text 移除 [ADJUST] 段落
       → 检测 [DONE] → 去除 markdown → 截断 300 字 → 返回 { message, companionState, adjustmentSuggestion? }
```

**完整目标代码**（替换第 13-48 行）：

```typescript
export function parseCompanionAIResponse(rawText: string): CompanionStep {
  let text = rawText.trim();

  if (!text) {
    throw new ParseCompanionAIResponseError("AI response is empty.");
  }

  if (text.startsWith("```")) {
    text = text
      .replace(/^```(?:text)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  // ═══ V2.7 新增：在截断前提取 [ADJUST] 段落 ═══
  let adjustmentSuggestion: TaskAdjustmentSuggestion | undefined;

  const adjustMatch = ADJUST_SECTION_PATTERN.exec(text);
  if (adjustMatch) {
    const parsed = parseAdjustmentSection(adjustMatch[1]);
    if (parsed) {
      adjustmentSuggestion = parsed;
    }
    // 从 text 中移除整个 [ADJUST]...[/ADJUST] 段落
    text = text.replace(ADJUST_SECTION_PATTERN, "").trim();
  }

  // ═══ 原有逻辑：检测 [DONE] ═══
  const companionState = DONE_MARKER_PATTERN.test(text) ? "done" : "active";

  text = text
    .replace(DONE_MARKER_PATTERN, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*{1,3}([^*]+?)\*{1,3}/g, "$1")
    .replace(/_{1,3}([^_]+?)_{1,3}/g, "$1")
    .trim();

  if (!text) {
    throw new ParseCompanionAIResponseError("AI response is empty after cleaning.");
  }

  if (text.length > MAX_MESSAGE_LENGTH) {
    text = text.slice(0, MAX_MESSAGE_LENGTH) + "…";
  }

  return {
    companionState,
    message: text,
    adjustmentSuggestion,
  };
}
```

**注意**：`parseAdjustmentSection` 返回类型为 `TaskAdjustmentSuggestion | null`，需要文件顶部新增 `import type { TaskAdjustmentSuggestion } from "@/lib/types";`。不使用内联 `import("@/lib/types")` 断言方案。

### 6.6 边界情况处理

| 情况 | 行为 |
|------|------|
| AI 输出不含 [ADJUST] | `adjustmentSuggestion` = undefined，行为与 V2.6 完全一致 |
| [ADJUST] 段落存在但内容无法解析 | `adjustmentSuggestion` = undefined，text 中移除该段落 |
| [ADJUST] 嵌套标记 | 正则 `[\s\S]*?` 非贪婪匹配，取第一组 |
| 格式不完整（只有 [ADJUST] 没有 [/ADJUST]） | 正则不匹配，`adjustmentSuggestion` = undefined |
| [ADJUST] 段落出现在 AI 输出末尾 | 在截断前已提取，不受 `slice(0,300)` 影响 |
| [ADJUST] 段落非常长 | 完整提取，不受 MAX_MESSAGE_LENGTH 限制 |

### 6.7 Codex 操作指令

```
在 src/lib/task-companion-parser.ts 中：

Step 1: 文件顶部 import 区域新增：
        import type { TaskAdjustmentSuggestion } from "@/lib/types";

Step 2: 第 11 行 DONE_MARKER_PATTERN 之后，新增 ADJUST_SECTION_PATTERN 正则和 parseAdjustmentSection 函数
        parseAdjustmentSection 返回类型为 TaskAdjustmentSuggestion | null

Step 3: 第 13-48 行 parseCompanionAIResponse 函数：
        - 在去除 codeblock 之后、检测 [DONE] 之前，插入 [ADJUST] 提取逻辑
        - 提取成功后从 text 中移除 [ADJUST] 段落
        - 返回对象中新增 adjustmentSuggestion 字段

不要修改 MAX_MESSAGE_LENGTH 常量和 DONE_MARKER_PATTERN。
不要修改其他 import 语句（新增 import type 除外）。
```

---

## 7. Prompt 执行方案

### 7.1 文件

`src/prompts/task-companion.ts`

### 7.2 变更 1：COMPANION_SYSTEM_PROMPT 新增三个分节

**位置**：在现有 `═══ AI 验收规则 ═══` 分节之后、`═══ 主动鼓励机制 ═══` 分节之前。

**新增分节 A**：`═══ 任务调整触发规则 ═══`

```
═══ 任务调整触发规则 ═══
当你在当前任务的陪伴过程中检测到以下模式时，应考虑主动给出调整建议。

触发条件（满足任一即可）：
1. 同一任务内 stuck ≥ 2 次 + 最近一次 stuck 后 AI 给了更小动作但仍无法推进
2. 同一任务内 too_hard ≥ 2 次 + AI 已给出降级方案但用户仍反馈太难
3. 用户通过反馈框明确表达时间/精力/难度约束：
   - "今天没时间" / "只有 X 分钟"
   - "太大了" / "做不完" / "太多了"
   - "能不能少做点" / "能明天做吗"
4. AI 验收连续 2 次给出"不算完成"或"还差一点"，且用户未提交新的实质进展

建议调整时，只针对当前这一个任务，不要建议批量调整其他任务。

不触发调整的情况：
- 用户只是表达情绪但仍在推进（"好难啊但我试试"）→ 给鼓励 + 更小动作
- 用户第一次 stuck/too_hard → 正常给材料/降级方案
- 用户输入了具体卡点且 AI 能帮解决 → 先帮解决，不急着建议调整
```

**新增分节 B**：`═══ [ADJUST] 调整建议输出格式 ═══`

```
═══ [ADJUST] 调整建议输出格式 ═══
当你决定给出调整建议时，在正常输出文本之后，附加一个 [ADJUST]...[/ADJUST] 段落。

格式：
[ADJUST]
类型：downgraded
alt_title：只写项目名称和你的角色，一句话
这个任务内容较多，建议先完成最核心的部分。
[/ADJUST]

字段说明：
- 类型：downgraded（降级版）、tomorrow（明日继续）、keep_visible（保留但不要求今天完成）
- alt_title：仅 downgraded 类型需要，提供降级后的新任务标题。
  tomorrow 和 keep_visible 不要输出 alt_title 行。
- 第三行：给用户的一句话说清为什么建议这个调整

选择指南：
- 用户说"太复杂/太大/不知道怎么做" → downgraded（给出一个更简单的替代标题）
- 用户说"今天没时间/只有X分钟/做不完" → tomorrow
- 用户说"今天状态不好/做不动了" → 先建议 downgraded，如果用户仍反馈困难 → tomorrow
- 用户连续卡住，但任务本身不是难度问题而是精力问题 → keep_visible
- 不要在同一个 [ADJUST] 中建议多种类型——每次只建议一种
```

**新增分节 C**：`═══ 调整建议去重 ═══`

```
═══ 调整建议去重 ═══
如果用户消息中包含"用户已拒绝的调整类型"，则本轮不应再建议这些类型的调整。
例如：用户已拒绝"tomorrow"→ 本轮不应再建议 tomorrow，但仍可建议 downgraded 或 keep_visible。
如果所有三种调整类型（downgraded / tomorrow / keep_visible）都已被拒绝，本轮不再建议任何调整。
```

### 7.3 变更 2：扩展 CompanionPromptInput 接口

**当前代码**（第 108-116 行）：
```typescript
interface CompanionPromptInput {
  taskTitle: string;
  goal?: string;
  currentStep?: string;
  stepHistory?: string[];
  userSignal: CompanionUserSignal;
  sequenceContext?: CompanionSequenceContext;
  userFeedback?: string;
}
```

**目标代码**：新增两个可选字段：

```typescript
interface CompanionPromptInput {
  taskTitle: string;
  goal?: string;
  currentStep?: string;
  stepHistory?: string[];
  userSignal: CompanionUserSignal;
  sequenceContext?: CompanionSequenceContext;
  userFeedback?: string;
  // V2.7 新增
  signalStats?: {
    stuck: number;
    tooHard: number;
    hasDifficultyFeedback: boolean;
  };
  declinedAdjustmentTypes?: string[];
}
```

### 7.4 变更 3：扩展 buildCompanionUserPrompt

**当前代码**：在 `parts.push(SIGNAL_PROMPTS[input.userSignal])` 之前拼接 userFeedback。

**目标代码**：在 userFeedback 拼接之后、signal prompt 之前，新增 signalStats 和 declinedAdjustmentTypes 行：

```typescript
  // V2.7 新增：信号统计
  if (input.signalStats) {
    const stats = input.signalStats;
    parts.push(
      `当前任务陪伴信号统计：\n- 本轮陪伴中 stuck 次数：${stats.stuck}\n- 本轮陪伴中 too_hard 次数：${stats.tooHard}\n- 用户通过反馈框表达过难度相关：${stats.hasDifficultyFeedback ? "是" : "否"}`,
    );
  }

  // V2.7 新增：已拒绝的调整类型
  if (input.declinedAdjustmentTypes && input.declinedAdjustmentTypes.length > 0) {
    parts.push(
      `用户已拒绝的调整类型：${input.declinedAdjustmentTypes.join("、")}。不要再次建议这些类型的调整。`,
    );
  }
```

**插入位置**：在 `if (input.userFeedback?.trim()) { ... }` 之后、`parts.push(SIGNAL_PROMPTS[input.userSignal])` 之前。

### 7.5 变更 4：升级安全红线（第 3 条）

**当前代码**（COMPANION_SYSTEM_PROMPT 安全红线第 3 条）：
```
3. 不自动替用户完成任务，不修改任务，不生成新任务，不自动勾选任务。
```

**目标代码**（新增调整相关约束）：
```
3. 不自动替用户完成任务，不修改任务，不生成新任务，不自动勾选任务。你可以通过 [ADJUST] 建议调整，但不能自动执行调整。用户必须点击"接受调整"后系统才会调整。
```

### 7.6 Codex 操作指令

```
在 src/prompts/task-companion.ts 中：

Step 1: COMPANION_SYSTEM_PROMPT 模板字符串中，在 "═══ AI 验收规则 ═══" 分节之后、
        "═══ 主动鼓励机制 ═══" 分节之前，插入三个新分节：
        "═══ 任务调整触发规则 ═══"
        "═══ [ADJUST] 调整建议输出格式 ═══"
        "═══ 调整建议去重 ═══"

Step 2: 安全红线第 3 条补充调整相关约束文字

Step 3: CompanionPromptInput 接口新增 signalStats? 和 declinedAdjustmentTypes? 字段

Step 4: buildCompanionUserPrompt 函数中，在 userFeedback 拼接之后、signal prompt 之前，
        插入 signalStats 行和 declinedAdjustmentTypes 行的拼接逻辑

不要删除任何现有分节。不要修改 import 语句。
```

---

## 8. API Route 执行方案

### 8.1 文件

`src/app/api/task-companion/route.ts`

### 8.2 变更 1：CompanionRequestBody 扩展

**当前代码**（第 48-60 行）需要新增两个字段：

```typescript
interface CompanionRequestBody {
  taskTitle?: unknown;
  goal?: unknown;
  currentStep?: unknown;
  stepHistory?: unknown;
  userSignal?: unknown;
  userFeedback?: unknown;
  // V2.7 新增
  signalStats?: unknown;
  declinedAdjustmentTypes?: unknown;
  currentStepNumber?: unknown;
  totalSteps?: unknown;
  completedSteps?: unknown;
  previousTaskTitle?: unknown;
  nextTaskTitle?: unknown;
}
```

### 8.3 变更 2：新增 normalizeSignalStats 函数

**位置**：在 `normalizeUserFeedback` 函数（第 164-172 行）之后。

```typescript
// V2.7 新增：normalize 前端传来的 signalStats
interface NormalizedSignalStats {
  stuck: number;
  tooHard: number;
  hasDifficultyFeedback: boolean;
}

function normalizeSignalStats(value: unknown): NormalizedSignalStats | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const stats = value as Record<string, unknown>;
  const stuck = typeof stats.stuck === "number" && Number.isInteger(stats.stuck) && stats.stuck >= 0
    ? Math.min(stats.stuck, 99)
    : 0;
  const tooHard = typeof stats.tooHard === "number" && Number.isInteger(stats.tooHard) && stats.tooHard >= 0
    ? Math.min(stats.tooHard, 99)
    : 0;
  const hasDifficultyFeedback = typeof stats.hasDifficultyFeedback === "boolean"
    ? stats.hasDifficultyFeedback
    : false;

  if (stuck === 0 && tooHard === 0 && !hasDifficultyFeedback) {
    return undefined;  // 无需传递给 Prompt
  }

  return { stuck, tooHard, hasDifficultyFeedback };
}
```

### 8.4 变更 3：新增 normalizeDeclinedAdjustmentTypes 函数

**位置**：在 `normalizeSignalStats` 之后。

```typescript
// V2.7 新增：normalize 前端传来的已拒绝调整类型
const VALID_ADJUSTMENT_TYPES = new Set(["downgraded", "tomorrow", "keep_visible"]);

function normalizeDeclinedAdjustmentTypes(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => VALID_ADJUSTMENT_TYPES.has(item));

  // 去重
  const unique = [...new Set(normalized)];

  return unique.length > 0 ? unique : undefined;
}
```

### 8.5 变更 4：buildCompanionUserPrompt 调用扩展

**当前代码**（第 225-239 行），在 `buildCompanionUserPrompt` 调用中新增两行：

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
      sequenceContext: normalizeSequenceContext(body),
      stepHistory: normalizeStepHistory(body.stepHistory),
      taskTitle: body.taskTitle.trim().slice(0, MAX_TASK_TITLE_LENGTH),
      userFeedback: normalizeUserFeedback(body.userFeedback),
      userSignal: body.userSignal,
      // V2.7 新增
      signalStats: normalizeSignalStats(body.signalStats),
      declinedAdjustmentTypes: normalizeDeclinedAdjustmentTypes(body.declinedAdjustmentTypes),
    });
```

### 8.6 Codex 操作指令

```
在 src/app/api/task-companion/route.ts 中：

Step 1: CompanionRequestBody 接口新增两个字段：
        signalStats?: unknown;
        declinedAdjustmentTypes?: unknown;

Step 2: 在 normalizeUserFeedback 函数之后，新增 normalizeSignalStats 和 normalizeDeclinedAdjustmentTypes 函数

Step 3: buildCompanionUserPrompt 调用中新增 signalStats 和 declinedAdjustmentTypes 行

不要修改 POST 函数的整体结构。不要修改 import 语句。不要新增 VALID_ADJUSTMENT_TYPES 之外的常量到文件顶部。
```

---

## 9. useTaskCompanion 执行方案

### 9.1 文件

`src/hooks/useTaskCompanion.ts`

### 9.2 变更 1：新增两个 useRef

**位置**：在 `inflightRef` 和 `requestIdRef` 之后（第 73-74 行之后）。

```typescript
  // V2.7 新增：信号统计（每次 requestCompanion 时传给 API）
  const signalStatsRef = useRef<{
    stuck: number;
    tooHard: number;
    hasDifficultyFeedback: boolean;
  }>({
    stuck: 0,
    tooHard: 0,
    hasDifficultyFeedback: false,
  });

  // V2.7 新增：已拒绝的调整类型（同一 companion 会话内去重）
  const dismissedAdjustmentTypesRef = useRef<Set<string>>(new Set());
```

### 9.3 变更 2：更新 requestCompanion 请求体

**当前代码**（第 103-119 行）：需要新增两个字段。

在 `body: JSON.stringify({...})` 中新增：

```typescript
          body: JSON.stringify({
            completedSteps: sequenceContext?.completedSteps,
            currentStep: currentStepMessage,
            currentStepNumber: sequenceContext?.currentStepNumber,
            goal,
            nextTaskTitle: sequenceContext?.nextTaskTitle,
            previousTaskTitle: sequenceContext?.previousTaskTitle,
            stepHistory: historySnapshot,
            taskTitle,
            totalSteps: sequenceContext?.totalSteps,
            userFeedback: userFeedback?.trim().slice(0, 300) || undefined,
            userSignal,
            // V2.7 新增
            signalStats: signalStatsRef.current,
            declinedAdjustmentTypes:
              dismissedAdjustmentTypesRef.current.size > 0
                ? [...dismissedAdjustmentTypesRef.current]
                : undefined,
          }),
```

### 9.4 变更 3：sendSignal 中更新 signalStatsRef

**当前代码**（第 168-175 行）`sendSignal` 函数只调用 `requestCompanion(userSignal)`。

**目标代码**：在 `requestCompanion` 调用之前更新信号统计：

```typescript
  const sendSignal = useCallback(
    async (
      userSignal: Exclude<CompanionUserSignal, "start" | "user_feedback">,
    ) => {
      // V2.7 新增：更新信号统计
      if (userSignal === "stuck") {
        signalStatsRef.current.stuck += 1;
      } else if (userSignal === "too_hard") {
        signalStatsRef.current.tooHard += 1;
      }
      await requestCompanion(userSignal);
    },
    [requestCompanion],
  );
```

### 9.5 变更 4：sendFeedback 中更新 signalStatsRef

**当前代码**（第 177-188 行）`sendFeedback` 函数。

**目标代码**：在 `requestCompanion` 调用之前更新难度反馈标记：

```typescript
  const sendFeedback = useCallback(
    async (text: string) => {
      const trimmedText = text.trim();

      if (!trimmedText) {
        return;
      }

      // V2.7 新增：标记用户通过反馈框表达过难度相关内容
      // 简单启发式——包含难度/时间关键词
      if (!signalStatsRef.current.hasDifficultyFeedback) {
        const difficultyKeywords = [
          "太大", "太难", "做不完", "没时间", "做不动",
          "太多了", "能不能少做", "明天做", "卡住",
        ];
        if (difficultyKeywords.some((kw) => trimmedText.includes(kw))) {
          signalStatsRef.current.hasDifficultyFeedback = true;
        }
      }

      await requestCompanion("user_feedback", trimmedText);
    },
    [requestCompanion],
  );
```

### 9.6 变更 5：新增 declineAdjustment 方法

**位置**：在 `sendFeedback`（第 188 行）之后、`exitCompanion`（第 190 行）之前。

```typescript
  // V2.7 新增：拒绝调整建议（由 TaskCompanionPanel 调用）
  const declineAdjustment = useCallback(
    (type: string) => {
      dismissedAdjustmentTypesRef.current.add(type);
    },
    [],
  );
```

**说明**：useTaskCompanion **不新增 acceptAdjustment**。接受调整的流程走 props 链路：
`TaskCompanionPanel onAcceptAdjustment → TaskItem → TaskList → MainWorkspace → useTaskGroup.applyTaskAdjustment`。
useTaskCompanion 只负责 declineAdjustment（记录已拒绝类型用于去重）。

### 9.7 变更 6：reset 中清空两个 ref

**当前代码**（第 76-84 行）`reset` 函数。

**目标代码**：

```typescript
  const reset = useCallback(() => {
    requestIdRef.current += 1;
    inflightRef.current = false;
    setStatus("idle");
    setCurrentStep(null);
    setError(null);
    setStepHistory([]);
    setActiveSignal(null);
    // V2.7 新增：清空 V2.7 ref
    signalStatsRef.current = { stuck: 0, tooHard: 0, hasDifficultyFeedback: false };
    dismissedAdjustmentTypesRef.current = new Set();
  }, []);
```

### 9.8 变更 7：UseTaskCompanionReturn 扩展

**当前代码**（第 29-42 行）。

**目标代码**：新增 `declineAdjustment`：

```typescript
interface UseTaskCompanionReturn {
  status: TaskCompanionStatus;
  currentStep: CompanionStep | null;
  error: string | null;
  stepHistory: string[];
  activeSignal: CompanionUserSignal | null;
  startCompanion: () => Promise<void>;
  sendSignal: (
    userSignal: Exclude<CompanionUserSignal, "start" | "user_feedback">,
  ) => Promise<void>;
  sendFeedback: (text: string) => Promise<void>;
  // V2.7 新增
  declineAdjustment: (type: string) => void;
  exitCompanion: () => void;
  reset: () => void;
}
```

### 9.9 变更 8：return 对象新增

在 return 对象中新增 `declineAdjustment`。

### 9.10 Codex 操作指令

```
在 src/hooks/useTaskCompanion.ts 中：

Step 1: 在 inflightRef 和 requestIdRef 之后，新增 signalStatsRef 和 dismissedAdjustmentTypesRef

Step 2: 请求体 JSON.stringify 中新增 signalStats 和 declinedAdjustmentTypes 字段

Step 3: sendSignal 中，在 requestCompanion 调用之前，根据 signal 类型累加 signalStatsRef

Step 4: sendFeedback 中，在 requestCompanion 调用之前，检测难度关键词并设置 hasDifficultyFeedback

Step 5: 在 sendFeedback 之后，新增 declineAdjustment 方法（不新增 acceptAdjustment——accept 走 props 链路）

Step 6: reset 函数中，清空 signalStatsRef 和 dismissedAdjustmentTypesRef

Step 7: UseTaskCompanionReturn 接口新增 declineAdjustment（不新增 acceptAdjustment）

Step 8: return 对象中新增 declineAdjustment

不要修改 import 语句。不要修改 requestIdRef/inflightRef 逻辑。
不要修改 stepHistory 更新逻辑。不要修改 startCompanion 函数。
```

---

## 10. useTaskGroup 执行方案

### 10.1 文件

`src/hooks/useTaskGroup.ts`

### 10.2 变更 1：新增 import

**当前代码**（第 1-23 行 import 区域），新增导入：

```typescript
import { clearTodayResolvedAdjustmentsForNewDay } from "@/lib/task-execution";
```

### 10.3 变更 2：新增 applyTaskAdjustment 方法

**位置**：在 `handleToggleTask`（第 404-436 行）之后。

**参考模板**：`handleToggleTask` 的模式——setTaskGroup → saveCurrentTaskGroup → saveTaskGroupToCloud。

```typescript
  // V2.7 新增：应用任务调整
  function applyTaskAdjustment(
    taskId: string,
    input: import("@/lib/types").ApplyTaskAdjustmentInput,
  ) {
    setTaskGroup((currentTaskGroup) => {
      if (!currentTaskGroup) {
        return currentTaskGroup;
      }

      const taskIndex = currentTaskGroup.tasks.findIndex(
        (task) => task.id === taskId,
      );

      if (taskIndex === -1) {
        return currentTaskGroup;
      }

      const task = currentTaskGroup.tasks[taskIndex];
      const now = new Date().toISOString();

      let updatedTask: typeof task;

      if (input.type === "downgraded") {
        // 降级：替换 title，保留 originalTitle
        updatedTask = {
          ...task,
          title: input.alternativeTitle ?? task.title,
          updatedAt: now,
          adjustment: {
            type: "downgraded",
            originalTitle: task.title,
            reason: input.reason,
            adjustedAt: now,
          },
        };
      } else {
        // tomorrow / keep_visible: title 不变
        updatedTask = {
          ...task,
          updatedAt: now,
          adjustment: {
            type: input.type,  // "tomorrow" | "keep_visible"
            reason: input.reason,
            adjustedAt: now,
          },
        };
      }

      const updatedTaskGroup: TaskGroup = {
        ...currentTaskGroup,
        tasks: currentTaskGroup.tasks.map((t) =>
          t.id === taskId ? updatedTask : t,
        ),
        updatedAt: now,
      };

      saveCurrentTaskGroup(updatedTaskGroup);
      void saveTaskGroupToCloud(getOrCreateDeviceId(), updatedTaskGroup);
      return updatedTaskGroup;
    });
  }
```

**关键转换规则**：

| input.type | task.title | task.adjustment |
|:---|------|------|
| `"downgraded"` | `input.alternativeTitle`（替换） | `{ type, originalTitle: 旧title, reason, adjustedAt }` |
| `"tomorrow"` | 不变 | `{ type, reason, adjustedAt }` |
| `"keep_visible"` | 不变 | `{ type, reason, adjustedAt }` |

### 10.4 变更 3：在 applyRestoredTaskGroup 中调用 clearTodayResolvedAdjustmentsForNewDay

**当前代码**（第 166-175 行）：
```typescript
    function applyRestoredTaskGroup(restoredTaskGroup: TaskGroup) {
      const shouldCarryOver = shouldCarryOverTaskGroup(restoredTaskGroup);

      setTaskGroup(restoredTaskGroup);
      setPageStatus("success");
      setShowCarryoverPrompt(shouldCarryOver);
      setShowNewDayPrompt(
        !shouldCarryOver && !isTaskGroupFromToday(restoredTaskGroup),
      );
    }
```

**目标代码**：在 carryover 恢复时清理跨天 adjustment，并在发生清理后保存到 localStorage：

```typescript
    function applyRestoredTaskGroup(restoredTaskGroup: TaskGroup) {
      const shouldCarryOver = shouldCarryOverTaskGroup(restoredTaskGroup);

      // V2.7: 跨天 carryover 时清除 tomorrow/keep_visible adjustment
      if (shouldCarryOver) {
        const { taskGroup: cleanedTaskGroup, changed } =
          clearTodayResolvedAdjustmentsForNewDay(restoredTaskGroup);

        if (changed) {
          // 清理后保存到 localStorage（云端本来不存 adjustment，无需 cloud save）
          saveCurrentTaskGroup(cleanedTaskGroup);
          setTaskGroup(cleanedTaskGroup);
          setPageStatus("success");
          setShowCarryoverPrompt(true);
          setShowNewDayPrompt(false);
          return;
        }
      }

      setTaskGroup(restoredTaskGroup);
      setPageStatus("success");
      setShowCarryoverPrompt(shouldCarryOver);
      setShowNewDayPrompt(
        !shouldCarryOver && !isTaskGroupFromToday(restoredTaskGroup),
      );
    }
```

### 10.5 变更 4：返回对象新增 applyTaskAdjustment

在 `return { ... }` 对象（第 471-492 行）中新增：

```typescript
    applyTaskAdjustment,
```

以及 `UseTaskGroupReturn` 类型（隐式推导，无需显式声明 interface）。

### 10.6 Codex 操作指令

```
在 src/hooks/useTaskGroup.ts 中：

Step 1: import 区域新增 clearTodayResolvedAdjustmentsForNewDay 导入

Step 2: 在 handleToggleTask 之后，新增 applyTaskAdjustment 函数
        参考 handleToggleTask 的模式：setTaskGroup → saveCurrentTaskGroup → saveTaskGroupToCloud
        downgraded: task.title = input.alternativeTitle; task.adjustment = { type, originalTitle, reason, adjustedAt }
        tomorrow/keep_visible: task.title 不变; task.adjustment = { type, reason, adjustedAt }

Step 3: applyRestoredTaskGroup 函数中，在 shouldCarryOver 为 true 时：
        调用 clearTodayResolvedAdjustmentsForNewDay(restoredTaskGroup)
        若 changed=true，则 saveCurrentTaskGroup(cleanedTaskGroup) + setTaskGroup(cleanedTaskGroup) + return
        云端不存 adjustment，无需 cloud save

Step 4: return 对象中新增 applyTaskAdjustment

不要修改 handleToggleTask 函数。不要修改 saveCurrentTaskGroup / saveTaskGroupToCloud。
不要修改 restoreForAuthUser 的整体流程。不要修改 import 语句（新增除外）。
```

---

## 11. Props 链路执行方案

### 11.1 完整数据流

```
TaskCompanionPanel
  └── 用户点击"接受调整"
       ↓
  props.onAcceptAdjustment(taskId, suggestion)
       ↓
TaskItem
  └── props.onAcceptAdjustment(taskId, suggestion)  [转发]
       ↓
TaskList
  └── props.onAcceptAdjustment(taskId, suggestion)  [转发]
       ↓
MainWorkspace
  └── handleAcceptAdjustment(taskId, suggestion)
       ↓
  useTaskGroup.applyTaskAdjustment(taskId, input)
```

### 11.2 类型转换点

在 `MainWorkspace.handleAcceptAdjustment` 中，将 `TaskAdjustmentSuggestion` 转换为 `ApplyTaskAdjustmentInput`：

```typescript
function handleAcceptAdjustment(
  taskId: string,
  suggestion: TaskAdjustmentSuggestion,
) {
  applyTaskAdjustment(taskId, {
    type: suggestion.type,
    reason: suggestion.suggestion,
    alternativeTitle: suggestion.alternativeTitle,
  });
}
```

**转换规则**：`suggestion.suggestion` → `input.reason`（语义一致，字段名不同只是为了清晰区分"AI 建议展示"和"调整执行原因"）。

### 11.3 三层类型闭合

```
TaskAdjustmentSuggestion (parser 输出)
  { type, suggestion, alternativeTitle? }
         ↓ MainWorkspace 转换
ApplyTaskAdjustmentInput (props 链输入)
  { type, reason?, alternativeTitle? }
         ↓ useTaskGroup.applyTaskAdjustment 内部生成
TaskAdjustment (存储结构)
  { type, originalTitle?, reason?, adjustedAt }
```

---

## 12. TaskCompanionPanel UI 执行方案

### 12.1 文件

`src/components/TaskCompanionPanel.tsx`

### 12.2 变更 1：Props 新增 onAcceptAdjustment

**当前代码**（第 22-28 行）：
```typescript
interface TaskCompanionPanelProps {
  taskId: string;
  taskTitle: string;
  goal: string;
  sequenceContext?: TaskCompanionSequenceContext;
  onClose: () => void;
}
```

**目标代码**：
```typescript
interface TaskCompanionPanelProps {
  taskId: string;
  taskTitle: string;
  goal: string;
  sequenceContext?: TaskCompanionSequenceContext;
  onClose: () => void;
  // V2.7 新增
  onAcceptAdjustment?: (
    taskId: string,
    suggestion: import("@/lib/types").TaskAdjustmentSuggestion,
  ) => void;
}
```

### 12.3 变更 2：解构新增字段

在函数组件的解构中新增：
```typescript
  onAcceptAdjustment,
```

以及从 `useTaskCompanion` 解构中新增：
```typescript
  declineAdjustment,
```

### 12.4 变更 3：新增 dismissed 本地状态

```typescript
  // V2.7 新增：调整建议卡片是否被用户关闭
  const [adjustmentDismissed, setAdjustmentDismissed] = useState(false);
```

### 12.5 变更 4：获取 adjustmentSuggestion

```typescript
  const adjustmentSuggestion = currentStep?.adjustmentSuggestion;
  const showAdjustmentCard =
    adjustmentSuggestion &&
    !adjustmentDismissed &&
    status !== "loading" &&
    status !== "error";
```

### 12.6 变更 5：新增调整建议卡片 JSX

**位置**：在 AI 消息区域（`<div className="rounded-xl border border-emerald-100 bg-white px-4 py-3">`）之后、DONE 提示之前，插入：

```tsx
      {showAdjustmentCard && adjustmentSuggestion ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
          <p className="text-sm font-semibold text-amber-800">
            {adjustmentSuggestion.type === "downgraded"
              ? "💡 降级建议"
              : adjustmentSuggestion.type === "tomorrow"
                ? "📅 明日继续建议"
                : "👁️ 保留建议"}
          </p>
          <p className="mt-1 text-sm leading-6 text-amber-700">
            {adjustmentSuggestion.suggestion}
          </p>
          {adjustmentSuggestion.type === "downgraded" &&
          adjustmentSuggestion.alternativeTitle ? (
            <p className="mt-1 text-xs text-amber-600">
              降级后标题：{adjustmentSuggestion.alternativeTitle}
            </p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <button
              className="min-h-10 rounded-full bg-amber-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
              disabled={isLoading}
              onClick={() => {
                if (onAcceptAdjustment) {
                  onAcceptAdjustment(taskId, adjustmentSuggestion);
                }
                setAdjustmentDismissed(true);
              }}
              type="button"
            >
              接受调整
            </button>
            <button
              className="min-h-10 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              disabled={isLoading}
              onClick={() => {
                // V2.7: "不用，继续" —— 只隐藏卡片，不发送任何信号
                declineAdjustment(adjustmentSuggestion.type);
                setAdjustmentDismissed(true);
              }}
              type="button"
            >
              不用，继续
            </button>
          </div>
        </div>
      ) : null}
```

### 12.7 "不用，继续"行为验证

| 预期行为 | 代码验证 |
|----------|----------|
| 只隐藏卡片 | `setAdjustmentDismissed(true)` — 不调用任何信号 |
| 不发送 done | 不调用 `sendSignal("done")` |
| 不自动请求 AI | 不调用 `startCompanion` 或 `requestCompanion` |
| 不修改任务 | 不调用 `onAcceptAdjustment` |
| 记录已拒绝类型 | `declineAdjustment(adjustmentSuggestion.type)` |

### 12.8 变更 6：status 变化时重置 dismissed

当 `currentStep` 变化时（AI 返回了新消息），重置 `adjustmentDismissed`：

```typescript
  // V2.7: 当前步骤变化时重置 dismissed 状态
  useEffect(() => {
    setAdjustmentDismissed(false);
  }, [currentStep]);
```

### 12.9 变更 7：reset 时重置 dismissed

`exitCompanion` → `reset()` 自然会清空 currentStep。adjustmentDismissed 随组件卸载而清除（组件重新挂载时 useState 初始化为 false）。

### 12.10 Codex 操作指令

```
在 src/components/TaskCompanionPanel.tsx 中：

Step 1: Props 接口新增 onAcceptAdjustment 可选回调

Step 2: 函数组件参数解构新增 onAcceptAdjustment

Step 3: 从 useTaskCompanion 解构中新增 declineAdjustment

Step 4: 新增 adjustmentDismissed state

Step 5: 基于 currentStep.adjustmentSuggestion 计算 showAdjustmentCard

Step 6: 在 AI 消息区域之后、DONE 提示之前，插入调整建议卡片 JSX
        （含标题、建议文本、降级后标题、接受/拒绝按钮）

Step 7: "不用，继续"按钮的 onClick 只调用 declineAdjustment + setAdjustmentDismissed(true)
        不调用 sendSignal / requestCompanion / startCompanion / onAcceptAdjustment

Step 8: 新增 useEffect：currentStep 变化时重置 setAdjustmentDismissed(false)

不要修改 import 语句。不要修改现有按钮和输入框的 JSX。
不要修改 handleSendSignal / handleSendFeedback 函数。不要修改 visibleSignalButtons 逻辑。
```

---

## 13. TaskItem / TaskList / MainWorkspace 执行方案

### 13.1 TaskItem.tsx

**文件**：`src/components/TaskItem.tsx`

#### 变更 1：Props 新增 onAcceptAdjustment

在 `TaskItemProps` 接口（第 18-29 行）中新增：

```typescript
  // V2.7 新增
  onAcceptAdjustment?: (
    taskId: string,
    suggestion: import("@/lib/types").TaskAdjustmentSuggestion,
  ) => void;
```

#### 变更 2：新增 resolved_today 状态判断

**当前代码**（第 47-49 行）：
```typescript
  const isCompleted = executionStatus === "completed";
  const isCurrent = executionStatus === "current";
  const isLocked = executionStatus === "locked";
```

**目标代码**：新增：
```typescript
  const isResolvedToday = executionStatus === "resolved_today";
```

#### 变更 3：新增调整标记标签

在 title 旁边显示调整标记：

```tsx
  {/* V2.7: 调整标记 */}
  {task.adjustment ? (
    <span className="ml-1 shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
      {task.adjustment.type === "downgraded"
        ? "降级版"
        : task.adjustment.type === "tomorrow"
          ? "明日继续"
          : "保留可见"}
    </span>
  ) : null}
```

**位置**：在 `<span className={titleClassName}>{task.title}</span>` 之后插入。

#### 变更 4：更新行样式

**当前 rowClassName**（第 89-93 行）：三态样式。需要新增第四态。

```typescript
  const rowClassName = isLocked
    ? "flex min-w-0 cursor-not-allowed items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 opacity-70 transition-colors"
    : isResolvedToday
      ? "flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 transition-colors"
      : isCurrent
        ? "flex min-w-0 items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50/40 px-4 py-3 transition-colors hover:bg-indigo-50/60"
        : "flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:bg-indigo-50/40";
```

**resolved_today 视觉**：灰底（`bg-slate-50/60`）+ 正常透明度（不是 `opacity-70`）+ 可勾选。

#### 变更 5：checkbox 行为

resolved_today 任务的 checkbox **仍可勾选**（用户改变主意），不需要 `pointer-events-none`：

当前 `isLocked` 时 checkbox disabled。新增 `isResolvedToday` 时 checkbox 正常可操作：

```typescript
  disabled={isLocked}
  // resolved_today 不 disabled——用户仍可勾选完成
```

#### 变更 6：转发 onAcceptAdjustment 给 TaskCompanionPanel

在 `TaskCompanionPanel` 渲染（第 164-173 行）中新增 prop：

```tsx
  onAcceptAdjustment={onAcceptAdjustment}
```

#### 变更 7：executionStatus 渲染规则汇总

| executionStatus | 行样式 | checkbox | AI 入口 |
|:---|---|:---:|:---:|
| `"completed"` | 白色 + 删除线 | 可取消 | 不显示 |
| `"current"` | indigo 高亮 | 可勾选 | 显示 |
| `"locked"` | 灰底低透明度 | 不可操作 | 不显示 |
| `"resolved_today"` | 灰底正常透明度 + 调整标记 | **可勾选** | 不显示 |

**关键点**：resolved_today 保留 checkbox——用户改变主意可以手动勾选完成。

### 13.2 TaskList.tsx

**文件**：`src/components/TaskList.tsx`

#### 变更：Props 新增 onAcceptAdjustment + 转发

**Props 接口**（第 10-24 行）中新增一行：
```typescript
  onAcceptAdjustment?: (
    taskId: string,
    suggestion: import("@/lib/types").TaskAdjustmentSuggestion,
  ) => void;
```

**TaskItem 渲染**（第 72-91 行），`<TaskItem>` 中新增 prop：
```tsx
  onAcceptAdjustment={onAcceptAdjustment}
```

~3 行改动。

### 13.3 MainWorkspace.tsx

**文件**：`src/components/MainWorkspace.tsx`

#### 变更 1：从 useTaskGroup 解构新增 applyTaskAdjustment

在第 23-44 行解构中新增：
```typescript
  applyTaskAdjustment,
```

#### 变更 2：新增 handleAcceptAdjustment 回调

在 `handleToggleCompanion`（第 97-102 行）之后新增：

```typescript
  // V2.7 新增：处理用户接受调整建议
  function handleAcceptAdjustment(
    taskId: string,
    suggestion: import("@/lib/types").TaskAdjustmentSuggestion,
  ) {
    applyTaskAdjustment(taskId, {
      type: suggestion.type,
      reason: suggestion.suggestion,
      alternativeTitle: suggestion.alternativeTitle,
    });
  }
```

#### 变更 3：TaskList 渲染新增 onAcceptAdjustment

在第 186-200 行 `<TaskList>` 中新增：
```tsx
  onAcceptAdjustment={handleAcceptAdjustment}
```

#### 变更 4：全部 todayResolved 但未全部 completed 的 UI

**位置**：在 `<TaskList>` 渲染之前或之后，新增条件判断。

```tsx
  {/* V2.7: 全部任务 todayResolved 但未全部 completed 的轻量提示 */}
  {(() => {
    if (isAllCompleted) return null;
    if (tasks.length === 0) return null;
    const activeCount = tasks.filter(
      (t) => !t.completed && (!t.adjustment || t.adjustment.type === "downgraded")
    ).length;
    if (activeCount > 0) return null;
    // 没有 active 任务（全是 todayResolved），但未全部 completed
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-center text-sm text-slate-500 shadow-sm">
        今天先到这里，剩下的任务已保留/明天继续。
      </div>
    );
  })()}
```

**逻辑**：
- `isAllCompleted` = true → 不显示（显示 CompleteAllPrompt）
- 没有任务 → 不显示（由 EmptyState 处理）
- 有 active 任务（非 completed 且非 todayResolved，或 downgraded）→ 不显示（正常执行中）
- 所有未完成任务都是 todayResolved → **显示轻量提示**

### 13.4 Codex 操作指令

```
【TaskItem.tsx】

Step 1: Props 接口新增 onAcceptAdjustment 可选回调

Step 2: 新增 isResolvedToday 状态判断

Step 3: 在 title span 之后，新增 adjustment 标记标签（条件渲染）

Step 4: rowClassName 新增 isResolvedToday 分支

Step 5: checkbox disabled 逻辑不变（isLocked 时 disabled，resolved_today 不禁用）

Step 6: TaskCompanionPanel 渲染中新增 onAcceptAdjustment prop

【TaskList.tsx】

Step 1: Props 接口新增 onAcceptAdjustment 可选回调

Step 2: TaskItem 渲染中转发 onAcceptAdjustment prop

【MainWorkspace.tsx】

Step 1: 从 useTaskGroup 解构中新增 applyTaskAdjustment

Step 2: 新增 handleAcceptAdjustment 回调函数

Step 3: TaskList 渲染中新增 onAcceptAdjustment prop

Step 4: 新增"全部 todayResolved 但未全部 completed"的轻量提示条件渲染
```

---

## 14. 跨天恢复与 adjustment 清理方案

### 14.1 完整流程

```
用户第二天打开 App
       ↓
useTaskGroup.restoreForAuthUser(userId)
       ↓
loadTaskGroup(storageScope) or loadTaskGroupFromCloud(deviceId)
       ↓
applyRestoredTaskGroup(restoredTaskGroup)
       ↓
shouldCarryOverTaskGroup(restoredTaskGroup) → true
       ↓
【V2.7】const { taskGroup: cleaned, changed } = clearTodayResolvedAdjustmentsForNewDay(restoredTaskGroup)
  ├── tomorrow → adjustment 被清除
  ├── keep_visible → adjustment 被清除
  └── downgraded → adjustment 保留
       ↓
if (changed) → saveCurrentTaskGroup(cleaned) → setTaskGroup(cleaned) → return
  （只保存到 localStorage，云端本来不存 adjustment，无需 cloud save）
else → 继续原有流程
       ↓
setTaskGroup(restoredTaskGroup)  → 触发 re-render
       ↓
TaskItem 重新渲染:
  ├── 原 tomorrow/keep_visible → 普通未完成，isTaskTodayResolved = false → "current" 或 "locked"
  └── 原 downgraded → adjustment 仍在 → title 仍是降级后的 → "current" 或 "locked"
```

### 14.2 调用位置

`useTaskGroup.ts` 第 166-175 行 `applyRestoredTaskGroup` 函数内，在 `shouldCarryOverTaskGroup` 判断为 `true` 时调用。调用 `clearTodayResolvedAdjustmentsForNewDay(restoredTaskGroup)` 后检查 `changed`：若 `true` 则 `saveCurrentTaskGroup(cleanedTaskGroup)`（只保存到 localStorage，云端本来不存 adjustment）。`handleContinueCarryover` 不处理 adjustment——只保持原逻辑（隐藏 carryover prompt）。

### 14.3 各 adjustment type 的跨天行为

| adjustment type | carryover 时 | 新一天状态 |
|:---|---|:---|
| `downgraded` | 保留 adjustment + 保留修改后的 title | 仍是降级后的标题，adjustment 仍在 Task 上 |
| `tomorrow` | 清除 adjustment | 普通未完成任务，恢复为 current/locked |
| `keep_visible` | 清除 adjustment | 普通未完成任务，恢复为 current/locked |

### 14.4 Prompt 感知

跨天恢复后 start 信号中，downgraded 任务因保留 adjustment，Prompt 将看到 adjustment 信息。当前 `buildCompanionUserPrompt` 不传递 adjustment 字段——**V2.7A 不做 Prompt 跨天感知，属于后续优化。**

---

## 15. 不修改 save/load route 的代码依据

### 15.1 save/route.ts

**`isValidTask`（第 54-68 行）验证确认**：

```typescript
function isValidTask(task: unknown): task is Task {
  if (!task || typeof task !== "object") return false;
  const value = task as Partial<Task>;
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.completed === "boolean" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}
```

只检查 5 个字段的 typeof，**不拒绝多余字段**。Task 对象多出 `adjustment` 属性 → `isValidTask` 仍返回 `true` ✅。

**DB insert 映射（第 189-198 行）确认**：

```typescript
return {
  id: task.id,
  task_group_id: taskGroup.id,
  title: task.title,
  completed: task.completed,
  completed_at: completedAt,
  created_at: task.createdAt,
  updated_at: task.updatedAt,
};
```

只映射 7 个列。`adjustment` 不在映射中 → 自然丢弃 ✅。

### 15.2 load/route.ts

**Task 映射（第 104-110 行）确认**：

```typescript
const tasks: Task[] = (taskRows ?? []).map((task) => ({
  id: task.id,
  title: task.title,
  completed: task.completed,
  createdAt: task.created_at,
  updatedAt: task.updated_at,
}));
```

不返回 `adjustment` 字段。前端从 localStorage 恢复 ✅。

### 15.3 结论

| 检查点 | 行为 | 是否需要改 |
|--------|------|:---:|
| save `isValidTask` | 不拒绝多余字段（adjustment） | ❌ 不改 |
| save DB insert | 只映射 7 列，adjustment 自然丢弃 | ❌ 不改 |
| load Task 映射 | 不返回 adjustment | ❌ 不改 |

**save 和 load route 都不需要任何代码修改。**

---

## 16. 不改统计口径说明

### 16.1 当前统计计算

在 `useTaskGroup.ts` 中（第 157-159 行）：

```typescript
const completedCount = tasks.filter((task) => task.completed).length;
const totalCount = tasks.length;
const isAllCompleted = totalCount > 0 && completedCount === totalCount;
```

### 16.2 V2.7 为什么不改

1. `keep_visible` / `tomorrow` 任务的 `completed` 仍是 `false`——自然不计入 `completedCount`
2. 这些任务仍在 `tasks` 数组中——计入 `totalCount`
3. **这就是期望行为**：用户看到了完整任务列表，完成了其中 N 个，完成率 = N / total。调整后的任务"不需要今天完成"但不代表它们不存在
4. 如果需要从统计中排除，需要改动：
   - `src/lib/stats-calculator.ts` — 统计计算
   - `src/app/api/task-groups/stats/route.ts` — 统计 API
   - `src/components/StatsBar.tsx` — 统计栏 UI
   - `src/components/TaskProgress.tsx` — 进度条
   - `src/components/CompleteAllPrompt.tsx` — 全部完成提示
   - 影响面太大，不属 V2.7A MVP 范围

### 16.3 isAllCompleted 的特殊情况

**当前**：`isAllCompleted = totalCount > 0 && completedCount === totalCount`

**V2.7 后**：
- 所有任务 completed → `isAllCompleted = true`（与 V2.6 一致）
- 所有任务 completed 或 todayResolved → `isAllCompleted = false`（正确——并非全部完成）
- MainWorkspace 中的新增轻量提示处理"全部 todayResolved 但未全部 completed"的情况（见 13.3 节变更 4）

---

## 17. 安全边界与产品红线

### 17.1 如何验证 AI 不自动勾选任务

| 层 | 保障 |
|----|------|
| UI 层 | checkbox 由用户手动点击，`TaskCompanionPanel` 没有 checkbox、没有 `onToggle` |
| Hook 层 | `onToggle` 仅在 `TaskItem` 的 checkbox `onChange` 中调用 |
| API 层 | `task-companion/route.ts` 只返回文本，不修改任务状态 |
| Prompt 层 | 安全红线第 3 条明确禁止自动勾选 |
| V2.7 新增 | `applyTaskAdjustment` 只修改 title + adjustment，不修改 completed |

### 17.2 如何验证 AI 不自动删除任务

| 层 | 保障 |
|----|------|
| 代码层 | 没有任何 AI 输出可以触发任务删除——`handleClearTasks` 只在用户点击"清空任务"时调用 |
| V2.7 新增 | `applyTaskAdjustment` 只做 update，不做 delete |

### 17.3 如何验证没有变成聊天系统

| 防线 | 保障 |
|------|------|
| 任务绑定 | 调整建议卡片只在 `TaskCompanionPanel` 内部，不是独立页面 |
| 无全局入口 | 不新增路由、不新增 Tab |
| 不存对话 | adjustment 不存数据库，`[ADJUST]` 解析结果不持久化 |
| UI 不是聊天 | 调整建议是功能卡片（标题+文本+两个按钮），不是聊天气泡 |

### 17.4 如何验证不绕过 locked 顺序执行

| 机制 | 保障 |
|------|------|
| `getTaskExecutionStatus` 是唯一状态判断入口 | 所有任务状态都经过此函数 |
| `downgraded` → `isTaskTodayResolved = false` → `"current"` → 仍阻塞后续 |
| `tomorrow / keep_visible` → `isTaskTodayResolved = true` → `"resolved_today"` → 不阻塞 |
| `resolved_today` 只能通过"接受调整"触发 | `applyTaskAdjustment` 是唯一修改 adjustment 的路径 |

### 17.5 V2.7 明确禁止事项（Codex 必读）

| # | 禁止 | 原因 |
|---|------|------|
| 1 | 不实现 `postponed` 类型 | 属于 V2.7B |
| 2 | 不做批量调整（"剩余任务 keep_visible"等） | V2.7A 只调整当前任务 |
| 3 | 不改数据库 schema / migration | V2.7 MVP 零数据库变更 |
| 4 | 不改 task-group/save/route.ts | 已验证：零改动 |
| 5 | 不改 task-group/load/route.ts | 已验证：零改动 |
| 6 | 不改 `ai-client.ts` | AI 调用逻辑不变 |
| 7 | 不改 `adjust-task-strategy.ts` | 生成阶段调整不变——V2.7 是执行中调整 |
| 8 | 不改 `TaskAssistPanel.tsx` / `useTaskAssist.ts` | AI 辅助不变 |
| 9 | 不改 `task-assist.ts` / `task-generation.ts` / `task-review.ts` | Prompt 不变 |
| 10 | 不改历史 / 统计 / 复盘 API 和组件 | V2.7 MVP 不改统计口径 |
| 11 | 不改 Auth | Auth 体系稳定 |
| 12 | 不新增聊天 Tab / 消息气泡 UI | 产品定位不变 |
| 13 | 不新增长期对话存储 | V2.7 不做 |
| 14 | 不自动勾选任务 | Human-in-the-Loop |
| 15 | 不自动删除任务 | Human-in-the-Loop |
| 16 | 不让 AI 替用户放弃目标 | 调整是减压降级，不是放弃 |
| 17 | 不绕过 locked 顺序执行 | `downgraded` 仍阻塞后续 |
| 18 | 不提交、不 push | 等 ChatGPT 最终把关 |

---

## 18. Codex 实现顺序

> **Codex 按 Phase A–L 顺序一次性实现。实现完成后停止，不提交、不 push。随后交给 Claude Code 做完整 Code Review。**

### Phase A：types.ts 类型扩展（预计 ~25 行，5 分钟）

```
文件：src/lib/types.ts
变更：
  1. 新增 TaskAdjustment 接口
  2. Task 接口新增 adjustment? 字段
  3. 新增 TaskAdjustmentSuggestion 接口
  4. 新增 ApplyTaskAdjustmentInput 接口
  5. CompanionStep 新增 adjustmentSuggestion? 字段
验证：TypeScript 编译无错误
```

### Phase B：task-execution.ts 四态升级（预计 ~45 行新增 + ~20 行修改，15 分钟）

```
文件：src/lib/task-execution.ts
变更：
  1. TaskExecutionStatus 扩展为四态（含 "resolved_today"）
  2. CompletableTask 扩展为含 adjustment?
  3. 新增 isTaskTodayResolved helper
  4. 重写 getCurrentTaskIndex（跳过 todayResolved）
  5. 重写 getTaskExecutionStatus（四态优先级）
  6. 新增 clearTodayResolvedAdjustmentsForNewDay
验证：TypeScript 编译无错误
```

### Phase C：task-companion-parser.ts [ADJUST] 解析（预计 ~30 行新增 + ~5 行修改，10 分钟）

```
文件：src/lib/task-companion-parser.ts
变更：
  1. 新增 type import: import type { TaskAdjustmentSuggestion } from "@/lib/types"
  2. 新增 ADJUST_SECTION_PATTERN 正则
  3. 新增 parseAdjustmentSection 函数（返回 TaskAdjustmentSuggestion | null）
  4. parseCompanionAIResponse 新增 [ADJUST] 提取逻辑（在截断前）
  5. 返回对象新增 adjustmentSuggestion
验证：TypeScript 编译无错误
```

### Phase D：task-companion.ts Prompt 升级（预计 ~60 行新增 + ~8 行修改，15 分钟）

```
文件：src/prompts/task-companion.ts
变更：
  1. COMPANION_SYSTEM_PROMPT 新增 3 个分节
  2. 安全红线第 3 条补充
  3. CompanionPromptInput 新增 signalStats? + declinedAdjustmentTypes?
  4. buildCompanionUserPrompt 新增 signalStats 行 + declinedAdjustmentTypes 行
验证：TypeScript 编译无错误
```

### Phase E：task-companion/route.ts API 扩展（预计 ~25 行新增 + ~3 行修改，10 分钟）

```
文件：src/app/api/task-companion/route.ts
变更：
  1. CompanionRequestBody 新增 signalStats + declinedAdjustmentTypes
  2. 新增 normalizeSignalStats 函数
  3. 新增 normalizeDeclinedAdjustmentTypes 函数
  4. buildCompanionUserPrompt 调用新增两个参数
验证：TypeScript 编译无错误
```

### Phase F：useTaskCompanion.ts Hook 扩展（预计 ~30 行新增 + ~5 行修改，10 分钟）

```
文件：src/hooks/useTaskCompanion.ts
变更：
  1. 新增 signalStatsRef + dismissedAdjustmentTypesRef
  2. 请求体新增 signalStats + declinedAdjustmentTypes
  3. sendSignal 中更新 signalStatsRef
  4. sendFeedback 中更新 hasDifficultyFeedback
  5. 新增 declineAdjustment 方法
  6. reset 中清空两个 ref
  7. UseTaskCompanionReturn 扩展 + return 对象扩展
验证：TypeScript 编译无错误
```

### Phase G：useTaskGroup.ts 状态管理扩展（预计 ~45 行新增 + ~5 行修改，15 分钟）

```
文件：src/hooks/useTaskGroup.ts
变更：
  1. 新增 clearTodayResolvedAdjustmentsForNewDay import
  2. 新增 applyTaskAdjustment 方法
  3. applyRestoredTaskGroup 中调用 clearTodayResolvedAdjustmentsForNewDay，若 changed=true 则 saveCurrentTaskGroup
  4. return 对象新增 applyTaskAdjustment
验证：TypeScript 编译无错误
```

### Phase H：TaskCompanionPanel.tsx UI 升级（预计 ~60 行新增 + ~3 行修改，15 分钟）

```
文件：src/components/TaskCompanionPanel.tsx
变更：
  1. Props 新增 onAcceptAdjustment
  2. 新增 adjustmentDismissed state
  3. 新增调整建议卡片 JSX（含接受/拒绝按钮）
  4. "不用，继续"不发送任何信号
  5. useEffect 重置 dismissed
验证：TypeScript 编译无错误；视觉确认 UI 变化
```

### Phase I：TaskItem.tsx 视觉升级（预计 ~25 行新增 + ~5 行修改，10 分钟）

```
文件：src/components/TaskItem.tsx
变更：
  1. Props 新增 onAcceptAdjustment
  2. 新增 isResolvedToday 状态判断
  3. 新增 adjustment 标记标签
  4. rowClassName 新增 isResolvedToday 分支
  5. TaskCompanionPanel 渲染新增 onAcceptAdjustment prop
验证：TypeScript 编译无错误
```

### Phase J：TaskList.tsx Props 转发（预计 ~5 行新增 + ~1 行修改，3 分钟）

```
文件：src/components/TaskList.tsx
变更：
  1. Props 新增 onAcceptAdjustment
  2. TaskItem 渲染中转发 onAcceptAdjustment
验证：TypeScript 编译无错误
```

### Phase K：MainWorkspace.tsx 集成（预计 ~12 行新增 + ~2 行修改，5 分钟）

```
文件：src/components/MainWorkspace.tsx
变更：
  1. 从 useTaskGroup 解构新增 applyTaskAdjustment
  2. 新增 handleAcceptAdjustment 回调
  3. TaskList 渲染新增 onAcceptAdjustment
  4. 新增"全部 todayResolved 但未全部 completed"轻量提示
验证：TypeScript 编译无错误
```

### Phase L：全量验证（预计 15 分钟）

```
命令：
  npm run lint
  npm run build
  git status --short

手动验收（见第 20 节）
回归验收（见第 21 节）
```

> **实现完成后停止，不提交、不 push。随后交给 Claude Code 做完整 Code Review。**

---

## 19. 验证命令

### 19.1 每次修改后

```bash
npm run lint    # 必须零 error
npm run build   # 必须 Compiled successfully
```

### 19.2 全量修改完成后

```bash
npm run lint
npm run build
git status --short
```

### 19.3 预期 git status 输出

```
M src/lib/types.ts
M src/lib/task-execution.ts
M src/lib/task-companion-parser.ts
M src/prompts/task-companion.ts
M src/app/api/task-companion/route.ts
M src/hooks/useTaskCompanion.ts
M src/hooks/useTaskGroup.ts
M src/components/TaskCompanionPanel.tsx
M src/components/TaskItem.tsx
M src/components/TaskList.tsx
M src/components/MainWorkspace.tsx
```

**仅此 11 个文件，不应有任何其他文件变更。** 特别确认无以下文件变更：
- ~~`src/app/api/task-group/save/route.ts`~~
- ~~`src/app/api/task-group/load/route.ts`~~
- ~~`src/lib/ai-client.ts`~~
- ~~`src/lib/adjust-task-strategy.ts`~~
- ~~database schema / migration~~

---

## 20. 手动验收场景

### 场景 1：连续 stuck → AI 建议调整（核心场景）

1. 打开 `/app`，输入目标，生成任务
2. 对"当前任务"点击"开始陪我做"
3. AI 给出第一步后，连续点击"我卡住了"2-3 次
4. **期望**：AI 在后续输出中包含 [ADJUST]...[/ADJUST] 段落
5. **期望**：调整建议卡片出现在 AI 消息下方，含"接受调整"和"不用，继续"按钮
6. **不期望**：AI 只是口头安慰，无调整建议

### 场景 2：反馈输入"太大了" → AI 建议降级

1. 在反馈输入框输入：`"这个任务太大了，做不完"`
2. 点击"发送给 AI"
3. **期望**：AI 输出包含 `[ADJUST]` 段落，type 为 `downgraded`，含 `alt_title`
4. **期望**：卡片显示降级建议和替代标题

### 场景 3：接受调整 → 任务更新

1. 在场景 1 或 2 中，AI 给出了调整建议卡片
2. 点击"接受调整"
3. **期望**：
   - 降级版：task.title 更新为替代标题，originalTitle 保留
   - 明日继续：task.adjustment 设为 `{ type: "tomorrow", ... }`，后续任务解锁
   - 保留可见：task.adjustment 设为 `{ type: "keep_visible", ... }`，后续任务解锁
4. **期望**：任务行显示调整标记标签（"降级版"/"明日继续"/"保留可见"）
5. **期望**：刷新页面后 adjustment 仍在（localStorage 持久化）

### 场景 4："不用，继续" → 只隐藏卡片

1. AI 给出调整建议卡片
2. 点击"不用，继续"
3. **期望**：调整建议卡片消失
4. **期望**：不调用 `sendSignal("done")`（通过 debug 确认）
5. **期望**：任务不变
6. **期望**：陪伴面板回到正常交互状态，用户可以继续点击按钮/输入反馈

### 场景 5：拒绝后去重

1. AI 建议"明日继续"→ 点击"不用，继续"
2. 继续点击"太难了"触发 AI 再次判断
3. **期望**：AI 不再建议"tomorrow"类型（可建议 downgraded 或 keep_visible）
4. 继续拒绝 downgraded 和 keep_visible
5. **期望**：AI 不再建议任何调整

### 场景 6：降级版不阻塞后续

1. 接受 downgraded 调整
2. **期望**：当前任务仍是 current（标题已变），后续任务仍是 locked

### 场景 7：明日继续不阻塞后续

1. 接受 tomorrow 调整
2. **期望**：当前任务变为 resolved_today（灰底 + "明日继续"标签），后续任务解锁

### 场景 8：跨天清除调整

1. 在当前天接受 tomorrow 调整
2. 确认任务有 adjustment 标记
3. 第二天打开 App（或手动修改 taskGroup.createdAt 模拟跨天）
4. **期望**：原 tomorrow 任务变为普通未完成，adjustment 被清除

### 场景 9：全部 todayResolved 但不全部 completed

1. 对所有任务依次接受 tomorrow 或 keep_visible 调整
2. **期望**：不显示"全部完成"提示
3. **期望**：显示轻量提示"今天先到这里，剩下的任务已保留/明天继续。"

### 场景 10：原有功能不受影响

1. "我完成了"按钮正常
2. "我卡住了"按钮正常
3. "太难了"按钮正常
4. 反馈输入框正常
5. [DONE] 标记正常
6. AI 验收正常

---

## 21. 回归验收清单

### 21.1 陪伴功能回归

| # | 验收项 | 预期 |
|---|--------|------|
| R1 | "开始陪我做"触发 startCompanion | 正常 |
| R2 | "我完成了"按钮 → AI 给下一步 | 正常 |
| R3 | "我卡住了"按钮 → AI 给帮助 | 正常 |
| R4 | "太难了"按钮 → AI 给降级 | 正常 |
| R5 | 反馈输入框 + "发送给 AI" | 正常 |
| R6 | [DONE] 标记 → 面板显示提示 | 正常 |
| R7 | "复制当前步骤" → 剪贴板 | 正常 |
| R8 | "退出陪伴" → 关闭面板 | 正常 |
| R9 | 重试按钮（error 状态） | 正常 |
| R10 | 序列上下文（第几步/共几步） | 正常 |
| R11 | locked 任务不能进入陪伴 | 正常 |
| R12 | 任务完成后陪伴面板关闭 | 正常 |

### 21.2 核心功能回归

| # | 验收项 | 预期 |
|---|--------|------|
| R13 | 任务生成（输入目标→AI 生成任务列表） | 正常 |
| R14 | 任务勾选/取消 | 正常 |
| R15 | 全部完成后 CompleteAllPrompt | 正常 |
| R16 | AI Assist 四种动作 | 正常 |
| R17 | 历史记录（HistoryPanel） | 正常 |
| R18 | 统计数据（StatsBar） | 正常 |
| R19 | AI 复盘（TaskReviewPanel） | 正常 |
| R20 | Auth 登录/登出/路由守卫 | 正常 |
| R21 | 未完成任务跨天继承 | 正常（含 adjustment 清理） |
| R22 | 顺序执行（locked/unlocked） | 正常（downgraded 仍阻塞，tomorrow/keep_visible 不阻塞） |

### 21.3 技术回归

| # | 验收项 | 预期 |
|---|--------|------|
| R23 | `npm run lint` | 零 error |
| R24 | `npm run build` | Compiled successfully |
| R25 | `git status --short` | 仅 11 个文件 |
| R26 | 无数据库变更 | `git diff` 无 schema/migration |
| R27 | 无新增依赖 | `git diff package.json` 无变更 |
| R28 | save/load route 无变更 | `git diff` 无 save/load 变更 |
| R29 | ai-client.ts 无变更 | `git diff` 无该文件变更 |
| R30 | adjust-task-strategy.ts 无变更 | `git diff` 无该文件变更 |

---

## 22. 风险与 Review 重点

### 22.1 Claude Code Review 必查 15 项

| # | 检查项 | 重点 |
|---|--------|------|
| 1 | `types.ts` 改动 | 新增类型正确；Task.adjustment 为可选；CompanionStep 向后兼容 |
| 2 | `task-execution.ts` 四态逻辑 | 优先级：completed → resolved_today → current → locked |
| 3 | `isTaskTodayResolved` | 只对 tomorrow/keep_visible 返回 true；downgraded 返回 false |
| 4 | `getCurrentTaskIndex` | 正确跳过 todayResolved 任务 |
| 5 | `clearTodayResolvedAdjustmentsForNewDay` | tomorrow/keep_visible 清除；downgraded 保留 |
| 6 | `parseAdjustmentSection` 容错 | 无 [ADJUST]、格式不完整、嵌套标记 |
| 7 | [ADJUST] 提取在截断前 | parser 流程中 [ADJUST] 提取在 `slice(0,300)` 之前 |
| 8 | Prompt 新增分节 | 3 个分节完整；不删除现有分节；红线完整保留 |
| 9 | `normalizeSignalStats` 防御 | 非 object → undefined；负数 → clamp；超大值 → clamp |
| 10 | `normalizeDeclinedAdjustmentTypes` 防御 | 非 array → undefined；无效类型 → 过滤；去重 |
| 11 | `signalStatsRef` 重置 | `reset()` 中清空；`exitCompanion` → `reset()` 链路完整 |
| 12 | `applyTaskAdjustment` 字段闭合 | downgraded → title 替换 + originalTitle；tomorrow/keep_visible → title 不变 |
| 13 | "不用，继续"不发送 done | 确认 onClick 中不调用 sendSignal / requestCompanion |
| 14 | Props 链路完整 | Panel → Item → List → Workspace → useTaskGroup |
| 15 | save/load route 零改动 | `git diff` 确认无变更 |

### 22.2 Codex 提交前自检清单

- [ ] `npm run lint` 零 error
- [ ] `npm run build` 成功
- [ ] `git status --short` 仅 11 个文件
- [ ] `git diff` 无 `save/route.ts` 变更
- [ ] `git diff` 无 `load/route.ts` 变更
- [ ] `git diff` 无 `ai-client.ts` 变更
- [ ] `git diff` 无 `adjust-task-strategy.ts` 变更
- [ ] `git diff` 无数据库 schema/migration 变更
- [ ] `git diff` 无 `package.json` 变更
- [ ] `grep "resolved_today" src/lib/task-execution.ts` 有匹配
- [ ] `grep "clearTodayResolvedAdjustmentsForNewDay" src/lib/task-execution.ts` 有匹配
- [ ] `grep "isTaskTodayResolved" src/lib/task-execution.ts` 有匹配
- [ ] `grep "applyTaskAdjustment" src/hooks/useTaskGroup.ts` 有匹配
- [ ] `grep "ADJUST" src/lib/task-companion-parser.ts` 有匹配
- [ ] `grep "signalStats" src/hooks/useTaskCompanion.ts` 有匹配
- [ ] `grep "dismissedAdjustmentTypesRef" src/hooks/useTaskCompanion.ts` 有匹配
- [ ] 未新增任何文件（除本文档）
- [ ] 未删除任何文件

### 22.3 常见实现错误预警

| # | 错误 | 正确做法 |
|---|------|----------|
| 1 | 实现了 `postponed` 类型 | V2.7A 只有 downgraded / tomorrow / keep_visible 三种 |
| 2 | Prompt 建议批量调整 | 只建议当前任务调整 |
| 3 | "不用，继续"调用了 sendSignal("done") | 只隐藏卡片，不发送任何信号 |
| 4 | `isTaskTodayResolved` 对 downgraded 返回 true | downgraded 不是 todayResolved——仍是活跃任务 |
| 5 | `getCurrentTaskIndex` 未跳过 todayResolved | todayResolved 任务阻塞后续 |
| 6 | 忘记在 `applyRestoredTaskGroup` 中调用清理函数 + 保存 localStorage | 清理后 changed=true 须 saveCurrentTaskGroup，否则跨天后 tomorrow 任务永远无法成为 current |
| 7 | 在 `handleContinueCarryover` 中添加了 adjustment 清理逻辑 | adjustment 清理只在 applyRestoredTaskGroup 中，handleContinueCarryover 只隐藏 prompt |
| 8 | [ADJUST] 提取在截断之后 | 长 AI 输出中 [ADJUST] 段落被 `slice(0,300)` 截断 |
| 9 | `save/route.ts` 被修改 | 已验证不需要改 |
| 10 | `load/route.ts` 被修改 | 已验证不需要改 |
| 11 | 修改了 `ai-client.ts` | V2.7 不改 AI 调用逻辑 |
| 12 | 修改了 `adjust-task-strategy.ts` | 生成阶段调整和 V2.7 执行中调整是两个独立模块 |
| 13 | `declineAdjustment` 忘记记录类型 | dismissedAdjustmentTypesRef 未更新 |
| 14 | 在 useTaskCompanion 中新增了 acceptAdjustment | 接受调整走 props 链路（Panel→Item→List→Workspace→useTaskGroup），useTaskCompanion 只有 declineAdjustment |

---

> **文档结束**
>
> **关联文档**：
> - [Architecture-V2.7-Task-Difficulty-Adjustment.md](Architecture-V2.7-Task-Difficulty-Adjustment.md) — V2.7 架构方案（本文档的上游）
> - [Upgrade-Lock-V2.6-to-V3.0A.md](Upgrade-Lock-V2.6-to-V3.0A.md) — 版本锁定关系（本文档必须遵守）
> - [Roadmap-V2.6-to-V3.0A-AI-Execution-Loop.md](Roadmap-V2.6-to-V3.0A-AI-Execution-Loop.md) — V2.6→V3.0A 路线规划
> - [Project-State-Handoff.md](Project-State-Handoff.md) — 项目当前状态交接
>
> **下一文档**：本文档经 ChatGPT 审查通过后 → Codex 按 Phase A→L 顺序一次性实现，完成后交 Claude Code 做完整 Code Review
