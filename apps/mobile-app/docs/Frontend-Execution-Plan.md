# Frontend-Execution-Plan — 清行 手机 App 前端分批执行方案

> **状态**：执行方案阶段。**只写文档，不写代码。**
> **所属工程**：`apps/mobile-app/`
> **前置文档**：[Frontend-Architecture.md](Frontend-Architecture.md) | [UI-Spec-Mobile-App.md](UI-Spec-Mobile-App.md) | [项目级架构决策](../../../docs/Architecture-V3.0A-Frontend-Isolation.md)
> **定位**：Codex 分批实现「清行」手机 App 前端的精确操作手册。
> **品牌名**：对外 UI 统一使用「清行」。
> **设计日期**：2026-07-08

---

## 目录

- [0. 总览：六批实现计划](#0-总览六批实现计划)
- [1. 全局约束与禁止清单](#1-全局约束与禁止清单)
- [2. Batch 1：基础工程壳](#2-batch-1基础工程壳)
- [3. Batch 2：登录 / 注册页面](#3-batch-2登录--注册页面)
- [4. Batch 3：今日页 / 任务执行页](#4-batch-3今日页--任务执行页)
- [5. Batch 4：足迹页](#5-batch-4足迹页)
- [6. Batch 5：成长页 / 我的页](#6-batch-5成长页--我的页)
- [7. Batch 6：统一视觉打磨](#7-batch-6统一视觉打磨)
- [8. 整体验收清单](#8-整体验收清单)
- [9. Code Review 重点](#9-code-review-重点)

---

## 0. 总览：六批实现计划

```
Batch 1: 基础工程壳
├─ package.json, configs, globals.css, layout.tsx
├─ types/app.ts, styles/tokens.ts
├─ data/mockData.ts（全部 mock 数据）
├─ services/（全部 service 层）
├─ components/ui/（PaperCard, PrimaryButton, SecondaryButton, TextInput）
├─ components/icons/（全部手绘 SVG 图标）
├─ components/shell/（AppShell, BottomTabBar）
└─ 验证：npm run dev 启动，底部导航可见，Tab 切换正常

Batch 2: 登录 / 注册页面
├─ components/auth/WelcomePage.tsx
├─ components/auth/OtpLoginPage.tsx
├─ components/auth/PasswordLoginPage.tsx
├─ components/auth/RegisterPage.tsx
├─ app/page.tsx（入口路由：未登录→欢迎页，已登录→/today）
└─ 验证：登录/注册流程完整，mock 登录后进入今日页

Batch 3: 今日页 / 任务执行页
├─ components/today/TodayEmptyView.tsx
├─ components/today/GoalInputCard.tsx
├─ components/today/TodayTaskView.tsx
├─ components/today/CurrentTaskCard.tsx
├─ components/today/UpcomingTaskList.tsx
├─ components/today/TaskProgressCard.tsx
├─ components/companion/TaskCompanionView.tsx
├─ app/today/page.tsx
└─ 验证：空状态→输入目标→生成任务→执行陪伴→完成

Batch 4: 足迹页
├─ components/footprint/FootprintEmptyView.tsx
├─ components/footprint/FootprintHistoryView.tsx
├─ components/footprint/HistoryRangeTabs.tsx
├─ components/footprint/HistoryCard.tsx
├─ app/footprint/page.tsx
└─ 验证：空状态/历史列表/日期筛选/展开收起

Batch 5: 成长页 / 我的页
├─ components/growth/GrowthView.tsx
├─ components/growth/GrowthStatCard.tsx
├─ components/growth/GrowthSuggestionCard.tsx
├─ components/me/MeView.tsx
├─ components/me/AccountCard.tsx
├─ components/me/SyncCard.tsx
├─ components/me/SettingsList.tsx
├─ app/growth/page.tsx
├─ app/me/page.tsx
└─ 验证：统计卡/AI建议/设置/退出登录

Batch 6: 统一视觉打磨
├─ 间距/圆角/阴影一致性
├─ 移动端安全区适配
├─ 手绘 SVG 风格统一
├─ 视觉一致性检查
└─ 验证：lint + build + 手动验收清单
```

---

## 1. 全局约束与禁止清单

### 1.1 每批必做

- 完成后运行 `npm run lint`（在 `apps/mobile-app/` 下）
- 完成后运行 `npm run build`（在 `apps/mobile-app/` 下）
- 确认 `git diff --name-only` 不包含 `src/` 下任何文件

### 1.2 绝对禁止

| # | 禁止项 |
|---|--------|
| 1 | 修改 `src/**` 任何文件 |
| 2 | 修改根 `package.json`、`next.config.ts`、`tsconfig.json`、`tailwind.config.ts` |
| 3 | 修改 API Route |
| 4 | 修改 Supabase 配置 |
| 5 | 修改 AI prompts |
| 6 | 修改数据库 schema / migration |
| 7 | 页面组件直接 `import` mockData |
| 8 | 页面组件直接写死数据 |
| 9 | 出现双重 AppShell |
| 10 | 使用 Material Icons / Heroicons / Lucide 等标准图标库 |
| 11 | 底部 Tab 在任务执行页隐藏 |
| 12 | 「开始使用」直接进入注册页 |
| 13 | 对外展示名称使用「AI Todo」而非「清行」 |
| 14 | 提前接真实后端 / Supabase / AI API |
| 15 | 使用 `git add .` |

### 1.3 品牌规范

- HTML `<title>`：清行
- 页面标题、按钮文案中的产品名：清行
- 代码内部变量/文件名可保留 `ai-todo` / `AI Todo`

---

## 2. Batch 1：基础工程壳

### 2.1 目标

创建 `apps/mobile-app/` 独立 Next.js 工程，完成所有基础配置、类型、Mock 数据、Service 层、通用 UI 组件、手绘 SVG 图标和 AppShell。

### 2.2 新增文件清单（~30 个）

#### 2.2.1 工程配置（6 个）

| # | 文件 | 说明 |
|---|------|------|
| 1 | `apps/mobile-app/package.json` | 依赖：next, react, react-dom, tailwindcss, typescript |
| 2 | `apps/mobile-app/next.config.ts` | 最小配置 |
| 3 | `apps/mobile-app/tsconfig.json` | strict, paths: `@/*` → `./*` |
| 4 | `apps/mobile-app/tailwind.config.ts` | 含完整设计 Token |
| 5 | `apps/mobile-app/postcss.config.mjs` | tailwindcss + autoprefixer |
| 6 | `apps/mobile-app/.eslintrc.json` | `"extends": "next/core-web-vitals"` |

**package.json 核心依赖**：
```json
{
  "name": "qingxing-mobile",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint ."
  },
  "dependencies": {
    "next": "latest",
    "react": "latest",
    "react-dom": "latest"
  },
  "devDependencies": {
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "autoprefixer": "latest",
    "eslint": "latest",
    "eslint-config-next": "latest",
    "postcss": "latest",
    "tailwindcss": "^3.4.0",
    "typescript": "latest"
  }
}
```

不引入 `@supabase/ssr`、`@supabase/supabase-js`、AI 相关依赖。

**tailwind.config.ts 设计 Token**（与 UI Spec 对齐）：

```typescript
theme: {
  extend: {
    colors: {
      warm: {
        bg: "#F7F3EA",
      },
      brand: {
        blue: "#0F3155",
        "blue-dark": "#0B3763",
      },
      paper: {
        DEFAULT: "#FFFDF6",
        warm: "#FEFAEF",
        yellow: "#F6E8BD",
      },
      text: {
        primary: "#211A16",
        secondary: "#7A756B",
        tertiary: "#8A8278",
        inactive: "#8C887E",
      },
      danger: {
        soft: "#C44E4E",
      },
      sync: {
        green: "#7FA27F",
      },
    },
    borderRadius: {
      card: "28px",
      "card-lg": "36px",
      button: "999px",
      input: "999px",
      tag: "999px",
    },
    boxShadow: {
      card: "0 2px 16px rgba(0, 0, 0, 0.04)",
      "card-hover": "0 4px 20px rgba(0, 0, 0, 0.06)",
      button: "0 2px 8px rgba(0, 0, 0, 0.06)",
      "bottom-bar": "0 -1px 0 rgba(0, 0, 0, 0.04)",
    },
    fontFamily: {
      sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
      serif: ['Georgia', '"Songti SC"', '"STSong"', 'serif'],
    },
    maxWidth: {
      mobile: "430px",
    },
    padding: {
      "safe-bottom": "env(safe-area-inset-bottom, 0px)",
    },
  },
}
```

#### 2.2.2 类型与样式（2 个）

| # | 文件 | 说明 |
|---|------|------|
| 7 | `apps/mobile-app/types/app.ts` | 完整类型定义 |
| 8 | `apps/mobile-app/styles/tokens.ts` | 设计 Token 常量 |

**types/app.ts** 必须包含以下类型（与 UI Spec 数据结构严格对齐）：

```typescript
// ========== 任务相关 ==========
export type TaskStatus = "current" | "locked" | "completed";

export interface Task {
  id: string;
  title: string;
  details?: string[];         // 补充信息：["圈出 3 个关键词", "约 10 分钟"]
  estimatedMinutes?: number;
  status: TaskStatus;
  completedAt?: string;
}

export interface TodayState {
  goal: string;
  tasks: Task[];
  completedCount: number;
  totalCount: number;
}

// ========== 任务执行陪伴 ==========
export interface CompanionStep {
  taskId: string;
  taskTitle: string;
  stepTitle: string;          // "先做这一小步"
  steps: string[];            // 步骤列表
  closingText: string;        // 收束文案
}

// ========== 历史相关 ==========
export interface HistoryTask {
  title: string;
  completed: boolean;
}

export interface HistoryItem {
  id: string;
  dateLabel: string;          // "7月6日 周一"
  goal: string;
  completionRate: number;     // 67
  completedCount: number;
  totalCount: number;
  expanded: boolean;          // 默认展开/收起
  tasks: HistoryTask[];
}

export type HistoryRange = "7d" | "30d";

// ========== 成长统计 ==========
export interface GrowthStats {
  todayCompletionRate: number;    // 67
  weekCompletionRate: number;     // 58
  streakDays: number;             // 3
  totalCompleted: number;         // 26
  statusLabel: string;            // "有在继续"
  summaryText: string;
  suggestionTitle: string;        // "下次可以轻一点"
  suggestionText: string;
}

// ========== 认证相关 ==========
export interface MockUser {
  email: string;
  isLoggedIn: boolean;
  syncStatus: "synced" | "not_synced";
}

export interface RegisterInput {
  email: string;
  code: string;
  password: string;
  confirmPassword: string;
}

// ========== 页面状态 ==========
export type LoadingState = "idle" | "loading" | "success" | "error";
export type AuthScreen = "welcome" | "otp-login" | "password-login" | "register";
export type AppTab = "today" | "footprint" | "growth" | "me";
```

#### 2.2.3 Mock 数据（1 个）

| # | 文件 | 说明 |
|---|------|------|
| 9 | `apps/mobile-app/data/mockData.ts` | 全部 Mock 数据 |

**mockData.ts 必须包含的数据**（严格对齐 UI Spec 第 16 节）：

```typescript
import type { Task, HistoryItem, GrowthStats, MockUser, TodayState } from "@/types/app";

// ========== 用户 ==========
export const MOCK_USER: MockUser = {
  email: "user@example.com",
  isLoggedIn: true,
  syncStatus: "synced",
};

// ========== 今日任务 ==========
export const MOCK_TODAY_STATE: TodayState = {
  goal: "准备明天的数据分析面试",
  completedCount: 0,
  totalCount: 4,
  tasks: [
    {
      id: "task-1",
      title: "阅读面试岗位要求",
      details: ["圈出 3 个关键词", "约 10 分钟"],
      estimatedMinutes: 10,
      status: "current",
    },
    {
      id: "task-2",
      title: "准备 1 分钟自我介绍",
      estimatedMinutes: 15,
      status: "locked",
    },
    {
      id: "task-3",
      title: "整理简历项目经历",
      estimatedMinutes: 20,
      status: "locked",
    },
    {
      id: "task-4",
      title: "复习常见 SQL 问题",
      estimatedMinutes: 15,
      status: "locked",
    },
  ],
};

export const MOCK_EMPTY_TODAY: TodayState = {
  goal: "",
  completedCount: 0,
  totalCount: 0,
  tasks: [],
};

// ========== 足迹历史 ==========
export const MOCK_HISTORY: HistoryItem[] = [
  {
    id: "history-1",
    dateLabel: "7月6日 周一",
    goal: "准备数据分析面试",
    completionRate: 67,
    completedCount: 4,
    totalCount: 6,
    expanded: true,
    tasks: [
      { title: "圈出岗位关键词", completed: true },
      { title: "复习常见SQL问题", completed: true },
      { title: "模拟一次面试", completed: true },
      { title: "整理项目亮点", completed: false },
      { title: "更新简历", completed: false },
      { title: "发送感谢信", completed: true },
    ],
  },
  {
    id: "history-2",
    dateLabel: "7月5日 周日",
    goal: "整理简历项目经历",
    completionRate: 75,
    completedCount: 3,
    totalCount: 4,
    expanded: false,
    tasks: [],
  },
];

export const MOCK_EMPTY_HISTORY: HistoryItem[] = [];

// ========== 成长统计 ==========
export const MOCK_GROWTH: GrowthStats = {
  todayCompletionRate: 67,
  weekCompletionRate: 58,
  streakDays: 3,
  totalCompleted: 26,
  statusLabel: "有在继续",
  summaryText: "这几天你都有回来，已经往前走了一点点。",
  suggestionTitle: "下次可以轻一点",
  suggestionText: "不用一次安排太多。下次先从 2-3 个小步骤开始就好。",
};
```

#### 2.2.4 Service 层（5 个）

| # | 文件 | 说明 |
|---|------|------|
| 10 | `apps/mobile-app/services/authService.mock.ts` | 认证 Mock API |
| 11 | `apps/mobile-app/services/taskService.mock.ts` | 任务 Mock API |
| 12 | `apps/mobile-app/services/historyService.mock.ts` | 历史记录 Mock API |
| 13 | `apps/mobile-app/services/growthService.mock.ts` | 成长统计 Mock API |
| 14 | `apps/mobile-app/services/index.ts` | 统一导出 |

**service 函数签名**（所有函数返回 Promise，内部 await delay(200-500)）：

```typescript
// authService.mock.ts
loginWithOtp(email: string): Promise<MockUser>
loginWithPassword(email: string, password: string): Promise<MockUser>
register(input: RegisterInput): Promise<MockUser>
logout(): Promise<void>
getCurrentUser(): Promise<MockUser | null>

// taskService.mock.ts
getTodayState(): Promise<TodayState>
generateTasks(goal: string): Promise<TodayState>
completeTask(taskId: string): Promise<TodayState>
getCompanionStep(taskId: string, feedback?: string): Promise<CompanionStep>

// historyService.mock.ts
getHistory(range: HistoryRange): Promise<HistoryItem[]>

// growthService.mock.ts
getGrowthStats(): Promise<GrowthStats>
```

**Service 实现要点**：
- 每个函数用 `delay()` 模拟网络延迟
- Mock 登录：任意邮箱 + 验证码 `123456` / 密码任意 → 成功
- Mock 注册：校验两次密码一致 → 返回 MOCK_USER
- `generateTasks(goal)`: 接收 goal 字符串，返回 MOCK_TODAY_STATE（替换 goal 字段）
- `completeTask(taskId)`: 将指定 task 状态改为 `completed`，下一个 `locked` 改为 `current`
- `getCompanionStep(taskId, feedback?)`: 首次返回默认步骤；有 feedback 时更新步骤文案
- `getHistory(range)`: 根据 range 过滤 MOCK_HISTORY（30 天全返回，7 天返回最近条目）

#### 2.2.5 通用 UI 组件（5 个）

| # | 文件 | 说明 |
|---|------|------|
| 15 | `apps/mobile-app/components/ui/PaperCard.tsx` | 纸张卡片 |
| 16 | `apps/mobile-app/components/ui/PrimaryButton.tsx` | 深蓝主按钮 |
| 17 | `apps/mobile-app/components/ui/SecondaryButton.tsx` | 白底次按钮 |
| 18 | `apps/mobile-app/components/ui/TextInput.tsx` | 胶囊输入框 |
| 19 | `apps/mobile-app/components/ui/SectionTitle.tsx` | 分区标题 |

**PrimaryButton**：深蓝背景 `#0B3763`、白色文字、全圆角 `999px`、h-14~16、shadow-button。loading 态文字替换为「正在整理今天的小步...」。disabled 态降低不透明度。
**SecondaryButton**：白/米白背景、深蓝文字、全圆角、浅边框。
**TextInput**：圆角胶囊 `rounded-input`、h-14~16、左侧可选 icon、右侧可放"发送验证码"等操作区。error 时边框变红 + 下方红色提示文字。
**PaperCard**：暖白/暖黄背景、rounded-card 大圆角、shadow-card、p-6~8 内边距。

#### 2.2.6 手绘 SVG 图标（11 个）

| # | 文件 | 图标 |
|---|------|------|
| 20 | `apps/mobile-app/components/icons/IconToday.tsx` | 今日（日历/小旗） |
| 21 | `apps/mobile-app/components/icons/IconFootprint.tsx` | 足迹（脚印） |
| 22 | `apps/mobile-app/components/icons/IconGrowth.tsx` | 成长（小芽） |
| 23 | `apps/mobile-app/components/icons/IconMe.tsx` | 我的（用户轮廓） |
| 24 | `apps/mobile-app/components/icons/IconPaperPlane.tsx` | 纸飞机 |
| 25 | `apps/mobile-app/components/icons/IconStar.tsx` | 星星 |
| 26 | `apps/mobile-app/components/icons/IconLeaf.tsx` | 叶子 |
| 27 | `apps/mobile-app/components/icons/IconFire.tsx` | 火焰 |
| 28 | `apps/mobile-app/components/icons/IconCheck.tsx` | 完成勾 |
| 29 | `apps/mobile-app/components/icons/IconSettings.tsx` | 设置齿轮 |
| 30 | `apps/mobile-app/components/icons/IconArrow.tsx` | 箭头（展开/返回） |

**每个图标组件 Props**：
```typescript
interface IconProps {
  size?: number;      // 默认 28
  active?: boolean;   // true=深蓝(#0F3155), false=灰褐(#8C887E)
  className?: string;
}
```

**手绘风格要求**：
- 使用 `stroke` 为主（`strokeWidth={1.5}`），辅以最小 `fill`
- `strokeLinecap="round"` + `strokeLinejoin="round"`
- 路径避免完美几何形状（直线微弯、圆不完美）
- 颜色通过 `currentColor` 或 props 控制

#### 2.2.7 App Shell（2 个）

| # | 文件 | 说明 |
|---|------|------|
| 31 | `apps/mobile-app/components/shell/BottomTabBar.tsx` | 底部导航 |
| 32 | `apps/mobile-app/components/shell/AppShell.tsx` | App 根容器 |

**BottomTabBar**：
- 使用 `usePathname()` 判断当前路由，决定哪个 Tab 高亮
- 四个 `<Link href="/today" replace>` 按钮
- 每个按钮包含对应手绘 Icon 组件 + 文字
- 激活：`text-[#0F3155]`，未激活：`text-[#8C887E]`
- 固定在底部，`pb-safe-bottom`，白色背景 + 顶部分隔线
- 高度约 80px（含 safe-area）

**AppShell**：
- 包裹 `{children}` + `BottomTabBar`
- `max-w-mobile mx-auto` 居中
- `min-h-screen bg-warm-bg`
- children 区域 `pb-20`（给 BottomTabBar 留空间）
- 不做 auth 判断——auth 状态由顶层 page.tsx 决定

#### 2.2.8 路由页面（3 个）

| # | 文件 | 说明 |
|---|------|------|
| 33 | `apps/mobile-app/app/globals.css` | 全局样式 |
| 34 | `apps/mobile-app/app/layout.tsx` | 根布局（metadata: 清行） |
| 35 | `apps/mobile-app/app/page.tsx` | 入口路由 |

**app/layout.tsx**：
```typescript
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "清行",
  description: "慢一点，也在向前走",
};

export const viewport: Viewport = {
  themeColor: "#0F3155",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-warm-bg font-sans text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
```

**app/page.tsx**：入口路由根据 mock 登录状态分流：
- 已登录 → `router.replace("/today")`
- 未登录 → 渲染 `WelcomePage`
- 暂时不做真实 auth 状态检查，用 `useState` mock

**app/globals.css**：
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root { color-scheme: light; }

* {
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

html, body {
  margin: 0;
  min-height: 100%;
  overflow-x: hidden;
  background-color: #F7F3EA;
}

body {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
  -webkit-font-smoothing: antialiased;
}

html {
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
}
```

### 2.3 Batch 1 验证清单

- [ ] `cd apps/mobile-app && npm install` 无报错
- [ ] `npm run dev` 正常启动
- [ ] 浏览器访问 `localhost:3000` 不白屏
- [ ] 底部导航四个 Tab 全部可见
- [ ] 当前 Tab 高亮为深蓝，非当前为灰褐
- [ ] 点击 Tab 切换页面，URL 变化
- [ ] `npm run lint` 通过
- [ ] `npm run build` 通过

---

## 3. Batch 2：登录 / 注册页面

### 3.1 目标

实现完整 Auth 流程：欢迎页 → 验证码登录 → 密码登录 → 注册 → mock 登录成功进入今日页。

### 3.2 新增文件清单（4 个）

| # | 文件 | 组件 |
|---|------|------|
| 36 | `apps/mobile-app/components/auth/WelcomePage.tsx` | 产品欢迎页 |
| 37 | `apps/mobile-app/components/auth/OtpLoginPage.tsx` | 验证码登录页 |
| 38 | `apps/mobile-app/components/auth/PasswordLoginPage.tsx` | 密码登录页 |
| 39 | `apps/mobile-app/components/auth/RegisterPage.tsx` | 注册页 |

### 3.3 组件规格

#### WelcomePage.tsx

**Props**：
```typescript
interface WelcomePageProps {
  onNavigate: (screen: AuthScreen) => void;
}
```

**结构**：
- 顶部：Logo 文字「清行」（衬线字体）+ 右侧「登录」文字按钮
- 中部：大标题「慢一点，也在向前走」+ 副标题「不用完整计划，写下一句话，我会与你一起完成」+ 预览卡片（暖纸卡片 +「行动中」红色贴纸标签）
- 底部：PrimaryButton「开始使用」→ `onNavigate("otp-login")` + SecondaryButton「已有账号，去登录」→ `onNavigate("otp-login")`
- 底部装饰：蓝紫色手绘波纹装饰条

#### OtpLoginPage.tsx

**Props**：
```typescript
interface OtpLoginPageProps {
  onNavigate: (screen: AuthScreen) => void;
  onLoginSuccess: () => void;
}
```

**结构**：
- 顶部：Logo「清行」+ 大标题「今天，也从一小步开始」+ 副标题「登录后，昨天的行动还会在这里。」+ IconStar 装饰
- 中部登录卡片（PaperCard）：
  - 标题「继续今天的小步」+ 副标题
  - Tab 切换行：「验证码登录」（当前，深蓝下划线）/「密码登录」（点击 → `onNavigate("password-login")`）
  - 说明文案：「收一封邮件，就可以继续今天的记录。」
  - TextInput（邮箱地址）
  - PrimaryButton「进入我的行动手账」→ mock 登录成功 → `onLoginSuccess()`
- 底部：文案「第一次来？注册后，你的行动记录会被保存。」+ 链接「创建我的行动记录」→ `onNavigate("register")`

**表单校验**（mock）：
- 邮箱为空 → 提示「先写下邮箱地址。」
- 邮箱格式错误 → 提示「邮箱地址好像不太对。」
- mock 阶段不真实发送验证码，任意输入即可登录

#### PasswordLoginPage.tsx

**Props**：同 OtpLoginPage。

**结构**：
- 顶部：大标题「开始留下行动足迹」+ 副标题「不用一次完成很多，先保存今天这一小步。」+ 叶子/点状装饰
- 中部卡片：TextInput（邮箱地址）+ TextInput（输入密码，type="password"）+ PrimaryButton「开始我的行动记录」
- 底部：链接「直接回来」→ `onNavigate("otp-login")`

#### RegisterPage.tsx

**Props**：同 OtpLoginPage。

**结构**：
- 顶部：大标题「开始留下行动足迹」（同密码登录页风格）
- 中部卡片：TextInput（邮箱地址）+ TextInput（6位验证码，maxLength=6）+ TextInput（设置密码，type="password"）+ TextInput（再次输入密码，type="password"）+ PrimaryButton「开始我的行动记录」
- 底部：链接「已有行动记录？直接回来」→ `onNavigate("otp-login")`

**表单校验**：
- 邮箱为空/格式错误
- 验证码为空/不是 6 位
- 密码为空
- 两次密码不一致 → 提示「两次输入的密码不一样。」
- mock 阶段只做前端提示

### 3.4 入口路由逻辑（更新 app/page.tsx）

```
app/page.tsx 状态机：
┌─ authState === "guest" ─────────────────────────┐
│  ├─ authScreen === "welcome" → <WelcomePage>     │
│  ├─ authScreen === "otp-login" → <OtpLoginPage>  │
│  ├─ authScreen === "password-login" → <PasswordLoginPage> │
│  └─ authScreen === "register" → <RegisterPage>   │
└─ authState === "authenticated" → router.replace("/today") │
```

初始状态：`authState: "guest"`, `authScreen: "welcome"`。

`onLoginSuccess()` → 设 `authState: "authenticated"` → `router.replace("/today")`。

### 3.5 Batch 2 验证清单

- [ ] 产品欢迎页完整（Logo + 文案 + 预览卡片 + 按钮）
- [ ] 「开始使用」进入验证码登录页（非注册页）
- [ ] 验证码登录页 Tab 可切换到密码登录页
- [ ] 验证码登录页 → 输入邮箱 → 点击登录 → mock 成功 → 进入今日页
- [ ] 密码登录页 → 输入邮箱+密码 → 点击登录 → mock 成功 → 进入今日页
- [ ] 注册页四个输入框完整 + 校验提示
- [ ] 注册成功 → 进入今日页
- [ ] 所有页面风格统一（暖米白+深蓝），登录页与主 App 风格不割裂
- [ ] `npm run lint` 通过
- [ ] `npm run build` 通过

---

## 4. Batch 3：今日页 / 任务执行页

### 4.1 目标

实现今日 Tab 的完整闭环：空状态 → 输入目标 → 生成任务 → 当前任务卡 → 后续任务列表 → 执行陪伴页 → 完成推进。

### 4.2 新增文件清单（7 个）

| # | 文件 | 组件 |
|---|------|------|
| 40 | `apps/mobile-app/components/today/TodayEmptyView.tsx` | 今日空状态 |
| 41 | `apps/mobile-app/components/today/GoalInputCard.tsx` | 目标输入卡 |
| 42 | `apps/mobile-app/components/today/TodayTaskView.tsx` | 今日任务视图 |
| 43 | `apps/mobile-app/components/today/CurrentTaskCard.tsx` | 当前任务强调卡 |
| 44 | `apps/mobile-app/components/today/UpcomingTaskList.tsx` | 后续任务列表 |
| 45 | `apps/mobile-app/components/today/TaskProgressCard.tsx` | 今日进度卡 |
| 46 | `apps/mobile-app/components/companion/TaskCompanionView.tsx` | 任务执行陪伴 |

### 4.3 组件规格

#### TodayEmptyView.tsx

**Props**：
```typescript
interface TodayEmptyViewProps {
  goal: string;
  completedCount: number;
  totalCount: number;
  isGenerating: boolean;
  onGoalChange: (goal: string) => void;
  onGenerate: () => void;
  onNavigateToMe: () => void;
}
```

**结构**：
- 右上角 IconSettings → `onNavigateToMe()`
- 问候文案：「早上好，今天我们一起向前一点点」
- 大标题：「今天，想完成哪一小步？」
- IconPaperPlane + IconStar 装饰
- GoalInputCard：TextInput + PrimaryButton「迈出全新的一步」
- 底部进度区：「今天走到了这里」+ IconFire + 文案

**交互**：
- goal 为空时「迈出全新的一步」disabled
- 点击后调用 `onGenerate()`
- isGenerating 时按钮文案变为「正在整理今天的小步...」

#### GoalInputCard.tsx

**Props**：
```typescript
interface GoalInputCardProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  placeholder?: string;  // "例如：准备明天的面试"
}
```

PaperCard 包裹：TextInput（大号 placeholder）+ 分隔线 + 说明「不用想清全部，先写下一句话。」+ PrimaryButton。

#### TodayTaskView.tsx

**Props**：
```typescript
interface TodayTaskViewProps {
  todayState: TodayState;
  onCompleteTask: (taskId: string) => void;
  onStartCompanion: (taskId: string) => void;
}
```

**结构**：
- 大标题「已经开始了，今天慢慢来」+ 副标题 + IconStar
- PaperCard 总卡片（暖白）：
  - 小卡 1：今天的小目标（goal 摘要）
  - 小卡 2：今天走到这里（completedCount/totalCount + 进度条 + 鼓励文案）
- CurrentTaskCard（暖黄色 `bg-paper-yellow`）
- UpcomingTaskList

**状态**：
- 全部完成时显示完成反馈文案

#### CurrentTaskCard.tsx

**Props**：
```typescript
interface CurrentTaskCardProps {
  task: Task;
  onComplete: (taskId: string) => void;
  onStartCompanion: (taskId: string) => void;
}
```

**结构**（暖黄色 PaperCard `variant="yellow"`）：
- 标签「先做这一件」
- 任务标题（大号加粗）
- 补充信息行：`{task.details?.join(" · ")}` 或 `约 {task.estimatedMinutes} 分钟`
- PrimaryButton「陪我做这一步」→ `onStartCompanion(task.id)`
- SecondaryButton「我完成了」→ `onComplete(task.id)`

#### UpcomingTaskList.tsx

**Props**：
```typescript
interface UpcomingTaskListProps {
  tasks: Task[];  // 只包含 locked 状态的任务
  onCompanionClick: (taskId: string) => void;
}
```

**结构**：
- 标题「后面再做」
- 每个 locked task：标题 + 预估时间 +「陪我」文字按钮
- locked 任务弱化展示（灰色文字），「陪我」按钮点击提示「先完成眼前这一小步」
- 圆形未完成状态图标

#### TaskProgressCard.tsx

**Props**：
```typescript
interface TaskProgressCardProps {
  completedCount: number;
  totalCount: number;
}
```

进度条 + 数字 + 鼓励文案（根据进度变化）。

#### TaskCompanionView.tsx

**核心约束**：此页面**不隐藏 BottomTabBar**。它是 TodayView 内的子视图。

**Props**：
```typescript
interface TaskCompanionViewProps {
  task: Task;
  onBack: () => void;
  onComplete: (taskId: string) => void;
}
```

**State**：
```typescript
const [feedback, setFeedback] = useState("");
const [isSending, setIsSending] = useState(false);
const [currentStep, setCurrentStep] = useState<CompanionStep | null>(null);
```

**结构**：
- 顶部：「陪你走这一步」+ 右上角「先退出」→ `onBack()`
- 当前任务卡（PaperCard）：「现在这件事」+ 状态标签「正在做」+ 任务标题 + 说明「完成要不要打勾，最后由你决定。」
- AI 当前步骤卡（PaperCard）：
  - IconPaperPlane + 标题「先做这一小步」
  - 步骤列表（每个步骤一行）
  - 收束文案：「写完这三行，回来告诉我你写到哪了。」
- 反馈输入区：
  - 标题「把现在的情况告诉我」
  - TextInput（textarea 模式，maxLength=300，placeholder「写下你做到哪了、卡在哪里，或贴一小段草稿。」）
  - PrimaryButton「发给 AI」（空内容时 disabled）
  - 辅助文案：「不用写很多，一句话也可以」

**交互**：
- 点击「发给 AI」→ mock 更新 currentStep 中的步骤文案
- 首次进入时自动调用 `getCompanionStep(task.id)` 获取初始步骤
- 不显示聊天气泡历史——只显示当前步骤卡

### 4.4 更新 app/today/page.tsx

```typescript
"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { TodayEmptyView } from "@/components/today/TodayEmptyView";
import { TodayTaskView } from "@/components/today/TodayTaskView";
import { TaskCompanionView } from "@/components/companion/TaskCompanionView";
import { getTodayState, generateTasks, completeTask } from "@/services/taskService.mock";
import type { TodayState, Task } from "@/types/app";

export default function TodayPage() {
  const [todayState, setTodayState] = useState<TodayState | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [executingTaskId, setExecutingTaskId] = useState<string | null>(null);

  // 加载今日状态
  useEffect(() => { getTodayState().then(setTodayState).finally(() => setLoading(false)); }, []);

  const executingTask = todayState?.tasks.find(t => t.id === executingTaskId) ?? null;

  return (
    <AppShell currentTab="today">
      {executingTask ? (
        <TaskCompanionView
          task={executingTask}
          onBack={() => setExecutingTaskId(null)}
          onComplete={async (id) => {
            await completeTask(id);
            setExecutingTaskId(null);
            setTodayState(await getTodayState());
          }}
        />
      ) : !todayState || todayState.tasks.length === 0 ? (
        <TodayEmptyView
          goal={todayState?.goal ?? ""}
          completedCount={todayState?.completedCount ?? 0}
          totalCount={todayState?.totalCount ?? 0}
          isGenerating={isGenerating}
          onGoalChange={(g) => setTodayState(prev => prev ? { ...prev, goal: g } : null)}
          onGenerate={async () => {
            setIsGenerating(true);
            setTodayState(await generateTasks(todayState?.goal ?? ""));
            setIsGenerating(false);
          }}
          onNavigateToMe={() => window.location.href = "/me"}
        />
      ) : (
        <TodayTaskView
          todayState={todayState}
          onCompleteTask={async (id) => {
            await completeTask(id);
            setTodayState(await getTodayState());
          }}
          onStartCompanion={(id) => setExecutingTaskId(id)}
        />
      )}
    </AppShell>
  );
}
```

### 4.5 Batch 3 验证清单

- [ ] 今日空状态完整（问候+标题+输入+IconPaperPlane+IconStar）
- [ ] 输入目标 → 点击「迈出全新的一步」→ 任务列表出现
- [ ] 当前任务卡突出（暖黄色卡片，比后续任务大）
- [ ] 后续任务弱化（灰色文字，locked 状态）
- [ ] 「陪我做这一步」→ 进入任务执行陪伴页
- [ ] 任务执行页保留底部 Tab
- [ ] 「我完成了」→ 当前任务完成，下一任务解锁
- [ ] 全部完成后显示完成反馈
- [ ] 反馈输入框可输入 +「发给 AI」mock 更新步骤
- [ ] 空内容时「发给 AI」disabled
- [ ] 执行陪伴页不像通用聊天软件（无气泡列表）
- [ ] 「先退出」→ 回到今日任务页
- [ ] `npm run lint` 通过
- [ ] `npm run build` 通过

---

## 5. Batch 4：足迹页

### 5.1 目标

实现足迹 Tab：空状态引导、历史列表、日期筛选、卡片展开收起。

### 5.2 新增文件清单（4+1 个）

| # | 文件 | 组件 |
|---|------|------|
| 47 | `apps/mobile-app/components/footprint/FootprintEmptyView.tsx` | 足迹空状态 |
| 48 | `apps/mobile-app/components/footprint/FootprintHistoryView.tsx` | 足迹历史视图 |
| 49 | `apps/mobile-app/components/footprint/HistoryRangeTabs.tsx` | 日期范围切换 |
| 50 | `apps/mobile-app/components/footprint/HistoryCard.tsx` | 单条历史卡片 |
| 51 | `apps/mobile-app/app/footprint/page.tsx` | 足迹路由页 |

### 5.3 组件规格

#### FootprintEmptyView.tsx

**Props**：
```typescript
interface FootprintEmptyViewProps {
  onGoToToday: () => void;
}
```

**结构**：纸飞机+脚印插画 + 大标题「这里还在等第一步」+ 文案 + PrimaryButton「去完成今天这一小步」→ `onGoToToday()`。

#### FootprintHistoryView.tsx

**State**：
```typescript
const [range, setRange] = useState<HistoryRange>("7d");
const [history, setHistory] = useState<HistoryItem[]>([]);
const [loading, setLoading] = useState(true);
```

**结构**：标题「走过的小步」+ 副标题 + 足迹装饰 + HistoryRangeTabs +「最近留下的足迹」+ HistoryCard × N。

#### HistoryRangeTabs.tsx

**Props**：
```typescript
interface HistoryRangeTabsProps {
  current: HistoryRange;
  onChange: (range: HistoryRange) => void;
}
```

Segment Control 样式：「最近 7 天」/「最近 30 天」，当前选中深蓝背景白字。

#### HistoryCard.tsx

**Props**：
```typescript
interface HistoryCardProps {
  item: HistoryItem;
  onToggleExpand: (id: string) => void;
}
```

**收起态**：日期 + 目标摘要 + 完成率标签（如「67%」）+ 进度条 + 完成数 +「看看那天做了什么」按钮。

**展开态**：收起态内容 +「那天的小步骤」标题 + 步骤列表（每项：完成勾 + 标题，未完成项灰色）+ 收起箭头。

### 5.4 Batch 4 验证清单

- [ ] 无历史记录时显示空状态引导
- [ ] 空状态「去完成今天这一小步」切换到今日 Tab
- [ ] 历史列表展示（日期、目标、完成率、进度条）
- [ ] 「最近 7 天」/「最近 30 天」切换
- [ ] 历史卡片可展开/收起
- [ ] 展开后显示每项步骤的完成状态
- [ ] `npm run lint` 通过
- [ ] `npm run build` 通过

---

## 6. Batch 5：成长页 / 我的页

### 6.1 目标

实现成长 Tab（统计卡 + AI 建议）和我的 Tab（账号 + 设置 + 退出）。

### 6.2 新增文件清单（7+2 个）

| # | 文件 | 组件 |
|---|------|------|
| 52 | `apps/mobile-app/components/growth/GrowthView.tsx` | 成长视图容器 |
| 53 | `apps/mobile-app/components/growth/GrowthStatCard.tsx` | 单个统计卡 |
| 54 | `apps/mobile-app/components/growth/GrowthSuggestionCard.tsx` | AI 建议卡 |
| 55 | `apps/mobile-app/components/me/MeView.tsx` | 我的视图容器 |
| 56 | `apps/mobile-app/components/me/AccountCard.tsx` | 账号信息卡 |
| 57 | `apps/mobile-app/components/me/SyncCard.tsx` | 同步状态卡 |
| 58 | `apps/mobile-app/components/me/SettingsList.tsx` | 设置项列表 |
| 59 | `apps/mobile-app/app/growth/page.tsx` | 成长路由页 |
| 60 | `apps/mobile-app/app/me/page.tsx` | 我的路由页 |

### 6.3 组件规格

#### GrowthView.tsx

**State**：
```typescript
const [stats, setStats] = useState<GrowthStats | null>(null);
const [loading, setLoading] = useState(true);
```

**结构**：
- 标题「最近的小步」+ 副标题「这几天的努力，都被好好留下了。」+ IconLeaf
- 总结 PaperCard：「这几天」+ 状态标签「有在继续」+ summaryText
- 统计区标题「留下的小脚印」
- 四个 GrowthStatCard：
  1. 「今天」+ completionRate% + 环形图（SVG）
  2. 「这周」+ weekCompletionRate% + 折线简化图
  3. 「连续」+ streakDays 天
  4. 「做完」+ totalCompleted 个
- GrowthSuggestionCard
- 底部文案「能回来继续，就已经很好了。」

#### GrowthStatCard.tsx

**Props**：
```typescript
interface GrowthStatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  variant: "ring" | "line" | "number" | "count";
  rate?: number;  // 用于 ring 变体
}
```

纸卡片，小尺寸（四列并排），图标/图表 + 数字 + 标签。

**环形图 SVG**（variant="ring"）：
```typescript
function ProgressRing({ rate }: { rate: number }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (rate / 100) * circumference;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r={radius} fill="none" stroke="#E7DDC8" strokeWidth="4" />
      <circle cx="28" cy="28" r={radius} fill="none" stroke="#0F3155" strokeWidth="4"
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 28 28)" />
      <text x="28" y="28" textAnchor="middle" dominantBaseline="central"
        fill="#0F3155" fontSize="12" fontWeight="600">{rate}%</text>
    </svg>
  );
}
```

#### GrowthSuggestionCard.tsx

**Props**：
```typescript
interface GrowthSuggestionCardProps {
  title: string;
  text: string;
  onAction: () => void;
}
```

PaperCard：标题 + 文案 + PrimaryButton「看看下次怎么开始」→ 切换到今日 Tab。

#### MeView.tsx

- AccountCard：头像占位圆 + email + 状态标签「已登录」
- SyncCard：标题「记录保存方式」+「账号同步」+ 绿色标签「已同步」+ 说明文案
- SettingsList 设置项（每项：左侧图标 + 文字 + 右侧箭头）：
  1. 隐私与数据说明
  2. 说说你的想法
  3. 当前版本：清行 V0.1
  4. 清除本机缓存（danger 样式，二次确认）
  5. 退出当前账号（danger 样式，二次确认）

#### SettingsList.tsx

退出登录逻辑：
- 点击「退出当前账号」→ 弹出确认弹窗（温柔风格）
- 确认 → `logout()` → `router.replace("/")` → 回到欢迎页
- 清除缓存同理，mock 阶段只弹 toast 确认，不真实清数据

### 6.4 Batch 5 验证清单

- [ ] 四个统计卡完整（今天/这周/连续/做完）
- [ ] 环形图 + 折线简化图渲染正常
- [ ] AI 建议卡显示完整
- [ ] 「看看下次怎么开始」跳回今日 Tab
- [ ] 底部鼓励文案显示
- [ ] 账号卡（邮箱+登录状态）显示
- [ ] 同步状态卡显示
- [ ] 5 个设置项显示
- [ ] 「清除本机缓存」+「退出当前账号」是危险样式（棕红文字）
- [ ] 退出登录有二次确认
- [ ] mock 退出后回到欢迎页
- [ ] `npm run lint` 通过
- [ ] `npm run build` 通过

---

## 7. Batch 6：统一视觉打磨

### 7.1 目标

不新增功能，只打磨视觉一致性和移动端体验。

### 7.2 打磨清单

#### 7.2.1 间距一致性

- [ ] 所有页面左右内边距统一 24px（`px-6`）
- [ ] 卡片内边距统一 24–32px（`p-6` ~ `p-8`）
- [ ] 组件间距统一 12–16px（`gap-3` ~ `gap-4`）
- [ ] BottomTabBar 高度在所有页面一致

#### 7.2.2 圆角一致性

- [ ] 所有 PaperCard 使用 `rounded-card`（28px）或 `rounded-card-lg`（36px）
- [ ] 所有 PrimaryButton / SecondaryButton 使用 `rounded-button`（999px）
- [ ] 所有 TextInput 使用 `rounded-input`（999px）
- [ ] 小标签使用 `rounded-tag`（999px）

#### 7.2.3 阴影一致性

- [ ] 所有 PaperCard 使用 `shadow-card`
- [ ] 所有 PrimaryButton 使用 `shadow-button`
- [ ] BottomTabBar 使用 `shadow-bottom-bar`

#### 7.2.4 移动端安全区

- [ ] BottomTabBar `pb-safe-bottom`
- [ ] 页面内容区 `pb-20`（给 Tab 留空间）
- [ ] 测试 safe-area-inset-bottom 在 iPhone 模拟器中生效

#### 7.2.5 手绘 SVG 风格统一

- [ ] 所有图标使用统一 `strokeWidth={1.5}`
- [ ] 所有图标 `strokeLinecap="round"` + `strokeLinejoin="round"`
- [ ] 激活态颜色统一 `#0F3155`，未激活统一 `#8C887E`
- [ ] 装饰性图标（纸飞机、星星、叶子、火焰）风格一致

#### 7.2.6 视觉一致性

- [ ] 所有页面背景色 `bg-warm-bg`（`#F7F3EA`）
- [ ] 标题字体风格一致（大标题用衬线 serif，正文用 sans）
- [ ] 文案温柔鼓励风格，无冷冰冰系统文案
- [ ] 所有页面在 360px–430px 宽度下不崩溃
- [ ] 触控区域 ≥44px

#### 7.2.7 交互打磨

- [ ] 按钮点击有视觉反馈（opacity / scale）
- [ ] 页面切换过渡自然（Next.js 路由切换）
- [ ] loading 态有视觉提示
- [ ] 空状态引导文案温暖

### 7.3 Batch 6 验证清单

- [ ] 所有颜色与 UI Spec 色值一致
- [ ] 所有圆角统一
- [ ] 所有阴影统一
- [ ] 移动端安全区正确
- [ ] 360px 宽度不崩溃
- [ ] 触控区域 ≥44px
- [ ] `npm run lint` 通过
- [ ] `npm run build` 通过

---

## 8. 整体验收清单

### 8.1 全局

- [ ] 背景是暖米白 `#F7F3EA`
- [ ] 主色是深蓝 `#0F3155`
- [ ] 卡片是纸张感（白色/暖白/暖黄）
- [ ] 圆角足够大（28–36px）
- [ ] 阴影柔和
- [ ] 底部 Tab 固定四个 Tab
- [ ] 四个 Tab 文案：今日 / 足迹 / 成长 / 我的
- [ ] 没有双重 App 壳
- [ ] 没有强紫色 SaaS 风
- [ ] 页面最大宽度 430px
- [ ] 所有对外展示名称使用「清行」

### 8.2 Auth

- [ ] 产品欢迎页完整 +「清行」Logo + 品牌文案
- [ ] 「开始使用」进入登录页（非注册页）
- [ ] 验证码登录页 Tab 切换
- [ ] 密码登录页
- [ ] 注册页四字段 + 校验
- [ ] mock 登录/注册后进入今日页

### 8.3 今日

- [ ] 空状态完整（IconPaperPlane + IconStar）
- [ ] 输入目标后可生成 mock 任务
- [ ] 当前任务卡首屏突出（暖黄色）
- [ ] 后续任务弱化
- [ ] 「陪我做这一步」进入执行页
- [ ] 「我完成了」推进进度
- [ ] 全部完成有反馈

### 8.4 任务执行

- [ ] 底部 Tab 保留
- [ ] 当前任务 + AI 步骤卡显示
- [ ] 反馈输入框 +「发给 AI」
- [ ] 空内容不能发送
- [ ] mock AI 更新步骤
- [ ] 「先退出」回今日
- [ ] 不像通用聊天软件

### 8.5 足迹

- [ ] 空状态完整
- [ ] 历史列表完整
- [ ] 最近 7 天 / 30 天切换
- [ ] 卡片展开/收起
- [ ] 完成率、进度条、步骤清单正确

### 8.6 成长

- [ ] 四张统计卡
- [ ] AI 建议卡
- [ ] 「看看下次怎么开始」可跳回今日
- [ ] 文案温柔

### 8.7 我的

- [ ] 账号卡 + 同步卡
- [ ] 5 个设置项
- [ ] 危险操作样式（棕红文字）
- [ ] mock 退出回欢迎页

### 8.8 工程

- [ ] `npm run lint` 通过
- [ ] `npm run build` 通过
- [ ] `git diff --name-only` 不包含 `src/` 下任何文件
- [ ] 未修改根 `package.json`
- [ ] 页面组件不直接 `import` mockData
- [ ] 数据通过 service 层获取

---

## 9. Code Review 重点

### 9.1 P0 必查

| # | 检查项 | 方法 |
|---|--------|------|
| 1 | 双重 AppShell | 全局搜索 `<AppShell` 使用次数——每个 page.tsx 最多一次 |
| 2 | 旧 /app 套壳 | 确认 BottomTabBar 内不含 MainWorkspace 或旧组件 |
| 3 | 组件直接写死数据 | `grep "MOCK_" components/` 必须为空 |
| 4 | 组件直接 import mockData | `grep "from.*mockData" components/` 必须为空 |
| 5 | src/ 被修改 | `git diff --name-only` 不包含 `src/` |
| 6 | 对外名称「清行」 | 检查 `<title>`、欢迎页、登录页、页面标题 |
| 7 | 标准图标库 | `grep -r "lucide\|heroicon\|@iconify\|material-icon" apps/mobile-app/` 必须为空 |
| 8 | 底部 Tab 在任务执行页隐藏 | 检查 TaskCompanionView 是否仍在 AppShell 内 |
| 9 | 「开始使用」进注册页 | 检查 WelcomePage 的 `onNavigate("otp-login")` |

### 9.2 P1 必查

| # | 检查项 | 方法 |
|---|--------|------|
| 10 | Service 接口签名 | 与本文档 2.2.4 对照 |
| 11 | Mock 数据结构 | 与 UI Spec 第 16 节对照 |
| 12 | 底部导航固定 | `position: fixed` + `bottom: 0` |
| 13 | Safe area | `pb-safe-bottom` + `env(safe-area-inset-bottom)` |
| 14 | 手机端宽度 | `max-w-mobile mx-auto` |
| 15 | Tab 切换 replace | `<Link href="..." replace>` |
| 16 | 手绘 SVG strokeWidth | 统一 1.5 |
| 17 | 颜色值与 UI Spec 一致 | 背景 `#F7F3EA`、深蓝 `#0F3155` |

### 9.3 P2 建议

| # | 检查项 |
|---|--------|
| 18 | 已完成任务折叠 |
| 19 | GoalInput 有任务时收起 |
| 20 | 历史卡片展开动画 |
| 21 | 按钮 loading 态 disabled |
| 22 | 触控区域 ≥44px |
| 23 | 空状态引导文案温柔 |

---

> **文档结束**
>
> **下一阶段**：ChatGPT 审查 → 通过后 Codex 按 Batch 1–6 顺序实现
>
> **关联文档**：
> - [Frontend-Architecture.md](Frontend-Architecture.md) — 前端内部架构设计
> - [UI-Spec-Mobile-App.md](UI-Spec-Mobile-App.md) — 视觉与交互规格
> - [项目级架构决策](../../../docs/Architecture-V3.0A-Frontend-Isolation.md)
