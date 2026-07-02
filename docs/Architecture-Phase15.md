# Architecture Phase 15 — 智能任务调整

> **状态**：架构设计阶段，待 Review 通过后进入执行方案
> **依赖**：Phase 14（全部完成并通过验收）
> **对应文档**：docs/PRD-V2.0.md / docs/Roadmap-Phase12-15.md / docs/Architecture-Phase14.md
> **设计日期**：2026-07-02

---

## 目录

- [一、Phase 15 总目标](#一phase-15-总目标)
- [二、不做范围与阶段红线](#二不做范围与阶段红线)
- [三、核心架构决策](#三核心架构决策)
- [四、当前 generate-tasks 如何接入历史统计](#四当前-generate-tasks-如何接入历史统计)
- [五、如何复用 Phase 13 的 stats-calculator](#五如何复用-phase-13-的-stats-calculator)
- [六、如何使用 Phase 14 的 suggestedDifficulty 和 suggestedTaskCountRange](#六如何使用-phase-14-的-suggesteddifficulty-和-suggestedtaskcountrange)
- [七、是否需要持久化 Phase 14 的复盘建议](#七是否需要持久化-phase-14-的复盘建议)
- [八、已登录 / 未登录的数据归属规则](#八已登录--未登录的数据归属规则)
- [九、服务端如何读取用户历史统计](#九服务端如何读取用户历史统计)
- [十、Prompt 如何增强](#十prompt-如何增强)
- [十一、任务数量如何调整](#十一任务数量如何调整)
- [十二、低完成率策略](#十二低完成率策略)
- [十三、高完成率策略](#十三高完成率策略)
- [十四、无历史数据回退](#十四无历史数据回退)
- [十五、AI 返回 JSON 结构兼容性](#十五ai-返回-json-结构兼容性)
- [十六、文件级改动清单](#十六文件级改动清单)
- [十七、新增 helper 文件设计](#十七新增-helper-文件设计)
- [十八、风险矩阵](#十八风险矩阵)
- [十九、Phase 15 子阶段拆分建议](#十九phase-15-子阶段拆分建议)
- [二十、验收标准](#二十验收标准)
- [二十一、是否建议进入 Phase 15A 执行方案设计](#二十一是否建议进入-phase-15a-执行方案设计)
- [二十二、为后续 Phase 预留](#二十二为后续-phase-预留)

---

## 一、Phase 15 总目标

### 1.1 一句话目标

让 AI 根据用户最近 7 天的任务完成统计，在生成新任务时自动调整任务数量、难度和拆解粒度，使任务更贴合用户当前的行动节奏。

### 1.2 产品定位

Phase 15 是 V2.0 产品主线的最后一环：

```
目标 → AI 拆解 → 执行 → 记录 → 统计 → 复盘 → [智能调整]
                                                    ↑
                                                Phase 15
```

Phase 15 完成后，AI Todo 的完整闭环正式打通：用户每天完成任务 → 系统积累历史 → AI 自动调整下次生成策略 → 更好的完成体验 → 更高的持续率。

### 1.3 核心价值

| 场景 | Phase 14 及之前 | Phase 15 行为 |
|------|----------------|--------------|
| 新用户第一次使用 | 固定生成 3-8 条任务 | 无历史 → 回退 V1.0 逻辑（3-5 条） |
| 低完成率用户（连续多天 < 50%）| 仍生成 3-8 条任务 | 生成 3 条更轻量、更具体的任务 |
| 稳定行动用户（≥ 80%，连续 ≥ 7 天）| 仍生成 3-8 条任务 | 可生成 5-7 条有适度挑战的任务 |
| 普通用户（50%-80% 完成率）| 仍生成 3-8 条任务 | 保持 3-5 条，正常难度 |

### 1.4 核心设计原则

| 原则 | 说明 |
|------|------|
| **服务端决策** | 所有调整逻辑在 API Route 内完成，前端不可见 |
| **不信任前端** | 统计数据只在服务端计算，前端仅传 deviceId/timezoneOffset |
| **stats-driven** | 基于 `computeAllStats()` 的 12 个统计字段，不依赖 Phase 14 复盘持久化 |
| **渐进调整** | 难度和数量变化温和，不从一个极端跳到另一个极端 |
| **无历史回退** | 没有历史数据时 100% 保持 V1.0 行为 |
| **低耦合** | 不影响勾选、清空、历史、统计、复盘 |
| **零数据库变更** | 复用现有 task_groups + tasks 表，stats 实时计算 |

---

## 二、不做范围与阶段红线

### 2.1 Phase 15 明确不做

| 不做 | 原因 |
|------|------|
| 复杂用户画像系统 | 超出 V2.0 范围 |
| 长期目标建模 / 推荐系统 | 超出 V2.0 范围 |
| 自动修改已有任务 | 复盘是只读反馈，智能调整只影响新生成 |
| 项目管理 / 甘特图 / 日历排期 | 超出产品定位 |
| 多目标并行规划 | V2.0 聚焦单日单目标 |
| 周报 / 推送通知 | 超出 V2.0 范围 |
| 会员 / 支付 / 权限分级 | 超出 V2.0 范围 |
| 自动触发任务生成 | 仍由用户手动输入目标 |
| 数据库 schema 变更 | 零新表、零新字段、零 migration |
| 新增 npm 依赖 | 复用现有 `computeAllStats` + `callAIService` |
| 修改 Supabase RLS | 仍使用 service_role key 绕过 RLS |
| 修改 JSON Schema 的 `minItems` / `maxItems` | 保持 `minItems: 3, maxItems: 8` |
| 前端传可信统计结果 | 所有统计在服务端计算 |
| 前端 UI 大幅重构 | 仅新增 request body 中的 `deviceId` 和 `timezoneOffset` |
| 修改现有组件 | TaskList / StatsBar / HistoryPanel / TaskReviewPanel 不动 |

### 2.2 阶段越界红线

```
Phase 15 只做：
  ✅ 服务端读取 stats → 计算调整策略 → 增强 Prompt → AI 生成调整后的任务
  ✅ 新增 adjust-task-strategy.ts（stats → difficulty + countRange）
  ✅ 修改 task-generation.ts（buildPrompt 接受 stats）
  ✅ 修改 generate-tasks/route.ts（读取 stats + 注入 Prompt）
  ✅ 修改 types.ts（GenerateTasksRequest 新增 deviceId / timezoneOffset）
  ✅ 修改 useTaskGroup.ts（调用 generate-tasks 时传 deviceId / timezoneOffset）

Phase 15 绝不做：
  ❌ 任何数据库 schema 变更
  ❌ 任何新表创建
  ❌ 任何新 npm 依赖
  ❌ 持久化复盘建议
  ❌ 自动触发任务生成
  ❌ 修改已有任务
  ❌ 修改 JSON Schema 约束
  ❌ 前端暴露统计调整细节
```

---

## 三、核心架构决策

### 3.1 决策总览

| # | 决策 | 选项 | 选择 |
|---|------|------|:---:|
| 1 | 调整依据来源 | A: Phase 14 review 建议 / B: Phase 13 stats 实时计算 | **B（stats 实时计算）** |
| 2 | 是否需要持久化复盘建议 | A: 持久化 / B: 不持久化 | **B（不持久化）** |
| 3 | 是否从 generate-tasks 内部调用 review API | A: 调用 / B: 不调用 | **B（不调用，避免 2× AI 成本）** |
| 4 | Prompt 增强方式 | A: 修改 System Prompt / B: 增强 User Prompt / C: 两者都改 | **C（System Prompt 微调 + User Prompt 增强）** |
| 5 | 策略逻辑位置 | A: generate-tasks route 内联 / B: 独立 helper 文件 | **B（独立 helper）** |
| 6 | 无历史回退 | A: 特殊分支 / B: stats 自然为空 | **B（stats 自然为空 → V1.0 等价）** |
| 7 | 前端改动 | A: 仅加 params / B: 加 UI 提示 | **A（仅加 params）** |

### 3.2 决策理由

**决策 1 — stats 实时计算而非 review 建议**：
- Phase 14 的 `suggestedDifficulty` 和 `suggestedTaskCountRange` 不持久化（刷新丢失）
- 如果在 generate-tasks 内调用 review API，每次任务生成变成 2 次 AI 调用，成本翻倍
- Stats 直接计算不涉及 AI 调用，0 额外成本
- Phase 14 review 和 Phase 15 adjust 本质上是同一 stats 的两种"解读"——review 解读给人看，adjust 解读给 Prompt 看。两者可独立推导，不需要依赖关系

**决策 2 — 不持久化复盘建议**：
- 零数据库变更（明确红线）
- 用户每天生成任务时，stats 会自动反映最新状态
- 复盘建议的"保质期"很短（勾选任务后即 stale），持久化价值低

**决策 3 — 不内部调用 review API**：
- 每次 generate-tasks 多加 1 次 AI 调用（~500 tokens），成本翻倍
- review API 本身设计为手动触发，不应被程序自动调用
- Stats 驱动的调整逻辑可以达到相同效果

**决策 5 — 独立 helper 文件**：
- 遵循项目分工模式（parser / calculator / adjuster 各自独立）
- 便于单元测试
- generate-tasks route 保持简洁

---

## 四、当前 generate-tasks 如何接入历史统计

### 4.1 当前流程（V1.0 / V2.0 截至 Phase 14）

```
POST /api/generate-tasks { goal }
  │
  ├── 1. 参数校验（validateGoalInput / checkRiskInput）
  ├── 2. callAIService({ goal })
  │     └── SYSTEM_PROMPT + buildPrompt(goal)
  │           └── buildPrompt 只看 goal 文本（大目标关键词检测）
  ├── 3. parseAIResponse(rawAIResponse)
  └── 4. 返回 TaskGroup { goal, tasks }
```

**关键特征**：
- 无 Supabase 访问（不需要 userId / deviceId）
- 无历史上下文
- 纯 AI 调用 + JSON 解析
- 完全不 session-aware

### 4.2 Phase 15 增强后流程

```
POST /api/generate-tasks { goal, deviceId?, timezoneOffset? }
  │
  ├── 1. 参数校验（不变）
  ├── 2. getAuthenticatedUserId()            ← 新增：读取 session
  ├── 3. computeAllStats(supabase, {userId, deviceId}, timezoneOffset)
  │     └── try-catch：失败时 stats = undefined（回退）
  ├── 4. 如果有 stats：
  │     └── computeAdjustment(stats)          ← 新增：stats → difficulty + countRange
  │           ├── difficulty: "lighter" | "normal" | "deeper"
  │           └── countRange: [min, max]
  ├── 5. callAIService({ goal, stats?, adjustment? })
  │     └── SYSTEM_PROMPT + buildPrompt(goal, stats, adjustment)
  │           ├── 无 stats → buildPrompt(goal)  ← 与 V1.0 完全一致
  │           └── 有 stats → buildPrompt(goal, stats, adjustment) ← 增强版
  ├── 6. parseAIResponse(rawAIResponse)      （不变）
  └── 7. 返回 TaskGroup { goal, tasks }      （不变）
```

### 4.3 关键变更点

| 步骤 | 当前 | Phase 15 | 风险 |
|------|------|---------|:---:|
| 参数解析 | `{ goal }` | `{ goal, deviceId?, timezoneOffset? }` | 低 |
| Auth | 无 | `getAuthenticatedUserId()` | 低 |
| DB 查询 | 无 | `computeAllStats()`（2 次 DB 查询） | 中 |
| Prompt 构建 | `buildPrompt(goal)` | `buildPrompt(goal, stats?, adjustment?)` | 中 |
| AI 调用 | `callAIService({ goal })` | 传入 enhanced prompt | 低 |

---

## 五、如何复用 Phase 13 的 stats-calculator

### 5.1 直接复用

Phase 13 的 `computeAllStats()` 返回 12 个字段，Phase 15 使用其中 5 个核心字段：

| 字段 | 类型 | Phase 15 用途 |
|------|------|--------------|
| `sevenDay.completionRate` | `number \| null` | 判断完成率高低（< 50% → lighter，≥ 80% → deeper）|
| `total.activeDayStreak` | `number` | 判断持续性（≥ 7 → deeper 前提条件）|
| `total.totalCompleted` | `number` | 判断是否有历史（0 → 回退 V1.0）|
| `recentIncompleteTaskCount` | `number` | 低完成率时评估任务过载程度 |
| `performanceLabel` | `"稳定行动" \| "有点吃力" \| "刚刚开始"` | 快速判断，直接映射 |

### 5.2 调用方式

与 Phase 14 review API 完全一致的调用模式：

```typescript
// generate-tasks/route.ts 内
import { computeAllStats } from "@/lib/stats-calculator";
import { getAuthenticatedUserId, getSupabaseServerClient } from "@/lib/supabase-server";

const userId = await getAuthenticatedUserId();
const supabase = getSupabaseServerClient();

let stats: StatsData | undefined;
if (supabase) {
  try {
    stats = await computeAllStats(supabase, { userId, deviceId }, timezoneOffset);
  } catch {
    // 静默回退：stats 读取失败时不阻断任务生成
  }
}
```

### 5.3 三个关键设计

**设计 1：stats 失败不阻断生成**。`computeAllStats` 的 try-catch 不会让 generate-tasks 返回 500。如果 DB 异常，stats = undefined → 回退 V1.0 逻辑。

**设计 2：stats 为空（新用户）自然回退**。`computeAllStats` 对新用户返回 `emptyStats()`：`totalCompleted = 0`，`sevenDay.completionRate = null`。`computeAdjustment` 遇到此情况返回 `normal` + `[3, 5]`，等价于 V1.0。

**设计 3：不新增 DB 查询**。`computeAllStats` 只做 2 次查询（task_groups + tasks），Phase 15 不会引入额外查询。生成任务的原有延迟 ~1-2 秒（主要来自 AI API），新增 DB 查询 +50-100ms，用户无感知。

---

## 六、如何使用 Phase 14 的 suggestedDifficulty 和 suggestedTaskCountRange

### 6.1 结论：Phase 15 不直接使用这两个字段

**理由**：

| 原因 | 详细说明 |
|------|---------|
| 不持久化 | Phase 14 复盘结果只存前端 state，刷新丢失。Phase 15 generate-tasks 在服务端运行，无法访问前端 state |
| 可能 stale | 用户可能在复盘后又勾选了多个任务，但未重新生成复盘。此时 `suggestedDifficulty` 已过期 |
| 成本和复杂度 | 如果让 generate-tasks 内部调用 review API，每次任务生成会额外消耗 ~500 tokens。用户每天可能多次重新生成任务 |
| 逻辑可复现 | `suggestedDifficulty` 本质上是从 stats 推导的——Phase 14 的 System Prompt 写了明确的推导规则（§9.1）。Phase 15 可以直接从 stats 实时计算，结果等价 |

### 6.2 Phase 14 字段的角色

在 Phase 15 架构中，Phase 14 的 `suggestedDifficulty` 和 `suggestedTaskCountRange` 的角色是：

```
Phase 14 Review AI（给人看）          Phase 15 Adjust（给 Prompt 看）
        │                                    │
        │ 读取 stats                          │ 读取 stats
        │ ↓                                  │ ↓
        │ AI 判断 + 自然语言输出              │ 纯函数 computeAdjustment()
        │ ↓                                  │ ↓
        │ suggestedDifficulty: "normal"       │ difficulty: "normal"
        │ suggestedTaskCountRange: [3, 5]     │ countRange: [3, 5]
        │ ↓                                  │ ↓
        │ 前端展示 feedbackText               │ generate-tasks Prompt 注入
        │ （difficulty/range 不展示）         │ （用户不可见）
```

两条路径从同一 stats 输入推导出相同结论，但用途不同：一个给用户看自然语言，一个给 AI 看机器指令。

### 6.3 未来可选增强

如果后续 Phase（如 Phase 16+）决定将复盘结果持久化到数据库，届时 generate-tasks 可以在 stats 之外**额外参考**最近的复盘 `suggestedDifficulty` 和 `suggestedTaskCountRange`，作为调整策略的增强信号。当前 Phase 15 不做此优化。

---

## 七、是否需要持久化 Phase 14 的复盘建议

### 7.1 结论：不需要

Phase 15 不依赖 Phase 14 持久化。所有调整基于实时 stats。

### 7.2 持久化方案（未来参考，Phase 15 不做）

如果未来复盘需要历史可查，可新增表（Phase 15 不做）：

```sql
-- 示意，非 Phase 15 范围
CREATE TABLE IF NOT EXISTS task_group_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_group_id UUID REFERENCES task_groups(id) ON DELETE CASCADE,
  feedback_text TEXT NOT NULL,
  sections JSONB,
  suggested_difficulty TEXT,
  suggested_task_count_range INT4RANGE,
  user_id UUID,
  device_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 八、已登录 / 未登录的数据归属规则

### 8.1 完全延续 Phase 11-14 的 session-aware 模型

| 状态 | stats 查询条件 | 说明 |
|------|---------------|------|
| 已登录 | `WHERE task_groups.user_id = session.user.id` | 基于当前登录用户的历史调整 |
| 未登录 | `WHERE task_groups.device_id = deviceId AND task_groups.user_id IS NULL` | 基于当前设备的匿名历史调整 |

### 8.2 安全性

| # | 规则 | 实现 |
|---|------|------|
| 1 | userId 永远从 `getAuthenticatedUserId()` 获取 | generate-tasks 不从 body 读取 userId |
| 2 | 前端不传 userId | 请求体只有 `goal`、`deviceId`、`timezoneOffset` |
| 3 | 已登录时忽略 body 的 `deviceId` | API 内 `if (userId) { /* 用 userId */ } else { /* 用 deviceId */ }` |
| 4 | service_role 只在服务端使用 | 同 Phase 11-14 |
| 5 | stats 归属过滤与 review API 一致 | 复用同一套 `StatsOwnerFilter` 逻辑 |

### 8.3 登出行为

```
登出后：
  - generate-tasks 中 getAuthenticatedUserId() 返回 null
  - stats 回退到 device_id 查询
  - 新生成的任务基于匿名历史调整
  - 重新登录后 stats 切回 user_id
  - 调整策略随数据范围变化自然切换
```

---

## 九、服务端如何读取用户历史统计

### 9.1 实现路径

```typescript
// generate-tasks/route.ts Phase 15 增强
export async function POST(request: NextRequest) {
  // ... 现有参数校验（不变）...

  // ═══ Phase 15 新增：读取 stats ═══
  const timezoneOffset = parseTimezoneOffset(body.timezoneOffset);
  const supabase = getSupabaseServerClient();
  const userId = await getAuthenticatedUserId();
  const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";

  let stats: StatsData | undefined;
  let adjustment: AdjustmentResult | undefined;

  if (supabase && (userId || deviceId)) {
    try {
      stats = await computeAllStats(supabase, { userId, deviceId }, timezoneOffset);
      if (stats.total.totalCompleted > 0) {
        adjustment = computeAdjustment(stats);
      }
    } catch {
      // 静默回退：stats 读取失败 → stats = undefined → V1.0 行为
    }
  }
  // ═══ Phase 15 新增结束 ═══

  // ... AI 调用 + 解析 + 返回（不变，但 prompt 构建时传入 stats/adjustment）...
}
```

### 9.2 前端传参

当前 `POST /api/generate-tasks` 的请求体：

```typescript
// Phase 14 及之前
interface GenerateTasksRequest {
  goal: string;
}
```

Phase 15 增强后：

```typescript
// Phase 15
interface GenerateTasksRequest {
  goal: string;
  deviceId?: string;        // 新增：匿名态标识（已登录时忽略）
  timezoneOffset?: number;  // 新增：本地时区偏移（默认 -480 UTC+8）
}
```

前端调用变更（`useTaskGroup.ts`）：

```typescript
// Phase 14 及之前
const response = await fetch("/api/generate-tasks", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ goal }),
});

// Phase 15
const response = await fetch("/api/generate-tasks", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    goal,
    deviceId: getOrCreateDeviceId(),              // 新增
    timezoneOffset: new Date().getTimezoneOffset(), // 新增
  }),
});
```

### 9.3 "前端不传可信统计"——防线设计

| 防线 | 机制 |
|------|------|
| **类型层面** | `GenerateTasksRequest` 只有 `goal`、`deviceId`、`timezoneOffset`，无法传入 stats 数据 |
| **API 层面** | generate-tasks route 不从 request body 读取任何 stats 字段 |
| **计算层面** | `computeAllStats()` 在服务端执行，前端不可绕过 |
| **归属层面** | userId 来自 `getAuthenticatedUserId()`，前端不可伪造 |

---

## 十、Prompt 如何增强

### 10.1 System Prompt 变更

当前 SYSTEM_PROMPT（`src/prompts/task-generation.ts`）：

```
你是一个任务规划助手（Task Planner），你的唯一职责是把用户的目标拆成今天可以执行的任务。

核心规则：
1. 只返回 JSON 对象...
2. JSON 格式必须是 {"tasks":[{"title":"任务标题"}]}。
3. 生成 3 到 8 条任务。
4. 每条任务必须具体、轻量、可执行，适合今天完成。
...
```

Phase 15 变更（微调第 3 条 + 新增第 8 条）：

```
3. 生成 3 到 8 条任务，根据用户近期的完成情况调整数量和难度。

8. 如果用户提示中建议了任务数量和难度方向，请优先遵循该建议。
```

**变更理由**：System Prompt 仅增加 2 行，让 AI 理解用户 Prompt 中的调整建议是可信的（来自服务端 stats 计算），应优先遵循。

### 10.2 buildPrompt 增强

当前 `buildPrompt(goal)`：

```typescript
export function buildPrompt(goal: string) {
  const trimmedGoal = goal.trim();
  const isBigGoal = bigGoalKeywords.some((keyword) => trimmedGoal.includes(keyword));
  const guidance = isBigGoal
    ? "这个目标可能较大，请只生成今天可以开始执行的第一组轻量任务。"
    : "请直接生成今天可以执行的轻量任务。";

  return `用户目标：${trimmedGoal}\n\n${guidance}\n\n请返回 3 到 8 条任务，严格使用 JSON 格式：{"tasks":[{"title":"任务标题"}]}`;
}
```

Phase 15 增强 `buildPrompt(goal, stats?, adjustment?)`：

```typescript
export function buildPrompt(
  goal: string,
  stats?: StatsData,
  adjustment?: AdjustmentResult,
): string {
  const trimmedGoal = goal.trim();
  const isBigGoal = bigGoalKeywords.some((keyword) => trimmedGoal.includes(keyword));
  const guidance = isBigGoal
    ? "这个目标可能较大，请只生成今天可以开始执行的第一组轻量任务。"
    : "请直接生成今天可以执行的轻量任务。";

  // ═══ Phase 15 新增：历史上下文 ═══
  let historyContext = "";
  if (stats && adjustment) {
    const rateDisplay = stats.sevenDay.completionRate !== null
      ? `${Math.round(stats.sevenDay.completionRate * 100)}%`
      : "暂无数据";

    historyContext = [
      `\n历史统计（仅供你参考，不要展示给用户）：`,
      `- 最近 7 天完成率：${rateDisplay}`,
      `- 连续行动天数：${stats.total.activeDayStreak} 天`,
      `- 最近 7 天未完成任务：${stats.recentIncompleteTaskCount} 个`,
      `- 表现状态：${stats.performanceLabel}`,
      ``,
      `调整建议：`,
      `- 建议任务难度：${adjustment.difficulty === "lighter" ? "更轻量" : adjustment.difficulty === "deeper" ? "可稍深入" : "正常难度"}`,
      `- 建议生成 ${adjustment.countRange[0]}-${adjustment.countRange[1]} 条任务`,
      `- 调整原因：${adjustment.reason}`,
    ].join("\n");
  }
  // ═══ Phase 15 新增结束 ═══

  return [
    `用户目标：${trimmedGoal}`,
    guidance,
    historyContext,
    `请返回 3 到 8 条任务，严格使用 JSON 格式：{"tasks":[{"title":"任务标题"}]}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
```

### 10.3 完整 User Prompt 示例

#### 场景 A：低完成率用户

```
用户目标：学习 Python

这个目标可能较大，请只生成今天可以开始执行的第一组轻量任务。

历史统计（仅供你参考，不要展示给用户）：
- 最近 7 天完成率：28%
- 连续行动天数：2 天
- 最近 7 天未完成任务：15 个
- 表现状态：有点吃力

调整建议：
- 建议任务难度：更轻量
- 建议生成 3-3 条任务
- 调整原因：最近7天完成率偏低（28%），建议减少任务数量并降低每条的完成门槛

请返回 3 到 8 条任务，严格使用 JSON 格式：{"tasks":[{"title":"任务标题"}]}
```

#### 场景 B：稳定行动用户

```
用户目标：深入学习 Rust 所有权机制

请直接生成今天可以执行的轻量任务。

历史统计（仅供你参考，不要展示给用户）：
- 最近 7 天完成率：87%
- 连续行动天数：14 天
- 最近 7 天未完成任务：2 个
- 表现状态：稳定行动

调整建议：
- 建议任务难度：可稍深入
- 建议生成 5-7 条任务
- 调整原因：近期完成率高（87%），连续行动稳定，可以适度增加挑战

请返回 3 到 8 条任务，严格使用 JSON 格式：{"tasks":[{"title":"任务标题"}]}
```

#### 场景 C：无历史（新用户）

```
用户目标：准备前端面试

请直接生成今天可以执行的轻量任务。

请返回 3 到 8 条任务，严格使用 JSON 格式：{"tasks":[{"title":"任务标题"}]}
```

**无历史上下文段**——与 V1.0 输出完全一致。

### 10.4 Token 预算变化

| 模块 | Phase 14 | Phase 15 低完成率 | Phase 15 稳定行动 |
|------|:---:|:---:|:---:|
| System Prompt | ~550 chars | ~600 chars (+50) | ~600 chars (+50) |
| User Prompt | ~100 chars | ~380 chars (+280) | ~380 chars (+280) |
| AI 输出 | ~500 chars | ~500 chars | ~800 chars |
| **单次 ~tokens** | ~300 | ~400 | ~450 |

增量约 100-150 input tokens / 次，成本几乎可忽略。

---

## 十一、任务数量如何调整

### 11.1 调整策略表

| sevenDayRate | activeDayStreak | performanceLabel | → difficulty | → countRange | 说明 |
|:---:|:---:|------|:---:|:---:|------|
| **null**（无历史）| 0 | 刚刚开始 | `normal` | `[3, 5]` | 回退 V1.0 |
| **< 30%** | 任意 | 有点吃力 | `lighter` | `[3, 3]` | 最轻：只生成 3 条最小任务 |
| **30%-49%** | 任意 | 有点吃力 | `lighter` | `[3, 4]` | 轻量：3-4 条低门槛任务 |
| **50%-69%** | 任意 | 刚刚开始 | `normal` | `[3, 5]` | 正常：V1.0 等价 |
| **70%-79%** | ≥ 3 | 稳定行动 | `normal` | `[4, 6]` | 略多：4-6 条 |
| **≥ 80%** | ≥ 7 | 稳定行动 | `deeper` | `[5, 7]` | 挑战：5-7 条深一度任务 |
| **≥ 80%** | < 7 | 稳定行动 | `normal` | `[4, 6]` | 完成率高但持续天数不足，保守一些 |

### 11.2 保持 3-8 条产品约束

- JSON Schema 的 `minItems: 3, maxItems: 8` **不变**
- `computeAdjustment` 的 countRange 始终返回 `[3, 3]` 到 `[5, 7]` 区间，不触碰 8 的上限
- Prompt 中的"建议生成 X-Y 条"是软建议，AI 在 JSON Schema 硬约束内执行
- 即使 AI 忽略建议生成了不同数量，JSON Schema 确保仍在 3-8 范围内

### 11.3 边界保护

| 边界 | 保护机制 |
|------|---------|
| stats 为 undefined | `computeAdjustment` 不调用 → `buildPrompt` 不附加历史上下文 → V1.0 等价 |
| `totalCompleted === 0` | `computeAdjustment` 返回 `normal` + `[3, 5]` + "新用户，无历史数据" |
| completionRate 刚好 50% | 落到 `normal` 分支（`< 50%` 才 lighter） |
| completionRate 刚好 80% + streak 刚好 7 | 落到 `deeper` 分支（`≥ 80%` 且 `≥ 7`） |
| streak 计算跨月/跨年 | `computeStreak` 已在 Phase 13 验证正确 |

---

## 十二、低完成率策略

### 12.1 触发条件

`sevenDay.completionRate < 0.5`（即完成率 < 50%）

### 12.2 策略细节

| 维度 | 处理 | Prompt 体现 |
|------|------|------------|
| **任务数量** | 减少到 3 条（最严重）或 3-4 条（中等） | `建议生成 3-4 条任务` |
| **任务粒度** | 拆得更细、更具体、更低门槛 | `建议任务难度：更轻量` |
| **措辞引导** | 每个任务的"完成感"要强：15 分钟内能完成、不需要前置条件 | Prompt 追加"每条任务应该门槛极低，开始成本几乎为零" |
| **避免** | 不生成"学习 X 概念"这类模糊任务 | 依赖 AI 遵循 Prompt 约束 |

### 12.3 Prompt 追加文案（低完成率场景）

在 `buildPrompt` 中，当 `difficulty === "lighter"` 时追加：

```
特别提醒：用户近期完成率偏低。请生成更容易开始的任务——
每条任务门槛极低（15分钟内能完成），不需要前置条件，完成感强。
避免生成模糊的"学习/了解/掌握 X"类任务。
```

### 12.4 预期效果示例

| 目标 | V1.0 可能生成 | Phase 15 lighter 生成 |
|------|-------------|---------------------|
| "学习 Python" | 1. 学习变量和数据类型 2. 理解条件判断 3. 掌握循环 4. 写一个简单计算器 5. 理解函数定义 | 1. 打开在线 Python 编辑器 2. 跟着教程完成第一个 print 语句 3. 尝试用变量保存名字并打印 |

---

## 十三、高完成率策略

### 13.1 触发条件

`sevenDay.completionRate ≥ 0.8` 且 `total.activeDayStreak ≥ 7`

### 13.2 策略细节

| 维度 | 处理 | Prompt 体现 |
|------|------|------------|
| **任务数量** | 增加到 5-7 条 | `建议生成 5-7 条任务` |
| **任务深度** | 允许略深入的拆解，但不是"更难" | `建议任务难度：可稍深入` |
| **措辞引导** | 保持可执行性，不生成"研究 X 原理"类无效任务 | Prompt 追加"适度增加挑战但不牺牲可操作性" |

### 13.3 Prompt 追加文案（高完成率场景）

```
特别提醒：用户近期完成率很高且连续行动稳定。可以适度增加任务挑战——
每条任务仍应今天可完成，但可以包含 1-2 条需要更多专注或思考的任务。
不要为了增加难度而生成模糊或不可操作的任务。
```

### 13.4 限制

- 最多建议 7 条，不触及 8 的上限（给 AI 留缓冲）
- `deeper` 不意味着"难"——意味着"稍深入的拆解"。例如："了解 React" → "用 React 写一个计数器组件"（而非"理解 React 虚拟 DOM 原理"）
- 如果 AI 生成的"deeper"任务不可操作，用户仍可手动重新生成（行为不变）

---

## 十四、无历史数据回退

### 14.1 回退条件

`stats === undefined` 或 `stats.total.totalCompleted === 0`

### 14.2 回退行为

| 步骤 | 有历史 | 无历史（回退） |
|------|--------|--------------|
| computeAllStats | ✅ 调用 | ✅ 调用（返回 emptyStats） |
| computeAdjustment | ✅ 计算 | ❌ 不调用 |
| buildPrompt | 传入 stats + adjustment | 传入 undefined |
| User Prompt | 含历史上下文 | 与 V1.0 完全一致 |
| AI 行为 | 参考 stats 调整 | V1.0 行为 |
| System Prompt | 含"遵循建议"指引 | 含"遵循建议"指引（无建议可循，AI 自行判断） |

### 14.3 验证方式

新用户（清空数据库后）→ 输入目标 → 生成的任务应与 Phase 14 行为无差异。唯一差异是 System Prompt 多了 2 行（"根据近期完成情况调整"和"遵循建议"），但对无建议的 case，AI 行为不受影响。

### 14.4 渐进过渡

用户从"无历史"到"有历史"的过渡是自然渐进的：

```
Day 1: totalCompleted = 0 → V1.0 行为（3-5 条）
Day 2: totalCompleted = 4, sevenDayRate ≈ 70% → normal（3-5 条）
Day 3-6: 逐步积累
Day 7+: sevenDayRate >= 80% 且 streak >= 7 → deeper（5-7 条）
```

不会出现 Day 1 生成 3 条、Day 2 突然跳到 7 条的情况。

---

## 十五、AI 返回 JSON 结构兼容性

### 15.1 JSON Schema 不变

```typescript
// src/lib/ai-client.ts — 保持不变
const taskJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    tasks: {
      type: "array",
      minItems: 3,    // 不变
      maxItems: 8,    // 不变
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
        },
        required: ["title"],
      },
    },
  },
  required: ["tasks"],
};
```

### 15.2 API Response 不变

```typescript
// 返回格式不变
interface GenerateTasksSuccessResponse {
  success: true;
  data: TaskGroup;  // { id, goal, tasks, createdAt, updatedAt }
}
```

### 15.3 前端无需解析新字段

`useTaskGroup` 中 `generateTasks()` 的返回处理完全不变：

```typescript
const data = await response.json();
if (data.success) {
  setTaskGroup(data.data);  // 不变
}
```

### 15.4 AI 兼容性保障

- System Prompt 的 JSON 格式描述不变（`{"tasks":[{"title":"任务标题"}]}`)
- `response_format: json_schema` 的 schema 不变（DeepSeek / OpenAI 兼容）
- `parseAIResponse` 不变
- 三段式 fallback（json_schema → json_object → 无 format）不变

---

## 十六、文件级改动清单

### 16.1 改动总览

| # | 文件 | 操作 | 行数估计 | 说明 |
|---|------|:---:|:---:|------|
| 1 | `src/lib/adjust-task-strategy.ts` | **新建** | ~80 | `computeAdjustment(stats)` |
| 2 | `src/prompts/task-generation.ts` | **修改** | +40 | `buildPrompt` 接受 stats + adjustment |
| 3 | `src/app/api/generate-tasks/route.ts` | **修改** | +45 | 读取 stats + 注入 Prompt |
| 4 | `src/lib/types.ts` | **修改** | +10 | `GenerateTasksRequest` 新增 `deviceId` / `timezoneOffset` |
| 5 | `src/lib/ai-client.ts` | **修改** | +10 | `AIClientOptions` 新增可选 `systemPrompt` / `userPrompt` override |
| 6 | `src/hooks/useTaskGroup.ts` | **修改** | +3 | `generateTasks` 调用时传 `deviceId` / `timezoneOffset` |

**总新增约 180 行，总修改约 20 行（已有文件改动量极小）。**

### 16.2 各文件详细改动

#### 16.2.1 `src/lib/adjust-task-strategy.ts`（新建 ~80 行）

```typescript
// 纯函数：StatsData → { difficulty, countRange, reason }
// 无副作用、无 DB 访问、无环境变量依赖

import type { StatsData } from "@/lib/types";

export interface AdjustmentResult {
  difficulty: "lighter" | "normal" | "deeper";
  countRange: [number, number];  // [min, max] within [3, 7]
  reason: string;                // 中文说明，注入 Prompt
}

export function computeAdjustment(stats: StatsData): AdjustmentResult {
  const rate = stats.sevenDay.completionRate;
  const streak = stats.total.activeDayStreak;

  // 无历史
  if (stats.total.totalCompleted === 0 || rate === null) {
    return {
      difficulty: "normal",
      countRange: [3, 5],
      reason: "新用户，无历史数据，使用默认策略。",
    };
  }

  // 低完成率（< 30%）
  if (rate < 0.3) {
    return {
      difficulty: "lighter",
      countRange: [3, 3],
      reason: "最近7天完成率偏低，建议生成最少量的轻量任务，降低完成门槛。",
    };
  }

  // 低完成率（30%-49%）
  if (rate < 0.5) {
    return {
      difficulty: "lighter",
      countRange: [3, 4],
      reason: "最近7天完成率偏低，建议减少任务数量并降低每条的完成门槛。",
    };
  }

  // 高完成率 + 长期连续
  if (rate >= 0.8 && streak >= 7) {
    return {
      difficulty: "deeper",
      countRange: [5, 7],
      reason: "近期完成率高且连续行动稳定，可以适度增加挑战。",
    };
  }

  // 中高完成率但持续不足
  if (rate >= 0.7) {
    return {
      difficulty: "normal",
      countRange: [4, 6],
      reason: "近期完成率不错，可以稍微增加任务量。",
    };
  }

  // 默认（50%-69%）
  return {
    difficulty: "normal",
    countRange: [3, 5],
    reason: "保持当前节奏。",
  };
}
```

#### 16.2.2 `src/prompts/task-generation.ts`（修改 ~+40 行）

详见 §10.1 和 §10.2。

#### 16.2.3 `src/app/api/generate-tasks/route.ts`（修改 ~+45 行）

新增导入：
```typescript
import { computeAllStats } from "@/lib/stats-calculator";
import { getAuthenticatedUserId, getSupabaseServerClient } from "@/lib/supabase-server";
import { computeAdjustment } from "@/lib/adjust-task-strategy";
import type { StatsData } from "@/lib/types";
```

新增 stats 读取块（在参数校验之后、AI 调用之前），详见 §9.1。

#### 16.2.4 `src/lib/types.ts`（修改 ~+10 行）

```typescript
// 修改
export interface GenerateTasksRequest {
  goal: string;
  deviceId?: string;        // Phase 15 新增
  timezoneOffset?: number;  // Phase 15 新增
}
```

#### 16.2.5 `src/lib/ai-client.ts`（修改 ~+10 行）

新增两个可选字段到 `AIClientOptions`：

```typescript
interface AIClientOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  goal: string;
  systemPrompt?: string;   // Phase 15 新增：覆盖默认 SYSTEM_PROMPT
  userPrompt?: string;      // Phase 15 新增：覆盖 buildPrompt 输出
}
```

`requestChatCompletion` 内部使用 `options.systemPrompt ?? SYSTEM_PROMPT` 和 `options.userPrompt ?? buildPrompt(options.goal)`。

> **兼容性**：不传这两个字段时，行为与 Phase 14 完全一致。Phase 14 的 review API 使用 `callAIWithPrompts`（不走 `callAIService`），不受影响。

#### 16.2.6 `src/hooks/useTaskGroup.ts`（修改 ~+3 行）

`generateTasks` 函数内，fetch body 新增两个字段：

```typescript
body: JSON.stringify({
  goal,
  deviceId: getOrCreateDeviceId(),
  timezoneOffset: new Date().getTimezoneOffset(),
}),
```

### 16.3 禁止修改的文件

```
src/lib/supabase-server.ts          ← 复用已有函数
src/lib/supabase-client.ts
src/lib/device-id.ts
src/lib/stats-calculator.ts         ← 直接调用 computeAllStats，不改
src/lib/review-parser.ts
src/lib/task-parser.ts              ← 不改（JSON 解析不变）
src/lib/input-validator.ts
src/lib/constants.ts
src/prompts/task-review.ts
src/app/api/task-groups/review/route.ts
src/app/api/task-groups/stats/route.ts
src/app/api/task-groups/history/route.ts
src/app/api/task-group/save/route.ts
src/app/api/task-group/load/route.ts
src/app/api/task-group/delete/route.ts
src/app/api/task-group/migrate/route.ts
src/components/*                     ← 全部不改
src/hooks/useTaskReview.ts
src/hooks/useTaskStats.ts
src/hooks/useTaskHistory.ts
src/hooks/useAuth.ts
src/app/page.tsx
```

---

## 十七、新增 helper 文件设计

### 17.1 `src/lib/adjust-task-strategy.ts`

| 维度 | 说明 |
|------|------|
| **职责** | 纯函数，输入 `StatsData`，输出 `AdjustmentResult` |
| **依赖** | 仅 `StatsData` 类型（来自 `@/lib/types`） |
| **副作用** | 无 |
| **可测试性** | 100% 纯函数，任何 stats 输入 → 确定性输出 |
| **边界** | 覆盖 null rate、0 totalCompleted、极端值、所有 performanceLabel |

### 17.2 `AdjustmentResult` 类型

```typescript
export interface AdjustmentResult {
  difficulty: "lighter" | "normal" | "deeper";
  countRange: [number, number];
  reason: string;
}
```

### 17.3 阈值常量（硬编码，不抽配置）

阈值数量少（4 个分支），且是产品决策而非技术参数。如果后续需要 A/B 测试或动态调整，再抽成配置。Phase 15 硬编码即可。

---

## 十八、风险矩阵

### 18.1 风险总览

| # | 风险 | 等级 | 概率 | 影响 | 缓解措施 |
|---|------|:---:|:---:|------|------|
| 1 | **任务过少**（lighter 策略过于保守，用户觉得不够） | P1 | 中 | 用户手动重新生成即可回到 3-5 条。Prompt 是软建议，AI 可在 JSON Schema 范围内微调 |
| 2 | **任务过难**（deeper 策略导致任务不可操作） | P1 | 中 | Prompt 追加"不牺牲可操作性"约束。System Prompt 第 4 条"每条任务必须具体、轻量、可执行"不因 difficulty 而改变 |
| 3 | **Prompt 过长**（历史上下文膨胀，超过 AI 上下文窗口） | P2 | 极低 | 历史上下文固定 ~280 chars。总 input ~400 tokens，远低于 4K/8K 窗口 |
| 4 | **历史统计读取失败**（Supabase 超时/异常 → 任务生成失败） | P1 | 低 | try-catch 包裹 `computeAllStats`，失败时 stats=undefined → 回退 V1.0，不阻断生成 |
| 5 | **AI 输出不稳定**（忽略调整建议，仍按默认策略生成） | P2 | 中 | JSON Schema 约束 minItems: 3 不改变。Prompt 的调整建议是"建议"非"指令"，AI 可能不完全遵循——但不会比 V1.0 更差。System Prompt 新增"优先遵循建议"可提高遵循率 |
| 6 | **影响现有生成任务功能**（stats 读取引入的延迟或错误导致 generate-tasks 体验下降） | P1 | 低 | stats 读取在 try-catch 内，失败不阻断。DB 查询 < 100ms，用户无感知。Phase 15C 回归验证 generate-tasks 行为 |
| 7 | **session-aware 改造引入 auth 依赖问题** | P2 | 低 | 完全复用 Phase 11-14 已验证的 `getAuthenticatedUserId()` 模式。generate-tasks 当前不走 auth，但新增的 stats 读取可 fallback |
| 8 | **匿名用户 deviceId 丢失导致 stats 读取失败** | P2 | 极低 | deviceId 来自 localStorage，与 review/stats API 同一来源。如果丢失，stats 为空 → V1.0 回退 |

### 18.2 无 P0 风险

Phase 15 所有调整都是"软性"的——Prompt 增强而非硬编码逻辑。最坏情况：AI 忽略调整建议，行为回退到 V1.0。不会让 generate-tasks 不可用。

### 18.3 stats 读取失败的降级路径

```
computeAllStats 失败
  → stats = undefined
  → computeAdjustment 不调用
  → buildPrompt(goal) — 不附加历史上下文
  → callAIService 使用默认 SYSTEM_PROMPT + 无历史 User Prompt
  → 100% 等价于 Phase 14 generate-tasks 行为
  → 用户完全无感知（除任务生成策略未个性化外）
```

---

## 十九、Phase 15 子阶段拆分建议

### 19.1 拆分方案

| 阶段 | 名称 | 内容 | 文件数 |
|:---:|------|------|:---:|
| **15A** | 服务端策略 + Prompt 增强 | adjust-task-strategy.ts（新）、task-generation.ts（改）、ai-client.ts（改）、types.ts（改）、generate-tasks/route.ts（改） | 5 |
| **15B** | 前端传参 + 端到端集成 | useTaskGroup.ts（改） | 1 |
| **15C** | 验收 + 回归 | 手动测试 + 回归验证 | 0 |

### 19.2 不拆的理由（可考虑 15A+15B 合并）

15B 只改 `useTaskGroup.ts` 的 3 行（加 `deviceId` 和 `timezoneOffset` 到 fetch body）。改动极小，可与 15A 合并为一个阶段。

**推荐**：15A（服务端）+ 15B（前端）合并为 **Phase 15（智能任务调整）**，15C 为验收。与 Phase 14 的 A/B/C 拆分模式保持一致。

### 19.3 执行顺序

```
1. types.ts 新增字段                      ← 最先（其他文件依赖类型）
2. adjust-task-strategy.ts 新建           ← 独立模块，可并行
3. task-generation.ts 修改 buildPrompt     ← 依赖 2
4. ai-client.ts 修改 AIClientOptions       ← 独立
5. generate-tasks/route.ts 修改           ← 依赖 2, 3, 4
6. useTaskGroup.ts 修改                   ← 依赖 1, 5
```

---

## 二十、验收标准

### 20.1 功能验收

| # | 验收项 | 验证方法 |
|---|--------|---------|
| 1 | 无历史用户 → generate-tasks 行为与 Phase 14 一致 | 清空 DB → 生成任务 → 任务数量 3-5 条，无异常 |
| 2 | 低完成率（模拟 < 30%）→ 生成 3 条更轻任务 | 构造低完成率 stats → 验证生成任务数 ≤ 4，任务粒度细 |
| 3 | 中等完成率（50-69%）→ 保持正常策略 | 构造中等完成率 stats → 任务数 3-5 条 |
| 4 | 高完成率 + 连续 ≥ 7 天 → 生成 5-7 条 | 构造高完成率 + 高 streak stats → 任务数 ≥ 5 |
| 5 | stats 读取失败 → 回退 V1.0（不报错） | 断网或 Supabase 不可用时 → 仍能正常生成任务 |
| 6 | 已登录 → 基于 user_id 历史调整 | 登录 → 生成任务 → 调整策略与 user_id stats 一致 |
| 7 | 未登录 → 基于 device_id 历史调整 | 未登录 → 生成任务 → 调整策略与 device_id stats 一致 |
| 8 | 登出后 → 策略切换到 device_id | 登录 → 完成任务 → 登出 → 生成任务 → 策略基于 device stats |
| 9 | AI JSON 返回结构不变 | 各种场景下 `parseAIResponse` 正常解析 |
| 10 | 不影响勾选、清空、历史、统计、复盘 | 回归验证 |

### 20.2 质量验收

| # | 验收项 |
|---|--------|
| 11 | `npm run lint` 通过 |
| 12 | `npm run build` 通过 |
| 13 | 手机端任务生成正常（策略调整不改变 UI） |
| 14 | Phase 11 全部功能不受影响（回归） |
| 15 | Phase 12 全部功能不受影响（回归） |
| 16 | Phase 13 全部功能不受影响（回归） |
| 17 | Phase 14 全部功能不受影响（回归） |

### 20.3 安全验收

| # | 验收项 |
|---|--------|
| 18 | generate-tasks 请求体不含 userId |
| 19 | generate-tasks 不从 body 读取 stats 数据 |
| 20 | stats 读取使用 service_role + 归属过滤 |
| 21 | `AI_API_KEY` 不出现在前端 bundle |
| 22 | 登出后 stats 不读到 user_id 数据 |

### 20.4 Token 验收

| # | 验收项 |
|---|--------|
| 23 | 无历史时不附加历史上下文（token 不增加） |
| 24 | 有历史时 input token 增量 ≤ 200 tokens |

---

## 二十一、是否建议进入 Phase 15A 执行方案设计

### 21.1 判断

**✅ 建议。** 本架构方案已覆盖 24 项设计要点，所有关键决策已做出。可以进入执行方案编写阶段。

### 21.2 进入执行方案前需要确认的项

| # | 确认项 | 状态 |
|---|--------|:---:|
| 1 | stats 驱动而非 review 驱动 | ✅ 本方案已决策 |
| 2 | 不持久化复盘建议 | ✅ 本方案已决策 |
| 3 | 不修改 JSON Schema 的 minItems / maxItems | ✅ 本方案已约束 |
| 4 | generate-tasks 变为 session-aware | ✅ 本方案已设计 |
| 5 | 前端仅加 deviceId + timezoneOffset | ✅ 本方案已设计 |
| 6 | 调整阈值（< 30% / 30-49% / 50-69% / 70-79% / ≥ 80%）| ⚠️ 建议 ChatGPT 把关确认 |
| 7 | 15A 和 15B 是否合并 | ⚠️ 建议 ChatGPT 把关确认 |

### 21.3 工作流

```
1. Claude Code 写 Architecture-Phase15.md（本文档）   ← 当前步骤
2. ChatGPT 审查架构方案 + 把关阈值和阶段拆分
3. 通过后 → Claude Code 写 Execution-Plan-Phase15.md
4. ChatGPT 审查执行方案
5. Codex 按执行方案实现
6. Claude Code Review
7. ChatGPT 最终把关
8. 提交
```

---

## 二十二、为后续 Phase 预留

### 22.1 当前 Phase 15 的限制

| 限制 | 原因 | 未来 Phase 可能的方向 |
|------|------|---------------------|
| 只基于 7 天 stats | 简单、稳定、低成本 | Phase 16+ 可扩展为 14 天/30 天 |
| 不持久化复盘建议 | 零 DB 变更 | Phase 16+ 持久化 review + 结合 stats 双重信号 |
| 阈值硬编码 | 快速上线 | Phase 16+ 用户可配置"任务量偏好" |
| 调整是单向的（只在 generate-tasks 时） | 不修改已有任务 | Phase 16+ 可在复盘后"建议调整当前任务" |

### 22.2 扩展点

| 扩展点 | 当前实现 | 未来方向 |
|--------|---------|---------|
| `computeAdjustment` | 4 个分支 | 可增加分支（如：连续 3 天完成率 0% → 特殊处理） |
| `buildPrompt` | 附加 historyContext | 可附加更丰富的上下文（如最近 3 个目标摘要） |
| `difficulty` | 3 级 | 可扩展为 5 级（非常轻/轻/正常/有挑战/有深度） |
| `countRange` | [3,7] 内 | 可支持用户偏好覆盖 |

---

> **文档结束**
>
> **下一阶段**：本文档经 ChatGPT Review 通过后，进入 Phase 15A 执行方案设计。
>
> **关联文档**：
> - `docs/PRD-V2.0.md` — V2.0 产品规划（§15: Phase 15 拆分建议）
> - `docs/Roadmap-Phase12-15.md` — Phase 12-15 中期路线图（§7: Phase 15 定义）
> - `docs/Architecture-Phase14.md` — Phase 14 完整架构（§19: 为 Phase 15 预留）
> - `docs/Architecture-Phase13.md` — Phase 13 技术架构（stats-calculator 设计）
> - `docs/Execution-Plan-Phase14C.md` — Phase 14C 执行方案（§12.4: Phase 15 关键约束）
> - `docs/PROJECT-CONTEXT.md` — 项目长期上下文
