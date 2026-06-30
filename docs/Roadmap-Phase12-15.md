# Roadmap: Phase 12-15 中期路线图

## 1. 文档目的

本文档基于 `docs/PRD-V2.0.md`，用于统一 AI Todo V2.0 中期开发路线，覆盖 Phase 12 / 13 / 14 / 15。

目标是避免后续每个 Phase 独立设计时出现产品方向、数据口径、API 归属、UI 优先级不一致的问题。

本文档只定义产品与技术路线，不代表进入 Phase 12A 实现。

## 2. V2.0 总主线

AI Todo V2.0 的总主线是：

目标 → AI 拆解 → 执行 → 记录 → 复盘 → 智能调整

V1.0 已完成前半段：

- 目标
- AI 拆解
- 执行
- 当前任务保存

V2.0 的 Phase 12-15 负责补齐后半段：

- Phase 12：记录
- Phase 13：统计
- Phase 14：复盘
- Phase 15：智能调整

产品方向保持不变：AI Todo 不是复杂项目管理工具，而是手机端优先的 AI 行动教练。

## 3. Phase 12 / 13 / 14 / 15 整体依赖关系

整体依赖顺序：

1. Phase 12 历史记录是基础数据层。
2. Phase 13 完成统计依赖历史任务组和任务完成状态。
3. Phase 14 AI 复盘依赖 Phase 13 的统计结果和 Phase 12 的历史上下文。
4. Phase 15 智能任务调整依赖 Phase 13 的统计指标，以及 Phase 14 沉淀出的复盘策略和文案方向。

不能跳过的关键依赖：

- 没有历史记录，就没有稳定统计口径。
- 没有统计，就不能让 AI 判断用户最近完成节奏。
- 没有复盘验证，就不应直接让 AI 自动调整任务难度。

推荐顺序：

Phase 12 → Phase 13 → Phase 14 → Phase 15

## 4. Phase 12：历史记录

### 目标

让用户能看到过去生成过的任务组，知道自己每天推进了什么。

Phase 12 的重点是“记录”，不是“分析”。

### 做什么

- 新增历史记录 API。
- 展示最近历史任务组。
- 每条历史记录展示：
  - 日期
  - goal
  - completedCount
  - totalCount
  - completionRate
- 支持查看历史任务详情。
- 历史记录必须 session-aware：
  - 已登录按 user_id 查询
  - 未登录按 device_id 查询
- 登出后不能显示 user_id 历史。

### 不做什么

- 不做 AI 复盘。
- 不做复杂统计图表。
- 不做搜索。
- 不做标签系统。
- 不做历史编辑。
- 不做多任务组管理后台。
- 不做多设备合并策略。

### 需要为 Phase 13 预留什么

Phase 12 应为 Phase 13 预留稳定统计字段：

- taskGroup id
- goal
- createdAt
- updatedAt
- tasks
- completedCount
- totalCount
- completionRate
- localDate 或可稳定计算本地日期的时间字段

Phase 12 不一定需要落库 completionRate，但 API 返回时应能计算出来。

### 验收标准

- 能展示历史任务组。
- 历史任务组按时间倒序展示。
- 每条记录能看到目标和完成情况。
- 点击历史记录能看到任务详情。
- 已登录只展示当前 user_id 历史。
- 未登录只展示当前 device_id 历史。
- 登出后不显示 user_id 历史。
- 空历史时有合理空状态。
- 手机端可用。
- `npm run lint` 通过。
- `npm run build` 通过。

## 5. Phase 13：完成统计

### 目标

让用户知道自己最近行动表现如何，但不制造压力。

Phase 13 的重点是“轻量反馈”，不是“复杂报表”。

### 做什么

- 展示最近 7 天完成率。
- 展示总完成任务数。
- 展示连续行动天数。
- 展示今日完成率。
- 支持空数据状态。
- 统计必须 session-aware：
  - 已登录按 user_id 聚合
  - 未登录按 device_id 聚合

### 不做什么

- 不做复杂图表。
- 不做趋势预测。
- 不做排行榜。
- 不做团队统计。
- 不做项目维度统计。
- 不做完整周报。
- 不让前端传可信统计结果。

### 依赖 Phase 12 哪些数据

Phase 13 依赖：

- 历史 task_groups
- tasks.completed
- task_groups.created_at
- task_groups.updated_at
- 每个 task_group 的 completedCount
- 每个 task_group 的 totalCount
- 用户当前归属：user_id 或 device_id

### 需要为 Phase 14 / 15 预留什么

Phase 13 应为后续 AI 使用预留统一统计输出：

