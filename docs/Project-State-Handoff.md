# AI Todo Project State Handoff

> 状态：当前项目交接文档
> 用途：新会话 / Claude Code / Codex 接手项目时优先读取
> 更新日期：2026-07-10（V3.0A Batch 4：足迹页已完成并已 push）
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

### 任务难度与数量动态调整（V2.7 新增）
- 用户多次卡住 / 太难 / 没时间后，AI 给出任务调整建议
- 支持三种调整类型：downgraded（降级版）/ tomorrow（明日继续）/ keep_visible（保留可见）
- 用户必须点击"接受调整"才生效（Human-in-the-Loop），AI 不自动执行
- "不用，继续"不发送 done 信号，不自动请求 AI
- resolved_today 四态加入任务执行逻辑（completed / current / locked / resolved_today）
- tomorrow / keep_visible 不自动完成，今天不阻塞后续任务
- downgraded 仍是 current，仍阻塞后续任务
- 跨天恢复时自动清理 tomorrow / keep_visible adjustment
- 不改数据库 schema · 不改 save/load route · 不改统计口径
- 不实现 postponed · 不做批量调整

### 页面结构
- `/` Landing Page / 产品首页
- `/login` 登录 / 注册页面
- `/app` AI Todo 主工作台（需登录）
- `/forgot-password` 忘记密码
- `/reset-password` 重置密码
- Auth 路由守卫（client-side redirect）

### AI 能力
- AI 任务生成（含生成阶段智能调整：根据历史完成率动态调整生成任务数量和难度）
- AI 复盘（基于历史完成情况给出轻量复盘）
- 任务级 AI 辅助（"AI 帮我一下"——给步骤、模板、检查清单、框架）
- 任务陪伴模式（"开始陪我做"——固定信号按钮 + 任务内受控短反馈输入框，逐步推进当前任务）
- 任务内受控反馈输入框（用户可输入当前进展、卡点、草稿、时间限制，AI 基于反馈继续推进）
- AI 小步验收机制（AI 判断当前小步质量，可建议用户自己勾选完成，但不能自动勾选）
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
│   │   ├── task-groups/review/route.ts# AI 复盘
│   │   ├── task-assist/route.ts     # AI 辅助执行
│   │   └── task-companion/route.ts  # 陪伴模式
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
    └── task-companion.ts     # 陪伴模式 Prompt（V2.6 最新）
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
- **任务陪伴模式**（"开始陪我做"）：固定按钮（我完成了/我卡住了/太难了）+ 任务内受控短反馈输入框，逐步推进。AI 可基于用户反馈继续推进当前任务，可验收当前小步质量
- **序列上下文感知**：AI 知道当前任务在列表中的位置（第几步/共几步）
- **未完成任务跨天继承**：昨天未完成的任务今天自动带入
- **任务顺序执行**：locked 任务不能跳过，完成当前任务后下一任务才解锁
- **任务动态调整（V2.7）**：用户多次反馈卡住/太难/没时间后，AI 给出 [ADJUST] 建议。支持 downgraded / tomorrow / keep_visible 三种调整。用户接受后生效，decline 不触发 AI 请求。resolved_today 状态不阻塞后续任务

### AI 边界规则（V2.5.3 + V2.7）
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
- resolved_today 状态的任务（tomorrow / keep_visible）今天不阻塞后续任务，但也不自动完成
- downgraded 任务仍是 current 状态，仍阻塞后续任务
- 跨天恢复时自动清理 tomorrow / keep_visible adjustment，保留 downgraded
- AI 不能建议用户跳过当前任务或先做后面的任务
- 完成权始终在用户手中
- AI 小步验收机制：AI 判断当前小步质量（基本可以过 / 还差一点 / 不算完成 / 可以勾选完成）
- AI 可以建议用户自己勾选完成，但不能自动勾选任务
- AI 不能替用户完成任何需要用户本人承担结果的最终动作

## 8. 当前文档整理状态

- 历史阶段文档（V2.1–V2.5.3）已全部移动到 `docs/archive/`
- 旧路线文档和项目元文档已移动到 `docs/archive/`
- `docs/archive/` 还包含 `phase-12/` `phase-13/` `phase-14/` `phase-15/` `v1/`（更早归档）
- **旧文档禁止删除**，需要查历史时去 archive

## 9. 🟢 当前状态：V3.0A Batch 4 已完成

### 9.1 V2.6 已完成 ✅

V2.6（任务内受控反馈框与 AI 验收机制）已实现并通过最终验收。

**已提交 commit：** `718ec47 feat: add V2.6 task feedback input`

### 9.2 V2.7 已完成 ✅

