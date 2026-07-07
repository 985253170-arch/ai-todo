# V2.5.1：未完成任务继承 + 顺序执行修复执行方案

> 状态：Execution Plan
> 目标：只修复未完成任务跨天继承和任务顺序执行两个产品流程问题。
> 前置：V2.5 Task Companion Mode 已完成并线上验证通过。
> 架构依据：docs/Architecture-V2.5.1-Task-Carryover-Sequential.md
> 执行原则：最小改动，不改数据库、不改 API、不改 AI Prompt/Parser、不改 Auth。

---

## 1. 执行结论

V2.5.1 只做两件事：

1. 未完成任务跨天继承
   - 如果存在未完成任务组，即使不是今天创建，也继续展示。
   - 不再提示“新的一天，开始新的目标吧”。
   - 改为提示：“你还有未完成的任务，今天继续完成。”
   - 只有任务全部完成、用户明确开始新目标、清空任务、重新生成、或无任务组时，才允许进入新目标流程。

2. 任务顺序执行
   - 现有任务数组顺序就是执行顺序。
   - 第一个未完成任务是 `current`。
   - `current` 前面的任务是 `completed`。
   - `current` 后面的未完成任务是 `locked`。
   - `locked` 任务不可勾选，不显示 AI 帮助入口，不允许打开陪伴模式。
   - 用户点击 `locked` 任务卡片时显示内联提示：“请先完成上一步，再继续这一步。”

本阶段不引入服务端新能力，不改变 AI 能力边界，不改变任务生成、复盘、统计、历史、Auth、安全流程。

---

## 2. 实施范围

### 2.1 技术方向

采用纯前端推导和最小 hook 保护方案：

- 不改数据库 schema。
- 不新增 migration。
- 不新增 API Route。
- 不改 `generate-tasks` API。
- 不改 `task-assist` API。
- 不改 `task-companion` API。
- 不改 prompt 文件。
- 不改 parser 文件。
- 不改 `ai-client.ts`。
- 不改 Auth / V2.3 文件。
- 不新增依赖。
- 用纯函数从 `tasks[]` 和 `completed` 推导执行状态。

### 2.2 产品规则

1. 用户不能跳过 `locked` 任务。
2. 用户可以主动开始新目标，但必须明确点击。
3. AI 帮助和陪伴只服务 `current` 任务。
4. 完成 `current` 后，下一个任务自动成为 `current`。
5. 取消已完成任务时，`current` 回退到该任务。
6. AI 不自动勾选任务。
7. AI 不自动创建任务。
8. AI 不自动跳过任务。
9. V2.5.1 不限制 AI 后续能力边界。
10. V2.5.2 再做 AI 大脑与情感升级。

---

## 3. 文件影响清单

### 3.1 允许新增文件

1. `src/lib/task-execution.ts`
   - 新增任务执行状态纯函数。
   - 导出 `TaskExecutionStatus` 类型。
   - 不依赖 React，不访问浏览器 API，不读写 storage，不发请求。

### 3.2 允许修改文件

1. `src/hooks/useTaskGroup.ts`
   - 修改恢复逻辑中的 `showNewDayPrompt` 判断。
   - 新增 carryover 状态返回。
   - 在 `handleToggleTask` 增加 locked 任务保护。
   - 不改变保存 localStorage / Supabase 的原有逻辑。

2. `src/components/NewDayPrompt.tsx`
   - 增加 `variant: "new_day" | "carryover"`。
   - carryover 模式显示继续任务提示。
   - 支持“继续推进”和“开始新目标”。

3. `src/components/MainWorkspace.tsx`
   - 接入 carryover prompt。
   - 传递任务顺序执行状态需要的 props。
   - 保持 assist / companion 互斥逻辑不变。

4. `src/components/TaskList.tsx`
   - 根据 tasks 推导每个任务的 execution status。
   - 将 `executionStatus` / `taskIndex` 传给 TaskItem。
   - 透传 locked 点击提示回调。

5. `src/components/TaskItem.tsx`
   - 根据 `completed/current/locked` 渲染任务状态。
   - locked checkbox disabled。
   - locked 卡片整体点击显示内联提示。
   - AI 帮助入口只在 current 任务显示。

### 3.3 不建议修改