- sevenDayCompletionRate
- totalCompleted
- activeDayStreak
- recentTaskGroupCount
- recentAverageTaskCount
- recentIncompleteTaskCount
- recentPerformanceLabel：稳定行动 / 有点吃力 / 刚刚开始

这些字段可以先作为 API 返回结果，不一定立即存入数据库。

### 验收标准

- 能展示最近 7 天完成率。
- 能展示总完成任务数。
- 能展示连续行动天数。
- 能展示今日完成率。
- 统计数据与历史记录一致。
- 已登录统计只来自当前 user_id。
- 未登录统计只来自当前 device_id。
- 登出后不显示 user_id 统计。
- 空数据状态不报错。
- 手机端展示清晰。
- `npm run lint` 通过。
- `npm run build` 通过。

## 6. Phase 14：AI 复盘

### 目标

让 AI 基于用户完成情况给出短、温和、行动导向的反馈。

Phase 14 的重点是“复盘”，不是“自动改变任务生成”。

### 做什么

- 支持今日任务复盘。
- 支持最近 7 天轻量复盘。
- AI 反馈文案短、温和、低压力。
- AI 复盘基于 Phase 13 的统计结果和 Phase 12 的历史任务。
- AI 失败时不影响主流程。
- 可以缓存复盘结果，避免重复请求。

### 不做什么

- 不做长篇报告。
- 不做心理分析。
- 不做情绪诊断。
- 不做复杂教练人格。
- 不做任务自动调整。
- 不做周报推送。
- 不做通知系统。

### 依赖 Phase 13 哪些统计

Phase 14 依赖：

- 今日完成率
- 最近 7 天完成率
- 总完成任务数
- 连续行动天数
- 最近未完成任务数量
- recentPerformanceLabel

### 需要为 Phase 15 预留什么

Phase 14 应沉淀 AI 判断口径：

- 用户最近是否完成稳定
- 用户是否任务过载
- 用户是否适合减少任务数量
- 用户是否可以适度增加任务挑战

建议复盘 API 返回结构中预留机器可读字段：

- feedbackText
- suggestedDifficulty：lighter / normal / deeper
- suggestedTaskCountRange

Phase 14 可以先展示 feedbackText，其他字段留给 Phase 15 使用。

### 验收标准

- 完成任务后可以生成 AI 复盘。
- 复盘文案简短、温和、行动导向。
- AI 复盘基于当前登录态数据。
- 已登录只读取当前 user_id 数据。
- 未登录只读取当前 device_id 数据。
- AI 失败时页面不崩溃。
- 不暴露 token、cookie、API key。
- 不影响任务生成、勾选、保存、刷新恢复。
- `npm run lint` 通过。
- `npm run build` 通过。

## 7. Phase 15：智能任务调整

### 目标

让 AI 根据用户历史完成情况，自动调整任务数量、难度和拆解粒度。

Phase 15 的重点是“生成策略更贴合用户”，不是“建立复杂用户画像”。

### 做什么

- generate-tasks API 在服务端读取历史统计。
- Prompt 加入最近完成率、任务数量、未完成任务等上下文。
- 低完成率时生成更少、更轻、更具体的任务。
- 高完成率时可以生成略深入的任务。
- 没有历史数据时保持 V1.0 生成逻辑。
- 保持任务数量在 3-8 条的产品约束内，低完成率时可优先 3 条。

### 不做什么

- 不做长期用户画像系统。
- 不做复杂推荐系统。
- 不做多目标规划。
- 不做项目管理。
- 不做日历排期。
- 不做自动创建长期计划。
- 不让前端传可信统计上下文。

### 依赖 Phase 13 / 14 哪些数据

依赖 Phase 13：

- sevenDayCompletionRate
- activeDayStreak
- recentAverageTaskCount
- recentIncompleteTaskCount
- recentPerformanceLabel

依赖 Phase 14：

- suggestedDifficulty
- suggestedTaskCountRange
- AI 复盘中验证过的文案和策略方向

### 验收标准

- 有历史数据时，AI 生成任务会参考历史完成情况。
- 低完成率时任务更少、更轻、更容易开始。
- 高完成率时任务可以略深入，但仍适合今天完成。
- 没有历史数据时保持原生成逻辑。
- 不破坏高风险输入拦截。
- 不破坏 AI JSON 解析规则。
- 不破坏 localStorage / Supabase 保存。
- 不破坏登录态数据隔离。
- `npm run lint` 通过。
- `npm run build` 通过。

## 8. 统一数据原则

Phase 12-15 必须延续 Phase 11 的数据归属规则：

