# V3.0D 架构方案：手机端核心体验修正

> **状态：** Architecture 与 Execution Plan 已通过 ChatGPT 最终 Review；D1 代码施工需单独授权。
>
> **Git 基线：** `73d4a7d63a7fe51b6bb60ef46b8e3e97023fc0a6` — `feat: add mobile app install assets`
>
> **前置阶段：** V3.0C C1–C4 全部完成 ✅
>
> **产品输入：** ChatGPT 已确认 UI Spec（V3.0D），用户已确认
>
> **范围：** 欢迎页默认字号单屏优先、OTP Mock 双状态、任务总览重构、行动清单二级页面、任务执行 default 页面级内容流调整
>
> **不进入范围：** V3.1-A 真实认证、Service Worker、Capacitor、新路由、后端、数据库

---

## 1. 文档目的与阶段边界

### 1.1 目的

V3.0D 修正 V3.0C 真机验收中发现的五个核心体验问题：

1. 欢迎页像可滚动 Landing Page，不是 App Welcome Screen
2. 验证码登录缺少"发送验证码 → 输入 6 位验证码"的视觉步骤
3. 任务总览页"后面再做"区域被压缩至不可读
4. 缺少从任务总览查看完整行动清单的二级页面
5. 任务执行页 AI 输出区被压缩，默认态信息密度失衡

### 1.2 阶段边界

| 边界 | 归属 |
|------|------|
| V3.0D（本阶段） | 前端 UI/UX 修正，不修改 Mock service 逻辑 |
| V3.1-A | 真实认证流程接入（Supabase Auth、SMTP） |
| V3.2 | Capacitor / APK |
| 不属于任何阶段 | 新路由、第二套 AppShell、Chat UI |

---

## 2. 产品问题与真机验收发现

| # | 问题 | 真机表现 | 根因 |
|---|------|---------|------|
| 1 | 欢迎页可滚动 | 390×844 下内容超出，需上下滑动 | `min-h-screen` + 模拟任务大卡 + 功能列表撑高 |
| 2 | 验证码无第二状态 | 输入邮箱后直接"登录成功"，无验证码输入环节 | OtpLoginPage 只有 email-entry，缺少 code-entry 本地状态 |
| 3 | "后面再做"不可读 | 仅 140-180px 区域，多任务时被压缩 | UpcomingTaskList 在 TaskListView 中被 flex-1 分配剩余高度，与 CurrentTaskCard 竞争 |
| 4 | 缺少行动清单页 | 用户无法安心浏览全部任务 | 当前只有 TaskListView 一页，无二级清单 |
| 5 | AI 输出区偏小 | 默认态 Guide 仅 4 行预览，任务摘要占空间过多 | TaskExecutionView 默认态中 ExecutionTaskCard + Guide 预览 + FeedbackBox 三者争抢 flex 空间 |

---

## 3. 当前代码结构只读审计

### 3.1 渲染树（当前真实）

```text
Page (app/page.tsx)
└─ BackControllerProvider
   └─ HomeContent
      ├─ [guest] AuthShell
      │   ├─ authScreen="welcome" → WelcomePage
      │   ├─ authScreen="otp-login" → OtpLoginPage
      │   ├─ authScreen="password-login" → PasswordLoginPage
      │   └─ authScreen="register" → RegisterPage
      │
      └─ [authenticated] AppShell
         ├─ main > 内容包装层 (min-h-0 flex-1 overflow-hidden)
         │  ├─ activeTab="today"
         │  │   ├─ todayMode="home" → TodayHomeView
         │  │   ├─ todayMode="tasks" → TaskListView → CurrentTaskCard（条件）
         │  │   └─ todayMode="execution" → TaskExecutionView → ExecutionTaskCard
         │  ├─ activeTab="footprint" → FootprintsView
         │  ├─ activeTab="growth" → GrowthView
         │  └─ activeTab="me" → MeView
         └─ BottomTabBar (fixed bottom-0 z-20)
```

### 3.2 状态所有权（当前真实）

| 状态 | 所有者 | 值 |
|------|--------|-----|
| `authState` | HomeContent | `"guest"` \| `"authenticated"` |
| `authScreen` | HomeContent | `"welcome"` \| `"otp-login"` \| `"password-login"` \| `"register"` |
| `activeTab` | HomeContent | `"today"` \| `"footprint"` \| `"growth"` \| `"me"` |
| `todayMode` | HomeContent | `"home"` \| `"tasks"` \| `"execution"` |
| `todayState` | HomeContent | `TodayState \| null` |
| `executingTaskId` | HomeContent | `string \| null` |
| `executionPresentation` | TaskExecutionView | `"default"` \| `"guide-focused"` \| `"feedback-focused"` |
| `feedbackDraft` | TaskExecutionView | `string` |
| `keyboardInset` | TaskExecutionView | `number` |
| `footprintMode` | FootprintsView | `"empty"` \| `"list"` \| `"detail"` |
| `meMode` | MeView | `"home"` \| `"privacy"` \| `"feedback"` |
| `confirmMode` | MeView | `ConfirmMode \| null` |
| 验证码 Mock 状态 | 无（当前缺失） | — |

### 3.3 BackController Handler（当前真实）

| id | priority | 注册位置 | 生效条件 | 行为 |
|---|---|---|---|---|
| `me-confirm` | 100 | MeView | `isActive && confirmMode !== null` | 关闭 Sheet |
| `task-feedback-focus` | 95 | TaskExecutionView | `executionPresentation === "feedback-focused"` | 收起 → default |
| `task-guide-focus` | 94 | TaskExecutionView | `executionPresentation === "guide-focused"` | 收起 → default |
| `me-subpage` | 90 | MeView | `isActive && meMode !== "home"` | 回 me home |
| `footprint-detail` | 80 | FootprintsView | `isActive && footprintMode === "detail"` | 回 footprint list |
| `page-auth-flow` | 60 | page.tsx | `authState === "guest"` | authScreen 回退 |
| `page-authenticated-root` | 50 | page.tsx | `authState === "authenticated"` | Tab → todayMode 回退 |

### 3.4 滚动所有权（当前真实）

| 页面/组件 | 外层 | 内部滚动 | 问题 |
|-----------|------|---------|------|
| AppShell | `h-[100svh] overflow-hidden` | — | ✅ |
| AuthShell | `h-[100svh] overflow-hidden` | 内层 `overflow-y-auto` | WelcomePage 使用 `min-h-screen` 绕过约束 |
| WelcomePage | `min-h-screen` | 无限制 | ❌ 外层长页 |
| OtpLoginPage | `min-h-screen` | 依赖 AuthShell 滚动 | ⚠️ 需确保单屏优先 |
| TodayHomeView | `h-full overflow-hidden` | 无 | ✅ |
| TaskListView | `h-full overflow-hidden` | UpcomingTaskList `overflow-y-auto` | ❌ 后续任务区过小 |
| TaskExecutionView | `h-full overflow-hidden` | GuideCard/FeedbackBox 按 presentation 切换 | ⚠️ 默认态 AI 输出偏小 |
| MeView | `h-full overflow-hidden` | 列表 `overflow-y-auto` | ✅ |
| FootprintsView | `h-full overflow-hidden` | 列表 `overflow-y-auto` | ✅ |

---

## 4. 当前页面状态图

```
┌─────────────────────────────────────────────────────────────────────┐
│ guest                                                               │
│   ├─ welcome                                                        │
│   ├─ otp-login ────────────────── (无 code-entry 子状态)             │
│   ├─ password-login                                                 │
│   └─ register                                                       │
│                                                                     │
│ authenticated                                                       │
│   ├─ today                                                          │
│   │   ├─ todayMode="home" (TodayHomeView)                           │
│   │   ├─ todayMode="tasks" (TaskListView)                           │
│   │   └─ todayMode="execution" (TaskExecutionView)                  │
│   │       ├─ executionPresentation="default"                        │
│   │       ├─ executionPresentation="guide-focused"                  │
│   │       └─ executionPresentation="feedback-focused"               │
│   ├─ footprint                                                      │
│   │   ├─ footprintMode="list"                                       │
│   │   ├─ footprintMode="detail"                                     │
│   │   └─ footprintMode="empty"                                      │
│   ├─ growth                                                         │
│   └─ me                                                             │
│       ├─ meMode="home"                                              │
│       │   └─ confirmMode (Sheet overlay)                            │
│       ├─ meMode="privacy"                                           │
│       └─ meMode="feedback"                                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. 目标页面信息架构

V3.0D 目标状态图（新增/变更项标 ★）：

```
┌─────────────────────────────────────────────────────────────────────┐
│ guest                                                               │
│   ├─ welcome                      ★ 默认字号单屏优先；放大字号安全滚动                    │
│   ├─ otp-login                                                      │
│   │   ├─ otpStep="email-entry"    ★ 新增                            │
│   │   └─ otpStep="code-entry"     ★ 新增                            │
│   ├─ password-login                                                 │
│   └─ register                                                       │
│                                                                     │
│ authenticated                                                       │
│   ├─ today                                                          │
│   │   ├─ todayMode="home"                                           │
│   │   ├─ todayMode="tasks"         ★ 重构：移除后续任务列表           │
│   │   ├─ todayMode="action-list"   ★ 新增：行动清单二级页面           │
│   │   └─ todayMode="execution"     ★ 重构：default 页面级内容流调整     │
│   │       ├─ executionPresentation="default"                        │
│   │       ├─ executionPresentation="guide-focused"                  │
│   │       └─ executionPresentation="feedback-focused"               │
│   ├─ footprint                                                      │
│   ├─ growth                                                         │
│   └─ me                                                             │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.1 UI Spec 名称 ↔ 代码名称映射