1. `src/lib/types.ts`
   - 不建议修改。
   - `TaskExecutionStatus` 优先放在 `src/lib/task-execution.ts` 内导出。
   - 不给 `Task` 增加 `status/order/locked` 字段。

2. `src/hooks/useTaskAssist.ts`
   - 不修改。

3. `src/hooks/useTaskCompanion.ts`
   - 不修改。

---

## 4. Phase 1：task-execution 纯函数

### 4.1 新增文件

新增：`src/lib/task-execution.ts`

### 4.2 导出类型

```ts
export type TaskExecutionStatus = "completed" | "current" | "locked";
```

类型只描述前端推导状态，不写入 `Task`，不持久化。

### 4.3 函数设计

#### getCurrentTaskIndex(tasks)

输入：`Array<{ completed: boolean }>`

输出：`number | null`

规则：

- 返回第一个 `completed === false` 的任务索引。
- 空数组返回 `null`。
- 全部完成返回 `null`。

#### getTaskExecutionStatus(taskIndex, tasks)

输入：`taskIndex: number`，`tasks: Array<{ completed: boolean }>`

输出：`TaskExecutionStatus`

规则：

- 如果 `tasks[taskIndex]` 不存在，返回 `locked`，避免异常。
- 如果该任务 `completed === true`，返回 `completed`。
- 如果该任务是第一个未完成任务，返回 `current`。
- 其他未完成任务返回 `locked`。

#### hasIncompleteTasks(tasks)

输入：`Array<{ completed: boolean }>`

输出：`boolean`

规则：

- 存在任一 `completed === false` 返回 `true`。
- 空数组返回 `false`。

#### isTaskGroupFullyCompleted(tasks)

输入：`Array<{ completed: boolean }>`

输出：`boolean`

规则：

- 至少有 1 个任务，且全部完成时返回 `true`。
- 空数组返回 `false`，避免把无任务组误判为“已完成任务组”。

#### shouldCarryOverTaskGroup(taskGroup)

输入：`TaskGroup`

输出：`boolean`

规则：

- `taskGroup.tasks` 存在未完成任务。
- `isTaskGroupFromToday(taskGroup) === false`。
- 同时满足才返回 `true`。

实现时从 `@/lib/date-utils` 引入 `isTaskGroupFromToday`，从 `@/lib/types` 引入 `TaskGroup` 类型。

#### isTaskLocked(taskIndex, tasks)

输入：`taskIndex: number`，`tasks: Array<{ completed: boolean }>`

输出：`boolean`

规则：

- 等价于 `getTaskExecutionStatus(taskIndex, tasks) === "locked"`。
- hook 层和组件层都使用该函数，避免状态判断分叉。

### 4.4 边界情况

必须覆盖：

1. 空任务数组不报错。
2. 全部未完成：第 1 个 current，其余 locked。
3. 部分完成：第 1 个未完成 current，后面 locked。
4. 全部完成：全部 completed，无 current。
5. 只有 1 个未完成任务：current。
6. 只有 1 个已完成任务：completed。
7. 取消已完成任务：current 回退到该任务。

### 4.5 验证方式

项目当前没有专门测试框架要求时，Codex 必须做静态或临时脚本验证。

建议实现后运行临时 Node 脚本，只导入或等价复刻纯函数输入输出验证，不提交脚本文件。验证内容至少包括上述 7 个 case。

示例验证目标：

```text
[] -> current null
[false,false] -> current, locked
[true,false,false] -> completed, current, locked
[true,true] -> completed, completed
[false] -> current
[true] -> completed
[true,true,false] 取消 index 1 后 -> completed, current, locked
```

---

## 5. Phase 2：useTaskGroup 恢复与 toggle 保护

### 5.1 当前问题

当前 `useTaskGroup.ts` 在 localStorage 或 Supabase 恢复任务组后，使用：

```ts
setShowNewDayPrompt(!isTaskGroupFromToday(taskGroup));
```

这会把“跨天但未完成”的任务组误导为新一天流程。

### 5.2 新增 hook 状态

在 `useTaskGroup` 内新增：

```ts
const [showCarryoverPrompt, setShowCarryoverPrompt] = useState(false);
```

返回对象新增：

```ts
showCarryoverPrompt
handleContinueCarryover
```

`handleContinueCarryover` 只关闭提示：

```ts
function handleContinueCarryover() {
  setShowCarryoverPrompt(false);
}
```