V2.7（任务难度与数量动态调整）已实现并通过全部验收环节：
- ✅ Claude Code Code Review
- ✅ P0 parser regex 修复复审
- ✅ ChatGPT 最终把关
- ✅ 用户手动验收

**最新提交：** `cd8b99f feat: add V2.7 task adjustment flow`

**V2.7 已交付能力：**
- 用户多次卡住 / 太难 / 没时间后，AI 给出 [ADJUST] 任务调整建议
- 支持三种调整：downgraded（降级版）/ tomorrow（明日继续）/ keep_visible（保留可见）
- Human-in-the-Loop：用户点击"接受调整"才生效，AI 不自动执行
- "不用，继续"不发送 done，不自动请求 AI
- resolved_today 四态任务执行（completed / current / locked / resolved_today）
- tomorrow / keep_visible 今天不阻塞后续任务，不自动完成
- downgraded 仍是 current，仍阻塞后续任务
- 跨天恢复时自动清理 tomorrow / keep_visible adjustment
- 不改数据库 · 不改 save/load route · 不改统计口径
- 不实现 postponed · 不做批量调整

**V2.7 修改的 11 个代码文件：**
1. `src/lib/types.ts`
2. `src/lib/task-execution.ts`
3. `src/lib/task-companion-parser.ts`
4. `src/prompts/task-companion.ts`
5. `src/app/api/task-companion/route.ts`
6. `src/hooks/useTaskCompanion.ts`
7. `src/hooks/useTaskGroup.ts`
8. `src/components/TaskCompanionPanel.tsx`
9. `src/components/TaskItem.tsx`
10. `src/components/TaskList.tsx`
11. `src/components/MainWorkspace.tsx`

### 9.3 V2.6 + V2.7 阶段文档

| 文档 | 路径 | 状态 |
|------|------|:--:|
| 路线规划 | `docs/Roadmap-V2.6-to-V3.0A-AI-Execution-Loop.md` | ✅ |
| V2.6 架构方案 | `docs/Architecture-V2.6-Task-Feedback-Input.md` | ✅ |
| V2.6 执行方案 | `docs/Execution-Plan-V2.6-Task-Feedback-Input.md` | ✅ |
| 版本锁定关系 | `docs/Upgrade-Lock-V2.6-to-V3.0A.md` | ✅ |
| V2.7 架构方案 | `docs/Architecture-V2.7-Task-Difficulty-Adjustment.md` | ✅ |
| V2.7 执行方案 | `docs/Execution-Plan-V2.7-Task-Difficulty-Adjustment.md` | ✅ |

### 9.4 V3.0A Batch 3A 已完成 ✅

V3.0A Batch 3A（今日首页 + 任务界面）已完成、提交并 push 到 GitHub main。

**最新提交：** `a25245c4 feat: add mobile today flow`

**已完成内容：**
1. 今日首页 `TodayHomeView`
2. 目标输入卡 `GoalInputCard`
3. 准备卡 `ReadyCard`
4. 任务界面 `TaskListView`
5. 任务进度卡 `TaskProgressCard`
6. 当前任务卡 `CurrentTaskCard`
7. 后续任务区 `UpcomingTaskList`
8. `AppShell` 手机视口高度模型修复
9. `phone-preview.html` 手机边框验收工具

**视觉验收结论：**
- ✅ 任务界面通过
- ✅ 今日首页基本通过
- 🟡 今日首页底部“今天走到了这里”略紧凑，记为 P2，不阻断

**技术验收结论：**
- ✅ lint 通过
- ✅ build 通过
- ✅ Claude Code Review 通过
- ✅ P0 = 0
- ✅ P1 = 0
- ✅ 已 push 到 GitHub main

### 9.5 V3.0A Batch 3B 已完成 ✅

V3.0A Batch 3B（任务执行界面）已完成、提交并 push 到 GitHub main。

**最新提交：** `5606f244 feat: add mobile task execution view`

**已完成内容：**
1. 新增任务执行界面 `TaskExecutionView`
2. 新增当前任务展示卡 `ExecutionTaskCard`
3. 新增 AI 指引卡 `ExecutionGuideCard`
4. 新增反馈输入区 `ExecutionFeedbackBox`
5. `page.tsx` 增加 `todayMode = home | tasks | execution`
6. 实现任务界面点击"陪我做这一步"进入任务执行界面
7. 实现"回到任务 / 先退出"返回任务界面
8. 实现"我完成了这一小步"后完成当前任务并推进下一任务
9. 实现输入反馈后只替换 AI 指引，不生成聊天记录