| UI Spec 名称 | 代码标识 | 类型 |
|-------------|---------|------|
| 欢迎页 | `authScreen="welcome"` | 现有，修改 |
| 验证码登录（邮箱输入） | `otpStep="email-entry"` | ★ 新增子状态 |
| 验证码登录（验证码输入） | `otpStep="code-entry"` | ★ 新增子状态 |
| 密码登录 | `authScreen="password-login"` | 只读 |
| 注册 | `authScreen="register"` | 只读 |
| 今日首页 | `todayMode="home"` | 只读 |
| 任务总览 | `todayMode="tasks"` | 现有，重构 |
| 今日的其他小步 | `todayMode="action-list"` / `ActionListView` | ★ 新增；“行动清单二级页”仅作内部文档角色名称 |
| 任务执行（默认） | `executionPresentation="default"` | 现有，重构 |
| 任务执行（AI 专注） | `executionPresentation="guide-focused"` | 现有，保持 |
| 任务执行（输入专注） | `executionPresentation="feedback-focused"` | 现有，保持 |

---

## 6. Welcome 单屏架构

### 6.1 当前问题

[WelcomePage.tsx](../apps/mobile-app/components/auth/WelcomePage.tsx) 使用：

```tsx
<main className="min-h-screen bg-warm-bg px-6 py-7">
  <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-mobile flex-col">
```

`min-h-screen` + `min-h-[calc(100vh-3.5rem)]` 允许内容超出视口，形成长页。当前内容包含模拟任务展示大卡（PaperCard 含占位条、纸飞机图标、行动中标签），在 375×812 下两个按钮可能被挤出。

### 6.2 目标方案

Welcome 改为紧凑的 App Welcome Screen，默认系统字号优先在一屏完成主流程，并在系统放大字号或可访问性文字下允许 AuthShell 内容区安全纵向滚动；不裁切内容，也不以极小字号强行塞入一屏。

**锁定结构（与 ChatGPT 和用户确认一致）：**

```
AuthShell (h-[100svh] overflow-hidden)
└─ Welcome 内容（默认字号紧凑；必要时由 AuthShell 内容区纵向滚动）
   ├─ 顶部安全区
   ├─ "清行"
   ├─ 中间品牌区
   │   ├─ 主标题："今天，也从一小步开始"
   │   ├─ 手绘小径与嫩芽品牌视觉（主视觉）
   │   ├─ 品牌文案："慢一点，也在向前走。"
   │   └─ 说明："不用完整计划，先写下今天想推进的事。"
   ├─ 底部操作区
   │   └─ PrimaryButton "开始使用"
   └─ 底部安全区
```

**唯一主动作与登录/注册路径：**

- Welcome 只保留一个主按钮“开始使用”，调用既有 `onNavigate("otp-login")`。
- Welcome 不显示顶部登录按钮、旧第二登录 CTA、注册按钮、“了解更多”或任何第三入口。
- 新用户从验证码登录页的既有注册入口进入 RegisterPage；已有用户同样点击“开始使用”进入登录页。
- 不修改 WelcomePage 与 page.tsx 的现有回调接口。

**品牌视觉规则：**

- "今天，也从一小步开始"是唯一主标题。
- "慢一点，也在向前走。"是品牌鼓励文案，不替换主标题。
- 主要品牌视觉必须是手绘小径与嫩芽。
- 可复用 C4 已存在的清行图标资产作为只读展示来源。
- 不修改 C4 图标文件。
- 星星可作为轻量装饰，但不能替代小径与嫩芽主视觉。
- 纸飞机不能继续作为 Welcome 主品牌视觉。

**关键变更：**

- 删除模拟任务展示大卡（PaperCard 含占位条、行动中标签）。
- 删除功能列表、统计数据、"了解更多"等网页式内容。
- 外层使用紧凑 `h-full flex flex-col` 语义，不再使用 `min-h-screen`。
- 默认字号的 375×812 下，唯一主按钮“开始使用”完整可见；系统放大字号时允许 AuthShell 内容区安全滚动。

**WelcomePage 修改范围：**

- 删减中间模拟内容区。
- 外层容器改为紧凑 `h-full` 语义（从 AuthShell 继承高度约束）。
- 保留品牌标识（清行、小径与嫩芽主视觉）。
- 仅保留底部“开始使用”主按钮。

**不修改：**

- AuthShell 本身。
- WelcomePage 与 page.tsx 的接口（`onNavigate` prop）。

### 6.3 AuthShell 角色

AuthShell 当前已提供 `h-[100svh] overflow-hidden` + 内层 `overflow-y-auto`。Welcome 调整后：

- 默认系统字号优先呈现紧凑 Welcome，用户无需滚动即可看到“开始使用”。
- 系统放大字号或可访问性文字导致内容增高时，AuthShell 内层纵向滚动是必要且允许的安全兜底，确保标题、说明、主视觉和按钮均不被裁切。
- AuthShell 的 `bottomInsetHandledByChild` prop 保持现有语义。

---

## 7. OTP Mock 双状态架构

### 7.1 当前问题

[OtpLoginPage.tsx](../apps/mobile-app/components/auth/OtpLoginPage.tsx) 当前只有邮箱输入 → 直接调用 `loginWithOtp(email)` → `onLoginSuccess()`。用户看不到验证码输入步骤。

### 7.2 目标方案

OtpLoginPage 内部新增本地状态 `otpStep`，不修改 auth service：

```ts
type OtpStep = "email-entry" | "code-entry";
```

**状态与数据：**
- `otpStep: OtpStep` — 当前视觉状态
- `email: string` — 用户输入的邮箱，在两种状态间保留
- `verificationCode: string` — 6 位数字
- `isSending: boolean` — 发送中（Mock 延迟）
- `resendTimer: number` — 倒计时秒数

**email-entry 状态：**
```
AuthShell
└─ OtpLoginPage
   ├─ header: "清行" + 星星装饰
   ├─ 标题："继续今天的小步"
   ├─ 说明："收一封邮件，就可以继续今天的记录。"
   ├─ 登录方式 Tab：验证码登录 / 密码登录
   ├─ 邮箱输入框
   ├─ PrimaryButton "发送验证码"
   └─ footer: "第一次来？创建我的行动记录"（注册入口）
```

密码登录只能通过登录方式 Tab 进入；footer 不再显示第二个密码登录入口，也不新增文字链接形式的第三个密码登录入口。注册入口继续进入 RegisterPage；PasswordLoginPage、RegisterPage 与 page.tsx 均保持只读。

**code-entry 状态：**
```
AuthShell
└─ OtpLoginPage
   ├─ header: "清行" + 星星装饰
   ├─ 标题："继续输入验证码"
   ├─ Mock 诚实说明（温柔、低干扰）：
   │   "当前是前端体验流程，暂时不会发送真实邮件。
   │    输入任意 6 位数字即可继续体验。"
   ├─ 邮箱展示 + "演示邮箱" 标签
   ├─ 验证码输入：
   │   └─ 一个逻辑 input + 六个视觉数字格
   ├─ PrimaryButton "验证并进入清行"
   ├─ "重新发送（XX 秒）"
   └─ "更换邮箱"
```

### 7.3 Mock 行为

- **email-entry → code-entry：**
  点击"发送验证码"→ `isSending = true` → mock 极短视觉过渡 → `otpStep = "code-entry"` → 启动 60 秒倒计时
- **不调用真实 auth service：** 不调用 `loginWithOtp`，不调用任何 `authService.mock.ts` 中的发送相关函数
- **不显示"发送成功"：** 不声称真实邮件已发送
- **code-entry → authenticated：**
  `verificationCode` 未满 6 位时“验证并进入清行”保持 disabled，且不自动提交；完整 6 位数字时，用户点击按钮后再次以 `/^\d{6}$/` 检查、清除 `formError`，并**立即**调用现有 `onLoginSuccess()`。
- 不增加 `isVerifying`、验证按钮 loading、验证 mock delay、验证 timeout、成功提示、真实验证码校验或 service 调用。
- 不修改 `authService.mock.ts`
- 不接 Supabase、SMTP 或任何真实后端

### 7.4 Mock 诚实说明

code-entry 状态下的文案必须始终诚实：

**标题：** "继续输入验证码"

**Mock 说明（温柔、低干扰）：**
```
当前是前端体验流程，暂时不会发送真实邮件。
输入任意 6 位数字即可继续体验。
```

- 使用 `text-xs text-text-tertiary`
- 放在次要位置，不干扰主流程
- 不使用警告色、感叹号或醒目样式
- 真实认证接入后可独立移除

