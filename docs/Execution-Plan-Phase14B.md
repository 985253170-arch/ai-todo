# Phase 14B 执行方案 — AI 复盘 UI

> **状态**：设计阶段，待 Review 通过后开发
> **依赖**：Phase 14A（全部完成并通过验收）
> **上级文档**：[Architecture-Phase14.md](./Architecture-Phase14.md)
> **前置方案**：[Execution-Plan-Phase14A.md](./Execution-Plan-Phase14A.md)
> **制定日期**：2026-07-01

---

## 目录

- [1. Phase 14B 目标](#1-phase-14b-目标)
  - [1.4 Phase 14B 不做](#14-phase-14b-不做)
  - [1.5 Phase 14A P2 项不处理声明](#15-phase-14a-p2-项不处理声明)
- [2. 允许修改文件](#2-允许修改文件)
- [3. 禁止修改文件](#3-禁止修改文件)
- [4. 现有前端结构检查](#4-现有前端结构检查)
- [5. UI 位置设计](#5-ui-位置设计)
- [6. TaskReviewPanel 状态机设计](#6-taskreviewpanel-状态机设计)
- [7. useTaskReview hook 设计](#7-usetaskreview-hook-设计)
- [8. page.tsx 集成设计](#8-pagetsx-集成设计)
- [9. 错误处理设计](#9-错误处理设计)
- [10. 移动端适配](#10-移动端适配)
- [11. 并发控制设计](#11-并发控制设计)
- [12. 文件级改动计划](#12-文件级改动计划)
- [13. 手动测试清单](#13-手动测试清单)
- [14. P0/P1/P2 风险自查](#14-p0p1p2-风险自查)
- [15. 是否建议进入 Codex 实现](#15-是否建议进入-codex-实现)
- [16. 给 Codex 的实现边界提醒](#16-给-codex-的实现边界提醒)

---

## 1. Phase 14B 目标

### 1.1 一句话目标

实现 AI 复盘前端 UI——用户在 TaskList 下方看到"生成今日复盘"按钮，点击后调用 Phase 14A 的 `POST /api/task-groups/review`，展示 AI 返回的 `feedbackText`。

### 1.2 交付物

| # | 交付物 | 类型 | 说明 |
|---|--------|------|------|
| 1 | `src/hooks/useTaskReview.ts` | 新建 | 管理 AI 复盘全部状态（review / loading / error / isStale） |
| 2 | `src/components/TaskReviewPanel.tsx` | 新建 | 复盘入口 + 结果展示 UI，含 7 种状态 |
| 3 | `src/app/page.tsx` | 修改 | 集成 TaskReviewPanel（胶水层，仅传参） |

### 1.3 验收标准

1. 有 active task_group 且有 tasks（`tasks.length > 0`）时显示"生成今日复盘"按钮
2. 点击按钮后显示 loading 态（按钮禁用 + 动画 + "正在生成复盘…"）
3. 复盘成功展示 `feedbackText`（首版只展示 feedbackText，不展示 sections）
4. 无任务时不显示复盘入口（`tasks.length === 0` → `hidden`）
5. 无 active task_group 时不显示复盘入口（`taskGroup === null` → `hidden`）
6. 错误状态显示温和文案 + "重试"按钮
7. 任务 toggle 后复盘标记为 stale（显示提示 + "重新生成"按钮）
8. Stale 不清空旧 review 内容（半透明遮罩 + 提示）
9. 清空任务后（`handleClearTasks` / `handleStartNewDay`）复盘自动清空（taskGroup 变为 null → resetReview）
10. 重新生成任务后（`handleGenerate` / `handleRegenerate`）复盘自动清空（新 taskGroup → resetReview）
11. 登录/登出后复盘自动重置（taskGroup 变化链式触发）
12. 手机端布局正确（卡片全宽，触控区域 ≥ 44×44px）
13. `npm run lint` + `npm run build` 通过

### 1.4 Phase 14B 不做

```
❌ 不修改 src/app/api/task-groups/review/route.ts
❌ 不修改 src/lib/ai-client.ts
❌ 不修改 src/lib/review-parser.ts
❌ 不修改 src/prompts/task-review.ts
❌ 不修改 src/lib/stats-calculator.ts
❌ 不修改 src/app/api/generate-tasks/route.ts
❌ 不修改 src/app/api/task-groups/stats/route.ts
❌ 不修改 src/app/api/task-groups/history/route.ts
❌ 不修改 src/app/api/task-group/load/route.ts
❌ 不修改 TaskList / StatsBar / HistoryPanel / Header / GoalInput 等现有组件核心逻辑
❌ 不修改 useTaskGroup / useTaskStats / useTaskHistory 核心逻辑
❌ 不修改 src/lib/types.ts（ReviewData 等类型已在 Phase 14A 完备）
❌ 不修改 src/lib/constants.ts
❌ 不修改 Supabase schema / 不新增数据库表
❌ 不新增 npm 依赖
❌ 不进入 Phase 14C / 14D / 15
❌ 不展示 suggestedDifficulty / suggestedTaskCountRange 给用户
❌ 不展示 sections（summary / encouragement / nextStep）给用户（首版仅 feedbackText）
❌ 不实现任务自动调整
❌ 不修改 generate-tasks 策略
❌ 不持久化复盘结果（刷新页面后复盘丢失，用户需重新生成——符合 Architecture §10.2）
❌ 不处理 Phase 14A 的 P2 项（详见下方 §1.5）
```

### 1.5 Phase 14A P2 项不处理声明

Phase 14A Review 结论中记录了 3 项 P2（`await computeAllStats` 多余、任务格式多余字段、`task_group_` 前缀注释）。Phase 14B **明确不处理这些 Phase 14A P2**——它们不阻塞复盘 UI 功能，留到 Phase 14C 或单独小修中处理。

**理由**：
- Phase 14B 范围已严格限定为 3 个文件（useTaskReview.ts + TaskReviewPanel.tsx + page.tsx），扩展范围会增加风险
- Phase 14A P2 涉及 API route / review-parser / types / stats-calculator——均不在 Phase 14B 允许修改列表中
- 这些 P2 是代码清洁度改进，不影响功能正确性，不应与 UI 实现混在同一个 Phase 中

---

## 2. 允许修改文件

### 2.1 最终允许列表（共 3 个）

| # | 文件 | 操作 | 改动量估算 | 性质 |
|---|------|------|:---:|------|
| 1 | `src/hooks/useTaskReview.ts` | 新建 | ~130 行 | 核心状态管理 |
| 2 | `src/components/TaskReviewPanel.tsx` | 新建 | ~150 行 | 纯展示组件 |
| 3 | `src/app/page.tsx` | 修改 | +25 行 | 胶水层集成 |

**总计**：~305 行新增/修改代码，零行删除或重构现有代码。

### 2.2 各文件详细说明

#### 2.2.1 `src/hooks/useTaskReview.ts`（新建）

**文件定位**：Phase 14B 核心状态管理 hook。管理复盘的全部生命周期——生成请求、状态转换、stale 检测、重置。与 Phase 13 `useTaskStats` 的 inflightRef 模式保持一致。

**函数签名**：

```typescript
interface UseTaskReviewOptions {
  taskGroupId: string | undefined;
  taskGroupUpdatedAt: string | undefined;
  taskCount: number;
  deviceId: string;
  timezoneOffset: number;
}

interface UseTaskReviewReturn {
  review: ReviewData | null;
  isLoading: boolean;
  error: string | null;
  isStale: boolean;
  generateReview: () => Promise<void>;
  resetReview: () => void;
}

function useTaskReview(options: UseTaskReviewOptions): UseTaskReviewReturn;
```

**为什么不需要 `authUserId` 参数**：auth 变化在 `useTaskGroup` 中已经触发了 `taskGroup` 的重置（先设为 null → 再从新身份加载）。`useTaskReview` 通过监听 `taskGroupId` 的变化（从旧 ID → undefined → 新 ID）自然实现 auth 切换时的 review 重置。无需重复引入 `useAuth`。

**内部状态**：

```typescript
const [review, setReview] = useState<ReviewData | null>(null);
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [isStale, setIsStale] = useState(false);
const inflightRef = useRef<Promise<void> | null>(null);
const reviewedAtVersionRef = useRef<string | null>(null);
```

#### 2.2.2 `src/components/TaskReviewPanel.tsx`（新建）

**文件定位**：纯展示组件，接收 `useTaskReview` 的全部返回值作为 props。内部不管理任何状态，不调用任何 API。所有业务逻辑在 `useTaskReview` 中完成。

**Props 接口**：

```typescript
interface TaskReviewPanelProps {
  taskCount: number;
  review: ReviewData | null;
  isLoading: boolean;
  error: string | null;
  isStale: boolean;
  onGenerate: () => void;
  onReset: () => void;
}
```

**empty 状态判断**：`TaskReviewPanel` 内部第一行逻辑：
```typescript
if (taskCount === 0) return null;
```
`taskCount === 0` 时不渲染按钮或卡片（静默）。理由：无任务 = 无复盘内容，显示入口无意义。

**组件内部包含**：

| 子模块 | 职责 | 渲染条件 |
|--------|------|---------|
| `ReviewButton` | "生成今日复盘"按钮 | `!review && !isLoading`（ready 状态） |
| `ReviewLoading` | 加载动画 + "正在生成复盘…" | `isLoading === true` |
| `ReviewCard` | 展示 feedbackText | `review !== null`（success / stale 状态） |
| `ReviewStaleNotice` | 任务变化提示 + "重新生成"按钮 | `isStale && review` |
| `ReviewError` | 错误文案 + "重试"按钮 | `error !== null` |

**不拆分独立子组件文件**——Phase 14 首版复盘 UI 逻辑简单（~150 行），TaskReviewPanel 内部包含所有 UI 子模块即可。拆分标准参考 Architecture §11.6。

#### 2.2.3 `src/app/page.tsx`（修改）

**修改范围**：仅新增 3 个代码块，不修改任何已有代码：

1. 新增 `import` 语句（2 行）
2. 新增 `useTaskReview` 调用（~10 行）
3. 新增 `<TaskReviewPanel>` 渲染（~10 行，在 TaskList 和 HistoryPanel 之间）

---

## 3. 禁止修改文件

Phase 14B 严格限定只修改上述 3 个文件。以下文件**绝不允许修改**：

```
src/lib/types.ts                         ← 已在 Phase 14A 完备，无需修改
src/lib/ai-client.ts                     ← Phase 14A 产物
src/lib/review-parser.ts                  ← Phase 14A 产物
src/lib/stats-calculator.ts              ← Phase 13 产物
src/lib/supabase-server.ts
src/lib/supabase-client.ts
src/lib/device-id.ts
src/lib/constants.ts
src/prompts/task-review.ts               ← Phase 14A 产物
src/prompts/task-generation.ts
src/app/api/task-groups/review/route.ts  ← Phase 14A 产物（核心红线）
src/app/api/generate-tasks/route.ts
src/app/api/task-groups/stats/route.ts
src/app/api/task-groups/history/route.ts
src/app/api/task-group/load/route.ts
src/app/api/task-group/save/route.ts
src/app/api/task-group/delete/route.ts
src/app/api/task-group/migrate/route.ts
src/components/TaskList.tsx              ← 不修改核心逻辑
src/components/StatsBar.tsx              ← 不修改核心逻辑
src/components/HistoryPanel.tsx          ← 不修改核心逻辑
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
src/hooks/useTaskGroup.ts                ← 不修改
src/hooks/useTaskStats.ts                ← 不修改
src/hooks/useTaskHistory.ts              ← 不修改
src/hooks/useAuth.ts                     ← 不修改
任何数据库 schema / migration 文件
package.json
```

---

## 4. 现有前端结构检查

### 4.1 page.tsx 当前组件渲染顺序

```
1. Header          — 标题 + 登录/登出 + 历史面板开关
2. HeroSection     — 产品描述
3. GoalInput       — 目标输入 + 生成任务按钮
4. StatsBar        — 2×2 统计卡片网格（今日完成率 / 最近 7 天 / 连续行动 / 总完成任务）
5. NewDayPrompt    — 条件渲染：showNewDayPrompt 为 true 时显示
6. LoadingState    — 条件渲染：pageStatus === "loading" 时显示
7. TaskList        — 任务列表 + 进度条 + 清空/重新生成按钮
8. HistoryPanel    — 条件渲染：isOpen 为 true 时显示历史记录
```

**关键观察**：TaskList 和 HistoryPanel 之间目前没有其他组件。`<div id="history-panel">` 包裹 HistoryPanel，TaskReviewPanel 应插入在 TaskList 之后、`<div id="history-panel">` 之前。

### 4.2 page.tsx 数据获取方式

| 数据 | 来源 | 取值方式 |
|------|------|---------|
| `taskGroup` | `useTaskGroup()` | `taskGroup: TaskGroup \| null` |
| `taskGroup.id` | `useTaskGroup()` | `taskGroup?.id` |
| `taskGroup.updatedAt` | `useTaskGroup()` | `taskGroup?.updatedAt` |
| `tasks` | `useTaskGroup()` | 从 taskGroup 解构，`tasks = taskGroup?.tasks ?? []` |
| `taskCount` | `useTaskGroup()` | `totalCount`（来自 `tasks.length`） |
| `deviceId` | page.tsx 调用 `getOrCreateDeviceId()` | page.tsx 获取后通过 props 传入 useTaskReview。useTaskReview 不直接导入 `getOrCreateDeviceId` |
| `timezoneOffset` | 运行时计算 | `new Date().getTimezoneOffset()` |
| `stats` | `useTaskStats()` | `taskStats.stats` |

**page.tsx 当前未导入 `useAuth`**——auth 状态由 `useTaskGroup` 和 `useTaskStats` 内部各自管理。

### 4.3 useTaskGroup 关键行为

| 操作 | taskGroup 变化 | id 变化？ | updatedAt 变化？ |
|------|:---:|:---:|:---:|
| `handleGenerate()` | 新 taskGroup | ✅ 新 id | ✅ 新值 |
| `handleRegenerate()` | 新 taskGroup | ✅ 新 id | ✅ 新值 |
| `handleToggleTask(taskId)` | 原地更新 | ❌ 同 id | ✅ `new Date().toISOString()` |
| `handleClearTasks()` | 设为 null | ❌→undefined | ❌→undefined |
| `handleStartNewDay()` | 设为 null | ❌→undefined | ❌→undefined |
| 登录/登出 | 先 null → 后新值 | 变化 | 变化 |

**对 useTaskReview 的影响**：

| useTaskGroup 操作 | useTaskReview 预期行为 |
|------|------|
| generate / regenerate | `taskGroupId` 变化 → `resetReview()` → `isStale = false` |
| toggleTask | `taskGroupUpdatedAt` 变化 → `isStale = true`（不清空 review） |
| clearTasks / startNewDay | `taskGroupId` 变为 undefined → `resetReview()` → 回到 hidden |
| 登录/登出 | taskGroup 先 null → 后新值 → `resetReview()` |

### 4.4 useTaskStats 模式借鉴

从 [src/hooks/useTaskStats.ts](../src/hooks/useTaskStats.ts) 借鉴的核心模式：

```typescript
// 1. inflightRef 并发控制
const inflightRef = useRef<Promise<void> | null>(null);

const refreshStats = useCallback(async () => {
  if (inflightRef.current) {
    return inflightRef.current;  // 复用进行中的请求
  }
  const promise = (async () => { /* fetch */ })();
  inflightRef.current = promise;
  return promise;
}, []);

// 2. 错误处理
} catch (statsError) {
  setError(statsError instanceof Error ? statsError.message : DEFAULT_ERROR_MESSAGE);
} finally {
  setIsLoading(false);
  inflightRef.current = null;
}

// 3. auth 变化重新加载
useEffect(() => {
  if (isAuthLoading) return;
  void refreshStats();
}, [isAuthLoading, refreshStats, user?.id]);
```

### 4.5 StatsBar UI 风格

- **卡片容器**：`rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)]`
- **2×2 网格**：`grid grid-cols-2 gap-3 sm:grid-cols-4`
- **加载态**：`animate-pulse` + 骨架占位
- **错误态**：`border border-slate-200 bg-white/85` + 错误文案 + 重试按钮（`rounded-full bg-indigo-50 text-indigo-700`）
- **StatCard 内**：`rounded-2xl border border-indigo-100 bg-white/85`，标题 `text-xs text-slate-400`，数值 `text-xl font-semibold text-slate-800`

### 4.6 TaskList 下方插入位置

```tsx
// page.tsx 当前代码（第 141-163 行）：
<TaskList ... />                          // ← TaskList 结束
<div id="history-panel" ref={historyPanelRef}>  // ← 插入点（TaskList 之后、此 div 之前）
  <HistoryPanel ... />
</div>
```

**插入位置确认**：`<TaskReviewPanel>` 放在 `<TaskList>` 和 `<div id="history-panel">` 之间。

### 4.7 HistoryPanel 不修改确认

HistoryPanel 通过 `isOpen` 控制显隐，内部是独立 section。TaskReviewPanel 在其上方，不需要修改 HistoryPanel 的任何代码。

### 4.8 types.ts 前端类型完备性确认

| 前端需要的类型 | 是否已在 Phase 14A 定义 | 位置 |
|------|:---:|------|
| `ReviewData` | ✅ | `src/lib/types.ts:190-195` |
| `ReviewSuccessResponse` | ✅ | `src/lib/types.ts:197-200` |
| `ReviewErrorResponse` | ✅ | `src/lib/types.ts:202-209` |
| `ReviewResponse` | ✅ | `src/lib/types.ts:210` |
| `ReviewErrorCode` | ✅ | `src/lib/types.ts:169-180` |
| `SuggestedDifficulty` | ✅ | `src/lib/types.ts:182` |
| `ReviewSections` | ✅ | `src/lib/types.ts:184-188` |

**结论：types.ts 已完全满足 Phase 14B 前端使用，无需追加任何类型。**

---

## 5. UI 位置设计

### 5.1 渲染顺序

```
GoalInput         ← 不改：目标输入
StatsBar           ← 不改：统计卡片（2×2 网格）
NewDayPrompt       ← 不改：条件渲染
LoadingState       ← 不改：条件渲染
TaskList           ← 不改：任务列表（主流程）
TaskReviewPanel    ← NEW：复盘入口 + 结果展示
HistoryPanel       ← 不改：历史记录
```

### 5.2 设计理由

| 理由 | 说明 |
|------|------|
| **复盘不挡执行** | 用户先看到任务，先执行。复盘是执行后的反馈，放在 TaskList 后面符合"先做后复盘"的认知顺序 |
| **复盘不抢主流程** | TaskList 是核心操作区（勾选/清空/重新生成），复盘是辅助功能，不抢占视觉焦点 |
| **StatsBar 已有状态提示** | 统计卡片在 TaskList 上方承担了"今日进度概览"角色，复盘不需要在任务前展示 |
| **符合架构设计** | Architecture §11.1 明确采用方案 B：TaskList 下方、HistoryPanel 上方 |
| **HistoryPanel 不受影响** | 历史面板在复盘卡片下方，互不干扰 |

### 5.3 page.tsx 集成后的 JSX 结构

```tsx
<main>
  <div className="mx-auto ...">
    <Header ... />
    <HeroSection />
    <div className="grid gap-5">
      <GoalInput ... />
      <StatsBar ... />
      {showNewDayPrompt ? <NewDayPrompt ... /> : null}
      {pageStatus === "loading" ? <LoadingState /> : null}
      <TaskList ... />

      {/* ─── Phase 14B 新增 ─── */}
      {taskGroup ? (
        <TaskReviewPanel
          taskCount={totalCount}
          error={taskReview.error}
          isLoading={taskReview.isLoading}
          isStale={taskReview.isStale}
          onGenerate={taskReview.generateReview}
          onReset={taskReview.resetReview}
          review={taskReview.review}
        />
      ) : null}

      <div id="history-panel" ref={historyPanelRef}>
        <HistoryPanel ... />
      </div>
    </div>
  </div>
</main>
```

**关键设计决策**：

- `taskGroup` 为 null 时整个 TaskReviewPanel 不渲染（React 条件渲染 `null`）→ 天然满足 hidden 状态
- `taskGroup` 为非 null 但 `tasks.length === 0` 时，TaskReviewPanel 内部判断为 empty 状态
- TaskReviewPanel 不关心 `taskGroup` 的细节——它只消费 `useTaskReview` 的返回值

---

## 6. TaskReviewPanel 状态机设计

### 6.1 状态定义

| # | 状态 | 触发条件 | UI 展示 |
|:--:|------|------|------|
| 1 | **hidden** | `taskGroup === null`（由 page.tsx 条件渲染处理） | 不渲染任何复盘 UI |
| 2 | **empty** | `taskGroup !== null` 且 `taskCount === 0`（由 TaskReviewPanel 的 `taskCount` prop 判断 → `return null`） | 不显示按钮/卡片（静默）。理由：无任务 = 无复盘内容，显示入口无意义 |
| 3 | **ready** | `taskCount > 0` 且 `review === null` 且 `!isLoading` 且 `!error` | 显示"💬 生成今日复盘"按钮 |
| 4 | **loading** | `isLoading === true` | 按钮替换为 loading 指示器（spinner + "正在生成复盘…"） |
| 5 | **success** | `review !== null` 且 `!isStale` 且 `!isLoading` | 显示 ReviewCard（feedbackText），不显示按钮 |
| 6 | **stale** | `review !== null` 且 `isStale === true` | ReviewCard 上方显示提示 + "重新生成"按钮；原有内容半透明 |
| 7 | **error** | `error !== null` 且 `!isLoading` | 显示温和错误文案 + "重试"按钮 |

### 6.2 状态转换图

```
hidden ──→ empty ──→ ready ──→ loading ──→ success ──→ stale ──→ loading ──→ success
  ↑                    ↑          │            │          │                      │
  │                    │          │            │          │                      │
  └── clearTasks ──────┘          │            │          └── resetReview ───────┘
  └── startNewDay ────→ hidden    │            │
                                  │            │
                                  ↓            ↓
                                error         error
                                  │            │
                               onRetry ───→ loading
```

### 6.3 状态优先级

TaskReviewPanel 内部按以下优先级判断渲染状态：

```
1. hidden      → page.tsx 不渲染该组件 (taskGroup === null)
2. empty       → props.taskCount === 0 → return null（不渲染按钮）
3. error       → error !== null && !isLoading
4. loading     → isLoading === true
5. stale       → review !== null && isStale === true
6. success     → review !== null && !isStale
7. ready       → review === null && !isLoading && !error（fallback）
```

### 6.4 各状态 UI 详细设计

#### 6.4.1 ready 状态

```
┌──────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────┐│
│  │         💬 生成今日复盘                    ││
│  └──────────────────────────────────────────┘│
└──────────────────────────────────────────────┘
```

- 按钮样式：`rounded-full bg-indigo-50 text-indigo-700 font-semibold hover:bg-indigo-100`（与 StatsBar 重试按钮风格一致）
- 最小触控高度：`min-h-11`（≥ 44px）
- 全宽按钮，居中文字

#### 6.4.2 loading 状态

```
┌──────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────┐│
│  │         ◌ 正在生成复盘…                    ││
│  └──────────────────────────────────────────┘│
└──────────────────────────────────────────────┘
```

- 按钮变为禁用态（`disabled` + `cursor-not-allowed opacity-60`）
- 左侧 spinner 动画（CSS `animate-spin`，使用 emoji 或 tailwind 动画的 SVG 圈）
- 文字 "正在生成复盘…"

#### 6.4.3 success 状态

```
┌──────────────────────────────────────────────┐
│  💬 今日复盘                                  │
│                                              │
│  今天完成了 3 个任务，已经把目标往前推进了一步。│
│  剩下 2 个任务可以从最小的一步开始，明天继续    │
│  推进。你已经连续行动 5 天了，节奏很稳定。      │
└──────────────────────────────────────────────┘
```

- 卡片容器：`rounded-2xl border border-indigo-100 bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)]`（与 TaskList 风格一致）
- 标题：`text-sm font-semibold text-indigo-600` → "💬 今日复盘"
- 正文：`text-sm leading-relaxed text-slate-700 whitespace-pre-line`（保留 AI 返回的自然换行）
- **首版只展示 feedbackText**，不展示 sections（summary/encouragement/nextStep）
- **不展示 suggestedDifficulty / suggestedTaskCountRange**（Phase 15 字段，不可见）

#### 6.4.4 stale 状态（叠加在 success 上）

```
┌──────────────────────────────────────────────┐
│  ⚠️ 任务状态已变化，可重新生成复盘              │
│  [重新生成]                                   │
├──────────────────────────────────────────────┤
│  💬 今日复盘                                  │
│                                              │
│  （ReviewCard 内容，半透明 opacity-50）        │
│  ...                                         │
└──────────────────────────────────────────────┘
```

- stale 提示栏：`bg-amber-50 border-amber-100 rounded-t-2xl px-5 py-3`
- 提示文字：`text-sm text-amber-700`
- "重新生成"按钮：`rounded-full bg-amber-100 text-amber-800 font-medium hover:bg-amber-200 min-h-10`
- 原有 ReviewCard 内容加 `opacity-50`（不清空，用户可能正在阅读）
- **不自动清空 review**——stale 只是标记，让用户决定是否重新生成

#### 6.4.5 error 状态

```
┌──────────────────────────────────────────────┐
│  ⚠️ AI 复盘生成失败，请稍后重试                 │
│  [重试]                                       │
└──────────────────────────────────────────────┘
```

- 错误容器：`border border-amber-100 bg-amber-50 rounded-2xl px-5 py-4`（温和色调，不用红色——复盘是辅助功能，错误不应惊吓用户）
- 错误文字：`text-sm font-medium text-amber-700`
- "重试"按钮：`rounded-full bg-amber-100 text-amber-800 font-semibold hover:bg-amber-200 min-h-10`
- **不展示技术错误信息**（如 HTTP 状态码、错误码原文）——只展示用户友好的中文文案

---

## 7. useTaskReview hook 设计

### 7.1 完整接口定义

```typescript
// src/hooks/useTaskReview.ts — Phase 14B 新建

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReviewData, ReviewResponse } from "@/lib/types";

// ─── 前端错误文案映射（局部常量） ───

const REVIEW_ERROR_MESSAGES: Record<string, string> = {
  NO_ACTIVE_TASK_GROUP: "还没有今天的任务，先生成任务再让 AI 复盘。",
  NO_TASKS_TO_REVIEW: "还没有任务内容，无法生成复盘。",
  AI_REVIEW_FAILED: "AI 复盘生成失败，请稍后重试。",
  AI_RESPONSE_INVALID: "AI 回复格式异常，请重试。",
  RATE_LIMITED: "请求过于频繁，请稍后再试。",
  INTERNAL_ERROR: "服务异常，请稍后重试。",
};

const DEFAULT_ERROR_MESSAGE = "复盘生成失败，请稍后重试。";

// ─── Options ───

interface UseTaskReviewOptions {
  taskGroupId: string | undefined;
  taskGroupUpdatedAt: string | undefined;
  taskCount: number;
  deviceId: string;
  timezoneOffset: number;
}

// ─── Return ───

interface UseTaskReviewReturn {
  review: ReviewData | null;
  isLoading: boolean;
  error: string | null;
  isStale: boolean;
  generateReview: () => Promise<void>;
  resetReview: () => void;
}

export function useTaskReview(options: UseTaskReviewOptions): UseTaskReviewReturn {
  const { taskGroupId, taskGroupUpdatedAt, taskCount, deviceId, timezoneOffset } = options;

  const [review, setReview] = useState<ReviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);

  const inflightRef = useRef<Promise<void> | null>(null);
  const reviewedAtVersionRef = useRef<string | null>(null);
  const prevTaskGroupIdRef = useRef<string | undefined>(taskGroupId);
```

### 7.2 Stale 检测算法

```typescript
  // ─── Stale 检测 ───
  // 规则：当 taskGroupUpdatedAt 与生成复盘时的快照不一致时，标记为 stale

  useEffect(() => {
    // taskGroupId 变化 → 重置一切
    if (taskGroupId !== prevTaskGroupIdRef.current) {
      prevTaskGroupIdRef.current = taskGroupId;

      if (!taskGroupId) {
        // taskGroup 变为 null → 完全重置
        setReview(null);
        setError(null);
        setIsLoading(false);
        setIsStale(false);
        reviewedAtVersionRef.current = null;
        return;
      }

      // taskGroup 变为新的 id → 清空旧复盘
      setReview(null);
      setError(null);
      setIsStale(false);
      reviewedAtVersionRef.current = null;
      return;
    }

    // taskGroupId 不变，检查 updatedAt 是否变化
    if (review && reviewedAtVersionRef.current !== null) {
      if (taskGroupUpdatedAt !== reviewedAtVersionRef.current) {
        setIsStale(true);
      }
    }
  }, [taskGroupId, taskGroupUpdatedAt, review]);
```

**Stale 检测决策表**：

| 场景 | taskGroupId | taskGroupUpdatedAt | reviewedAtVersionRef | 行为 |
|------|:---:|------|------|------|
| 初始挂载 | undefined | undefined | null | 无操作（review 为 null） |
| 初始挂载 | "uuid-a" | "2024-01-01T00:00:00Z" | null | 无操作（review 为 null） |
| 生成复盘后 | "uuid-a" | "2024-01-01T00:00:00Z" | "2024-01-01T00:00:00Z" | isStale = false |
| Toggle 任务后 | "uuid-a" | "2024-01-01T00:01:00Z" | "2024-01-01T00:00:00Z" | **isStale = true** |
| Generate 新任务后 | "uuid-b" | "2024-01-02T00:00:00Z" | — | resetReview() |
| ClearTasks 后 | undefined | undefined | — | 完全重置 |

### 7.3 generateReview 实现

```typescript
  const generateReview = useCallback(async () => {
    // 并发控制：复用进行中的请求（与 useTaskStats.refreshStats 一致）
    if (inflightRef.current) {
      return inflightRef.current;
    }

    // 防御：无 taskGroupId 时不应调用（但 button 在此时不渲染）
    if (!taskGroupId) {
      return;
    }

    const promise = (async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/task-groups/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId,
            taskGroupId,
            timezoneOffset,
          }),
        });

        const result = (await response.json()) as ReviewResponse;

        if (!response.ok || !result.success) {
          const errorCode = result.success ? "INTERNAL_ERROR" : result.error.code;
          const message =
            REVIEW_ERROR_MESSAGES[errorCode] ?? DEFAULT_ERROR_MESSAGE;
          throw new Error(message);
        }

        setReview(result.data);
        setIsStale(false);
        // 记录生成复盘时的 taskGroup 版本快照
        reviewedAtVersionRef.current = taskGroupUpdatedAt ?? null;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : DEFAULT_ERROR_MESSAGE,
        );
      } finally {
        setIsLoading(false);
        inflightRef.current = null;
      }
    })();

    inflightRef.current = promise;
    return promise;
  }, [deviceId, taskGroupId, taskGroupUpdatedAt, timezoneOffset]);
```

**关键设计决策**：

- **显式传入 `taskGroupId` 给 API**：Phase 14B 首版只复盘 active task_group，但前端已知当前 `taskGroup.id`，显式传入可避免后端误取其他 active group。Phase 14A API 已支持 `taskGroupId` 归属校验。仍不开放历史复盘入口（不从 HistoryPanel 触发）。
- **deviceId 从 hook 参数获取**：由 page.tsx 传入（从 `getOrCreateDeviceId()` 调用中获取），与 useTaskStats 模式一致
- **DEFAULT_ERROR_MESSAGE 作为兜底**：覆盖网络异常（fetch throw）和未知 error code
- **isStale 在成功时重置为 false**：复盘重新生成后不再是 stale

### 7.4 resetReview 实现

```typescript
  const resetReview = useCallback(() => {
    setReview(null);
    setError(null);
    setIsStale(false);
    reviewedAtVersionRef.current = null;
  }, []);
```

**resetReview 何时被调用**：
- **内部自动调用**：`useEffect` 检测到 `taskGroupId` 变化（taskGroup 整体替换，如 generate/regenerate/clearTasks/startNewDay）→ 自动执行 reset 逻辑
- **page.tsx 手动调用场景**：Phase 14B 首版 page.tsx 不手动调用 `resetReview`——所有 reset 由 hook 内部的 `useEffect` 自动处理。`resetReview` 暴露给 page.tsx 作为未来扩展的预留接口

### 7.5 为什么不需要 authUserId 参数

```
auth 变化（登录/登出）
  → useTaskGroup 的 onAuthStateChange 回调触发
  → restoreForAuthUser(newUserId)
  → setTaskGroup(null)           ← taskGroupId 变为 undefined
  → useTaskReview useEffect 检测到 taskGroupId 变化
  → 自动 resetReview()
  → restoreForAuthUser 后续 setTaskGroup(newTaskGroup) ← taskGroupId 变为新 id
  → useTaskReview 处于干净状态（review=null, isStale=false）
```

这条链路已由 `useTaskGroup` → `taskGroupId` 变化 → `useTaskReview` useEffect 完整覆盖。无需在 `useTaskReview` 中重复引入 `useAuth`。

---

## 8. page.tsx 集成设计

### 8.1 新增 import

```typescript
// 在现有 import 之后追加：
import { TaskReviewPanel } from "@/components/TaskReviewPanel";
import { useTaskReview } from "@/hooks/useTaskReview";
import { getOrCreateDeviceId } from "@/lib/device-id";
```

注意 `getOrCreateDeviceId` 当前未在 page.tsx 中导入（useTaskGroup 内部自行导入）。Phase 14B 需要在 page.tsx 中导入以获取 deviceId 传给 useTaskReview。

### 8.2 新增 hook 调用

在 `const taskStats = useTaskStats();` 之后追加：

```typescript
const taskReview = useTaskReview({
  taskGroupId: taskGroup?.id,
  taskGroupUpdatedAt: taskGroup?.updatedAt,
  taskCount: totalCount,
  deviceId: getOrCreateDeviceId(),
  timezoneOffset: new Date().getTimezoneOffset(),
});
```

**参数来源**：

| 参数 | 来源 | 说明 |
|------|------|------|
| `taskGroupId` | `taskGroup?.id` | useTaskGroup 返回值。null 时 → undefined |
| `taskGroupUpdatedAt` | `taskGroup?.updatedAt` | useTaskGroup 返回值。null 时 → undefined |
| `taskCount` | `totalCount` | useTaskGroup 返回值。`tasks.length` |
| `deviceId` | `getOrCreateDeviceId()` | 从 device-id.ts 导入 |
| `timezoneOffset` | `new Date().getTimezoneOffset()` | 运行时计算，每次渲染取当前值 |

**timezoneOffset 在每次渲染时重新计算**——`new Date().getTimezoneOffset()` 在每次渲染时取当前时区偏移量。useTaskReview 的 `generateReview` 通过 `useCallback` 的依赖数组 `[..., timezoneOffset]` 在值变化时重新创建函数。这通常不会频繁变化（用户不会在复盘中间切换时区）。

**deviceId 在每次渲染时调用**——`getOrCreateDeviceId()` 在每次渲染时执行。这在当前项目中完全可接受，因为该函数是纯同步的 `localStorage` 读取/创建操作（无网络请求、无异步 I/O），性能开销可忽略。如果 Codex 想优化，可以用 `useMemo(() => getOrCreateDeviceId(), [])` 缓存返回值，但不要因此扩大改动范围——当前写法已足够简洁且正确。

### 8.3 新增组件渲染

在 `<TaskList ... />` 和 `<div id="history-panel" ...>` 之间插入：

```tsx
{taskGroup ? (
  <TaskReviewPanel
    taskCount={totalCount}
    error={taskReview.error}
    isLoading={taskReview.isLoading}
    isStale={taskReview.isStale}
    onGenerate={taskReview.generateReview}
    onReset={taskReview.resetReview}
    review={taskReview.review}
  />
) : null}
```

**条件渲染逻辑**：`taskGroup` 为 null 时不渲染（hidden 状态）。当 `taskGroup` 为非 null 但 `taskCount === 0` 时，TaskReviewPanel 内部判断为 empty → 不渲染按钮/卡片。

### 8.4 page.tsx 完整改动 diff

```diff
 // 现有 import（不改）
 import { HistoryPanel } from "@/components/HistoryPanel";
 ...
+import { TaskReviewPanel } from "@/components/TaskReviewPanel";
+import { useTaskReview } from "@/hooks/useTaskReview";
+import { getOrCreateDeviceId } from "@/lib/device-id";

 export default function Home() {
   ...
   const taskStats = useTaskStats();
+
+  const taskReview = useTaskReview({
+    taskGroupId: taskGroup?.id,
+    taskGroupUpdatedAt: taskGroup?.updatedAt,
+    taskCount: totalCount,
+    deviceId: getOrCreateDeviceId(),
+    timezoneOffset: new Date().getTimezoneOffset(),
+  });

   ...
   return (
     <main>
       ...
           <TaskList ... />
+
+          {taskGroup ? (
+            <TaskReviewPanel
+              taskCount={totalCount}
+              error={taskReview.error}
+              isLoading={taskReview.isLoading}
+              isStale={taskReview.isStale}
+              onGenerate={taskReview.generateReview}
+              onReset={taskReview.resetReview}
+              review={taskReview.review}
+            />
+          ) : null}
+
           <div id="history-panel" ref={historyPanelRef}>
             <HistoryPanel ... />
           </div>
       ...
     </main>
   );
 }
```

**零行删除，零行修改已有代码。** 所有改动为纯追加。

---

## 9. 错误处理设计

### 9.1 前端错误文案映射

| API 错误码 / 场景 | 前端展示文案 | 色调 |
|------|------|------|
| `NO_ACTIVE_TASK_GROUP` | "还没有今天的任务，先生成任务再让 AI 复盘。" | 中性（不应出现——此状态 UI 为 hidden） |
| `NO_TASKS_TO_REVIEW` | "还没有任务内容，无法生成复盘。" | 中性（不应出现——此状态 UI 为 empty） |
| `AI_REVIEW_FAILED` | "AI 复盘生成失败，请稍后重试。" | 温和 amber |
| `AI_RESPONSE_INVALID` | "AI 回复格式异常，请重试。" | 温和 amber |
| `RATE_LIMITED` | "请求过于频繁，请稍后再试。" | 温和 amber |
| `INTERNAL_ERROR` | "服务异常，请稍后重试。" | 温和 amber |
| 网络错误（fetch throw）| "网络连接失败，请检查网络后重试。" | 温和 amber |
| 未知错误（兜底）| "复盘生成失败，请稍后重试。" | 温和 amber |

### 9.2 错误展示原则

| # | 原则 | 实现 |
|---|------|------|
| 1 | 不弹窗、不跳出 | 错误在 TaskReviewPanel 内部展示，不打断用户操作 |
| 2 | 不影响主流程 | TaskList / StatsBar / HistoryPanel 正常使用不受影响 |
| 3 | 温和色调 | 使用 amber（琥珀色）而非 red，降低用户焦虑感 |
| 4 | 不暴露技术细节 | 只展示用户友好文案，不展示 HTTP 状态码、错误码原文、堆栈 |
| 5 | 可重试 | 显示"重试"按钮，点击重新调用 generateReview |
| 6 | 不自动重试 | 失败后等用户手动点击重试（避免 token 浪费） |

### 9.3 各错误码到 UI 状态

```
NO_ACTIVE_TASK_GROUP  → 正常不应出现（taskGroup 为 null 时不渲染按钮）
NO_TASKS_TO_REVIEW    → 正常不应出现（taskCount === 0 时不渲染按钮）
AI_REVIEW_FAILED      → error 状态
AI_RESPONSE_INVALID   → error 状态
RATE_LIMITED          → error 状态
INTERNAL_ERROR        → error 状态
网络异常              → error 状态
```

---

## 10. 移动端适配

### 10.1 布局规则

| 规则 | 实现 |
|------|------|
| 卡片全宽 | `w-full`（默认块级元素），与 TaskList 卡片宽度一致 |
| 触控区域 ≥ 44×44px | 按钮 `min-h-11` = 44px |
| 文案正常换行 | `whitespace-pre-line`，不截断 |
| 内边距适配 | `px-5 py-4`（移动端足够），`sm:px-6 sm:py-5` |
| 不溢出 | 父容器 `max-w-[720px]`，无需额外处理 |
| 安全区域 | 复用 page.tsx 的 `pb-[env(safe-area-inset-bottom,1rem)]` |

### 10.2 移动端效果示意

```
移动端（宽度 < 640px）：

┌────────────────────────────┐
│  GoalInput                 │
│  StatsBar (2×2)            │
│  TaskList                  │
│  ┌──────────────────────┐  │
│  │  💬 生成今日复盘       │  │  ← ready 状态
│  └──────────────────────┘  │
│  ┌──────────────────────┐  │
│  │  💬 今日复盘          │  │
│  │                      │  │  ← success 状态
│  │  今天完成了 3 个...   │  │
│  └──────────────────────┘  │
│  HistoryPanel              │
└────────────────────────────┘
```

### 10.3 桌面端适配

桌面端（≥ 640px）与移动端布局一致——复盘卡片仍在 TaskList 下方，`max-w-[720px]` 居中。不需要桌面端特殊布局。

---

## 11. 并发控制设计

### 11.1 inflightRef 模式（与 useTaskStats 一致）

```typescript
const inflightRef = useRef<Promise<void> | null>(null);

const generateReview = useCallback(async () => {
  // 如果已有进行中的请求，复用其 Promise
  if (inflightRef.current) {
    return inflightRef.current;
  }

  const promise = (async () => {
    // ... fetch + 状态更新
  })();

  inflightRef.current = promise;
  return promise;
}, [...]);
```

### 11.2 并发控制层级

| 层级 | 机制 | 说明 |
|------|------|------|
| **前端 inflightRef** | 同时只允许 1 个进行中的请求 | 防止用户快速双击 |
| **UI 按钮禁用** | `isLoading` 时按钮 `disabled` + `opacity-60` + `cursor-not-allowed` | 视觉反馈 + 物理防重复 |
| **后端 rate limit** | Phase 14A best-effort 内存计数（3 req/60s） | 额外保护层 |

### 11.3 并发行为验证

```
用户快速双击"生成今日复盘"按钮：
  1. 第 1 次点击：inflightRef.current === null → 发起请求
  2. 第 2 次点击：inflightRef.current !== null → 直接返回进行中的 Promise
  3. 按钮 disabled（isLoading = true）→ 视觉上不可再次点击

请求完成后：
  4. finally 中 inflightRef.current = null
  5. isLoading = false → 按钮恢复（如果是 ready 状态）或变为 success
```

---

## 12. 文件级改动计划

### 12.1 实现顺序

```
Step 1: src/hooks/useTaskReview.ts（新建）
  └── useTaskReview hook 完整实现（~130 行）
      包含：状态管理、stale 检测、generateReview、resetReview、inflightRef 并发控制

Step 2: src/components/TaskReviewPanel.tsx（新建）
  └── TaskReviewPanel 纯展示组件（~150 行）
      包含 6 种 UI 状态（empty / ready / loading / success / stale / error）
      hidden 状态由 page.tsx 条件渲染处理

Step 3: src/app/page.tsx（修改 +25 行）
  └── 新增 import + useTaskReview 调用 + TaskReviewPanel 渲染
      零行删除或修改已有代码
```

**推荐实现顺序**：1 → 2 → 3。Hook 先就绪，组件依赖 hook 的接口。两个新文件可以在同一次代码生成中完成，page.tsx 最后集成。

### 12.2 各文件与现有代码的引用关系

| 文件 | 引用（import 来源） | 被引用（import 去向） |
|------|------|------|
| `useTaskReview.ts` | `react`、`@/lib/types` | `page.tsx` |
| `TaskReviewPanel.tsx` | `react`、`@/lib/types` | `page.tsx` |
| `page.tsx`（修改） | `useTaskReview`、`TaskReviewPanel`、`@/lib/device-id` | — |

### 12.3 各文件导入清单

**useTaskReview.ts 导入**：
```typescript
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReviewData, ReviewResponse } from "@/lib/types";
```

**TaskReviewPanel.tsx 导入**：
```typescript
import type { ReviewData } from "@/lib/types";
```

**page.tsx 追加导入**：
```typescript
import { TaskReviewPanel } from "@/components/TaskReviewPanel";
import { useTaskReview } from "@/hooks/useTaskReview";
import { getOrCreateDeviceId } from "@/lib/device-id";
```

---

## 13. 手动测试清单

### 13.1 功能测试

| # | 场景 | 操作 | 预期结果 |
|:--:|------|------|------|
| 1 | 无任务时不显示复盘入口 | 页面初始加载（无 taskGroup）| TaskReviewPanel 不渲染任何内容 |
| 2 | 有任务后显示入口 | 生成任务（goal → generate）| TaskList 下方出现"💬 生成今日复盘"按钮 |
| 3 | 点击生成复盘 | 点击按钮 | 按钮变为 loading（禁用 + "正在生成复盘…"） |
| 4 | 复盘成功展示 | loading 完成 | 显示 ReviewCard，包含 feedbackText 中文案 |
| 5 | 任务 toggle 后变 stale | 复盘成功后勾选/取消勾选任务 | ReviewCard 上方出现 stale 提示 + "重新生成"按钮 |
| 6 | Stale 不清空旧内容 | 查看 stale 状态 | 原有 ReviewCard 内容仍在（半透明），新提示在上方 |
| 7 | 重新生成复盘 | 点击 stale 状态的"重新生成" | 进入 loading → 新复盘替换旧内容 → isStale = false |
| 8 | 清空任务后复盘清空 | 点击"清空"按钮 | TaskReviewPanel 不渲染（taskGroup === null） |
| 9 | 开始新一天后复盘清空 | 点击 NewDayPrompt 的"开始新一天" | 同上 |
| 10 | 重新生成任务后复盘清空 | 输入新 goal → 生成 | 旧复盘消失，按钮恢复为 ready 状态 |
| 11 | 重新生成（regenerate）后复盘清空 | 点击 TaskList 的"重新生成" | 同上 |
| 12 | 全部完成任务后生成复盘 | 勾选全部任务 → 生成复盘 | 复盘文案包含正反馈（"全部完成""节奏很好"） |
| 13 | 部分完成任务后生成复盘 | 勾选部分任务 → 生成复盘 | 复盘文案包含"完成了 X 个""可以继续" |
| 14 | 零完成时生成复盘 | 不勾选任何任务 → 生成复盘 | 复盘文案温和、不批评、建议最小一步 |
| 15 | AI 调用失败（网络断连）| 断开网络 → 点击生成 | 显示"网络连接失败，请检查网络后重试。" + 重试按钮 |
| 16 | 重试成功 | 恢复网络 → 点击重试 | 正常生成复盘 |
| 17 | 快速双击防重复 | 快速点击按钮 2 次 | 只发起 1 次 API 请求（inflightRef） |
| 18 | Loading 中按钮禁用 | 正在生成复盘时尝试点击 | 按钮 disabled，无法触发新请求 |

### 13.2 状态转换测试

| # | 初始状态 | 操作 | 预期最终状态 |
|:--:|------|------|:--:|
| 19 | hidden | 生成任务 | ready |
| 20 | ready | 点击生成 | loading |
| 21 | loading | API 成功返回 | success |
| 22 | loading | API 失败返回 | error |
| 23 | success | 勾选任务 | stale |
| 24 | stale | 点击重新生成 | loading → success |
| 25 | success | 清空任务 | hidden |
| 26 | error | 点击重试 | loading |
| 27 | stale | 清空任务 | hidden |

### 13.3 登录态测试

| # | 场景 | 预期 |
|:--:|------|------|
| 28 | 未登录 → 生成复盘 | 正常展示（device_id 模式） |
| 29 | 已登录 → 生成复盘 | 正常展示（user_id 模式） |
| 30 | 已登录 → 登出 | 复盘自动清空（taskGroup 链式重置） |
| 31 | 未登录 → 登录 | 复盘自动清空 |

### 13.4 移动端测试

| # | 场景 | 预期 |
|:--:|------|------|
| 32 | 手机宽度 < 640px | 复盘卡片全宽，按钮高度 ≥ 44px |
| 33 | 长 feedbackText | 正常换行不截断 |
| 34 | 短 feedbackText | 卡片高度自适应，不留下大片空白 |

### 13.5 质量验收

| # | 验证项 | 方法 |
|:--:|------|------|
| 35 | `npm run lint` 通过 | 命令行 |
| 36 | `npm run build` 通过 | 命令行 |
| 37 | `git status --short` 仅 3 个文件变更 | 命令行 |
| 38 | TaskList 勾选功能正常（不受影响） | 人工 |
| 39 | StatsBar 统计正常（不受影响） | 人工 |
| 40 | HistoryPanel 历史正常（不受影响） | 人工 |
| 41 | generate-tasks 正常（不受影响） | 人工 |
| 42 | 清空/开始新一天正常（不受影响） | 人工 |

---

## 14. P0/P1/P2 风险自查

### 14.1 风险矩阵

| # | 风险 | 等级 | 概率 | 影响 | 缓解措施 |
|---|------|:---:|:---:|------|------|
| 1 | `page.tsx` 集成时意外破坏现有组件渲染顺序 | P1 | 低 | 高 — 页面布局错乱 | 纯追加代码，不修改任何已有 JSX 或逻辑。只在 TaskList 和 HistoryPanel 之间插入新组件。Code Review 重点检查 diff。 |
| 2 | `getOrCreateDeviceId()` 重复导入导致 page.tsx 冗余 | P2 | 极低 | 极低 — 代码审美问题 | `useTaskGroup` 内部已导入 `getOrCreateDeviceId`，page.tsx 新导入不冲突——每次调用返回相同的 localStorage 值。 |
| 3 | `timezoneOffset` 每次渲染计算可能导致 `generateReview` 频繁重建 | P2 | 极低 | 极低 — `useCallback` deps 变化导致函数引用变化，但时区偏移量在单次会话中不变 | 实际上 `new Date().getTimezoneOffset()` 在同一个浏览器会话中不变，不会引起问题。 |
| 4 | AI 返回的 feedbackText 过长（> 300 字）导致 UI 卡片高度异常 | P2 | 低 | 低 — 卡片过高但不影响功能 | Phase 14A parser 限制了 feedbackText ≤ 300 字。如果 AI 突破限制（Parser fallback），UI 用 `whitespace-pre-line` 正常换行，高度自适应。 |
| 5 | Stale 检测在 taskGroup 首次加载时误触发（review 为 null 但 useEffect 执行） | P2 | 极低 | 极低 — 误标 stale | 代码中有 `if (review && ...)` 保护——review 为 null 时不检查 updatedAt |
| 6 | `deviceId` 在 page.tsx 渲染时被调用（每次渲染都执行 `getOrCreateDeviceId()`）| P2 | 极低 | 极低 — 极轻量的 localStorage 读取 | 与 Phase 11–13 各组件内部调用模式一致。`getOrCreateDeviceId()` 是纯同步 localStorage 操作，性能可忽略。 |
| 7 | 错误状态下如果用户清空任务，error 状态残留 | P2 | 低 | 低 — UI 短暂显示错误后消失 | `useEffect` 中 `taskGroupId` 变化时会完全重置状态（包括 `setError(null)`），自动清理。 |

### 14.2 无 P0 风险

Phase 14B 是纯前端 UI + hook——不修改 API、不修改数据库、不修改任何现有组件核心逻辑。最坏情况：TaskReviewPanel 渲染异常 → 不影响 TaskList / StatsBar / HistoryPanel 正常使用。不影响任务生成、勾选、清空、统计、历史。

---

## 15. 是否建议进入 Codex 实现

✅ **建议进入 Phase 14B Codex 实现。**

**理由**：

1. **所有前置依赖就绪**：Phase 14A API 已完成并通过验收（P0=0, P1=0, P2=3）
2. **修改范围极小**：3 个文件，~305 行新增/修改代码，零行删除或重构
3. **完全复用 Phase 14A 类型**：`types.ts` 无需任何修改
4. **Pattern 对齐成熟**：inflightRef 模式复制自 `useTaskStats`（Phase 13 已验证）；UI 风格复制自 `StatsBar` 和 `TaskList`
5. **零耦合侵入**：纯追加到 page.tsx，不修改任何已有 hook 或组件逻辑
6. **无新增依赖**：不装 npm 包，不建数据库表
7. **向后兼容**：不破坏任何现有 API 或组件
8. **风险极低**：所有 P2 风险均有明确缓解措施，无 P0/P1

---

## 16. 给 Codex 的实现边界提醒

### 16.1 文件操作红线

```
✅ 允许新建：
   • src/hooks/useTaskReview.ts
   • src/components/TaskReviewPanel.tsx

✅ 允许修改（纯追加，不动已有代码）：
   • src/app/page.tsx（+25 行，3 处插入点）

❌ 绝不允许修改：
   所有其他文件（见 §3 完整列表）
   尤其是：
   • src/app/api/task-groups/review/route.ts   ← 核心红线
   • src/lib/types.ts                           ← 已在 Phase 14A 完备
   • src/lib/ai-client.ts                       ← Phase 14A 产物
   • src/lib/review-parser.ts                    ← Phase 14A 产物
   • src/prompts/task-review.ts                 ← Phase 14A 产物
   • src/hooks/useTaskGroup.ts
   • src/hooks/useTaskStats.ts
   • src/components/TaskList.tsx
   • src/components/StatsBar.tsx
   • src/components/HistoryPanel.tsx
```

### 16.2 代码风格对齐

| 模块 | 对齐目标 | 要点 |
|------|---------|------|
| `useTaskReview.ts` | `useTaskStats.ts` | inflightRef 模式、错误处理模式、useCallback + useEffect 组合 |
| `TaskReviewPanel.tsx` | `StatsBar.tsx` + `TaskList.tsx` | 卡片容器样式、按钮配色（indigo/amber）、加载骨架、错误重试 |
| `page.tsx`（修改） | 现有 page.tsx | 解构风格、条件渲染 `{condition ? <Comp /> : null}`、注释风格 |

### 16.3 关键实现注意事项

1. **TaskReviewPanel 不管理状态**：所有状态由 `useTaskReview` 管理并通过 props 传入。TaskReviewPanel 是纯展示组件。

2. **不展示 sections**：首版 ReviewCard 只展示 `review.feedbackText`。不展示 `review.sections.summary` / `encouragement` / `nextStep`。不展示 `review.suggestedDifficulty` / `suggestedTaskCountRange`。

3. **显式传入 `taskGroupId` 给 API**：`generateReview` 中的 fetch body 传 `deviceId`、`taskGroupId` 和 `timezoneOffset`。前端已知当前 `taskGroup.id`，显式传入可避免多标签页或状态变化时后端误取其他 active group。Phase 14A API 已支持 `taskGroupId` 归属校验。

4. **empty 状态不渲染 UI**：当 `taskCount === 0` 时，TaskReviewPanel 返回 `null`（不渲染按钮或提示文字）。这与 Architecture §11.3 的 empty 状态定义一致。

5. **Stale 不清空 review**：`isStale = true` 时，ReviewCard 内容仍在（`opacity-50`），上方叠加 stale 提示栏 + "重新生成"按钮。

6. **错误用 amber 不用 red**：复盘是辅助功能，错误不应惊吓用户。使用 amber（`bg-amber-50 border-amber-100 text-amber-700`）而非 red。

7. **不要 import useAuth**：useTaskReview 通过 `taskGroupId` 变化检测 auth 切换，不需要直接依赖 `useAuth`。

8. **防御性检查**：`generateReview` 在 `taskGroupId` 为 undefined 时直接 return（虽然按钮在此时不可见，但防御性编程）。

9. **Spinner 动画**：使用 CSS `animate-spin`（Tailwind 内置）或简单的 emoji 动画（如 `◌`）。不引入任何新依赖。

10. **不创建测试文件**：除非用户明确要求。

### 16.4 不要做的事

```
❌ 不要给 useTaskReview 添加 authUserId 参数
❌ 不要在 page.tsx 中修改任何已有代码行
❌ 不要修改 TaskReviewPanel 的 props 接口（已在本文档定义完毕）
❌ 不要展示 sections / suggestedDifficulty / suggestedTaskCountRange
❌ 不要自动生成复盘（必须手动点击按钮）
❌ 不要在 taskGroup 变化时自动调用 generateReview
❌ 不要在 stale 时自动清空 review
❌ 不要弹窗展示错误
❌ 不要使用红色错误 UI
❌ 不要引入新 npm 依赖（如 zod、react-query、swr）
❌ 不要创建 ReviewCard / ReviewButton / ReviewLoading 等独立子组件文件
❌ 不要修改 useTaskGroup / useTaskStats / useTaskHistory
❌ 不要修改 TaskList / StatsBar / HistoryPanel / Header
❌ 不要修改 review API
❌ 不要持久化复盘到 localStorage（Phase 14 首版为前端 state）
❌ 不要处理 Phase 14A 的 P2 项（await computeAllStats / 多余任务格式 / task_group_ 前缀注释）——这些留到 Phase 14C 或单独小修
```

### 16.5 build 验证

实现完成后必须通过：

```
npm run lint    # 零错误
npm run build   # 成功
git status --short  # 仅 3 个文件变更：
                     #   M src/app/page.tsx
                     #   ?? src/hooks/useTaskReview.ts
                     #   ?? src/components/TaskReviewPanel.tsx
```

---

> **文档结束**
>
> **下一文档**：Phase 14C 集成刷新 + 边界 Cases 执行方案（待 Phase 14B 实现并通过验收后制定）
>
> **关联文档**：
> - `docs/Architecture-Phase14.md` — Phase 14 完整架构（本文档的上游设计）
> - `docs/Execution-Plan-Phase14A.md` — Phase 14A API 执行方案（前置实现）
> - `docs/Architecture-Phase13.md` — Phase 13 统计架构（useTaskStats 模式参考）
> - `docs/Architecture-Phase12.md` — Phase 12 历史架构（HistoryPanel 布局参考）
> - `docs/Roadmap-Phase12-15.md` — Phase 12-15 中期路线图
> - `docs/PRD-V2.0.md` — V2.0 产品规划