**视觉验收结论：**
- ✅ 任务执行界面通过
- ✅ 底部 Tab 保留
- ✅ 页面不是聊天软件、没有聊天气泡/消息列表
- ✅ "我完成了这一小步"可见
- ✅ 页面没有变成长网页

**技术验收结论：**
- ✅ lint 通过
- ✅ build 通过
- ✅ Claude Code Review 通过
- ✅ P0 = 0
- ✅ P1 = 0
- ✅ P2 = 2（loading 文案省略号不一致 + 视觉可微调），不阻断
- ✅ 已 push 到 GitHub main

### 9.6 V3.0A Batch 4：足迹页 已完成 ✅

V3.0A Batch 4（足迹页）已完成、提交并 push 到 GitHub main。

**最新提交：** `d52c88e3 feat: add mobile footprints view`

**已完成内容：**
1. 新增足迹页主容器 `FootprintsView`
2. 新增足迹空状态 `FootprintEmptyState`
3. 新增今日轻总结卡 `FootprintSummaryCard`
4. 新增最近足迹列表 `FootprintList`
5. 新增足迹详情页 `FootprintDetailView`
6. `page.tsx` 接入 `activeTab === "footprint"` 渲染 `FootprintsView`
7. 实现足迹列表页
8. 实现足迹详情页
9. 实现足迹列表 → 足迹详情
10. 实现足迹详情 → 足迹列表
11. 实现空状态按钮 → 回到今日
12. 只使用 `FootprintsView` 内本地 mock 数据
13. 未新增路由
14. 未新增 AppShell
15. 未修改 BottomTabBar

**视觉验收结论：**
- ✅ 足迹列表页通过
- ✅ 足迹详情页通过
- ✅ 底部 Tab 保留，足迹 Tab 激活正常
- ✅ 页面没有 SaaS 报表化
- ✅ 页面没有 Todo 历史列表化
- ✅ 没有 checkbox / 完成率 / KPI / 统计报表
- ✅ 文案符合清行温柔、低压力风格

**技术验收结论：**
- ✅ lint 通过
- ✅ build 通过
- ✅ Claude Code Review 通过
- ✅ P0 = 0
- ✅ P1 = 0
- ✅ P2 = 3（FootprintEntry 接口重复定义 + totalCompletedToday 硬编码 + mock 数据下空状态不默认展示），不阻断
- ✅ 已 push 到 GitHub main

**本次提交文件：**
1. `apps/mobile-app/app/page.tsx`
2. `apps/mobile-app/components/footprints/FootprintsView.tsx`
3. `apps/mobile-app/components/footprints/FootprintEmptyState.tsx`
4. `apps/mobile-app/components/footprints/FootprintSummaryCard.tsx`
5. `apps/mobile-app/components/footprints/FootprintList.tsx`
6. `apps/mobile-app/components/footprints/FootprintDetailView.tsx`

### 9.7 下一阶段：V3.0A Batch 5

下一阶段为 **V3.0A Batch 5：成长页**。

## 10. V2.6 → V3.0A 版本路线总览

```
V2.5.3 ✅ → V2.6 ✅ → V2.7 ✅ → V3.0A Batch 3A ✅ → V3.0A Batch 3B ✅ → V3.0A Batch 4 ✅ → V3.0A Batch 5 🔜
  AI输出      用户→AI    AI自适应     今日首页/任务界面     任务执行界面       足迹页       成长页
  能力升级    反馈通道    任务调整     手机前端闭环入口     任务层陪伴         足迹历史     成长洞察
```

**版本依赖**：V2.5.3→V2.6 ✅（已完成）→ V2.7 ✅（已完成）→ V3.0A（强建议依赖）

**不允许多版本并行开发。必须严格按顺序推进。**

详细锁定关系见 [`docs/Upgrade-Lock-V2.6-to-V3.0A.md`](docs/Upgrade-Lock-V2.6-to-V3.0A.md)（新会话必读）。

## 11. 长期未跟踪项

以下文件/目录长期存在于工作区但未被 Git 跟踪，持续忽略不处理：

- `.agents/`
- `.claude/`
- `.codex/`
- `skills-lock.json`
- `start`
- `stop`

## 12. Claude Code / Codex 协作流程

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

## 13. 禁止事项

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

## 14. 新会话最小上下文

以后新会话只需要带：

