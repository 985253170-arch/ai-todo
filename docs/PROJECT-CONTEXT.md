# PROJECT-CONTEXT.md — AI Todo 长期项目记忆

> 保存 AI Todo 项目的长期上下文，避免迁移工作区后丢失。恢复上下文时对照本文档 + CLAUDE.md 即可快速重建。

## 1. 项目定位

AI Todo 是**手机端优先的 AI 行动教练**，不是普通 Todo List。

核心闭环：目标 → AI 拆解 → 执行 → 记录 → 统计 → 复盘 → 智能调整。

## 2. 技术栈

| 层 | 技术 |
|---|------|
| 框架 | Next.js App Router |
| 语言 | TypeScript |
| 样式 | Tailwind CSS |
| 数据库 | Supabase PostgreSQL |
| 认证 | Supabase Auth（Magic Link OTP） |
| AI | DeepSeek API（OpenAI-compatible） |
| 客户端 ID | localStorage deviceId |
| 部署 | Vercel |
| Shell | Windows PowerShell |

依赖：`next` `react` `react-dom` `@supabase/supabase-js` `@supabase/ssr`。无图表库，无状态管理库。

## 3. 三角色分工

| 角色 | 职责 |
|------|------|
| Claude Code | 架构设计 / 执行方案 / Code Review / 最终验收 |
| Codex | 具体写代码 / 按执行方案实现 / 小修 bug |
| ChatGPT | 阶段把关 / 产品判断 / 给 Claude Code 和 Codex 分别写指令 |

标准工作流：Claude Code 写架构方案 → ChatGPT 审查 → Codex 实现 → Claude Code Review → ChatGPT 最终把关 → 提交。

## 4. V1.0 基础功能

- 输入目标 → AI 生成 3-8 条当日可执行任务
- 任务勾选完成/取消
- 重新生成任务 / 清空任务 / 开始新一天
- localStorage 本地保存与恢复（scope 隔离）
- Supabase 云端保存/读取/归档/迁移
- Magic Link OTP 登录/登出
- 匿名 device_id → 登录 user_id 任务迁移
- 手机端优先 UI（AI 行动教练风格）

## 5. V1.0 核心 API

| API Route | 方法 | 功能 | Session-Aware |
|-----------|------|------|:---:|
| `/api/generate-tasks` | POST | AI 生成任务 | ❌ |
| `/api/task-group/save` | POST | 保存/更新任务组（upsert + replace tasks） | ✅ |
| `/api/task-group/load` | GET | 读取当前活跃任务组 | ✅ |
| `/api/task-group/delete` | POST | 归档任务组（SET archived_at） | ✅ |
| `/api/task-group/migrate` | POST | 匿名 device 任务迁移到 user_id | ✅ (需登录) |

API 统一响应格式：`{success: true, data}` | `{success: false, error: {code, message}}`

## 6. 核心前端模块

| 模块 | 文件 | 职责 |
|------|------|------|
| `useTaskGroup` | `src/hooks/useTaskGroup.ts` | 核心状态：生成/勾选/清空/重新生成/云端同步/scope |
| `useAuth` | `src/hooks/useAuth.ts` | Supabase Auth 状态 + signIn/signOut/verifyOtp |
| `GoalInput` | `src/components/GoalInput.tsx` | 目标输入框 + 示例 + 生成按钮 |
| `TaskList` | `src/components/TaskList.tsx` | 任务卡片列表 + 进度条 + 全部完成提示 |
| `Header` | `src/components/Header.tsx` | 顶部导航 + 历史按钮 + 登录/用户信息 |
| `page.tsx` | `src/app/page.tsx` | 主页面组装 |

## 7. Supabase 数据模型

**task_groups** 表：
```
id (PK), goal, user_id (nullable), device_id (nullable),
created_at, updated_at, archived_at (nullable)
```

**tasks** 表：
```
id (PK), task_group_id (FK, ON DELETE CASCADE),
title, completed (boolean), completed_at (nullable),
created_at, updated_at
```

- `archived_at IS NULL` = 活跃任务组（当前使用中）
- `archived_at IS NOT NULL` = 已归档（历史记录）
- `completed_at IS NOT NULL` = 已完成（支撑连续天数统计）
- API Route 使用 **service_role** key 绕过 RLS

## 8. deviceId 与 user_id 规则

- **未登录**：scope = `device:<deviceId>`，Supabase 按 `device_id` 归属
- **已登录**：scope = `user:<userId>`，Supabase 按 `user_id` 归属
- **登录时迁移**：`POST /api/task-group/migrate` 将 device 匿名任务更新为 userId
- **登出后**：清空 user scope localStorage，回退到 device scope
- **前端从不传 userId**，userId 只来自服务端 Supabase Auth session