不要在 hook 内加入 toast 或复杂 UI 文案状态。

### 5.3 恢复逻辑

新增本地 helper，避免 localStorage 和 cloud 分支重复：

```ts
function applyRestoredTaskGroup(restoredTaskGroup: TaskGroup) {
  setTaskGroup(restoredTaskGroup);
  setPageStatus("success");

  const shouldCarryOver = shouldCarryOverTaskGroup(restoredTaskGroup);
  setShowCarryoverPrompt(shouldCarryOver);
  setShowNewDayPrompt(
    !shouldCarryOver && !isTaskGroupFromToday(restoredTaskGroup),
  );
}
```

注意：

- 如果跨天且有未完成任务：`showCarryoverPrompt = true`，`showNewDayPrompt = false`。
- 如果跨天且全部完成：`showCarryoverPrompt = false`，`showNewDayPrompt = true`。
- 如果今天创建：两者都 false。
- 无任务组：两者都 false。

localStorage 恢复时使用该 helper。

Supabase 恢复时也使用同一个 helper。

### 5.4 清理状态时同步关闭 carryover

以下路径必须同步：

- `handleGenerate` 成功后：`setShowCarryoverPrompt(false)`。
- `handleRegenerate` 成功后：`setShowCarryoverPrompt(false)`。
- `handleClearTasks`：`setShowCarryoverPrompt(false)`。
- `handleStartNewDay`：`setShowCarryoverPrompt(false)`。
- 无 cloud task group：`setShowCarryoverPrompt(false)`。
- restore start 时：`setShowCarryoverPrompt(false)`。

### 5.5 toggle 保护

`useTaskGroup` 只能做安全拦截，不能承担 UI 提示。

`handleToggleTask(taskId)` 中：

1. 找到目标任务 index。
2. 如果找不到，返回当前 taskGroup。
3. 如果 `isTaskLocked(targetIndex, currentTaskGroup.tasks)` 为 true，直接返回当前 taskGroup。
4. 只有非 locked 任务继续执行原 toggle、保存 localStorage、保存云端逻辑。

不要把“请先完成上一步，再继续这一步。”放进 hook。
不要在 hook 内新增 toast 状态。
不要改变原有 save localStorage / Supabase 调用顺序。

### 5.6 toggle 返回值

本阶段不要求改变 `handleToggleTask` 的函数签名。UI 提示由组件层在 locked 点击时直接显示。

如果实现阶段认为必须让 hook 返回结果，最多使用简单结果：

```ts
type ToggleTaskResult = "toggled" | "locked" | "not_found";
```

但默认不推荐，避免扩大改动。

---

## 6. Phase 3：NewDayPrompt / Carryover UI

### 6.1 复用 NewDayPrompt

不新增 `CarryoverBanner.tsx`，优先复用 `NewDayPrompt.tsx`。

新增 props：

```ts
type NewDayPromptVariant = "new_day" | "carryover";

interface NewDayPromptProps {
  variant?: NewDayPromptVariant;
  onContinue?: () => void;
  onStartNewDay: () => void;
}
```

`variant` 默认值为 `"new_day"`，减少现有调用风险。

### 6.2 new_day 模式

保持当前视觉和行为：

- 文案继续使用 `UI_TEXT.NEW_DAY_PROMPT`。
- 主按钮继续调用 `onStartNewDay`。
- 不改变原有“开始新的一天”语义。

### 6.3 carryover 模式

显示文案：

```text
你还有未完成的任务，今天继续完成。
```

按钮：

1. “继续推进”
   - 调用 `onContinue`。
   - 只关闭 carryover 提示，不改变任务组。

2. “开始新目标”
   - 调用原有 `onStartNewDay`。
   - 明确清空当前任务组并进入新目标流程。

### 6.4 UI 注意点

- carryover 提示可继续使用 amber 色调，避免新增设计复杂度。
- “继续推进”应是更显眼或靠前的默认动作。
- “开始新目标”是次要动作，但必须可见。
- 不使用弹窗。
- 不新增 toast。

---

## 7. Phase 4：TaskList / TaskItem 顺序状态 UI

### 7.1 TaskList 负责推导状态

在 `TaskList.tsx` 中引入：

```ts
import { getTaskExecutionStatus } from "@/lib/task-execution";
```

