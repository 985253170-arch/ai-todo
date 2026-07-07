# AI Todo Project State Handoff

> 状态：当前项目交接文档
> 用途：新会话 / Claude Code / Codex 接手项目时优先读取
> 更新日期：2026-07-08
> 原则：只记录当前有效状态，不重复旧阶段完整方案

---

## 1. 产品定位

AI Todo 是**手机端优先的 AI 行动教练**，不是普通 Todo List。

核心闭环：**目标 → AI 拆解 → 执行 → 记录 → 复盘 → 智能调整**。

核心价值是把"模糊目标"转化为"今天能做的小任务"，并通过历史完成情况不断调整任务难度、数量和节奏。

**明确不做**：复杂项目管理、团队协作、甘特图、OKR 系统、日历排期、社交分享、排行榜、会员系统、支付。

## 2. 当前已完成能力

### 任务生命周期
- 输入目标 → AI 生成 3-8 条当日可执行任务
- 任务勾选完成/取消
- 重新生成 / 清空任务 / 开始新一天
- 全部完成后提示

### 数据持久化
- localStorage 本地保存 + Supabase 云端同步
- 匿名 deviceId 任务归属
- 登录 userId 任务归属
- 匿名 → 登录任务自动迁移

### 账号体系
- 邮箱验证码（OTP）登录/注册
- 密码登录
- 登录后强引导设置密码（允许"稍后再说"）
- 忘记密码 / 验证码式重置密码
- Cloudflare Turnstile 防机器人
- 自定义 SMTP（阿里云邮件推送）
- 错误提示脱敏

### 页面结构
- `/` Landing Page / 产品首页
- `/login` 登录 / 注册页面
- `/app` AI Todo 主工作台（需登录）
- `/forgot-password` 忘记密码
- `/reset-password` 重置密码
- Auth 路由守卫（client-side redirect）

### AI 能力
- AI 任务生成（含智能调整：根据历史完成率动态调整任务数量和难度）
- AI 复盘（基于历史完成情况给出轻量复盘）
- 任务级 AI 辅助（"AI 帮我一下"——给步骤、模板、检查清单、框架）
- 任务陪伴模式（"开始陪我做"——逐步推进当前任务）
- 未完成任务跨天继承
- 任务顺序执行（locked/unlocked 机制）
- AI 序列上下文感知
- AI 主动提供材料、框架、清单、低风险草稿的边界修正

### 历史与统计
- 历史记录（按日期查看任务组，游标分页）
- 统计面板（今日/7天/总计 完成数，连续行动天数）

## 3. 当前技术现状

### 技术栈

| 层 | 技术 |
|---|------|
| 框架 | Next.js App Router |
| 语言 | TypeScript |
| 样式 | Tailwind CSS |
| 数据库 | Supabase PostgreSQL |
| 认证 | Supabase Auth（OTP + Password） |
| AI | DeepSeek API（OpenAI-compatible） |
| 客户端 ID | localStorage deviceId |
| 部署 | Vercel |

### 关键目录