## 9. Phase 12 — 历史记录 ✅

- 新增 `archived_at` + `completed_at` 字段 + 索引
- `GET /api/task-groups/history` — 游标分页，查 archived_at IS NOT NULL
- `POST /api/task-group/delete` 改为归档（不物理删除）
- UI：HistoryPanel + useTaskHistory（懒加载、分页、auth 切换刷新）

影响文件：migration 文件、history route、useTaskHistory、HistoryPanel、task-group/delete route

## 10. Phase 13 — 统计 ✅

- 零数据库变更，纯聚合计算
- `GET /api/task-groups/stats` — TodayStats / SevenDayStats / TotalStats / performanceLabel
- `src/lib/stats-calculator.ts` — computeAllStats / computeStreak / computePerformanceLabel
- UI：StatsBar (4 卡片) + StatCard + useTaskStats（防重复请求）
- page.tsx 集成：操作后 500ms + 2500ms 两次刷新

影响文件：stats route、stats-calculator、useTaskStats、StatsBar、StatCard、page.tsx

## 11. Phase 14A — AI 复盘 API ✅

| 文件 | 操作 | 说明 |
|------|:---:|------|
| `src/lib/types.ts` | 修改 | 追加 ReviewData / ReviewErrorCode / SuggestedDifficulty |
| `src/lib/ai-client.ts` | 修改 | 新增 callAIWithPrompts() |
| `src/prompts/task-review.ts` | 新建 | REVIEW_SYSTEM_PROMPT + buildReviewUserPrompt |
| `src/lib/review-parser.ts` | 新建 | parseReviewAIResponse + JSON fallback |
| `src/app/api/task-groups/review/route.ts` | 新建 | 核心 API (~315 行，11 种错误码) |

关键设计：手动触发、温和语气 (120-180 字)、不持久化复盘结果、rate limit 3次/分钟

## 12. Phase 14B — AI 复盘 UI ✅

**提交**：`ed68e1d feat: add AI review UI`（2026-07-02）

**交付物（3 个文件，262 行新增）**：

| 文件 | 操作 | 行数 | 说明 |
|------|:---:|:---:|------|
| `src/hooks/useTaskReview.ts` | 新建 | 141 | 复盘状态管理：review / isLoading / error / isStale |
| `src/components/TaskReviewPanel.tsx` | 新建 | 99 | 复盘 UI：ready / loading / success / stale / error / empty |
| `src/app/page.tsx` | 修改 | +22 | 胶水层集成，TaskList 下方、HistoryPanel 上方 |

**关键设计**：
- 调用 `POST /api/task-groups/review`，显式传 `deviceId`、`taskGroupId`、`timezoneOffset`，不传 userId/tasks/stats
- inflightRef 防重复请求（与 useTaskStats 模式一致）
- taskGroupId 变化 → resetReview；taskGroupUpdatedAt 变化 → isStale = true
- 首版只展示 `review.feedbackText`，不展示 sections / suggestedDifficulty / suggestedTaskCountRange
- 不自动生成复盘（手动点击），不持久化复盘（React state，刷新丢失）
- 错误使用 amber 色调（非 red），不弹窗不 toast
- 移动端全宽，按钮 min-h-11（≥44px）

**验收结果**：功能 16/16 ✅ | 安全 8/8 ✅ | lint ✅ | build ✅

## 12B. Phase 14B-Follow-up — P2 修复 ✅

**执行方案**：`3620e10 docs: add Phase 14B follow-up execution plan`
**代码提交**：`39117c5 fix: apply Phase 14B follow-up fixes`（2026-07-02）

**修复内容（2 个文件，14 行新增，5 行删除）**：

| 文件 | 修复 |
|------|------|
| `src/hooks/useTaskReview.ts` | 新增 `REVIEW_ERROR_MESSAGES` 前端错误码映射表（6 个错误码 → 中文文案），错误抛出改为 `errorCode → REVIEW_ERROR_MESSAGES[errorCode] ?? DEFAULT_ERROR_MESSAGE` |
| `src/components/TaskReviewPanel.tsx` | loading `opacity-70` → `opacity-60`；stale 提示栏 `rounded-2xl` → `rounded-t-2xl`；stale 提示栏 `px-4` → `px-5` |

**边界 Case 确认**（不需改代码，已有逻辑覆盖）：
- 网络失败后可重试 ✅
- taskGroup 切换后旧 review 不残留 ✅
- 请求期间 taskGroup 改变不污染新状态 ✅
- stale → 重新生成 → 成功 UI 正确过渡 ✅

**验收结果**：P0=0 | P1=0 | P2=0 | lint ✅ | build ✅

**当前下一步**：Phase 14B 及其 Follow-up 全部完成，已进入 Phase 14C 人工验收。