1. `CLAUDE.md` — 项目规则（系统自动注入）
2. `docs/Project-State-Handoff.md` — 本文档（项目当前状态）⭐
3. `docs/Roadmap-V2.6-to-V3.0A-AI-Execution-Loop.md` — V2.6→V3.0A 路线总览
4. `docs/Upgrade-Lock-V2.6-to-V3.0A.md` — 版本锁定关系（新会话必读）⭐
5. `docs/Architecture-V2.7-Task-Difficulty-Adjustment.md` — V2.7 架构方案（已完成，参考）
6. `docs/Execution-Plan-V2.7-Task-Difficulty-Adjustment.md` — V2.7 执行方案（已完成，参考）
7. `docs/Architecture-V3.0-Web-App-Separation.md` — V3.0 架构（⚠️ 需先修订再进入 V3.0A）
8. `docs/PRD-V2.0.md` — V2.0 产品规划
9. `memory/MEMORY.md` — Memory 索引（按需读取具体条目）

不再需要读取 20+ 个旧阶段 Architecture/Execution Plan 文档。需要查历史时去 `docs/archive/`。

## 15. 🟡 当前执行中：V3.0A-Frontend-Isolation

V3.0A 前端隔离工程已启动，并已完成到 **Batch 4：足迹页**。

### 文档位置

**项目级架构决策文档（根 docs/）**：
- [Architecture-V3.0A-Frontend-Isolation.md](Architecture-V3.0A-Frontend-Isolation.md) — 为什么做前端隔离、为什么选 `apps/mobile-app`、文档边界

**手机 App 前端内部文档（apps/mobile-app/docs/）**：
- [UI-Spec-Design-Screenshot-Lock-V3.0A.md](../apps/mobile-app/docs/UI-Spec-Design-Screenshot-Lock-V3.0A.md) — 设计稿截图与页面职责最高优先级锁定
- [Mobile-Viewport-Layout-Lock-V3.0A.md](../apps/mobile-app/docs/Mobile-Viewport-Layout-Lock-V3.0A.md) — 390×844 手机视口与高度预算锁定
- [Frontend-UI-Boundary-Lock-V3.0A.md](../apps/mobile-app/docs/Frontend-UI-Boundary-Lock-V3.0A.md) — 前端 UI 边界、状态机和禁止项锁定
- [UI-Spec-Mobile-App.md](../apps/mobile-app/docs/UI-Spec-Mobile-App.md) — 手机 App UI 与交互规格
- [Frontend-Architecture.md](../apps/mobile-app/docs/Frontend-Architecture.md) — 前端内部架构设计
- [Frontend-Execution-Plan.md](../apps/mobile-app/docs/Frontend-Execution-Plan.md) — 前端执行方案
- [Codex-Frontend-Implementation-Workflow.md](../apps/mobile-app/docs/Codex-Frontend-Implementation-Workflow.md) — Codex 前端实现流程规范

**文档边界规则**：
- 根 `docs/` 管项目级决策（为什么做）
- `apps/mobile-app/docs/` 管前端内部设计和执行（怎么做）

### 当前工程状态

- `apps/mobile-app/` 独立 Next.js 手机 App 前端工程已创建
- Batch 1 基础工程壳已完成
- Batch 2 Auth 页面已完成
- Batch 3A 今日首页 + 任务界面已完成并 push
- Batch 3B 任务执行界面已完成并 push
- Batch 4 足迹页已完成并 push
- 最新提交：`d52c88e3 feat: add mobile footprints view`
- 下一步：V3.0A Batch 5 成长页

### V3.0A 核心方向

在 `apps/mobile-app/` 下创建独立 Next.js 手机 App 前端工程，实现四 Tab 信息架构（今日/足迹/成长/我的），使用 mock service，验证成熟后再合并回主项目路由。

### 锁定原则

1. 新前端放在 `apps/mobile-app/`
2. 不直接改现有 `src/app/api`
3. 不直接改现有 Supabase / Auth / AI 逻辑
4. 不直接改 prompts
5. 前端先用 mock service
6. 页面组件不能直接写死数据
7. 先实现四 Tab App
8. 后续通过 service 层替换为真实后端
9. 390×844 是手机端主验收视口
10. 每一屏只做一件事，不能做成长网页

### Batch 5 注意事项

1. 成长页不能做成复杂数据看板
2. 不能做成 SaaS 报表
3. 不能做成焦虑型成长评分
4. 不要使用强紫色
5. 重点是温柔看见自己的变化
6. 保持暖米白、深蓝、纸张卡片、低压力风格
7. 必须使用 390×844 手机视口验收
8. 底部 Tab 固定为：今日 / 足迹 / 成长 / 我的
9. 成长页当前激活 Tab 为"成长"
10. 实现前必须先由 ChatGPT 整理 UI Spec，并由用户确认
11. Codex 不能直接自由发挥写代码

### 禁止操作

不允许修改 `src/`、根 `package.json`、API Route、Supabase、prompts、数据库 schema。不允许删除旧文档。
