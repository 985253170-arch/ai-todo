# Roadmap V2.2 UI 升级 — AI Todo 产品体验总规划

> **状态**：总规划文档，非执行方案
> **依赖**：V2.2A 页面路由结构升级 ✅（已实现，线上验收通过）
> **定位**：V2.2B/C/D 三阶段 UI 升级的总体路线图，不替代各阶段的 Architecture 和 Execution Plan
> **上一文档**：[Roadmap-V2.1-V2.3.md](Roadmap-V2.1-V2.3.md) · [Architecture-V2.2A-Routing.md](Architecture-V2.2A-Routing.md) · [Execution-Plan-V2.2A-Routing.md](Execution-Plan-V2.2A-Routing.md)
> **设计日期**：2026-07-05

---

## 目录

- [一、规划目标](#一规划目标)
- [二、当前基础状态](#二当前基础状态)
- [三、V2.2B：登录/注册页高级感设计](#三v22b登录注册页高级感设计)
- [四、V2.2C：主工作台 UI 美化](#四v22c主工作台-ui-美化)
- [五、V2.2D：移动端体验优化](#五v22d移动端体验优化)
- [六、阶段顺序建议](#六阶段顺序建议)
- [七、风险控制](#七风险控制)
- [八、V2.2B 初步允许修改文件建议](#八v22b-初步允许修改文件建议)
- [九、V2.2C 初步允许修改文件建议](#九v22c-初步允许修改文件建议)
- [十、V2.2D 初步允许修改文件建议](#十v22d-初步允许修改文件建议)
- [十一、验收标准总览](#十一验收标准总览)
- [十二、和 V2.3 的边界](#十二和-v23-的边界)
- [十三、最终推荐](#十三最终推荐)

---

## 一、规划目标

### 1.1 总体目标

把 AI Todo 从"功能可用"升级为"看起来像正式产品、移动端体验顺手、视觉高级但不复杂"。

当前 V2.2A 已完成三页面路由结构（`/` `/login` `/app`），所有核心功能正常运行。但页面视觉仍然停留在"开发者原型"阶段——能用，但不够精致、不够产品化。

V2.2B/C/D 的目标是**在不改任何业务逻辑的前提下**，用 Tailwind CSS 原生样式全面提升视觉品质和移动端体验。

### 1.2 核心原则

| # | 原则 | 说明 |
|---|------|------|
| 1 | **不改核心业务逻辑** | 所有 hooks、API、lib、prompts、数据库零变更 |
| 2 | **不改 hooks** | useAuth / useTaskGroup / useTaskHistory / useTaskStats / useTaskReview 全部不动 |
| 3 | **不改 API** | 8 个 API Route 全部不动 |
| 4 | **不改数据库** | 零 schema / migration 变更 |
| 5 | **不改 AI 策略** | task-generation / task-review prompts 不动，Phase 15 智能调整不动 |
| 6 | **不新增复杂 UI 库** | 不引入 shadcn/ui、Radix、framer-motion 等 |
| 7 | **以 Tailwind CSS 原生样式为主** | 利用 Tailwind 内置 class 实现视觉升级，必要时仅在 globals.css 添加少量自定义 CSS 变量或工具类 |
| 8 | **分阶段推进** | V2.2B → V2.2C → V2.2D，每阶段独立 Architecture → Execution Plan → 实现 → Review → 验收 |
| 9 | **移动端优先** | 所有设计以手机屏幕为第一目标，桌面端为增强 |

### 1.3 不是什么

- 不是功能开发——不新增任何业务能力
- 不是重构——不改组件数据流、不改状态管理
- 不是设计系统大迁移——不引入新的 UI 框架或组件库
- 不是 branding 项目——不改 Logo、不改产品名称、不改产品定位

---

## 二、当前基础状态

### 2.1 V2.2A 已完成能力

V2.2A 页面路由结构升级已完成并线上验收通过。当前页面结构：

```
/          产品首页 / Landing Page
/login     登录 / 注册页面
/app       AI Todo 主工作台（必须登录）
```

| 能力 | 状态 |
|------|:--:|
| `/` Landing Page（产品介绍 + CTA） | ✅ |
| `/login` 登录/注册页面（验证码 + 密码双模式） | ✅ |
| `/app` 主工作台（GoalInput + TaskList + StatsBar + HistoryPanel + TaskReviewPanel） | ✅ |
| `/app` 必须登录才能访问 | ✅ |
| 未登录访问 `/app` → 自动跳转 `/login` | ✅ |
| 已登录访问 `/` 或 `/login` → 自动跳转 `/app` | ✅ |
| Landing CTA → `/login` | ✅ |
| Header variant 系统（landing / login / app） | ✅ |
| MainWorkspace 组件已独立抽取 | ✅ |
| LoginPageContent 独立组件（页面版登录表单） | ✅ |
| LandingPage 独立组件 | ✅ |
| 不使用 middleware（全 client-side 路由守卫） | ✅ |
| AuthModal 弹窗登录保留（`/app` 内未登录场景） | ✅ |
| SetPasswordPrompt 统一由 Header variant="app" 管理 | ✅ |

### 2.2 现有组件清单（22 个）

| 组件 | 文件 | V2.2A 状态 | 预计涉及阶段 |
|------|------|:--:|:--:|
| Header | `Header.tsx` | 已修改（variant 系统） | B / C |
| LandingPage | `LandingPage.tsx` | 新增 | B |
| LoginPageContent | `LoginPageContent.tsx` | 新增 | B |
| MainWorkspace | `MainWorkspace.tsx` | 新增（从旧 page.tsx 提取） | C |
| AuthModal | `AuthModal.tsx` | 不动 | — |
| SetPasswordPrompt | `SetPasswordPrompt.tsx` | 不动 | （可能被 B 触及样式） |
| GoalInput | `GoalInput.tsx` | 不动 | C |
| TaskList | `TaskList.tsx` | 不动 | C |
| TaskItem | `TaskItem.tsx` | 不动 | C |
| TaskProgress | `TaskProgress.tsx` | 不动 | C |
| CompleteAllPrompt | `CompleteAllPrompt.tsx` | 不动 | C |
| StatsBar | `StatsBar.tsx` | 不动 | C |
| StatCard | `StatCard.tsx` | 不动 | C |
| HistoryPanel | `HistoryPanel.tsx` | 不动 | C |
| HistoryItem | `HistoryItem.tsx` | 不动 | C |
| TaskReviewPanel | `TaskReviewPanel.tsx` | 不动 | C |
| HeroSection | `HeroSection.tsx` | 不动 | C |
| ExampleGoals | `ExampleGoals.tsx` | 不动 | C |
| LoadingState | `LoadingState.tsx` | 不动 | C |
| EmptyState | `EmptyState.tsx` | 不动 | C |
| ErrorMessage | `ErrorMessage.tsx` | 不动 | C |
| NewDayPrompt | `NewDayPrompt.tsx` | 不动 | C |

### 2.3 当前视觉状态评估

**诚实评价：页面"能用，但视觉还不是最终产品级"。**

| 页面 | 当前状态 |
|------|---------|
| `/` Landing Page | 有基本结构（Hero + Features + CTA），但卡片、间距、字体层级较为朴素 |
| `/login` 登录页 | 功能完整（OTP + 密码双 Tab），但表单视觉接近"开发者快速搭建"水平 |
| `/app` 主工作台 | 核心功能全部正常，但组件视觉风格不够统一，缺乏精致的卡片、阴影、间距系统 |

**具体表现**：
- 颜色使用较为零散，缺乏统一的色彩 Token 体系
- 卡片风格不统一（有的有阴影、有的没有；圆角大小不一致）
- 字体层级不够清晰（标题、正文、辅助文字的大小和粗细对比不够）
- 间距系统不够一致（不同卡片之间的 gap 不统一）
- 状态反馈视觉较弱（loading / empty / error / success 各态缺乏统一视觉语言）
- 移动端虽然可用，但缺少精致感（触控反馈、安全区适配、卡片呼吸感）

---

## 三、V2.2B：登录/注册页高级感设计

### 3.1 目标

让 `/login` 看起来像正式产品，而不是普通表单页。

不改变任何登录逻辑——OTP 验证码登录、密码登录、登录成功跳转 `/app`、SetPasswordPrompt 引导全部保持不变。

### 3.2 范围

#### 3.2.1 登录页背景

- 柔和渐变背景，与 Landing Page (`bg-[#F8FAFF]`) 和 App (`from-indigo-50 via-white to-sky-50`) 保持同色系
- 移动端不花哨——背景渐变简洁、不分散注意力
- 桌面端可增加轻量视觉层次（如微妙的网格纹理或单色渐变层）

#### 3.2.2 登录卡片

- 更清晰的层级：卡片与背景的分离感
- 更高级的圆角（如 `rounded-2xl` 或 `rounded-3xl`）
- 更精致的阴影（如 `shadow-lg shadow-indigo-500/5` 轻量彩色阴影）
- 更细腻的边框（如 `border border-white/50` 或 `border-slate-100`）
- 适合手机单手操作：卡片宽度 `max-w-sm`，垂直居中但有足够的上下留白

#### 3.2.3 验证码/密码 Tab

- 当前功能不改——OTP Tab 和密码 Tab 切换逻辑完全保留
- 优化 Tab 视觉：当前选中态更明确（如下划线加粗、颜色加深、背景色变化）
- 两个 Tab 之间的视觉分隔更清晰
- 切换动画可选（CSS transition，不引入 JS 动画库）

#### 3.2.4 表单输入框

涉及所有输入控件：

| 输入控件 | 说明 |
|---------|------|
| 邮箱输入 | 单个 `<input type="email">`，带图标前缀 |
| 密码输入 | 单个 `<input type="password">`，带显示/隐藏切换 |
| 6 位验证码输入 | 6 个独立 `<input>`，`inputMode="numeric"`，`autoComplete="one-time-code"` |

每个输入控件需覆盖的状态：

| 状态 | 视觉要求 |
|------|---------|
| **default** | 清晰的边框、合适的圆角、足够的内边距 |
| **focus** | 明显的焦点环（ring-2 ring-indigo-500），过渡动画 |
| **error** | 红色边框 + 红色提示文字，不制造焦虑（不用大红背景） |
| **disabled** | 灰色降低对比度，但仍可读 |

#### 3.2.5 错误提示和成功提示

- 统一样式：错误用淡红背景 + 红色边框 + 红色文字；成功用淡绿背景 + 绿色边框 + 绿色文字
- 中文提示清晰友好，不用技术术语
- 不制造焦虑：错误提示不闪烁、不弹窗、不用感叹号堆叠
- 提示位置：在相关输入框下方，不在页面顶部全局弹 toast

#### 3.2.6 设置密码引导衔接

- 登录后进入 `/app`（现有逻辑不变）
- SetPasswordPrompt 仍由 Header `variant="app"` 管理（现有逻辑不变）
- V2.2B 不改 Auth 底层逻辑
- 如果 SetPasswordPrompt 的视觉需要与登录页统一，可在 V2.2B 中微调其卡片样式

#### 3.2.7 移动端登录体验

- 键盘弹起不遮挡核心按钮：表单区域有足够的滚动空间
- 按钮高度 ≥ 44px，适合拇指触控
- 表单间距合理：标签、输入框、按钮之间的间距不拥挤
- 6 位验证码输入框宽度适合手机屏幕（不超出、不重叠）

### 3.3 明确不做

| # | 不做 | 原因 |
|---|------|------|
| 1 | 不改 `useAuth` | Auth 逻辑层 |
| 2 | 不改 `AuthModal` | 弹窗登录组件不动 |
| 3 | 不改 `SetPasswordPrompt`（逻辑层） | 设置密码引导逻辑不动（样式可微调以统一视觉） |
| 4 | 不改 Supabase Auth | 基础设施 |
| 5 | 不改验证码/密码登录逻辑 | 业务逻辑层 |
| 6 | 不加第三方登录（Google/GitHub/微信） | 留给 V2.3 或之后 |
| 7 | 不做忘记密码 | 留给 V2.3 |
| 8 | 不做 Turnstile | 留给 V2.3 |
| 9 | 不引入 shadcn/ui 或 Radix | 保持 Tailwind CSS 原生 |
| 10 | 不加复杂动画库 | CSS transition 足够 |

---

## 四、V2.2C：主工作台 UI 美化

### 4.1 目标

让 `/app` 看起来高级、清爽、像真正 AI 产品。

不改任何业务逻辑——任务生成、勾选、统计、历史、复盘、智能调整全部保持不变。

### 4.2 范围

#### 4.2.1 顶部 Header（variant="app"）

- 登录状态展示：邮箱显示更精致（如更小的字体、更柔和的背景 pill）
- 历史入口按钮：视觉更清晰，展开/收起状态有明确区分
- 登出按钮：样式柔和，不突兀
- 品牌感：Logo 区域保持简洁，可微调字体粗细和间距

#### 4.2.2 目标输入区（GoalInput + ExampleGoals）

- GoalInput 视觉升级：输入框层级更清晰（与背景有明确分隔）
- 生成按钮状态：default / hover / loading / disabled 各态视觉明确
- 示例目标入口（ExampleGoals）：chip/pill 样式更精致，点击有反馈
- 输入框 focus 态：清晰的焦点环，与登录页风格统一

#### 4.2.3 任务卡片（TaskList / TaskItem / TaskProgress / CompleteAllPrompt）

- TaskItem 视觉升级：
  - 勾选态：checkbox 自定义样式（不用浏览器默认），勾选后有划线 + 降低透明度
  - 完成态：已完成任务的视觉区别于未完成（不突兀）
  - 卡片间距：任务之间的间距有呼吸感
- TaskProgress：进度条视觉升级（圆角、颜色渐变、百分比文字）
- CompleteAllPrompt：全部完成后的提示卡片美观度
- 清空/重新生成操作区：按钮层级清晰（主操作/次操作区分）

#### 4.2.4 统计卡片（StatsBar / StatCard）

- StatsBar 视觉升级：4 个 StatCard 排列整齐
- StatCard 单项设计：
  - 今日完成率
  - 最近 7 天
  - 总完成数
  - 连续行动天数
- 每个卡片有统一的视觉语言（圆角、阴影、内边距）
- 移动端 2×2 或单列排列，不拥挤、不溢出
- 数字和标签的字体层级清晰

#### 4.2.5 历史面板（HistoryPanel / HistoryItem）

- HistoryPanel 卡片样式：与任务卡片风格统一
- 展开/收起体验：过渡平滑（CSS transition）
- HistoryItem：每条历史记录的卡片样式
- 空状态：友好的 empty state 插画或图标
- 加载更多：loading 态清晰

#### 4.2.6 AI 复盘卡片（TaskReviewPanel）

- TaskReviewPanel 视觉升级：卡片样式与整体统一
- 各状态视觉：
  - **ready**：引导生成复盘按钮美观
  - **loading**：骨架屏或 spinner（不闪烁）
  - **success**：复盘文案展示更温和（字体、行距、段落间距）
  - **stale**：提示"任务已更新，建议重新生成"的样式
  - **error**：错误提示友好
- 复盘文案排版：行距、段落间距舒适，适合阅读

#### 4.2.7 空状态/加载态/错误态

- **LoadingState**：骨架屏或 spinner，不闪烁、不跳动
- **EmptyState**（空任务状态）：友好的引导插图或图标 + 文案
- **ErrorMessage**：统一样式，与其他错误提示一致
- **统一视觉语言**：三种状态的色彩、图标风格、字体保持统一

#### 4.2.8 统一设计语言

在整个 `/app` 页面建立一致的视觉系统：

| Token 类别 | 说明 |
|-----------|------|
| **圆角** | 统一圆角尺度（如按钮 `rounded-xl`、卡片 `rounded-2xl`、输入框 `rounded-xl`） |
| **阴影** | 统一阴影层级（如卡片 `shadow-sm`、hover `shadow-md`、弹窗 `shadow-lg`） |
| **间距** | 统一 gap 系统（如卡片间 `gap-4`、区块间 `gap-6`、页面 padding `px-4 py-6`） |
| **字体层级** | 标题/正文/辅助文字有明确的大小和粗细体系 |
| **色彩** | 主色（indigo-600）、成功（emerald-500）、警告（amber-500）、错误（red-500）统一 |
| **卡片风格** | 所有卡片使用相似的背景、边框、圆角、阴影 |

### 4.3 明确不做

| # | 不做 | 原因 |
|---|------|------|
| 1 | 不改 `useTaskGroup` | 核心状态管理 |
| 2 | 不改 `useTaskStats` | 统计 hook |
| 3 | 不改 `useTaskHistory` | 历史 hook |
| 4 | 不改 `useTaskReview` | 复盘 hook |
| 5 | 不改任何 API Route | 全部不动 |
| 6 | 不改 AI Prompt | task-generation / task-review 不动 |
| 7 | 不改任务生成策略 | Phase 15 不动 |
| 8 | 不改数据库 | 零变更 |
| 9 | 不做复杂动画库 | CSS transition 足够 |
| 10 | 不引入 shadcn/ui 或 Radix | 保持 Tailwind CSS 原生 |
| 11 | 不改 `AuthModal` | 不属于 V2.2C 范围 |
| 12 | 不改 `LoginPageContent` | 属于 V2.2B |

---

## 五、V2.2D：移动端体验优化

### 5.1 目标

让 AI Todo 在手机上更顺手。

V2.2B 和 V2.2C 已经包含了移动端优先的设计。V2.2D 是在二者完成的基础上，专门打磨移动端的细节体验。

### 5.2 范围

#### 5.2.1 safe-area 安全区

- **顶部安全区**：`pt-[env(safe-area-inset-top,0px)]`（当前 Header 已有部分支持，需全面检查三个页面）
- **底部安全区**：`pb-[env(safe-area-inset-bottom,1rem)]`（当前 MainWorkspace 已有，需检查 Landing Page 和 Login Page）
- **iPhone Safari 适配**：确保在 iPhone（含刘海屏和 Dynamic Island 机型）上内容不被遮挡

#### 5.2.2 底部间距

- 页面底部留白充足：最后一个卡片不贴底
- 输入区域和操作按钮不被 Home Indicator 遮挡
- 历史面板展开后，底部仍有足够的滚动空间

#### 5.2.3 输入框键盘遮挡

- `/login` 表单：键盘弹起后，输入框和按钮仍在可视区域内
- `/app` 目标输入框（GoalInput）：键盘弹起后不被遮挡
- 手机键盘弹起后的滚动体验：页面自动滚动到焦点输入框，不需要手动滑动

#### 5.2.4 按钮触控区域

- 最小触控高度：所有可点击元素 ≥ 44px（`min-h-[44px]`）
- **active 状态**：按下时有视觉反馈（如 `active:scale-[0.98]` 或背景色变化）
- **disabled 状态**：明确降低对比度 + `cursor-not-allowed`（`disabled:opacity-50`）
- **loading 状态**：按钮文字替换为 spinner 或加载动画，按钮不可重复点击

#### 5.2.5 滚动体验

- 历史面板展开后自动定位（当前已有 `scrollIntoView` 逻辑，保持）
- 页面滚动顺滑（`scroll-behavior: smooth`）
- 避免横向溢出（`overflow-x-hidden` 检查所有容器）
- 避免 iOS 橡皮筋回弹导致的白屏区域

#### 5.2.6 小屏卡片排版

针对 320px-375px 宽度的小屏手机（iPhone SE、iPhone 6/7/8、小屏 Android）：

| 卡片 | 小屏适配要求 |
|------|------------|
| StatsBar 统计卡片 | 2×2 grid 不溢出，数字不换行 |
| TaskItem 任务卡片 | 勾选框 + 文字在一行，不折行 |
| 登录卡片 | `max-w-sm` 在小屏上不超出屏幕 |
| 复盘卡片 | 文本不溢出，按钮不超出卡片宽度 |
| 历史卡片 | 日期和任务数量在一行显示 |

#### 5.2.7 状态反馈

系统化所有交互状态，确保移动端 touch 体验完整：

| 状态 | 要求 |
|------|------|
| **hover** | 仅桌面端有 hover 效果（`hover:`），移动端通过 `active:` 提供按下反馈 |
| **active** | 所有可点击元素有 `active:` 状态（缩放、背景色变化、或边框变化） |
| **disabled** | 降低透明度 + 不可点击 + 视觉上明显不可用 |
| **loading** | 按钮/卡片在加载时有明确的加载态，不闪烁 |
| **error** | 错误提示风格统一，位置固定在相关元素附近 |
| **success** | 操作成功后的正向反馈（如任务勾选完成后的短暂高亮） |

### 5.3 明确不做

| # | 不做 | 原因 |
|---|------|------|
| 1 | 不做原生 App | AI Todo 是 Web App |
| 2 | 不做复杂手势系统 | 如滑动删除、长按菜单等，后续单独评估 |
| 3 | 不做下拉刷新 | 除非后续单独评估并写入执行方案 |
| 4 | 不引入移动端 UI 框架 | 如 Ionic、Framework7 等 |
| 5 | 不做 PWA | 后续单独评估 |
| 6 | 不做离线支持 | 后续版本考虑 |

---

## 六、阶段顺序建议

### 6.1 推荐顺序

```
V2.2B（登录页设计）
    │
    ▼
V2.2C（主工作台 UI 美化）
    │
    ▼
V2.2D（移动端体验优化）
```

**严格顺序执行，不并行。**

### 6.2 顺序理由

| 阶段 | 理由 |
|------|------|
| **V2.2B 先做** | `/login` 涉及的组件最少（LoginPageContent + Header + login/page.tsx），文件较独立，风险最低。适合作为 UI 升级第一步，建立 V2.2 UI 的风格基调。登录页是用户的第一印象，先打磨登录页能立即提升产品感知质量 |
| **V2.2C 其次** | `/app` 涉及 15+ 组件（任务、统计、历史、复盘），改动面最大。需要基于 V2.2B 建立的风格基调来统一设计语言。放到第二，可以在 B 的经验基础上推进 |
| **V2.2D 最后** | 移动端优化需要基于 B 和 C 完成后的真实 UI 效果来统一打磨。如果先做移动端优化再做 UI 美化，美化后可能需要重新调移动端适配。放到最后，一步到位 |

### 6.3 不并行的原因

1. **风格一致性**：如果 B 和 C 并行设计，两组件的视觉风格可能不统一，最终需要额外一轮统一调整
2. **改动面不重叠**：B 改 LoginPageContent，C 改 MainWorkspace 及其子组件，虽然不冲突，但独立 Review 更清晰
3. **风险控制**：顺序执行每阶段只需 Review 5-12 个文件；并行执行需同时 Review 15+ 个文件，Review 质量下降
4. **每阶段独立验收**：B 完成后可先上线（登录页视觉升级），用户能立即受益；不需要等全部完成

---

## 七、风险控制

### 7.1 风险识别

| # | 风险 | 等级 | 影响 |
|---|------|:---:|------|
| 1 | **UI 美化误伤业务逻辑** | **P1** | 修改组件 jsx 时不小心改动 onClick/handler 逻辑，导致任务生成/勾选/统计等行为异常 |
| 2 | **改动组件过多导致 Review 困难** | **P1** | V2.2C 涉及 15+ 组件，Review 时难以逐行检查所有变更 |
| 3 | **移动端样式在不同设备不一致** | **P2** | iOS Safari 和 Android Chrome 对 CSS 的渲染差异（如 safe-area、input 样式、滚动行为） |
| 4 | **登录页美化误改 Auth 流程** | **P1** | LoginPageContent 的 OTP/密码逻辑被意外改动 |
| 5 | **主工作台美化误改任务状态流** | **P1** | TaskList 的勾选/清空/重新生成逻辑被意外改动 |
| 6 | **大量 Tailwind class 改动导致可读性下降** | **P2** | 每个组件 JSX 中 className 变长，维护困难 |
| 7 | **过度设计导致产品变复杂** | **P2** | 追求"高级感"可能引入不必要的视觉噪音（如过多阴影、过多颜色、复杂动画） |

### 7.2 对应控制措施

| 风险 | 控制措施 |
|------|---------|
| 风险 1、4、5（误伤业务逻辑） | 每阶段只改 UI 层（JSX className + 少量 CSS 变量）；不改任何 `onClick`/`onChange`/`useEffect`/`async function`；每阶段独立 lint + build；Review 时用 `git diff` 逐文件检查 |
| 风险 2（Review 困难） | 每阶段限制允许修改文件数（B ≤ 6 个，C ≤ 12 个，D ≤ 15 个）；每阶段独立提 PR（或独立 commit）；Review 按组件拆分检查 |
| 风险 3（设备不一致） | 使用 Tailwind CSS 的标准化响应式 class；避免使用只有特定浏览器支持的 CSS；iPhone Safari + Android Chrome 双端手动验收 |
| 风险 6（可读性下降） | 考虑在 `globals.css` 中抽取少量 CSS 自定义 class（如 `.card`、`.btn-primary`）减少 JSX 中的重复 className；但不过度抽取——保持 Tailwind 优先 |
| 风险 7（过度设计） | 每个阶段先写 Architecture 文档，明确设计方向和"不做什么"；保持"简洁优先"原则——删比加更重要；ChatGPT 把关产品判断 |

### 7.3 不变保证（三个阶段的共同底线）

| 保证 | 验证方式 |
|------|---------|
| 不改 hooks | `git diff --stat src/hooks/` 无输出 |
| 不改 API | `git diff --stat src/app/api/` 无输出 |
| 不改 lib | `git diff --stat src/lib/` 无输出 |
| 不改数据库 | 确认无 migration 文件变更 |
| 不改 package.json | `git diff package.json` 无输出 |
| 不改 AI prompts | `git diff --stat src/prompts/` 无输出 |
| lint 通过 | `npm run lint` 零 error |
| build 通过 | `npm run build` 成功 |

---

## 八、V2.2B 初步允许修改文件建议

> **注意**：以下为初步建议，非最终执行方案。最终允许修改文件清单以 `Architecture-V2.2B-Login.md` 和 `Execution-Plan-V2.2B-Login.md` 为准。

### 8.1 预计涉及文件

| # | 文件 | 操作 | 说明 |
|---|------|:---:|------|
| 1 | `src/app/login/page.tsx` | 可能微调 | 页面级背景/布局调整 |
| 2 | `src/components/LoginPageContent.tsx` | **主要修改** | 登录卡片、表单输入框、Tab、错误提示视觉升级 |
| 3 | `src/components/Header.tsx` | 可能微调 | login variant 的 Header 视觉微调 |

### 8.2 可能新增文件

| # | 文件 | 说明 |
|---|------|------|
| 4 | `src/components/LoginVisualPanel.tsx`（可选） | 桌面端登录页左侧视觉面板（品牌插画/渐变装饰），移动端不显示 |
| 5 | `src/components/OtpInputGroup.tsx`（可选） | 6 位验证码输入框组抽取为独立组件 |

### 8.3 可能涉及但仅改样式

| # | 文件 | 操作 | 说明 |
|---|------|:---:|------|
| 6 | `src/components/SetPasswordPrompt.tsx` | 仅样式微调 | 统一卡片风格与登录页一致（不改弹出逻辑） |

### 8.4 禁止修改（V2.2B）

| # | 禁止 | 原因 |
|---|------|------|
| 1 | `src/hooks/useAuth.ts` | Auth 逻辑层 |
| 2 | `src/components/AuthModal.tsx` | 弹窗登录组件不动 |
| 3 | `src/lib/constants.ts`（AUTH_TEXT 以外的部分） | UI_TEXT 可读，不改 |
| 4 | `src/app/api/*` | 全部 API Route |
| 5 | `src/lib/*` | 全部 lib |
| 6 | `package.json` | 无新依赖 |
| 7 | 数据库 | 零变更 |

---

## 九、V2.2C 初步允许修改文件建议

> **注意**：以下为初步建议，非最终执行方案。最终允许修改文件清单以 `Architecture-V2.2C-Workspace.md` 和 `Execution-Plan-V2.2C-Workspace.md` 为准。

### 9.1 预计涉及文件

| # | 文件 | 操作 | 说明 |
|---|------|:---:|------|
| 1 | `src/app/app/page.tsx` | 可能微调 | 页面级背景/布局调整 |
| 2 | `src/components/MainWorkspace.tsx` | **修改** | 整体布局、间距系统、背景渐变 |
| 3 | `src/components/Header.tsx` | **修改** | app variant 视觉升级（登录状态、历史按钮、登出按钮、品牌感） |
| 4 | `src/components/GoalInput.tsx` | **修改** | 输入框 + 按钮视觉升级 |
| 5 | `src/components/ExampleGoals.tsx` | 修改 | 示例目标 chip 样式 |
| 6 | `src/components/TaskList.tsx` | 修改 | 任务列表容器 + 清空/重新生成按钮区域 |
| 7 | `src/components/TaskItem.tsx` | **修改** | 任务卡片 + 勾选框 + 完成态 |
| 8 | `src/components/TaskProgress.tsx` | 修改 | 进度条 |
| 9 | `src/components/CompleteAllPrompt.tsx` | 修改 | 全部完成提示卡片 |
| 10 | `src/components/StatsBar.tsx` | 修改 | 统计栏容器 |
| 11 | `src/components/StatCard.tsx` | **修改** | 单项统计卡片 |
| 12 | `src/components/HistoryPanel.tsx` | 修改 | 历史面板容器 + 展开/收起 + 加载更多 |
| 13 | `src/components/HistoryItem.tsx` | 修改 | 单条历史记录卡片 |
| 14 | `src/components/TaskReviewPanel.tsx` | **修改** | 复盘卡片 + 各状态视觉 |
| 15 | `src/components/HeroSection.tsx` | 修改 | Hero 区域视觉微调 |
| 16 | `src/components/LoadingState.tsx` | **修改** | 加载态（骨架屏/spinner） |
| 17 | `src/components/EmptyState.tsx` | 修改 | 空状态 |
| 18 | `src/components/ErrorMessage.tsx` | 修改 | 错误提示 |
| 19 | `src/components/NewDayPrompt.tsx` | 修改 | 跨天提示卡片 |

### 9.2 可能新增文件

| # | 文件 | 说明 |
|---|------|------|
| 20 | `src/components/DesignToken.tsx` 或 `globals.css` 自定义变量 | 如果确实需要抽取可复用的设计 Token（颜色、圆角、阴影 CSS 变量），在 globals.css 中添加 `:root` 变量 |

### 9.3 禁止修改（V2.2C）

| # | 禁止 | 原因 |
|---|------|------|
| 1 | `src/hooks/*` | 全部 hooks 不动 |
| 2 | `src/app/api/*` | 全部 API Route |
| 3 | `src/lib/*` | 全部 lib |
| 4 | `src/prompts/*` | AI prompts |
| 5 | `src/components/AuthModal.tsx` | 不属于 V2.2C |
| 6 | `src/components/LoginPageContent.tsx` | 属于 V2.2B |
| 7 | `src/components/SetPasswordPrompt.tsx`（逻辑层） | 不改弹出逻辑 |
| 8 | `package.json` | 无新依赖 |
| 9 | 数据库 | 零变更 |

---

## 十、V2.2D 初步允许修改文件建议

> **注意**：以下为初步建议，非最终执行方案。最终允许修改文件清单以 `Architecture-V2.2D-Mobile.md` 和 `Execution-Plan-V2.2D-Mobile.md` 为准。

### 10.1 预计涉及文件

V2.2D 可能涉及所有三个页面入口 + 所有组件 + globals.css（如确实需要全局移动端基础样式）。

| # | 文件 | 操作 | 说明 |
|---|------|:---:|------|
| 1 | `src/app/page.tsx` | 可能微调 | Landing 页 safe-area / 底部间距 |
| 2 | `src/app/login/page.tsx` | 可能微调 | 登录页 safe-area / 键盘适配 |
| 3 | `src/app/app/page.tsx` | 可能微调 | App 页 safe-area |
| 4 | `src/components/*.tsx` | 按需微调 | 触控区域、active 状态、小屏适配 |
| 5 | `src/app/globals.css` | 如确实需要 | 全局移动端基础样式（如 `touch-action`、`-webkit-overflow-scrolling`）——如涉及，必须在 Architecture 文档中单独说明理由 |

### 10.2 禁止修改（V2.2D）

| # | 禁止 | 原因 |
|---|------|------|
| 1 | `src/hooks/*` | 全部 hooks 不动 |
| 2 | `src/app/api/*` | 全部 API Route |
| 3 | `src/lib/*` | 全部 lib |
| 4 | `src/prompts/*` | AI prompts |
| 5 | `package.json` | 无新依赖 |
| 6 | 数据库 | 零变更 |

---

## 十一、验收标准总览

### 11.1 V2.2B 验收标准

| # | 验收项 | 预期结果 |
|---|--------|---------|
| B1 | `/login` 视觉明显提升 | 卡片、输入框、按钮、Tab 比 V2.2A 更精致 |
| B2 | 验证码登录正常 | 输入邮箱 → 发送验证码 → 输入 6 位码 → 登录成功 → 跳转 `/app` |
| B3 | 密码登录正常 | 切换到密码 Tab → 输入邮箱+密码 → 登录成功 → 跳转 `/app` |
| B4 | 登录成功进入 `/app` | LoginPageContent 登录后 `router.replace("/app")` 正常 |
| B5 | 错误提示正常 | 空邮箱、错误验证码、错误密码的中文提示清晰友好 |
| B6 | 手机端可用 | 登录卡片在手机上居中、不超出屏幕、输入框和按钮可正常操作 |
| B7 | 键盘弹起不遮挡 | 虚拟键盘弹出后，输入框和按钮仍在可视区域 |
| B8 | 按钮触控舒适 | 所有按钮高度 ≥ 44px，active 态有反馈 |
| B9 | AuthModal 不受影响 | `/app` 内弹窗登录体验与 V2.2A 一致 |
| B10 | SetPasswordPrompt 正常 | 登录后进入 `/app`，Header 弹出设置密码引导（逻辑不变） |
| B11 | lint 通过 | `npm run lint` 零 error |
| B12 | build 通过 | `npm run build` 成功 |

### 11.2 V2.2C 验收标准

| # | 验收项 | 预期结果 |
|---|--------|---------|
| C1 | `/app` 视觉明显提升 | 整体更精致、清爽、统一 |
| C2 | 任务生成正常 | GoalInput 输入目标 → 生成任务（逻辑不变） |
| C3 | 勾选正常 | 点击勾选框 → 任务完成/取消完成（逻辑不变） |
| C4 | 统计正常 | StatsBar 4 个指标数据正确（逻辑不变） |
| C5 | 历史正常 | HistoryPanel 展开/收起/加载更多正常（逻辑不变） |
| C6 | AI 复盘正常 | TaskReviewPanel 各状态正常（逻辑不变） |
| C7 | 智能调整正常 | Phase 15 策略不受影响 |
| C8 | 登录/登出正常 | Header 登录状态展示 + AuthModal + 登出正常 |
| C9 | 空状态/加载态/错误态视觉统一 | LoadingState / EmptyState / ErrorMessage 风格一致 |
| C10 | 卡片风格统一 | 圆角、阴影、间距、色彩在各组件间一致 |
| C11 | lint 通过 | `npm run lint` 零 error |
| C12 | build 通过 | `npm run build` 成功 |

### 11.3 V2.2D 验收标准

| # | 验收项 | 预期结果 |
|---|--------|---------|
| D1 | 手机端布局不溢出 | 所有页面在 375px 宽度下无横向滚动条 |
| D2 | 输入框不明显被键盘遮挡 | `/login` 和 `/app` 输入框在键盘弹起后可滚动到可视区域 |
| D3 | 按钮触控舒适 | 所有按钮 ≥ 44px 高度，active 态有视觉反馈 |
| D4 | safe-area 适配正常 | iPhone（含刘海屏）上顶部和底部内容不被遮挡 |
| D5 | 小屏卡片排版清晰 | StatsBar 2×2 grid、TaskItem、登录卡片在小屏上不拥挤 |
| D6 | 页面滚动体验正常 | 滚动顺滑、无卡顿、历史面板展开后自动定位 |
| D7 | 状态反馈完整 | hover/active/disabled/loading/error/success 各态在移动端有对应的视觉表现 |
| D8 | 底部间距充足 | 最后一个卡片不贴底，操作按钮不被 Home Indicator 遮挡 |
| D9 | lint 通过 | `npm run lint` 零 error |
| D10 | build 通过 | `npm run build` 成功 |

---

## 十二、和 V2.3 的边界

### 12.1 V2.2 UI 升级不做的事情（属于 V2.3 Security）

| # | 功能 | 原因 |
|---|------|------|
| 1 | Cloudflare Turnstile 防机器人 | V2.3 安全增强 |
| 2 | 忘记密码 | V2.3 安全增强 |
| 3 | 重置密码页面 | V2.3 安全增强 |
| 4 | 第三方登录（Google/GitHub/微信） | V2.3 或之后 |
| 5 | 账号安全策略（密码强度、错误信息脱敏） | V2.3 安全增强 |
| 6 | rate limit 配置 | V2.3 安全增强 |
| 7 | 邮件模板优化 | V2.3 安全增强（或在 V2.1-Follow-up 中已做） |

### 12.2 边界清晰的原因

V2.2 专注**视觉和体验**——让已经能用的功能看起来更好、用起来更顺手。V2.3 专注**安全**——让账号系统更健壮。两者的改动面完全正交：

- V2.2：`src/components/*.tsx`（UI 层）+ `src/app/globals.css`（样式层）
- V2.3：`src/hooks/useAuth.ts`（Auth 逻辑层）+ `src/app/api/auth/*`（安全 API）+ 环境变量 + Cloudflare 配置

如果在 V2.2 中混入安全功能，会导致 Review 范围扩大、问题定位困难。

---

## 十三、最终推荐

### 13.1 推荐执行路径

```
现在（本文档完成后）
    │
    ├── 1. Claude Code 写 docs/Architecture-V2.2B-Login.md（V2.2B 架构方案）
    │      - 基于本总规划 §三 的范围
    │      - 明确登录页设计的视觉方向、具体改动点、文件清单
    │
    ├── 2. ChatGPT 审查 Architecture-V2.2B-Login.md
    │
    ├── 3. Claude Code 写 docs/Execution-Plan-V2.2B-Login.md（V2.2B 执行方案）
    │      - 给 Codex 的逐步实现指令
    │      - 精确到每个文件的每一处 className 改动
    │
    ├── 4. ChatGPT 审查 Execution-Plan-V2.2B-Login.md
    │
    ├── 5. Codex 按执行方案实现
    │
    ├── 6. Claude Code Code Review
    │
    ├── 7. ChatGPT 最终把关 → 提交 V2.2B
    │
    ├── 8. 重复步骤 1-7 进入 V2.2C
    │
    ├── 9. 重复步骤 1-7 进入 V2.2D
    │
    └── 10. V2.2 全部完成后 → 进入 V2.3 Security
```

### 13.2 预估工作量（按阶段）

| 阶段 | Architecture | Execution Plan | 实现 | Review | 合计 |
|------|:--:|:--:|:--:|:--:|:--:|
| V2.2B | 小（涉及 3-6 文件） | 小 | 中 | 小 | **1-2 轮对话** |
| V2.2C | 中（涉及 12-20 文件） | 中 | 大 | 中 | **2-3 轮对话** |
| V2.2D | 小（涉及 3-22 文件，多为微调） | 小 | 中 | 中 | **1-2 轮对话** |

### 13.3 推荐理由总结

1. **V2.2B 先做**：风险最低、文件最少、用户第一印象提升最明显
2. **V2.2C 其次**：改动面最大，但基于 B 的风格基调能保证一致性
3. **V2.2D 最后**：基于 B 和 C 的成品来打磨移动端体验，避免重复工作
4. **每阶段独立 Architecture + Execution Plan**：保持项目一致的工作流，确保质量和可控性
5. **不改任何业务逻辑**：三个阶段只碰 className 和 CSS 变量，零风险引入业务 bug

---

> **文档结束**
>
> **下一文档**：`docs/Architecture-V2.2B-Login.md`（V2.2B 登录/注册页高级感设计 架构方案，待编写）
>
> **关联文档**：
> - [Roadmap-V2.1-V2.3.md](Roadmap-V2.1-V2.3.md) — V2.1-V2.3 路线图
> - [Architecture-V2.2A-Routing.md](Architecture-V2.2A-Routing.md) — V2.2A 架构方案（✅ 已完成）
> - [Execution-Plan-V2.2A-Routing.md](Execution-Plan-V2.2A-Routing.md) — V2.2A 执行方案（✅ 已完成）
> - [PROJECT-CONTEXT.md](PROJECT-CONTEXT.md) — 项目长期上下文
> - [PROJECT-INDEX.md](PROJECT-INDEX.md) — 项目文件索引
> - [PRD-V2.0.md](PRD-V2.0.md) — V2.0 产品规划
