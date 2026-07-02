# V2.1：账号系统稳定化 / Auth 改造架构方案

> **状态**：架构设计阶段
> **依赖**：V2.0 主线 Phase 12-15 已关闭
> **上一版本**：Phase 11（Magic Link OTP → V2.1 email+password）
> **设计日期**：2026-07-02

---

## 目录

- [一、总体目标](#一总体目标)
- [二、当前 Auth 系统分析](#二当前-auth-系统分析)
- [三、为什么选择 Email + Password](#三为什么选择-email--password)
- [四、V2.1 范围定义](#四v21-范围定义)
- [五、Supabase Auth API 迁移](#五supabase-auth-api-迁移)
- [六、前端架构变更](#六前端架构变更)
- [七、组件变更设计](#七组件变更设计)
- [八、Email 确认流程](#八email-确认流程)
- [九、Session 管理](#九session-管理)
- [十、匿名↔登录迁移](#十匿名登录迁移)
- [十一、Phase 15 兼容性](#十一phase-15-兼容性)
- [十二、Phase 14 兼容性](#十二phase-14-兼容性)
- [十三、安全边界](#十三安全边界)
- [十四、文件变更清单](#十四文件变更清单)
- [十五、不修改文件清单](#十五不修改文件清单)
- [十六、风险矩阵](#十六风险矩阵)
- [十七、子 Phase 拆分](#十七子-phase-拆分)
- [十八、验收标准](#十八验收标准)

---

## 一、总体目标

### 1.1 问题陈述

V2.0 使用 Supabase Auth Magic Link（邮箱链接）登录。生产环境实测发现：

- 用户输入邮箱后收到登录链接邮件
- 点击邮件链接跳回网站
- 页面仍显示"未登录"状态
- 需要再次点击登录，体验断裂

**根因分析**（不需要修改，仅记录）：

Magic Link 在 Serverless 环境（Vercel）中存在 cookie 写入时序问题。`auth/callback/route.ts` 中 `exchangeCodeForSession` 需要在 Response 对象上 set cookie，但 Supabase `@supabase/ssr` 的 cookie 处理链在 Vercel Edge 和 Node.js runtime 之间存在兼容性差异。OTP 6 位数字验证码没有这个问题（不需要 redirect → callback），但 Phase 11 最终选择了 Magic Link 而非 OTP。

### 1.2 V2.1 目标

**废弃 Magic Link，改用 Email + Password 账号体系。**

核心目标：

1. 用户可以用邮箱 + 密码注册账号
2. 用户可以用邮箱 + 密码登录
3. 注册后发送邮箱确认链接（Supabase 内置）
4. 登录 / 登出稳定可靠
5. 保留匿名任务（device_id 模式完全不受影响）
6. 登录后继续触发匿名 → 用户任务迁移
7. Phase 15 generate-tasks 继续基于 user_id stats
8. 未登录时继续基于 device_id stats

### 1.3 成功判断

| 判断维度 | 标准 |
|---------|------|
| 登录成功率 | 用户输入邮箱+密码 → 登录成功（不依赖邮件跳转） |
| Session 持久化 | 刷新页面后 session 保持 |
| 登出 | 点击登出 → 立即登出 → 回退匿名模式 |
| 注册流程 | 输入邮箱+密码 → 收到确认邮件 → 点击确认 → 可登录 |
| 匿名模式 | 不登录状态下所有 V2.0 功能正常 |
| 数据迁移 | 登录后匿名任务自动绑定到 user_id |
| 现有功能 | Phase 14 复盘 / Phase 15 智能调整不受影响 |
| 安全 | userId 只来自服务端 session，前端不传 |

---

## 二、当前 Auth 系统分析

### 2.1 当前调用链（Magic Link）

```
用户点击"登录"
  → AuthModal 弹窗
  → 输入邮箱
  → useAuth.signIn(email)
  → supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
  → Supabase 发送 Magic Link 邮件
  → 用户点击邮件中的链接
  → GET /auth/callback?token_hash=xxx&type=magiclink
  → supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })
  → 设置 session cookie
  → 重定向到 /
  → useAuth 通过 onAuthStateChange 监听到 session 变化
  → user 状态更新
  → Header 显示邮箱 + 登出按钮
```

### 2.2 当前 Auth 关键代码分布

| 文件 | 当前职责 | V2.1 变更 |
|------|---------|:--:|
| `src/hooks/useAuth.ts` | `signIn(email)` → signInWithOtp<br>`verifyOtp(email, token)` → verifyOtp<br>`signOut()` → signOut | **改** |
| `src/components/AuthModal.tsx` | 单个邮箱输入框 → 发送 Magic Link → 显示"请查看邮箱" | **改** |
| `src/components/Header.tsx` | 登录/登出按钮，显示邮箱 | **改**（微调） |
| `src/app/auth/callback/route.ts` | 处理 Magic Link 回调（exchangeCodeForSession / verifyOtp） | **改** |
| `src/app/api/auth/me/route.ts` | GET 当前 session 用户信息 | **不改** |
| `src/lib/constants.ts` | AUTH_TEXT 文案（Magic Link 相关） | **改** |
| `src/lib/supabase-server.ts` | `getAuthenticatedUserId()` / `createSupabaseAuthClient()` | **不改** |
| `src/lib/supabase-client.ts` | `createSupabaseBrowserClient()` | **不改** |

### 2.3 哪些完全不动

以下 13 个文件不涉及 auth 功能本身，V2.1 完全不动：

```
src/app/api/generate-tasks/route.ts       ← getAuthenticatedUserId() 不变
src/app/api/task-group/save/route.ts       ← 同上
src/app/api/task-group/load/route.ts       ← 同上
src/app/api/task-group/delete/route.ts     ← 同上
src/app/api/task-group/migrate/route.ts    ← 同上
src/app/api/task-groups/review/route.ts    ← 同上
src/app/api/task-groups/stats/route.ts     ← 同上
src/app/api/task-groups/history/route.ts   ← 同上
src/hooks/useTaskGroup.ts                  ← 同上（迁移逻辑不变）
src/hooks/useTaskReview.ts                 ← deviceId+taskGroupId 不变
src/hooks/useTaskStats.ts                  ← deviceId 不变
src/hooks/useTaskHistory.ts                ← deviceId 不变
src/lib/ai-client.ts                       ← callAIWithPrompts 不变
```

---

## 三、为什么选择 Email + Password

### 3.1 方案对比

| 维度 | Magic Link（当前） | Email OTP 6位码 | Email + Password |
|------|:---:|:---:|:---:|
| 实现复杂度 | 低 | 低 | 中 |
| 登录步骤 | 2步（输入邮箱 → 点邮件链接） | 3步（输入邮箱 → 收码 → 输入码） | 1步（输入邮箱+密码 → 登录） |
| 手机端体验 | ❌ 需切换App看邮件 | 中（键盘自动填充） | ✅ 最直接 |
| 服务端复杂度 | 需 callback route | 需 verifyOtp | 直接 signInWithPassword |
| Serverless 兼容 | ❌ cookie 写入时序问题 | ✅ 无回调 | ✅ 无回调 |
| 记住密码 | N/A | N/A | ✅ 浏览器/密码管理器 |
| 用户心智 | "等邮件" | "等验证码" | 最熟悉 |
| Supabase 支持 | ✅ 原生 | ✅ 原生 | ✅ 原生 |

### 3.2 决策理由

1. **Email + Password 不依赖邮件跳转**——消除了 Magic Link 在 Vercel Serverless 环境中的 cookie 时序问题
2. **一步登录**——输入邮箱+密码即刻登录，不需要等邮件、不需要切换 App
3. **浏览器自动填充**——Chrome/Safari 原生支持密码管理器，手机端体验好
4. **Supabase 原生支持**——`signUp()` + `signInWithPassword()`，零额外依赖
5. **用户最熟悉**——邮箱+密码是全球最普遍的账号体系

---

## 四、V2.1 范围定义

### 4.1 V2.1 必须做

| # | 功能 | Supabase API |
|---|------|-------------|
| 1 | 邮箱 + 密码注册 | `supabase.auth.signUp({ email, password })` |
| 2 | 邮箱 + 密码登录 | `supabase.auth.signInWithPassword({ email, password })` |
| 3 | 注册后邮箱确认链接 | Supabase 内置确认邮件（Dashboard 开启） |
| 4 | 登录 / 登出稳定 | `signInWithPassword` / `signOut` |
| 5 | 保留匿名任务 | device_id 模式完全不变 |
| 6 | 登录后匿名→用户任务迁移 | 现有 `POST /api/task-group/migrate` 逻辑不变 |
| 7 | Phase 15 generate-tasks 基于 user_id stats | `getAuthenticatedUserId()` 不变 |
| 8 | 未登录时基于 device_id stats | device_id 回退逻辑不变 |

### 4.2 V2.1 不做

| # | 不做 | 原因 |
|---|------|------|
| 1 | 手机验证码 | 需 SMS 服务商，V2.2+ |
| 2 | 邮箱 6 位数字验证码 | 流程比密码更复杂，且 Supabase 的 email OTP 也需要回调 |
| 3 | Cloudflare Turnstile CAPTCHA | 防机器人，V2.1-Follow-up |
| 4 | 忘记密码 | Supabase 内置 `resetPasswordForEmail`，V2.2 |
| 5 | 修改密码 | Supabase 内置 `updateUser`，V2.2 |
| 6 | 第三方登录（Google/GitHub/微信） | OAuth 配置复杂度，V2.2+ |
| 7 | 账号中心 / 个人资料页 | 最小账号系统原则 |
| 8 | 用户昵称 / 头像 | 同上 |
| 9 | 会员系统 | 不在产品路线图 |
| 10 | 数据库 schema 变更 | 不需要 |

### 4.3 后续版本可做

| # | 功能 | 建议版本 |
|---|------|:---:|
| 1 | Cloudflare Turnstile 防机器人 | V2.1-Follow-up |
| 2 | 忘记密码 + 重置密码 | V2.2 |
| 3 | 邮箱确认链接升级为邮箱验证码（可选） | V2.2 |
| 4 | 账号安全优化（密码强度/登录历史） | V2.2 |

---

## 五、Supabase Auth API 迁移

### 5.1 API 对照表

| 操作 | Magic Link（旧） | Email+Password（新） |
|------|-----------------|---------------------|
| 注册 | `signInWithOtp({ email })` + `shouldCreateUser: true` | `signUp({ email, password })` |
| 登录 | 点击 Magic Link → `verifyOtp({ token_hash, type })` | `signInWithPassword({ email, password })` |
| 登出 | `signOut()` | `signOut()` ✅ 不变 |
| 获取用户 | `getUser()` | `getUser()` ✅ 不变 |
| Session 监听 | `onAuthStateChange()` | `onAuthStateChange()` ✅ 不变 |

### 5.2 useAuth Hook 接口变更

```typescript
// === 旧接口 (Magic Link) ===
interface UseAuthReturn {
  user: AuthUser | null;
  isLoading: boolean;
  signIn(email: string): Promise<void>;              // → signInWithOtp
  verifyOtp(email: string, token: string): Promise<void>;  // → verifyOtp
  signOut(): Promise<void>;
}

// === 新接口 (Email+Password) ===
interface UseAuthReturn {
  user: AuthUser | null;
  isLoading: boolean;
  signUp(email: string, password: string): Promise<void>;   // 新增
  signIn(email: string, password: string): Promise<void>;   // 签名变更
  signOut(): Promise<void>;                                   // 不变
}
```

**关键变更说明**：

- `signIn` 签名从 `(email)` 变为 `(email, password)`——前端调用方需更新
- `verifyOtp` 移除——email+password 不需要验证码
- `signUp` 新增——注册入口，调用 `supabase.auth.signUp()`
- `user` / `isLoading` / `signOut` 不变

### 5.3 useAuth 内部实现变更

```typescript
// 注册
async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  if (error) throw error;
  // data.user 可能为 null（如果开启了邮箱确认）
  // data.session 可能为 null（邮箱未确认时无 session）
  // 返回后 UI 显示"请查看邮箱确认链接"
}

// 登录
async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  // data.session 存在 → onAuthStateChange 触发 → user 状态更新
}
```

---

## 六、前端架构变更

### 6.1 数据流对比

**Magic Link（旧）**：
```
AuthModal                    useAuth                      Supabase
   │                           │                             │
   ├── signIn(email) ────────► ├── signInWithOtp() ────────► │ 发送邮件
   │                           │                             │
   │   "请查看邮箱"             │                             │
   │                           │                             │
   │   [用户点击邮件链接]        │                             │
   │                           │                             │
   │   /auth/callback ───────► ├── verifyOtp() ────────────► │ 验证
   │                           │ ◄── session ─────────────── │
   │                           │ onAuthStateChange → user    │
   │ ◄── user state ────────── │                             │
```

**Email+Password（新）**：
```
AuthModal                    useAuth                      Supabase
   │                           │                             │
   │  [注册模式]                │                             │
   ├── signUp(email, pw) ────► ├── signUp() ──────────────► │ 创建用户
   │                           │ ◄── user (unconfirmed)      │ 发送确认邮件
   │   "请查看邮箱确认"         │                             │
   │                           │                             │
   │  [登录模式]                │                             │
   ├── signIn(email, pw) ────► ├── signInWithPassword() ──► │ 验证
   │                           │ ◄── session ─────────────── │
   │                           │ onAuthStateChange → user    │
   │ ◄── user state ────────── │                             │
```

### 6.2 page.tsx 集成

`page.tsx` 当前集成方式：

```typescript
// 当前（不变）
const { user, isLoading, signIn, signOut } = useAuth();
// Header 中消费 user / isLoading / signIn / signOut
// AuthModal 中消费 signIn
```

V2.1 后：

```typescript
// V2.1（signIn 签名变化，但 page.tsx 不直接调用 signIn）
const { user, isLoading, signIn, signOut } = useAuth();
// page.tsx 不直接调用 signIn —— 由 AuthModal 调用
// page.tsx 只传 signIn 给 Header → AuthModal
// 所以 page.tsx 不需要改
```

`page.tsx` **不需要修改**。Header 和 AuthModal 的 props 调整在组件内部消化。

---

## 七、组件变更设计

### 7.1 AuthModal 重构

**当前 AuthModal**：单个邮箱输入框 + "发送登录链接"按钮 → 显示"请查看邮箱"

**V2.1 AuthModal**：双模式（登录 / 注册），Tab 切换：

```
┌────────────────────────────────────────────┐
│                                            │
│          [登录]    |    注册                │
│          ——————                           │
│                                            │
│    ┌──────────────────────────────────┐    │
│    │  your@email.com                  │    │
│    └──────────────────────────────────┘    │
│    ┌──────────────────────────────────┐    │
│    │  密码（至少 6 位）                │    │
│    └──────────────────────────────────┘    │
│                                            │
│    ┌──────────────────────────────────┐    │
│    │           登  录                  │    │
│    └──────────────────────────────────┘    │
│                                            │
│    没有账号？切换到「注册」创建账号。        │
│                                            │
└────────────────────────────────────────────┘

注册模式（多一个确认密码字段）：

┌────────────────────────────────────────────┐
│                                            │
│          登录    |    [注册]                │
│                       ——————               │
│                                            │
│    ┌──────────────────────────────────┐    │
│    │  your@email.com                  │    │
│    └──────────────────────────────────┘    │
│    ┌──────────────────────────────────┐    │
│    │  密码（至少 6 位）                │    │
│    └──────────────────────────────────┘    │
│    ┌──────────────────────────────────┐    │
│    │  确认密码                         │    │
│    └──────────────────────────────────┘    │
│                                            │
│    ┌──────────────────────────────────┐    │
│    │           注  册                  │    │
│    └──────────────────────────────────┘    │
│                                            │
│    已有账号？切换到「登录」。               │
│                                            │
└────────────────────────────────────────────┘
```

**注册成功后的状态**（邮箱确认已开启）：

```
┌────────────────────────────────────────────┐
│                                            │
│          ✅ 注册成功                        │
│                                            │
│    确认邮件已发送至 your@email.com          │
│    请前往邮箱点击确认链接，然后登录。        │
│                                            │
│              [关闭]                         │
│                                            │
└────────────────────────────────────────────┘
```

**关键设计细节**：

| 元素 | 设计 |
|------|------|
| 模式切换 | Tab 切换（登录 / 注册），默认"登录" |
| 邮箱输入 | `type="email"`，移动端触发邮箱键盘 |
| 密码输入 | `type="password"`，`minLength={6}`，有显示/隐藏切换 |
| 确认密码 | 仅注册模式显示，前端校验一致性 |
| 提交按钮 | 登录："登录"；注册："注册" |
| 加载状态 | 按钮显示"登录中..." / "注册中..."，disabled |
| 错误提示 | 邮箱格式错误 / 密码太短 / 密码不一致 / 登录失败 / 注册失败 — 红色内联文字 |
| 成功提示 | 注册成功后显示确认邮件提示（蓝色 info 框） |
| 关闭方式 | 点击遮罩 / 右上角 ✕ / ESC 键 |
| 底部提示 | 登录模式：「没有账号？切换到「注册」」<br>注册模式：「已有账号？切换到「登录」」 |

### 7.2 Header 变更

**当前 Header**（不变的部分）：

```typescript
const { user, isLoading, signIn, signOut } = useAuth();
```

**V2.1 Header 变更**：

- `signIn` 签名变了（现在需要 `email + password`），但 Header 只是把 `signIn` 传给 AuthModal，不直接调用
- AuthModal 的 `onSignIn` prop 签名从 `(email: string)` 变为 `(email: string, password: string)`
- Header 自身只需微调 props 透传

**Header 实际改动**：约 2 行——`onSignIn` → `onSignIn` + 新增 `onSignUp` prop 传递，或统一为一个 auth 对象。

### 7.3 前端校验规则

| 校验项 | 规则 | 位置 |
|--------|------|------|
| 邮箱格式 | `type="email"` 浏览器原生 + 非空 | AuthModal 前端 |
| 密码长度 | ≥ 6 位（Supabase 默认要求） | AuthModal 前端 + Supabase 后端 |
| 确认密码 | 与密码一致（仅注册模式） | AuthModal 前端 |
| 登录失败 | Supabase 返回错误 → 显示中文提示 | useAuth catch → AuthModal |
| 注册失败 | 同上（如邮箱已注册） | useAuth catch → AuthModal |

### 7.4 错误码映射

Supabase Auth 常见错误 → 用户中文提示：

| Supabase Error | 中文提示 |
|----------------|---------|
| `Invalid login credentials` | 邮箱或密码错误，请重试。 |
| `User already registered` | 该邮箱已注册，请直接登录。 |
| `Password should be at least 6 characters` | 密码至少需要 6 位。 |
| `Unable to validate email address: invalid format` | 邮箱格式不正确。 |
| `Email not confirmed` | 邮箱尚未确认，请先点击确认邮件中的链接。 |

---

## 八、Email 确认流程

### 8.1 设计决策

**开启邮箱确认。** 理由：

1. 防止机器人批量注册垃圾账号
2. 确保用户邮箱真实可用（为后续"忘记密码"做准备）
3. Supabase 内置支持，零开发成本

### 8.2 确认流程

```
用户注册
  → supabase.auth.signUp({ email, password })
  → Supabase 自动发送确认邮件
  → 用户收到邮件，点击确认链接
  → GET /auth/callback?token_hash=xxx&type=email
  → callback route 调用 supabase.auth.verifyOtp()
  → 邮箱确认完成
  → 重定向到 /?signup_confirmed=true（可选，用于显示欢迎提示）

用户尝试登录
  → supabase.auth.signInWithPassword({ email, password })
  → 如果邮箱未确认：
    Supabase 默认行为是允许登录（取决于 Dashboard 设置）
    推荐设置："Allow unconfirmed email sign in" = OFF
    → 未确认邮箱无法登录 → 提示"请先点击确认邮件中的链接"
```

### 8.3 auth/callback/route.ts 变更

当前 callback route 处理两种场景：
- Magic Link: `token_hash` + `type=magiclink`
- OTP Code: `code` → `exchangeCodeForSession`

V2.1 变更：
- 移除 Magic Link 处理（不再发送 Magic Link）
- 保留 `token_hash` 处理（`type=email` → 邮箱确认回调）
- 移除 `exchangeCodeForSession`（不再使用 `code` 参数）

```typescript
// V2.1 callback route 简化逻辑
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");  // "email"
  const redirectUrl = getRedirectUrl(request);

  if (!tokenHash || !type) {
    // 无 token，直接重定向到首页
    return NextResponse.redirect(redirectUrl);
  }

  // verifyOtp 用于邮箱确认
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  });

  if (error) {
    // 确认失败 → 重定向到首页（带错误参数，可选）
    return NextResponse.redirect(redirectUrl);
  }

  // 确认成功 → 重定向到首页
  return NextResponse.redirect(redirectUrl);
}
```

### 8.4 Supabase Dashboard 配置

V2.1 上线前需在 Supabase Dashboard 配置：

| 设置项 | 位置 | 推荐值 |
|--------|------|:--:|
| Confirm email | Authentication → Settings → Email | **ON** |
| Allow unconfirmed sign in | 同上 | **OFF** |
| SMTP Sender | 同上 | 配置自定义发件人（可选，V2.1-Follow-up） |
| 邮件模板 | Authentication → Email Templates | 更新为中文文案 |

> ⚠️ **重要**：如果使用自定义 `/auth/callback` 处理邮箱确认，需要在 Supabase Dashboard 的 **Confirm signup** 邮件模板中，把默认的 `{{ .ConfirmationURL }}` 替换为：
> ```
> {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email
> ```
> 否则 Supabase 会使用默认确认链接（指向 Supabase 域名而非自定义 callback route）。同时 **Site URL** 和 **Redirect URLs** 仍需配置为生产 Vercel 域名和 localhost（如 `http://localhost:3000`）。

---

## 九、Session 管理

### 9.1 Session 持久化

**不变。** Supabase Auth 的 session 管理机制与 Magic Link 完全相同：

- Session 存储在 httpOnly cookie 中（`sb-xxx-auth-token`）
- `onAuthStateChange` 监听 session 变化
- `getAuthenticatedUserId()` 在服务端从 cookie 读取 session
- 刷新页面后 session 自动恢复

Email+Password 登录后，`signInWithPassword` 的返回值中已包含 session，Supabase JS SDK 自动将 session 写入 cookie。**不需要 callback route 参与登录流程**——这消除了 Magic Link 的 cookie 时序问题。

### 9.2 Session 过期

| 项目 | 值 |
|------|-----|
| Session 有效期 | Supabase 默认 1 小时（access token） |
| Refresh Token 有效期 | Supabase 默认 7 天 |
| 自动刷新 | `@supabase/ssr` 自动处理 |
| 过期后行为 | API Route 中 `getAuthenticatedUserId()` 返回 null → 回退 device_id 模式 |

### 9.3 登出

**不变。** `supabase.auth.signOut()` → 清除 cookie → `onAuthStateChange` 触发 → `user` 变为 `null` → Header 恢复"登录"按钮 → useTaskGroup 回退 device_id 模式。

---

## 十、匿名↔登录迁移

### 10.1 迁移逻辑

**完全不变。** 迁移逻辑与 Magic Link 完全相同：

```
useTaskGroup.restoreForAuthUser():
  1. 检测 user.id 存在
  2. 调用 POST /api/task-group/migrate { deviceId }
  3. API Route 从 session 获取 userId → UPDATE task_groups SET user_id = session.user.id
  4. 清除 device scope localStorage
  5. 从 user scope 恢复数据
```

### 10.2 为什么迁移不受影响

迁移依赖的是 `getAuthenticatedUserId()` → `user.id`。无论用户通过 Magic Link 还是 Email+Password 登录，`getAuthenticatedUserId()` 返回的 `user.id` 是完全一样的（Supabase Auth UUID）。迁移的 API Route 和 useTaskGroup 逻辑零改动。

---

## 十一、Phase 15 兼容性

### 11.1 generate-tasks API

Phase 15 在 `POST /api/generate-tasks` 中读取 stats 的逻辑：

```typescript
const userId = await getAuthenticatedUserId();
// 有 userId → 基于 user_id 读 stats → computeAdjustment → 增强 Prompt
// 无 userId → 基于 device_id 读 stats → computeAdjustment → 增强 Prompt
```

**完全不受影响。** `getAuthenticatedUserId()` 的返回值不依赖登录方式。

### 11.2 device_id 回退

未登录或 session 过期时，`getAuthenticatedUserId()` 返回 `null` → 走 device_id 路径。Email+Password 的 session 过期行为与 Magic Link 完全相同。

---

## 十二、Phase 14 兼容性

### 12.1 AI 复盘 API

`POST /api/task-groups/review` 依赖：

```typescript
const userId = await getAuthenticatedUserId();
// 用于：canAccessTaskGroup()、computeAllStats() 的 owner filter
```

**完全不受影响。** `callAIWithPrompts` 和 review 业务逻辑零改动。

---

## 十三、安全边界

### 13.1 不变的安全规则

| # | 规则 | 状态 |
|---|------|:--:|
| 1 | Service Role Key 不暴露到前端 | ✅ 不变 |
| 2 | userId 只来自服务端 session | ✅ 不变 |
| 3 | 前端请求体不包含 userId | ✅ 不变 |
| 4 | API Route 不信任前端传来的 userId | ✅ 不变 |
| 5 | 登出后不能访问 user_id 数据 | ✅ 不变 |
| 6 | Session cookie httpOnly | ✅ 不变 |

### 13.2 新增安全考虑

| # | 考虑 | 措施 |
|---|------|------|
| 1 | 密码传输安全 | Supabase API 使用 HTTPS，密码不经过 Next.js 服务端 |
| 2 | 密码强度 | 前端 `minLength={6}` + Supabase 后端默认要求 ≥6 位 |
| 3 | 暴力破解 | Supabase 内置 rate limit；后续 V2.1-Follow-up 加 Turnstile |
| 4 | 密码泄露 | 密码不存储在本地数据库（只存在 Supabase Auth 的 `auth.users` 表中，加密存储） |
| 5 | 前端密码泄露风险 | 密码只在 AuthModal 的 React state 中短暂存在，登录/注册后立即从内存中释放（不存 localStorage、不存 cookie 明文、不传给自己 API） |

### 13.3 关键安全点

> ⚠️ **Email+Password 的安全性特点**：
>
> 密码由 Supabase Auth 直接处理（`signInWithPassword` / `signUp`）。Next.js 服务端**永不接触**用户密码。密码通过 HTTPS 从浏览器直接发送到 Supabase Auth API。
>
> 因此 V2.1 不会引入密码在服务端日志/内存中泄露的风险。

---

## 十四、文件变更清单

| # | 文件 | 操作 | 预计行数 | 说明 |
|---|------|:---:|:---:|------|
| 1 | `src/hooks/useAuth.ts` | **修改** | ~80 改 | `signIn` 改为 email+password；新增 `signUp`；移除 `verifyOtp` |
| 2 | `src/components/AuthModal.tsx` | **重写** | ~200 | 双模式（登录/注册）；email+password+confirm；Tab 切换 |
| 3 | `src/app/auth/callback/route.ts` | **简化** | ~60 | 移除 Magic Link 处理，保留 `verifyOtp` 用于邮箱确认 |
| 4 | `src/lib/constants.ts` | **修改** | ~30 | AUTH_TEXT 更新（移除 Magic Link 文案，新增注册相关） |
| 5 | `src/components/Header.tsx` | **修改** | ~5 | AuthModal props 适配（signIn 签名变化） |

**总计：5 个文件，约 375 行变更（~200 新增 + ~175 删除）。**

---

## 十五、不修改文件清单

以下文件 **V2.1 完全不动**（与执行方案中的禁止修改清单一致）：

```
# 服务端基础设施（getAuthenticatedUserId 不变）
src/lib/supabase-server.ts
src/lib/supabase-client.ts

# API Routes（全部 session-aware，不变）
src/app/api/generate-tasks/route.ts
src/app/api/task-group/save/route.ts
src/app/api/task-group/load/route.ts
src/app/api/task-group/delete/route.ts
src/app/api/task-group/migrate/route.ts
src/app/api/task-groups/review/route.ts
src/app/api/task-groups/stats/route.ts
src/app/api/task-groups/history/route.ts
src/app/api/auth/me/route.ts

# 前端 Hooks
src/hooks/useTaskGroup.ts
src/hooks/useTaskReview.ts
src/hooks/useTaskStats.ts
src/hooks/useTaskHistory.ts

# 核心组件
src/app/page.tsx
src/components/GoalInput.tsx
src/components/TaskList.tsx
src/components/StatsBar.tsx
src/components/HistoryPanel.tsx
src/components/TaskReviewPanel.tsx

# AI 相关
src/lib/ai-client.ts
src/lib/task-parser.ts
src/lib/review-parser.ts
src/prompts/task-generation.ts
src/prompts/task-review.ts

# 其他
src/lib/types.ts
src/lib/stats-calculator.ts
src/lib/adjust-task-strategy.ts
src/lib/storage.ts
src/lib/device-id.ts
src/lib/input-validator.ts
src/lib/date-utils.ts
package.json
数据库 schema / migration
.env.local
```

---

## 十六、风险矩阵

| # | 风险 | 等级 | 影响 | 缓解措施 |
|---|------|:---:|------|---------|
| 1 | `signInWithPassword` 在 Vercel Serverless 中 cookie 写入失败 | **P1** | 用户登录后 session 丢失 | 使用 `@supabase/ssr` 的 `createBrowserClient`（已用于 Magic Link，验证过 cookie 机制），不同于 callback route 的重定向 cookie 写入 |
| 2 | 邮箱确认邮件被归入垃圾箱 | **P1** | 用户注册后无法确认 | Supabase Dashboard 配置自定义 SMTP；邮件模板中文优化 |
| 3 | 现有 Magic Link 用户无法登录（无密码） | **P2** | 老用户需要重新注册 | V2.1 上线时 Supabase Auth 中已有用户数量极少（测试阶段）；可提示"如之前使用过链接登录，请重新注册" |
| 4 | 密码管理负担（用户忘记密码） | **P2** | 登录失败 → 放弃使用 | 浏览器密码管理器自动填充；V2.2 加入"忘记密码" |
| 5 | `signIn` 签名变化导致 Header 传参错误 | **P2** | TypeScript 编译时即可发现 | lint + build 作为门禁 |
| 6 | AuthModal 状态机复杂度增加（登录/注册/成功/错误） | **P2** | UI bug | 每个状态有独立渲染分支，参考现有 AuthModal 的 message/error 模式 |
| 7 | Supabase `signUp` 的 `data.user` 行为变化（email confirm ON 时 user 返回但 session 为 null） | **P2** | 注册后自动登录逻辑需区分 confirm ON/OFF | 注册成功后不依赖 session 判断——直接提示"请查看邮箱确认" |

---

## 十七、子 Phase 拆分

### V2.1A：Auth 核心（useAuth + callback + constants）

| 项目 | 内容 |
|------|------|
| 目标 | useAuth Hook 改造 + callback route 简化 + 文案更新 |
| 文件 | `useAuth.ts` / `auth/callback/route.ts` / `constants.ts` |
| 允许 | signIn → signInWithPassword；signUp 新增；verifyOtp 移除；AUTH_TEXT 更新 |
| 禁止 | 不改 UI 组件；不改 API Route |
| 验收 | lint + build 通过；TypeScript 编译无 error |

### V2.1B：Auth UI（AuthModal 重写 + Header 适配）

| 项目 | 内容 |
|------|------|
| 目标 | 双模式 AuthModal + Header 适配 |
| 文件 | `AuthModal.tsx` / `Header.tsx` |
| 允许 | AuthModal 完全重写；Header props 微调 |
| 禁止 | 不改 page.tsx；不改其他组件；不改 API Route |
| 验收 | lint + build 通过；手机端 UI 正常；登录/注册 Tab 切换正常；密码显示/隐藏正常 |

### V2.1C：集成验证 + 部署

| 项目 | 内容 |
|------|------|
| 目标 | Supabase Dashboard 配置 + Vercel 部署验证 |
| 执行 | 人工操作（Dashboard 配置 + 部署 + 冒烟测试） |
| 文件 | 不修改代码（Dashboard 配置不算代码变更） |
| 验收 | 全部验收标准通过（见 §十八） |

---

## 十八、验收标准

### 18.1 功能验收

| # | 验收项 | 方法 |
|---|--------|------|
| 1 | 邮箱+密码注册成功 | 输入新邮箱+密码 → 注册 → 显示"请查看邮箱确认" |
| 2 | 邮箱确认链接可用 | 点击邮件链接 → 跳回网站 → 邮箱状态变为"已确认" |
| 3 | 邮箱+密码登录成功 | 输入已确认的邮箱+密码 → 登录 → Header 显示邮箱 |
| 4 | 登录后刷新保持登录态 | 登录 → F5 刷新 → 仍显示已登录 |
| 5 | 登出正常 | 点击登出 → Header 恢复"登录"按钮 |
| 6 | 未登录生成任务正常 | 不登录 → 输入目标 → 生成任务 → 正常 |
| 7 | 未登录勾选任务正常 | 勾选 → StatsBar 更新 → 正常 |
| 8 | 匿名任务迁移正常 | 未登录生成任务 → 登录 → 任务绑定到 user_id |
| 9 | 未登录生成复盘正常 | 不登录 → 生成任务 → 生成复盘 → 正常 |
| 10 | 登录后生成复盘正常 | 登录 → 生成任务 → 生成复盘 → 正常 |
| 11 | Phase 15 智能调整基于 user_id | 登录 → 多次生成/完成 → stats 积累 → 下次生成有调整建议 |
| 12 | 未登录 Phase 15 基于 device_id | 清除登录 → 基于 device_id 的 stats → 正常 |
| 13 | 手机端登录 UI 正常 | 375px 宽度 → AuthModal 不溢出 → 输入框可操作 |
| 14 | 注册表单校验正常 | 空邮箱/短密码/密码不一致 → 显示对应错误提示 |
| 15 | 登录错误提示正常 | 错误密码 → 显示"邮箱或密码错误" |

### 18.2 安全验收

| # | 验收项 | 方法 |
|---|--------|------|
| 16 | 前端请求体不含 userId | DevTools Network → generate-tasks/save/load 请求 → 无 userId |
| 17 | 前端请求体不含 password | DevTools Network → 所有请求 body → 不含 password（密码直连 Supabase） |
| 18 | Service Role Key 不出现在前端 | DevTools Sources → 搜索 `sb_secret` → 无结果 |
| 19 | 登出后 API 不能访问 user_id 数据 | 登出 → curl 测试 → 回退 device_id |

### 18.3 回归验收

| # | 验收项 | 方法 |
|---|--------|------|
| 20 | TaskList 正常 | 登录/未登录 → 任务列表 → 勾选/取消 |
| 21 | StatsBar 正常 | 统计数字 → 4 卡片展示 → 不溢出 |
| 22 | HistoryPanel 正常 | 历史记录 → 展开/收起 → 正常 |
| 23 | AI 复盘正常 | 生成复盘 → stale → 重新生成 |
| 24 | lint 通过 | `npm run lint` |
| 25 | build 通过 | `npm run build` |

### 18.4 兼容验收

| # | 验收项 |
|---|--------|
| 26 | Phase 14 AI 复盘不受影响 |
| 27 | Phase 15 智能调整不受影响 |
| 28 | V2.0 所有 API 不受影响 |
| 29 | localStorage scope 隔离不变 |
| 30 | 多设备数据不串号 |

---

> **下一阶段**：本文档经 ChatGPT Review 通过后，由 Claude Code 写 `docs/Execution-Plan-V2.1-Auth.md`（V2.1 Auth 执行方案），再由 Codex 按执行方案实现。
