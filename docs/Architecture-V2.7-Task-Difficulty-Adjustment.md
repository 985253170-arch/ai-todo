# V2.7：任务难度与数量动态调整 架构方案

> **状态**：架构设计阶段。ChatGPT 审查中（第三轮）。**只写架构方案，不写代码。**
> **前置**：V2.6 任务内受控反馈框与 AI 验收机制 ✅（已提交 `718ec47`）
> **路线依据**：[Roadmap-V2.6-to-V3.0A-AI-Execution-Loop.md](Roadmap-V2.6-to-V3.0A-AI-Execution-Loop.md)
> **版本锁定**：遵守 [Upgrade-Lock-V2.6-to-V3.0A.md](Upgrade-Lock-V2.6-to-V3.0A.md) 第 5 节 V2.7 锁定范围
> **定位**：从"AI 只能安慰"到"AI 能建议调整"——用户多次卡住/太难/没时间后，AI 给出减压降级建议，用户确认后调整
> **下一文档**：`docs/Execution-Plan-V2.7-Task-Difficulty-Adjustment.md`（待本架构审查通过后编写）
> **设计日期**：2026-07-08
> **修订日期**：2026-07-08（ChatGPT 第一轮审查修订 → 第三轮审查修订）

---

## 目录

- [1. 背景与问题](#1-背景与问题)
- [2. V2.7 核心目标](#2-v27-核心目标)
- [3. V2.7 不做范围](#3-v27-不做范围)
- [4. 与 V2.6 / V3.0A 的关系](#4-与-v26--v30a-的关系)
- [5. 当前代码核验结果](#5-当前代码核验结果)
- [6. 用户反馈信号来源](#6-用户反馈信号来源)
- [7. 调整触发条件设计](#7-调整触发条件设计)
- [8. 调整建议类型设计](#8-调整建议类型设计)
- [9. "接受调整 / 不用继续"交互与数据更新闭环](#9-接受调整--不用继续交互与数据更新闭环)
- [10. 任务状态与数据模型方案](#10-任务状态与数据模型方案)
- [11. 技术方案对比](#11-技术方案对比)
- [12. 推荐方案：方案 B 修正版](#12-推荐方案方案-b-修正版)
- [13. 预计文件影响范围](#13-预计文件影响范围)
- [14. 明确不修改文件](#14-明确不修改文件)
- [15. 产品边界与安全红线](#15-产品边界与安全红线)
- [16. 风险与缓解](#16-风险与缓解)
- [17. V2.7 MVP 范围分阶段建议](#17-v27-mvp-范围分阶段建议)
- [18. 验收标准](#18-验收标准)
- [19. 后续 Execution Plan 要点](#19-后续-execution-plan-要点)

---

## 1. 背景与问题

### 1.1 V2.6 达成了什么

V2.6 建立了用户→AI 的双向反馈通道：

| 成果 | 说明 |
|------|------|
| 任务内受控反馈输入框 | 用户可输入当前进展、卡点、草稿、时间限制 |
| AI 基于 userFeedback 推进任务 | AI 理解用户自由文本并给出针对性回应 |
| AI 小步验收机制 | 四类验收结论：基本可以过 / 还差一点 / 不算完成 / 可以勾选完成 |
| 鼓励融入反馈流 | 删除独立"鼓励我一下"按钮 |

V2.6 让 AI 能**听到**用户的真实反馈——草稿内容、卡点原因、时间约束。

### 1.2 V2.6 暴露的新问题：AI 听到了但做不了什么

V2.6 上线后，一个典型场景浮现：

```
用户点击"太难了" → AI 说"确实有难度，我们先做个 3 分钟版本..."
用户输入"我真的做不动了，今天状态不好" → AI 说"没关系，先休息一下..."
用户再次点击"太难了" → AI 说"这个任务我先放一放..."
```

**问题**：AI 每次都在**口头安慰**，但没有**实际行动能力**。AI 不能：

- 把任务标记为明天继续
- 降低任务难度（替换为更简单版本）
- 建议今天只做前 N 个任务
- 给用户一个一键操作来执行调整

用户反复卡住/太难/没时间后，AI 的安慰变成了"反复安慰但无实际行动"——这和 V2.5.3 的"空泛鸡汤"一样令人沮丧。

### 1.3 核心矛盾

```
V2.6 让 AI 能"听到"用户卡住了     →  但 AI 听完只能安慰，不能调整
AI 说"确实太难了"                  →  但任务列表纹丝不动
用户说"今天没时间"                 →  但任务一个没少
AI 理解用户的困境                  →  但没有任何系统层面的调整能力
```

**V2.6 修好了"用户→AI 的输入通道"，但 AI 的输出仍然只到文本为止——不能触及任务系统。**

这就是 V2.7 要解决的核心问题。

### 1.4 V2.7 的核心问题定义

**当用户在当前任务内多次反馈"太难 / 卡住 / 没时间 / 任务太大"后，AI 不应只是安慰，而应能给出任务调整建议。用户确认后，系统执行调整。**

---

## 2. V2.7 核心目标

### 2.1 一句话目标

**让 AI 在检测到用户多次卡住/太难/没时间后，能主动给出减压降级建议，用户一键确认后系统执行调整。**

### 2.2 必须解决

| # | 目标 | 说明 |
|---|------|------|
| 1 | AI 识别用户多次 stuck / too_hard / userFeedback 中的难度信号 | 综合前端 signalStats 计数 + userFeedback 文本语义 |
| 2 | AI 给出调整建议 | 三类调整：降级版 / 明日继续 / 保留但不要求今天完成（暂缓 postponed 属于 V2.7B） |
| 3 | 增加"接受调整 / 不用，继续"交互 | Human-in-the-Loop：用户确认后才调整 |
| 4 | 用户确认后系统执行调整 | 更新 task 对象 → useTaskGroup state → localStorage，完整闭环 |
| 5 | 调整后保持 locked 顺序执行 | 接受调整后的任务标记为 todayResolved（不阻塞后续），downgraded 仍阻塞 |
| 6 | 任务完成权仍在用户手中 | AI 不能自动勾选、自动删除、自动放弃 |

### 2.3 不是目标

| # | 不是目标 | 说明 |
|---|----------|------|
| 1 | 不是 AI 自动管理任务 | AI 只建议，不能自动执行 |
| 2 | 不是全局任务重排 | 不改变任务顺序 |
| 3 | 不是 AI 替用户放弃目标 | 调整是减压降级，不是放弃 |
| 4 | 不是聊天系统 | 调整建议是功能卡片，不是对话轮次 |
| 5 | 不是长期记忆系统 | 调整状态仅限当前任务组，跨天后重新生成 |

---

## 3. V2.7 不做范围

| # | 不做 | 原因 |
|---|------|------|
| 1 | 不自动删除任务 | AI 不能替用户删除 |
| 2 | 不自动勾选任务 | Human-in-the-Loop 不动摇 |
| 3 | 不绕过 locked 顺序执行 | 只有用户点击"接受调整"后当前任务才可被标记为 todayResolved |
| 4 | 不让 AI 替用户决定放弃目标 | AI 不能说"换个目标吧" |
| 5 | 不做任务换顺序 / 重排任务 | 任务顺序始终由生成时确定 |
| 6 | 不做全局聊天 | 产品定位不变 |
| 7 | 不做长期对话记忆 | 任务完成后清空 |
| 8 | 不做消息气泡 UI | 保持当前 AI 输出卡片 + 调整建议卡片 |
| 9 | 不做 V3.0A 的 App Shell / 底部导航 / TodayView | 属于 V3.0A |
| 10 | 不改 Auth | Auth 体系稳定 |
| 11 | 不改历史 / 统计 / 复盘 | V2.7 MVP 不改统计口径 |
| 12 | 不直接写代码 | 架构方案阶段 |

---

## 4. 与 V2.6 / V3.0A 的关系

### 4.1 V2.6 是 V2.7 的硬前置

| V2.7 需求 | 依赖 V2.6 的什么 | 为什么不能跳过 |
|-----------|-----------------|---------------|
| 识别"多次卡住/太难/没时间" | userFeedback 文本语义 | 固定按钮只能表达 4 种状态，userFeedback 里才有"为什么难" |
| AI 基于反馈语义判断调整时机 | AI 对 userFeedback 的理解能力 | V2.6 的 Prompt 用户反馈输入处理规则是基础 |
| 调整建议的上下文 | 当前任务 + stepHistory + userFeedback | V2.6 建立了完整的双向上下文 |
| "接受调整"按钮的交互模式 | "发送给 AI"按钮的 UI 模式 | V2.6 验证了任务卡片内新增交互按钮的可行性 |

**没有 V2.6 的 V2.7 会怎样**：
- 调整触发只能靠按钮计数（点了几次"太难了"）
- 无法区分"真的太难"和"只是有点难"
- 调整建议缺少语义上下文，容易过度反应或反应不足

### 4.2 V2.7 与"生成阶段智能调整"的区别

**这是两个完全不同层面的调整**：

| 维度 | 生成阶段智能调整（已有） | V2.7 执行中调整（新增） |
|------|----------------------|----------------------|
| **时机** | 用户输入目标 → AI 生成任务 **之前** | 用户执行任务 **过程中** |
| **依据** | 历史完成率（跨天统计数据） | 当前 companion 会话内的实时反馈信号 |
| **调整内容** | 任务数量和难度级别（lighter / normal / deeper） | 单个任务状态（降级 / 明日继续 / 保留但不要求今天完成） |
| **触发者** | 系统自动（`adjust-task-strategy.ts`） | AI 检测 + 用户确认 |
| **粒度** | 整个任务组 | 单个任务 |
| **数据来源** | `stats-calculator.ts` 的历史统计 | 当前 companion 会话中的 signalStats |
| **代码位置** | `src/lib/adjust-task-strategy.ts` | V2.7 新增逻辑 |

**关键区别**：生成阶段调整是"开始前根据历史调整"，V2.7 是"执行中根据实时反馈调整"。两者不冲突，各管各的阶段。

### 4.3 V2.7 对 V3.0A 的影响

V2.7 新增的调整建议卡片和任务标记，将成为 V3.0A TodayView 中任务卡片的组成部分：

- V3.0A 的任务卡片需要能展示"降级版""明日继续""保留可见"等调整标记
- V3.0A 的 UI 重组不应把旧版（无调整标记）任务列表搬进 App Shell
- V2.7 完成后，V3.0A 架构方案需要基于调整标记的新 Task 类型设计 TodayView

---

## 5. 当前代码核验结果

> 以下核验基于 2026-07-08 `main` 分支代码（commit `e62d05c`），V2.6 已完成。

### 5.1 types.ts — 核心类型

| 项目 | 位置 | 当前内容 |
|------|------|----------|
| `CompanionUserSignal` | 第 255-261 行 | `"start" \| "done" \| "stuck" \| "too_hard" \| "encourage" \| "user_feedback"` ✅ V2.6 已扩展 |
| `Task` 接口 | 第 9-15 行 | `{ id, title, completed, createdAt, updatedAt }` — 无调整相关字段 |
| `TaskGroup` 接口 | 第 17-23 行 | `{ id, goal, tasks: Task[], createdAt, updatedAt }` |

**核验结论**：
- `CompanionUserSignal` 已含 `"user_feedback"`，V2.7 可直接复用
- `Task` 接口缺少 `adjustment?` 字段，V2.7 需要扩展

### 5.2 useTaskCompanion.ts — 陪伴 Hook

| 项目 | 位置 | 当前内容 |
|------|------|----------|
| `requestCompanion` | 第 86-162 行 | `async (userSignal, userFeedback?)` — 已支持 userFeedback 可选参数 |
| `sendSignal` | 第 168-175 行 | 排除 `"start" \| "user_feedback"` |
| `sendFeedback` | 第 177-188 行 | `async (text: string)` — V2.6 新增 |
| `stepHistory` | 第 69 行 | `string[]` — 只存 AI message，不存用户反馈 |
| 信号统计 | ❌ 无 | 当前不统计 stuck/too_hard 次数 |

**核验结论**：
- Hook 已支持 userFeedback 参数，V2.7 的调整建议可通过现有链路触发
- **缺少前端信号统计机制**——V2.7 需要在 hook 层用 useRef 维护 signalStats

### 5.3 TaskCompanionPanel.tsx — 陪伴面板 UI

| 项目 | 位置 | 当前内容 |
|------|------|----------|
| `SIGNAL_BUTTONS` | 第 35-42 行 | 3 个按钮：done / stuck / too_hard（encourage 已删除） |
| 反馈输入框 | 第 240-264 行 | `<textarea>` + "发送给 AI"按钮 |
| AI 消息区域 | 第 192-232 行 | 白色圆角卡片，展示 AI 文本 |
| `isDone` 状态 | 第 77 行 | `status === "done"`，显示完成提示 |
| Props | 第 22-28 行 | `taskId, taskTitle, goal, sequenceContext?, onClose` |

**核验结论**：
- AI 消息区域目前只展示纯文本——V2.7 需要在此区域内或下方新增调整建议卡片
- 当前没有"接受/拒绝"按钮组——V2.7 需新增
- 当前没有 `onAcceptAdjustment` 回调 prop——V2.7 需新增

### 5.4 TaskItem.tsx — 任务行组件

| 项目 | 位置 | 当前内容 |
|------|------|----------|
| Props 接口 | 第 18-29 行 | task, tasks, taskIndex, executionStatus, onToggle, isAssistOpen, onToggleAssist, isCompanionOpen, onToggleCompanion, goal |
| 任务行样式 | 第 89-93 行 | locked=灰底低透明度, current=indigo 底色, completed=白色 |
| TaskCompanionPanel 渲染 | 第 164-173 行 | 传入 `goal, onClose, sequenceContext, taskId, taskTitle` |

**核验结论**：
- TaskItem 目前不感知调整状态——V2.7 需要新增调整标记的视觉处理
- TaskItem 渲染 TaskCompanionPanel 时没有传递 `onAcceptAdjustment`——V2.7 需新增 prop 转发

### 5.5 TaskList.tsx — 任务列表

| 项目 | 位置 | 当前内容 |
|------|------|----------|
| Props 接口 | 第 10-24 行 | tasks, completedCount, totalCount, isAllCompleted, regenerateError, onToggleTask, onClearTasks, onRegenerate, activeAssistTaskId, activeCompanionTaskId, onToggleAssist, onToggleCompanion, goal |
| 任务渲染 | 第 72-91 行 | `tasks.map(...)` → `getTaskExecutionStatus(index, tasks)` → `<TaskItem>` |

**核验结论**：
- TaskList 是纯列表容器——V2.7 需要新增 `onAcceptAdjustment` prop 并转发给 TaskItem

### 5.6 task-execution.ts — 任务状态判断

| 函数 | 当前位置 | 逻辑 |
|------|----------|------|
| `getCurrentTaskIndex` | 第 10-14 行 | 返回第一个未完成任务的 index |
| `getTaskExecutionStatus` | 第 16-31 行 | 返回 `"completed" \| "current" \| "locked"`，基于 `CompletableTask` 类型（仅 `completed: boolean`） |
| `isTaskLocked` | 第 45-47 行 | 基于 `getTaskExecutionStatus` |
| `shouldCarryOverTaskGroup` | 第 41-43 行 | 有未完成任务 + 不是今天创建的 → 跨天继承 |

**核验结论**：
- 当前 `CompletableTask` 类型只含 `completed: boolean`——需要扩展为可感知 `adjustment`
- `getTaskExecutionStatus` 需要判断 todayResolved 任务（tomorrow/keep_visible）并返回 `"resolved_today"` 状态
- `downgraded` 任务仍是活跃任务（不是 todayResolved），正常参与 locked 逻辑
- 这是 V2.7 最关键的逻辑变更

### 5.7 task-companion/route.ts — API Route

| 项目 | 位置 | 当前内容 |
|------|------|----------|
| `VALID_USER_SIGNALS` | 第 19-26 行 | 6 个值，含 `"user_feedback"` |
| `CompanionRequestBody` | 第 48-60 行 | 含 `userFeedback?: unknown` |
| `normalizeUserFeedback` | 第 164-172 行 | 截断 300 字 |
| `buildCompanionUserPrompt` 调用 | 第 225-239 行 | 传入 userFeedback |
| 信号统计 | ❌ 无 | 不接收/传递 signalStats |

**核验结论**：
- Route 层当前不接收 signalStats——V2.7 需要新增 `signalStats?: unknown` 字段 + normalize + 传入 Prompt
- 已有 rate-limit map（第 75 行）是请求频率限制，不是信号频率统计——两者不同

### 5.8 task-companion.ts (prompt) — 陪伴 Prompt

| 项目 | 位置 | 当前内容 |
|------|------|----------|
| 安全红线 | 第 5-11 行 | 6 条 |
| 用户反馈处理 | 第 53-59 行 | 6 个信号的处理规则 |
| 用户反馈输入处理 | 第 61-67 行 | 5 条规则（V2.6 新增） |
| AI 验收规则 | 第 69-80 行 | 4 类结论 + 5 条边界（V2.6 新增） |
| `buildCompanionUserPrompt` | 第 158-192 行 | 拼接逻辑，不含 signalStats |

**核验结论**：
- Prompt 已具备用户反馈理解和验收能力——V2.7 需要在此基础上新增"调整触发与建议"规则
- `buildCompanionUserPrompt` 需要新增 signalStats 行

### 5.9 task-companion-parser.ts — 陪伴输出解析

| 项目 | 位置 | 当前内容 |
|------|------|----------|
| `parseCompanionAIResponse` | 第 13-48 行 | 返回 `CompanionStep { companionState, message }` |
| `DONE_MARKER_PATTERN` | 第 11 行 | 检测 `[DONE]` 标记 |
| 输出清理 | 第 20-34 行 | 去除 markdown/codeblock/markup |

**核验结论**：
- 当前只解析 `[DONE]` 标记——V2.7 需要新增 `[ADJUST]...[/ADJUST]` 解析
- 返回类型 `CompanionStep` 需要扩展——新增可选 `adjustmentSuggestion` 字段
- **这是 [ADJUST] 的唯一解析入口**——避免 UI 层重复解析、截断风险

### 5.10 task-group/save/route.ts — 保存 API

| 项目 | 位置 | 当前内容 |
|------|------|----------|
| `isValidTask` | 第 54-67 行 | 验证 `{ id, title, completed, createdAt, updatedAt }` — **只检查必填字段存在，不拒绝多余字段** |
| 任务保存映射 | 第 179-206 行 | delete-all + insert-all；DB 映射只取 `id, task_group_id, title, completed, completed_at, created_at, updated_at` |

**核验结论**：
- `isValidTask` 使用 `typeof value.xxx === "type"` 检查——**不会因为 task 多了 `adjustment` 属性而拒绝**。已验证：`adjustment` 是可选多余字段，不在必填检查列表中
- DB insert（第 181-197 行）只映射 7 个列——`adjustment` 自然被丢弃，不需要显式 strip
- **结论：save route 不需要任何代码修改**

### 5.11 task-group/load/route.ts — 加载 API

| 项目 | 位置 | 当前内容 |
|------|------|----------|
| Task 映射 | 第 104-110 行 | `{ id, title, completed, createdAt, updatedAt }` — 严格映射，不含 `adjustment` |

**核验结论**：
- 加载时不返回 adjustment 字段——V2.7 的 adjustment 从 localStorage 恢复
- **结论：load route 不需要修改**

### 5.12 useTaskGroup.ts — 核心状态 Hook

| 项目 | 位置 | 当前内容 |
|------|------|----------|
| `handleToggleTask` | 第 404-436 行 | 修改 task.completed → setTaskGroup → saveCurrentTaskGroup → saveTaskGroupToCloud |
| `saveCurrentTaskGroup` | 第 277-279 行 | 包装 `saveTaskGroup(taskGroupToSave, scope)` |
| `saveTaskGroupToCloud` | 第 41-55 行 | POST 到 `/api/task-group/save` |
| 无 `applyTaskAdjustment` | ❌ | 当前没有任务调整方法 |

**核验结论**：
- `handleToggleTask` 的模式（setTaskGroup → saveLocal → saveCloud）是 V2.7 `applyTaskAdjustment` 的参考模板
- V2.7 需要新增 `applyTaskAdjustment(taskId, adjustment)` 方法，复用同一模式

---

## 6. 用户反馈信号来源

### 6.1 信号类型

V2.7 的调整触发不依赖单一信号，而是综合以下三个来源：

| 来源 | 信号 | 说明 |
|------|------|------|
| **固定按钮** | `stuck` | 用户点击"我卡住了" |
| **固定按钮** | `too_hard` | 用户点击"太难了" |
| **反馈输入框** | `user_feedback` | 用户输入自然语言："太大了""做不动了""今天没时间""能不能少做点" |
| **AI 验收** | AI 多次给出"不算完成"或"还差一点" | 同一任务内 AI 验收连续不通过 |

### 6.2 为什么不能只用按钮计数

| 场景 | 按钮计数的问题 | userFeedback 的优势 |
|------|--------------|-------------------|
| 用户点 1 次"太难了" | 是真的太难，还是只是想吐槽？ | userFeedback 文本："这个 SQL 语句太复杂了"→ 是具体难度 |
| 用户连续点 3 次"太难了" | 确实太难 | userFeedback 可能提供更多上下文 |
| 用户点 2 次"stuck" | 是真的卡住，还是想放弃？ | userFeedback 文本："我不确定方向对不对"→ 是需要指导，不是需要调整 |

**结论**：signalStats 提供**定量信号**（频率），userFeedback 文本提供**定性信号**（原因）。两者结合传给 Prompt 才能准确判断调整时机。

### 6.3 信号捕获位置（推荐方案：前端 useRef）

```
TaskCompanionPanel
  ├── 按钮点击 → sendSignal("stuck" / "too_hard")
  └── 文本提交 → sendFeedback(text)
       ↓
useTaskCompanion
  ├── 【V2.7 新增】signalStatsRef = useRef({ stuck: 0, too_hard: 0, hasDifficultyFeedback: false })
  ├── 每次 requestCompanion 前更新 signalStats
  └── 将 signalStats 作为可选字段传给 API
       ↓
task-companion/route.ts
  ├── 接收 signalStats → normalize（只做校验和截断）
  └── 传入 buildCompanionUserPrompt(...)
       ↓
task-companion.ts (Prompt)
  ├── buildCompanionUserPrompt 新增 signalStats 行
  └── AI 基于 signalStats + userFeedback 判断是否输出调整建议
```

### 6.4 为什么前端 useRef 而不是 Route 层内存计数

| 维度 | 前端 useRef | Route 层 (Map) |
|------|-----------|---------------|
| **生命周期** | 与 companion 会话一致（exitCompanion 重置） | Serverless 函数实例可能随时被回收 |
| **可靠性** | 确定——浏览器 tab 内稳定 | 不可靠——Serverless cold start 丢失计数 |
| **per-task 隔离** | 天然（每个 companion 实例绑定一个 taskId） | 需要额外 key 设计（userId+taskId） |
| **并发** | 无并发问题（单用户单 tab） | 潜在 race condition |
| **复杂度** | 极低——一个 useRef<{ stuck, too_hard, hasDifficultyFeedback }> | 需要 Map + 过期清理 + 内存泄漏风险 |

**结论**：前端 useRef 是主方案。Route 层计数不作为主要方案——仅作为备选提及，且需标注 Serverless 不可靠。

---

## 7. 调整触发条件设计

### 7.1 触发机制选择：Prompt 判断 > 硬编码阈值

**不推荐硬编码阈值**（如"同一任务内 stuck 2 次即触发"），理由：

| 硬编码阈值的问题 | Prompt 判断的优势 |
|----------------|------------------|
| 无法区分"真的太难"和"只是需要指导" | AI 可基于 userFeedback 文本理解真实原因 |
| 阈值一刀切——不同任务类型难度不同 | AI 可基于任务标题理解任务性质 |
| 用户可能快速连点按钮（误操作） | AI 可判断是否为有效信号 |
| 需要维护阈值常量，后续调整需改代码 | Prompt 调整只需改文本 |

**推荐**：以 Prompt 判断为主，辅以前端 signalStats（传给 Prompt 作为上下文）。

### 7.2 传给 Prompt 的信号统计信息

在 `buildCompanionUserPrompt` 中新增信号统计行：

```
当前任务陪伴信号统计：
- 本轮陪伴中 stuck 次数：2
- 本轮陪伴中 too_hard 次数：1
- 用户通过反馈框表达过难度相关：是
```

`signalStats` 在每次 `requestCompanion` 调用时作为可选字段发送到 API。API 只做 normalize（校验类型 + 截断），不做计数逻辑。

### 7.3 Prompt 中的调整触发规则

在 COMPANION_SYSTEM_PROMPT 中新增分节：

```
═══ 任务调整触发规则 ═══
当你在当前任务的陪伴过程中检测到以下模式时，应考虑主动给出调整建议：

触发条件（满足任一即可）：
1. 同一任务内 stuck ≥ 2 次 + 最近一次 stuck 后 AI 给了更小动作但仍无法推进
2. 同一任务内 too_hard ≥ 2 次 + AI 已给出降级方案但用户仍反馈太难
3. 用户通过反馈框明确表达时间/精力/难度约束：
   - "今天没时间" / "只有 X 分钟"
   - "太大了" / "做不完" / "太多了"
   - "能不能少做点" / "能明天做吗"
4. AI 验收连续 2 次给出"不算完成"或"还差一点"，且用户未提交新的实质进展

不触发调整的情况：
- 用户只是表达情绪但仍在推进（"好难啊但我试试"）→ 给鼓励 + 更小动作
- 用户第一次 stuck/too_hard → 正常给材料/降级方案
- 用户输入了具体卡点且 AI 能帮解决 → 先帮解决，不急着建议调整
```

### 7.4 调整建议的输出时机

```
AI 正常推进任务的流程：
  step 1 → 用户反馈 → step 2 → 用户反馈 → step 3 → ...

调整建议插入的时机：
  检测到触发条件 → 在当前步骤末尾或下一步开头附加调整建议

AI 的输出格式（扩展）：
  正常步骤文本（如常）
  
  ─── 调整建议 ───
  建议类型：降级版 / 明日继续 / 保留但不要求今天完成
  具体建议文本（一句话）
  [ADJUST] 标记
```

**关键设计**：调整建议是附加在正常 AI 输出中的，不打断推进流程。AI 先正常回应（如常给更小动作），然后附加调整建议。

---

## 8. 调整建议类型设计

### 8.1 三类调整（V2.7A MVP）

| 类型 | 含义 | todayResolved? | 系统行为 | 示例建议文本 |
|------|------|:---:|----------|------------|
| **降级版** (`downgraded`) | 把当前任务替换为更简单版本 | **否** — 仍是活跃任务，仍阻塞后续 | 更新 task.title，保留 originalTitle | "这个任务可以降级为：只写项目名称和你的角色，不需要完整描述。" |
| **明日继续** (`tomorrow`) | 标记今天不做，明天跨天自动继承（adjustment 清理后作为普通未完成任务） | **是** — 今天不再阻塞后续 | 利用现有 carryover 机制，跨天自动带入；跨天后清除 adjustment | "这个任务今天做不完也没关系。明天会自动带过来，届时作为普通任务重新开始。" |
| **保留但不要求今天完成** (`keep_visible`) | 保留可见但没有完成压力 | **是** — 今天不再阻塞后续 | 视觉灰化，保留在列表中作为提醒；跨天后清除 adjustment | "这个任务不需要今天完成。保留在列表里作为提醒，但不用有压力。" |

> **V2.7B 后置**：`postponed`（暂缓 / 本周暂缓）因语义更复杂（需要区分"今天暂缓"和"本周暂缓"），放到 V2.7B 实现。详见第 17.2 节。

### 8.2 todayResolved 概念

V2.7 引入 `todayResolved` 概念来区分"已完成"和"今天不做了"：

```
completed = true          → 用户手动勾选了 checkbox（真正的完成）
todayResolved = true       → 用户接受调整，标记今天不再处理（不是完成，只是不阻塞）
                            - tomorrow / keep_visible → todayResolved = true
                            - downgraded → todayResolved = false（仍是活跃任务）
```

**核心规则**：

| 规则 | 说明 |
|------|------|
| todayResolved 不是 completed | completed 永远只由用户手动勾选 checkbox 改变 |
| todayResolved 只影响 locked 阻塞 | 在 `getTaskExecutionStatus` 中返回 `"resolved_today"` 状态 |
| downgraded 仍是 current | 降级只是在同一任务内降低难度，任务仍需完成，仍阻塞后续 |
| 只能通过"接受调整"触发 | 没有任何其他入口可以标记 todayResolved |
| 不绕过 locked 顺序 | 任务 1 是 downgraded → 仍是 current → 任务 2 仍是 locked。只有 tomorrow/keep_visible 才释放后续 |

### 8.3 调整类型选择逻辑（Prompt 层）

```
- 用户说"今天没时间" → 建议"明日继续"当前任务（tomorrow）
- 用户说"这个太大了" → 建议"降级版"当前任务（downgraded）
- 用户连续 stuck/too_hard → 先建议"降级版"，如果仍不行 → 建议"明日继续"（tomorrow）
- 用户说"今天真的做不动了" → 建议当前任务"明日继续"（tomorrow）
```

**V2.7A 范围约束**：只调整当前任务，不做批量调整。"剩余任务 keep_visible""前 N 个正常，N+1 后暂缓"等批量调整属于 V2.7B 或后续版本。

### 8.4 调整建议的数据结构

```typescript
// ═══ types.ts 新增 ═══

// 1. Parser 层输出：AI 给用户的调整建议（从 [ADJUST] 解析出来）
interface TaskAdjustmentSuggestion {
  type: "downgraded" | "tomorrow" | "keep_visible";
  suggestion: string;           // AI 给出的一句话建议文本（展示在调整卡片中）
  alternativeTitle?: string;    // downgraded 时的替代标题
}

// 2. Props 链输入：用户点击"接受调整"后，流经 Panel → Item → List → Workspace → useTaskGroup
//    字段与 TaskAdjustmentSuggestion 一致，语义上表示"用户已确认，准备执行"
interface ApplyTaskAdjustmentInput {
  type: "downgraded" | "tomorrow" | "keep_visible";
  reason?: string;              // AI 给出的调整原因（即 suggestion 字段，重命名为 reason）
  alternativeTitle?: string;    // downgraded 时的替代标题
}

// 3. 存储层：存入 task.adjustment 的最终结构（由 useTaskGroup.applyTaskAdjustment 内部生成）
interface TaskAdjustment {
  type: "downgraded" | "tomorrow" | "keep_visible";
  originalTitle?: string;        // 降级时保留原标题
  reason?: string;               // AI 给出的调整原因（一句话）
  adjustedAt: string;            // ISO timestamp
}

// Task 接口扩展
interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  adjustment?: TaskAdjustment;   // V2.7 新增：可选调整标记
}

// ═══ 字段闭合规则 ═══
// 
// applyTaskAdjustment(taskId, input: ApplyTaskAdjustmentInput) 内部转换：
//
//   downgraded:
//     task.title = input.alternativeTitle         // 替换为新标题
//     task.adjustment = {
//       type: "downgraded",
//       originalTitle: oldTitle,                 // 保留原标题
//       reason: input.reason,                    // AI 建议文本
//       adjustedAt: new Date().toISOString(),
//     }
//
//   tomorrow / keep_visible:
//     task.title 不变                             // 原标题不动
//     task.adjustment = {
//       type: "tomorrow" | "keep_visible",
//       reason: input.reason,                    // AI 建议文本
//       adjustedAt: new Date().toISOString(),
//     }
```

**设计说明**：
- `todayResolved` 不存为独立字段，由 `isTaskTodayResolved(adjustment)` helper 根据 `adjustment.type` 计算
- `TaskAdjustmentSuggestion`（parser 输出）和 `ApplyTaskAdjustmentInput`（props 链输入）字段等价，语义分层：前者是 AI 建议，后者是用户已确认的执行指令
- `TaskAdjustment`（存储结构）必须由 `applyTaskAdjustment` 内部生成，不在 UI 层手动构造——保证 `originalTitle` 和 `adjustedAt` 一定正确

---

## 9. "接受调整 / 不用继续"交互与数据更新闭环

### 9.1 调整建议卡片 UI

调整建议显示在 AI 消息区域**下方**，作为独立卡片：

```
┌─────────────────────────────────────┐
│  AI 消息区域                         │
│  "这个确实有难度。我们先试一个更小    │
│   的版本——只写项目名称和你的角色。"   │
│                                      │
│  ┌─ 调整建议 ──────────────────────┐ │
│  │ 💡 我注意到这个任务你已经卡了    │ │
│  │ 好几次。要不要把它降级为：       │ │
│  │ "只写项目名称和角色，一句话"？   │ │
│  │                                  │ │
│  │ [接受调整]  [不用，继续]         │ │
│  └──────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 9.2 交互流程

```
AI 输出包含 [ADJUST]...[/ADJUST] 标记的文本
       ↓
task-companion-parser.ts（唯一解析入口）
  ├── 解析出 visibleMessage（不含 [ADJUST] 段落）
  ├── 解析出 companionState
  └── 解析出 adjustmentSuggestion?（含 type, suggestion, alternativeTitle?）
       ↓
CompanionStep 类型扩展 → 包含 adjustmentSuggestion
       ↓
TaskCompanionPanel 接收 currentStep.adjustmentSuggestion
  └── 渲染调整建议卡片 + [接受调整] [不用，继续] 按钮
       ↓
┌──────────────┬──────────────────┐
│ 用户点击      │ 用户点击          │
│ "接受调整"    │ "不用，继续"      │
└──────┬───────┴──────┬───────────┘
       ↓              ↓
  执行调整操作     关闭调整建议卡片
  (见 9.3 完整链路) AI 继续推进当前任务
```

### 9.3 接受调整的完整数据更新闭环

这是 V2.7 最关键的链路——从 UI 到底层状态的完整闭环：

```
TaskCompanionPanel
  └── 用户点击"接受调整"
       ↓
  onAcceptAdjustment(taskId, adjustment)
  （新增 prop，由 TaskItem 传入）
       ↓
TaskItem
  └── 转发 onAcceptAdjustment(taskId, adjustment)
  （新增 prop，由 TaskList 传入）
       ↓
TaskList
  └── 转发 onAcceptAdjustment(taskId, adjustment)
  （新增 prop，由 MainWorkspace 传入）
       ↓
MainWorkspace.handleAcceptAdjustment(taskId, adjustment)
  └── 调用 useTaskGroup.applyTaskAdjustment(taskId, adjustment)
       ↓
useTaskGroup.applyTaskAdjustment(taskId, adjustment)
  ├── 1. setTaskGroup: 遍历 tasks，找到匹配 taskId
  │     - downgraded: task.title = input.alternativeTitle; task.adjustment = { type, originalTitle, reason, adjustedAt }
  │     - tomorrow / keep_visible: task.adjustment = { type, reason, adjustedAt }
  │     - 返回新 taskGroup 对象（不可变更新）
  ├── 2. saveCurrentTaskGroup(updatedTaskGroup) → localStorage
  │     - JSON.stringify 完整 TaskGroup（含 adjustment 字段）
  └── 3. saveTaskGroupToCloud(deviceId, updatedTaskGroup) → API
        - POST /api/task-group/save
        - isValidTask: adjustment 是多余字段，不拒绝 ✅
        - DB insert: 只映射 id, task_group_id, title, completed, ... ✅
        - adjustment 自然被丢弃，数据库不存 ✅
       ↓
React re-render:
  ├── TaskItem 重新渲染 → 显示调整标记（如 "📋 降级版" / "📅 明日继续" / "👁️ 保留可见"）
  └── task-execution 重新计算 → tomorrow/keep_visible 不阻塞后续
```

**为什么需要 TaskList 和 TaskItem 各新增一个 prop**：

当前 props 链是 MainWorkspace → TaskList（onToggleTask）→ TaskItem（onToggle）。这已是既有模式。`onAcceptAdjustment` 走同样的逐层转发路径——TaskList 和 TaskItem 各自只新增一个 prop 声明 + 一行转发代码，改动量极小（各 ~3 行）。

**为什么不直接让 TaskCompanionPanel 调用 useTaskGroup**：
- TaskCompanionPanel 是无状态展示组件，不持有 taskGroup state
- useTaskGroup 在 MainWorkspace 层，TaskCompanionPanel 在 TaskItem 内部——跨层级访问需要 context 或 prop drilling。Prop drilling 改动最小、最可追踪

### 9.4 [ADJUST] 解析：统一在 task-companion-parser.ts

**推荐方案**：修改 `src/lib/task-companion-parser.ts`，作为 [ADJUST] 的唯一解析入口。

**理由**：
- 避免 UI 层重复解析，确保解析逻辑一致
- 避免 [ADJUST] 被截断（MAX_MESSAGE_LENGTH=300 截断前先提取 [ADJUST]）
- 当前 parser 已处理 `[DONE]` 标记——[ADJUST] 是同类扩展，职责一致
- Panel 层只用 `currentStep.adjustmentSuggestion` 渲染，不自己解析文本

**扩展后的 CompanionStep 类型**：

```typescript
// types.ts
interface CompanionStep {
  message: string;                                    // visibleMessage（不含 [ADJUST] 段落）
  companionState: CompanionStatus;                    // "active" | "done"
  adjustmentSuggestion?: TaskAdjustmentSuggestion;    // V2.7 新增
}

// TaskAdjustmentSuggestion 定义见 8.4 节——parser 输出此类型
// type: "downgraded" | "tomorrow" | "keep_visible"（不含 postponed）
```

**parser 解析流程**：

```
parseCompanionAIResponse(rawText):
  1. 检测 [ADJUST]...[/ADJUST] 段落 → 提取 adjustmentSuggestion
  2. 从 rawText 移除 [ADJUST] 段落 → 得到 visibleMessage
  3. 现有清理逻辑（codeblock/markdown/markup 去除）
  4. 检测 [DONE] → companionState
  5. 返回 { message: visibleMessage, companionState, adjustmentSuggestion? }
```

**TaskCompanionPanel 只负责渲染**：
```typescript
// Panel 中不需要自己解析 AI 文本
const adjustmentSuggestion = currentStep?.adjustmentSuggestion;
// 如果有 adjustmentSuggestion，渲染调整建议卡片
// 如果没有，正常渲染 AI 消息
```

### 9.5 "不用，继续"按钮行为（重要：不发送 done 信号）

用户点击"不用，继续"后：

1. **只隐藏当前调整建议卡片**——设置本地 UI 状态 `dismissed = true`，`currentStep.adjustmentSuggestion` 不删除
2. **不调用 `sendSignal("done")`**——不发送任何信号给 AI
3. **不自动请求 AI**——不触发新的 `requestCompanion`
4. **不修改任务**——task 对象不变
5. **记录已拒绝的调整类型**——把当前 `suggestion.type` 加入 `dismissedAdjustmentTypesRef`（见 9.6 节），避免 AI 重复建议同一类型

用户之后可以继续点击 stuck / too_hard / 输入反馈来推进任务。调整建议卡片关闭后，陪伴面板回到正常交互状态。

**为什么不在拒绝后发送 done**：
- `done` 信号表示"用户完成了 AI 给出的步骤"——但用户并没有完成任何步骤，只是拒绝了调整建议
- 发送 `done` 会让 AI 错误地推进到下一步，但实际上当前步骤状态没有变化
- 拒绝调整建议 ≠ 用户完成了当前小步，不应触发 AI 推进

### 9.6 拒绝调整后的去重机制（dismissedAdjustmentTypesRef）

**问题**：如果 AI 反复建议同一类型的调整（如连续 3 次建议"明日继续"），用户每次都要点击"不用，继续"，体验极差。

**方案**：在 `useTaskCompanion` 中新增 `dismissedAdjustmentTypesRef`：

```typescript
// useTaskCompanion.ts V2.7 新增
const dismissedAdjustmentTypesRef = useRef<Set<string>>(new Set());
```

**规则**：

| 时机 | 操作 |
|------|------|
| 用户点击"不用，继续" | `dismissedAdjustmentTypesRef.current.add(suggestion.type)` |
| 每次 `requestCompanion` | 把 `[...dismissedAdjustmentTypesRef.current]` 传给 API 的 `declinedAdjustmentTypes` 字段 |
| `exitCompanion` / `reset` | 清空 `dismissedAdjustmentTypesRef` |

**数据流**：

```
useTaskCompanion
  └── requestCompanion 时传入 declinedAdjustmentTypes: string[]
       ↓
task-companion/route.ts
  └── normalizeDeclinedAdjustmentTypes（校验 + 去重 + 截断）
       ↓
buildCompanionUserPrompt
  └── 新增 declinedAdjustmentTypes 行（如果有值）
       ↓
Prompt 规则（COMPANION_SYSTEM_PROMPT 新增）：
  "用户已拒绝的调整类型：downgraded, tomorrow
   不要再次建议这些类型的调整。"
```

**Prompt 中新增规则**：

```
═══ 调整建议去重 ═══
如果用户消息中包含"用户已拒绝的调整类型"，则本轮不应再建议这些类型的调整。
例如：用户已拒绝"明日继续"→ 本轮不应再建议 tomorrow，但仍可建议 downgraded 或 keep_visible。
```

**边界情况**：
- 如果用户拒绝了所有 3 种类型（downgraded + tomorrow + keep_visible），Prompt 规则："所有调整类型均已被拒绝，本轮不再建议任何调整"
- `declinedAdjustmentTypes` 只在当前 companion 会话内有效——`exitCompanion` 时随 ref 一起清除
- 即使 `declinedAdjustmentTypes` 包含某类型，如果新的 userFeedback 提供了明确的调整需求（如用户明确说"帮我降级"），AI 仍可输出该类型——这是用户主动要求，不是 AI 反复建议

---

## 10. 任务状态与数据模型方案

### 10.1 核心问题：adjustment 是否需要持久化到数据库？

**分析现有数据流**：

```
用户操作 → useTaskGroup (state)
              ↓
         saveCurrentTaskGroup() → localStorage（JSON.stringify 完整 TaskGroup，含 adjustment）
              ↓
         saveTaskGroupToCloud() → POST /api/task-group/save → Supabase
              ↓
         DB insert 只映射 7 列，adjustment 自然被丢弃
```

### 10.2 策略：API 自然忽略 adjustment（已验证，零代码改动）

**经代码核验确认**：

| 检查点 | 代码位置 | 行为 | 是否需要改 |
|--------|----------|------|:---:|
| `isValidTask` | save/route.ts:54-67 | 只检查 5 个必填字段类型（`typeof value.xxx === "..."`），**不拒绝多余字段** | ❌ 不改 |
| DB insert 映射 | save/route.ts:181-197 | 7 个列：`id, task_group_id, title, completed, completed_at, created_at, updated_at`——`adjustment` 不在映射中，自然丢弃 | ❌ 不改 |
| `load/route.ts` Task 映射 | load/route.ts:104-110 | 返回 `{ id, title, completed, createdAt, updatedAt }`——不含 `adjustment` | ❌ 不改 |

**结论**：前端发送含 `adjustment` 的 Task 对象到 save API → `isValidTask` 通过 → DB insert 忽略 adjustment → 云端不存 adjustment。load 时也不返回 adjustment → 前端从 localStorage 恢复。**save 和 load route 都不需要任何代码修改。**

### 10.3 为什么不改数据库

1. **adjustment 是会话级状态**：调整建议基于"今天的执行过程"，跨天恢复后上下文已消失，保留 adjustment 标记也没有实际意义
2. **云端恢复场景极少**：用户 99% 的情况是从 localStorage 恢复，云端只是备份
3. **最坏情况可接受**：换设备/清缓存后恢复任务组，任务显示为原始版本（无调整标记）——用户可以重新开始陪伴，AI 会基于新的反馈重新判断
4. **不改数据库**：符合项目当前阶段的强烈偏好

### 10.4 对 task-execution.ts 的影响

**为什么必须改 task-execution.ts**：

当前 `CompletableTask` 只含 `completed: boolean`。`getTaskExecutionStatus` 只基于 `completed` 判断——返回 `"completed" | "current" | "locked"` 三态。如果 V2.7 允许用户把任务标记为"明日继续"或"保留但不要求今天完成"，这些任务不应继续阻塞后面的任务，但也需要与真正的 `completed` / `locked` 区分开。

**不改的后果**：用户接受"明日继续"调整后，下一个任务仍然 locked——用户无法继续。这直接破坏了 V2.7 的核心价值。

**修改方案**：

```typescript
// ═══ 1. 扩展 TaskExecutionStatus 类型 ═══
// 从三态 → 四态，新增 resolved_today
export type TaskExecutionStatus =
  | "completed"       // 用户手动勾选了 checkbox
  | "current"         // 当前可执行的任务
  | "locked"          // 尚未解锁（被前面任务阻塞）
  | "resolved_today"; // V2.7 新增：用户接受调整，今天不再要求（不阻塞，但不是 completed）

// ═══ 2. 扩展 CompletableTask 类型 ═══
type CompletableTask = {
  completed: boolean;
  adjustment?: TaskAdjustment;  // V2.7 新增
};

// ═══ 3. 新增 helper ═══
function isTaskTodayResolved(adjustment?: TaskAdjustment): boolean {
  if (!adjustment) return false;
  return adjustment.type === "tomorrow"
    || adjustment.type === "keep_visible";
  // 注意：downgraded 不属于 todayResolved
}

// ═══ 4. 更新 getCurrentTaskIndex ═══
// 找到第一个既未 completed 也非 todayResolved 的任务
function getCurrentTaskIndex(tasks: CompletableTask[]): number {
  return tasks.findIndex(
    t => !t.completed && !isTaskTodayResolved(t.adjustment)
  );
}

// ═══ 5. 重写 getTaskExecutionStatus ═══
export function getTaskExecutionStatus(
  taskIndex: number,
  tasks: CompletableTask[],
): TaskExecutionStatus {
  const task = tasks[taskIndex];
  if (!task) return "locked";

  // 优先级 1: completed
  if (task.completed) return "completed";

  // 优先级 2: todayResolved（V2.7 新增）
  if (isTaskTodayResolved(task.adjustment)) return "resolved_today";

  // 优先级 3: current（第一个 active 任务）
  const currentIndex = getCurrentTaskIndex(tasks);
  if (taskIndex === currentIndex) return "current";

  // 优先级 4: locked
  return "locked";
}
```

**四态判断优先级**：

```
completed = true                    → "completed"
!completed && isTaskTodayResolved   → "resolved_today"
!completed && !todayResolved && 是第一个 active 任务 → "current"
!completed && !todayResolved && 前面有 active 任务   → "locked"
```

**TaskItem 渲染规则**：

| executionStatus | 视觉 | 可勾选 | AI 陪伴/AI 辅助入口 |
|:---|------|:---:|:---:|
| `"completed"` | 删除线灰色 | 可取消勾选 | 不显示 |
| `"current"` | indigo 底色高亮 | 可勾选 | 显示 |
| `"locked"` | 灰底低透明度 | 不可操作 | 不显示 |
| `"resolved_today"` | 灰底 + 调整标记（如 "📅 明日继续"/"👁️ 保留可见"） | 可勾选 | 不显示 |

**关键点**：
- `downgraded` → `isTaskTodayResolved` 返回 `false` → 仍是活跃任务，正常参与 locked 链，状态为 `"current"`
- `tomorrow` / `keep_visible` → `isTaskTodayResolved` 返回 `true` → 状态为 `"resolved_today"`，不阻塞后续
- `"resolved_today"` 任务仍然可以手动勾选完成（用户改变主意），勾选后 `completed = true` → 状态变为 `"completed"`
- **优先级顺序不变**：completed > todayResolved > active(current/locked)

### 10.5 跨天 carryover + adjustment 交互（重要修正）

**问题**：如果 carryover 时保留 adjustment，tomorrow 任务跨天后仍被 `isTaskTodayResolved` 跳过，永远不会成为 current——这破坏了 carryover 的初衷。

**修正方案**：跨天恢复时，清除"今天已解除"的 adjustment，让任务回归为普通未完成任务。

```typescript
// task-execution.ts 或 useTaskGroup.ts 新增

/**
 * 跨天恢复任务组时调用：清除只属于"今天"的 adjustment 标记
 * - tomorrow / keep_visible → 清除 adjustment（任务回归普通未完成状态）
 * - downgraded → 保留 adjustment（降级是持久修改，标题已变，跨天后仍有效）
 */
function clearTodayResolvedAdjustmentsForNewDay(taskGroup: TaskGroup): TaskGroup {
  return {
    ...taskGroup,
    tasks: taskGroup.tasks.map(task => {
      if (!task.adjustment) return task;
      if (task.adjustment.type === "downgraded") return task; // 保留降级
      // tomorrow / keep_visible: 清除 adjustment
      const { adjustment, ...rest } = task;
      return rest as Task;
    }),
  };
}
```

**各 adjustment type 的 carryover 规则**：

| adjustment type | carryover 时行为 | 理由 |
|:---|------|------|
| `downgraded` | **保留** adjustment + 保留修改后的 title | 降级是对任务难度本身的判断，跨天仍有效；originalTitle 保留以便恢复 |
| `tomorrow` | **清除** adjustment，任务变为普通未完成任务 | "明天继续"的语义就是"今天不做，明天作为普通任务重新开始"。如果不清除，明天还会跳过 |
| `keep_visible` | **清除** adjustment，任务变为普通未完成任务 | "保留但不要求今天完成"只对今天有效。跨天后重新评估 |

**调用时机**：`shouldCarryOverTaskGroup` 返回 `true` 且用户确认恢复时，在 `useTaskGroup` 的恢复逻辑中调用 `clearTodayResolvedAdjustmentsForNewDay`。

**Prompt 感知**：跨天恢复后的 start 信号中，downgraded 任务因保留 adjustment，Prompt 应轻量提及："这个任务昨天被降级了，现在还是按降级后的版本来做。"

---

## 11. 技术方案对比

### 方案 A：只用 Prompt 建议，不改任务数据

**思路**：AI 在输出文本中建议调整，但系统不保存任何调整状态。用户看到建议后自己决定要不要做。

| 维度 | 评价 |
|------|------|
| 用户体验 | 🔴 差——用户点击"接受调整"后什么都没发生 |
| 产品完整性 | 🔴 差——只做了一半（建议了但不能执行） |
| **结论** | **不推荐**——半成品体验 |

### 方案 B（修正版）：前端会话状态 + localStorage + Prompt 驱动 + parser 解析 + useTaskGroup 更新链路，不改数据库

**思路**：
- `Task` 类型新增可选 `adjustment?: TaskAdjustment`
- 前端 useTaskCompanion 用 useRef 维护 signalStats，传给 API
- Prompt 基于 signalStats + userFeedback 判断触发条件并输出 `[ADJUST]...[/ADJUST]`
- `task-companion-parser.ts` 统一解析 [ADJUST]，输出 `adjustmentSuggestion`
- TaskCompanionPanel 渲染调整建议卡片
- 用户点击"接受调整"→ 逐层回调 → useTaskGroup.applyTaskAdjustment → setTaskGroup → localStorage
- `task-execution.ts` 扩展以感知 todayResolved
- Supabase 同步时 adjustment 自然被 DB insert 映射忽略（零代码改动）
- 数据库不改

| 维度 | 评价 |
|------|------|
| 改 types.ts | ✅ 新增 TaskAdjustment + TaskAdjustmentSuggestion + ApplyTaskAdjustmentInput + Task.adjustment? + CompanionStep.adjustmentSuggestion? |
| 改 task-companion-parser.ts | ✅ 解析 [ADJUST] 标记，输出 adjustmentSuggestion |
| 改 TaskCompanionPanel | ✅ 渲染调整建议卡片 + 接受/拒绝按钮 + onAcceptAdjustment prop + dismissed 本地状态 |
| 改 TaskItem | ✅ 新增 onAcceptAdjustment prop 转发 + 调整标记视觉（downgraded / tomorrow / keep_visible + resolved_today） |
| 改 TaskList | ✅ 新增 onAcceptAdjustment prop 转发 |
| 改 useTaskCompanion | ✅ signalStats useRef + dismissedAdjustmentTypesRef + acceptAdjustment / declineAdjustment |
| 改 useTaskGroup | ✅ applyTaskAdjustment 方法 + clearTodayResolvedAdjustmentsForNewDay helper |
| 改 task-companion/route | ✅ 接收 + normalize signalStats 和 declinedAdjustmentTypes，传入 Prompt |
| 改 task-companion.ts (prompt) | ✅ 调整触发规则 + [ADJUST] 格式 + signalStats 行 + declinedAdjustmentTypes 行 + 去重规则 |
| 改 task-execution | ✅ TaskExecutionStatus 扩展为四态（含 resolved_today） + isTaskTodayResolved helper + getCurrentTaskIndex 跳过 todayResolved + clearTodayResolvedAdjustmentsForNewDay |
| 改 save/load API | ❌ 已验证：零改动 |
| 改数据库 | ❌ 零 schema 变更 |
| "接受调整"能力 | 🟢 强——完整闭环：AI 建议 → 用户确认 → 系统执行 → 状态持久化 |
| 持久化 | 🟡 中——localStorage 持久化，云端自然忽略 adjustment |
| 风险 | 🟡 中——task-execution 改动需仔细测试 locked 逻辑 |
| **结论** | **✅ 推荐**——最小改动实现完整闭环，风险可控 |

### 方案 C：扩展数据库 + 完整持久化

**思路**：
- `tasks` 表新增 `adjustment` JSONB 列
- `save/load` API 完整支持 adjustment 字段
- Database migration 新增列

| 维度 | 评价 |
|------|------|
| 改数据库 | 🔴 新增 migration |
| 风险 | 🔴 高——DB migration + API 改动面大 |
| **结论** | **不推荐当前阶段**——收益（跨设备持久化）与成本（DB migration + API 改动 + 更多回归风险）不成比例 |

### 方案对比总结

| 维度 | 方案 A | 方案 B 修正版 ✅ | 方案 C |
|------|:--:|:--:|:--:|
| 改 types.ts | ❌ | ✅ | ✅ |
| 改 parser | ❌ | ✅ | ✅ |
| 改 UI (Panel + Item + List) | ✅ 半 | ✅ 3 文件 | ✅ 3 文件 |
| 改 Hook (Companion + TaskGroup) | ❌ | ✅ 2 文件 | ✅ 2 文件 |
| 改 API Route | ❌ | ✅ (companion only) | ✅ (companion + save/load) |
| 改 Prompt | ✅ | ✅ | ✅ |
| 改 task-execution | ❌ | ✅ | ✅ |
| 改 save/load API | ❌ | ❌ | ✅ |
| 改数据库 | ❌ | ❌ | 🔴 |
| **总修改文件数** | ~2 | **~10** | ~12 |
| 用户体验 | 🔴 半成品 | 🟢 完整闭环 | 🟢 完整闭环 |
| 风险等级 | 🟢 低 | 🟡 中 | 🔴 高 |
| **推荐** | ❌ | **✅ 推荐** | ❌ |

---

## 12. 推荐方案：方案 B 修正版

### 12.1 核心思路

在现有 task-companion 链路 + V2.6 userFeedback 通道基础上，新增：
1. **Prompt 层**：调整触发规则 + `[ADJUST]` 输出格式 + declinedAdjustmentTypes 去重规则
2. **前端层**：useTaskCompanion 维护 signalStats（useRef）+ dismissedAdjustmentTypesRef → 传给 API
3. **Parser 层**：task-companion-parser.ts 统一解析 `[ADJUST]`，输出 adjustmentSuggestion
4. **UI 层**：TaskCompanionPanel 渲染调整建议卡片 + 接受/拒绝按钮；TaskItem 显示四态调整标记（含 resolved_today 新状态）
5. **数据层**：Task 类型扩展 `adjustment` 字段；`ApplyTaskAdjustmentInput` 流经 Props 链；useTaskGroup.applyTaskAdjustment 内部生成 `TaskAdjustment` → setTaskGroup → localStorage
6. **执行层**：task-execution 扩展 `TaskExecutionStatus` 四态（含 `resolved_today`）+ `isTaskTodayResolved` helper + `clearTodayResolvedAdjustmentsForNewDay`
7. **Props 链路**：TaskCompanionPanel → TaskItem → TaskList → MainWorkspace → useTaskGroup（完整上行回调链）
8. **去重机制**：`dismissedAdjustmentTypesRef` 记录用户已拒绝的调整类型，传给 Prompt 避免反复建议

**不改数据库、不改 save/load API、不改 Auth、不改历史/统计/复盘。**

### 12.2 为什么方案 B 修正版是最优选择

| # | 理由 |
|---|------|
| 1 | **完整闭环**：AI 建议 → 用户确认 → useTaskGroup 更新状态 → localStorage 持久化——四步闭合 |
| 2 | **改动面可控**：~10 个文件，集中在陪伴链路 + 状态管理 + task-execution |
| 3 | **不改数据库**：代码核验已确认 save/load route 自然忽略 adjustment，零改动 |
| 4 | **可降级**：最坏情况（localStorage 丢失）只是 adjustment 标记丢失，任务本身不受影响 |
| 5 | **利用现有机制**：carryover（明日继续）、locked（todayResolved 不阻塞）、task title（降级替换）——都是已有概念的自然扩展 |
| 6 | **不影响生成阶段智能调整**：V2.7 是执行中调整，与 `adjust-task-strategy.ts` 互不干扰 |
| 7 | **Parser 统一解析**：避免 UI 层重复解析逻辑，[ADJUST] 截断风险集中在 parser 处理 |
| 8 | **前端 signalStats**：避免 Serverless 内存不可靠问题，生命周期与 companion 会话一致 |

### 12.3 方案 B 修正版的数据流

```
用户多次 stuck/too_hard/user_feedback
       ↓
useTaskCompanion
  ├── signalStatsRef: { stuck: N, too_hard: N, hasDifficultyFeedback: bool }
  └── 每次 requestCompanion 把 signalStats 作为可选字段传给 API
       ↓
task-companion/route.ts
  ├── normalize signalStats（校验 + 截断）
  └── 传入 buildCompanionUserPrompt(...)
       ↓
AI（Prompt）检测触发条件 → 输出 [ADJUST]...[/ADJUST]
       ↓
task-companion-parser.ts（唯一解析入口）
  ├── 提取 adjustmentSuggestion
  ├── 从 rawText 移除 [ADJUST] 段落 → visibleMessage
  └── 返回 CompanionStep { message, companionState, adjustmentSuggestion? }
       ↓
TaskCompanionPanel
  └── currentStep.adjustmentSuggestion? → 渲染调整建议卡片 + [接受调整] [不用，继续]
       ↓
用户点击"接受调整"
       ↓
TaskCompanionPanel.onAcceptAdjustment(taskId, adjustment)
       ↓
TaskItem.onAcceptAdjustment(taskId, adjustment)       ← 新增 prop，转发
       ↓
TaskList.onAcceptAdjustment(taskId, adjustment)       ← 新增 prop，转发
       ↓
MainWorkspace.handleAcceptAdjustment(taskId, adjustment)
       ↓
useTaskGroup.applyTaskAdjustment(taskId, adjustment)  ← 新方法
  ├── setTaskGroup → 更新 task 对象（title/adjustment）
  ├── saveCurrentTaskGroup → localStorage（完整 TaskGroup 含 adjustment）
  └── saveTaskGroupToCloud → API（adjustment 被 DB insert 自然忽略）
       ↓
React re-render:
  ├── TaskItem → 显示调整标记视觉
  └── task-execution → todayResolved 任务不阻塞后续
```

---

## 13. 预计文件影响范围

### 13.1 建议修改文件

| # | 文件 | 修改内容 | 改动量 | 风险 |
|:--:|------|------|:--:|:--:|
| 1 | `src/lib/types.ts` | 新增 `TaskAdjustment` + `TaskAdjustmentSuggestion` + `ApplyTaskAdjustmentInput` + `Task.adjustment?` + `CompanionStep.adjustmentSuggestion?`；`TaskExecutionStatus` 扩展为四态（含 `"resolved_today"`） | ~+20 行 | 低 |
| 2 | `src/prompts/task-companion.ts` | COMPANION_SYSTEM_PROMPT 新增"任务调整触发规则"分节 + [ADJUST] 输出格式 + 调整建议去重规则；`buildCompanionUserPrompt` 新增 signalStats 行 + declinedAdjustmentTypes 行；`CompanionPromptInput` 新增 `signalStats?` + `declinedAdjustmentTypes?` | ~+55 行 ~改 5 行 | 中 |
| 3 | `src/app/api/task-companion/route.ts` | `CompanionRequestBody` 新增 `signalStats?: unknown` + `declinedAdjustmentTypes?: unknown`；新增 `normalizeSignalStats` + `normalizeDeclinedAdjustmentTypes`；传入 `buildCompanionUserPrompt` | ~+20 行 | 低 |
| 4 | `src/hooks/useTaskCompanion.ts` | 新增 `signalStatsRef`（useRef）+ `dismissedAdjustmentTypesRef`（useRef）；每次 requestCompanion 传入 signalStats + declinedAdjustmentTypes；新增 `acceptAdjustment` / `declineAdjustment` 回调；返回类型扩展 | ~+35 行 | 中 |
| 5 | `src/components/TaskCompanionPanel.tsx` | Props 新增 `onAcceptAdjustment`；渲染调整建议卡片（基于 `currentStep.adjustmentSuggestion`）；接受/拒绝按钮；dismissed 本地 UI 状态 | ~+55 行 | 中 |
| 6 | `src/lib/task-companion-parser.ts` | 新增 `parseAdjustmentSuggestion` 内部函数；`parseCompanionAIResponse` 返回类型扩展为含 `adjustmentSuggestion?`；提取 [ADJUST] 段落后再截断 message | ~+25 行 ~改 5 行 | 中 |
| 7 | `src/lib/task-execution.ts` | `TaskExecutionStatus` 扩展为四态（含 `"resolved_today"`）；新增 `isTaskTodayResolved` helper；`CompletableTask` 扩展为含 `adjustment?`；重写 `getTaskExecutionStatus`；更新 `getCurrentTaskIndex`；新增 `clearTodayResolvedAdjustmentsForNewDay` | ~+40 行 ~改 20 行 | **高** |
| 8 | `src/hooks/useTaskGroup.ts` | 新增 `applyTaskAdjustment(taskId, input)` 方法（接收 ApplyTaskAdjustmentInput → 内部生成 TaskAdjustment）；新增 `clearTodayResolvedAdjustmentsForNewDay` 调用（跨天恢复时）；参考 `handleToggleTask` 模式：setTaskGroup → saveLocal → saveCloud | ~+35 行 | 中 |
| 9 | `src/components/TaskItem.tsx` | Props 新增 `onAcceptAdjustment?`；转发给 TaskCompanionPanel；新增调整标记视觉（downgraded 标签 / tomorrow 标记 / keep_visible 标记）+ `resolved_today` 状态渲染 | ~+20 行 ~改 5 行 | 低 |
| 10 | `src/components/TaskList.tsx` | Props 新增 `onAcceptAdjustment`；转发给 TaskItem | ~+3 行 | 低 |
| 11 | `src/components/MainWorkspace.tsx` | 新增 `handleAcceptAdjustment` 回调 → `useTaskGroup.applyTaskAdjustment` | ~+10 行 | 低 |

**预计总改动量 ~320 行**（~280 新增 + ~40 修改），属于中 Phase。新增 MainWorkspace.tsx 到明确修改列表（上一版仅在描述中提及）。

### 13.2 确认不需要修改文件

| # | 文件 | 原因 | 验证结果 |
|:--:|------|------|------|
| 1 | `src/app/api/task-group/save/route.ts` | `isValidTask` 不拒绝多余字段；DB insert 只映射 7 列，adjustment 自然丢弃 | ✅ 已验证代码 |
| 2 | `src/app/api/task-group/load/route.ts` | 不返回 adjustment；前端从 localStorage 恢复 | ✅ 已验证代码 |

### 13.3 关于 task-execution.ts 修改的必要性（重申）

**为什么必须改 task-execution.ts**：

当前 locked 逻辑：`getTaskExecutionStatus` 返回 `"locked"` 当任务未完成且不是当前任务。如果 V2.7 允许用户把任务标记为 tomorrow/keep_visible，那么这些 todayResolved 任务不应继续阻塞后面的任务。

**不改的后果**：用户接受"明日继续"调整后，下一个任务仍然 locked——用户无法继续。这直接破坏了 V2.7 的核心价值。

**修改范围**：
- `TaskExecutionStatus` 从三态扩展为四态：`"completed" | "current" | "locked" | "resolved_today"`
- 新增 `isTaskTodayResolved(adjustment?)` helper
- `CompletableTask` 类型扩展为含 `adjustment?`
- 重写 `getTaskExecutionStatus`：按 completed → todayResolved → current → locked 优先级判断
- `getCurrentTaskIndex` 中跳过 todayResolved 任务
- 新增 `clearTodayResolvedAdjustmentsForNewDay(taskGroup)`：跨天恢复时清除 tomorrow/keep_visible adjustment

**风险缓解**：task-execution 是纯函数，容易单元测试。执行方案阶段必须写完整的测试用例覆盖所有 adjustment type × completed × taskIndex 组合，额外覆盖四态优先级和跨天清理逻辑。

---

## 14. 明确不修改文件

| # | 文件 | 原因 |
|:--:|------|------|
| 1 | `src/lib/ai-client.ts` | AI 调用逻辑不变 |
| 2 | `src/lib/adjust-task-strategy.ts` | 生成阶段智能调整逻辑不变——V2.7 是执行中调整，各管各的 |
| 3 | `src/components/TaskAssistPanel.tsx` | V2.7 不改 AI 辅助面板 |
| 4 | `src/hooks/useTaskAssist.ts` | 辅助 hook 不变 |
| 5 | `src/prompts/task-assist.ts` | V2.6 已是稳定版 |
| 6 | `src/prompts/task-generation.ts` | 任务生成 Prompt 不变 |
| 7 | `src/prompts/task-review.ts` | AI 复盘 Prompt 不变 |
| 8 | 数据库 schema / migration | 零数据库变更 |
| 9 | `package.json` / `package-lock.json` | 无新依赖 |
| 10 | `.env.local` / `next.config.ts` | 环境变量和配置不变 |
| 11 | `src/app/api/generate-tasks/route.ts` | 生成 API 不变 |
| 12 | `src/app/api/task-group/save/route.ts` | **已验证**：isValidTask 不拒绝多余字段，DB insert 自然忽略 adjustment |
| 13 | `src/app/api/task-group/load/route.ts` | **已验证**：adjustment 从 localStorage 恢复，不需要云端返回 |
| 14 | `src/app/api/task-groups/history/route.ts` | 历史 API 不变 |
| 15 | `src/app/api/task-groups/stats/route.ts` | 统计 API 不变（V2.7 MVP 不改统计口径） |
| 16 | `src/app/api/task-groups/review/route.ts` | 复盘 API 不变 |
| 17 | `src/components/` 其余所有组件 | 不改 |
| 18 | `src/hooks/` 其余所有 hooks | 不改 |
| 19 | `src/lib/storage.ts` | localStorage 抽象层不变（saveTaskGroup 直接 JSON.stringify 即可） |
| 20 | `src/lib/stats-calculator.ts` | 统计计算不变（V2.7 MVP 不改统计口径） |

---

## 15. 产品边界与安全红线

### 15.1 V2.7 新增边界

| # | 边界 | 说明 |
|---|------|------|
| 1 | AI 只能建议调整，不能自动执行 | 用户必须点击"接受调整" |
| 2 | 调整是减压降级，不是放弃 | AI 不能说"换个目标吧""这个不值得做" |
| 3 | 用户拒绝后不自动推进 | 点击"不用，继续"→ 只隐藏卡片，不发送信号，不自动请求 AI；记录已拒绝类型以去重 |
| 4 | 不能绕过 locked 顺序执行 | 只有用户点击"接受调整"后当前任务才可以被标记为 todayResolved（状态 `"resolved_today"`）；downgraded 仍是 `"current"` 状态，不释放后续 |
| 5 | 不自动删除任务 | 所有调整类型都是标记，不是删除 |
| 6 | 不自动勾选任务 | Human-in-the-Loop——completed 永远只由用户手动 checkbox 改变 |
| 7 | 不反复建议同一调整类型 | 前端 dismissedAdjustmentTypesRef + Prompt 去重规则，用户拒绝后在同一 companion 会话内不再建议相同类型 |

### 15.2 todayResolved ≠ completed

| 概念 | 含义 | 如何触发 | 影响 |
|------|------|----------|------|
| `completed = true` | 用户认为任务已完成 | 手动勾选 checkbox | 视觉：删除线灰色；统计：计入完成数 |
| `todayResolved = true` | 用户接受调整，今天不再要求 | 点击"接受调整" | 视觉：调整标记（如 "📅 明日继续"/"👁️ 保留可见"）+ `resolved_today` 状态渲染；不阻塞后续任务；统计：不计入完成数 |

**todayResolved 不是 completed 的替代品。completed 只能由用户手动勾选。**

### 15.3 全部保留的 V2.5.3 / V2.6 安全红线

| # | 红线 | 来源 |
|---|------|------|
| 1 | 不做心理诊断 | V2.5.3 |
| 2 | 不输出空泛鸡汤 | V2.5.3 |
| 3 | 不自动替用户完成任务，不自动勾选任务 | V2.5.3 |
| 4 | 不建议用户跳过当前任务 | V2.5.3 |
| 5 | 不输出完整最终稿 | V2.5.3 |
| 6 | 不编造用户经历 | V2.5.3 |
| 7 | 不默认让用户去外部搜索 | V2.5.3 |
| 8 | 给材料后收束到可执行小动作 | V2.5.3 |
| 9 | userFeedback 不入 stepHistory | V2.6 |
| 10 | userFeedback 不存数据库 | V2.6 |
| 11 | 不做全局聊天 | V2.6 |
| 12 | AI 只能建议"可以勾选完成"，不能自动勾选 | V2.6 |

### 15.4 如何避免"接受调整"变成"AI 自动管理任务"

| 机制 | 说明 |
|------|------|
| **用户确认门禁** | 每个调整都需要用户点击"接受调整"才生效 |
| **拒绝权** | 用户可以点击"不用，继续"拒绝 |
| **单任务作用域** | 调整只影响当前任务，不波及整个任务组 |
| **可逆** | 降级版保留 originalTitle；tomorrow 和 keep_visible 只是会话级标记，跨天自动清除 |
| **不自动触发** | AI 检测到模式后输出建议，但系统不会绕过用户直接执行 |

### 15.5 如何保证不绕过 locked 顺序执行

1. **task-execution.ts 是唯一 locked 判断入口**——所有任务状态判断都经过 `getTaskExecutionStatus`
2. **V2.7 只扩展该函数**——新增 `isTaskTodayResolved` 检查，但不改变基本逻辑
3. **downgraded 仍参与 locked 链**——`isTaskTodayResolved(downgraded) = false`，降级只是改标题，任务仍是未完成状态，仍阻塞后续
4. **tomorrow / keep_visible 不阻塞**——`isTaskTodayResolved(...) = true`，用户明确选择今天不做
5. **todayResolved 只能通过"接受调整"触发**——没有其他代码路径可以标记
6. **审核重点**：Code Review 时逐条验证所有 adjustment type × completed × taskIndex 组合

---

## 16. 风险与缓解

### 16.1 P0 风险

| # | 风险 | 影响 | 缓解措施 |
|---|------|------|----------|
| **P0-1** | task-execution 修改破坏 locked 顺序执行 | 用户可跳过任务，产品核心规则崩塌 | 执行方案必须包含完整测试矩阵（adjustment type × completed × taskIndex 所有组合）；Code Review 逐条验证 |
| **P0-2** | AI 频繁输出调整建议，干扰用户执行 | 用户被反复打扰，体验变差 | Prompt 规则："用户拒绝后不在同一任务内再次建议"；"用户表达情绪但仍在推进时不触发" |
| **P0-3** | "接受调整"后任务状态不一致 | tasks 数组与 UI 不同步 | applyTaskAdjustment → setTaskGroup → saveLocal → saveCloud；参照 handleToggleTask 已验证模式 |

### 16.2 P1 风险

| # | 风险 | 影响 | 缓解措施 |
|---|------|------|----------|
| **P1-1** | [ADJUST] 解析逻辑与 AI 输出格式不完全匹配 | 调整建议卡片不出现或解析错误 | 集中在 parser 层处理；Prompt 明确定义输出格式；parser 做容错 |
| **P1-2** | signalStats 数据不准确 | 传给 Prompt 的计数有误 | useRef 逻辑极简（三个字段 + 两个按钮累加）；exitCompanion 时重置 |
| **P1-3** | localStorage 的 adjustment 与云端恢复冲突 | 云端恢复的任务覆盖本地 adjustment | 恢复逻辑优先使用 localStorage 版本（当前已有 `loadTaskGroup(storageScope)` 优先于云端） |
| **P1-4** | 跨天 carryover + adjustment 交互错误 | tomorrow/keep_visible 跨天后仍被跳过，任务永远无法成为 current | `clearTodayResolvedAdjustmentsForNewDay` 在跨天恢复时清除 tomorrow/keep_visible adjustment；downgraded 保留 |

### 16.3 P2 风险

| # | 风险 | 影响 | 缓解措施 |
|---|------|------|----------|
| **P2-1** | TaskItem 调整标记视觉干扰 | 用户感觉界面变复杂 | 标记使用轻量视觉（小标签/图标），不改变任务行整体布局 |
| **P2-2** | 调整建议卡片在移动端体验差 | 卡片 + 按钮占用过多屏幕空间 | 使用紧凑布局；按钮在卡片内横排 |

---

## 17. V2.7 MVP 范围分阶段建议

### 17.1 V2.7A MVP（本次实现）

| 项目 | 内容 |
|------|------|
| **调整类型** | `downgraded` / `tomorrow` / `keep_visible`（三种） |
| **交互** | 接受 / 拒绝调整按钮 |
| **状态持久化** | localStorage（完整 TaskGroup 含 adjustment） |
| **云端同步** | adjustment 自然被 DB insert 忽略（零改动） |
| **统计** | **不改统计口径**——keep_visible / tomorrow 只影响 locked 阻塞和视觉，不影响 completedCount / totalCount / stats；今日完成率仍按 `completed / total` 计算 |
| **数据库** | 不改 |
| **文件改动** | ~10 个文件（见第 13 节） |

### 17.2 V2.7B 后置（不在本次实现）

| 项目 | 说明 | 后置原因 |
|------|------|----------|
| `postponed`（暂缓 / 本周暂缓） | 更复杂的语义——需要区分"今天暂缓"和"本周暂缓" | MVP 先做语义最清晰的一种 tomorrow + keep_visible；postponed 需要更多产品决策 |
| 从统计口径排除 adjusted task | completedCount / totalCount / isAllCompleted / stats 全部需要感知 adjustment | 影响面大（stats-calculator + stats API + StatsBar + TaskProgress + CompleteAllPrompt），MVP 先不改 |
| 云端同步 adjustment | 需要在 DB 新增列 + 改 save/load API | MVP 已确认不需要跨设备同步 |
| 调整历史记录 | 记录用户接受/拒绝了哪些调整 | 需要额外存储和 UI，属于增强功能 |
| 更复杂调整策略 | 如"建议前 3 个完成，后 2 个明天"的批量调整 | MVP 先做单任务调整 |

### 17.3 关于统计口径的明确决策

**V2.7 MVP 不改统计口径。** 理由：

1. `keep_visible` 的任务仍在列表中（视觉灰化但不隐藏），用户仍需看到它们
2. 当前 `completedCount = tasks.filter(t => t.completed).length`——keep_visible 任务的 `completed` 仍是 `false`，自然不计入完成数
3. `totalCount = tasks.length`——keep_visible 任务仍在数组中，计入总数
4. **这就是期望行为**：用户看到了完整任务列表，完成了其中 N 个，完成率 = N / total。keep_visible 的任务"不需要今天完成"但不代表它们不存在
5. 如果需要从统计中排除，需要改动：`stats-calculator.ts` + stats API + StatsBar + TaskProgress + CompleteAllPrompt，影响面太大，不属 MVP 范围

---

## 18. 验收标准

### 18.1 功能验收

| # | 验收项 | 验证方式 |
|---|--------|----------|
| **F1** | 同一任务 stuck 2+ 次后 AI 给出调整建议 | 连续点击"我卡住了"2 次 → AI 输出包含 [ADJUST] |
| **F2** | 同一任务 too_hard 2+ 次后 AI 给出调整建议 | 连续点击"太难了"2 次 → AI 输出包含 [ADJUST] |
| **F3** | 用户输入"太大了""做不动了""今天没时间"后 AI 给出调整建议 | 输入反馈文本 → AI 输出包含 [ADJUST] |
| **F4** | parser 正确解析 [ADJUST] 并输出 adjustmentSuggestion | AI 输出含 [ADJUST] → CompanionStep.adjustmentSuggestion 不为空 |
| **F5** | 调整建议卡片显示"接受调整"和"不用，继续"按钮 | 视觉确认卡片 + 两个按钮 |
| **F6** | 用户点击"接受调整"后 useTaskGroup 更新任务 | 接受 → setTaskGroup 更新 → localStorage 保存 |
| **F7** | "降级版"调整后任务标题更新，保留原始标题 | task.title 更新，task.adjustment.originalTitle 存在 |
| **F8** | "明日继续"调整后任务不阻塞后续任务 | 接受"明日继续" → 后续任务 unlocked |
| **F9** | "保留但不要求今天完成"调整后任务灰化可视 | 任务仍可见但灰色，无勾选压力 |
| **F10** | 用户点击"不用，继续"后只隐藏卡片，不发送 done 信号 | 拒绝 → 卡片消失（dismissed 本地状态）；不调用 sendSignal；不自动请求 AI；任务不变 |
| **F11** | 用户拒绝后 AI 不再反复建议同一调整类型 | 拒绝 → dismissedAdjustmentTypesRef 记录类型 → 后续 requestCompanion 传入 → Prompt 去重规则生效 |
| **F12** | 用户拒绝所有 3 种调整类型后 AI 不再建议任何调整 | dismissedAdjustmentTypes 包含全部 3 种 → Prompt 规则"不再建议任何调整" |
| **F13** | AI 不自动勾选任务 | 任何情况下 checkbox 只由用户手动操作 |
| **F14** | AI 不自动删除任务 | 任何情况下任务不被删除 |
| **F15** | 调整后 locked / resolved_today 四态规则正确 | downgraded → "current"（阻塞后续）；tomorrow/keep_visible → "resolved_today"（不阻塞后续）；completed → "completed" |
| **F16** | "全部任务 todayResolved 但未全部 completed"时不显示"全部完成" | 所有未完成任务都是 resolved_today → 显示轻量提示"今天先到这里，剩下的任务已保留/明天继续。"；不自动勾选；不删除任务 |
| **F17** | 跨天恢复时 tomorrow/keep_visible adjustment 被清除 | 新一天加载 carryover 任务组 → tomorrow/keep_visible 任务变为普通未完成任务（adjustment 清除）；downgraded 保留 |
| **F18** | 原有陪伴功能不受影响 | done/stuck/too_hard + 反馈输入框均正常 |

### 18.2 技术验收

| # | 验收项 | 验证方式 |
|---|--------|----------|
| **T1** | 不改数据库 | `git diff` 无 schema/migration 变更 |
| **T2** | 不改 save/load route | `git diff` 无 `task-group/save` / `task-group/load` 变更 |
| **T3** | [ADJUST] 解析在 parser 层 | `git diff` 含 `task-companion-parser.ts` 变更 |
| **T4** | 不改 ai-client.ts | `git diff` 无该文件变更 |
| **T5** | 不改 task-assist 相关文件 | `git diff` 无 assist 文件变更 |
| **T6** | `npm run lint` 通过 | 零 error |
| **T7** | `npm run build` 通过 | Compiled successfully |
| **T8** | `git status --short` 仅允许的修改文件 | 无意外修改，无新增源文件（新 doc 除外） |
| **T9** | `TaskExecutionStatus` 含 `"resolved_today"` | `grep "resolved_today" src/lib/types.ts` 有匹配 |
| **T10** | `clearTodayResolvedAdjustmentsForNewDay` 函数存在 | `grep` 在 task-execution.ts 或 useTaskGroup.ts 有匹配 |

### 18.3 回归验收

| # | 验收项 |
|---|--------|
| **R1** | 任务生成正常（generate-tasks） |
| **R2** | 任务勾选正常（checkbox） |
| **R3** | AI Assist 四种动作正常 |
| **R4** | V2.6 反馈输入框正常 |
| **R5** | V2.6 AI 验收正常 |
| **R6** | 历史记录正常 |
| **R7** | 统计正常 |
| **R8** | AI 复盘正常 |
| **R9** | Auth 正常 |
| **R10** | 跨天 carryover 正常（含 adjustment 清除） |
| **R11** | 全部任务 todayResolved 但不全部 completed 时 UI 正常 |

---

## 19. 后续 Execution Plan 要点

### 19.1 执行方案必须包含

1. **精确到文件/行号的代码变更方案**（基于本架构方案第 5 节代码核验结果）
2. **types.ts 全部新增类型定义**：
   - `TaskAdjustmentSuggestion`（parser 输出） + `ApplyTaskAdjustmentInput`（Props 链输入） + `TaskAdjustment`（存储结构）
   - `TaskExecutionStatus` 四态扩展（含 `"resolved_today"`）
   - `CompanionStep.adjustmentSuggestion?` + `Task.adjustment?`
3. **task-execution.ts 修改的完整测试矩阵**：
   - adjustment type (none / downgraded / tomorrow / keep_visible) × completed (true / false) × taskIndex 所有组合
   - 每个组合的预期 `getTaskExecutionStatus` 返回值（四态：completed / current / locked / resolved_today）
   - `getCurrentTaskIndex` 跳过 todayResolved 的测试
   - `clearTodayResolvedAdjustmentsForNewDay` 的跨天清理测试（明天场景：tomorrow/keep_visible 清除，downgraded 保留）
4. **task-companion-parser.ts [ADJUST] 解析的精确实现**：
   - 解析函数签名、正则、容错策略
   - [ADJUST] 提取在截断之前执行（避免被 MAX_MESSAGE_LENGTH 截断）
   - 边界情况：无 [ADJUST]、格式不完整、嵌套标记
5. **useTaskGroup.applyTaskAdjustment 的精确实现**：
   - 接收 `ApplyTaskAdjustmentInput`，内部生成 `TaskAdjustment`
   - downgraded: `task.title = input.alternativeTitle`，`task.adjustment = { type, originalTitle, reason, adjustedAt }`
   - tomorrow/keep_visible: `task.title` 不变，`task.adjustment = { type, reason, adjustedAt }`
   - 不可变更新模式（参考 handleToggleTask）
6. **useTaskGroup.clearTodayResolvedAdjustmentsForNewDay 的精确实现**：
   - 跨天恢复时调用
   - tomorrow/keep_visible → 清除 adjustment
   - downgraded → 保留
7. **Props 链路每层的精确改动**：
   - TaskCompanionPanel: 新增 `onAcceptAdjustment?: (taskId: string, suggestion: TaskAdjustmentSuggestion) => void` + dismissed 本地状态
   - TaskItem: Props 新增 `onAcceptAdjustment?`，转发给 TaskCompanionPanel；新增四态视觉渲染（含 `resolved_today`）
   - TaskList: Props 新增 `onAcceptAdjustment`，转发给 TaskItem
   - MainWorkspace: 新增 `handleAcceptAdjustment`，调用 `useTaskGroup.applyTaskAdjustment`
8. **调整建议卡片的完整 JSX 代码**——含接受/拒绝按钮 + dismissed 状态
9. **Prompt 升级的完整文本**：
   - "任务调整触发规则"分节（仅针对当前任务，不含批量调整）
   - [ADJUST] 输出格式（三种类型：downgraded / tomorrow / keep_visible）
   - signalStats 行 + declinedAdjustmentTypes 行
   - "调整建议去重"分节
10. **signalStats 的前端 useRef 实现**——数据结构、何时累加、何时重置
11. **dismissedAdjustmentTypesRef 的前端 useRef 实现**：
    - 用户点击"不用，继续"→ 记录类型
    - 每次 requestCompanion 传入
    - exitCompanion 时清空
12. **"不用，继续"按钮的完整行为规范**——不发送 done、不自动请求 AI、不修改任务
13. **"全部任务 todayResolved 但未全部 completed"的 UI 处理**：
    - 不显示"全部完成"
    - 不自动勾选、不删除任务
    - 显示轻量提示文案

### 19.2 执行顺序建议

```
Phase A: types.ts — 新增 TaskAdjustment + TaskAdjustmentSuggestion + ApplyTaskAdjustmentInput
                    + Task.adjustment? + CompanionStep.adjustmentSuggestion?
                    + TaskExecutionStatus 四态扩展（含 "resolved_today"）
Phase B: task-execution.ts — 新增 isTaskTodayResolved helper
                             + 重写 getTaskExecutionStatus（四态优先级）
                             + 更新 getCurrentTaskIndex（跳过 todayResolved）
                             + 新增 clearTodayResolvedAdjustmentsForNewDay
Phase C: task-companion-parser.ts — 新增 [ADJUST] 解析 + 返回类型扩展
Phase D: task-companion.ts (prompt) — 新增调整触发规则 + [ADJUST] 格式
                                       + signalStats 行 + declinedAdjustmentTypes 行
                                       + 调整建议去重规则
Phase E: task-companion/route.ts — 新增 normalizeSignalStats + normalizeDeclinedAdjustmentTypes
                                    + 传入 Prompt
Phase F: useTaskCompanion.ts — 新增 signalStatsRef + dismissedAdjustmentTypesRef
                               + acceptAdjustment / declineAdjustment
Phase G: useTaskGroup.ts — 新增 applyTaskAdjustment（ApplyTaskAdjustmentInput → TaskAdjustment）
                           + clearTodayResolvedAdjustmentsForNewDay 调用
Phase H: TaskCompanionPanel.tsx — 新增调整建议卡片 + 接受/拒绝按钮
                                  + dismissed 本地状态 + onAcceptAdjustment
Phase I: TaskItem.tsx — 新增 onAcceptAdjustment prop 转发
                        + 四态调整标记视觉（含 resolved_today）
Phase J: TaskList.tsx — 新增 onAcceptAdjustment prop 转发
Phase K: MainWorkspace.tsx — 新增 handleAcceptAdjustment → useTaskGroup.applyTaskAdjustment
                             + "全部 todayResolved 但未全部 completed"的轻量提示
Phase L: 全量验证 — lint + build + 功能验收（F1-F18）+ 回归验收（R1-R11）
```

### 19.3 给 ChatGPT 的建议审查点

1. 接受调整的完整数据更新链路是否闭合（Panel → Item → List → Workspace → useTaskGroup → localStorage）
2. `TaskAdjustmentSuggestion` → `ApplyTaskAdjustmentInput` → `TaskAdjustment` 三层类型是否字段闭合
3. todayResolved 概念是否清晰、边界是否准确（downgraded ≠ todayResolved）
4. `TaskExecutionStatus` 四态设计（`"resolved_today"`）是否合理
5. `clearTodayResolvedAdjustmentsForNewDay` 的跨天清理规则是否正确（tomorrow/keep_visible 清除，downgraded 保留）
6. task-companion-parser.ts 作为 [ADJUST] 唯一解析入口是否合理
7. task-execution.ts 的修改是否风险可控
8. signalStats 前端 useRef 方案是否可靠
9. "不用，继续"不发送 done 的行为是否正确
10. dismissedAdjustmentTypesRef + Prompt 去重机制是否完整
11. save/load route "不需要改"的结论是否经代码核验确认
12. V2.7A / V2.7B 分阶段范围是否合理（postponed 只在 V2.7B）
13. 统计口径"MVP 不改"的决策是否正确
14. 与"生成阶段智能调整"的边界是否清晰
15. 批量调整"剩余任务 keep_visible"是否已从 V2.7A 删除
16. "全部 todayResolved 但未全部 completed"的 UI 处理是否完备
17. V2.5.3/V2.6 安全红线是否全部保留
18. 是否有遗漏的风险或边界

---

> **文档结束**
>
> **下一文档**：本文档经 ChatGPT 审查通过后 → `docs/Execution-Plan-V2.7-Task-Difficulty-Adjustment.md`（V2.7 执行方案）
>
> **关联文档**：
> - [Roadmap-V2.6-to-V3.0A-AI-Execution-Loop.md](Roadmap-V2.6-to-V3.0A-AI-Execution-Loop.md) — V2.6→V3.0A 路线规划
> - [Upgrade-Lock-V2.6-to-V3.0A.md](Upgrade-Lock-V2.6-to-V3.0A.md) — 版本锁定关系
> - [Architecture-V2.6-Task-Feedback-Input.md](Architecture-V2.6-Task-Feedback-Input.md) — V2.6 架构方案
> - [Execution-Plan-V2.6-Task-Feedback-Input.md](Execution-Plan-V2.6-Task-Feedback-Input.md) — V2.6 执行方案
> - [PRD-V2.0.md](PRD-V2.0.md) — V2.0 产品规划
> - [Project-State-Handoff.md](Project-State-Handoff.md) — 项目当前状态交接
> - [Architecture-V3.0-Web-App-Separation.md](Architecture-V3.0-Web-App-Separation.md) — V3.0 架构方案（待修订）
