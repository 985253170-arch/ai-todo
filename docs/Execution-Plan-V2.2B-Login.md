# Execution-Plan-V2.2B-Login — 登录/注册页高级感设计 执行方案

> **状态**：执行方案，待 ChatGPT 审查
> **依赖**：[Architecture-V2.2B-Login.md](Architecture-V2.2B-Login.md)（架构方案已通过 ChatGPT 审查）
> **定位**：给 Codex 的精确实现指令——逐文件、逐区域、逐 className 的修改清单
> **上一文档**：[Architecture-V2.2B-Login.md](Architecture-V2.2B-Login.md) · [Execution-Plan-V2.2A-Routing.md](Execution-Plan-V2.2A-Routing.md)
> **编写日期**：2026-07-05
> **受众**：Codex（实现者）

---

## 目录

- [一、阶段目标](#一阶段目标)
- [二、实现策略](#二实现策略)
- [三、允许修改文件清单](#三允许修改文件清单)
- [四、禁止修改清单](#四禁止修改清单)
- [五、不改逻辑清单（Codex 红线）](#五不改逻辑清单codex-红线)
- [六、Codex 实现规则](#六codex-实现规则)
- [七、文件 1：src/app/login/page.tsx](#七文件-1srcapploginpagetsx)
- [八、文件 2：src/components/LoginPageContent.tsx](#八文件-2srccomponentsloginpagecontenttsx)
- [九、不改文件确认](#九不改文件确认)
- [十、验收清单](#十验收清单)
- [十一、给 Codex 的实现指令汇总](#十一给-codex-的实现指令汇总)

---

## 一、阶段目标

V2.2B 是 V2.2 UI 升级三步中的**第一步**：登录/注册页高级感设计。

**一句话目标**：让 `/login` 看起来像正式产品，而不是普通表单页。

### 1.1 实现范围

| 维度 | V2.2B 范围 |
|------|-----------|
| **做什么** | 美化 `/login` 页面的视觉设计：背景、卡片、Tab、输入框、按钮、提示信息、底部文案 |
| **不做什么** | 不改 Auth 逻辑、不改 useAuth、不改 AuthModal、不改 API、不改数据库、不改 `/app`、不做 AI 辅助执行 |
| **改多少文件** | **2 个文件**（login/page.tsx + LoginPageContent.tsx） |

### 1.2 与 V2.2A 的关系

V2.2A 已完成三页面路由结构（`/` `/login` `/app`）。LoginPageContent 是 V2.2A 创建的页面版登录表单组件（~424 行），功能完整但视觉偏基础。

V2.2B 在此基础之上，**仅改 className**，不改任何 JS 逻辑。

---

## 二、实现策略

### 2.1 核心原则

| # | 原则 | 说明 |
|---|------|------|
| 1 | **只改 className** | 所有 JS 逻辑（onClick / onChange / onSubmit / useEffect / useState）一行不动 |
| 2 | **不重构组件** | 不抽取子组件、不拆分文件、不改变组件结构 |
| 3 | **不新增文件** | 0 个新文件 |
| 4 | **不改 Header.tsx** | login variant 当前视觉已可用，本轮不改，降低风险 |
| 5 | **不改 SetPasswordPrompt.tsx** | 不属于 V2.2B 范围 |
| 6 | **不改 AUTH_TEXT / ERROR_MESSAGES** | 文案常量零变更 |
| 7 | **不改任何 import** | 不新增、不移除、不改路径 |

### 2.2 改动面一览

| 项目 | 数值 |
|------|:---:|
| 修改文件 | 2 个 |
| 新增文件 | 0 个 |
| 删除文件 | 0 个 |
| 新增 npm 依赖 | 0 个 |
| 数据库 schema 变更 | 0 个 |
| API Route 变更 | 0 个 |
| package.json 变更 | 0 个 |
| .env.local 变更 | 0 个 |

### 2.3 色彩调整摘要

| 元素 | V2.2A（当前） | V2.2B（目标） |
|------|-------------|-------------|
| 页面背景 | `bg-[#F8FAFF]` + `from-indigo-50 via-white to-sky-50` | `from-indigo-50/60 via-white to-sky-50/40`（更柔和） |
| 卡片阴影 | `shadow-[0_18px_60px_rgba(15,23,42,0.08)]` | `shadow-xl shadow-indigo-500/5`（彩色轻阴影） |
| 卡片边框 | `border-slate-200` | `border-slate-100`（更轻） |
| 错误提示 | `amber-50` / `amber-100` / `amber-800` | `red-50` / `red-100` / `red-700`（语义红色） |
| 成功提示 | `indigo-50` / `indigo-100` / `indigo-700` | `emerald-50` / `emerald-100` / `emerald-700`（语义绿色） |
| 主按钮 disabled | `from-slate-400 to-slate-400` | `from-slate-300 to-slate-300`（更淡） |
| 底部文案 | 无 | 新增"登录后即可同步你的任务记录与行动数据" |

---

## 三、允许修改文件清单

| # | 文件 | 操作 | 预计改动量 | 说明 |
|---|------|:---:|:---:|------|
| 1 | `src/app/login/page.tsx` | **修改** | ~3 行 className | 页面级背景渐变 + 容器调整 |
| 2 | `src/components/LoginPageContent.tsx` | **修改** | ~50 行 className | 卡片、Tab、输入框、按钮、提示信息视觉升级 + 新增底部文案 |

**总计：2 个文件，约 53 行 className 改动。0 个新文件。**

### 不纳入修改的文件

| 文件 | 原因 |
|------|------|
| `src/components/Header.tsx` | login variant 当前视觉已可用（"返回首页"链接 + App 名称 + 间距合理），本轮不改以降低风险 |
| `src/components/SetPasswordPrompt.tsx` | 不属于 V2.2B 范围。其样式统一留到后续单独评估 |

---

## 四、禁止修改清单

以下文件和目录 **V2.2B 完全不动**：

```
# Hooks
src/hooks/useAuth.ts
src/hooks/useTaskGroup.ts
src/hooks/useTaskHistory.ts
src/hooks/useTaskStats.ts
src/hooks/useTaskReview.ts

# API Routes
src/app/api/*

# Lib
src/lib/*

# Prompts
src/prompts/*

# 其他组件
src/components/AuthModal.tsx
src/components/SetPasswordPrompt.tsx
src/components/Header.tsx
src/components/MainWorkspace.tsx
src/components/LandingPage.tsx
src/components/GoalInput.tsx
src/components/TaskList.tsx
src/components/TaskItem.tsx
src/components/TaskProgress.tsx
src/components/CompleteAllPrompt.tsx
src/components/StatsBar.tsx
src/components/StatCard.tsx
src/components/HistoryPanel.tsx
src/components/HistoryItem.tsx
src/components/TaskReviewPanel.tsx
src/components/HeroSection.tsx
src/components/ExampleGoals.tsx
src/components/LoadingState.tsx
src/components/EmptyState.tsx
src/components/ErrorMessage.tsx
src/components/NewDayPrompt.tsx

# 其他页面
src/app/page.tsx
src/app/app/page.tsx
src/app/layout.tsx

# 配置
package.json
tailwind.config.ts
src/app/globals.css
.env.local

# 数据库
数据库 schema / migration
```

---

## 五、不改逻辑清单（Codex 红线）

以下 **LoginPageContent.tsx** 中的 JS 逻辑**一行都不能改**：

### 5.1 Hooks 调用

```
useAuth() 调用          — 不改
useRouter() 调用        — 不改
user / isLoading         — 不改解构
```

### 5.2 State 声明

```
mode, setMode                   — 不改
email, setEmail                 — 不改
password, setPassword           — 不改
token, setToken                 — 不改
otpSent, setOtpSent             — 不改
message, setMessage             — 不改
errorMessage, setErrorMessage   — 不改
isSubmitting, setIsSubmitting   — 不改
isPasswordVisible, setIsPasswordVisible — 不改
resendSeconds, setResendSeconds — 不改
```

### 5.3 useEffect

```typescript
// 已登录跳转 /app — 不改
useEffect(() => {
  if (!isLoading && user) {
    router.replace("/app");
  }
}, [isLoading, router, user]);

// 重发倒计时 — 不改
useEffect(() => {
  if (resendSeconds <= 0) return;
  const timer = window.setTimeout(() => {
    setResendSeconds((currentValue) => Math.max(0, currentValue - 1));
  }, 1000);
  return () => window.clearTimeout(timer);
}, [resendSeconds]);
```

### 5.4 函数

```
switchMode()              — 不改
validateEmail()           — 不改
handleSendOtp()           — 不改
handleVerifyOtp()         — 不改
handleOtpSubmit()         — 不改
handlePasswordSubmit()    — 不改
handleTokenChange()       — 不改
getSafeErrorMessage()     — 不改
isValidEmail()            — 不改
```

### 5.5 条件渲染

```typescript
if (isLoading || user) {
  return null;            // 不改
}
```

### 5.6 JSX 属性（不改）

```
onClick={...}             — 全部不改
onChange={...}            — 全部不改
onSubmit={...}            — 全部不改
type="..."                — 全部不改
disabled={...}            — 全部不改（属性值不改，只改 disabled 态的 className）
value={...}               — 全部不改
placeholder={...}         — 全部不改
inputMode="numeric"       — 不改
maxLength={6}             — 不改
autoComplete="..."        — 不改
minLength={6}             — 不改
```

### 5.7 文案常量

```
AUTH_TEXT.*               — 全部不改
ERROR_MESSAGES.*          — 全部不改
```

---

## 六、Codex 实现规则

Codex 必须严格遵守以下规则：

1. **只改 2 个允许文件**：`src/app/login/page.tsx` + `src/components/LoginPageContent.tsx`
2. **优先只改 className**：所有改动都应该是 className 字符串的替换
3. **不重构组件**：不拆分子组件、不提取函数
4. **不抽组件**：不创建新文件
5. **不新增文件**：0 个新文件
6. **不改函数名**：所有函数名保持原样
7. **不改 state**：不新增、不移除、不改名
8. **不改 hooks**：不新增 useEffect/useState/useCallback
9. **不改 API**：零 API Route 变更
10. **不改 lib**：零 lib 变更
11. **不改 prompts**：零 prompt 变更
12. **不改 package.json**：零依赖变更
13. **不改数据库**：零 schema 变更
14. **不做 AI 辅助执行**：不新增任何 AI 相关 UI
15. **不做 `/app` 美化**：不碰 MainWorkspace 及其子组件
16. **不做 V2.3 安全功能**：不做忘记密码/Turnstile/第三方登录
17. **不提交 commit**：修改完成后只报告，不提交
18. **修改后必须运行**：
    ```bash
    npm run lint
    npm run build
    ```
19. **最后必须报告**：
    ```bash
    git status --short
    git diff --stat
    ```

---

## 七、文件 1：src/app/login/page.tsx

**当前文件**：`src/app/login/page.tsx`（15 行）

### 7.1 当前代码

```typescript
"use client";

import { Header } from "@/components/Header";
import { LoginPageContent } from "@/components/LoginPageContent";

export default function LoginPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F8FAFF] bg-gradient-to-b from-indigo-50 via-white to-sky-50 px-4 py-6 pb-[env(safe-area-inset-bottom,1rem)] text-slate-950 sm:px-6 sm:py-10">
      <div className="mx-auto flex max-w-[420px] flex-col gap-6 sm:gap-7">
        <Header variant="login" />
        <LoginPageContent />
      </div>
    </main>
  );
}
```

### 7.2 当前职责

`/login` 路由入口薄壳。渲染 Header variant="login" + LoginPageContent。

### 7.3 本阶段改什么

仅调整 `<main>` 的 className：

| # | 改动 | 当前值 | 新值 | 原因 |
|---|------|--------|------|------|
| 1 | 页面背景渐变 | `from-indigo-50 via-white to-sky-50` | `from-indigo-50/60 via-white to-sky-50/40` | 更柔和、与 App 背景有微妙差异 |
| 2 | 移除硬编码底色 | `bg-[#F8FAFF]` | 移除 | 渐变本身已提供背景色，硬编码底色多余 |
| 3 | 高度单位 | `min-h-screen` | `min-h-[100dvh]` | dynamic viewport height，键盘弹起后可视区域正确 |
| 4 | 容器宽度 | `max-w-[420px]` | `max-w-sm` | 384px 标准宽度，与卡片宽度一致 |

### 7.4 目标代码

```typescript
"use client";

import { Header } from "@/components/Header";
import { LoginPageContent } from "@/components/LoginPageContent";

export default function LoginPage() {
  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-gradient-to-b from-indigo-50/60 via-white to-sky-50/40 px-4 py-6 pb-[env(safe-area-inset-bottom,1rem)] text-slate-950 sm:px-6 sm:py-10">
      <div className="mx-auto flex max-w-sm flex-col gap-6 sm:gap-7">
        <Header variant="login" />
        <LoginPageContent />
      </div>
    </main>
  );
}
```

### 7.5 差异对照

```diff
-    <main className="min-h-screen overflow-x-hidden bg-[#F8FAFF] bg-gradient-to-b from-indigo-50 via-white to-sky-50 px-4 py-6 pb-[env(safe-area-inset-bottom,1rem)] text-slate-950 sm:px-6 sm:py-10">
-      <div className="mx-auto flex max-w-[420px] flex-col gap-6 sm:gap-7">
+    <main className="min-h-[100dvh] overflow-x-hidden bg-gradient-to-b from-indigo-50/60 via-white to-sky-50/40 px-4 py-6 pb-[env(safe-area-inset-bottom,1rem)] text-slate-950 sm:px-6 sm:py-10">
+      <div className="mx-auto flex max-w-sm flex-col gap-6 sm:gap-7">
```

### 7.6 不改什么

| 项目 | 说明 |
|------|------|
| import 语句 | 不改 |
| 函数名和导出方式 | 不改 |
| Header variant="login" | 不改 |
| LoginPageContent 引用 | 不改 |
| `overflow-x-hidden` | 保留（防止横向滚动） |
| `px-4 py-6` / `sm:px-6 sm:py-10` | 保留（间距合理） |
| `pb-[env(safe-area-inset-bottom,1rem)]` | 保留（iPhone 安全区） |
| `text-slate-950` | 保留 |
| `flex-col gap-6 sm:gap-7` | 保留 |
| **不新增任何 JS 逻辑** | — |
| **不新增任何 import** | — |

---

## 八、文件 2：src/components/LoginPageContent.tsx

**当前文件**：`src/components/LoginPageContent.tsx`（424 行）

这是 V2.2B 的**主要修改文件**。以下按区域逐项列出 className 改动。

### 8A. 卡片容器（section）

#### 当前代码（L235）

```tsx
<section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] sm:p-6">
```

#### 改动

| 属性 | 当前值 | 新值 | 原因 |
|------|--------|------|------|
| 边框 | `border-slate-200` | `border-slate-100` | 更轻、更精致 |
| 阴影 | `shadow-[0_18px_60px_rgba(15,23,42,0.08)]` | `shadow-xl shadow-indigo-500/5` | 轻量 indigo 彩色阴影，替代灰暗大阴影 |

#### 目标代码

```tsx
<section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xl shadow-indigo-500/5 sm:p-6">
```

#### 不改

- `rounded-3xl` — 保留（24px 大圆角）
- `bg-white` — 保留
- `p-5 sm:p-6` — 保留

---

### 8B. 标题区（h1 + p）

#### 当前代码（L236-243）

```tsx
<div className="mb-5">
  <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
    {AUTH_TEXT.MODAL_TITLE}
  </h1>
  <p className="mt-2 text-sm leading-6 text-slate-500">
    {AUTH_TEXT.MODAL_DESCRIPTION}
  </p>
</div>
```

#### 改动

**不改。** 当前标题区 className 已满足设计规格（§3.4 字体层级：标题 `text-2xl font-semibold tracking-tight`，描述 `text-sm leading-6 text-slate-500`）。

---

### 8C. Tab 区

#### 当前代码（L245-268）

```tsx
<div className="mb-4 grid grid-cols-2 rounded-full bg-slate-100 p-1">
  <button
    className={`min-h-10 rounded-full text-sm font-semibold transition ${
      isOtpMode
        ? "bg-white text-indigo-700 shadow-sm"
        : "text-slate-500 hover:text-slate-700"
    }`}
    onClick={() => switchMode("otp")}
    type="button"
  >
    {AUTH_TEXT.OTP_LOGIN_TAB}
  </button>
  <button
    className={`min-h-10 rounded-full text-sm font-semibold transition ${
      !isOtpMode
        ? "bg-white text-indigo-700 shadow-sm"
        : "text-slate-500 hover:text-slate-700"
    }`}
    onClick={() => switchMode("password")}
    type="button"
  >
    {AUTH_TEXT.PASSWORD_LOGIN_TAB}
  </button>
</div>
```

#### 改动

| # | 位置 | 当前值 | 新值 | 原因 |
|---|------|--------|------|------|
| 1 | 容器 margin-bottom | `mb-4` | `mb-5` | 增加 Tab 到表单的间距 |
| 2 | 每个 Tab 高度 | `min-h-10` (40px) | `min-h-[42px]` | 触控友好（≥42px），视觉更舒适 |
| 3 | 每个 Tab 增加 active | 无 | `active:scale-[0.97]` | 按下微反馈 |
| 4 | 每个 Tab 增加 disabled | 无 | `disabled:opacity-50 disabled:cursor-not-allowed` | loading 时不可操作 |

#### 目标代码

```tsx
<div className="mb-5 grid grid-cols-2 rounded-full bg-slate-100 p-1">
  <button
    className={`min-h-[42px] rounded-full text-sm font-semibold transition active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed ${
      isOtpMode
        ? "bg-white text-indigo-700 shadow-sm"
        : "text-slate-500 hover:text-slate-700"
    }`}
    onClick={() => switchMode("otp")}
    type="button"
  >
    {AUTH_TEXT.OTP_LOGIN_TAB}
  </button>
  <button
    className={`min-h-[42px] rounded-full text-sm font-semibold transition active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed ${
      !isOtpMode
        ? "bg-white text-indigo-700 shadow-sm"
        : "text-slate-500 hover:text-slate-700"
    }`}
    onClick={() => switchMode("password")}
    type="button"
  >
    {AUTH_TEXT.PASSWORD_LOGIN_TAB}
  </button>
</div>
```

#### 不改

- `grid grid-cols-2` — 保留（双列布局）
- `rounded-full` — 保留（pill 风格）
- `bg-slate-100` — 保留（容器背景）
- `p-1` — 保留（容器内边距）
- 选中态 `bg-white text-indigo-700 shadow-sm` — 保留
- 未选中态 `text-slate-500 hover:text-slate-700` — 保留
- `onClick={() => switchMode(...)}` — **不改**
- `type="button"` — 不改

---

### 8D. 邮箱输入框（OTP 模式）

#### 当前代码（L272-290）

```tsx
<label className="grid gap-2">
  <span className="text-sm font-medium text-slate-700">
    {AUTH_TEXT.EMAIL_LABEL}
  </span>
  <input
    className="min-h-12 rounded-xl border border-slate-200 px-4 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
    onChange={(event) => {
      setEmail(event.target.value);
      setToken("");
      setOtpSent(false);
      setMessage(null);
      setErrorMessage(null);
      setResendSeconds(0);
    }}
    placeholder={AUTH_TEXT.EMAIL_PLACEHOLDER}
    type="email"
    value={email}
  />
</label>
```

#### 改动

| # | 属性 | 当前值 | 新值 | 原因 |
|---|------|--------|------|------|
| 1 | 高度 | `min-h-12` (48px) | `min-h-[48px]` | 统一用精确值，与设计规格一致 |
| 2 | focus ring 透明度 | `focus:ring-indigo-100` | `focus:ring-indigo-500/10` | 更微妙的 focus ring，与设计规格一致 |

#### 目标代码

```tsx
<label className="grid gap-2">
  <span className="text-sm font-medium text-slate-700">
    {AUTH_TEXT.EMAIL_LABEL}
  </span>
  <input
    className="min-h-[48px] rounded-xl border border-slate-200 px-4 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
    onChange={(event) => {
      setEmail(event.target.value);
      setToken("");
      setOtpSent(false);
      setMessage(null);
      setErrorMessage(null);
      setResendSeconds(0);
    }}
    placeholder={AUTH_TEXT.EMAIL_PLACEHOLDER}
    type="email"
    value={email}
  />
</label>
```

#### 不改

- `type="email"` — 不改
- `value={email}` — 不改
- `onChange={...}` — **不改**（整个 handler 不动）
- `placeholder={AUTH_TEXT.EMAIL_PLACEHOLDER}` — 不改
- `rounded-xl` — 保留
- `border-slate-200` — 保留（default 态边框）

---

### 8E. 邮箱输入框（密码模式）

密码模式下的邮箱输入框（L363-369）与 OTP 模式下的邮箱输入框改动相同。

#### 当前代码

```tsx
<input
  className="min-h-12 rounded-xl border border-slate-200 px-4 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
  onChange={(event) => setEmail(event.target.value)}
  placeholder={AUTH_TEXT.EMAIL_PLACEHOLDER}
  type="email"
  value={email}
/>
```

#### 目标代码

```tsx
<input
  className="min-h-[48px] rounded-xl border border-slate-200 px-4 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
  onChange={(event) => setEmail(event.target.value)}
  placeholder={AUTH_TEXT.EMAIL_PLACEHOLDER}
  type="email"
  value={email}
/>
```

---

### 8F. OTP 验证码输入框

#### 当前代码（L297-305）

```tsx
<input
  className="min-h-12 rounded-xl border border-slate-200 px-4 text-center text-lg font-semibold tracking-[0.35em] text-slate-950 outline-none placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
  inputMode="numeric"
  maxLength={6}
  onChange={(event) => handleTokenChange(event.target.value)}
  placeholder={AUTH_TEXT.OTP_PLACEHOLDER}
  value={token}
/>
```

#### 改动

| # | 属性 | 当前值 | 新值 | 原因 |
|---|------|--------|------|------|
| 1 | 高度 | `min-h-12` | `min-h-[48px]` | 统一 |
| 2 | focus ring | `focus:ring-indigo-100` | `focus:ring-indigo-500/10` | 统一 |

#### 目标代码

```tsx
<input
  className="min-h-[48px] rounded-xl border border-slate-200 px-4 text-center text-lg font-semibold tracking-[0.35em] text-slate-950 outline-none placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
  inputMode="numeric"
  maxLength={6}
  onChange={(event) => handleTokenChange(event.target.value)}
  placeholder={AUTH_TEXT.OTP_PLACEHOLDER}
  value={token}
/>
```

#### 不改

- `inputMode="numeric"` — 不改（手机数字键盘）
- `maxLength={6}` — 不改
- `onChange={(event) => handleTokenChange(event.target.value)}` — **不改**
- `value={token}` — 不改
- `text-center text-lg font-semibold tracking-[0.35em]` — 保留
- `autoComplete="one-time-code"` — **注意：当前代码中没有此属性。不新增。**

---

### 8G. 密码输入框容器

#### 当前代码（L376-394）

```tsx
<div className="flex min-h-12 items-center rounded-xl border border-slate-200 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100">
  <input
    className="min-h-12 min-w-0 flex-1 rounded-xl px-4 text-base text-slate-950 outline-none placeholder:text-slate-400"
    minLength={6}
    onChange={(event) => setPassword(event.target.value)}
    placeholder={AUTH_TEXT.PASSWORD_PLACEHOLDER}
    type={isPasswordVisible ? "text" : "password"}
    value={password}
  />
  <button
    className="min-h-12 px-4 text-sm font-semibold text-slate-500 transition hover:text-indigo-700"
    onClick={() =>
      setIsPasswordVisible((currentValue) => !currentValue)
    }
    type="button"
  >
    {isPasswordVisible ? "隐藏" : "显示"}
  </button>
</div>
```

#### 改动

| # | 位置 | 当前值 | 新值 | 原因 |
|---|------|--------|------|------|
| 1 | 外层容器高度 | `min-h-12` | `min-h-[48px]` | 统一 |
| 2 | 外层容器 focus ring | `focus-within:ring-indigo-100` | `focus-within:ring-indigo-500/10` | 统一 |
| 3 | input 高度 | `min-h-12` | `min-h-[48px]` | 统一 |
| 4 | 显示/隐藏按钮高度 | `min-h-12` | `min-h-[48px]` | 统一 |

#### 目标代码

```tsx
<div className="flex min-h-[48px] items-center rounded-xl border border-slate-200 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10">
  <input
    className="min-h-[48px] min-w-0 flex-1 rounded-xl px-4 text-base text-slate-950 outline-none placeholder:text-slate-400"
    minLength={6}
    onChange={(event) => setPassword(event.target.value)}
    placeholder={AUTH_TEXT.PASSWORD_PLACEHOLDER}
    type={isPasswordVisible ? "text" : "password"}
    value={password}
  />
  <button
    className="min-h-[48px] px-4 text-sm font-semibold text-slate-500 transition hover:text-indigo-700"
    onClick={() =>
      setIsPasswordVisible((currentValue) => !currentValue)
    }
    type="button"
  >
    {isPasswordVisible ? "隐藏" : "显示"}
  </button>
</div>
```

#### 不改

- `onClick={() => setIsPasswordVisible(...)}` — **不改**
- `type={isPasswordVisible ? "text" : "password"}` — 不改
- `minLength={6}` — 不改
- `focus-within:` 模式 — 保留（容器级 focus 态）

---

### 8H. 成功提示（message）

#### 当前代码（OTP 模式 L309-311，密码模式无 message）

```tsx
{message ? (
  <p className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
    {message}
  </p>
) : null}
```

#### 改动

| # | 属性 | 当前值 | 新值 | 原因 |
|---|------|--------|------|------|
| 1 | 背景 | `bg-indigo-50` | `bg-emerald-50` | 成功语义色（翠绿） |
| 2 | 边框 | `border-indigo-100` | `border-emerald-100` |  |
| 3 | 文字 | `text-indigo-700` | `text-emerald-700` |  |

#### 目标代码

```tsx
{message ? (
  <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
    {message}
  </p>
) : null}
```

---

### 8I. 错误提示（errorMessage）

#### 当前代码（两处：OTP 模式 L314-318，密码模式 L397-401）

```tsx
{errorMessage ? (
  <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">
    {errorMessage}
  </p>
) : null}
```

#### 改动

| # | 属性 | 当前值 | 新值 | 原因 |
|---|------|--------|------|------|
| 1 | 背景 | `bg-amber-50` | `bg-red-50` | 错误语义色（温和红） |
| 2 | 边框 | `border-amber-100` | `border-red-100` |  |
| 3 | 文字 | `text-amber-800` | `text-red-700` |  |

**注意**：此改动需要应用到**两处**——OTP 模式的 errorMessage（L315）和密码模式的 errorMessage（L398）。两处的 className 字符串完全相同，Codex 需要两处都改。

#### 目标代码

```tsx
{errorMessage ? (
  <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
    {errorMessage}
  </p>
) : null}
```

---

### 8J. 主按钮（两处：OTP 模式 + 密码模式）

#### 当前代码（OTP 模式 L320-332，密码模式 L403-411）

```tsx
<button
  className="min-h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 px-5 text-base font-semibold text-white shadow-[0_4px_12px_rgba(79,70,229,0.2)] transition duration-150 hover:-translate-y-px hover:shadow-[0_8px_18px_rgba(79,70,229,0.26)] active:translate-y-0 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-400 disabled:shadow-none"
  disabled={isSubmitting}
  type="submit"
>
```

#### 改动

| # | 属性 | 当前值 | 新值 | 原因 |
|---|------|--------|------|------|
| 1 | 高度 | `min-h-12` | `min-h-[48px]` | 统一 |
| 2 | shadow default | `shadow-[0_4px_12px_rgba(79,70,229,0.2)]` | `shadow-md shadow-indigo-500/20` | 简化，用 Tailwind 内置 shadow + 彩色 opacity |
| 3 | shadow hover | `hover:shadow-[0_8px_18px_rgba(79,70,229,0.26)]` | `hover:shadow-lg hover:shadow-indigo-500/25` | 简化 |
| 4 | disabled 渐变 | `disabled:from-slate-400 disabled:to-slate-400` | `disabled:from-slate-300 disabled:to-slate-300` | 更淡的 disabled 态 |
| 5 | active 缩放 | 无 | `active:scale-[0.98]` | 按下微反馈 |

**注意**：此改动需要应用到**两处**——OTP 模式的主按钮（L321）和密码模式的主按钮（L404）。两处的 className 字符串完全相同，Codex 需要两处都改。

#### 目标代码

```tsx
<button
  className="min-h-[48px] rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 px-5 text-base font-semibold text-white shadow-md shadow-indigo-500/20 transition duration-150 hover:-translate-y-px hover:shadow-lg hover:shadow-indigo-500/25 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
  disabled={isSubmitting}
  type="submit"
>
```

#### 不改

- `disabled={isSubmitting}` — **不改**
- `type="submit"` — 不改
- 按钮内部文案逻辑 — 不改（`isSubmitting ? ... : ...`）
- `bg-gradient-to-r from-indigo-600 to-blue-500` — 保留（品牌渐变）

---

### 8K. 重新发送按钮（OTP 模式）

#### 当前代码（L335-346）

```tsx
<button
  className="min-h-11 rounded-full px-4 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
  disabled={isSubmitting || resendSeconds > 0}
  onClick={() => {
    void handleSendOtp();
  }}
  type="button"
>
```

#### 改动

| # | 属性 | 当前值 | 新值 | 原因 |
|---|------|--------|------|------|
| 1 | 高度 | `min-h-11` (44px) | `min-h-[44px]` | 统一精确值 |

#### 目标代码

```tsx
<button
  className="min-h-[44px] rounded-full px-4 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
  disabled={isSubmitting || resendSeconds > 0}
  onClick={() => {
    void handleSendOtp();
  }}
  type="button"
>
```

#### 不改

- `onClick={() => { void handleSendOtp(); }}` — **不改**
- `disabled={isSubmitting || resendSeconds > 0}` — 不改
- 倒计时文案逻辑 — 不改

---

### 8L. 切换提示按钮（两处）

#### 当前代码（OTP 模式 L349-355，密码模式 L413-419）

```tsx
<button
  className="text-center text-sm leading-6 text-slate-500 transition hover:text-indigo-700"
  onClick={() => switchMode("password")}  // 或 switchMode("otp")
  type="button"
>
  {AUTH_TEXT.OTP_SWITCH_HINT}  {/* 或 AUTH_TEXT.PASSWORD_LOGIN_SWITCH_HINT */}
</button>
```

#### 改动

**不改。** 当前样式已满足设计规格。`text-sm leading-6 text-slate-500 hover:text-indigo-700` 简洁清晰。

---

### 8M. 新增：底部辅助文案

#### 当前状态

LoginPageContent **没有**底部辅助文案。卡片 section 闭合后直接就是组件的 return 结束。

#### 新增内容

在 `</section>` 闭合标签之后、组件 return 结束之前，新增一行底部文案：

```tsx
<p className="mt-6 text-center text-xs text-slate-400">
  登录后即可同步你的任务记录与行动数据
</p>
```

#### 放置位置

在 section 闭合标签 `</section>`（当前 L422）之后。即在卡片下方、组件 return 结束前。

#### 目标代码（在 section 之后添加）

```tsx
      </section>

      <p className="mt-6 text-center text-xs text-slate-400">
        登录后即可同步你的任务记录与行动数据
      </p>
    </>
```

（以上仅为示意。实际代码中 LoginPageContent 的 return 是在 section 之后直接结束，需将新增的 `<p>` 放在 `</section>` 和 `)` 之间。）

#### 文案规格

| 属性 | 值 | 说明 |
|------|-----|------|
| 文案 | `登录后即可同步你的任务记录与行动数据` | 硬编码中文，不使用 AUTH_TEXT 常量 |
| 字号 | `text-xs` | 12px |
| 颜色 | `text-slate-400` | 淡灰，不抢焦点 |
| 对齐 | `text-center` | 居中 |
| 上间距 | `mt-6` | 与卡片保持 24px 间距 |
| 链接 | 无 | 纯展示文案 |
| 暗示 | 无 | 不暗示已有使用条款/隐私政策页面 |

#### 不改

- 不新增 `AUTH_TEXT` 常量
- 不新增 `<Link>` 或 `<a>` 标签
- 不新增页面或路由

---

### 8N. 汇总：LoginPageContent.tsx 所有 className 改动

| 区域 | 改动数 | 类型 |
|------|:---:|------|
| 8A. 卡片容器 | 2 | border + shadow 替换 |
| 8B. 标题区 | 0 | 不改 |
| 8C. Tab 区 | 4 | min-h + active + disabled + mb |
| 8D. OTP 邮箱输入 | 2 | min-h + focus:ring |
| 8E. 密码模式邮箱输入 | 2 | min-h + focus:ring |
| 8F. OTP 验证码输入 | 2 | min-h + focus:ring |
| 8G. 密码输入框容器 | 4 | 外层 min-h + focus:ring + input min-h + 按钮 min-h |
| 8H. 成功提示 | 3 | bg + border + text（amber→emerald） |
| 8I. 错误提示 ×2 | 6 | bg + border + text（amber→red），两处 |
| 8J. 主按钮 ×2 | 10 | min-h + shadow×2 + disabled + active，两处 |
| 8K. 重新发送按钮 | 1 | min-h |
| 8L. 切换提示按钮 | 0 | 不改 |
| 8M. 底部文案 | 1 | 新增 `<p>` 元素 |
| **合计** | **~37 处** | |

---

## 九、不改文件确认

以下文件 V2.2B **零改动**，Codex 不需要打开它们：

```
✅ src/components/Header.tsx           — login variant 当前可用，本轮不改
✅ src/components/SetPasswordPrompt.tsx — 不属于 V2.2B 范围
✅ src/components/AuthModal.tsx         — 弹窗登录，不属于 V2.2B
✅ src/hooks/useAuth.ts                 — Auth 逻辑层
✅ src/lib/constants.ts                 — AUTH_TEXT / ERROR_MESSAGES 不改
✅ src/app/api/*                        — 全部 API Route
✅ src/app/page.tsx                     — Landing Page
✅ src/app/app/page.tsx                 — App 主工作台
✅ 所有其他组件                          — 不属于 V2.2B
✅ package.json / tailwind.config.ts / globals.css  — 配置不改
```

---

## 十、验收清单

### 10.1 视觉验收

| # | 验收项 | 预期结果 |
|---|--------|---------|
| V1 | `/login` 页面视觉明显提升 | 卡片、输入框、按钮、Tab 比 V2.2A 更精致、更有产品感 |
| V2 | 页面背景为柔和蓝紫渐变 | `from-indigo-50/60 via-white to-sky-50/40`，与 App 背景同色系但更柔和 |
| V3 | 登录卡片有分离感 | 白色卡片 + `border-slate-100` + `shadow-xl shadow-indigo-500/5`，浮于背景之上 |
| V4 | Tab 选中态对比度增强 | 选中：白色 + indigo-700 + shadow-sm；未选中：slate-500 |
| V5 | 输入框 focus 态有明显 ring | `focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10` |
| V6 | 错误提示为温和红色调 | `bg-red-50 border-red-100 text-red-700` |
| V7 | 成功提示为翠绿色调 | `bg-emerald-50 border-emerald-100 text-emerald-700` |
| V8 | 主按钮 disabled 态清晰 | `from-slate-300 to-slate-300` + 无阴影 |
| V9 | 主按钮 active 有缩放反馈 | `active:scale-[0.98]` |
| V10 | 底部文案正确显示 | "登录后即可同步你的任务记录与行动数据"（text-xs text-slate-400 居中，无链接） |
| V11 | 375px 手机无横向滚动 | 页面宽度适配，无 `overflow-x` 问题 |

### 10.2 功能回归验收

| # | 验收项 | 预期结果 |
|---|--------|---------|
| F1 | 未登录访问 `/login` 显示登录页 | 表单正常显示，不跳转 |
| F2 | 已登录访问 `/login` 自动跳转 `/app` | 不显示登录表单，直接跳转（`useEffect` 守卫不改） |
| F3 | 验证码登录完整流程 | 输入邮箱 → 发送验证码 → 收到邮件 → 输入 6 位码 → 自动验证 → 跳转 `/app` |
| F4 | 密码登录完整流程 | 切换到密码 Tab → 邮箱保留 → 输入密码 → 登录成功 → 跳转 `/app` |
| F5 | 6 位验证码输入满自动验证 | `handleTokenChange` + `useEffect` 逻辑不改，自动提交正常 |
| F6 | 重新发送倒计时正常 | 发送后 60s 倒计时，结束后显示"重新发送" |
| F7 | 错误提示正常显示 | 空邮箱、错误验证码、错误密码分别显示对应中文提示 |
| F8 | 密码显示/隐藏正常 | 点击切换按钮，`isPasswordVisible` 逻辑不改 |
| F9 | Tab 切换邮箱保留 | 从 OTP 切到密码，邮箱不清空（`switchMode` 中不含 `setEmail`） |
| F10 | 登录成功进入 `/app` | `router.replace("/app")` 不改 |
| F11 | `/app` 中 SetPasswordPrompt 正常 | Header variant="app" 管理，V2.2B 不影响 |
| F12 | AuthModal 不受影响 | `/app` 内弹窗登录体验不变 |

### 10.3 兼容验收

| # | 验收项 | 预期结果 |
|---|--------|---------|
| C1 | Header login variant 正常 | "返回首页"链接 + App 名称正常显示和跳转 |
| C2 | Landing Page 不受影响 | `/` 页面视觉和功能不变 |
| C3 | `/app` 主工作台不受影响 | 所有功能正常 |
| C4 | 无 AI 辅助执行 UI 混入 | 登录页无 AI 相关按钮或入口 |

### 10.4 门禁验收

Codex 完成实现后必须运行：

```bash
npm run lint      # 必须零 error
npm run build     # 必须成功
git status --short # 仅显示 2 个允许文件
git diff --stat    # 确认改动量在预期范围内
```

| # | 验收项 | 命令/预期 |
|---|--------|---------|
| G1 | lint 通过 | `npm run lint` 零 error |
| G2 | build 通过 | `npm run build` 成功 |
| G3 | git status 只出现允许文件 | 仅显示 `src/app/login/page.tsx` + `src/components/LoginPageContent.tsx` |
| G4 | git diff 确认为 className 改动 | `git diff` 中无 onClick/onChange/useEffect/useState 变更 |

---

## 十一、给 Codex 的实现指令汇总

### ✅ 可以做

1. **修改 `src/app/login/page.tsx`**（§七）
   - 改 `<main>` className：背景渐变、`min-h-[100dvh]`
   - 改 `<div>` className：`max-w-[420px]` → `max-w-sm`
   
2. **修改 `src/components/LoginPageContent.tsx`**（§八）
   - 8A：卡片 border + shadow
   - 8C：Tab min-h + active + disabled + mb
   - 8D/8E/8F：所有输入框 min-h + focus:ring
   - 8G：密码输入框容器 + input + 按钮 min-h + focus:ring
   - 8H：成功提示 amber → emerald
   - 8I：错误提示 amber → red（**两处都要改**）
   - 8J：主按钮 min-h + shadow + disabled + active（**两处都要改**）
   - 8K：重新发送按钮 min-h
   - 8M：新增底部辅助文案 `<p>`

### ❌ 不要做

1. **不要改任何 JS 逻辑**（§五完整清单）
2. **不要改 Header.tsx**
3. **不要改 SetPasswordPrompt.tsx**
4. **不要改 AUTH_TEXT / ERROR_MESSAGES 常量**
5. **不要新增文件**
6. **不要改任何 import 语句**
7. **不要改 onClick / onChange / onSubmit / useEffect / useState**
8. **不要改 disabled / type / value / placeholder / inputMode / maxLength / minLength / autoComplete 属性**
9. **不要重构组件结构**
10. **不要改 `/app` 或 Landing Page**
11. **不要引入新 npm 依赖**
12. **不要提交 commit**

### ⚠️ 特别注意

1. **错误提示有两处**（OTP 模式 + 密码模式），两处的 className 字符串完全相同，需要**两处都改**
2. **主按钮有两处**（OTP 模式 + 密码模式），两处的 className 字符串完全相同，需要**两处都改**
3. **邮箱输入框有两处**（OTP 模式 + 密码模式），两处需要同步修改
4. **不改 8B 标题区**和**8L 切换提示按钮**——它们的当前样式已满足设计规格
5. **底部辅助文案是硬编码中文**，不使用 `AUTH_TEXT` 常量，不包裹 `<Link>`

### ⚠️ 如果发现需要改禁止清单中的内容

**停下来，汇报。** 说明哪个位置、为什么需要改、当前执行方案哪里遗漏了。不要自行扩大修改范围。

---

> **文档结束**
>
> **下一阶段**：本文档经 ChatGPT 审查通过后，Codex 按本文档实现代码。实现完成后 Claude Code 做 Code Review。
>
> **关联文档**：
> - [Architecture-V2.2B-Login.md](Architecture-V2.2B-Login.md) — V2.2B 架构方案（✅ 已通过审查）
> - [Roadmap-V2.2-UI-Upgrade.md](Roadmap-V2.2-UI-Upgrade.md) — V2.2 UI 升级总规划
> - [Architecture-V2.2A-Routing.md](Architecture-V2.2A-Routing.md) — V2.2A 架构方案（✅ 已完成）
> - [Execution-Plan-V2.2A-Routing.md](Execution-Plan-V2.2A-Routing.md) — V2.2A 执行方案（✅ 已完成）
> - [Roadmap-AI-Assisted-Execution.md](Roadmap-AI-Assisted-Execution.md) — AI 辅助执行路线总稿（V2.4+）
> - [PROJECT-CONTEXT.md](PROJECT-CONTEXT.md) — 项目长期上下文
> - [PROJECT-INDEX.md](PROJECT-INDEX.md) — 项目文件索引