在 `tasks.map((task, index) => ...)` 中计算：

```ts
const executionStatus = getTaskExecutionStatus(index, tasks);
```

传给 TaskItem：

```tsx
<TaskItem
  executionStatus={executionStatus}
  taskIndex={index}
  ...
/>
```

不需要把状态写进 `Task`。

### 7.2 TaskItem props

新增：

```ts
import type { TaskExecutionStatus } from "@/lib/task-execution";

interface TaskItemProps {
  taskIndex: number;
  executionStatus: TaskExecutionStatus;
  ...
}
```

### 7.3 completed 渲染

规则：

- checkbox enabled。
- 文本保持 line-through。
- 可以取消勾选。
- 不显示 AI 帮助入口。
- 不显示陪伴入口。

原因：取消已完成任务后，current 会回退到该任务。

### 7.4 current 渲染

规则：

- checkbox enabled。
- 卡片轻微高亮。
- 显示 AI 帮助入口。
- 可以打开 V2.4 Assist。
- 可以通过 Assist 底部进入 V2.5 Companion。

建议样式：

- 边框使用 `border-indigo-200`。
- 背景使用 `bg-indigo-50/40` 或保留当前 hover。
- 不做大规模 UI 美化。

### 7.5 locked 渲染

规则：

- checkbox disabled。
- 卡片整体置灰。
- 文本降低透明度。
- 不显示 AI 帮助入口。
- 不渲染 Assist Panel。
- 不渲染 Companion Panel。
- 卡片整体可点击，用于显示内联提示。

locked 内联提示文案：

```text
请先完成上一步，再继续这一步。
```

### 7.6 locked 提示不能只依赖 disabled checkbox

执行方案必须避免以下问题：disabled checkbox 不触发点击事件，用户没有反馈。

实现要求：

- `TaskItem` 内新增本地 state：

```ts
const [showLockedHint, setShowLockedHint] = useState(false);
```

- locked 卡片外层 `div` 或按钮区域绑定 `onClick`。
- 如果 locked，点击卡片调用：

```ts
setShowLockedHint(true);
```

- 可以用 `setTimeout` 在 2 秒后隐藏，或点击其他任务时自然重渲染隐藏。
- checkbox 本身仍可 disabled。
- 不把该提示状态放进 `useTaskGroup`。

### 7.7 AI 入口显示规则

| executionStatus | AI 帮助入口 | Companion 入口 |
|---|---:|---:|
| completed | 隐藏 | 隐藏 |
| current | 显示 | 通过 Assist Panel 显示 |
| locked | 隐藏 | 隐藏 |

### 7.8 onToggle / onAssist / onCompanion 防御

组件层：

- locked checkbox disabled。
- locked 不显示 AI 按钮。
- locked 不渲染面板。

hook 层：

- `handleToggleTask` 仍必须拦截 locked 任务，防止未来组件误调用。

---

## 8. Phase 5：MainWorkspace 接入

### 8.1 接入 carryover prompt

从 `useTaskGroup()` 解构新增值：

```ts
showCarryoverPrompt,
handleContinueCarryover,
```

渲染逻辑：

```tsx
{showCarryoverPrompt ? (
  <NewDayPrompt
    variant="carryover"
    onContinue={handleContinueCarryover}
    onStartNewDay={handleStartNewDayWithStats}
  />
) : null}

{showNewDayPrompt ? (
  <NewDayPrompt
    variant="new_day"
    onStartNewDay={handleStartNewDayWithStats}
  />
) : null}
```

由于 `useTaskGroup` 会保证两者不会同时为 true，UI 不应出现两个提示。

### 8.2 保持 assist / companion 互斥不变

保留当前逻辑：

- 打开 assist 时关闭 companion。
- 打开 companion 时关闭 assist。

不修改 `useTaskAssist.ts`。
不修改 `useTaskCompanion.ts`。
不修改 V2.5 companion API。

### 8.3 任务生成、复盘、历史、统计

以下逻辑不改：

- `handleGenerateWithStats`
- `handleToggleTaskWithStats`
- `handleClearTasksWithStats`
- `handleRegenerateWithStats`
- `TaskReviewPanel`
- `HistoryPanel`
- `StatsBar`

唯一注意：locked 任务被点击时不会触发 `handleToggleTaskWithStats`，因此不会刷新 stats；这是正确行为。

