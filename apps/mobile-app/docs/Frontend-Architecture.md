# Frontend-Architecture — 清行 手机 App 前端内部架构设计

> **状态**：架构设计阶段。只写文档，不写代码。
> **所属工程**：`apps/mobile-app/`
> **品牌名**：对外展示统一使用「清行」，内部代号 AI Todo 可保留于代码/文档中。
> **品牌主文案**：「慢一点，也在向前走」
> **项目级决策**：参见 [`docs/Architecture-V3.0A-Frontend-Isolation.md`](../../../docs/Architecture-V3.0A-Frontend-Isolation.md)
> **UI Spec**：[`UI-Spec-Mobile-App.md`](UI-Spec-Mobile-App.md)
> **执行方案**：[`Frontend-Execution-Plan.md`](Frontend-Execution-Plan.md)
> **设计日期**：2026-07-08

---

## 目录

- [1. 品牌与视觉身份](#1-品牌与视觉身份)
- [2. apps/mobile-app 目录架构](#2-appsmobile-app-目录架构)
- [3. Auth 页面结构与流转](#3-auth-页面结构与流转)
- [4. AppShell / BottomTabBar 结构](#4-appshell--bottomtabbar-结构)
- [5. 四 Tab 信息架构](#5-四-tab-信息架构)
- [6. 任务执行陪伴页（保留底部 Tab）](#6-任务执行陪伴页保留底部-tab)
- [7. 页面组件拆分](#7-页面组件拆分)
- [8. Mock Service 架构](#8-mock-service-架构)
- [9. 手绘风 SVG 图标方案](#9-手绘风-svg-图标方案)
- [10. UI 风格约束与视觉 Token](#10-ui-风格约束与视觉-token)
- [11. 通用 UI 组件库](#11-通用-ui-组件库)
- [12. 后续真实后端接入点](#12-后续真实后端接入点)
- [13. 后续合并回主项目路由的迁移路径](#13-后续合并回主项目路由的迁移路径)
- [14. 不允许出现的设计偏差](#14-不允许出现的设计偏差)

---

## 1. 品牌与视觉身份

### 1.1 品牌名

| 场景 | 使用名称 |
|------|---------|
| 对外 UI（页面标题、Logo、欢迎页、登录页、按钮文案） | **清行** |
| 内部代码、文档、仓库名 | AI Todo（可继续保留） |
| HTML `<title>` | 清行 |

### 1.2 品牌主文案

```
慢一点，也在向前走
```

### 1.3 品牌调性

- 清爽、轻盈、安静地行动
- 不强调复杂计划，不制造压力，只陪用户完成今天这一小步
- 视觉关键词：暖米白、纸张卡片、深蓝主色、手帐感、温柔鼓励、低压力、圆角、柔和阴影、手绘小图标

### 1.4 商标备注

「清行」当前仅作为 V3.0A 原型品牌名使用。正式上线、App Store 发布、商业推广或商标注册前，必须进行正式商标检索与法务确认。

---

## 2. apps/mobile-app 目录架构

### 2.1 完整目录结构

```
apps/mobile-app/
├── app/                          # Next.js App Router 页面
│   ├── layout.tsx                # 根布局（metadata: 清行）
│   ├── page.tsx                  # 入口：未登录→欢迎页，已登录→/today
│   ├── globals.css               # 全局样式 + 设计 Token
│   ├── today/
│   │   └── page.tsx              # 今日 Tab（空状态 / 任务列表 / 执行陪伴）
│   ├── footprint/
│   │   └── page.tsx              # 足迹 Tab（空状态 / 历史列表）
│   ├── growth/
│   │   └── page.tsx              # 成长 Tab（统计卡 + AI 建议）
│   └── me/
│       └── page.tsx              # 我的 Tab（账号 + 设置 + 退出）
│
├── components/                   # UI 组件
│   ├── shell/                    # App 壳组件
│   │   ├── AppShell.tsx          # App 根容器（布局 + Tab 切换）
│   │   └── BottomTabBar.tsx      # 底部导航栏（手绘 SVG 图标）
│   ├── ui/                       # 通用 UI 组件库
│   │   ├── PaperCard.tsx         # 纸张卡片容器
│   │   ├── PrimaryButton.tsx     # 深蓝主按钮
│   │   ├── SecondaryButton.tsx   # 白底次按钮
│   │   ├── TextInput.tsx         # 圆角胶囊输入框
│   │   └── SectionTitle.tsx      # 分区标题
│   ├── icons/                    # 手绘风 SVG 图标组件
│   │   ├── IconToday.tsx         # 今日（日历/指南针）
│   │   ├── IconFootprint.tsx     # 足迹（脚印）
│   │   ├── IconGrowth.tsx        # 成长（小芽/上升线）
│   │   ├── IconMe.tsx            # 我的（用户头像）
│   │   ├── IconPaperPlane.tsx    # 纸飞机
│   │   ├── IconStar.tsx          # 星星
│   │   ├── IconLeaf.tsx          # 叶子
│   │   ├── IconFire.tsx          # 火焰进度
│   │   └── IconCheck.tsx         # 完成勾
│   ├── auth/                     # 认证页面组件
│   │   ├── WelcomePage.tsx       # 产品欢迎页
│   │   ├── OtpLoginPage.tsx      # 验证码登录页
│   │   ├── PasswordLoginPage.tsx # 密码登录页
│   │   └── RegisterPage.tsx      # 注册页
│   ├── today/                    # 今日 Tab 组件
│   │   ├── TodayEmptyView.tsx    # 今日空状态
│   │   ├── TodayTaskView.tsx     # 今日任务视图
│   │   ├── GoalInputCard.tsx     # 目标输入卡片
│   │   ├── CurrentTaskCard.tsx   # 当前任务强调卡
│   │   ├── UpcomingTaskList.tsx  # 后续任务列表
│   │   └── TaskProgressCard.tsx  # 今日进度卡片
│   ├── companion/                # 任务执行陪伴组件
│   │   └── TaskCompanionView.tsx # 任务执行陪伴页
│   ├── footprint/                # 足迹 Tab 组件
│   │   ├── FootprintEmptyView.tsx    # 足迹空状态
│   │   ├── FootprintHistoryView.tsx  # 足迹历史视图
│   │   ├── HistoryRangeTabs.tsx      # 最近7天/30天切换
│   │   └── HistoryCard.tsx           # 单条历史卡片
│   ├── growth/                   # 成长 Tab 组件
│   │   ├── GrowthView.tsx            # 成长视图容器
│   │   ├── GrowthStatCard.tsx        # 单个统计卡
│   │   └── GrowthSuggestionCard.tsx  # AI 建议卡
│   └── me/                       # 我的 Tab 组件
│       ├── MeView.tsx            # 我的视图容器
│       ├── AccountCard.tsx       # 账号信息卡
│       ├── SyncCard.tsx          # 同步状态卡
│       └── SettingsList.tsx      # 设置项列表
│
├── services/                     # Service 层（数据获取）
│   ├── authService.mock.ts       # 认证 Mock API
│   ├── taskService.mock.ts       # 任务 Mock API
│   ├── historyService.mock.ts    # 历史记录 Mock API
│   ├── growthService.mock.ts     # 成长统计 Mock API
│   └── index.ts                  # Service 统一导出
│
├── data/                         # Mock 数据
│   └── mockData.ts               # 所有 Mock 数据定义
│
├── types/                        # 类型定义
│   └── app.ts                    # 前端专用类型
│
├── styles/                       # 样式
│   └── tokens.ts                 # 设计 Token（颜色/间距/圆角/阴影/字体）
│
├── docs/                         # 前端专属文档
│   ├── UI-Spec-Mobile-App.md
│   ├── Frontend-Architecture.md  # 本文档
│   └── Frontend-Execution-Plan.md
│
├── package.json                  # 独立依赖配置
├── next.config.ts                # Next.js 配置
├── tsconfig.json                 # TypeScript 配置
├── tailwind.config.ts            # Tailwind 配置（含设计 Token）
└── postcss.config.mjs            # PostCSS 配置
```

### 2.2 目录职责一览

| 目录 | 职责 | 约束 |
|------|------|------|
| `app/` | Next.js 文件系统路由 | 只做路由入口，不写业务逻辑 |
| `components/shell/` | AppShell + BottomTabBar | 只控制布局和 Tab 切换 |
| `components/ui/` | 通用 UI 组件（PaperCard, PrimaryButton 等） | 无业务逻辑，纯展示 |
| `components/icons/` | 手绘风 SVG 图标 | 每个图标独立组件，统一风格 |
| `components/auth/` | 4 个 Auth 页面 | 不直接读数据，通过 props 接收 |
| `components/today/` | 今日 Tab 所有 UI | 不直接读数据，通过 props 接收 |
| `components/companion/` | 任务执行陪伴 | 保留底部 Tab，不套新壳 |
| `components/footprint/` | 足迹 Tab 所有 UI | 不直接读数据，通过 props 接收 |
| `components/growth/` | 成长 Tab 所有 UI | 不直接读数据，通过 props 接收 |
| `components/me/` | 我的 Tab 所有 UI | 不直接读数据，通过 props 接收 |
| `services/` | 数据获取层 | 接口签名与未来真实 API 一致 |
| `data/` | 静态 Mock 数据 | 只被 services 引用，不被组件直接引用 |
| `types/` | 前端类型定义 | 与 UI Spec 数据结构一致 |
| `styles/` | 设计 Token 常量 | 被 tailwind.config.ts 和组件引用 |

---

## 3. Auth 页面结构与流转

### 3.1 页面清单

本阶段共 4 个 Auth 页面：

| 页面 | 组件 | 对应设计稿 |
|------|------|-----------|
| 产品欢迎页 | `WelcomePage.tsx` | `产品首页.png` |
| 验证码登录页 | `OtpLoginPage.tsx` | `登录注册页.png` |
| 密码登录页 | `PasswordLoginPage.tsx` | `密码登录页.png` |
| 注册页 | `RegisterPage.tsx` | `注册页.png` |

### 3.2 页面流转

```
产品欢迎页（未登录入口）
  ├─ 点击「开始使用」→ 验证码登录页
  ├─ 点击「已有账号，去登录」→ 验证码登录页
  └─ 点击右上角「登录」→ 验证码登录页

验证码登录页
  ├─ Tab「验证码登录」→ 当前页
  ├─ Tab「密码登录」→ 密码登录页
  ├─ 输入邮箱 + 验证码 → 点击「进入我的行动手账」→ mock 登录成功 → 今日页
  └─ 点击「创建我的行动记录」→ 注册页

密码登录页
  ├─ 输入邮箱 + 密码 → 点击「开始我的行动记录」→ mock 登录成功 → 今日页
  └─ 点击「直接回来」→ 验证码登录页

注册页
  ├─ 输入邮箱 + 验证码 + 密码 + 确认密码 → 点击「开始我的行动记录」→ mock 注册成功 → 今日页
  └─ 点击「已有行动记录？直接回来」→ 验证码登录页
```

### 3.3 关键产品规则

- 「开始使用」默认进入**登录页**，不直接进入注册页
- 没有账号时，从登录页点击「创建我的行动记录」进入注册页
- 所有登录/注册当前阶段使用 mock，不接真实 Supabase Auth
- 表单校验只做前端提示（邮箱格式、密码非空、两次密码一致）

---

## 4. AppShell / BottomTabBar 结构

### 4.1 App Shell 组件

```
app/layout.tsx
└── AppShell
    ├── 页面内容区（children，带 padding-bottom）
    └── BottomTabBar（固定底部）
        ├── TabButton [今日] + IconToday
        ├── TabButton [足迹] + IconFootprint
        ├── TabButton [成长] + IconGrowth
        └── TabButton [我的] + IconMe
```

**关键约束**：
- AppShell 是**唯一的全局壳**，不能出现"壳中壳"
- BottomTabBar 固定在底部，始终可见（包括任务执行陪伴页）
- 四个 Tab 页面之间通过 Next.js 路由切换
- 页面内容区域设置 `padding-bottom` 等于 BottomTabBar 高度 + safe-area
- 背景色使用暖米白 `#F7F3EA`
- 最大宽度 `max-w-[430px]`，居中显示
- AppShell 本身不管理 auth 状态——auth 状态由顶层 page.tsx 决定渲染 Auth 页面还是 AppShell

### 4.2 BottomTabBar 行为

- 四个 Tab 按钮使用 Next.js `<Link href="/today" replace>` 导航
- 使用 `replace` 而非 `push`，避免浏览器回退栈堆积
- 当前激活 Tab：深蓝图标 + 深蓝文字（`#0F3155`）
- 未激活 Tab：灰褐色图标 + 灰褐色文字（`#8C887E`）
- 背景白色半透明 + 顶部分隔线
- 使用 `pb-safe-bottom`（`env(safe-area-inset-bottom, 0px)`）适配 safe-area
- 路由是唯一真相源，不使用 `useState` 管理 currentTab

### 4.3 BottomTabBar 图标

四个 Tab 图标均为手绘风 SVG：

| Tab | 图标组件 | 手绘主题 |
|-----|---------|---------|
| 今日 | `IconToday` | 日历 / 指南针 / 小旗 |
| 足迹 | `IconFootprint` | 脚印 |
| 成长 | `IconGrowth` | 小芽 / 上升线 |
| 我的 | `IconMe` | 用户头像轮廓 |

---

## 5. 四 Tab 信息架构

### 5.1 Tab 总览

```
┌──────────┬──────────┬──────────┬──────────┐
│  今 日   │  足 迹   │  成 长   │  我 的   │
│  Today   │Footprint │  Growth  │    Me    │
├──────────┼──────────┼──────────┼──────────┤
│ 空状态    │ 空状态    │ 总结卡片  │ 账号卡    │
│ 目标输入  │ 历史列表  │ 统计四卡  │ 同步状态  │
│ 当前任务  │ 日期筛选  │ AI 建议   │ 设置列表  │
│ 后续任务  │ 展开详情  │ 鼓励文案  │ 退出登录  │
│ 执行陪伴  │          │          │          │
└──────────┴──────────┴──────────┴──────────┘
```

### 5.2 今日 Tab（Today）

**核心定位**：用户每天打开 App 看到的第一屏，完成"输入目标 → 查看任务 → 执行任务 → 反馈进度"闭环。

**三种视图状态**：

| 状态 | 视图组件 | 条件 |
|------|---------|------|
| 空状态 | `TodayEmptyView` | 未输入目标、无今日任务 |
| 任务列表 | `TodayTaskView` | 已生成任务 |
| 执行陪伴 | `TaskCompanionView` | 点击当前任务「陪我做这一步」 |

**TodayEmptyView 结构**（从上到下）：
1. 右上角设置图标
2. 问候文案：「早上好，今天我们一起向前一点点」
3. 大标题：「今天，想完成哪一小步？」
4. 纸飞机 + 星星装饰
5. GoalInputCard（输入框 +「迈出全新的一步」按钮）
6. 底部进度区：「今天走到了这里」+ 火焰装饰 + 完成数

**TodayTaskView 结构**（从上到下）：
1. 大标题：「已经开始了，今天慢慢来」
2. 副标题：「不用看完整清单，先把眼前这一小步做好。」
3. 总卡片（小目标卡 + 进度卡）
4. CurrentTaskCard（黄色强调、「先做这一件」、任务标题 + 补充信息 +「陪我做这一步」+「我完成了」）
5. UpcomingTaskList（「后面再做」、locked 任务列表、每项右侧「陪我」按钮）

### 5.3 足迹 Tab（Footprint）

**两种视图状态**：

| 状态 | 视图组件 | 条件 |
|------|---------|------|
| 空状态 | `FootprintEmptyView` | 无历史记录 |
| 历史列表 | `FootprintHistoryView` | 有历史记录 |

**FootprintEmptyView 结构**：
- 纸飞机 + 脚印插画
- 大标题：「这里还在等第一步」
- 文案：「完成一次今日行动后，这里会自动留下足迹。」
- 主按钮：「去完成今天这一小步」→ 切换到今日 Tab

**FootprintHistoryView 结构**：
- 标题：「走过的小步」+ 副标题
- HistoryRangeTabs（最近 7 天 / 最近 30 天 Segment Control）
- 列表标题：「最近留下的足迹」
- HistoryCard × N（日期、目标、完成率标签、进度条、展开/收起步骤列表）

### 5.4 成长 Tab（Growth）

**核心定位**：以低压力方式展示用户最近的行动情况和 AI 温柔建议。

**GrowthView 结构**：
1. 标题：「最近的小步」+ 副标题 + 小芽装饰
2. 总结卡片：「这几天」+ 状态标签（如「有在继续」）+ 总结文案
3. 统计区标题：「留下的小脚印」
4. 四个 GrowthStatCard（今天完成率+环形图、这周完成率+折线图、连续天数、总完成数）
5. GrowthSuggestionCard（AI 建议标题 + 文案 +「看看下次怎么开始」按钮）
6. 底部文案：「能回来继续，就已经很好了。」

### 5.5 我的 Tab（Me）

**MeView 结构**：
1. 标题：「我的小空间」+ 副标题 + 叶子装饰
2. AccountCard（头像占位圆、邮箱、登录状态标签）
3. SyncCard（记录保存方式、账号同步状态、说明文案）
4. SettingsList（隐私与数据说明、说说你的想法、当前版本、清除本机缓存、退出当前账号）
5. 危险操作（清除缓存、退出账号）使用浅红/棕红文字，点击需二次确认

---

## 6. 任务执行陪伴页（保留底部 Tab）

### 6.1 核心原则

任务执行页**不是**独立全屏页面，它属于今日 Tab 内的一个视图层级，**必须保留底部 Tab**。

```
AppShell
├── TodayView（isExecuting = true 时渲染 TaskCompanionView）
│   └── TaskCompanionView
│       ├── 顶部：页面标题「陪你走这一步」+「先退出」按钮
│       ├── 当前任务卡：「现在这件事」+ 状态标签「正在做」
│       ├── AI 当前步骤卡：纸飞机图标 +「先做这一小步」+ 步骤列表
│       └── 反馈输入区：textarea +「发给 AI」按钮
└── BottomTabBar  ← 始终可见！
```

### 6.2 为什么不隐藏底部 Tab

- 任务执行是"今日"Tab 内的子视图，不是独立页面
- 保留底部 Tab 让用户随时可以切换到足迹/成长/我的
- 隐藏 Tab 会造成"进入执行后回不去"的迷失感
- 与设计稿 `任务执行界面.png` 一致

### 6.3 AI 交互边界

AI（mock）可以：
- 给步骤、给模板、给检查清单、给短示例
- 判断是否"差不多可以过"
- 建议用户自己勾选完成

AI 不可以：
- 自动勾选任务
- 替用户提交最终结果
- 编造用户经历
- 跳到后续 locked 任务

### 6.4 反馈输入规则

- textarea 最大 300 字
- 空内容时「发给 AI」按钮 disabled
- mock 阶段：发送后更新 AI 当前步骤卡文案
- 不存长期对话
- 不显示聊天气泡历史（只显示当前 AI 反馈/当前步骤）
- **不是通用聊天软件**

---

## 7. 页面组件拆分

### 7.1 Auth 组件树

```
WelcomePage                   # 产品欢迎页
├── Logo「清行」
├── 品牌文案「慢一点，也在向前走」
├── 预览卡片（手帐风插画 +「行动中」贴纸）
├── PrimaryButton「开始使用」
└── SecondaryButton「已有账号，去登录」

OtpLoginPage                  # 验证码登录页
├── Logo「清行」
├── 标题「今天，也从一小步开始」
├── 登录卡片（Tab: 验证码登录 / 密码登录）
│   ├── TextInput（邮箱地址）
│   └── PrimaryButton「进入我的行动手账」
└── 链接「创建我的行动记录」→ RegisterPage

PasswordLoginPage             # 密码登录页
├── 标题「开始留下行动足迹」
├── 装饰（纸张纹理、叶子、点状装饰）
├── TextInput（邮箱地址）
├── TextInput（输入密码）
├── PrimaryButton「开始我的行动记录」
└── 链接「直接回来」→ OtpLoginPage

RegisterPage                  # 注册页
├── 标题「开始留下行动足迹」
├── TextInput（邮箱地址）
├── TextInput（6位验证码）
├── TextInput（设置密码）
├── TextInput（再次输入密码）
├── PrimaryButton「开始我的行动记录」
└── 链接「已有行动记录？直接回来」→ OtpLoginPage
```

### 7.2 今日 Tab 组件树

```
app/today/page.tsx
└── TodayView（状态容器）
    ├── TodayEmptyView          # goal 为空时
    │   ├── 问候文案 + 标题
    │   ├── IconPaperPlane + IconStar
    │   └── GoalInputCard
    │       ├── TextInput（placeholder: 例如：准备明天的面试）
    │       └── PrimaryButton「迈出全新的一步」
    │
    ├── TodayTaskView           # 已生成任务时
    │   ├── 标题 + 副标题 + IconStar
    │   ├── PaperCard（总卡片：小目标卡 + 进度卡）
    │   ├── CurrentTaskCard     # 黄色强调
    │   │   ├── 任务标题 + 补充信息（关键词 + 预计时间）
    │   │   ├── PrimaryButton「陪我做这一步」
    │   │   └── SecondaryButton「我完成了」
    │   └── UpcomingTaskList    # 弱化展示
    │       └── 后续任务 × N（locked 状态 +「陪我」按钮）
    │
    └── TaskCompanionView       # isExecuting = true 时
        ├── 标题「陪你走这一步」+「先退出」
        ├── PaperCard（当前任务卡：「现在这件事」+「正在做」标签）
        ├── PaperCard（AI 步骤卡：IconPaperPlane +「先做这一小步」+ 步骤列表）
        └── 反馈输入区（textarea +「发给 AI」+ 辅助文案）
```

### 7.3 足迹 Tab 组件树

```
app/footprint/page.tsx
└── FootprintView（状态容器）
    ├── FootprintEmptyView      # 无历史记录时
    │   ├── 插画（纸飞机 + 脚印）
    │   └── PrimaryButton「去完成今天这一小步」
    │
    └── FootprintHistoryView    # 有历史记录时
        ├── 标题 + 副标题 + 足迹装饰
        ├── HistoryRangeTabs    # 最近7天 / 最近30天
        └── HistoryCard × N
            ├── 日期 + 目标 + 完成率标签 + 进度条
            └── 展开区：那天的小步骤列表
```

### 7.4 成长 Tab 组件树

```
app/growth/page.tsx
└── GrowthView
    ├── 标题 + 副标题 + IconLeaf
    ├── PaperCard（总结卡片：「这几天」+ 状态标签 + 文案）
    ├── 统计区标题「留下的小脚印」
    ├── GrowthStatCard × 4    # 今天完成率、这周完成率、连续天数、总完成数
    ├── GrowthSuggestionCard   # AI 建议标题 + 文案 + PrimaryButton
    └── 底部鼓励文案
```

### 7.5 我的 Tab 组件树

```
app/me/page.tsx
└── MeView
    ├── 标题 + 副标题 + IconLeaf
    ├── AccountCard            # 头像占位、邮箱、登录状态
    ├── SyncCard               # 记录保存方式、同步状态、说明
    └── SettingsList           # 5 个设置项 + 退出登录
```

---

## 8. Mock Service 架构

### 8.1 设计原则

```
组件 ← props ← page.tsx ← service 层 ← mock 数据
 │                                    │
 ├─ 不直接引用 mock 数据               │
 ├─ 不直接写死数据                     │
 └─ 只通过 props 接收数据              │
```

**核心规则**：
- 页面组件**不能直接 import mockData.ts**
- 页面组件**不能直接在 JSX 中写死数据**
- 数据必须通过 service 层获取
- Service 层函数签名与未来真实 API 签名一致
- 每个 async 函数模拟网络延迟（200–500ms）

### 8.2 Service 函数签名

#### authService.mock.ts

```typescript
loginWithOtp(email: string): Promise<MockUser>
loginWithPassword(email: string, password: string): Promise<MockUser>
register(input: RegisterInput): Promise<MockUser>
logout(): Promise<void>
getCurrentUser(): Promise<MockUser | null>
```

#### taskService.mock.ts

```typescript
getTodayState(): Promise<TodayState>
generateTasks(goal: string): Promise<TodayState>
completeTask(taskId: string): Promise<TodayState>
getCompanionStep(taskId: string, feedback?: string): Promise<CompanionStep>
```

#### historyService.mock.ts

```typescript
getHistory(range: "7d" | "30d"): Promise<HistoryItem[]>
```

#### growthService.mock.ts

```typescript
getGrowthStats(): Promise<GrowthStats>
```

---

## 9. 手绘风 SVG 图标方案

### 9.1 核心原则

所有图标必须为**手绘风 SVG**。不允许使用 Material Icons、Heroicons、Lucide 等标准 SaaS 图标库作为最终视觉效果。

### 9.2 实现策略

本阶段（mock 前端）采用**自绘简化 SVG** 方案：

- 每个图标为独立的 React 组件（`components/icons/` 下）
- SVG 使用 `stroke` 而非 `fill` 为主，模拟手绘线条感
- 线条使用 `stroke-linecap="round"` + `stroke-linejoin="round"`
- 轻微不规则路径（避免完美几何形状）
- 颜色通过 `currentColor` 继承，支持激活/未激活状态切换

### 9.3 图标清单

| 图标 | 组件名 | 用途 | 尺寸 |
|------|--------|------|------|
| 今日 | `IconToday` | 底部 Tab | 28×28 |
| 足迹 | `IconFootprint` | 底部 Tab | 28×28 |
| 成长 | `IconGrowth` | 底部 Tab | 28×28 |
| 我的 | `IconMe` | 底部 Tab | 28×28 |
| 纸飞机 | `IconPaperPlane` | 空状态装饰、AI 步骤卡 | 48×48 |
| 星星 | `IconStar` | 页面装饰 | 24×24 |
| 叶子 | `IconLeaf` | 成长/我的页装饰 | 24×24 |
| 火焰 | `IconFire` | 进度装饰 | 24×24 |
| 完成勾 | `IconCheck` | 任务完成 | 20×20 |
| 设置 | `IconSettings` | 设置入口 | 24×24 |
| 箭头 | `IconArrow` | 展开/收起、返回 | 20×20 |

### 9.4 图标组件模板

```typescript
// 手绘风 SVG 图标示例结构
interface IconProps {
  size?: number;
  active?: boolean;  // true = 深蓝, false = 灰褐
}

export function IconToday({ size = 28, active = false }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      stroke={active ? "#0F3155" : "#8C887E"}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* 手绘风路径 */}
    </svg>
  );
}
```

---

## 10. UI 风格约束与视觉 Token

### 10.1 颜色系统

与 UI Spec 对齐：

| Token | 色值 | 用途 |
|-------|------|------|
| 暖米白背景 | `#F7F3EA` | 全局页面背景 |
| 纸张卡片 | `#FFFDF6` / `#FEFAEF` | 卡片表面 |
| 卡片描边 | `#E7DDC8` | 温柔边框 |
| 深蓝主色 | `#0F3155` | 标题、Tab 激活、主按钮文字/背景 |
| 深蓝按钮 | `#0B3763` | 主按钮背景 |
| 主文字深褐 | `#211A16` | 标题、正文 |
| 次级文字 | `#7A756B` | 辅助说明 |
| 弱文字 | `#8A8278` | placeholder、禁用态 |
| 底部未激活 | `#8C887E` | Tab 未激活 |
| 暖黄任务卡 | `#F6E8BD` | 当前任务强调 |
| 绿色同步 | `#7FA27F` | 已同步状态 |
| 危险色 | `#C44E4E` | 清除缓存、退出登录（温柔红，非强警告） |

### 10.2 圆角与阴影

与 UI Spec 对齐：

| 元素 | 圆角 | 阴影 |
|------|------|------|
| 大卡片（PaperCard） | 28–36px | `0 2px 16px rgba(0,0,0,0.04)` |
| 输入框（TextInput） | 28–999px（胶囊） | 轻微内阴影或无 |
| 主按钮（PrimaryButton） | 999px（全圆角） | 底部轻阴影 |
| 小标签 | 999px | 无或轻阴影 |
| 底部 Tab | 顶部分隔线 | 无强阴影 |

### 10.3 间距与尺寸

| 项目 | 规格 |
|------|------|
| 设计基准宽度 | 390px |
| 页面最大宽度 | `max-width: 430px` |
| 最小支持宽度 | 360px |
| 页面左右内边距 | 24–32px |
| 底部导航高度 | 76–92px（含 safe-area） |
| 主按钮高度 | 56–68px |
| 输入框高度 | 56–68px |
| 触控最小高度 | 44px |

### 10.4 字体

```css
/* 系统字体兜底 */
font-family: system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;

/* 标题可选衬线 */
font-family: Georgia, "Songti SC", "STSong", serif;
```

---

## 11. 通用 UI 组件库

### 11.1 PaperCard

```typescript
interface PaperCardProps {
  children: React.ReactNode;
  variant?: "white" | "warm" | "yellow";  // 白 / 暖白 / 暖黄
  padding?: "normal" | "large";
  className?: string;
}
```

样式：暖白背景、28–36px 圆角、浅米色边框、柔和阴影、24–32px 内边距。

### 11.2 PrimaryButton

```typescript
interface PrimaryButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}
```

样式：深蓝背景 `#0B3763`、白色文字、999px 圆角、56–68px 高度、轻微阴影。
loading 态显示「正在整理今天的小步...」等文案。

### 11.3 SecondaryButton

```typescript
interface SecondaryButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}
```

样式：白色/米白背景、深蓝文字、999px 圆角、浅边框。

### 11.4 TextInput

```typescript
interface TextInputProps {
  type?: "text" | "email" | "password" | "number";
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  icon?: React.ReactNode;  // 左侧图标
  error?: string;
  disabled?: boolean;
}
```

样式：圆角胶囊、浅蓝灰边框、左侧可选图标、placeholder 灰色、高度约 60px。

---

## 12. 后续真实后端接入点

### 12.1 接入时机

当以下条件全部满足后，进入 Phase B：
1. 四 Tab UI 验收通过
2. 所有页面交互验收通过
3. Mock service 接口签名稳定
4. 用户确认 App 信息架构合理

### 12.2 替换对照表

| mock service | 后续真实能力 |
|-------------|-------------|
| `authService.mock.ts` | Supabase Auth（`@supabase/ssr`） |
| `taskService.mock.ts` | `/api/generate-tasks`、`/api/task-group/*`、`/api/task-companion` |
| `historyService.mock.ts` | `/api/task-groups/history` |
| `growthService.mock.ts` | `/api/task-groups/stats`、`/api/task-groups/review` |

**关键约束**：页面组件不改，只替换 service 实现。

---

## 13. 后续合并回主项目路由的迁移路径

### 13.1 三步走

```
Phase A（当前）         Phase B（后续）         Phase C（后续）
apps/mobile-app/        apps/mobile-app/       src/app/app/
独立开发                对接真实 API            合并替换
Mock Service           验证数据流              清理旧组件
```

### 13.2 Phase C 合并步骤

1. 抽取 `components/ui/` 和 `components/icons/` → `src/components/app/`
2. 替换路由：`src/app/app/page.tsx` 改为渲染 AppShell + TodayView
3. 替换 service：删除 mock service，改用现有 hooks
4. 清理旧组件：移除 MainWorkspace 中不再需要的旧视图
5. 验证：确保旧功能在新 App Shell 中正常运行

### 13.3 合并时的约束

- 不出现两个 AppShell
- 不出现两套底部导航
- 不出现 mock 数据
- 所有现有 API Route 不变

---

## 14. 不允许出现的设计偏差

Codex 实现时必须避免：

1. 把旧 `/app` 页面套进新壳
2. 出现双重 AppShell
3. 底部 Tab 文案改成「记录」而不是「足迹」
4. 把「成长」合并进「足迹」
5. 把任务执行页做成通用聊天页面
6. 在任务执行页显示聊天气泡长列表
7. 页面组件直接写死所有 mock 数据
8. 页面风格变成强紫色或通用 SaaS 风
9. 登录页风格与主 App 风格割裂
10. 任务列表首屏看不到当前任务
11. 后续 locked 任务过于抢眼
12. 「我完成了」由 AI 自动触发
13. 提前接真实 API
14. 修改根项目 `src/**`
15. 使用 Material Icons / Heroicons 等标准图标库
16. 底部 Tab 在任务执行页消失
17. 「开始使用」直接进入注册页（必须进入登录页）
18. 对外展示名称使用「AI Todo」而非「清行」

---

> **文档结束**
>
> **下一文档**：[`Frontend-Execution-Plan.md`](Frontend-Execution-Plan.md) — Codex 分批实现操作手册
>
> **关联文档**：
> - [UI-Spec-Mobile-App.md](UI-Spec-Mobile-App.md) — 视觉与交互规格
> - [项目级架构决策](../../../docs/Architecture-V3.0A-Frontend-Isolation.md) — 为什么做前端隔离
