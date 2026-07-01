# Phase 13：完成统计 — 技术架构方案

> **状态**：设计阶段，待 Review 通过后开发
> **依赖**：Phase 12（全部完成并通过验收）
> **对应文档**：docs/PRD-V2.0.md / docs/Roadmap-Phase12-15.md / docs/Architecture-Phase12.md / docs/Future-Architecture-Notes-Phase13-15.md
> **设计日期**：2026-07-01

---

## 目录

- [一、Phase 13 总目标](#一phase-13-总目标)
- [二、不做范围与阶段红线](#二不做范围与阶段红线)
- [三、数据库设计](#三数据库设计)
- [四、统计口径定义](#四统计口径定义)
- [五、日期与时区口径](#五日期与时区口径)
- [六、API 设计](#六api-设计)
- [七、数据归属规则](#七数据归属规则)
- [八、统计数据来源](#八统计数据来源)
- [九、前端 UI 设计](#九前端-ui-设计)
- [十、与 Phase 12 的兼容关系](#十与-phase-12-的兼容关系)
- [十一、为 Phase 14 AI 复盘预留](#十一为-phase-14-ai-复盘预留)
- [十二、Phase 13 子阶段拆分](#十二phase-13-子阶段拆分)
- [十三、验收标准汇总](#十三验收标准汇总)
- [十四、风险点与规避方案](#十四风险点与规避方案)
- [十五、阶段越界红线](#十五阶段越界红线)

---

## 一、Phase 13 总目标

### 1.1 一句话目标

让用户知道自己最近行动表现如何，但不制造压力。

### 1.2 V2.0 产品主线中的位置

```
目标 → AI 拆解 → 执行 → 记录 → [统计] → 复盘 → 智能调整
                                  ↑
                             Phase 13
```

Phase 12 补齐了"记录"环节——用户能看到过去生成过的任务组。Phase 13 在此基础上增加"统计"——让用户一眼看到自己最近完成得怎么样。

### 1.3 解决了什么

| 场景 | Phase 12 行为 | Phase 13 行为 |
|------|--------------|--------------|
| 用户想知道今天完成了多少 | 需要打开 TaskList 自己数 | 一眼看到"今日 3/5" |
| 用户想知道最近一周表现 | 需要逐条展开历史卡片心算 | 一眼看到"7 天完成率 67%" |
| 用户想知道自己连续行动了几天 | 需要手动翻历史记录 | 一眼看到"连续 5 天" |
| 新用户第一次使用 | 无历史数据 | 空状态鼓励文案 |

### 1.4 核心设计原则

| 原则 | 说明 |
|------|------|
| **轻量** | 只做简单数字 + 短句，不做图表、趋势线、燃尽图 |
| **不抢主流程** | 统计区在今日任务下方，不打断"输入目标 → 生成任务 → 执行"的核心流程 |
| **不制造压力** | 低完成率不说"你表现不好"，只说进度状态 |
| **手机端优先** | 紧凑横向排布，不占过多垂直空间 |
| **实时聚合** | 统计数据从 `task_groups` / `tasks` 实时计算，不引入物化表 |

---

## 二、不做范围与阶段红线

### 2.1 Phase 13 明确不做

| 不做 | 原因 | 归属 Phase |
|------|------|-----------|
| AI 复盘 / 今日反馈 | 复盘是 Phase 14 | Phase 14 |
| 智能任务生成调整 | 策略调整是 Phase 15 | Phase 15 |
| 趋势预测 / 燃尽图 | 超出 V2.0 范围 | — |
| 复杂图表（bar / sparkline / pie） | V2.0 不做复杂报表 | — |
| 排行榜 | 不做社交竞争 | — |
| 团队统计 | 不做协作 | — |
| 项目维度统计 | 不做项目管理 | — |
| 完整周报 | 超出 V2.0 范围 | — |
| 搜索 / 筛选 / 标签 | 超出 V2.0 范围 | — |
| 修改 generate-tasks 策略 | Phase 15 | Phase 15 |
| 推送通知 | 超出 V2.0 范围 | — |
| `daily_stats` 物化表 | PRD 建议优先从已有表聚合计算 | — |
| 统计数字 badge 在 Header | 避免制造数字焦虑，Phase 13 保持 Header 简洁 | — |

### 2.2 阶段越界红线

```
Phase 13 只做：
  ✅ 统计 API（GET /api/task-groups/stats）
  ✅ 统计 UI 组件（StatsBar / 轻量卡片）
  ✅ 今日完成率展示
  ✅ 最近 7 天完成率展示
  ✅ 总完成任务数展示
  ✅ 连续行动天数展示
  ✅ recentPerformanceLabel
  ✅ 空状态 / 加载状态 / 错误状态

Phase 13 绝不做：
  ❌ 任何 AI 调用（复盘 / 反馈 / 建议）
  ❌ 任何任务生成策略变更
  ❌ 任何图表库引入
  ❌ 任何新 npm 依赖
  ❌ 任何数据库 schema 变更
  ❌ 任何趋势预测
```

> **关于统计数字 vs 图表**：Phase 13 只展示**数字 + 短句标签**。"最近 7 天完成率 67%" 是统计数字，属于 Phase 13。用柱状图展示每天完成率变化趋势是图表，超出 Phase 13 范围。

---

## 三、数据库设计

### 3.1 核心决策：不新增字段，不新增表

**结论：Phase 13 完全复用 Phase 12 的数据库 schema，零变更。**

| 决策 | 理由 |
|------|------|
| 不新增字段 | Phase 12 已新增 `tasks.completed_at` 和 `task_groups.archived_at`，统计所需的所有字段均已就绪 |
| 不新建 `daily_stats` 表 | PRD 第 12 节明确："V2.0 初期推荐优先从 task_groups / tasks 聚合计算，避免过早引入统计表" |
| 不修改 RLS | 统计只读查询，不写入，现有 RLS 足够（API Route 使用 service_role 绕过 RLS） |
| 不新增索引 | Phase 12 的 `idx_task_groups_history` 和 `idx_task_groups_active` 已覆盖统计查询场景 |

### 3.2 统计所需字段来源

| 字段 | 所在表 | Phase 引入 | 统计用途 |
|------|--------|:---:|------|
| `task_groups.id` | task_groups | Phase 10 | 关联 tasks |
| `task_groups.goal` | task_groups | Phase 10 | 统计无需 goal（Phase 14 复盘需要） |
| `task_groups.user_id` | task_groups | Phase 11 | 归属隔离 |
| `task_groups.device_id` | task_groups | Phase 10 | 归属隔离 |
| `task_groups.created_at` | task_groups | Phase 10 | 日期聚合（"哪天生成的任务组"） |
| `task_groups.archived_at` | task_groups | Phase 12 | 区分活跃 vs 历史（统计 API 两者都读） |
| `tasks.id` | tasks | Phase 10 | 关联 |
| `tasks.task_group_id` | tasks | Phase 10 | 关联到 task_group |
| `tasks.completed` | tasks | Phase 10 | 计算完成数 |
| `tasks.completed_at` | tasks | **Phase 12** | **统计核心**：完成时间归属、连续行动天数 |

### 3.3 为什么 `completed_at` 是统计核心

```
场景：用户周一生成 5 个任务，完成 3 个（周一）。
      周二打开应用，继续完成剩余 2 个。

如果只用 tasks.completed：
  → 无法区分"周一完成的 3 个"和"周二完成的 2 个"
  → 连续行动天数的计算会出错

使用 tasks.completed_at：
  → 周一完成的 3 个：completed_at = 周一
  → 周二完成的 2 个：completed_at = 周二
  → 周一和周二各有完成的记录，streak 正确 +1
```

Phase 12 已通过 `completed_at` 保留逻辑（Architecture-Phase12.md §4.6）确保每次 toggle 写入正确的完成时间。Phase 13 直接使用，无需额外处理。

---

## 四、统计口径定义

### 4.1 统计指标体系

| # | 指标 | 字段名 | 定义 | 业务含义 |
|---|------|--------|------|------|
| 1 | 今日完成率 | `todayCompletionRate` | 今日活跃 task_group 中 completed 的任务数 / 总任务数 | 今天推进了多少 |
| 2 | 今日完成数 | `todayCompletedCount` | 今日活跃 task_group 中 completed 的任务数 | 今天完成了几个 |
| 3 | 今日总任务数 | `todayTotalCount` | 今日活跃 task_group 中的任务总数 | 今天共有几个任务 |
| 4 | 最近 7 天完成率 | `sevenDayCompletionRate` | 最近 7 天（含今天）所有 task_group 中 completed 的任务数 / 总任务数 | 近期整体完成水平 |
| 5 | 最近 7 天完成数 | `sevenDayCompletedCount` | 同上，分子 | 近 7 天完成了多少 |
| 6 | 最近 7 天总任务数 | `sevenDayTotalCount` | 同上，分母 | 近 7 天共有多少任务 |
| 7 | 总完成任务数 | `totalCompleted` | 用户所有 task_group（active + archived）中 completed 的任务累计数 | 历史总积累 |
| 8 | 连续行动天数 | `activeDayStreak` | 从今天往前数，连续每天至少有 1 个 task_group 且至少完成 1 条任务的天数 | 用户行动的连续性和稳定性 |
| 9 | 最近任务组数量 | `recentTaskGroupCount` | 最近 7 天（含今天）的 task_group 数量 | 为 Phase 14 预留：感知用户活跃频率 |
| 10 | 最近平均任务数 | `recentAverageTaskCount` | 最近 7 天 task_group 的平均任务数 | 为 Phase 15 预留：感知 AI 生成的典型任务数量 |
| 11 | 最近未完成任务数量 | `recentIncompleteTaskCount` | 最近 7 天所有 task_group 中 `completed = false` 的任务累计数 | 为 Phase 14/15 预留：感知任务是否过量 |
| 12 | 表现标签 | `recentPerformanceLabel` | 基于七日完成率和连续天数的综合标签 | 用户一眼感知自己状态 |

### 4.2 今日完成率 详细定义

```
口径：
  - 数据源：当前活跃 task_group（archived_at IS NULL）
  - 如果用户今天还没有生成任务（task_group 不存在）：
    todayCompletionRate = null（不是 0）
    todayCompletedCount = 0
    todayTotalCount = 0
  - 如果用户已生成任务但还没完成任何一条：
    todayCompletionRate = 0
    todayCompletedCount = 0
    todayTotalCount = taskGroup.tasks.length
  - 如果用户已完成部分或全部：
    todayCompletionRate = completedCount / totalCount
```

**为什么没有活跃 task_group 时返回 null 而不是 0**：0 意味着"你今天有任务但全没完成"，会制造不必要的压力。null 表示"今天还没有开始"，UI 可以不展示或展示鼓励文案。

**关于"今日"的口径补充**：
- Phase 13 的"今日完成率"实际指**当前活跃 task_group** 的完成率（`archived_at IS NULL` 的那一条），**不强制要求**活跃 task_group 的 `created_at` 属于今天。
- 用户可能隔天继续执行前一天生成但未清空的任务——这种情况仍应展示完成率，而非因为"今天没生成新任务"就让统计消失。
- 例如：用户周一生成 5 个任务，完成了 3 个。周二打开应用继续做剩余 2 个。此时活跃 task_group 仍是周一那条，`created_at` 是周一，但"今日完成率"展示的是当前任务组的完成进度。
- 未来如果引入"真正每日任务切换"机制（如每天自动生成新 task_group），再调整口径。

### 4.3 最近 7 天完成率 详细定义

```
口径：
  - 时间窗口：今天（用户本地日期）往前推 7 天（含今天 = 7 个自然日）
  - 数据源：所有 task_group（active + archived），其 created_at 落在窗口内
  - 如果窗口内没有任何 task_group：
    sevenDayCompletionRate = null
    sevenDayCompletedCount = 0
    sevenDayTotalCount = 0
  - 计算方式：
    sevenDayCompletedCount = SUM(每个 task_group 中 completed = true 的 tasks 数)
    sevenDayTotalCount = SUM(每个 task_group 中 tasks 总数)
    sevenDayCompletionRate = sevenDayCompletedCount / sevenDayTotalCount
    如果 sevenDayTotalCount = 0，sevenDayCompletionRate = null
```

**为什么用 `created_at` 而非 `archived_at` 做时间窗口**：
- 用户的行动节奏由"哪天生成任务组"定义，而非"哪天清空"
- 如果用户周一生成任务、周三才清空，这个任务组代表的是"周一"的行动，应按周一计入统计
- `created_at` 不可变，口径稳定

### 4.4 总完成任务数 详细定义

```
口径：
  - 数据源：所有 task_group（active + archived），不限时间
  - 计算方式：SUM(每个 task_group 中 completed = true 的 tasks 数)
  - 不衰减、不归零、永久累计
  - 无历史数据时返回 0
```

**为什么不依赖 `tasks.completed_at` 计算总完成数**：
- `completed_at` 用于"哪天完成的"日期归属，不是用于"是否完成"的判断
- `tasks.completed` boolean 足以判断完成状态
- 总完成数是简单的全局 COUNT，不需要日期过滤

### 4.5 连续行动天数 详细定义

```
口径：
  - 行动日定义：一个自然日（用户本地日期）内，存在至少 1 条 task 的 completed_at 不为 NULL
  - 连续：从今天开始往前数，每一天都是行动日，直到遇到第一个非行动日
  - 今天是否为行动日：
    - 今天已有 task 完成（completed_at 在今天） → 今天算行动日，计入 streak
    - 今天还没有 task 完成 → 从昨天开始往前数
  - 如果没有任何完成记录：activeDayStreak = 0

算法：
  1. 获取所有 task 的 completed_at（不为 NULL），按用户本地日期分组
  2. 从"今天"开始，逐日检查是否有完成记录
  3. 如果今天有 → streak++，检查昨天；继续直到某天没有完成记录
  4. 如果今天没有 → 从昨天开始检查
  5. 返回 streak 计数

示例：
  用户周一完成 2 个、周二完成 1 个、周三没完成、周四完成 3 个
  → activeDayStreak = 1（只有周四连续到今天……但如果今天周五也没完成，则从周四开始往前数 → 只有周四一天，streak = 1）

  用户周一完成 2 个、周二完成 1 个、周三完成 3 个（今天是周三）
  → activeDayStreak = 3（周一/二/三 连续）

  用户今天完成了 2 个（昨天和前天也有完成）
  → streak 包含今天
```

**为什么用 `completed_at` 而非 `created_at` 判断行动日**：
- "行动"的核心是"完成"，不是"生成"
- 用户生成任务但一条都不做 → 不算有效行动日
- 这符合 Roadmap 定义的"有生成任务且至少完成 1 条任务"

**为什么允许 `completed_at` 日期 ≠ `task_group.created_at` 日期**：
- 用户可能跨天完成任务（周一的任务周二才完成）
- 完成动作发生的时间点就是行动日
- Phase 12 的 `completed_at` 保留逻辑确保了完成时间的准确性

### 4.6 最近任务组数量 详细定义

```
口径：
  - 时间窗口：最近 7 天（同 §4.3 口径）
  - 计数：窗口内 task_group 的数量（不论 archived_at 状态）
  - 无数据时返回 0
```

### 4.7 最近平均任务数 详细定义

```
口径：
  - 基于 §4.6 的任务组列表
  - 计算方式：SUM(每个 task_group 的 tasks 数) / task_group 数量
  - 无数据时返回 0
  - 保留 1 位小数
```

### 4.8 最近未完成任务数量 详细定义

```
口径：
  - 时间窗口：最近 7 天（同 §4.3 口径）
  - 计算方式：SUM(每个 task_group 中 completed = false 的 tasks 数)
  - 无数据时返回 0
```

**注意**：最近未完成任务统计的是"最近 7 天生成的任务组中未完成的任务总数"，不是"今天还剩几个没做"。这会包含已归档的旧任务组中未完成的任务（跨天 carry-over）。

### 4.9 `recentPerformanceLabel` 详细定义

```
标签取值："稳定行动" | "有点吃力" | "刚刚开始"

判断优先级（从上到下匹配）：

1. totalCompleted === 0 或 sevenDayCompletionRate === null
   → "刚刚开始"
   语义：还没有足够数据判断表现

2. sevenDayCompletionRate < 0.5
   → "有点吃力"
   语义：近 7 天完成不到一半，可能需要减少任务或调整目标

3. sevenDayCompletionRate >= 0.7 AND activeDayStreak >= 3
   → "稳定行动"
   语义：完成率高且连续行动，节奏稳定

4. 其他（0.5 <= sevenDayCompletionRate < 0.7 或 activeDayStreak < 3 但完成率尚可）
   → "刚刚开始"
   语义：有一定行动但还不够稳定，仍然处于起步阶段
```

**阈值依据**：
- 50% 是"半数完成"的心理分界线——低于一半说明可能有任务难度或数量问题
- 70% 是"大部分完成"的合理门槛——高于 70% 且连续 3 天说明节奏稳定
- 连续 3 天是"习惯雏形"的最小周期

> **阈值可在 Phase 14 复盘效果验证后调整。Phase 13 先用此阈值。**

---

## 五、日期与时区口径

### 5.1 核心问题

Supabase 中 `created_at` 和 `completed_at` 存储为 `TIMESTAMPTZ`（UTC）。统计需要按"用户本地日期"聚合。

例如：用户在 UTC+8 时区，2026-07-01 晚上 23:00 完成一个任务。UTC 时间是 2026-07-01 15:00。如果按 UTC 日期统计，这个任务归入 7 月 1 日——正确。

但如果用户在 UTC-5 时区，当地时间 2026-07-01 晚上 23:00，UTC 时间是 2026-07-02 04:00。按 UTC 日期统计会归入 7 月 2 日——与用户感知的日期不一致。

### 5.2 方案选择

| 方案 | 描述 | 复杂度 | 准确性 | 是否采用 |
|------|------|:---:|:---:|:---:|
| A: 纯 UTC | 所有统计按 UTC 日期 | 最低 | 跨时区用户有偏差 | ❌ |
| B: 前端传 UTC offset（分钟） | 前端传 `timezoneOffset`（如 -480），服务端用 PostgreSQL `AT TIME ZONE` 调整 | 中 | 准确 | ✅ 采用 |
| C: 前端传 IANA 时区 | 前端传 `Asia/Shanghai` 等 IANA 标识符 | 高（服务端需要时区数据库） | 最准确（含 DST） | ❌ 过度设计 |

**结论：采用方案 B — 前端传 `timezoneOffset`（分钟）。**

### 5.3 核心公式

```
本地时间 = UTC 时间 - timezoneOffset 分钟
```

**为什么是减法？** JavaScript 的 `getTimezoneOffset()` 返回 `UTC - 本地`（分钟）。因此 `本地 = UTC - (UTC - 本地)` = `UTC - timezoneOffset`。

**示例 1 — UTC+8（北京 / 上海，timezoneOffset = -480）**：
```
本地时间 = UTC - (-480) = UTC + 480 分钟
→ 本地比 UTC 快 8 小时
→ UTC 00:00 时本地为 08:00 ✓
→ NOW() = 2026-07-01T15:00:00Z → 本地时间 2026-07-01 23:00 ✓
```

**示例 2 — UTC-5（纽约 / 东部，timezoneOffset = 300）**：
```
本地时间 = UTC - 300 = UTC - 300 分钟
→ 本地比 UTC 慢 5 小时
→ UTC 05:00 时本地为 00:00 ✓
→ NOW() = 2026-07-01T15:00:00Z → 本地时间 2026-07-01 10:00 ✓
```

**服务端实现**：Phase 13 采用**服务端 JS 内存聚合**方案（详见 §6.3），时区转换在 JS 辅助函数中完成：

- `computeSevenDayStartUTC(timezoneOffset)` — 计算用户本地 7 天前的 UTC 时间戳
- `computeStreak(completedAts, timezoneOffset)` — 将 `completed_at` 转为用户本地日期后计算 streak

两步均遵循 `本地时间 = UTC - timezoneOffset` 公式。具体 TypeScript 实现见 §6.3。

> **参考：等价的 PostgreSQL 写法（仅作参考，Phase 13 不使用数据库层聚合）**：
> ```sql
> -- 用户本地今天日期
> -- 公式：(NOW() - ($timezoneOffset || ' minutes')::INTERVAL)::date
> -- 对于 UTC+8（offset=-480）：(NOW() + INTERVAL '480 minutes')::date
> -- 例如：NOW() = 2026-07-01T15:00:00Z → 本地日期 = 2026-07-01 ✓
>
> -- completed_at 按本地日期分组（用于 streak 计算）
> -- 公式：(completed_at - ($timezoneOffset || ' minutes')::INTERVAL)::date
> -- 对于 UTC+8（offset=-480）：(completed_at + INTERVAL '480 minutes')::date
> -- 例如：completed_at = 2026-07-01T02:00:00Z → 本地日期 = 2026-07-01（UTC+8 本地 10:00）✓
>
> -- 最近 7 天起始 UTC 时间戳
> -- 步骤：
> --   1. 算出用户本地今天日期
> --   2. 减去 6 天 → 得到本地 7 天前的日期 00:00:00
> --   3. 加上 timezoneOffset 分钟 → 转回 UTC
> -- 公式：(local_today_date - INTERVAL '6 days') + ($timezoneOffset || ' minutes')::INTERVAL
> -- 对于 UTC+8（offset=-480）：
> --   (local_today_date - INTERVAL '6 days') - INTERVAL '480 minutes'
> --   NOW() = 2026-07-01T15:00:00Z 时：
> --     本地日期 = 2026-07-01
> --     7 天前本地日期 = 2026-06-25
> --     UTC 起始 = 2026-06-25T00:00:00 - 480min = 2026-06-24T16:00:00Z ✓
> ```

### 5.4 各指标的日期口径汇总

| 指标 | 日期字段 | 时区处理 | 窗口 |
|------|---------|---------|------|
| 今日完成率 | `task_groups.created_at`（查活跃 task_group） | 不需日期窗口——直接查 `archived_at IS NULL` | N/A |
| 最近 7 天完成率 | `task_groups.created_at` | ✅ 按用户本地时间 | 今天 - 6 天 ~ 今天 + 1 天 |
| 总完成任务数 | 不限日期 | 不需时区 | 全量 |
| 连续行动天数 | `tasks.completed_at` | ✅ 按用户本地日期逐日检查 | 从今天往前到第一个非行动日 |
| 最近任务组数量 | `task_groups.created_at` | ✅ 同上 | 今天 - 6 天 ~ 今天 + 1 天 |
| 最近平均任务数 | `task_groups.created_at` | ✅ 同上 | 同上 |
| 最近未完成任务数 | `task_groups.created_at` | ✅ 同上 | 同上 |
| `recentPerformanceLabel` | 基于上述 | 间接依赖上述口径 | 无独立窗口 |

### 5.5 `timezoneOffset` 默认值与容错

```
前端：
  - 正常情况：传 new Date().getTimezoneOffset()
  - 如果前端未传 timezoneOffset（异常）：
    服务端默认使用 UTC+8（timezoneOffset = -480）
    理由：应用当前面向中文用户，UTC+8 是最合理的默认值

服务端验证：
  - timezoneOffset 必须是 -720 ~ 720 之间的整数（UTC-12 ~ UTC+12）
  - 超出范围 → 使用默认值 -480
  - 非数字 → 使用默认值 -480
```

---

## 六、API 设计

### 6.1 API 路由总览

| Method | Route | 状态 | Phase 13 变更 |
|--------|-------|:---:|------|
| `GET` | `/api/task-groups/stats` | **新增** | 返回聚合统计数据 |

**只新增 1 个 API Route，不修改任何已有 API。**

### 6.2 `GET /api/task-groups/stats` — 统计数据

```
Method:   GET
Query:    ?deviceId=xxx&timezoneOffset=-480
           - deviceId: 未登录时必传（作为查询 device_id 的键），已登录时可选（API 内部忽略）
           - timezoneOffset: 用户本地时区偏移量（分钟），例如 UTC+8 = -480
             可选，默认 -480（UTC+8）

Auth:     getAuthenticatedUserId() 决定归属
```

**服务端逻辑**：

```
1. getAuthenticatedUserId()
2. 验证 timezoneOffset（-720 ~ 720，默认 -480）
3. 构建归属过滤条件：
   - 已登录: WHERE user_id = session.user.id
   - 未登录: WHERE device_id = deviceId AND user_id IS NULL
4. 执行统计查询（详见下文 §6.3）
5. 组装响应
6. 返回 StatsResponse
```

### 6.3 服务端统计查询方案

**核心方案：两步查询（复用 Phase 12B history API 已验证模式），服务端 JS 内存聚合。**

数据归属字段（`user_id` / `device_id`）只在 `task_groups` 表上，因此所有归属过滤必须在 `task_groups` 层完成。`tasks` 表没有 `user_id` / `device_id` 列，通过 `task_group_id` 关联。

**查询策略**：
1. **第一步**：从 `task_groups` 查询归属内的 task_group（不含嵌套 tasks）
2. **第二步**：从 `tasks` 用 `.in("task_group_id", taskGroupIds)` 查询所有关联 tasks
3. **第三步**：在服务端 JS 中用 `task_group_id` 把 tasks 组装回对应 task_group
4. **第四步**：在 JS 内存中聚合所有统计指标

```typescript
// Phase 13A 实现参考（Supabase JS v2）
// 复用 Phase 12B history API 已验证的两步查询模式：
//   task_groups 归属过滤 → 获取 IDs → tasks 按 task_group_id IN (...) 查询 → JS 组装

import type { SupabaseClient } from "@supabase/supabase-js";

// ─── 数据结构 ───

interface TaskRow {
  id: string;
  title: string;
  completed: boolean;
  completed_at: string | null;
  task_group_id: string;  // 用于 JS 组装
}

interface TaskGroupRow {
  id: string;
  goal: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

interface TaskGroupWithTasks extends TaskGroupRow {
  tasks: TaskRow[];
}

// ─── 第一步：查询归属内的 task_groups（不含嵌套 tasks） ───

async function fetchTaskGroups(
  supabase: SupabaseClient,
  userId: string | null,
  deviceId: string,
): Promise<TaskGroupRow[]> {

  let query = supabase
    .from("task_groups")
    .select("id, goal, created_at, updated_at, archived_at")
    .order("created_at", { ascending: false });

  // 归属过滤（与 Phase 12B history API 完全一致）
  if (userId) {
    query = query.eq("user_id", userId);
  } else {
    query = query.eq("device_id", deviceId).is("user_id", null);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`STATS_LOAD_FAILED: ${error.message}`);
  }

  return (data as TaskGroupRow[]) ?? [];
}

// ─── 第二步：按 task_group_id 批量查询 tasks ───

async function fetchTasksByGroupIds(
  supabase: SupabaseClient,
  taskGroupIds: string[],
): Promise<TaskRow[]> {

  // Supabase JS .in() 最多支持 300 个值，用户数据量远低于此
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, completed, completed_at, task_group_id")
    .in("task_group_id", taskGroupIds)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`STATS_LOAD_FAILED: ${error.message}`);
  }

  return (data as TaskRow[]) ?? [];
}

// ─── 第三步：JS 组装 —— 按 task_group_id 把 tasks 挂到对应 task_group ───

function assembleGroups(
  groups: TaskGroupRow[],
  tasks: TaskRow[],
): TaskGroupWithTasks[] {

  const tasksByGroupId = new Map<string, TaskRow[]>();
  for (const t of tasks) {
    const list = tasksByGroupId.get(t.task_group_id);
    if (list) {
      list.push(t);
    } else {
      tasksByGroupId.set(t.task_group_id, [t]);
    }
  }

  return groups.map(g => ({
    ...g,
    tasks: tasksByGroupId.get(g.id) ?? [],
  }));
}

// ─── 第四步：内存聚合统计 ───

async function computeStats(
  supabase: SupabaseClient,
  userId: string | null,
  deviceId: string,
  timezoneOffset: number,
): Promise<StatsData> {

  // 1. 查询 task_groups
  const groups = await fetchTaskGroups(supabase, userId, deviceId);

  // 2. 空数据快速返回
  if (groups.length === 0) {
    return {
      today: { completedCount: 0, totalCount: 0, completionRate: null },
      sevenDay: { completedCount: 0, totalCount: 0, completionRate: null },
      total: { totalCompleted: 0, activeDayStreak: 0 },
      recentTaskGroupCount: 0,
      recentAverageTaskCount: 0,
      recentIncompleteTaskCount: 0,
      performanceLabel: "刚刚开始",
    };
  }

  // 3. 收集 task_group_id 列表
  const taskGroupIds = groups.map(g => g.id);

  // 4. 批量查询 tasks
  const tasks = await fetchTasksByGroupIds(supabase, taskGroupIds);

  // 5. JS 组装
  const allGroups = assembleGroups(groups, tasks);

  // 6. 分类

  // 活跃 task_group（archived_at IS NULL 且 updated_at 最新）
  const activeGroup = allGroups
    .filter(g => g.archived_at === null)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    [0] ?? null;

  // 最近 7 天 task_groups（按用户本地日期过滤 created_at）
  const sevenDayStartUTC = computeSevenDayStartUTC(timezoneOffset);
  const sevenDayGroups = allGroups.filter(g =>
    new Date(g.created_at).getTime() >= sevenDayStartUTC.getTime()
  );

  // 7. 计算统计指标

  const todayStats = computeTodayFromGroup(activeGroup);
  const sevenDayStats = computeSevenDayFromGroups(sevenDayGroups);

  const totalCompleted = allGroups.reduce(
    (sum, g) => sum + g.tasks.filter(t => t.completed).length, 0
  );

  const allCompletedAts: string[] = [];
  for (const g of allGroups) {
    for (const t of g.tasks) {
      if (t.completed_at) allCompletedAts.push(t.completed_at);
    }
  }
  const activeDayStreak = computeStreak(allCompletedAts, timezoneOffset);

  const performanceLabel = computePerformanceLabel(
    sevenDayStats.completionRate, activeDayStreak, totalCompleted
  );

  return {
    today: todayStats,
    sevenDay: sevenDayStats,
    total: { totalCompleted, activeDayStreak },
    recentTaskGroupCount: sevenDayGroups.length,
    recentAverageTaskCount: sevenDayGroups.length > 0
      ? Math.round(
          (sevenDayGroups.reduce((s, g) => s + g.tasks.length, 0) /
            sevenDayGroups.length) * 10
        ) / 10
      : 0,
    recentIncompleteTaskCount: sevenDayGroups.reduce(
      (s, g) => s + g.tasks.filter(t => !t.completed).length, 0
    ),
    performanceLabel,
  };
}

// ─── 辅助函数（无变化） ───

function computeSevenDayStartUTC(timezoneOffset: number): Date {
  const now = new Date();
  const localNow = new Date(now.getTime() - timezoneOffset * 60000);
  const localToday = new Date(
    Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate()),
  );
  const localSevenDaysAgo = new Date(localToday.getTime() - 6 * 86400000);
  return new Date(localSevenDaysAgo.getTime() + timezoneOffset * 60000);
}

function computeTodayFromGroup(group: TaskGroupWithTasks | null): TodayStats {
  if (!group || group.tasks.length === 0) {
    return { completedCount: 0, totalCount: 0, completionRate: null };
  }
  const completedCount = group.tasks.filter(t => t.completed).length;
  const totalCount = group.tasks.length;
  return {
    completedCount,
    totalCount,
    completionRate: totalCount > 0 ? completedCount / totalCount : null,
  };
}

function computeSevenDayFromGroups(groups: TaskGroupWithTasks[]): SevenDayStats {
  let completedCount = 0;
  let totalCount = 0;
  for (const g of groups) {
    completedCount += g.tasks.filter(t => t.completed).length;
    totalCount += g.tasks.length;
  }
  return {
    completedCount,
    totalCount,
    completionRate: totalCount > 0 ? completedCount / totalCount : null,
  };
}

function computeStreak(completedAts: string[], timezoneOffset: number): number {
  const localDates = new Set(
    completedAts.map(utcStr => {
      const utc = new Date(utcStr);
      const local = new Date(utc.getTime() - timezoneOffset * 60000);
      return local.toISOString().slice(0, 10);
    }),
  );

  const now = new Date();
  const localNow = new Date(now.getTime() - timezoneOffset * 60000);
  let cursor = new Date(
    Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate()),
  );

  const todayStr = cursor.toISOString().slice(0, 10);
  if (!localDates.has(todayStr)) {
    cursor = new Date(cursor.getTime() - 86400000);
  }

  let streak = 0;
  while (true) {
    const dateStr = cursor.toISOString().slice(0, 10);
    if (localDates.has(dateStr)) {
      streak++;
      cursor = new Date(cursor.getTime() - 86400000);
    } else {
      break;
    }
  }
  return streak;
}
```

**关键设计决策**：
1. **不依赖 Supabase nested select**——改用显式两步查询（与 Phase 12B history API 模式一致），避免嵌套 select 的行为不确定性。
2. **不从 tasks 表直接过滤归属**——`tasks` 表没有 `user_id` / `device_id` 列，归属过滤完全在第一步 `task_groups` 查询中完成。第二步 tasks 查询只用 `.in("task_group_id", taskGroupIds)`。
3. **不使用 `.or()` 拼接 SQL 字符串**——使用 Supabase JS SDK 的 `.eq()` / `.is()` / `.in()` 标准链式调用。
4. **所有统计在服务端 JS 中计算**——today / sevenDay / total / streak / label 全部在 JS 内存中聚合，不依赖 PostgreSQL 窗口函数或复杂 SQL。
5. **空 task_group 快速返回**——如果第一步查询返回空数组，直接返回空统计结构，跳过后续步骤。
6. **如果后续需要性能优化**（如年级别数据量），再考虑 RPC 或 `daily_stats` 表。Phase 13 不做。
```

### 6.4 请求 / 响应类型

```typescript
// ─── 新增到 src/lib/types.ts ───

export type StatsErrorCode =
  | "INVALID_DEVICE_ID"
  | "INVALID_TIMEZONE_OFFSET"
  | "NOT_CONFIGURED"
  | "STATS_LOAD_FAILED"
  | "UNKNOWN_ERROR";

export interface TodayStats {
  completedCount: number;
  totalCount: number;
  completionRate: number | null;  // null = 今天还没生成任务
}

export interface SevenDayStats {
  completedCount: number;
  totalCount: number;
  completionRate: number | null;  // null = 最近 7 天无任务组
}

export interface TotalStats {
  totalCompleted: number;
  activeDayStreak: number;
}

export type PerformanceLabel = "稳定行动" | "有点吃力" | "刚刚开始";

export interface StatsData {
  today: TodayStats;
  sevenDay: SevenDayStats;
  total: TotalStats;
  recentTaskGroupCount: number;       // 为 Phase 14 预留
  recentAverageTaskCount: number;     // 为 Phase 14 预留
  recentIncompleteTaskCount: number;  // 为 Phase 14 预留
  performanceLabel: PerformanceLabel;
}

export interface StatsSuccessResponse {
  success: true;
  data: StatsData;
}

export interface StatsErrorResponse {
  success: false;
  error: {
    code: StatsErrorCode;
    message: string;
  };
}

export type StatsResponse = StatsSuccessResponse | StatsErrorResponse;
```

### 6.5 返回示例

```json
// 正常情况（用户有 5 天连续行动，今天已完成 3/5）
{
  "success": true,
  "data": {
    "today": {
      "completedCount": 3,
      "totalCount": 5,
      "completionRate": 0.6
    },
    "sevenDay": {
      "completedCount": 18,
      "totalCount": 28,
      "completionRate": 0.643
    },
    "total": {
      "totalCompleted": 42,
      "activeDayStreak": 5
    },
    "recentTaskGroupCount": 5,
    "recentAverageTaskCount": 5.6,
    "recentIncompleteTaskCount": 10,
    "performanceLabel": "稳定行动"
  }
}

// 新用户（今天还没生成任务）
{
  "success": true,
  "data": {
    "today": {
      "completedCount": 0,
      "totalCount": 0,
      "completionRate": null
    },
    "sevenDay": {
      "completedCount": 0,
      "totalCount": 0,
      "completionRate": null
    },
    "total": {
      "totalCompleted": 0,
      "activeDayStreak": 0
    },
    "recentTaskGroupCount": 0,
    "recentAverageTaskCount": 0,
    "recentIncompleteTaskCount": 0,
    "performanceLabel": "刚刚开始"
  }
}
```

### 6.6 错误结构

```typescript
// 与 Phase 12 保持一致：{ success: false, error: { code, message } }

const STATS_ERROR_MESSAGES: Record<StatsErrorCode, string> = {
  INVALID_DEVICE_ID: "设备 ID 无效。",
  INVALID_TIMEZONE_OFFSET: "时区参数无效。",
  NOT_CONFIGURED: "云端服务暂未配置。",
  STATS_LOAD_FAILED: "统计数据加载失败。",
  UNKNOWN_ERROR: "未知错误。",
};

function errorResponse(code: StatsErrorCode, status: number) {
  const body: StatsErrorResponse = {
    success: false,
    error: { code, message: STATS_ERROR_MESSAGES[code] },
  };
  return NextResponse.json(body, { status });
}
```

### 6.7 查询性能考量

Phase 13A 采用**两步查询 + 服务端 JS 聚合**：

| 步骤 | 查询 | 数据量预估 | 性能 |
|:---:|------|-----------|------|
| 1 | `task_groups`：归属过滤 + 全量读取（`select("id, goal, created_at, updated_at, archived_at")`） | 通常 15-40 条（约 1 个月的 task_group） | < 20ms，走 `idx_task_groups_active` 或 `created_at` 索引 |
| 2 | `tasks`：`.in("task_group_id", taskGroupIds)` 批量读取 | 通常 75-240 条（每个 task_group 约 5-6 条 tasks） | < 30ms，走 `task_group_id` 外键索引 |
| 3 | JS 内存聚合 | 上述数据在内存中组装 + 计算 | < 5ms |

| 统计指标 | 计算方式 | 数据来源 |
|---------|---------|---------|
| 今日完成率 | 从组装后的 allGroups 中取 `archived_at IS NULL` 的一条 | 内存 |
| 最近 7 天完成率 | 过滤 `created_at >= sevenDayStartUTC` 的 task_group，汇总 tasks | 内存 |
| 总完成数 | 汇总 allGroups 中所有 `completed = true` 的 tasks | 内存 |
| 连续行动天数 | 收集所有 `completed_at`，按本地日期分组 → streak 算法 | 内存 |

**Phase 13 不需要聚合查询优化**——两步查询总计 < 60ms，JS 聚合 < 5ms，总响应时间 < 100ms。用户数据量小（每天 1 个 task_group × 约 6 个 tasks），内存聚合完全够用。如果未来数据量增长（年级别），可在 Phase 14 或 15 评估是否需要 RPC 或 `daily_stats` 物化表。

---

## 七、数据归属规则

### 7.1 完全延续 Phase 12 的 session-aware 模型

| 状态 | 统计查询条件 | 说明 |
|------|-------------|------|
| 已登录 | `WHERE task_groups.user_id = session.user.id` | 按 user_id 聚合统计 |
| 未登录 | `WHERE task_groups.device_id = deviceId AND task_groups.user_id IS NULL` | 按 device_id 聚合统计 |

### 7.2 安全规则

| # | 规则 | 实现 |
|---|------|------|
| 1 | userId 永远从 `getAuthenticatedUserId()` 获取 | stats API 不从 query/body 读取 userId |
| 2 | 前端不传 userId | stats API query 参数只有 `deviceId` 和 `timezoneOffset` |
| 3 | 不暴露 service_role key | Phase 11 已保证，Phase 13 不新增前端 Supabase 调用 |
| 4 | 不能统计其他用户的数据 | 归属过滤强制 `WHERE user_id = session.user.id` |
| 5 | 登出后不能统计 user_id 数据 | session 清除后 API 回退 device_id 路径 |
| 6 | 不信任前端传的 stats 计算结果 | 所有统计在服务端独立计算 |

### 7.3 登出行为

```
登出后：
  - session cookie 清除
  - getAuthenticatedUserId() 返回 null
  - stats API 回退到 device_id 模式
  - 前端展示 device_id 的统计数据
  - user_id 统计数据不可见（预期行为）
  - 重新登录后 user_id 统计数据恢复
```

---

## 八、统计数据来源

### 8.1 数据读取范围

```
统计 API 数据读取范围：

  ┌──────────────────────────────────────────────┐
  │             Phase 12 历史 API                  │
  │  只读 archived_at IS NOT NULL（已归档）        │
  │  不读活跃 task_group                          │
  └──────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────┐
  │             Phase 13 统计 API                  │
  │  读 archived_at IS NULL（活跃）+               │
  │     archived_at IS NOT NULL（已归档）          │
  │  覆盖 "今天 + 过去 N 天"                       │
  └──────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────┐
  │          Phase 12 load API                     │
  │  只读 archived_at IS NULL（活跃）              │
  │  只返回最新 1 条                               │
  └──────────────────────────────────────────────┘
```

### 8.2 各指标的数据读取路径

| 指标 | task_groups 范围 | tasks 范围 | 关键条件 |
|------|:---:|:---:|------|
| 今日完成率 | 活跃（archived_at IS NULL） | 对应 tasks | LIMIT 1, 如果不存在返回 null |
| 最近 7 天完成率 | 活跃 + 已归档，created_at 在窗口内 | 对应 tasks | `created_at >= sevenDayStart` |
| 总完成任务数 | 活跃 + 已归档，不限时间 | completed = true | 全表 COUNT |
| 连续行动天数 | — | completed_at IS NOT NULL | 按用户本地日期分组 → streak 计算 |
| 最近任务组数量 | 活跃 + 已归档，created_at 在窗口内 | — | COUNT(窗口内的 task_groups) |
| 最近平均任务数 | 同上 | 对应 tasks 数 / task_group 数 | AVG(每个 task_group 的 tasks.length) |
| 最近未完成任务数 | 同上 | completed = false | SUM(窗口内每个 task_group 的未完成任务数) |

### 8.3 为什么统计必须同时读 active + archived

```
场景：今天是周三。用户周一生成任务、周二清空，周二生成新任务、周二晚上清空。
      周三生成新任务（活跃，archived_at IS NULL）。

如果只看 archived：
  → 最近 7 天 = 周一 + 周二的数据
  → ❌ 缺少周三的数据，"今天"不在统计里

如果只看 active：
  → 只有周三的数据
  → ❌ 缺少周一、周二，"最近 7 天"不完整

必须同时读 active + archived：
  → ✅ "最近 7 天" = 周一、周二（archived）+ 周三（active）
  → ✅ "今日完成率" = 周三（active）
  → ✅ "总完成数" = 全部
```

---

## 九、前端 UI 设计

### 9.1 组件树

```
page.tsx
├── Header                           (不改 — Phase 12 已有)
├── HeroSection                      (不改)
├── GoalInput                        (不改)
├── StatsBar                     ←  NEW (统计卡片条，今日任务区域上方)
│   ├── TodayStatCard            ←  NEW (今日完成率)
│   ├── SevenDayStatCard         ←  NEW (最近 7 天完成率)
│   ├── StreakStatCard           ←  NEW (连续行动天数)
│   └── TotalCompletedStatCard   ←  NEW (总完成任务数)
├── TaskList                         (不改)
└── HistoryPanel                     (不改 — Phase 12 已有)
```

### 9.2 `StatsBar` — 统计卡片条

**位置**：GoalInput 下方、TaskList 上方（或在 NewDayPrompt 之后）。

```
┌──────────────────────────────────────────────────┐
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────┐│
│  │  今日     │ │  近 7 天  │ │  连续行动  │ │ 总完成 ││
│  │  3/5     │ │   67%    │ │   5 天   │ │  42   ││
│  │  完成率   │ │  完成率   │ │           │ │  个任务 ││
│  │  60%     │ │  18/28   │ │  稳定行动  │ │       ││
│  └──────────┘ └──────────┘ └──────────┘ └───────┘│
└──────────────────────────────────────────────────┘
```

**设计要点**：
- 4 个小卡片水平排列，移动端 `grid-cols-2`（2×2），桌面端 `grid-cols-4`
- 每个卡片极其简洁：数字 + 标签，不做任何图表
- 今日卡片在无活跃任务组时显示"今天还没有开始"（不显示 0/0）
- 连续行动天数下方显示 `performanceLabel` 短标签
- 卡片背景使用极淡的 indigo/slate 色调，不抢今日任务视觉焦点
- 不显示趋势箭头（↑↓）、不显示变化百分比

### 9.3 各统计卡片的空状态

| 状态 | 今日卡片 | 7 天卡片 | 连续天数卡片 | 总完成卡片 |
|------|---------|---------|:---:|:---:|
| 新用户（无任何数据） | "今天还没有开始" | "还没有数据" | "刚刚开始" | 0 |
| 有历史但今天未生成 | "今天还没有开始" | 显示 7 天数据 | 显示 streak | 显示总数 |
| 今天已生成但无任务 0/0 | "今天还没有开始" | 同上 | 同上 | 同上 |
| 今天有任务但未完成 0/N | "0 / N" | 同上 | 同上 | 同上 |

### 9.4 移动端布局

```
移动端（宽度 < 640px）— grid-cols-2：

┌──────────────────────────────┐
│  ┌────────┐   ┌──────────┐  │
│  │  今日   │   │  近 7 天  │  │
│  │  3/5   │   │   67%    │  │
│  │  60%   │   │  18/28   │  │
│  └────────┘   └──────────┘  │
│  ┌────────┐   ┌──────────┐  │
│  │ 连续行动 │   │  总完成   │  │
│  │  5 天   │   │  42 个   │  │
│  │ 稳定行动 │   │          │  │
│  └────────┘   └──────────┘  │
└──────────────────────────────┘
```

### 9.5 文案规范

| 场景 | 文案 | 语气 |
|------|------|------|
| 今日完成率 100% | "全部完成" | 肯定，不夸大 |
| 今日完成率 ≥ 50% | 显示 "N/M · X%" | 中性 |
| 今日完成率 < 50% | 同左，不加评价 | 不制造压力 |
| 今日未开始 | "今天还没有开始" | 温和邀请 |
| 连续 ≥ 7 天 | "连续 N 天" + "稳定行动" | 正面 |
| 连续 1-6 天 | "连续 N 天" | 中性 |
| 连续 0 天 | "刚刚开始" | 鼓励 |
| 总完成 0 | "0" | 中性 |
| 7 天完成率 null | "还没有数据" | 中性 |

**禁止的文案**：
- ❌ "你完成率很低"
- ❌ "只完成了 2 个"
- ❌ "落后了"
- ❌ "你需要更努力"
- ❌ 任何感叹号强调

### 9.6 新 Hook: `useTaskStats`

```
src/hooks/useTaskStats.ts

导出内容：
  stats: StatsData | null           // 统计数据（null = 尚未加载）
  isLoading: boolean                // 首次加载中
  error: string | null              // 加载错误信息
  refreshStats(): Promise<void>     // 手动刷新统计

内部实现：
  - 调用 GET /api/task-groups/stats
  - deviceId 从 getOrCreateDeviceId() 获取
  - timezoneOffset 从 new Date().getTimezoneOffset() 获取
  - 用户登录/登出时自动刷新（监听 user?.id 变化）
  - 页面首次加载时自动获取
  - 与 useTaskHistory 类似的错误处理模式

并发控制（必须实现）：
  - 使用 useRef 持有当前进行中的请求 AbortController 或 Promise
  - 如果已有 stats 请求正在进行中：
    - refreshStats() 被调用 → 忽略新请求（不排队），复用当前进行中的请求结果
    - 理由：stats 数据在一次请求中已包含所有指标，不需要重复获取
  - 请求完成（成功或失败）后清除进行中标记，允许下次刷新
  - 这避免用户连续勾选多个任务时产生过多 stats API 请求

实现要点：
  const inflightRef = useRef<Promise<void> | null>(null);

  const refreshStats = useCallback(async () => {
    // 如果已有进行中的请求，直接复用，不发起新请求
    if (inflightRef.current) {
      return inflightRef.current;
    }

    const promise = (async () => {
      try {
        setError(null);
        const result = await fetchStats(deviceId, timezoneOffset);
        setStats(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : DEFAULT_ERROR_MESSAGE);
      } finally {
        inflightRef.current = null;
      }
    })();

    inflightRef.current = promise;
    return promise;
  }, [deviceId, timezoneOffset]);

不同于 useTaskHistory：
  - 不需要分页（一次返回全量统计）
  - 不需要 isOpen 控制（stats 始终可见）
  - 需要监听 taskGroup 变化（任务完成/清空后自动刷新）
  - 内置并发去重（防止连续 toggle 产生多个请求）
```

### 9.7 `useTaskGroup` 修改点

**`useTaskGroup` 内部不新增任何 stats 相关逻辑。** 统计刷新完全由 `page.tsx` 层的 `useTaskStats` 驱动，不耦合进 `useTaskGroup`。

推荐实现方式：

```typescript
// page.tsx（示意）
const { tasks, taskGroup, handleToggleTask, handleClearTasks, handleGenerate, handleStartNewDay, ... } = useTaskGroup();
const { stats, refreshStats } = useTaskStats({
  taskGroupId: taskGroup?.id,
  taskGroupUpdatedAt: taskGroup?.updatedAt,
  userId: user?.id,
});

// toggle 后延迟刷新（确保 save API 已写入 completed_at）
const handleToggleWithStats = async (taskId: string) => {
  await handleToggleTask(taskId);
  setTimeout(() => { refreshStats(); }, 500);
};
```

| 触发事件 | 刷新方式 | 说明 |
|---------|---------|------|
| toggle 任务 | `page.tsx` 中包装 `handleToggleWithStats`，延迟 500ms 后调用 `refreshStats()` | 确保 save API 已写入 `completed_at` |
| 清空任务 | `useTaskStats` 内部 `useEffect` 监听 `taskGroup?.id` / `taskGroup?.updatedAt` 变化 | handleClearTasks 完成后 taskGroup 状态变化 → useTaskStats 自动感知 |
| 开始新一天 | 同上 | handleStartNewDay 完成后同上 |
| 生成任务 | 同上 | handleGenerate 完成后同上 |
| 登录/登出 | `useTaskStats` 内部 `useEffect` 监听 `user?.id` | userId 变化 → 自动刷新 |

**关键**：`useTaskGroup` 自身不导入 `useTaskStats`、不调用 `refreshStats`。所有 stats 刷新要么由 `page.tsx` 胶水层触发（toggle 场景），要么由 `useTaskStats` 内部依赖监听自动触发（taskGroup 状态变化 / user 变化）。

### 9.8 `page.tsx` 集成

```
page.tsx 新增内容：
  1. import { useTaskStats } from "@/hooks/useTaskStats"
  2. import { StatsBar } from "@/components/StatsBar"
  3. 调用 useTaskStats hook
  4. 在 GoalInput 之后、NewDayPrompt / TaskList 之前渲染 <StatsBar>

现有结构保持不变：
  - Header / HeroSection / GoalInput / TaskList / HistoryPanel 不改
```

### 9.9 统计刷新时机

| 触发事件 | 触发方式 | 延迟 | 说明 |
|---------|---------|:---:|------|
| 页面首次加载 | `useTaskStats` 内部 `useEffect` on mount | 0 | 自动 |
| 用户登录/登出 | `useTaskStats` 内部 `useEffect` 依赖 `user?.id` | 0 | userId 变化 → 自动刷新 |
| 任务完成（toggle） | `page.tsx` 中 `handleToggleTask` 完成后手动调用 `setTimeout(() => refreshStats(), 500)` | 500ms | 避免 save API 尚未写入 `completed_at` |
| 清空任务 | `useTaskStats` 内部 `useEffect` 依赖 `taskGroup?.id` / `taskGroup?.updatedAt` | 0 | taskGroup 状态变化 → 自动触发 |
| 开始新一天 | 同上 | 0 | 同上 |
| 生成任务 | 同上 | 0 | 同上 |
| 历史面板打开 | 不刷新 | — | stats 与 history panel 独立 |

**设计原则**：
- `useTaskGroup` **零耦合**——不引入 stats 依赖、不调用 `refreshStats`。
- `page.tsx` 作为胶水层：将 `taskGroup?.id`、`taskGroup?.updatedAt`、`user?.id` 作为 `useTaskStats` 的依赖项传入。
- `useTaskStats` 在依赖变化时自动刷新（toggle 场景除外，需手动延迟调用）。
- toggle 的 500ms 延迟仅在 `page.tsx` 的 `handleToggleWithStats` 包装函数中处理，不侵入 `useTaskGroup`。**清空 / 生成后也通过 taskGroup 状态变化触发刷新**——`handleClearTasks` / `handleGenerate` / `handleStartNewDay` 完成后 taskGroup 状态自然变化，`useTaskStats` 自动感知。 |

---

## 十、与 Phase 12 的兼容关系

| Phase 12 产出 | Phase 13 如何使用 | 兼容性 |
|--------------|-----------------|:---:|
| `tasks.completed_at` | 连续行动天数计算、7 天完成率 | ✅ 直接使用 |
| `task_groups.archived_at` | 区分活跃 vs 已归档（统计读两者） | ✅ 直接使用 |
| `task_groups.created_at` | 7 天窗口过滤 | ✅ 直接使用 |
| history API | 不依赖（stats API 独立查询） | ✅ 无耦合 |
| HistoryPanel | 不修改 | ✅ 独立组件 |
| Header | 不修改 | ✅ 不增加 badge |
| types.ts | 新增 Stats 相关类型（追加，不修改已有） | ✅ 向后兼容 |
| localStorage 策略 | 不修改（stats 不写 localStorage） | ✅ 无影响 |
| save / delete / load API | 不修改 | ✅ 无影响 |
| RLS 策略 | 不修改 | ✅ 只读聚合，不写入 |

**兼容性总结**：Phase 13 是纯增量——新增 API + 新增 Hook + 新增组件，不修改任何 Phase 12 已有代码（除 types.ts 追加类型和 page.tsx 引入新组件外）。

---

## 十一、为 Phase 14 AI 复盘预留

### 11.1 Stats API 返回字段的预留设计

Phase 14 的 AI 复盘 Prompt 需要的所有统计数据，Phase 13 stats API 均已返回：

| Phase 14 需要 | Stats API 字段 | 格式 | 备注 |
|--------------|---------------|------|------|
| 今日完成率 | `today.completionRate` | `number \| null` | 用于判断"今天表现" |
| 今日完成数/总数 | `today.completedCount` / `today.totalCount` | `number` | 用于"完成了 N/M 个任务" |
| 最近 7 天完成率 | `sevenDay.completionRate` | `number \| null` | 用于判断"近期趋势" |
| 总完成任务数 | `total.totalCompleted` | `number` | 用于感知"用户历史深度" |
| 连续行动天数 | `total.activeDayStreak` | `number` | 用于鼓励或建议 |
| 最近未完成任务数 | `recentIncompleteTaskCount` | `number` | 用于判断任务是否过多 |
| 表现标签 | `performanceLabel` | `"稳定行动" \| "有点吃力" \| "刚刚开始"` | 用于调整复盘文案风格 |
| 最近任务组数量 | `recentTaskGroupCount` | `number` | 用于感知用户活跃频率 |
| 最近平均任务数 | `recentAverageTaskCount` | `number` | 为 Phase 15 预留 |

### 11.2 Phase 14 不需要再次查询数据库

Phase 14 的 `POST /api/task-groups/review` API 可以：
1. 调用 `getAuthenticatedUserId()` 确认身份
2. **直接复用 Phase 13 的统计计算函数**（提取为共享模块 `src/lib/stats-calculator.ts`）
3. 读取当前 taskGroup 的 goal + tasks
4. 将统计摘要作为 Prompt 上下文传入 AI

这避免了 Phase 14 重复实现统计逻辑。

### 11.3 共享统计计算模块

```
src/lib/stats-calculator.ts  ← Phase 13A 新建，Phase 14 复用

导出函数：
  computeTodayStats(supabase, ownerFilter): Promise<TodayStats>
  computeSevenDayStats(supabase, ownerFilter, timezoneOffset): Promise<SevenDayStats>
  computeTotalStats(supabase, ownerFilter, timezoneOffset): Promise<TotalStats>
  computePerformanceLabel(sevenDayRate, streak, totalCompleted): PerformanceLabel
  computeAllStats(supabase, ownerFilter, timezoneOffset): Promise<StatsData>

统计 API Route 调用 computeAllStats()。
Phase 14 review API Route 调用同样的函数。
```

---

## 十二、Phase 13 子阶段拆分

### Phase 13A：统计 API

**目标**：新增 `GET /api/task-groups/stats` + 共享统计计算模块。

**实现顺序**（严格按此顺序，每步验证通过后再进入下一步）：

| 步骤 | 内容 | 验证方法 |
|:---:|------|------|
| 1 | session-aware stats API 骨架 + 基础 today / sevenDay / totalCompleted | curl 验证归属过滤 + 基础数字正确 |
| 2 | timezoneOffset 日期窗口（7 天范围 + completed_at 本地日期分组） | curl 传不同 timezoneOffset 验证窗口边界 |
| 3 | activeDayStreak 计算 | 手动构造跨天 / 中断场景验证 streak |
| 4 | performanceLabel + recent 预留字段（recentTaskGroupCount / recentAverageTaskCount / recentIncompleteTaskCount） | curl 验证 label 在 3 种状态下正确 |

**内容**：
- [ ] 新增 `src/lib/stats-calculator.ts`（统计计算函数，可复用）
- [ ] 新增 `src/app/api/task-groups/stats/route.ts`
- [ ] 新增 types.ts 中的 Stats 相关类型（`StatsData`, `StatsResponse`, `StatsErrorCode` 等）
- [ ] 步骤 1：实现 session-aware 查询 + today / sevenDay / totalCompleted
- [ ] 步骤 2：实现 timezoneOffset 日期窗口
- [ ] 步骤 3：实现 activeDayStreak
- [ ] 步骤 4：实现 `recentPerformanceLabel` + 3 个 recent 预留字段
- [ ] 手动 curl 测试验证（每步完成后）

**禁止**：
- 不创建前端 stats 组件
- 不修改任何已有 API Route
- 不修改 useTaskGroup / useTaskHistory

**验收标准**：
1. `GET /api/task-groups/stats?deviceId=xxx&timezoneOffset=-480` 返回 200 + 完整 StatsData
2. 已登录返回 user_id 统计，未登录返回 device_id 统计
3. 今日完成率在有活跃 task_group 时返回正确值
4. 今日完成率在无活跃 task_group 时返回 null（不是 0）
5. 最近 7 天完成率正确聚合 active + archived 数据
6. 总完成任务数正确
7. 连续行动天数正确（含跨天完成场景）
8. `recentPerformanceLabel` 按阈值正确判断
9. timezoneOffset 默认 UTC+8，容错处理正确
10. 空数据返回全 0/null 结构，不报错
11. 登出后返回 device_id 统计（不含 user_id 数据）
12. `npm run lint` + `npm run build` 通过

---

### Phase 13B：统计 UI

**目标**：前端统计卡片组件 + useTaskStats hook。

**内容**：
- [ ] 新增 `src/hooks/useTaskStats.ts`
- [ ] 新增 `src/components/StatsBar.tsx`（4 卡片容器）
- [ ] 新增 `src/components/StatCard.tsx`（单个统计卡片）
- [ ] 修改 `src/app/page.tsx`（集成 StatsBar）

**禁止**：
- 不引入图表库
- 不引入新 npm 依赖
- 不修改 Header / HeroSection / GoalInput / TaskList / HistoryPanel
- 不修改 useTaskGroup / useTaskHistory 核心逻辑
- 不增加 AI 相关 UI

**验收标准**：
1. StatsBar 在 GoalInput 下方正确渲染
2. 4 个统计卡片正确展示：今日完成率、近 7 天完成率、连续行动天数、总完成任务数
3. 今日卡片在无任务时显示"今天还没有开始"
4. 7 天卡片在无数据时显示"还没有数据"
5. 连续天数下方显示 `performanceLabel`
6. 新用户空状态不报错
7. 登录/登出后统计自动切换（user_id ↔ device_id）
8. 任务完成/清空/生成后统计自动刷新
9. 移动端 grid-cols-2 布局正确
10. 桌面端 grid-cols-4 布局正确
11. 卡片不抢今日任务主流程视觉焦点
12. `npm run lint` + `npm run build` 通过

---

### Phase 13C：集成 + 边界 Cases

**目标**：与现有功能集成，验证交互正确性，处理边界。

**内容**：
- [ ] 验证：统计刷新时机正确（toggle 后 500ms → stats 更新）
- [ ] 验证：清空任务后统计更新（今日归零，7 天/总完成/streak 保持）
- [ ] 验证：开始新一天后统计更新
- [ ] 验证：跨天完成任务后 streak 计算正确
- [ ] 验证：timezoneOffset 非默认值时统计正确
- [ ] 验证：多设备同一账号统计一致
- [ ] 性能检查：stats API < 500ms
- [ ] 错误状态 UI 验证
- [ ] 加载状态 UI 验证（骨架屏或简洁 loading）

**禁止**：
- 不新增功能
- 不改 API 签名
- 不进入 Phase 14

**验收标准**：
1. 所有边界 case 通过
2. Phase 11 / 12 所有功能不受影响（回归验证）
3. 移动端 UI 验收通过
4. `npm run lint` + `npm run build` 通过

---

### Phase 13D：端到端验收 + 最终 Review

**目标**：人工全流程验收 + 数据一致性验证。

**内容**：
- [ ] 全流程人工验证：
  - 未登录生成任务 → 完成部分 → stats 正确
  - 登录生成任务 → 完成部分 → stats 正确
  - 连续多天生成并完成 → streak 正确递增
  - 某天不完成 → streak 中断
  - 清空任务 → 今日归零，历史统计不受影响
  - 开始新一天 → stats 切换到新 task_group
  - 登出 → stats 切换到 device_id 模式
  - 重新登录 → stats 恢复 user_id 模式
- [ ] 数据一致性验证：
  - 统计数字与手动计算一致
  - 今日完成率与 TaskList 显示一致
  - 7 天完成率与历史面板手动聚合一致
- [ ] `performanceLabel` 在 3 种状态下各自正确
- [ ] 空状态各场景验证
- [ ] Final Review checklist 通过
- [ ] 零 P0 / P1 问题

**禁止**：
- 不新增功能
- 不改 API 签名
- 不进入 Phase 14

**验收标准**：
1. 所有人工验收场景通过
2. 统计数据与历史记录/当前任务一致
3. Phase 11 / 12 全功能回归通过
4. `npm run lint` + `npm run build` 通过
5. git status 干净

---

## 十三、验收标准汇总

### 13.1 功能验收

| # | 验收项 | 阶段 |
|---|--------|:---:|
| 1 | 能展示今日完成率 | 13A + 13B |
| 2 | 今日未开始时显示温和空状态（不是 0/0） | 13B |
| 3 | 能展示最近 7 天完成率 | 13A + 13B |
| 4 | 能展示总完成任务数 | 13A + 13B |
| 5 | 能展示连续行动天数 | 13A + 13B |
| 6 | 能展示 `recentPerformanceLabel` | 13A + 13B |
| 7 | 已登录统计只来自当前 user_id | 13A |
| 8 | 未登录统计只来自当前 device_id | 13A |
| 9 | 登出后不显示 user_id 统计 | 13D |
| 10 | 空数据时所有指标有合理默认值 | 13A + 13B |
| 11 | 任务完成/清空/生成后统计自动刷新 | 13C |
| 12 | 移动端展示清晰 | 13B |

### 13.2 质量验收

| # | 验收项 |
|---|--------|
| 13 | `npm run lint` 通过 |
| 14 | `npm run build` 通过 |
| 15 | 手机端可用 |
| 16 | Phase 11 全部功能不受影响（回归） |
| 17 | Phase 12 全部功能不受影响（回归） |

### 13.3 安全验收

| # | 验收项 |
|---|--------|
| 18 | `SUPABASE_SERVICE_ROLE_KEY` 不出现在前端 bundle |
| 19 | 前端请求体不含 userId |
| 20 | stats API 不能越权返回其他用户数据 |
| 21 | 登出后 stats API 返回 device_id 模式（不暴露 user_id 数据） |

---

## 十四、风险点与规避方案

| # | 风险 | 概率 | 影响 | 缓解措施 |
|---|------|:---:|------|------|
| 1 | **连续行动天数计算错误**（跨天完成、时区导致日期归属偏差） | 中 | 用户体验核心指标不准确 | Phase 13C 人工验证 streak 在多种跨天场景下的正确性。如有偏差，在 stats-calculator 中增加时间窗口容差逻辑 |
| 2 | **stats API 响应时间过长**（聚合查询跨多表） | 低 | 页面加载时 stats 区域延迟显示 | 用户数据量小（每天 1 个 task_group），实际查询 < 500ms。如有性能问题，后续可考虑缓存 stats 结果（5 分钟 TTL）或 `daily_stats` 表 |
| 3 | **时区偏移导致 7 天统计不准确** | 低 | 跨时区用户看到错误的统计数字 | 前端自动获取 `getTimezoneOffset()`；服务端校检范围（-720 ~ 720）；默认 UTC+8；Phase 13D 跨时区验证 |
| 4 | **统计刷新过于频繁**（toggle → save → refresh stats → 多次重复） | 低 | 不必要的 API 请求 | toggle 后 500ms 延迟刷新；stats hook 内置去抖（同一时刻只允许 1 个进行中的请求） |
| 5 | **`completed_at` 在 Phase 12 写入不正确** → 统计全错 | 低 | 连续行动天数、7 天完成率不可信 | Phase 12D 验收已通过，`completed_at` 决策表逻辑已验证。Phase 13D 增加数据一致性验证 |
| 6 | **stats 与 TaskList 显示的完成数不一致** | 中 | 用户感知数据不可信 | stats API 直接查询 Supabase（与 load API 同源），理论上一定一致。Phase 13C 验证 |
| 7 | **`performanceLabel` 阈值不合理**（如 70% 太高，大量用户被标为"有点吃力"） | 中 | 用户体验，但 Phase 13 影响有限（Phase 14 主影响） | Phase 14 前收集真实数据验证阈值。Phase 13 先用本文 §4.9 的阈值，Phase 14 复盘效果验证后调整 |

### 风险 1 详细说明：连续行动天数

```
潜在错误场景：
  - 用户周一 23:55（UTC+8）完成一个任务 → completed_at = 周一 15:55 UTC
  - 按 UTC 日期归入周一 ✅
  - 但如果用户时区是 UTC-5，当地时间周一 23:55 = UTC 周二 04:55
    → 按 UTC 日期归入周二，但用户感知是周一完成的

缓解：
  - 使用 timezoneOffset 将 completed_at 转换为用户本地日期后再分组
  - 公式：本地日期 = (completed_at - (timezoneOffset || ' minutes')::INTERVAL)::date
  - 对于 UTC+8（offset=-480）：(completed_at + INTERVAL '480 minutes')::date
  - 连续判断基于转换后的本地日期序列
```

### 风险 6 详细说明：stats 与 TaskList 一致性问题

```
场景：用户 toggle 了 2 个任务 → save API 已成功写入
      → stats API 查询 → 此时 useTaskGroup 还在更新本地状态

如果 stats API 查询时机早于 save API 完成：
  → stats 显示旧的完成数，TaskList 显示新的完成数
  → 不一致

缓解：
  - toggle 后不立即刷新 stats，延迟 500ms（确保 save 已完成）
  - stats API 查询的是 Supabase 实时数据（不是前端本地状态）
  - 最终一致性：短暂的不一致（< 1s）可以接受
```

---

## 十五、阶段越界红线

### 15.1 Phase 13 红线（编码阶段强制执行）

```
✅ 可以做：
  - 新增 /api/task-groups/stats
  - 新增 StatsBar / StatCard 组件
  - 新增 useTaskStats hook
  - 展示统计数字
  - 展示 performanceLabel

❌ 绝不做：
  - 调用任何 AI API
  - 修改 generate-tasks 逻辑
  - 添加图表（bar / sparkline / pie / 趋势线）
  - 引入新 npm 依赖（recharts / chart.js / d3 等）
  - 修改 task_groups / tasks 表结构
  - 新增 daily_stats 表
  - 在 Header 添加 badge 数字
  - 修改 useTaskGroup / useTaskHistory 核心逻辑
  - 修改 HistoryPanel / HistoryItem
  - 编写任何 AI Prompt
  - 做趋势预测
  - 做排行榜
```

### 15.2 全局红线（所有 Phase 通用，重申）

```
❌ 不做团队协作
❌ 不做社交 / 排行榜
❌ 不做复杂项目管理
❌ 不改 Supabase 表结构（Phase 13 不需要）
❌ 不改 RLS
❌ 不暴露任何密钥
❌ 不提交 .env.local
❌ 不让前端传可信 userId
❌ 不让前端传可信统计结果
❌ 不引入新的 npm 依赖
```

---

## 附录 A：与 API 文档的对应关系

| PRD 第 13 节 | Phase 13 实现 |
|-------------|--------------|
| `GET /api/task-groups/stats` | ✅ 完全对应 §6.2 |
| `data.totalCompleted` | ✅ `total.totalCompleted` |
| `data.sevenDayCompletionRate` | ✅ `sevenDay.completionRate` |
| `data.activeDayStreak` | ✅ `total.activeDayStreak` |
| `data.today` 相关 | ✅ 扩展为完整的 `TodayStats` 对象 |

---

## 附录 B：与 Roadmap Phase 13 的对应关系

| Roadmap §5 要求 | Architecture-Phase13 覆盖 |
|----------------|--------------------------|
| 展示最近 7 天完成率 | §4.3 + §6.2 |
| 展示总完成任务数 | §4.4 + §6.2 |
| 展示连续行动天数 | §4.5 + §6.2 |
| 展示今日完成率 | §4.2 + §6.2 |
| session-aware 隔离 | §7 |
| 空数据状态 | §9.3 |
| 为 Phase 14/15 预留字段 | §11（7 个预留字段） |
| 不做复杂报表 | §2 |

---

## 附录 C：与 Future-Architecture-Notes 开放问题的回应

| 备忘录 §3.7 开放问题 | Architecture-Phase13 决定 |
|---------------------|--------------------------|
| 1. 独立 route 还是挂 history 下 | **独立 route**：`/api/task-groups/stats`（与 history API 职责不同，数据口径不同）§6.1 |
| 2. "最近 7 天"按自然周还是滚动窗口 | **滚动窗口**：今天往前 7 天（含今天）§4.3 |
| 3. activeDayStreak "连续"定义 | **严格连续**：中断 1 天即归零。用 `completed_at` 按本地日期分组判断 §4.5 |
| 4. 时区处理 | **前端传 timezoneOffset（分钟）**，服务端用 offset 调整日期边界。默认 UTC+8 §5.2 |
| 5. performanceLabel 阈值 | **已定义**：50% / 70% + 连续 3 天。Phase 14 可调整 §4.9 |
| 6. 是否需要 daily_stats | **不需要**——Phase 13 不引入。Phase 14/15 如有性能问题再评估 §3.1 |
| 7. Header badge | **不加**——避免数字焦虑。stats 在 StatsBar 展示，Header 保持简洁 §2.1 |

---

> **下一阶段**：本文档经 Review 通过后，进入 Phase 13A（统计 API）。
>
> **关联文档**：
> - `docs/PRD-V2.0.md` — V2.0 产品规划
> - `docs/Roadmap-Phase12-15.md` — Phase 12-15 中期路线图
> - `docs/Architecture-Phase12.md` — Phase 12 技术架构（上游依赖）
> - `docs/Future-Architecture-Notes-Phase13-15.md` — Phase 13-15 架构备忘录