### 8.4 面板关闭防御

当 current 变化后，原来打开的 assist/companion 可能属于已完成任务。

最小方案：

- 在 `TaskItem` 层，非 current 不渲染 AI 入口和面板。
- 如果 active id 指向 completed/locked 任务，面板自然消失。
- 不需要在 `MainWorkspace` 中额外监听 current 变化清空 active id。

如果实现时发现 stale 面板残留，允许在 `TaskList` 中只对 current 渲染面板作为最终防线。

---

## 9. Phase 6：验证方案

### 9.1 命令验证

必须运行：

```bash
npm run lint
npm run build
git status --short
```

### 9.2 纯函数验证

必须通过临时脚本或等价静态验证覆盖：

1. 空任务数组 → 不报错，current 为 null。
2. 全部未完成 → 第 1 个 current，其余 locked。
3. 部分完成 → 第 1 个未完成 current，后面 locked。
4. 全部完成 → 全部 completed，无 current。
5. 只有 1 个未完成任务 → current。
6. 只有 1 个已完成任务 → completed。
7. 取消已完成任务 → current 回退到该任务。

### 9.3 手动验收清单

未完成任务继承：

1. 昨天任务组存在未完成任务，今天进入 `/app`。
2. 不显示“新的一天，开始新的目标吧”。
3. 显示“你还有未完成的任务，今天继续完成。”
4. 点击“继续推进”，提示关闭，任务保留。
5. 点击“开始新目标”，清空旧任务，进入新目标流程。
6. 昨天任务组全部完成时，仍允许进入新目标流程。
7. 无任务组时行为不变。

顺序执行：

1. 新任务列表中第一个未完成任务是 current。
2. current 后面的未完成任务是 locked。
3. locked checkbox disabled。
4. 点击 locked 卡片显示“请先完成上一步，再继续这一步。”
5. locked 不显示“AI 帮我一下”。
6. completed 不显示“AI 帮我一下”。
7. current 显示“AI 帮我一下”。
8. 完成 current 后，下一个任务自动成为 current。
9. 取消已完成任务后，current 回退到该任务。
10. 全部完成后 CompleteAllPrompt 正常显示。

AI 回归：

1. current 任务的 V2.4 四个按钮正常：怎么开始、拆小一点、5 分钟版本、我卡住了。
2. current 任务可以进入 V2.5 “开始陪我做”。
3. Companion 五个动作正常：我完成了、我卡住了、太难了、鼓励我一下、退出陪伴。
4. AI 不自动勾选任务。
5. locked 任务无法打开 Assist / Companion。

其他回归：

1. 任务生成正常。
2. 清空任务正常。
3. 重新生成正常。
4. 历史记录正常。
5. 统计正常。
6. AI 复盘正常。
7. 登录 / 忘记密码 / 重置密码不受影响。

---

## 10. 不做范围

V2.5.1 明确不做：

1. 不做 V3.0 页面重构。
2. 不做底部导航。
3. 不做任务拖拽排序。
4. 不做任务依赖图。
5. 不做跳过任务。
6. 不做长期记忆。
7. 不做完整聊天系统。
8. 不做数据库 schema 修改。
9. 不做 API 修改。
10. 不改 AI Prompt。
11. 不改 AI Parser。
12. 不改 Auth。
13. 不改 package.json / package-lock.json。
14. 不改 .env.local。
15. 不改 `ai-client.ts`。
16. 不改 `useTaskAssist.ts`。
17. 不改 `useTaskCompanion.ts`。
18. 不新增 npm 依赖。
19. 不新增 task status 持久化字段。
20. 不新增 toast 系统。

---

## 11. 风险与缓解

### 11.1 P0 风险

1. 任务状态推导错误导致所有任务被锁住
   - 缓解：task-execution 纯函数必须覆盖空数组、全部完成、全部未完成、单任务、取消完成等 case。

2. useTaskGroup 恢复逻辑误清空任务
   - 缓解：只修改 prompt 判断，不修改 localStorage / Supabase 加载和保存结构。

3. locked 保护破坏正常 toggle
   - 缓解：只在 `isTaskLocked(index, tasks)` 为 true 时 return；current 和 completed 保持原 toggle 逻辑。

### 11.2 P1 风险

