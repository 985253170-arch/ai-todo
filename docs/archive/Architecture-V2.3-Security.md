# V2.3：安全增强 架构方案

> **状态**：架构设计阶段
> **依赖**：V2.2A ✅ · V2.2B ✅ · V2.1B OTP+Password ✅ · 自定义 SMTP ✅ · 自定义域名 aitodoai.cn ✅
> **定位**：安全增强——补齐忘记密码/重置密码 + 防滥用 + 配置复查，**不是 UI 美化，不是 AI 辅助执行**
> **上一文档**：[Roadmap-Core-First-V2.3-to-V3.0.md](Roadmap-Core-First-V2.3-to-V3.0.md)（路线总规划）
> **下一文档**：`docs/Architecture-V2.4-AI-Assist-MVP.md`（V2.4 AI 辅助执行 MVP，待 V2.3 完成后启动）
> **设计日期**：2026-07-05

---

## 目录

- [一、阶段定位](#一阶段定位)
- [二、当前安全现状](#二当前安全现状)
- [三、V2.3 候选功能](#三v23-候选功能)
- [四、V2.3 明确不做](#四v23-明确不做)
- [五、可能涉及文件分析](#五可能涉及文件分析)
- [六、推荐实现拆分](#六推荐实现拆分)
- [七、推荐路由设计](#七推荐路由设计)
- [八、Turnstile 架构判断](#八turnstile-架构判断)
- [九、Supabase 邮件模板要求](#九supabase-邮件模板要求)
- [十、错误提示优化方案](#十错误提示优化方案)
- [十一、验收标准](#十一验收标准)
- [十二、风险矩阵](#十二风险矩阵)
- [十三、后续衔接](#十三后续衔接)

---

## 一、阶段定位

### 1.1 V2.3 是什么

V2.3 是 **安全增强阶段**。在 V2.4 开放任务级 AI 辅助执行 API 之前，先补齐账号安全底线。

**一句话**：安全底座先稳，再开放更多能力。

### 1.2 V2.3 不是什么

| 不是 | 原因 |
|------|------|
| 不是 UI 美化 | 页面美化全部后移到 V3.0 |
| 不是 AI 辅助执行 | AI 辅助属于 V2.4 / V2.5 / V2.6 |
| 不是页面重构 | App Shell / 多页面拆分全部后移到 V3.0 |
| 不是账号体系改造 | V2.1B OTP + Password 混合登录主流程不变 |
| 不是任务核心流程变更 | 任务生成、保存、历史、统计、复盘、智能调整不受影响 |

### 1.3 不变的原则

- **不改变 V2.1B OTP + Password 混合登录主流程**
- **不改变 Supabase Auth 核心调用**（`signInWithOtp` / `verifyOtp` / `signInWithPassword` / `signUp` / `updateUser` / `signOut`）
- **不改变 `/app` 任何组件和逻辑**
- **不改变现有 API Route 签名和行为**
- **不改变数据库 schema**

---

## 二、当前安全现状

### 2.1 已有能力 ✅

| # | 能力 | 实现 | 状态 |
|---|------|------|:--:|
| 1 | Supabase Auth | `@supabase/ssr` + `@supabase/supabase-js` | ✅ |
| 2 | 邮箱验证码 OTP 登录 | `useAuth.sendOtp()` → `signInWithOtp({ email, options: { shouldCreateUser: true } })` | ✅ |
| 3 | 密码登录 | `useAuth.signInWithPassword()` → `signInWithPassword({ email, password })` | ✅ |
| 4 | 设置密码引导 | `SetPasswordPrompt` 组件，OTP 登录后弹出 | ✅ |
| 5 | 自定义 SMTP | 阿里云邮件推送，`supabase/config.toml` + Dashboard 配置 | ✅ |
| 6 | `/login` 独立页面 | `src/app/login/page.tsx` + `LoginPageContent.tsx`（OTP + Password 双 Tab） | ✅ |
| 7 | Auth 回调路由 | `src/app/auth/callback/route.ts`，处理 OTP 邮件链接中的 `token_hash` 验证 | ✅ |
| 8 | Auth 路由守卫 | `/app` 页面 client-side `useEffect` + `router.replace("/login")` | ✅ |
| 9 | 自定义域名 | aitodoai.cn / www.aitodoai.cn | ✅ |
| 10 | 错误脱敏（基础） | `getSafeErrorMessage()` 函数，映射 Supabase 错误到通用中文提示 | ✅ |

### 2.2 当前缺失 ❌

| # | 缺失项 | 风险等级 | 影响 |
|---|--------|:---:|------|
| 1 | **忘记密码入口** | 🔴 高 | 用户忘记密码后无法自助恢复，只能联系管理员或放弃账号 |
| 2 | **重置密码页面** | 🔴 高 | 即使发了重置密码邮件，用户也收不到完整闭环 |
| 3 | **前端防机器人** | 🟡 中 | `/login` 无 CAPTCHA/验证码，可被脚本批量调用 `sendOtp` / `signInWithPassword` |
| 4 | **服务端 Turnstile 校验** | 🟡 中 | 仅有 client-side widget 不够，必须服务端二次验证 token |
| 5 | **错误提示脱敏不完整** | 🟡 中 | `getSafeErrorMessage` 兜底逻辑对未匹配错误暴露了 "Invalid login credentials" 等 Supabase 原文 |
| 6 | **重置密码邮件模板未配置** | 🔴 高 | Supabase Dashboard 中仅配置了 Confirm signup 模板，未配置 Reset password 模板 |
| 7 | **Supabase Auth 安全配置未复查** | 🟡 中 | rate limit、session 过期时间、refresh token 策略可能使用默认值 |
| 8 | **回调 URL 可能不完整** | 🟡 中 | 自定义域名 aitodoai.cn 是否已加入 Redirect URLs 需确认 |

### 2.3 当前 Auth 相关文件全貌

```
src/
├── app/
│   ├── login/
│   │   └── page.tsx                    ← /login 页面入口（30 行）
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts                ← Auth 回调处理（87 行）
│   └── api/
│       └── auth/
│           └── me/
│               └── route.ts            ← GET /api/auth/me（31 行）
├── components/
│   ├── LoginPageContent.tsx            ← 登录表单核心（432 行）
│   ├── Header.tsx                      ← Header + AuthModal + SetPasswordPrompt（176 行）
│   ├── AuthModal.tsx                   ← /app 页面中的登录弹窗
│   └── SetPasswordPrompt.tsx           ← OTP 登录后设置密码引导
├── hooks/
│   └── useAuth.ts                      ← Auth 核心 hook（199 行）
├── lib/
│   ├── supabase-client.ts              ← 浏览器端 Supabase client（13 行）
│   ├── supabase-server.ts              ← 服务端 Supabase client + getAuthenticatedUserId（64 行）
│   ├── constants.ts                    ← AUTH_TEXT / ERROR_MESSAGES 常量（102 行）
│   └── types.ts                        ← AuthUser / AuthMeResponse 类型（222 行）
```

---

## 三、V2.3 候选功能

### 3.1 功能总览

| # | 功能 | 说明 | 优先级 | 小阶段 |
|---|------|------|:---:|:---:|
| A | **忘记密码** | `/forgot-password` 页面，输入邮箱 → 调用 Supabase `resetPasswordForEmail` → 发送重置密码邮件 | P0 | V2.3A |
| B | **重置密码** | `/reset-password` 页面，从邮件链接进入 → 输入新密码 + 确认新密码 → 调用 Supabase `updateUser` → 跳转 `/login` | P0 | V2.3A |
| C | **Cloudflare Turnstile** | 轻量防机器人，保护 `sendOtp` / 密码登录 / 忘记密码；新增 `/api/auth/verify-turnstile` 服务端校验 | P0 | V2.3B |
| D | **错误提示优化** | 统一脱敏策略，不暴露用户存在性、不暴露 Supabase 技术信息 | P1 | V2.3C |
| E | **Supabase Auth 配置复查** | Site URL、Redirect URLs、邮件模板、rate limit、session 设置、Allow unconfirmed email sign in | P1 | V2.3C |

---

### 3.2 A — 忘记密码

#### 流程

```
用户点击"忘记密码？"
  → 跳转 /forgot-password
  → 输入邮箱
  → 前端调用 useAuth.sendResetPasswordEmail(email)
  → Supabase auth.resetPasswordForEmail(email, { redirectTo: "https://aitodoai.cn/reset-password" })
  → 无论邮箱是否存在，都显示："如果该邮箱已注册，重置密码邮件已发送。"
  → 用户查收邮件，点击邮件中的重置链接
  → 进入 /reset-password 页面
```

#### 关键设计决策

1. **不暴露邮箱是否存在。** 无论 `resetPasswordForEmail` 成功还是失败（包括 "User not found"），前端统一显示成功提示。
   - Supabase `resetPasswordForEmail` 默认不暴露用户存在性（它总是返回 success），但实际生产中发现某些 Supabase 项目配置下会返回错误。需要在前端 catch 中统一处理。

2. **`redirectTo` 指向自定义域名**。`resetPasswordForEmail` 的 `redirectTo` 参数必须指向 `https://aitodoai.cn/reset-password`（或 Vercel 默认域名作为 fallback）。

3. **不新增 `useAuth` 方法。** 忘记密码功能只需要调用 `supabase.auth.resetPasswordForEmail`，在 `useAuth` 中新增一个 `sendResetPasswordEmail` 方法。

#### useAuth 新增方法

```typescript
// useAuth.ts 新增
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
    // 仅在真正的网络/配置错误时抛出
    if (error.message?.includes("rate limit")) {
      throw error;
    }
    // 其他错误（包括 user not found）静默吞掉
    return;
  }
}
```

#### 安全要点

- 前端不区分"用户存在"和"用户不存在"
- 邮件发送失败不暴露技术细节
- rate limit 错误正常提示（"操作过于频繁，请稍后再试"），这不会泄露用户存在性

---

### 3.3 B — 重置密码

#### 流程

```
用户从邮件点击重置链接
  → 浏览器打开 https://aitodoai.cn/reset-password#access_token=xxx&refresh_token=xxx&type=recovery
  → /reset-password 页面解析 URL hash 中的 access_token 和 refresh_token
  → 调用 supabase.auth.setSession({ access_token, refresh_token }) 建立临时 session
  → 显示：输入新密码 + 确认新密码
  → 用户提交
  → 调用 supabase.auth.updateUser({ password: newPassword })
  → 成功后提示"密码已重置"，跳转 /login
  → 用户用新密码登录
```

#### 页面设计要点

- **无 Header / Footer 干扰。** `/reset-password` 页面极简：标题 + 两个输入框 + 提交按钮。
- **密码强度提示。** 复用现有 6 位最低要求，不新增复杂度要求。
- **确认密码校验。** 前端校验两次输入一致。
- **成功后的状态清除。** 重置成功后调用 `supabase.auth.signOut()` 清除临时 session，再引导到 `/login`。
- **token 过期处理。** 如果 `setSession` 失败（token 过期或已使用），显示"重置链接已过期，请重新申请"并提供返回 `/forgot-password` 的链接。

#### useAuth 新增/复用方法

- **无需新增 `useAuth` 方法。** 重置密码流程使用 Supabase 原生 `setSession` + `updateUser`。`updateUser` 已在 `setPassword` 方法中调用。
- `/reset-password` 页面可以直接使用 `createSupabaseBrowserClient()` 获取 supabase 实例，不依赖 `useAuth` hook。

---

### 3.4 C — Cloudflare Turnstile 轻量防机器人

详见 [八、Turnstile 架构判断](#八turnstile-架构判断)。

核心要点：
- 前端 widget 嵌入 `/login` 和 `/forgot-password`
- 服务端 `/api/auth/verify-turnstile` 校验 token
- 保护对象：`sendOtp` · 密码登录 · 忘记密码
- 失败时 fail-open（允许通过但记录日志），避免锁死真实用户

---

### 3.5 D — 错误提示优化

详见 [十、错误提示优化方案](#十错误提示优化方案)。

核心要点：
- 统一脱敏策略：永远不区分"用户不存在"和"密码错误"
- 扩展 `getSafeErrorMessage` 覆盖更多 Supabase 错误码
- 考虑将 `getSafeErrorMessage` 从 `LoginPageContent.tsx` 提取到 `lib/constants.ts` 或 `lib/auth-errors.ts`，供 `/forgot-password` 和 `/reset-password` 复用

---

### 3.6 E — Supabase Auth 配置复查

详见 [九、Supabase 邮件模板要求](#九supabase-邮件模板要求)。

核心复查项：
- Site URL
- Redirect URLs（含 aitodoai.cn / www.aitodoai.cn / Vercel 默认域名 / localhost）
- Reset password 邮件模板（中文文案 + 正确回调 URL）
- Confirm signup 邮件模板（已有，确认无需修改）
- Rate limit 设置
- Session 过期时间
- "Allow unconfirmed email sign in" 是否关闭

---

## 四、V2.3 明确不做

| # | 不做 | 原因 | 后续 |
|---|------|------|------|
| 1 | 不做复杂账号中心（用户资料编辑、头像、昵称） | 最小安全原则，当前产品不需要 | 永不 |
| 2 | 不做第三方 OAuth（Google / GitHub / 微信） | 配置复杂、维护成本高 | 永不（全局红线） |
| 3 | 不做会员系统 / 付费 | 产品早期不引入商业化 | 永不（全局红线） |
| 4 | 不做团队权限 / RBAC | 个人工具定位 | 永不（全局红线） |
| 5 | 不做页面重构 / UI 美化 | 全部留在 V3.0 | V3.0 |
| 6 | 不做 AI 辅助执行 | 属于 V2.4 / V2.5 / V2.6 | V2.4 |
| 7 | 不做 App Shell / 多页面拆分 | 全部留在 V3.0 | V3.0 |
| 8 | 不新增 `/app/today` `/app/history` `/app/insights` `/app/settings` | 页面拆分后移到 V3.0 | V3.0 |
| 9 | 不改任务生成、保存、历史、统计、复盘、智能调整逻辑 | 安全增强不影响任务核心流程 | — |
| 10 | 不改数据库 schema | 除非后续单独评审决定 | — |
| 11 | 不做 Turnstile 之外的验证码方案 | 保持简单，不引入 reCAPTCHA / hCaptcha | — |
| 12 | 不做 IP 黑名单 / WAF | 过度设计，Turnstile 足够 | — |

---

## 五、可能涉及文件分析

### 5.1 风险分级

#### 🔴 高风险（修改前必须仔细评估影响）

| 文件 | 当前职责 | V2.3 可能需要改什么 | 风险点 |
|------|------|------|------|
| `src/hooks/useAuth.ts` | Auth 核心 hook（sendOtp / verifyOtp / signInWithPassword / signUp / setPassword / signOut） | 新增 `sendResetPasswordEmail` 方法；如果 Turnstile 在前端校验，sendOtp / signInWithPassword 可能需要增加 token 参数 | 修改现有方法签名会影响 `LoginPageContent`、`AuthModal` 等所有调用方 |
| `src/lib/supabase-server.ts` | 服务端 Supabase client + `getAuthenticatedUserId` | 可能不需要修改（Turnstile 校验用 fetch 直接调 Cloudflare API，不走 Supabase） | 如果错误修改会影响所有 API Route 的认证 |
| `src/app/auth/callback/route.ts` | 处理邮件链接中的 `token_hash` OTP 验证 | **可能不需要修改**。重置密码流程走 Supabase 的 `type=recovery`，hash 中的 token 由 `/reset-password` 页面处理，不走 callback route。但如果 Supabase 重置密码邮件也走 callback 模式，则需要扩展此路由。 | 当前 callback 只处理 `type=email`（OTP），需要确认重置密码邮件的回调类型 |
| `src/lib/constants.ts` | `AUTH_TEXT` / `ERROR_MESSAGES` 常量 | 新增忘记密码/重置密码相关文案（按钮、提示、错误信息） | 常量修改影响面小，但需要确认不遗漏 |
| `src/lib/types.ts` | `AuthUser` / `AuthMeResponse` 类型 | 可能不需要修改（忘记密码不改变 AuthUser 结构） | 如新增类型需确保向下兼容 |

> **注**：`src/app/auth/callback/route.ts` 当前仅处理 `type=email`（第 35-39 行的 `getOtpType` 只识别 `"email"`）。Supabase 重置密码邮件的回调参数是 `type=recovery`，如果重置密码链接也经过 `/auth/callback`，则需要扩展此路由。**但推荐方案是重置密码直接走 `/reset-password` 页面处理 URL hash 中的 token，不经过 callback route。** 此文件可能完全不需要修改。

#### 🟡 中风险（可能新增或修改）

| 文件 | 当前职责 | V2.3 可能需要改什么 | 风险点 |
|------|------|------|------|
| `src/components/LoginPageContent.tsx` | 登录表单核心（432 行） | 在密码登录 Tab 中添加"忘记密码？"链接（跳转 `/forgot-password`）；如果 Turnstile 嵌入此处，增加 Turnstile widget | 432 行已较复杂，新增逻辑需谨慎 |
| `src/app/login/page.tsx` | `/login` 页面入口（30 行） | 如果 Turnstile 在页面级加载 script，可能在此添加 | 风险低，少量代码 |
| `src/app/forgot-password/page.tsx` | **新增** | 忘记密码页面 | 新文件，无历史负担 |
| `src/app/reset-password/page.tsx` | **新增** | 重置密码页面 | 新文件，但需要正确处理 Supabase recovery token 的 hash 解析 |
| `src/app/api/auth/verify-turnstile/route.ts` | **新增** | Turnstile 服务端校验 API | 新文件，需要正确调用 Cloudflare API |
| `src/lib/constants.ts` | 复用现有 `AUTH_TEXT` / `ERROR_MESSAGES` | 新增忘记/重置密码文案 | 纯文案新增，风险低 |

#### 🟢 低风险（不改或仅引用）

| 文件 | 说明 |
|------|------|
| `src/components/Header.tsx` | `/login` 和 `/app` 的 Header 变体不变 |
| `src/components/SetPasswordPrompt.tsx` | OTP 后设置密码引导不变 |
| `src/components/AuthModal.tsx` | `/app` 页面中的登录弹窗不变（forgot password 仅在 `/login` 页面提供） |
| `src/app/app/page.tsx` | `/app` 主工作台不变 |
| 所有 API Route（除新增的 verify-turnstile） | 不变 |
| 所有任务核心逻辑 | 不变 |
| `src/lib/supabase-client.ts` | 不变 |

### 5.2 V2.3 预估文件变更

| 类型 | 数量 | 文件 |
|:---|:---:|------|
| 修改 | 2-3 | `useAuth.ts`（新增 sendResetPasswordEmail）、`LoginPageContent.tsx`（新增"忘记密码"链接 + 可能 Turnstile）、`constants.ts`（新增文案） |
| 新增 | 3-5 | `/forgot-password/page.tsx`、`/reset-password/page.tsx`、`/api/auth/verify-turnstile/route.ts`、`lib/auth-errors.ts`（可选）、`components/TurnstileWidget.tsx`（可选） |
| 不改 | — | 其他所有文件 |

---

## 六、推荐实现拆分

### V2.3A：忘记密码 / 重置密码（核心闭环）

**目标**：用户可以自助完成"忘记密码 → 收邮件 → 设置新密码 → 用新密码登录"。

**允许修改/新增文件**：
- `src/hooks/useAuth.ts` — 新增 `sendResetPasswordEmail` 方法
- `src/lib/constants.ts` — 新增忘记密码/重置密码文案
- `src/components/LoginPageContent.tsx` — 密码 Tab 中新增"忘记密码？"链接
- `src/app/forgot-password/page.tsx` — **新增**，忘记密码页面
- `src/app/reset-password/page.tsx` — **新增**，重置密码页面

**禁止修改内容**：
- 不改变 `sendOtp` / `verifyOtp` / `signInWithPassword` / `signUp` / `setPassword` / `signOut` 现有方法签名
- 不改 `/login` 页面结构（仅新增一个链接）
- 不改 `/app` 任何组件
- 不改 API Route

**验收标准**：
- [ ] 忘记密码页面可访问（`/forgot-password`）
- [ ] 输入已注册邮箱 → 提示"如果该邮箱已注册，重置密码邮件已发送"
- [ ] 输入未注册邮箱 → 同样提示（不泄露用户存在性）
- [ ] 收到重置密码邮件，点击链接打开 `/reset-password`
- [ ] 输入新密码 + 确认密码 → 密码重置成功
- [ ] 用新密码可登录
- [ ] 原 OTP 登录仍正常
- [ ] 原密码登录仍正常（旧密码不可用，新密码可用）
- [ ] 设置密码引导不被破坏
- [ ] 登录后 `/app` 仍正常
- [ ] 登出仍正常

**风险点**：
- 重置密码邮件中 `redirectTo` URL 配置错误 → 用户点击链接后 404
- `access_token` hash 解析失败 → 无法建立临时 session
- Supabase 重置密码邮件模板未配置 → 邮件不发送或文案不对

**Supabase Dashboard 前置配置**（实施前必须完成）：
1. 配置 Reset password 邮件模板（中文文案 + 正确回调 URL）
2. 确认 `redirectTo` 参数能与邮件模板正确拼接

---

### V2.3B：Turnstile 防机器人接入

**目标**：在前端关键操作（发送 OTP、密码登录、忘记密码）前通过 Turnstile 验证，服务端二次校验 token。

**允许修改/新增文件**：
- `src/app/api/auth/verify-turnstile/route.ts` — **新增**，服务端校验 API
- `src/components/LoginPageContent.tsx` — 发送 OTP / 密码登录前调用 Turnstile
- `src/app/forgot-password/page.tsx` — 忘记密码提交前调用 Turnstile
- `src/app/login/page.tsx` — 加载 Turnstile script（或通过 next/script 在 LoginPageContent 中加载）
- `.env.local` — **仅新增两项**（`NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`，不写真实值）

**禁止修改内容**：
- 不修改 `useAuth` 方法签名（Turnstile token 通过独立调用传递，不嵌入 sendOtp/signInWithPassword）
- 不修改数据库 schema
- 不新增 npm 依赖（Turnstile 使用 Cloudflare 的 `<script>` 标签加载，不需要 npm 包）
- 不改变现有错误处理流程

**验收标准**：
- [ ] Turnstile widget 在 `/login` 页面正常渲染
- [ ] Turnstile widget 在 `/forgot-password` 页面正常渲染
- [ ] 未通过 Turnstile 时，发送 OTP / 密码登录 / 忘记密码 按钮不可点击
- [ ] 服务端 `/api/auth/verify-turnstile` 正确校验 token
- [ ] 校验失败时返回明确错误（不暴露 secret）
- [ ] Turnstile 加载失败时系统仍可用（fail-open）
- [ ] 本地开发时 Turnstile 使用 test key（始终通过）
- [ ] 不影响现有登录/注册流程

**风险点**：
- Turnstile secret key 泄露（写入前端代码或提交到 git）
- Turnstile CDN 被墙导致国内用户无法加载（需要 fail-open 策略）
- Turnstile 服务端校验失败导致合法用户无法登录（需要超时和重试策略）

---

### V2.3C：Auth 错误提示与邮件模板复查

**目标**：统一前端错误脱敏策略，复查并完善 Supabase Dashboard 所有 Auth 相关配置。

**允许修改/新增文件**：
- `src/lib/constants.ts` — 新增/优化错误提示文案
- `src/components/LoginPageContent.tsx` — 扩展 `getSafeErrorMessage` 覆盖范围；或提取到 `src/lib/auth-errors.ts`
- `src/lib/auth-errors.ts` — **可选新增**，集中管理 Auth 错误脱敏逻辑

**Supabase Dashboard 复查清单**（不写代码，纯配置复查）：

| # | 配置项 | 预期值 | 说明 |
|---|--------|--------|------|
| 1 | Site URL | `https://aitodoai.cn` | 自定义域名优先 |
| 2 | Redirect URLs | 含 `https://aitodoai.cn/**`、`https://www.aitodoai.cn/**`、`https://ai-todo-kappa-drab.vercel.app/**`、`http://localhost:3000/**` | 覆盖生产、Vercel 默认、本地开发 |
| 3 | Reset password 邮件模板 | 中文文案 + `{{ .RedirectTo }}` | 必须配置，否则忘记密码闭环断裂 |
| 4 | Confirm signup 邮件模板 | 已有，确认文案和回调 URL 正确 | 复查即可 |
| 5 | Rate limit（auth） | 默认 `/auth/v1/otp` 限速 30 req/h | 确认是否适合产品需求 |
| 6 | Session 过期时间 | 默认 3600s（1 小时） | 确认是否需要调整 |
| 7 | Refresh token 策略 | 默认 refresh token 永不过期 | 确认安全策略 |
| 8 | Allow unconfirmed email sign in | **关闭** | 必须确认关闭，用户必须验证邮箱 |

**禁止修改内容**：
- 不改变现有错误码体系
- 不改变 API Route 错误响应格式

**验收标准**：
- [ ] 所有 Auth 错误提示不暴露 Supabase 技术信息
- [ ] 登录失败统一提示"邮箱或密码错误"（不区分用户不存在 vs 密码错误）
- [ ] OTP 发送失败不区分"用户不存在" vs "邮件发送失败"
- [ ] 忘记密码统一提示（不区分邮箱是否已注册）
- [ ] Supabase Dashboard 所有配置项复查通过
- [ ] Reset password 邮件模板使用中文且回调 URL 正确

---

### V2.3-Review：安全回归审查

**目标**：端到端验证安全闭环，确保所有现有功能不受影响。

**不做代码修改，纯验证。**

**验收标准**：见 [十一、验收标准](#十一验收标准)。

---

## 七、推荐路由设计

### 方案对比

#### 方案一：`/login` 内联 + `/reset-password` 独立

```
/login                  ← 现有页面，密码 Tab 内加"忘记密码？"链接（切换为"忘记密码"模式）
/reset-password         ← 独立页面，从邮件链接进入
```

| 优点 | 缺点 |
|------|------|
| 少一个页面文件 | LoginPageContent 已 432 行，再加 forgot password 状态会更复杂 |
| 用户不需要跳转页面 | 三种模式（OTP / Password / ForgotPassword）挤在一个组件中，维护困难 |
| — | 忘记密码状态的 UI 与登录 UI 差异大（无 Tab、无 OTP 区域），不适合内联 |

#### 方案二：`/forgot-password` + `/reset-password` 均独立

```
/forgot-password        ← 独立页面，仅邮箱输入 + 提交 + 返回登录
/reset-password         ← 独立页面，从邮件链接进入，仅新密码 + 确认密码
/login                  ← 密码 Tab 内加"忘记密码？"链接跳转 /forgot-password
```

| 优点 | 缺点 |
|------|------|
| 职责单一，每个页面 < 150 行 | 多 1 个页面文件 |
| `/forgot-password` 可复用 `/login` 的页面布局（Header + 渐变背景） | — |
| 易于独立测试和维护 | — |
| 不增加 LoginPageContent 复杂度 | — |

### 推荐方案：**方案二**

**理由**：

1. **LoginPageContent 已足够复杂。** 当前 432 行，包含双 Tab、OTP 表单、密码表单、10 种状态、9 个函数。再加入"忘记密码"状态会超过 500 行，违反单一职责原则。

2. **忘记密码 UI 与登录 UI 差异大。** 忘记密码只需要一个邮箱输入框 + 提交按钮 + 返回链接，不需要 Tab 切换，不需要 OTP 输入，不需要密码输入。强行内联会制造大量条件渲染。

3. **独立页面更安全。** 忘记密码和重置密码都是安全敏感操作，独立页面更容易做 Turnstile 保护和错误脱敏。

4. **与行业实践一致。** GitHub、Google、Apple 等均使用独立 `/forgot-password` 页面。

### 路由结构

```
/login                  ← 现有（不变）
  └── "忘记密码？" → /forgot-password
/forgot-password        ← 新增
  └── 提交成功 → 显示提示 → "返回登录" → /login
/reset-password         ← 新增（从邮件链接进入）
  └── 重置成功 → "返回登录" → /login
```

---

## 八、Turnstile 架构判断

### 8.1 Turnstile 是否进入 V2.3

**推荐：是。** Turnstile 是防机器人攻击的最小可行方案，必须在 AI 辅助 API（V2.4）开放前完成。

### 8.2 放置位置

| 页面/操作 | 是否需要 Turnstile | 说明 |
|-----------|:---:|------|
| `/login` — 发送 OTP | ✅ 需要 | 防止脚本批量刷 OTP 邮件，消耗 SMTP 配额 |
| `/login` — 密码登录 | ✅ 需要 | 防止密码爆破 |
| `/forgot-password` — 发送重置邮件 | ✅ 需要 | 防止滥用重置密码邮件 |
| `/login` 页面加载时 | — | Turnstile widget 在页面加载时渲染，但 token 在提交时获取 |
| `/reset-password` | ❌ 不需要 | 用户已持有有效 recovery token（邮件链接中的 token），不需要额外验证 |

### 8.3 Token 是否必须走服务端验证

**必须。** 客户端 widget 验证只是第一关，服务端必须独立校验。

原因：
- 客户端代码完全可控，攻击者可以绕过 widget 直接调用 API
- Turnstile 的安全模型是 **client-side widget → 获取 token → 服务端用 secret key 向 Cloudflare 验证 token**
- 前端只持有 site key（可公开），secret key 只在服务端

### 8.4 是否需要新增 `/api/auth/verify-turnstile`

**是。** 需要新增 `POST /api/auth/verify-turnstile`。

#### API 设计

```
POST /api/auth/verify-turnstile
Content-Type: application/json

Request:
{
  "token": "XXX.XXXX.XXXXX"   // Turnstile widget 返回的 token
}

Response (成功):
{
  "success": true,
  "data": {
    "verified": true
  }
}

Response (校验失败):
{
  "success": true,            // API 调用成功，但 token 校验失败
  "data": {
    "verified": false,
    "error": "invalid_token"  // 不向客户端暴露 Cloudflare 原始错误码
  }
}

Response (服务端错误):
{
  "success": false,
  "error": {
    "code": "TURNSTILE_VERIFICATION_FAILED",
    "message": "安全验证失败，请稍后重试。"
  }
}
```

#### 服务端实现要点

```typescript
// src/app/api/auth/verify-turnstile/route.ts
export async function POST(request: NextRequest) {
  const { token } = await request.json();

  if (!token) {
    return NextResponse.json({
      success: true,
      data: { verified: false, error: "missing_token" }
    });
  }

  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    // 未配置 secret key 时 fail-open
    return NextResponse.json({
      success: true,
      data: { verified: true }
    });
  }

  try {
    const formData = new FormData();
    formData.append("secret", secretKey);
    formData.append("response", token);

    const result = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    });

    const outcome = await result.json();
    // outcome: { success: boolean, "error-codes": string[], ... }

    return NextResponse.json({
      success: true,
      data: {
        verified: outcome.success === true,
        error: outcome.success ? undefined : "invalid_token"
      }
    });
  } catch {
    // Cloudflare API 不可达时 fail-open
    return NextResponse.json({
      success: true,
      data: { verified: true }
    });
  }
}
```

### 8.5 哪些操作必须携带 Turnstile token

| 操作 | 是否需要 | token 传递方式 |
|------|:---:|------|
| `POST /api/auth/verify-turnstile` → 前端调用 `sendOtp` | ✅ | 先调 Turnstile 获取 token → 调 verify-turnstile API → 校验通过后才调 sendOtp |
| `POST /api/auth/verify-turnstile` → 前端调用 `signInWithPassword` | ✅ | 同上 |
| `POST /api/auth/verify-turnstile` → 前端调用 `sendResetPasswordEmail` | ✅ | 同上 |
| API Route（任务生成/保存/读取） | ❌ | 这些 API 由登录用户的 session JWT 保护，不需要 Turnstile |

### 8.6 Turnstile 加载失败处理（Fail-Open 策略）

```
Turnstile 加载流程:
  1. 页面加载 → 加载 Cloudflare Turnstile script
  2. Widget 渲染成功 → 正常流程（提交前获取 token）
  3. Widget 渲染失败 / script 加载超时（5 秒）→ fail-open
     - 隐藏 Turnstile 容器
     - 允许提交（不携带 token）
     - 记录 console.warn

服务端校验流程:
  1. 收到 verify-turnstile 请求
  2. 未配置 TURNSTILE_SECRET_KEY → 直接返回 verified: true
  3. 调用 Cloudflare API 超时（3 秒）→ catch 返回 verified: true
  4. Cloudflare API 返回 success: false → 返回 verified: false

原则:
  - Turnstile 是增强安全，不能成为阻止合法用户的障碍
  - 宁可漏过少量机器人，不可锁死真实用户
```

### 8.7 本地开发处理

| 环境 | Site Key | Secret Key | 行为 |
|------|------|------|------|
| 生产 | 生产 key | 生产 secret | 正常校验 |
| 本地开发 | `1x00000000000000000000AA`（Cloudflare 测试 key） | `1x0000000000000000000000000000000AA`（测试 secret） | widget 始终通过 |
| 未配置 | 不存在 | 不存在 | fail-open（始终通过） |

测试 key 参考：https://developers.cloudflare.com/turnstile/reference/testing/

### 8.8 环境变量

| 变量 | 用途 | 暴露方式 | 位置 |
|------|------|------|------|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | 前端 widget 加载 | 公开（`NEXT_PUBLIC_` 前缀） | Vercel 环境变量 + `.env.local` |
| `TURNSTILE_SECRET_KEY` | 服务端 token 校验 | **私密**（无 `NEXT_PUBLIC_` 前缀） | Vercel 环境变量 + `.env.local` |

**严禁**：
- 不要在客户端代码中引用 `TURNSTILE_SECRET_KEY`
- 不要将 `.env.local` 中的真实 secret key 提交到 git
- `.env.local` 中本地开发使用测试 key，生产环境在 Vercel Dashboard 配置真实 key

---

## 九、Supabase 邮件模板要求

### 9.1 Reset Password 邮件模板

#### 配置位置

Supabase Dashboard → Authentication → Email Templates → Reset Password

#### 模板要求

```html
<!-- Subject -->
重置你的 AI Todo 密码

<!-- HTML Body -->
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

#### 关键配置

| 项目 | 值 | 说明 |
|------|------|------|
| `{{ .RedirectTo }}` | 由 `resetPasswordForEmail({ redirectTo })` 的 `redirectTo` 参数拼接 | **不要手动写死 URL**，使用 Supabase 模板变量 |
| `{{ .Token }}` | Supabase 自动生成 | 不在模板中直接使用（已内置在 `{{ .RedirectTo }}` 中） |
| `{{ .Email }}` | 用户邮箱 | 可选，用于个性化（如"你好，{{ .Email }}..."） |

### 9.2 回调 URL 应该指向哪里

```
resetPasswordForEmail(email, {
  redirectTo: "https://aitodoai.cn/reset-password"
})
```

邮件中的 `{{ .RedirectTo }}` 会被替换为：
```
https://aitodoai.cn/reset-password#access_token=xxx&refresh_token=xxx&type=recovery
```

`/reset-password` 页面解析 hash 中的 token，调用 `supabase.auth.setSession()` 建立临时 session。

### 9.3 自定义域名 aitodoai.cn 配置检查

| 检查项 | 当前状态 | V2.3 需要 |
|------|:--:|:--:|
| Site URL 是否为 `https://aitodoai.cn` | 需确认 | ✅ 必须是 |
| Redirect URLs 是否包含 `https://aitodoai.cn/**` | 需确认 | ✅ 必须包含 |
| Redirect URLs 是否包含 `https://www.aitodoai.cn/**` | 需确认 | ✅ 建议包含 |
| Redirect URLs 是否包含 Vercel 默认域名 | 需确认 | ✅ 建议保留（fallback） |
| 邮件模板中的链接是否使用 `{{ .RedirectTo }}` 变量 | 需确认 | ✅ 必须 |

### 9.4 localhost 是否保留

**保留。** Redirect URLs 中保留 `http://localhost:3000/**`，方便本地开发和调试。

### 9.5 邮件模板是否继续中文化

**是。** 所有邮件模板（Confirm signup + Reset password）继续使用中文。

原因：
- 目标用户为中文用户
- V2.1-Follow-up SMTP 中已配置中文 Confirm signup 模板，保持一致性
- SMTP 服务商（阿里云邮件推送）在国内，中文邮件投递率更高

---

## 十、错误提示优化方案

### 10.1 当前状态

`getSafeErrorMessage` 函数（`LoginPageContent.tsx` 第 10-43 行）已实现基础脱敏：

```typescript
function getSafeErrorMessage(error: unknown, mode: AuthMode) {
  // 检查 error.message 中的关键词
  // "email rate limit exceeded" → 操作过于频繁
  // "invalid login credentials" → 邮箱或密码错误
  // "token" / "otp" / "expired" → 验证码错误或已过期
  // "unable to validate email address" → 邮箱格式不正确
  // 兜底 → 根据 mode 返回通用错误
}
```

### 10.2 当前问题

1. **关键字匹配脆弱。** 依赖 Supabase 错误消息的英文字符串，如果 Supabase 更新错误文案，匹配会失效。
2. **兜底逻辑区分了 mode。** `mode === "password" ? PASSWORD_LOGIN_ERROR : OTP_INVALID`，但这仍然暴露了操作类型。
3. **忘记密码场景需要新的脱敏规则。** `resetPasswordForEmail` 可能返回 "User not found" 类错误，必须在前端静默处理。
4. **函数定义在 LoginPageContent 中。** `/forgot-password` 和 `/reset-password` 无法复用。

### 10.3 推荐方案

**提取 `getSafeErrorMessage` 到独立模块**，并扩展覆盖范围：

```
src/lib/auth-errors.ts   ← 新增（或放在 constants.ts）
```

```typescript
// src/lib/auth-errors.ts

export type AuthOperation = "otp" | "password" | "forgot_password" | "reset_password";

const SAFE_AUTH_MESSAGES: Record<string, Record<AuthOperation, string>> = {
  "email rate limit exceeded": {
    otp: "操作过于频繁，请稍后再试。",
    password: "操作过于频繁，请稍后再试。",
    forgot_password: "操作过于频繁，请稍后再试。",
    reset_password: "操作过于频繁，请稍后再试。",
  },
  "invalid login credentials": {
    otp: "邮箱或验证码错误，请重试。",
    password: "邮箱或密码错误，请重试。",
    forgot_password: "如果该邮箱已注册，重置密码邮件已发送。",  // 不暴露
    reset_password: "重置密码失败，请重新申请重置链接。",
  },
  // ... 更多错误码映射
};

// 兜底消息：不区分操作类型
const FALLBACK_SAFE_MESSAGES: Record<AuthOperation, string> = {
  otp: "验证失败，请稍后重试。",
  password: "登录失败，请稍后重试。",
  forgot_password: "如果该邮箱已注册，重置密码邮件已发送。",  // 关键：绝不暴露
  reset_password: "重置失败，请重新申请重置链接。",
};

export function getSafeAuthErrorMessage(
  error: unknown,
  operation: AuthOperation
): string {
  if (!(error instanceof Error) || !error.message) {
    return FALLBACK_SAFE_MESSAGES[operation];
  }

  const message = error.message.toLowerCase();

  for (const [pattern, messages] of Object.entries(SAFE_AUTH_MESSAGES)) {
    if (message.includes(pattern)) {
      return messages[operation];
    }
  }

  return FALLBACK_SAFE_MESSAGES[operation];
}
```

### 10.4 脱敏原则

| 原则 | 说明 |
|------|------|
| **不暴露用户存在性** | 登录失败统一"邮箱或密码错误"，不区分"用户不存在"和"密码错误" |
| **不暴露 Supabase 技术信息** | 不展示 `invalid login credentials`、`User not found`、`token has expired` 等原始消息 |
| **忘记密码完全静默** | 任何错误（除 rate limit）都显示"如果该邮箱已注册，重置密码邮件已发送" |
| **rate limit 正常提示** | 频控提示不泄露用户存在性，且是可预期的正常行为 |
| **开发环境可调试** | `console.error` 中保留原始错误对象，供开发者排查 |

---

## 十一、验收标准

### 11.1 功能验收

| # | 验收项 | 标准 |
|---|--------|------|
| 1 | 忘记密码邮件能发送 | `/forgot-password` 输入已注册邮箱 → 收到重置密码邮件 |
| 2 | 不泄露邮箱是否存在 | 未注册邮箱提交后显示相同提示 |
| 3 | 重置密码链接可打开 | 从邮件点击链接 → 正确跳转 `/reset-password` |
| 4 | 新密码设置成功 | 输入新密码 + 确认密码 → 更新成功 |
| 5 | 新密码可登录 | 用新密码在 `/login` 密码登录成功 → 进入 `/app` |
| 6 | 原 OTP 登录仍正常 | `/login` OTP Tab → 发送验证码 → 验证 → 登录成功 |
| 7 | 原密码登录仍正常（新密码） | 旧密码失效，新密码可用 |
| 8 | 设置密码引导不被破坏 | OTP 登录后 → SetPasswordPrompt 正常弹出 |
| 9 | `/app` 仍正常 | 登录后 `/app` 任务列表、勾选、统计、历史等全部正常 |
| 10 | 登出仍正常 | Header 点击登出 → 回到未登录状态 |

### 11.2 安全验收

| # | 验收项 | 标准 |
|---|--------|------|
| 1 | Turnstile 校验生效 | 绕过前端直接调 `/api/auth/verify-turnstile` 传入无效 token → 返回 `verified: false` |
| 2 | 机器人不能无限刷 OTP | 无有效 Turnstile token 时无法调 sendOtp |
| 3 | 前端不暴露 secret key | `Ctrl+Shift+F` 搜索 `TURNSTILE_SECRET_KEY` 仅出现在服务端代码中 |
| 4 | 后端不信任前端 token | 服务端独立调用 Cloudflare API 验证 |
| 5 | 错误提示不泄露用户存在性 | 登录失败统一"邮箱或密码错误"，忘记密码统一静默提示 |
| 6 | API key / token / cookie 不暴露 | 浏览器 Network 面板中不出现 secret key |

### 11.3 回归验收

| # | 验收项 | 标准 |
|---|--------|------|
| 1 | 任务生成正常 | 输入目标 → AI 生成任务 |
| 2 | 任务勾选正常 | 点击任务 → completed 状态切换 |
| 3 | 历史正常 | 点击历史 → 查看归档任务组 |
| 4 | 统计正常 | StatsBar 数据显示正确 |
| 5 | AI 复盘正常 | TaskReviewPanel 正常触发和展示 |
| 6 | 智能调整正常 | 连续低完成率 → 任务数量自动调整 |

### 11.4 门禁

```bash
npm run lint     # 零 error
npm run build    # Compiled successfully
git status --short   # 仅 V2.3 涉及的文件变更，无意外修改
```

---

## 十二、风险矩阵

| # | 风险 | 概率 | 影响 | 缓解措施 |
|---|------|:---:|:---:|------|
| 1 | **重置密码回调链路错误** | 🟡 中 | 🔴 高 | 先在 Vercel 默认域名上验证完整链路，再切换到 aitodoai.cn |
| 2 | **Supabase 邮件模板 URL 配错** | 🟡 中 | 🔴 高 | 使用 `{{ .RedirectTo }}` 模板变量而非硬编码 URL；发测试邮件验证 |
| 3 | **Turnstile secret key 暴露** | 🟢 低 | 🔴 高 | secret key 仅放 `.env.local`（gitignore）和 Vercel 环境变量；Review 时搜索 |
| 4 | **Turnstile 加载失败导致用户无法登录** | 🟡 中 | 🔴 高 | Fail-open 策略：widget 加载失败或 API 不可达时允许通过 |
| 5 | **忘记密码暴露账号是否存在** | 🟡 中 | 🟡 中 | `resetPasswordForEmail` 所有错误（除 rate limit）统一静默处理 |
| 6 | **修改 useAuth 影响现有 OTP 登录** | 🟢 低 | 🔴 高 | 新增方法不改现有方法签名；回归测试 OTP 完整流程 |
| 7 | **修改 LoginPageContent 影响登录页稳定性** | 🟢 低 | 🟡 中 | 仅在密码 Tab 新增一个链接（`<a href="/forgot-password">`），改动极小 |
| 8 | **环境变量配置缺失导致生产失败** | 🟡 中 | 🔴 高 | Turnstile 环境变量缺失时 fail-open；部署 checklist 确保先配环境变量再上线 |
| 9 | **Supabase `resetPasswordForEmail` 的 `redirectTo` 与实际部署域名不一致** | 🟡 中 | 🟡 中 | 使用 `window.location.origin` 动态拼接；邮件模板检查 `{{ .RedirectTo }}` |
| 10 | **重置密码 token 在 URL hash 中，客户端路由可能截断** | 🟢 低 | 🟡 中 | `/reset-password` 页面使用 `useEffect` 读取 `window.location.hash`；不依赖 Next.js router |

---

## 十三、后续衔接

### 13.1 V2.3 完成后的下一步

```
V2.3 安全增强 ✅
    ↓
V2.4 任务级 AI 辅助执行 MVP
    ↓
V2.5 AI 辅助执行增强
    ↓
V2.6 AI 辅助执行沉淀
    ↓
V3.0 正式 App 架构重构（页面优化 + 美观统一 + App Shell + 多页面拆分 + 移动端优化）
```

### 13.2 V2.3 不进入

- ❌ 页面美化 → V3.0
- ❌ App Shell → V3.0
- ❌ 多页面拆分 → V3.0
- ❌ AI 辅助执行 → V2.4
- ❌ 数据库 schema 变更 → 除非单独评审

### 13.3 标准工作流

```
Claude Code 写架构方案（本文档）
    → ChatGPT 审查
    → Claude Code 写执行方案（docs/Execution-Plan-V2.3-Security.md）
    → ChatGPT 审查
    → Codex 按执行方案实现
    → Claude Code Review
    → ChatGPT 最终把关
    → 提交
```

---

> **下一文档**：`docs/Execution-Plan-V2.3-Security.md`（V2.3 安全增强 执行方案，待本文档经 ChatGPT 审查通过后启动）
