# AI Todo 项目索引

> 让 Claude Code / Codex 快速找到需要的东西。条目指向活跃文档和归档文档两部分。

## 1. 项目入口

| 文件 | 用途 |
|------|------|
| [CLAUDE.md](../CLAUDE.md) | Claude Code 项目规则、工作流、Memory 读取顺序 |
| [docs/PROJECT-CONTEXT.md](PROJECT-CONTEXT.md) | 长期项目上下文，恢复记忆用 |
| [README.md](../README.md) | 项目说明和运行方式 |

## 2. 产品与路线

| 文件 | 用途 |
|------|------|
| [docs/PRD-V2.0.md](PRD-V2.0.md) | V2.0 产品规划，当前方向 |
| [docs/Roadmap-Phase12-15.md](Roadmap-Phase12-15.md) | Phase 12-15 路线图 |

### 路线总览

| 版本 | 内容 | 状态 |
|------|------|:--:|
| V1.0 | 基础 Todo + AI 生成 + Supabase 同步 + Magic Link 登录 | ✅ 已归档 |
| V2.0 | Phase 12-15：历史 → 统计 → AI 复盘 → 智能调整 | ✅ 闭环 |
| V2.1 | Auth 改造：Magic Link → Email + Password | ✅ 已完成 |
| V2.1-Follow-up | 自定义 SMTP 与邮件确认稳定化 | 🔜 下一阶段 |
| V2.2 | 页面结构与产品体验升级（路由分离 + UI 美化） | ⏭️ V2.1-Follow-up 后 |
| V2.3 | 安全增强（Turnstile / 忘记密码） | ⏭️ V2.2 后 |

## 3. 架构文档

### 活跃（主 docs 区域，按需读取）

| 文件 | 用途 |
|------|------|
| [docs/Architecture-V2.1-Auth.md](Architecture-V2.1-Auth.md) | V2.1 Auth 架构（✅ 已完成） |
| [docs/Execution-Plan-V2.1-Auth.md](Execution-Plan-V2.1-Auth.md) | V2.1 Auth 执行方案（✅ 已完成） |

### 归档（`docs/archive/`，不默认读取）

| 目录 | 内容 |
|------|------|
| [docs/archive/phase-12/](archive/phase-12/) | Phase 12 历史记录 |
| [docs/archive/phase-13/](archive/phase-13/) | Phase 13 统计 |
| [docs/archive/phase-14/](archive/phase-14/) | Phase 14 AI 复盘（含 Execution Plans） |
| [docs/archive/phase-15/](archive/phase-15/) | Phase 15 智能调整（含 Execution Plan + 历史笔记） |
| [docs/archive/v1/](archive/v1/) | V1.0 架构 + PRD + Phase 10/11 |

## 4. 执行方案

| 文件 | 用途 |
|------|------|
| [docs/Execution-Plan-V2.1-Auth.md](Execution-Plan-V2.1-Auth.md) | V2.1 Auth 执行方案（已完成） |

V2.1 Auth 执行方案已完成并实施。下一阶段 V2.1-Follow-up SMTP（自定义 SMTP 与邮件确认稳定化）。V2.2 页面结构与产品体验升级排在 V2.1-Follow-up 之后。

## 5. 当前开发重点

- **当前阶段**：V2.1-Follow-up SMTP（V2.1 Auth ✅ 已完成）
- **当前活跃文档**：`docs/Architecture-V2.1-Auth.md`（参考，已完成）
- **下一步**：配置自定义 SMTP → 编辑 Confirm signup 邮件模板 → 验证邮件确认链路
- **之后**：V2.2 页面结构与产品体验升级（Claude Code 写 `docs/Architecture-V2.2-UI.md`，含路由分离 / 登录页独立设计 / UI 美化 / 移动端优化）
- **当前禁止**：不要修改 src/ 任何文件，不要进入 V2.2 实现

## 6. 核心代码入口

