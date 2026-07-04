# Execution-Plan-V2.2A-Routing.md — V2.2A 页面路由结构升级 执行方案

> **状态**：执行方案，待 ChatGPT 审查
> **依赖**：[Architecture-V2.2A-Routing.md](Architecture-V2.2A-Routing.md)（架构方案已通过 ChatGPT 审查并已提交 `542bd35`）
> **上一文档**：[Architecture-V2.2A-Routing.md](Architecture-V2.2A-Routing.md) · [Execution-Plan-V2.1B-OTP-Password.md](Execution-Plan-V2.1B-OTP-Password.md)
> **编写日期**：2026-07-04
> **受众**：Codex（实现者）

---

## 目录

- [一、阶段目标](#一阶段目标)
- [二、实现策略](#二实现策略)
- [三、允许修改文件清单](#三允许修改文件清单)
- [四、逐步执行步骤](#四逐步执行步骤)
- [五、文件 1：MainWorkspace.tsx — 工作台内容提取](#五文件-1mainworkspacetsx--工作台内容提取)
- [六、文件 2：src/app/app/page.tsx — /app 路由入口](#六文件-2srcappapppagetsx--app-路由入口)
- [七、文件 3：LandingPage.tsx — Landing 内容组件](#七文件-3landingpagetsx--landing-内容组件)
- [八、文件 4：src/app/page.tsx — Landing 路由入口重写](#八文件-4srcapppagetsx--landing-路由入口重写)
- [九、文件 5：LoginPageContent.tsx — 登录页表单组件](#九文件-5loginpagecontenttsx--登录页表单组件)
- [十、文件 6：src/app/login/page.tsx — /login 路由入口](#十文件-6srcapploginpagetsx--login-路由入口)
- [十一、文件 7：Header.tsx — variant 适配](#十一文件-7headertsx--variant-适配)
- [十二、风险控制](#十二风险控制)
- [十三、验收标准](#十三验收标准)
- [十四、禁止事项清单](#十四禁止事项清单)
- [十五、给 Codex 的实现指令草案](#十五给-codex-的实现指令草案)

---

## 一、阶段目标

V2.2A 将当前单页面结构（`/` 承载全部功能）升级为三页面路由结构：

```
/          产品首页 / Landing Page
/login     登录 / 注册页面
/app       AI Todo 主工作台
```

**V2.2A 只做路由结构升级，不做 UI 大美化。** UI 美化留给 V2.2B/C/D。

核心决策：

| # | 决策 | 说明 |
|---|------|------|
| 1 | **方案 C** | `/app` 允许匿名访问，保持 device_id 匿名任务模式。Header 对匿名用户继续提供登录引导 |
| 2 | **不使用 middleware** | 路由守卫只用 client-side `useEffect` + `router.replace` |
| 3 | 不修改 useAuth | 现有接口已满足需求 |
| 4 | 不修改 useTaskGroup | 核心状态管理不变 |
| 5 | 不修改任何 API Route | 全部 API Route 不动 |
| 6 | 不修改数据库 | 零 schema / migration 变更 |
| 7 | 不修改 package.json | 无新依赖 |
| 8 | 不重写 AuthModal | 保留弹窗登录体验 |
| 9 | 不做大规模 UI 美化 | V2.2B/C/D 职责 |
| 10 | 不引入新依赖 | 零新增 |

---

## 二、实现策略

### 2.1 核心思路

| 策略 | 说明 |
|------|------|
| **MainWorkspace 最小搬迁** | 从当前 `page.tsx` 提取核心内容到 `MainWorkspace.tsx`，Header 保留在 MainWorkspace 内部渲染，避免 props 传递链断裂 |
| **三个薄壳路由页面** | `page.tsx`（Landing，~45 行）、`login/page.tsx`（~30 行）、`app/page.tsx`（~10 行），只做组装或重定向 |
| **Header variant 系统** | `variant="landing"` / `"login"` / `"app"` 三种模式，通过条件渲染切换 |
| **LoginPageContent 独立实现** | 复用 `useAuth` hooks + `AUTH_TEXT` constants，但不修改 AuthModal。登录成功后直接跳转 `/app` |
| **SetPasswordPrompt 只由 Header 管理** | 设置密码引导只在 Header `variant="app"` 中弹出（复用 V2.1B 已验证逻辑）。LoginPageContent 不处理密码设置 |
| **零高风险文件触碰** | hooks、API routes、lib、AuthModal、数据库全部不动 |

### 2.2 关键实现决策：Header 与 MainWorkspace 的关系

架构文档 §五中，`app/page.tsx` 渲染 `<Header variant="app" />` + `<MainWorkspace />` 作为兄弟组件。但 Header `variant="app"` 需要 `historyPanelId`、`isHistoryOpen`、`onToggleHistory` 三个 props，而这些值来自 `useTaskHistory` hook——该 hook 在 MainWorkspace 内部调用。

**如果 Header 和 MainWorkspace 是兄弟组件，它们无法共享同一个 `useTaskHistory` 实例的 `isOpen` / `togglePanel` 状态。**

因此执行方案做出以下调整：**MainWorkspace 内部保留 Header 的渲染**（与当前 page.tsx 一致）。`app/page.tsx` 变成极简薄壳（约 10 行），只渲染 `<MainWorkspace />`。MainWorkspace 内部给 Header 传 `variant="app"` + 现有的 `historyPanelId` / `isHistoryOpen` / `onToggleHistory` props。

这避免了引入状态提升、Context、或重复 hook 调用，将改动风险降到最低。

### 2.3 改动面一览

| 项目 | 数值 |
|------|:---:|
| 新增文件 | 4 个 |
| 重写文件 | 2 个 |
| 修改文件 | 1 个 |
| 删除文件 | 0 个 |
| 新增 npm 依赖 | 0 个 |
| 数据库 schema 变更 | 0 个 |
| API Route 变更 | 0 个 |
| package.json 变更 | 0 个 |
| .env.local 变更 | 0 个 |

---

## 三、允许修改文件清单

| # | 文件 | 操作 | 预计行数 | 说明 |
|---|------|:---:|:---:|------|
| 1 | `src/components/MainWorkspace.tsx` | **新增** | ~170 行 | 从现 `page.tsx` 提取工作台内容（Header 保留在内部） |
| 2 | `src/app/app/page.tsx` | **新增** | ~10 行 | `/app` 路由页面（极简薄壳，无守卫） |
| 3 | `src/components/LandingPage.tsx` | **新增** | ~80 行 | Landing Page 视觉内容组件 |
| 4 | `src/app/page.tsx` | **重写** | ~45 行 | Landing 路由入口（从 190 行缩减） |
| 5 | `src/components/LoginPageContent.tsx` | **新增** | ~170 行 | 登录表单（页面版，无遮罩层） |
| 6 | `src/app/login/page.tsx` | **新增** | ~30 行 | `/login` 路由页面（薄壳 + 已登录守卫） |
| 7 | `src/components/Header.tsx` | **修改** | ~35 行 | 增加 `variant` prop 适配三页面 |

**总计：7 个文件（4 新增 + 2 重写 + 1 修改），约 540 行变更。**

### 文件依赖关系

```
                    ┌─────────────────────────┐
                    │   MainWorkspace.tsx      │  ← 新增（从 page.tsx 提取，依赖 Header）
                    │   (Step 1)               │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   app/page.tsx           │  ← 新增 /app 路由（依赖 MainWorkspace）
                    │   (Step 2)               │
                    └─────────────────────────┘

                    ┌─────────────────────────┐
                    │   LandingPage.tsx        │  ← 新增（独立组件，无 hook 依赖）
                    │   (Step 3)               │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   page.tsx (/)           │  ← 重写为 Landing 入口（依赖 LandingPage + Header + useAuth）
                    │   (Step 4)               │
                    └─────────────────────────┘

                    ┌─────────────────────────┐
                    │   LoginPageContent.tsx   │  ← 新增（依赖 useAuth + AUTH_TEXT，不依赖 SetPasswordPrompt）
                    │   (Step 5)               │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   login/page.tsx         │  ← 新增 /login 路由（依赖 LoginPageContent + Header + useAuth）
                    │   (Step 6)               │
                    └─────────────────────────┘

                    ┌─────────────────────────┐
                    │   Header.tsx             │  ← 修改：增加 variant prop（被 Step 1,4,6 依赖）
                    │   (Step 7)               │
                    └─────────────────────────┘
```

---

## 四、逐步执行步骤

按最小风险顺序排列。**推荐按 Step 7 → 1 → 2 → 3 → 4 → 5 → 6 执行**（先改 Header 加 variant prop，再创建依赖它的路由页面，这样每步 lint 都能通过）：

```
Step 7: Header.tsx                    ← 先改：增加 variant prop（所有路由页面依赖它）
Step 1: MainWorkspace.tsx             ← 新增：从 page.tsx 提取
Step 2: src/app/app/page.tsx          ← 新增 /app 路由（依赖 Step 1）
Step 3: LandingPage.tsx               ← 新增 Landing 内容（独立）
Step 4: src/app/page.tsx              ← 重写为 Landing 入口（依赖 Step 3,7）
Step 5: LoginPageContent.tsx          ← 新增登录页表单（独立，依赖 useAuth + AUTH_TEXT）
Step 6: src/app/login/page.tsx        ← 新增 /login 路由（依赖 Step 5,7）
Step 8: 本地验证路由                   ← npm run dev + 手动测试 / /login /app
Step 9: 功能回归                       ← 匿名/登录完整流程测试
Step 10: 门禁                         ← npm run lint + npm run build + git status
```

完成 7 个允许文件整体改动后，统一运行 `npm run lint` / `npm run build`。如果 Codex 中途想验证编译状态，可以在 Header 兼容 `variant` 默认 `"app"` 后执行 lint。

---

## 五、文件 1：MainWorkspace.tsx — 工作台内容提取

**新文件**：`src/components/MainWorkspace.tsx`（约 170 行）

### 5.1 来源

从当前 `src/app/page.tsx`（190 行）提取核心工作台内容。

### 5.2 提取策略

**最小搬迁，保留 Header 在内部。** 相对于当前 `page.tsx`，仅做以下修改：

| # | 位置 | 修改 |
|---|------|------|
| 1 | 函数名 | `export default function Home()` → `export function MainWorkspace()` |
| 2 | 导出方式 | `export default` → `export`（命名导出） |
| 3 | Header JSX | 增加 `variant="app"` prop（其余 props 不变） |
| 4 | 其他 | **100% 不变**——import、hooks、refs、handlers、useEffect、JSX 结构完全复制 |

### 5.3 具体代码

```typescript
"use client";

import { useEffect, useRef } from "react";
import { GoalInput } from "@/components/GoalInput";
import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { HistoryPanel } from "@/components/HistoryPanel";
import { LoadingState } from "@/components/LoadingState";
import { NewDayPrompt } from "@/components/NewDayPrompt";
import { StatsBar } from "@/components/StatsBar";
import { TaskReviewPanel } from "@/components/TaskReviewPanel";
import { TaskList } from "@/components/TaskList";
import { useTaskHistory } from "@/hooks/useTaskHistory";
import { useTaskGroup } from "@/hooks/useTaskGroup";
import { useTaskReview } from "@/hooks/useTaskReview";
import { useTaskStats } from "@/hooks/useTaskStats";
import { getOrCreateDeviceId } from "@/lib/device-id";

export function MainWorkspace() {
  const historyPanelRef = useRef<HTMLDivElement>(null);
  const statsRefreshTimerRef = useRef<number | null>(null);
  const statsFollowUpRefreshTimerRef = useRef<number | null>(null);
  const {
    inputGoal,
    errorMessage,
    tasks,
    completedCount,
    totalCount,
    isGenerateDisabled,
    pageStatus,
    taskGroup,
    showNewDayPrompt,
    regenerateError,
    isAllCompleted,
    setInputGoal,
    handleGenerate,
    handleToggleTask,
    handleClearTasks,
    handleRegenerate,
    handleExampleClick,
    handleStartNewDay,
  } = useTaskGroup();
  const taskHistory = useTaskHistory();
  const taskStats = useTaskStats();
  const taskReview = useTaskReview({
    taskGroupId: taskGroup?.id,
    taskGroupUpdatedAt: taskGroup?.updatedAt,
    taskCount: totalCount,
    deviceId: getOrCreateDeviceId(),
    timezoneOffset: new Date().getTimezoneOffset(),
  });

  function scheduleStatsRefresh(delay = 500, followUpDelay = 2500) {
    // ... 与当前 page.tsx 完全一致（L53-70）
    if (statsRefreshTimerRef.current !== null) {
      window.clearTimeout(statsRefreshTimerRef.current);
    }
    if (statsFollowUpRefreshTimerRef.current !== null) {
      window.clearTimeout(statsFollowUpRefreshTimerRef.current);
    }

    statsRefreshTimerRef.current = window.setTimeout(() => {
      statsRefreshTimerRef.current = null;
      void taskStats.refreshStats();
    }, delay);

    statsFollowUpRefreshTimerRef.current = window.setTimeout(() => {
      statsFollowUpRefreshTimerRef.current = null;
      void taskStats.refreshStats();
    }, followUpDelay);
  }

  async function handleGenerateWithStats() {
    await handleGenerate();
    scheduleStatsRefresh(500);
  }

  function handleToggleTaskWithStats(taskId: string) {
    handleToggleTask(taskId);
    scheduleStatsRefresh(500);
  }

  function handleClearTasksWithStats() {
    handleClearTasks();
    scheduleStatsRefresh(500);
  }

  async function handleRegenerateWithStats() {
    await handleRegenerate();
    scheduleStatsRefresh(500);
  }

  function handleStartNewDayWithStats() {
    handleStartNewDay();
    scheduleStatsRefresh(500);
  }

  useEffect(() => {
    // ... 与当前 page.tsx 完全一致（L97-112）
    if (!taskHistory.isOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      historyPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [taskHistory.isOpen]);

  useEffect(() => {
    // ... 与当前 page.tsx 完全一致（L114-123）
    return () => {
      if (statsRefreshTimerRef.current !== null) {
        window.clearTimeout(statsRefreshTimerRef.current);
      }
      if (statsFollowUpRefreshTimerRef.current !== null) {
        window.clearTimeout(statsFollowUpRefreshTimerRef.current);
      }
    };
  }, []);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F8FAFF] bg-gradient-to-b from-indigo-50 via-white to-sky-50 px-4 py-6 pb-[env(safe-area-inset-bottom,1rem)] text-slate-950 sm:px-6 sm:py-10">
      <div className="mx-auto flex max-w-[720px] flex-col gap-6 sm:gap-7">
        {/* ⬇ 唯一改动：增加 variant="app" */}
        <Header
          variant="app"
          historyPanelId="history-panel"
          isHistoryOpen={taskHistory.isOpen}
          onToggleHistory={taskHistory.togglePanel}
        />
        <HeroSection />
        <div className="grid gap-5">
          <GoalInput
            errorMessage={errorMessage}
            isLoading={isGenerateDisabled}
            onChange={setInputGoal}
            onExampleClick={handleExampleClick}
            onSubmit={handleGenerateWithStats}
            value={inputGoal}
          />
          <StatsBar
            error={taskStats.error}
            isLoading={taskStats.isLoading}
            onRetry={taskStats.refreshStats}
            stats={taskStats.stats}
          />
          {showNewDayPrompt ? (
            <NewDayPrompt onStartNewDay={handleStartNewDayWithStats} />
          ) : null}
          {pageStatus === "loading" ? <LoadingState /> : null}
          <TaskList
            completedCount={completedCount}
            isAllCompleted={isAllCompleted}
            onClearTasks={handleClearTasksWithStats}
            onRegenerate={handleRegenerateWithStats}
            onToggleTask={handleToggleTaskWithStats}
            regenerateError={regenerateError}
            tasks={tasks}
            totalCount={totalCount}
          />
          {taskGroup ? (
            <TaskReviewPanel
              taskCount={totalCount}
              error={taskReview.error}
              isLoading={taskReview.isLoading}
              isStale={taskReview.isStale}
              onGenerate={taskReview.generateReview}
              onReset={taskReview.resetReview}
              review={taskReview.review}
            />
          ) : null}
          <div id="history-panel" ref={historyPanelRef}>
            <HistoryPanel
              error={taskHistory.error}
              hasMore={taskHistory.hasMore}
              historyList={taskHistory.historyList}
              isLoading={taskHistory.isLoading}
              isLoadingMore={taskHistory.isLoadingMore}
              isOpen={taskHistory.isOpen}
              onLoadMore={taskHistory.loadMore}
              onRetry={taskHistory.refreshHistory}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
```

### 5.4 与当前 page.tsx 的差异

| 差异 | 说明 |
|------|------|
| 函数名 | `Home` → `MainWorkspace` |
| 导出方式 | `export default function` → `export function`（命名导出） |
| Header JSX | 增加 `variant="app"` prop |
| 其他 | **100% 不变**——所有 hooks、refs、handlers、useEffect、JSX 结构完全复制 |

### 5.5 Codex 注意事项

1. **最安全的做法**：复制整个 `page.tsx` → 改函数名 → 改导出方式 → 给 Header 加 `variant="app"` → 保存为 `MainWorkspace.tsx`
2. **不要顺手重构**——即使看到可以优化的地方，V2.2A 不做
3. **命名导出**：使用 `export function MainWorkspace()`（不是 `export default`）
4. **保留所有注释和空行**：保持与原文件一致的格式
5. **保留 `"use client"` 指令**

---

## 六、文件 2：src/app/app/page.tsx — /app 路由入口

**新文件**：`src/app/app/page.tsx`（约 10 行）

### 6.1 定位

极简薄壳路由页面。**无路由守卫**——匿名和已登录用户均可访问。

### 6.2 关键设计

- 不做任何 hooks 调用
- 不做任何数据获取
- 唯一的职责：渲染 MainWorkspace
- 无路由守卫——满足方案 C（匿名可访问）

### 6.3 具体代码

```typescript
"use client";

import { MainWorkspace } from "@/components/MainWorkspace";

export default function AppPage() {
  return <MainWorkspace />;
}
```

### 6.4 注意事项

- 对应的物理路径是 `src/app/app/page.tsx`，Next.js App Router 自动映射到 `/app` 路由
- 需要确保 `src/app/app/` 目录被创建

---

## 七、文件 3：LandingPage.tsx — Landing 内容组件

**新文件**：`src/components/LandingPage.tsx`（约 80 行）

### 7.1 定位

产品首页视觉内容组件。面向新用户和未登录回头客。

### 7.2 关键设计

- 纯展示组件，无 hooks（除 `next/link` 外无客户端交互）
- 移动端优先
- CTA 主按钮 → `/app`（匿名即可使用）
- 次链接 → `/login`（已有账号）

### 7.3 具体代码

```typescript
"use client";

import Link from "next/link";
import { UI_TEXT } from "@/lib/constants";

export function LandingPage() {
  return (
    <div className="mx-auto flex max-w-[720px] flex-col items-center px-4 pb-12 pt-16 text-center sm:px-6 sm:pt-24">
      {/* Badge */}
      <span className="rounded-full border border-indigo-100 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-600">
        {UI_TEXT.APP_ROLE}
      </span>

      {/* Hero Title */}
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
          href="/app"
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
        无需注册即可使用。{UI_TEXT.PRIVACY_NOTICE}
      </p>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
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

### 7.4 设计要点

| 元素 | 说明 |
|------|------|
| Badge | 复用 `UI_TEXT.APP_ROLE`（"AI 行动教练"） |
| Hero | 渐变标题 + `UI_TEXT.APP_TAGLINE` |
| FeatureCard | 纯展示，无交互，`sm:grid-cols-3` 桌面端三列 |
| CTA 主按钮 | `<Link href="/app">`，渐变样式与现有按钮一致 |
| 次链接 | `<Link href="/login">`，浅色文字链接 |
| 底部说明 | `UI_TEXT.PRIVACY_NOTICE`（"隐私优先，数据加密存储。"） |

### 7.5 Codex 注意事项

1. 使用 `next/link` 的 `<Link>` 组件（不是 `<a>`），Next.js App Router 要求
2. `FeatureCard` 是私有组件（不需要 export），定义在同一个文件中
3. 样式与现有视觉风格一致（渐变色、圆角、阴影）
4. 移动端优先（`sm:` breakpoint 适配桌面端）

---

## 八、文件 4：src/app/page.tsx — Landing 路由入口重写

**当前文件**：`src/app/page.tsx`（190 行） → **重写**为约 45 行

### 8.1 当前状态

当前 `page.tsx` 承载全部工作台功能（190 行）。

### 8.2 改造目标

重写为 Landing Page 路由入口：
- 已登录用户 → client-side 跳转 `/app`
- 未登录用户 → 显示 Landing Page
- 渲染 `Header variant="landing"` + `LandingPage` 组件

### 8.3 具体代码

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

  // isLoading 时返回 null，避免闪烁（已登录用户几乎立即跳转）
  if (isLoading) {
    return null;
  }

  // 已登录但还在跳转中 → 不渲染 Landing Page 内容
  if (user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[#F8FAFF]">
      <Header variant="landing" />
      <LandingPageContent />
    </main>
  );
}
```

### 8.4 关键设计

| # | 设计点 | 说明 |
|---|--------|------|
| 1 | `isLoading` 时 return null | 避免已登录用户先看到 Landing Page 再跳转的闪烁 |
| 2 | `user` 存在时 return null | 双重保险——在 `router.replace` 生效前不渲染 |
| 3 | 不再引入 useTaskGroup 等 hooks | 只使用 useAuth |
| 4 | 不再渲染工作台组件 | GoalInput/TaskList/StatsBar/HistoryPanel/TaskReviewPanel 全部移除 |
| 5 | `Header variant="landing"` | 不传 historyPanelId/isHistoryOpen/onToggleHistory |

### 8.5 当前职责

原 190 行：主工作台页面。

### 8.6 本阶段改什么

重写为 Landing Page 路由入口（约 45 行）。

### 8.7 Codex 注意事项

1. **这是重写**——不要在原 page.tsx 上修改，而是完全替换内容
2. **移除所有不需要的 import**：GoalInput、HeroSection、HistoryPanel、LoadingState、NewDayPrompt、StatsBar、TaskReviewPanel、TaskList、useTaskGroup、useTaskHistory、useTaskStats、useTaskReview、getOrCreateDeviceId
3. **只保留需要的 import**：useAuth、useRouter、Header、LandingPage
4. `useEffect` 依赖数组包含 `[user, isLoading, router]`
5. `router.replace`（不是 `router.push`）——避免回退按钮回到 `/` 的死循环

---

## 九、文件 5：LoginPageContent.tsx — 登录页表单组件

**新文件**：`src/components/LoginPageContent.tsx`（约 170 行）

### 9.1 定位

页面版登录表单，承载与 AuthModal 相同的登录能力，但是**页面卡片布局**（非弹窗遮罩）。

### 9.2 为什么独立实现

| 原因 | 说明 |
|------|------|
| AuthModal 是为弹窗设计的 | 有遮罩层、关闭按钮、`isOpen`/`onClose` props，不适合直接复用到页面中 |
| 不修改 AuthModal | V2.2A 的原则——AuthModal 是 V2.1B 的核心交付物，已经过生产验证 |
| V2.2B 再统一 | V2.2B 将专门做登录页独立设计——届时统一抽取 AuthForm 公共组件 |

### 9.3 复用关系

| 复用 | 来源 | 方式 |
|------|------|------|
| 登录方法 | `useAuth` hook | `sendOtp` / `verifyOtp` / `signInWithPassword` / `setPassword` |
| 文案 | `AUTH_TEXT` constants | 所有 UI 文案 |
| 错误处理 | `getSafeErrorMessage` | 本地实现（与 AuthModal 相同的错误映射逻辑） |

### 9.4 组件内部状态

```typescript
type AuthMode = "otp" | "password";

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
```

### 9.5 关键交互逻辑

#### 登录成功后

登录成功后统一跳转 `/app`。设置密码引导由 Header `variant="app"` 负责（复用 V2.1B 已验证的 `skippedPasswordPromptUserId` 逻辑，避免双入口重复弹窗）。

```typescript
useEffect(() => {
  if (user) {
    router.replace("/app");
  }
}, [user, router]);
```

#### 发送验证码

```typescript
async function handleSendOtp() {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    setErrorMessage(AUTH_TEXT.EMAIL_REQUIRED);
    return;
  }

  setIsSubmitting(true);
  setErrorMessage(null);

  try {
    await sendOtp(trimmedEmail);
    setOtpSent(true);
    setResendSeconds(60);
    setMessage(`${AUTH_TEXT.CODE_SENT} ${trimmedEmail}`);
  } catch (error) {
    setErrorMessage(getSafeErrorMessage(error));
  } finally {
    setIsSubmitting(false);
  }
}
```

#### 验证码自动提交

```typescript
useEffect(() => {
  if (token.length === 6 && otpSent && !isSubmitting) {
    void handleVerifyOtp();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [token]);
```

#### Tab 切换

```typescript
function switchMode(nextMode: AuthMode) {
  setMode(nextMode);
  setPasswordState("");
  setToken("");
  setMessage(null);
  setErrorMessage(null);
  setOtpSent(false);
  setResendSeconds(0);
}
// 注意：切换 Tab 时不清空 email——方便用户切换登录方式
```

### 9.6 UI 结构

```
┌────────────────────────────────────────────┐
│                                            │
│          登录 AI Todo                       │
│    登录后可以多设备同步任务数据。             │
│                                            │
│  ┌────────────────────────────────────┐    │
│  │  [验证码登录]  |  密码登录           │    │  ← Tab 切换
│  │  ———————————                       │    │
│  │                                    │    │
│  │  [邮箱输入框]                       │    │
│  │                                    │    │
│  │  otpSent ?                         │    │
│  │    → 6 位验证码输入框 + 重发/换邮箱  │    │
│  │    :                               │    │
│  │    → "发送验证码"按钮                │    │
│  │                                    │    │
│  └────────────────────────────────────┘    │
│                                            │
└────────────────────────────────────────────┘
```

### 9.7 与 AuthModal 的差异

| 方面 | AuthModal | LoginPageContent |
|------|-----------|-----------------|
| 布局 | 遮罩层 + 居中弹窗 | 页面居中卡片 |
| 关闭方式 | × 按钮 / 遮罩 / ESC | 无关闭按钮（通过 Header "← 返回首页"） |
| 登录成功后 | 关闭弹窗，SetPasswordPrompt 由 Header 控制 | 直接跳转 /app，SetPasswordPrompt 由 Header variant="app" 处理 |
| Props | `isOpen` / `isAuthenticated` / `onClose` / `onSendOtp` / `onVerifyOtp` / `onSignInWithPassword` | 无 Props——自己调用 useAuth |
| 遮罩层 | `backdrop-blur-sm` | 无 |
| 宽度 | `max-w-sm` 弹窗 | `max-w-sm` 卡片 |

### 9.8 登录成功后流程

LoginPageContent **不**管理 SetPasswordPrompt。登录成功后统一 `router.replace("/app")`。进入 `/app` 后，MainWorkspace 内部的 Header `variant="app"` 会检查 `password_set` 标记并弹出 SetPasswordPrompt（复用 V2.1B 已验证逻辑）。

**设计原因**：如果 LoginPageContent 自己管理 SetPasswordPrompt，"稍后再说"的状态不会同步到 Header 的 `skippedPasswordPromptUserId`。用户跳转到 `/app` 后 Header 可能再次弹窗。将 SetPasswordPrompt 统一由 Header 管理可以避免双入口重复弹窗。

### 9.9 Codex 注意事项

1. **复用 `useAuth` hooks**：`sendOtp`、`verifyOtp`、`signInWithPassword`、`setPassword`——与 AuthModal 使用的完全相同
2. **复用 `AUTH_TEXT` constants**：所有文案来自 `AUTH_TEXT`，不要硬编码
3. **不 import SetPasswordPrompt**：LoginPageContent 登录成功后统一 `router.replace("/app")`。设置密码引导由 Header `variant="app"` 负责
4. **验证码自动提交**：用 `useEffect` 监听 `token.length === 6`，不要在 `handleTokenInput` 中直接调用
5. **重发倒计时**：`useEffect` + `setInterval`，倒计时结束后按钮恢复可点击
6. **Tab 切换不清空 email**：用户在验证码 Tab 输入邮箱后切换到密码 Tab，邮箱应保留
7. **密码登录分支**：参考 AuthModal 的 `handlePasswordSubmit` 逻辑（前端校验 → `signInWithPassword` → 错误处理）
8. **不引入新依赖**：6 位验证码输入框纯手写（6 个 `<input>`），使用 `inputMode="numeric"` + `pattern="[0-9]"` + `autoComplete="one-time-code"`
9. **样式**：与 AuthModal 保持一致（渐变按钮、输入框样式、错误/成功提示颜色）
10. **不 import `SetPasswordPrompt`**——LoginPageContent 不处理密码设置，引导交给 `/app` 的 Header
11. `getSafeErrorMessage` 函数可以在 LoginPageContent 中本地实现（约 20 行，与 AuthModal 中的逻辑相同）。如果 AuthModal 中的 `getSafeErrorMessage` 不是导出的，LoginPageContent 需要自己实现一份

---

## 十、文件 6：src/app/login/page.tsx — /login 路由入口

**新文件**：`src/app/login/page.tsx`（约 30 行）

### 10.1 定位

登录页面路由入口。已登录用户自动跳转 `/app`。

### 10.2 具体代码

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

  if (user) {
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

### 10.3 关键设计

| # | 设计点 | 说明 |
|---|--------|------|
| 1 | 已登录守卫 | `useEffect` → `router.replace("/app")` |
| 2 | `isLoading` 时 return null | 避免闪烁 |
| 3 | `Header variant="login"` | 轻量 Header（Logo + "← 返回首页"） |
| 4 | `LoginPageContent` | 独立组件，无 Props |

### 10.4 Codex 注意事项

1. 对应的物理路径是 `src/app/login/page.tsx`，Next.js App Router 自动映射到 `/login` 路由
2. 需要确保 `src/app/login/` 目录被创建
3. 路由守卫逻辑与 Landing Page（`page.tsx`）相同

---

## 十一、文件 7：Header.tsx — variant 适配

**当前文件**：`src/components/Header.tsx`（122 行） → **修改**约 35 行

### 11.1 当前状态

Header 组件有两种状态：
- 未登录：显示"登录"按钮 → 打开 AuthModal
- 已登录：显示邮箱 + "登出"按钮
- 始终有"历史"按钮 + AuthModal + SetPasswordPrompt

### 11.2 改造目标

增加 `variant` prop，三种模式：

| Variant | 渲染内容 |
|---------|---------|
| `"landing"` | Logo + "登录"按钮（→ `/login`）+ "开始使用"按钮（→ `/app`）。**不渲染 AuthModal / SetPasswordPrompt / 历史按钮** |
| `"login"` | Logo + "← 返回首页"链接（→ `/`）。**不渲染 AuthModal / SetPasswordPrompt / 历史按钮** |
| `"app"` | **与当前 Header 完全相同**：Logo、历史按钮、登录状态、AuthModal、SetPasswordPrompt |

### 11.3 Props 变更

```typescript
// 改造前
interface HeaderProps {
  historyPanelId: string;
  isHistoryOpen: boolean;
  onToggleHistory: () => void;
}

// 改造后
interface HeaderProps {
  variant?: "landing" | "login" | "app";  // 可选，默认 "app"（兼容旧调用，降低迁移风险）
  historyPanelId?: string;
  isHistoryOpen?: boolean;
  onToggleHistory?: () => void;
}
```

- `variant` 是可选 prop，默认 `"app"`（兼容旧调用）。所有新调用必须显式传 variant
- `historyPanelId` / `isHistoryOpen` / `onToggleHistory` 变为可选——仅在 `variant="app"` 时需要

### 11.4 具体改动

#### 11.4.1 函数签名

```typescript
// 改造前
export function Header({
  historyPanelId,
  isHistoryOpen,
  onToggleHistory,
}: HeaderProps) {

// 改造后
export function Header({
  variant,
  historyPanelId,
  isHistoryOpen,
  onToggleHistory,
}: HeaderProps) {
  // 默认 "app" 兼容旧调用；所有新调用必须显式传 variant
  const resolvedVariant = variant ?? "app";
```

#### 11.4.2 landing variant — 新增渲染分支

在现有 return 之前，增加 `variant === "landing"` 的提前返回：

```typescript
if (resolvedVariant === "landing") {
  return (
    <header className="mb-6 flex flex-col gap-4 pt-[env(safe-area-inset-top,0px)] sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <p className="border-l-2 border-indigo-500 pl-3 text-xl font-semibold tracking-tight text-slate-950">
          {UI_TEXT.APP_NAME}
        </p>
        <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
          {UI_TEXT.APP_ROLE}
        </span>
      </div>

      <div className="flex items-center gap-2 self-start sm:self-auto">
        <a
          href="/login"
          className="rounded-full border border-slate-200 bg-white/80 px-4 py-1.5 text-sm font-medium text-slate-600 transition hover:border-indigo-100 hover:text-indigo-700"
        >
          {AUTH_TEXT.LOGIN}
        </a>
        <a
          href="/app"
          className="rounded-full bg-gradient-to-r from-indigo-600 to-blue-500 px-4 py-1.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(79,70,229,0.25)] transition hover:-translate-y-0.5"
        >
          免费开始使用
        </a>
      </div>
    </header>
  );
}
```

> **注意**：landing variant 使用原生 `<a href="...">` 而非 `next/link` `<Link>`。原因：Header 组件当前不 import `next/link`，且 `<a>` 在 landing/login 场景中足够（不需要客户端路由的 prefetch 优化）。如果 Codex 倾向使用 `<Link>`，也可以改为 `import Link from "next/link"` + `<Link href="...">`，两种方式都接受。

#### 11.4.3 login variant — 新增渲染分支

```typescript
if (resolvedVariant === "login") {
  return (
    <header className="mb-6 flex items-center gap-4 pt-[env(safe-area-inset-top,0px)] sm:mb-8">
      <a
        href="/"
        className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-indigo-100 hover:text-indigo-700"
      >
        ← 返回首页
      </a>
      <div className="flex items-center gap-3">
        <p className="border-l-2 border-indigo-500 pl-3 text-xl font-semibold tracking-tight text-slate-950">
          {UI_TEXT.APP_NAME}
        </p>
        <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
          {UI_TEXT.APP_ROLE}
        </span>
      </div>
    </header>
  );
}
```

#### 11.4.4 app variant — 保留现有逻辑

`resolvedVariant === "app"` 时走现有逻辑（不提前 return）。现有代码的主体部分不变，仅需：
- 不再需要条件判断 `resolvedVariant`——因为 landing 和 login 已经提前 return
- `historyPanelId` / `isHistoryOpen` / `onToggleHistory` 在使用前加非空断言 `!` 或类型收窄（因为 TypeScript 可能报它们为 `string | undefined`）

**方式 A**（推荐——在函数体顶部加类型断言）：

```typescript
// resolvedVariant === "app" 时以下 props 必定存在
const panelId = historyPanelId!;
const isOpen = isHistoryOpen!;
const toggle = onToggleHistory!;
```

然后在后续代码中用 `panelId` / `isOpen` / `toggle` 替代原来的 `historyPanelId` / `isHistoryOpen` / `onToggleHistory`。

**方式 B**（使用默认值）：

```typescript
const panelId = historyPanelId ?? "history-panel";
const isOpen = isHistoryOpen ?? false;
const toggle = onToggleHistory ?? (() => {});
```

### 11.5 完整改造后 Header.tsx 结构

```
L1-8    导入                                    ← 不变
L10-14  HeaderProps 接口                         ← 修改：variant 可选（默认 "app"），其他变 optional
L16-20  function Header({ variant, ... })        ← 修改：解构增加 variant
L21     const resolvedVariant = variant ?? "app"  ← 新增：解析 variant
L22-30  useAuth 解构                             ← 不变
L31-39  isAuthModalOpen / skippedPasswordPrompt  ← 不变
L41-47  shouldShowSetPasswordPrompt              ← 不变
L48-71  landing variant 提前 return              ← 新增（用 resolvedVariant）
L73-91  login variant 提前 return                ← 新增（用 resolvedVariant）
L93-    原有代码（app variant）                   ← 基本不变，只加类型收窄
```

### 11.6 当前职责

页面顶部导航栏，展示应用名称、登录状态、历史按钮，管理 AuthModal 和 SetPasswordPrompt。

### 11.7 本阶段改什么

- Props 接口：增加 `variant`（可选，默认 `"app"`），`historyPanelId` 等变可选
- 新增 `variant === "landing"` 渲染分支（约 25 行）
- 新增 `variant === "login"` 渲染分支（约 18 行）
- 原有 app 渲染逻辑增加类型收窄（约 5 行）

### 11.8 不改什么

- AuthModal 渲染逻辑：**不变**（仅在 app variant 渲染）
- SetPasswordPrompt 渲染逻辑：**不变**（仅在 app variant 渲染）
- 历史按钮交互逻辑：**不变**
- 登录状态展示：**不变**
- Header 布局和样式：**不变**
- useAuth 调用：**不变**

### 11.9 Codex 注意事项

0. **variant 可选**：`variant` 默认 `"app"`，通过 `const resolvedVariant = variant ?? "app"` 解析。所有新调用（MainWorkspace、Landing `page.tsx`、login `page.tsx`）必须显式传 variant
1. **landing/login 的 `<a>` 标签**：可以使用原生 `<a>` 或 `next/link` `<Link>`——两种都接受。如果用 `<Link>`，需要新增 `import Link from "next/link"`
2. **app variant 的 props 类型收窄**：使用非空断言 `!` 或默认值，确保 TypeScript 编译通过
3. **历史按钮只在 app variant 渲染**：landing/login 不需要历史按钮（它们不是工作台）
4. **AuthModal 只在 app variant 渲染**：landing/login 通过页面跳转完成登录，不需要弹窗
5. **SetPasswordPrompt 只在 app variant 渲染**：LoginPageContent 登录后直接跳转 `/app`，SetPasswordPrompt 统一由 Header variant="app" 管理
6. **不要改变现有 app variant 的任何行为**——这是最关键的约束
7. **Header 改动是 7 个文件中风险最高的**——因为现有逻辑必须保持不变。建议先写 landing/login 的提前 return（纯新增代码），再处理 app variant 的 props 类型收窄

---

## 十二、风险控制

### 12.1 核心风险

| # | 风险 | 等级 | 影响 | 缓解措施 |
|---|------|:---:|------|---------|
| 1 | **MainWorkspace 搬迁引入 bug** | **P1** | 搬迁过程中不小心改了某个 handler 逻辑 | **纯复制粘贴**——从 page.tsx 复制到 MainWorkspace.tsx，只改函数名和 Header 的 variant prop。不重构、不优化 |
| 2 | **Header variant="app" 行为变化** | **P1** | app variant 的 AuthModal / SetPasswordPrompt / 历史按钮与旧 Header 不一致 | app variant 走**完全相同**的代码路径。只增加类型收窄，不改逻辑 |
| 3 | **LoginPageContent 与 AuthModal 行为不一致** | **P2** | `/login` 登录流程 bug（与弹窗登录不同） | 使用相同的 `useAuth` hooks + `AUTH_TEXT`。如发现 behavior gap，在 Code Review 阶段修复 |
| 4 | **`/app` 直接访问 404** | **P2** | `src/app/app/page.tsx` 与 Next.js `app/` 目录名冲突 | Next.js App Router 的 URL 由 `src/app/` 下的文件夹决定。`src/app/app/page.tsx` → `/app`。`npm run build` 会验证 |
| 5 | **已登录用户访问 `/` 闪烁 Landing Page** | **P2** | `isLoading` 期间先渲染 Landing Page 再跳转 | `isLoading` 和 `user` 存在时 return null |
| 6 | **SetPasswordPrompt 在 `/login` 和 `/app` 两处同时弹出** | **P2** | 用户在 `/login` 登录后跳转 `/app`，Header 又弹一次 | LoginPageContent 登录成功后直接 `router.replace("/app")`，不管理 SetPasswordPrompt。设置密码引导统一由 Header `variant="app"` 负责（复用 V2.1B 已验证的 `skippedPasswordPromptUserId` 逻辑），避免双入口重复弹窗 |

### 12.2 不变保证

| 保证 | 验证方式 |
|------|---------|
| MainWorkspace 只搬迁，不重构 | diff page.tsx 和 MainWorkspace.tsx 只应有函数名 + variant prop 差异 |
| Header variant="app" 保持旧 Header 行为 | 在 `/app` 中点击历史按钮 → AuthModal → 登出，与旧 `/` 行为对比 |
| LoginPageContent 不修改 AuthModal | `git diff` 确认 AuthModal.tsx 零变更 |
| `/app` 不加登录守卫 | `app/page.tsx` 中无 `useEffect` 跳转逻辑 |
| useAuth 不改 | `git diff` 确认 |
| useTaskGroup 不改 | `git diff` 确认 |
| API 不改 | `git diff --stat src/app/api/` 无输出 |
| 数据库不改 | 确认无 migration 文件 |

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
| 4 | 已登录用户访问 `/` | 自动跳转 `/app`（无闪烁） |
| 5 | 已登录用户访问 `/login` | 自动跳转 `/app`（无闪烁） |
| 6 | 未登录用户访问 `/app` | 正常显示工作台，可匿名使用 |
| 7 | 未登录用户访问 `/` | 显示 Landing Page，不跳转 |
| 8 | 未登录用户访问 `/login` | 显示登录页面，不跳转 |

### 13.3 Landing Page 验收

| # | 验收项 | 预期结果 |
|---|--------|---------|
| 9 | CTA "免费开始使用" → 点击 | 跳转 `/app` |
| 10 | "已有账号？登录" → 点击 | 跳转 `/login` |
| 11 | Header "登录"按钮 → 点击 | 跳转 `/login` |
| 12 | Header "免费开始使用"按钮 → 点击 | 跳转 `/app` |

### 13.4 Login Page 验收

| # | 验收项 | 预期结果 |
|---|--------|---------|
| 13 | 默认显示验证码登录 Tab | Tab 样式与 AuthModal 一致 |
| 14 | 可切换到密码登录 Tab | 切换正常，邮箱保留 |
| 15 | 输入邮箱 → 发送验证码 → 收到邮件 | OTP 流程正常 |
| 16 | 输入正确验证码 → 自动登录 | 登录成功 |
| 17 | 登录成功后 | 直接跳转 `/app` |
| 18 | 跳转 `/app` 后 `password_set !== true` | Header variant="app" 弹出 SetPasswordPrompt（复用 V2.1B 已验证逻辑） |
| 19 | 密码登录 → 输入邮箱+密码 → 登录 | 登录成功 |
| 20 | 登录成功后 `password_set === true` | 直接跳转 `/app`，不弹引导 |
| 21 | "← 返回首页"链接 → 点击 | 跳转 `/` |

### 13.5 App Main Workspace 验收

| # | 验收项 | 预期结果 |
|---|--------|---------|
| 22 | 匿名用户输入目标 → 生成任务 | 正常（device_id 模式） |
| 23 | 匿名用户勾选任务 | 正常 |
| 24 | 匿名用户查看统计 | 正常 |
| 25 | 匿名用户查看历史 | 正常 |
| 26 | 匿名用户使用 AI 复盘 | 正常 |
| 27 | 匿名用户点击 Header "登录" → AuthModal | 弹窗正常，登录后任务迁移正常 |
| 28 | 已登录用户使用全部功能 | 与旧 `/` 体验完全一致 |
| 29 | 已登录用户刷新 `/app` | session 恢复，任务从云端加载 |
| 30 | 已登录用户登出 | Header 恢复"登录"按钮，任务回退 device_id |
| 31 | 跨天提示（NewDayPrompt） | 正常 |
| 32 | 清空 / 重新生成 | 正常 |
| 33 | 历史面板展开/收起/加载更多 | 正常 |
| 34 | 智能任务调整（Phase 15） | 正常 |

### 13.6 兼容验收

| # | 验收项 | 预期结果 |
|---|--------|---------|
| 35 | 匿名任务登录后迁移 | 正常 |
| 36 | Phase 14 AI 复盘不受影响 | 正常 |
| 37 | Phase 15 智能调整不受影响 | 正常 |
| 38 | 直接访问 `/app`（不经过 `/`） | 正常工作 |
| 39 | V2.1B 验证码/密码登录不回归 | 全部 Auth 流程正常 |

### 13.7 门禁验收

| # | 验收项 | 命令 |
|---|--------|------|
| 40 | TypeScript 编译通过 | `npm run lint` |
| 41 | Next.js 构建通过 | `npm run build` |
| 42 | `git status --short` 仅显示允许修改的 7 个文件 | 手动检查 |

---

## 十四、禁止事项清单

### 14.1 禁止修改的文件

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

### 14.2 禁止行为

| # | 禁止 | 原因 |
|---|------|------|
| 1 | 不修改 useAuth | 现有接口已满足需求 |
| 2 | 不修改 useTaskGroup | 核心状态管理不改 |
| 3 | 不修改任何 API Route | 全部不动 |
| 4 | 不修改 AuthModal | 保留弹窗体验 |
| 5 | 不修改 SetPasswordPrompt | 复用不改 |
| 6 | 不修改数据库 schema / migration | 不需要 |
| 7 | 不修改 package.json | 无新依赖 |
| 8 | 不修改 .env.local | 无新环境变量 |
| 9 | 不引入 middleware.ts | client-side 路由守卫已足够 |
| 10 | 不引入服务端组件 | 所有页面保持 "use client" |
| 11 | 不做大规模 UI 美化 | V2.2B/C/D 职责 |
| 12 | 不重写 Auth UI | LoginPageContent 是独立组件，不改 AuthModal |
| 13 | 不在 `/app` 加登录守卫 | 方案 C——匿名可访问 |
| 14 | 不重构 MainWorkspace 内部逻辑 | 纯搬迁 |
| 15 | 不修改 types.ts | V2.2A 不需要新类型 |
| 16 | 不修改 constants.ts | 现有 AUTH_TEXT / UI_TEXT 复用 |

---

## 十五、给 Codex 的实现指令草案

> 以下是给 Codex 的实现指令。Codex 必须严格按本执行方案实现，禁止扩大范围。

### ✅ 可以做

1. 新增 `src/components/MainWorkspace.tsx` — 从当前 `page.tsx` 复制工作台内容，函数名改为 `MainWorkspace`，Header 增加 `variant="app"`（§五）
2. 新增 `src/app/app/page.tsx` — `/app` 路由极简薄壳，只渲染 `<MainWorkspace />`（§六）
3. 新增 `src/components/LandingPage.tsx` — Landing Page 视觉内容组件（§七）
4. 重写 `src/app/page.tsx` — Landing 路由入口，已登录跳转 `/app`（§八）
5. 新增 `src/components/LoginPageContent.tsx` — 页面版登录表单，复用 useAuth + AUTH_TEXT。登录成功后统一跳转 `/app`，不处理 SetPasswordPrompt（§九）
6. 新增 `src/app/login/page.tsx` — `/login` 路由入口，已登录跳转 `/app`（§十）
7. 修改 `src/components/Header.tsx` — 增加 `variant` prop，三种渲染分支（§十一）

### ❌ 不要做

1. **不要改 API Route** — `src/app/api/*` 全部不动
2. **不要改 callback route** — `src/app/auth/callback/route.ts` 不动
3. **不要改 hooks** — useAuth / useTaskGroup / useTaskHistory / useTaskStats / useTaskReview 全部不动
4. **不要改 AuthModal** — 保留不动
5. **不要改 SetPasswordPrompt** — 只复用，不改代码
6. **不要改其他 UI 组件** — GoalInput / TaskList / StatsBar / HistoryPanel / TaskReviewPanel / HeroSection / LoadingState / NewDayPrompt 全部不动
7. **不要改 lib** — types.ts / constants.ts / ai-client.ts / supabase-server.ts / supabase-client.ts / device-id.ts / task-parser.ts / review-parser.ts / stats-calculator.ts / adjust-task-strategy.ts / storage.ts / input-validator.ts / date-utils.ts 全部不动
8. **不要改 prompts** — task-generation.ts / task-review.ts 不动
9. **不要改数据库** — 不改 schema / migration / RLS
10. **不要新增 npm 依赖** — package.json 不动
11. **不要改 .env.local** — 不新增环境变量
12. **不要改 tailwind.config.ts / globals.css** — 样式不动
13. **不要引入 middleware.ts** — client-side 路由守卫已足够
14. **不要在 `/app` 加登录守卫** — 匿名可访问（方案 C）
15. **不要重构 MainWorkspace 内部逻辑** — 纯搬迁
16. **不要做 UI 美化** — V2.2B/C/D 职责
17. **不要修改 page.tsx 以外的任何现有文件**（除 Header.tsx）

### ⚠️ 如果发现需要改 §十四 禁止清单中的文件

**停下来，汇报。** 说明哪个文件、为什么需要改、当前执行方案哪里遗漏了。不要自行扩大修改范围。

### ⚠️ 关于 MainWorkspace 搬迁

从 `page.tsx` → `MainWorkspace.tsx` 的搬迁是**纯复制粘贴**，只改 3 处：
1. 函数名 `Home` → `MainWorkspace`
2. 导出方式 `export default` → `export function`
3. Header JSX 增加 `variant="app"` prop

**其他所有代码（imports、hooks、refs、handlers、useEffect、JSX）一个字不改。**

### ⚠️ 关于 Header variant="app" 的行为

**必须保持与当前 Header 100% 一致。** 包括：
- 历史按钮的 `aria-controls` / `aria-pressed` 属性
- 历史按钮高亮样式
- AuthModal 弹窗触发逻辑
- SetPasswordPrompt 弹出条件
- 登录状态展示
- 登出按钮行为

### ⚠️ 关于 LoginPageContent 和 AuthModal 的关系

LoginPageContent 是**独立组件**——不与 AuthModal 共享代码。但它们：
- 使用相同的 `useAuth` hooks（`sendOtp` / `verifyOtp` / `signInWithPassword`）
- 使用相同的 `AUTH_TEXT` constants

**不要在 LoginPageContent 中 import AuthModal，也不要修改 AuthModal。**

### ⚠️ 关于 LoginPageContent 和 SetPasswordPrompt

LoginPageContent **不** import 或渲染 `SetPasswordPrompt`。登录成功后统一 `router.replace("/app")`。进入 `/app` 后，MainWorkspace 内部的 Header `variant="app"` 会检查 `password_set` 标记并弹出 SetPasswordPrompt（复用 V2.1B 已验证的 `skippedPasswordPromptUserId` 逻辑）。这避免了 `/login` 和 `/app` 两处同时弹出 SetPasswordPrompt 的问题。

---

> **文档结束**
>
> **下一阶段**：本文档经 ChatGPT 审查通过后，Codex 按本文档实现代码。实现完成后 Claude Code 做 Code Review。
>
> **关联文档**：
> - [Architecture-V2.2A-Routing.md](Architecture-V2.2A-Routing.md) — V2.2A 架构方案（✅ 已通过审查，已提交 `542bd35`）
> - [Architecture-V2.1B-OTP-Password.md](Architecture-V2.1B-OTP-Password.md) — V2.1B 架构方案（✅ 已完成）
> - [Execution-Plan-V2.1B-OTP-Password.md](Execution-Plan-V2.1B-OTP-Password.md) — V2.1B 执行方案（✅ 已完成）
> - [Roadmap-V2.1-V2.3.md](Roadmap-V2.1-V2.3.md) — V2.1-V2.3 路线图
> - [PROJECT-CONTEXT.md](PROJECT-CONTEXT.md) — 项目长期上下文
> - [PROJECT-INDEX.md](PROJECT-INDEX.md) — 项目文件索引