1. 用户想换目标却感觉被旧任务困住
   - 缓解：carryover 提示必须提供“开始新目标”。

2. disabled checkbox 没有反馈
   - 缓解：locked 卡片整体可点击，组件层显示内联提示。

3. AI 面板残留在非 current 任务上
   - 缓解：TaskItem 仅在 current 状态渲染 AI 按钮和面板。

4. 全部完成后仍显示 carryover
   - 缓解：`shouldCarryOverTaskGroup` 必须要求存在未完成任务。

### 11.3 P2 风险

1. 任务顺序不适合某些目标
   - 缓解：V2.5.1 暂不做跳过任务；后续版本再考虑。

2. locked 视觉过强
   - 缓解：使用轻量置灰和内联提示，不做强弹窗。

3. 跨天任务组显示在历史中仍按创建日期
   - 缓解：本阶段不改历史逻辑，接受同一任务组跨天推进。

---

## 12. Codex 实现指令边界

### 12.1 允许新增文件

1. `src/lib/task-execution.ts`

### 12.2 允许修改文件

1. `src/hooks/useTaskGroup.ts`
2. `src/components/NewDayPrompt.tsx`
3. `src/components/MainWorkspace.tsx`
4. `src/components/TaskList.tsx`
5. `src/components/TaskItem.tsx`

### 12.3 禁止修改文件

严禁修改：

1. 数据库 schema / migration。
2. `src/app/api/**`。
3. `src/prompts/**`。
4. `src/lib/ai-client.ts`。
5. `src/lib/task-parser.ts`。
6. `src/lib/review-parser.ts`。
7. `src/lib/task-assist-parser.ts`。
8. `src/lib/task-companion-parser.ts`。
9. `src/hooks/useTaskAssist.ts`。
10. `src/hooks/useTaskCompanion.ts`。
11. `src/hooks/useTaskReview.ts`。
12. `src/hooks/useTaskStats.ts`。
13. `src/hooks/useTaskHistory.ts`。
14. Auth / V2.3 相关文件。
15. `package.json`。
16. `package-lock.json`。
17. `.env.local`。
18. docs 文件，除非用户明确要求更新执行方案。
19. `src/lib/types.ts`，除非实现中证明绝对必要；默认禁止。

### 12.4 每个文件具体改动点

`src/lib/task-execution.ts`：

- 新增 `TaskExecutionStatus`。
- 新增 `getCurrentTaskIndex`。
- 新增 `getTaskExecutionStatus`。
- 新增 `hasIncompleteTasks`。
- 新增 `isTaskGroupFullyCompleted`。
- 新增 `shouldCarryOverTaskGroup`。
- 新增 `isTaskLocked`。

`src/hooks/useTaskGroup.ts`：

- 引入 `shouldCarryOverTaskGroup`、`isTaskLocked`。
- 新增 `showCarryoverPrompt` 状态。
- 新增 `handleContinueCarryover`。
- localStorage / Supabase 恢复时使用统一 helper 设置 `showNewDayPrompt` 和 `showCarryoverPrompt`。
- locked task toggle 时直接 return。
- 不改变保存逻辑。

`src/components/NewDayPrompt.tsx`：

- 新增 `variant`。
- 新增 `onContinue`。
- `new_day` 保持旧行为。
- `carryover` 显示继续任务文案和两个按钮。

`src/components/MainWorkspace.tsx`：

- 解构 `showCarryoverPrompt`、`handleContinueCarryover`。
- 渲染 carryover prompt。
- 保持 V2.5 assist / companion 互斥逻辑不变。

`src/components/TaskList.tsx`：

- 引入 `getTaskExecutionStatus`。
- map 时传入 `index` 和 `executionStatus`。

`src/components/TaskItem.tsx`：

- 新增 `executionStatus` / `taskIndex` props。
- locked checkbox disabled。
- locked 卡片点击显示内联提示。
- AI 帮助入口只在 current 显示。
- completed/current/locked 三种视觉状态。

### 12.5 git status 预期

实现完成后，除长期未跟踪项外，预期只出现：

```text
 M src/hooks/useTaskGroup.ts
 M src/components/NewDayPrompt.tsx
 M src/components/MainWorkspace.tsx
 M src/components/TaskList.tsx
 M src/components/TaskItem.tsx
?? src/lib/task-execution.ts
```

