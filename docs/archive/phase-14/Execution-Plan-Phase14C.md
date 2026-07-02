# Phase 14C 执行方案 — AI 复盘体验稳定化 / 集成刷新 / 边界 Cases

> **状态**：设计阶段，待 Review 通过后执行
> **依赖**：Phase 14B + Phase 14B-Follow-up（全部完成并通过验收）
> **上级文档**：[Architecture-Phase14.md](./Architecture-Phase14.md)
> **前置方案**：[Execution-Plan-Phase14B.md](./Execution-Plan-Phase14B.md)、[Execution-Plan-Phase14B-Follow-up.md](./Execution-Plan-Phase14B-Follow-up.md)
> **制定日期**：2026-07-02

---

## 目录

- [1. Phase 14C 是否有必要](#1-phase-14c-是否有必要)
- [2. Phase 14C 目标](#2-phase-14c-目标)
- [3. Phase 14C 做什么](#3-phase-14c-做什么)
- [4. Phase 14C 不做什么](#4-phase-14c-不做什么)
- [5. 允许修改文件列表](#5-允许修改文件列表)
- [6. 禁止修改文件列表](#6-禁止修改文件列表)
- [7. 文件级改动计划](#7-文件级改动计划)
- [8. 手动测试清单](#8-手动测试清单)
- [9. P0 / P1 / P2 风险判断](#9-p0--p1--p2-风险判断)
- [10. 是否建议进入 Codex 实现](#10-是否建议进入-codex-实现)
- [11. 给 Codex 的执行边界提醒](#11-给-codex-的执行边界提醒)
- [12. 是否建议 Phase 14C 后进入 Phase 15 架构设计](#12-是否建议-phase-14c-后进入-phase-15-架构设计)

---

## 1. Phase 14C 是否有必要

### 1.1 判断结论

**有必要，但定位调整。**

原 Architecture §16 定义了 Phase 14C（集成刷新 + 边界 Cases）和 Phase 14D（端到端验收 + 最终 Review）两个独立阶段。经过对当前代码的完整走查，判断如下：

| 原计划 | 调整 | 理由 |
|--------|------|------|
| Phase 14C（集成验证） | **保留，但改为纯人工验证** | 代码逻辑已完备，无需新增代码 |
| Phase 14D（最终验收） | **合并到 Phase 14C** | 两个阶段内容高度重叠（均为人工验证），分开执行浪费回合 |

### 1.2 为什么需要 Phase 14C

1. **Phase 14B + Follow-up 验证均为 Code Review 级别的静态检查**，缺少真实运行时的端到端行为验证
2. **7 项关键边界 Case 尚未在真实浏览器中验证**（登录/登出切换、网络断连重试、快速连续操作等）
3. **移动端真实设备走查尚未执行**（仅 desktop Chrome DevTools 模拟）
4. **需要一个正式的 Phase 14 关闭节点**——确认 AI 复盘从 API 到 UI 的完整体验稳定

### 1.3 为什么不需要代码改动

经过对当前 3 个核心文件的逐行分析（详见 §7），所有关键保护逻辑均已正确实现：

| 保护机制 | 位置 | 状态 |
|---------|------|:---:|
| 请求期间 taskGroup 改变不污染新状态 | `useTaskReview.ts:68,93-95,102-104` | ✅ |
| Stale 检测（toggle 后标记） | `useTaskReview.ts:132-140` | ✅ |
| taskGroupId 变化自动 reset | `useTaskReview.ts:123-130` | ✅ |
| 登录/登出链式 reset | `useTaskGroup` → `taskGroupId` → `useTaskReview` | ✅ |
| inflightRef 并发控制 | `useTaskReview.ts:64-66,119` | ✅ |
| 网络错误 → TypeError → NETWORK_ERROR_MESSAGE | `useTaskReview.ts:106-108` | ✅ |
| 6 种 API 错误码 → 中文文案 | `useTaskReview.ts:26-33` | ✅ |
| Stale 不清空旧内容（opacity-50） | `TaskReviewPanel.tsx:89` | ✅ |
| Loading 优先于 review 渲染 | `TaskReviewPanel.tsx:25`（isLoading 在 review 之前检查） | ✅ |

---

## 2. Phase 14C 目标

### 2.1 一句话目标

通过系统化的人工测试清单，验证 AI 复盘从 API 到 UI 的完整体验在所有关键场景下均稳定正确，作为 Phase 14 的总体验收。

### 2.2 成功标准

1. 全部 36 项手动测试通过（含 7 项边界 Case）
2. Phase 12 / 13 全功能回归通过（6 项）
3. 移动端真实设备或 DevTools 移动模拟走查通过
4. `npm run lint` + `npm run build` 通过
5. 零 P0 / P1 问题
6. 任何发现的 P2 记录在案，不在此 Phase 修复（除非是 P0 阻断）

---

## 3. Phase 14C 做什么

### 3.1 核心活动（3 项）

| # | 活动 | 方式 | 预计耗时 |
|:--:|------|------|:---:|
| 1 | 执行 36 项手动测试清单（§8） | 人工在浏览器中逐项操作验证 | ~30 分钟 |
| 2 | 移动端 UI 走查（真实设备或 DevTools） | 人工 | ~10 分钟 |
| 3 | 记录结果，输出验收报告 | 文档 | ~10 分钟 |

### 3.2 测试维度（6 个）

| 维度 | 覆盖内容 | 测试项数 |
|------|---------|:---:|
| **功能完整性** | 按钮、loading、success、stale、error 状态 | 8 |
| **状态转换** | 所有状态间的转换路径 | 9 |
| **边界 Cases** | 网络断连、快速操作、taskGroup 变化 | 7 |
| **登录态隔离** | 登录/登出/匿名切换 | 4 |
| **回归验证** | Phase 12/13 功能不受影响 | 6 |
| **移动端 UI** | 触控区域、换行、布局 | 2 |

---

## 4. Phase 14C 不做什么

```
❌ 不写代码（纯人工验证阶段）
❌ 不新增文件
❌ 不修改任何 .ts / .tsx 文件
❌ 不修改 API Route
❌ 不修改 lib 模块
❌ 不修改 hooks / components
❌ 不修改 page.tsx
❌ 不修改 package.json
❌ 不修改数据库 schema / migration
❌ 不新增 npm 依赖
❌ 不修改 generate-tasks 策略
❌ 不做周复盘
❌ 不做自动复盘
❌ 不做 AI 自动改任务
❌ 不持久化复盘结果
❌ 不新增 Supabase 表
❌ 不进入 Phase 15（架构设计或实现）
❌ 不做长期用户画像
❌ 不重构 Phase 14A / 14B 已完成代码
❌ 不创建新的根目录 .md 文件
```

### 4.1 如果在测试中发现 Bug 怎么办

| Bug 等级 | 处理方式 |
|---------|---------|
| **P0 阻断**（复盘功能完全不可用） | 停止验收，先修 bug，再重新验收 |
| **P1 重要**（某个边界场景行为异常） | 记录在验收报告中，由 Claude Code 或 ChatGPT 决定是否新开 Follow-up |
| **P2 轻微**（文案可优化、样式微调） | 记录在验收报告中，不阻塞 Phase 14C 通过 |

---

## 5. 允许修改文件列表

**Phase 14C 不改代码。允许修改的文件为空。**

如果测试中发现 P0 阻断问题需要紧急修复，修复范围不得超过：

| # | 文件 | 条件 |
|---|------|------|
| 1 | `src/hooks/useTaskReview.ts` | 仅当 bug 在此文件中且修复 ≤ 5 行 |
| 2 | `src/components/TaskReviewPanel.tsx` | 仅当 bug 在此文件中且修复 ≤ 5 行 |
| 3 | `src/app/page.tsx` | 仅当 bug 在此文件中且修复 ≤ 3 行 |

以上为紧急修复预留窗口，**正常流程不触发**。任何代码修改必须在验收报告中明确记录。

---

## 6. 禁止修改文件列表

Phase 14C 严禁修改以下所有文件：

```
src/lib/types.ts                               ← Phase 14A 产物
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
.env.local
```

---

## 7. 文件级改动计划

### 7.1 当前代码走查结论

对 3 个核心文件进行了逐行分析，确认所有关键保护逻辑已正确实现：

#### 7.1.1 `src/hooks/useTaskReview.ts`（150 行）

| 行号 | 机制 | 分析 | 结论 |
|:---:|------|------|:---:|
| 26-33 | `REVIEW_ERROR_MESSAGES` | 6 个错误码 → 中文文案映射 | ✅ |
| 23-24 | `DEFAULT_ERROR_MESSAGE` + `NETWORK_ERROR_MESSAGE` | 兜底 + 网络断连 | ✅ |
| 46 | `inflightRef` | 并发控制 | ✅ |
| 47 | `reviewedAtVersionRef` | Stale 版本快照 | ✅ |
| 48 | `taskGroupIdRef` | 初始化 `useRef(taskGroupId)` — 只取初始值 | ⚠️ 见下 |
| 64-66 | `inflightRef.current` 复用 | 快速双击只发 1 次请求 | ✅ |
| 68-69 | `requestTaskGroupId` / `requestTaskGroupUpdatedAt` | 闭包快照，捕获请求发起时的值 | ✅ |
| 87-90 | 错误码映射 | `errorCode → REVIEW_ERROR_MESSAGES[errorCode] ?? DEFAULT_ERROR_MESSAGE` | ✅ |
| 93-95 | 成功后 taskGroup 变化检测 | `taskGroupIdRef.current !== requestTaskGroupId` → 丢弃结果 | ✅ |
| 97-99 | `reviewedAtVersionRef` 记录 | 使用 `requestTaskGroupUpdatedAt`（请求发起时的版本） | ✅ |
| 102-104 | 失败后 taskGroup 变化检测 | 同成功路径，丢弃 error | ✅ |
| 106-112 | 错误分类 | `TypeError` → 网络错误文案；`Error` → 取其 message；其他 → 兜底 | ✅ |
| 123-130 | taskGroupId 变化 useEffect | `taskGroupIdRef.current` 同步 + `resetReview()` | ✅ |
| 132-140 | Stale 检测 useEffect | `reviewedAtVersionRef.current` vs `taskGroupUpdatedAt` | ✅ |

**关于 `taskGroupIdRef` 初始化**（第 48 行）：

```typescript
const taskGroupIdRef = useRef<string | undefined>(taskGroupId);
```

`useRef(initialValue)` 只在组件首次渲染时使用 `initialValue`，后续 `taskGroupId` prop 变化不会自动更新 ref。但第 123-130 行的 `useEffect` 负责同步：

```typescript
useEffect(() => {
    if (taskGroupIdRef.current === taskGroupId) return;
    taskGroupIdRef.current = taskGroupId;
    resetReview();
}, [resetReview, taskGroupId]);
```

**时序分析**（关键边界场景）：

```
T0: 组件挂载，taskGroupId = "uuid-A"
    → useRef("uuid-A") → taskGroupIdRef.current = "uuid-A"
    → useEffect 执行：taskGroupIdRef.current ("uuid-A") === taskGroupId ("uuid-A") → return（不 reset）

T1: 用户点击"生成复盘"（taskGroup-A 下）
    → requestTaskGroupId = "uuid-A"（闭包快照）
    → fetch 发出...

T2: 用户清空任务（在 T1 的 fetch 返回之前）
    → handleClearTasks → taskGroup = null
    → taskGroupId prop 变为 undefined
    → useEffect 触发：taskGroupIdRef.current ("uuid-A") !== taskGroupId (undefined)
    → taskGroupIdRef.current = undefined
    → resetReview()（清空所有 state）
    → page.tsx: taskGroup === null → TaskReviewPanel 不渲染

T3: T1 的 fetch 返回
    → 检查 taskGroupIdRef.current (undefined) !== requestTaskGroupId ("uuid-A")
    → return（不 setReview，不污染新状态）✅
```

**结论**：`taskGroupIdRef` 依赖 useEffect 同步而非 useRef 自动跟踪，这在 React 中是标准模式。时序正确。

#### 7.1.2 `src/components/TaskReviewPanel.tsx`（99 行）

| 行号 | 机制 | 分析 | 结论 |
|:---:|------|------|:---:|
| 21-23 | `taskCount === 0` → `return null` | empty 状态，不渲染按钮 | ✅ |
| 25-40 | `isLoading` 分支 | 优先于 review 检查（L58），确保 loading 时展示 spinner | ✅ |
| 29 | `opacity-60` | Follow-up 修复后值 | ✅ |
| 43-56 | `error` 分支 | amber 色调，重试按钮调用 `onGenerate` | ✅ |
| 58-69 | `!review` 分支 | ready 状态，显示"生成今日复盘"按钮 | ✅ |
| 72-98 | `review !== null` 分支 | success / stale 状态 | ✅ |
| 74-86 | `isStale` 子分支 | amber 提示栏 + 重新生成按钮 | ✅ |
| 75 | `rounded-t-2xl` + `px-5` | Follow-up 修复后值 | ✅ |
| 89 | `opacity-50` | stale 时旧内容半透明 | ✅ |
| 13-20 | Props 解构 | `onReset` 在接口中但未解构（§7.4 有意为之——未来扩展预留） | ✅ |

**状态渲染优先级分析**：

```
1. taskCount === 0          → return null（最高优先级，不渲染任何 UI）
2. isLoading === true       → loading UI（spinner）
3. error !== null           → error UI（amber 提示 + 重试）
4. review === null          → ready UI（"生成今日复盘"按钮）
5. review !== null          → success / stale UI（ReviewCard）
   └── isStale === true     →   stale 提示栏 + 半透明内容
   └── isStale === false    →   正常 ReviewCard
```

**关键设计**：`isLoading`（第 25 行）在 `error`（第 43 行）之前检查。这确保了：
- 重试点击 → `generateReview()` → `setIsLoading(true)` + `setError(null)` → UI 立即从 error 切换到 loading
- 不会出现 error 和 loading 同时可见的闪烁

#### 7.1.3 `src/app/page.tsx`（190 行）

| 行号 | 机制 | 分析 | 结论 |
|:---:|------|------|:---:|
| 11 | `TaskReviewPanel` import | ✅ |
| 15 | `useTaskReview` import | ✅ |
| 17 | `getOrCreateDeviceId` import | ✅ |
| 45-51 | `useTaskReview` 调用 | 传参完整：taskGroupId、taskGroupUpdatedAt、taskCount、deviceId、timezoneOffset | ✅ |
| 163-173 | `{taskGroup ? <TaskReviewPanel ... /> : null}` | taskGroup 为 null 时不渲染（hidden 状态） | ✅ |
| 163-173 | 位置 | TaskList（L153-162）之后，HistoryPanel（L174-185）之前 | ✅ |
| — | 零行删除或修改已有代码 | 全部改动为纯追加 | ✅ |

### 7.2 改动计划

**本阶段无代码改动。** 仅执行 §8 手动测试清单。

---

## 8. 手动测试清单

### 8.1 功能完整性测试（8 项）

| # | 场景 | 操作步骤 | 预期结果 |
|:--:|------|---------|------|
| F-1 | 无任务时不显示复盘入口 | 打开页面（全新浏览器 / 清空 localStorage） | TaskReviewPanel 不渲染任何内容 |
| F-2 | 生成任务后显示"生成今日复盘"按钮 | 输入目标 → 点击"生成任务" | TaskList 下方出现全宽 indigo 按钮："💬 生成今日复盘" |
| F-3 | 点击按钮 → loading 态 | 点击"💬 生成今日复盘" | 按钮变为禁用态 + spinner 动画 + "正在生成复盘…"，opacity-60 |
| F-4 | 复盘成功展示 ReviewCard | 等待 loading 完成 | 显示 ReviewCard："💬 今日复盘"标题 + feedbackText 正文（120-180 字中文） |
| F-5 | 不展示 sections / suggestedDifficulty / suggestedTaskCountRange | 检查 ReviewCard 内容 | 仅显示 feedbackText，不显示 summary/encouragement/nextStep/difficulty/range |
| F-6 | 全部完成任务 → 复盘正反馈 | 勾选全部任务 → 生成复盘 | feedbackText 包含正向鼓励（如"全部完成""节奏很好"） |
| F-7 | 部分完成任务 → 具体建议 | 勾选部分任务 → 生成复盘 | feedbackText 包含"完成了 X 个" + 下一步建议 |
| F-8 | 零完成 → 温和文案 | 不勾选任何任务 → 生成复盘 | feedbackText 温和、不批评、建议最小一步，无"失败""落后"等词汇 |

### 8.2 状态转换测试（9 项）

| # | 初始状态 | 操作 | 预期最终状态 | 验证点 |
|:--:|------|------|:--:|------|
| S-1 | hidden（无 taskGroup） | 生成任务 | ready（显示按钮） | 按钮出现 |
| S-2 | ready | 点击"生成今日复盘" | loading → success | spinner → ReviewCard |
| S-3 | loading | 等待请求完成 | success | 复盘内容正确展示 |
| S-4 | success | 勾选/取消勾选一个任务 | stale | 出现 amber 提示栏 + 内容半透明 |
| S-5 | stale | 点击"重新生成" | loading → success | 新复盘替换旧内容，isStale 消失 |
| S-6 | stale | 不点重新生成，直接清空任务 | hidden | TaskReviewPanel 消失 |
| S-7 | success | 输入新 goal → 生成新任务 | ready（旧复盘已清空） | 显示"生成今日复盘"按钮（非旧复盘） |
| S-8 | success | 点击 TaskList 的"重新生成" | ready（旧复盘已清空） | 同上 |
| S-9 | success | 点击 NewDayPrompt 的"开始新一天" | hidden →（生成后）ready | 旧复盘不残留 |

### 8.3 边界 Cases 测试（7 项）

| # | 场景 | 操作步骤 | 预期结果 |
|:--:|------|---------|------|
| E-1 | 网络断连后重试 | 1. 生成任务 2. Chrome DevTools → Network → Offline 3. 点击"生成今日复盘" 4. 看到网络错误文案 5. 恢复 Online 6. 点击"重试" | 步骤 3：显示"网络连接失败，请检查网络后重试。"+ 重试按钮；步骤 6：正常生成复盘 |
| E-2 | taskGroup 切换后旧 review 不残留 | 1. 在 taskGroup-A 下生成复盘（看到 ReviewCard） 2. 输入新 goal → 生成新任务（taskGroup-B） | 步骤 2 后：TaskReviewPanel 显示"生成今日复盘"按钮（非旧复盘内容） |
| E-3 | 请求期间 taskGroup 改变不污染 | 1. 在 taskGroup-A 下点击"生成今日复盘" 2. **在请求返回前**立即清空任务 3. 等待请求返回 | 步骤 3 后：页面无复盘内容残留（taskGroup 已变为 null → hidden） |
| E-4 | 快速双击防重复 | 快速双击"生成今日复盘"按钮 | 浏览器 Network 面板只显示 1 次 POST /api/task-groups/review 请求 |
| E-5 | loading 中按钮不可再点击 | 点击"生成今日复盘"→ loading 出现后再次点击按钮区域 | 按钮 disabled，不触发新请求 |
| E-6 | stale → 重新生成 → 成功 UI 过渡 | 1. 生成复盘 2. 勾选任务（变 stale） 3. 点击"重新生成" | 步骤 3：stale 提示和半透明内容立即消失 → loading spinner → 新 ReviewCard。不出现空白闪烁或旧内容残留。 |
| E-7 | 复盘后刷新页面 → 复盘丢失 | 1. 生成复盘（看到 ReviewCard） 2. 按 F5 刷新页面 | 页面重新加载，TaskReviewPanel 显示"生成今日复盘"按钮（复盘不持久化，符合设计） |

### 8.4 登录态隔离测试（4 项）

| # | 场景 | 操作步骤 | 预期结果 |
|:--:|------|---------|------|
| A-1 | 未登录 → 生成复盘 | 不登录，生成任务 → 生成复盘 | 正常展示（device_id 模式） |
| A-2 | 已登录 → 生成复盘 | 登录后生成任务 → 生成复盘 | 正常展示（user_id 模式），复盘内容反映当前用户的数据 |
| A-3 | 已登录 → 登出 | 1. 登录状态下生成复盘 2. 登出 | 步骤 2 后：复盘清空（taskGroup 重置），页面回到未登录初始状态 |
| A-4 | 未登录 → 登录 | 1. 未登录状态下生成复盘 2. 登录 | 步骤 2 后：复盘清空（taskGroup 重置，匿名任务迁移到登录用户），此时应显示迁移后的 taskGroup，复盘按钮为 ready |

### 8.5 回归验证（6 项）

| # | 验证项 | 操作 | 预期 |
|:--:|------|------|------|
| R-1 | TaskList 勾选正常 | 生成任务 → 勾选/取消勾选 | 功能正常，不受复盘影响 |
| R-2 | StatsBar 统计正常 | 查看统计卡片 | 数字正确更新，不受复盘影响 |
| R-3 | HistoryPanel 历史正常 | 打开历史面板 | 历史记录正确展示，不受复盘影响 |
| R-4 | generate-tasks 正常 | 输入目标 → 生成任务 | 正常生成 3-8 条任务，不受复盘影响 |
| R-5 | 清空任务正常 | 点击"清空" | 任务清空，复盘同时清空 |
| R-6 | 开始新一天正常 | 点击"开始新一天"（如有 NewDayPrompt） | 任务清空，复盘清空，可重新生成 |

### 8.6 移动端 UI 走查（2 项）

| # | 验证项 | 方法 | 预期 |
|:--:|------|------|------|
| M-1 | 触控区域 ≥ 44×44px | DevTools 移动模拟（375px 宽）| 按钮 `min-h-11`（44px），全宽可点击 |
| M-2 | 长文案正常换行 | 等待 AI 返回较长的 feedbackText（接近 180 字） | 文案正常换行不截断，卡片高度自适应 |

### 8.7 测试环境要求

| 条件 | 说明 |
|------|------|
| 浏览器 | Chrome 或 Edge（含 DevTools） |
| 网络 | 需要能访问 Supabase + DeepSeek API |
| 账号 | 准备一个 Supabase 测试账号（或使用 Magic Link 登录） |
| 移动端 | DevTools 移动模拟（375px × 812px，iPhone 尺寸）即可，不强制真实设备 |
| 数据库 | 可使用现有数据，不需要清空 |

---

## 9. P0 / P1 / P2 风险判断

### 9.1 风险矩阵

| # | 风险 | 等级 | 概率 | 影响 | 缓解措施 |
|---|------|:---:|:---:|------|------|
| 1 | 人工测试中遗漏某些边界场景 | P2 | 低 | 低 — 遗漏场景不影响核心功能 | 测试清单已覆盖 7 类 36 项，超出 Architecture §16 Phase 14C 原定 18 项验证范围 |
| 2 | 后端 AI API 不可用导致所有复盘测试 blocked | P1 | 低 | 中 — 无法验证 success/stale 状态 | 先检查 API 可用性（curl 或直接访问）；如果 API 不可用，先排查 AI_API_KEY 配置 |
| 3 | Supabase 连接异常导致无法生成任务 | P1 | 低 | 高 — 全部测试 blocked | 先验证 Supabase 连接（检查 StatsBar 是否能加载统计） |
| 4 | 测试中发现 Phase 14A/14B 未覆盖的边界 bug | P1 | 低 | 中 | 记录在验收报告中，不在此 Phase 修复。由 ChatGPT 或 Claude Code 决定是否新开 Follow-up |
| 5 | 移动端真实设备上按钮过小或布局异常 | P2 | 极低 | 低 — DevTools 模拟已可覆盖绝大多数场景 | DevTools 移动模拟即可，不强制真实设备 |
| 6 | 人工验收执行不完整（只测了部分项目） | P2 | 中 | 低 — 跳过的大概率是低频场景 | 测试清单设计为 checklist 格式，逐项打勾，降低遗漏概率 |

### 9.2 无 P0 风险

Phase 14C 不修改任何代码——只做人工验证。最坏情况：验证不通过 → 记录问题 → 新开 Follow-up 修复。不影响线上功能。

---

## 10. 是否建议进入 Codex 实现

**❌ 不建议进入 Codex 实现。**

Phase 14C 是纯人工验证阶段，不涉及任何代码编写。应由 **Claude Code 或人工测试人员** 在浏览器中按 §8 清单逐项验证，并输出验收报告。

如果需要，可以由 ChatGPT 审查验收报告并做最终把关。

---

## 11. 给 Codex 的执行边界提醒

**本阶段不需要 Codex 执行代码编写。** 以下提醒仅用于：如果人工测试中发现 P0 阻断 bug，需要 Codex 紧急修复时参考。

### 11.1 紧急修复文件红线

```
✅ 仅允许修改（且仅在发现 P0 bug 时）：
   • src/hooks/useTaskReview.ts
   • src/components/TaskReviewPanel.tsx
   • src/app/page.tsx

❌ 绝不允许修改（即使发现 bug）：
   • src/app/api/task-groups/review/route.ts   ← Phase 14A 核心红线
   • src/lib/types.ts
   • src/lib/ai-client.ts
   • src/lib/review-parser.ts
   • src/lib/stats-calculator.ts
   • src/prompts/task-review.ts
   • src/hooks/useTaskGroup.ts
   • src/hooks/useTaskStats.ts
   • src/hooks/useTaskHistory.ts
   • src/hooks/useAuth.ts
   • 任何其他 API Route / Component
   • package.json / 数据库 schema
```

### 11.2 如果发现 bug 的处理流程

```
1. 记录 bug：文件、行号、现象、复现步骤
2. 评定等级：P0（阻断）/ P1（重要）/ P2（轻微）
3. P0 → 由 Claude Code 写修复方案 → ChatGPT 审查 → Codex 实现 → Claude Code Review
4. P1/P2 → 记录在验收报告中，不在此 Phase 修复
5. 修复后重新执行受影响类别的全部测试项
```

---

## 12. 是否建议 Phase 14C 后进入 Phase 15 架构设计

### 12.1 判断结论

**✅ 建议 Phase 14C 验收通过后，由 Claude Code 先写 Phase 15 架构方案（Architecture-Phase15.md），但不直接进入实现。**

### 12.2 理由

| # | 理由 |
|---|------|
| 1 | Phase 14 全部子阶段（14A / 14B / Follow-up / 14C）均已完成，Phase 14 可以正式关闭 |
| 2 | Phase 15（智能任务调整）是 V2.0 最后一个 Phase，涉及修改 `generate-tasks` 策略——这是项目最核心的 API，必须先有完整架构设计 |
| 3 | Phase 15 依赖 Phase 14 产出的 `suggestedDifficulty` 和 `suggestedTaskCountRange` 字段，这些字段已在 Phase 14A API 中返回（但 UI 不展示），架构设计时需要评估如何将它们接入 generate-tasks |
| 4 | Phase 15 的架构设计需要回答：如何读取历史统计、如何注入 Prompt、如何保持 3-8 条任务约束、没有历史数据时如何回退——这些需要独立的架构文档 |
| 5 | 按照项目工作流：Claude Code 写架构方案 → ChatGPT 审查 → 通过后再写执行方案 → Codex 实现 |

### 12.3 进入 Phase 15 的前置条件

```
✅ Phase 14C 验收通过（36 项测试全部通过）
✅ 零 P0 / P1 问题
✅ lint + build 通过
✅ Phase 14 验收报告已输出
✅ git status 干净（或仅有验收报告文档）
✅ PROJECT-CONTEXT.md 已更新 Phase 14C 完成状态
```

### 12.4 Phase 15 架构设计时的关键约束（预热）

以下不是 Phase 14C 的内容，但提前列出，确保 Phase 14 → 15 过渡平顺：

```
Phase 15 架构设计时必须遵守：
  ✅ 基于 Phase 14 产出的 suggestedDifficulty / suggestedTaskCountRange
  ✅ 在服务端读取历史统计（不信任前端传入）
  ✅ 没有历史数据时保持 V1.0 生成逻辑（回退）
  ✅ 任务数量保持在 3-8 条产品约束内
  ✅ 不修改数据库 schema（复用现有 stats-calculator）
  ✅ 不新增 npm 依赖
  ✅ 不改动现有组件和 hooks

Phase 15 架构设计时严禁：
  ❌ 让前端传可信统计结果
  ❌ 创建用户画像系统
  ❌ 创建推荐系统
  ❌ 修改 Supabase RLS
  ❌ 新增 Supabase 表
  ❌ 做复杂多目标规划
  ❌ 修改 generate-tasks 的 JSON Schema（保持 tasks 数组结构）
```

---

> **文档结束**
>
> **执行方式**：人工在浏览器中按 §8 清单逐项验证，输出验收报告。
>
> **关联文档**：
> - `docs/Architecture-Phase14.md` — Phase 14 完整架构（含 Phase 14C/D 原始定义）
> - `docs/Execution-Plan-Phase14A.md` — Phase 14A API 执行方案
> - `docs/Execution-Plan-Phase14B.md` — Phase 14B UI 执行方案
> - `docs/Execution-Plan-Phase14B-Follow-up.md` — Phase 14B Follow-up 执行方案
> - `docs/Roadmap-Phase12-15.md` — Phase 12-15 中期路线图
> - `docs/PRD-V2.0.md` — V2.0 产品规划
> - `docs/PROJECT-CONTEXT.md` — 项目长期上下文
