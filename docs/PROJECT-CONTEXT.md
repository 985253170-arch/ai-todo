# PROJECT-CONTEXT.md — AI Todo 长期项目记忆

> 高频事实见 Memory（`memory/MEMORY.md`）。已关闭 Phase 完整文档见 `docs/archive/`。

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
| 认证 | Supabase Auth（V2.1 ✅ Email+Password 注册/登录） |
| AI | DeepSeek API（OpenAI-compatible） |
| 客户端 ID | localStorage deviceId |
| 部署 | Vercel |

依赖：`next` `react` `react-dom` `@supabase/supabase-js` `@supabase/ssr`。无图表库，无状态管理库。

## 3. 三角色分工

| 角色 | 职责 |
|------|------|
| Claude Code | 架构设计 / 执行方案 / Code Review / 最终验收 |
| Codex | 具体写代码 / 按执行方案实现 / 小修 bug |
| ChatGPT | 阶段把关 / 产品判断 / 给 Claude Code 和 Codex 分别写指令 |

标准工作流：Claude Code 写架构方案 → ChatGPT 审查 → Codex 实现 → Claude Code Review → ChatGPT 最终把关 → 提交。

## 4. V1.0 基础功能（已稳定）

- 输入目标 → AI 生成 3-8 条当日可执行任务
- 任务勾选完成/取消 · 重新生成/清空/开始新一天
- localStorage 本地保存 + Supabase 云端同步
- Email+Password 注册/登录/登出（V2.1 已替代 Magic Link）
- 匿名 device_id → 登录 user_id 任务迁移

## 5. 核心 API

| API Route | 方法 | 功能 | Session-Aware |
|-----------|------|------|:---:|
| `/api/generate-tasks` | POST | AI 生成任务（含智能调整） | ✅ |
| `/api/task-group/save` | POST | 保存/更新任务组 | ✅ |
| `/api/task-group/load` | GET | 读取当前活跃任务组 | ✅ |
| `/api/task-group/delete` | POST | 归档任务组 | ✅ |
| `/api/task-group/migrate` | POST | 匿名 → 登录迁移 | ✅ |
| `/api/task-groups/history` | GET | 历史记录（游标分页） | ✅ |
| `/api/task-groups/stats` | GET | 统计（Today/7Day/Total） | ✅ |
| `/api/task-groups/review` | POST | AI 复盘 | ✅ |

统一响应格式：`{success: true, data}` | `{success: false, error: {code, message}}`

## 6. 核心前端模块

| 模块 | 文件 | 职责 |
|------|------|------|
| `useTaskGroup` | `src/hooks/useTaskGroup.ts` | 核心状态：生成/勾选/清空/云端同步 |
| `useAuth` | `src/hooks/useAuth.ts` | Supabase Auth 状态 |
| `useTaskStats` | `src/hooks/useTaskStats.ts` | 统计数据获取 |
| `useTaskHistory` | `src/hooks/useTaskHistory.ts` | 历史记录（懒加载分页） |
| `useTaskReview` | `src/hooks/useTaskReview.ts` | AI 复盘状态管理 |
| `GoalInput` / `TaskList` / `Header` / `StatsBar` / `HistoryPanel` / `TaskReviewPanel` | `src/components/` | UI 组件 |

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

- `archived_at IS NULL` = 活跃任务组 · `archived_at IS NOT NULL` = 已归档
- `completed_at IS NOT NULL` = 已完成（支撑连续天数统计）
- API Route 使用 **service_role** key 绕过 RLS

## 8. deviceId 与 user_id 规则

- **未登录**：scope = `device:<deviceId>`，Supabase 按 `device_id` 归属
- **已登录**：scope = `user:<userId>`，Supabase 按 `user_id` 归属
- **登录时迁移**：`POST /api/task-group/migrate` 将 device 匿名任务更新为 userId
- **登出后**：清空 user scope localStorage，回退到 device scope
- **前端从不传 userId**，userId 只来自服务端 Supabase Auth session

## 9. Phase 历史

### Phase 12 — 历史记录 ✅
新增 `archived_at` + `completed_at` 字段，`GET /api/task-groups/history`（游标分页），归档替代物理删除，HistoryPanel + useTaskHistory。
→ 详见 `docs/archive/phase-12/Architecture-Phase12.md`