```
src/
├── app/
│   ├── api/
│   │   ├── generate-tasks/route.ts    # AI 生成任务（含智能调整）
│   │   ├── task-group/save/route.ts   # 保存任务组
│   │   ├── task-group/load/route.ts   # 加载任务组
│   │   ├── task-group/delete/route.ts # 归档任务组
│   │   ├── task-group/migrate/route.ts# 匿名→登录迁移
│   │   ├── task-groups/history/route.ts# 历史记录（游标分页）
│   │   ├── task-groups/stats/route.ts # 统计
│   │   └── task-groups/review/route.ts# AI 复盘
│   ├── app/page.tsx       # /app 主工作台
│   ├── login/page.tsx     # /login 登录注册
│   ├── forgot-password/   # 忘记密码
│   ├── reset-password/    # 重置密码
│   ├── layout.tsx         # 根布局
│   ├── globals.css        # 全局样式
│   └── page.tsx           # / Landing Page
├── components/
│   ├── MainWorkspace.tsx      # 主工作台容器
│   ├── GoalInput.tsx          # 目标输入
│   ├── TaskList.tsx           # 任务列表
│   ├── TaskItem.tsx           # 单条任务
│   ├── TaskAssistPanel.tsx    # AI 帮我一下面板
│   ├── TaskCompanionPanel.tsx # 陪伴模式面板
│   ├── Header.tsx             # 顶部导航
│   ├── StatsBar.tsx           # 统计栏
│   ├── HistoryPanel.tsx       # 历史面板
│   ├── TaskReviewPanel.tsx    # AI 复盘面板
│   ├── LandingPage.tsx        # 产品首页
│   ├── LoginPageContent.tsx   # 登录页内容
│   ├── AuthModal.tsx          # Auth 弹窗（旧，可能未使用）
│   └── ...其他组件
├── hooks/
│   ├── useTaskGroup.ts    # 核心状态：生成/勾选/清空/云端同步
│   ├── useAuth.ts         # Supabase Auth 状态
│   ├── useTaskAssist.ts   # AI 辅助执行
│   ├── useTaskCompanion.ts# 任务陪伴模式
│   ├── useTaskStats.ts    # 统计数据
│   ├── useTaskHistory.ts  # 历史记录（懒加载分页）
│   └── useTaskReview.ts   # AI 复盘状态
├── lib/
│   ├── types.ts              # 核心类型定义
│   ├── ai-client.ts          # DeepSeek API 客户端
│   ├── supabase-server.ts    # Supabase 服务端 client
│   ├── supabase-client.ts    # Supabase 浏览器 client
│   ├── storage.ts            # localStorage 抽象
│   ├── task-parser.ts        # 任务生成解析
│   ├── task-execution.ts     # 任务执行状态判断
│   ├── task-assist-parser.ts # AI 辅助输出解析
│   ├── task-companion-parser.ts # 陪伴模式输出解析
│   ├── review-parser.ts      # AI 复盘输出解析
│   ├── stats-calculator.ts   # 统计计算
│   ├── adjust-task-strategy.ts # 智能调整策略
│   ├── auth-errors.ts        # Auth 错误码处理
│   ├── input-validator.ts    # 输入校验
│   ├── date-utils.ts         # 日期工具
│   ├── device-id.ts          # deviceId 管理
│   └── constants.ts          # 常量
└── prompts/
    ├── task-generation.ts    # AI 任务生成 Prompt
    ├── task-review.ts        # AI 复盘 Prompt
    ├── task-assist.ts        # AI 辅助执行 Prompt（V2.5.3 最新）
    └── task-companion.ts     # 陪伴模式 Prompt（V2.5.3 最新）
```

### 数据库

- `task_groups` 表：id, goal, user_id, device_id, created_at, updated_at, archived_at
- `tasks` 表：id, task_group_id (FK), title, completed, completed_at, created_at, updated_at
- `archived_at IS NULL` = 活跃，`archived_at IS NOT NULL` = 已归档
- API Route 使用 **service_role** key 绕过 RLS

### 高风险文件（修改前必须审查）

`useTaskGroup.ts` · `types.ts` · `ai-client.ts` · `task-parser.ts` · `supabase-server.ts` · `generate-tasks/route.ts` · `save/route.ts` · `delete/route.ts` · `load/route.ts` · `migrate/route.ts`

## 4. 当前页面结构

| 路由 | 用途 | Auth 要求 |
|------|------|:---:|
| `/` | Landing Page / 产品首页 | 无 |
| `/login` | 登录 / 注册页面 | 无 |
| `/app` | AI Todo 主工作台（核心） | 需登录 |
| `/forgot-password` | 忘记密码 | 无 |
| `/reset-password` | 重置密码 | 无 |

`/app` 是核心工作台，所有功能集中在单页内：GoalInput + TaskList + StatsBar + HistoryPanel + TaskReviewPanel。

## 5. 当前 AI 能力

### 已实现
- **任务生成**：输入目标 → AI 拆解为 3-8 条当日可执行任务
- **智能调整**：根据历史完成率动态调整任务数量和难度（5 级阈值）
- **AI 复盘**：基于历史完成情况给出轻量复盘建议
- **任务级 AI 辅助**（"AI 帮我一下"）：how_to_start / break_down / five_minute / im_stuck 四种动作
- **任务陪伴模式**（"开始陪我做"）：start / done / stuck / too_hard / encourage 五种信号，逐步推进
- **序列上下文感知**：AI 知道当前任务在列表中的位置（第几步/共几步）
- **未完成任务跨天继承**：昨天未完成的任务今天自动带入
- **任务顺序执行**：locked 任务不能跳过，完成当前任务后下一任务才解锁

### AI 边界规则（V2.5.3）
- AI 不替用户完成需要本人承担结果的最终动作
- AI 可以主动提供：信息、材料、框架、模板、示例、问题清单、检查清单、参考表达、低风险草稿、第一句开头、可选方案
- 低风险草稿只能是练习版/片段/开头/可替换句式/半成品，不能是完整最终稿
- AI 不默认让用户去知乎、百度、小红书、CSDN 搜索
- 给材料后必须收束到一个可执行的小动作
- 医疗/法律/金融等高风险任务只能给通用信息和求助建议