**邮箱展示规则：**
- 脱敏展示用户输入的邮箱
- 旁边明确标注 "演示邮箱"
- 不得声称"验证码已发送到"该邮箱

### 7.5 验证码输入形态

**强制锁定：** 一个逻辑 `<input>` + 六个视觉数字格（纯 CSS 实现）。

理由：
- 保持单一焦点，避免六个 input 自动跳转和删除行为复杂化
- 方便键盘与无障碍
- 不允许 Codex 自行选择另一套方案

要求：
- `inputMode` 为数字语义（`inputMode="numeric"`）
- `maxLength={6}`
- 只接受数字（`replace(/\D/g, "")`）
- code-entry 中只有一个稳定的验证码输入实例
- 不通过 key 强制重建
- email 输入框在 code-entry 时不保留 DOM（但 `email` 状态值保留）
- "更换邮箱"返回 email-entry 后恢复已输入的邮箱

### 7.6 倒计时与更换邮箱

- 倒计时：60 秒，从进入 code-entry 后开始
- 倒计时期间"重新发送"按钮显示剩余秒数并禁用
- 倒计时结束后可点击重新发送（重置计时器，再次进入 Mock 流程）
- "更换邮箱"→ `otpStep = "email-entry"`，恢复已输入的 email 值
- 倒计时在组件卸载或离开 code-entry 时清理

### 7.7 不修改的页面

- **PasswordLoginPage** — 保持只读
- **RegisterPage** — 保持只读

---

## 8. 任务总览页架构

### 8.1 当前问题

[TaskListView.tsx](../apps/mobile-app/components/today/TaskListView.tsx) 将所有内容堆在一个 `overflow-hidden` 页面内：

```
TaskListView (h-full overflow-hidden)
├─ header (shrink-0)
├─ TaskProgressCard (shrink-0)
├─ hint (shrink-0, 条件)
├─ CurrentTaskCard (条件)
├─ allCompleted 提示 (条件)
└─ UpcomingTaskList (flex min-h-0 flex-1)  ← 被挤压
```

`UpcomingTaskList` 使用 `flex min-h-0 flex-1`，在 CurrentTaskCard 占用 220-260px、TaskProgressCard 约 120-145px 后，剩余高度仅约 140-180px，多任务时严重压缩。

### 8.2 目标方案

将“后面再做”完整列表从任务总览中移除，改为轻量入口卡；TaskListView 仍以当前任务为视觉中心。

**新 TaskListView 结构：**

```text
TaskListView（页面内容区单一纵向滚动）
├─ header
│  ├─ “← 退出” / “任务执行”
│  ├─ “已经开始了，今天慢慢来”
│  └─ “不用看完整清单，先把眼前这一小步做好。”
├─ TaskProgressCard
│  ├─ “今天的小目标” + goal
│  └─ 进度条
├─ hint（条件）
├─ CurrentTaskCard（条件）
│  ├─ “先做这一件”
│  ├─ 任务标题 + 细节
│  ├─ “陪我做这一步”
│  └─ “我完成了”
├─ 今日的其他小步入口卡（条件）
│  ├─ “后面还有 N 步”
│  └─ “看看今天的其他小步 →”
└─ allCompleted 提示（条件）
```

**入口卡设计与显示条件：**

- 暖白纸张卡（`variant="white"`），视觉权重弱于 CurrentTaskCard。
- 只突出“后面还有 N 步”和“看看今天的其他小步 →”；不保留额外长段解释，也不保留旧入口箭头文案。
- N 来自后续任务数据（见 §9 数据分组规则）；N > 0 且未全部完成时显示，N = 0 或全部完成时隐藏。
- 点击 → `todayMode = "action-list"`；内部代码名仍为 ActionListView，用户界面名称见 §9。
- 不使用红点、数字徽章、checkbox 或设置列表式 chevron 行。

**滚动与内容规则：**

- 移除 UpcomingTaskList 后，不再让后续任务区以 `flex-1` 争抢空间。
- TaskListView 采用**页面内容区单一纵向滚动**，不强制 `overflow-hidden` 将内容锁死，也不为入口卡创建独立小滚动框。
- 默认 390×844 优先保持当前任务在前；375×812 或系统放大字号导致内容超出时，允许页面内容自然纵向滚动。
- 不裁切入口卡，不压缩 CurrentTaskCard，不通过固定高度预算塞入单屏；BottomTabBar 仍由 AppShell 唯一提供，内容底部留出其实际高度、safe area 与至少 16px。
- TaskListView 继续使用 CurrentTaskCard，不导入、不改用 ExecutionTaskCard；CurrentTaskCard 是唯一视觉中心。

---

## 9. 行动清单二级页面架构

### 9.1 页面定位与对外名称

“行动清单二级页”仅是内部文档角色名称。对用户的真实页面标题固定为**“今天的其他小步”**；页面仍是只读浏览页，让用户安心查看当前及后续小步，而不是任务管理器。

入口来自 TaskListView 的“后面还有 N 步 / 看看今天的其他小步 →”，内部状态和组件名保持 `todayMode="action-list"`、`ActionListView`。

### 9.2 状态所有权

`todayMode` 新增值 `"action-list"`，由 HomeContent (`page.tsx`) 唯一持有。

进入：TaskListView 中点击“看看今天的其他小步”→ `setTodayMode("action-list")`
退出：点击“回到任务”或系统返回 → `setTodayMode("tasks")`

### 9.3 数据分组规则（锁定）

以下规则基于项目真实的 `types/app.ts` 中的 `TaskStatus = "current" | "locked" | "completed"` 和 `TodayState.tasks` 数组。

**1. 当前任务（正在做）：**

复用 TaskListView 现有的 `currentTask` 解析方式：

```ts
const currentTask = todayState.tasks.find((task) => task.status === "current");
```

不创建第二套"当前任务"判断规则。

**2. 后续任务：**

保持 `todayState.tasks` 原始顺序，排除已完成的（`status === "completed"`）和当前任务（`status === "current"`）：

```ts
const upcomingTasks = todayState.tasks.filter(
  (task) => task.status !== "completed" && task.status !== "current"
);
```

**3. "接下来"（第一项后续）：**

后续任务中的第一项：

```ts
const nextTask = upcomingTasks[0]; // 仅当 upcomingTasks.length > 0
```

**4. "后面再做"（其余后续）：**

后续任务中除第一项以外的剩余项目：

```ts
const remainingTasks = upcomingTasks.slice(1); // 仅当 upcomingTasks.length > 1
```

**5. N（入口卡数字）：**

后续任务总数，不包含当前任务和已完成任务：

```ts
const N = upcomingTasks.length;
```

**6. 分组展示规则（统一锁定）：**

分组展示由 `currentTask` 是否存在和 `N` 的值共同决定。

**currentTask 存在时：**

| N | 正在做 | 接下来 | 后面再做 |
|---|:---:|:---:|:---:|
| N = 0 | ✅ | ❌ | ❌ |
| N = 1 | ✅ | ✅ | ❌ |
| N >= 2 | ✅ | ✅ | ✅ |

**currentTask 不存在时：**

| N | 正在做 | 接下来 | 后面再做 |
|---|:---:|:---:|:---:|
| N = 0 | ❌ | ❌ | ❌ |
| N = 1 | ❌ | ✅ | ❌ |
| N >= 2 | ❌ | ✅ | ✅ |

**固定规则：**

- "接下来"始终是 `upcomingTasks[0]`（N >= 1 时）
- "后面再做"始终是 `upcomingTasks.slice(1)`（N >= 2 时）
- 不自行把 locked 任务提升为 current
- 不修改 todayState
- 不补造 currentTask
- 不显示额外空状态卡
- 已完成任务不展示
- 保持 todayState.tasks 原始顺序
- **全部任务完成：** 保留当前 TaskListView 已有的 `allCompleted` 结果（`totalCount > 0 && completedCount === totalCount`），不显示行动清单入口，不进入 ActionListView

**7. 已完成任务：**

本阶段行动清单不展示已完成任务。已完成记录仍由足迹等既有页面负责。

### 9.4 组件：ActionListView

新建文件：`apps/mobile-app/components/today/ActionListView.tsx`

**Props：**
```ts
interface ActionListViewProps {
  todayState: TodayState;
  onBack: () => void;
}
```

**结构与滚动：**

```text
ActionListView
└─ 页面内容滚动区（单一 `overflow-y-auto overscroll-y-contain`）
   ├─ header
   │  ├─ “← 回到任务” / “今天的其他小步”
   │  └─ “不用一次看完，先把眼前这一小步做好。”
   ├─ TaskProgressCard
   │  └─ “今天的小目标” + goal
   ├─ “正在做” 分组（条件：currentTask 存在）
   │  └─ ActionListTaskCard（淡黄色、只读，无按钮）
   ├─ “接下来” 分组（条件：N >= 1）
   │  └─ ActionListTaskCard（暖白、只读，无按钮）
   └─ “后面再做” 分组（条件：N >= 2）
      └─ ActionListTaskCard × (N-1)（安静暖白、只读）

BottomTabBar（由 AppShell 唯一提供，固定）
```

