# AI Todo Project State Handoff

> 状态：当前项目交接文档
> 用途：新会话 / Claude Code / Codex 接手项目时优先读取
> 更新日期：2026-07-19
> 当前状态：V3.0D 已正式完成并关闭；V3.1-A 前置只读审计与 Architecture 已完成并通过 ChatGPT Review；尚未创建 Execution Plan 或开始代码施工
> V3.1-A Architecture 文档提交：`bd9d27094dea383651292d2cfe494b939e2537fd` — `docs: finalize V3.1-A auth architecture`（已 Push）
> 最新功能代码基线：`9dcab1f4b20a3df3f7fce0d22ef99cfa21b7179b` — `fix: improve mobile task execution flow`
> 原则：只记录当前有效状态，不重复旧阶段完整 Architecture 或 Execution Plan

---

## 1. 产品定位

AI Todo 是**手机端优先的 AI 行动教练**，对外品牌为**清行**，不是普通 Todo List。

核心闭环：**目标 → AI 拆解 → 执行 → 记录 → 复盘 → 智能调整**。

核心价值是把模糊目标转化为今天能做的小任务，以低压力的方式帮助用户推进当前一步。

**明确不做**：复杂项目管理、团队协作、甘特图、OKR 系统、日历排期、社交分享、排行榜、会员系统、支付、聊天 Tab、全局聊天页、聊天气泡或消息历史。

### 产品与视觉锁定

- 手机端优先，主要验收宽度为 **375–430px**；390×844 是常用主验收视口。
- 四个底部 Tab 固定为：**今日 / 足迹 / 成长 / 我的**。
- 主流程只有一套 `AppShell` 与一套 `BottomTabBar`。
- 任务执行页保留 `BottomTabBar`；Auth 页面不显示 `BottomTabBar`。
- AI 输入只绑定当前任务，不建立全局聊天入口、会话历史或聊天 UI。
- 不把产品回退为普通 Todo checkbox 列表，也不演变为 SaaS 管理工具。
- 清行保持暖米白、深蓝、纸张感、温柔且低压力的手机 App 体验；避免强紫色主视觉。

## 2. 当前工程与协作边界

### 当前工程

- 手机 App 工程：`apps/mobile-app/`，独立 Next.js App Router 前端。
- 当前主流程仍采用前端 mock/service 边界；不得把 mock 与真实后端混为一谈。
- 不擅自修改 `src/**`、`apps/mobile-app/**`、API Route、Supabase、数据库、migration、prompts 或真实 Auth，除非当前已获 ChatGPT 审查通过的执行方案明确授权。
- 旧文档不得删除；历史详情按需从 `docs/archive/` 或既有阶段文档查阅。

### 角色分工与流程

```text
ChatGPT：阶段把关 / 产品判断 / 给 Claude Code 和 Codex 写指令
Claude Code：架构设计 / 执行方案 / Code Review / 最终验收
Codex：按已批准执行方案实现代码 / 小修 bug
用户：确认产品判断与视觉验收
```

标准流程：

```text
1. Claude Code 写 Architecture
2. ChatGPT 审查 Architecture
3. Claude Code 写 Execution Plan
4. ChatGPT 审查 Execution Plan
5. Codex 按批准方案施工
6. Claude Code Review
7. ChatGPT 最终把关
8. 获授权后才 Commit / Push
```

### 长期操作约束

- 不跳过 Review，不主动扩大 Phase 范围，不在当前 Phase 未关闭时开始下一 Phase。
- 不擅自提交；不得使用 `git add .`、`git add -A` 或 `git add -N`。
- 不处理长期未跟踪项，不删除或移动旧文档。
- 修改后按授权执行 lint、build、`git diff --check` 与 Git 范围核验。

## 3. 当前状态：V3.0D 正式完成

V3.0D 已完成、正式关闭。D1、D2、D3、D4 均已通过 Claude Code Review、ChatGPT 最终判断与用户最终组合验收。

- **P0 = 0**
- **P1 = 0**
- **D4 无代码提交**
- V3.0D 最终代码基线仍为 D3 提交：`9dcab1f4b20a3df3f7fce0d22ef99cfa21b7179b`

### 3.1 V3.0D 目标

V3.0D 完成手机 App 关键体验修正：

1. Welcome 从网页长页改为手机单屏欢迎页。
2. OTP 登录增加诚实的前端 Mock 双状态。
3. 任务总览移除旧后续任务嵌套小框。
4. 新增“今天的其他小步”独立二级页面。
5. 任务执行页从固定高度竞争改为自然纵向内容流。
6. 保留 Guide / Feedback 专注态、键盘和返回控制。

### 3.2 V3.0D-D1：Welcome + OTP Mock 双状态

**提交：**

```text
73a4e6c81498ccc985bba47518f850cac1edc83d
feat: refine mobile welcome and otp mock flow
```

