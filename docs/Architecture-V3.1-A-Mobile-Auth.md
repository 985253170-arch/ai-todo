# Architecture V3.1-A — Mobile 真实认证

> **状态：** Architecture 已通过 ChatGPT Review；不是 Execution Plan，不构成代码授权。
>
> **Architecture Review：** 通过；P0：0；P1：0；P2：3。
>
> **P2（非阻断，必须在 Execution Plan 锁定）：**
> 1. A1.5 验证入口须由 Execution Plan 唯一选择并单独授权；
> 2. Mock adapter 最小内存 Session / `passwordSet` / local signOut 实现细节；
> 3. 页面局部错误与 transient `AuthState.error` 清理细节。
>
> **阶段：** V3.1-A — Mobile 真实认证流程接入。
>
> **创建日期：** 2026-07-19。
>
> **代码基线：** `cd72d5cd6fda5246fb9700f2739a9849068af48d`（Handoff 文档提交）；最新功能代码基线为 `9dcab1f4b20a3df3f7fce0d22ef99cfa21b7179b`（V3.0D-D3）。两者用途不同，不得混淆。
>
> **本文件权限：** 本次只创建本文档。本文不修改、删除或授权修改任何代码、配置、环境变量、Supabase、数据库、API Route 或 Mock 文件。

---

## 1. 文档状态与阶段边界

### 1.1 当前状态

| 项目 | 状态 |
|---|---|
| V3.0D | 已正式完成并关闭。 |
| V3.1-A 前置只读审计 | 已完成并经 ChatGPT 审查通过。 |
| V3.1-A Architecture | 已完成并通过 ChatGPT Review；P0：0，P1：0，P2：3。 |
| V3.1-A Execution Plan | 尚未创建；Architecture 与现行产品文档已完成同步。下一步由 Claude Code 编写 Execution Plan；Execution Plan 仍须经 ChatGPT 审查通过后，才可能授权 Codex 施工。 |
| V3.1-A 代码施工 | 尚未开始。 |
| Codex | 未获得写代码授权。 |

非阻断 P2：

1. A1.5 验证入口须由 Execution Plan 唯一选择并单独授权；
2. Mock adapter 最小内存 Session / `passwordSet` / local signOut 实现细节；
3. 页面局部错误与 transient `AuthState.error` 清理细节。

### 1.2 本文解决的架构问题

1. 在不删除、不覆盖任何 Mock 的前提下，接入真实 Supabase Email Auth。
2. 让 Auth 页面只依赖统一 Auth facade，而不是 Mock、Supabase client 或环境变量。
3. 锁定已有账号 OTP 登录、注册 OTP、首次设置密码、密码登录和登出的唯一状态机。
4. 让 [page.tsx](../apps/mobile-app/app/page.tsx) 成为真实 Auth 状态的单一顶层所有者。
5. 锁定同源目标部署，保证后续 V3.1-B 的根 API 能继续从 Cookie Session 识别用户。
6. 明确 V3.1-A 的 Auth 范围与 V3.1-B 的业务数据 adapter 范围。

### 1.3 本文不授权的事项

本文**不授权**：

- 创建 Execution Plan；
- 编写或修改 mobile 代码；
- 安装 Supabase 依赖；
- 设置或修改环境变量；
- 修改 `src/**`、根 API Route、根配置；
- 创建、迁移或修改数据库 / Supabase RLS；
- 删除、覆盖或重写任何 `*.mock.ts`；
- 任务、历史、成长、AI Companion、deviceId 或匿名任务迁移；
- UI 自由重做、Auth 子路由、第二套 AppShell、第二个 BottomTabBar；
- Codex 施工、commit 或 push。

---

## 2. 当前事实与审计结论

### 2.1 Git 门禁结论

本 Architecture 开始前的只读 Git 核验结果：

```text
仓库根目录：C:/Dev/ai-todo
分支：main
HEAD：cd72d5cd6fda5246fb9700f2739a9849068af48d
origin/main：cd72d5cd6fda5246fb9700f2739a9849068af48d
HEAD = origin/main：是
staged：空
tracked 工作区：干净
```

仅存在已知且长期忽略的未跟踪项：`.agents/`、`.claude/`、`.codex/`、`.vscode/`、`skills-lock.json`、`start`、`stop`、`test_photo.jpeg`。本文不处理它们。

### 2.2 Mobile 当前事实

- [apps/mobile-app/](../apps/mobile-app/) 是独立 Next.js App Router 工程；当前无 Supabase 依赖、无 API client、无 auth provider、无 real adapter。
- [app/page.tsx](../apps/mobile-app/app/page.tsx) 以 `authState: "guest" | "authenticated"` 和 `authScreen` 管理整个 Auth 入口；`handleLoginSuccess()` 只切换本地 boolean，`handleLogout()` 只清空 React state。
- [OtpLoginPage.tsx](../apps/mobile-app/components/auth/OtpLoginPage.tsx) 用 `setTimeout` 模拟发送，任何 6 位数字都会进入 AppShell；它当前不调用 service。
- [PasswordLoginPage.tsx](../apps/mobile-app/components/auth/PasswordLoginPage.tsx) 与 [RegisterPage.tsx](../apps/mobile-app/components/auth/RegisterPage.tsx) 直接 import `authService.mock.ts`。
- [authService.mock.ts](../apps/mobile-app/services/authService.mock.ts) 导出了 Mock login、register、logout、getCurrentUser；其中 `getCurrentUser()` 当前没有页面调用方。
- [MeAccountCard.tsx](../apps/mobile-app/components/me/MeAccountCard.tsx) 硬编码 `user@example.com`；[MeSyncCard.tsx](../apps/mobile-app/components/me/MeSyncCard.tsx) 硬编码“已同步”和任务跨设备保存承诺。
- [AuthShell.tsx](../apps/mobile-app/components/auth/AuthShell.tsx) 已提供 Auth 的单实例手机壳与安全区；Auth 页面没有 BottomTabBar。
- [BackControllerContext.tsx](../apps/mobile-app/contexts/BackControllerContext.tsx) 已是全项目唯一 `popstate` / `pageshow` 监听器；不得替换或新增第二个监听器。

### 2.3 旧真实 Auth 当前事实