- 已登录按 user_id 查询、保存、统计、复盘。
- 未登录按 device_id 查询、保存、统计、复盘。
- 前端不传可信 userId。
- userId 只能由服务端 Supabase Auth session 获取。
- 所有后端 API 必须 session-aware。
- service_role key 只能在服务端使用。
- 前端不能 import supabase-server。
- 前端不能出现 service_role key。
- localStorage 继续使用 scope 隔离。
- localStorage 缓存必须包含 scope 元数据。
- 登出后不能显示 user_id 数据。
- 登录后迁移匿名数据必须幂等。

## 9. 统一 API 原则

Phase 12-15 新增 API 应遵循：

- 统一返回 `{ success: true, data }` 或 `{ success: false, error }`。
- 错误 code 使用稳定字符串。
- 不返回 token、cookie、secret、service_role key。
- 不信任 request body 中的 userId。
- 需要用户归属的数据，服务端必须先读取 session。
- 未登录时使用 deviceId，但只能作为匿名归属标识。
- 查询历史、统计、复盘时必须带归属过滤。
- AI 相关 API 必须保留高风险输入和解析失败兜底。
- 写入类 API 必须避免越权覆盖其他 user_id 或 device_id 的数据。

建议 API 命名保持一致：

- `/api/task-groups/history`
- `/api/task-groups/stats`
- `/api/task-groups/review`
- `/api/generate-tasks` 增强，不另开复杂入口

## 10. 统一 UI 原则

Phase 12-15 UI 应保持 AI 行动教练风格：

- 手机端优先。
- 今日行动计划仍是主屏核心。
- 历史、统计、复盘是辅助信息，不抢主流程。
- 文案温和、低压力、不批评用户。
- 统计不要复杂化，优先数字 + 短句。
- 历史记录用轻量卡片，不做表格化后台。
- AI 反馈短句优先，不做长篇报告。
- 空状态必须清晰，不让用户误以为数据丢失。
- 登录 / 登出后的数据切换必须明确且不串数据。

## 11. 阶段越界红线

Phase 12 红线：

- 不做统计图表。
- 不做 AI 复盘。
- 不做任务生成策略调整。

Phase 13 红线：

- 不做 AI 复盘。
- 不做智能生成调整。
- 不做复杂报表。

Phase 14 红线：

- 不自动改变任务生成策略。
- 不做复杂人格化教练。
- 不做推送通知。

Phase 15 红线：

- 不做用户画像系统。
- 不做长期项目规划。
- 不做推荐系统。
- 不做会员、支付、权限。

所有 Phase 通用红线：

- 不做团队协作。
- 不做社交、排行榜。
- 不做复杂项目管理。
- 不改 Supabase 表结构，除非当前 Phase 明确要求并单独评审。
- 不改 RLS，除非当前 Phase 明确要求并单独评审。
- 不暴露任何密钥。
- 不提交 `.env.local`。

## 12. 风险与规避方案

### 风险 1：历史和统计让产品变复杂

规避：

- 首页仍以今日任务为主。
- 历史和统计只做轻量入口。
- 第一版不做筛选、搜索和复杂图表。

### 风险 2：登录态和匿名态数据串联

规避：

- 所有 API session-aware。
- 本地缓存带 scope 元数据。
- 登出后立即清空 user 数据。
- 历史、统计、复盘都必须按 user_id / device_id 隔离。

### 风险 3：统计口径不稳定

规避：

- Phase 13 前明确日期口径。
- 优先使用 task_groups.created_at 计算历史日期。
- 必要时后续增加 localDate 字段。

### 风险 4：AI 复盘造成压力

规避：

- 不批评用户。
- 不使用焦虑化文案。
- 只描述行动进展和下一步建议。

### 风险 5：AI 成本上升

规避：

- 统计优先由数据库或服务端计算。
- 复盘按需触发。
- 周复盘后置。
- Prompt 保持短上下文。

### 风险 6：Phase 15 过早智能化

规避：

- 必须先完成 Phase 12-14。
- 智能调整只基于少量稳定指标。
- 没有历史数据时回退 V1.0 生成逻辑。

## 13. 后续 Architecture-Phase13 / 14 / 15 的编写时机

建议编写顺序：

1. Phase 12 开始前，先写 `Architecture-Phase12.md`。
2. Phase 12 完成并通过验收后，再写 `Architecture-Phase13.md`。
3. Phase 13 完成并确认统计口径后，再写 `Architecture-Phase14.md`。
4. Phase 14 完成并确认 AI 复盘效果后，再写 `Architecture-Phase15.md`。

不建议一次性提前写完 Phase 13-15 的详细架构，因为统计口径和 AI 复盘效果需要在前一阶段验证后再固化。

本文档作为中期路线约束，后续每个 Architecture 文档应遵守本文的数据原则、API 原则、UI 原则和阶段红线。