如果 V2.5 未提交变更仍在工作区，Codex 必须在汇报中区分“既有 V2.5 未提交变更”和“本次 V2.5.1 新增变更”，不得误判为越界。

### 12.6 验证命令

必须运行：

```bash
npm run lint
npm run build
git status --short
```

还必须做 task-execution 纯函数静态或临时脚本验证。

### 12.7 最终汇报格式

实现阶段最终汇报必须包含：

1. V2.5.1 是否实现完成。
2. 修改 / 新增文件清单。
3. 是否只改允许文件。
4. task-execution 纯函数验证结果。
5. 未完成任务继承逻辑说明。
6. 顺序执行逻辑说明。
7. locked 点击提示实现方式。
8. AI Assist / Companion 是否只服务 current。
9. `npm run lint` 结果。
10. `npm run build` 结果。
11. `git status --short` 输出。
12. 是否未提交、未 push。
13. 是否发现需要 Claude Code / ChatGPT 决策的问题。

---

## 13. Claude Code Review 清单

1. 是否未改数据库 schema。
2. 是否未改 API route。
3. 是否未改 prompt/parser/ai-client。
4. 是否未改 Auth / V2.3 文件。
5. 是否未改 package.json / package-lock.json。
6. 是否 task-execution 纯函数正确。
7. 是否覆盖空数组、全部未完成、部分完成、全部完成、单任务、取消完成等 case。
8. 是否 carryover 判断正确。
9. 是否跨天未完成任务不再显示 new day prompt。
10. 是否 showNewDayPrompt 不再误引导放弃未完成任务。
11. 是否 carryover 提示有“继续推进”和“开始新目标”。
12. 是否 locked 任务不能勾选。
13. 是否 hook 层也拦截 locked toggle。
14. 是否 locked 点击有内联提示。
15. 是否没有把 UI 提示状态塞进 useTaskGroup。
16. 是否 current 完成后下一个自动解锁。
17. 是否取消已完成任务后 current 回退。
18. 是否 AI 帮助入口只出现在 current。
19. 是否 completed 不显示 AI 帮助入口。
20. 是否 locked 不显示 AI 帮助入口。
21. 是否 V2.4 四个按钮正常。
22. 是否 V2.5 陪伴模式正常。
23. 是否任务生成不受影响。
24. 是否历史不受影响。
25. 是否统计不受影响。
26. 是否复盘不受影响。
27. 是否 lint/build 通过。

---

## 14. 验收标准

### 14.1 未完成任务继承

1. 存在跨天未完成任务组时，进入 `/app` 继续显示该任务组。
2. 跨天未完成任务组不显示“新的一天，开始新的目标吧”。
3. 跨天未完成任务组显示：“你还有未完成的任务，今天继续完成。”
4. 点击“继续推进”只关闭提示，不清空任务。
5. 点击“开始新目标”调用原 `handleStartNewDay`，进入新目标流程。
6. 跨天但全部完成的任务组不进入 carryover。
7. 无任务组时原有空状态不变。

### 14.2 顺序执行

1. 第一个未完成任务为 current。
2. current 前已完成任务为 completed。
3. current 后未完成任务为 locked。
4. locked 不可勾选。
5. 点击 locked 卡片显示“请先完成上一步，再继续这一步。”
6. current 完成后，下一个任务自动成为 current。
7. 取消已完成任务后，current 回退到该任务。
8. 全部完成后显示原 CompleteAllPrompt。

### 14.3 AI 入口

1. current 任务显示“AI 帮我一下”。
2. completed 任务不显示“AI 帮我一下”。
3. locked 任务不显示“AI 帮我一下”。
4. current 任务可打开 V2.4 Assist。
5. current 任务可从 Assist 进入 V2.5 Companion。
6. locked 任务不能打开 Companion。
7. AI 不自动勾选任务。
8. AI 不自动创建任务。
9. AI 不自动跳过任务。

### 14.4 回归

1. 任务生成正常。
2. 清空任务正常。
3. 重新生成正常。
4. 历史记录正常。
5. 统计正常。
6. AI 复盘正常。
7. 登录 / 注册 / 忘记密码 / 重置密码正常。
8. `npm run lint` 通过。
9. `npm run build` 通过。
10. `git status --short` 只包含允许范围内变更和既有长期未跟踪项。