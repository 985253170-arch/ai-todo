# AI Todo 项目索引

> 让 Claude Code / Codex 快速找到需要的东西，不用全项目乱翻。

## 1. 项目入口

| 文件 | 用途 |
|------|------|
| [CLAUDE.md](../CLAUDE.md) | Claude Code 项目规则、工作流、强制规则 |
| [docs/PROJECT-CONTEXT.md](PROJECT-CONTEXT.md) | 长期项目上下文，恢复记忆用 |
| [README.md](../README.md) | 项目说明和运行方式 |

## 2. 产品与路线

| 文件 | 用途 |
|------|------|
| [PRD.md](../PRD.md) | V1.0 产品需求文档，历史参考 |
| [docs/PRD-V2.0.md](PRD-V2.0.md) | V2.0 产品规划，当前方向 |
| [docs/Roadmap-Phase12-15.md](Roadmap-Phase12-15.md) | Phase 12-15 路线图 |

## 3. 架构文档

| 文件 | 用途 |
|------|------|
| [Architecture.md](../Architecture.md) | V1.0 通用架构（组件拆分、状态管理、数据流、localStorage） |
| [Architecture-Phase10.md](../Architecture-Phase10.md) | Phase 10：数据库与云端保存 |
| [Architecture-Phase11.md](../Architecture-Phase11.md) | Phase 11：登录注册与多设备同步 |
| [docs/Architecture-Phase12.md](Architecture-Phase12.md) | Phase 12：历史记录 |
| [docs/Architecture-Phase13.md](Architecture-Phase13.md) | Phase 13：统计 |
| [docs/Architecture-Phase14.md](Architecture-Phase14.md) | Phase 14：AI 复盘 |

## 4. 执行方案

| 文件 | 用途 |
|------|------|
| [docs/Execution-Plan-Phase14A.md](Execution-Plan-Phase14A.md) | Phase 14A：AI 复盘 API 执行方案 |
| [docs/Execution-Plan-Phase14B.md](Execution-Plan-Phase14B.md) | Phase 14B：AI 复盘 UI 执行方案 |

## 5. 当前开发重点

- **当前阶段**：Phase 14B
- **当前目标**：实现 AI 复盘 UI
- **只允许修改 3 个文件**：
  - `src/hooks/useTaskReview.ts`
  - `src/components/TaskReviewPanel.tsx`
  - `src/app/page.tsx`

## 6. 核心代码入口

| 文件 | 职责 |
|------|------|
| [src/app/page.tsx](../src/app/page.tsx) | 主页面组装 |
| [src/hooks/useTaskGroup.ts](../src/hooks/useTaskGroup.ts) | 任务状态主 hook |
| [src/hooks/useAuth.ts](../src/hooks/useAuth.ts) | 登录状态 |
| [src/hooks/useTaskStats.ts](../src/hooks/useTaskStats.ts) | 统计 hook |
| [src/hooks/useTaskHistory.ts](../src/hooks/useTaskHistory.ts) | 历史 hook |
| [src/components/TaskList.tsx](../src/components/TaskList.tsx) | 任务列表 |
| [src/components/StatsBar.tsx](../src/components/StatsBar.tsx) | 统计栏 |
| [src/components/HistoryPanel.tsx](../src/components/HistoryPanel.tsx) | 历史面板 |

## 7. API 路由

| 路由 | 文件 | 功能 |
|------|------|------|
| `POST /api/generate-tasks` | [route.ts](../src/app/api/generate-tasks/route.ts) | AI 生成任务 |
| `POST /api/task-group/save` | [route.ts](../src/app/api/task-group/save/route.ts) | 保存任务组 |
| `GET /api/task-group/load` | [route.ts](../src/app/api/task-group/load/route.ts) | 读取活跃任务组 |
| `POST /api/task-group/delete` | [route.ts](../src/app/api/task-group/delete/route.ts) | 归档任务组 |
| `POST /api/task-group/migrate` | [route.ts](../src/app/api/task-group/migrate/route.ts) | 匿名任务迁移到登录用户 |
| `GET /api/task-groups/history` | [route.ts](../src/app/api/task-groups/history/route.ts) | 历史记录 |
| `GET /api/task-groups/stats` | [route.ts](../src/app/api/task-groups/stats/route.ts) | 统计 |
| `POST /api/task-groups/review` | [route.ts](../src/app/api/task-groups/review/route.ts) | AI 复盘 |

## 8. 核心工具

| 文件 | 职责 |
|------|------|
| [src/lib/types.ts](../src/lib/types.ts) | 全局类型定义 |
| [src/lib/ai-client.ts](../src/lib/ai-client.ts) | AI API 调用（callAIService / callAIWithPrompts） |
| [src/lib/task-parser.ts](../src/lib/task-parser.ts) | 任务生成 AI 响应解析 |
| [src/lib/review-parser.ts](../src/lib/review-parser.ts) | 复盘 AI 响应解析 |
| [src/lib/stats-calculator.ts](../src/lib/stats-calculator.ts) | 统计计算（computeAllStats 等） |
| [src/lib/supabase-server.ts](../src/lib/supabase-server.ts) | 服务端 Supabase + Auth |
| [src/lib/supabase-client.ts](../src/lib/supabase-client.ts) | 客户端 Supabase |
| [src/lib/device-id.ts](../src/lib/device-id.ts) | 匿名 deviceId 生成与持久化 |

## 9. Prompt

| 文件 | 用途 |
|------|------|
| [src/prompts/task-generation.ts](../src/prompts/task-generation.ts) | 任务生成 System Prompt + buildPrompt |
| [src/prompts/task-review.ts](../src/prompts/task-review.ts) | AI 复盘 System Prompt + buildReviewUserPrompt |

## 10. 不要随便改的高风险文件

修改以下文件前必须确认影响范围并获 ChatGPT 审查通过：

- `src/hooks/useTaskGroup.ts` — 核心状态管理，所有操作依赖
- `src/lib/types.ts` — 全局类型定义，全项目依赖
- `src/lib/ai-client.ts` — AI 调用底层，三个 API 共用
- `src/lib/task-parser.ts` — AI 响应解析
- `src/lib/supabase-server.ts` — 服务端 Supabase + Auth
- `src/app/api/generate-tasks/route.ts` — 核心生成 API
- `src/app/api/task-group/save/route.ts` — 保存 API
- `src/app/api/task-group/load/route.ts` — 加载 API
- `src/app/api/task-group/delete/route.ts` — 归档 API
- `src/app/api/task-group/migrate/route.ts` — 迁移 API

## 11. 后续整理计划

> ⚠️ 以下操作**等 Phase 14B 完成后再单独整理**，现在不要动：

| 当前位置 | 计划迁移 | 原因 |
|------|------|------|
| `PRD.md` | `docs/PRD-V1.0.md` | 与 V2.0 区分版本，统一放入 docs/ |
| `Architecture.md` | `docs/Architecture.md` | 与其他 Architecture 文档集中管理 |
| `Architecture-Phase10.md` | `docs/Architecture-Phase10.md` | 同上 |
| `Architecture-Phase11.md` | `docs/Architecture-Phase11.md` | 同上 |
| `docs/Future-Architecture-Notes-Phase13-15.md` | `docs/archive/` | 已完成历史使命，归档 |