**提交文件：**

- `apps/mobile-app/components/auth/WelcomePage.tsx`
- `apps/mobile-app/components/auth/OtpLoginPage.tsx`

**完成内容：**

- Welcome 只有“开始使用”一个主动作。
- 使用小径与嫩芽图标。
- 无第二登录入口。
- OTP 为 `email-entry / code-entry` 双状态。
- 一个逻辑 input 配合六个视觉格。
- 诚实 Mock 文案。
- 60 秒重新发送倒计时。
- `otp-code-entry / 65`。
- 无真实 Auth/service 调用。

### 3.3 V3.0D-D2：任务总览入口 + 独立行动清单二级页

**提交：**

```text
5f94d9ede282dc42a5cdd3907c37524e94791570
feat: add mobile action list view
```

**提交文件：**

- `apps/mobile-app/app/page.tsx`
- `apps/mobile-app/components/today/TaskListView.tsx`
- `apps/mobile-app/components/today/ActionListView.tsx`

**完成内容：**

- `TaskListView` 不再显示旧 `UpcomingTaskList` 小滚动框。
- 任务总览仅显示轻量入口：

  ```text
  后面还有 N 步
  看看今天的其他小步 →
  ```

- 新增独立页面“今天的其他小步”。
- 分组为：正在做 / 接下来 / 后面再做。
- 当前任务黄色，后续任务暖白。
- 任务卡为纯展示。
- `action-list / 85`。
- 返回链：`action-list → tasks → home`。

“独立二级页面”是独立 `todayMode` 状态页，不是新增路由；任务较多时允许自然纵向滚动。

### 3.4 V3.0D-D3：任务执行页自然内容流

**提交：**

```text
9dcab1f4b20a3df3f7fce0d22ef99cfa21b7179b
fix: improve mobile task execution flow
```

**提交文件：**

- `apps/mobile-app/components/today/ExecutionTaskCard.tsx`
- `apps/mobile-app/components/today/TaskExecutionView.tsx`

**完成内容：**

- `ExecutionTaskCard` 新增 `compact` 模式。
- compact 显示完整标题、第一条非空 detail、一次预计时长。
- default 执行页顺序：

  ```text
  header
  → compact task card
  → Guide
  → Feedback
  → 完成按钮
  ```

- default 页面整体自然纵向滚动。
- AI Guide 不再被压成薄条。
- 输入区和完成按钮可滚动到达。
- BottomTab 不遮挡完成按钮。
- `GuideCard`、`FeedbackBox`、textarea 保持单实例。
- `guide-focused / feedback-focused` 行为保持。
- `visualViewport` 键盘适配与草稿生命周期保持。
- `task-feedback-focus / 95`。
- `task-guide-focus / 94`。

### 3.5 V3.0D-D4：最终全量 Review 与组合验收

D4 没有代码提交。

**完成内容：**

- 核验 D1 / D2 / D3 提交范围。
- 全量检查 Welcome、OTP、任务总览、行动清单、任务执行页。
- 检查 AppShell、BottomTabBar、BackController。
- 检查各页面滚动所有权。
- 检查系统返回链。
- lint 通过。
- build 通过。
- TypeScript 通过。
- `git diff --check` 通过。
- P0 = 0。
- P1 = 0。
- 用户最终组合验收通过。

**最终结论：V3.0D 正式关闭。**

## 4. 当前返回链与 BackController

### 返回链

**OTP：**

```text
code-entry
→ email-entry
→ Welcome
```

**行动清单：**

```text
action-list
→ tasks
→ home
```

**任务执行：**

```text
feedback-focused
→ default
→ tasks
→ home

guide-focused
→ default
→ tasks
→ home
```

### 相关 Back Handler

- `task-feedback-focus / 95`
- `task-guide-focus / 94`
- `action-list / 85`
- `otp-code-entry / 65`
- `page-auth-flow / 60`
- `page-authenticated-root / 50`

不得在未获明确授权时改写 BackController 架构、增加第二个 `popstate/pageshow` 监听、在页面组件中调用 `history.back()` 或改用路由返回机制。

## 5. V3.0B / V3.0C 历史摘要

- **V3.0B：**已完成。完成任务执行陪伴反馈区、我的页二级页面、轻确认 Sheet 和一级入口动作闭环；保留单一 AppShell / BottomTabBar，且没有接入真实后端。
- **V3.0C：**已完成。完成移动端 hardening 相关的安全区、滚动、输入体验和确认 Sheet 精确滚动锁；其详细 Architecture、Execution Plan 与历史提交按需查阅，不再作为当前施工阶段。
- 当前有效阶段结论以本文件第 3 节的 V3.0D 正式关闭状态为准。

## 6. 已知非阻断警告

仅保留以下 P2：

1. `WelcomePage.tsx` 原生 `<img>` 的 Next.js ESLint 建议。
2. Next.js multiple lockfiles workspace-root 警告。
3. Windows LF / CRLF 行尾提示。

