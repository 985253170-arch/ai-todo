# Execution-Plan-V2.1B-OTP-Password.md — V2.1B OTP + Password 执行方案

> **状态**：执行方案，待 ChatGPT 审查
> **依赖**：[Architecture-V2.1B-OTP-Password.md](Architecture-V2.1B-OTP-Password.md)（架构方案已通过 ChatGPT 审查）
> **上一文档**：[Architecture-V2.1B-OTP-Password.md](Architecture-V2.1B-OTP-Password.md)
> **编写日期**：2026-07-04
> **受众**：Codex（实现者）

---

## 目录

- [一、执行概述](#一执行概述)
- [二、允许修改文件清单](#二允许修改文件清单)
- [三、禁止修改文件清单](#三禁止修改文件清单)
- [四、文件 1：types.ts — AuthUser 扩展](#四文件-1typests--authuser-扩展)
- [五、文件 2：useAuth.ts — Hook 改造](#五文件-2useauthts--hook-改造)
- [六、文件 3：constants.ts — 文案更新](#六文件-3constantsts--文案更新)
- [七、文件 4：SetPasswordPrompt.tsx — 新增组件](#七文件-4setpasswordprompttsx--新增组件)
- [八、文件 5：AuthModal.tsx — 重写](#八文件-5authmodaltsx--重写)
- [九、文件 6：Header.tsx — 适配](#九文件-6headertsx--适配)
- [十、callback route — 不修改](#十callback-route--不修改)
- [十一、Supabase Dashboard 前置检查](#十一supabase-dashboard-前置检查)
- [十二、实现顺序](#十二实现顺序)
- [十三、验收标准](#十三验收标准)
- [十四、风险与回滚](#十四风险与回滚)
- [十五、给 Codex 的执行边界提醒](#十五给-codex-的执行边界提醒)

---

## 一、执行概述

### 1.1 目标

在现有 Email+Password 账号体系（V2.1 Auth ✅）基础上，新增邮箱验证码（OTP）登录/注册能力。新用户默认用验证码登录（自动创建账号），登录后强引导设置密码；已设密码的用户可自由选择验证码或密码登录。两种方式长期共存。

### 1.2 改动面

| 项目 | 数值 |
|------|:---:|
| 修改文件 | 5 个 |
| 新增文件 | 1 个 |
| 删除文件 | 0 个 |
| 新增 npm 依赖 | 0 个 |
| 数据库 schema 变更 | 0 个 |
| API Route 变更 | 0 个 |
| package.json 变更 | 0 个 |
| .env.local 变更 | 0 个 |

### 1.3 本阶段做什么

| # | 事项 | 说明 |
|---|------|------|
| 1 | 新增 OTP 验证码发送/校验 | useAuth 新增 `sendOtp` / `verifyOtp` |
| 2 | 新增登录后设置密码 | useAuth 新增 `setPassword`；新增 SetPasswordPrompt 组件 |
| 3 | AuthModal 改为验证码/密码双模式 | 默认验证码登录 Tab，密码登录为第二 Tab |
| 4 | 保留密码登录 | `signInWithPassword`（原 `signIn` 重命名） |
| 5 | 保留 signUp | 不做 AuthModal 公开入口，仅内部兼容 |
| 6 | types.ts AuthUser 扩展 | 增加 `metadata` 字段用于读取 `password_set` |
| 7 | Supabase Magic Link 邮件模板 | 人工配置为中文验证码格式（`{{ .Token }}`） |

### 1.4 本阶段不做什么

| # | 不做 | 原因 |
|---|------|------|
| 1 | 不删除 Email+Password 登录 | 混合体系，两种方式共存 |
| 2 | 不修改数据库 schema / migration | 使用 `user_metadata.password_set` |
| 3 | 不修改任务业务 API（全部 8 个 route） | 零改动 |
| 4 | 不修改 callback route | 保留不动，OTP 主流程不依赖它 |
| 5 | 不修改 package.json / .env.local | 无新增依赖或环境变量 |
| 6 | 不新增 /login 或 /app 路由 | V2.2 域名 |
| 7 | 不实现忘记密码 | V2.3 域名 |
| 8 | 不修改匿名任务迁移逻辑 | 迁移依赖 `user.id`，与登录方式无关 |
| 9 | 不修改 Phase 14 / Phase 15 | `getAuthenticatedUserId()` 不变 |
| 10 | 不修改 supabase-server.ts / supabase-client.ts | 基础设施不动 |
| 11 | 不修改 useTaskGroup / useTaskReview / useTaskStats / useTaskHistory | 任务 hooks 不动 |
| 12 | 不修改 GoalInput / TaskList / StatsBar / HistoryPanel / TaskReviewPanel | UI 组件不动（AuthModal / Header / SetPasswordPrompt 除外） |

---

## 二、允许修改文件清单

| # | 文件 | 操作 | 预计行数 | 说明 |
|---|------|:---:|:---:|------|
| 1 | `src/lib/types.ts` | **修改** | ~6 行（改） | AuthUser 增加 `metadata` 字段 |
| 2 | `src/hooks/useAuth.ts` | **修改** | ~130 行（改） | 新增 sendOtp/verifyOtp/setPassword；signIn 重命名为 signInWithPassword；扩展 toAuthUser |
| 3 | `src/lib/constants.ts` | **修改** | ~45 行（改） | AUTH_TEXT 新增 OTP + 设置密码相关文案 |
| 4 | `src/components/SetPasswordPrompt.tsx` | **新增** | ~80 行 | 登录后设置密码引导浮层 |
| 5 | `src/components/AuthModal.tsx` | **重写** | ~370 行（新） | 双模式（验证码/密码）；6 位验证码输入；移除注册 Tab |
| 6 | `src/components/Header.tsx` | **修改** | ~25 行（改） | useAuth 接口适配 + AuthModal props 变更 + SetPasswordPrompt 条件渲染 |

**总计：6 个文件（5 改 + 1 新增），约 656 行变更。**

### 关于 callback route

**不修改** `src/app/auth/callback/route.ts`。OTP 主流程使用纯客户端 `verifyOtp({ email, token, type: "email" })`，不经过 callback route。callback route 保留用于旧 V2.1 确认链接兼容和未来 V2.3 reset password。

### 关于是否需要第 7 个文件的审查结论

逐一排查后发现不需要：

| 疑似需要 | 排查结果 | 结论 |
|----------|---------|:--:|
| `src/app/page.tsx` | 不直接调用 useAuth 的任何方法——只通过 Header 消费 | 不改 |
| `src/app/auth/callback/route.ts` | OTP 主流程不依赖 callback；旧确认链接保留兼容 | 不改 |
| `src/lib/supabase-server.ts` | `getAuthenticatedUserId()` 与登录方式无关 | 不改 |
| `src/lib/supabase-client.ts` | `createSupabaseBrowserClient()` 不变 | 不改 |
| `src/lib/device-id.ts` | device_id 逻辑不变 | 不改 |
| `src/hooks/useTaskGroup.ts` | `restoreForAuthUser()` 依赖 `user.id`，与登录方式无关 | 不改 |

---

## 三、禁止修改文件清单

以下文件 **V2.1B 完全不动**。Codex 实现时如果发现需要改这些文件中的任何一个，**必须停下来汇报**——说明执行方案有遗漏。

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

# callback route — 保留不动
src/app/auth/callback/route.ts

# 前端 Hooks（useAuth 除外）
src/hooks/useTaskGroup.ts
src/hooks/useTaskReview.ts
src/hooks/useTaskStats.ts
src/hooks/useTaskHistory.ts

# UI 组件（AuthModal + Header + SetPasswordPrompt 除外）
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
src/lib/storage.ts
src/lib/input-validator.ts
src/lib/date-utils.ts

# 配置
package.json
.env.local
数据库 schema / migration
```

---

## 四、文件 1：types.ts — AuthUser 扩展

**当前文件**：`src/lib/types.ts`（219 行）

### 4.1 当前代码（L165-168）

```typescript
export interface AuthUser {
  id: string;
  email: string | null;
}
```

### 4.2 改造后

```typescript
export interface AuthUser {
  id: string;
  email: string | null;
  metadata?: {
    password_set?: boolean;
  };
}
```

### 4.3 改动说明

| 项目 | 说明 |
|------|------|
| 新增字段 | `metadata?: { password_set?: boolean }` — 可选字段，向后兼容 |
| 用途 | useAuth 的 `toAuthUser` 从 `session.user.user_metadata` 读取 `password_set` → 映射到 `AuthUser.metadata.password_set` → AuthModal / Header 判断是否需要弹出设置密码引导 |
| 不影响 | `Task` / `TaskGroup` / `GenerateTasksRequest` / `StatsData` / `ReviewData` / API 响应结构 / 任何任务业务类型 |

### 4.4 修改边界（重要）

**仅修改 `AuthUser` 接口（L165-168），不修改 types.ts 中任何其他类型。** 包括但不限于：

- ❌ 不改 `Task`
- ❌ 不改 `TaskGroup`
- ❌ 不改 `GenerateTasksRequest` / `GenerateTasksResponse`
- ❌ 不改 `StatsData` / `TodayStats` / `SevenDayStats` / `TotalStats`
- ❌ 不改 `ReviewData` / `ReviewSections` / `ReviewResponse`
- ❌ 不改 `CloudTaskGroupResponse` / `HistoryTaskGroupsResponse`
- ❌ 不改 `ApiErrorCode` / `AuthErrorCode` / `ReviewErrorCode` 等错误码类型
- ❌ 不改 `PageStatus` / `AdjustmentResult` / `PerformanceLabel`

**该改动只服务于 Auth UI 判断是否展示设置密码引导，不参与任务保存、历史、统计、AI 复盘或智能任务调整的数据结构。**

### 4.5 当前职责

全局 TypeScript 类型定义，包含任务、统计、复盘、Auth、API 请求/响应的所有类型。

### 4.6 本阶段改什么

仅 `AuthUser` 接口增加 3 行 `metadata` 字段。

### 4.7 不改什么

`AuthUser` 之外的**所有**类型定义不动。

### 4.8 依赖

无前置依赖。此文件是第一步修改，被 useAuth.ts 依赖。

### 4.9 可能风险

| 风险 | 等级 | 缓解 |
|------|:---:|------|
| metadata 字段命名与其他类型冲突 | **P2** | `metadata` 只在 AuthUser 中使用，其他类型不使用此字段名 |
| 旧代码中读取 `AuthUser` 的地方因新增 optional 字段而报错 | **P2** | `metadata?` 是可选字段，现有代码不解构 `metadata` 就不会受影响。`npm run lint` 会在编译时验证 |

### 4.10 Codex 注意事项

1. 只改 L165-168 的 `AuthUser` 接口，加 3 行
2. `metadata` 和 `password_set` 都必须是 optional（`?:`），确保向后兼容
3. 不要在 types.ts 中新增任何其他类型或修改任何其他接口
4. types.ts 属于高风险文件（见 `memory/high-risk-files.md`），只做此一处最小改动
5. 改完后立即 `npm run lint` 确认编译通过

---

## 五、文件 2：useAuth.ts — Hook 改造

**当前文件**：`src/hooks/useAuth.ts`（115 行）

### 5.1 当前代码分析

```typescript
// 当前导出
return {
  user,        // AuthUser | null
  isLoading,   // boolean
  signUp,      // (email, password) => Promise<void>
  signIn,      // (email, password) => Promise<void>   ← 内部调用 signInWithPassword
  signOut,     // () => Promise<void>
};
```

`toAuthUser` 当前只映射 `{ id, email }`，不包含 `user_metadata`。

### 5.2 改造后接口

```typescript
// V2.1B 导出
return {
  user,                // AuthUser | null  ← 不变（但 AuthUser 类型已扩展 metadata）
  isLoading,           // boolean         ← 不变
  sendOtp,             // (email: string) => Promise<void>  ← 新增
  verifyOtp,           // (email: string, token: string) => Promise<void>  ← 新增
  signInWithPassword,  // (email: string, password: string) => Promise<void>  ← 重命名自 signIn
  signUp,              // (email: string, password: string) => Promise<void>  ← 保留（内部兼容）
  setPassword,         // (password: string) => Promise<void>  ← 新增
  signOut,             // () => Promise<void>  ← 不变
};
```

### 5.3 保持不变的部分（直接保留，不修改）

| 代码段 | 说明 |
|--------|------|
| `toAuthUser()` 核心逻辑 | `{ id, email }` 映射保留，**扩展** `metadata` 读取（见 5.4.1） |
| `logSafeAuthError()` | 错误日志脱敏函数，与登录方式无关 |
| `useMemo(() => createSupabaseBrowserClient(), [])` | 客户端初始化 |
| `useEffect` 中的 `supabase.auth.getUser()` | 初始化时恢复 session |
| `useEffect` 中的 `onAuthStateChange` | 监听 session 变化 |
| `isMounted` 清理逻辑 | 防止内存泄漏 |
| `signOut` 函数（L94-106） | `signOut()` → 清除 cookie → `setUser(null)` |
| `signUp` 函数（L60-74） | 完全保留 V2.1 实现，不修改 |

### 5.4 需要修改/新增的代码

#### 5.4.1 扩展 toAuthUser（修改 L7-16）

```typescript
function toAuthUser(user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null): AuthUser | null {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? null,
    metadata: {
      password_set: Boolean(user.user_metadata?.password_set),
    },
  };
}
```

**关键变更**：
- 参数类型从 `{ id: string; email?: string }` 扩展为包含 `user_metadata`
- 返回值增加 `metadata.password_set`，从 `user.user_metadata.password_set` 读取并转为 boolean
- `Boolean(undefined)` → `false`，安全回退——旧 V2.1 用户 metadata 中没有此字段时，`password_set` 为 `false`

#### 5.4.2 新增 sendOtp 函数

```typescript
async function sendOtp(email: string) {
  if (!supabase) {
    throw new Error("AUTH_NOT_CONFIGURED");
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  if (error) {
    logSafeAuthError(error);
    throw error;
  }
  // 不调用 setUser() — sendOtp 仅发送邮件，不建立 session
}
```

**关键说明**：
- `shouldCreateUser: true` — 新邮箱自动创建账号
- 成功后**不**调用 `setUser()`（此时无 session）
- 不需要 `emailRedirectTo`（OTP 不需要回调 URL）
- 错误通过 `logSafeAuthError` 脱敏后 throw

#### 5.4.3 新增 verifyOtp 函数

```typescript
async function verifyOtp(email: string, token: string) {
  if (!supabase) {
    throw new Error("AUTH_NOT_CONFIGURED");
  }

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    logSafeAuthError(error);
    throw error;
  }

  // data.session 存在 → onAuthStateChange 自动触发 → user 更新
  // 手动 setUser 确保 UI 即时响应
  setUser(toAuthUser(data.user));
}
```

**关键说明**：
- `type` 固定为 `"email"`
- **不是** `token_hash` — `token` 是 6 位数字验证码明文
- **不是** `/auth/callback` 路径 — 纯客户端调用
- 成功后 `data.session` 自动写入 cookie（Supabase JS SDK 自动处理）
- `onAuthStateChange` 会再次触发 `setUser`，这里手动调用是为了 UI 即时响应

#### 5.4.4 重命名 signIn → signInWithPassword + 补写 password_set（修改 L76-92）

```typescript
async function signInWithPassword(email: string, password: string) {
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

  setUser(toAuthUser(data.user));

  // 兼容旧 V2.1 用户：如果 password_set 未标记，静默补写
  if (!data.user.user_metadata?.password_set) {
    await supabase.auth.updateUser({
      data: { password_set: true },
    }).catch(() => {
      // 静默忽略 — 补写失败不阻塞登录
    });
  }
}
```

**关键说明**：
- 函数名从 `signIn` 改为 `signInWithPassword`（与 Supabase API 名一致）
- 函数体与 V2.1 的 `signIn` **基本相同**（`signInWithPassword` 调用不变）
- **新增**：密码登录成功后检查 `user_metadata.password_set`，旧 V2.1 用户缺失时静默补写
- 补写失败（如网络问题）不影响登录——catch 块为空

#### 5.4.5 新增 setPassword 函数

```typescript
async function setPassword(password: string) {
  if (!supabase) {
    throw new Error("AUTH_NOT_CONFIGURED");
  }

  const { data, error } = await supabase.auth.updateUser({
    password,
    data: { password_set: true },
  });

  if (error) {
    logSafeAuthError(error);
    throw error;
  }

  // updateUser 成功后 onAuthStateChange 触发 USER_UPDATED 事件
  // 手动 setUser 确保 UI 即时响应
  setUser(toAuthUser(data.user));
}
```

**关键说明**：
- 调用前提：用户已登录（有有效 session）
- `password` — 新密码（前端已校验 ≥6 位）
- `data: { password_set: true }` — 写入 `user_metadata`，标记用户已设置密码
- `onAuthStateChange` 会触发 `USER_UPDATED` 事件，`toAuthUser` 会重新读取 `user_metadata.password_set`

#### 5.4.6 signUp — 保留不动

```typescript
// 完全保留 V2.1 的实现（L60-74），不修改
// 不作为 AuthModal 主入口，但保留在 Hook 中用于内部兼容 / 回滚 / 备用
async function signUp(email: string, password: string) {
  // ... 与 V2.1 完全相同
}
```

#### 5.4.7 signOut — 保留不动

```typescript
// L94-106 完全保留，不修改
async function signOut() {
  // ... 与 V2.1 完全相同
}
```

### 5.5 onAuthStateChange 处理

**不变。** 监听逻辑与 V2.1 完全相同（L47-52）：

```typescript
supabase.auth.onAuthStateChange((_event, session) => {
  setUser(toAuthUser(session?.user ?? null));
  setIsLoading(false);
});
```

各操作触发的事件：

| 操作 | 触发事件 | user 变化 |
|------|---------|---------|
| `sendOtp()` | 不触发 | 不变（无 session 变化） |
| `verifyOtp()` 成功 | `SIGNED_IN` | user 从 null 变为 AuthUser |
| `signInWithPassword()` 成功 | `SIGNED_IN` | user 从 null 变为 AuthUser |
| `setPassword()` 成功 | `USER_UPDATED` | user 更新（`metadata.password_set` 变为 true） |
| `signOut()` | `SIGNED_OUT` | user 变为 null |

### 5.6 完整改造后 useAuth.ts 结构

```
  1-6   导入                                    ← 不变
  7-18  toAuthUser（扩展 metadata 读取）         ← 修改
 18-25  logSafeAuthError                        ← 不变
 26-58  useState + useEffect（session 初始化）    ← 不变
 60-74  signUp(email, password)                  ← 保留不变
 76-92  signInWithPassword(email, password)      ← 重命名 + 补写 password_set
 94-106 signOut()                                ← 保留不变
108-120 sendOtp(email)                           ← 新增
122-138 verifyOtp(email, token)                  ← 新增
140-156 setPassword(password)                    ← 新增
158-166 return { user, isLoading, sendOtp, verifyOtp, signInWithPassword, signUp, setPassword, signOut }
```

**不再包含名为 `signIn` 的函数**——已重命名为 `signInWithPassword`。调用方（Header.tsx）需同步更新。

### 5.7 当前职责

管理 Supabase Auth 状态，提供登录/注册/登出方法，监听 session 变化。

### 5.8 本阶段改什么

- `toAuthUser` 扩展：读取 `user_metadata.password_set`
- `signIn` 重命名为 `signInWithPassword` + 新增补写 `password_set` 逻辑
- 新增 `sendOtp` / `verifyOtp` / `setPassword`
- 导出对象增加 3 个新方法 + 重命名 1 个方法

### 5.9 不改什么

- `signUp` 完全保留
- `signOut` 完全保留
- `useEffect` session 恢复逻辑
- `onAuthStateChange` 监听逻辑
- `logSafeAuthError` 脱敏逻辑
- `useMemo` 客户端初始化

### 5.10 依赖

- 依赖 `types.ts`（Step 1 — AuthUser 需先扩展 `metadata` 字段）
- 依赖 `@supabase/supabase-js`（现有依赖，不变）

### 5.11 可能风险

| 风险 | 等级 | 缓解 |
|------|:---:|------|
| `signIn` 重命名导致调用方 TypeScript 报错 | **P2** | `npm run lint` 会捕获。Header.tsx 在 Step 6 同步更新 |
| `toAuthUser` 参数类型扩展后旧代码不兼容 | **P2** | 新参数是 optional（`user_metadata?`），向后兼容 |
| `signInWithPassword` 补写 metadata 失败 | **P2** | catch 块为空，静默忽略。最坏情况用户多看到一次设置密码引导 |

### 5.12 Codex 注意事项

1. **函数名必须改**：`signIn` → `signInWithPassword`，return 对象中也要同步更新
2. **toAuthUser 参数签名**：`user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null`
3. **sendOtp 成功不调 setUser**：此时还没有 session
4. **verifyOtp 的 type 参数**：固定为 `"email"`，不要写成 `"signup"` 或 `"magiclink"`
5. **verifyOtp 的 token 参数**：是 6 位数字验证码明文，不是 `token_hash`
6. **signInWithPassword 补写是静默的**：catch 块为空，不要 throw 或 log
7. **signUp 不动**：连函数体都不要改，原样保留
8. **signOut 不动**：原样保留
9. **错误全部通过 `logSafeAuthError` 脱敏**：不直接 console.log Supabase error 对象
10. **不输出 token / password / session 到 console**：logSafeAuthError 只输出 message/name/status

---

## 六、文件 3：constants.ts — 文案更新

**当前文件**：`src/lib/constants.ts`（85 行）

### 6.1 当前 AUTH_TEXT

```typescript
export const AUTH_TEXT = {
  LOGIN: "登录",
  LOGGED_IN: "已登录",
  LOGGING_STATUS: "登录状态...",
  LOGOUT: "登出",
  CLOSE: "关闭",
  MODAL_TITLE: "登录 AI Todo",
  MODAL_DESCRIPTION: "登录后可以多设备同步任务数据。",
  EMAIL_LABEL: "邮箱",
  EMAIL_PLACEHOLDER: "you@example.com",
  PASSWORD_LABEL: "密码",
  PASSWORD_PLACEHOLDER: "至少 6 位",
  CONFIRM_PASSWORD_LABEL: "确认密码",
  CONFIRM_PASSWORD_PLACEHOLDER: "再次输入密码",
  LOGIN_TAB: "登录",
  LOGIN_BUTTON: "登录",
  LOGIN_LOADING: "登录中...",
  LOGIN_SWITCH_HINT: "没有账号？切换到「注册」创建账号。",
  SIGNUP_TAB: "注册",
  SIGNUP_BUTTON: "注册",
  SIGNUP_LOADING: "注册中...",
  SIGNUP_SUCCESS_TITLE: "✅ 注册成功",
  SIGNUP_SUCCESS_MESSAGE: "确认邮件已发送，请前往邮箱点击确认链接，然后登录。",
  SIGNUP_SWITCH_HINT: "已有账号？切换到「登录」。",
  EMAIL_REQUIRED: "请输入邮箱。",
  PASSWORD_REQUIRED: "请输入密码。",
  PASSWORD_TOO_SHORT: "密码至少需要 6 位。",
  PASSWORD_MISMATCH: "两次输入的密码不一致。",
  EMAIL_RATE_LIMITED: "操作过于频繁，请稍后再试。",
} as const;
```

### 6.2 改造后 AUTH_TEXT

V2.1B 需要新增 OTP 验证码相关 + 设置密码引导相关文案。以下是完整的改造后 AUTH_TEXT（新增 key 用 `← 新增` 标注）：

```typescript
export const AUTH_TEXT = {
  // 通用（不变）
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

  // --- 验证码登录 Tab（新增/调整） ---
  OTP_TAB: "验证码登录",                              // ← 新增
  SEND_CODE: "发送验证码",                             // ← 新增
  SENDING_CODE: "发送中…",                             // ← 新增
  CODE_SENT: "验证码已发送至",                          // ← 新增（后面拼接 email）
  CODE_LABEL: "输入验证码",                            // ← 新增
  CODE_PLACEHOLDER: "",                                // ← 新增（6 个独立框不需要 placeholder）
  VERIFYING: "验证中…",                                // ← 新增
  RESEND_CODE: "重新发送",                             // ← 新增
  RESEND_COUNTDOWN: "重新发送（{s}秒）",                // ← 新增（{s} 替换为倒计时秒数）
  CHANGE_EMAIL: "换个邮箱",                            // ← 新增
  OTP_SWITCH_HINT: "有密码？切换到「密码登录」。",        // ← 新增

  // --- 密码登录 Tab（调整） ---
  PASSWORD_TAB: "密码登录",                            // ← 新增（替代旧 LOGIN_TAB）
  PASSWORD_LABEL: "密码",
  PASSWORD_PLACEHOLDER: "至少 6 位",
  PASSWORD_BUTTON: "登录",                             // ← 新增（替代旧 LOGIN_BUTTON）
  PASSWORD_LOADING: "登录中…",                         // ← 新增（替代旧 LOGIN_LOADING）
  PASSWORD_SWITCH_HINT: "没有密码？切换到「验证码登录」。", // ← 新增

  // --- 设置密码引导（新增） ---
  SET_PASSWORD_TITLE: "🔐 设置登录密码",               // ← 新增
  SET_PASSWORD_DESCRIPTION: "设置密码后，下次可以直接用密码登录，不需要等验证码。", // ← 新增
  SET_PASSWORD_LABEL: "密码（至少 6 位）",              // ← 新增
  CONFIRM_PASSWORD_LABEL: "确认密码",
  CONFIRM_PASSWORD_PLACEHOLDER: "再次输入密码",
  SAVE_PASSWORD: "保存密码",                           // ← 新增
  SAVING_PASSWORD: "保存中…",                          // ← 新增
  SET_PASSWORD_SUCCESS: "密码已设置，下次可直接用密码登录。", // ← 新增
  SKIP_FOR_NOW: "稍后再说",                             // ← 新增

  // --- 保留（内部兼容，不删除） ---
  LOGIN_TAB: "登录",                                   // 保留（可能被其他代码引用）
  LOGIN_BUTTON: "登录",
  LOGIN_LOADING: "登录中...",
  LOGIN_SWITCH_HINT: "没有账号？切换到「注册」创建账号。",
  SIGNUP_TAB: "注册",
  SIGNUP_BUTTON: "注册",
  SIGNUP_LOADING: "注册中...",
  SIGNUP_SUCCESS_TITLE: "✅ 注册成功",
  SIGNUP_SUCCESS_MESSAGE: "确认邮件已发送，请前往邮箱点击确认链接，然后登录。",
  SIGNUP_SWITCH_HINT: "已有账号？切换到「登录」。",

  // --- 校验错误 ---
  EMAIL_REQUIRED: "请输入邮箱。",
  PASSWORD_REQUIRED: "请输入密码。",
  PASSWORD_TOO_SHORT: "密码至少需要 6 位。",
  PASSWORD_MISMATCH: "两次输入的密码不一致。",

  // --- 服务端错误映射 ---
  EMAIL_RATE_LIMITED: "操作过于频繁，请稍后再试。",
} as const;
```

### 6.3 移除的 key

**不移除任何现有 key。** V2.1 的 `LOGIN_TAB` / `SIGNUP_TAB` / `LOGIN_BUTTON` / `SIGNUP_BUTTON` 等保留在 AUTH_TEXT 中，因为：
- 新 AuthModal 使用新的 `OTP_TAB` / `PASSWORD_TAB` 等 key
- 旧 key 保留避免其他文件引用时报 TypeScript 错误
- 旧 key 在未来 V2.3 或内部兼容场景仍可能用到

### 6.4 UI_TEXT 和 ERROR_MESSAGES

**不变。** 只修改 `AUTH_TEXT` 对象。`UI_TEXT` 和 `ERROR_MESSAGES` 完全不动。

### 6.5 当前职责

集中管理 UI 文案常量，包括 AUTH_TEXT（登录相关）、UI_TEXT（通用 UI）、ERROR_MESSAGES（错误提示）。

### 6.6 本阶段改什么

仅 `AUTH_TEXT` 对象新增约 15 个 OTP + 设置密码相关 key。

### 6.7 不改什么

- `UI_TEXT` 完全不动
- `ERROR_MESSAGES` 完全不动
- `STORAGE_KEY` / `DEVICE_ID_STORAGE_KEY` 不动
- 现有 AUTH_TEXT key **一个都不删除**

### 6.8 依赖

无前置依赖。此文件独立。

### 6.9 可能风险

| 风险 | 等级 | 缓解 |
|------|:---:|------|
| 新增 key 命名与其他常量冲突 | **P2** | 所有 key 在 `AUTH_TEXT` 对象内部，不会与 `UI_TEXT` / `ERROR_MESSAGES` 冲突 |
| 忘记保留旧 key 导致其他文件引用报错 | **P2** | 明确要求"不移除任何现有 key"，lint 会捕获缺失 |

### 6.10 Codex 注意事项

1. **只新增，不删除** — 旧 AUTH_TEXT key 全部保留
2. **RESEND_COUNTDOWN 包含 `{s}` 占位符** — 渲染时用 `.replace("{s}", String(countdown))` 替换
3. 新增 key 的注释分组清晰（`// --- 验证码登录 Tab ---` 等），方便后续维护
4. 改完后 `npm run lint` 确认无 TypeScript 错误

---

## 七、文件 4：SetPasswordPrompt.tsx — 新增组件

**新文件**：`src/components/SetPasswordPrompt.tsx`（约 80 行）

### 7.1 为什么需要单独组件

SetPasswordPrompt 是独立于 AuthModal 的浮层组件，出现时机是 AuthModal **关闭之后**。原因：

1. **AuthModal 在登录成功后自动关闭** — V2.1 的 `useEffect(() => { if (isAuthenticated) onClose() }, [isAuthenticated])` 逻辑保留不变
2. **设置密码引导不应阻塞登录** — 用户已经登录成功（session 已建立），引导是"建议"而非"要求"
3. **独立组件更简单** — 如果集成到 AuthModal 中，需要改变"登录成功自动关闭"的行为，增加状态机复杂度
4. **可复用** — 未来 V2.3 忘记密码等场景可能复用此组件

### 7.2 Props 设计

```typescript
interface SetPasswordPromptProps {
  isOpen: boolean;
  onSetPassword: (password: string) => Promise<void>;
  onSkip: () => void;
}
```

| Prop | 类型 | 说明 |
|------|------|------|
| `isOpen` | `boolean` | 是否显示引导浮层 |
| `onSetPassword` | `(password: string) => Promise<void>` | 保存密码回调。调用 useAuth.setPassword() |
| `onSkip` | `() => void` | "稍后再说"回调。直接关闭引导 |

**不需要 `isAuthenticated` prop** — 此组件只在 `user` 存在时渲染（由父组件 Header.tsx 控制）。

### 7.3 组件内部状态

```typescript
const [password, setPassword] = useState("");
const [confirmPassword, setConfirmPassword] = useState("");
const [errorMessage, setErrorMessage] = useState<string | null>(null);
const [successMessage, setSuccessMessage] = useState<string | null>(null);
const [isSubmitting, setIsSubmitting] = useState(false);
```

### 7.4 UI 结构

```
┌────────────────────────────────────────────┐
│                                            │
│          🔐 设置登录密码                    │
│                                            │
│    设置密码后，下次可以直接用密码登录，      │
│    不需要等验证码。                         │
│                                            │
│    ┌──────────────────────────────────┐    │
│    │  密码（至少 6 位）                │    │
│    └──────────────────────────────────┘    │
│    ┌──────────────────────────────────┐    │
│    │  确认密码                         │    │
│    └──────────────────────────────────┘    │
│                                            │
│    ┌──────────────────────────────────┐    │
│    │         保存密码                  │    │  ← 主按钮（渐变样式）
│    └──────────────────────────────────┘    │
│                                            │
│           稍后再说                          │  ← 文字链接（弱化样式）
│                                            │
└────────────────────────────────────────────┘
```

**移动端适配**：
- 遮罩层：`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 py-6 backdrop-blur-sm`
- 弹窗宽度：`max-w-sm w-full`
- 输入框：`min-h-12`（44px 最小触控目标）
- 按钮：`min-h-12`

### 7.5 交互逻辑

```typescript
async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();

  // 前端校验
  if (password.length < 6) {
    setErrorMessage(AUTH_TEXT.PASSWORD_TOO_SHORT);
    return;
  }
  if (password !== confirmPassword) {
    setErrorMessage(AUTH_TEXT.PASSWORD_MISMATCH);
    return;
  }

  setIsSubmitting(true);
  setErrorMessage(null);

  try {
    await onSetPassword(password);
    setSuccessMessage(AUTH_TEXT.SET_PASSWORD_SUCCESS);
    // 成功后不立即关闭 — 让用户看到成功提示
    // 1.5 秒后父组件通过 onSkip 或自动关闭
  } catch (error) {
    setErrorMessage(getSafeErrorMessage(error));
  } finally {
    setIsSubmitting(false);
  }
}
```

**关键交互规则**：

| 规则 | 说明 |
|------|------|
| 前端校验 | 密码 ≥6 位 + 确认密码一致性，不通过不发请求 |
| 保存中 | 按钮显示"保存中…"，disabled |
| 保存成功 | 显示绿色成功提示，1.5 秒后父组件通过关闭引导 |
| 保存失败 | 显示红色错误提示（如密码太弱等 Supabase 后端校验错误） |
| 稍后再说 | 直接调用 `onSkip()`，不保存任何内容 |
| 点击遮罩不关闭 | 引导浮层不支持点击遮罩关闭（防止误触），只能通过"稍后再说"或成功保存后关闭 |

### 7.6 安全约束

| 约束 | 说明 |
|------|------|
| 不存储密码到 localStorage | 密码只在 React state 中短暂存在，提交后清空 |
| 不传给应用自有 API | 密码通过 `supabase.auth.updateUser()` 直接发送到 Supabase Auth HTTPS 接口 |
| 不输出密码到 console | `logSafeAuthError` 只输出 message/name/status |
| 组件卸载时清空 state | 防止密码残留 |

### 7.7 渲染条件（在 Header.tsx 中控制）

```typescript
// 不是 SetPasswordPrompt 内部逻辑，而是 Header.tsx 中：
{showSetPasswordPrompt && user && (
  <SetPasswordPrompt
    isOpen={showSetPasswordPrompt}
    onSetPassword={async (password) => {
      await setPassword(password);
      setShowSetPasswordPrompt(false);
    }}
    onSkip={() => setShowSetPasswordPrompt(false)}
  />
)}
```

只有在 `user` 存在（已登录）**且** `needsPasswordSetup` 为 true 时才渲染。

### 7.8 当前职责

N/A（新组件）。

### 7.9 本阶段改什么

全部新增。

### 7.10 不改什么

N/A（新组件）。

### 7.11 依赖

- 依赖 `constants.ts`（Step 3 — AUTH_TEXT 中的设置密码相关文案）
- 依赖 `useAuth`（Step 2 — 通过 props 的 `onSetPassword` 回调间接依赖）

### 7.12 可能风险

| 风险 | 等级 | 缓解 |
|------|:---:|------|
| `onSetPassword` 抛错后状态残留 | **P2** | catch 块中 setErrorMessage，不清空密码输入（允许用户修改后重试） |
| 成功提示后用户不知道下一步 | **P2** | 成功提示文字明确告知"密码已设置，下次可直接用密码登录" |
| 密码输入框自动填充敏感信息 | **P2** | 使用 `type="password"` + `autoComplete="new-password"` |

### 7.13 Codex 注意事项

1. 复用 AuthModal 的 `getSafeErrorMessage` 函数（或提取为共享工具函数）
2. 样式与 AuthModal 保持一致（遮罩层、弹窗圆角、输入框样式、按钮渐变）
3. 成功提示用绿色（`border-green-100 bg-green-50 text-green-700`），错误提示用红色（与 AuthModal 一致）
4. `isOpen` 为 false 时 `return null`
5. "稍后再说"按钮用文字链接样式（`text-sm text-slate-400 hover:text-slate-600`），不要用按钮样式
6. 密码输入框 `autoComplete="new-password"`（告诉浏览器这是设置新密码，不是登录）

---

## 八、文件 5：AuthModal.tsx — 重写

**当前文件**：`src/components/AuthModal.tsx`（311 行）

### 8.1 当前代码分析

V2.1 的 AuthModal 是"登录/注册"双 Tab：
- `AuthMode = "login" | "signup"`
- 登录模式：邮箱 + 密码 → `onSignIn`
- 注册模式：邮箱 + 密码 + 确认密码 → `onSignUp`
- 注册成功后显示成功提示页面
- 登录成功后 `isAuthenticated` 变 true → `useEffect` 自动 `onClose()`

### 8.2 改造目标

V2.1B 改为"验证码登录/密码登录"双 Tab：
- `AuthMode = "otp" | "password"`（替代旧的 `"login" | "signup"`）
- 默认 Tab = `"otp"`（验证码登录）
- 验证码登录：邮箱 → 发送验证码 → 6 位验证码输入 → 自动提交 → 登录成功
- 密码登录：邮箱 + 密码 → 登录成功
- **不再展示注册 Tab**（注册通过 OTP 自动创建账号）

### 8.3 Props 变更

```typescript
// V2.1（旧）
interface AuthModalProps {
  isOpen: boolean;
  isAuthenticated: boolean;
  onClose: () => void;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
}

// V2.1B（新）
interface AuthModalProps {
  isOpen: boolean;
  isAuthenticated: boolean;
  onClose: () => void;
  onSendOtp: (email: string) => Promise<void>;
  onVerifyOtp: (email: string, token: string) => Promise<void>;
  onSignInWithPassword: (email: string, password: string) => Promise<void>;
}
```

**不再有 `onSignUp` prop**。注册主入口改为 OTP 自动创建账号。

### 8.4 组件内部状态

```typescript
type AuthMode = "otp" | "password";
type OtpPhase = "idle" | "sending" | "code" | "verifying" | "success" | "error";

const [mode, setMode] = useState<AuthMode>("otp");            // 默认验证码登录
const [otpPhase, setOtpPhase] = useState<OtpPhase>("idle");
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [token, setToken] = useState("");                        // 6 位验证码字符串
const [message, setMessage] = useState<string | null>(null);   // 成功提示
const [errorMessage, setErrorMessage] = useState<string | null>(null);
const [isSubmitting, setIsSubmitting] = useState(false);
const [resendCountdown, setResendCountdown] = useState(0);     // 重发倒计时（秒）
```

### 8.5 重置表单（改造 resetForm）

```typescript
function resetForm() {
  setMode("otp");          // 默认验证码登录（旧：login）
  setOtpPhase("idle");     // ← 新增
  setEmail("");
  setPassword("");
  setToken("");            // ← 新增
  setMessage(null);
  setErrorMessage(null);
  setIsSubmitting(false);
  setResendCountdown(0);   // ← 新增
  // 移除 setIsPasswordVisible（V2.1B 密码登录可选择保留显示/隐藏切换）
}
```

### 8.6 验证码登录分支状态机

#### idle — 输入邮箱

```
┌────────────────────────────────────────────┐
│                                            │
│    [验证码登录]    |    密码登录              │
│    ———————————                             │
│                                            │
│    ┌──────────────────────────────────┐    │
│    │  your@email.com                  │    │
│    └──────────────────────────────────┘    │
│                                            │
│    ┌──────────────────────────────────┐    │
│    │         发送验证码                │    │
│    └──────────────────────────────────┘    │
│                                            │
│    有密码？切换到「密码登录」。              │
│                                            │
└────────────────────────────────────────────┘
```

**交互**：
- 点击"发送验证码" → 校验邮箱非空 → `setOtpPhase("sending")` → 调用 `onSendOtp(email)`
- 成功后 → `setOtpPhase("code")` + 启动倒计时 `setResendCountdown(60)`
- 失败后 → `setOtpPhase("error")` + `setErrorMessage(...)`

#### sending — 发送中

按钮显示"发送中…"，disabled。此状态通常很短暂（< 2 秒）。

#### code — 输入 6 位验证码

```
│                                            │
│    验证码已发送至 your@email.com            │
│                                            │
│    ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐        │
│    │ 1│ │ 2│ │ 3│ │ 4│ │ 5│ │ 6│        │
│    └──┘ └──┘ └──┘ └──┘ └──┘ └──┘        │
│                                            │
│    没有收到？重新发送（45s）                 │  ← 倒计时中 disabled
│    没有收到？重新发送                       │  ← 倒计时结束后可点击
│                                            │
│    换个邮箱                                 │  ← 返回 idle 态
```

**6 个独立数字输入框实现**：

```typescript
// 每个输入框的 ref 数组，用于自动跳转焦点
const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(6).fill(null));

function handleTokenInput(index: number, value: string) {
  // 只接受数字
  if (!/^\d*$/.test(value)) return;

  // 更新 token 字符串
  const newToken = token.split("");
  newToken[index] = value;
  const newTokenStr = newToken.join("");
  setToken(newTokenStr);

  // 自动跳转焦点
  if (value && index < 5) {
    inputRefs.current[index + 1]?.focus();
  }

  // 满 6 位自动提交
  if (newTokenStr.length === 6) {
    // 自动触发验证（在 useEffect 或 callback 中处理）
  }
}

function handleTokenKeyDown(index: number, event: React.KeyboardEvent) {
  if (event.key === "Backspace" && !token[index] && index > 0) {
    // 当前框为空时按退格 → 跳到前一个框
    inputRefs.current[index - 1]?.focus();
  }
}

function handleTokenPaste(event: React.ClipboardEvent) {
  event.preventDefault();
  const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
  setToken(pasted);
  // 焦点跳到最后一个有值的框或第 6 个框
  if (pasted.length === 6) {
    // 自动触发验证
  }
}
```

**自动提交**：用 `useEffect` 监听 `token` 变化，当 `token.length === 6` 且 `otpPhase === "code"` 时自动调用 `handleVerifyOtp()`。

**重发倒计时**：用 `useEffect` + `setInterval`：

```typescript
useEffect(() => {
  if (resendCountdown <= 0) return;
  const timer = setInterval(() => {
    setResendCountdown((prev) => {
      if (prev <= 1) {
        clearInterval(timer);
        return 0;
      }
      return prev - 1;
    });
  }, 1000);
  return () => clearInterval(timer);
}, [resendCountdown]);
```

#### verifying — 验证中

按钮显示"验证中…"，所有输入框 disabled。

#### error — 验证失败

显示红色错误提示（如"验证码错误或已过期，请重新获取。"）。验证码输入框保留，用户可修改后重新自动提交。

#### success — 验证成功

`isAuthenticated` 变为 true → `useEffect` 自动 `onClose()`。

### 8.7 密码登录分支

```
┌────────────────────────────────────────────┐
│                                            │
│    验证码登录    |    [密码登录]             │
│                       ———————————          │
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
│    没有密码？切换到「验证码登录」。          │
│                                            │
└────────────────────────────────────────────┘
```

**与 V2.1 登录模式的差异**：
- Tab 标签从"登录"改为"密码登录"
- 去掉了注册 Tab
- 底部提示改为"没有密码？切换到「验证码登录」"
- 密码显示/隐藏切换可选择保留（推荐保留）

**提交逻辑**：

```typescript
async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();

  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    setErrorMessage(AUTH_TEXT.EMAIL_REQUIRED);
    return;
  }
  if (!password) {
    setErrorMessage(AUTH_TEXT.PASSWORD_REQUIRED);
    return;
  }
  if (password.length < 6) {
    setErrorMessage(AUTH_TEXT.PASSWORD_TOO_SHORT);
    return;
  }

  setIsSubmitting(true);
  setErrorMessage(null);

  try {
    await onSignInWithPassword(trimmedEmail, password);
    setPassword("");
  } catch (error) {
    setErrorMessage(getSafeErrorMessage(error));
  } finally {
    setIsSubmitting(false);
  }
}
```

### 8.8 错误码映射（扩展 getSafeErrorMessage）

在现有 V2.1 映射基础上增加 OTP 相关：

```typescript
function getSafeErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    const message = error.message.toLowerCase();

    // 现有映射（保留）
    if (message.includes("email rate limit exceeded")) {
      return AUTH_TEXT.EMAIL_RATE_LIMITED;
    }
    if (message.includes("invalid login credentials")) {
      return "邮箱或密码错误，请重试。";
    }
    if (message.includes("user already registered")) {
      return "该邮箱已注册，请直接登录。";
    }
    if (message.includes("password should be at least 6 characters")) {
      return AUTH_TEXT.PASSWORD_TOO_SHORT;
    }
    if (message.includes("unable to validate email address")) {
      return "邮箱格式不正确。";
    }
    if (message.includes("email not confirmed")) {
      return "邮箱尚未确认，请先点击确认邮件中的链接。";
    }

    // V2.1B 新增 OTP 相关映射
    if (message.includes("token has expired or is invalid")) {
      return "验证码错误或已过期，请重新获取。";
    }
    if (message.includes("for security purposes")) {
      return "请等待片刻后再试。";
    }

    return error.message;
  }

  return ERROR_MESSAGES.AUTH_OPERATION_FAILED;
}
```

### 8.9 Tab 切换规则

```typescript
function switchMode(nextMode: AuthMode) {
  setMode(nextMode);
  setOtpPhase("idle");
  setPassword("");
  setToken("");
  setMessage(null);
  setErrorMessage(null);
  setResendCountdown(0);
}
```

切换 Tab 时清空所有输入和错误状态。

### 8.10 登录成功后自动关闭

**保留 V2.1 逻辑**：

```typescript
useEffect(() => {
  if (isAuthenticated) {
    onClose();
  }
}, [isAuthenticated, onClose]);
```

不管是验证码登录成功还是密码登录成功，`isAuthenticated` 变为 true 后 AuthModal 自动关闭。设置密码引导由 Header.tsx 中的 SetPasswordPrompt 接管。

### 8.11 不再展示注册 Tab

**确认**：AuthModal 中不展示注册 Tab。注册主入口是 OTP 验证码——`signInWithOtp({ shouldCreateUser: true })` 自动为新邮箱创建账号。

### 8.12 手机端优先

| 元素 | 做法 |
|------|------|
| 遮罩层 | `fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 py-6 backdrop-blur-sm` |
| 弹窗宽度 | `max-w-sm w-full` |
| 输入框 | `min-h-12`（44px 最小触控目标） |
| 验证码输入框 | 6 个，每个约 44px 宽，`text-lg` 字号，`inputMode="numeric"`，`pattern="[0-9]"`，`autoComplete="one-time-code"` |
| 按钮 | `min-h-12` |
| Tab 切换 | 内联按钮 + 底部下划线指示器（保留 V2.1 的 `grid grid-cols-2 rounded-full bg-slate-100 p-1` 样式） |
| 键盘类型 | 邮箱 `type="email"`；验证码 `inputMode="numeric"`；密码 `type="password"` |

### 8.13 保留不变的部分

| 代码段 | 说明 |
|--------|------|
| `useEffect(() => { if (isAuthenticated) onClose() }, [isAuthenticated])` | 登录成功后自动关闭弹窗 |
| `if (!isOpen) return null` | 弹窗外不渲染 |
| 遮罩层结构（`role="dialog"`, `aria-modal="true"`） | 无障碍属性 |
| 关闭按钮（右上角 ×） | 交互模式 |
| Tab 切换容器样式（`grid grid-cols-2 rounded-full bg-slate-100 p-1`） | 视觉一致 |

### 8.14 当前职责

登录/注册 UI 组件，管理表单状态和用户交互。

### 8.15 本阶段改什么

- Props：`onSignIn` / `onSignUp` → `onSendOtp` / `onVerifyOtp` / `onSignInWithPassword`
- `AuthMode` 类型：`"login" | "signup"` → `"otp" | "password"`
- 新增 `OtpPhase` 状态机（6 个状态）
- 新增 6 位验证码独立输入框 + 自动跳转焦点 + 粘贴支持
- 新增重发倒计时
- 移除注册 Tab 和注册表单
- `getSafeErrorMessage` 新增 OTP 相关错误映射
- 默认 Tab 改为"验证码登录"

### 8.16 不改什么

- 登录成功后自动关闭逻辑
- 遮罩层交互模式
- 弹窗基础样式（圆角/阴影/宽度）
- Tab 切换容器样式
- 不引入 V2.2 UI 升级（不拆 /login 和 /app）

### 8.17 依赖

- 依赖 `useAuth`（Step 2 — `sendOtp` / `verifyOtp` / `signInWithPassword`）
- 依赖 `constants.ts`（Step 3 — AUTH_TEXT 中的新 key）

### 8.18 可能风险

| 风险 | 等级 | 缓解 |
|------|:---:|------|
| 验证码输入框焦点管理 bug | **P2** | 使用 `useRef` 数组 + `onChange`/`onKeyDown` 精确控制；粘贴支持用 `onPaste` |
| 自动提交与手动提交竞态 | **P2** | `useEffect` 中检查 `otpPhase === "code"` 且 `!isSubmitting` 才触发 |
| 倒计时 useEffect 清理不当导致内存泄漏 | **P2** | 在 `useEffect` 返回清理函数中 `clearInterval` |
| Tab 切换时状态残留 | **P2** | `switchMode` 中重置所有相关状态 |
| 邮箱输入在验证码 Tab 和密码 Tab 之间共享 | **P2** | 使用同一个 `email` state（两个 Tab 共享邮箱输入），切换 Tab 时不清空邮箱（方便用户切换登录方式） |

### 8.19 Codex 注意事项

1. **这是改动最大的文件**（311 行 → 约 370 行完全重写），建议先读懂现有代码的状态管理逻辑（`resetForm`、`switchMode`、`handleSubmit`、`useEffect`），理解后再重写
2. **验证码输入框**：6 个独立 `<input>`，每个 `maxLength={1}`，`type="text"`（不是 `type="number"`——避免浏览器数字微调控件），`inputMode="numeric"`，`pattern="[0-9]"`
3. **autoComplete="one-time-code"** — 放在第一个验证码输入框上，iOS 会自动从邮件中读取验证码
4. **自动提交**：`useEffect` 监听 `token.length === 6 && otpPhase === "code" && !isSubmitting`
5. **倒计时**：`resendCountdown > 0` 时显示 `AUTH_TEXT.RESEND_COUNTDOWN.replace("{s}", String(resendCountdown))`
6. **邮箱共享**：两个 Tab 共用一个 `email` state，切换 Tab 时不清空邮箱——用户可能在验证码 Tab 输入邮箱后发现想用密码登录，此时邮箱应保留
7. **close 时完全重置**：`handleClose` → `resetForm()` → `onClose()`
8. **不引入新的 npm 依赖** — 6 位验证码输入框纯手写，不使用任何库
9. **getSafeErrorMessage 函数保留** — 只增加 2 个 OTP 相关的 `if` 分支
10. **按钮样式与 V2.1 保持一致** — `bg-gradient-to-r from-indigo-600 to-blue-500` 渐变

---

## 九、文件 6：Header.tsx — 适配

**当前文件**：`src/components/Header.tsx`（89 行）

### 9.1 当前代码分析

```typescript
const { user, isLoading, signIn, signUp, signOut } = useAuth();

// AuthModal props
<AuthModal
  isAuthenticated={Boolean(user)}
  isOpen={isAuthModalOpen}
  onClose={() => setIsAuthModalOpen(false)}
  onSignIn={signIn}
  onSignUp={signUp}
/>
```

### 9.2 V2.1B 变更

```typescript
const {
  user, isLoading,
  sendOtp, verifyOtp, signInWithPassword, setPassword,
  signOut,
} = useAuth();

const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
const [showSetPasswordPrompt, setShowSetPasswordPrompt] = useState(false);

// 登录成功后检查是否需要提示设置密码
useEffect(() => {
  if (user && !user.metadata?.password_set) {
    setShowSetPasswordPrompt(true);
  }
}, [user]);

// 登出时关闭设置密码引导
useEffect(() => {
  if (!user) {
    setShowSetPasswordPrompt(false);
  }
}, [user]);

return (
  <>
    {/* Header 内容（不变） */}
    <header>...</header>

    {/* AuthModal props 变更 */}
    <AuthModal
      isAuthenticated={Boolean(user)}
      isOpen={isAuthModalOpen}
      onClose={() => setIsAuthModalOpen(false)}
      onSendOtp={sendOtp}
      onVerifyOtp={verifyOtp}
      onSignInWithPassword={signInWithPassword}
    />

    {/* 设置密码引导（条件渲染） */}
    {showSetPasswordPrompt && user && (
      <SetPasswordPrompt
        isOpen={showSetPasswordPrompt}
        onSetPassword={async (password) => {
          await setPassword(password);
          setShowSetPasswordPrompt(false);
        }}
        onSkip={() => setShowSetPasswordPrompt(false)}
      />
    )}
  </>
);
```

### 9.3 具体改动行

| 位置 | 改动 | 说明 |
|------|------|------|
| L20 | `const { user, isLoading, signIn, signUp, signOut } = useAuth()` | 改为 `const { user, isLoading, sendOtp, verifyOtp, signInWithPassword, setPassword, signOut } = useAuth()` |
| L21 | — | 新增 `const [showSetPasswordPrompt, setShowSetPasswordPrompt] = useState(false)` |
| L22 后 | — | 新增 2 个 `useEffect`：监听 user 变化控制 SetPasswordPrompt |
| L80-86 | `<AuthModal ... onSignIn={signIn} onSignUp={signUp} />` | 改为 `<AuthModal ... onSendOtp={sendOtp} onVerifyOtp={verifyOtp} onSignInWithPassword={signInWithPassword} />` |
| L87 前 | — | 新增 SetPasswordPrompt 条件渲染（约 8 行） |

### 9.4 不改的部分

- 登录状态展示（`user.email` + 登出按钮）：**不变**
- Loading 状态（`isLoading` → "登录状态..."）：**不变**
- 未登录状态（"登录"按钮）：**不变**
- 历史按钮：**不变**
- 整个 header 布局：**不变**
- `UI_TEXT.APP_NAME` / `UI_TEXT.APP_ROLE` 展示：**不变**

### 9.5 当前职责

页面顶部导航栏，展示应用名称、登录状态、历史按钮，管理 AuthModal 和 SetPasswordPrompt 的显示。

### 9.6 本阶段改什么

- useAuth 解构：方法名变化 + 新增方法
- AuthModal props：3 个 prop 变化
- 新增 SetPasswordPrompt 条件渲染 + 两个 useEffect

### 9.7 不改什么

- Header 布局和样式
- 历史按钮逻辑
- 登出按钮逻辑
- 登录按钮样式

### 9.8 依赖

- 依赖 `useAuth`（Step 2 — 方法名和接口变更）
- 依赖 `AuthModal`（Step 5 — Props 变更）
- 依赖 `SetPasswordPrompt`（Step 4 — 新组件）

### 9.9 可能风险

| 风险 | 等级 | 缓解 |
|------|:---:|------|
| useAuth 解构名称不匹配导致运行时 undefined | **P2** | `npm run lint` 会捕获 TypeScript 类型不匹配 |
| `useEffect` 监听 `user` 导致设置密码引导重复弹出 | **P2** | 条件 `user && !user.metadata?.password_set` 确保只在 password_set 不为 true 时弹出 |
| `onAuthStateChange` 触发 `USER_UPDATED` 后 `useEffect` 再次判断 | **P2** | `setPassword` 成功后 `user.metadata.password_set` 变为 true，条件不满足，引导自动关闭 |
| 用户在设置密码引导打开时登出 | **P2** | 第二个 `useEffect` 监听 `!user` 时关闭引导 |

### 9.10 Codex 注意事项

1. **不要改 Header 布局** — 只改 useAuth 解构 + AuthModal props + 新增 SetPasswordPrompt
2. **两个 useEffect 的顺序**：先写"登录成功后显示引导"，再写"登出后关闭引导"
3. **SetPasswordPrompt 渲染条件**：`showSetPasswordPrompt && user` — 两个条件都必须满足
4. **setPassword 回调中的 `await`**：必须 await，确保 `password_set` 写入完成后再关闭引导
5. **不要删除 `signUp` 引用** — 如果 Header 中不再解构 `signUp`，确保没有其他地方使用它
6. **import SetPasswordPrompt**：别忘了新增 `import { SetPasswordPrompt } from "@/components/SetPasswordPrompt"`
7. Header.tsx 改动量小（约 25 行），但依赖前面 5 个文件全部就绪——放在最后改

---

## 十、callback route — 不修改

### 10.1 决策

**不修改** `src/app/auth/callback/route.ts`（86 行）。

### 10.2 理由

| 理由 | 说明 |
|------|------|
| OTP 主流程不依赖 callback | `verifyOtp({ email, token, type: "email" })` 是纯客户端调用，不需要 URL 回调 |
| 密码登录不依赖 callback | `signInWithPassword()` 是纯客户端调用 |
| 旧 V2.1 确认链接仍需 callback | 旧 V2.1 注册用户点击 Confirm signup 邮件中的链接 → `GET /auth/callback?token_hash=xxx&type=email` |
| 未来 V2.3 需要 callback | 忘记密码 / reset password 流程可能扩展 callback route 支持 `type=recovery` |
| 改动成本 > 收益 | callback route 当前逻辑已正确（只接受 `type=email`），无 bug，无性能问题 |

### 10.3 不做的事

| 不做 | 原因 |
|------|------|
| 不删除 callback route | 旧兼容 + 未来扩展需要 |
| 不修改 `getOtpType` | 当前只接受 `type=email`，逻辑正确 |
| 不新增 `type=signup` | 确认链接始终使用 `type=email` |
| 不新增 `type=recovery` | 属于 V2.3，不在 V2.1B 范围 |
| 不在 callback 中处理 OTP 验证码 | OTP 是客户端 verifyOtp，不需要 callback |

### 10.4 Codex 注意事项

**这个文件不要打开，不要修改，不要格式化。** 在 `git status --short` 中不应出现此文件。

---

## 十一、Supabase Dashboard 前置检查

以下检查项需要在代码部署**之前**由人工在 Supabase Dashboard 中确认。这些不是代码变更。

### 11.1 SMTP 检查

| # | 检查项 | 预期 | 方法 |
|---|--------|------|------|
| 1 | 阿里云邮件推送 SMTP 已开启 | 状态正常，发信域名已验证 | Supabase Dashboard → Authentication → Email → SMTP Settings |
| 2 | SMTP 发送测试通过 | 能收到测试邮件 | 使用 Supabase Dashboard 内置的"Send Test Email"功能 |

### 11.2 Magic Link 邮件模板检查

| # | 检查项 | 预期 | 方法 |
|---|--------|------|------|
| 3 | 模板使用 `{{ .Token }}` | 邮件正文中包含 `{{ .Token }}`（6 位数字验证码占位符） | Supabase Dashboard → Authentication → Email Templates → **Magic Link** |
| 4 | 模板**不使用** `{{ .ConfirmationURL }}` | 邮件正文中不包含 ConfirmationURL | 同上，全文搜索 `ConfirmationURL` |
| 5 | 模板**不使用** `{{ .TokenHash }}` | 邮件正文中不包含 TokenHash | 同上，全文搜索 `TokenHash` |
| 6 | 邮件主题为中文 | "AI Todo 登录验证码" | 查看 Subject 字段 |
| 7 | 邮件正文为中文 | 包含"验证码"、"10 分钟"等中文提示 | 查看 HTML 内容 |

### 11.3 Auth Settings 检查

| # | 检查项 | 当前值 | 说明 |
|---|--------|:---:|------|
| 8 | Allow new users to sign up | **ON** | OTP `shouldCreateUser: true` 依赖此开关 |
| 9 | Confirm email | **ON** | 建议保持。不影响 OTP 主流程（OTP 验证本身证明邮箱所有权），但为旧 V2.1 确认链接保留 |
| 10 | Allow unconfirmed email sign in | **OFF** | 建议保持。不影响 OTP 主流程，但阻止未验证邮箱绕过验证登录 |

### 11.4 OTP 过期时间检查

| # | 检查项 | 建议值 | 说明 |
|---|--------|:---:|------|
| 11 | OTP 过期时间 | **600s（10 分钟）** | Supabase 默认 3600s。在 Supabase Dashboard → Authentication → Settings 中找到 OTP Expiry / Email OTP Expiration 设置项（具体字段名以 Supabase Dashboard 当前界面为准）。**这是建议配置，不是代码依赖。** 如果暂时找不到或无法调整此设置项，不阻塞架构设计和代码实现，但实现验收时应记录实际值 |

### 11.5 无需检查的项

| 项目 | 原因 |
|------|------|
| Confirm signup 邮件模板 | V2.1-Follow-up SMTP 已配置，不动 |
| Site URL | V2.1 已配置，不动 |
| Redirect URLs | V2.1 已配置，不动 |

---

## 十二、实现顺序

### 12.1 推荐顺序

```
Step 1: types.ts           → AuthUser 扩展 metadata
Step 2: useAuth.ts          → 新增 sendOtp/verifyOtp/setPassword + signIn 重命名
Step 3: constants.ts        → AUTH_TEXT 新增 OTP + 设置密码文案
Step 4: SetPasswordPrompt.tsx → 新增设置密码引导组件
Step 5: AuthModal.tsx       → 重写为验证码/密码双模式
Step 6: Header.tsx          → useAuth 接口适配 + AuthModal props 变更 + SetPasswordPrompt 集成
Step 7: lint / build / git status → 门禁验证
Step 8: 人工 Supabase Dashboard 检查
Step 9: 生产环境手动验收
```

### 12.2 依赖关系

```
types.ts (Step 1)
    │
    ▼
useAuth.ts (Step 2) ─────────────────────┐
    │                                      │
    ▼                                      │
constants.ts (Step 3) ──┐                  │
    │                    │                  │
    ▼                    ▼                  │
SetPasswordPrompt.tsx   AuthModal.tsx       │
(Step 4)                (Step 5)            │
    │                    │                  │
    └──────────┬─────────┘                  │
               ▼                            │
         Header.tsx (Step 6) ◄──────────────┘
```

### 12.3 每步验收

| Step | 文件 | 验收方式 |
|:---:|------|---------|
| 1 | types.ts | `npm run lint` — TypeScript 编译通过 |
| 2 | useAuth.ts | `npm run lint` — 类型检查通过；`signIn` 已重命名为 `signInWithPassword` |
| 3 | constants.ts | `npm run lint` — 无类型错误；新 key 存在 |
| 4 | SetPasswordPrompt.tsx | `npm run lint` — 组件编译通过 |
| 5 | AuthModal.tsx | `npm run lint` — Props 匹配；所有状态分支无 TS 错误 |
| 6 | Header.tsx | `npm run lint` — useAuth 解构匹配；AuthModal props 匹配 |
| 7 | 全部 | `npm run lint` + `npm run build` + `git status --short` |

### 12.4 为什么 Step 3（constants）在 Step 4-5（组件）之前

AuthModal 和 SetPasswordPrompt 的新增 AUTH_TEXT key 需要在组件引用前定义。如果先写组件后补常量，TypeScript 编译会报错。

### 12.5 为什么 Step 6（Header）放最后

Header 依赖 useAuth 的新接口、AuthModal 的新 Props、SetPasswordPrompt 组件。这三个依赖全部就绪后 Header 才能编译通过。

---

## 十三、验收标准

### 13.1 配置验收

| # | 验收项 | 方法 |
|---|--------|------|
| 1 | Magic Link 邮件模板已编辑为中文验证码格式 | Supabase Dashboard → Email Templates → Magic Link |
| 2 | 模板使用 `{{ .Token }}`（不是 ConfirmationURL / TokenHash） | 检查模板 HTML |
| 3 | SMTP（阿里云邮件推送）保持配置不动 | Dashboard 确认 |

### 13.2 功能验收 — 验证码登录

| # | 验收项 | 预期结果 |
|---|--------|---------|
| 4 | 输入邮箱 → 发送验证码 → 收到邮件 | 收到中文验证码邮件，包含 6 位数字 |
| 5 | **新邮箱**输入正确验证码 → 自动创建账号 + 登录 | 登录成功，Header 显示邮箱。Supabase Auth 中可见新用户 |
| 6 | **老邮箱**输入正确验证码 → 直接登录 | 登录成功，Header 显示邮箱 |
| 7 | 输入**错误**验证码 → 提示错误 | 显示"验证码错误或已过期，请重新获取。" |
| 8 | 验证码输入满 6 位 → **自动提交** | 不需要点击按钮，自动调用 verifyOtp |
| 9 | 重发倒计时 | 发送后按钮显示倒计时（60s→0），期间 disabled |
| 10 | 倒计时结束后可**重新发送** | 按钮恢复可点击，点击后重新发送验证码邮件 |

### 13.3 功能验收 — 密码登录

| # | 验收项 | 预期结果 |
|---|--------|---------|
| 11 | 切换到密码登录 Tab | 显示邮箱+密码输入框 |
| 12 | 已设密码用户 → 邮箱+密码登录成功 | 登录成功，Header 显示邮箱 |
| 13 | 密码**错误** → 提示错误 | 显示"邮箱或密码错误，请重试。" |
| 14 | **旧 V2.1 密码用户** → 密码登录成功 | 登录成功；`user_metadata.password_set` 静默补写为 true |
| 15 | 未设密码用户 → 切换到密码登录 | 可尝试登录（但因为没密码，会提示"邮箱或密码错误"） |

### 13.4 功能验收 — 设置密码引导

| # | 验收项 | 预期结果 |
|---|--------|---------|
| 16 | 验证码登录成功后（password_set ≠ true） | 弹出设置密码引导浮层 |
| 17 | 密码登录成功后（password_set 补写前） | 仅旧 V2.1 用户首次密码登录时会弹出（补写后不再弹出） |
| 18 | 输入密码 + 确认密码 → 保存 | 提示成功，引导关闭，再次登录不弹出 |
| 19 | 密码 < 6 位 → 保存 | 前端拦截，显示"密码至少需要 6 位。" |
| 20 | 确认密码不一致 → 保存 | 前端拦截，显示"两次输入的密码不一致。" |
| 21 | 点击**"稍后再说"** | 引导关闭，正常进入 App，password_set 仍为 false |
| 22 | 设置密码后 → 下次登录**不再弹出**引导 | password_set = true，直接进入 App |
| 23 | 稍后再说后 → 下次登录**再次弹出**引导 | password_set 仍为 false，再次弹出 |
| 24 | 设置密码后用密码登录成功 | 可用邮箱+密码登录，不再弹出引导 |

### 13.5 功能验收 — 通用

| # | 验收项 | 预期结果 |
|---|--------|---------|
| 25 | 登录后**刷新**保持登录 | F5 刷新 → 仍显示已登录 |
| 26 | **登出**正常 | 点击登出 → Header 恢复"登录"按钮 → 回退匿名模式 |
| 27 | AuthModal 默认 Tab 是**验证码登录** | 打开 AuthModal → 默认选中"验证码登录" |
| 28 | Tab 切换清空输入和错误 | 切换 Tab → 验证码/密码/错误提示清空（邮箱保留） |

### 13.6 兼容验收

| # | 验收项 | 预期结果 |
|---|--------|---------|
| 29 | **未登录匿名模式**正常 | 不登录 → 输入目标 → 生成任务 |
| 30 | **匿名任务登录后迁移**正常 | 匿名创建任务 → 验证码登录 → 任务保留且绑定到 user_id |
| 31 | 同上（密码登录） | 匿名创建任务 → 密码登录 → 任务保留且绑定到 user_id |
| 32 | Phase 14 **AI 复盘**不受影响 | 登录 → 生成复盘 → 正常 |
| 33 | Phase 15 **智能调整**不受影响 | 登录 → stats 积累 → 调整建议正常 |
| 34 | `getAuthenticatedUserId()` 不变 | API Route 中 userId 来自 session |
| 35 | 前端请求体不含 userId | DevTools Network 确认 |
| 36 | **历史记录**不串数据 | 登录 → 历史 → 只显示当前用户的任务组 |
| 37 | **统计**不串数据 | 登录 → 统计 → 只显示当前用户的统计 |

### 13.7 安全验收

| # | 验收项 | 方法 |
|---|--------|------|
| 38 | 验证码频率限制正常 | 短时间内多次发送 → 报 rate limit |
| 39 | 密码不经过 Next.js 服务端 | DevTools Network → `/api/*` 不含 password |
| 40 | Service Role Key 不出现在前端 | DevTools Sources 搜索 |
| 41 | 登出后 API 不能访问 user_id 数据 | 登出 → 回退 device_id |

### 13.8 门禁验收

| # | 验收项 | 命令 |
|---|--------|------|
| 42 | TypeScript 编译通过 | `npm run lint` |
| 43 | Next.js 构建通过 | `npm run build` |
| 44 | `git status --short` 仅显示允许修改的 6 个文件 | 手动检查 |

---

## 十四、风险与回滚

### 14.1 风险矩阵

| # | 风险 | 等级 | 影响 | 缓解措施 |
|---|------|:---:|------|---------|
| 1 | **OTP 邮件送达失败** | **P1** | 用户收不到验证码，无法通过 OTP 登录 | SMTP 已在 V2.1-Follow-up 中验证稳定（阿里云邮件推送）；已设密码的用户可用密码登录兜底；未设密码用户需等待邮件恢复或联系支持 |
| 2 | **Magic Link 模板误用 `{{ .ConfirmationURL }}`** | **P1** | 发送的是链接而非 6 位验证码，用户看到的是 URL 而非数字码 | 必须在 Magic Link 模板中使用 `{{ .Token }}`；§十一 Dashboard 检查第 3-5 项为强制门禁；配置后立即测试完整发送→接收→输入→登录链路 |
| 3 | **用户不设置密码** | **P2** | 回头客每次等验证码，体验差 | 每次登录后弹出引导（直到设置密码）；引导文案强调"下次更快登录"；允许"稍后再说"确保不阻塞 |
| 4 | **`user_metadata.password_set` 不准** | **P2** | 已设密码的用户仍被提示设置 | metadata 由 Supabase Auth 直接管理；密码登录时自动补写；设置密码引导允许跳过——最坏情况用户多看到一次引导 |
| 5 | **旧 V2.1 用户 metadata 缺失** | **P2** | 旧用户密码登录后弹出设置密码引导 | `signInWithPassword` 中静默补写 `password_set: true`；补写成功后下次不再弹出 |
| 6 | **AuthModal 状态机复杂度增加** | **P2** | UI bug（状态切换时残留错误提示/输入内容） | 每个 Tab 切换时清空状态；验证码各个 phase 有独立渲染分支；`npm run lint` 作为门禁 |
| 7 | **邮箱枚举风险** | **P2** | 攻击者可通过"发送验证码"探测邮箱是否注册 | `signInWithOtp({ shouldCreateUser: true })` 对已注册和未注册邮箱行为一致（都发邮件）；前端提示统一 |
| 8 | **验证码频率限制** | **P2** | 用户短时间内多次请求被限流 | 前端重发倒计时 60s；Supabase 内置 rate limit 已保护；错误提示引导用户等待 |
| 9 | **types.ts 修改引入类型错误** | **P2** | 编译失败 | `npm run lint` 作为门禁；`metadata?` 是 optional 字段，向后兼容；现有代码不解构 `metadata` 不受影响 |
| 10 | **Header.tsx 中 useEffect 导致设置密码引导重复弹出** | **P2** | 用户每次登录都看到引导 | 条件 `user && !user.metadata?.password_set` 确保只在 password_set 不为 true 时弹出；`onAuthStateChange` 触发 USER_UPDATED 后 metadata 更新，条件不再满足 |

### 14.2 回滚方案

如果混合方案出现严重问题（如 OTP 邮件大面积送达失败），回滚到纯 Email+Password：

#### 回滚步骤

1. **代码回滚**（1 个 `git revert`）：
   - 恢复 AuthModal 为 V2.1 版本（登录/注册双 Tab）
   - 恢复 useAuth 为 V2.1 版本（移除 sendOtp/verifyOtp/setPassword，signInWithPassword 改回 signIn）
   - 删除 SetPasswordPrompt.tsx
   - 恢复 constants.ts 中的 AUTH_TEXT
   - 恢复 types.ts 中的 AuthUser 类型
   - 恢复 Header.tsx

2. **Supabase 配置回滚**：
   - Magic Link 邮件模板不需要回滚（V2.1 不使用 Magic Link 模板，仅 Confirm signup 模板参与 V2.1 流程）
   - SMTP 配置不动（阿里云邮件推送继续用于 Confirm signup 邮件）

3. **数据回滚**：
   - `user_metadata.password_set` 字段不删除（不影响 V2.1 功能，保留即可）
   - 数据库无变更，无需回滚

#### 回滚后状态

- 回到 V2.1 的 Email+Password 注册/登录
- 已通过 OTP 设置密码的用户 metadata 中有 `password_set: true`，但 V2.1 不使用此字段，无影响
- 已通过 OTP 创建但未设密码的用户，仍可通过 OTP 重新登录（因为他们的 Supabase Auth 账号已存在），但 V2.1 AuthModal 不支持 OTP → 这些用户需等待 V2.1B 重新上线

#### 回滚成本

| 项目 | 说明 |
|------|------|
| 代码回滚 | `git revert` 一个 commit（6 个文件） |
| 配置回滚 | 无需操作（SMTP / 模板保持不动） |
| 数据回滚 | 无需操作 |
| 用户影响 | 仅影响 V2.1B 上线后通过 OTP 登录且未设密码的用户（预计极少） |
| 预计时间 | < 10 分钟（revert + build + deploy） |

---

## 十五、给 Codex 的执行边界提醒

### ✅ 可以做

1. 修改 `src/lib/types.ts` — 仅 AuthUser 增加 metadata 字段（§四）
2. 修改 `src/hooks/useAuth.ts` — 新增 sendOtp/verifyOtp/setPassword + signIn 重命名 + toAuthUser 扩展（§五）
3. 修改 `src/lib/constants.ts` — AUTH_TEXT 新增 OTP + 设置密码文案（§六）
4. 新增 `src/components/SetPasswordPrompt.tsx` — 设置密码引导浮层（§七）
5. 重写 `src/components/AuthModal.tsx` — 验证码/密码双模式（§八）
6. 修改 `src/components/Header.tsx` — useAuth 接口适配 + AuthModal props 变更 + SetPasswordPrompt 集成（§九）

### ❌ 不要做

1. **不要改 API Route** — `src/app/api/*` 全部不动（8 个 route）
2. **不要改 callback route** — `src/app/auth/callback/route.ts` 不动
3. **不要改任务逻辑** — useTaskGroup / useTaskReview / useTaskStats / useTaskHistory / ai-client / task-parser / review-parser / stats-calculator / adjust-task-strategy 不动
4. **不要改服务端基础设施** — supabase-server.ts / supabase-client.ts / device-id.ts 不动
5. **不要改数据库** — 不改 schema / migration / RLS
6. **不要新增 npm 依赖** — `package.json` 不动
7. **不要改 .env.local** — 不新增环境变量
8. **不要改 Tailwind 配置** — 不动 `tailwind.config.ts` / `globals.css`
9. **不要做 CAPTCHA** — Cloudflare Turnstile 是 V2.3
10. **不要做忘记密码** — 是 V2.3
11. **不要改 page.tsx** — 页面入口不动
12. **不要拆 /login 和 /app 路由** — 是 V2.2
13. **不要做 UI 美化** — 不改 AuthModal 之外的任何组件的样式
14. **不要修改 Task / TaskGroup / API 响应结构** — types.ts 只改 AuthUser
15. **不要输出 token / password / session 到 console** — 使用 `logSafeAuthError` 脱敏
16. **不要提交旧草稿** `docs/Architecture-V2.1-OTP.md`
17. **不要修改旧草稿** `docs/Architecture-V2.1-OTP.md`

### ⚠️ 如果发现需要改 §三 禁止清单中的文件

**停下来，汇报。** 说明哪个文件、为什么需要改、当前执行方案哪里遗漏了。不要自行扩大修改范围。

### ⚠️ 关于 signUp 的处理

`signUp` 函数保留在 useAuth.ts 中不动，但**不在 AuthModal 中作为公开入口使用**。AuthModal 不展示注册 Tab。新用户注册通过 OTP 验证码（`sendOtp` → `verifyOtp`）自动创建账号。不要删除 `signUp` 函数——它在内部兼容和回滚场景中仍需保留。

### ⚠️ 关于 email 在 AuthModal 两个 Tab 之间的共享

两个 Tab（验证码登录 / 密码登录）**共享同一个 `email` state**。用户在验证码 Tab 输入邮箱后切换到密码 Tab，邮箱应保留（方便用户切换登录方式）。切换 Tab 时清空 `password` / `token` / `errorMessage` 等，但不清空 `email`。

---

> **文档结束**
>
> **下一阶段**：本文档经 ChatGPT 审查通过后，Codex 按本文档实现代码。实现完成后 Claude Code 做 Code Review。
>
> **关联文档**：
> - [Architecture-V2.1B-OTP-Password.md](Architecture-V2.1B-OTP-Password.md) — V2.1B 架构方案
> - [Architecture-V2.1-Auth.md](Architecture-V2.1-Auth.md) — V2.1 Auth 架构方案（✅ 已完成）
> - [Execution-Plan-V2.1-Auth.md](Execution-Plan-V2.1-Auth.md) — V2.1 Auth 执行方案（✅ 已完成）
> - [Architecture-V2.1-Follow-up-SMTP.md](Architecture-V2.1-Follow-up-SMTP.md) — V2.1-Follow-up SMTP 架构方案（✅ 已完成）
> - [Execution-Plan-V2.1-Follow-up-SMTP.md](Execution-Plan-V2.1-Follow-up-SMTP.md) — V2.1-Follow-up SMTP 执行方案（✅ 已完成）
> - [Roadmap-V2.1-V2.3.md](Roadmap-V2.1-V2.3.md) — V2.1-V2.3 路线图
> - [PROJECT-CONTEXT.md](PROJECT-CONTEXT.md) — 项目长期上下文
> - [PROJECT-INDEX.md](PROJECT-INDEX.md) — 项目文件索引
