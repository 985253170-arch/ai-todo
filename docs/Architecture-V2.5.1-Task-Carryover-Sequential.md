# V2.5.1：未完成任务继承 + 顺序执行修复 架构方案

> **状态**：架构设计阶段。待 ChatGPT 审查通过后，由 Claude Code 编写执行方案。
> **依赖**：V2.5 Task Companion Mode ✅（线上验证通过）
> **定位**：修复两个严重产品流程问题——未完成任务跨天丢失 + 任务平级清单缺乏执行顺序
> **上一文档**：[Architecture-V2.5-Task-Companion.md](Architecture-V2.5-Task-Companion.md) · [Execution-Plan-V2.5-Task-Companion.md](Execution-Plan-V2.5-Task-Companion.md)
> **下一文档**：`docs/Execution-Plan-V2.5.1-Task-Carryover-Sequential.md`（待本架构审查通过后编写）
> **设计日期**：2026-07-07

---

## 目录

- [一、背景与问题](#一背景与问题)
- [二、V2.5.1 目标](#二v251-目标)
- [三、当前逻辑分析](#三当前逻辑分析)
- [四、产品决策](#四产品决策)
- [五、未完成任务继承方案](#五未完成任务继承方案)
- [六、顺序执行方案](#六顺序执行方案)
- [七、UI / 交互方案](#七ui--交互方案)
- [八、AI Assist / Companion 接入规则](#八ai-assist--companion-接入规则)
- [九、数据与状态设计](#九数据与状态设计)
- [十、不做范围](#十不做范围)
- [十一、V2.5.2 预留](#十一v252-预留)
- [十二、风险与缓解](#十二风险与缓解)
- [十三、文件影响预估](#十三文件影响预估)
- [十四、验收标准](#十四验收标准)
- [十五、后续 Execution Plan 要点](#十五后续-execution-plan-要点)

---

## 一、背景与问题

### 1.1 两个严重产品流程问题

**问题一：未完成任务跨天丢失**

当前 `/app` 的 `useTaskGroup` 恢复逻辑：

1. 用户昨天有未完成的任务组（`TaskGroup`）
2. 今天进入 `/app` 时，`isTaskGroupFromToday()` 返回 `false`
3. `showNewDayPrompt` 被设为 `true` → 页面显示 "新的一天，开始新的目标吧" 琥珀色横幅
4. 用户点击 "开始新的一天" → 旧任务组被清空 → 输入新目标 → 生成新任务
5. **昨天的未完成任务被用户主动绕过，任务连续性断裂**

即使用户不点击横幅，旧任务组仍然可见可操作，但产品设计上**没有"继续昨天任务"的明确引导**，反而用 "开始新的一天" 暗示用户放弃旧任务。

**问题二：任务平级清单缺乏执行顺序**

当前 AI 生成的任务列表是平级清单：

```
☐ 撰写项目周报
☐ 回复客户邮件
☐ 整理会议纪要
☐ 更新项目进度表
```

用户可以**任意勾选任意任务**，不按顺序。但很多目标天然有先后：

```
1. 先整理会议纪要 → 2. 再更新项目进度表 → 3. 最后撰写周报
```

跳过前置任务直接做后面的任务，会让 AI Todo 退化成普通 Todo List，失去"行动教练"的差异化定位。

### 1.2 为什么现在必须修

| 理由 | 说明 |
|------|------|
| **产品闭环断裂** | V2.0 闭环"目标 → 拆解 → 执行 → 复盘"中，"执行"环节没有顺序约束，用户可能跳过关键步骤 |
| **跨天连续性缺失** | 用户昨天的努力今天被"新的一天"提示抹掉，违反 AI 行动教练的持续陪伴定位 |
| **V2.5 陪伴模式依赖任务连续性** | V2.5 的 Companion 陪用户一步一步推进，但如果用户可以随意跳到后面的任务，陪伴的意义大打折扣 |
| **小改动大收益** | 不改数据库、不改 AI 生成、不改 Auth，最小改动解决两个核心流程问题 |

---

## 二、V2.5.1 目标

### 2.1 一句话

**修复任务跨天连续性和执行顺序，让 AI Todo 的任务列表更像"行动路径"而非平级清单。**

### 2.2 两个核心目标

| # | 目标 | 一句话 |
|---|------|--------|
| 1 | **未完成任务跨天继承** | 昨天没做完的任务，今天继续做，不提示"开始新的一天" |
| 2 | **任务顺序执行** | 任务按 AI 生成的顺序依次执行，前面的没做完不能跳过 |

### 2.3 核心原则

```
用户主导执行 → AI 陪伴推进 → 用户自己勾选完成
不做全自动 Agent → 不做自动跳过 → 不做自动完成
```

---

## 三、当前逻辑分析

### 3.1 当前 "今日任务" 判断逻辑

**文件**：[src/hooks/useTaskGroup.ts](../src/hooks/useTaskGroup.ts)

```
页面加载
    │
    ▼
restoreForAuthUser(userId)
    │
    ├── 1. 从 localStorage 恢复 taskGroup
    │      └── 找到 → setTaskGroup + setShowNewDayPrompt(!isTaskGroupFromToday)
    │
    ├── 2. localStorage 无 → 从 Supabase 加载
    │      └── 找到 → setTaskGroup + setShowNewDayPrompt(!isTaskGroupFromToday)
    │
    └── 3. 云端也无 → taskGroup=null, pageStatus="idle"
```

**关键判断**：[src/lib/date-utils.ts](../src/lib/date-utils.ts)

```typescript
export function isTaskGroupFromToday(taskGroup: TaskGroup) {
  const createdDate = new Date(taskGroup.createdAt);
  const today = new Date();
  return (
    createdDate.getFullYear() === today.getFullYear() &&
    createdDate.getMonth() === today.getMonth() &&
    createdDate.getDate() === today.getDate()
  );
}
```

**问题**：这个函数只判断"任务组是否今天创建"，不判断"任务组是否全部完成"。

### 3.2 当前 useTaskGroup 加载任务组逻辑

**文件**：[src/hooks/useTaskGroup.ts](../src/hooks/useTaskGroup.ts) 第 156-254 行

恢复流程：
1. 确定 storage scope（`user:<userId>` 或 `device:<deviceId>`）
2. 先尝试 localStorage
3. 再尝试云端 Supabase
4. 找到 → 展示任务组 + 判断是否显示 "新的一天" 提示
5. 没找到 → 空状态，等待用户输入目标

**关键点**：
- `load/route.ts` 用 `.order("updated_at", { ascending: false }).limit(1)` 加载**最近活跃的**任务组
- 按 `updated_at` 而非 `created_at` 排序——这意味着如果用户在昨天操作了任务（勾选/取消），那个任务组就是"最近活跃的"
- 加载条件：`archived_at IS NULL`（未归档）

### 3.3 当前 "新的一天" 自动创建逻辑

**不存在**"自动创建新任务组"逻辑。当前行为是：

1. 用户进入页面 → 看到旧任务组 + "新的一天" 横幅
2. 用户点击 "开始新的一天" → `handleStartNewDay()` 清空任务组
3. 用户输入新目标 → 点击生成 → 创建新任务组

**问题不在"自动创建"，而在"引导用户放弃旧任务"。**

### 3.4 当前 Task 是否有顺序字段

**没有。** [src/lib/types.ts](../src/lib/types.ts) 中的 `Task` 接口：

```typescript
export interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}
```

- 无 `order` / `sortOrder` / `sequence` 字段
- 无 `status` 字段（仅有 `completed: boolean`）
- 数据库 `tasks` 表中同样没有顺序字段

任务在数据库中按 `created_at ASC` 排序加载，在前端按数组索引顺序渲染。

### 3.5 当前 Task completed 状态如何更新

**文件**：[src/hooks/useTaskGroup.ts](../src/hooks/useTaskGroup.ts) 第 388-409 行

```typescript
function handleToggleTask(taskId: string) {
  setTaskGroup((currentTaskGroup) => {
    // 找到对应 task，翻转 completed
    const updatedTaskGroup = {
      ...currentTaskGroup,
      tasks: currentTaskGroup.tasks.map((task) =>
        task.id === taskId
          ? { ...task, completed: !task.completed, updatedAt: now }
          : task,
      ),
      updatedAt: now,
    };
    saveCurrentTaskGroup(updatedTaskGroup);
    void saveTaskGroupToCloud(deviceId, updatedTaskGroup);
    return updatedTaskGroup;
  });
}
```

- **无前置依赖检查**：任意任务可以随时 toggle
- **无顺序约束**：可以先完成第 5 个任务再完成第 1 个

### 3.6 当前 TaskItem 是否允许任意任务勾选

**是。** [src/components/TaskItem.tsx](../src/components/TaskItem.tsx) 第 27-32 行：

```tsx
<input
  checked={task.completed}
  onChange={() => onToggle(task.id)}
  type="checkbox"
/>
```

- 无 `disabled` 逻辑
- 无 "请先完成上一步" 提示
- 所有任务的 checkbox 行为完全一致

### 3.7 当前 AI Assist / Companion 是否绑定任意 Task

**是。** 两个面板都通过 `taskId` 绑定任务：

- [TaskItem.tsx:52-61](../src/components/TaskItem.tsx#L52-L61)：`TaskAssistPanel` 通过 `taskId={task.id}` 绑定
- [TaskItem.tsx:63-72](../src/components/TaskItem.tsx#L63-L72)：`TaskCompanionPanel` 通过 `taskId={task.id}` 绑定

任何任务都可以打开 Assist 或 Companion 面板，无顺序限制。

### 3.8 当前历史记录和复盘是否依赖日期

- **历史记录**（`/api/task-groups/history`）：按 `created_at DESC` 分页，不依赖"今天"概念
- **统计**（`/api/task-groups/stats`）：`Today` 统计使用 `completed_at >= 今天 00:00:00 UTC`——跨天未完成任务不影响统计
- **复盘**（`/api/task-groups/review`）：针对指定 `taskGroupId` 复盘，不依赖日期

**结论**：历史/统计/复盘都不依赖 "任务组是否今天创建"，跨天继承不影响这些模块。

---

## 四、产品决策

### 4.1 AI Todo 不是普通 Todo List

| 普通 Todo List | AI Todo |
|---------------|---------|
| 任务平级，随便勾选 | 任务有序，依次执行 |
| 每天新清单 | 跨天持续行动路径 |
| 工具属性 | 教练属性 |
| 用户自己规划顺序 | AI 生成有序行动步骤 |

### 4.2 任务列表 = 行动路径

AI 生成的 3-8 条任务不是并列事项，而是**从目标出发的一步步行动路径**。

- 第一步 = 启动动作（降低开始门槛）
- 中间步 = 核心推进
- 最后步 = 收尾/产出

用户不应该跳过第一步直接做最后一步——这不符合"行动教练"的产品定位。

### 4.3 Human-in-the-Loop 不变

| 谁做 | 什么 |
|------|------|
| **用户** | 判断步骤是否完成、勾选完成、决定何时继续/退出、决定是否开始新目标 |
| **AI** | 生成有序步骤、建议当前第一步、陪伴执行、鼓励推进 |

**V2.5.1 新增的约束**：
- 用户不能跳过前置未完成任务直接勾选后面的任务
- 但用户仍然可以：
  - 选择开始全新目标（明确操作）
  - 继续昨天的未完成任务（默认行为）

### 4.4 AI 能力边界不写死

V2.5.1 只解决流程问题，**不限制 AI 的能力边界**：

- AI 仍然可以自由生成任务内容
- AI 仍然可以建议、解释、拆解、鼓励
- 后续 V2.5.2 的 AI 大脑与情感升级不受 V2.5.1 限制
- V2.5.1 只在**前端交互层**加顺序约束，不影响 AI Prompt 和生成逻辑

---

## 五、未完成任务继承方案

### 5.1 核心规则

```
进入 /app
    │
    ▼
加载最近活跃任务组（现有逻辑不变）
    │
    ├── 无任务组 → 空状态，等待输入目标（现有逻辑不变）
    │
    └── 有任务组
        │
        ├── 全部任务已完成 → 显示"全部完成" + 允许生成新任务
        │
        └── 存在未完成任务
            │
            ├── 任务组是今天创建的 → 正常展示（现有逻辑不变）
            │
            └── 任务组不是今天创建的 → 跨天继承模式
                │
                ├── ❌ 不显示"新的一天"琥珀色横幅
                ├── ✅ 显示"继续昨天的任务"提示
                ├── ✅ 继续展示未完成任务
                └── ✅ 已完成的任务保持已完成状态
```

### 5.2 判断逻辑

新增工具函数 `shouldCarryOverTaskGroup(taskGroup: TaskGroup): boolean`：

```typescript
// 判断是否应该跨天继承（而非提示"新的一天"）
function shouldCarryOverTaskGroup(taskGroup: TaskGroup): boolean {
  const hasIncompleteTasks = taskGroup.tasks.some(t => !t.completed);
  const isFromToday = isTaskGroupFromToday(taskGroup);
  return hasIncompleteTasks && !isFromToday;
}
```

### 5.3 多个未完成任务组的处理

**推荐策略**：继续**最近活跃的**未完成任务组。

理由：
- `load/route.ts` 已经按 `updated_at DESC LIMIT 1` 加载——自然就是最近活跃的
- 不需要新增选择逻辑
- 如果用户有多个未完成任务组，最近操作的那个最可能是"正在进行中"的

### 5.4 何时允许生成新任务

只允许在以下情况下生成新任务：

| 场景 | 允许？ | 说明 |
|------|:--:|------|
| 当前任务组全部完成 | ✅ | 自然结束，可以开始新目标 |
| 用户点击"重新生成" | ✅ | 明确的用户意图 |
| 用户点击"清空任务" | ✅ | 明确的用户意图 |
| 没有任何任务组 | ✅ | 初始状态 |
| 存在跨天未完成任务 | ❌ | 默认继续，不主动提示新任务 |
| 用户想换目标但任务未完成 | ✅ | 通过"清空任务"明确操作（不做阻止） |

### 5.5 修改点

**修改 `useTaskGroup.ts` 的 `restoreForAuthUser` 逻辑**：

```
// 当前逻辑（伪代码）
if (savedTaskGroup) {
  setTaskGroup(savedTaskGroup);
  setShowNewDayPrompt(!isTaskGroupFromToday(savedTaskGroup));  // ← 问题
  return;
}

// 新逻辑（伪代码）
if (savedTaskGroup) {
  setTaskGroup(savedTaskGroup);
  const hasIncomplete = savedTaskGroup.tasks.some(t => !t.completed);
  if (!hasIncomplete) {
    // 全部完成了，可以显示"新的一天"
    setShowNewDayPrompt(!isTaskGroupFromToday(savedTaskGroup));
  } else if (isTaskGroupFromToday(savedTaskGroup)) {
    // 今天的任务，正常展示
    setShowNewDayPrompt(false);
  } else {
    // 跨天 + 未完成 → 继承，不显示"新的一天"
    setShowNewDayPrompt(false);
    // 可选：设置一个标记让 UI 显示"继续昨天的任务"
  }
  return;
}
```

**修改 `NewDayPrompt` 或新增 `CarryoverPrompt`**：

当任务组是跨天继承的，显示不同的 UI：
- "你还有未完成的任务，今天继续完成。"（而非"新的一天，开始新的目标吧"）
- 提供 "继续推进" 作为默认行为
- 提供 "开始新目标" 作为备选（调用 `handleStartNewDay`）

---

## 六、顺序执行方案

### 6.1 核心规则

**用现有任务数组顺序作为执行顺序。**

```
Task[0] → Task[1] → Task[2] → ... → Task[N-1]
  │          │          │              │
  ▼          ▼          ▼              ▼
已完成的   当前进行中   待解锁         待解锁
(completed) (current)  (locked)       (locked)
```

### 6.2 任务状态推导

**不新增数据库字段**，从 `completed` 布尔值 + 数组位置推导状态：

```typescript
type TaskExecutionStatus = "completed" | "current" | "locked";

function deriveTaskStatus(
  task: Task,
  index: number,
  allTasks: Task[],
): TaskExecutionStatus {
  if (task.completed) return "completed";

  // 第一个未完成任务 = current
  const firstIncompleteIndex = allTasks.findIndex(t => !t.completed);
  if (index === firstIncompleteIndex) return "current";

  // current 之后的未完成任务 = locked
  return "locked";
}
```

### 6.3 推导示例

```
任务列表：           completed  状态推导
─────────────────────────────────────
整理会议纪要         ✅ true    completed
更新项目进度表       ❌ false   current   ← 第一个未完成
撰写项目周报         ❌ false   locked    ← current 之后
回复客户邮件         ❌ false   locked
```

### 6.4 执行规则

| 规则 | 说明 |
|------|------|
| **current 之前的任务** | 必须已完成（`completed === true`），否则系统状态不一致 |
| **current 任务** | 用户可以勾选完成、打开 AI 帮助、打开陪伴模式 |
| **locked 任务** | 可以展示，但 checkbox **disabled** |
| **locked 任务交互** | 点击 checkbox → 提示 "请先完成上一步，再继续这一步" |
| **完成 current 后** | 下一个未完成任务自动变为 current |
| **全部完成后** | 显示 "全部完成" 状态，允许生成新任务 |

### 6.5 边界情况

| 场景 | 处理 |
|------|------|
| 用户取消勾选 current 之前的任务 | current 回退到该任务位置（它重新变成第一个未完成） |
| 用户取消勾选 current | current 不变，它后面的仍然是 locked |
| AI 重新生成任务 | 所有任务重新开始，第一条是 current |
| 所有任务已完成 | 无 current，无 locked |
| 第一个任务就是 current | 无 completed 任务，第一个任务直接可操作 |
| 从云端恢复的任务组 | 按相同规则重新推导状态 |

### 6.6 为什么不用数据库字段

| 方案 | 优点 | 缺点 |
|------|------|------|
| **纯前端推导（本方案）** | 零数据库变更、零 API 修改 | 依赖前端逻辑正确性 |
| 新增 `sort_order` 字段 | 数据更可靠 | 需要 migration、改 save/load API |
| 新增 `status` 字段 | 状态持久化 | 需要 migration、status 和 completed 可能不一致 |

**选择纯前端推导**，理由：
1. 不改数据库 schema（符合项目强制规则）
2. `completed` 已经提供了足够信息
3. 任务顺序 = 数组顺序（AI 生成时就排好序）
4. 风险可控：推导逻辑是纯函数，易于测试

---

## 七、UI / 交互方案

### 7.1 未完成任务继承 — UI

**场景**：用户昨天有未完成任务，今天打开 `/app`

**当前 UI**（有问题）：
```
┌──────────────────────────────────────────┐
│  ⚠️ 新的一天，开始新的目标吧              │
│  [开始新的一天]                           │
└──────────────────────────────────────────┘
```

**新 UI**：
```
┌──────────────────────────────────────────┐
│  📋 你还有未完成的任务，今天继续完成。     │
│  目标：完成本周工作汇报                    │
│  [继续推进]          [开始新目标]          │
└──────────────────────────────────────────┘
```

- "继续推进" = 默认行为，关闭横幅（或滚动到任务列表）
- "开始新目标" = 调用 `handleStartNewDay`，清空当前任务组

**实现方案**：修改 `NewDayPrompt` 组件，根据是否有未完成任务显示不同内容。组件名可保持不变（减少改动面），通过 props 控制显示模式。

### 7.2 任务顺序执行 — UI

**TaskItem 状态样式**：

| 状态 | checkbox | 标题样式 | 操作按钮 | 视觉提示 |
|------|:--:|------|------|------|
| **completed** | ✅ 勾选 | 删除线 + 灰色 | 无 | 左侧绿色竖线 |
| **current** | ☐ 可点击 | 正常 + 微强调 | "AI 帮我一下" | 左侧蓝色竖线 + 浅蓝背景 |
| **locked** | 🔒 disabled | 灰色 + 锁图标 | 隐藏 | 左侧灰色竖线 + opacity-60 |

**移动端视觉示意**：

```
┌──────────────────────────────────────────┐
│ ┃ ✅ 整理会议纪要                         │  ← completed（绿线）
│                                          │
│ ┃ ☐ 更新项目进度表                        │  ← current（蓝线 + 浅蓝背景）
│   📍 当前这一步               [AI 帮我一下] │
│                                          │
│   🔒 撰写项目周报                         │  ← locked（灰线 + 锁图标）
│   🔒 回复客户邮件                         │  ← locked
└──────────────────────────────────────────┘
```

### 7.3 locked 任务交互

**点击 locked checkbox 时**：

移动端 Toast / 内联提示：
```
┌──────────────────────────────────────────┐
│  ⚠️ 请先完成上一步，再继续这一步。         │
└──────────────────────────────────────────┘
```

**实现方案**：
- 在 `handleToggleTask` 中加前置检查：如果 task 状态是 locked → 不执行 toggle，显示提示
- "AI 帮我一下" 按钮对 locked 任务隐藏

### 7.4 最小化视觉改动

| 改动项 | 方式 |
|--------|------|
| current 任务高亮 | 左侧边框色 + 微背景色（Tailwind class 即可） |
| locked 任务置灰 | `opacity-60` + 锁图标 emoji |
| locked checkbox disabled | `disabled` 属性 |
| 跨天继承提示 | 复用 `NewDayPrompt` 组件，新增 variant prop |
| 提示文案 | 复用 toast / inline message 模式 |

**不使用**：新字体、新图标库、新颜色体系、新组件库。

### 7.5 不改的UI部分

| 组件 | 改动 |
|------|:--:|
| Header | ❌ 不改 |
| HeroSection | ❌ 不改 |
| GoalInput | ❌ 不改 |
| StatsBar | ❌ 不改 |
| HistoryPanel | ❌ 不改 |
| TaskReviewPanel | ❌ 不改 |
| LoadingState | ❌ 不改 |
| EmptyState | ❌ 不改 |
| TaskProgress | ❌ 不改 |
| CompleteAllPrompt | ❌ 不改 |
| ErrorMessage | ❌ 不改 |

---

## 八、AI Assist / Companion 接入规则

### 8.1 入口可见性

| 任务状态 | "AI 帮我一下" | "开始陪我做" |
|----------|:--:|:--:|
| **completed** | 隐藏 | 隐藏 |
| **current** | ✅ 显示 | ✅ 显示（通过 Assist Panel） |
| **locked** | 隐藏 | 隐藏 |

**理由**：
- AI 辅助和陪伴应该服务于"当前这一步"，而非未来的步骤
- locked 任务还没到执行时机，提前给 AI 帮助会分散注意力
- 用户完成了 current 后，下一个任务自动解锁，届时可以获取 AI 帮助

### 8.2 Companion 面板不变

V2.5 Companion 核心 API 和行为完全不变：

- 陪伴入口仍然在 TaskAssistPanel 底部
- 陪伴交互仍然是 5 个固定反馈按钮
- 陪伴 API 仍然不访问任务完成状态
- 陪伴仍然不自动勾选任务

**唯一变化**：只有 current 任务可以打开陪伴面板。

### 8.3 V2.4 Assist 面板不变

V2.4 的 4 个辅助按钮行为完全不变。只是入口只对 current 任务显示。

---

## 九、数据与状态设计

### 9.1 核心原则

```
零数据库变更 + 纯前端状态推导
```

### 9.2 不新增数据库字段

`tasks` 表不变：
```
id (PK), task_group_id (FK), title, completed (boolean),
completed_at (nullable), created_at, updated_at
```

不新增 `sort_order`、`status`、`locked` 等字段。

### 9.3 不新增 TypeScript 类型字段

`Task` 接口不变：
```typescript
export interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}
```

不新增 `status`、`sortOrder`、`locked` 等字段。

### 9.4 新增纯函数推导

新增工具函数文件 `src/lib/task-execution.ts`（或放在现有 `date-utils.ts` 同目录）：

```typescript
// 推导单个任务的执行状态
export type TaskExecutionStatus = "completed" | "current" | "locked";

export function getTaskExecutionStatus(
  taskIndex: number,
  tasks: { completed: boolean }[],
): TaskExecutionStatus;

// 判断任务组是否全部完成
export function isTaskGroupFullyCompleted(tasks: { completed: boolean }[]): boolean;

// 判断任务组是否有未完成任务
export function hasIncompleteTasks(tasks: { completed: boolean }[]): boolean;

// 判断是否应该跨天继承
export function shouldCarryOverTaskGroup(taskGroup: TaskGroup): boolean;

// 获取当前任务索引
export function getCurrentTaskIndex(tasks: { completed: boolean }[]): number | null;
```

### 9.5 状态推导在组件层

- `TaskItem` 调用 `getTaskExecutionStatus(index, tasks)` 决定渲染状态
- `TaskList` 调用 `getCurrentTaskIndex(tasks)` 传递给子组件
- `useTaskGroup` 调用 `hasIncompleteTasks` / `shouldCarryOverTaskGroup` 决定 `showNewDayPrompt`
- 不新增全局状态管理
- 不新增 Context / Provider

### 9.6 localStorage 不变

任务组仍然以 `TaskGroup` 格式存储在 localStorage，序列化/反序列化逻辑不变。

---

## 十、不做范围

### 10.1 V2.5.1 明确不做

| # | 不做 | 原因 |
|---|------|------|
| 1 | 不做 V3.0 页面大重构 | 属于 V3.0 |
| 2 | 不做底部导航 | 属于 V3.0 |
| 3 | 不做任务拖拽排序 | 复杂度高，非 MVP 必需 |
| 4 | 不做任务依赖图 | 过度设计 |
| 5 | 不做跳过任务 | V2.5.1 默认不做跳过 |
| 6 | 不做长期记忆 | 属于后续版本 |
| 7 | 不做完整聊天系统 | 不做自由聊天 |
| 8 | 不做 AI 自动完成 | 永远不做（HITL） |
| 9 | 不做 AI 自动创建后续任务 | 永远不做 |
| 10 | 不做数据库大改 | 零 schema 变更 |
| 11 | 不做 AI 情感人格完整实现 | 属于 V2.5.2 |
| 12 | 不改 Auth | 与 Auth 无关 |
| 13 | 不改 V2.5 companion 核心 API | 陪伴 API 不变 |
| 14 | 不改 V2.4 assist API | 辅助 API 不变 |
| 15 | 不改 generate-tasks API | 任务生成不受影响 |
| 16 | 不改 review API | 复盘不受影响 |
| 17 | 不改历史/统计 API | 历史/统计不受影响 |
| 18 | 不做任务到期日/DDL | 非 V2.5.1 目标 |
| 19 | 不做用户自定义任务顺序 | AI 生成的顺序即执行顺序 |
| 20 | 不做多任务组并列选择 | 始终加载最近活跃的 |

---

## 十一、V2.5.2 预留

### 11.1 V2.5.1 不把 AI 锁死

V2.5.1 的所有改动都在**前端交互层**：

- 未完成任务继承 → UI 逻辑
- 任务顺序执行 → UI 逻辑
- 状态推导 → 纯函数

**AI Prompt、AI API、AI 行为完全没有被限制。**

### 11.2 V2.5.2 的 AI 大脑与情感边界升级

后续 V2.5.2 应该具备：

| 能力 | 说明 |
|------|------|
| **更自然的陪伴语气** | 不只是固定模板，而是根据上下文调整 |
| **更强的上下文理解** | 理解用户当前在任务序列中的位置和状态 |
| **更灵活的任务帮助** | 根据任务类型给出不同风格的帮助 |
| **更有人味的鼓励** | 不只是 4 步结构，而是有记忆、有温度的对话 |
| **更主动的下一步建议** | 识别用户停滞时主动给出小步骤 |
| **任务顺序智能感知** | AI 知道当前是第几步，给出适合当前阶段的帮助 |

### 11.3 底线不变

| # | 底线 | 说明 |
|---|------|------|
| 1 | 不替用户完成最终任务 | AI 只辅助，不替代 |
| 2 | 不自动勾选 | 完成权始终在用户 |
| 3 | 不自动执行外部操作 | 不发送、不发布、不提交 |
| 4 | 不做心理诊断 | 不是心理咨询工具 |
| 5 | 不制造依赖和焦虑 | 不暗示"没有 AI 你不行" |

### 11.4 V2.5.1 → V2.5.2 的衔接

V2.5.1 的顺序执行为 V2.5.2 的 AI 大脑升级提供了关键基础：

- AI 知道用户在任务序列的**哪个位置**（current / 第几步）
- AI 知道前面完成了什么、后面还剩什么
- AI 可以根据当前位置给出**更精准**的建议和鼓励
- Companion 的上下文可以从"当前任务"扩展到"当前任务在序列中的位置"

---

## 十二、风险与缓解

### P0 — 阻塞

| # | 风险 | 影响 | 缓解措施 |
|---|------|------|----------|
| **P0-1** | 状态推导逻辑错误导致用户无法操作任何任务 | 核心功能不可用 | `getTaskExecutionStatus` 纯函数易于单元测试；添加边界情况验证（全部完成、全部未完成、仅一个任务等） |
| **P0-2** | 改坏 `handleToggleTask` 导致任务完成状态异常 | 核心功能受损 | 只新增前置检查，不修改 toggle 核心逻辑 |
| **P0-3** | 改坏 `useTaskGroup` 恢复逻辑 | 任务加载异常 | 新增逻辑仅修改 `showNewDayPrompt` 判断条件 |
| **P0-4** | locked 任务永远无法解锁 | 用户被困 | 确保 `getCurrentTaskIndex` 正确识别第一个未完成任务 |

### P1 — 严重影响体验

| # | 风险 | 影响 | 缓解措施 |
|---|------|------|----------|
| **P1-1** | 旧任务组恢复影响"新一天"体验 | 用户觉得被旧任务困住 | "开始新目标"按钮始终可用；用户可主动清空 |
| **P1-2** | 用户想开始新目标但系统强制继续旧任务 | 用户困惑 | 跨天继承提示中提供明确的"开始新目标"选项 |
| **P1-3** | locked 任务让用户觉得受限 | 用户反感 | locked 任务仍然展示，只是不能勾选；提示文案友好 |
| **P1-4** | AI 生成的任务顺序不合理 | 执行路径错误 | Prompt 已要求"按执行顺序列出"；后续可优化生成 Prompt |
| **P1-5** | 跨天任务组对历史记录展示的影响 | 同一任务组跨越多天 | 历史记录按 `created_at` 显示，跨天任务组只出现一次 |

### P2 — 可接受

| # | 风险 | 影响 | 缓解措施 |
|---|------|------|----------|
| **P2-1** | 状态推导依赖前端逻辑 | 刷新后重新推导，可能存在短暂不一致 | 推导逻辑幂等，多次推导结果一致 |
| **P2-2** | 不支持"两个任务可以并行"的场景 | 某些目标确实不需要严格顺序 | 后续版本可增加"跳过"功能 |
| **P2-3** | 移动端 locked 视觉提示可能不够明显 | 用户可能忽略 | 使用 opacity + lock emoji + disabled cursor 三重提示 |
| **P2-4** | 用户取消勾选已完成任务导致 current 回退 | 用户可能困惑 | 回退是正确行为（该任务重新变成第一个未完成），但需要确保 UI 更新即时 |

---

## 十三、文件影响预估

### 13.1 新增文件（2-3 个）

| # | 文件 | 职责 | 预估行数 |
|:--:|------|------|:--:|
| 1 | `src/lib/task-execution.ts` | 任务执行状态推导纯函数（`getTaskExecutionStatus`、`isTaskGroupFullyCompleted`、`hasIncompleteTasks`、`shouldCarryOverTaskGroup`、`getCurrentTaskIndex`） | ~60 |
| 2 | （可选）`src/components/CarryoverBanner.tsx` | 跨天继承提示横幅（如果 NewDayPrompt 不便于复用） | ~50 |

### 13.2 修改文件（5-7 个）

| # | 文件 | 修改内容 | 风险 |
|:--:|------|------|:--:|
| 1 | `src/hooks/useTaskGroup.ts` | 修改 `restoreForAuthUser` 中的 `showNewDayPrompt` 判断逻辑；修改 `handleToggleTask` 增加 locked 检查 | **高** |
| 2 | `src/components/TaskItem.tsx` | 根据 task execution status 渲染不同样式；locked 任务 disabled checkbox + 隐藏 AI 按钮 | 中 |
| 3 | `src/components/TaskList.tsx` | 传递 task index 给 TaskItem | 低 |
| 4 | `src/components/MainWorkspace.tsx` | 新增 "继续推进/开始新目标" 处理逻辑（可能通过修改 NewDayPrompt 的 props） | 低 |
| 5 | `src/components/NewDayPrompt.tsx` | 新增 variant prop 支持 "跨天继承" 和 "新的一天" 两种模式 | 低 |
| 6 | （可选）`src/lib/types.ts` | 如需导出 `TaskExecutionStatus` 类型 | 低 |
| 7 | （可选）`src/lib/constants.ts` | 新增 UI 文案常量（如提示文本） | 低 |

### 13.3 明确不改

| # | 不改 | 原因 |
|:--:|------|------|
| 1 | 数据库 schema / migration | 零数据库变更 |
| 2 | 所有 API Route（generate-tasks / task-assist / task-companion / task-group/** / task-groups/**） | 服务端逻辑不受影响 |
| 3 | `ai-client.ts` | 不影响 AI 调用 |
| 4 | 所有 Prompt 文件 | 不影响 AI 生成 |
| 5 | 所有 Parser 文件 | 不影响 AI 响应解析 |
| 6 | `useTaskAssist.ts` | 不受影响 |
| 7 | `useTaskCompanion.ts` | 不受影响 |
| 8 | `useTaskReview.ts` / `useTaskStats.ts` / `useTaskHistory.ts` | 不受影响 |
| 9 | Auth / V2.3 安全文件 | 不受影响 |
| 10 | `package.json` / `package-lock.json` | 无新依赖 |
| 11 | `.env.local` | 环境变量不变 |

### 13.4 高风险文件（修改前必须确认）

| 文件 | 风险 | 原因 |
|------|:--:|------|
| `src/hooks/useTaskGroup.ts` | **高** | 核心任务状态管理，459 行 |
| `src/components/TaskItem.tsx` | 中 | 新增状态推导 + disabled 逻辑 |
| `src/lib/types.ts` | 低 | 如仅导出类型，风险极低 |

---

## 十四、验收标准

### 14.1 未完成任务继承

| # | 验收项 | 操作 | 预期 |
|---|--------|------|------|
| **C1** | 昨天未完成任务今天继续展示 | 昨天创建任务组 → 完成部分任务 → 今天进入 /app | 看到昨天未完成的任务，"新的一天"横幅**不出现**，改为"继续昨天的任务" |
| **C2** | 昨天全部完成今天可开始新任务 | 昨天创建任务组 → 全部完成 → 今天进入 /app | 看到"全部完成"或空状态，可输入新目标 |
| **C3** | "继续推进"为默认行为 | 关闭横幅或向下滚动 | 任务列表正常可操作 |
| **C4** | "开始新目标"仍可用 | 点击"开始新目标" | 清空旧任务组，进入空状态等待输入 |
| **C5** | 无任务组时行为不变 | 全新用户进入 /app | 空状态，等待输入目标 |

### 14.2 任务顺序执行

| # | 验收项 | 操作 | 预期 |
|---|--------|------|------|
| **S1** | 第一个任务是 current | 生成新任务 | 第一个任务高亮，可操作 |
| **S2** | 后面的任务是 locked | 生成新任务 | 第二、三...个任务显示锁图标 + 置灰 + checkbox disabled |
| **S3** | current 完成后解锁下一个 | 勾选 current 任务 | 下一个任务变为 current（高亮 + 可操作） |
| **S4** | locked 任务不可勾选 | 点击 locked 任务的 checkbox | 不勾选，显示提示"请先完成上一步" |
| **S5** | 取消勾选已完成任务 → current 回退 | 取消勾选一个已完成的任务 | 该任务重新变为 current，后面的重新变为 locked |
| **S6** | 全部完成后状态正常 | 勾选最后一个任务 | 全部完成，显示"全部完成"提示 |
| **S7** | 仅一个任务时行为正常 | 生成只有 1 个任务的任务组 | 该任务是 current，完成后全部完成 |

### 14.3 AI Assist / Companion 接入

| # | 验收项 | 操作 | 预期 |
|---|--------|------|------|
| **A1** | current 任务可打开 AI 帮助 | 点击 current 任务的"AI 帮我一下" | 面板正常打开 |
| **A2** | current 任务可打开陪伴模式 | current 任务 → AI 帮我一下 → 开始陪我做 | 陪伴面板正常打开 |
| **A3** | locked 任务不显示 AI 帮助入口 | 查看 locked 任务 | 无"AI 帮我一下"按钮 |
| **A4** | completed 任务不显示 AI 帮助入口 | 查看已完成任务 | 无"AI 帮我一下"按钮 |

### 14.4 回归验收

| # | 验收项 | 预期 |
|---|--------|------|
| **R1** | 任务生成（/api/generate-tasks） | 不受影响 |
| **R2** | 任务勾选（完成/取消） | 不受影响（仅 locked 增加前置检查） |
| **R3** | 清空 / 重新生成 / 新一天 | 不受影响 |
| **R4** | 历史记录 | 不受影响 |
| **R5** | 统计数据 | 不受影响 |
| **R6** | AI 复盘 | 不受影响 |
| **R7** | V2.4 AI 辅助面板（4 个按钮） | 不受影响 |
| **R8** | V2.5 陪伴面板（5 个反馈按钮） | 不受影响 |
| **R9** | 登录/注册/忘记密码/重置密码 | 不受影响 |
| **R10** | Turnstile | 不受影响 |

### 14.5 技术门禁

```bash
npm run lint     # 零 error
npm run build    # Compiled successfully，TypeScript 类型检查通过
git status --short   # 仅 V2.5.1 允许的文件变更，无意外修改
```

---

## 十五、后续 Execution Plan 要点

### 15.1 执行方案应包含

1. **任务执行状态推导函数**（`task-execution.ts`）的完整实现规范
2. **useTaskGroup 恢复逻辑修改**的详细步骤
3. **TaskItem 状态渲染**的 3 种样式规范（completed / current / locked）
4. **NewDayPrompt 双模式**的 props 设计和 UI 规范
5. **locked 任务交互提示**的实现方案（内联 vs toast）
6. **Codex 实施步骤**的分阶段计划
7. **Claude Code Review 清单**

### 15.2 执行顺序建议

```
Phase A: 基础设施
  ├── task-execution.ts（纯函数 + 单元测试）
  └── types.ts（如需要导出类型）

Phase B: 核心逻辑
  ├── useTaskGroup.ts（恢复逻辑 + toggle 前置检查）
  └── NewDayPrompt.tsx（双模式支持）

Phase C: UI 层
  ├── TaskItem.tsx（状态推导 + 3 种渲染）
  └── TaskList.tsx（传递 index）

Phase D: 全量验证
  ├── lint + build
  ├── 功能验收 C1-C5, S1-S7, A1-A4
  └── 回归验收 R1-R10
```

### 15.3 预估改动量

| 层 | 新增行数 | 修改行数 |
|----|:--:|:--:|
| 工具函数 | ~60 | 0 |
| Hook | 0 | ~30 |
| UI 组件 | ~20（可选新组件） | ~50 |
| 类型/常量 | ~10 | ~5 |
| **总计** | **~90** | **~85** |

预计总改动量 ~175 行，属于小型 Phase。

---

> **文档结束**
>
> **下一文档**：本文档经 ChatGPT 审查通过后 → `docs/Execution-Plan-V2.5.1-Task-Carryover-Sequential.md`（V2.5.1 执行方案）
>
> **关联文档**：
> - [Architecture-V2.5-Task-Companion.md](Architecture-V2.5-Task-Companion.md) — V2.5 架构方案（本 V2.5.1 的依赖）
> - [Execution-Plan-V2.5-Task-Companion.md](Execution-Plan-V2.5-Task-Companion.md) — V2.5 执行方案
> - [Roadmap-Core-First-V2.3-to-V3.0.md](Roadmap-Core-First-V2.3-to-V3.0.md) — 总路线文档
> - [PROJECT-CONTEXT.md](PROJECT-CONTEXT.md) — 项目长期上下文
> - [PROJECT-INDEX.md](PROJECT-INDEX.md) — 项目文件索引
