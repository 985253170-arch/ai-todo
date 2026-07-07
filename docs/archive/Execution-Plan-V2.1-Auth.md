# Execution-Plan-V2.1-Auth.md — V2.1 Auth 执行方案

> **状态**：执行方案，待 ChatGPT 审查
> **依赖**：[Architecture-V2.1-Auth.md](Architecture-V2.1-Auth.md)（架构方案已通过 ChatGPT 审查）
> **上一文档**：[Architecture-V2.1-Auth.md](Architecture-V2.1-Auth.md)
> **编写日期**：2026-07-02
> **受众**：Codex（实现者）

---

## 目录

- [一、执行概述](#一执行概述)
- [二、允许修改文件清单](#二允许修改文件清单)
- [三、禁止修改文件清单](#三禁止修改文件清单)
- [四、文件 1：useAuth.ts 改造](#四文件-1useauthts-改造)
- [五、文件 2：AuthModal.tsx 重写](#五文件-2authmodaltsx-重写)
- [六、文件 3：Header.tsx 适配](#六文件-3headertsx-适配)
- [七、文件 4：auth/callback/route.ts 简化](#七文件-4authcallbackroutets-简化)
- [八、文件 5：constants.ts 文案更新](#八文件-5constantsts-文案更新)
- [九、Supabase Dashboard 人工配置](#九supabase-dashboard-人工配置)
- [十、匿名迁移兼容性说明](#十匿名迁移兼容性说明)
- [十一、Phase 15 兼容性说明](#十一phase-15-兼容性说明)
- [十二、验收标准](#十二验收标准)
- [十三、风险与缓解](#十三风险与缓解)
- [十四、给 Codex 的执行边界提醒](#十四给-codex-的执行边界提醒)

---

## 一、执行概述

### 1.1 目标

把当前 Magic Link（邮箱链接）登录改造为 Email + Password 注册 / 登录。

### 1.2 改动面

| 项目 | 数值 |
|------|:---:|
| 修改文件 | 5 个 |
| 新增文件 | 0 个 |
| 删除文件 | 0 个 |
| 新增 npm 依赖 | 0 个 |
| 数据库 schema 变更 | 0 个 |
| API Route 变更 | 0 个（callback route 不算业务 API） |

### 1.3 实现顺序

```
Step 1: useAuth.ts       → 改 Hook 接口（signIn/signUp/signOut）
Step 2: constants.ts     → 改文案
Step 3: AuthModal.tsx    → 重写 UI（依赖 Step 1 + 2）
Step 4: Header.tsx       → 适配新 props（依赖 Step 1 + 3）
Step 5: callback/route.ts → 简化逻辑（独立，可与 Step 1-4 并行）
```

推荐 Codex 按 Step 1 → Step 2 → Step 3 → Step 4 → Step 5 顺序实现，每步执行后 `npm run lint` 确认无 error。

---

## 二、允许修改文件清单

| # | 文件 | 操作 | 预计行数 | 说明 |
|---|------|:---:|:---:|------|
| 1 | `src/hooks/useAuth.ts` | **修改** | ~100 行（改） | signIn 签名变更 + signUp 新增 + verifyOtp 移除 |
| 2 | `src/components/AuthModal.tsx` | **重写** | ~250 行（新） | 双模式（登录/注册）表单 |
| 3 | `src/components/Header.tsx` | **微调** | ~10 行（改） | AuthModal props 适配 |
| 4 | `src/app/auth/callback/route.ts` | **简化** | ~70 行（新） | 移除 Magic Link code 交换，仅保留邮箱确认 |
| 5 | `src/lib/constants.ts` | **修改** | ~40 行（改） | AUTH_TEXT 更新 |

**总计：5 个文件，约 470 行变更（~340 新增 + ~130 删除）。**

### 关于是否需要第 6 个文件的审查结论

逐一排查后发现不需要：

| 疑似需要 | 排查结果 | 结论 |
|----------|---------|:--:|
| `src/app/page.tsx` | 不直接调用 `signIn`——只通过 Header → AuthModal 消费 | 不改 |
| `src/lib/types.ts` | `AuthUser = { id, email }` 完全不变 | 不改 |
| `src/lib/supabase-server.ts` | `getAuthenticatedUserId()` 与登录方式无关 | 不改 |
| `src/lib/supabase-client.ts` | `createSupabaseBrowserClient()` 不变 | 不改 |
| `src/lib/device-id.ts` | device_id 逻辑不变 | 不改 |
| `src/hooks/useTaskGroup.ts` | `restoreForAuthUser()` 依赖 `user.id`，与登录方式无关 | 不改 |

---

## 三、禁止修改文件清单

以下文件 **V2.1 完全不动**。Codex 实现时如果发现需要改这些文件中的任何一个，必须停下来汇报——说明执行方案有遗漏。

```
# 页面入口
src/app/page.tsx

# 服务端基础设施
src/lib/supabase-server.ts
src/lib/supabase-client.ts
src/lib/device-id.ts

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

# 前端 Hooks（useAuth 除外）
src/hooks/useTaskGroup.ts
src/hooks/useTaskReview.ts
src/hooks/useTaskStats.ts
src/hooks/useTaskHistory.ts

# UI 组件（AuthModal + Header 除外）
src/components/GoalInput.tsx
src/components/TaskList.tsx
src/components/StatsBar.tsx
src/components/HistoryPanel.tsx
src/components/TaskReviewPanel.tsx

# AI 相关
src/lib/ai-client.ts
src/lib/task-parser.ts
src/lib/review-parser.ts
src/lib/stats-calculator.ts
src/lib/adjust-task-strategy.ts
src/prompts/task-generation.ts
src/prompts/task-review.ts

# 其他
src/lib/types.ts
src/lib/storage.ts
src/lib/input-validator.ts
src/lib/date-utils.ts
package.json
数据库 schema / migration
.env.local
```

---

## 四、文件 1：useAuth.ts 改造

**当前文件**：`src/hooks/useAuth.ts`（121 行）

### 4.1 当前代码分析

```typescript
// 当前导出
return {
  user,        // AuthUser | null
  isLoading,   // boolean
  signIn,      // (email: string) => Promise<void>   ← signInWithOtp
  verifyOtp,   // (email: string, token: string) => Promise<void>
  signOut,     // () => Promise<void>
};
```

当前 `signIn` 内部调用 `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo } })`——发送 Magic Link 邮件。

### 4.2 改造后接口

```typescript
// 改造后导出
return {
  user,        // AuthUser | null  ← 不变
  isLoading,   // boolean         ← 不变
  signUp,      // (email: string, password: string) => Promise<void>  ← 新增
  signIn,      // (email: string, password: string) => Promise<void>  ← 签名变更
  signOut,     // () => Promise<void>  ← 不变
};
```

### 4.3 保持不变的部分（直接保留，不修改）

| 代码段 | 说明 |
|--------|------|
| `toAuthUser()` | `{ id, email }` 映射函数，与登录方式无关 |
| `logSafeAuthError()` | 错误日志脱敏函数，与登录方式无关 |
| `useMemo(() => createSupabaseBrowserClient(), [])` | 客户端初始化 |
| `useEffect` 中的 `supabase.auth.getUser()` | 初始化时恢复 session |
| `useEffect` 中的 `onAuthStateChange` | 监听 session 变化 |
| `isMounted` 清理逻辑 | 防止内存泄漏 |
| `signOut` 函数（第 100-112 行） | `signOut()` → 清除 cookie → `setUser(null)` |

### 4.4 需要移除的代码

| 移除 | 行号 | 说明 |
|------|------|------|
| `signIn` 函数体（第 60-79 行） | 60-79 | 替换为新实现（见 4.5） |
| `verifyOtp` 函数（第 82-98 行） | 82-98 | email+password 不需要验证码 |
| 导出中的 `verifyOtp` | 118 | 从 return 对象中移除 |

### 4.5 需要新增/修改的代码

#### 4.5.1 新增 signUp 函数

```typescript
async function signUp(email: string, password: string) {
  if (!supabase) {
    throw new Error("AUTH_NOT_CONFIGURED");
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    logSafeAuthError(error);
    throw error;
  }
  // 注意：开启邮箱确认时，signUp 返回的 data.user 存在但 data.session 为 null
  // 不调用 setUser()——等用户点击确认邮件后 onAuthStateChange 自动触发
}
```

**关键说明**：注册成功后不调用 `setUser()`。因为 Supabase 开启邮箱确认后 `signUp` 返回的 `data.session` 为 `null`。用户需要去邮箱点击确认链接，确认后 `onAuthStateChange` 自动触发，将 user 设置为已确认用户。

#### 4.5.2 修改 signIn 函数（替换旧实现）

```typescript
async function signIn(email: string, password: string) {
  if (!supabase) {
    throw new Error("AUTH_NOT_CONFIGURED");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    logSafeAuthError(error);
    throw error;
  }

  // data.session 存在 → onAuthStateChange 自动触发 → user 更新
  // 但为了一致性也手动 setUser
  setUser(toAuthUser(data.user));
}
```

**关键说明**：`signInWithPassword` 成功后 `data.session` 已存在，Supabase JS SDK 自动将 session 写入 cookie。`onAuthStateChange` 会再次触发 `setUser`，这里手动调用是为了 UI 即时响应（避免等待 listener 触发）。

#### 4.5.3 signOut（不变，保留原样）

第 100-112 行的 `signOut` 函数完全保留，不修改。

### 4.6 完整改造后 useAuth.ts 结构

```
 1-25  导入 + toAuthUser + logSafeAuthError  ← 不变
26-58  useState + useEffect（session 初始化） ← 不变
60-75  signUp(email, password)                ← 新增
77-95  signIn(email, password)                ← 替换旧 signIn
97-109 signOut()                              ← 不变
111-116 return { user, isLoading, signUp, signIn, signOut }
```

**不再包含 `verifyOtp`。不再包含 `signInWithOtp`。不再包含 `emailRedirectTo`。**

---

## 五、文件 2：AuthModal.tsx 重写

**当前文件**：`src/components/AuthModal.tsx`（134 行）

### 5.1 当前代码分析

```
组件状态：
  - email: string
  - message: string | null
  - errorMessage: string | null
  - isSubmitting: boolean

Props：
  - isOpen, isAuthenticated, onClose
  - onSignIn: (email: string) => Promise<void>

渲染：
  - 单一表单：邮箱输入框 + "发送登录链接"按钮
  - 成功后显示 AUTH_TEXT.MAGIC_LINK_SENT
  - 错误显示 getSafeErrorMessage(error)
```

### 5.2 改造目标

双模式 AuthModal：登录模式 / 注册模式，Tab 切换。

### 5.3 新增/修改的 Props

```typescript
interface AuthModalProps {
  isOpen: boolean;
  isAuthenticated: boolean;
  onClose: () => void;
  onSignIn: (email: string, password: string) => Promise<void>;   // 签名变更
  onSignUp: (email: string, password: string) => Promise<void>;   // 新增
}
```

### 5.4 组件内部状态

```typescript
const [mode, setMode] = useState<"login" | "signup">("login");  // 新增
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");                     // 新增
const [confirmPassword, setConfirmPassword] = useState("");       // 新增（仅注册模式）
const [message, setMessage] = useState<string | null>(null);
const [errorMessage, setErrorMessage] = useState<string | null>(null);
const [isSubmitting, setIsSubmitting] = useState(false);
```

### 5.5 表单校验规则

| 校验项 | 规则 | 触发时机 | 错误提示 |
|--------|------|---------|---------|
| 邮箱非空 | `email.trim()` 不为空 | 提交时 | "请输入邮箱。" |
| 邮箱格式 | 浏览器 `type="email"` 原生校验 | 提交时 | 浏览器默认提示 |
| 密码非空 | `password` 不为空 | 提交时 | "请输入密码。" |
| 密码长度 | `password.length >= 6` | 提交时 | "密码至少需要 6 位。" |
| 确认密码一致 | `password === confirmPassword` | 提交时（仅注册） | "两次输入的密码不一致。" |

**所有校验在 `handleSubmit` 开头统一执行，不通过则 setErrorMessage + return，不发请求。**

### 5.6 登录模式 UI

```
┌────────────────────────────────────────────┐
│                                            │
│          [登录]    |    注册                │  ← Tab 切换
│          ——————                           │
│                                            │
│    ┌──────────────────────────────────┐    │
│    │  your@email.com                  │    │  ← type="email"
│    └──────────────────────────────────┘    │
│    ┌──────────────────────────────────┐    │
│    │  密码（至少 6 位）                │    │  ← type="password"
│    └──────────────────────────────────┘    │
│                                            │
│    ┌──────────────────────────────────┐    │
│    │           登  录                  │    │  ← isSubmitting 时显示"登录中..."
│    └──────────────────────────────────┘    │
│                                            │
│    没有账号？切换到「注册」创建账号。        │
│                                            │
└────────────────────────────────────────────┘
```

### 5.7 注册模式 UI

```
┌────────────────────────────────────────────┐
│                                            │
│          登录    |    [注册]                │  ← Tab 切换
│                       ——————               │
│                                            │
│    ┌──────────────────────────────────┐    │
│    │  your@email.com                  │    │
│    └──────────────────────────────────┘    │
│    ┌──────────────────────────────────┐    │
│    │  密码（至少 6 位）                │    │
│    └──────────────────────────────────┘    │
│    ┌──────────────────────────────────┐    │
│    │  确认密码                         │    │  ← 仅注册模式
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

### 5.8 注册成功后的 UI（邮箱确认已开启）

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

触发条件：`signUp()` 成功（没有 throw）→ `setMessage(AUTH_TEXT.SIGNUP_SUCCESS)` → 切换到此视图。此时表单不渲染，用户点击"关闭"关闭弹窗。

### 5.9 错误处理

| 场景 | 处理方式 |
|------|---------|
| 邮箱为空 | `setErrorMessage("请输入邮箱。")` |
| 密码为空 | `setErrorMessage("请输入密码。")` |
| 密码 < 6 位 | `setErrorMessage("密码至少需要 6 位。")` |
| 确认密码不一致 | `setErrorMessage("两次输入的密码不一致。")` |
| Supabase 返回错误 | `setErrorMessage(getSafeErrorMessage(error))` |
| 登录成功后 isAuthenticated 变为 true | `useEffect` 监听 → `onClose()`（保持现有逻辑） |

**保留现有 `getSafeErrorMessage` 函数**（处理 rate limit 等 Supabase 错误），并增加常见密码相关错误的中文映射：

| Supabase Error | 中文提示 |
|----------------|---------|
| `Invalid login credentials` | 邮箱或密码错误，请重试。 |
| `User already registered` | 该邮箱已注册，请直接登录。 |
| `Password should be at least 6 characters` | 密码至少需要 6 位。 |
| `Unable to validate email address: invalid format` | 邮箱格式不正确。 |
| `Email not confirmed` | 邮箱尚未确认，请先点击确认邮件中的链接。 |

### 5.10 移动端适配

| 元素 | 做法 |
|------|------|
| 遮罩层 | `fixed inset-0 px-4 py-6` — 保留左右留白 |
| 弹窗宽度 | `max-w-sm w-full` — 手机上 375-414px 不溢出 |
| 输入框 | `min-h-12` — 44px 最小触控目标 |
| 按钮 | `min-h-12` — 同上 |
| 底部提示文字 | `text-sm` — 可读 |
| Tab 切换 | 内联按钮 + 底部下划线指示器 |

### 5.11 保留不变的部分

| 代码段 | 说明 |
|--------|------|
| `useEffect(() => { if (isAuthenticated) onClose() }, [isAuthenticated])` | 登录成功后自动关闭弹窗 |
| `if (!isOpen) return null` | 弹窗外不渲染 |
| 遮罩层结构（`role="dialog"`, `aria-modal="true"`） | 无障碍属性 |
| 关闭按钮（右上角 × + 点击遮罩不关闭） | 交互模式 |
| `getSafeErrorMessage` 函数 | 增加映射、保留 rate limit 处理 |

---

## 六、文件 3：Header.tsx 适配

**当前文件**：`src/components/Header.tsx`（88 行）

### 6.1 当前代码分析

```typescript
const { user, isLoading, signIn, signOut } = useAuth();
// ...
<AuthModal
  isAuthenticated={Boolean(user)}
  isOpen={isAuthModalOpen}
  onClose={() => setIsAuthModalOpen(false)}
  onSignIn={signIn}                    // ← signIn 签名变了
/>
```

### 6.2 需要改动的位置

| 行号 | 改动 | 说明 |
|------|------|------|
| 20 | `const { user, isLoading, signIn, signOut } = useAuth()` | 改为 `const { user, isLoading, signIn, signUp, signOut } = useAuth()` |
| 84 | `<AuthModal ... onSignIn={signIn} />` | 改为 `<AuthModal ... onSignIn={signIn} onSignUp={signUp} />` |

### 6.3 不改的部分

- 登录状态展示（`user.email` + 登出按钮）：不变
- Loading 状态（`isLoading` → "登录状态..."）：不变
- 未登录状态（"登录"按钮）：不变
- 历史按钮：不变
- 整个 header 布局：不变

**实际改动：约 2 行。** Header.tsx 是改动最小的文件。

---

## 七、文件 4：auth/callback/route.ts 简化

**当前文件**：`src/app/auth/callback/route.ts`（113 行）

### 7.1 当前代码分析

当前 callback route 处理两条路径：

```
路径 A（code）：
  → code 参数存在
  → supabase.auth.exchangeCodeForSession(code)
  → 重定向

路径 B（token_hash）：
  → token_hash + type 参数存在
  → supabase.auth.verifyOtp({ token_hash, type })
  → 重定向
```

`getOtpType()` 当前接受 6 种 type：`"signup", "invite", "magiclink", "recovery", "email_change", "email"`。

### 7.2 改造目标

- **移除路径 A**（`code` / `exchangeCodeForSession`）——V2.1 不再使用 Magic Link，不再需要 code 交换
- **保留路径 B**（`token_hash` / `verifyOtp`）——仅用于邮箱确认回调
- **type 限定为 `"email"`**——不写 `type=signup`

### 7.3 需要移除的代码

| 移除 | 当前行号 | 说明 |
|------|------|------|
| `code` 变量及判断 | 52, 60-63 | 不再使用 `code` 参数 |
| `exchangeCodeForSession` 整个分支 | 84-94 | 不再使用 Magic Link |
| `getOtpType` 中的多余 type | 34-49 | 只保留 `"email"` |

### 7.4 改造后 getOtpType

```typescript
function getOtpType(type: string | null): EmailOtpType | null {
  if (type === "email") {
    return "email";
  }
  return null;
}
```

**只接受 `type=email`。** 不写 `type=signup`、不写 `type=email_change`。

### 7.5 改造后 GET handler 主逻辑（伪代码）

```typescript
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const otpType = getOtpType(request.nextUrl.searchParams.get("type"));
  const redirectUrl = getRedirectUrl(request);

  // 不再检查 code 参数

  if (!tokenHash || !otpType) {
    // 无有效 token → 直接重定向首页
    return NextResponse.redirect(redirectUrl);
  }

  // Supabase client 初始化（不变）
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // verifyOtp 仅用于邮箱确认
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: otpType,  // 只能是 "email"
  });

  if (error) {
    // 确认失败 → 重定向首页
    return NextResponse.redirect(redirectUrl);
  }

  // 确认成功 → 重定向首页
  return NextResponse.redirect(redirectUrl);
}
```

### 7.6 保留不变的部分

| 代码段 | 说明 |
|--------|------|
| `getSafeNextPath()` | 防止 open redirect |
| `getRedirectUrl()` | 构建安全的重定向 URL |
| `setAuthCallbackError()` | 错误参数注入（可选保留） |
| `getSafeAuthError()` | 错误信息脱敏 |
| Supabase client 创建逻辑 | Cookie 处理不变 |

---

## 八、文件 5：constants.ts 文案更新

**当前文件**：`src/lib/constants.ts`（71 行）

### 8.1 当前 AUTH_TEXT（需要替换）

```typescript
export const AUTH_TEXT = {
  LOGIN: "登录",
  LOGGED_IN: "已登录",
  LOGGING_STATUS: "登录状态...",
  LOGOUT: "登出",
  MODAL_TITLE: "登录 AI Todo",
  MODAL_DESCRIPTION: "发送登录链接后，请前往邮箱点击链接完成登录。",
  EMAIL_LABEL: "邮箱",
  EMAIL_PLACEHOLDER: "you@example.com",
  SEND_LINK: "发送登录链接",
  SENDING_LINK: "发送中...",
  MAGIC_LINK_SENT: "请前往邮箱点击登录链接。",
  EMAIL_REQUIRED: "请先输入邮箱。",
  EMAIL_RATE_LIMITED: "邮件发送过于频繁，请稍后再试。",
  CLOSE: "关闭登录弹窗",
} as const;
```

### 8.2 改造后 AUTH_TEXT

```typescript
export const AUTH_TEXT = {
  // 通用
  LOGIN: "登录",
  LOGGED_IN: "已登录",
  LOGGING_STATUS: "登录状态...",
  LOGOUT: "登出",
  CLOSE: "关闭",

  // AuthModal 通用
  MODAL_TITLE: "登录 AI Todo",
  MODAL_DESCRIPTION: "登录后可以多设备同步任务数据。",
  EMAIL_LABEL: "邮箱",
  EMAIL_PLACEHOLDER: "you@example.com",
  PASSWORD_LABEL: "密码",
  PASSWORD_PLACEHOLDER: "至少 6 位",
  CONFIRM_PASSWORD_LABEL: "确认密码",
  CONFIRM_PASSWORD_PLACEHOLDER: "再次输入密码",

  // 登录模式
  LOGIN_TAB: "登录",
  LOGIN_BUTTON: "登录",
  LOGIN_LOADING: "登录中...",
  LOGIN_SWITCH_HINT: "没有账号？切换到「注册」创建账号。",

  // 注册模式
  SIGNUP_TAB: "注册",
  SIGNUP_BUTTON: "注册",
  SIGNUP_LOADING: "注册中...",
  SIGNUP_SUCCESS_TITLE: "✅ 注册成功",
  SIGNUP_SUCCESS_MESSAGE: "确认邮件已发送，请前往邮箱点击确认链接，然后登录。",
  SIGNUP_SWITCH_HINT: "已有账号？切换到「登录」。",

  // 校验错误
  EMAIL_REQUIRED: "请输入邮箱。",
  PASSWORD_REQUIRED: "请输入密码。",
  PASSWORD_TOO_SHORT: "密码至少需要 6 位。",
  PASSWORD_MISMATCH: "两次输入的密码不一致。",

  // 服务端错误映射
  EMAIL_RATE_LIMITED: "操作过于频繁，请稍后再试。",
} as const;
```

### 8.3 移除的 key

| 移除 | 原因 |
|------|------|
| `SEND_LINK` | 不再发送 Magic Link |
| `SENDING_LINK` | 同上 |
| `MAGIC_LINK_SENT` | 同上 |
| `MODAL_DESCRIPTION`（旧） | 提到"发送登录链接"，改为新描述 |

### 8.4 UI_TEXT 和 ERROR_MESSAGES

**不变。** 只修改 `AUTH_TEXT` 对象。`UI_TEXT` 和 `ERROR_MESSAGES` 完全不动。

---

## 九、Supabase Dashboard 人工配置

V2.1 代码部署前，需在 Supabase Dashboard 完成以下配置。**这些是人工操作，不属于代码变更。**

### 9.1 Authentication → Settings → Email

| 设置项 | 推荐值 | 说明 |
|--------|:---:|------|
| Allow new users to sign up | **ON** | 允许注册 |
| Confirm email | **ON** | 注册后发送确认邮件 |
| Allow unconfirmed email sign in | **OFF** | 未确认邮箱不能登录 |
| SMTP Sender | 自定义 | 可选，V2.1 可以先用 Supabase 默认发件人 |

### 9.2 Authentication → Email Templates → Confirm signup

如果使用自定义 `/auth/callback` 处理邮箱确认，**必须修改 Confirm signup 邮件模板**：

把默认的：
```
{{ .ConfirmationURL }}
```

替换为：
```
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email
```

> ⚠️ 注意：写 `type=email`，不要写 `type=signup`。

### 9.3 Authentication → URL Configuration

| 设置项 | 值 |
|--------|-----|
| Site URL | Vercel 生产域名（如 `https://ai-todo.vercel.app`） |
| Redirect URLs | 生产域名 + `http://localhost:3000`（本地开发） |

---

## 十、匿名迁移兼容性说明

### 10.1 迁移逻辑不修改

匿名 → 登录任务迁移由 `useTaskGroup.restoreForAuthUser()` 驱动，调用 `POST /api/task-group/migrate`。

迁移触发条件：`user.id` 从 `null` 变为一个 UUID（即用户登录成功）。

V2.1 中 `signInWithPassword` 成功后 `onAuthStateChange` 触发，`user` 从 `null` 变为 `{ id, email }`。这与 Magic Link 的 `verifyOtp` 成功后的行为**完全一致**。

### 10.2 不改的文件

- `src/hooks/useTaskGroup.ts` — 迁移逻辑不变
- `src/app/api/task-group/migrate/route.ts` — API 不变
- `src/lib/supabase-server.ts` — `getAuthenticatedUserId()` 不变

### 10.3 为什么不受影响

迁移依赖的是"`user.id` 存在"这个条件。无论用户通过 Magic Link 还是 Email+Password 登录，`user.id` 都是同一个 Supabase Auth UUID。迁移的 API Route 和 useTaskGroup 逻辑零改动。

---

## 十一、Phase 15 兼容性说明

### 11.1 generate-tasks API

Phase 15 在 `POST /api/generate-tasks` 中：

```typescript
const userId = await getAuthenticatedUserId();
// userId 存在 → 基于 user_id stats → computeAdjustment → 增强 Prompt
// userId 不存在 → 基于 device_id stats → computeAdjustment → 增强 Prompt
```

**完全不受影响。** `getAuthenticatedUserId()` 的返回值不依赖登录方式。`signInWithPassword` 写入的 session cookie 与 Magic Link 写入的 session cookie 完全相同。

### 11.2 不改的文件

- `src/app/api/generate-tasks/route.ts`
- `src/lib/stats-calculator.ts`
- `src/lib/adjust-task-strategy.ts`

---

## 十二、验收标准

### 12.1 功能验收

| # | 验收项 | 预期结果 |
|---|--------|---------|
| 1 | 未登录 → 生成任务 | 正常生成，device_id 归属 |
| 2 | 未登录 → 勾选任务 | 正常，StatsBar 更新 |
| 3 | 未登录 → AI 复盘 | 正常生成复盘 |
| 4 | 注册：输入新邮箱+密码 → 点击注册 | 显示"确认邮件已发送" |
| 5 | 注册：邮箱已存在 → 点击注册 | 显示"该邮箱已注册" |
| 6 | 注册：密码 < 6 位 → 点击注册 | 前端拦截，显示"密码至少需要 6 位" |
| 7 | 注册：确认密码不一致 → 点击注册 | 前端拦截，显示"两次输入的密码不一致" |
| 8 | 邮箱确认：点击邮件链接 | 跳回网站，邮箱状态变为"已确认" |
| 9 | 登录：已确认邮箱+正确密码 → 登录 | Header 显示邮箱 + 登出按钮 |
| 10 | 登录：错误密码 → 登录 | 显示"邮箱或密码错误" |
| 11 | 登录：未确认邮箱 → 登录 | 显示"邮箱尚未确认" |
| 12 | 登录后刷新页面 | 仍显示已登录 |
| 13 | 登出 | Header 恢复"登录"按钮，回退匿名模式 |
| 14 | 匿名 → 登录任务迁移 | 未登录时生成的任务在登录后绑定到 user_id |
| 15 | 登录后 AI 复盘 | 正常 |
| 16 | 登录后 Phase 15 智能调整 | 基于 user_id stats |
| 17 | 未登录 Phase 15 智能调整 | 基于 device_id stats（回退） |

### 12.2 UI 验收

| # | 验收项 | 预期结果 |
|---|--------|---------|
| 18 | 登录/注册 Tab 切换 | 点击 Tab 切换表单，默认"登录" |
| 19 | 密码显示/隐藏切换 | 点击眼睛图标切换 `type="password"` ↔ `type="text"` |
| 20 | 手机端 375px 宽度 | AuthModal 不溢出，输入框可操作 |
| 21 | 按钮 loading 状态 | 显示"登录中..." / "注册中..."，disabled |
| 22 | 错误提示样式 | 红色内联文字，浅红背景 |

### 12.3 安全验收

| # | 验收项 | 预期结果 |
|---|--------|---------|
| 23 | 前端请求体不含 userId | DevTools Network 确认 |
| 24 | 应用自有 API 请求体不含 password | DevTools Network 检查 `/api/*` 请求 → 不含 password。Supabase Auth 请求中出现 password 属于正常行为（密码直接发送到 Supabase Auth HTTPS 接口，不经过应用 API） |
| 25 | Service Role Key 不出现在前端 | DevTools Sources 搜索 `SUPABASE_SERVICE_ROLE_KEY` 无结果 |
| 26 | 登出后 API 不能访问 user_id 数据 | 登出 → 回退 device_id |

### 12.4 门禁验收

| # | 验收项 | 命令 |
|---|--------|------|
| 27 | TypeScript 编译通过 | `npm run lint` |
| 28 | Next.js 构建通过 | `npm run build` |
| 29 | 无新增 console error/warning | 手动检查 |
| 30 | `git status --short` 仅显示 5 个允许文件 | 手动检查 |

---

## 十三、风险与缓解

| # | 风险 | 等级 | 影响 | 缓解措施 |
|---|------|:---:|------|---------|
| 1 | 邮箱确认链接配置错误（邮件模板未改或 type 写成 signup） | **P1** | 用户点击确认链接后 callback route 无法处理 | 严格按照 §九 配置邮件模板；部署前在 localhost 完整走通注册→确认→登录流程 |
| 2 | 未确认邮箱无法登录（Dashboard 设置 "Allow unconfirmed sign in" = OFF） | **P2** | 用户注册后未查收邮件直接尝试登录 → 报错 | 注册成功提示明确引导"请前往邮箱点击确认链接"；登录失败时 "Email not confirmed" 有中文提示 |
| 3 | 注册邮箱已存在 | **P2** | 用户用已注册邮箱再次注册 → Supabase 报错 | `getSafeErrorMessage` 映射 `User already registered` → "该邮箱已注册，请直接登录。" |
| 4 | 密码错误 | **P2** | 用户输错密码 | `getSafeErrorMessage` 映射 `Invalid login credentials` → "邮箱或密码错误，请重试。" |
| 5 | 旧 Magic Link 用户无法登录（无密码） | **P2** | 已有测试用户用邮箱链接登录后，V2.1 无法用密码登录 | 当前用户量极少（测试阶段）；提示"如之前使用过链接登录，请重新注册"。Supabase Auth 中同一邮箱注册即为同一用户，不需要额外迁移 |
| 6 | AuthModal 状态机复杂度增加（登录/注册/成功/错误） | **P2** | UI bug | 按 mode 分两个表单分支渲染，注册成功后单独一个成功视图，三个分支不交叉 |
| 7 | `signIn` 签名变化导致 Header 传参 TypeScript 错误 | **P2** | 编译失败 | `npm run lint` 作为门禁，TypeScript 会在编译时捕获 props 不匹配 |

---

## 十四、给 Codex 的执行边界提醒

### ✅ 可以做

1. 修改 `src/hooks/useAuth.ts` — 按 §四 改造
2. 修改 `src/components/AuthModal.tsx` — 按 §五 重写
3. 修改 `src/components/Header.tsx` — 按 §六 适配
4. 修改 `src/app/auth/callback/route.ts` — 按 §七 简化
5. 修改 `src/lib/constants.ts` — 按 §八 更新

### ❌ 不要做

1. **不要改 API Route** — `src/app/api/*` 全部不动
2. **不要改任务逻辑** — useTaskGroup / useTaskReview / useTaskStats / useTaskHistory / ai-client / task-parser / review-parser / stats-calculator / adjust-task-strategy 不动
3. **不要改数据库** — 不改 schema / migration / RLS
4. **不要新增 npm 依赖** — `package.json` 不动
5. **不要做 CAPTCHA** — Cloudflare Turnstile 是 V2.3
6. **不要做邮箱验证码** — 6 位数字 OTP 不在 V2.1 范围
7. **不要改 page.tsx** — 页面入口不动
8. **不要改 supabase-server.ts / supabase-client.ts** — 服务端基础设施不动
9. **不要改密码显示/隐藏以外的 UI 细节** — AuthModal 之外不改 UI
10. **不要改 Tailwind 配置** — 不动 `tailwind.config.ts` / `globals.css`

### ⚠️ 如果发现需要改 §三 禁止清单中的文件

**停下来，汇报。** 说明哪个文件、为什么需要改、当前执行方案哪里遗漏了。不要自行扩大修改范围。

---

> **下一阶段**：本文档经 ChatGPT 审查通过后，Codex 按本文档实现代码。实现完成后 Claude Code 做 Code Review。
>
> **关联文档**：
> - [Architecture-V2.1-Auth.md](Architecture-V2.1-Auth.md) — V2.1 Auth 架构方案
> - [Roadmap-V2.1-V2.3.md](Roadmap-V2.1-V2.3.md) — V2.1-V2.3 路线图
> - [PROJECT-CONTEXT.md](PROJECT-CONTEXT.md) — 项目长期上下文