## 12C. Phase 14C — 人工验收 ✅

**执行方案**：`9433337 docs: add Phase 14C execution plan`

Phase 14C 定位为纯人工验证阶段，不修改任何代码。基于 36 项测试清单 (功能 8 + 状态转换 9 + 边界 7 + 认证隔离 4 + 回归 6 + 移动端 2) 进行人工验收。

**已测试通过（核心闭环验证）**：
- 无任务状态清空后复盘按钮消失 / 重新生成后按钮重新出现
- 生成任务后显示"💬 生成今日复盘"按钮
- 点击 → loading spinner + "正在生成复盘…"
- 成功后展示 ReviewCard（"💬 今日复盘" + feedbackText）
- 仅展示 feedbackText，不展示 sections / suggestedDifficulty / suggestedTaskCountRange
- 勾选任务 → stale（amber 提示栏 + 内容 opacity-50 + "重新生成"按钮）
- stale → 重新生成 → loading → 新复盘替换旧内容
- 复盘卡片位置正确（TaskList 下方、HistoryPanel 上方）
- stale 提示样式正常，无前端报错
- TaskList 勾选 / generate-tasks / 清空任务均正常

**建议补测项（不阻塞 Phase 15）**：
- 网络断连后重试（DevTools Offline 模拟）
- 登录 / 登出 / 匿名 deviceId / user_id 切换（需 Supabase Auth 环境）
- 全部完成 / 部分完成 / 零完成三类 AI 文案差异
- 移动端长文案换行和触控区域
- HistoryPanel 回归

**验收结论**：P0=0 | P1=0 | P2=0（代码层面）| 不需要 Codex 修复 | 允许关闭 Phase 14 | 建议进入 Phase 15 架构设计

**Phase 14 整体关闭**：14A (API) → 14B (UI) → 14B-Follow-up (P2 修复) → 14C (人工验收) 完整链路走完 ✅

**当前下一步**：先让 Claude Code 写 `docs/Architecture-Phase15.md`（AI 智能调整任务架构设计）。Phase 15 必须先做架构设计（涉及 `generate-tasks` 策略调整），不能直接让 Codex 写代码。

## 13. 高风险基础文件（不能随便改）

| 文件 | 风险 |
|------|------|
| `src/hooks/useTaskGroup.ts` | 核心状态管理，所有操作依赖 |
| `src/lib/ai-client.ts` | AI 调用底层，三个 API 共用 |
| `src/lib/task-parser.ts` | AI 响应解析 |
| `src/lib/types.ts` | 类型定义，全项目依赖 |
| `src/lib/supabase-server.ts` | 服务端 Supabase + Auth |
| `src/app/api/generate-tasks/route.ts` | 核心生成 API |
| `src/app/api/task-group/save/route.ts` | 保存 API（含 completed_at 保留逻辑） |
| `src/app/api/task-group/delete/route.ts` | 归档 API |
| `src/app/api/task-group/load/route.ts` | 加载 API |
| `src/app/api/task-group/migrate/route.ts` | 迁移 API |

## 14. 最新提交

```
9433337 docs: add Phase 14C execution plan
39117c5 fix: apply Phase 14B follow-up fixes
3620e10 docs: add Phase 14B follow-up execution plan
741c94e docs: update project context for Phase 14B completion
ed68e1d feat: add AI review UI
67fa54d docs: add project index and file writing rules
```

Phase 14 整体关闭，当前 HEAD = `9433337`。

## 15. 工作区路径

`C:\Dev\ai-todo`

## 16. 恢复上下文必读顺序

1. `CLAUDE.md` — 项目规则 + 阶段状态 + 工作流
2. `docs/PROJECT-CONTEXT.md` — 本文档，长期项目记忆
3. `docs/PRD-V2.0.md` — 产品规划（含 will-do / will-not-do）
4. `docs/Roadmap-Phase12-15.md` — 中期路线图 + Phase 边界红线
5. `docs/Architecture-Phase14.md` — Phase 14 完整架构
6. `docs/Execution-Plan-Phase14B.md` — 当前 Phase 执行方案
7. `git log --oneline -8` — 最近提交历史
8. `git status --short` — 工作区状态

## 强制规则（来自 CLAUDE.md）

- 不要主动扩大 Phase 范围，严格按执行方案实施
- 不要跳过 Review 环节
- 不要在 Phase 未完成时进入下一 Phase
- 不要擅自提交（git commit 须经 ChatGPT 把关通过）
- 不要擅自修改数据库 schema / migration
- 每个 Phase 只能修改执行方案明确列出的文件
- 如果发现执行方案和代码不一致，先汇报，不要自行扩大修改范围

## 修改后必做

```bash
npm run lint
npm run build
git status --short
```