**视觉规则：**
- 当前任务（正在做）：淡黄色纸张卡（`variant="yellow"`）。
- 后续任务：暖白卡 + 浅边框。
- 所有任务完整可读，不使用“禁用灰”让文字难以阅读。
- 无 checkbox、拖拽、排序、优先级、标签、截止日期、分类、批量操作。
- 无“新增任务”按钮、KPI、评分或百分比。

**滚动规则：**
- header、TaskProgressCard 和所有任务卡处于**同一页面内容滚动流**。
- 只设置一个页面级内容滚动区域；不把任务 list 单独设为狭小的 `overflow-y-auto`，不形成页面滚动套列表滚动。
- BottomTabBar 仍由 AppShell 唯一提供；滚动内容底部必须预留 BottomTabBar 实际高度 + safe area + 至少 16px，确保末项可达且不被遮挡。
- 不创建第二 AppShell 或第二 BottomTabBar。

### 9.5 任务卡方案（锁定）

**锁定方案：ActionListView 内部定义轻量 `ActionListTaskCard`**

不需要新增独立文件。`ActionListTaskCard` 作为 ActionListView 文件内的内部展示组件。

要求：
1. 复用 PaperCard
2. 不修改 CurrentTaskCard（CurrentTaskCard 保持只读）
3. 不增加独立的 `ActionListTaskCard.tsx` 文件
4. 不出现按钮
5. 不出现 checkbox
6. 不允许任务状态操作
7. 不允许提前开始后续任务
8. 当前任务卡为淡黄色（`variant="yellow"`）
9. 后续任务卡为暖白（`variant="white"`）
10. 保留完整标题和辅助说明（如预计时间）

最终建议新增文件严格只有：
- `apps/mobile-app/components/today/ActionListView.tsx`

---

## 10. 任务执行三状态架构

### 10.1 当前状态（C3 实现）

[TaskExecutionView.tsx](../apps/mobile-app/components/today/TaskExecutionView.tsx) 的三枚举架构**整体保留**：

```ts
type ExecutionPresentation = "default" | "guide-focused" | "feedback-focused";
```

当前组件显隐矩阵、DOM 稳定性（单实例 GuideCard / FeedbackBox / textarea）、Back Handler、visualViewport 逻辑和草稿规则**均正确，不做结构性改动**。

### 10.2 真机问题

1. **default 态 AI 输出区可读性不足**：任务摘要、Guide、反馈与完成动作在当前固定高度布局中会相互挤压；D3 的目标是改为页面级内容流，而非继续分配固定高度。
2. **guide-focused 态**：已经正确实现（保留既有 GuideCard 阅读滚动）。
3. **feedback-focused 态**：已经正确实现（保留 FeedbackBox 扩展与 visualViewport 键盘适配）。

### 10.3 目标方案：default 态内容流与页面级滚动

**目标 default 态结构：**

```text
TaskExecutionView default（页面内容区单一纵向滚动）
├─ header：顶部导航
│  └─ “陪你走这一步” + 副标题
├─ ExecutionTaskCard compact
├─ ExecutionGuideCard（独立 AI 指引卡）
│  └─ “展开查看完整建议”入口
├─ ExecutionFeedbackBox（独立输入区域）
└─ “我完成了这一小步”
```

**关键调整：**

- default 状态的当前任务摘要、AI 输出、用户输入与完成动作处于同一页面内容流，内容较长时由页面级纵向滚动承载。
- 不使用固定外层裁切内容，不为默认 AI 输出创建狭小内部滚动框，也不通过固定高度预算塞入单屏。
- AI Guide 是独立卡片，默认状态清晰可识别；不硬编码必须显示的行数，不用极小字号或 line clamp 强行适配，既有“展开查看完整建议”能力保留。
- FeedbackBox 是独立输入区域，保留既有组件规则和 300 字限制；不把其当前实现高度重新定义为产品固定高度，不修改 ExecutionFeedbackBox 文件。
- “我完成了这一小步”必须可通过页面滚动到达，且内容底部需预留 BottomTabBar 实际高度、safe area 与至少 16px。
- 不改变 GuideCard / FeedbackBox / textarea 单实例约束、C3 三状态、visualViewport 逻辑或 Back Handler。

### 10.4 ExecutionTaskCard compact 必须保留的信息

compact 模式必须保留：
1. **任务标题** — `task.title`，始终完整可读，允许按可用宽度自然换行；不使用 line clamp 裁切必要标题，也不删除标题。
2. **当前小步说明** — 从 `task.details` 中取得第一条非空字符串。存在时显示一次。不存在时该说明行不渲染。不使用预计时间代替。不自行生成新的任务说明文案。
3. **预计时间** — `task.estimatedMinutes` 存在时独立显示"约 X 分钟"。不存在时不显示。整张卡中最多显示一次预计时间。
4. **最低信息原则** — 必须保留：任务标题、可用的小步说明、可用的预计时间。但不得因某项数据不存在而重复预计时间、编造小步说明、显示空占位行或改写任务数据。

允许压缩：
- 装饰
- 重复标签（"现在这件事" / "正在做"，可合并为一个）
- 过大的上下留白
- 不必要的说明文字
- 细节列表展开（`details.slice(0, 2)` → 仅保留第一项）

**不得压缩为：只有“正在做”标签 + 一行标题。**

不写死固定高度；紧凑模式的判断是必要信息完整、内容不被裁切、可减少装饰/重复标签/过大留白，而不是达到某个像素区间。

**ExecutionTaskCard 紧凑化方案：**
- 为 ExecutionTaskCard 新增可选 `compact?: boolean` prop（默认 `false`）。
- `compact=true` 时保留任务标题、第一条非空小步说明（存在时）和单次预计时间（存在时）；不以时间代替 detail，不编造缺失内容。
- TaskExecutionView 是 V3.0D 中唯一明确使用 ExecutionTaskCard 的页面，并且始终传入 `compact={true}`。
- TaskListView 继续使用 CurrentTaskCard，不导入或改用 ExecutionTaskCard；CurrentTaskCard 保持只读。
- V3.0D 不新增其他 ExecutionTaskCard 使用位置，也不新增组件替换现有 CurrentTaskCard。

### 10.5 guide-focused 态（保持）

当前 C3 实现正确：
- ExecutionTaskCard 隐藏
- GuideCard `min-h-0 flex-1 overflow-hidden` + 内部 `overflow-y-auto`
- "写下现在的情况" 按钮可见
- FeedbackBox 视觉隐藏（实例保留）
- 完成按钮可见

### 10.6 feedback-focused 态（保持）

当前 C3 实现正确：
- ExecutionTaskCard 隐藏
- GuideCard 视觉隐藏（实例保留）
- FeedbackBox `flex min-h-0 flex-1 flex-col`
- visualViewport 120px 阈值
- 局部 `--task-feedback-keyboard-inset`
- rAF 聚焦逻辑
- 完成按钮可见

---

## 11. 页面状态所有权

| 页面/状态 | 唯一所有者 | 展示组件 | 返回行为 | 滚动所有者 | Bottom Tab | 内部滚动 |
|-----------|-----------|---------|---------|-----------|-----------|---------|
| Welcome | HomeContent (page.tsx) | WelcomePage | 不可返回（根） | AuthShell 内容区 | ❌ | 默认字号单屏优先；放大字号安全纵向滚动 |
| otp-email | OtpLoginPage 本地 | OtpLoginPage | Back → welcome | AuthShell 内容区 | ❌ | 页面内容区纵向滚动兜底 |
| otp-code | OtpLoginPage 本地 | OtpLoginPage | Back → otp-email (via otp-code-entry / 65) | AuthShell 内容区 | ❌ | 键盘时 AuthShell 兜底 |
| password-login | HomeContent (page.tsx) | PasswordLoginPage | Back → otp-login | AuthShell 内容区 | ❌ | 页面内容区纵向滚动兜底 |
| register | HomeContent (page.tsx) | RegisterPage | Back → otp-login | AuthShell 内容区 | ❌ | 键盘时 AuthShell 兜底 |
| today-home | HomeContent (page.tsx) | TodayHomeView | Back → 退出应用 | AppShell | ✅ | 既有行为不变 |
| task-overview | HomeContent (page.tsx) | TaskListView | Back → today-home | TaskListView 页面内容区 | ✅ | 单一纵向滚动；无嵌套小滚动框 |
| action-list ★ | HomeContent (page.tsx) | ActionListView（UI 标题“今天的其他小步”） | Back → task-overview (via action-list / 85) | ActionListView 页面内容区 | ✅ | 单一纵向滚动；header、进度、任务同流 |
| task-exec-default | TaskExecutionView | TaskExecutionView | Back → task-overview | TaskExecutionView 页面内容区 | ✅ | 单一纵向滚动；摘要、AI、输入、完成同流 |
| task-exec-guide | TaskExecutionView | TaskExecutionView | Back → task-exec-default | TaskExecutionView | ✅ | 保留既有 GuideCard 阅读滚动 |
| task-exec-feedback | TaskExecutionView | TaskExecutionView | Back → task-exec-default | TaskExecutionView | ✅ | 保留 FeedbackBox focused / visualViewport |
| footprint-list | FootprintsView | FootprintsView | Back → today | AppShell | ✅ | 列表 `overflow-y-auto` |
| footprint-detail | FootprintsView | FootprintDetailView | Back → footprint-list | AppShell | ✅ | 列表 `overflow-y-auto` |
| me-home | MeView | MeView | Back → today | AppShell | ✅ | 列表 `overflow-y-auto` |
| me-privacy | MeView | MePrivacyPage | Back → me-home | AppShell | ✅ | 内部 `overflow-y-auto` |
| me-feedback | MeView | MeFeedbackPage | Back → me-home | AppShell | ✅ | PaperCard 内部 `overflow-y-auto` |

