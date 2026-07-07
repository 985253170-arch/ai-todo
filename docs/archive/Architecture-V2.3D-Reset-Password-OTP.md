# V2.3D：重置密码验证码流程 架构方案

> **状态**：架构设计阶段，**不写代码，待 ChatGPT 审查通过后交给 Codex 实现**
> **依赖**：[Architecture-V2.3-Security.md](Architecture-V2.3-Security.md) ✅ · V2.3A ✅ · V2.3B ✅ · V2.3C ✅
> **定位**：安全增强修补——将链接式重置密码改为中国用户更熟悉的验证码式重置密码
> **上一文档**：[Execution-Plan-V2.3-Security.md](Execution-Plan-V2.3-Security.md)（V2.3A/B/C 执行方案）
> **下一文档**：`docs/Execution-Plan-V2.3D-Reset-Password-OTP.md`（V2.3D 执行方案，待架构审查通过后编写）
> **设计日期**：2026-07-06

---

## 目录

- [一、背景与产品判断](#一背景与产品判断)
- [二、新旧流程对比](#二新旧流程对比)
- [三、SDK 技术可行性验证](#三sdk-技术可行性验证)
- [四、页面架构](#四页面架构)
- [五、Hook 架构](#五hook-架构)
- [六、Supabase 邮件模板变更](#六supabase-邮件模板变更)
- [七、Turnstile 影响](#七turnstile-影响)
- [八、错误脱敏影响](#八错误脱敏影响)
- [九、安全边界](#九安全边界)
- [十、文件影响范围](#十文件影响范围)
- [十一、兼容策略](#十一兼容策略)
- [十二、验收标准](#十二验收标准)
- [十三、风险矩阵](#十三风险矩阵)
- [十四、不做事项](#十四不做事项)
- [十五、Codex 实现阶段建议拆分](#十五codex-实现阶段建议拆分)

---

## 一、背景与产品判断

### 1.1 当前状态

V2.3A 实现的密码重置流程是 **Supabase 标准链接式**：

```
/forgot-password → resetPasswordForEmail(email, { redirectTo })
  → 邮件含重置链接（含 token_hash + type=recovery）
  → 用户点击链接 → /reset-password 解析 URL hash
  → setSession → updateUser({ password }) → signOut()
```

### 1.2 为什么改成验证码式

| 维度 | 链接式（当前） | 验证码式（目标） |
|------|:--:|:--:|
| **中国用户习惯** | 不熟悉"点击邮件链接重置密码" | 熟悉"输入验证码 → 设置新密码"（类似微信/支付宝验证码流程） |
| **邮件客户端兼容** | 部分国产邮件 App 可能拦截/截断链接 | 验证码纯文本，无兼容问题 |
| **安全扫描误触发** | 邮件中的链接可能被企业安全网关/反病毒软件预加载，导致 token 提前消耗 | 验证码不会自动触发 |
| **移动端体验** | 链接跳转浏览器 → 可能丢失 App 上下文 | 用户手动输入验证码，始终在同一页面 |
| **实现复杂度** | hash 解析 + setSession + 临时 recovery session | verifyOtp({ type: "recovery" }) → 同页面完成 |

### 1.3 产品判断结论

| # | 判断项 | 结论 |
|---|--------|------|
| 1 | 为什么改 | 中国用户对"验证码重置"的认知成本远低于"邮件链接重置" |
| 2 | 用户体验收益 | 单页面完成（不跳转）、验证码纯文本（不依赖链接）、与 OTP 登录体验一致 |
| 3 | 安全影响 | 验证码为 6 位数字，暴力破解面小（Supabase rate limit + Turnstile 双层保护）；验证码有过期时间；与链接式相比，避免了链接预加载导致 token 提前消耗的风险 |
| 4 | 对 V2.3A/B/C 影响 | V2.3A forgot-password 页面需重构为双步骤；V2.3B Turnstile 继续有效；V2.3C 错误脱敏需扩展 |
| 5 | 是否保留 /reset-password | **保留作为兼容入口**（见 §十一） |
| 6 | 链接 vs 验证码策略 | **验证码优先，链接兼容**。主流程改为验证码，/reset-password 作为旧链接/异常 fallback |

---

## 二、新旧流程对比

### 2.1 旧流程（V2.3A 链接式）

```
┌─────────────────────────────────────────────────────────┐
│ /login                                                   │
│   点击"忘记密码？"                                         │
│     ↓                                                    │
│ /forgot-password                                         │
│   输入邮箱 → Turnstile → 提交                              │
│     ↓                                                    │
│ resetPasswordForEmail(email, {                            │
│   redirectTo: "/reset-password",                         │
│   captchaToken                                           │
│ })                                                       │
│     ↓                                                    │
│ 邮件：点击"重置密码"按钮（含 token_hash 链接）              │
│     ↓                                                    │
│ /reset-password#access_token=...&refresh_token=...        │
│   解析 hash → setSession → 输入新密码 + 确认密码           │
│     ↓                                                    │
│ updateUser({ password }) → signOut() → 跳转 /login        │
└─────────────────────────────────────────────────────────┘
```

**问题**：
1. 用户必须离开当前页面（点击邮件链接 → 浏览器新 Tab）
2. 依赖 URL hash 解析（边缘情况：hash 被截断、浏览器不支持）
3. 链接可能被邮件安全扫描预加载（token 提前消耗）
4. 与 OTP 登录的 6 位验证码体验不一致

### 2.2 新流程（V2.3D 验证码式）

```
┌─────────────────────────────────────────────────────────┐
│ /login                                                   │
│   点击"忘记密码？"                                         │
│     ↓                                                    │
│ /forgot-password  [step = "request"]                     │
│   输入邮箱 → Turnstile → 点击"发送验证码"                   │
│     ↓                                                    │
│ resetPasswordForEmail(email, { captchaToken })            │
│   （不传 redirectTo，由邮件模板展示 {{ .Token }}）          │
│     ↓                                                    │
│ 邮件：展示 6 位验证码 + "请在页面中输入此验证码"             │
│     ↓                                                    │
│ /forgot-password  [step = "reset"]                       │
│   输入 6 位验证码 + 新密码 + 确认密码                       │
│     ↓                                                    │
│ verifyOtp({ email, token, type: "recovery" })             │
│     ↓ （成功后获得 recovery session）                      │
│ updateUser({ password: newPassword })                     │
│     ↓                                                    │
│ signOut() → 显示"密码已重置" → 返回 /login                  │
└─────────────────────────────────────────────────────────┘
```

**优势**：
1. 用户始终在同一页面，不需要跳转
2. 不依赖 URL hash
3. 验证码不会被邮件安全扫描预加载
4. 与 OTP 登录体验一致（用户已熟悉 6 位验证码输入）

---

## 三、SDK 技术可行性验证

### 3.1 实测环境

```
@supabase/supabase-js: 2.108.2
@supabase/ssr: 0.12.0
@supabase/auth-js: (bundled, 2.x 对应)
```

### 3.2 关键类型验证

#### ① EmailOtpType 包含 "recovery"

```typescript
// node_modules/@supabase/auth-js/dist/main/lib/types.d.ts:693
export type EmailOtpType =
  | 'signup'
  | 'invite'
  | 'magiclink'
  | 'recovery'      // ✅ 明确支持
  | 'email_change'
  | 'email'
  | (string & {});  // 未来扩展
```

**结论：`verifyOtp({ email, token, type: "recovery" })` 完全类型安全，不需要 `any`。**

#### ② resetPasswordForEmail 支持 captchaToken

```typescript
// GoTrueClient.d.ts:2105
resetPasswordForEmail(email: string, options?: {
  redirectTo?: string;
  captchaToken?: string;  // ✅ 支持
}): Promise<{ data: {}; error: null } | { data: null; error: AuthError }>;
```

**结论：`resetPasswordForEmail(email, { captchaToken })` 不传 `redirectTo` 完全合法。不传 `redirectTo` 时，`{{ .RedirectTo }}` 默认使用 Supabase Site URL；但我们改用 `{{ .Token }}`，所以不影响。**

#### ③ verifyOtp recovery → session → updateUser 链路

```typescript
verifyOtp(params: VerifyOtpParams): Promise<AuthResponse>;
// AuthResponse = { data: { user: User; session: Session | null }; error: null }
//               | { data: { user: null; session: null }; error: AuthError }
```

官方文档注释（GoTrueClient.d.ts:1092-1101）明确指出：
> `type: "recovery"` — Used when verifying an OTP sent for account recovery, typically after a password reset request.

**结论：verifyOtp recovery 成功后返回 user + session，可继续调用 `updateUser({ password })`。**

### 3.3 技术可行性总评

| 检查项 | 结果 |
|--------|:--:|
| verifyOtp type: "recovery" 类型支持 | ✅ 完全支持 |
| resetPasswordForEmail captchaToken | ✅ 完全支持 |
| 不传 redirectTo 的合法性 | ✅ 合法，redirectTo 是可选的 |
| recovery session → updateUser | ✅ 标准链路 |
| 不需要 any 绕过 | ✅ 完全类型安全 |
| 不新增依赖 | ✅ 不需要 |

**🟢 无技术阻塞。V2.3D 在当前 SDK 版本下完全可行。**

---

## 四、页面架构

### 4.1 核心设计

**`/forgot-password` 承载完整双步骤流程。`/reset-password` 降级为兼容入口。**

### 4.2 /forgot-password 双步骤设计

#### Step 1: `step = "request"` — 发送验证码

```
┌──────────────────────────────────────┐
│          ← 返回登录                   │
│                                      │
│        忘记密码                        │
│  输入你的注册邮箱，我们会发送验证码。     │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ you@example.com              │    │
│  └──────────────────────────────┘    │
│                                      │
│  [ 我是人类 ] ← Turnstile Widget     │
│                                      │
│  ┌──────────────────────────────┐    │
│  │       发送验证码               │    │
│  └──────────────────────────────┘    │
│                                      │
│           返回登录                    │
└──────────────────────────────────────┘
```

**状态**：
- `email`: string（用户输入的邮箱）
- `turnstileToken`: string | null
- `isSubmitting`: boolean
- `errorMessage`: string | null
- `message`: string | null

**行为**：
- 点击"发送验证码" → `resetPasswordForEmail(email, { captchaToken })`
- 成功 → `setStep("reset")` + 显示"验证码已发送"（message 或短暂 toast）
- 失败 → `getSafeAuthErrorMessage(error, "forgot_password")` 处理（见 §八）

#### Step 2: `step = "reset"` — 验证 + 设置新密码

```
┌──────────────────────────────────────┐
│          ← 返回上一步                  │
│                                      │
│        设置新密码                       │
│  验证码已发送至 y***@example.com        │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  输入 6 位验证码               │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  新密码（至少 6 位）     [👁]  │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  确认密码                     │    │
│  └──────────────────────────────┘    │
│                                      │
│  [ 重新发送验证码 (60s) ]             │
│                                      │
│  ┌──────────────────────────────┐    │
│  │       设置新密码               │    │
│  └──────────────────────────────┘    │
│                                      │
│  成功提示（绿色）                       │
│  "密码已重置，请用新密码登录。"          │
│  [ 返回登录 ]                         │
└──────────────────────────────────────┘
```

**状态**：
- `email`: string（从 step 1 保留）
- `token`: string（6 位验证码）
- `newPassword`: string
- `confirmPassword`: string
- `isSubmitting`: boolean
- `errorMessage`: string | null
- `message`: string | null
- `isSuccess`: boolean
- `resendSeconds`: number
- `isPasswordVisible`: boolean

**行为**：
- 输入 6 位验证码（auto-submit 可选，但不强制）
- 点击"设置新密码" → 前端校验密码一致 → `verifyResetPasswordOtpAndSetPassword()` → `signOut()` → `setIsSuccess(true)`
- 验证码错误 → `getSafeAuthErrorMessage(error, "reset_password")`
- 点击"重新发送" → 调 `sendResetPasswordEmail` + 倒计时 60s

#### Step 3: `step = "success"`（可选，也可以复用 isSuccess 状态）

简化为在 step="reset" 内部通过 `isSuccess` 标志展示成功态。不新增第三个 step 值。

### 4.3 /reset-password 降级为兼容入口

**保留 `/reset-password` 页面，职责缩小为：**

1. 处理旧邮件链接（V2.3A 发出的，含有 `#access_token=...&type=recovery`）
2. 处理异常场景（验证码方式失败后的 fallback）
3. 提供明确提示："推荐使用验证码方式重置密码" + 链接到 `/forgot-password`
4. 如果 hash 解析成功，仍然可以完成重置流程（不删除现有逻辑）

**不新增逻辑，只做文案调整。** 例如顶部加一句提示：
> "我们已支持更便捷的验证码重置方式，[点击这里]($/forgot-password) 使用验证码重置。"

### 4.4 页面路由总览

| 路由 | V2.3A 职责 | V2.3D 职责 | 变更 |
|------|-----------|-----------|:--:|
| `/forgot-password` | 发送重置邮件（链接式） | **双步骤验证码流程**（主入口） | 🔄 重构 |
| `/reset-password` | hash 解析 + setSession + 设置新密码 | **兼容旧链接 + fallback**（保留） | 🔧 文案微调 |
| `/login` | 登录入口 | 不变 | ✅ 不变 |

---

## 五、Hook 架构

### 5.1 推荐方案：扩展 useAuth

**放在 useAuth 中，保持 Auth 逻辑集中。**

#### 新增方法

```typescript
// useAuth.ts 新增

// 方法 1：发送重置密码验证码（替代旧 sendResetPasswordEmail）
async function sendResetPasswordOtp(
  email: string,
  captchaToken?: string,
): Promise<void>
```

- 内部调用 `supabase.auth.resetPasswordForEmail(email, { captchaToken })`
- **不传 `redirectTo`**（邮件模板改用 `{{ .Token }}` 展示验证码）
- 错误处理：rate limit → throw → UI 展示；其余错误 → 静默 return（不泄露用户存在性）
- 旧方法 `sendResetPasswordEmail` 保留，改由新方法调用

#### 调整现有方法

```typescript
// useAuth.ts 修改

// 旧方法签名（V2.3A）
async function sendResetPasswordEmail(
  email: string,
  captchaToken?: string,
): Promise<void>

// V2.3D 改为：
async function sendResetPasswordEmail(
  email: string,
  captchaToken?: string,
): Promise<void>
// 内部行为不变，但 redirectTo 不再必需：
// - 验证码模式（默认）：不传 redirectTo
// - 链接模式（兼容）：传 redirectTo: `${origin}/reset-password`
//
// 具体：通过参数控制模式，默认不传 redirectTo
```

#### 是否新增 `verifyResetPasswordOtpAndSetPassword`

**推荐不新增。** 原因：
1. 该方法组合了 3 个 Supabase 调用（verifyOtp + updateUser + signOut），如果放在 useAuth 中会增加 hook 复杂度
2. 页面直接调用 Supabase browser client 更灵活
3. 页面需要细粒度控制（如分别处理 verifyOtp 错误 vs updateUser 错误）

**替代方案：在 forgot-password 页面中直接组合调用。**

```typescript
// forgot-password/page.tsx 中
async function handleResetPassword(email: string, token: string, newPassword: string) {
  const supabase = createSupabaseBrowserClient();
  if (!supabase) throw new Error("AUTH_NOT_CONFIGURED");

  // Step 1: 验证 recovery OTP
  const { data, error: verifyError } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "recovery",
  });

  if (verifyError) throw verifyError;
  // data.session 已建立

  // Step 2: 设置新密码
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) throw updateError;

  // Step 3: 清除 session
  await supabase.auth.signOut();
}
```

### 5.2 取舍总结

| 方案 | 优点 | 缺点 | 推荐 |
|------|------|------|:--:|
| 放 useAuth | Auth 逻辑集中 | hook 更复杂，组合调用粒度粗 | ❌ |
| 放页面 | 改动少，细粒度控制 | Auth 流程分散在两个地方 | ✅ |

---

## 六、Supabase 邮件模板变更

### 6.1 Reset Password 邮件模板

**需要从"链接式"改为"验证码式"。**

#### 新模板设计

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

### 6.2 关键变更点

| 项目 | 旧模板（V2.3A） | 新模板（V2.3D） |
|------|----------------|----------------|
| 核心变量 | `{{ .RedirectTo }}` 链接按钮 | `{{ .Token }}` 验证码 |
| 用户操作 | 点击链接跳转 | 手动输入验证码 |
| 过期说明 | "24 小时内有效" | "1 小时内有效"（验证码比链接更短效） |
| 安全提醒 | 无 | "请勿将验证码泄露给他人" |

### 6.3 不修改的模板

| 模板 | 状态 |
|------|:--:|
| **Confirm Signup**（注册确认） | ✅ 不变 — 使用 `{{ .RedirectTo }}` + `token_hash` |
| **Magic Link / OTP Login**（验证码登录） | ✅ 不变 — 使用 `{{ .Token }}` |

### 6.4 注意事项

- ⚠️ 不要在聊天和代码中贴真实 `{{ .Token }}` 值
- ⚠️ 不要贴 Supabase Secret Key / Service Role Key
- ⚠️ 不要修改 Confirm Signup 邮件模板（它继续使用链接流程）
- ⚠️ 不要修改 OTP 登录邮件模板（它使用 `{{ .Token }}`，与我们的新模板一致）

---

## 七、Turnstile 影响

### 7.1 V2.3B 继续有效

| 场景 | Turnstile 行为 | 说明 |
|------|---------------|------|
| 发送重置验证码 | **需要** Turnstile | `resetPasswordForEmail(email, { captchaToken })` 携带 token |
| 验证验证码 + 设置新密码 | **不需要** Turnstile | 验证 recovery OTP 本身已有安全保证 |
| 重新发送验证码 | **需要重新获取** Turnstile token | Turnstile token 一次性有效，重发需刷新 widget |
| 已过期的 Turnstile token | widget 自动回调 `expired-callback` → `onTokenChange(null)` | UI 不崩溃，但需重新完成验证 |

### 7.2 实现建议

- 发送验证码按钮在 `turnstileToken === null` 时 **不禁用**，但提交时校验
- 如果 `captchaToken` 为空，Supabase Required CAPTCHA 会返回错误 → 由 `getSafeAuthErrorMessage(error, "forgot_password")` 展示提示
- "重新发送验证码" 点击后，如果 Turnstile token 已过期，引导用户重新完成 Turnstile

---

## 八、错误脱敏影响

### 8.1 V2.3C 继续有效

| 操作 | V2.3D 使用 | 说明 |
|------|-----------|------|
| `resetPasswordForEmail` → 发送验证码 | `"forgot_password"` | 复用现有逻辑：未注册邮箱静默成功 |
| `verifyOtp({ type: "recovery" })` → 验证码错误 | `"reset_password"` | 扩展以覆盖 recovery 特有的错误模式 |
| `updateUser({ password })` → 密码设置失败 | `"reset_password"` | 新增对 weak password 等错误的处理 |

### 8.2 需要扩展的 `auth-errors.ts`

#### 新增错误模式

`verifyOtp` recovery 可能返回的错误消息：

| Supabase 错误 | 当前匹配 | 建议处理 |
|---------------|---------|---------|
| `token has expired or is invalid` | patterns: `["token", "otp", "expired"]` ✅ | `RESET_PASSWORD_TOKEN_EXPIRED` = "重置链接已过期，请重新申请。" |
| `invalid otp` / `invalid token` | patterns: `["token", "otp", "expired"]` ✅ | 同上 |
| `Email rate limit exceeded` | patterns: `["rate limit"]` ✅ | `EMAIL_RATE_LIMITED` |

**结论：当前 7 种错误模式已覆盖 recovery OTP 场景。** 唯一需要确认的是：

#### 可能需要新增的文案

| Key | 值 | 用途 |
|-----|-----|------|
| `RESET_PASSWORD_OTP_INVALID` | "验证码错误或已过期，请重新获取。" | 验证码错误时的专门提示 |
| `RESET_PASSWORD_OTP_RESEND` | "验证码已重新发送。" | 重发成功后的提示 |

**建议**：如果 `RESET_PASSWORD_TOKEN_EXPIRED` 对验证码场景语义不够精确，新增专用文案。否则可复用。

### 8.3 不新增 AuthOperation

保持现有 4 种：
- `"otp"` — OTP 登录
- `"password"` — 密码登录
- `"forgot_password"` — 发送重置验证码（安全关键：不泄露用户存在性）
- `"reset_password"` — 验证 recovery OTP + 设置新密码

**不需要新增 `"reset_password_otp"`。** `"reset_password"` 已覆盖验证码错误和 set password 错误。

---

## 九、安全边界

| # | 原则 | V2.3D 遵守 |
|---|------|:--:|
| 1 | 不新增自建验证码表 | ✅ 使用 Supabase 原生 recovery OTP |
| 2 | 不新增 API Route | ✅ 纯前端页面 + Supabase Auth SDK |
| 3 | 不在前端保存长期 token | ✅ verifyOtp 返回的 session 仅在内存中，signOut 后清除 |
| 4 | 不把 access_token / refresh_token 打到 console | ✅ logAuthError 已脱敏 |
| 5 | 不打印用户输入的验证码 | ✅ token 不在 logAuthError 范围内；token 输入框 value 不受 logAuthError 影响 |
| 6 | 不打印新密码 | ✅ password 被 redactSensitiveText 处理 |
| 7 | 不打印 captchaToken | ✅ captchaToken 被 redactSensitiveText 处理 |
| 8 | 不绕过 Supabase Auth | ✅ 全部使用 Supabase Auth 原生方法 |
| 9 | 不使用 service_role | ✅ 全流程使用 anon key（browser client） |
| 10 | 不把 Secret Key 写入代码 | ✅ TURNSTILE_SECRET_KEY 仅存在于 Supabase Dashboard |

---

## 十、文件影响范围

### 10.1 预计需要修改

| 文件 | 变更类型 | 预估改动量 | 说明 |
|------|:--:|:--:|------|
| `src/app/forgot-password/page.tsx` | 🔄 重构 | ~200 行 | 双步骤流程（request + reset） |
| `src/hooks/useAuth.ts` | 🔧 修改 | ~10 行 | `sendResetPasswordEmail` 不再传 `redirectTo` |
| `src/app/reset-password/page.tsx` | 🔧 微调 | ~5 行 | 顶部加提示，引导用户使用验证码方式 |
| `src/lib/auth-errors.ts` | 🔧 微调 | ~5 行 | 可选：新增 recovery OTP 专用文案 |
| `src/lib/constants.ts` | 🔧 微调 | ~5 行 | 可选：新增 `RESET_PASSWORD_OTP_INVALID` 等文案 |

### 10.2 预计不应修改

| 文件 | 原因 |
|------|------|
| `src/components/TurnstileWidget.tsx` | V2.3B 产物，零修改 |
| `src/components/LoginPageContent.tsx` | 登录流程不变，"忘记密码"入口文字 `FORGOT_PASSWORD_LINK` 不变 |
| `src/components/Header.tsx` | 不变 |
| `src/components/AuthModal.tsx` | 不变 |
| `src/components/SetPasswordPrompt.tsx` | 不变 |
| `src/app/login/page.tsx` | 不变 |
| `src/app/app/page.tsx` | 不变 |
| `src/app/auth/callback/route.ts` | 不变 |
| `src/app/api/**`（全部 8 个 Route） | 不变 |
| `src/lib/supabase-client.ts` | 不变 |
| `src/lib/supabase-server.ts` | 不变 |
| `src/lib/types.ts` | 不变 |
| `src/lib/ai-client.ts` | 不变 |
| `src/lib/task-parser.ts` | 不变 |
| `src/lib/review-parser.ts` | 不变 |
| `src/lib/stats-calculator.ts` | 不变 |
| `src/lib/adjust-task-strategy.ts` | 不变 |
| `src/lib/device-id.ts` | 不变 |
| `src/prompts/*` | 不变 |
| `src/hooks/useTaskGroup.ts` | 不变 |
| `src/hooks/useTaskStats.ts` | 不变 |
| `src/hooks/useTaskHistory.ts` | 不变 |
| `src/hooks/useTaskReview.ts` | 不变 |
| `package.json` / `package-lock.json` | 不变 |
| `next.config.ts` | 不变 |
| `.env.local` / `.env.example` | 不变 |
| 数据库 schema / migration | 不变 |
| 所有现有文档 | 不变（本架构文档为新增） |

---

## 十一、兼容策略

### 11.1 旧 /reset-password 链接流程是否保留

**保留。** 降级为兼容入口：

1. 旧邮件链接（V2.3A 发出的）仍然有效
2. `/reset-password` 处理 hash 解析 + setSession + updateUser 的代码完整保留
3. 顶部新增提示："推荐使用验证码方式重置密码" + 链接到 `/forgot-password`

### 11.2 如果用户点击旧邮件链接

- 跳转 `/reset-password#access_token=...`
- 解析 hash → setSession → 展示密码设置表单（现有逻辑，不变）
- 重置成功 → signOut → 返回 `/login`
- **完全兼容，不破坏。**

### 11.3 如果验证码邮件延迟

- 用户等待后仍未收到 → 点击"重新发送验证码"
- 倒计时结束后按钮恢复可点击
- 重发需重新完成 Turnstile（如果 token 已过期）

### 11.4 如果验证码过期

- `verifyOtp` 返回错误 → `getSafeAuthErrorMessage(error, "reset_password")` → 展示"验证码错误或已过期，请重新获取。"
- 用户可以点击"重新发送"

### 11.5 如果用户刷新页面

- email 和 step 状态存储在组件 state 中
- 刷新后 step 回到 `"request"`，用户需重新输入邮箱和 Turnstile
- **不使用 localStorage / sessionStorage**（简化实现，避免 email 在客户端持久化）

### 11.6 是否需要 localStorage / sessionStorage

**不需要。** 原因：
1. 安全考虑：email 在客户端持久化增加攻击面
2. 简化实现：组件 state 已足够
3. 刷新页面后重新输入邮箱是合理的用户体验（类似大多数 App）

### 11.7 是否需要倒计时

**轻量版倒计时。** 使用 `useEffect` + `setTimeout`（与现有 OTP 登录倒计时一致）。

```typescript
// 复用 LoginPageContent 中的倒计时模式
useEffect(() => {
  if (resendSeconds <= 0) return;
  const timer = setTimeout(() => setResendSeconds(s => Math.max(0, s - 1)), 1000);
  return () => clearTimeout(timer);
}, [resendSeconds]);
```

### 11.8 是否需要限制重复点击

- 发送验证码按钮：`disabled={isSubmitting}` — 提交中禁用
- "设置新密码"按钮：`disabled={isSubmitting}` — 提交中禁用
- "重新发送"按钮：`disabled={isSubmitting || resendSeconds > 0}` — 提交中 + 倒计时中禁用

---

## 十二、验收标准

### F1-F13 功能验收

| # | 验收项 | 预期结果 |
|---|--------|---------|
| **F1** | 输入已注册邮箱 → 发送验证码 | 收到 6 位验证码邮件，邮件展示 `{{ .Token }}` 纯文本 |
| **F2** | 输入未注册邮箱 → 发送验证码 | 仍显示统一成功提示，不暴露"用户不存在" |
| **F3** | 输入错误验证码 → 提交 | 显示"验证码错误或已过期，请重新获取。" |
| **F4** | 输入过期验证码 → 提交 | 显示"验证码错误或已过期，请重新获取。" |
| **F5** | 输入正确验证码 + 新密码 → 提交 | 密码更新成功，显示"密码已重置，请用新密码登录。" |
| **F6** | 用新密码登录 | 成功进入 `/app` |
| **F7** | 用旧密码登录 | 失败，提示"邮箱或密码错误，请重试。" |
| **F8** | OTP 登录 (sendOtp + verifyOtp) | 不受影响，正常登录 |
| **F9** | 密码登录 (signInWithPassword) | 不受影响，正常登录 |
| **F10** | Turnstile 保护发送重置验证码 | 发往 Supabase 的 `resetPasswordForEmail` 请求包含 `captchaToken` |
| **F11** | 错误提示不泄露用户存在性 | 未注册邮箱 + 错误验证码 + 密码更新失败 均不泄露 |
| **F12** | 旧链接兼容 | `/reset-password` 仍可处理旧邮件链接，顶部有引导 |
| **F13** | lint + build | 零 error 通过 |

### 回归验收

| # | 验收项 | 预期结果 |
|---|--------|---------|
| **R1** | 任务生成 | 不受影响 |
| **R2** | 任务勾选 | 不受影响 |
| **R3** | 历史记录 | 不受影响 |
| **R4** | 统计数据 | 不受影响 |
| **R5** | AI 复盘 | 不受影响 |
| **R6** | 智能调整 | 不受影响 |

---

## 十三、风险矩阵

### P0（阻塞 — 必须解决才能实现）

| # | 风险 | 可能性 | 影响 | 缓解措施 |
|---|------|:--:|:--:|------|
| **P0-1** | verifyOtp recovery 类型当前 SDK 不支持 | 🟢 已验证，完全支持 | — | SDK v2.108.2 已确认 `EmailOtpType` 包含 `'recovery'` |
| **P0-2** | recovery OTP 成功后不能 updateUser | 🟢 已验证，标准链路 | — | Supabase 文档明确：recovery verifyOtp 建立 session → updateUser 修改密码 |
| **P0-3** | 改坏现有 OTP 登录 | 🟡 低 | 🔴 高 | useAuth 中 `sendOtp` + `verifyOtp(type: "email")` 不变；仅在 forgot-password 页面中使用 `type: "recovery"` |
| **P0-4** | 改坏密码登录 | 🟡 低 | 🔴 高 | `signInWithPassword` 零修改 |
| **P0-5** | 改坏 Turnstile | 🟡 低 | 🔴 高 | TurnstileWidget 组件零修改；captchaToken 传递维持现有模式 |
| **P0-6** | 忘记密码泄露用户是否存在 | 🟢 已验证，V2.3C 已处理 | — | `forgot_password` operation 错误全部静默为 `FORGOT_PASSWORD_SUCCESS` |
| **P0-7** | resetPasswordForEmail 不传 redirectTo 是否影响邮件发送 | 🟡 极低 | 🟡 中 | `redirectTo` 是可选参数；不传时 `{{ .RedirectTo }}` 使用默认 Site URL，但我们改用 `{{ .Token }}`，不依赖 RedirectTo |

### P1（必须修复 — 影响功能或安全）

| # | 风险 | 可能性 | 影响 | 缓解措施 |
|---|------|:--:|:--:|------|
| **P1-1** | 邮件模板配置错误导致验证码不显示 | 🟡 中 | 🔴 高 | Supabase Dashboard 修改后立即测试发送 |
| **P1-2** | 重置成功后未 signOut | 🟡 低 | 🟡 中 | 在 forgot-password 页面 handleReset 中显式调用 `signOut()` |
| **P1-3** | token / password / captchaToken 被 console 打印 | 🟢 极低，V2.3C logAuthError 已脱敏 | — | 继续使用 `logAuthError` + `redactSensitiveText` |
| **P1-4** | 旧 reset-password 链接失效且无提示 | 🟡 低（逻辑不变） | 🟡 中 | /reset-password 现有 hash 解析逻辑完整保留 |
| **P1-5** | verifyOtp recovery 在 `"Allow unconfirmed email sign in" = OFF` 场景下的行为 | 🟡 低 | 🟡 中 | 需人工验证：未确认邮箱的用户能否通过 recovery OTP 重置密码 |

### P2（建议修复 — 不影响功能）

| # | 风险 | 缓解措施 |
|---|------|---------|
| **P2-1** | 重发验证码没有倒计时 | 实现复用 `LoginPageContent` 的 `resendSeconds` + `useEffect` 模式 |
| **P2-2** | 邮件文案不够清晰 | 按 §六 模板配置，重点是验证码展示突出 |
| **P2-3** | 刷新页面后需重新输入邮箱 | 设计决定：不使用 localStorage，符合安全最佳实践 |
| **P2-4** | 文件尾部空白行 | lint 自动修复 |
| **P2-5** | /reset-password 和 /forgot-password 两套重置逻辑并存，维护成本 | 代码注释标注 /reset-password 为 "Legacy compatibility"，主逻辑在 /forgot-password |

---

## 十四、不做事项

| # | 不做项 | 原因 |
|---|--------|------|
| 1 | 不做 V2.4 AI 辅助执行 | 属于后续版本 |
| 2 | 不改 `/app` 主页面 | 安全增强不碰主线 |
| 3 | 不改任务系统 | 同上 |
| 4 | 不改数据库 | 不需要新表或字段 |
| 5 | 不新增 API Route | 全部使用 Supabase Auth SDK |
| 6 | 不新增第三方依赖 | Turnstile 已有 |
| 7 | 不做 UI 大改版 | 属于 V3.0 |
| 8 | 不做短信验证码 | Supabase 需额外配置，超出范围 |
| 9 | 不做微信登录 | 属于 V3.0+ |
| 10 | 不做多因素认证 MFA | 超出 MVP 范围 |
| 11 | 不做账号注销 | 暂不考虑 |
| 12 | 不做后台管理 | 超出范围 |
| 13 | 不删除 `/reset-password` 页面 | 兼容保留 |

---

## 十五、Codex 实现阶段建议拆分

### V2.3D-1：文档与模板准备（Claude Code / ChatGPT / 人工）

1. ✅ 本架构文档（Claude Code → ChatGPT 审查）
2. ⬜ 执行方案（Claude Code → ChatGPT 审查 → Codex 执行依据）
3. ⬜ Supabase Dashboard Reset Password 邮件模板更新（人工操作）

### V2.3D-2：代码实现（Codex）

| 步骤 | 文件 | 操作 | 预估行数 |
|:--:|------|:--:|:--:|
| 1 | `src/lib/constants.ts` | 可选：新增 `RESET_PASSWORD_OTP_INVALID` 等文案 | +5 |
| 2 | `src/lib/auth-errors.ts` | 可选：微调 `reset_password` 操作的消息 | +5 |
| 3 | `src/hooks/useAuth.ts` | `sendResetPasswordEmail` 不再传 `redirectTo` | ±5 |
| 4 | `src/app/forgot-password/page.tsx` | 🔄 重构：双步骤流程 | ~200 |
| 5 | `src/app/reset-password/page.tsx` | 顶部新增兼容提示 | +5 |

**预计总改动量**：~220 行（含新 forgot-password 页面）

### V2.3D-Review：代码审查 + 验收（Claude Code → ChatGPT）

1. Claude Code Review（范围检查 + 安全检查 + 功能检查）
2. ChatGPT 最终把关
3. 浏览器端 F1-F13 实测
4. 通过后提交

---

## 附录 A：与 V2.3A 的关键差异对照

| 维度 | V2.3A（链接式） | V2.3D（验证码式） |
|------|----------------|-------------------|
| 邮件模板核心变量 | `{{ .RedirectTo }}` | `{{ .Token }}` |
| 用户操作 | 点击邮件链接 | 手动输入 6 位验证码 |
| 页面数 | 2 个（forgot-password + reset-password） | 1 个（forgot-password，双步骤） |
| Supabase 方法链 | resetPasswordForEmail → (点击链接) → setSession → updateUser | resetPasswordForEmail → verifyOtp(type:recovery) → updateUser |
| Turnstile 次数 | 1 次（发送邮件） | 1-2 次（发送 + 可选重发） |
| reset-password 职责 | 主流程 | 兼容旧链接 + fallback |
| session 管理 | URL hash → setSession | verifyOtp 直接建立 session |

## 附录 B：关键 SDK 类型引用

```typescript
// @supabase/auth-js (bundled in @supabase/supabase-js@2.108.2)

// EmailOtpType 包含 'recovery'（已验证）
export type EmailOtpType =
  | 'signup' | 'invite' | 'magiclink'
  | 'recovery' | 'email_change' | 'email'
  | (string & {});

// VerifyEmailOtpParams 支持 recovery
export interface VerifyEmailOtpParams {
  email: string;
  token: string;
  type: EmailOtpType;
  options?: {
    redirectTo?: string;
    captchaToken?: string;
  };
}

// resetPasswordForEmail 签名
resetPasswordForEmail(email: string, options?: {
  redirectTo?: string;    // 可选
  captchaToken?: string;  // 可选
}): Promise<AuthResponse>;
```
