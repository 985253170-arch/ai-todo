# V2.3D：重置密码验证码流程 执行方案

> **状态**：执行方案阶段，**不写代码，待 ChatGPT 审查通过后交给 Codex 实现**
> **依赖**：[Architecture-V2.3D-Reset-Password-OTP.md](Architecture-V2.3D-Reset-Password-OTP.md) ✅ 架构设计完成
> **上一文档**：[Execution-Plan-V2.3-Security.md](Execution-Plan-V2.3-Security.md)（V2.3A/B/C 执行方案，✅ 已完成）
> **设计日期**：2026-07-06

---

## 目录

- [〇、执行结论](#〇执行结论)
- [一、阶段边界](#一阶段边界)
- [二、允许修改文件](#二允许修改文件)
- [三、禁止修改文件](#三禁止修改文件)
- [四、架构细节修正](#四架构细节修正)
- [五、分文件实施步骤](#五分文件实施步骤)
  - [5.1 步骤 1：`src/hooks/useAuth.ts`](#51-步骤-1srchooksuseauthts)
  - [5.2 步骤 2：`src/lib/constants.ts`](#52-步骤-2srclibconstantsts)
  - [5.3 步骤 3：`src/lib/auth-errors.ts`](#53-步骤-3srclibauth-errorsts)
  - [5.4 步骤 4：`src/app/forgot-password/page.tsx`](#54-步骤-4srcappforgot-passwordpagetsx)
  - [5.5 步骤 5：`src/app/reset-password/page.tsx`](#55-步骤-5srcappreset-passwordpagetsx)
- [六、Supabase 邮件模板人工切换步骤](#六supabase-邮件模板人工切换步骤)
- [七、Codex 实现指令草案](#七codex-实现指令草案)
- [八、Claude Code Review 检查清单](#八claude-code-review-检查清单)
- [九、验收标准](#九验收标准)
- [十、风险与回滚](#十风险与回滚)
- [十一、不做事项](#十一不做事项)

---

## 〇、执行结论

| # | 判断项 | 结论 |
|---|--------|:--:|
| 1 | V2.3D 是否可以实现 | **✅ 可以实现** |
| 2 | 是否存在技术阻塞 | **✅ 无阻塞** |
| 3 | 当前 SDK 是否支持 `verifyOtp({ email, token, type: "recovery" })` | **✅ 完全支持**（`@supabase/supabase-js@2.108.2`，`EmailOtpType` 包含 `'recovery'`） |
| 4 | 是否需要 `any` 绕过 TypeScript | **✅ 不需要**（完全类型安全） |
| 5 | 是否需要新增 API Route | **✅ 不需要**（纯前端页面 + Supabase Auth SDK） |
| 6 | 是否需要新增数据库表 | **✅ 不需要** |
| 7 | 是否需要新增 npm 依赖 | **✅ 不需要** |
| 8 | 是否保留 `/reset-password` | **✅ 保留**（作为旧链接兼容入口） |
| 9 | 预计改动量 | **~230 行**（5 个文件） |

---

## 一、阶段边界

### 1.1 V2.3D 是什么

将 V2.3A 的链接式密码重置改为**验证码式密码重置**。用户在 `/forgot-password` 同一页面完成"发送验证码 → 输入验证码 + 新密码 → 密码重置成功"全流程。

### 1.2 V2.3D 不是什么

| 不是 | 原因 |
|------|------|
| 不是 V2.4 AI 辅助执行 | 属于后续版本 |
| 不是 UI 美化 | UI 美化全部后移到 V3.0 |
| 不是新的 Auth 机制 | 完全基于 Supabase Auth 原生 recovery 流程 |
| 不是数据库变更 | 不需要新表或字段 |
| 不是 API Route 变更 | 不新增、不修改任何 API Route |

### 1.3 与 V2.3A/B/C 的关系

| 子阶段 | 职责 | V2.3D 影响 |
|:---:|------|:--:|
| V2.3A | 忘记密码 / 重置密码（链接式） | `/forgot-password` 重构为双步骤验证码流程；`/reset-password` 降级为兼容入口 |
| V2.3B | Cloudflare Turnstile | 继续有效：发送验证码 + 重新发送验证码均需 Turnstile |
| V2.3C | 错误提示脱敏 | 继续有效：新增 recovery OTP 错误文案；`logAuthError` + `redactSensitiveText` 不变 |

---

## 二、允许修改文件

V2.3D Codex 实现阶段**只允许修改以下 5 个文件**：

| # | 文件 | 操作 | 预估改动 |
|:--:|------|:--:|:--:|
| 1 | `src/hooks/useAuth.ts` | 🔧 修改 | ~15 行（新增 `sendResetPasswordOtp`，旧方法改为 alias） |
| 2 | `src/lib/constants.ts` | 🔧 修改 | ~10 行（新增验证码相关文案） |
| 3 | `src/lib/auth-errors.ts` | 🔧 修改 | ~10 行（新增 recovery OTP 错误文案） |
| 4 | `src/app/forgot-password/page.tsx` | 🔄 重构 | ~200 行（双步骤验证码流程） |
| 5 | `src/app/reset-password/page.tsx` | 🔧 微调 | ~5 行（顶部新增兼容提示） |

---

## 三、禁止修改文件

以下文件**严禁任何修改**。Codex 若触碰其中任何一个，Review 直接打回。

| # | 文件 | 原因 |
|---|------|------|
| 1 | `.env.local` | 环境变量，Codex 不操作 |
| 2 | `package.json` | 无新增依赖 |
| 3 | `package-lock.json` | 无新增依赖 |
| 4 | `src/app/api/**`（全部 8 个 API Route） | 不变 |
| 5 | `src/app/app/page.tsx` | `/app` 主页面不变 |
| 6 | `src/app/auth/callback/route.ts` | Auth 回调不变 |
| 7 | `src/app/login/page.tsx` | `/login` 页面不变 |
| 8 | `src/components/TurnstileWidget.tsx` | V2.3B 产物，零修改 |
| 9 | `src/components/LoginPageContent.tsx` | 登录流程不变 |
| 10 | `src/components/Header.tsx` | 不变 |
| 11 | `src/components/AuthModal.tsx` | 不变 |
| 12 | `src/components/SetPasswordPrompt.tsx` | 不变 |
| 13 | `src/components/TaskList.tsx` | 不变 |
| 14 | `src/components/GoalInput.tsx` | 不变 |
| 15 | `src/components/StatsBar.tsx` | 不变 |
| 16 | `src/components/HistoryPanel.tsx` | 不变 |
| 17 | `src/components/TaskReviewPanel.tsx` | 不变 |
| 18 | `src/hooks/useTaskGroup.ts` | 不变 |
| 19 | `src/hooks/useTaskStats.ts` | 不变 |
| 20 | `src/hooks/useTaskHistory.ts` | 不变 |
| 21 | `src/hooks/useTaskReview.ts` | 不变 |
| 22 | `src/lib/supabase-client.ts` | 不变 |
| 23 | `src/lib/supabase-server.ts` | 不变 |
| 24 | `src/lib/types.ts` | 不变 |
| 25 | `src/lib/ai-client.ts` | 不变 |
| 26 | `src/lib/task-parser.ts` | 不变 |
| 27 | `src/lib/review-parser.ts` | 不变 |
| 28 | `src/lib/stats-calculator.ts` | 不变 |
| 29 | `src/lib/adjust-task-strategy.ts` | 不变 |
| 30 | `src/prompts/**` | 不变 |
| 31 | 数据库 schema / migration | 不变 |
| 32 | `next.config.ts` | 不变 |
| 33 | 所有 `docs/` 文档（除本文档） | 不变 |

---

## 四、架构细节修正

基于代码审查，以下 3 个执行细节必须在架构方案基础上明确修正：

### 4.1 sendResetPasswordOtp 规则

**架构方案**（§五）建议 `sendResetPasswordOtp` 作为新方法。执行方案明确：

- V2.3D 主流程**只发送验证码**，不生成重置链接。
- `resetPasswordForEmail` **不传 `redirectTo`**（邮件模板改为 `{{ .Token }}`，不需要跳转链接）。
- `/reset-password` **只用于兼容 V2.3A 已经发出去的旧链接**。

**实现方式**：

```typescript
// useAuth.ts — 新增方法（V2.3D 主流程入口）
async function sendResetPasswordOtp(email: string, captchaToken?: string) {
  if (!supabase) {
    throw new Error("AUTH_NOT_CONFIGURED");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    captchaToken,
  });

  if (error) {
    logSafeAuthError(error);

    if (
      error.message?.toLowerCase().includes("rate limit") ||
      error.message?.toLowerCase().includes("too many requests")
    ) {
      throw error;
    }

    return;
  }
}
```

**旧 `sendResetPasswordEmail` 改为 alias**：

```typescript
// 保留旧方法名，内部直接调用新方法（仅作为旧调用方的兼容 alias）
async function sendResetPasswordEmail(email: string, captchaToken?: string) {
  return sendResetPasswordOtp(email, captchaToken);
}
```

**关键约束**：
- `forgot-password` 页面**必须调用 `sendResetPasswordOtp`**，**禁止**调用 `sendResetPasswordEmail`。
- `sendResetPasswordEmail` **只能是 alias**，**禁止**在内部再次调用 `resetPasswordForEmail({ redirectTo })`。
- 不要设计 `mode: "otp" | "link"` 参数。
- 不要做复杂的条件分支。
- 不要保留任何新发送链接邮件的分支。

### 4.2 邮件模板切换顺序（⚠️ 关键）

**不要在代码部署前提前把 Supabase Reset Password 邮件模板改成 `{{ .Token }}`。**

正确顺序：

```
1. Codex 实现 V2.3D 代码
2. Claude Code Review
3. ChatGPT 最终把关
4. git commit + push
5. Vercel 重新部署成功
6. 人工进入 Supabase Dashboard
7. 修改 Reset Password 邮件模板为验证码模板（{{ .Token }}）
8. 再做浏览器端实测验证
```

**原因**：如果先改邮件模板，而线上代码还是 V2.3A 链接流程，用户会收到验证码但页面仍按链接流程处理（体验断裂）。

### 4.3 /reset-password 提示链接

`/reset-password` 页面只加轻量提示。提示链接必须是 `/forgot-password`（普通 `<a href>`，不是 `$/forgot-password`）。

不删除原 hash 解析 / setSession / updateUser / signOut 逻辑。

---

## 五、分文件实施步骤

### 5.1 步骤 1：`src/hooks/useAuth.ts`

#### 5.1.1 当前状态（第 192-214 行）

```typescript
async function sendResetPasswordEmail(email: string, captchaToken?: string) {
  if (!supabase) throw new Error("AUTH_NOT_CONFIGURED");
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
    captchaToken,
  });
  if (error) {
    logSafeAuthError(error);
    if (
      error.message?.toLowerCase().includes("rate limit") ||
      error.message?.toLowerCase().includes("too many requests")
    ) {
      throw error;
    }
    return;
  }
}
```

#### 5.1.2 目标变更

**新增 `sendResetPasswordOtp` 方法**（在 `sendResetPasswordEmail` 之前）：

```typescript
async function sendResetPasswordOtp(email: string, captchaToken?: string) {
  if (!supabase) {
    throw new Error("AUTH_NOT_CONFIGURED");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    captchaToken,
  });

  if (error) {
    logSafeAuthError(error);

    if (
      error.message?.toLowerCase().includes("rate limit") ||
      error.message?.toLowerCase().includes("too many requests")
    ) {
      throw error;
    }

    return;
  }
}
```

**修改 `sendResetPasswordEmail` 为 alias**（在 `sendResetPasswordOtp` 之后）：

```typescript
// 旧方法改为 alias，内部直接调用 sendResetPasswordOtp
// 禁止在此方法中再次调用 resetPasswordForEmail({ redirectTo })
async function sendResetPasswordEmail(email: string, captchaToken?: string) {
  return sendResetPasswordOtp(email, captchaToken);
}
```

**修改 return 对象**，新增 `sendResetPasswordOtp`：

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
  sendResetPasswordEmail,    // alias → sendResetPasswordOtp（旧调用方兼容）
  sendResetPasswordOtp,      // ← 新增（V2.3D 主流程入口）
};
```

#### 5.1.3 Codex 操作清单

- [ ] 在 `sendResetPasswordEmail` 方法之前新增 `sendResetPasswordOtp`
- [ ] 修改 `sendResetPasswordEmail`：删除 `redirectTo` 逻辑，改为 `return sendResetPasswordOtp(email, captchaToken)`
- [ ] 在 return 对象中新增 `sendResetPasswordOtp`
- [ ] **禁止修改** `sendOtp` / `verifyOtp` / `signInWithPassword` / `signUp` / `setPassword` / `signOut` 的任何代码
- [ ] **禁止修改** `toAuthUser` / `logSafeAuthError` 函数
- [ ] **禁止在 `sendResetPasswordEmail` 中再次调用 `resetPasswordForEmail({ redirectTo })`**

---

### 5.2 步骤 2：`src/lib/constants.ts`

#### 5.2.1 当前状态

`AUTH_TEXT` 对象（第 56-120 行）包含完整的忘记密码 / 重置密码文案（V2.3A 产物）。第 101-119 行为忘记密码和重置密码相关文案。

#### 5.2.2 目标变更

在 `AUTH_TEXT` 对象末尾（第 119 行 `RESET_PASSWORD_GO_FORGOT` 之后，`} as const;` 之前）新增验证码相关文案：

```typescript
// 重置密码 — 验证码
RESET_PASSWORD_CODE_LABEL: "验证码",
RESET_PASSWORD_CODE_PLACEHOLDER: "输入 6 位验证码",
RESET_PASSWORD_CODE_SEND_BUTTON: "发送验证码",
RESET_PASSWORD_CODE_SEND_LOADING: "发送中...",
RESET_PASSWORD_CODE_RESEND_BUTTON: "重新发送验证码",
RESET_PASSWORD_CODE_SENT: "验证码已发送，请查收邮箱。",
RESET_PASSWORD_SET_BUTTON: "设置新密码",
RESET_PASSWORD_SET_LOADING: "设置中...",
RESET_PASSWORD_SUCCESS_V2: "密码已重置，请用新密码登录。",
RESET_PASSWORD_OTP_INVALID: "验证码错误或已过期，请重新获取。",
RESET_PASSWORD_LEGACY_HINT: "我们已支持验证码重置密码，也可以返回忘记密码页面重新获取验证码。",
```

#### 5.2.3 Codex 操作清单

- [ ] 在 `RESET_PASSWORD_GO_FORGOT` 之后、`} as const;` 之前新增上述文案
- [ ] **禁止修改**任何现有 `AUTH_TEXT` 属性
- [ ] **禁止修改** `UI_TEXT` / `ERROR_MESSAGES`
- [ ] **禁止修改** `STORAGE_KEY` / `DEVICE_ID_STORAGE_KEY`

---

### 5.3 步骤 3：`src/lib/auth-errors.ts`

#### 5.3.1 当前状态（149 行）

V2.3C 产物。包含：
- `AuthOperation = "otp" | "password" | "forgot_password" | "reset_password"`（第 3-7 行）
- 7 种错误模式匹配（第 19-86 行）
- `redactSensitiveText()` 10 种敏感信息脱敏（第 100-113 行）
- `getSafeAuthErrorMessage()` 标准映射（第 115-128 行）
- `logAuthError()` 安全日志（第 130-148 行）

#### 5.3.2 目标变更

**① 新增 recovery OTP 专用错误模式**（在现有 error patterns 数组中新增一条）：

```typescript
{
  patterns: ["invalid otp", "invalid token", "otp has expired", "otp expired"],
  messages: {
    otp: AUTH_TEXT.OTP_INVALID,
    password: AUTH_TEXT.PASSWORD_LOGIN_ERROR,
    forgot_password: AUTH_TEXT.FORGOT_PASSWORD_SUCCESS,
    reset_password: "验证码错误或已过期，请重新获取。",
  },
},
```

**② 可选：微调 `reset_password` 的 fallback message**：

当前第 10 行：
```typescript
const RESET_PASSWORD_FALLBACK_MESSAGE = "重置失败，请重新申请重置链接。";
```

建议改为：
```typescript
const RESET_PASSWORD_FALLBACK_MESSAGE = "重置失败，请重新获取验证码后重试。";
```

**③ 确认现有 pattern 已覆盖 recovery OTP 错误**：

| Supabase 错误 | 现有 pattern 覆盖 | 状态 |
|---------------|------------------|:--:|
| `token has expired or is invalid` | `["token", "otp", "expired"]` | ✅ 已覆盖 |
| `invalid otp` | 新增 `["invalid otp"]` | 🔧 需新增 |
| `otp has expired` | 新增 `["otp has expired"]` | 🔧 需新增 |
| `Email rate limit exceeded` | `["rate limit", "too many requests"]` | ✅ 已覆盖 |
| `captcha` / `turnstile` | `["captcha", "turnstile", ...]` | ✅ 已覆盖 |

**④ 不需要修改 `redactSensitiveText()`**。现有 10 种正则已覆盖 token / password / captchaToken / access_token / refresh_token / cookie / api_key / service_role / bearer。

**⑤ 不需要新增 `AuthOperation`**。现有的 `"forgot_password"` 和 `"reset_password"` 已覆盖 V2.3D 所有场景。

#### 5.3.3 Codex 操作清单

- [ ] 在 `AUTH_ERROR_PATTERNS` 数组中新增 recovery OTP 错误模式（放在现有 token/otp/expired 模式之前）
- [ ] 可选：修改 `RESET_PASSWORD_FALLBACK_MESSAGE` 文案
- [ ] **禁止修改** `logAuthError` 函数
- [ ] **禁止修改** `redactSensitiveText` 函数
- [ ] **禁止修改** `getSafeAuthErrorMessage` 函数签名
- [ ] **禁止新增** `AuthOperation` 类型成员
- [ ] 不要在代码中硬编码敏感信息脱敏的正则

---

### 5.4 步骤 4：`src/app/forgot-password/page.tsx`（⚠️ 核心重构）

#### 5.4.1 当前状态（159 行）

V2.3A + V2.3B 产物。单步骤页面：
- 输入邮箱 + Turnstile + 点击"发送重置密码邮件"
- 调 `sendResetPasswordEmail(email, turnstileToken)`
- 成功后显示 "如果该邮箱已注册，重置密码邮件已发送。"
- 返回 `/login`

#### 5.4.2 目标：双步骤验证码重置

**页面状态定义**：

```typescript
type ResetStep = "request" | "reset";

const [step, setStep] = useState<ResetStep>("request");
const [email, setEmail] = useState("");
const [token, setToken] = useState("");
const [newPassword, setNewPassword] = useState("");
const [confirmPassword, setConfirmPassword] = useState("");
const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
const [isSubmitting, setIsSubmitting] = useState(false);
const [errorMessage, setErrorMessage] = useState<string | null>(null);
const [successMessage, setSuccessMessage] = useState<string | null>(null);
const [isSuccess, setIsSuccess] = useState(false);
const [resendSeconds, setResendSeconds] = useState(0);
const [isPasswordVisible, setIsPasswordVisible] = useState(false);
```

**倒计时**（复用 `LoginPageContent.tsx` 第 38-48 行模式）：

```typescript
useEffect(() => {
  if (resendSeconds <= 0) return;
  const timer = window.setTimeout(() => {
    setResendSeconds((currentValue) => Math.max(0, currentValue - 1));
  }, 1000);
  return () => window.clearTimeout(timer);
}, [resendSeconds]);
```

#### 5.4.3 Step "request" — 发送验证码

**UI 结构**（与当前 V2.3A `/forgot-password` 一致，仅文案调整）：

```
┌──────────────────────────────────────┐
│  ← 返回登录（Header variant="login"）  │
│                                      │
│  忘记密码                              │
│  输入注册邮箱，我们会发送验证码。         │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ you@example.com              │    │
│  └──────────────────────────────┘    │
│                                      │
│  [ 我是人类 ] ← TurnstileWidget      │
│                                      │
│  ┌──────────────────────────────┐    │
│  │       发送验证码               │    │
│  └──────────────────────────────┘    │
│                                      │
│  返回登录                             │
└──────────────────────────────────────┘
```

**发送验证码逻辑**：

```typescript
async function handleSendCode() {
  const trimmedEmail = email.trim();
  const validationMessage = validateEmail(trimmedEmail);

  if (validationMessage) {
    setSuccessMessage(null);
    setErrorMessage(validationMessage);
    return;
  }

  setIsSubmitting(true);
  setSuccessMessage(null);
  setErrorMessage(null);

  try {
    await sendResetPasswordOtp(trimmedEmail, turnstileToken ?? undefined);
    // 无论邮箱是否存在，统一进入 step "reset" 并显示成功提示
    setStep("reset");
    setSuccessMessage(AUTH_TEXT.RESET_PASSWORD_CODE_SENT);
    setResendSeconds(60);
    setTurnstileToken(null); // Turnstile token 已使用
  } catch (error) {
    const safeMessage = getSafeAuthErrorMessage(error, "forgot_password");
    logAuthError(error, "forgot_password");

    if (
      safeMessage === AUTH_TEXT.EMAIL_RATE_LIMITED ||
      safeMessage === "安全验证失败，请刷新页面后重试。"
    ) {
      setErrorMessage(safeMessage);
    } else {
      // 其他错误仍进入 step "reset"，不暴露用户是否存在
      setStep("reset");
      setSuccessMessage(AUTH_TEXT.RESET_PASSWORD_CODE_SENT);
      setResendSeconds(60);
      setTurnstileToken(null);
    }
  } finally {
    setIsSubmitting(false);
  }
}
```

**关键安全逻辑**：
- 未注册邮箱：仍显示 "验证码已发送" + 进入 step "reset"。用户输入验证码时 Supabase 会返回错误（因为邮箱不存在），前端用安全文案提示。
- rate limit / captcha 错误：显示具体错误提示（这两个不泄露用户存在性）。
- 其他错误：统一进入 step "reset"，与成功行为一致。

#### 5.4.4 Step "reset" — 验证 + 设置新密码

**UI 结构**：

```
┌──────────────────────────────────────┐
│  ← 返回上一步                          │
│                                      │
│  设置新密码                            │
│  验证码已发送至 y***@example.com       │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  输入 6 位验证码               │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  新密码（至少 6 位）    [👁]   │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  确认密码                     │    │
│  └──────────────────────────────┘    │
│                                      │
│  [ 重新发送验证码 (60s) ]             │
│                                      │
│  [ TurnstileWidget ]                 │
│                                      │
│  ┌──────────────────────────────┐    │
│  │       设置新密码               │    │
│  └──────────────────────────────┘    │
└──────────────────────────────────────┘
```

**设置新密码逻辑**：

```typescript
async function handleSetNewPassword() {
  // 1. 前端校验
  const trimmedEmail = email.trim();
  const trimmedToken = token.trim();

  if (!trimmedToken || trimmedToken.length !== 6) {
    setSuccessMessage(null);
    setErrorMessage(AUTH_TEXT.OTP_INVALID_LENGTH);
    return;
  }

  if (!newPassword) {
    setSuccessMessage(null);
    setErrorMessage(AUTH_TEXT.PASSWORD_REQUIRED);
    return;
  }

  if (newPassword.length < 6) {
    setSuccessMessage(null);
    setErrorMessage(AUTH_TEXT.PASSWORD_TOO_SHORT);
    return;
  }

  if (newPassword !== confirmPassword) {
    setSuccessMessage(null);
    setErrorMessage(AUTH_TEXT.PASSWORD_MISMATCH);
    return;
  }

  // 2. 获取 Supabase client
  const supabase = createSupabaseBrowserClient();
  if (!supabase) {
    setSuccessMessage(null);
    setErrorMessage("服务暂未配置，请稍后重试。");
    return;
  }

  setIsSubmitting(true);
  setSuccessMessage(null);
  setErrorMessage(null);

  try {
    // 3. verifyOtp recovery（不需要 Turnstile token）
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email: trimmedEmail,
      token: trimmedToken,
      type: "recovery",
    });

    if (verifyError) {
      // 使用 auth-errors 统一处理（以 "reset_password" operation 映射）
      throw verifyError;
    }

    // data.user 已可用，data.session 已建立

    // 4. updateUser 设置新密码
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      throw updateError;
    }

    // 5. signOut 清除 recovery session
    await supabase.auth.signOut();

    // 6. 显示成功
    setIsSuccess(true);
    setSuccessMessage(AUTH_TEXT.RESET_PASSWORD_SUCCESS_V2);
  } catch (error) {
    setErrorMessage(getSafeAuthErrorMessage(error, "reset_password"));
    logAuthError(error, "reset_password");
  } finally {
    setIsSubmitting(false);
  }
}
```

**关键细节**：
- `verifyOtp` 使用 `type: "recovery"`（不是 `"email"`），完全类型安全，**不需要 `any`**。
- `verifyOtp` 成功后 `data.session` 已建立，可直接调 `updateUser`。
- `updateUser` 成功后必须 `signOut()` 清除 recovery session。
- 密码更新失败的错误通过 `getSafeAuthErrorMessage(error, "reset_password")` 映射。
- 验证码错误显示 "验证码错误或已过期，请重新获取。"；密码更新失败显示安全文案。

#### 5.4.5 重新发送验证码

```typescript
async function handleResendCode() {
  if (resendSeconds > 0) return; // 倒计时中禁止点击

  const trimmedEmail = email.trim();

  setIsSubmitting(true);
  setSuccessMessage(null);
  setErrorMessage(null);

  try {
    await sendResetPasswordOtp(trimmedEmail, turnstileToken ?? undefined);
    setSuccessMessage(AUTH_TEXT.RESET_PASSWORD_CODE_SENT);
    setResendSeconds(60);
    setToken(""); // 清空旧验证码
    setTurnstileToken(null); // Turnstile token 已使用
  } catch (error) {
    const safeMessage = getSafeAuthErrorMessage(error, "forgot_password");
    logAuthError(error, "forgot_password");

    if (
      safeMessage === AUTH_TEXT.EMAIL_RATE_LIMITED ||
      safeMessage === "安全验证失败，请刷新页面后重试。"
    ) {
      setErrorMessage(safeMessage);
    } else {
      setSuccessMessage(AUTH_TEXT.RESET_PASSWORD_CODE_SENT);
      setResendSeconds(60);
      setToken("");
      setTurnstileToken(null);
    }
  } finally {
    setIsSubmitting(false);
  }
}
```

#### 5.4.6 Turnstile 集成

| 操作 | 需要 Turnstile | 说明 |
|------|:--:|------|
| 发送验证码（step "request"） | ✅ 需要 | `sendResetPasswordOtp(email, turnstileToken ?? undefined)` |
| 重新发送验证码（step "reset"） | ✅ 需要 | 同上，需要新的 Turnstile token |
| 验证验证码 + 设置新密码 | ❌ 不需要 | `verifyOtp` + `updateUser` + `signOut` 不传 captchaToken |

**TurnstileWidget 放置位置**：
- Step "request"：在提交按钮之前
- Step "reset"：在 "重新发送验证码" 按钮之后、"设置新密码" 按钮之前（或紧接在重新发送按钮下方）

**Turnstile token 用后即焚**：每次发送/重发成功后 `setTurnstileToken(null)`。

#### 5.4.7 成功状态

当 `isSuccess === true` 时，显示成功页面：

```
┌──────────────────────────────────────┐
│                                      │
│  密码已重置                            │
│                                      │
│  ✅ 密码已重置，请用新密码登录。         │
│                                      │
│  ┌──────────────────────────────┐    │
│  │       返回登录                 │    │
│  └──────────────────────────────┘    │
└──────────────────────────────────────┘
```

#### 5.4.8 邮箱脱敏显示

在 step "reset" 中展示脱敏邮箱（提高用户体验，让用户确认验证码发到了正确的邮箱）：

```typescript
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = local.length > 2 ? 2 : 1;
  return local.slice(0, visible) + "***@" + domain;
}
```

显示文案示例：`验证码已发送至 y***@example.com`

#### 5.4.9 Codex 操作清单

- [ ] 新增 state 变量（step, email, token, newPassword, confirmPassword, isSuccess, resendSeconds, isPasswordVisible）
- [ ] 新增 `useEffect` 倒计时逻辑
- [ ] 实现 `handleSendCode`（step "request" 提交）
- [ ] 实现 `handleSetNewPassword`（step "reset" 提交，包含 verifyOtp recovery + updateUser + signOut）
- [ ] 实现 `handleResendCode`（重新发送验证码）
- [ ] 实现 `maskEmail`（邮箱脱敏显示）
- [ ] 渲染 step "request" UI（邮箱输入 + TurnstileWidget + 发送验证码按钮）
- [ ] 渲染 step "reset" UI（验证码输入 + 新密码 + 确认密码 + 重发按钮 + TurnstileWidget + 设置新密码按钮）
- [ ] 渲染 isSuccess UI（成功提示 + 返回登录按钮）
- [ ] 使用 `createSupabaseBrowserClient()` 获取 Supabase 实例
- [ ] 使用 `getSafeAuthErrorMessage()` + `logAuthError()` 处理错误
- [ ] 导入 `sendResetPasswordOtp`（从 useAuth），**不导入 `sendResetPasswordEmail`**
- [ ] **禁止使用** localStorage / sessionStorage
- [ ] **禁止硬编码** `mode: "otp" | "link"` 参数
- [ ] **禁止在 submit handler 中写业务逻辑外的东西**

---

### 5.5 步骤 5：`src/app/reset-password/page.tsx`

#### 5.5.1 当前状态（238 行）

V2.3A + V2.3B + V2.3C 产物。完整流程：
- hash 解析 → setSession → 输入新密码 + 确认密码 → updateUser → signOut
- 4 种状态：`isTokenInvalid` / `isSuccess` / `!isTokenReady` / 正常表单

#### 5.5.2 目标变更

**只新增轻量提示**，不删除任何现有逻辑。

在页面顶部（`<main>` 标签内部，`<section>` 卡片之前）新增提示横幅：

```tsx
{/* V2.3D 兼容提示 */}
{!isSuccess && !isTokenInvalid && (
  <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
    {AUTH_TEXT.RESET_PASSWORD_LEGACY_HINT}{" "}
    <a
      className="font-semibold underline transition hover:text-indigo-900"
      href="/forgot-password"
    >
      前往忘记密码
    </a>
  </div>
)}
```

**提示条件**：仅在正常表单状态（非成功、非 token 无效）时显示。成功状态和 token 无效状态已有各自 UI，不叠加提示。

**提示链接**：`href="/forgot-password"`（普通 `<a>` 标签，不是 `$/forgot-password`）。

#### 5.5.3 Codex 操作清单

- [ ] 在正常表单渲染分支中新增兼容提示横幅
- [ ] 提示链接指向 `/forgot-password`
- [ ] **禁止删除** hash 解析逻辑（第 19-58 行）
- [ ] **禁止删除** `setSession` 调用（第 45-48 行）
- [ ] **禁止删除** `updateUser` 逻辑（第 95-97 行）
- [ ] **禁止删除** `signOut` 调用（第 105 行）
- [ ] **禁止删除**任何现有 state 变量
- [ ] **禁止修改**任何现有 JSX 结构（仅在现有结构外新增）
- [ ] 提示横幅仅在 `!isSuccess && !isTokenInvalid` 时显示

---

## 六、Supabase 邮件模板人工切换步骤

### 6.1 操作位置

```
Supabase Dashboard
→ Authentication（身份验证）
→ Email Templates（邮件模板）
→ Reset Password（重置密码）
```

### 6.2 新模板内容

**Subject（主题）**：
```
重置你的 AI Todo 密码
```

**Message Body（HTML）**：
```html
<div style="max-width:480px;margin:0 auto;padding:32px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <h2 style="font-size:20px;color:#1e293b;margin-bottom:16px;">重置你的 AI Todo 密码</h2>

  <p style="font-size:15px;color:#475569;line-height:1.6;margin-bottom:24px;">
    我们收到了你的密码重置请求。你的验证码是：
  </p>

  <!-- 验证码展示区 -->
  <div style="background:#f1f5f9;border-radius:12px;padding:20px 16px;text-align:center;margin-bottom:24px;">
    <span style="font-size:32px;font-weight:700;letter-spacing:0.2em;color:#1e293b;font-family:'SF Mono','Menlo','Consolas',monospace;">
      {{ .Token }}
    </span>
  </div>

  <p style="font-size:14px;color:#64748b;line-height:1.5;margin-bottom:24px;">
    请在重置密码页面输入此验证码。<br/>
    验证码在 1 小时内有效。
  </p>

  <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
    <p style="font-size:13px;color:#92400e;margin:0;line-height:1.5;">
      ⚠️ 如果你没有请求重置密码，请忽略此邮件。<br/>
      ⚠️ 请勿将验证码泄露给他人。
    </p>
  </div>

  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />

  <p style="font-size:12px;color:#cbd5e1;">
    AI Todo · 你的 AI 行动教练<br/>
    <a href="https://aitodoai.cn" style="color:#6366f1;">aitodoai.cn</a>
  </p>
</div>
```

### 6.3 核心变更点

| 项目 | 旧模板（V2.3A） | 新模板（V2.3D） |
|------|----------------|----------------|
| 核心变量 | `{{ .RedirectTo }}` 链接按钮 | `{{ .Token }}` 验证码 |
| 用户操作 | 点击链接跳转 | 手动输入验证码 |
| 过期说明 | "24 小时内有效" | "1 小时内有效" |
| 安全提醒 | 无 | "请勿将验证码泄露给他人" |

### 6.4 ⚠️ 关键约束

1. **不要在代码部署前提前改模板。**
2. **必须等 V2.3D 代码部署到 Vercel 后再改模板。**
3. **不要修改 Confirm Signup 模板**（继续使用链接流程）。
4. **不要修改 Magic Link / OTP Login 模板**（继续使用 `{{ .Token }}`）。
5. **不要在聊天和代码中贴真实 `{{ .Token }}` 值。**

### 6.5 人工操作时序

```
V2.3D 代码 commit + push
  → Vercel 自动部署
  → 确认部署成功
  → 进入 Supabase Dashboard
  → Email Templates → Reset Password
  → 替换为验证码模板（{{ .Token }}）
  → 保存
  → 浏览器端 /forgot-password 实测验证
```

---

## 七、Codex 实现指令草案

### 7.1 执行顺序

**严格按以下顺序执行，不可跳步或并行：**

```
步骤 1: src/hooks/useAuth.ts        (新增 sendResetPasswordOtp)
步骤 2: src/lib/constants.ts        (新增文案)
步骤 3: src/lib/auth-errors.ts      (新增 recovery OTP 错误模式)
步骤 4: src/app/forgot-password/page.tsx  (重构为双步骤流程)
步骤 5: src/app/reset-password/page.tsx   (新增兼容提示)
```

### 7.2 每步完成后必做

```bash
npm run lint
npm run build
git status --short
```

若 lint 或 build 失败，**停止后续步骤，先修复当前步骤的问题**。

### 7.3 Codex 完成全部 5 步后必须汇报

| # | 汇报项 |
|---|--------|
| 1 | 修改 / 新增了哪些文件（精确到文件路径） |
| 2 | 是否只改 V2.3D 允许文件（对照 §二 清单） |
| 3 | 是否没有修改 `TurnstileWidget.tsx` |
| 4 | 是否没有修改 `LoginPageContent.tsx` |
| 5 | 是否没有新增 API Route |
| 6 | 是否没有修改 `package.json` |
| 7 | 是否没有修改 `.env.local` |
| 8 | 是否没有新增 npm 依赖 |
| 9 | 是否没有新增数据库 schema / migration |
| 10 | `npm run lint` 是否通过（零 error） |
| 11 | `npm run build` 是否通过（Compiled successfully） |
| 12 | `git status --short` 结果 |
| 13 | 是否确认 `verifyOtp({ type: "recovery" })` 没有使用 `any` 绕过 |
| 14 | 是否发现需要 Claude Code / ChatGPT 决策的问题 |

### 7.4 Codex 禁止事项

| # | 禁止 |
|---|------|
| 1 | 不要修改 §三 列出的任何禁止文件 |
| 2 | 不要新增 `mode: "otp" \| "link"` 参数 |
| 3 | 不要在 `forgot-password` 页面导入 `sendResetPasswordEmail` |
| 4 | 不要使用 `any` 类型绕过 |
| 5 | 不要使用 localStorage / sessionStorage |
| 6 | 不要修改 `redactSensitiveText` |
| 7 | 不要修改 `logAuthError` |
| 8 | 不要修改 `TurnstileWidget` |
| 9 | 不要提交 commit |
| 10 | 不要 push |

---

## 八、Claude Code Review 检查清单

### 8.1 范围检查（一票否决）

| # | 检查项 | 不通过则打回 |
|---|--------|:--:|
| R1 | 是否只改了 §二 列出的 5 个文件 | 🔴 |
| R2 | 是否没有触碰 §三 列出的 33 个文件/目录 | 🔴 |
| R3 | 是否没有新增 API Route | 🔴 |
| R4 | 是否没有修改 `package.json` | 🔴 |
| R5 | 是否没有新增 npm 依赖 | 🔴 |
| R6 | 是否没有修改 `TurnstileWidget.tsx` | 🔴 |
| R7 | 是否没有修改 `LoginPageContent.tsx` | 🔴 |
| R8 | 是否没有新增数据库表 / migration | 🔴 |

### 8.2 功能检查

| # | 检查项 | 说明 |
|---|--------|------|
| F1 | `sendResetPasswordOtp` 是否不传 `redirectTo` | 确认 `resetPasswordForEmail(email, { captchaToken })` 无 `redirectTo` |
| F2 | `sendResetPasswordEmail` 是否改为 alias | 确认内部仅调用 `sendResetPasswordOtp`，不包含 `redirectTo`、不独立调用 `resetPasswordForEmail` |
| F3 | `forgot-password` 是否调用 `sendResetPasswordOtp` | 确认不是 `sendResetPasswordEmail` |
| F4 | `verifyOtp` 是否使用 `type: "recovery"` | 确认不是 `type: "email"` |
| F5 | `verifyOtp` 是否没有 `any` 绕过 | 确认 `EmailOtpType` 类型正确 |
| F6 | `updateUser` 后是否调 `signOut()` | 确认 recovery session 被清除 |
| F7 | 成功状态是否显示 "密码已重置，请用新密码登录。" | 确认文案正确 |
| F8 | 成功状态是否有 "返回登录" 按钮 | 确认指向 `/login` |
| F9 | `/reset-password` 是否保留现有 hash 解析逻辑 | 确认 `setSession` + `updateUser` + `signOut` 未删除 |
| F10 | `/reset-password` 兼容提示链接是否指向 `/forgot-password` | 确认不是 `$/forgot-password` |

### 8.3 安全检查

| # | 检查项 | 说明 |
|---|--------|------|
| S1 | 未注册邮箱是否不暴露 | 确认 `sendResetPasswordOtp` 所有错误（除 rate limit/captcha）静默处理 |
| S2 | 验证码错误是否不暴露原始 Supabase 消息 | 确认使用 `getSafeAuthErrorMessage(error, "reset_password")` |
| S3 | 密码更新失败是否不暴露原始 Supabase 消息 | 同上 |
| S4 | `logAuthError` 是否不打印验证码 | 确认 token 不被传入 `logAuthError` |
| S5 | `logAuthError` 是否不打印新密码 | 确认 password 被 `redactSensitiveText` 处理 |
| S6 | `logAuthError` 是否不打印 captchaToken | 确认 captchaToken 被 `redactSensitiveText` 处理 |
| S7 | Console 是否不打印 access_token / refresh_token | 确认 `redactSensitiveText` 覆盖 |
| S8 | 是否没有使用 localStorage / sessionStorage | 确认所有状态在组件 state 中 |
| S9 | Turnstile 是否正确保护发送和重发 | 确认 `turnstileToken` 传入 `sendResetPasswordOtp` |

### 8.4 门禁

```bash
npm run lint     # 零 error
npm run build    # Compiled successfully
git status --short   # 仅 5 个 V2.3D 允许文件 + 本执行方案文档
```

---

## 九、验收标准

### 9.1 功能验收

| # | 验收项 | 操作 | 预期结果 |
|---|--------|------|------|
| **F1** | 已注册邮箱可收到验证码 | `/forgot-password` 输入已注册邮箱 → 点击"发送验证码" | 收到含 6 位验证码的邮件 |
| **F2** | 未注册邮箱不泄露 | `/forgot-password` 输入未注册邮箱 → 点击"发送验证码" | 仍显示统一成功提示，进入 step "reset" |
| **F3** | 错误验证码被拒绝 | 输入错误的 6 位验证码 → 点击"设置新密码" | 显示"验证码错误或已过期，请重新获取。" |
| **F4** | 过期验证码被拒绝 | 使用已过期的验证码 → 点击"设置新密码" | 显示"验证码错误或已过期，请重新获取。" |
| **F5** | 正确验证码 + 新密码设置成功 | 输入正确验证码 + 新密码 + 确认密码 → 点击"设置新密码" | 显示"密码已重置，请用新密码登录。" |
| **F6** | 新密码可登录 | 用新密码在 `/login` 登录 | 成功进入 `/app` |
| **F7** | 旧密码失效 | 用旧密码在 `/login` 登录 | 登录失败（"邮箱或密码错误，请重试。"） |
| **F8** | OTP 登录不受影响 | `/login` OTP Tab → 发送验证码 → 验证 | 登录成功进入 `/app` |
| **F9** | 密码登录不受影响 | `/login` 密码 Tab → 输入正确密码 | 登录成功进入 `/app` |
| **F10** | Turnstile 保护发送验证码 | 打开 Network 面板，发送验证码 | `resetPasswordForEmail` 请求包含 `captchaToken` |
| **F11** | 重新发送验证码可用 | 等待倒计时结束 → 完成 Turnstile → 点击"重新发送验证码" | 收到新验证码，倒计时重置为 60s |
| **F12** | `/reset-password` 旧链接兼容可用 | 使用旧的 Supabase 重置链接访问 `/reset-password` | hash 解析 + setSession + 密码设置正常工作 |
| **F13** | `/reset-password` 兼容提示可见 | 正常访问 `/reset-password`（非旧链接模式） | 顶部显示引导提示 + "前往忘记密码"链接 |
| **F14** | 错误提示不泄露用户存在性 | 各种错误场景（未注册邮箱、错误验证码、密码更新失败） | 均不暴露用户存在性 |
| **F15** | 注册仍可用 | `/login` OTP Tab → 新邮箱 → 验证 | 自动创建账号 + 登录 |

### 9.2 门禁

```bash
npm run lint     # 零 error
npm run build    # Compiled successfully，TypeScript 检查通过
git status --short   # 仅 V2.3D 允许的文件变更，无意外修改
```

### 9.3 回归验收

| # | 验收项 | 预期结果 |
|---|--------|---------|
| R1 | 任务生成 | 不受影响 |
| R2 | 任务勾选 | 不受影响 |
| R3 | 历史记录 | 不受影响 |
| R4 | 统计数据 | 不受影响 |
| R5 | AI 复盘 | 不受影响 |
| R6 | 智能调整 | 不受影响 |
| R7 | OTP 登录 | 不受影响 |
| R8 | 密码登录 | 不受影响 |
| R9 | 设置密码引导 | 不受影响 |
| R10 | 登出 | 不受影响 |

---

## 十、风险与回滚

### 10.1 风险矩阵

| # | 风险 | 概率 | 影响 | 缓解措施 |
|---|------|:--:|:--:|------|
| P0-1 | verifyOtp recovery 类型不支持 | 🟢 已验证 | — | SDK v2.108.2 确认 `EmailOtpType` 包含 `'recovery'` |
| P0-2 | recovery session 不能 updateUser | 🟢 已验证 | — | Supabase 官方文档明确支持 |
| P0-3 | 改坏现有 OTP 登录 | 🟢 极低 | 🔴 高 | `sendOtp` + `verifyOtp(type: "email")` 零修改 |
| P0-4 | 改坏现有密码登录 | 🟢 极低 | 🔴 高 | `signInWithPassword` 零修改 |
| P0-5 | 改坏 Turnstile | 🟢 极低 | 🔴 高 | `TurnstileWidget.tsx` 零修改 |
| P1-1 | 邮件模板配置错误 | 🟡 中 | 🔴 高 | 人工操作后立即测试 |
| P1-2 | 模板先改代码未部署 | 🟡 中 | 🔴 高 | §4.2 明确禁止，严格执行顺序 |
| P1-3 | 验证码邮件延迟/未送达 | 🟡 低 | 🟡 中 | 提供重发按钮 + 检查 SMTP |

### 10.2 回滚方案

#### 场景 A：V2.3D 代码有问题

1. Git revert V2.3D 的 commit
2. 或：Git reset --hard 到 V2.3C 的最后一个 commit
3. Supabase 邮件模板保持链接式（如果还没改）或恢复链接式（如果已改）

#### 场景 B：代码部署成功但模板没改

1. 用户可能收到链接式邮件（与页面验证码流程不一致）
2. **立即修改** Reset Password 模板为 `{{ .Token }}`

#### 场景 C：模板已改但代码未部署（⚠️ 禁止操作）

1. 用户收到验证码但线上页面不会验证验证码
2. **这是禁止操作，必须避免**
3. 如果已发生：立即回滚邮件模板为链接式 `{{ .RedirectTo }}`，或立即部署 V2.3D 代码

#### 场景 D：验证码邮件无法收到

1. 检查阿里云 SMTP 配置
2. 检查 Supabase SMTP Settings
3. 检查 Rate Limit 设置
4. 检查 Turnstile CAPTCHA 配置
5. 临时回滚：Supabase Dashboard Reset Password 模板切回链接式

---

## 十一、不做事项

V2.3D **明确不做**以下内容：

| # | 不做 | 原因 |
|---|------|------|
| 1 | 不做 V2.4 AI 辅助执行 | 属于后续版本 |
| 2 | 不改 `/app` 主页面 | 安全增强不碰主线 |
| 3 | 不改任务系统（生成/保存/历史/统计/复盘/智能调整） | 安全增强不碰任务核心 |
| 4 | 不改数据库 schema | 不需要新表或字段 |
| 5 | 不新增 API Route | 全部使用 Supabase Auth SDK |
| 6 | 不新增 npm 依赖 | 现有依赖完全满足需求 |
| 7 | 不做 UI 大改版 | 全部留在 V3.0 |
| 8 | 不做短信验证码 | Supabase 需额外配置，超出范围 |
| 9 | 不做微信登录 | 属于 V3.0+，全局红线 |
| 10 | 不做 MFA | 超出 MVP 范围 |
| 11 | 不做账号注销 | 暂不考虑 |
| 12 | 不做后台管理 | 超出范围 |
| 13 | 不删除 `/reset-password` 页面 | 兼容保留 |
| 14 | 不修改 `TurnstileWidget.tsx` | V2.3B 产物，足够 |
| 15 | 不修改 `LoginPageContent.tsx` | 登录流程零变更 |
| 16 | 不使用 `mode: "otp" \| "link"` | 简化实现，避免复杂分支 |
| 17 | 不使用 localStorage / sessionStorage | 安全最佳实践，避免 email 客户端持久化 |

---

## 附录 A：文件变更汇总

| 文件 | 操作 | 预估行数 | 关键变更 |
|------|:--:|:--:|------|
| `src/hooks/useAuth.ts` | 修改 | +20 | 新增 `sendResetPasswordOtp`；`sendResetPasswordEmail` 改为 alias 指向 `sendResetPasswordOtp`；return 对象新增导出 |
| `src/lib/constants.ts` | 修改 | +10 | 新增 11 个验证码相关 `AUTH_TEXT` 属性 |
| `src/lib/auth-errors.ts` | 修改 | +10 | 新增 recovery OTP 错误模式；可选修改 fallback message |
| `src/app/forgot-password/page.tsx` | 重构 | ~200 | 双步骤流程：request（发送验证码）+ reset（验证 + 设置密码）+ success |
| `src/app/reset-password/page.tsx` | 微调 | +5 | 顶部新增兼容提示横幅 |
| **合计** | | **~240** | |

---

## 附录 B：verifyOtp recovery 类型确认

```typescript
// @supabase/auth-js (bundled in @supabase/supabase-js@2.108.2)

export type EmailOtpType =
  | 'signup'
  | 'invite'
  | 'magiclink'
  | 'recovery'      // ✅ 原生支持，不需要 any
  | 'email_change'
  | 'email'
  | (string & {});

// 调用方式
const { data, error } = await supabase.auth.verifyOtp({
  email: "user@example.com",
  token: "123456",
  type: "recovery",  // ✅ 完全类型安全
});
```

---

> **文档结束**
>
> **下一文档**：本文档经 ChatGPT 审查通过后 → Codex 按执行方案实现
>
> **关联文档**：
> - [Architecture-V2.3D-Reset-Password-OTP.md](Architecture-V2.3D-Reset-Password-OTP.md) — V2.3D 架构方案（✅ 已完成）
> - [Architecture-V2.3-Security.md](Architecture-V2.3-Security.md) — V2.3 安全增强架构方案（✅ 已完成）
> - [Execution-Plan-V2.3-Security.md](Execution-Plan-V2.3-Security.md) — V2.3A/B/C 执行方案（✅ 已完成）
> - [PROJECT-CONTEXT.md](PROJECT-CONTEXT.md) — 项目长期上下文
> - [PROJECT-INDEX.md](PROJECT-INDEX.md) — 项目文件索引