---

## 12. BackController 与 History API 集成

### 12.1 现有 Handler（保留不变）

| id | priority | 注册位置 |
|---|---|---|
| `me-confirm` | 100 | MeView |
| `task-feedback-focus` | 95 | TaskExecutionView |
| `task-guide-focus` | 94 | TaskExecutionView |
| `me-subpage` | 90 | MeView |
| `footprint-detail` | 80 | FootprintsView |
| `page-auth-flow` | 60 | page.tsx |
| `page-authenticated-root` | 50 | page.tsx |

### 12.2 V3.0D 新增 Handler

| id | priority | 注册位置 | 生效条件 | 行为 |
|---|---|---|---|---|
| `action-list` ★ | 85 | page.tsx (HomeContent) | `authState === "authenticated" && activeTab === "today" && todayMode === "action-list"` | `setTodayMode("tasks")`, 返回 true |
| `otp-code-entry` ★ | 65 | OtpLoginPage | `otpStep === "code-entry"` | `setOtpStep("email-entry")`, 返回 true |

**priority 85（action-list）：** 介于 `me-subpage / 90` 和 `footprint-detail / 80` 之间。比 subpage handler 低、比 footprint-detail 高，不会劫持 Me 或 Footprints 的返回逻辑。

**priority 65（otp-code-entry）：** 高于 `page-auth-flow / 60` 但低于 `footprint-detail / 80`。OTP code-entry 是独立消费层级，不会被 auth-flow 抢先消费。用户按返回时先回到 email-entry（而非直接回 welcome）。

`otp-code-entry` 必须注册（不是"可选"），注册所有者为 OtpLoginPage。

### 12.3 更新 page-authenticated-root

`page-authenticated-root / 50` 需要知道 `action-list` 的存在，使返回链正确：

```
action-list → tasks → home
```

当前已处理 `todayMode === "execution"` → tasks → home。action-list 必须以独立分支同层处理，且不得清空 `executingTaskId`：

```ts
// page-authenticated-root 中
if (todayMode === "execution") {
  setExecutingTaskId(null);
  setTodayMode("tasks");
  return true;
}

if (todayMode === "action-list") {
  setTodayMode("tasks");
  return true;
}
```

### 12.4 完整返回栈优先级

```text
100 me-confirm
 95 task-feedback-focus
 94 task-guide-focus
 90 me-subpage
 85 action-list          ★ 新增
 80 footprint-detail
 65 otp-code-entry       ★ 新增（强制，非可选）
 60 page-auth-flow
 50 page-authenticated-root
```

### 12.5 返回链汇总

```
code-entry → email-entry → welcome (→ 退出)
action-list → task-overview → today-home (→ 退出)
guide-focused → task-exec-default → task-overview → today-home
feedback-focused → task-exec-default → task-overview → today-home
```

### 12.6 不修改

- WebHistoryGuard（唯一 popstate/pageshow 监听器）
- BackControllerContext 核心逻辑
- `createBackController()` 工厂
- History API 直接调用（不新增 `history.back()` / `router.back()` 散落调用）
- 禁止新增第二个 popstate 监听器

---

## 13. 页面级滚动、Safe Area 与可访问性文字

### 13.1 全局约束

```text
AppShell 外层：h-[100svh] + flex flex-col + overflow-hidden
  main：现有内容容器
    每个 V3.0D 页面：一个页面级内容纵向滚动区
      内容按自然顺序流动
  BottomTabBar：fixed bottom-0 z-20（由现有 AppShell 唯一提供）
```

V3.0D 不修改 AppShell、AuthShell、BottomTabBar 或全局 CSS；本阶段只在允许页面组件内让内容区拥有单一纵向滚动。禁止“固定外层 + 狭小中间 list 内滚”以及页面滚动套列表滚动。

### 13.2 页面规则

| 页面 | 默认系统字号 | 放大字号 / 内容变长 | 禁止 |
|---|---|---|---|
| Welcome | 紧凑单屏优先，375–430px 宽度下“开始使用”无需滚动可见 | AuthShell 内容区安全纵向滚动；标题、说明、主视觉、按钮均不得裁切 | 声称永远禁止滚动、极小字号硬塞、第二入口 |
| TaskListView | 390×844 优先当前任务在前，入口卡保持轻量 | 页面内容自然纵向滚动，不裁切入口卡或压缩 CurrentTaskCard | `overflow-hidden` 锁死内容、独立小滚动框、超出即停止 |
| ActionListView | header、进度与任务卡在同一页面内容流 | 同一个页面级滚动区承载全部内容 | 固定 header/进度 + 中间任务 list 独立滚动、嵌套滚动 |
| TaskExecutionView default | 摘要、AI、输入、完成动作均清晰可识别 | 页面内容自然纵向滚动，完成动作始终可到达 | 固定高度裁切、AI 默认内部小滚动框、硬编码行数/高度 |

### 13.3 内容尺寸原则

- ExecutionTaskCard compact 保留标题、第一条非空 detail（存在时）和单次 estimatedMinutes（存在时），可减少重复标签、装饰、过大留白和多余说明；不写死高度、不裁切必要内容、不以时间代替 detail、不编造内容。
- AI 输出为独立卡片；默认状态清晰可识别，较长内容由页面级滚动承载；不规定固定行数，不以 line clamp 或极小字号强行适配；guide-focused 保留既有展开和阅读能力。
- 用户输入为独立区域，默认状态可识别、可点击，保留既有 300 字限制与组件规则；不把当前高度定义为产品固定高度，不修改 ExecutionFeedbackBox；feedback-focused 保留既有扩展行为。
- “我完成了这一小步”不要求在所有字号下与全部内容同时露出，但必须能通过页面滚动到达，且不被 BottomTabBar 遮挡。

### 13.4 Safe Area

- 维持 C1 的全局 CSS 变量：`--safe-area-top/right/bottom/left`。
- AppShell 和 AuthShell 的 safe-area 逻辑不变，BottomTabBar 的 `pb-safe-bottom` 不变。
- V3.0D 的页面内容底部保留 BottomTabBar 实际高度 + safe area + 至少 16px；新页面通过现有 AppShell/AuthShell 继承 safe area。
- V3.0D 不修改 `globals.css` 中的 safe-area 变量。

---

## 14. 键盘与 visualViewport 兼容

### 14.1 现有逻辑（保留）

TaskExecutionView 的 visualViewport 逻辑（`startViewportTracking`、120px 阈值、局部 `--task-feedback-keyboard-inset`、rAF 聚焦）**不做任何修改**。该逻辑已经过 C3 Code Review 和真机验证。

### 14.2 OTP 键盘处理

OTP code-entry 状态下：
- 验证码输入聚焦 → 键盘弹出
- 由于 AuthShell 已提供 `overflow-y-auto`，浏览器原生聚焦滚动可将输入框和按钮带入视野
- 不需要为 OtpLoginPage 添加独立的 visualViewport 监听
- AuthShell.tsx 在 V3.0D D1 中严格只读；OTP 优先依赖其既有滚动能力与浏览器原生聚焦滚动。
- 若仍发现键盘遮挡且必须修改 AuthShell：立即停止 D1，记录设备、视口、键盘状态与复现步骤，只向 ChatGPT 汇报；不得自行修改 AuthShell，由 ChatGPT 决定是否建立独立修复批次与新文件范围。

### 14.3 不适用场景

- Welcome 页：无输入框，键盘不出现
- TaskListView：无输入框，键盘不出现
- ActionListView：无输入框，键盘不出现

---

## 15. 组件复用和新增组件边界

### 15.1 现有可复用组件（不改）

| 组件 | 文件 | 用途 |
|------|------|------|
| AppShell | `components/shell/AppShell.tsx` | 已登录壳 |
| AuthShell | `components/auth/AuthShell.tsx` | Auth 壳 |
| BottomTabBar | `components/shell/BottomTabBar.tsx` | 底部导航 |
| PaperCard | `components/ui/PaperCard.tsx` | 纸张卡片 |
| PrimaryButton | `components/ui/PrimaryButton.tsx` | 主按钮 |
| SecondaryButton | `components/ui/SecondaryButton.tsx` | 次按钮 |
| TextInput | `components/ui/TextInput.tsx` | 输入框 |
| TaskProgressCard | `components/today/TaskProgressCard.tsx` | 目标与进度 |
| CurrentTaskCard | `components/today/CurrentTaskCard.tsx` | TaskListView 的当前任务卡；只读 |
| ExecutionTaskCard | `components/today/ExecutionTaskCard.tsx` | TaskExecutionView 的执行页任务卡；V3.0D 仅由该页面传入 `compact={true}` |
| ExecutionGuideCard | `components/today/ExecutionGuideCard.tsx` | AI 指引卡 |
| ExecutionFeedbackBox | `components/today/ExecutionFeedbackBox.tsx` | 反馈输入 |
| BackControllerContext | `contexts/BackControllerContext.tsx` | 返回栈 |
| 所有 icons | `components/icons/` | 手绘图标 |
| 所有 services | `services/` | Mock 数据 |

