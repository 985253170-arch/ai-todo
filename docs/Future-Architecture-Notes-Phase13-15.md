# Future Architecture Notes: Phase 13 / 14 / 15

> **文档类型**：架构备忘录（非正式详细架构）
> **创建日期**：2026-06-30
> **依赖文档**：`docs/PRD-V2.0.md` / `docs/Roadmap-Phase12-15.md` / `docs/Architecture-Phase12.md`
>
> **⚠️ 重要声明**：
> - 本文档**不是** Phase 13 / 14 / 15 的正式详细架构。
> - 正式 `Architecture-Phase13.md` 必须等 **Phase 12 完成并通过验收后**再写。
> - 正式 `Architecture-Phase14.md` 必须等 **Phase 13 完成并确认统计口径后**再写。
> - 正式 `Architecture-Phase15.md` 必须等 **Phase 14 完成并确认 AI 复盘效果后**再写。
> - 本文档的目的是**避免后续上下文过长导致忘记规划**，提前保存关键决策和约束。

---

## 目录

- [一、文档目的](#一文档目的)
- [二、与上游文档的关系](#二与上游文档的关系)
- [三、Phase 13：完成统计](#三phase-13完成统计)
- [四、Phase 14：AI 复盘](#四phase-14ai-复盘)
- [五、Phase 15：智能任务调整](#五phase-15智能任务调整)
- [六、统一数据原则](#六统一数据原则)
- [七、统一越界红线](#七统一越界红线)
- [八、未来执行提醒](#八未来执行提醒)

---

## 一、文档目的

1. **防止遗忘**：当上下文过长导致 Codex / Claude Code 丢失 Phase 13-15 规划时，本文档作为恢复记忆的锚点。
2. **统一约束**：Phase 13 / 14 / 15 共享的数据原则、API 原则、UI 原则在此集中定义，避免每个 Phase 独立设计时方向漂移。
3. **阶段边界**：明确每个 Phase 的输入依赖和输出交付物，防止越界实现。
4. **待确认问题**：记录每个 Phase 正式架构前必须重新审视的开放问题。

---

## 二、与上游文档的关系

```
PRD-V2.0.md        → 产品方向 + 功能模块定义
    │
    ▼
Roadmap-Phase12-15.md → 技术路线 + 阶段依赖 + 验收标准 + 红线
    │
    ├── Architecture-Phase12.md  ← 已创建（Review 中）
    │
    ├── Future-Architecture-Notes-Phase13-15.md  ← 本文档（备忘录）
    │
    └── 正式架构（Phase 12 完成后逐个编写）：
        ├── Architecture-Phase13.md
        ├── Architecture-Phase14.md
        └── Architecture-Phase15.md
```

| 文档 | 作用 | 本次是否依赖 |
|------|------|:---:|
| `PRD-V2.0.md` | 定义 V2.0 五模块（今日行动 / 历史 / 统计 / AI 复盘 / 智能调整）的产品功能 | ✅ |
| `Roadmap-Phase12-15.md` | 定义 Phase 12-15 的技术路线、依赖关系、验收标准、阶段红线 | ✅ |
| `Architecture-Phase12.md` | Phase 12 已完成的技术设计，定义数据库字段、API 结构、安全模型 | ✅ |

---

## 三、Phase 13：完成统计

### 3.1 未来目标

让用户知道自己最近行动表现如何，但不制造压力。

Phase 13 的重点是 **轻量反馈**，不是复杂报表。

### 3.2 依赖 Phase 12 的数据

| 依赖内容 | Phase 12 产出 | 用途 |
|---------|-------------|------|
| `task_groups` 表 | `archived_at` 字段 | 区分活跃 vs 历史；按日期范围聚合 |
| `tasks` 表 | `completed_at` 字段 | 计算完成时间归属（哪天完成了几条） |
| `task_groups.user_id / device_id` | Phase 11 已有 | 按归属隔离统计 |
| `task_groups.created_at` | Phase 10 已有 | 按日期聚合统计 |
| history API 返回结构 | `TaskGroup[]`（含 tasks） | 统计 API 可复用查询模式 |

Phase 13 **不需要**再次修改数据库 schema——所有统计字段直接基于 Phase 12 的 `completed_at` 和 `archived_at` 做聚合查询。

### 3.3 可能需要的 API

| API | 用途 | 备注 |
|-----|------|------|
| `GET /api/task-groups/stats` | 返回今日统计 + 最近 7 天统计 | 统一返回结构：`{ success, data: { today, sevenDay, total } }` |

**可能的返回字段**（不作最终承诺）：

```typescript
// 示意——正式架构再定
interface StatsResponse {
  today: {
    completedCount: number;
    totalCount: number;
    completionRate: number;       // 0-1
  };
  sevenDay: {
    completedCount: number;
    totalCount: number;
    completionRate: number;
  };
  total: {
    totalCompleted: number;       // 累计完成任务数
    activeDayStreak: number;      // 连续行动天数
  };
  performanceLabel: "稳定行动" | "有点吃力" | "刚刚开始";
}
```

**统计 API 的数据口径**（必须与 history API 不同）：
- history API 只读 `archived_at IS NOT NULL`
- 统计 API 可以读 `archived_at IS NULL`（活跃）+ `archived_at IS NOT NULL`（历史）——覆盖"今天 + 过去 N 天"
- 正式架构时必须明确日期口径（按 `created_at` 还是 `completed_at` 计算"今天"）

### 3.4 可能需要的 UI

| 组件 | 位置 | 备注 |
|------|------|------|
| `StatsBar` 或轻量统计卡片 | 主页面（HeroSection 下方或 TaskList 上方） | 不抢今日任务主流程 |
| 今日完成率展示 | 同上 | 数字 + 短句，不做图表 |
| 最近 7 天简要统计 | 可折叠区域 | 轻量入口 |
| 连续行动天数 + 总完成数 | 同上 | 底部 or 统计区 |

**UI 约束**（延续 Phase 12 设计原则）：
- 手机端优先
- 统计不抢主流程（今日行动计划仍是第一屏核心）
- 只做简单数字 + 短句，不做 bar / sparkline / pie
- 文案温和，不制造焦虑
- 空数据状态清晰（新用户无统计数据 → 鼓励文案）

### 3.5 必须遵守的统计口径

| 口径 | 说明 |
|------|------|
| **归属隔离** | 已登录按 `user_id` 聚合；未登录按 `device_id` 聚合 |
| **日期归属** | 优先用 `task_groups.created_at` 确定"哪天生成的"；`tasks.completed_at` 确定"哪天完成的" |
| **完成率公式** | `completedCount / totalCount`（totalCount 为 0 时返回 0 或不展示） |
| **连续行动天数** | 有生成任务且至少完成 1 条任务的连续天数 |
| **不落库** | 统计数据优先从 `task_groups` / `tasks` 实时聚合计算，不引入 `daily_stats` 表（除非查询性能确实需要） |

### 3.6 不做范围

- ❌ 不做复杂图表（bar / sparkline / pie / 趋势线）
- ❌ 不做燃尽图
- ❌ 不做趋势预测
- ❌ 不做排行榜
- ❌ 不做团队统计
- ❌ 不做项目维度统计
- ❌ 不做完整周报
- ❌ 不做 AI 复盘（Phase 14）
- ❌ 不做智能生成调整（Phase 15）
- ❌ 不让前端传可信统计结果

### 3.7 正式架构前必须重新确认的问题

1. **统计 API 是否单独建 route，还是挂在 history API 下**（如 `/api/task-groups/stats` vs `/api/task-groups/history?stats=true`）？
2. **"最近 7 天"按自然周（周一-周日）还是滚动窗口（今天往前 7×24h）**？
3. **`activeDayStreak` 的"连续"定义**：允许 1 天中断？按自然日还是 24h 窗口？
4. **时区处理**：`created_at` / `completed_at` 是 UTC。前端展示按用户本地时区。聚合查询是否需要传时区参数？还是服务端默认 UTC，前端自己转换？
5. **`performanceLabel` 的判断阈值**："稳定行动" / "有点吃力" / "刚刚开始" 的具体分界线？
6. **是否需要 `daily_stats` 物化表**？当前预判不需要——但 Phase 13 实现时如果查询性能不佳，可能需要重新评估。
7. **统计数字是否需要 badge 显示在 Header**（如历史按钮旁显示"连续 5 天"）？

---

## 四、Phase 14：AI 复盘

### 4.1 未来目标

让 AI 基于用户完成情况给出 **短、温和、行动导向** 的反馈。

Phase 14 的重点是 **复盘**，不是自动改变任务生成策略。

### 4.2 依赖 Phase 13 的统计字段

| 依赖 | Phase 13 产出 | 用途 |
|------|-------------|------|
| 今日完成率 | stats API | AI 判断今天表现 |
| 最近 7 天完成率 | stats API | AI 判断近期趋势 |
| 总完成任务数 | stats API | AI 感知用户历史深度 |
| 连续行动天数 | stats API | AI 鼓励或建议 |
| 最近未完成任务数量 | stats API | AI 感知任务难度是否合适 |
| `recentPerformanceLabel` | stats API | AI 调整复盘文案风格 |

### 4.3 可能需要的 API

| API | 用途 | 触发方式 |
|-----|------|---------|
| `POST /api/task-groups/review` | AI 复盘 | 用户手动触发（按钮）或完成任务后自动触发 |

**可能的请求/响应结构**（示意）：

```typescript
// 请求
interface ReviewRequest {
  taskGroupId: string;  // 今日任务组 ID
}

// 响应
interface ReviewResponse {
  success: true;
  data: {
    feedbackText: string;                          // 人类可读的复盘文案
    suggestedDifficulty: "lighter" | "normal" | "deeper";  // 留给 Phase 15
    suggestedTaskCountRange: [number, number];     // 留给 Phase 15
  };
}
```

**AI 调用约束**：
- 服务端发起 AI 请求（不从前端）
- 统计上下文由 API Route 从 stats 逻辑读取（不信任前端传参）
- AI 失败时返回兜底文案，不崩溃
- 复盘结果可以缓存（同一 taskGroupId 不重复请求）
- Prompt 保持简短——上下文只传当前 taskGroup + 统计摘要

### 4.4 可能需要的 AI Prompt 输入

AI 复盘 Prompt 预计包含：

| 输入 | 来源 | 格式 |
|------|------|------|
| 今日目标（goal） | `task_groups.goal` | 字符串 |
| 今日任务列表 + 完成状态 | `tasks` | `[{ title, completed }]` |
| 今日完成率 | 实时计算 | `"4/6 (67%)"` |
| 最近 7 天完成率 | stats API | 数字 |
| 连续行动天数 | stats API | 数字 |
| 用户表现标签 | stats API | `"稳定行动"` / `"有点吃力"` / `"刚刚开始"` |

**Prompt 设计原则**（正式架构时细化）：
- 不批评用户，不评价人格
- 只反馈行动进展和下一步建议
- 短句优先（2-4 句）
- 温和、低压力、教练式

### 4.5 复盘文案原则

| 原则 | 示例 |
|------|------|
| **不批评** | ❌ "你今天完成率很低，需要更加努力。" |
| | ✅ "今天完成了 2 个任务，已经把目标往前推了一步。明天可以从更小的一步开始。" |
| **行动导向** | ❌ "你最近表现不好。" |
| | ✅ "明天只需要完成 2-3 个小任务，就能找回节奏。" |
| **简短** | 2-4 句，不超过 150 字 |
| **不制造压力** | 不说"你应该"、"你必须" |
| **承认努力** | 完成全部 → "今天全部完成了，节奏很好。"；完成部分 → "今天推进了一部分，剩下的明天继续。" |

### 4.6 不做范围

- ❌ 不做长篇报告
- ❌ 不做心理分析
- ❌ 不做情绪诊断
- ❌ 不做复杂教练人格
- ❌ 不做任务自动调整（Phase 15）
- ❌ 不做周报推送
- ❌ 不做通知系统
- ❌ 不自动触发复盘（需要用户手动触发或完成任务后确认）
- ❌ 不在前端暴露 AI Prompt

### 4.7 正式架构前必须重新确认的问题

1. **复盘触发时机**：全部任务完成后自动触发？还是用户手动点击"复盘"按钮？还是两者都有？
2. **复盘缓存策略**：同一 taskGroupId 的复盘结果缓存多久？用户再次打开时显示缓存还是重新生成？
3. **AI 模型选择**：复盘用哪个模型？是否复用 `generate-tasks` 的模型？
4. **复盘失败兜底文案**：具体兜底文案内容是什么？
5. **`suggestedDifficulty` 和 `suggestedTaskCountRange` 是否在 Phase 14 就展示给用户，还是只落库留给 Phase 15**？
6. **周复盘**：PRD 提到"每 7 天生成一次轻量总结"——是否 Phase 14 就做？还是后置到 Phase 15？
7. **复盘文案的语言**：目前 generate-tasks 返回中文。复盘是否也固定中文？

---

## 五、Phase 15：智能任务调整

### 5.1 未来目标

让 AI 根据用户历史完成情况，自动调整任务数量、难度和拆解粒度。

Phase 15 的重点是 **生成策略更贴合用户**，不是建立复杂用户画像。

### 5.2 依赖 Phase 13 / 14 的数据

| 依赖 | 来源 | 用途 |
|------|------|------|
| 最近 7 天完成率 | Phase 13 stats | 判断用户当前难度是否合适 |
| 连续行动天数 | Phase 13 stats | 感知用户节奏 |
| 最近未完成任务数量 | Phase 13 stats | 判断是否任务偏多 |
| `recentPerformanceLabel` | Phase 13 stats | 决定调整力度 |
| `suggestedDifficulty` | Phase 14 review | AI 复盘中验证过的难度建议 |
| `suggestedTaskCountRange` | Phase 14 review | AI 复盘中验证过的数量建议 |

### 5.3 `generate-tasks` API 可能如何增强

**当前（V1.0）**：Prompt 只包含用户输入的 goal。

**Phase 15 增强后（示意）**：

```
generate-tasks API（Phase 15）：

第 1 步：服务端读取当前 session（getAuthenticatedUserId）
第 2 步：服务端读取历史统计（复用 Phase 13 的统计查询逻辑）
第 3 步：构建增强 Prompt：
  - 用户 goal（不变）
  - 最近 7 天完成率（从历史统计读取）
  - 最近任务数量（从历史 task_groups 读取）
  - 最近未完成任务数量（同上）
  - recentPerformanceLabel
  - 如果 Phase 14 完成，加入 suggestedDifficulty
第 4 步：调用 AI（模型不变）
第 5 步：解析 JSON + 高风险输入拦截（不变）
第 6 步：返回 tasks（结构不变）
```

**关键约束**：
- 前端请求体不变（不新增字段）——统计上下文由服务端内部读取
- 任务数量仍保持在 3-8 条的产品约束内
- 低完成率时优先生成 3 条更轻的任务
- 高完成率时可以生成 5-7 条略深入的任务

### 5.4 AI 调整策略的边界

| 用户状态 | 调整策略 | 边界 |
|---------|---------|------|
| 最近 7 天完成率 ≥ 80% | 任务可以略多（5-7 条）或略深入 | 不超过 8 条；不提升任务复杂度到"需要分多天"的级别 |
| 最近 7 天完成率 40%-80% | 保持默认策略（3-5 条） | 不改变深度，只微调数量 |
| 最近 7 天完成率 < 40% | 任务更少（2-3 条）、更具体、更容易开始 | 最少 2 条；不生成"今天开始学习 X"这种大颗粒任务 |
| 无历史数据（新用户） | 保持 V1.0 默认生成逻辑 | 不惩罚新用户 |
| `suggestedDifficulty === "lighter"` | 优先生成更轻的任务 | 单条任务的预估时间不超过 30 分钟 |

**绝对不变的红线**：
- 任务数量 2-8 条（不突破 PRD 的 3-8 条约束，低完成率时可降为 2 条）
- 不改变 AI 模型
- 不改变 JSON 解析规则
- 不改变高风险输入拦截
- 不改变 localStorage / Supabase 保存逻辑
- 不改变 session-aware 数据隔离

### 5.5 不做范围

- ❌ 不做长期用户画像系统
- ❌ 不做复杂推荐系统
- ❌ 不做多目标规划
- ❌ 不做项目管理
- ❌ 不做日历排期
- ❌ 不做自动创建长期计划
- ❌ 不让前端传可信统计上下文
- ❌ 不做会员 / 支付 / 权限

### 5.6 正式架构前必须重新确认的问题

1. **调整策略的阈值是否需要在 Phase 14 复盘效果验证后重新校准**？
2. **AI 生成任务时，除了完成率，是否应加入"未完成任务的具体标题"作为上下文**（帮助 AI 判断哪些任务偏难）？
3. **`suggestedDifficulty` 是否在所有情况下都应被采纳，还是仅当统计和复盘结论一致时才生效**？
4. **低完成率时是否应该改变 prompt 中的"教练口吻"**（如更加温和、更强调最小行动）？
5. **是否需要 A/B 测试逻辑**（部分用户用新策略，部分用户用旧策略，对比完成率）？
6. **连续低完成率（如 14 天完成率 < 30%）是否有特殊处理**（如建议用户设定更简单的目标）？

---

## 六、统一数据原则

以下原则适用于 **Phase 12 / 13 / 14 / 15 全部阶段**，任何一期的正式架构不得违反：

### 6.1 数据归属

```
已登录：
  - 所有数据按 user_id 查询、保存、统计、复盘
  - user_id 从服务端 Supabase Auth session 获取
  - 前端不传 userId

未登录：
  - 所有数据按 device_id 查询、保存、统计、复盘
  - user_id IS NULL 作为安全校验

迁移：
  - device_id → user_id 迁移必须幂等
  - 迁移后历史 / 统计 / 复盘数据自动归属 user_id
  - archived_at / completed_at 在迁移时保持原值
```

### 6.2 API 安全

| # | 规则 | 适用于 |
|---|------|--------|
| 1 | userId 永远从服务端 session cookie 获取，不从请求体或 query 参数读取 | 所有 API |
| 2 | `SUPABASE_SERVICE_ROLE_KEY` 只在服务端使用 | 所有 API |
| 3 | 前端不能 `import` supabase-server | 所有前端代码 |
| 4 | 前端不能出现 `service_role` key | 所有前端代码 |
| 5 | 所有数据操作 API 必须是 session-aware | 所有 API |
| 6 | 写入 API 必须校验归属（403 如果越权） | save / delete / migrate / review |
| 7 | 查询 API 必须带归属过滤 | load / history / stats / review |
| 8 | API 响应不返回 token / cookie / secret / service_role key | 所有 API |

### 6.3 localStorage 定位

```
localStorage：
  ✅ 仅存储活跃 TaskGroup（快速恢复 + 离线可用）
  ✅ Scope 隔离：ai_todo_current_task_group:user:<id> 或 device:<id>
  ❌ 不存储历史记录
  ❌ 不存储统计数据
  ❌ 不存储 AI 复盘结果
  ❌ 不存储生成策略参数

Supabase：
  ✅ 活跃 TaskGroup + 全部历史 + 统计数据源
  ✅ session-aware 数据隔离
```

### 6.4 登出行为

```
登出后：
  - session cookie 清除
  - getAuthenticatedUserId() 返回 null
  - 所有 API 回退到 device_id 模式
  - user_id 数据不可访问（预期行为）
  - localStorage user scope 清空 → 回退到 device scope
  - 重新登录后 user_id 数据恢复可见
```

---

## 七、统一越界红线

以下红线适用于 **Phase 12 / 13 / 14 / 15 全部阶段**。

### 7.1 各 Phase 独立红线

| Phase | 绝不做 |
|-------|--------|
| **Phase 12** | 统计图表、AI 复盘、任务生成策略调整 |
| **Phase 13** | AI 复盘、智能生成调整、复杂报表 |
| **Phase 14** | 自动改变任务生成策略、复杂教练人格、推送通知 |
| **Phase 15** | 用户画像系统、长期项目规划、推荐系统、会员/支付/权限 |

### 7.2 全局红线（所有 Phase 通用）

```
❌ 不做团队协作
❌ 不做社交 / 排行榜
❌ 不做复杂项目管理
❌ 不改 Supabase 表结构（除非当前 Phase 明确要求并单独评审）
❌ 不改 RLS（除非当前 Phase 明确要求并单独评审）
❌ 不暴露任何密钥
❌ 不提交 .env.local
❌ 不让前端传可信 userId
❌ 不让前端传可信统计结果 / 复盘上下文
❌ 不引入新的 npm 依赖（除非 Phase 明确需要并评审）
```

---

## 八、未来执行提醒

### 8.1 编写正式架构的顺序

```
Phase 12 完成并通过验收
  │
  ├── ✅ 统计口径已验证（completed_at 写入正确、archived_at 归档正确）
  │
  ▼
编写 Architecture-Phase13.md
  │
  │  Phase 13 完成并确认统计口径
  │
  ├── ✅ 统计 API 返回值稳定
  ├── ✅ 统计 UI 用户反馈正向
  │
  ▼
编写 Architecture-Phase14.md
  │
  │  Phase 14 完成并确认 AI 复盘效果
  │
  ├── ✅ 复盘文案用户接受度高
  ├── ✅ suggestedDifficulty 经验证有效
  │
  ▼
编写 Architecture-Phase15.md
```

### 8.2 不可跳过的检查点

| 检查点 | 何时检查 | 内容 |
|--------|---------|------|
| **CK-1** | Phase 12 完成后 | `completed_at` 写入是否正确（toggle → undo → re-toggle → 检查值） |
| **CK-2** | Phase 12 完成后 | `archived_at` 归档是否正确（清空 → 检查不丢失、不重复归档） |
| **CK-3** | Phase 13 开始前 | 统计口径确认（日期归属、时区处理、`activeDayStreak` 定义） |
| **CK-4** | Phase 14 开始前 | 复盘 Prompt 验证（用真实用户数据测试 5-10 条复盘文案） |
| **CK-5** | Phase 15 开始前 | 调整策略验证（`suggestedDifficulty` 与用户实际完成率一致性检查） |

### 8.3 备忘提醒

- **不要提前写 Phase 13-15 的正式详细架构**——统计口径和 AI 复盘效果需要在前一阶段验证后再固化。Roadmap-Phase12-15.md 第 13 节明确："不建议一次性提前写完 Phase 13-15 的详细架构，因为统计口径和 AI 复盘效果需要在前一阶段验证后再固化。"
- **Phase 12 是 Phase 13-15 的数据基础**——如果 `completed_at` 写入逻辑有问题，Phase 13 统计会全部出错。Phase 12 完成后的回归验证至关重要。
- **Phase 13 统计是 Phase 14 复盘的输入**——如果统计口径不稳定（如时区问题），AI 复盘会基于错误数据生成误导性文案。
- **Phase 14 复盘是 Phase 15 调整的验证**——`suggestedDifficulty` 应先被复盘验证有效，再交给生成策略使用。跳过验证直接调整是最大的风险。
- **所有新 API 必须 session-aware**——不得有例外。这是 Phase 11D 确立的核心安全模型。

---

> **本文档到此结束。Phase 12 完成并通过验收后，基于此备忘录编写 `Architecture-Phase13.md`。**
>
> **关联文档**：
> - `docs/PRD-V2.0.md` — V2.0 产品规划
> - `docs/Roadmap-Phase12-15.md` — Phase 12-15 中期路线图
> - `docs/Architecture-Phase12.md` — Phase 12 技术架构
