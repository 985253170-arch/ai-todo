# V2.2A：页面路由结构升级 架构方案

> **状态**：✅ 架构方案已完成，已同步产品策略变更（/app 必须登录）
> **依赖**：V2.1 Auth（Email+Password）✅ · V2.1-Follow-up SMTP ✅ · V2.1B OTP + Password ✅
> **定位**：将当前单页面结构拆分为 `/` `/login` `/app` 三页面路由结构，**不是 UI 美化，不是 Auth 重写**
> **上一文档**：[Architecture-V2.1B-OTP-Password.md](Architecture-V2.1B-OTP-Password.md) · [Execution-Plan-V2.1B-OTP-Password.md](Execution-Plan-V2.1B-OTP-Password.md)
> **设计日期**：2026-07-04

---

## 目录

- [一、当前页面结构分析](#一当前页面结构分析)
- [二、目标路由结构](#二目标路由结构)
- [三、匿名模式策略（核心决策）](#三匿名模式策略核心决策)
- [四、路由守卫设计](#四路由守卫设计)
- [五、文件结构设计](#五文件结构设计)
- [六、Auth 组件复用策略](#六auth-组件复用策略)
- [七、主工作台迁移方案](#七主工作台迁移方案)
- [八、Header 适配方案](#八header-适配方案)
- [九、数据兼容性](#九数据兼容性)
- [十、禁止事项](#十禁止事项)
- [十一、允许修改文件清单](#十一允许修改文件清单)
- [十二、禁止修改文件清单](#十二禁止修改文件清单)
- [十三、验收标准](#十三验收标准)
- [十四、风险与回滚](#十四风险与回滚)

---

## 一、当前页面结构分析

### 1.1 路由现状

当前项目只有**一个页面路由**：

```
src/app/
├── layout.tsx              ← 根布局（html/body 壳，无逻辑）
├── page.tsx                ← 唯一页面（/），190 行，承载全部功能
├── globals.css
├── auth/callback/route.ts  ← Auth 回调（V2.1 兼容，不动）
└── api/                    ← 全部 API Route（不动）
```

### 1.2 page.tsx 当前承载内容

`src/app/page.tsx`（190 行，"use client"）在一个页面内组装了：

```
┌──────────────────────────────────────────┐
│  Header                                  │  ← 登录状态 / 历史按钮 / AuthModal
├──────────────────────────────────────────┤
│  HeroSection                             │  ← "今天想推进哪个目标？"
├──────────────────────────────────────────┤
│  GoalInput                               │  ← 目标输入 + 生成按钮
├──────────────────────────────────────────┤
│  StatsBar                                │  ← 今日 / 7天 / 总计统计
├──────────────────────────────────────────┤
│  NewDayPrompt（条件）                     │  ← 跨天提示
├──────────────────────────────────────────┤
│  LoadingState（pageStatus === "loading"） │
├──────────────────────────────────────────┤
│  TaskList                                │  ← 任务列表 + 完成/清空/重新生成
├──────────────────────────────────────────┤
│  TaskReviewPanel（条件）                  │  ← AI 复盘
├──────────────────────────────────────────┤
│  HistoryPanel                            │  ← 历史记录（展开/收起）
└──────────────────────────────────────────┘
```

使用的 hooks：

| Hook | 用途 |
|------|------|
| `useTaskGroup` | 核心状态：目标输入、任务生成、勾选、清空、跨天 |
| `useTaskHistory` | 历史记录（懒加载分页） |
| `useTaskStats` | 统计数据（Today/7Day/Total） |
| `useTaskReview` | AI 复盘状态机 |

**关键事实**：
- 全部逻辑在一个 "use client" 组件中
- 无服务端组件、无服务端数据获取
- 匿名用户可完整使用全部功能（device_id 模式）
- Auth 通过 Header 中的 AuthModal 弹窗完成，不离开当前页面

### 1.3 当前 Auth 入口

```
用户点击 Header "登录"按钮
  → AuthModal 弹窗（遮罩层 + 居中弹窗）
  → 验证码登录 / 密码登录
  → 登录成功 → AuthModal 自动关闭
  → 仍在同一页面（/）
  → 触发匿名任务迁移
```

**特点**：登录不离开当前页面，无页面跳转。用户始终在 `/`。

### 1.4 当前页面存在的问题

| 问题 | 影响 |
|------|------|
| `/` 直接就是工作台，无 Landing Page | 新用户首次访问直接看到 GoalInput，没有产品介绍、价值说明 |
| 登录是弹窗而非页面 | URL 无法表达"正在登录"状态；无法直接分享 `/login` 链接 |
| 所有功能挤在一个页面 | URL 永远是 `/`，刷新后状态依赖 localStorage 恢复 |
| 无路由层级 | 产品首页、登录、工作台没有独立 URL，SEO / 分享 / 深度链接能力为零 |

---

## 二、目标路由结构

### 2.1 三页面路由

```
/          产品首页 / Landing Page
/login     登录 / 注册页面
/app       AI Todo 主工作台
```

### 2.2 `/` — Landing Page

**定位**：产品首页，面向**新用户**和**未登录回头客**。

**展示内容**：

```
┌──────────────────────────────────────────┐
│  [Logo] AI Todo              登录 | 开始使用 │  ← LandingHeader
├──────────────────────────────────────────┤
│                                          │
│         AI 行动教练                       │
│    让 AI 帮你把模糊目标拆成                │
│    今天能完成的小任务                      │
│                                          │
│     ✨ 输入目标，AI 自动拆解               │
│     📊 追踪完成情况                        │
│     🧠 AI 复盘与智能调整                   │
│                                          │
│     ┌────────────────────────────┐       │
│     │       免费开始使用           │       │  ← CTA → /login
│     └────────────────────────────┘       │
│                                          │
│     已有账号？登录 →                       │  ← → /login
│                                          │
└──────────────────────────────────────────┘
```

**关键设计**：
- 静态内容为主，不需要 hooks（除了判断登录态显示不同 CTA）
- "免费开始使用" → 跳转 `/login`（必须登录才能使用主工作台）
- "登录" → 跳转 `/login`
- 已登录用户访问 `/` → 自动跳转 `/app`
- 简洁、移动端优先

### 2.3 `/login` — 登录/注册页面

**定位**：承载当前 AuthModal 的登录能力，但是**页面形式**而非弹窗。

**展示内容**：

```
┌──────────────────────────────────────────┐
│  ← 返回    AI Todo                        │  ← LoginHeader（轻量）
├──────────────────────────────────────────┤
│                                          │
│          登录 AI Todo                     │
│    登录后可以多设备同步任务数据。           │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  [验证码登录]  |  密码登录           │  │  ← 复用 AuthModal 的 Tab 逻辑
│  │  ———————————                       │  │
│  │                                    │  │
│  │  ┌──────────────────────────────┐  │  │
│  │  │  you@example.com             │  │  │
│  │  └──────────────────────────────┘  │  │
│  │                                    │  │
│  │  ┌──────────────────────────────┐  │  │
│  │  │        发送验证码              │  │  │
│  │  └──────────────────────────────┘  │  │
│  │                                    │  │
│  └────────────────────────────────────┘  │
│                                          │
└──────────────────────────────────────────┘
```

**关键设计**：
- 不在遮罩层中——是独立页面，有完整 URL `/login`
- 复用 AuthModal 的表单逻辑（见 [§六](#六auth-组件复用策略)）
- 已登录用户访问 `/login` → 自动跳转 `/app`
- 登录成功后 → 跳转 `/app`
- 无 Header（或最轻量 Header：仅 Logo + "← 返回"链接）
- 移动端优先，卡片居中

### 2.4 `/app` — 主工作台

**定位**：AI Todo 核心功能页面。承载当前 `page.tsx` 的全部内容。

**展示内容**：与当前 `/` 页面**完全一致**的功能：

```
┌──────────────────────────────────────────┐
│  Header（完整版）                         │  ← 登录状态 / 历史按钮 / 登出
├──────────────────────────────────────────┤
│  HeroSection                             │
├──────────────────────────────────────────┤
│  GoalInput                               │
├──────────────────────────────────────────┤
│  StatsBar                                │
├──────────────────────────────────────────┤
│  TaskList                                │
├──────────────────────────────────────────┤
│  TaskReviewPanel                         │
├──────────────────────────────────────────┤
│  HistoryPanel                            │
└──────────────────────────────────────────┘
```

**关键设计**：
- 与当前 `/` 页面功能 100% 一致
- **必须登录才能访问**（未登录 → client-side 跳转 `/login`）
- 已登录用户正常使用全部功能
- Header 显示完整版（历史按钮、邮箱、登出、AuthModal、SetPasswordPrompt）

### 2.5 页面间导航关系

```
                    ┌──────────────┐
                    │      /       │
                    │  Landing Page │
                    └──────┬───────┘
                           │  "开始使用" / "登录"
                           │
                    ┌──────▼──────┐
                    │   /login    │
                    │   登录页     │
                    └──────┬──────┘
          登录成功跳转     │
                    ┌──────▼──────┐
                    │    /app     │
                    │   主工作台   │
                    └─────────────┘

已登录用户访问 / 或 /login → 自动跳转 /app
未登录用户访问 /app → 自动跳转 /login
```

---

## 三、匿名模式策略（核心决策）

### 3.1 最终决策：/app 必须登录

**V2.2A 采用方案 B：`/app` 仅已登录用户可访问。**

经过 ChatGPT 审查和用户手动验收后确认：当前产品阶段应优先保证数据安全和产品结构清晰，匿名模式虽降低了使用门槛，但也带来了数据丢失风险和产品定位模糊的问题。

### 3.2 方案对比（已决策）

#### 方案 A：`/app` 允许匿名访问（已否决）

```
/       → 所有人可访问
/login  → 未登录可访问，已登录跳转 /app
/app    → 所有人可访问（匿名 + 已登录）
```

| 维度 | 评价 |
|------|------|
| 用户体验 | ✅ 零门槛 |
| 产品定位 | ⚠️ Landing Page 到 App 的转化路径弱 |
| 实现复杂度 | ✅ 最低 |

#### 方案 B：`/app` 需要登录（✅ 已采用）

```
/       → 所有人可访问
/login  → 未登录可访问，已登录跳转 /app
/app    → 仅已登录可访问，未登录跳转 /login
```

| 维度 | 评价 |
|------|------|
| 用户体验 | ✅ 登录门槛低（OTP 验证码，输入邮箱即可） |
| 产品定位 | ✅ 产品结构清晰，数据安全可靠 |
| 实现复杂度 | ✅ 仅需 client-side useEffect + router.replace |
| 数据安全 | ✅ 所有任务数据关联到 user_id |

#### 方案 C：`/app` 允许匿名访问 + Header 强引导登录（已否决）

原推荐方案。经手动验收后用户确认不采用，改为方案 B。

### 3.3 方案 B 的具体实施

| 页面 | 匿名用户 | 已登录用户 |
|------|---------|-----------|
| `/` | 看到 Landing Page，所有 CTA 指向 `/login` | 自动跳转 `/app` |
| `/login` | 看到登录页，可使用验证码/密码登录 | 自动跳转 `/app` |
| `/app` | 自动跳转 `/login`（client-side redirect） | 完整使用所有功能 |

### 3.4 关于 device_id 的历史说明

`device_id` 机制仍然存在于代码中（`src/lib/device-id.ts`），用于以下场景：
- 登录后匿名任务迁移（`POST /api/task-group/migrate`）
- 历史兼容（V2.1B 之前产生的匿名数据）

但 **V2.2A 后 `/app` 不再允许匿名访问**，device_id 不再作为主访问策略。新用户必须登录才能使用主工作台。

### 3.5 不使用 middleware

**确认：V2.2A 不引入 middleware.ts。** `/app` 的登录守卫使用 client-side `useEffect` + `router.replace("/login")`，与 `/` 和 `/login` 的守卫模式一致。

---

## 四、路由守卫设计

### 4.1 总体策略：Client-Side Only

**不使用 Next.js middleware。** 原因：

| 维度 | Middleware | Client-Side useEffect |
|------|:---:|:---:|
| 复杂度 | 高——需处理 Edge Runtime 限制、Supabase session 读取、cookie 解析 | 低——复用现有 useAuth hook |
| 风险 | 中——middleware 在每次请求时运行，错误会导致全站不可用 | 低——只在页面级别生效，错误只影响当前页面 |
| 对现有代码的影响 | 大——需新增 middleware.ts + 适配 Supabase Auth | 小——在页面组件中加几行 useEffect |
| 适用场景 | 强安全要求的后端页面 | **当前产品阶段不需要** |

### 4.2 各页面守卫逻辑

#### `/` — Landing Page

```typescript
// src/app/page.tsx — Landing Page
"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LandingPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !isLoading) {
      router.replace("/app");
    }
  }, [user, isLoading, router]);

  // 渲染 Landing Page 内容
  // 如果 isLoading，显示骨架屏或 null
}
```

**逻辑**：已登录用户访问 `/` → 自动跳转 `/app`。

#### `/login` — 登录页

```typescript
// src/app/login/page.tsx — Login Page
"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LoginPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !isLoading) {
      router.replace("/app");
    }
  }, [user, isLoading, router]);

  // 渲染登录表单
  // 如果 isLoading，显示骨架屏
}
```

**逻辑**：已登录用户访问 `/login` → 自动跳转 `/app`。

#### `/app` — 主工作台

```typescript
// src/app/app/page.tsx — Main Workspace
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { MainWorkspace } from "@/components/MainWorkspace";

export default function AppPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return null;
  }

  return <MainWorkspace />;
}
```

**逻辑**：未登录用户访问 `/app` → 自动跳转 `/login`。

### 4.3 不需要 middleware

**确认：V2.2A 不引入 middleware.ts。**

- 三个页面的路由守卫逻辑均使用 client-side `useEffect` + `router.replace`
- 不涉及服务端重定向
- 不涉及 cookie 读取
- 不需要 Edge Runtime

### 4.4 不需要服务端组件

**确认：V2.2A 不移除任何 "use client" 指令，不引入服务端组件。**

- 所有页面保持 "use client"（与当前架构一致）
- 不做 SSR/SSG 优化（产品阶段不需要）
- 不做 SEO 优化（App 是工具型产品，不是内容站）

---

## 五、文件结构设计

### 5.1 推荐最小方案

```
src/app/
├── layout.tsx                          ← 不变（根布局）
├── globals.css                         ← 不变
├── page.tsx                            ← 修改：改为 Landing Page
├── login/
│   └── page.tsx                        ← 新增：/login 登录页
├── app/
│   └── page.tsx                        ← 新增：/app 主工作台
├── auth/callback/route.ts              ← 不变
└── api/                                ← 全部不变

src/components/
├── Header.tsx                          ← 修改：增加 variant 支持（Landing / App / Login）
├── MainWorkspace.tsx                   ← 新增：从 page.tsx 提取的主工作台内容
├── LandingPage.tsx                     ← 新增：Landing Page 内容组件
├── LoginPageContent.tsx                ← 新增：登录页表单内容（不包含遮罩层）
├── AuthModal.tsx                       ← 不变
├── SetPasswordPrompt.tsx               ← 不变
├── GoalInput.tsx                       ← 不变
├── TaskList.tsx                        ← 不变
├── StatsBar.tsx                        ← 不变
├── HistoryPanel.tsx                    ← 不变
├── TaskReviewPanel.tsx                 ← 不变
├── HeroSection.tsx                     ← 不变
├── LoadingState.tsx                    ← 不变
├── NewDayPrompt.tsx                    ← 不变
└── ...                                 ← 其他组件不变

src/hooks/                              ← 全部不变
src/lib/                                ← 全部不变
src/prompts/                            ← 全部不变
```

### 5.2 文件变更汇总

| # | 文件 | 操作 | 预计行数 | 说明 |
|---|------|:---:|:---:|------|
| 1 | `src/app/page.tsx` | **重写** | ~50 行 | Landing Page（从 190 行缩减） |
| 2 | `src/app/login/page.tsx` | **新增** | ~25 行 | /login 路由页面（薄壳） |
| 3 | `src/app/app/page.tsx` | **新增** | ~20 行 | /app 路由页面（薄壳） |
| 4 | `src/components/MainWorkspace.tsx` | **新增** | ~150 行 | 从现 page.tsx 提取核心内容 |
| 5 | `src/components/LandingPage.tsx` | **新增** | ~80 行 | Landing Page 视觉内容 |
| 6 | `src/components/LoginPageContent.tsx` | **新增** | ~150 行 | 登录表单（页面版，无遮罩） |
| 7 | `src/components/Header.tsx` | **修改** | ~15 行 | 增加 variant prop 适配多页面 |

**总计：7 个文件（4 新增 + 2 重写 + 1 修改），约 490 行变更。**

### 5.3 各文件详细设计

#### 文件 1：`src/app/page.tsx` — Landing Page（重写）

```typescript
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { LandingPage as LandingPageContent } from "@/components/LandingPage";

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // 已登录用户跳转 /app
  useEffect(() => {
    if (user && !isLoading) {
      router.replace("/app");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return null; // 或骨架屏
  }

  return (
    <main className="min-h-screen bg-[#F8FAFF]">
      <Header variant="landing" />
      <LandingPageContent />
    </main>
  );
}
```

**关键点**：
- 不再引入 useTaskGroup / useTaskHistory / useTaskStats / useTaskReview
- 不再渲染 GoalInput / TaskList / StatsBar / HistoryPanel / TaskReviewPanel
- 只有 useAuth（判断登录态）+ LandingPageContent
- isLoading 时返回 null（避免闪烁），因为已登录用户几乎立即跳转

#### 文件 2：`src/app/login/page.tsx` — /login 路由（新增）

```typescript
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { LoginPageContent } from "@/components/LoginPageContent";

export default function LoginPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // 已登录用户跳转 /app
  useEffect(() => {
    if (user && !isLoading) {
      router.replace("/app");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#F8FAFF]">
      <Header variant="login" />
      <LoginPageContent />
    </main>
  );
}
```

#### 文件 3：`src/app/app/page.tsx` — /app 路由（新增）

```typescript
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { MainWorkspace } from "@/components/MainWorkspace";

export default function AppPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return null;
  }

  return <MainWorkspace />;
}
```

**关键点**：
- 有登录守卫——未登录用户自动跳转 `/login`
- `isLoading` 和 `!user` 时 return null（避免闪烁）
- `variant` 不再需要传到这里——MainWorkspace 内部已传 `variant="app"` 给 Header

#### 文件 4：`src/components/MainWorkspace.tsx` — 主工作台（新增）

从当前 `page.tsx` 提取的核心内容。**除移除 Header 外，逻辑 100% 不变。**

```typescript
"use client";

import { useEffect, useRef } from "react";
// ... 所有现有 import（除 Header）
// useTaskGroup, useTaskHistory, useTaskStats, useTaskReview
// GoalInput, HeroSection, HistoryPanel, LoadingState, NewDayPrompt
// StatsBar, TaskReviewPanel, TaskList

export function MainWorkspace() {
  // ... 完全复制当前 page.tsx 中的所有逻辑
  // 包括：
  // - 所有 hooks 调用（useTaskGroup, useTaskHistory, useTaskStats, useTaskReview）
  // - scheduleStatsRefresh + timer refs
  // - 所有 handle*WithStats 包装函数
  // - history scroll useEffect
  // - cleanup useEffect

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F8FAFF] bg-gradient-to-b from-indigo-50 via-white to-sky-50 px-4 py-6 pb-[env(safe-area-inset-bottom,1rem)] text-slate-950 sm:px-6 sm:py-10">
      <div className="mx-auto flex max-w-[720px] flex-col gap-6 sm:gap-7">
        {/* Header 已移除——由 app/page.tsx 渲染 */}
        <HeroSection />
        <div className="grid gap-5">
          <GoalInput /* ... 所有 props */ />
          <StatsBar /* ... 所有 props */ />
          {/* NewDayPrompt, LoadingState, TaskList, TaskReviewPanel, HistoryPanel */}
          {/* ... 与当前 page.tsx 完全一致 */}
        </div>
      </div>
    </main>
  );
}
```

**提取策略**：
- 当前 `page.tsx` 的 L1-123（所有 hooks + 逻辑函数）→ 复制到 MainWorkspace
- 当前 `page.tsx` 的 L125-189（JSX return）→ 复制到 MainWorkspace，**移除 Header 行**
- 不重构、不优化、不改逻辑——纯搬迁

#### 文件 5：`src/components/LandingPage.tsx` — Landing Page 内容（新增）

```typescript
"use client";

import Link from "next/link";
import { UI_TEXT } from "@/lib/constants";

export function LandingPage() {
  return (
    <div className="mx-auto flex max-w-[720px] flex-col items-center px-4 pb-12 pt-16 text-center sm:px-6 sm:pt-24">
      {/* Hero */}
      <span className="rounded-full border border-indigo-100 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-600">
        {UI_TEXT.APP_ROLE}
      </span>
      <h1 className="mt-6 max-w-lg text-4xl font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl">
        让 AI 帮你把模糊目标
        <span className="bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent">
          拆成今天能完成的小任务
        </span>
      </h1>
      <p className="mt-4 max-w-md text-base leading-7 text-slate-500">
        {UI_TEXT.APP_TAGLINE}
      </p>

      {/* Features */}
      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        <FeatureCard icon="🎯" title="输入目标" description="一句话告诉 AI 你想推进什么" />
        <FeatureCard icon="📋" title="AI 拆解" description="自动生成 3-8 条今日可执行任务" />
        <FeatureCard icon="📊" title="追踪成长" description="查看完成统计，获得 AI 复盘反馈" />
      </div>

      {/* CTA */}
      <div className="mt-12 flex flex-col items-center gap-4">
        <Link
          href="/login"
          className="inline-flex min-h-12 items-center rounded-full bg-gradient-to-r from-indigo-600 to-blue-500 px-8 text-base font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5"
        >
          免费开始使用
        </Link>
        <Link
          href="/login"
          className="text-sm text-slate-400 transition hover:text-indigo-600"
        >
          已有账号？登录
        </Link>
      </div>

      {/* Footer note */}
      <p className="mt-12 text-xs text-slate-400">
        登录后使用全部功能。{UI_TEXT.PRIVACY_NOTICE}
      </p>
    </div>
  );
}

function FeatureCard({ icon, title, description }: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white/80 p-6 text-center shadow-sm">
      <span className="text-3xl">{icon}</span>
      <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}
```

**设计要点**：
- 纯展示组件，无 hooks（除 Link 外无客户端交互）
- 移动端优先（`sm:grid-cols-3` 桌面端三列，移动端单列）
- CTA 主按钮 → `/login`（必须登录才能使用）
- 次链接 → `/login`（已有账号）
- 底部注明"登录后使用全部功能"

#### 文件 6：`src/components/LoginPageContent.tsx` — 登录页内容（新增）

这是最需要谨慎设计的组件。**V2.2A 不做 Auth UI 重写**，因此此组件需要在不修改 AuthModal 的前提下，提供页面化的登录体验。

**方案选择**：

| 方案 | 描述 | 改动 | 风险 |
|------|------|:---:|:---:|
| A. 让 `/login` 自动打开 AuthModal | 页面加载后自动 `setIsAuthModalOpen(true)` | 最小 | 用户体验差（页面空白 → 弹窗出现） |
| B. 抽取 AuthForm，AuthModal 和 LoginPageContent 共享 | 从 AuthModal 中提取纯表单逻辑 | 中（需重构 AuthModal） | 违背"不重写 Auth UI"原则 |
| **C. 创建 LoginPageContent，独立实现表单** | 新组件使用与 AuthModal 相同的 useAuth hooks + constants，但独立实现表单 UI（无遮罩） | 约 150 行新代码 | 低（AuthModal 不动） |

**推荐方案 C**：LoginPageContent 是一个独立组件，使用相同的 `useAuth` hooks 和 `AUTH_TEXT` constants，但渲染为**页面卡片布局**（非弹窗）。

```typescript
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { AUTH_TEXT } from "@/lib/constants";
import { SetPasswordPrompt } from "@/components/SetPasswordPrompt";

type AuthMode = "otp" | "password";

export function LoginPageContent() {
  const router = useRouter();
  const { user, sendOtp, verifyOtp, signInWithPassword, setPassword } = useAuth();

  const [mode, setMode] = useState<AuthMode>("otp");
  const [email, setEmail] = useState("");
  const [password, setPasswordState] = useState("");
  const [token, setToken] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [showSetPasswordPrompt, setShowSetPasswordPrompt] = useState(false);

  // 登录成功后跳转 /app
  useEffect(() => {
    if (user) {
      if (!user.metadata?.password_set) {
        setShowSetPasswordPrompt(true);
      } else {
        router.replace("/app");
      }
    }
  }, [user, router]);

  // 重发倒计时
  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setInterval(() => {
      setResendSeconds((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);

  // 验证码自动提交
  useEffect(() => {
    if (token.length === 6 && otpSent && !isSubmitting) {
      void handleVerifyOtp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleSendOtp() {
    // ... (与 AuthModal 中逻辑相同)
  }

  async function handleVerifyOtp() {
    // ... (与 AuthModal 中逻辑相同)
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    // ... (与 AuthModal 中逻辑相同)
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setPasswordState("");
    setToken("");
    setMessage(null);
    setErrorMessage(null);
    setOtpSent(false);
    setResendSeconds(0);
  }

  // 如果正在加载 user 状态，返回 null
  // （useAuth 的 isLoading 需要暴露给此组件）

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* 标题 */}
        <h2 className="text-center text-xl font-bold text-slate-900">
          {AUTH_TEXT.MODAL_TITLE}
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500">
          {AUTH_TEXT.MODAL_DESCRIPTION}
        </p>

        {/* Tab 切换 + 表单（与 AuthModal 相同的 UI 结构，但无遮罩层） */}
        {/* ... 验证码登录 / 密码登录 Tab ... */}
        {/* ... 表单输入 ... */}
        {/* ... 错误/成功提示 ... */}
      </div>

      {/* 设置密码引导（复用现有 SetPasswordPrompt） */}
      <SetPasswordPrompt
        isOpen={showSetPasswordPrompt}
        onSetPassword={async (pw) => {
          await setPassword(pw);
          router.replace("/app");
        }}
        onSkip={() => router.replace("/app")}
        onClose={() => router.replace("/app")}
      />
    </div>
  );
}
```

**关键设计决策**：

1. **为什么不复用 AuthModal**：AuthModal 是为弹窗设计的（有遮罩层、关闭按钮、`isOpen`/`onClose` props）。直接复用到页面中需要 hack（如永久 `isOpen={true}`），且遮罩层和关闭按钮在页面场景中不合适。

2. **为什么不等 V2.2B 再创建 LoginPageContent**：V2.2A 需要 `/login` 路由可访问。如果用"空页面 + 自动打开 AuthModal"的临时方案，产品体验太差。LoginPageContent 只是 AuthModal 逻辑的页面化移植，不是 UI 美化——V2.2B 在此基础上做视觉升级。

3. **LoginPageContent 和 AuthModal 的关系**：
   - **代码不共享**（不抽取公共组件）——避免改动 AuthModal
   - **逻辑相同**——都使用 `useAuth` hooks + `AUTH_TEXT` constants
   - **UI 相似**——Tab 切换、表单布局、错误提示风格一致
   - **V2.2B 可以统一**——届时可以抽取 `AuthForm` 公共组件，AuthModal 和 LoginPageContent 都使用它

#### 文件 7：`src/components/Header.tsx` — Header 适配（修改）

增加 `variant` prop 以适配三个页面：

```typescript
interface HeaderProps {
  variant: "landing" | "login" | "app";
  // app variant 额外 props（可选）
  historyPanelId?: string;
  isHistoryOpen?: boolean;
  onToggleHistory?: () => void;
}
```

| Variant | 渲染内容 |
|---------|---------|
| `"landing"` | Logo + "登录"按钮（→ `/login`）+ "开始使用"按钮（→ `/app`） |
| `"login"` | Logo + "← 返回首页"链接（→ `/`）；无 AuthModal |
| `"app"` | 与当前 Header **完全相同**（登录状态、历史按钮、AuthModal、SetPasswordPrompt） |

**改动量**：
- 新增 `variant` prop + 条件渲染（约 15 行改动）
- `variant="app"` 时保留全部现有逻辑
- `variant="landing"` 和 `variant="login"` 是简化版 Header

**注意**：`variant="app"` 的 Header 会继续使用 AuthModal（弹窗方式）。匿名用户在 `/app` 点击"登录"后，AuthModal 弹窗出现，登录成功后自动关闭——与当前体验完全一致。

### 5.4 不需要修改的文件（确认清单）

以下文件在 V2.2A 中**零改动**：

```
✅ src/hooks/useAuth.ts           — Auth 逻辑不变
✅ src/hooks/useTaskGroup.ts      — 核心状态管理不变
✅ src/hooks/useTaskHistory.ts    — 历史不变
✅ src/hooks/useTaskStats.ts      — 统计不变
✅ src/hooks/useTaskReview.ts     — 复盘不变
✅ src/components/AuthModal.tsx   — 弹窗不变
✅ src/components/SetPasswordPrompt.tsx — 设置密码引导不变
✅ src/components/GoalInput.tsx   — 目标输入不变
✅ src/components/TaskList.tsx    — 任务列表不变
✅ src/components/StatsBar.tsx    — 统计栏不变
✅ src/components/HistoryPanel.tsx — 历史面板不变
✅ src/components/TaskReviewPanel.tsx — 复盘面板不变
✅ src/components/HeroSection.tsx — Hero 不变
✅ src/components/LoadingState.tsx — 加载态不变
✅ src/components/NewDayPrompt.tsx — 跨天提示不变
✅ src/lib/types.ts               — 类型定义不变（V2.2A 不需要新类型）
✅ src/lib/constants.ts           — 文案不变（复用现有 AUTH_TEXT / UI_TEXT）
✅ src/lib/supabase-server.ts     — 服务端不变
✅ src/lib/supabase-client.ts     — 客户端不变
✅ src/lib/device-id.ts           — device_id 不变
✅ src/lib/ai-client.ts           — AI 客户端不变
✅ src/lib/task-parser.ts         — 任务解析不变
✅ src/lib/review-parser.ts       — 复盘解析不变
✅ src/lib/stats-calculator.ts    — 统计计算不变
✅ src/lib/adjust-task-strategy.ts — 智能调整不变
✅ src/prompts/task-generation.ts — 任务生成 Prompt 不变
✅ src/prompts/task-review.ts     — 复盘 Prompt 不变
✅ src/app/api/*                  — 全部 API Route 不变
✅ src/app/auth/callback/route.ts — callback 不变
✅ src/app/layout.tsx             — 根布局不变
✅ src/app/globals.css            — 全局样式不变
✅ package.json                   — 依赖不变
✅ .env.local                     — 环境变量不变
✅ 数据库 schema / migration       — 零变更
```

---

## 六、Auth 组件复用策略

### 6.1 决策矩阵

| 场景 | 使用组件 | 说明 |
|------|---------|------|
| `/app` 中点击"登录" | **AuthModal**（弹窗） | 与当前体验完全一致——弹窗出现，登录成功后自动关闭 |
| `/login` 页面 | **LoginPageContent**（页面卡片） | 独立实现，无遮罩层，登录成功后跳转 `/app` |
| 登录后设置密码 | **SetPasswordPrompt**（复用） | `/app` 和 `/login` 两处都复用现有组件 |

### 6.2 为什么不抽取 AuthForm 公共组件

**V2.2A 不做这个重构。** 原因：

1. AuthModal 是 V2.1B 的核心交付物，已经过生产验证。重构它意味着重新测试所有 Auth 流程。
2. LoginPageContent 约 150 行，代码量小，独立维护成本低。
3. V2.2B 将专门做登录页独立设计——届时统一抽取 `AuthForm` 更合理（在 V2.2B 的架构方案中规划）。
4. 如果 V2.2A 抽取 AuthForm，AuthModal 需要同步改动——这违反了"不重写 Auth UI"的约束。

### 6.3 V2.2A vs V2.2B 的 Auth 边界

| 版本 | Auth 工作 |
|------|---------|
| **V2.2A** | 创建 LoginPageContent（页面版 Auth 表单），AuthModal 不动 |
| **V2.2B** | 重新设计登录页 UI、抽取 AuthForm 公共组件、统一 AuthModal 和 LoginPageContent |

**当前任务（V2.2A）只是让 `/login` 路由可访问，不是让登录页变漂亮。**

### 6.4 SetPasswordPrompt 在两处的复用

- `/app` 场景：登录成功后（AuthModal 关闭）→ Header 的 useEffect 检测到 `password_set !== true` → 弹出 SetPasswordPrompt（与当前一致）
- `/login` 场景：登录成功后 → LoginPageContent 的 useEffect 检测到 → 弹出 SetPasswordPrompt → 设置完成或跳过 → 跳转 `/app`

两处都使用同一个 `SetPasswordPrompt` 组件（零改动）。

### 6.5 useAuth Hook 是否需要修改

**不需要修改。** `useAuth` 的导出接口完全满足 V2.2A 的需求：
- `user` / `isLoading` — 判断登录态
- `sendOtp` / `verifyOtp` / `signInWithPassword` — 用于 LoginPageContent
- `setPassword` — 用于 SetPasswordPrompt
- `signOut` — 用于 Header

**注意**：LoginPageContent 需要 `isLoading` 来判断是否已完成初始 session 恢复。当前 `useAuth` 已导出 `isLoading`，无需修改。

---

## 七、主工作台迁移方案

### 7.1 迁移原则

**纯搬迁，不重构。**

- 不改 hooks 内部逻辑
- 不改组件 props
- 不改数据流
- 不改业务逻辑

### 7.2 具体搬迁内容

从 `src/app/page.tsx` → `src/components/MainWorkspace.tsx`：

| 原行数 | 内容 | 操作 |
|:---:|------|:---:|
| L1-17 | import 语句 | 复制（移除 Header import） |
| L19 | `export default function Home()` | 改为 `export function MainWorkspace()` |
| L20-22 | refs（historyPanelRef, timers） | 复制 |
| L23-42 | useTaskGroup 解构 | **完全复制** |
| L43 | useTaskHistory | **完全复制** |
| L44 | useTaskStats | **完全复制** |
| L45-51 | useTaskReview | **完全复制** |
| L53-70 | scheduleStatsRefresh | **完全复制** |
| L72-95 | handle*WithStats 包装函数 | **完全复制** |
| L97-123 | useEffect (history scroll + cleanup) | **完全复制** |
| L125-189 | JSX return | 复制，但**移除 `<Header ... />` 行** |

### 7.3 不改什么

| 项目 | 说明 |
|------|------|
| useTaskGroup | `restoreForAuthUser()` / `handleGenerate()` / `handleToggleTask()` 等全部不变 |
| useTaskHistory | `loadMore()` / `togglePanel()` / `refreshHistory()` 等全部不变 |
| useTaskStats | `refreshStats()` / `stats` / `isLoading` / `error` 等全部不变 |
| useTaskReview | `generateReview()` / `resetReview()` / `review` / `isStale` 等全部不变 |
| scheduleStatsRefresh | 500ms / 2500ms 双重刷新逻辑不变 |
| historyPanelRef + scroll | 打开历史面板自动滚动的逻辑不变 |
| timer cleanup | useEffect cleanup 中 clearTimeout 不变 |

### 7.4 为什么需要 MainWorkspace 组件

Next.js App Router 的 `page.tsx` 是路由入口，不应该包含大量业务逻辑。提取 MainWorkspace 组件的好处：

1. `/app/page.tsx` 保持简洁（~20 行薄壳）
2. 如果未来需要 `/app` 的 layout.tsx，可以在 layout 中引入 MainWorkspace
3. 便于测试（组件可以独立渲染，不依赖路由）
4. 符合 React 最佳实践（页面是入口，组件是内容）

---

## 八、Header 适配方案

### 8.1 三种 Header Variant

#### `variant="landing"` — Landing Page Header

```
┌──────────────────────────────────────────┐
│  AI Todo  今日行动教练                     │
│                                          │
│              [登录]  [免费开始使用]        │
└──────────────────────────────────────────┘
```

- Logo + 副标题
- "登录"按钮 → 跳转 `/login`（使用 `next/link` 或 `router.push`）
- "免费开始使用"按钮 → 跳转 `/login`
- **不使用 AuthModal**
- **不渲染 SetPasswordPrompt**

#### `variant="login"` — Login Page Header

```
┌──────────────────────────────────────────┐
│  ← 返回首页    AI Todo                    │
└──────────────────────────────────────────┘
```

- Logo + "← 返回首页"链接 → 跳转 `/`
- **不使用 AuthModal**
- **不渲染 SetPasswordPrompt**
- 最轻量 Header，不给登录页增加视觉噪音

#### `variant="app"` — App Main Workspace Header

与**当前 Header 完全一致**：
- Logo + 副标题
- 历史按钮（展开/收起）
- 登录状态展示（已登录：邮箱 + 登出；未登录：登录按钮 → AuthModal）
- AuthModal 弹窗
- SetPasswordPrompt 条件渲染
- 可能需要新增一个"首页"链接（→ `/`），可选

### 8.2 Header Props 设计

```typescript
interface HeaderProps {
  variant: "landing" | "login" | "app";
  // 以下 props 仅在 variant="app" 时需要
  historyPanelId?: string;
  isHistoryOpen?: boolean;
  onToggleHistory?: () => void;
}
```

- `variant="landing"` 和 `variant="login"` 不需要 `historyPanelId` / `isHistoryOpen` / `onToggleHistory`
- `variant="app"` 时需要这三个 props（与当前一致）

### 8.3 Header 改动范围

| 区域 | 改动 |
|------|------|
| Props 接口 | 新增 `variant`，`historyPanelId` 等变为 optional |
| 顶部结构 | 包裹在 `if (variant === "app")` / `if (variant === "landing")` / `if (variant === "login")` 条件渲染中 |
| landing 渲染 | 新增：Logo + 两个 CTA 按钮 |
| login 渲染 | 新增：Logo + "← 返回首页"链接 |
| app 渲染 | 当前逻辑完全保留 |
| AuthModal | 仅在 `variant="app"` 时渲染 |
| SetPasswordPrompt | 仅在 `variant="app"` 时渲染 |

---

## 九、数据兼容性

### 9.1 所有现有数据流不变

| 数据流 | 当前 | V2.2A 后 | 变更 |
|--------|------|---------|:---:|
| 匿名模式 device_id | localStorage deviceId | 完全不变 | ❌ |
| 登录后 user_id | Supabase Auth UUID | 完全不变 | ❌ |
| 匿名 → 登录任务迁移 | POST /api/task-group/migrate | 完全不变 | ❌ |
| localStorage scope | device:<id> / user:<id> | 完全不变 | ❌ |
| API session-aware | getAuthenticatedUserId() | 完全不变 | ❌ |
| 前端不传 userId | 安全规则 | 完全不变 | ❌ |
| Phase 14 AI 复盘 | POST /api/task-groups/review | 完全不变 | ❌ |
| Phase 15 智能调整 | computeAdjustment(stats) | 完全不变 | ❌ |
| useTaskGroup 状态管理 | useState + useCallback | 完全不变 | ❌ |
| Supabase Auth session | cookie-based | 完全不变 | ❌ |
| Supabase Dashboard 配置 | SMTP / 模板 | 完全不变 | ❌ |

### 9.2 路由迁移对数据的影响

**零影响。** V2.2A 做的事情：

1. `/` 从工作台变为 Landing Page → **不影响数据存储/读取**
2. 新增 `/app` 承载工作台 → **同样的 hooks、同样的 localStorage key、同样的 API 调用**
3. 新增 `/login` 承载登录 → **同样的 Supabase Auth API，同样的 session 管理**

用户从 `/` 迁移到 `/app` 使用：
- localStorage 数据自动可用（同一域名）
- Supabase session cookie 自动可用（同一域名）
- 匿名任务不受影响（device_id 从同一 localStorage 读取）

### 9.3 页面刷新行为

| 页面 | 刷新后 |
|------|--------|
| `/` | 已登录 → 跳转 `/app`；未登录 → 显示 Landing Page |
| `/login` | 已登录 → 跳转 `/app`；未登录 → 显示登录表单 |
| `/app` | 未登录 → 自动跳转 `/login`；已登录 → user 恢复 + 云端加载任务 |

---

## 十、禁止事项

### 10.1 V2.2A 明确不做

| # | 不做 | 原因 |
|---|------|------|
| 1 | **不做大规模 UI 美化** | V2.2B/C/D 的职责 |
| 2 | **不重写 Auth 逻辑** | useAuth / AuthModal / SetPasswordPrompt 不动 |
| 3 | **不修改 Supabase Auth 配置** | Dashboard 不动 |
| 4 | **不修改数据库 schema / migration** | 不需要 |
| 5 | **不修改任何 API Route** | 全部 API Route 不动 |
| 6 | **不修改 callback route** | 不动 |
| 7 | **不修改 AI prompt** | task-generation / task-review 不动 |
| 8 | **不修改任务生成策略** | Phase 15 不动 |
| 9 | **不修改 Phase 14 AI 复盘** | 复盘逻辑不动 |
| 10 | **不修改 hooks 内部逻辑** | useTaskGroup / useTaskHistory / useTaskStats / useTaskReview 不动 |
| 11 | **不修改 useAuth** | 现有接口已满足需求 |
| 12 | **不引入新依赖** | package.json 不改 |
| 13 | **不引入 middleware.ts** | client-side 路由守卫已足够 |
| 14 | **不引入服务端组件** | 所有页面保持 "use client" |
| 15 | **不修改 tailwind.config.ts / globals.css** | 样式不动 |
| 16 | **不修改 .env.local** | 无新环境变量 |
| 17 | **不修改 types.ts** | V2.2A 不需要新类型 |
| 18 | **不修改 constants.ts** | 现有 AUTH_TEXT / UI_TEXT 复用 |
| 19 | **不修改 Task / TaskGroup / API 响应结构** | 不动 |
| 20 | **不修改 Landing Page 之外的任何组件样式** | 除 Header variant 适配外 |

### 10.2 关于 `/app` 的 URL 选择

选择 `/app` 而非 `/dashboard` 或 `/workspace`：
- `/app` 简洁，符合 Next.js App Router 惯例（`src/app/app/page.tsx`）
- 大部分 AI 工具型产品使用 `/app` 作为主工作区（如 ChatGPT、Claude）
- 移动端 URL 简短，方便分享

---

## 十一、允许修改文件清单

| # | 文件 | 操作 | 预计行数 | 说明 |
|---|------|:---:|:---:|------|
| 1 | `src/app/page.tsx` | **重写** | ~50 行 | Landing Page 入口（从 190 行缩减） |
| 2 | `src/app/login/page.tsx` | **新增** | ~25 行 | /login 路由页面（薄壳） |
| 3 | `src/app/app/page.tsx` | **新增** | ~20 行 | /app 路由页面（薄壳） |
| 4 | `src/components/MainWorkspace.tsx` | **新增** | ~150 行 | 从现 page.tsx 提取的工作台内容 |
| 5 | `src/components/LandingPage.tsx` | **新增** | ~80 行 | Landing Page 视觉内容 |
| 6 | `src/components/LoginPageContent.tsx` | **新增** | ~150 行 | 登录表单（页面版，无遮罩层） |
| 7 | `src/components/Header.tsx` | **修改** | ~15 行 | 增加 variant prop |

**总计：7 个文件（4 新增 + 2 重写 + 1 修改），约 490 行变更。**

### 文件依赖关系

```
page.tsx (Landing)  ──→  Header (variant="landing")
                      ──→  LandingPage

login/page.tsx      ──→  Header (variant="login")
                      ──→  LoginPageContent ──→ useAuth
                                           ──→ SetPasswordPrompt (复用)

app/page.tsx        ──→  Header (variant="app")  ← 现有逻辑完全保留
                      ──→  MainWorkspace ──→ useTaskGroup / useTaskHistory / useTaskStats / useTaskReview
                                         ──→ GoalInput / TaskList / StatsBar / HistoryPanel / TaskReviewPanel
                                         ──→ HeroSection / LoadingState / NewDayPrompt
```

---

## 十二、禁止修改文件清单

以下文件 **V2.2A 完全不动**：

```
# 页面入口（除已列出的允许文件外）
src/app/layout.tsx

# Hooks（全部）
src/hooks/useAuth.ts
src/hooks/useTaskGroup.ts
src/hooks/useTaskHistory.ts
src/hooks/useTaskStats.ts
src/hooks/useTaskReview.ts

# UI 组件（除 Header 外）
src/components/AuthModal.tsx
src/components/SetPasswordPrompt.tsx
src/components/GoalInput.tsx
src/components/TaskList.tsx
src/components/StatsBar.tsx
src/components/HistoryPanel.tsx
src/components/TaskReviewPanel.tsx
src/components/HeroSection.tsx
src/components/LoadingState.tsx
src/components/NewDayPrompt.tsx

# API Routes（全部）
src/app/api/generate-tasks/route.ts
src/app/api/task-group/save/route.ts
src/app/api/task-group/load/route.ts
src/app/api/task-group/delete/route.ts
src/app/api/task-group/migrate/route.ts
src/app/api/task-groups/review/route.ts
src/app/api/task-groups/stats/route.ts
src/app/api/task-groups/history/route.ts
src/app/api/auth/me/route.ts
src/app/auth/callback/route.ts

# 服务端基础设施
src/lib/supabase-server.ts
src/lib/supabase-client.ts
src/lib/device-id.ts

# AI 相关
src/lib/ai-client.ts
src/lib/task-parser.ts
src/lib/review-parser.ts
src/lib/stats-calculator.ts
src/lib/adjust-task-strategy.ts
src/prompts/task-generation.ts
src/prompts/task-review.ts

# 类型和常量
src/lib/types.ts
src/lib/constants.ts

# 其他 lib
src/lib/storage.ts
src/lib/input-validator.ts
src/lib/date-utils.ts

# 配置
package.json
.env.local
tailwind.config.ts
src/app/globals.css
数据库 schema / migration
```

---

## 十三、验收标准

### 13.1 路由验收

| # | 验收项 | 预期结果 |
|---|--------|---------|
| 1 | 访问 `http://localhost:3000/` | 显示 Landing Page（产品介绍 + CTA） |
| 2 | 访问 `http://localhost:3000/login` | 显示登录页面（验证码/密码双 Tab） |
| 3 | 访问 `http://localhost:3000/app` | 显示主工作台（GoalInput + TaskList + StatsBar + HistoryPanel + TaskReviewPanel） |

### 13.2 路由守卫验收

| # | 验收项 | 预期结果 |
|---|--------|---------|
| 4 | 已登录用户访问 `/` | 自动跳转 `/app` |
| 5 | 已登录用户访问 `/login` | 自动跳转 `/app` |
| 6 | 未登录用户访问 `/app` | 自动跳转 `/login` |
| 7 | 未登录用户访问 `/` | 显示 Landing Page，不跳转 |
| 8 | 未登录用户访问 `/login` | 显示登录页面，不跳转 |

### 13.3 Landing Page 验收

| # | 验收项 | 预期结果 |
|---|--------|---------|
| 9 | Landing Page CTA "免费开始使用" | 点击后跳转 `/login` |
| 10 | Landing Page "已有账号？登录" | 点击后跳转 `/login` |
| 11 | Landing Page Header "登录"按钮 | 点击后跳转 `/login` |
| 12 | Landing Page Header "免费开始使用"按钮 | 点击后跳转 `/login` |

### 13.4 Login Page 验收

| # | 验收项 | 预期结果 |
|---|--------|---------|
| 13 | `/login` 默认显示验证码登录 Tab | Tab 样式与 AuthModal 一致 |
| 14 | 可切换到密码登录 Tab | 切换正常，邮箱保留 |
| 15 | 输入邮箱 → 发送验证码 → 收到邮件 | OTP 流程正常 |
| 16 | 输入正确验证码 → 自动登录 | 登录成功 |
| 17 | 登录成功后 `password_set !== true` | 弹出 SetPasswordPrompt |
| 18 | 设置密码或稍后再说 | 跳转 `/app` |
| 19 | 密码登录 → 输入邮箱+密码 → 登录 | 登录成功 |
| 20 | 登录成功后 `password_set === true` | 直接跳转 `/app`，不弹引导 |
| 21 | `/login` 页 "← 返回首页"链接 | 点击后跳转 `/` |

### 13.5 App Main Workspace 验收

| # | 验收项 | 预期结果 |
|---|--------|---------|
| 22 | 已登录用户在 `/app` 输入目标 → 生成任务 | 正常（user_id 模式） |
| 23 | 已登录用户勾选任务 | 正常 |
| 24 | 已登录用户查看统计 | 正常 |
| 25 | 已登录用户查看历史 | 正常 |
| 26 | 已登录用户使用 AI 复盘 | 正常 |
| 27 | 已登录用户点击 Header 登出 → 回退 | 正常 |
| 28 | 已登录用户在 `/app` 使用全部功能 | 与旧体验完全一致 |
| 29 | 已登录用户刷新 `/app` | session 恢复，任务从云端加载 |
| 30 | 跨天提示（NewDayPrompt） | 正常 |
| 31 | 清空 / 重新生成 | 正常 |
| 32 | 历史面板展开/收起/加载更多 | 正常 |
| 33 | 智能任务调整（Phase 15） | 正常 |

### 13.6 兼容验收

| # | 验收项 | 预期结果 |
|---|--------|---------|
| 35 | 匿名任务登录后迁移 | 正常（POST /api/task-group/migrate） |
| 36 | Phase 14 AI 复盘不受影响 | 正常 |
| 37 | Phase 15 智能调整不受影响 | 正常 |
| 38 | `getAuthenticatedUserId()` 不变 | API Route 中 userId 来自 session |
| 39 | 前端请求体不含 userId | DevTools Network 确认 |
| 40 | 直接访问 `/app`（不经过 `/`） | 正常工作（不丢失功能） |
| 41 | V2.1B 验证码登录 / 密码登录不回归 | 全部 Auth 流程正常 |

### 13.7 门禁验收

| # | 验收项 | 命令 |
|---|--------|------|
| 42 | TypeScript 编译通过 | `npm run lint` |
| 43 | Next.js 构建通过 | `npm run build` |
| 44 | `git status --short` 仅显示允许修改的 7 个文件 | 手动检查 |

---

## 十四、风险与回滚

### 14.1 风险矩阵

| # | 风险 | 等级 | 影响 | 缓解措施 |
|---|------|:---:|------|---------|
| 1 | **路由拆分导致主工作台状态丢失** | **P1** | 用户从 `/` 跳转 `/app` 后 localStorage 数据不可读 | `/` 和 `/app` 在同一域名下，localStorage 共享。MainWorkspace 使用与当前 page.tsx 完全相同的 hooks 和 storage key。验收时测试从 `/` → `/app` 数据保持 |
| 2 | **LoginPageContent 引入 Auth bug** | **P1** | `/login` 页面登录流程异常（与 AuthModal 行为不一致） | LoginPageContent 使用与 AuthModal 相同的 useAuth hooks + Supabase API。验收时对比 AuthModal 和 LoginPageContent 的登录行为 |
| 3 | **Header variant 条件渲染导致 AuthModal 不显示** | **P1** | `/app` 中点击登录按钮无反应 | Header variant="app" 时 AuthModal 渲染逻辑与当前完全一致。验收时确认 `/app` 中 AuthModal 正常工作 |
| 4 | **Vercel 部署后 `/app` 直接访问 404** | **P2** | Next.js App Router 的 `/app` 路由可能与 `src/app` 目录名冲突 | Next.js App Router 的 URL 路径由 `src/app/` 下的文件夹结构决定。`src/app/app/page.tsx` → `/app` 路由。验证 `npm run build` 无错误且 `npm run dev` 中 `/app` 可访问 |
| 5 | **已登录用户访问 `/` 闪烁 Landing Page** | **P2** | isLoading 期间显示 Landing Page → 然后跳转 /app 的闪烁 | `isLoading` 时 return null（不渲染任何内容），避免闪烁 |
| 6 | **SetPasswordPrompt 只在 `/app` 中弹出** | **P2** | 用户在 `/login` 登录成功后跳转 `/app`，Header 检测到 `password_set !== true` | LoginPageContent 登录成功后直接 `router.replace("/app")`，不管理 SetPasswordPrompt。设置密码引导统一由 Header `variant="app"` 负责（复用 V2.1B 已验证的 `skippedPasswordPromptUserId` 逻辑），避免双入口重复弹窗 |

### 14.2 回滚方案

如果 V2.2A 路由拆分出现严重问题（如 `/app` 404、状态丢失），回滚到单页面结构：

#### 回滚步骤

1. **代码回滚**（1 个 `git revert`）：
   - 恢复 `src/app/page.tsx` 为 V2.1B 版本（单页面工作台）
   - 删除 `src/app/login/page.tsx`
   - 删除 `src/app/app/page.tsx`
   - 删除 `src/components/MainWorkspace.tsx`
   - 删除 `src/components/LandingPage.tsx`
   - 删除 `src/components/LoginPageContent.tsx`
   - 恢复 `src/components/Header.tsx`（移除 variant prop）

2. **配置回滚**：
   - 无需操作（无 Supabase Dashboard / 环境变量变更）

3. **数据回滚**：
   - 无需操作（零数据库/零 API 变更）

#### 回滚成本

| 项目 | 说明 |
|------|------|
| 代码回滚 | `git revert` 一个 commit（7 个文件） |
| 配置回滚 | 无需操作 |
| 数据回滚 | 无需操作 |
| 用户影响 | 仅影响 V2.2A 上线后访问过 `/login` 或 `/app` 的用户（URL 变更回 `/`） |
| 预计时间 | < 10 分钟（revert + build + deploy） |

---

> **文档结束**
>
> **下一文档**：本文档经 ChatGPT 审查通过后 → `docs/Execution-Plan-V2.2A-Routing.md`（V2.2A 执行方案）
>
> **关联文档**：
> - [Architecture-V2.1B-OTP-Password.md](Architecture-V2.1B-OTP-Password.md) — V2.1B 架构方案（✅ 已完成）
> - [Execution-Plan-V2.1B-OTP-Password.md](Execution-Plan-V2.1B-OTP-Password.md) — V2.1B 执行方案（✅ 已完成）
> - [Roadmap-V2.1-V2.3.md](Roadmap-V2.1-V2.3.md) — V2.1-V2.3 路线图
> - [PROJECT-CONTEXT.md](PROJECT-CONTEXT.md) — 项目长期上下文
> - [PROJECT-INDEX.md](PROJECT-INDEX.md) — 项目文件索引
> - [PRD-V2.0.md](PRD-V2.0.md) — V2.0 产品规划