### 15.2 建议新增组件

| 组件 | 文件（建议路径） | 职责 |
|------|------|------|
| ActionListView ★ | `components/today/ActionListView.tsx` | 行动清单二级页面（含内部 ActionListTaskCard） |

### 15.3 建议修改组件

| 组件 | 文件 | 修改内容 |
|------|------|---------|
| WelcomePage | `components/auth/WelcomePage.tsx` | 删除模拟内容、改为单屏布局、锁定品牌视觉 |
| OtpLoginPage | `components/auth/OtpLoginPage.tsx` | 新增 otpStep 双状态、Mock 验证码流程、注册 otp-code-entry / 65 |
| TaskListView | `components/today/TaskListView.tsx` | 移除 UpcomingTaskList、新增行动清单入口卡 |
| TaskExecutionView | `components/today/TaskExecutionView.tsx` | ExecutionTaskCard 传 `compact`、default 页面级内容流调整 |
| ExecutionTaskCard | `components/today/ExecutionTaskCard.tsx` | 新增 `compact?: boolean` prop |
| page.tsx | `app/page.tsx` | 新增 `todayMode="action-list"`、注册 `action-list` / 85、更新 `page-authenticated-root` |

### 15.4 必须只读组件

| 组件 | 原因 |
|------|------|
| PasswordLoginPage | 不属于 V3.0D 范围 |
| RegisterPage | 不属于 V3.0D 范围 |
| CurrentTaskCard | 不修改（ActionListView 内部使用独立 ActionListTaskCard） |
| TodayHomeView | 现有实现满足 UI Spec |
| AppShell | 不修改壳 |
| AuthShell | 不修改壳 |
| BottomTabBar | 不修改 Tab |
| BackControllerContext | 不修改核心返回逻辑 |
| WebHistoryGuard | 不修改 History 监听 |
| ExecutionFeedbackBox | C3 实现已通过 Review |
| ExecutionGuideCard | C3 实现已通过 Review |
| 所有 services | 不修改 Mock 数据 |
| 所有 types | 不修改类型定义 |
| globals.css | 不修改全局样式 |
| tailwind.config.ts | 不修改配置 |
| package.json / next.config.ts | 不修改工程配置 |
| manifest.ts / 图标 | C4 资产，保持不变 |

---

## 16. 状态与数据流

### 16.1 数据流不变

```
Mock Service → page.tsx → props → 页面组件 → props → 子组件
```

V3.0D 不修改：
- Mock service 函数签名
- 数据获取方式
- types 定义
- 组件间 props 传递方向

### 16.2 新增/变更的状态

| 状态 | 所有者 | 类型 | 初始值 |
|------|--------|------|--------|
| `otpStep` ★ | OtpLoginPage | `"email-entry" \| "code-entry"` | `"email-entry"` |
| `todayMode` | HomeContent | 新增 `"action-list"` | — |
| `executionPresentation` | TaskExecutionView | 不变 | `"default"` |

### 16.3 状态不提升

- `otpStep` 保持在 OtpLoginPage 本地，不提升到 page.tsx
- `todayMode="action-list"` 由 page.tsx 管理（与 `"home"` / `"tasks"` / `"execution"` 同级）
- ActionListView 不拥有页面状态（纯展示组件）

---

## 17. 可能涉及的文件范围

### 17.1 必然修改

1. `apps/mobile-app/app/page.tsx` — 新增 `todayMode="action-list"` + `action-list` Back Handler + 更新 `page-authenticated-root`
2. `apps/mobile-app/components/auth/WelcomePage.tsx` — 单屏改造、品牌视觉锁定
3. `apps/mobile-app/components/auth/OtpLoginPage.tsx` — OTP 双状态、验证码输入、`otp-code-entry` Back Handler
4. `apps/mobile-app/components/today/TaskListView.tsx` — 移除 UpcomingTaskList、新增入口卡；继续使用只读 CurrentTaskCard，不导入或改用 ExecutionTaskCard
5. `apps/mobile-app/components/today/TaskExecutionView.tsx` — default 页面级内容流调整；V3.0D 唯一明确传入 `ExecutionTaskCard compact={true}` 的页面
6. `apps/mobile-app/components/today/ExecutionTaskCard.tsx` — 新增 `compact?: boolean` prop（默认 `false`）

### 17.2 建议新增

7. `apps/mobile-app/components/today/ActionListView.tsx` — 行动清单二级页面（含内部 ActionListTaskCard）

### 17.3 明确排除的代码文件

`apps/mobile-app/components/today/UpcomingTaskList.tsx` 不在本轮施工范围内。

1. 不修改。
2. 不删除。
3. 不归档。
4. 不重命名。
5. 不移动。
6. 仅允许 TaskListView 停止引用该组件。
7. 是否成为暂时未引用文件不属于 V3.0D 清理范围。

### 17.4 必须只读

- 所有 `services/`、`types/`、`components/shell/`、`components/ui/`、`components/icons/`、`contexts/`
- `components/auth/PasswordLoginPage.tsx`、`RegisterPage.tsx`、`AuthShell.tsx`
- `components/today/TodayHomeView.tsx`、`CurrentTaskCard.tsx`、`GoalInputCard.tsx`、`ReadyCard.tsx`
- `components/today/ExecutionFeedbackBox.tsx`、`ExecutionGuideCard.tsx`
- `app/globals.css`、`app/layout.tsx`、`app/manifest.ts`
- `package.json`、`next.config.ts`、`tailwind.config.ts`
- 所有 `public/` 资产

### 17.5 禁止触碰

- `src/**`
- API Route
- Supabase
- 数据库
- migration
- prompts
- C4 Manifest / 图标

---

## 18. 明确只读和禁止文件

### 18.1 绝对禁止修改

```text
src/**
apps/mobile-app/services/**
apps/mobile-app/types/**
apps/mobile-app/mockData/**
apps/mobile-app/components/shell/AppShell.tsx
apps/mobile-app/components/shell/BottomTabBar.tsx
apps/mobile-app/components/auth/AuthShell.tsx
apps/mobile-app/components/auth/PasswordLoginPage.tsx
apps/mobile-app/components/auth/RegisterPage.tsx
apps/mobile-app/components/today/CurrentTaskCard.tsx
apps/mobile-app/components/today/UpcomingTaskList.tsx
apps/mobile-app/components/today/ExecutionFeedbackBox.tsx
apps/mobile-app/components/today/ExecutionGuideCard.tsx
apps/mobile-app/components/ui/**
apps/mobile-app/components/icons/**
apps/mobile-app/contexts/BackControllerContext.tsx
apps/mobile-app/app/globals.css
apps/mobile-app/app/layout.tsx
apps/mobile-app/app/manifest.ts
apps/mobile-app/public/**
apps/mobile-app/package.json
apps/mobile-app/next.config.ts
apps/mobile-app/tailwind.config.ts
根 package.json
根配置
```

---

## 19. 实施批次建议

### D1：Welcome 默认字号单屏优先 + OTP Mock 双状态

**目标：** 删除 welcome 长页与冗余入口，默认字号呈现紧凑 Welcome；放大字号时安全滚动；新增 OTP 验证码视觉流程。

**依赖：** 无（独立于 Today 页面）。

**精确文件范围：**
- `WelcomePage.tsx`（删减模拟内容，仅保留“开始使用”，默认字号单屏优先、放大字号安全滚动，锁定品牌视觉）
- `OtpLoginPage.tsx`（新增 otpStep、email-entry / code-entry、验证码输入形态、Mock 诚实说明、注册 `otp-code-entry` / 65）

D1 必须包含 `otp-code-entry / 65` Back Handler 的注册，但不得修改 `BackControllerContext.tsx`。

**禁止混入：** TaskListView、TaskExecutionView、ActionListView、page.tsx、ExecutionTaskCard。

**独立验收条件：**
- 默认字号 375×812 下唯一“开始使用”完整可见；放大字号可安全纵向滚动且无裁切
- 主标题：“今天，也从一小步开始”
- 品牌文案：“慢一点，也在向前走。”
- Welcome 无旧第二登录 CTA、顶部登录或其他第二/第三入口
- 无模拟任务展示大卡
- 品牌感保留（清行、小径与嫩芽主视觉）
- OTP email-entry → 点击“发送验证码” → code-entry（不显示“发送成功”）
- code-entry 标题为“继续输入验证码”
- Mock 诚实说明：“当前是前端体验流程，暂时不会发送真实邮件。输入任意 6 位数字即可继续体验。”
- 邮箱旁显示“演示邮箱”
- 验证码输入：一个逻辑 input + 六个视觉数字格
- 6 位输入完成后“验证并进入清行”可用 → 点击进入 authenticated
- 返回键从 code-entry 回 email-entry（通过 `otp-code-entry / 65`）
- lint / build / TypeScript 通过