## 6. 当前账号与安全能力

- **Supabase Auth**：Email OTP + Password 混合登录
- **邮箱验证码登录**：新邮箱 OTP 自动创建账号
- **密码登录**：已设置密码的用户可用邮箱+密码登录
- **设置密码引导**：OTP 登录后强引导设置密码（允许"稍后再说"）
- **忘记密码**：`/forgot-password` 页面，输入邮箱 → 发送重置验证码
- **验证码式重置密码**：`/reset-password` 页面，输入验证码 + 新密码
- **自定义 SMTP**：阿里云邮件推送，已配置完成
- **Turnstile**：Cloudflare Turnstile 防机器人（登录/注册表单）
- **错误提示脱敏**：不暴露"用户不存在"vs"密码错误"，统一提示
- **Auth 路由守卫**：`/app` client-side redirect 到 `/login`（未登录时）

## 7. 当前任务执行规则

- 用户主导执行，AI 只辅助，不自动完成
- 任务按列表顺序执行
- locked 任务不能跳过（没有 AI 辅助/陪伴入口）
- 只有"当前任务"（解锁态）才显示 AI 辅助 / 陪伴入口
- 完成当前任务后，下一任务自动解锁
- 未完成任务跨天继承到新一天
- AI 不能建议用户跳过当前任务或先做后面的任务
- 完成权始终在用户手中

## 8. 当前文档整理状态

- 历史阶段文档（V2.1–V2.5.3）已全部移动到 `docs/archive/`
- 旧路线文档和项目元文档已移动到 `docs/archive/`
- `docs/archive/` 还包含 `phase-12/` `phase-13/` `phase-14/` `phase-15/` `v1/`（更早归档）
- `docs/` 根目录只保留：`PRD-V2.0.md`、`Project-State-Handoff.md`（本文件）、`Architecture-V3.0-Web-App-Separation.md`
- **旧文档禁止删除**，需要查历史时去 archive

## 9. 下一阶段：V3.0 Web 与 App 界面分离

V3.0 目标是把"网页端"和"手机应用界面"分开设计。

- **Web 端**：产品介绍、登录、桌面浏览体验、管理/概览
- **App 端**：今日行动、任务执行、AI 陪伴、底部导航、移动端沉浸体验
- PWA 已存在，但 PWA 不等于 App 信息架构
- 手机 App UI 需要独立页面结构，不是直接把网页缩小
- 详细方案见 `docs/Architecture-V3.0-Web-App-Separation.md`

## 10. Claude Code / Codex 协作流程

```
ChatGPT：阶段把关 / 产品判断 / 给 Claude Code 和 Codex 写指令
Claude Code：架构设计 / 执行方案 / Review / 最终验收
Codex：具体写代码 / 按文档实现 / 小修 bug
```

标准工作流：

```
1. Claude Code 写架构方案（Architecture-PhaseXX.md）
2. ChatGPT 审查架构方案
3. Claude Code 写执行方案（Execution-Plan-PhaseXX.md）
4. ChatGPT 审查执行方案
5. Codex 按执行方案实现代码
6. Claude Code Code Review
7. ChatGPT 最终把关
8. Commit / Push
```

## 11. 禁止事项

- 不随便改数据库 schema / migration
- 不随便改 Auth 核心逻辑
- 不随便改 API Route
- 不把 AI 做成全自动 Agent
- 不把任务完成权交给 AI
- 不让旧文档继续污染新会话上下文
- 不擅自提交（git commit 必须经 ChatGPT 把关通过）
- 不主动扩大 Phase 范围
- 不跳过 Review 环节
- 不删除任何文档（归档 ≠ 删除）

## 12. 新会话最小上下文

以后新会话只需要带：

1. `CLAUDE.md` — 项目规则（系统自动注入）
2. `docs/PRD-V2.0.md` — V2.0 产品规划
3. `docs/Project-State-Handoff.md` — 本文档（项目当前状态）
4. `docs/Architecture-V3.0-Web-App-Separation.md` — V3.0 架构方案
5. `memory/MEMORY.md` — Memory 索引（按需读取具体条目）

不再需要读取 20+ 个旧阶段 Architecture/Execution Plan 文档。需要查历史时去 `docs/archive/`。