- [src/hooks/useAuth.ts](../src/hooks/useAuth.ts) 已证明旧工程具备 `signInWithOtp`、`verifyOtp`、`signInWithPassword`、`updateUser` 设置密码、`signOut`、`getUser` 和 `onAuthStateChange`。
- 旧 `sendOtp()` 当前固定 `shouldCreateUser: true`，不适用于本阶段已锁定的“登录意图不得创建未知账号”。mobile Real adapter 必须独立传递 intent，不得直接复用该 Hook 的行为。
- [src/lib/supabase-client.ts](../src/lib/supabase-client.ts) 使用 `@supabase/ssr` 的 `createBrowserClient()`，只使用 `NEXT_PUBLIC_SUPABASE_URL` 与 legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`；这是旧根工程事实，不是 mobile 新工程方案。
- [src/lib/supabase-server.ts](../src/lib/supabase-server.ts) 的 `getAuthenticatedUserId()` 从服务端请求 Cookie 创建 Auth client，再调用 `auth.getUser()`；旧业务 API 不信任前端提交的 userId。
- [src/app/api/auth/me/route.ts](../src/app/api/auth/me/route.ts) 可读取当前请求 Cookie 中的 Session，但没有发送 OTP、验证 OTP、设置密码或密码登录 API。
- [src/app/auth/callback/route.ts](../src/app/auth/callback/route.ts) 是邮件链接 `token_hash` callback，不是 mobile 6 位验证码流程的必要调用链。
- [src/lib/auth-errors.ts](../src/lib/auth-errors.ts) 已有旧 Web 的敏感信息脱敏思路，但它属于 `src/**`，V3.1-A 不修改也不直接 import；mobile 应建立自己的归一化错误契约。

### 2.4 前置审计结论

| 审计结论 | Architecture 响应 |
|---|---|
| R1：OTP 是假流程，顶层只有 boolean Auth。 | 用真实 AuthState、facade、Root state ownership 和 Session gate 替代。 |
| R2：无 facade / Real adapter / client / 切换点。 | 新增单一 facade selector、Mock adapter、Real adapter、browser client。 |
| R3：跨域在现有边界不可行。 | 选择外部同源反向代理 / 网关；跨域明确不采用。 |
| R4：`MockUser` 不足，Register 流程冲突。 | 保留旧 Mock 类型，新增 AuthUser / AuthStatus / OtpIntent 等真实 Auth 类型，并重构页面状态机。 |
| R5：旧 V2.1 Auth Architecture 已过期。 | 本文为唯一面向 mobile V3.1-A 的新 Architecture；不复用归档方案。 |

---

## 3. 目标与不做范围

### 3.1 目标

V3.1-A 的唯一业务目标是让清行 mobile 的账号认证真实可用：

```text
Welcome
→ 验证码登录（已有账号）或显式注册（新账号）
→ 真实 Supabase Session
→ 必要时首次设置密码
→ 唯一 AppShell
→ 我的页显示真实账号已登录
```

同时，开发和测试环境仍能通过统一 facade 使用 Mock，不改变现有今日、足迹、成长、任务执行、AI Guide / Feedback 的 Mock 数据链。

### 3.2 不做范围

以下明确推迟至 V3.1-B：

- 真实任务生成、当前任务读取、保存、完成；
- deviceId 创建、匿名任务持久化、匿名任务迁移的实际调用；
- 历史、足迹、成长、统计、AI 复盘；
- AI Guide、Feedback、Companion、Assist；
- `resolved_today` 状态映射；
- 任务数据同步和“所有记录已同步”；
- 旧 API TaskGroup 与 mobile TodayState 的所有数据适配。

Auth 成功只证明“账号已登录”。它**不证明** mobile Mock 任务已保存到真实后端，也不证明跨设备任务数据已同步。

---

## 4. 产品流程锁定

### 4.1 入口

保持既有、已验收的入口：

```text
Welcome
→ 点击“开始使用”
→ otp-login 的 email-entry
```

不新增 Welcome 第二个主按钮，不在 Welcome 增加密码入口，不在 Auth 页面显示 BottomTabBar。

### 4.2 登录与注册语义

| 流程 | 意图 | OTP 发送策略 | 验证成功后的去向 |
|---|---|---|---|
| 验证码登录 | 已有账号登录 | `shouldCreateUser: false` | `passwordSet=true` → AppShell；否则 → 必须设置密码。 |
| 显式注册 | 新账号创建 | `shouldCreateUser: true` | Session 已建立 → 必须设置密码 → AppShell。 |
| 密码登录 | 已有账号登录 | 不发送 OTP | 密码验证成功 → 直接 `authenticated` → AppShell；metadata 仅 best-effort 补写。 |

登录与注册共用 OTP 能力和验证码视觉交互，但必须传递不同 `OtpIntent`。页面不得通过“登录时默认为 true”静默创建未知账号。

### 4.3 产品冲突解决与文档优先级

当前有效需求锁定文档 [V3.1-A-Auth-Flow-Lock.md](V3.1-A-Auth-Flow-Lock.md) 与 Roadmap 曾保留“新邮箱在验证码登录中自动创建账号并登录”的旧表述。该旧表述已由本 Architecture 取代；Auth Flow Lock 与 Roadmap 已在 Architecture Review 通过后完成同步。

当前四份现行文档统一采用唯一流程：

```text
OTP 登录 intent
→ shouldCreateUser: false
→ 仅用于已有账号

显式 Register intent
→ shouldCreateUser: true
→ 仅用于创建新账号
```

因此，登录页发现未知邮箱时不静默创建账号，而是以温和文案引导进入 RegisterPage。当前不存在两套产品流程。

### 4.4 已有未设置密码账号

OTP 验证产生 Session 后：

```text
user.metadata.password_set === true
→ authenticated
→ AppShell

user.metadata.password_set !== true
→ authenticated-needs-password
→ 必须设置密码界面
→ setPassword 成功
→ authenticated
→ AppShell
```

此规则只适用于 OTP 登录、注册 OTP 验证和启动恢复。密码登录成功是明确例外：成功本身已经证明该账号具备可用密码，见 §8.3 与 §13.3。

### 4.5 视觉锁定

实现必须保持：暖米白、深蓝、纸张卡片感、大圆角、柔和阴影、温和文案、375–430px 手机结构、390×844 主验收尺寸、AuthShell 单实例和 Auth 页面无 BottomTabBar。

当前 [RegisterPage.tsx](../apps/mobile-app/components/auth/RegisterPage.tsx) 已拥有邮箱、验证码、两次密码的控件及既有 PaperCard 结构；它可在同一页面组件内改为多阶段状态，并复用其密码字段承载“首次设置密码”。因此：

> **不需要额外 UI Spec。**
>
> 前提是后续 Execution Plan 仅在既有 AuthShell、页头、PaperCard 和按钮语言体系内做最小状态 / 文案 / 可达性调整；不得新增第二套认证视觉，也不得自由设计新页面。

---

## 5. 当前架构

```text
┌────────────────────────────────────────────────────────────┐
│ apps/mobile-app/app/page.tsx                               │
│ authState: guest | authenticated（本地 boolean）             │
└────────────────────────────────────────────────────────────┘
                 │
     ┌───────────┼──────────────────────────────┐
     │           │                              │
     ▼           ▼                              ▼
OtpLoginPage  PasswordLoginPage              RegisterPage
  │ setTimeout     │ direct import                │ direct import
  │ any 6 digits   ▼                              ▼
  └──────────→ authService.mock.ts ←──────────────┘
                    │
                    ▼
              MOCK_USER / delay

MeAccountCard：硬编码邮箱
MeSyncCard：硬编码“已同步”
```

当前问题不是页面视觉，而是：页面各自决定 Auth 数据来源；顶层不知道真实 Session；Mock 与 Real 无可替换边界；刷新、跨标签、退出失败和首次设置密码没有真实状态模型。

---

## 6. 目标分层架构

### 6.1 唯一分层

```text
┌───────────────────────────────────────────────────────────────┐
│ Auth 页面 / 我的页                                              │
│ WelcomePage / OtpLoginPage / PasswordLoginPage / RegisterPage │
│ MeView / MeAccountCard / MeSyncCard                            │
└───────────────────────┬───────────────────────────────────────┘
                        │ 仅接收 Props / Auth facade action
                        ▼
┌───────────────────────────────────────────────────────────────┐
│ page.tsx：Auth 状态唯一所有者                                  │
│ AuthState、初始化、Session 订阅、屏幕选择、退出后的状态清理     │
└───────────────────────┬───────────────────────────────────────┘
                        │ 只在此处创建 / 取得一次 facade
                        ▼
┌───────────────────────────────────────────────────────────────┐
│ services/authService.ts：唯一选择点                            │
│ NEXT_PUBLIC_QINGXING_AUTH_MODE → AuthFacade                   │
└───────────────────────┬───────────────────────────┬───────────┘
                        │                           │
                        ▼                           ▼
┌─────────────────────────────────┐  ┌──────────────────────────┐
│ authService.mock-adapter.ts     │  │ authService.real.ts      │
│ 包装既有 authService.mock.ts    │  │ 映射 / 归一化 / 订阅      │
└──────────────┬──────────────────┘  └──────────────┬───────────┘
               │                                     │
               ▼                                     ▼
  既有 Mock functions / 内存状态        lib/supabase-client.ts
                                                    │
                                                    ▼
                                  @supabase/ssr createBrowserClient
                                                    │
                                                    ▼
                                               Supabase Auth
```

### 6.2 分层约束

| 层 | 可以做 | 不可以做 |
|---|---|---|
| 页面 | 表单输入、展示 loading / 归一化错误、调用由顶层传入的 Auth action、报告局部 busy。 | import Mock / Real adapter、import Supabase client、读取环境变量、根据环境选实现。 |
| `page.tsx` | 拥有 AuthState、创建一次 facade、初始化与订阅、根据状态渲染 AuthShell / AppShell、将 user 传给我的页。 | 直接调用 Supabase、持久化密码 / OTP、接入任务 API。 |
| facade selector | 解析唯一模式开关、验证配置、返回稳定 `AuthFacade`。 | 处理页面跳转、写任务数据、暴露 provider 原始 User。 |
| Mock adapter | 包装保留的 mock export，模拟 facade 合约，提供非持久 session。 | 修改原 Mock 文件、伪装为真实凭据、把 Mock Session 当生产 Session。 |
| Real adapter | 调用公开 Supabase browser auth、映射 User、归一化错误、订阅 Auth event。 | service role key、任务数据、userId 可信输入、页面跳转、数据库操作。 |
| browser client | 使用 public URL + publishable key 创建一次客户端。 | 读取 service role key、持久化 OTP / password、承担 UI 状态。 |

### 6.3 页面依赖规则

- `page.tsx` 是唯一直接依赖 `services/authService.ts` 的页面层模块。
- Auth 子页面和我的页只通过 Props 接收 facade action、`AuthUser`、`AuthStatus`、`AuthError` 或父级 callback。
- 因此，它们既不 import `authService.mock.ts`，也不 import future `authService.real.ts` 或 Supabase client。
- `services/index.ts` 不作为 Auth 切换点；它当前仅 re-export Mock，保留现状可避免新旧出口混淆。

---

## 7. Auth facade 契约

### 7.1 契约草案（非实现代码）

以下是供后续 Execution Plan 锁定的 TypeScript 形状，不是本次代码：

```ts
export interface AuthFacade {
  sendOtp(input: SendOtpInput): Promise<AuthResult<OtpDelivery>>;
  verifyOtp(input: VerifyOtpInput): Promise<AuthResult<AuthUser>>;
  signInWithPassword(input: PasswordSignInInput): Promise<AuthResult<AuthUser>>;
  setPassword(input: SetPasswordInput): Promise<AuthResult<AuthUser>>;
  getCurrentUser(): Promise<AuthResult<AuthUser | null>>;
  signOut(): Promise<AuthResult<void>>;
  subscribeAuthState(listener: AuthStateListener): Unsubscribe;
}

export interface SendOtpInput {
  email: string;
  intent: OtpIntent;
}

export interface VerifyOtpInput {
  email: string;
  code: string;
  intent: OtpIntent;
}

export interface PasswordSignInInput {
  email: string;
  password: string;
}

export interface SetPasswordInput {
  password: string;
}

export interface OtpDelivery {
  email: string;
  intent: OtpIntent;
  resendAfterSeconds: 60;
}

export type AuthResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AuthError };

export type AuthOperation =
  | "initialize"
  | "send-otp"
  | "verify-otp"
  | "password-sign-in"
  | "set-password"
  | "sign-out"
  | "session-event";

export type AuthSessionEventType =
  | "INITIAL_SESSION"
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "USER_UPDATED"
  | "PASSWORD_RECOVERY";

export interface AuthSessionEvent {
  type: AuthSessionEventType;
  user: AuthUser | null;
}

export type AuthStateListener = (event: AuthSessionEvent) => void;
export type Unsubscribe = () => void;
```

所有预期失败（包含 provider、网络和配置失败）以 `AuthResult` 返回。页面不接触原始 Supabase error；不可预期的程序异常由 facade 统一转换为 `unknown` 的 `AuthError`。

### 7.2 方法表

| 方法 | 输入 | 成功返回 | Session 影响 | Mock adapter | Real adapter | 页面调用 / loading 所有权 |
|---|---|---|---|---|---|---|
| `sendOtp` | 邮箱、`sign-in` / `sign-up` intent | 邮箱、intent、60 秒重新发送时间 | 不建立 Session | 记录本轮意图与邮箱，模拟可验证发送。 | `signInWithOtp`；登录为 `shouldCreateUser:false`，注册为 `true`。 | OTP / Register 局部 `isSending`；顶层 status 为 `authenticating` 但保持当前屏。 |
| `verifyOtp` | 邮箱、6 位 code、intent | 规范化 `AuthUser` | 成功建立 Session | 调用既有 Mock 登录能力并建立**内存** Mock session。 | `verifyOtp({ email, token: code, type:"email" })`。 | OTP / Register 局部 `isVerifying`；顶层依据 user 决定 needs-password / authenticated。 |
| `signInWithPassword` | 邮箱、password | `AuthUser` | 成功建立或刷新 Session | 包装既有 `loginWithPassword`。 | `signInWithPassword`，映射成功 user。 | Password 页面局部 `isSubmitting`。 |
| `setPassword` | 新 password | 更新后的 `AuthUser`，`passwordSet:true` | 更新已登录 Session 的 User metadata | 优先包装能自然适配的既有 Mock 函数；缺失的 session / passwordSet 语义只由 adapter 最小内存状态补足。 | `updateUser({ password, data:{ password_set:true } })`。 | RegisterPage 的 required-password mode 局部 `isSubmitting`。 |
| `getCurrentUser` | 无 | `AuthUser | null` | 不创建 Session；只读取 / 验证 | 仅返回本 tab 内存 Mock session；硬刷新为 guest。 | 以 `auth.getUser()` 为权威读取。 | 仅 `page.tsx` 初始化 / 失效恢复。 |
| `signOut` | 无；scope 由 facade 固定为 local | `void` | 成功撤销**当前浏览器 Session** | 包装既有 `logout` 并只清当前 facade / 当前 tab 的内存 session，不宣称退出所有设备。 | **必须调用 `auth.signOut({ scope: "local" })`；禁止未指定 scope 的 `auth.signOut()`。** | `page.tsx` 顶层 `signing-out`；MeConfirmSheet 仅展示等待。 |
| `subscribeAuthState` | listener | cleanup | 监听外部 Session 变化 | 同一 facade 生命周期内通知本 adapter 变更。 | `onAuthStateChange()`，映射为不含原始 token 的事件。 | 仅 `page.tsx` 订阅一次。 |

### 7.4 Session 事件契约、初始化与并发策略

Real adapter 必须将 Supabase 回调归一化为 §7.1 的 `AuthSessionEvent`，只向顶层传递 `type` 与最小 `AuthUser | null`。`page.tsx` 必须严格区分下列三个不可以合并的并发控制概念：

| 概念 | 唯一职责 | 不负责 |
|---|---|---|
| `subscriptionGeneration` | 当前 `useEffect` 生命周期、cleanup、React Strict Mode 重放、组件卸载与旧订阅失效。 | Auth 事件顺序或页面 action 新旧判断。 |
| `authRevision` | Auth 状态事件顺序；使旧初始化和迟到 action 结果不能覆盖新 Auth event。 | effect 生命周期或页面请求唯一性。 |
| 页面 `requestId` / action generation | 单个页面 action 的新旧判断：页面卸载、AuthScreen 改变、用户重发同类请求或更高优先级 Session event 到达后，旧 action 不得写回局部页面或顶层 AuthState。 | 替代 `subscriptionGeneration` 或 `authRevision`。 |

| Provider event | facade 行为 | page.tsx 行为 |
|---|---|---|
| `INITIAL_SESSION` | 传递事件，但不把它作为页面初始化真相。 | **明确忽略；不提升 `authRevision`。** 初始身份唯一由 `getCurrentUser()` 决定。 |
| `SIGNED_IN` | 映射 session user。 | **先提升 `authRevision`，再 reconcile user** 为 `authenticated` 或 `authenticated-needs-password`。 |
| `SIGNED_OUT` | 映射 `user:null`。 | **先提升 `authRevision`，再转为 `guest` 并清 transient UI state。** |
| `TOKEN_REFRESHED` | 映射更新后的 user。 | **先提升 `authRevision`，再更新最小 AuthUser**；已有有效 user 时不闪回 AuthShell。 |
| `USER_UPDATED` | 映射更新后的 user。 | **先提升 `authRevision`，再更新** `passwordSet` 等最小状态。 |
| `PASSWORD_RECOVERY` | 归一化为事件但不包含 token。 | **先提升 `authRevision`，不进入 AppShell 或普通 authenticated；按 §7.4A fail-closed 执行 local signOut。** |

本文选择唯一初始化策略：

```text
1. 建立 subscriptionGeneration；
2. 建立订阅；
3. 记录 initRevision = 当前 authRevision；
4. 调用 getCurrentUser()；
5. 初始化结果仅当 subscriptionGeneration 仍有效，且当前 authRevision === initRevision 时才可应用。
```

因此，任何非 `INITIAL_SESSION` event 到达时都会先提升 `authRevision`，使正在进行的旧初始化结果失效；`INITIAL_SESSION` 明确忽略且不提升 revision。示例：

```text
getCurrentUser() 尚未返回
→ SIGNED_IN 到达
→ authRevision 提升并进入 authenticated
→ 较早初始化返回 null
→ initRevision 与当前 authRevision 不匹配，结果被丢弃
→ 不得覆盖为 guest
```

同一规则适用于 `TOKEN_REFRESHED`、`USER_UPDATED`、`SIGNED_OUT` 和 `PASSWORD_RECOVERY`。React Strict Mode 重放时 cleanup 只使旧 `subscriptionGeneration` 无效；事件顺序仍由 `authRevision` 处理，二者不得合并成含义模糊的单一变量。

### 7.4A `PASSWORD_RECOVERY` fail-closed

V3.1-A 不新增忘记密码页面、密码恢复页面或重置密码流程。收到 `PASSWORD_RECOVERY` 时必须：

```text
PASSWORD_RECOVERY
→ 先提升 authRevision
→ 使旧初始化与旧页面 action 结果失效
→ 不进入 AppShell
→ 不进入普通 authenticated
→ best-effort auth.signOut({ scope: "local" })
```

- local signOut 成功：转为 `guest`，返回 Welcome 或 AuthShell 中性提示；不新增恢复页面。
- local signOut 失败：不展示 AppShell，进入 AuthShell `error`，提供安全重试并保持 fail-closed；不得把恢复 Session 当成正常登录完成。
- 技术日志仅可记录 `operation`、归一化 error `code`、`retryable`；不得记录 access token、refresh token、OTP、`token_hash`、邮箱、URL 恢复参数或 raw provider payload。

### 7.5 关键语义

1. `sendOtp()` 成功仅表示请求已被 facade 接受 / 发送，**不代表已登录**。
2. `verifyOtp()` 与密码登录成功才会产生 AuthUser 和真实 Session。
3. `setPassword()` 只能在 `authenticated-needs-password` 且存在当前 Session 时调用；页面不可传 userId。
4. 正常“退出当前账号”、首次密码设置门禁中的显式退出，以及 `PASSWORD_RECOVERY` fail-closed cleanup，Real adapter 都必须调用 `auth.signOut({ scope: "local" })`；本阶段不实现 global signOut 或“退出所有设备”。
5. local signOut 仅退出当前浏览器 Session；同一浏览器共享该 Session 的标签页通过 `SIGNED_OUT` 收敛为 guest，其他浏览器 Profile 与其他设备的独立 Session 不受影响。
6. `signOut()` 失败时不清空页面 AuthUser，不假装已退出；状态应恢复为原先 authenticated / needs-password，并显示温柔失败提示。`PASSWORD_RECOVERY` 是例外，失败必须维持 AuthShell error 的 fail-closed 状态。
7. `subscribeAuthState()` 不向页面泄露 access token、refresh token、raw Supabase User 或 event payload。

---

## 8. Auth 类型模型

### 8.1 契约草案（非实现代码）

```ts
export interface AuthUser {
  id: string;
  email: string;
  passwordSet: boolean;
}

export type AuthMode = "mock" | "real";

export type AuthStatus =
  | "initializing"
  | "guest"
  | "authenticating"
  | "authenticated-needs-password"
  | "authenticated"
  | "signing-out"
  | "error";

export type AuthScreen =
  | "welcome"
  | "otp-login"
  | "password-login"
  | "register"
  | "password-setup";

export type OtpIntent = "sign-in" | "sign-up";
export type PasswordSetState = "required" | "set";

export type AuthErrorCode =
  | "email-invalid"
  | "email-not-registered"
  | "email-already-registered"
  | "otp-invalid"
  | "otp-expired"
  | "rate-limited"
  | "password-invalid"
  | "password-too-short"
  | "network"
  | "not-configured"
  | "session-expired"
  | "password-update-failed"
  | "sign-out-failed"
  | "unknown";

export interface AuthError {
  code: AuthErrorCode;
  userMessage: string;
  retryable: boolean;
  operation: AuthOperation;
}

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  screen: AuthScreen;
  error: AuthError | null;
}
```

`MockUser` 与 `RegisterInput` 继续保留，以维持既有 [authService.mock.ts](../apps/mobile-app/services/authService.mock.ts) 的编译和 Mock 兼容性；它们不再是页面的完整认证模型。

### 8.2 User 映射规则

| 来源与 Supabase 状态 | mobile `AuthUser` 结果 | 顶层状态 |
|---|---|---|
| OTP 验证 / 启动恢复：`user.id` 有效、`email` 非空、`user_metadata.password_set === true` | `{ id, email, passwordSet:true }` | `authenticated` |
| OTP 验证 / 启动恢复：`user.id` 有效、`email` 非空、metadata 缺失或不为 `true` | `{ id, email, passwordSet:false }` | `authenticated-needs-password` |
| **密码登录成功**：`user.id` 有效、`email` 非空，任意 `password_set` metadata | `{ id, email, passwordSet:true }` | `authenticated` |
| `user` 为 null | `null` | `guest` |
| `user.email` 为 null / 空值 | 不构造可渲染 AuthUser；先 best-effort `signOut` | `error` 后回到 `guest` |
| Session 存在但 `getUser()` 明确无效 / 失效 | 不信任本地 Session；best-effort `signOut` | `guest`，附 `session-expired` 提示 |
| `getUser()` 网络失败 | 不把用户降级成 guest，也不显示 AppShell | `error`，在 AuthShell 内可重试初始化 |

### 8.3 password_set 的产品语义与密码登录例外

`password_set` 是**产品体验标记**，用于决定 OTP 验证或启动恢复后是否展示首次设置密码；它不是身份认证、授权或安全边界。

- OTP 登录、注册 OTP 验证和启动恢复时，metadata 缺失必须保守映射为 `passwordSet:false`，进入 `authenticated-needs-password`。
- `signInWithPassword()` 成功则已经证明该账号拥有可用密码；当前 Session 必须直接映射为 `authenticated`，即使 `password_set` metadata 缺失。
- Real adapter 可在密码登录成功后 best-effort 调用 `updateUser({ data: { password_set:true } })` 补写体验标记。
- metadata 补写失败只记录可重试的、无敏感信息的非阻断技术状态；不向用户展示技术错误，不强制再次设置密码，也不得把既有 authenticated 用户降级为 needs-password。
- `setPassword()` 成功后返回的 user 必须映射为 `passwordSet:true`。

### 8.4 错误状态所有权

`AuthStatus = "error"` 只用于无法确定稳定 Auth 状态的致命启动问题，例如初始化 `getCurrentUser()` 失败、Real mode 配置缺失或无法安全映射当前 user。

`sendOtp`、`verifyOtp`、`signInWithPassword`、`setPassword`、`signOut` 等操作失败时，必须恢复此前稳定状态：

| 失败操作 | 恢复状态 | 错误展示 |
|---|---|---|
| sendOtp / verifyOtp / password sign-in（guest 流程） | `guest`，保留当前 AuthScreen | 当前页面局部 error 或 `AuthState.error`。 |
| setPassword | `authenticated-needs-password` | 留在 password-setup，可重试。 |
| signOut | 原 `authenticated` 或 `authenticated-needs-password` | MeConfirmSheet / password-setup 显示可重试错误。 |
| 初始化 / 配置失败 | `error` | AuthShell 内全局错误与初始化 retry。 |

网络操作失败不能把有效用户错误降为 guest，也不能让有效 Session 错误显示为未登录。

---

## 9. Mock / Real 切换

### 9.1 唯一切换点

future [services/authService.ts](../apps/mobile-app/services/authService.ts) 是唯一读取模式和构造 adapter 的模块。页面、组件、Mock adapter 和 Real adapter 均不再各自读取环境变量。Real mode 默认且仅读取 `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`；不得默认回退到 legacy anon key。

候选公开变量：

```text
NEXT_PUBLIC_QINGXING_AUTH_MODE=mock | real
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

`NEXT_PUBLIC_*` 会在 Next.js build 时内联；改变它们通常需要重新构建 / 重新部署，不能被误认为请求期动态开关。若未来需要运行期切换，必须由新的 Architecture 单独审查，不属于本阶段。

### 9.2 切换规则

| 运行条件 | 选择 | 行为 |
|---|---|---|
| 开发 / 测试，`NEXT_PUBLIC_QINGXING_AUTH_MODE` 未设置 | Mock | 明确、可预测地使用 Mock；不访问 Supabase。 |
| 开发 / 测试，模式为 `mock` | Mock | facade 返回 Mock adapter。 |
| 任意环境，模式为 `real` 且 public URL / publishable key 齐全 | Real | facade 返回 Real adapter。 |
| production，模式缺失 | 配置错误 | 不退回 Mock，不显示错误的生产登录成功；进入 AuthShell 配置错误状态。 |
| production，模式为 `mock` | 配置错误 | 拒绝启动 Real Auth 路径，防止生产误用演示账号。 |
| `real` 模式缺 URL 或 publishable key | 配置错误 | 归一化为 `not-configured`；禁止静默 guest / Mock 回退。 |
| 未知模式值 | 配置错误 | 归一化为 `not-configured`，记录不含敏感值的技术日志。 |

### 9.3 Mock adapter 行为

Mock adapter 不改动原始 `authService.mock.ts`：

- 验证码登录成功时优先包装能自然适配的既有 `loginWithOtp()`；
- 密码登录优先包装既有 `loginWithPassword()`；
- 注册和设置密码不伪造无意义的产品输入，也不强绑定“伪造 code / confirmPassword 调旧 register”；facade 缺失的 Session / passwordSet 语义仅由 Mock adapter 的最小内存状态补足，精确函数组合由 Execution Plan 锁定；
- 登出包装既有 `logout()` 并清除 adapter 内存状态；
- Mock session 只存在于当前 browser tab 的 adapter 内存，硬刷新后为 guest；不把 localStorage boolean 当成认证凭据；
- 对 Mock 未能真实表达的账号存在性、OTP 过期与 provider rate limit，测试使用受控 adapter fixture / 显式失败模拟，不修改原始 Mock 文件。

这使原 Mock 文件永久保留，同时让页面面向与 Real 一致的契约。

---

## 10. OTP 登录流程

### 10.1 已有账号 OTP 登录时序

```text
用户            OtpLoginPage       page.tsx / facade       Real adapter        Supabase
 │ 输入邮箱           │                    │                    │                  │
 │───────────────────>│                    │                    │                  │
 │                    │ validate           │                    │                  │
 │                    │ sendOtp(sign-in)   │                    │                  │
 │                    │───────────────────>│                    │                  │
 │                    │                    │ sendOtp            │                  │
 │                    │                    │───────────────────>│ signInWithOtp   │
 │                    │                    │                    │ shouldCreate=false
 │                    │                    │                    │─────────────────>│
 │                    │                    │                    │<─────────────────│
 │<───────────────────│ code-entry + 60s   │<───────────────────│ normalized result│
 │ 输入六位验证码      │                    │                    │                  │
 │───────────────────>│ verifyOtp          │                    │                  │
 │                    │───────────────────>│───────────────────>│ verifyOtp        │
 │                    │                    │                    │─────────────────>│
 │                    │                    │                    │<─────────────────│ Session + User
 │                    │                    │<───────────────────│ AuthUser          │
 │                    │                    │ passwordSet?       │                  │
 │<───────────────────│ AppShell / 必设密码│                    │                  │
```

### 10.2 页面规则

- email-entry 只校验邮箱格式；通过后调用 `sendOtp({ intent:"sign-in" })`。
- 成功后才进入 code-entry；显示脱敏邮箱、一个逻辑 input 和六个视觉格、60 秒倒计时、重新发送和更换邮箱。
- 点击重新发送调用同一 intent 的 `sendOtp()`，不得只重置本地 timer。
- 验证仅允许 6 位数字；重复发送 / 验证时按钮 disabled，页面不创建并发请求。
- 真实模式删除“当前是前端体验流程”“输入任意 6 位数字”等 Mock 文案；Mock 模式可以保留诚实演示提示，但不得假装真实邮件已发送。
- 登录邮箱未注册时，只在 Real adapter 得到经 A1.5 验证的明确 provider 结果时归一化成 `email-not-registered`；页面温柔提示“这个邮箱还没有行动记录，可以先创建一个。”并提供到 RegisterPage 的明确入口。

---

## 11. 注册流程

### 11.1 RegisterPage 的角色

[RegisterPage.tsx](../apps/mobile-app/components/auth/RegisterPage.tsx) 保持为从 OTP 登录页进入的显式注册入口，不创建独立全局注册系统，不新增路由。

其在**尚未建立 Session**时只拥有以下注册局部阶段：

```text
register-email
→ register-code
```

验证码验证成功并建立 Session 后，顶层立即切换为 `authenticated-needs-password`；随后由 AuthShell 中的 `password-setup` 承载密码设置，不再把它当作可返回的 `register-password` 局部步骤。

OTP 输入的视觉组件、倒计时和更换邮箱交互应与登录流程共用可提取的**认证内部 UI primitive / hook**，而不是复制两套 Supabase 调用逻辑。复用只限 Auth 页面内部；页面仍只通过 Props 使用顶层 action。

### 11.2 注册时序

```text
用户              RegisterPage       page.tsx / facade     Real adapter       Supabase
 │ 输入新邮箱            │                    │                  │                 │
 │──────────────────────>│ sendOtp(sign-up)  │                  │                 │
 │                       │───────────────────>│─────────────────>│ signInWithOtp  │
 │                       │                    │                  │ shouldCreate=true
 │                       │                    │                  │────────────────>│
 │<──────────────────────│ register-code      │<─────────────────│ delivery result │
 │ 输入六位验证码         │                    │                  │                 │
 │──────────────────────>│ verifyOtp          │─────────────────>│ verifyOtp       │
 │                       │                    │                  │────────────────>│
 │                       │                    │<─────────────────│ Session/AuthUser│
 │                       │                    │ 状态切为 authenticated-needs-password       │
 │<──────────────────────│ password-setup     │                  │                 │
 │ 输入两次密码           │ setPassword        │─────────────────>│ updateUser      │
 │──────────────────────>│───────────────────>│                  │ password + metadata
 │                       │                    │                  │────────────────>│
 │<──────────────────────│ AppShell           │<─────────────────│ passwordSet=true│
```

### 11.3 同邮箱冲突

注册意图必须允许创建，但不能重复创建。若 provider 返回经 A1.5 验证的“已有账号”结果，facade 映射为 `email-already-registered`，页面显示温柔提示“这个邮箱已经有行动记录了，可以直接登录。”并导航回 OTP 登录 email-entry，保留邮箱供用户确认后发送验证码。

若 Supabase 的反枚举策略对已存在 / 不存在邮箱返回故意模糊的成功响应，页面不得用猜测或二次探测泄露账号存在性。A1.5 必须记录实际 provider 行为；无法安全获得确定结果时，使用中性提示并要求 ChatGPT 决定产品引导文字，不能临时解析 provider message。

---

## 12. 首次设置密码

### 12.1 强制门禁

首次设置密码不是可跳过的推荐项：

```text
authenticated-needs-password
→ 只渲染 AuthShell 内的 password-setup
→ setPassword 成功
→ authenticated
→ AppShell
```

即使 Supabase Session 已经建立，未设置密码者也不渲染 AppShell。这样不会出现“已登录但回到普通 guest 页面”或浏览器返回绕过设置密码的混乱状态。

### 12.2 承载组件与 Props

`RegisterPage` 复用既有卡片、密码输入和确认密码输入，并通过 future Props 区分：

```text
flow: "register" | "required-password-setup"
email?: string
onSetPassword(...)
onExplicitSignOut()
authError?: AuthError | null
isBusy: boolean
```

`required-password-setup` 不再询问邮箱或验证码；它显示当前脱敏邮箱、两次密码输入、唯一主动作“设置并进入清行”和非主动作“退出当前账号”。这属于现有 Auth 页面结构内的最小状态调整，不需要额外 UI Spec。

### 12.3 显式退出

- 系统返回键在 required-password-setup 中不会返回 guest，也不会绕过门禁。
- 用户如明确点击“退出当前账号”，顶层必须先调用固定 local scope 的 `signOut()`。
- `signOut()` 成功：清空 AuthState、页面局部草稿和 tab / today session state，返回 Welcome；同一浏览器共享该 Session 的标签页经 `SIGNED_OUT` 收敛 guest。
- `signOut()` 失败：保留 Session 与 `authenticated-needs-password`，显示“暂时没能退出，请稍后再试一次。”；不得假装已退出。
- 其他浏览器 Profile 与其他设备的独立 Session 不受这次 local signOut 影响；本阶段不提供 global signOut。

---

## 13. 密码登录

### 13.1 产品入口

在 OTP 登录 email-entry 已存在的二段切换内，密码登录仍为可访问入口。Welcome 不显示密码入口，避免第二个 Welcome 主动作。

### 13.2 流程

```text
otp-login
→ password-login
→ 输入邮箱和密码
→ facade.signInWithPassword
→ AuthUser(passwordSet=true)
→ authenticated
→ AppShell
```

密码错误统一为温和错误，不展示原始 provider 文本，不说明具体是邮箱还是密码错。后续密码登录不能删除验证码登录，OTP tab / 登录入口始终保留。

### 13.3 metadata 异常

成功密码登录已经证明账号存在可用密码，因此当前 Session 直接映射为 `authenticated`。若 `password_set` metadata 缺失，Real adapter 可以 best-effort 补写 `true` 作为后续 OTP / 启动体验标记；补写失败只留下可重试、无敏感信息的非阻断技术状态，不向用户展示技术错误，也不得再次强制进入 required-password-setup。

---

## 14. Session 初始化与恢复

### 14.1 启动时序

```text
浏览器刷新 / App 启动
        │
        ▼
page.tsx 创建一次 AuthFacade
        │
        ▼
建立 subscriptionGeneration（仅 effect 生命周期）
        │
        ▼
订阅 AuthSessionEvent
  ├→ INITIAL_SESSION：忽略；不提升 authRevision
  ├→ SIGNED_IN：提升 authRevision → reconcile user
  ├→ SIGNED_OUT：提升 authRevision → guest + 清 transient state
  ├→ TOKEN_REFRESHED：提升 authRevision → 更新最小 AuthUser，不闪回 AuthShell
  ├→ USER_UPDATED：提升 authRevision → 更新 passwordSet 等最小状态
  └→ PASSWORD_RECOVERY：提升 authRevision → local signOut → 成功 guest / 失败 AuthShell error
        │
        ▼
记录 initRevision = 当前 authRevision
        │
        ▼
调用 getCurrentUser()（唯一初始权威）
        │
        ├── subscriptionGeneration 无效 → 丢弃
        ├── authRevision !== initRevision → 丢弃
        │
        └── 两项均有效的当前初始化结果
                 │
       ┌─────────┼──────────────┐
       ▼         ▼              ▼
     null      AuthUser       error
       │         │              │
       ▼         ▼              ▼
    guest   passwordSet?   AuthShell 内错误 + 重试
              │
     ┌────────┴─────────┐
     ▼                  ▼
authenticated  authenticated-needs-password
     │                  │
 AppShell        password-setup（不显示 AppShell）
```

**竞态示例：** `getCurrentUser()` 尚未返回时若 `SIGNED_IN` 到达，事件先提升 `authRevision` 并进入 authenticated；随后较早初始化返回 null 时，因 `authRevision !== initRevision` 被丢弃，绝不能覆盖成 guest。`TOKEN_REFRESHED`、`USER_UPDATED`、`SIGNED_OUT` 与 `PASSWORD_RECOVERY` 同样使旧初始化失效。

### 14.2 `getUser()` 与 `getSession()` 的选择

- `getUser()` 是初始恢复的唯一权威：它获得经过 Supabase 校验的当前 User，不把浏览器本地 Session blob 当作已验证身份。
- `getSession()` 可以由 SDK 在内部用于 refresh / event 管理，但不作为 mobile 顶层“已认证”的独立判断依据。
- 本文选择先订阅、记录 `initRevision`、再调用 `getCurrentUser()` 的单一初始化策略：`INITIAL_SESSION` 明确忽略且不提升 `authRevision`，避免它与 `getCurrentUser()` 形成第二套初始化真相。
- 任一 `SIGNED_IN`、`SIGNED_OUT`、`TOKEN_REFRESHED`、`USER_UPDATED` 或 `PASSWORD_RECOVERY` event 必须先提升 `authRevision`，再处理 event；初始化结果仅在 `subscriptionGeneration` 有效且 `authRevision === initRevision` 时可写入状态。
- `SIGNED_IN`、`TOKEN_REFRESHED`、`USER_UPDATED` 用于初始化后的状态变更；`SIGNED_OUT` 转 guest；`PASSWORD_RECOVERY` 按 §7.4A local signOut fail-closed，成功 guest、失败 AuthShell error。
- 接收到 event 后仍只映射 `session?.user` 为 AuthUser；token 不进入 React state、Props、日志或 localStorage。

### 14.3 首屏和失败策略

| 场景 | 顶层渲染 | 原因 |
|---|---|---|
| `initializing` | AuthShell 内中性 loading，不显示 Welcome / AppShell。 | 避免“先闪 Welcome，再跳 AppShell”。 |
| `guest` | Welcome / OTP / Password / Register。 | 正常未登录或 guest 操作失败后恢复。 |
| `authenticating` | 当前 Auth 页面，按钮 loading / disabled。 | 短暂操作态，不是新的身份真相。 |
| `authenticated-needs-password` | AuthShell → required-password-setup。 | 不可绕过门禁。 |
| `authenticated` | 既有唯一 AppShell。 | 正常已登录。 |
| `signing-out` | 当前 AppShell / 确认 Sheet 保持，退出操作 disabled。 | 成功前不假装退出。 |
| `error` | AuthShell 初始化 / 配置错误 + retry。 | 仅用于无法确定稳定 Auth 状态的致命错误。 |

### 14.4 订阅生命周期、页面 action 与 Strict Mode

- `page.tsx` 通过稳定 memoized facade 在单个 `useEffect` 中订阅。
- effect cleanup 必须执行 facade unsubscribe，并只使旧 `subscriptionGeneration` 无效；其职责是 effect 生命周期、组件卸载和 Strict Mode 重放，不承担 Auth 事件排序。
- 每个非 `INITIAL_SESSION` event 必须先提升 `authRevision`；它独立于 `subscriptionGeneration`，用于阻止旧 `getCurrentUser()` 或旧 action result 覆盖更新的 AuthState。
- React Strict Mode 的 effect 重放会先 cleanup 再重建订阅；实现不得依赖“只 mount 一次”的偶然行为，cleanup 后只保留最新的一条有效订阅。
- 页面异步 action 必须有独立 request id / action generation，并在启动时记录 actionRevision = 当前 `authRevision`；页面卸载、AuthScreen 改变、用户重发同类请求或更高优先级 Session event 到达后，旧 action result 不得写回局部页面或顶层 AuthState。结果只能在当前 request id 仍匹配、当前 subscriptionGeneration 有效（若依赖该 effect）且 `authRevision === actionRevision` 时应用。
- `onAuthStateChange` 的用户结果须经过与 `getCurrentUser()` 相同的 email / passwordSet 映射，避免两条链产生不同状态。
- 正常 local signOut 会使同一浏览器共享该 Session 的标签页收到 `SIGNED_OUT` 并收敛到 guest；其他浏览器 Profile 与其他设备的独立 Session 不受影响。多 tab 不共享页面状态，只共享 Supabase Session 事实。

---

## 15. 登出

```text
MeView
→ MeConfirmSheet 的“确认退出” / password-setup 的“退出当前账号”
→ page.tsx requestSignOut()
→ AuthStatus = signing-out
→ facade.signOut()
→ Real adapter: auth.signOut({ scope: "local" })
    ├→ 成功：订阅 / action 确认为 null
    │         → 清 AuthUser、authScreen=welcome、activeTab=today、todayMode=home
    │         → 清仅内存 task / hint / executingTaskId
    │         → 当前浏览器共享 Session 的标签页经 SIGNED_OUT 收敛 guest
    │         → Welcome
    └→ 失败：恢复原 AuthStatus 与 AuthUser
              → MeConfirmSheet / password-setup 显示温柔错误，可重试
```

- 登出调用必须是真实 Supabase `auth.signOut({ scope: "local" })`，不是只调用 `setAuthState("guest")`，也禁止未指定 scope 的 `auth.signOut()`。
- 产品“退出当前账号”只退出当前浏览器 Session：同一浏览器共享该 Session 的标签页通过 `SIGNED_OUT` 收敛到 guest；其他浏览器 Profile 与其他设备上的独立 Session 不受影响。
- 本阶段不实现“退出所有设备”。未来若需该能力，必须单独设计文案、确认操作和 global scope；不得在本阶段隐式使用 global。
- Session event 是最终一致性来源；显式 action 的成功结果可先更新 UI，但应能被随后 `SIGNED_OUT` 幂等确认。
- Mock adapter 只模拟当前 facade / 当前 tab Session 退出，不得声称退出所有设备。
- future `MeConfirmSheet` 需要可等待 async logout、禁用重复确认并呈现归一化错误；不得在请求未完成时关闭并假装完成。

---

## 16. 页面状态所有权

### 16.1 `page.tsx` 的唯一职责

[page.tsx](../apps/mobile-app/app/page.tsx) 继续是单页状态机顶层，但 Auth 从 boolean 升级为 `AuthState`：

| 状态 | 可渲染内容 | 是否显示 AppShell |
|---|---|---|
| `initializing` | AuthShell loading | 否 |
| `guest` | Welcome / OTP / Password / Register | 否 |
| `authenticating` | 当前 Auth 页面，按钮 loading / disabled | 否 |
| `authenticated-needs-password` | AuthShell → required-password-setup | 否 |
| `authenticated` | 既有唯一 AppShell | 是 |
| `signing-out` | 当前 AppShell / 确认 Sheet 保持，退出操作 disabled | 是，直到成功 |
| `error` | AuthShell 初始化 / 配置错误与 retry；或 PASSWORD_RECOVERY 的 local signOut 失败。 | 否；普通操作失败恢复稳定状态并在原页面展示 error，恢复 Session 绝不进入 AppShell。 |

顶层操作包括：

- 创建 / 获取一次 `AuthFacade`；
- 初始化 Session、处理 subscription，并严格维护互不合并的 `subscriptionGeneration`、`authRevision` 与 `initRevision`；
- 为页面异步 action 维护独立 request id / action generation，防止迟到结果覆盖更新 AuthState；
- 根据 `AuthUser.passwordSet` 转换 AuthStatus；
- 将 user 传入 `MeView`；
- 执行固定 local scope 的真正 `requestSignOut()`，以及 `PASSWORD_RECOVERY` fail-closed local signOut；
- 完整登录或退出后复用当前最小的 `activeTab` / `todayMode` 清理规则；
- 不再使用 `onLoginSuccess(): void` 作为独立认证真相。后续页面可保留语义等价 callback，但它必须传回 facade result，由顶层状态转换决定是否进入 AppShell。

### 16.2 页面职责表

| 页面 / 组件 | 局部状态 | 从父级接收 | 调用边界 | 成功转换 | 返回行为 |
|---|---|---|---|---|---|
| `WelcomePage` | 无 | `onNavigate` | 无 Auth 调用 | 进入 OTP email-entry | 无变化；仅一个主动作。 |
| `OtpLoginPage` | email、code、otpStep、timer、focus、isSending、isVerifying、局部 AuthError | `sendOtp`、`verifyOtp`、`isBusy`、`onNavigate` | 调用顶层传入的 facade action | 顶层决定 AppShell 或 password-setup | code-entry → email-entry；再由 parent 回 Welcome。 |
| `PasswordLoginPage` | email、password、表单校验、isSubmitting、局部 AuthError | `signInWithPassword`、`onNavigate` | 调用顶层 action | 顶层决定 authenticated | 返回 OTP login。 |
| `RegisterPage` | Session 建立前：register-email / register-code、email、code、timer、busy、局部 AuthError；Session 建立后由 password-setup mode 承载 password / confirm。 | `sendOtp`、`verifyOtp`、`setPassword`、`onExplicitSignOut` | 调用顶层 action | verify 后顶层切 `authenticated-needs-password`；set 成功后顶层进入 AppShell | 见 §17；只有 password-setup 不可用系统返回绕过。 |
| `MeView` | meMode、confirmMode、scroll lock | `user`、`authStatus`、`onLogout`、`logoutError` | 不直接调用 facade | 顶层完成 logout | 保持现有 me-subpage / confirm handler。 |
| `MeAccountCard` | 无 | `user: AuthUser` | 无 | 显示真实 `user.email` 与“已登录” | 无。 |
| `MeSyncCard` | 无 | 可选 `authStatus` | 无 | 显示诚实 Auth 事实 | 无。 |

### 16.3 “我的”页面文案边界

`MeAccountCard` 显示当前 `AuthUser.email`，只有 `authenticated` 才会被渲染；email 不需要 fallback 为虚构账号。

`MeSyncCard` 不得把 Auth 成功说成任务数据同步完成。V3.1-A 的诚实最小文案应为：

```text
标题：账号状态
徽标：已登录
说明：你正在使用这个账号继续清行。行动记录的真实保存与跨设备同步，会在后续连接中完成。
```

不得在 V3.1-A 继续显示“已同步”“你的行动记录会跟随账号保存，换设备也能继续”。这是一项 Auth 页面外的最小、必要文案修正，不等于接入任务数据。

---

## 17. BackController 与返回链

### 17.1 不变约束

- 保持现有 `BackControllerProvider` 层级。
- 不新增 `popstate` / `pageshow` 监听器。
- 页面不调用 `history.back()`。
- 现有 `otp-code-entry / 65`、`page-auth-flow / 60`、`page-authenticated-root / 50` 保持其架构职责。

### 17.2 目标返回链

```text
OTP 登录
code-entry
→ email-entry
→ Welcome

密码登录
password-login
→ otp-login(email-entry)
→ Welcome

注册（尚未形成 Session）
register-code
→ register-email
→ otp-login(email-entry)
→ Welcome

OTP 验证成功且 Session 已建立
authenticated-needs-password
→ password-setup
→ auth-password-setup / 70
→ 系统返回键被消费，停留 password-setup
→ 显式“退出当前账号”
→ signOut 成功
→ Welcome

完整登录后的应用内返回
沿用 page-authenticated-root / 50 与既有 today / tab 返回链
```

### 17.3 Handler 设计

| Handler | 优先级 | 生效条件 | 行为 | 与既有 handler 的关系 |
|---|---:|---|---|---|
| `auth-password-setup` | 70 | `authenticated-needs-password` | 消费系统返回，不改变屏幕；只允许明确“退出当前账号”触发 signOut。 | 高于 OTP 65 和 page auth 60；不与完整登录 root 50 重叠。 |
| `register-flow` | 66 | RegisterPage 内部 `register-code` 且尚未建立 Session、无异步请求 | 退回 `register-email`。 | 只处理尚未建立 Session 的注册步骤；高于 OTP 65，二者不会同时 mount。 |
| `otp-code-entry` | 65 | OtpLoginPage code-entry 且无异步请求 | 退回 OTP email-entry，清 code、timer、局部错误和焦点。 | 保留已有 id 与优先级。 |
| `page-auth-flow` | 60 | guest 的顶层 AuthScreen | Password / Register → OTP；OTP → Welcome。 | 作为子页面局部 handler 未消费时的 fallback。 |
| `page-authenticated-root` | 50 | 完整 `authenticated` | 维持既有 AppShell 内返回链。 | 不处理 `authenticated-needs-password`。 |

### 17.4 异步请求期间

发送、验证、设置密码、密码登录或登出进行时：

- 当前主动作与相关导航 disabled；
- 对应 Back handler 返回 `true` 但不改变 screen，避免请求迟到后把旧结果写入已离开的页面；
- 每个 action 使用独立 request id / action generation，并在启动时记录 actionRevision = 当前 `authRevision`；组件卸载、AuthScreen 改变、用户重发同类请求或更高优先级 Session event 到达后，旧 action 结果不得写回页面或顶层 AuthState。
- 倒计时、验证码、密码值只存组件内存；返回 email-entry 或卸载时清空验证码和计时器；密码在提交后与卸载时清空。

---

## 18. Supabase Client 与安全边界

### 18.1 方案比较

| 方案 | 能力 | 优点 | 当前阻断 / 缺点 | 结论 |
|---|---|---|---|---|
| A：mobile Real adapter → Supabase Browser Client | 完整覆盖 OTP、验证、密码登录、设置密码、登出、订阅。 | 与现有 root `useAuth` 使用的公开 SDK 能力一致；不需改旧 API；页面仍被 facade 隔离。 | mobile 需声明 Supabase client 依赖与 public env；必须做 Cookie MVP 验证。 | **唯一推荐。** |
| B：全部走旧根工程 Auth API | 当前只有 `GET /api/auth/me`。 | 理论上可把 client credential 操作收敛到服务器。 | 没有发送 OTP、验证 OTP、密码登录、设置密码、登出 API；新增它们会修改 `src/app/api/**`，当前禁止。 | 不采用。 |
| C：新增 mobile 自己的 Auth API Route | 可包装 provider。 | 可自定义服务端交互。 | 增加另一套 Session / Cookie 责任，需 route、安全与部署设计；没有 A 的当前必要性。 | 不采用。 |

### 18.2 推荐方案 A

future `lib/supabase-client.ts` 仅以：

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

调用 `@supabase/ssr` 的 `createBrowserClient()`。mobile [package.json](../apps/mobile-app/package.json) 在后续获批实现时需显式声明支持当前 Cookie 与 cache-header 安全行为、且与根工程可兼容的精确 `@supabase/ssr` 与 `@supabase/supabase-js` 依赖版本；具体版本必须经 §23.4 的只读安全门禁确认，本次不修改依赖。

### 18.3 安全边界

1. 只使用 publishable key；`SUPABASE_SERVICE_ROLE_KEY` 永不进入 mobile bundle、环境变量或日志。
2. 不得将任何 secret key、`sb_secret_*` 或 service role key 放入客户端环境变量或 bundle。
3. 旧根工程当前使用 legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`：本阶段不修改根工程，不构成 mobile 使用 publishable key 的阻断；两者必须属于同一个 Supabase project，A1.5 通过 project ref、Cookie 名称和 `/api/auth/me` 验证 Session 兼容。
4. 不允许 mobile 新实现默认继续使用 `NEXT_PUBLIC_SUPABASE_ANON_KEY`。
5. 页面不提交 userId 作为可信身份；Real adapter 也不接受 userId。
6. 用户身份只由 Supabase Session 决定；未来旧 API 继续由 `getAuthenticatedUserId()` 从服务端 Cookie 获取 userId。
7. OTP、password、access token、refresh token、Cookie、publishable key 以外的 secret 均不得写入页面 state 日志、analytics、错误文案或 localStorage。
8. 认证与 Session 路径的响应必须遵循 §19.1A：gateway、CDN、反向代理与 ISR 不得共享缓存；`/api/auth/me` 至少使用等价于 `Cache-Control: private, no-store` 的策略，任何含 `Set-Cookie` 的 response 禁止缓存。
9. 不自行实现密码哈希，不建立第二套账号系统，不修改用户表、schema、RLS 或 root Auth API。
10. Auth response 只在内存映射为最小 `AuthUser`；原始 provider object 不长期存储或传入组件。
11. Session 初始化完成前不显示 AppShell；网络错误不能导致误判为已登录。

---

## 19. 同源部署与跨域判断

### 19.1 结论

```text
V3.1 默认采用同源目标架构。
跨域在当前边界下不采用。
```

同一 Git 仓库不等于同源：mobile-app 与根 Next app 是两个独立工程，mobile 当前 `next.config.ts` 为空，根 API 依赖请求 Cookie，而当前项目没有 CORS / OPTIONS / credentialed cross-origin 支持。

### 19.1A Gateway / CDN 缓存安全（P0）

认证响应被共享缓存可能造成不同用户 Session 串号。因此 Architecture 强制执行以下缓存规则：

1. **所有认证相关路径不得被 gateway、CDN、反向代理或 ISR 缓存。**
   V3.1-A 至少包括 `/api/auth/me`。V3.1-B 后续扩展的所有 authenticated API 也必须继承相同规则。

2. **Gateway 必须透传：`Cookie`、`Set-Cookie`、`Cache-Control`、`Expires`、`Pragma`。**
   不得丢弃、合并、错误改写或缓存 `Set-Cookie`。

3. **对认证和 Session 路径必须使用等价于 `Cache-Control: private, no-store` 的禁止共享缓存策略。**
   不得允许 public cache、shared cache、ISR、静态缓存或 CDN 缓存认证响应。

4. **如果部署平台或 CDN 有 Minimum TTL：必须设置为 0，或使用平台明确的 Caching Disabled 策略。**

5. **禁止缓存任何含 `Set-Cookie` 的响应。**

6. **A0 必须确认 gateway/CDN 具备：**
   - 路径级禁用缓存；
   - `Cookie` 转发；
   - `Set-Cookie` 转发；
   - `Cache-Control` / `Expires` / `Pragma` 透传；
   - Minimum TTL = 0 或等价设置。
   A0 只能确认能力和配置条件，不声称已完成 Session 验证。

7. **A1.5 必须实际验证：**
   - 登录前 `/api/auth/me` 为 null；
   - 登录后 `/api/auth/me` 为当前用户；
   - 刷新 Session 时响应没有被共享缓存；
   - `signOut` 后 `/api/auth/me` 为 null；
   - 两个不同浏览器 Profile 或隐私窗口不会得到对方 Session；
   - Network 中认证响应为 `private/no-store` 或平台等价状态；
   - `Set-Cookie` 没有被缓存后复用。

8. **必须只读确认旧根工程当前：**
   - `@supabase/ssr` 的实际版本；
   - `createServerClient` 的 `setAll` 行为；
   - `/api/auth/me` 的响应头；
   - 是否可能刷新并写入 Cookie。
   如果根工程当前无法提供安全缓存头：本阶段仍禁止修改 `src/**`；A1.5 必须停止；优先由 gateway 强制认证路径完全不缓存；如果 gateway 也无法保证，则不得进入 A2；不得降低安全标准或用前端 userId 绕过。

9. **风险分级：该问题属于 P0，因为认证响应被共享缓存可能造成不同用户 Session 串号。**
   修订后已变为 Architecture 已解决；实现期由 A0 / A1.5 门禁验证。

### 19.2 部署方案比较

| 方案 | 说明 | 评价 |
|---|---|---|
| 外部反向代理 / 网关 | 同一公开 origin 下，`/` 代理 mobile-app；A1.5 最小 Auth 验证期仅暴露 `/api/auth/me` 到根 app；V3.1-B 再经批准扩展到必要 `/api/*`。 | **推荐。** 清晰保留 Web / App 工程分离，不改两个 Next config，不提前实施 task proxy。 |
| mobile `next.config.ts` rewrite / proxy | mobile `/api/*` 转根 app。 | 不采用。它会修改 mobile config，并在 V3.1-A 过早建立广泛业务 API proxy，模糊 A/B 边界。 |
| 根工程托管 mobile 子路径 | 让根 Next 承载 mobile 资源 / 路径。 | 不采用。需要根工程集成和 UI 托管决策，违反当前 Web / App 分离与根配置只读边界。 |

### 19.3 推荐拓扑

```text
本地开发（目标拓扑）

Browser: http://qingxing.localhost:<gateway-port>
       │
       ▼
External reverse proxy / gateway
  ├─ /              → mobile-app Next dev server
  └─ /api/auth/me   → root legacy Next dev server（仅 A1.5 验证）

生产（目标拓扑）

Browser: https://qingxing.example
       │
       ▼
External reverse proxy / gateway
  ├─ /              → mobile-app deployment
  └─ /api/auth/me   → root legacy deployment（A1.5）

V3.1-B 才在批准的 Execution Plan 中把必要的 /api/* 路径加入网关路由。
```

要求：

- gateway 必须透明转发 browser 的 `Cookie` request header；
- 对根 API 的 response 必须保留 `Set-Cookie`，不得改写为另一 host；
- gateway 必须透传 `Cache-Control`、`Expires`、`Pragma` response header，不得丢弃、合并或错误改写；
- mobile 页面、Supabase browser session cookie 和根 `/api/auth/me` 必须处于**同一公开 origin**；
- 目标 API base URL 保持相对路径 `/api/...`，但 V3.1-A Auth 本身直接走 facade → Supabase Browser Client，不提前调用任务 API；
- [apps/mobile-app/next.config.ts](../apps/mobile-app/next.config.ts) 与根 `next.config.ts` 本阶段不需要修改；
- 这不把 Web UI 与 mobile UI 合并，只在网关层提供同源入口。

### 19.4 A0 前置检查与 A1.5 Cookie / Session 门禁

静态代码不能证明 provider 的 OTP 模板、真实网关转发和 Browser Client Session 行为，因此验证拆分为两个严格顺序阶段：

#### V3.1-A0：部署与 Supabase 前置检查

| 项目 | 要求 |
|---|---|
| 目标 | 只判断真实验证环境是否具备；**不声称**已证明 Browser Client、OTP、Session 或 `/api/auth/me` 已贯通。 |
| 是否写仓库代码 | 不修改仓库、不创建项目文件，也不创建或运行验证 probe；A1.5 验证入口必须按 §19.4B 由 Execution Plan 唯一选择并获单独授权。 |
| Supabase 检查 | 确认 Email OTP 模板使用 6 位 Token，而非仅邮件链接；确认 public URL、redirect / site 设置可用于目标验证环境；确认 publishable key 可用。 |
| gateway 检查 | 确认目标 gateway 能提供同一 public origin；可转发 request `Cookie` 和 upstream `Set-Cookie`，且不会把 Cookie 改写为另一 host；可路径级禁用缓存；可透传 `Cache-Control` / `Expires` / `Pragma`；Minimum TTL = 0 或等价已设置。 |
| 输出 | 记录“环境具备 / 不具备 / 需要补齐”的前置结论及证据来源。 |
| 失败 | 停止，不进入 A1；向 ChatGPT 报告缺失的外部条件。 |

A0 不创建或运行验证 probe；它只确认环境能力与配置条件。A1.5 的验证入口必须按 §19.4B 由 Execution Plan 唯一选择并获单独授权。

#### V3.1-A1.5：Session / Cookie 最小可行性验证

A1 已建立最小 Real Auth 能力后，才能执行：

| 项目 | 要求 |
|---|---|
| 目标 | 验证真实 OTP、Session、同源 `/api/auth/me`、固定 local signOut、Auth event / 初始化并发与缓存安全的最小闭环。 |
| 通过条件 | 1) 登录 intent `false` 不创建未知用户；2) 注册 intent `true` 可创建并建立 Session；3) Browser Client 登录后同源 `/api/auth/me` 返回相同 user id/email；4) **Profile A 与 Profile B 分别登录后，Profile A 执行 local signOut，Profile A 的 `/api/auth/me` 为 null，Profile B 的独立 Session 仍保持自己的用户，不发生 Session 串号；同一浏览器共享当前 Session 的标签页正确收到 `SIGNED_OUT`；**5) gateway 没有丢失 Cookie / Set-Cookie；6) 认证响应为 `private/no-store` 或平台等价状态；7) 两个不同浏览器 Profile 或隐私窗口不会得到对方 Session；8) `Set-Cookie` 没有被缓存后复用；9) 初始化 `getCurrentUser()` 迟到时，先到的 SIGNED_IN / TOKEN_REFRESHED / USER_UPDATED / SIGNED_OUT / PASSWORD_RECOVERY 不被覆盖；10) PASSWORD_RECOVERY 必须 fail-closed：不进 AppShell，local signOut 成功 guest、失败 AuthShell error。 |
| 失败 | 立即停止，不进入 A2；向 ChatGPT 报告真实 Network / Cookie / event-order 证据。 |
| 禁止绕过 | 不得使用跨域、前端 userId 或 service role key 规避失败；如果根工程或 gateway 无法保证安全缓存头，或 local signOut / recovery fail-closed 无法证明，不得进入 A2。 |

A1.5 不扩展 Auth 页面产品流程；它只使用 A1 的最小 Real Auth 能力验证 Session 基础。

### 19.4B A1.5 验证入口

A1.5 的具体触发方式由 Execution Plan 选择且只能选择一种。

**方案 A：仓库外临时 probe。**
- 必须由 ChatGPT 单独书面授权；
- 存放在 `C:\Dev\ai-todo` 之外；
- 不进入 Git；
- 不使用 service role；
- 不读取或保存用户密码、OTP、token；
- 验证完成后明确清除。

**方案 B：受控的临时开发验证入口。**
- 必须由 ChatGPT 单独授权；
- Execution Plan 精确列出文件；
- 仅开发环境可达；
- 生产 build 不可达；
- A1.5 完成后必须在进入 A2 前删除；
- 删除结果需 Claude Code Review；
- 临时入口不得进入最终提交。

不得默认假设可以通过浏览器控制台直接调用未暴露模块。Execution Plan 必须选定唯一方案后，才能执行 A1.5。该问题作为 P2，不阻断 Architecture，但必须成为 Execution Plan 门禁。

### 19.5 跨域不采用

当前跨域缺少：CORS allowlist、OPTIONS、`Access-Control-Allow-Credentials`、Cookie Domain / SameSite 策略、Authorization token API 验证和 CSRF 方案。旧 API 又仅从 Cookie Session 读用户。故在不修改 `src/app/api/**` 的锁定边界下，跨域不具备可实施性，不是 V3.1-A 的备选兜底。

---

## 20. 错误模型与用户文案边界

### 20.1 原则

- Raw Supabase error 仅可进入经敏感字段脱敏后的技术日志；不得直接展示。
- 页面只接收 `AuthError` 的 `code`、`userMessage`、`retryable`。
- 邮箱、OTP、password、Cookie、access / refresh token 均不得记录。
- 文案温和、具体、可行动，不指责、不制造焦虑、不出现 Supabase、SMTP、API 等术语。

### 20.2 映射表

| `AuthErrorCode` | 触发场景 | 页面文案方向 | 下一步 |
|---|---|---|---|
| `email-invalid` | 格式无效 / 空值 | “邮箱地址好像不太对，再看一眼就好。” | 修改邮箱。 |
| `email-not-registered` | 登录 intent 得到经 A1.5 验证的明确未知账号结果 | “这个邮箱还没有行动记录，可以先创建一个。” | 去注册。 |
| `email-already-registered` | 注册 intent 得到经 A1.5 验证的明确已有账号结果 | “这个邮箱已经有行动记录了，可以直接登录。” | 回登录。 |
| `otp-invalid` | 验证码错误 / 不完整 | “这个验证码好像不对，再看一眼就好。” | 修改验证码。 |
| `otp-expired` | OTP 已过期 | “验证码已经过期，我们重新发一封。” | 重新发送。 |
| `rate-limited` | 请求太频繁 | “刚刚发送得有一点快，稍等一会儿再试就好。” | 等待后重试。 |
| `password-invalid` | 密码登录失败 | “邮箱或密码没有对上，再试一次就好。” | 重试 / 回验证码登录。 |
| `password-too-short` | 设置密码不满足 Supabase 或产品最小要求 | “密码还需要再长一点，换一个更好记的组合吧。” | 修改密码。 |
| `network` | 断网、超时、不可达 | “网络暂时没有连上，检查一下后再试。” | 重试。 |
| `not-configured` | Real mode 缺 public 配置或模式错误 | “清行暂时还没准备好登录，请稍后再试。” | 不暴露配置细节；技术日志处理。 |
| `session-expired` | 失效 Session | “登录状态已经结束了，我们重新开始就好。” | 回 Welcome。 |
| `password-update-failed` | 设置密码 / metadata 更新失败 | “密码暂时没有保存好，再试一次就好。” | 留在 password-setup 重试。 |
| `sign-out-failed` | signOut 失败 | “暂时没能退出，请稍后再试一次。” | 保留当前状态重试。 |
| `unknown` | 未映射异常 | “这一步暂时没有完成，稍后再试一次。” | 重试；安全日志。 |

### 20.3 账号存在性披露边界

产品已要求登录未注册邮箱可温柔引导注册、注册已有邮箱可引导登录。这是有限的、用户主动提交邮箱后的流程披露。实现必须满足：

1. 只依赖 A1.5 已验证且稳定的 provider error code / status，不用模糊 message substring 推断；
2. 不以额外 API、管理员查询或重复探测来枚举账号；
3. provider 有反枚举模糊策略时，优先保留该保护并使用中性文案；
4. 不在日志、analytics 或 UI 留存“某邮箱存在 / 不存在”的记录；
5. 若 A1.5 无法提供稳定且安全的区分，Execution Plan 前必须报告 ChatGPT，不得擅自放宽策略。

---

## 21. 我的页账号显示

### 21.1 必须修改的事实

完整 authenticated 状态下：

```text
MeAccountCard
→ 显示 AuthUser.email
→ 徽标：已登录
```

`MeView` 从 page 接收 user、authStatus、logout error 与 async `onLogout`。`MeConfirmSheet` 需要等待登出完成，避免当前 `onLogout(): void` 立即将状态切 guest 的假退出模型。

### 21.2 同步文案

V3.1-A 的真实认证不等于业务数据已同步。`MeSyncCard` 必须改为 §16.3 的“账号状态 / 已登录”语义，不承诺任务跟随账号、换设备继续或已同步。

---

## 22. V3.1-A / V3.1-B 边界

| 能力 | V3.1-A | V3.1-B |
|---|:---:|:---:|
| Auth facade / mode selector | ✅ | 复用，不重做。 |
| Mock Auth adapter / Real Auth adapter | ✅ | 复用，不重做。 |
| Supabase Browser Client | ✅ | 复用 Session。 |
| OTP 登录 / 注册 / 重新发送 | ✅ | — |
| 首次设置密码 / 密码登录 | ✅ | — |
| Session 初始化、监听、登出 | ✅ | 复用。 |
| 我的页真实邮箱 / 账号已登录 | ✅ | 复用。 |
| 同源 Cookie MVP 与 `/api/auth/me` | ✅，仅验证 | 复用。 |
| 真实任务 API / `/api/task-group/*` | ❌ | ✅ |
| deviceId 与匿名任务迁移实际调用 | ❌ | ✅ |
| 历史、足迹、成长、统计、Review | ❌ | ✅ |
| AI Guide / Feedback / Companion / Assist | ❌ | ✅ |
| TaskStatus `resolved_today` 映射 | ❌ | ✅ |
| 任务同步状态 / “全部已同步” | ❌ | ✅ |

匿名任务迁移明确归属 **V3.1-B**：mobile 当前没有真实 deviceId 和真实任务持久化；在 Auth 接入时调用 migrate 没有实际 mobile 匿名任务可迁移。

---

## 23. 文件影响范围

以下均为后续 Execution Plan 的**预测范围**，不是本次授权。

### 23.1 预计新增文件

| 候选文件 | 唯一职责 |
|---|---|
| `apps/mobile-app/services/authService.ts` | 唯一模式选择点与稳定 facade 出口；验证 public config。 |
| `apps/mobile-app/services/authService.real.ts` | Real Auth adapter：Supabase 调用、User / error 映射、subscription。 |
| `apps/mobile-app/services/authService.mock-adapter.ts` | 包装既有 Mock export，并提供与 Real 一致的 facade contract。 |
| `apps/mobile-app/lib/supabase-client.ts` | mobile 唯一 Browser Client factory，仅读取 public URL / publishable key。 |
| `apps/mobile-app/lib/auth-errors.ts` | mobile AuthError 归一化、脱敏技术日志边界；不得 import / 修改 `src/lib/auth-errors.ts`。 |

### 23.2 预计修改文件

| 文件 | 分类 | 理由 |
|---|---|---|
| [apps/mobile-app/app/page.tsx](../apps/mobile-app/app/page.tsx) | **必须修改** | 从 boolean Auth 升级为 AuthState、初始化 / 订阅、真实登出、Prop wiring。 |
| [apps/mobile-app/types/app.ts](../apps/mobile-app/types/app.ts) | **必须修改** | 新增 AuthUser、AuthStatus、AuthError、OtpIntent 等；保留 MockUser / RegisterInput。 |
| [apps/mobile-app/services/index.ts](../apps/mobile-app/services/index.ts) | **不需要修改** | 保持当前 Mock barrel，Auth facade 使用专用路径，避免误导页面继续 import Mock。 |
| [apps/mobile-app/components/auth/WelcomePage.tsx](../apps/mobile-app/components/auth/WelcomePage.tsx) | **不需要修改** | 唯一“开始使用”入口已锁定。 |
| [apps/mobile-app/components/auth/OtpLoginPage.tsx](../apps/mobile-app/components/auth/OtpLoginPage.tsx) | **必须修改** | 移除假发送 / 任意 code 成功，接收 facade action，处理真实 state / error / resend。 |
| [apps/mobile-app/components/auth/PasswordLoginPage.tsx](../apps/mobile-app/components/auth/PasswordLoginPage.tsx) | **必须修改** | 移除 Mock direct import，使用父级 action 与真实错误契约。 |
| [apps/mobile-app/components/auth/RegisterPage.tsx](../apps/mobile-app/components/auth/RegisterPage.tsx) | **必须修改** | 从单表单转 register 多阶段，并复用 password-setup mode。 |
| [apps/mobile-app/components/auth/AuthShell.tsx](../apps/mobile-app/components/auth/AuthShell.tsx) | **不需要修改** | 现有单实例、安全区和滚动容器可承载 loading / error / password setup child。 |
| [apps/mobile-app/components/me/MeView.tsx](../apps/mobile-app/components/me/MeView.tsx) | **必须修改** | 接收真实 user / async signOut / 错误 Props。 |
| [apps/mobile-app/components/me/MeAccountCard.tsx](../apps/mobile-app/components/me/MeAccountCard.tsx) | **必须修改** | 显示真实邮箱。 |
| [apps/mobile-app/components/me/MeSyncCard.tsx](../apps/mobile-app/components/me/MeSyncCard.tsx) | **必须修改** | 改为诚实“账号已登录”，移除任务同步承诺。 |
| [apps/mobile-app/components/me/MeConfirmSheet.tsx](../apps/mobile-app/components/me/MeConfirmSheet.tsx) | **必须修改** | 支持 async signOut、pending、失败重试，防止假退出。 |
| [apps/mobile-app/package.json](../apps/mobile-app/package.json) | **必须修改** | 正式 Real adapter 需显式声明 `@supabase/ssr` / `@supabase/supabase-js`；版本由 Execution Plan 锁定。 |
| [apps/mobile-app/next.config.ts](../apps/mobile-app/next.config.ts) | **不需要修改** | 选择外部 gateway，不使用 Next rewrite / proxy。 |

### 23.3 依赖与唯一 lockfile 边界

`apps/mobile-app/package.json` 与**待 Execution Plan 只读确认的唯一 lockfile**必须被视为同一个依赖变更范围。

Execution Plan 开始前必须：

1. 只读确认实际使用的 package manager；
2. 只读确认在 `apps/mobile-app` 安装依赖时会实际改变的唯一 lockfile；
3. 精确锁定 `@supabase/ssr` 与 `@supabase/supabase-js` 版本，禁止使用 `latest`；
4. 在 Execution Plan 的 exact file list 中同时列出 mobile `package.json` 与该唯一 lockfile。

在 lockfile 未确定前，不得授权 Codex 安装依赖。实现时禁止顺带更新任何其他 lockfile，禁止重新生成整个 workspace 依赖树。

### 23.4 `@supabase/ssr` Cookie / 缓存安全版本门禁

Execution Plan 必须在任何依赖安装前只读确认 mobile 与根工程当前 `@supabase/ssr` 版本，并据此锁定 mobile 的精确版本：

1. mobile 新依赖必须使用精确版本，禁止 `latest`；
2. 必须选择支持当前 Cookie 与 cache-header 行为的版本；
3. 官方已知 v0.10.0 起可向 cookie `setAll` 提供相关防缓存 response header 时，不得选择更旧且缺少该能力的版本，除非 Execution Plan 提供等价安全证明；
4. 根工程若版本较旧，本阶段不顺带升级；
5. gateway 的认证路径禁止缓存策略和 A1.5 的真实验证仍是必需兜底，不因 SDK 版本而省略；
6. 无法证明 Cookie / cache-header 安全时，不得进入 A2。

### 23.5 明确只读

```text
src/app/api/**
src/hooks/**
src/lib/**
src/prompts/**
src/components/**
src/app/auth/callback/route.ts
数据库 schema / migration / Supabase RLS
根 package.json
根 next.config.ts
apps/mobile-app/components/shell/AppShell.tsx
apps/mobile-app/components/shell/BottomTabBar.tsx
apps/mobile-app/components/today/**
apps/mobile-app/components/footprints/**
apps/mobile-app/components/growth/**
```

### 23.6 永久保留

```text
apps/mobile-app/services/authService.mock.ts
apps/mobile-app/services/taskService.mock.ts
apps/mobile-app/services/historyService.mock.ts
apps/mobile-app/services/growthService.mock.ts
apps/mobile-app/services/serviceDelay.ts
apps/mobile-app/mockData/mockData.ts
```

这些文件不删除、不覆盖、不重命名；任何 Real adapter 必须是新增层。

---

## 24. 小阶段拆分

### 24.1 V3.1-A0：部署与 Supabase 前置检查

| 项目 | 内容 |
|---|---|
| 主要目标 | 不修改仓库，只确认 Email OTP 模板为 6 位 Token、publishable key 可用、目标 gateway 可提供同一 public origin，并具备 Cookie / Set-Cookie 转发及认证路径禁用缓存能力。 |
| 是否写代码 | 不写代码、不创建项目文件，也不创建或运行验证 probe；A1.5 验证入口须在 Execution Plan 中按 §19.4B 唯一选择并单独获批。 |
| 文件范围 | 无。 |
| 独立 Review | 是；环境不具备、Minimum TTL 无法归零 / 禁用缓存，或 gateway 不能透传 `Cache-Control` / `Expires` / `Pragma` 时停止，不进入 A1。 |
| 可回退性 | 纯前置检查，无仓库回退需求。 |

### 24.2 V3.1-A1：Auth 合约、client 与 adapter 最小基础

| 项目 | 内容 |
|---|---|
| 主要目标 | 新增 Auth types、facade selector、Mock adapter、最小 Real adapter、browser client、mobile error mapper；保留 Mock；不接完整 Auth 页面。 |
| 文件范围 | 仅 §23.1 新增文件、`types/app.ts`、`package.json` 与经只读确认的唯一 lockfile；不得改 Auth UI 或 `src/**`。 |
| 依赖门禁 | Execution Plan 前先只读确认实际 package manager 与唯一会变更的 lockfile；精确锁定 `@supabase/ssr` / `@supabase/supabase-js` 版本，禁止 `latest`、禁止顺带更新其他 lockfile 或重新生成整个 workspace 依赖；mobile 只读取 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。必须确认 mobile 与根工程的 `@supabase/ssr` 版本，mobile 不得选用低于已知 v0.10.0 的缺少 cookie cache-header 能力版本，除非有等价安全证明。 |
| 独立 Review | facade 只有一个切换点、production config fail-closed、无 service role / secret key、Mock 可用、依赖范围只有 package.json + 唯一 lockfile。 |
| 可回退性 | 删除 / 停用新增层即可回到当前 Mock imports；具体回退由 Execution Plan 锁定。 |

### 24.3 V3.1-A1.5：Session / Cookie 最小可行性验证

| 项目 | 内容 |
|---|---|
| 主要目标 | 使用 A1 已建立的最小 Real Auth 能力，验证真实 OTP、Session、同源 `/api/auth/me`、固定 local signOut、Auth event / 初始化竞态与认证响应缓存安全。 |
| 文件范围 | 不扩展完整 Auth 页面；验证入口必须由 Execution Plan 在 §19.4B 的方案 A 或方案 B 中**唯一选择**。方案 A 的仓库外 probe 必须获 ChatGPT 单独授权且不得进入提交；方案 B 的临时开发入口必须精确列文件、仅开发环境可达、生产 build 不可达、A2 前删除并经 Claude Code Review，且不进入最终提交。 |
| 通过条件 | §19.4 的 A1.5 OTP / Session / Cookie / 缓存 / local signOut / Auth event / PASSWORD_RECOVERY fail-closed 条件全部满足，包含双浏览器 Profile 或隐私窗口隔离与同 Session 标签页 SIGNED_OUT。 |
| 独立 Review | 是；任何 OTP、Session、`Set-Cookie`、缓存头、共享缓存、Profile 隔离、local signOut scope、事件竞态或 recovery fail-closed 失败均立即停止，不进入 A2。 |
| 禁止绕过 | 禁止跨域、前端 userId、service role key；不得默认通过浏览器控制台调用未暴露模块。 |

### 24.4 V3.1-A2：真实 OTP 登录与注册验证码

| 项目 | 内容 |
|---|---|
| 主要目标 | OtpLoginPage 与 RegisterPage 的 email / code 阶段接入 facade，实施 resend、错误、intent 区分。 |
| 文件范围 | `page.tsx`、OtpLoginPage、RegisterPage，以及 A1 Auth 文件；不动我的页和 `src/**`。 |
| 独立 Review | `shouldCreateUser:false/true` 分流、不会重复发送 / 验证、无 raw provider error、Session 建立后立刻转 password-setup 而非 register-password。 |
| 可回退性 | 仅恢复 Auth 页面到 Mock facade mode，不删除 adapters。 |

### 24.5 V3.1-A3：首次设置密码与密码登录

| 项目 | 内容 |
|---|---|
| 主要目标 | Required-password gate、显式退出 signOut、密码登录、metadata 体验标记映射。 |
| 文件范围 | `page.tsx`、PasswordLoginPage、RegisterPage、Auth types / adapter；必要时 Back handler wiring。 |
| 独立 Review | OTP / 恢复缺 metadata 时不能绕过 password setup；密码登录成功直接 authenticated，metadata 补写失败非阻断；OTP 与密码登录并存。 |
| 可回退性 | facade 仍可切 Mock；不触碰业务 Mock。 |

### 24.6 V3.1-A4：Session 恢复、我的页与登出

| 项目 | 内容 |
|---|---|
| 主要目标 | 初始化 gate、单一订阅策略、跨 tab 登出、真实邮箱、诚实账号状态、async signOut。 |
| 文件范围 | `page.tsx`、MeView、MeAccountCard、MeSyncCard、MeConfirmSheet、Auth facade 文件。 |
| 独立 Review | 无 Welcome flash、INITIAL_SESSION 不与 getCurrentUser 竞争、刷新可恢复、退出失败不假成功、没有“任务已同步”假文案。 |
| 可回退性 | 保持 Mock mode 可独立验收。 |

### 24.7 V3.1-A5：集成 Review、真机验收与提交准备

| 项目 | 内容 |
|---|---|
| 主要目标 | 按 §26 完成 Mock / Real / 返回链 / 视口 / 工程门禁验收。 |
| 文件范围 | 不新增功能；只允许经 Review 批准的缺陷修复。 |
| 独立 Review | Claude Code Review → ChatGPT 最终把关 → 用户验收。 |
| 提交 | 仅在获得明确授权后进行；本 Architecture 不授权 commit / push。 |

---

## 25. 风险与缓解

### 25.1 P0 / P1 处理结果

| 风险 | Architecture 决策 | 如何消除 | 实现阶段 | 验收方法 | 残余风险 |
|---|---|---|---|---|---|
| R0：Gateway / CDN 共享缓存认证响应 | 认证路径强制 `private, no-store` 等价策略；禁止缓存任何含 `Set-Cookie` 的 response；A0 确认路径级禁用缓存与 Minimum TTL=0，A1.5 实测双 Profile 隔离。 | gateway 透传 `Cookie` / `Set-Cookie` / `Cache-Control` / `Expires` / `Pragma`，不得 public / shared / ISR / 静态 / CDN 缓存认证响应；根工程无法提供安全缓存头时优先 gateway 强制 no-store，否则停止。 | A0、A1.5 | 配置证据、Network header、登录前后 `/api/auth/me`、刷新、登出、双浏览器 Profile / 隐私窗口隔离、`Set-Cookie` 不复用。 | Architecture 已解决；部署 / CDN 配置错误由门禁阻止 A2。 |
| R6：初始化 / Auth 事件 / action 竞态 | 明确分离 `subscriptionGeneration`、`authRevision`、`initRevision` 与页面 request id；所有非 INITIAL_SESSION event 先提升 revision。 | 初始化结果仅在 generation 有效且 revision 匹配时应用；旧 action 遇卸载、screen 改变、重发或更高优先级 event 一律失效。 | A1、A4 | 人工 race matrix：初始化迟到 + SIGNED_IN / TOKEN_REFRESHED / USER_UPDATED / SIGNED_OUT / PASSWORD_RECOVERY；Strict Mode cleanup 与 action 迟到结果。 | Architecture 已解决；实现必须按合约编码并验收。 |
| R7：默认 global signOut 与恢复 Session 误入 AppShell | Real adapter 固定 `auth.signOut({ scope: "local" })`；PASSWORD_RECOVERY fail-closed local signOut。 | 当前浏览器与同 Session tab 收敛 guest，其他 Profile / 设备不受影响；恢复 signOut 失败停留 AuthShell error。 | A1、A1.5、A3、A4 | 双 Profile local signOut、同浏览器 tab SIGNED_OUT、PASSWORD_RECOVERY 成功 / 失败 fail-closed。 | Architecture 已解决；SDK 行为与真机 / 多 Profile 验证为实现期门禁。 |
| R1：OTP 假流程与 boolean Auth | AuthState + facade +真实 OTP + Session gate。 | 移除 `setTimeout` / 任意六码成功路径；顶层以 AuthUser / passwordSet 决策。 | A2–A4 | Real OTP、错误 OTP、刷新、退出真机验证。 | Provider / 邮件送达依赖，作为实现期外部风险。 |
| R2：无 facade / adapter / client / 切换 | 单一 `authService.ts` selector，Mock / Real adapter 分离；mobile Real 默认 publishable key。 | 页面只接收 actions；生产 fail-closed；不允许 default fallback 到 legacy anon key。 | A1 | 静态 import 审计、Mock / Real 两模式测试、缺 publishable key 测试。 | 依赖版本与 env 注入需在 A1 build 验证。 |
| R3：跨域不可行 | 外部同源 gateway；跨域明确不采用。 | A0 只确认环境与缓存安全能力，A1.5 用 A1 最小 Real Auth 验证 Cookie、缓存隔离至根 `/api/auth/me`；V3.1-B 才扩 API 路径。 | A0、A1.5 | A0 环境 / CDN 配置检查 + A1.5 Cookie / cache header / Network / Profile / `/api/auth/me` 验证。 | gateway 是否可用和安全配置是 A0 门禁；真实贯通或隔离失败则阻止 A2。 |
| R4：类型不足与 Register 冲突 | 新增 AuthUser / AuthStatus / OtpIntent；Register 多阶段 + password-setup mode。 | 保留 MockUser，移除页面将其当真实身份的依赖。 | A1–A3 | typecheck、注册 / 既有账号 / 未设密码路径矩阵。 | UI 文案仅限既有结构；若执行中无法容纳，必须停下补 UI Spec。 |
| R5：旧 Architecture / 锁定表述过期或冲突 | 以本文为唯一 mobile V3.1-A Architecture，并以 §4.3 锁定登录 `false` / 注册 `true`。 | Auth Flow Lock、Roadmap、Handoff 已同步为登录 `false`、注册 `true` 的唯一流程。 | 已解决 | 本次现行文档同步经 ChatGPT 最终 Review 后关闭。 | 当前无产品流程冲突；后续如修改 Auth 产品流程，必须同步四份现行文档并重新 Review。 |

### 25.2 风险统计

```text
未解决 P0：0
未解决 Architecture 级 P1：0
实现期风险：
- A0 的 Supabase Email OTP 6 位 Token 配置、publishable key 可用性、同源 gateway/CDN 路径级禁用缓存、Cookie / Set-Cookie / Cache-Control / Expires / Pragma 透传与 Minimum TTL=0 条件；
- A1 的精确 `@supabase/ssr` / `@supabase/supabase-js` 安全版本、唯一 lockfile、publishable key 配置来源与 production public env 注入；以及 `subscriptionGeneration` / `authRevision` / `initRevision` / 页面 request id 的精确实现；
- A1.5 的真实 OTP、Session、`/api/auth/me`、固定 local signOut、缓存响应头、Set-Cookie 不复用、双浏览器 Profile / 隐私窗口隔离、同浏览器 tab SIGNED_OUT、迟到初始化与 PASSWORD_RECOVERY fail-closed 验证；
- A2–A4 的真实设备、网络、邮件服务与多标签 Session 行为。
P2：
- A1.5 验证入口必须由 Execution Plan 在仓库外临时 probe 或受控临时开发入口中唯一选择，并落实授权、生命周期与清除 / 删除 Review；
- Mock adapter 的最小内存 session / passwordSet 与当前 tab local signOut 语义的精确实现方式，留待 Execution Plan 锁定；
- 非致命操作错误的页面局部展示与 transient AuthState.error 清理细节，留待 Execution Plan 锁定。
```

实现期风险不是架构遗漏；每项都有阶段门禁、通过条件和失败即停止规则。

---

## 26. 验收矩阵

### 26.1 Mock 模式

| 场景 | 预期 |
|---|---|
| Welcome → OTP Mock | 保持单一入口，Mock OTP 可走完整 facade contract。 |
| Password Mock | 通过 facade，不再页面 direct import。 |
| Register Mock | 多阶段可完成，进入 required password 后完成 Mock session。 |
| Mock 登出 | 清当前 tab 内存 session，返回 Welcome。 |
| Mock 刷新 | 默认 guest；不把 localStorage boolean 视为 Session。 |
| Mock 文件 | 全部 §23.6 文件仍存在且未覆盖。 |

### 26.2 Real 模式

| 场景 | 预期 |
|---|---|
| 已有账号 OTP 登录 | `shouldCreateUser:false`；正确 code 后 `password_set` 已设则进入 AppShell，缺失则进入 password setup。 |
| 未注册邮箱登录 | 按 A1.5 验证的安全策略温柔引导注册，不静默建号。 |
| 新账号注册 OTP | `shouldCreateUser:true`，验证后建立 Session 并立即进入 password setup，不要求再次登录。 |
| 错误 / 过期验证码 | 归一化温柔提示，停留可恢复页面。 |
| 重新发送 | 真正重新调用 sendOtp，有倒计时、防重复。 |
| 首次设置密码 | 成功后 metadata 更新，才进入 AppShell；已建 Session 时返回键不能退回 register / guest。 |
| 密码登录 | 成功直接进入 AppShell；metadata 缺失仅 best-effort 补写，失败非阻断；OTP 登录仍可访问。 |
| 刷新 | 无 Welcome flash；OTP / 恢复 metadata 缺失进入 required-password gate。 |
| 登出 | Real adapter 固定 `auth.signOut({ scope: "local" })`；成功仅撤销当前浏览器 Session，同 Session 标签页经 `SIGNED_OUT` 收敛 guest；其他 Profile / 设备 Session 保持；失败保留原 `authenticated` 或 `authenticated-needs-password` 状态并可重试。 |
| 初始化 / Auth event 竞态 | getCurrentUser 初始化结果仅在 `subscriptionGeneration` 有效且 `authRevision === initRevision` 时应用；任何非 INITIAL_SESSION event 先提升 revision。验证初始化迟到不覆盖先到的 SIGNED_IN、TOKEN_REFRESHED、USER_UPDATED、SIGNED_OUT 或 PASSWORD_RECOVERY。 |
| PASSWORD_RECOVERY | 不新增恢复页面；先提升 `authRevision`，不进入 AppShell 或普通 authenticated，best-effort local signOut；成功 guest，失败 AuthShell error 且保持 fail-closed。 |
| Session / 缓存隔离 | 登录前 `/api/auth/me` 为 null，登录后为当前用户，刷新 Session 的认证响应不被共享缓存，signOut 后为 null；两个不同浏览器 Profile 或隐私窗口不会得到对方 Session；Network 显示 `private/no-store` 或平台等价状态，`Set-Cookie` 未被缓存后复用。 |
| Publishable key | Real adapter 默认仅读取 `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`；bundle 不含 service role / secret key，缺 publishable key fail-closed；根 legacy anon 与 mobile publishable key 属同一 project 并经 A1.5 project ref、Cookie 名称、`/api/auth/me` 验证兼容。 |
| Session 失效 / 多 tab | 正确回 guest，不出现残留 AppShell。 |
| 网络失败 | 不误判已登录，不暴露 raw error，可重试。 |
| 我的页 | 显示真实邮箱和“账号已登录”，不显示任务已同步。 |
| Shell | Auth 无 BottomTabBar；完整登录只有一套 AppShell。 |
| 返回链 | §17 的 OTP、注册、password setup、完整登录链全部正确。 |

### 26.3 视口与工程门禁

| 类型 | 必测项 |
|---|---|
| 视口 | 375px、390×844、430px；验证码格、键盘、主按钮和退出动作可到达。 |
| 真机 | Android Chrome 必测；iOS Safari 如可用至少验证 Session / OTP / keyboard。 |
| 静态 | lint、build、TypeScript、`git diff --check`。 |
| Git | `git status --short`、`git diff --name-only`、staged 核验、执行方案文件范围核验。 |
| 安全 | browser bundle 不含 `SUPABASE_SERVICE_ROLE_KEY`、`sb_secret_*` 或其他 secret key；Real adapter 默认只读 publishable key；页面不 import raw adapters / Supabase；日志不含 OTP / password / token。 |

---

## 27. Execution Plan 必须回答的问题

ChatGPT 审查本文通过后，V3.1-A Execution Plan 必须逐项锁定：

1. A0 的真实 gateway host、端口 / 部署拓扑、Supabase Dashboard Email OTP 6 位 Token 配置、publishable key 可用性、认证路径 Caching Disabled / Minimum TTL=0、Cookie / Set-Cookie / Cache-Control / Expires / Pragma 透传能力，以及前置检查证据由谁提供；若 A0 失败，停止条件与汇报格式。
2. 实际 package manager、`apps/mobile-app` 安装依赖时唯一会变化的 lockfile，以及 package.json 与该 lockfile 的同一依赖变更范围；未确认前不得安装依赖，禁止更新其他 lockfile 或重建 workspace 依赖。
3. mobile 与根工程当前 `@supabase/ssr` 版本；mobile 使用的 `@supabase/ssr`、`@supabase/supabase-js` 精确版本及唯一 lockfile 影响；不得用 `latest`，不得选用低于已知 v0.10.0 且缺少 cookie cache-header 能力的版本，除非提供等价安全证明；根版本较旧时不得顺带升级。
4. publishable key 的实际配置来源、环境变量文件位置、生产部署注入方式，以及防止 `SUPABASE_SERVICE_ROLE_KEY`、`sb_secret_*` 或其他 secret key 进入 browser bundle 的检查方法；不得默认使用 legacy anon key。
5. `AuthFacade`、Auth types、mobile error mapper 的确切文件路径与 export 方向；不得形成循环依赖。
6. Mock adapter 如何自然包装每个既有 mock function，并仅以最小内存状态补足 facade Session / passwordSet 语义；不得伪造无意义产品输入或改原 Mock source。
7. `OtpLoginPage` / `RegisterPage` 的精确 Props、共享内部 UI / hook 范围和逐个状态字段；不得复制 provider 调用；Session 建立后必须从 Register 局部流程切至顶层 password-setup。
8. `page.tsx` 的 AuthState reducer / callbacks、互不合并的 `subscriptionGeneration`、`authRevision`、`initRevision` 与页面 action request id；唯一初始化策略、INITIAL_SESSION 忽略、所有非 INITIAL_SESSION event 先提升 revision、Strict Mode cleanup、各 subscription event 与 async action guard。
9. Real adapter 的唯一 local signOut 调用 `auth.signOut({ scope: "local" })`、Mock adapter 当前 tab 语义、同浏览器 tab 收敛、其他 Profile / 设备不受影响，以及未来 global signOut 不属于本阶段的边界。
10. `PASSWORD_RECOVERY` 的 fail-closed 流程：revision 提升、旧初始化 / action 失效、local signOut、成功 guest、失败 AuthShell error、安全 retry 与仅记录 operation / normalized error code / retryable 的日志边界。
11. RegisterPage 的 password-setup mode 精确文案、显式退出行为、`auth-password-setup / 70` 与 `register-flow / 66` 的注册 / 清理边界、各 handler 对 busy 的处理。
12. `MeConfirmSheet` 的异步确认、错误和禁用行为如何做到最小 UI 改动。
13. Account / Sync 文案的最终精确文本，确保不承诺 V3.1-B 的任务同步。
14. A1.5 在仓库外临时 probe 与受控临时开发入口中**唯一选择**哪一方案；ChatGPT 授权、精确文件 / 存放路径、开发可达性、生产不可达性、敏感数据禁止、生命周期、删除 / 清除、Claude Code Review 和不进入最终提交的证据；并记录真实 OTP、Session、`/api/auth/me`、local signOut、cache headers、`Set-Cookie`、双浏览器 Profile / 隐私窗口隔离、同 Session 标签页 SIGNED_OUT、迟到初始化 race 和 PASSWORD_RECOVERY fail-closed 验证，及登录 unknown / 注册 existing 邮箱的稳定 provider error code / status 与无法区分时的中性 fallback。
15. 不得修改的 `src/**`、根 config、database、Mock、AppShell、BottomTabBar、BackController、today / footprints / growth 的完整核验清单。
16. 每小阶段的 exact file list、验收命令、manual test matrix、rollback boundary、Review gate 与提交授权条件。

没有完成以上锁定，不得调用 Codex 施工。

---

## 28. 最终架构结论

1. **技术路线：** 选择 `Auth facade → Real adapter → Supabase Browser Client`；页面不直接依赖任何实现细节。
2. **Mock：** 所有 Mock 文件永久保留；通过新增 Mock adapter 与 Real adapter 受控切换，切换点只存在于一个 facade selector。
3. **Auth 状态：** [page.tsx](../apps/mobile-app/app/page.tsx) 升级为初始化、guest、认证中、待设置密码、完整登录、退出中、错误的单一所有者；Session 恢复前不显示 Welcome 或 AppShell。
4. **产品流程：** OTP 登录 `shouldCreateUser:false`，显式注册 `true`；注册 OTP 成功后立即离开 Register 局部步骤并进入顶层 password-setup。OTP / 启动恢复缺少 `password_set` 时必须完成首次设置密码；密码登录成功是明确例外，直接 authenticated，metadata 补写仅为非阻断体验标记；密码登录与 OTP 长期并存。
5. **我的页：** 显示真实邮箱与“账号已登录”，不提前宣称任务已同步。
6. **返回链：** 保持现有 BackController；`register-flow / 66` 只处理 Session 建立前的 `register-code → register-email`，`auth-password-setup / 70` 处理已建 Session 的密码设置门禁；没有第二个 History API listener。
7. **部署与验证：** A0 只做 Supabase 6 位 Token、publishable key、同源 gateway/CDN 与认证路径缓存安全前置检查；gateway、CDN、反向代理和 ISR 不得缓存认证响应，必须透传 Cookie、Set-Cookie、Cache-Control、Expires、Pragma，Minimum TTL 必须为 0 或等价 Caching Disabled。A1 建立仅使用 `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 的最小 Real Auth 后，A1.5 由 Execution Plan 在唯一获批验证入口中验证真实 OTP、Cookie Session、同源 `/api/auth/me`、固定 `auth.signOut({ scope: "local" })`、`private/no-store` 等价响应、Set-Cookie 不复用、双 Profile 隔离、同 Session 标签页 SIGNED_OUT、迟到初始化 event race 与 PASSWORD_RECOVERY fail-closed。根工程 legacy anon key 不在本阶段修改；若根或 gateway 无法证明安全缓存、local scope 或 recovery fail-closed，停止，不进入 A2。跨域、Next rewrite 和根工程托管不采用。
8. **并发与退出语义：** `subscriptionGeneration` 只负责 effect 生命周期，`authRevision` 只负责 Auth event 顺序，`initRevision` 只负责初始化快照，页面 action 使用独立 request id；四者不得合并。非 INITIAL_SESSION event 必须先提升 revision，迟到初始化与 action 不得覆盖新状态。产品“退出当前账号”只退出当前浏览器 Session；同 Session 标签页收敛 guest，其他 Profile 与设备不受影响；本阶段不实现 global signOut。PASSWORD_RECOVERY 必须 local signOut fail-closed，绝不进入 AppShell。
9. **依赖与密钥：** mobile 必须锁定支持 Cookie / cache-header 安全行为的精确 `@supabase/ssr` / `@supabase/supabase-js` 版本和唯一 lockfile；不得 `latest`、不得默认回退 legacy anon key，且 `SUPABASE_SERVICE_ROLE_KEY`、`sb_secret_*` 与任何 secret key 永不进入 browser bundle。
10. **阶段边界：** V3.1-A 只做认证；真实任务、deviceId、匿名迁移、历史、成长、AI 和任务同步均严格推迟到 V3.1-B。
11. **进入下一步：** 本 Architecture 已消除 R0–R7、本轮 Gateway / CDN 缓存安全 P0、Publishable Key P1、初始化 / Auth 事件竞态 P1、local signOut scope P1 及此前 P1-1 至 P1-6 的 Architecture 级问题；A0 / A1.5 只负责验证，不得假定安全。Architecture 已通过 Review，并已与现行 Auth Flow Lock、Roadmap 和 Handoff 完成流程同步，已具备编写 V3.1-A Execution Plan 的文档条件。Execution Plan 尚未创建，必须由 Claude Code 编写并再次交 ChatGPT 审查；Codex 仍未获得代码授权。