### D2：任务总览重构 + 行动清单二级页面

**目标：** 重构任务总览（移除压缩的后续任务列表）+ 新增内部称为“行动清单二级页”、对外标题为“今天的其他小步”的只读页面。

**依赖：** D1 完成（不强制，但建议串行）。

**精确文件范围：**
- `TaskListView.tsx`（移除 UpcomingTaskList、新增“后面还有 N 步 / 看看今天的其他小步 →”入口卡）
- `ActionListView.tsx`（新增，含内部 ActionListTaskCard）
- `page.tsx`（新增 todayMode="action-list"、`action-list` / 85 Back Handler、更新 `page-authenticated-root`）

D2 完成：
- `todayMode="action-list"` 状态
- `action-list / 85` Back Handler
- `page-authenticated-root` 两个独立返回分支
- 行动清单数据分组规则（基于真实 TaskStatus 和 todayState.tasks）

**禁止混入：** TaskExecutionView、WelcomePage、OtpLoginPage、ExecutionTaskCard。

**独立验收条件：**
- TaskListView 任务总览不再有压缩的“后面再做”区域
- 入口卡只显示“后面还有 N 步 / 看看今天的其他小步 →”，N 来自真实数据；N=0 时不显示
- 点击入口卡 → 进入 ActionListView，UI 标题为“今天的其他小步”
- ActionListView 分组按数据规则展示：
  - currentTask 存在，N = 1：显示“正在做”和“接下来”，隐藏“后面再做”
  - currentTask 不存在，N = 1：隐藏“正在做”，显示“接下来”，隐藏“后面再做”
  - currentTask 存在，N >= 2：显示“正在做”、“接下来”和“后面再做”
  - currentTask 不存在，N >= 2：隐藏“正在做”，显示“接下来”和“后面再做”
  - 固定规则：不补造 currentTask；不提升 locked；不修改 todayState；不显示额外空状态卡；“接下来”始终使用 `upcomingTasks[0]`；“后面再做”始终使用 `upcomingTasks.slice(1)`
  - 全部完成：不显示入口卡，不进入 ActionListView
- 页面内容单一纵向滚动，header、进度和任务同一内容流，无嵌套列表滚动，末项不被 BottomTabBar 遮挡
- 返回键从 action-list → task-overview → today-home
- lint / build / TypeScript 通过

### D3：任务执行 default 页面级内容流调整与三状态保持

**目标：** default 态改为页面级纵向内容流 + ExecutionTaskCard compact 模式；不以 flex-1 高度竞争作为目标，不改变 C3 三状态。

**依赖：** D2 完成（共用 TaskExecutionView / ExecutionTaskCard）。

**精确文件范围：**
- `TaskExecutionView.tsx`（default 态使用页面内容单一滚动；V3.0D 唯一明确传入 `ExecutionTaskCard compact={true}` 的页面）
- `ExecutionTaskCard.tsx`（新增 `compact?: boolean` prop，默认 `false`；保留标题 + 小步说明 + 预计时间）

**禁止混入：** ActionListView、WelcomePage、OtpLoginPage、services。

**独立验收条件：**
- default 态当前任务摘要、AI 输出、用户输入、完成动作处于同一页面内容流
- ExecutionTaskCard compact 保留：任务标题 + 第一条非空小步说明（存在时）+ 预计时间（存在时），不写死高度
- compact 禁止压缩为仅标签 + 一行标题
- guide-focused 和 feedback-focused 行为不变
- textarea 单实例、单 DOM，不用 key 重建
- 三状态切换草稿不丢失
- visualViewport 120px 阈值正常
- Back Handler `task-feedback-focus / 95` 和 `task-guide-focus / 94` 不变
- 默认字号下摘要、AI、输入清楚可识别，完成动作可达；放大字号自然滚动、无裁切/横向滚动/默认 AI 小滚动框
- lint / build / TypeScript 通过

### D4：整体返回栈整合与真机验收

**目标：** 整合 D1-D3 的 Back Handler，全链路真机验收

**依赖：** D1 + D2 + D3 全部完成

**精确文件范围：** D4 默认不得修改代码。仅做整体 Review 和真机验收。

**如果 D4 发现代码问题：**
- 停止验收
- 单独报告 ChatGPT
- 由 ChatGPT 重新限定修复文件
- 不允许以"最小调整"为名自行修改代码

**独立验收条件：**
- 完整返回链逐层验证
- Android Chrome + iOS Safari（设备可用时）
- 375×812、390×844、430×932 三档视口
- 键盘弹出/收起各页面
- 无双重 AppShell、无聊天化、无 Todo 化

---

## 20. 风险矩阵与回退策略

### 20.1 风险

| 级别 | 风险 | 缓解 / 阻断条件 |
|------|------|---------------|
| P0 | TaskExecutionView default 内容流调整破坏现有三状态互斥 | DOM 稳定性守则不变；Review 逐状态核验 |
| P0 | page-authenticated-root 新增 action-list 分支导致返回跳过 tasks | Back Handler 优先级表 Review 必查 |
| P0 | ActionListView 形成嵌套滚动或内容被 BottomTab 遮挡 | 单一页面内容滚动区；header、进度、任务同流；底部预留 Tab 实际高度 + safe area + 16px |
| P0 | OtpLoginPage 双状态重挂载输入导致键盘丢失 | code-entry 输入是新增实例，email 输入在 code-entry 不保留 DOM；切换回 email-entry 恢复 email 值 |
| P0 | OTP 被误实现为真实认证、虚假“发送成功”或延迟验证成功 | email-entry 仅有约 250ms 视觉过渡；完整六码点击后立即 onLoginSuccess；无 service/验证 delay/loading/timeout |
| P0 | otp-code-entry / 65 未注册导致 code-entry 返回直接回 welcome | Review 强制检查 OtpLoginPage 注册 otp-code-entry |
| P1 | ExecutionTaskCard compact prop 被 TaskListView 误用 | compact 默认 false，TaskListView 不传此 prop |
| P1 | OTP code-entry Back Handler cleanup 失败导致残留 | 精确 priority 区间 + 对称 cleanup 验证 |
| P1 | Welcome 默认字号或放大字号下内容溢出/裁切 | 默认字号紧凑、唯一按钮可见；放大字号允许 AuthShell 安全滚动，不用极小字号 |
| P1 | OTP 键盘在只读 AuthShell 下仍遮挡控件 | 优先现有 AuthShell 滚动、浏览器聚焦滚动、OtpLoginPage 范围内调整；仍需改 AuthShell 时停止 D1、记录复现并报告 ChatGPT，另立批次 |
| P1 | ActionListView 任务卡与 Todo List 趋同 | 禁止 checkbox + 删除线 + 批量操作；Review 检查 |
| P1 | ActionListView 数据分组与 TaskListView currentTask 判断不一致 | 复用相同过滤逻辑；Review 检查 |
| P2 | 既有多 lockfiles 警告 | 仅记录 |
| P2 | LF/CRLF 警告 | 仅记录 |

### 20.2 回退策略

每个 D 批次独立提交，回退不影响其他批次：

- D1 回退：恢复 WelcomePage 和 OtpLoginPage 到 C4 基线版本
- D2 回退：恢复 TaskListView 和 page.tsx 到 D1 版本，删除 ActionListView
- D3 回退：恢复 TaskExecutionView 和 ExecutionTaskCard 到 D2 版本
- 不跨批次回退

---

## 21. Code Review 核心检查点

1. Welcome：默认字号紧凑、无 `min-h-screen`、唯一“开始使用”在 375×812 可见；放大字号允许 AuthShell 安全纵向滚动；主标题“今天，也从一小步开始”；品牌文案“慢一点，也在向前走。”；顶部只显示“清行”，无登录/注册/第三入口。
2. OTP：`otpStep` 本地状态；email-entry 仅有登录方式 Tab 作为密码登录入口和 footer 注册入口“第一次来？创建我的行动记录”，无重复密码链接；code-entry 标题“继续输入验证码”、“演示邮箱”与诚实 Mock 说明存在。
3. OTP 验证码：一个逻辑 input + 六个视觉数字格、`inputMode="numeric"`、`maxLength={6}`；完整六位后仅用户点击才再次校验并立即 `onLoginSuccess()`，无 isVerifying/loading/验证 delay/timeout/自动提交/service。
4. OTP Back Handler：`otp-code-entry / 65` 已注册、仅在 `otpStep === "code-entry"` 时消费。
5. TaskListView：无 UpcomingTaskList、入口卡 N 值来自 `upcomingTasks.length`、N=0 时隐藏；入口 UI 仅为“后面还有 N 步 / 看看今天的其他小步 →”。
6. ActionListView：真实 UI 标题“今天的其他小步”，页面内容区单一纵向滚动，header/进度/任务同流，无中间独立 `overflow-y-auto` 列表；内部 ActionListTaskCard 无按钮/checkbox。
7. ActionListView 数据分组：按 currentTask 存在/不存在 + N 值双条件判断（统一锁定表）；N=1 与 N>=2 的四种组合均符合 §9 固定规则；后续任务排除 completed 和 current。
8. 任务卡关系：TaskListView 继续使用只读 CurrentTaskCard，不导入或改用 ExecutionTaskCard；TaskExecutionView 是 V3.0D 唯一明确使用 ExecutionTaskCard 的页面，始终传 `compact={true}`；不新增其他使用位置。
9. TaskExecutionView：三枚举互斥、DOM 稳定；default 内容区单一纵向滚动，摘要/AI/输入/完成同流；compact 完整显示标题并允许自然换行，保留第一条非空小步说明与单次预计时间，但不以固定高度、line clamp 或裁切换紧凑。
10. BackController：`action-list / 85` 已注册、`otp-code-entry / 65` 已注册、page-authenticated-root 使用 execution / action-list 两个独立分支、优先级顺序正确。
11. 无 AppShell/BottomTabBar/globals.css/package.json 修改。
12. 无 services/types/CurrentTaskCard/ExecutionFeedbackBox/ExecutionGuideCard 修改。
13. lint / build / TypeScript 通过。