这些警告：

- 均不阻断当前阶段；
- 不属于 V3.0D 遗留 P0/P1；
- 未获单独授权时不得顺带处理。

## 7. 当前阶段：V3.1-A Architecture 已提交

V3.1-A 尚未开始代码施工，但前置只读审计与 Architecture 均已完成并通过 ChatGPT Review。Architecture 与现行产品文档已完成提交并 Push；本次提交未包含代码、配置、依赖或环境变量。

### 7.1 已完成状态

| 项目 | 状态 |
|---|---|
| V3.0D | 已正式完成并关闭。 |
| V3.1-A 前置只读审计 | 已完成并通过。 |
| V3.1-A Architecture | 已完成并通过 ChatGPT Review；已完成文档提交并 Push。 |
| Architecture Review | P0：0；P1：0；P2：3。 |
| Architecture 文档提交 | `bd9d27094dea383651292d2cfe494b939e2537fd` — 已 Push。 |
| Architecture 提交文件 | `docs/Architecture-V3.1-A-Mobile-Auth.md`、`docs/V3.1-A-Auth-Flow-Lock.md`、`docs/Roadmap-V3.0C-to-V3.3-Mobile-Production.md`。 |
| Architecture 提交范围 | 未包含代码、配置、依赖或环境变量。 |
| V3.1-A Execution Plan | 尚未创建。 |
| V3.1-A 代码施工 | 尚未开始。 |
| Codex | 未获得 V3.1-A 写代码授权。 |

### 7.2 非阻断 P2

1. A1.5 验证入口须在 Execution Plan 中唯一选择；
2. Mock adapter 最小内存 Session / `passwordSet` / local signOut；
3. 页面局部错误与 transient `AuthState.error` 清理。

这些 P2 不阻断 Architecture 通过，但必须由 Execution Plan 精确锁定，不能留给 Codex 自行决定。

### 7.3 当前边界

- 不允许创建 Execution Plan 之外的代码施工授权；本次仅完成现行文档同步。
- 不允许直接连接真实 Auth、API、Supabase 或数据库。
- 不允许直接删除 Mock service。
- 不允许直接修改现有页面视觉结构。
- 不允许安装 Supabase 依赖、设置环境变量、修改 package / lockfile、API Route、数据库或 migration。
- 不得宣称 Codex 已获授权、真实后端已接入，或 Auth / Supabase 已开始改造。

### 7.4 下一阶段

由 Claude Code 编写 **V3.1-A Execution Plan**，再经 ChatGPT 审查。只有 Execution Plan 获批并获得明确授权后，才可决定是否允许 Codex 开始代码施工。

V3.1-A 的当前权威 Architecture 是 [Architecture-V3.1-A-Mobile-Auth.md](Architecture-V3.1-A-Mobile-Auth.md)。其现行产品流程已同步至 [V3.1-A-Auth-Flow-Lock.md](V3.1-A-Auth-Flow-Lock.md) 与 [Roadmap-V3.0C-to-V3.3-Mobile-Production.md](Roadmap-V3.0C-to-V3.3-Mobile-Production.md)。

## 8. Git 基线与长期未跟踪项

### 当前 Git 基线

```text
ARCHITECTURE_COMMIT：bd9d27094dea383651292d2cfe494b939e2537fd
docs: finalize V3.1-A auth architecture
已 Push 至 origin/main

提交文件：
- docs/Architecture-V3.1-A-Mobile-Auth.md
- docs/V3.1-A-Auth-Flow-Lock.md
- docs/Roadmap-V3.0C-to-V3.3-Mobile-Production.md

ARCHITECTURE_COMMIT 是 V3.1-A 现行文档提交，不是功能代码基线。
```

### 最新功能代码基线

```text
9dcab1f4b20a3df3f7fce0d22ef99cfa21b7179b
fix: improve mobile task execution flow
```

D4 无代码提交，因此最新功能代码基线仍是 D3 提交。**不得将 Handoff 文档提交 HEAD 与最新功能代码基线混淆。**

### 长期未跟踪项

以下文件或目录长期存在于工作区，持续忽略且不得处理：

- `.agents/`
- `.claude/`
- `.codex/`
- `.vscode/`
- `skills-lock.json`
- `start`
- `stop`
- `test_photo.jpeg`

## 9. 新会话最小上下文

新会话优先读取：

1. `CLAUDE.md` — 项目规则。
2. `docs/Project-State-Handoff.md` — 本文档，当前状态。
3. `memory/MEMORY.md` — Memory 索引，并按需读取具体条目。
4. 当前获授权阶段的 Architecture / Execution Plan；未授权阶段不得默认加载或施工。

无需默认加载大量旧阶段文档；需要历史依据时再按需读取 `docs/archive/` 或既有阶段文档。
