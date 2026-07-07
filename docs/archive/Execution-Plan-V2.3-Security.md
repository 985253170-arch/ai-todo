# V2.3：安全增强 执行方案

> **状态**：执行方案阶段，**不写代码，待 ChatGPT 审查通过后交给 Codex 实现**
> **依赖**：[Architecture-V2.3-Security.md](Architecture-V2.3-Security.md) ✅ 已通过 ChatGPT 审查
> **设计日期**：2026-07-05

---

## 目录

- [〇、总表：允许修改与禁止修改](#总表允许修改与禁止修改)
- [一、V2.3A：忘记密码 + 重置密码核心闭环](#一v23a忘记密码--重置密码核心闭环)
- [二、V2.3B：Cloudflare Turnstile 防机器人](#二v23bcloudflare-turnstile-防机器人)
- [三、V2.3C：错误提示脱敏 + Supabase Auth 配置复查](#三v23c错误提示脱敏--supabase-auth-配置复查)
- [四、V2.3-Review：安全回归验收](#四v23-review安全回归验收)
- [五、人工配置步骤汇总](#五人工配置步骤汇总)
- [六、环境变量安全说明](#六环境变量安全说明)
- [七、回滚方案](#七回滚方案)
- [八、红线重申](#八红线重申)
- [九、Codex 执行边界](#九codex-执行边界)

---

## 〇、总表：允许修改与禁止修改

### 允许修改 / 新增文件总表

| 文件 | 操作 | 所属子阶段 | 改动量 |
|------|:--:|:---:|:---:|
| `src/hooks/useAuth.ts` | 修改 | V2.3A, V2.3B | 新增 2 个方法 + 3 个方法签名微调 |
| `src/lib/constants.ts` | 修改 | V2.3A, V2.3C | 新增 ~20 行文案；新增 ~40 行错误脱敏逻辑（或独立文件） |
| `src/components/LoginPageContent.tsx` | 修改 | V2.3A, V2.3B | 新增 1 个链接 + Turnstile widget 集成 |
| `src/app/login/page.tsx` | 修改 | V2.3B | 可能加载 Turnstile script |
| `src/app/forgot-password/page.tsx` | **新增** + 修改 | V2.3A, V2.3B | ~120 行，新页面；V2.3B 集成 Turnstile |
| `src/app/reset-password/page.tsx` | **新增** | V2.3A | ~150 行，新页面 |
| `src/lib/auth-errors.ts` | **新增**（可选） | V2.3C | ~60 行，或合入 constants.ts |
| `src/components/TurnstileWidget.tsx` | **新增**（可选） | V2.3B | ~80 行，Turnstile 封装组件 |

### 禁止修改文件总表

| 文件 | 原因 |
|------|------|
| `src/lib/supabase-client.ts` | 不变 |
| `src/lib/supabase-server.ts` | 不变 |
| `src/lib/types.ts` | 不变（AuthUser 结构不变） |
| `src/app/auth/callback/route.ts` | 不变（重置密码不走 callback） |
| `src/app/api/auth/me/route.ts` | 不变 |
| `src/app/api/generate-tasks/route.ts` | 不变 |
| `src/app/api/task-group/save/route.ts` | 不变 |
| `src/app/api/task-group/load/route.ts` | 不变 |
| `src/app/api/task-group/delete/route.ts` | 不变 |
| `src/app/api/task-group/migrate/route.ts` | 不变 |
| `src/app/api/task-groups/history/route.ts` | 不变 |
| `src/app/api/task-groups/stats/route.ts` | 不变 |
| `src/app/api/task-groups/review/route.ts` | 不变 |
| `src/app/app/page.tsx` | 不变（/app 页面不受影响） |
| `src/components/Header.tsx` | 不变 |
| `src/components/AuthModal.tsx` | 不变 |
| `src/components/SetPasswordPrompt.tsx` | 不变 |
| `src/components/TaskList.tsx` | 不变 |
| `src/components/GoalInput.tsx` | 不变 |
| `src/components/StatsBar.tsx` | 不变 |
| `src/components/HistoryPanel.tsx` | 不变 |
| `src/components/TaskReviewPanel.tsx` | 不变 |
| `src/hooks/useTaskGroup.ts` | 不变 |
| `src/hooks/useTaskStats.ts` | 不变 |
| `src/hooks/useTaskHistory.ts` | 不变 |
| `src/hooks/useTaskReview.ts` | 不变 |
| `src/lib/ai-client.ts` | 不变 |
| `src/lib/task-parser.ts` | 不变 |
| `src/lib/review-parser.ts` | 不变 |
| `src/lib/stats-calculator.ts` | 不变 |
| `src/lib/adjust-task-strategy.ts` | 不变 |
| `src/lib/device-id.ts` | 不变 |
| `src/prompts/task-generation.ts` | 不变 |
| `src/prompts/task-review.ts` | 不变 |
| `package.json` | 不变 |
| 数据库 schema | 不变 |
| 所有现有文档 | 不变 |

---

## 一、V2.3A：忘记密码 + 重置密码核心闭环

### 1.1 目标

用户可自助完成：点击"忘记密码？" → 输入邮箱 → 收重置密码邮件 → 设置新密码 → 用新密码登录。

### 1.2 前置人工操作（必须在代码实现前完成）

#### Supabase Dashboard → Email Templates → Reset Password

1. 进入 Supabase Dashboard → Authentication → Email Templates
2. 选择 **Reset Password** 模板
3. 配置如下 HTML：

```html
<!-- Subject -->
重置你的 AI Todo 密码

<!-- Message Body -->
<div style="max-width:480px;margin:0 auto;padding:32px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <h2 style="font-size:20px;color:#1e293b;margin-bottom:16px;">重置你的 AI Todo 密码</h2>
  <p style="font-size:15px;color:#475569;line-height:1.6;margin-bottom:24px;">
    我们收到了你的密码重置请求。点击下方按钮设置一个新密码：
  </p>
  <a href="{{ .RedirectTo }}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#4f46e5,#3b82f6);color:#fff;font-size:15px;font-weight:600;text-decoration:none;border-radius:12px;">
    重置密码
  </a>
  <p style="font-size:13px;color:#94a3b8;margin-top:24px;line-height:1.5;">
    如果你没有请求重置密码，请忽略这封邮件。<br/>
    此链接在 24 小时内有效。
  </p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
  <p style="font-size:12px;color:#cbd5e1;">
    AI Todo · 你的 AI 行动教练<br/>
    <a href="https://aitodoai.cn" style="color:#6366f1;">aitodoai.cn</a>
  </p>
</div>
```

4. **关键检查**：确认模板中使用的是 `{{ .RedirectTo }}`（Supabase 变量），不是硬编码 URL。
5. 保存模板。

### 1.3 步骤 1：修改 `src/lib/constants.ts` — 新增文案

在 `AUTH_TEXT` 对象末尾（第 101 行 `} as const;` 之前）新增以下属性：

```typescript
// 忘记密码
FORGOT_PASSWORD_LINK: "忘记密码？",
FORGOT_PASSWORD_TITLE: "忘记密码",
FORGOT_PASSWORD_DESCRIPTION: "输入你的注册邮箱，我们会发送重置密码邮件。",
FORGOT_PASSWORD_BUTTON: "发送重置密码邮件",
FORGOT_PASSWORD_LOADING: "发送中...",
FORGOT_PASSWORD_SUCCESS: "如果该邮箱已注册，重置密码邮件已发送。请查收邮件并点击重置链接。",
FORGOT_PASSWORD_BACK: "返回登录",

// 重置密码
RESET_PASSWORD_TITLE: "设置新密码",
RESET_PASSWORD_DESCRIPTION: "请输入你的新密码。",
RESET_PASSWORD_NEW_PASSWORD_LABEL: "新密码",
RESET_PASSWORD_CONFIRM_LABEL: "确认密码",
RESET_PASSWORD_BUTTON: "重置密码",
RESET_PASSWORD_LOADING: "重置中...",
RESET_PASSWORD_SUCCESS: "密码已重置，请用新密码登录。",
RESET_PASSWORD_TOKEN_EXPIRED: "重置链接已过期，请重新申请。",
RESET_PASSWORD_TOKEN_INVALID: "重置链接无效，请重新申请。",
RESET_PASSWORD_GO_LOGIN: "返回登录",
RESET_PASSWORD_GO_FORGOT: "重新申请重置密码",
```

**Codex 注意**：
- 所有文案必须是简体中文
- 紧接在现有 `AUTH_TEXT` 最后一个属性之后（`EMAIL_RATE_LIMITED` 之后），保持 `} as const;` 在末尾
- 不要修改任何现有 `AUTH_TEXT` 属性
- 不要修改 `ERROR_MESSAGES`
- 不要修改 `UI_TEXT`
- ⚠️ **`EMAIL_INVALID` 已存在于 `constants.ts` 第 92 行**。Codex 实现前必须确认：如果 `AUTH_TEXT.EMAIL_INVALID` 已有值 `"邮箱格式不正确。"`，则不重复新增；如果缺失，则新增 `EMAIL_INVALID: "邮箱格式不正确。"`。`/forgot-password` 和 `/reset-password` 的示例代码均引用此 key

### 1.4 步骤 2：修改 `src/hooks/useAuth.ts` — 新增 `sendResetPasswordEmail` 方法

#### 2A：新增方法（仅新增，不改现有方法）

在 `useAuth` 函数体内，`signOut` 方法之前或之后，新增以下方法：

```typescript
async function sendResetPasswordEmail(email: string) {
  if (!supabase) {
    throw new Error("AUTH_NOT_CONFIGURED");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    logSafeAuthError(error);
    // 不向上抛出"用户不存在"类错误，统一静默处理
    // 重要：resetPasswordForEmail 在 Supabase 配置正确时总是返回 success
    // 但在某些边缘情况下可能返回错误
    // 仅 rate limit 错误告知用户，其余静默处理（防止泄露用户存在性）
    if (
      error.message?.toLowerCase().includes("rate limit") ||
      error.message?.toLowerCase().includes("too many requests")
    ) {
      throw error;
    }
    // 其他所有错误（包括 user not found）静默吞掉
    return;
  }
}
```

#### 2B：在 return 对象中导出新方法

在 return 对象中（第 187-196 行），新增 `sendResetPasswordEmail`：

```typescript
return {
  user,
  isLoading,
  sendOtp,
  verifyOtp,
  signInWithPassword,
  signUp,
  setPassword,
  signOut,
  sendResetPasswordEmail,  // ← 新增这一行
};
```

**Codex 注意**：
- **禁止修改** `sendOtp` / `verifyOtp` / `signInWithPassword` / `signUp` / `setPassword` / `signOut` 的任何现有代码
- **禁止修改** 现有方法签名（参数列表不变）
- **禁止修改** `toAuthUser` / `logSafeAuthError` 函数
- 仅在 return 对象中新增一个属性，不改变已有属性的顺序
- `redirectTo` 使用 `window.location.origin` 而非硬编码域名（这样在 localhost / Vercel 预览 / aitodoai.cn 都能正确工作）

### 1.5 步骤 3：修改 `src/components/LoginPageContent.tsx` — 新增"忘记密码？"链接

#### 改动位置

在密码登录表单（`else` 分支，`<form className="grid gap-3" onSubmit={handlePasswordSubmit}>` 内部），在错误提示之后、主提交按钮之前（当前第 398-403 行 `{errorMessage ? (...) : null}` 之后，第 404 行 `<button className="min-h-[48px]...` 之前），新增一行：

```tsx
{/* 忘记密码链接 — 仅密码登录 Tab 显示 */}
<a
  className="text-right text-sm text-slate-500 transition hover:text-indigo-700"
  href="/forgot-password"
>
  {AUTH_TEXT.FORGOT_PASSWORD_LINK}
</a>
```

**Codex 注意**：
- 仅新增这 6 行代码
- 使用 `<a href>` 而非 `<Link>`（跳转到独立页面，不需要客户端路由）
- 不要触碰 OTP Tab 的任何代码
- 不要触碰密码 Tab 的其他代码
- 不要修改 `getSafeErrorMessage` 函数位置（V2.3C 才处理）
- 不要修改任何 `onClick` / `onSubmit` / `onChange` 等逻辑

### 1.6 步骤 4：新增 `src/app/forgot-password/page.tsx`

创建新文件，完整代码如下：

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { Header } from "@/components/Header";
import { AUTH_TEXT } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function ForgotPasswordPage() {
  const { sendResetPasswordEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  function validateEmail(trimmedEmail: string) {
    if (!trimmedEmail) {
      return AUTH_TEXT.EMAIL_REQUIRED;
    }
    if (!isValidEmail(trimmedEmail)) {
      return AUTH_TEXT.EMAIL_INVALID;
    }
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim();
    const validationMessage = validateEmail(trimmedEmail);

    if (validationMessage) {
      setMessage(null);
      setErrorMessage(validationMessage);
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      await sendResetPasswordEmail(trimmedEmail);
      // 无论邮箱是否存在，统一显示成功
      setIsSuccess(true);
      setMessage(AUTH_TEXT.FORGOT_PASSWORD_SUCCESS);
    } catch (error) {
      // 仅 rate limit 错误会抛出，其余已在 useAuth 中静默处理
      if (error instanceof Error && error.message?.toLowerCase().includes("rate limit")) {
        setErrorMessage(AUTH_TEXT.EMAIL_RATE_LIMITED);
      } else {
        // 兜底：仍显示成功，不泄露用户存在性
        setIsSuccess(true);
        setMessage(AUTH_TEXT.FORGOT_PASSWORD_SUCCESS);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-gradient-to-b from-indigo-50/60 via-white to-sky-50/40 px-4 py-6 pb-[env(safe-area-inset-bottom,1rem)] text-slate-950 sm:px-6 sm:py-10">
      <div className="mx-auto flex max-w-sm flex-col gap-6 sm:gap-7">
        <Header variant="login" />

        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xl shadow-indigo-500/5 sm:p-6">
          <div className="mb-5">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              {AUTH_TEXT.FORGOT_PASSWORD_TITLE}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {AUTH_TEXT.FORGOT_PASSWORD_DESCRIPTION}
            </p>
          </div>

          {isSuccess ? (
            <div className="grid gap-4">
              <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {message}
              </p>
              <a
                className="min-h-[48px] rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 px-5 text-center text-base font-semibold text-white shadow-md shadow-indigo-500/20 transition duration-150 hover:-translate-y-px inline-flex items-center justify-center"
                href="/login"
              >
                {AUTH_TEXT.FORGOT_PASSWORD_BACK}
              </a>
            </div>
          ) : (
            <form className="grid gap-3" onSubmit={handleSubmit}>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">
                  {AUTH_TEXT.EMAIL_LABEL}
                </span>
                <input
                  className="min-h-[48px] rounded-xl border border-slate-200 px-4 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setMessage(null);
                    setErrorMessage(null);
                  }}
                  placeholder={AUTH_TEXT.EMAIL_PLACEHOLDER}
                  type="email"
                  value={email}
                />
              </label>

              {errorMessage ? (
                <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {errorMessage}
                </p>
              ) : null}

              <button
                className="min-h-[48px] rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 px-5 text-base font-semibold text-white shadow-md shadow-indigo-500/20 transition duration-150 hover:-translate-y-px hover:shadow-lg hover:shadow-indigo-500/25 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting
                  ? AUTH_TEXT.FORGOT_PASSWORD_LOADING
                  : AUTH_TEXT.FORGOT_PASSWORD_BUTTON}
              </button>

              <a
                className="text-center text-sm leading-6 text-slate-500 transition hover:text-indigo-700"
                href="/login"
              >
                {AUTH_TEXT.FORGOT_PASSWORD_BACK}
              </a>
            </form>
          )}
        </section>

        <p className="mt-6 text-center text-xs text-slate-400">
          登录后即可同步你的任务记录与行动数据
        </p>
      </div>
    </main>
  );
}
```

**Codex 注意**：
- 复用 `/login` 相同的布局结构（`main` + `div.max-w-sm` + `Header variant="login"` + 卡片 + 底部文案）
- 复用相同的视觉样式（渐变背景、卡片圆角、阴影、输入框样式、按钮样式）
- 不依赖 `useRouter`（使用 `<a href>` 跳转）
- 不引入 Turnstile（留给 V2.3B）
- 关键安全逻辑：**catch 块中除 rate limit 外所有错误仍设置为成功状态**（`setIsSuccess(true)`），确保不泄露用户存在性

### 1.7 步骤 5：新增 `src/app/reset-password/page.tsx`

创建新文件。这是最复杂的新页面，需要正确处理 Supabase recovery token。

```tsx
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import { AUTH_TEXT } from "@/lib/constants";

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isTokenReady, setIsTokenReady] = useState(false);
  const [isTokenInvalid, setIsTokenInvalid] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // 解析 URL hash 中的 access_token 和 refresh_token
  useEffect(() => {
    const hash = window.location.hash;

    if (!hash || hash.length < 10) {
      setIsTokenInvalid(true);
      return;
    }

    // hash 格式: #access_token=xxx&refresh_token=yyy&expires_in=zzz&token_type=bearer&type=recovery
    const params = new URLSearchParams(hash.slice(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const type = params.get("type");

    if (!accessToken || !refreshToken || type !== "recovery") {
      setIsTokenInvalid(true);
      return;
    }

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      setIsTokenInvalid(true);
      return;
    }

    // 用 recovery token 建立临时 session
    void supabase.auth
      .setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      .then(({ error }) => {
        if (error) {
          setIsTokenInvalid(true);
          return;
        }
        setIsTokenReady(true);
      });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!newPassword) {
      setMessage(null);
      setErrorMessage(AUTH_TEXT.PASSWORD_REQUIRED);
      return;
    }

    if (newPassword.length < 6) {
      setMessage(null);
      setErrorMessage(AUTH_TEXT.PASSWORD_TOO_SHORT);
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage(null);
      setErrorMessage(AUTH_TEXT.PASSWORD_MISMATCH);
      return;
    }

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      setErrorMessage("服务暂未配置，请稍后重试。");
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw error;
      }

      setIsSuccess(true);
      setMessage(AUTH_TEXT.RESET_PASSWORD_SUCCESS);

      // 清除临时 session
      await supabase.auth.signOut();
    } catch (error) {
      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("rate limit") || msg.includes("too many requests")) {
          setErrorMessage(AUTH_TEXT.EMAIL_RATE_LIMITED);
        } else if (msg.includes("token") || msg.includes("expired")) {
          setErrorMessage(AUTH_TEXT.RESET_PASSWORD_TOKEN_EXPIRED);
        } else {
          setErrorMessage(AUTH_TEXT.RESET_PASSWORD_TOKEN_INVALID);
        }
      } else {
        setErrorMessage(AUTH_TEXT.RESET_PASSWORD_TOKEN_INVALID);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  // token 无效或过期 — 显示错误 + 返回 /forgot-password
  if (isTokenInvalid) {
    return (
      <main className="min-h-[100dvh] overflow-x-hidden bg-gradient-to-b from-indigo-50/60 via-white to-sky-50/40 px-4 py-6 pb-[env(safe-area-inset-bottom,1rem)] text-slate-950 sm:px-6 sm:py-10">
        <div className="mx-auto flex max-w-sm flex-col gap-6 sm:gap-7">
          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xl shadow-indigo-500/5 sm:p-6">
            <div className="mb-5">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                {AUTH_TEXT.RESET_PASSWORD_TITLE}
              </h1>
            </div>
            <div className="grid gap-4">
              <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                {AUTH_TEXT.RESET_PASSWORD_TOKEN_EXPIRED}
              </p>
              <a
                className="min-h-[48px] rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 px-5 text-center text-base font-semibold text-white shadow-md shadow-indigo-500/20 inline-flex items-center justify-center"
                href="/forgot-password"
              >
                {AUTH_TEXT.RESET_PASSWORD_GO_FORGOT}
              </a>
            </div>
          </section>
        </div>
      </main>
    );
  }

  // token 验证中 — 显示加载状态（极简，不闪屏）
  if (!isTokenReady) {
    return null;
  }

  // 成功 — 显示成功 + 返回 /login
  if (isSuccess) {
    return (
      <main className="min-h-[100dvh] overflow-x-hidden bg-gradient-to-b from-indigo-50/60 via-white to-sky-50/40 px-4 py-6 pb-[env(safe-area-inset-bottom,1rem)] text-slate-950 sm:px-6 sm:py-10">
        <div className="mx-auto flex max-w-sm flex-col gap-6 sm:gap-7">
          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xl shadow-indigo-500/5 sm:p-6">
            <div className="mb-5">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                {AUTH_TEXT.RESET_PASSWORD_TITLE}
              </h1>
            </div>
            <div className="grid gap-4">
              <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {message}
              </p>
              <a
                className="min-h-[48px] rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 px-5 text-center text-base font-semibold text-white shadow-md shadow-indigo-500/20 inline-flex items-center justify-center"
                href="/login"
              >
                {AUTH_TEXT.RESET_PASSWORD_GO_LOGIN}
              </a>
            </div>
          </section>
        </div>
      </main>
    );
  }

  // 正常表单 — 输入新密码
  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-gradient-to-b from-indigo-50/60 via-white to-sky-50/40 px-4 py-6 pb-[env(safe-area-inset-bottom,1rem)] text-slate-950 sm:px-6 sm:py-10">
      <div className="mx-auto flex max-w-sm flex-col gap-6 sm:gap-7">
        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-xl shadow-indigo-500/5 sm:p-6">
          <div className="mb-5">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              {AUTH_TEXT.RESET_PASSWORD_TITLE}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {AUTH_TEXT.RESET_PASSWORD_DESCRIPTION}
            </p>
          </div>

          <form className="grid gap-3" onSubmit={handleSubmit}>
            {/* 新密码 */}
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">
                {AUTH_TEXT.RESET_PASSWORD_NEW_PASSWORD_LABEL}
              </span>
              <div className="flex min-h-[48px] items-center rounded-xl border border-slate-200 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10">
                <input
                  className="min-h-[48px] min-w-0 flex-1 rounded-xl px-4 text-base text-slate-950 outline-none placeholder:text-slate-400"
                  minLength={6}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder={AUTH_TEXT.PASSWORD_PLACEHOLDER}
                  type={isPasswordVisible ? "text" : "password"}
                  value={newPassword}
                />
                <button
                  className="min-h-[48px] px-4 text-sm font-semibold text-slate-500 transition hover:text-indigo-700"
                  onClick={() =>
                    setIsPasswordVisible((v) => !v)
                  }
                  type="button"
                >
                  {isPasswordVisible ? "隐藏" : "显示"}
                </button>
              </div>
            </label>

            {/* 确认密码 */}
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">
                {AUTH_TEXT.RESET_PASSWORD_CONFIRM_LABEL}
              </span>
              <input
                className="min-h-[48px] rounded-xl border border-slate-200 px-4 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                minLength={6}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder={AUTH_TEXT.CONFIRM_PASSWORD_PLACEHOLDER}
                type="password"
                value={confirmPassword}
              />
            </label>

            {errorMessage ? (
              <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMessage}
              </p>
            ) : null}

            <button
              className="min-h-[48px] rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 px-5 text-base font-semibold text-white shadow-md shadow-indigo-500/20 transition duration-150 hover:-translate-y-px hover:shadow-lg hover:shadow-indigo-500/25 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting
                ? AUTH_TEXT.RESET_PASSWORD_LOADING
                : AUTH_TEXT.RESET_PASSWORD_BUTTON}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
```

**Codex 注意**：
- **直接使用 `createSupabaseBrowserClient()`** 获取 supabase 实例（不依赖 `useAuth` hook，因为重置密码流程需要独立的 client 来调用 `setSession`）
- **URL hash 解析**：使用 `new URLSearchParams(hash.slice(1))` 解析 `#access_token=...&refresh_token=...&type=recovery`
- **三种状态**：
  1. `isTokenInvalid` → 显示"链接已过期" + 返回 `/forgot-password`
  2. `!isTokenReady` → `return null`（静默加载 `setSession`，不闪屏）
  3. `isSuccess` → 显示"密码已重置" + 返回 `/login`
  4. 默认 → 显示新密码 + 确认密码表单
- **密码可见性切换**：复用 LoginPageContent 的"显示/隐藏"模式
- **成功后 signOut**：重置成功后调用 `supabase.auth.signOut()` 清除临时 recovery session
- **无需 Header 组件**：重置密码页面不显示 Header（极简设计）
- **不使用 `useRouter` 做 SPA 跳转**：使用 `<a href>` 做完整页面导航

### 1.8 V2.3A 完成后验证步骤

Codex 完成代码后，本地运行以下验证：

```bash
# 1. 门禁
npm run lint
npm run build

# 2. 页面可访问性
# - 打开 http://localhost:3000/login → 密码 Tab 中看到"忘记密码？"链接
# - 点击"忘记密码？"→ 跳转到 /forgot-password

# 3. 忘记密码流程
# - 输入已注册邮箱 → 提交 → 显示"如果该邮箱已注册，重置密码邮件已发送"
# - 输入未注册邮箱 → 提交 → 同样显示上述提示（不泄露用户存在性）
# - 输入空邮箱 → 显示"请输入邮箱。"
# - 输入无效邮箱 → 显示"邮箱格式不正确。"

# 4. 重置密码流程（需要收到邮件后才能完成）
# - 从邮箱点击重置链接 → 跳转 /reset-password
# - 显示新密码 + 确认密码表单
# - 输入不一致的密码 → 显示"两次输入的密码不一致。"
# - 输入少于 6 位密码 → 显示"密码至少需要 6 位。"
# - 输入匹配的新密码 → 提交 → 显示"密码已重置"
# - 点击"返回登录"→ 跳转 /login
# - 用新密码登录 → 成功进入 /app
# - 旧密码登录 → 失败

# 5. 回归
# - OTP 登录仍然正常
# - 密码登录仍然正常（新密码）
# - SetPasswordPrompt 正常弹出（OTP 登录后）
# - /app 正常
# - 登出正常
# - 任务生成 / 保存 / 历史 / 统计 / AI 复盘正常

# 6. 文件清单
git status --short
# 预期仅出现 V2.3A 允许的文件变更
```

### 1.9 V2.3A Codex 执行边界

| 能做 | 不能做 |
|------|--------|
| 新增 `sendResetPasswordEmail` 方法 | 不修改现有 7 个方法签名 |
| 新增 `AUTH_TEXT` 文案 | 不修改现有 `AUTH_TEXT` / `ERROR_MESSAGES` / `UI_TEXT` |
| 新增 `/forgot-password/page.tsx` | 不修改 `/login/page.tsx` 结构 |
| 新增 `/reset-password/page.tsx` | 不修改 `/app` 任何组件 |
| 在 LoginPageContent 密码 Tab 新增 1 个链接 | 不修改 OTP Tab 任何代码 |
| — | 不修改任何现有文件除上述 3 个 |

### 1.10 V2.3A Claude Code Review 要点

1. `sendResetPasswordEmail` 是否真的只新增不改现有方法
2. `redirectTo` 是否使用 `window.location.origin` 而非硬编码
3. `/forgot-password` 的 catch 是否所有错误（除 rate limit）都静默处理
4. `/reset-password` 的 hash 解析是否正确
5. `/reset-password` token 过期后是否正确重定向
6. 所有新页面的 className 是否与 `/login` 保持视觉一致
7. lint + build 是否通过

---

## 二、V2.3B：Cloudflare Turnstile 防机器人

### 保护范围

V2.3B 必须保护以下三个关键操作（与架构目标一致）：

| 操作 | 所在页面/组件 | Supabase Auth 方法 |
|------|------|------|
| 发送 OTP 验证码 | `LoginPageContent` | `signInWithOtp` |
| 密码登录 | `LoginPageContent` | `signInWithPassword` |
| 发送重置密码邮件 | `forgot-password/page.tsx` | `resetPasswordForEmail` |

为降低 Codex 实现复杂度，可拆分为两个小步：

- **V2.3B-1**：`/login` 接入 Turnstile（LoginPageContent 的 sendOtp + signInWithPassword）
- **V2.3B-2**：`/forgot-password` 接入 Turnstile（forgot-password 的 sendResetPasswordEmail）

但 **V2.3B 完成标准必须包含 `/forgot-password`**。如果只完成了 `/login` 保护，V2.3B 不算完成。

### 2.0 架构重确认：为什么不用独立的 `/api/auth/verify-turnstile`

Architecture 文档中提出了新增 `/api/auth/verify-turnstile` 的方案。经代码分析确认，该方案存在根本性的安全问题：

**问题**：当前 Supabase Auth 调用（`signInWithOtp` / `signInWithPassword` / `resetPasswordForEmail`）全部在浏览器端直接调用 Supabase API。如果新增 `/api/auth/verify-turnstile` 仅在前端"调 Turnstile → 调 verify-turnstile API → 调 Supabase Auth"，攻击者可以绕过前端校验直接调用 Supabase Auth API，前端 Turnstile 形同虚设。

**正确方案**：使用 Supabase Auth 原生的 CAPTCHA 集成。当 Supabase Dashboard 启用 CAPTCHA 后，Supabase Auth 服务器会拒绝没有有效 `captchaToken` 的请求。验证发生在 Supabase 服务端，无法被前端绕过。

**经代码确认**：项目使用的 `@supabase/supabase-js` v2.108.2 + `@supabase/auth-js` 类型定义中，以下方法的 options 均原生支持 `captchaToken` 参数：

| Supabase Auth 方法 | captchaToken 支持 | 类型定义位置 |
|------|:--:|------|
| `signInWithOtp` | ✅ 完全支持 | `auth-js/dist/main/lib/types.d.ts` L504, L511, L541, L556, L700 |
| `signInWithPassword` | ✅ 完全支持 | 同上 L524 |
| `signUp` | ✅ 完全支持 | 同上 L589 |
| `resetPasswordForEmail` | ✅ 支持（标记为 deprecated 但可用） | 同上 L666, L683 |

**结论**：**不新增 `/api/auth/verify-turnstile`。** Turnstile token 直接通过 Supabase SDK 的 `captchaToken` 参数传入 Supabase Auth 方法，由 Supabase Auth 服务端验证。

### 2.1 前置人工操作（必须在代码实现前完成）

#### Supabase Dashboard → Authentication → Bot and Abuse Protection

1. 进入 Supabase Dashboard → Authentication → **Bot and Abuse Protection**（或 "CAPTCHA" 设置页）
2. 找到 "Enable CAPTCHA protection" 开关 → **开启**
3. 选择 CAPTCHA 提供商：**Cloudflare Turnstile**
4. 输入你的 **Turnstile Secret Key**（从 Cloudflare Dashboard → Turnstile 获取）
5. 选择保护模式：
   - 如果 Supabase Dashboard 支持 **Required** 模式：V2.3 阶段先选 Required。**Required 模式下，不带有效 captchaToken 的 Auth 请求会被 Supabase 服务端拒绝，这是安全预期，不是 bug。**
   - 如果 Dashboard 只有简单的二元开关（开/关）：开启即默认要求 captchaToken
6. 保存配置

> **重要说明 — Required CAPTCHA 与前端 fail-open 的关系**：
>
> 前端 TurnstileWidget 的 fail-open 机制（script 加载失败时 `onTokenChange(null)`）**只能保证 UI 不崩溃**，不能让登录绕过 Supabase 服务端 CAPTCHA 验证。
>
> - 如果 Supabase CAPTCHA = **Required**：Turnstile widget 加载失败 → 前端不阻塞 → 用户仍可点击提交 → Supabase 服务端拒绝（因为没有有效 captchaToken）→ **这是安全预期，不是 bug**
> - 如果 Supabase CAPTCHA = **Optional**：Turnstile widget 加载失败 → 前端不阻塞 → 用户可提交 → Supabase 服务端放行（可选模式下不强制）
> - 如果中国网络导致 Turnstile CDN 大面积加载失败：**回滚方式是人工在 Supabase Dashboard 临时关闭 CAPTCHA**（或改成 Optional），不是让前端绕过 Supabase 的 Required CAPTCHA
>
> **执行方案中所有 "fail-open" 的含义**：fail-open 保证前端不崩溃、不白屏、不阻塞用户操作。但在 Required CAPTCHA 下，Supabase 仍可能拒绝请求。必要时人工关闭 Dashboard CAPTCHA 回滚。

#### Cloudflare Dashboard → Turnstile

1. 进入 [Cloudflare Dashboard](https://dash.cloudflare.com/) → Turnstile
2. 创建新的 Turnstile 站点（如果还没有）
3. 添加域名：
   - `aitodoai.cn`
   - `www.aitodoai.cn`
   - `ai-todo-kappa-drab.vercel.app`
   - `localhost`（本地开发）
4. 获取两个 key：
   - **Site Key**（公开）→ 用于前端 widget
   - **Secret Key**（私密）→ 填入 Supabase Dashboard 上一步
5. 记录 Site Key 备用

### 2.2 步骤 1：用户手动配置 `.env.local`（Codex 不操作此文件）

**Codex 严禁修改 `.env.local`。** 此步骤仅作为文档说明，由用户手动完成。

用户需要在 `.env.local` 中新增以下 1 行（**仅本地测试 key，不写真实 production key**）：

```
# Cloudflare Turnstile（防机器人验证）
# Site Key 从 Cloudflare Dashboard → Turnstile → 你的站点 获取
# 本地测试用 Cloudflare 官方测试 key，widget 始终通过
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
```

**说明**：
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` 是前端公开 key，可安全写入 `.env.local` 和 Vercel 环境变量
- `TURNSTILE_SECRET_KEY` **只填入 Supabase Dashboard**（Authentication → Bot and Abuse Protection），不写入 `.env.local`、不写入前端代码、不写入 Git、不写入聊天
- 生产环境的真实 `NEXT_PUBLIC_TURNSTILE_SITE_KEY` 由用户在 Vercel Dashboard 手动配置
- 确认 `.env.local` 已在 `.gitignore` 中

### 2.3 步骤 2：修改 `src/hooks/useAuth.ts` — 方法签名微调

在 `sendOtp` 和 `signInWithPassword` 中新增可选 `captchaToken` 参数。**不改变现有调用行为**（`captchaToken` 为 `undefined` 时 Supabase 仍正常处理）。

#### 修改 `sendOtp` 方法签名（第 65-78 行）

```typescript
// 修改前：
async function sendOtp(email: string) {

// 修改后：
async function sendOtp(email: string, captchaToken?: string) {
```

在 `options` 中新增 `captchaToken`：

```typescript
// 修改前：
const { error } = await supabase.auth.signInWithOtp({
  email,
  options: { shouldCreateUser: true },
});

// 修改后：
const { error } = await supabase.auth.signInWithOtp({
  email,
  options: { shouldCreateUser: true, captchaToken },
});
```

#### 修改 `signInWithPassword` 方法签名（第 116-153 行）

```typescript
// 修改前：
async function signInWithPassword(email: string, password: string) {

// 修改后：
async function signInWithPassword(email: string, password: string, captchaToken?: string) {
```

在调用中新增 `captchaToken`：

```typescript
// 修改前：
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});

// 修改后：
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
  options: { captchaToken },
});
```

⚠️ **注意**：`signInWithPassword` 的 `options` 参数是作为第三个参数传入还是作为 credentials 对象的嵌套属性。请查看项目的 `@supabase/supabase-js` 类型定义确认。如果当前 SDK 版本的 `signInWithPassword` 是 `(credentials: { email, password }, options?: { captchaToken? })` 则使用上述写法。如果是 `(credentials: { email, password, options?: { captchaToken? } })` 则调整。

#### 也可以修改 `sendResetPasswordEmail` 方法签名（V2.3A 新增的方法）

```typescript
// V2.3A 写法：
async function sendResetPasswordEmail(email: string) {

// V2.3B 修改为：
async function sendResetPasswordEmail(email: string, captchaToken?: string) {
```

在调用中新增 `captchaToken`：

```typescript
const { error } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/reset-password`,
  captchaToken,
});
```

**Codex 注意**：
- ⚠️ **关键**：`resetPasswordForEmail` 的 `captchaToken` 参数在类型定义中标记为 `@deprecated`（L666, L683）。这意味着 Supabase 可能在未来版本移除它。但当前 v2.108.2 仍然可用。如果 `npm run build` 报了 deprecation warning 且被当作 error，则将 `captchaToken` 从 `sendResetPasswordEmail` 中移除，改为在 V2.3C 阶段通过 Supabase Dashboard 配置确认是否支持。
- **不要修改** `sendOtp` / `signInWithPassword` / `sendResetPasswordEmail` 的现有逻辑（仅新增可选参数）
- 不要修改 `verifyOtp` / `signUp` / `setPassword` / `signOut`（不需要 Turnstile）
- `captchaToken` 必须是可选参数（`?: string`），确保不传时向后兼容

### 2.4 步骤 3：新增 `src/components/TurnstileWidget.tsx`（推荐封装）

如果 Turnstile 逻辑较简单，也可以直接在 LoginPageContent 中内联。推荐封装为独立组件以便在 `/login` 和 `/forgot-password` 中复用。

```tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface TurnstileWidgetProps {
  onTokenChange: (token: string | null) => void;
  onLoadError?: () => void;
}

// Cloudflare Turnstile 测试 site key（本地开发和未配置时使用）
const TEST_SITE_KEY = "1x00000000000000000000AA";

export function TurnstileWidget({ onTokenChange, onLoadError }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || TEST_SITE_KEY;

  const handleLoadError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
    // Fail-open: widget 加载失败时不阻塞页面，不白屏
    // 注意：在 Supabase CAPTCHA Required 模式下，没有有效 token 的请求会被 Supabase 服务端拒绝
    onTokenChange(null);
    onLoadError?.();
  }, [onTokenChange, onLoadError]);

  useEffect(() => {
    // 避免重复加载 script
    if (document.querySelector('script[src="https://challenges.cloudflare.com/turnstile/v0/api.js"]')) {
      renderWidget();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    script.onload = () => renderWidget();
    script.onerror = () => handleLoadError();

    // 5 秒超时 → fail-open
    const timeout = setTimeout(() => {
      if (widgetIdRef.current === null) {
        handleLoadError();
      }
    }, 5000);

    document.head.appendChild(script);

    return () => {
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function renderWidget() {
    if (!containerRef.current || !window.turnstile) {
      handleLoadError();
      return;
    }

    try {
      const widgetId = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: "light",
        size: "normal",
        callback: (token: string) => {
          onTokenChange(token);
        },
        "expired-callback": () => {
          onTokenChange(null);
          // 自动重置 widget 获取新 token
          if (widgetIdRef.current) {
            window.turnstile?.reset(widgetIdRef.current);
          }
        },
        "error-callback": () => {
          handleLoadError();
        },
      });

      widgetIdRef.current = widgetId;
      setIsLoading(false);
    } catch {
      handleLoadError();
    }
  }

  if (hasError) {
    // Fail-open: 不渲染任何内容，不阻塞页面
    // 注意：在 Supabase Required CAPTCHA 下，没有 token 的请求会被 Supabase 拒绝
    return null;
  }

  return (
    <div className="flex justify-center">
      {isLoading ? (
        <div className="h-[65px] w-[300px] animate-pulse rounded-lg bg-slate-100" />
      ) : null}
      <div ref={containerRef} className={isLoading ? "hidden" : ""} />
    </div>
  );
}

// TypeScript 类型声明（Turnstile 由外部 script 注入，npm 不安装类型包）
declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: "light" | "dark";
          size?: "normal" | "compact";
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        }
      ) => string;
      reset: (widgetId: string) => void;
    };
  }
}
```

**Codex 注意**：
- **不要再安装 npm 包**（如 `react-turnstile`、`@cloudflare/turnstile`）。使用原生 `<script>` 标签加载 `https://challenges.cloudflare.com/turnstile/v0/api.js`，零依赖
- **Fail-open 含义**：script 加载 5 秒超时、渲染失败、API 不可达 → 不阻塞页面、不白屏、不显示错误 → `onTokenChange(null)`。**但在 Supabase Required CAPTCHA 下，没有有效 token 的 Auth 请求会被 Supabase 服务端拒绝，用户将无法登录。必要时人工关闭 Dashboard CAPTCHA 回滚。**
- **Token 过期自动刷新**：`expired-callback` 触发时调用 `window.turnstile.reset()` 获取新 token
- **TypeScript**：`window.turnstile` 通过 `declare global` 声明类型

### 2.5 步骤 4：修改 `src/components/LoginPageContent.tsx` — 集成 Turnstile

#### 4A：import TurnstileWidget

在文件顶部 import 区新增：

```tsx
import { TurnstileWidget } from "@/components/TurnstileWidget";
```

#### 4B：新增 state

在现有 state 声明区（第 51-61 行附近）新增：

```tsx
const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
```

#### 4C：在表单中渲染 Turnstile widget

在 OTP 表单中（`{isOtpMode ? (...)` 分支），在提交按钮之前、错误提示之后，新增 Turnstile widget：

```tsx
{/* Turnstile — 防机器人验证 */}
<TurnstileWidget
  onTokenChange={(token) => setTurnstileToken(token)}
  onLoadError={() => {
    // Fail-open: 如果 Turnstile 加载失败，不阻塞页面
    // 注意：Supabase Required CAPTCHA 下，没有 token 的请求会被 Supabase 拒绝
    setTurnstileToken(null);
  }}
/>
```

**放置位置**：在 OTP 表单的 `</form>` 闭合标签之前，提交按钮之后（或紧接在错误提示之后、提交按钮之前）。推荐放在提交按钮之前，让用户先看到 Turnstile 再看到按钮。

#### 4D：修改 `handleSendOtp` — 传递 captchaToken

```typescript
// 修改前：
await sendOtp(trimmedEmail);

// 修改后：
await sendOtp(trimmedEmail, turnstileToken ?? undefined);
```

#### 4E：修改 `handlePasswordSubmit` — 传递 captchaToken

```typescript
// 修改前：
await signInWithPassword(trimmedEmail, password);

// 修改后：
await signInWithPassword(trimmedEmail, password, turnstileToken ?? undefined);
```

#### 4F：（可选）Turnstile token 用后即焚

每次提交后重置 token（Turnstile token 是一次性的）：

在 `handleSendOtp` 和 `handlePasswordSubmit` 的 `finally` 块中新增：

```typescript
// 在 finally 块的 setIsSubmitting(false) 之后
// 重置 Turnstile（token 已使用，需要刷新 widget 获取新 token）
setTurnstileToken(null);
// window.turnstile?.reset(...) 由 TurnstileWidget 的 expired-callback 处理
```

> **简化方案**：如果 Turnstile token 用后即焚逻辑过于复杂，可以在 `finally` 中仅 `setTurnstileToken(null)`。Turnstile widget 会自动在用户下次提交前获取新 token（用户点击按钮时 trigger widget 的验证）。

#### 4G：修改 `src/app/forgot-password/page.tsx` — 集成 Turnstile

与 LoginPageContent 集成方式相同：引入 TurnstileWidget + 新增 state + 传递 captchaToken。

**4G-1：import TurnstileWidget**

```tsx
import { TurnstileWidget } from "@/components/TurnstileWidget";
```

**4G-2：新增 state**

在现有 state 声明区新增：

```tsx
const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
```

**4G-3：在表单中渲染 Turnstile widget**

在 `handleSubmit` 表单的提交按钮之前，新增：

```tsx
{/* Turnstile — 防机器人验证 */}
<TurnstileWidget
  onTokenChange={(token) => setTurnstileToken(token)}
  onLoadError={() => {
    // Fail-open: 如果 Turnstile 加载失败，不阻塞页面
    // 注意：Supabase Required CAPTCHA 下，没有 token 的请求会被 Supabase 拒绝
    setTurnstileToken(null);
  }}
/>
```

**4G-4：修改 `handleSubmit` — 传递 captchaToken**

将 `sendResetPasswordEmail(trimmedEmail)` 改为：

```tsx
await sendResetPasswordEmail(trimmedEmail, turnstileToken ?? undefined);
```

**4G-5：提交后重置 token**

在 `finally` 块的 `setIsSubmitting(false)` 之后新增：

```tsx
setTurnstileToken(null);
```

> ⚠️ **V2.3B 完成标准**：`/login` 和 `/forgot-password` 均须接入 Turnstile 才算 V2.3B 完成。如果实现复杂可分步（先 B-1 `/login`，再 B-2 `/forgot-password`），但两者都必须完成。

### 2.6 V2.3B 一个重要决策：captchaToken 传递方式

有两种方式传递 captchaToken：

**方式 A**（推荐）：直接在 `useAuth` 方法参数中传递
```
LoginPageContent → turnstileToken state → sendOtp(email, token) / signInWithPassword(email, password, token)
```
- 优点：简单、直接、不改变 API Route
- 缺点：`useAuth` 方法签名变化（但只是新增可选参数，向后兼容）

**方式 B**：LoginPageContent 内部持有 turnstileToken，在调用 useAuth 方法前先校验
```
LoginPageContent → 先检查 turnstileToken → 然后调 sendOtp/signInWithPassword
```
- 优点：useAuth 方法签名不变
- 缺点：LoginPageContent 多一层判断；校验逻辑分散

**执行方案采用方式 A**。`captchaToken` 作为可选参数（`?: string`），不传时向后兼容。

### 2.7 V2.3B 完成后验证步骤

```bash
# 1. 门禁
npm run lint
npm run build

# 2. 本地开发测试
# - 本地 .env.local 使用测试 key → Turnstile widget 渲染正常，始终通过
# - OTP 发送正常（captchaToken 通过 options 传给 Supabase）
# - 密码登录正常

# 3. 人工测试（需要生产环境 Supabase Dashboard 已配置 CAPTCHA）
# - 打开 /login → Turnstile widget 应可见
# - 完成 Turnstile 验证 → 发送 OTP → 收到验证码邮件
# - 完成 Turnstile 验证 → 密码登录 → 成功
# - 打开 /forgot-password → Turnstile widget 应可见
# - 完成 Turnstile 验证 → 发送重置密码邮件 → 收到邮件
# - 不完成 Turnstile → 点击发送 → Supabase 服务端拒绝（406 或类似错误）
#   → 前端显示友好错误提示

# 4. Fail-open 测试
# - 修改 site key 为无效值 → Turnstile widget 加载失败
#   → 不应阻塞页面、不白屏、按钮仍可点击
#   → 但 Supabase Required CAPTCHA 下请求会被拒绝（这是安全预期）
#   → 若需恢复登录：人工在 Supabase Dashboard 临时关闭 CAPTCHA

# 5. 回归
# - 所有 V2.3A 功能正常（忘记密码 / 重置密码）
# - OTP 登录仍正常
# - /app 仍正常

# 6. 文件清单
git status --short
```

### 2.8 V2.3B Codex 执行边界

| 能做 | 不能做 |
|------|--------|
| 修改 `useAuth.ts` 方法签名（新增可选参数 `captchaToken?: string`） | 不修改现有方法的核心逻辑 |
| 新增 `TurnstileWidget.tsx` 组件 | 不安装任何 npm 包 |
| 修改 `LoginPageContent.tsx`（新增 TurnstileWidget + 传递 captchaToken） | 不修改 OTP Tab 和密码 Tab 的结构性代码 |
| — | **不新增 `/api/auth/verify-turnstile`**（不需要！） |
| 修改 `/forgot-password/page.tsx`（V2.3B-2：集成 TurnstileWidget + 传递 captchaToken） | 不修改 `/forgot-password` 的核心业务逻辑（静默处理、成功提示等） |

### 2.9 V2.3B Claude Code Review 要点

1. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` 是否正确使用测试 key（本地开发）
2. `TURNSTILE_SECRET_KEY` 是否未出现在任何前端代码中
3. Turnstile script 加载是否纯原生（无额外 npm 依赖）
4. Fail-open 是否生效（script 失败 → 不阻塞页面、不白屏；但 Required CAPTCHA 下 Supabase 会拒绝请求）
5. `captchaToken` 是否作为可选参数传递（不传时向后兼容）
6. 是否没有新增 `/api/auth/verify-turnstile`（确认！）
7. `sendOtp` / `signInWithPassword` / `sendResetPasswordEmail` 是否正确地将 `captchaToken` 传递给 Supabase
8. `/login` 和 `/forgot-password` 两个页面是否都正确集成了 TurnstileWidget
9. TypeScript 类型是否通过（`window.turnstile` 的类型声明）
10. lint + build 是否通过

---

## 三、V2.3C：错误提示脱敏 + Supabase Auth 配置复查

### 3.1 步骤 1：新增 `src/lib/auth-errors.ts`（集中管理 Auth 错误脱敏）

⚠️ **决策点**：是否新增独立文件 `auth-errors.ts`，还是将所有逻辑内联在 `constants.ts` 中？

**执行方案推荐**：新增独立文件 `src/lib/auth-errors.ts`。原因：
1. `constants.ts` 已 102 行，职责是 UI 文案，不适合放逻辑函数
2. `/forgot-password` 和 `/reset-password` 也需要复用错误脱敏逻辑
3. 独立文件便于单元测试和未来扩展

```typescript
// src/lib/auth-errors.ts

import { AUTH_TEXT } from "@/lib/constants";

/**
 * Auth 错误脱敏：将 Supabase 原始错误消息映射为安全的中文提示。
 *
 * 原则：
 * 1. 不暴露用户存在性（登录/忘记密码均统一提示）
 * 2. 不暴露 Supabase 技术信息（不展示 "invalid login credentials" 等原文）
 * 3. rate limit 正常提示（这是可预期行为，不泄露用户存在性）
 * 4. 开发环境下在 console.error 中保留原始错误供排查
 */

export type AuthOperation = "otp" | "password" | "forgot_password" | "reset_password";

/**
 * 模糊匹配表：按 Supabase 错误消息关键词 → 安全中文提示
 * 顺序匹配，命中第一个后返回
 */
const SAFE_ERROR_PATTERNS: Array<{
  patterns: string[];
  messages: Record<AuthOperation, string>;
}> = [
  {
    patterns: ["rate limit", "too many requests"],
    messages: {
      otp: "操作过于频繁，请稍后再试。",
      password: "操作过于频繁，请稍后再试。",
      forgot_password: "操作过于频繁，请稍后再试。",
      reset_password: "操作过于频繁，请稍后再试。",
    },
  },
  {
    patterns: ["invalid login credentials"],
    messages: {
      otp: "邮箱或验证码错误，请重试。",
      password: "邮箱或密码错误，请重试。",
      // 关键：忘记密码不暴露"用户不存在"
      forgot_password: "如果该邮箱已注册，重置密码邮件已发送。",
      reset_password: "重置密码失败，请重新申请重置链接。",
    },
  },
  {
    patterns: ["token", "otp", "expired"],
    messages: {
      otp: "验证码错误或已过期，请重新获取。",
      password: "登录失败，请稍后重试。",
      forgot_password: "如果该邮箱已注册，重置密码邮件已发送。",
      reset_password: "重置链接已过期，请重新申请。",
    },
  },
  {
    patterns: ["unable to validate email address"],
    messages: {
      otp: "邮箱格式不正确。",
      password: "邮箱格式不正确。",
      forgot_password: "邮箱格式不正确。",
      reset_password: "邮箱格式不正确。",
    },
  },
  {
    patterns: ["user not found"],
    messages: {
      otp: "验证码已发送，请查看邮箱。",
      password: "邮箱或密码错误，请重试。",
      forgot_password: "如果该邮箱已注册，重置密码邮件已发送。",
      reset_password: "重置链接已过期，请重新申请。",
    },
  },
  {
    patterns: ["email not confirmed", "email not verified"],
    messages: {
      otp: "请先确认你的邮箱地址。",
      password: "请先确认你的邮箱地址。",
      forgot_password: "如果该邮箱已注册，重置密码邮件已发送。",
      reset_password: "请先确认你的邮箱地址。",
    },
  },
  {
    patterns: ["captcha", "turnstile", "captcha_token", "captcha verification"],
    messages: {
      otp: "安全验证失败，请刷新页面后重试。",
      password: "安全验证失败，请刷新页面后重试。",
      forgot_password: "安全验证失败，请刷新页面后重试。",
      reset_password: "安全验证失败，请刷新页面后重试。",
    },
  },
];

/**
 * 兜底消息：当错误不匹配任何已知模式时使用
 */
const FALLBACK_MESSAGES: Record<AuthOperation, string> = {
  otp: AUTH_TEXT.OTP_INVALID,
  password: "登录失败，请稍后重试。",
  // 关键：忘记密码的兜底也必须静默处理
  forgot_password: "如果该邮箱已注册，重置密码邮件已发送。",
  reset_password: "重置失败，请重新申请重置链接。",
};

/**
 * 将 Supabase Auth 原始错误转换为安全的中文提示
 * @param error - Supabase Auth 抛出的 Error 对象
 * @param operation - 当前操作类型
 * @returns 安全的中文错误提示，可安全地展示给用户
 */
export function getSafeAuthErrorMessage(
  error: unknown,
  operation: AuthOperation
): string {
  if (!(error instanceof Error) || !error.message) {
    return FALLBACK_MESSAGES[operation];
  }

  const message = error.message.toLowerCase();

  for (const entry of SAFE_ERROR_PATTERNS) {
    for (const pattern of entry.patterns) {
      if (message.includes(pattern)) {
        return entry.messages[operation];
      }
    }
  }

  return FALLBACK_MESSAGES[operation];
}

/**
 * 安全地 console.error Supabase Auth 错误（仅在生产环境外打印详细信息）
 */
export function logAuthError(error: unknown, operation: AuthOperation): void {
  const safeMessage = getSafeAuthErrorMessage(error, operation);

  if (error instanceof Error) {
    console.error(`[Auth] ${operation} failed`, {
      safeMessage,
      originalName: error.name,
      originalMessage: error.message,
    });
  } else {
    console.error(`[Auth] ${operation} failed`, { safeMessage, error });
  }
}
```

**Codex 注意**：
- 将现 `LoginPageContent.tsx` 中的 `getSafeErrorMessage` 逻辑替换为调用此模块
- 不要直接删除 `LoginPageContent.tsx` 中的 `getSafeErrorMessage` 函数 → 改为一行调用 `getSafeAuthErrorMessage(error, mode)`
- `/forgot-password/page.tsx` 的 catch 块中也改用 `getSafeAuthErrorMessage`
- `/reset-password/page.tsx` 的 catch 块中也改用 `getSafeAuthErrorMessage`

### 3.2 步骤 2：修改 `src/components/LoginPageContent.tsx` — 替换 getSafeErrorMessage

#### 2A：import

```typescript
import { getSafeAuthErrorMessage, logAuthError } from "@/lib/auth-errors";
```

#### 2B：替换现有 `getSafeErrorMessage` 函数（第 10-43 行）

将现有的 `getSafeErrorMessage` 函数**整个删除**，替换为对 `auth-errors.ts` 的调用：

```typescript
// 删除第 10-43 行（整个 getSafeErrorMessage 函数定义 + isValidEmail）
// isValidEmail 保留在原位不动（如果 LoginPageContent 还在使用它）

// 在 handleSendOtp 的 catch 中：
// 修改前：
setErrorMessage(getSafeErrorMessage(error, "otp"));
// 修改后：
setErrorMessage(getSafeAuthErrorMessage(error, "otp"));
logAuthError(error, "otp");

// 在 handleVerifyOtp 的 catch 中：
// 修改前：
setErrorMessage(getSafeErrorMessage(error, "otp"));
// 修改后：
setErrorMessage(getSafeAuthErrorMessage(error, "otp"));
logAuthError(error, "otp");

// 在 handlePasswordSubmit 的 catch 中：
// 修改前：
setErrorMessage(getSafeErrorMessage(error, "password"));
// 修改后：
setErrorMessage(getSafeAuthErrorMessage(error, "password"));
logAuthError(error, "password");
```

**Codex 注意**：
- 三处 catch 块都要改（`handleSendOtp`、`handleVerifyOtp`、`handlePasswordSubmit`）
- `isValidEmail` 函数保留在原位不动
- 导入语句放在文件顶部，与其他 `@/lib/` import 放在一起

### 3.3 步骤 3：修改 `src/app/forgot-password/page.tsx` — 使用统一错误脱敏

在 `/forgot-password/page.tsx` 中：
```typescript
import { getSafeAuthErrorMessage, logAuthError } from "@/lib/auth-errors";

// 在 handleSubmit 的 catch 块中：
setErrorMessage(getSafeAuthErrorMessage(error, "forgot_password"));
logAuthError(error, "forgot_password");
```

### 3.4 步骤 4：修改 `src/app/reset-password/page.tsx` — 使用统一错误脱敏

```typescript
import { getSafeAuthErrorMessage, logAuthError } from "@/lib/auth-errors";

// 在 handleSubmit 的 catch 块中：
setErrorMessage(getSafeAuthErrorMessage(error, "reset_password"));
logAuthError(error, "reset_password");
```

### 3.5 步骤 5：Supabase Dashboard Auth 配置复查（纯人工操作）

以下是 Claude Code 在 V2.3-Review 阶段需要逐项确认的清单。V2.3C 阶段先列出，不实施。

打开 Supabase Dashboard → Authentication，逐项检查并记录：

| # | 配置项 | 位置 | 预期值 | 当前值 | 状态 |
|---|--------|------|--------|--------|:--:|
| 1 | Site URL | Authentication → URL Configuration | `https://aitodoai.cn` | ? | ⬜ |
| 2 | Redirect URLs | Authentication → URL Configuration → Redirect URLs | 含以下全部：<br>`https://aitodoai.cn/**`<br>`https://www.aitodoai.cn/**`<br>`https://ai-todo-kappa-drab.vercel.app/**`<br>`http://localhost:3000/**` | ? | ⬜ |
| 3 | Reset password 邮件模板 | Authentication → Email Templates → Reset Password | 中文文案 + `{{ .RedirectTo }}` | ? | ⬜ |
| 4 | Confirm signup 邮件模板 | Authentication → Email Templates → Confirm Signup | 中文文案 + 回调 URL 正确（已有，复查） | ? | ⬜ |
| 5 | CAPTCHA 已启用 | Authentication → Bot and Abuse Protection | 已启用 + Turnstile + Secret Key 已配置 | ? | ⬜ |
| 6 | Rate limit | Authentication → Rate Limits | 确认当前值；建议 `/auth/v1/otp` ≤ 30 req/h | ? | ⬜ |
| 7 | Session 过期时间 | Authentication → Sessions | 确认当前值（默认 3600s） | ? | ⬜ |
| 8 | Refresh token 策略 | Authentication → Sessions | 确认 refresh token 过期策略 | ? | ⬜ |
| 9 | Allow unconfirmed email sign in | Authentication → Settings | **关闭**（用户必须验证邮箱） | ? | ⬜ |
| 10 | SMTP 配置 | Authentication → SMTP Settings | 阿里云邮件推送，发送正常 | ? | ⬜ |

### 3.6 V2.3C 完成后验证步骤

```bash
# 1. 门禁
npm run lint
npm run build

# 2. 错误提示测试
# - 登录失败 → 统一显示"邮箱或密码错误，请重试。"（不显示 Supabase 原文）
# - OTP 错误 → "验证码错误或已过期，请重新获取。"
# - 忘记密码 → 始终"如果该邮箱已注册，重置密码邮件已发送。"
# - Rate limit → "操作过于频繁，请稍后再试。"
# - console.error 中仍能看到原始错误对象（供调试）

# 3. 回归
# - 所有 V2.3A + V2.3B 功能正常
# - /app 正常

# 4. 文件清单
git status --short
```

### 3.7 V2.3C Codex 执行边界

| 能做 | 不能做 |
|------|--------|
| 新增 `src/lib/auth-errors.ts` | 不修改现有错误码体系（`ERROR_MESSAGES`） |
| 修改 LoginPageContent 的 catch 块（3 处） | 不修改 Auth 业务逻辑 |
| 修改 forgot-password / reset-password 的 catch 块 | 不修改 API Route 错误响应格式 |
| 新增 console.error 日志 | 不在 console.error 中打印 password / token |

### 3.8 V2.3C Claude Code Review 要点

1. `getSafeAuthErrorMessage` 是否涵盖所有 7 种错误模式
2. 忘记密码的兜底消息是否仍然是静默提示
3. `logAuthError` 是否在 console.error 中打印了原始错误（开发调试用）
4. LoginPageContent 的 `getSafeErrorMessage` 是否已完全替换
5. 所有新代码是否使用 `AUTH_TEXT` 常量而非硬编码字符串
6. lint + build 是否通过

---

## 四、V2.3-Review：安全回归验收

**目标**：端到端验证完整安全闭环，确保没有回归。

**本阶段不写代码。** Claude Code 逐项验收，任意一项不通过则标记为 🔴 阻塞。

### 4.1 功能验收清单

| # | 验收项 | 操作 | 预期结果 | 状态 |
|---|--------|------|------|:--:|
| F1 | 忘记密码邮件可发送 | `/forgot-password` 输入已注册邮箱 → 提交 | 收到重置密码邮件 | ⬜ |
| F2 | 不泄露邮箱是否存在 | `/forgot-password` 输入未注册邮箱 → 提交 | 显示相同成功提示 | ⬜ |
| F3 | 重置密码链接可打开 | 从邮件点击重置链接 | 正确跳转 `/reset-password`，显示表单 | ⬜ |
| F4 | 新密码设置成功 | 输入新密码 + 确认密码 → 提交 | 显示"密码已重置" | ⬜ |
| F5 | 新密码可登录 | 从 `/login` 用新密码登录 | 进入 `/app` | ⬜ |
| F6 | 旧密码失效 | 从 `/login` 用旧密码登录 | 登录失败（"邮箱或密码错误"） | ⬜ |
| F7 | OTP 登录仍可用 | `/login` OTP Tab → 发送 → 验证 | 登录成功进入 `/app` | ⬜ |
| F8 | 密码登录仍可用 | `/login` 密码 Tab → 输入正确密码 | 登录成功进入 `/app` | ⬜ |
| F9 | 注册仍可用 | `/login` OTP Tab → 新邮箱 → 验证 | 自动创建账号 + 登录 | ⬜ |
| F10 | 邮件确认仍可用 | 注册后查收 Confirm signup 邮件 | 可点击确认链接 | ⬜ |
| F11 | 设置密码引导仍可用 | OTP 登录后 | SetPasswordPrompt 正常弹出 | ⬜ |
| F12 | `/app` 路由守卫仍可用 | 未登录访问 `/app` | 自动跳转 `/login` | ⬜ |
| F13 | 登出仍可用 | Header → 登出 | 回到未登录状态 | ⬜ |

### 4.2 安全验收清单

| # | 验收项 | 验证方式 | 预期结果 | 状态 |
|---|--------|------|------|:--:|
| S1 | CAPTCHA 校验生效 | 绕过前端直接 curl Supabase Auth API 不带 captchaToken | 返回错误（406 或 captcha 相关错误码） | ⬜ |
| S2 | 前端不暴露 secret key | `grep -r "TURNSTILE_SECRET_KEY" src/` | 仅出现在 `.env.local` 注释中，不出现在任何 `.ts`/`.tsx` 中 | ⬜ |
| S3 | 错误提示不泄露用户存在性 | 各种登录失败场景 | 统一"邮箱或密码错误"，不区分"用户不存在" | ⬜ |
| S4 | 忘记密码不泄露 | 已注册 vs 未注册邮箱 | 相同提示 | ⬜ |
| S5 | API key / token / cookie 不暴露 | 浏览器 Network 面板 | 不出现 secret key 或 Supabase service_role key | ⬜ |
| S6 | console.error 不打印敏感信息 | 触发 Auth 错误，查看浏览器 console | 可打印 error.message（Supabase 原始），但不打印 password / token | ⬜ |

### 4.3 回归验收清单

| # | 验收项 | 操作 | 预期结果 | 状态 |
|---|--------|------|------|:--:|
| R1 | 任务生成正常 | 输入目标 → 生成 | AI 生成 3-8 条任务 | ⬜ |
| R2 | 任务勾选正常 | 点击任务 | completed 状态切换 | ⬜ |
| R3 | 历史正常 | 点击历史 | 查看归档任务组 | ⬜ |
| R4 | 统计正常 | 查看 StatsBar | 数据显示正确 | ⬜ |
| R5 | AI 复盘正常 | 触发 TaskReviewPanel | 正常展示 | ⬜ |
| R6 | 智能调整正常 | 连续低完成率 | 任务数量自动调整 | ⬜ |

### 4.4 门禁

```bash
npm run lint     # 零 error，零 warning（或仅 pre-existing warnings）
npm run build    # Compiled successfully，TypeScript 检查通过
git status --short   # 仅 V2.3 允许的文件变更，无意外修改
```

### 4.5 V2.3-Review 结果判定

| 结果 | 条件 |
|:---:|------|
| ✅ **PASS** | 全部 F1-F13 + S1-S6 + R1-R6 通过 + lint + build 通过 |
| 🟡 **PASS WITH WARNINGS** | 核心功能通过，但有非阻塞的 P2 项未完成 |
| 🔴 **BLOCKED** | 任一 F1-F13 或 S1-S4 或 R1-R6 失败，或 lint / build 失败 |

---

## 五、人工配置步骤汇总

| # | 操作 | Dashboard | 所属子阶段 | 优先级 | 说明 |
|---|------|------|:---:|:---:|------|
| 1 | 配置 Reset Password 邮件模板 | Supabase → Email Templates | V2.3A 前置 | 🔴 阻塞代码实现 | 必须使用 `{{ .RedirectTo }}` 变量 |
| 2 | 创建 Cloudflare Turnstile 站点 | Cloudflare → Turnstile | V2.3B 前置 | 🔴 阻塞代码实现 | 获取 Site Key + Secret Key |
| 3 | 启用 CAPTCHA 保护 | Supabase → Authentication → Bot and Abuse Protection | V2.3B 前置 | 🔴 阻塞生产验证 | 输入 Turnstile Secret Key |
| 4 | 配置 Vercel 环境变量 | Vercel Dashboard | V2.3B 部署前 | 🟡 阻塞生产部署 | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` |
| 5 | 复查 Auth 配置 | Supabase → Authentication | V2.3C | 🟢 不阻塞功能 | 10 项配置复查清单 |
| 6 | 验证 SMTP 发送 | Supabase → SMTP Settings | V2.3-Review | 🟢 验证 | 发送测试邮件 |

---

## 六、环境变量安全说明

### 6.1 Supabase Auth 现有环境变量（不变）

| 变量 | 位置 | 可见性 |
|------|------|:--:|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` · Vercel | 公开（前端可读） |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` · Vercel | 公开（anon key，安全） |
| `SUPABASE_URL` | `.env.local` · Vercel | 仅服务端 |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` · Vercel | 🔒 仅服务端 |

### 6.2 V2.3 新增环境变量

| 变量 | 位置 | 可见性 | 说明 |
|------|------|:--:|------|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `.env.local` · Vercel | 公开 | 前端 widget 加载 |
| `TURNSTILE_SECRET_KEY` | **仅 Supabase Dashboard** + Vercel（备用） | 🔒 服务端 | **严禁写入 `.env.local` 真实值** |

### 6.3 安全检查

- [ ] `.env.local` 中 `TURNSTILE_SECRET_KEY` 仅为注释说明或测试 key
- [ ] `grep -r "TURNSTILE_SECRET_KEY" src/` 结果为 0（不出现于源码中）
- [ ] `grep -r "secret" src/components/` 结果不包含真实 secret key
- [ ] Vercel Dashboard → Environment Variables 中已配置 ``NEXT_PUBLIC_TURNSTILE_SITE_KEY``（生产）
- [ ] Supabase Dashboard → CAPTCHA 中已配置 Secret Key（生产）
- [ ] `.gitignore` 包含 `.env.local`

---

## 七、回滚方案

### 7.1 如果忘记密码 / 重置密码有严重 bug

1. **Git revert** V2.3A 的 commit
2. 或者**手动删除** `/forgot-password/page.tsx` 和 `/reset-password/page.tsx`
3. LoginPageContent 中删除"忘记密码？"链接（1 行）
4. useAuth 中删除 `sendResetPasswordEmail`（保留原有方法不变）
5. 原有登录/注册功能不受影响（V2.3A 不改现有方法）

### 7.2 如果 Turnstile 导致用户无法登录

1. **Supabase Dashboard → CAPTCHA → 关闭**（最快）
2. 或者将模式从 Required 改为 Optional（如果 Dashboard 支持）
3. Vercel 删除 `NEXT_PUBLIC_TURNSTILE_SITE_KEY` 环境变量
4. 前端 TurnstileWidget 在 site key 不存在时自动 fail-open（不渲染 widget → `onTokenChange(null)`），不影响页面展示
5. 不需要回滚代码

### 7.3 如果错误提示脱敏导致排查困难

1. `logAuthError` 在 console.error 中保留原始错误 → 开发者仍可排查
2. 如果需要更详细的错误信息，在 `auth-errors.ts` 中临时添加更细粒度的模式

---

## 八、红线重申

以下红线适用于 **V2.3 全部子阶段**。Codex 实现和 Claude Code Review 时均须遵守：

| # | 红线 | 说明 |
|---|------|------|
| 1 | 不做 V2.4 AI 辅助执行 | 任何 AI 辅助相关代码、API、组件都不在本阶段出现 |
| 2 | 不做 UI 美化 | 不修改现有组件的样式、布局（仅新增链接/组件） |
| 3 | 不做 App Shell / 多页面拆分 | `/app` 保持现有单页结构 |
| 4 | 不修改数据库 schema | 不新增表、不新增字段、不修改 migration |
| 5 | 不修改现有 API Route（除新增 Turnstile 相关） | 且 Turnstile 经确认不新增 API Route |
| 6 | 不新增 npm 依赖 | Turnstile 使用原生 `<script>` 标签 |
| 7 | 不暴露 API key / token / secret key | 特别是 `TURNSTILE_SECRET_KEY`、`SUPABASE_SERVICE_ROLE_KEY` |
| 8 | 不提交 commit | 本阶段仅写方案 + codex 实现 + review，ChatGPT 把关后再提交 |

---

## 九、Codex 执行边界

### 9.1 执行顺序

**严格顺序执行，不允许并行或跳步：**

```
人工前置配置（邮件模板 + Turnstile Site）
    ↓
V2.3A 代码实现（4 个文件）
    ↓ Claude Code Review V2.3A
    ↓
V2.3B 代码实现（3 个文件）
    ↓ Claude Code Review V2.3B
    ↓
V2.3C 代码实现（4 个文件）
    ↓ Claude Code Review V2.3C
    ↓
V2.3-Review 全量验收（仅验证，不改代码）
    ↓
ChatGPT 最终把关
    ↓
提交
```

### 9.2 每步完成标准

| 子阶段 | 完成标准 |
|:---:|------|
| V2.3A | `npm run lint` 通过 + `npm run build` 通过 + 忘记密码/重置密码手动测试通过 |
| V2.3B | `npm run lint` 通过 + `npm run build` 通过 + Turnstile widget 渲染正常 |
| V2.3C | `npm run lint` 通过 + `npm run build` 通过 + 错误提示验证通过 |
| V2.3-Review | 全部 4.1-4.4 清单逐项通过 |

### 9.3 禁止跨阶段修改

- V2.3A 代码不得包含 V2.3B/C 的任何代码
- V2.3B 代码不得包含 V2.3C 的任何代码
- 如果发现前一个子阶段的 bug，标记但不修 → 通知 Claude Code Review 决定

---

> **文档结束**
>
> **下一文档**：本文档经 ChatGPT 审查通过后 → Codex 按执行方案实现
>
> **关联文档**：
> - [Architecture-V2.3-Security.md](Architecture-V2.3-Security.md) — V2.3 架构方案（✅ 已通过审查）
> - [Roadmap-Core-First-V2.3-to-V3.0.md](Roadmap-Core-First-V2.3-to-V3.0.md) — 核心能力优先路线总规划
> - [PROJECT-CONTEXT.md](PROJECT-CONTEXT.md) — 项目长期上下文
> - [PROJECT-INDEX.md](PROJECT-INDEX.md) — 项目文件索引