---

## 22. 用户真机验收标准

### 22.1 D1 验收

- [ ] Welcome 默认字号紧凑，375×812 下唯一“开始使用”完整可见；放大字号时 AuthShell 内容区安全纵向滚动，无裁切、无横向滚动
- [ ] 主标题：“今天，也从一小步开始”
- [ ] 品牌文案：“慢一点，也在向前走。”
- [ ] 无模拟任务展示大卡
- [ ] 品牌感保留（清行、小径与嫩芽主视觉）
- [ ] 顶部只显示“清行”，无登录按钮；Welcome 无旧第二登录 CTA、注册按钮、“了解更多”或第三入口
- [ ] OTP email-entry 只显示清行品牌、页面标题与说明、登录方式 Tab、邮箱输入、“发送验证码”和 footer 注册入口“第一次来？创建我的行动记录”；密码登录仅通过 Tab 进入，footer 不显示第二个密码登录入口。
- [ ] code-entry 标题为“继续输入验证码”；无登录方式 Tab、密码入口、注册入口、原邮箱输入或第三入口。
- [ ] Mock 诚实说明：“当前是前端体验流程，暂时不会发送真实邮件。输入任意 6 位数字即可继续体验。”
- [ ] 邮箱旁显示“演示邮箱”
- [ ] 验证码输入为一个逻辑 input + 六个视觉数字格
- [ ] “重新发送”有倒计时
- [ ] “更换邮箱”回到 email-entry 并恢复邮箱
- [ ] 未满 6 位保持 disabled、无自动提交；完整 6 位后点击“验证并进入清行”再次检查 `/^\d{6}$/`、清 `formError` 并立即进入 authenticated；无验证 loading/delay/timeout/成功提示/service 调用。
- [ ] 返回键从 code-entry 回 email-entry（通过 `otp-code-entry / 65`）

### 22.2 D2 验收

- [ ] 任务总览不再有压缩的“后面再做”长列表
- [ ] 入口卡只显示“后面还有 N 步 / 看看今天的其他小步 →”，N 来自真实数据
- [ ] N = 0 时不显示入口卡
- [ ] 点击入口 → ActionListView，真实 UI 标题为“今天的其他小步”
- [ ] ActionListView 分组按统一锁定表展示（currentTask 存在/不存在 + N 值双条件）；每个分组仅有分组标题和锁定的 ActionListTaskCard / 卡片列表，无分组尾注文案、空状态说明、临时文案或额外分支文案逻辑。
- [ ] currentTask 存在且 N=1：显示“正在做”+“接下来”，隐藏“后面再做”
- [ ] currentTask 不存在且 N=1：不显示“正在做”，显示“接下来”，隐藏“后面再做”
- [ ] currentTask 存在且 N>=2：显示“正在做”+“接下来”+“后面再做”
- [ ] currentTask 不存在且 N>=2：不显示“正在做”，显示“接下来”+“后面再做”
- [ ] 不补造 currentTask、不提升 locked、不修改 todayState、不显示额外空状态卡；“接下来”使用 `upcomingTasks[0]`，“后面再做”使用 `upcomingTasks.slice(1)`
- [ ] 当前任务使用黄色卡
- [ ] 后续任务使用暖白卡
- [ ] 无 checkbox、按钮、任务状态操作
- [ ] 页面内容单一纵向滚动；header、TaskProgressCard、任务卡同一流；无嵌套小滚动框；末项不被 BottomTabBar 遮挡
- [ ] 返回键：action-list → task-overview → today-home

### 22.3 D3 验收

- [ ] default 态当前任务摘要、AI Guide、输入区清楚可识别
- [ ] ExecutionTaskCard compact 保留标题、第一条非空小步说明（存在时）、预计时间（存在时），不写死高度
- [ ] compact 不压缩为仅标签 + 一行标题
- [ ] guide-focused 和 feedback-focused 正常
- [ ] 三状态切换草稿不丢失
- [ ] 键盘弹出/收起正常
- [ ] 完成按钮始终可通过页面滚动到达
- [ ] 默认字号与放大字号均页面自然滚动、无内容裁切、无横向滚动、无默认 AI 嵌套小滚动框、无 BottomTab 遮挡

### 22.4 D4 验收

- [ ] Android Chrome 全链路返回（检验 `otp-code-entry / 65` 和 `action-list / 85`）
- [ ] iOS Safari（设备可用时）
- [ ] 375 / 390 / 430 三档视口
- [ ] 无双重 AppShell
- [ ] 无聊天化

---

## 23. 与 V3.1-A 的衔接边界

| 维度 | V3.0D | V3.1-A |
|------|-------|--------|
| 验证码 | Mock 视觉双状态（email-entry / code-entry） | 真实 Supabase Auth OTP |
| 邮箱 | 前端表单校验 | 真实 SMTP 发送 |
| 登录 | 前端 onLoginSuccess | 真实 Session 管理 |
| 密码 | 不修改 PasswordLoginPage/RegisterPage | 首次设置密码引导 |
| authService.mock.ts | 不修改 | 保留 + 新增真实 adapter |
| otpStep 状态 | OtpLoginPage 本地 | 由 auth facade 接管 |
| Mock 诚实说明 | 存在（"当前是前端体验流程"） | 移除 |
| "演示邮箱"标签 | 存在 | 移除 |

V3.0D 的 OTP 双状态实现（`otpStep`、`verificationCode`、倒计时）与 V3.1-A 的产品需求一致。V3.1-A 接入时，OtpLoginPage 的内部状态机可逐步替换为通过 auth facade 驱动，但页面视觉结构可保留。

---

## 24. 架构结论

1. **Welcome 方案：** 删除模拟内容，顶部只有“清行”，仅保留“开始使用”主动作并进入 otp-login；默认字号单屏优先，放大字号由 AuthShell 安全滚动；主标题“今天，也从一小步开始”，品牌视觉锁定小径与嫩芽。
2. **OTP Mock 方案：** OtpLoginPage 本地 `otpStep` 状态，不修改 auth service，Mock 文案始终诚实（“当前是前端体验流程”），“演示邮箱”标签。
3. **OTP 验证码输入：** 一个逻辑 input + 六个视觉数字格，`inputMode="numeric"`，`maxLength={6}`。
4. **OTP Back Handler：** `otp-code-entry / 65`（强制，非可选），OtpLoginPage 注册。
5. **任务总览重构：** 移除 UpcomingTaskList；TaskListView 继续使用只读 CurrentTaskCard，不导入或改用 ExecutionTaskCard；入口 UI 锁定为“后面还有 N 步 / 看看今天的其他小步 →”，N 来自真实数据，N=0 时隐藏。
6. **行动清单二级页方案：** 内部使用 `todayMode="action-list"` 与 ActionListView；真实 UI 标题“今天的其他小步”；数据分组按 currentTask 存在/不存在 + N 值双条件统一锁定表；不补造 currentTask、不提升 locked、不修改 todayState、不显示额外空状态卡，“接下来”固定使用 `upcomingTasks[0]`，“后面再做”固定使用 `upcomingTasks.slice(1)`。
7. **任务执行三状态：** 保留 C3 架构；default 使用页面级内容流，TaskExecutionView 是 V3.0D 唯一明确使用 ExecutionTaskCard 的页面，始终传入 `compact={true}`；ExecutionTaskCard 默认 `compact=false`，紧凑模式保留标题+小步说明+预计时间且不写死高度、不裁切必要内容。
8. **状态所有权：** 不提升局部状态，`todayMode` 在 page.tsx 管理，`otpStep` 在 OtpLoginPage 本地。
9. **BackController：** 新增 `action-list / 85` + `otp-code-entry / 65`，page-authenticated-root 使用两个独立分支。
10. **滚动所有权：** Welcome 默认字号单屏优先、放大字号安全滚动；TaskListView、ActionListView 与 TaskExecutionView default 均为页面内容区单一纵向滚动；guide-focused / feedback-focused 保留既有专注态滚动与键盘行为。
11. **双 AppShell 防护：** 所有页面保持在单一 AppShell/AuthShell 内，不创建新壳。
12. **V3.1-A 兼容：** V3.0D 的 OTP 状态机构建在 V3.1-A 接入时可复用视觉结构。