### Phase 13 — 统计 ✅
零数据库变更，纯聚合计算。`GET /api/task-groups/stats`，stats-calculator（computeAllStats/computeStreak），StatsBar UI。
→ 详见 `docs/archive/phase-13/Architecture-Phase13.md`

### Phase 14 — AI 复盘 ✅
14A: POST /api/task-groups/review（11 种错误码）+ review-parser + review prompt。
14B: useTaskReview + TaskReviewPanel（ready/loading/success/stale/error 状态机）。
14B-Follow-up: 前端错误码映射 + 样式微调。14C: 人工验收 36 项。
→ 详见 `docs/archive/phase-14/`

### Phase 15 — 智能任务调整 ✅
`computeAdjustment(stats)` 5 级阈值纯函数。generate-tasks API 变为 session-aware，服务端读取 stats → 增强 Prompt。stats 失败静默回退 V1.0。
→ 详见 `docs/archive/phase-15/`

### V2.0 主线闭环 ✅
```
目标 → AI 拆解 → 执行 → 记录 → 统计 → 复盘 → 智能调整
```
Phase 12-15 完整链路全部完成并验证通过。

### V2.1 Auth ✅
Magic Link → Email+Password 改造完成。仅改 5 个文件（useAuth / AuthModal / Header / callback / constants）。注册后邮箱确认已启用。Supabase Dashboard 已配置（Site URL: `https://ai-todo-kappa-drab.vercel.app`）。自定义 SMTP 邮件模板待 V2.1-Follow-up 或 V2.3 处理（Supabase 新版要求配置 SMTP 才能编辑模板）。用户已完成生产环境测试。
→ 详见 `docs/Architecture-V2.1-Auth.md` · `docs/Execution-Plan-V2.1-Auth.md`

### 下一阶段：V2.1-Follow-up SMTP 🔜
V2.1 Auth 主流程已完成，但 Confirm signup 邮件模板暂未自定义（Supabase 新版要求先配置自定义 SMTP 才能编辑模板）。下一阶段 V2.1-Follow-up 处理自定义 SMTP 与邮件确认稳定化，属于 V2.1 收尾增强，不是 V2.2。V2.1-Follow-up 完成后再进入 V2.2 UI 升级。

路线：V2.1 Auth ✅ → V2.1-Follow-up SMTP 🔜 → V2.2 UI ⏭️ → V2.3 Security ⏭️

## 10. 高风险文件

> 详见 Memory `high-risk-files.md`

修改前必须经 ChatGPT 审查的 10 个文件：
`useTaskGroup.ts` · `types.ts` · `ai-client.ts` · `task-parser.ts` · `supabase-server.ts` · `generate-tasks/route.ts` · `save/route.ts` · `delete/route.ts` · `load/route.ts` · `migrate/route.ts`

## 11. 最新提交

```
e607d9d feat: add V2.1 email password auth
1c12916 docs: add V2.1 Auth execution plan
bf6cee3 docs: add V2.1 Auth architecture and V2.1-V2.3 roadmap
881af19 docs: archive closed phases and trim project docs
71030e0 docs: update project context for Phase 15 completion
```

V2.0 主线 Phase 12-15 已关闭。V2.1 Auth 已完成。当前 HEAD = `e607d9d`。

## 12. 工作区路径

`C:\Dev\ai-todo`

## 13. 恢复上下文必读顺序

1. `CLAUDE.md` — 项目规则 + 阶段状态
2. `memory/MEMORY.md` — Memory 索引
3. `memory/current-phase-status.md` — 当前阶段
4. `memory/high-risk-files.md` — 高风险文件
5. `docs/PROJECT-CONTEXT.md` — 本文档
6. `docs/PROJECT-INDEX.md` — 项目文件索引
7. 当前活跃 Phase 文档（如 `docs/Architecture-V2.1-Auth.md`）
8. `git log --oneline -5` — 最近提交

## 强制规则（来自 CLAUDE.md）

- 不要主动扩大 Phase 范围，严格按执行方案实施
- 不要跳过 Review 环节 · 不要擅自提交
- 不要擅自修改数据库 schema / migration
- 每个 Phase 只修改执行方案明确列出的文件
- 发现执行方案和代码不一致，先汇报

## 修改后必做

```bash
npm run lint
npm run build
git status --short
```
