# Phase 14B-Follow-up 执行方案

> **状态**：设计阶段，待 Review 通过后开发
> **依赖**：Phase 14B（已完成并通过最终验收，`ed68e1d`）
> **上级文档**：[Execution-Plan-Phase14B.md](./Execution-Plan-Phase14B.md)
> **制定日期**：2026-07-02

---

## 目录

- [1. 阶段目标](#1-阶段目标)
  - [1.1 不做](#11-不做)
- [2. 允许修改文件](#2-允许修改文件)
- [3. 禁止修改文件](#3-禁止修改文件)
- [4. 具体修改点](#4-具体修改点)
  - [4.1 P2-1：错误码前端映射](#41-p2-1错误码前端映射)
  - [4.2 P2-2：loading opacity](#42-p2-2loading-opacity)
  - [4.3 P2-3：stale 提示栏圆角](#43-p2-3stale-提示栏圆角)
  - [4.4 P2-4：stale 提示栏内边距](#44-p2-4stale-提示栏内边距)
- [5. 边界 Case 确认清单](#5-边界-case-确认清单)
- [6. 文件级改动计划](#6-文件级改动计划)
- [7. Codex 实现步骤](#7-codex-实现步骤)
- [8. 验证命令](#8-验证命令)
- [9. Review 检查清单](#9-review-检查清单)
- [10. 风险评估](#10-风险评估)
- [11. 是否建议进入 Codex 实现](#11-是否建议进入-codex-实现)

---

## 1. 阶段目标

修复 Phase 14B 最终验收遗留的 **4 项 P2** + 确认 **4 项边界 Case** 已有代码逻辑充分覆盖。

| # | 类型 | 内容 |
|---|------|------|
| 1 | P2 修复 | useTaskReview.ts 增加 `REVIEW_ERROR_MESSAGES` 错误码→中文文案映射 |
| 2 | P2 修复 | TaskReviewPanel loading 按钮 opacity-70 → opacity-60 |
| 3 | P2 修复 | TaskReviewPanel stale 提示栏 rounded-2xl → rounded-t-2xl |
| 4 | P2 修复 | TaskReviewPanel stale 提示栏 px-4 → px-5 |
| 5 | 边界确认 | 4 项边界 case 逐项走查确认（不改代码，仅验证） |

**总计**：2 个文件，约 20 行改动（纯修改，零新建）。

### 1.1 不做

```
❌ 不修改后端 API（src/app/api/task-groups/review/route.ts）
❌ 不修改 src/lib/types.ts（ReviewErrorCode 已在 Phase 14A 完备）
❌ 不修改 src/lib/ai-client.ts
❌ 不修改 src/lib/review-parser.ts
❌ 不修改 src/prompts/task-review.ts
❌ 不修改 src/lib/stats-calculator.ts
❌ 不修改 src/lib/constants.ts
❌ 不修改 src/app/page.tsx（Phase 14B 集成正确，无需改动）
❌ 不修改现有 hooks（useTaskGroup / useTaskStats / useTaskHistory / useAuth）
❌ 不修改现有 components（TaskList / StatsBar / HistoryPanel / Header / GoalInput 等）
❌ 不新增文件
❌ 不新增 npm 依赖
❌ 不修改数据库 schema / migration
❌ 不新增 API Route
❌ 不持久化复盘（保持 React state）
❌ 不自动生成复盘（保持手动触发）
❌ 不展示 sections / suggestedDifficulty / suggestedTaskCountRange
❌ 不进入 Phase 15（自动调整任务）
❌ 不处理 README / .env.example / 文档整理
❌ 不做大规模 UI 改版
❌ 不做离线检测 / 自动重试 / 复杂恢复策略
❌ 不做复杂动画（stale → loading 过渡依赖现有 isLoading 优先渲染，已足够）
```

---

## 2. 允许修改文件

| # | 文件 | 操作 | 改动量 | 性质 |
|---|------|:---:|:---:|------|
| 1 | `src/hooks/useTaskReview.ts` | 修改 | ~15 行 | 新增错误码映射常量 + 修改错误抛出逻辑 |
| 2 | `src/components/TaskReviewPanel.tsx` | 修改 | ~3 行 | 3 处样式值替换 |

**总计**：~18 行改动，零行新建，零行删除已有功能。

---

## 3. 禁止修改文件

Phase 14B-Follow-up 严格限定只修改上述 2 个文件。以下文件**绝不允许修改**：

```
src/lib/types.ts                               ← Phase 14A 产物，类型完备
src/lib/ai-client.ts                           ← Phase 14A 产物
src/lib/review-parser.ts                       ← Phase 14A 产物
src/lib/stats-calculator.ts                    ← Phase 13 产物
src/lib/supabase-server.ts
src/lib/supabase-client.ts
src/lib/device-id.ts
src/lib/constants.ts
src/prompts/task-review.ts                     ← Phase 14A 产物
src/prompts/task-generation.ts
src/app/api/task-groups/review/route.ts        ← Phase 14A 产物（核心红线）
src/app/api/generate-tasks/route.ts
src/app/api/task-groups/stats/route.ts
src/app/api/task-groups/history/route.ts
src/app/api/task-group/load/route.ts
src/app/api/task-group/save/route.ts
src/app/api/task-group/delete/route.ts
src/app/api/task-group/migrate/route.ts
src/app/page.tsx                               ← Phase 14B 集成正确，无需改动
src/components/TaskList.tsx
src/components/StatsBar.tsx
src/components/HistoryPanel.tsx
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
src/hooks/useTaskGroup.ts
src/hooks/useTaskStats.ts
src/hooks/useTaskHistory.ts
src/hooks/useAuth.ts
任何数据库 schema / migration 文件
package.json
```

---

## 4. 具体修改点

### 4.1 P2-1：错误码前端映射

**文件**：`src/hooks/useTaskReview.ts`

**当前代码**（L23-24 + L78-81）：

```typescript
const DEFAULT_ERROR_MESSAGE = "复盘生成失败，请稍后重试。";
const NETWORK_ERROR_MESSAGE = "网络连接失败，请检查网络后重试。";

// ...

if (!response.ok || !result.success) {
  throw new Error(
    result.success ? DEFAULT_ERROR_MESSAGE : result.error.message,
  );
}
```

**问题**：当 `!result.success` 时，直接透传 `result.error.message`（API 返回的英文/技术文案），而非前端自行映射的中文友好文案。

**目标代码**：

在 `DEFAULT_ERROR_MESSAGE` 和 `NETWORK_ERROR_MESSAGE` 之后新增错误码映射表：

```typescript
const DEFAULT_ERROR_MESSAGE = "复盘生成失败，请稍后重试。";
const NETWORK_ERROR_MESSAGE = "网络连接失败，请检查网络后重试。";

const REVIEW_ERROR_MESSAGES: Record<string, string> = {
  NO_ACTIVE_TASK_GROUP: "还没有今天的任务，先生成任务再让 AI 复盘。",
  NO_TASKS_TO_REVIEW: "还没有任务内容，无法生成复盘。",
  AI_REVIEW_FAILED: "AI 复盘生成失败，请稍后重试。",
  AI_RESPONSE_INVALID: "AI 回复格式异常，请重试。",
  RATE_LIMITED: "请求过于频繁，请稍后再试。",
  INTERNAL_ERROR: "服务异常，请稍后重试。",
};
```

修改错误抛出逻辑：

```typescript
if (!response.ok || !result.success) {
  const errorCode = result.success ? "INTERNAL_ERROR" : result.error.code;
  const message = REVIEW_ERROR_MESSAGES[errorCode] ?? DEFAULT_ERROR_MESSAGE;
  throw new Error(message);
}
```

**映射表说明**：

| 错误码 | 前端文案 | 触发场景 | UI 状态 |
|------|------|------|:---:|
| `NO_ACTIVE_TASK_GROUP` | 还没有今天的任务，先生成任务再让 AI 复盘。 | 后端找不到活跃 task_group | 正常不应出现（按钮在 taskGroup=null 时不渲染） |
| `NO_TASKS_TO_REVIEW` | 还没有任务内容，无法生成复盘。 | task_group 存在但 tasks 为空 | 正常不应出现（taskCount=0 时按钮不渲染） |
| `AI_REVIEW_FAILED` | AI 复盘生成失败，请稍后重试。 | DeepSeek API 调用失败 | error |
| `AI_RESPONSE_INVALID` | AI 回复格式异常，请重试。 | AI 返回 JSON 解析失败 | error |
| `RATE_LIMITED` | 请求过于频繁，请稍后再试。 | 超过 3 次/分钟限制 | error |
| `INTERNAL_ERROR` | 服务异常，请稍后重试。 | 未预期的服务端异常 | error |
| 未知 errorCode | 复盘生成失败，请稍后重试。 | 兜底 | error |

**设计说明**：
- 映射表使用 `Record<string, string>` 而非 `Record<ReviewErrorCode, string>`，避免导入 `ReviewErrorCode` 类型（符合执行方案 §12.3 的导入清单——useTaskReview 只 import `ReviewData` 和 `ReviewResponse`）。未知 errorCode 落入 `?? DEFAULT_ERROR_MESSAGE` 兜底。
- `NO_ACTIVE_TASK_GROUP` 和 `NO_TASKS_TO_REVIEW` 正常情况下不会展示给用户（UI 已通过 hidden/empty 状态拦截），但仍保留映射作为防御。
- 不新增 import，不修改 `@/lib/types` 的导入语句。

---

### 4.2 P2-2：loading opacity

**文件**：`src/components/TaskReviewPanel.tsx`  
**位置**：第 29 行  
**当前值**：`opacity-70`  
**目标值**：`opacity-60`  
**依据**：执行方案 Phase 14B §6.4.2

```diff
-          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-indigo-50 px-5 text-sm font-semibold text-indigo-700 opacity-70"
+          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-indigo-50 px-5 text-sm font-semibold text-indigo-700 opacity-60"
```

---

### 4.3 P2-3：stale 提示栏圆角

**文件**：`src/components/TaskReviewPanel.tsx`  
**位置**：第 75 行  
**当前值**：`rounded-2xl`  
**目标值**：`rounded-t-2xl`  
**依据**：执行方案 Phase 14B §6.4.4（stale 提示栏在 ReviewCard 上方，仅顶部圆角使其与下方 ReviewCard 视觉连接）

```diff
-        <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
+        <div className="mb-4 rounded-t-2xl border border-amber-100 bg-amber-50 px-4 py-3">
```

---

### 4.4 P2-4：stale 提示栏内边距

**文件**：`src/components/TaskReviewPanel.tsx`  
**位置**：第 75 行  
**当前值**：`px-4`  
**目标值**：`px-5`  
**依据**：执行方案 Phase 14B §6.4.4

```diff
-        <div className="mb-4 rounded-t-2xl border border-amber-100 bg-amber-50 px-4 py-3">
+        <div className="mb-4 rounded-t-2xl border border-amber-100 bg-amber-50 px-5 py-3">
```

**注意**：P2-3 和 P2-4 在同一行，一次编辑即可修复两个问题。

---

## 5. 边界 Case 确认清单

以下 4 项边界 Case 经代码走查确认**已有逻辑充分覆盖**，本阶段**不新增代码**，仅做验证确认。

### 5.1 网络失败后用户可以重试

**已有逻辑**：
1. `generateReview` 中 `fetch` 抛出 `TypeError`（网络断连）→ catch 块检测 `reviewError instanceof TypeError` → `setError(NETWORK_ERROR_MESSAGE)`
2. `TaskReviewPanel` error 状态渲染"重试"按钮 → `onClick={onGenerate}` → 重新调用 `generateReview`

**结论**：✅ 不需要修改。链路完整。

### 5.2 taskGroup 切换后旧 review 不残留

**已有逻辑**：
1. `useEffect`（L114-121）：`taskGroupId` 变化时调用 `resetReview()`
2. `resetReview`：清空 `review` / `error` / `isLoading` / `isStale` / `reviewedAtVersionRef` / `inflightRef`

**覆盖场景**：
- `handleGenerate` → 新 taskGroupId → reset ✅
- `handleRegenerate` → 新 taskGroupId → reset ✅
- `handleClearTasks` → taskGroupId 变为 undefined → reset ✅
- `handleStartNewDay` → taskGroupId 变为 undefined → reset ✅
- 登录/登出 → taskGroup 先 null 后新值 → reset ✅

**结论**：✅ 不需要修改。链路完整。

### 5.3 请求期间 taskGroup 改变不会污染新状态

**已有逻辑**：
1. `generateReview` 在发起请求前捕获 `requestTaskGroupId`（L59）
2. 请求成功回调中检查 `taskGroupIdRef.current !== requestTaskGroupId`（L84）→ 不更新 state
3. 请求失败回调中同样检查（L93）→ 不设置 error

**时序示例**：
```
T1: 用户在 taskGroup-A 点击"生成复盘" → inflightRef = promise-A
T2: 用户清空任务 → taskGroup 变为 null → resetReview() → taskGroupIdRef = undefined
T3: promise-A resolve → 检测到 taskGroupIdRef (undefined) !== requestTaskGroupId (A)
    → return，不 setReview，不污染新状态
```

**结论**：✅ 不需要修改。闭包快照 + ref 双重保护。

### 5.4 stale → 重新生成 → 成功后 UI 正确过渡

**已有逻辑**：
1. stale 状态点击"重新生成"→ `onGenerate` → `generateReview()`
2. `generateReview` 立即调用 `setIsLoading(true)`（此时 `review` 仍在，`isStale=true` 仍在）
3. `TaskReviewPanel` 渲染优先级：`isLoading`（L25）先于 `review`（L58）→ 优先展示 loading UI
4. 请求成功 → `setReview(newData)` + `setIsStale(false)` + `setIsLoading(false)` → 渲染 success UI
5. 请求失败 → `setError(message)` + `setIsLoading(false)` → 渲染 error UI

**结论**：✅ 不需要修改。`isLoading` 优先渲染已覆盖过渡态。无需额外动画或状态管理。

---

## 6. 文件级改动计划

### 6.1 实现顺序

```
Step 1: src/hooks/useTaskReview.ts（修改 ~15 行）
  └── 新增 REVIEW_ERROR_MESSAGES 映射常量
      修改 generateReview 中的错误抛出逻辑（3 行替换）

Step 2: src/components/TaskReviewPanel.tsx（修改 ~3 行）
  └── 3 处样式值替换：
      - opacity-70 → opacity-60
      - rounded-2xl → rounded-t-2xl（stale 提示栏）
      - px-4 → px-5（stale 提示栏）

Step 3: 边界 Case 验证（不改代码）
  └── 人工走查确认 4 项边界 case
```

### 6.2 改动量汇总

| 文件 | 新增行 | 修改行 | 删除行 | 净变化 |
|------|:---:|:---:|:---:|:---:|
| `src/hooks/useTaskReview.ts` | +9 | ~3 | -3 | +6 |
| `src/components/TaskReviewPanel.tsx` | 0 | 3 | 0 | 0 |
| **合计** | **+9** | **~3** | **-3** | **+6** |

---

## 7. Codex 实现步骤

### Step 1：修复 useTaskReview.ts

1. 在 `NETWORK_ERROR_MESSAGE` 常量之后（当前 L24 之后）插入 `REVIEW_ERROR_MESSAGES` 映射表（9 行）
2. 将 L78-81 的错误抛出逻辑替换为目标代码（见 §4.1）
3. 确认不新增 import、不修改 import 语句

### Step 2：修复 TaskReviewPanel.tsx

1. L29：`opacity-70` → `opacity-60`
2. L75：`rounded-2xl` → `rounded-t-2xl`，`px-4` → `px-5`
3. 确认不修改其他行

### Step 3：验证

运行 `npm run lint && npm run build`，确认零错误。

### Step 4：边界确认（人工走查）

对照 §5 逐项走查 4 项边界 case，确认代码逻辑已覆盖。

---

## 8. 验证命令

```bash
npm run lint        # 零错误
npm run build       # 成功
git status --short  # 仅 2 个文件变更：
                    #   M src/hooks/useTaskReview.ts
                    #   M src/components/TaskReviewPanel.tsx
```

---

## 9. Review 检查清单

### 9.1 范围检查

| # | 检查项 |
|:--:|------|
| 1 | 是否只修改了 2 个允许文件 |
| 2 | 是否没有修改 page.tsx |
| 3 | 是否没有修改 API route |
| 4 | 是否没有修改 lib 模块 |
| 5 | 是否没有修改 prompts |
| 6 | 是否没有修改其他 hooks / components |
| 7 | 是否没有新增文件 |
| 8 | 是否没有修改 package.json |

### 9.2 useTaskReview.ts 检查

| # | 检查项 |
|:--:|------|
| 1 | `REVIEW_ERROR_MESSAGES` 是否包含 6 个错误码 |
| 2 | `RATE_LIMITED` 文案是否为"请求过于频繁，请稍后再试。" |
| 3 | 未知 errorCode 是否 fallback 到 `DEFAULT_ERROR_MESSAGE` |
| 4 | 是否不新增 import |
| 5 | 错误抛出是否改为 `errorCode → REVIEW_ERROR_MESSAGES[errorCode] ?? DEFAULT_ERROR_MESSAGE` |
| 6 | `NETWORK_ERROR_MESSAGE`（TypeError 分支）是否不受影响 |
| 7 | inflightRef / stale 逻辑是否未改动 |

### 9.3 TaskReviewPanel.tsx 检查

| # | 检查项 |
|:--:|------|
| 1 | loading 按钮 className 是否含 `opacity-60`（非 `opacity-70`） |
| 2 | stale 提示栏 className 是否含 `rounded-t-2xl`（非 `rounded-2xl`） |
| 3 | stale 提示栏 className 是否含 `px-5`（非 `px-4`） |
| 4 | 其他 className 是否未改动 |
| 5 | 组件逻辑 / 状态判断 / JSX 结构是否未改动 |

### 9.4 边界确认

| # | 检查项 |
|:--:|------|
| 1 | 网络失败后可重试 — 代码逻辑完整 |
| 2 | taskGroup 切换后旧 review 清理 — resetReview 覆盖 |
| 3 | 请求期间 taskGroup 改变不污染 — requestTaskGroupId 闭包快照 |
| 4 | stale → 重新生成 → 成功 UI 过渡 — isLoading 优先渲染 |

---

## 10. 风险评估

| # | 风险 | 等级 | 概率 | 影响 | 缓解措施 |
|---|------|:---:|:---:|------|------|
| 1 | 错误码映射遗漏新增的错误码 | P2 | 极低 | 极低 — 当新错误码不在映射表中时，`?? DEFAULT_ERROR_MESSAGE` 兜底 | 如果 Phase 14A 后端后续新增错误码，前端显示通用兜底文案，不影响功能 |
| 2 | opacity-60 与 opacity-70 差异不可见 | P2 | — | — | 用户几乎无法区分 10% 透明度差异，纯设计一致性修复 |
| 3 | rounded-t-2xl 在独立 stale 卡片中视觉变化 | P2 | 极低 | 极低 — 仅影响 stale 提示栏的底部圆角 | 执行方案 §6.4.4 明确要求 `rounded-t-2xl`，对齐方案即可 |

**无 P0/P1 风险**。改动量极小（~18 行，2 个文件），不改逻辑，不改 API，不改类型。

---

## 11. 是否建议进入 Codex 实现

✅ **建议进入 Phase 14B-Follow-up Codex 实现。**

**理由**：

1. **改动量极小**：2 个文件，~18 行改动，零新建
2. **纯修复性**：4 项 P2 均为样式/文案对齐，无新功能、无新逻辑
3. **零耦合**：不改 API、不改类型、不改其他组件
4. **无新增依赖**：不改 package.json
5. **风险极低**：最坏情况——样式或文案未对齐，不影响功能
6. **边界 Case 已有代码覆盖**：4 项边界 case 均无需新增代码，仅需人工确认
7. **Review 成本低**：检查清单 19 项，10 分钟内可完成

---

> **文档结束**
>
> **关联文档**：
> - `docs/Execution-Plan-Phase14B.md` — Phase 14B 执行方案（本 Follow-up 的上游方案）
> - `docs/Architecture-Phase14.md` — Phase 14 完整架构
> - `docs/PROJECT-CONTEXT.md` — 项目长期上下文（含 Phase 14B 交付总结 + 遗留 P2）
