# CLAUDE.md — AI Todo

## 项目定位
AI Todo 是手机端优先的 AI 行动教练，不是普通 Todo List。

## 技术栈
Next.js App Router · TypeScript · Tailwind CSS · Supabase PostgreSQL / Supabase Auth
Next.js API Route · DeepSeek API（OpenAI-compatible） · localStorage deviceId · Vercel

## 项目阶段状态
- Phase 12 ✅ 历史记录基础
- Phase 13 ✅ 统计 API + 统计 UI
- Phase 14 ✅ AI 复盘（14A API + 14B UI + 14C 人工验收）
- Phase 15 ✅ 智能任务调整
- V2.0 主线 Phase 12-15 ✅ 闭环
- V2.1 Auth 🔜 架构文档已完成（`docs/Architecture-V2.1-Auth.md`），等待 ChatGPT 审查

## Memory 系统

项目使用 Claude Code Memory 缓存高频事实。**每次会话启动后优先读取：**

1. `memory/MEMORY.md` — Memory 索引（确认有哪些 memory）
2. `memory/current-phase-status.md` — 当前阶段
3. `memory/high-risk-files.md` — 高风险文件
4. `memory/mandatory-workflow.md` — 工作流与强制规则
5. `memory/docs-loading-policy.md` — 文档读取策略
6. `memory/memory-governance.md` — Memory 治理规则（写入前必读）

Memory 写入规则：严格遵守 `memory-governance.md`。

## 文档读取优先级

按以下顺序读取，禁止默认加载全部文档：

1. `CLAUDE.md`（本文件，系统自动注入）
2. `memory/MEMORY.md` → 按需读取具体 memory 条目
3. `docs/PROJECT-CONTEXT.md` — 长期项目记忆
4. `docs/PROJECT-INDEX.md` — 项目文件索引
5. 当前活跃 Phase 文档 → **仅在相关任务时读取**
6. `docs/archive/` → **仅在需要完整历史上下文时读取，普通任务不读**

## 关键文档

### 活跃文档（可能被修改）
- `docs/Architecture-V2.1-Auth.md` — V2.1 Auth 架构（当前 Phase）
- `docs/PROJECT-CONTEXT.md` — 长期项目记忆
- `docs/PROJECT-INDEX.md` — 项目文件索引

### 参考文档（只读）
- `docs/PRD-V2.0.md` — V2.0 产品规划
- `docs/Roadmap-Phase12-15.md` — Phase 12-15 路线图

### 归档文档（`docs/archive/`，不默认读取）
已关闭 Phase 的完整架构文档和执行方案已归档到 `docs/archive/phase-{12,13,14,15}/`。
V1.0 旧文档归档到 `docs/archive/v1/`。

## 角色分工
| 角色 | 职责 |
|------|------|
| Claude Code | 架构设计 / 执行方案 / Code Review / 最终验收 |
| Codex | 按执行方案写代码 / 小修 bug |
| ChatGPT | 阶段把关 / 产品判断 / 分别给 Claude Code 和 Codex 写指令 |

## 当前工作流
1. Claude Code 写架构 / 执行方案 / Review
2. ChatGPT 审查并给下一步指令
3. Codex 按通过的执行方案实现代码
4. Claude Code Review
5. ChatGPT 最终把关
6. 通过后再提交

## 强制规则
- 不要主动扩大 Phase 范围，严格按照执行方案实施
- 不要跳过 Review 环节
- 不要在当前 Phase 未完成时进入下一 Phase
- 不要擅自提交（git commit 必须经 ChatGPT 把关通过）
- 不要擅自修改数据库 schema / migration
- 每个 Phase 只能修改执行方案中明确列出的文件
- 如果发现执行方案和代码不一致，先汇报，不要自行扩大修改范围

## 文件写入规则

- 不要在根目录创建新的 .md 文件，除非是 CLAUDE.md 或 README.md。
- 项目长期上下文写入 docs/PROJECT-CONTEXT.md。
- 项目索引写入 docs/PROJECT-INDEX.md。
- 产品文档、架构文档、执行方案统一放入 docs/。
- 架构文档命名：docs/Architecture-PhaseXX.md。
- 执行方案命名：docs/Execution-Plan-PhaseXX.md。
- **已关闭 Phase 文档归档到 `docs/archive/phase-XX/`，不在主 docs 区域保留。**
- 前端组件放入 src/components/。
- 前端 hook 放入 src/hooks/。
- API Route 放入 src/app/api/。
- 通用工具放入 src/lib/。
- AI Prompt 放入 src/prompts/。
- 不要创建 AGENTS.md，本项目使用 CLAUDE.md 管理 Claude Code 项目规则。
- 不要创建重复文档；如果已有文档覆盖同一主题，优先更新已有文档。
- 不要在 src/ 外创建 .ts / .tsx 文件。
- 不要擅自移动 Next.js 约定文件，例如 src/app/page.tsx、src/app/api、package.json、next.config.ts。
- 如果需要移动已有文件，必须先输出迁移方案，等 ChatGPT 审查通过后再执行。

## 修改后必做
```bash
npm run lint
npm run build
git status --short
```
