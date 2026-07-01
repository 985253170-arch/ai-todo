# CLAUDE.md — AI Todo

## 项目定位
AI Todo 是手机端优先的 AI 行动教练，不是普通 Todo List。

## 技术栈
Next.js App Router · TypeScript · Tailwind CSS · Supabase PostgreSQL / Supabase Auth
Next.js API Route · DeepSeek API（OpenAI-compatible） · localStorage deviceId · Vercel

## 项目阶段状态
- Phase 12 ✅ 历史记录基础
- Phase 13 ✅ 统计 API + 统计 UI
- Phase 14A ✅ POST /api/task-groups/review AI 复盘 API
- Phase 14B 🔜 Codex 实现 AI 复盘 UI（执行方案已提交 c287ac1）

## 关键文档
- docs/Architecture-Phase14.md
- docs/Execution-Plan-Phase14A.md
- docs/Execution-Plan-Phase14B.md
- docs/Architecture-Phase13.md
- docs/Architecture-Phase12.md
- docs/Roadmap-Phase12-15.md
- docs/PRD-V2.0.md

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

## 修改后必做
```bash
npm run lint
npm run build
git status --short
```