| 文件 | 职责 |
|------|------|
| [src/app/page.tsx](../src/app/page.tsx) | 主页面组装 |
| [src/hooks/useTaskGroup.ts](../src/hooks/useTaskGroup.ts) | 任务状态主 hook |
| [src/hooks/useAuth.ts](../src/hooks/useAuth.ts) | 登录状态 |
| [src/hooks/useTaskStats.ts](../src/hooks/useTaskStats.ts) | 统计 hook |
| [src/hooks/useTaskHistory.ts](../src/hooks/useTaskHistory.ts) | 历史 hook |
| [src/hooks/useTaskReview.ts](../src/hooks/useTaskReview.ts) | 复盘 hook |
| [src/components/TaskList.tsx](../src/components/TaskList.tsx) | 任务列表 |
| [src/components/StatsBar.tsx](../src/components/StatsBar.tsx) | 统计栏 |
| [src/components/HistoryPanel.tsx](../src/components/HistoryPanel.tsx) | 历史面板 |
| [src/components/TaskReviewPanel.tsx](../src/components/TaskReviewPanel.tsx) | 复盘面板 |

## 7. API 路由

| 路由 | 文件 | 功能 | Session-Aware |
|------|------|------|:--:|
| `POST /api/generate-tasks` | [route.ts](../src/app/api/generate-tasks/route.ts) | AI 生成任务（含智能调整） | ✅ |
| `POST /api/task-group/save` | [route.ts](../src/app/api/task-group/save/route.ts) | 保存任务组 | ✅ |
| `GET /api/task-group/load` | [route.ts](../src/app/api/task-group/load/route.ts) | 读取活跃任务组 | ✅ |
| `POST /api/task-group/delete` | [route.ts](../src/app/api/task-group/delete/route.ts) | 归档任务组 | ✅ |
| `POST /api/task-group/migrate` | [route.ts](../src/app/api/task-group/migrate/route.ts) | 匿名任务迁移到登录用户 | ✅ |
| `GET /api/task-groups/history` | [route.ts](../src/app/api/task-groups/history/route.ts) | 历史记录 | ✅ |
| `GET /api/task-groups/stats` | [route.ts](../src/app/api/task-groups/stats/route.ts) | 统计 | ✅ |
| `POST /api/task-groups/review` | [route.ts](../src/app/api/task-groups/review/route.ts) | AI 复盘 | ✅ |

## 8. 核心工具

| 文件 | 职责 |
|------|------|
| [src/lib/types.ts](../src/lib/types.ts) | 全局类型定义 |
| [src/lib/ai-client.ts](../src/lib/ai-client.ts) | AI API 调用（callAIService / callAIWithPrompts） |
| [src/lib/task-parser.ts](../src/lib/task-parser.ts) | 任务生成 AI 响应解析 |
| [src/lib/review-parser.ts](../src/lib/review-parser.ts) | 复盘 AI 响应解析 |
| [src/lib/stats-calculator.ts](../src/lib/stats-calculator.ts) | 统计计算（computeAllStats 等） |
| [src/lib/adjust-task-strategy.ts](../src/lib/adjust-task-strategy.ts) | 智能调整策略（computeAdjustment） |
| [src/lib/supabase-server.ts](../src/lib/supabase-server.ts) | 服务端 Supabase + Auth |
| [src/lib/supabase-client.ts](../src/lib/supabase-client.ts) | 客户端 Supabase |
| [src/lib/device-id.ts](../src/lib/device-id.ts) | 匿名 deviceId 生成与持久化 |

## 9. Prompt

| 文件 | 用途 |
|------|------|
| [src/prompts/task-generation.ts](../src/prompts/task-generation.ts) | 任务生成 System Prompt + buildPrompt |
| [src/prompts/task-review.ts](../src/prompts/task-review.ts) | AI 复盘 System Prompt + buildReviewUserPrompt |

## 10. 高风险文件

> 详细清单见 Memory `high-risk-files.md`。修改前必须确认影响范围并获 ChatGPT 审查。

- `src/hooks/useTaskGroup.ts` — 核心状态管理
- `src/lib/types.ts` — 全局类型定义
- `src/lib/ai-client.ts` — AI 调用底层
- `src/lib/supabase-server.ts` — 服务端 Supabase + Auth
- `src/app/api/generate-tasks/route.ts` — 核心生成 API
- `src/app/api/task-group/save/route.ts` — 保存 API
- `src/app/api/task-group/delete/route.ts` — 归档 API
- `src/app/api/task-group/load/route.ts` — 加载 API
- `src/app/api/task-group/migrate/route.ts` — 迁移 API
- `src/lib/task-parser.ts` — AI 响应解析

## 11. 归档说明

`docs/archive/` 目录保存已关闭 Phase 的完整原始文档。**普通任务不默认读取**，仅在需要完整历史上下文时按需查阅。已关闭 Phase 摘要信息在 `PROJECT-CONTEXT.md` §Phase 历史中。
