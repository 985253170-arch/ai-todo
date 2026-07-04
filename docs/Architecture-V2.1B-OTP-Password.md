# V2.1B：邮箱验证码 + 密码混合账号体系 架构方案

> **状态**：架构设计阶段
> **依赖**：V2.1 Auth（Email+Password）✅ 已完成 · V2.1-Follow-up SMTP（阿里云邮件推送）✅ 已完成
> **定位**：V2.1 Auth 的增强阶段，新增邮箱验证码登录 + 登录后引导设置密码，**不是 V2.2，不是 V2.3**
> **上一文档**：[Architecture-V2.1-Auth.md](Architecture-V2.1-Auth.md) · [Architecture-V2.1-Follow-up-SMTP.md](Architecture-V2.1-Follow-up-SMTP.md)
> **设计日期**：2026-07-04

---

## 目录

- [一、产品决策](#一产品决策)
- [二、Supabase Auth 方案](#二supabase-auth-方案)
- [三、前端登录状态机](#三前端登录状态机)
- [四、useAuth Hook 改造](#四useauth-hook-改造)
- [五、user_metadata.password_set 标记方案](#五user_metadatapassword_set-标记方案)
- [六、AuthModal / Auth UI 改造](#六authmodal--auth-ui-改造)
- [七、Header 适配](#七header-适配)
- [八、callback route 处理](#八callback-route-处理)
- [九、数据兼容性](#九数据兼容性)
- [十、Supabase Dashboard 配置](#十supabase-dashboard-配置)
- [十一、允许修改文件清单](#十一允许修改文件清单)
- [十二、禁止修改文件清单](#十二禁止修改文件清单)
- [十三、验收标准](#十三验收标准)
- [十四、风险与回滚](#十四风险与回滚)

---

## 一、产品决策

### 1.1 当前状态

V2.1 Auth 提供 Email+Password 注册/登录。V2.1-Follow-up SMTP 已完成阿里云邮件推送配置，邮件发送稳定。

用户当前的登录体验：

```
首次使用：输入邮箱+密码 → 注册 → 收确认邮件 → 点确认链接 → 输入密码登录 → 进入
再次使用：输入邮箱+密码 → 登录 → 进入
```

### 1.2 目标

将当前 Email+Password 账号体系升级为**邮箱验证码 + 密码混合账号体系**：

```
首次使用：输入邮箱 → 收验证码 → 输入 6 位验证码 → 自动创建账号 + 登录
  → 弹出"设置登录密码，下次更快登录"
  → 设置密码（推荐） 或 稍后再说

再次使用（已设密码）：输入邮箱+密码 → 登录
再次使用（未设密码）：输入邮箱 → 收验证码 → 登录
```

**核心设计理念**：

1. **默认验证码登录** — 降低首次使用门槛，不需要记密码
2. **登录后强引导设置密码** — 为回头客提供更快的密码登录方式
3. **两种方式长期共存** — 设过密码的用户可自由选择验证码或密码

### 1.3 为什么采用混合账号体系

| 维度 | 纯 Email+Password（当前） | 纯 Email OTP | 混合体系（目标） |
|------|:---:|:---:|:---:|
| **首次使用门槛** | 中（需设密码 + 确认邮件） | 低（收码即登录） | **低**（收码即登录） |
| **回头客登录速度** | 快（密码管理器自动填充） | 慢（每次等邮件） | **快**（有密码用密码，没密码用验证码） |
| **中国用户习惯** | 一般 | 熟悉（类似微信/短信验证码） | **最佳**（验证码入门 + 密码便捷） |
| **安全性** | 密码泄露风险 | 无密码泄露风险 | **平衡**（验证码兜底，密码可选） |
| **忘记密码** | 需重置流程（V2.3 才做） | 不存在"忘记密码" | **不存在**（随时可用验证码登录） |
| **邮件发送量** | 仅注册 1 封确认邮件 | 每次登录 1 封 | **中等**（首次+未设密码用户才发） |

### 1.4 相比纯 OTP 方案的优势

纯 OTP 方案的问题是：

1. **每次登录都发邮件** — 回头客体验差，等邮件 → 切换 App → 复制验证码 → 回来粘贴
2. **邮件发送成本** — 虽然免费额度够用，但每次登录都发一封是不必要的
3. **没有"记住我"的快捷方式** — 密码管理器可以一键填充，验证码永远需要等待

混合方案解决了这些问题：**设过一次密码，以后就能秒登**。

### 1.5 默认登录方式

| 场景 | 默认方式 | 原因 |
|------|:---:|------|
| AuthModal 首次打开 | **验证码登录** | 降低新用户门槛 |
| 用户已设密码 | 验证码登录（默认），可切换到密码登录 | 保持一致，让用户自己选择 |
| 用户未设密码 | 验证码登录（唯一方式） | 还没有密码可用 |

**产品建议**：AuthModal 默认 Tab 是"验证码登录"。密码登录作为第二个 Tab，标注为"密码登录"而非"登录"。这样新用户直接看到验证码输入框，老用户知道可以切换到密码。

### 1.6 设置密码是否强制

**不强制。** 但**强引导**。

| 行为 | 设计 |
|------|------|
| 验证码登录成功后 | 弹出设置密码引导界面 |
| 引导文案 | "设置登录密码，下次更快登录" |
| 主按钮 | "设置密码"（突出样式） |
| 次按钮 | "稍后再说"（文字链接，弱化样式） |
| 用户选择"稍后再说" | 关闭引导，正常进入 App。下次登录仍用验证码 |
| 用户选择"设置密码" | 输入密码（≥6 位）+ 确认密码 → 保存 → 下次可用密码登录 |

**为什么不强制**：

- 保持验证码登录的低门槛优势
- 用户可能只是想试用一下，强制设密码会增加流失
- 下次登录时再次引导即可——用户用多了自然会设密码

---

## 二、Supabase Auth 方案

### 2.1 API 全景

| 操作 | Supabase API | 说明 |
|------|-------------|------|
| 发送验证码 | `signInWithOtp({ email, options: { shouldCreateUser: true } })` | 新邮箱自动创建账号，老邮箱发送验证码 |
| 校验验证码 | `verifyOtp({ email, token, type: "email" })` | 纯客户端调用，验证成功自动获得 session |
| 设置密码 | `updateUser({ password, data: { password_set: true } })` | 为已有账号设置密码 + 写入 metadata |
| 密码登录 | `signInWithPassword({ email, password })` | 与 V2.1 相同，保留不动 |
| 获取用户 | `getUser()` | ✅ 不变 |
| 登出 | `signOut()` | ✅ 不变 |
| Session 监听 | `onAuthStateChange()` | ✅ 不变 |

### 2.2 signInWithOtp — 发送验证码

```typescript
const { error } = await supabase.auth.signInWithOtp({
  email,
  options: {
    shouldCreateUser: true,  // 邮箱不存在时自动创建账号
  },
});
```

- **不返回 session** — 仅发送验证码邮件
- `shouldCreateUser: true` — 新邮箱自动注册，无需单独 signUp
- 可能的错误：rate limit（过于频繁）、邮件发送失败
- **不需要 emailRedirectTo** — OTP 验证码不需要回调 URL

### 2.3 verifyOtp — 校验验证码

```typescript
const { data, error } = await supabase.auth.verifyOtp({
  email,
  token,        // 用户输入的 6 位数字验证码
  type: "email",
});
```

- **成功后 `data.session` 存在** — Supabase JS SDK 自动写入 session cookie
- `onAuthStateChange` 自动触发 → user 状态更新
- **不需要 callback route 参与**
- **不需要 URL 重定向**
- `type` 固定为 `"email"`
- 注意：此处 `token` 是 6 位数字验证码明文，**不是** `token_hash`（那是确认链接用的）

### 2.4 updateUser — 设置密码

```typescript
const { data, error } = await supabase.auth.updateUser({
  password: newPassword,
  data: { password_set: true },  // user_metadata
});
```

- 调用前提：用户已登录（有有效 session）
- `password` — 新密码（≥6 位，Supabase 默认要求）
- `data` — 写入 `user_metadata`，标记用户已设置密码
- 成功后 `data.user.user_metadata.password_set === true`
- `onAuthStateChange` 会触发（因为 user 对象更新了），需注意不要重复弹出设置密码引导

### 2.5 signInWithPassword — 密码登录

```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});
```

- **与 V2.1 完全相同，保留不动**
- 成功后 `data.session` 存在 → 自动写入 cookie
- `data.user.user_metadata.password_set` 可用于判断是否需要补写标记

### 2.6 是否保留 signUp(email, password)

**保留，但不作为公开主入口。**

| 用途 | 说明 |
|------|------|
| **不作为 AuthModal 主入口** | 注册主入口改为 OTP 验证码（自动创建账号） |
| **保留在 useAuth Hook 中** | 作为内部兼容方法，不删除 |
| **可能的未来用途** | 管理后台手动创建账号、测试脚本等 |

AuthModal 中**不展示注册 Tab**（现有 V2.1 的登录/注册双 Tab 改为验证码/密码双 Tab）。

### 2.7 是否还需要 Confirm signup 链接

**不需要作为主流程。**

| 流程 | 说明 |
|------|------|
| OTP 主流程 | 验证码校验成功即登录，无 Confirm signup 环节 |
| 旧 Confirm signup 邮件 | 保留 Supabase Dashboard 中的 Confirm signup 模板不做修改（兼容旧 V2.1 注册用户点击确认链接的场景） |
| 新用户 | 不会收到 Confirm signup 邮件（因为不走 signUp），走 OTP 验证码 |

### 2.8 /auth/callback 是否继续保留

**保留，但不参与 OTP 主流程。**

| 场景 | 是否需要 callback |
|------|:---:|
| OTP 验证码登录 | ❌ 不需要（纯客户端 verifyOtp） |
| 密码登录 | ❌ 不需要（纯客户端 signInWithPassword） |
| 旧 V2.1 注册用户的确认链接 | ✅ 仍需要（兼容） |
| 未来 reset password / email change | ✅ 可能需要（V2.3） |

**结论**：`src/app/auth/callback/route.ts` 保留不动。当前逻辑（`type=email` → `verifyOtp({ token_hash, type })`）不修改、不删除。OTP 主流程完全不调用它。

---

## 三、前端登录状态机

### 3.1 状态全景图

V2.1B 的 AuthModal 比 V2.1 复杂。以下是完整状态机：

```
                          ┌─────────────────────────────────┐
                          │        AuthModal 打开            │
                          │    默认 Tab = "验证码登录"        │
                          └──────────────┬──────────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
           ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
           │ 验证码登录 Tab │    │ 密码登录 Tab  │    │  关闭弹窗     │
           │  (默认选中)   │    │              │    │  (×/遮罩/ESC) │
           └──────┬───────┘    └──────┬───────┘    └──────────────┘
                  │                   │
    ┌─────────────┼─────────────┐     │
    ▼             ▼             ▼     ▼
┌────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐
│ idle   │  │ sending  │  │  error   │  │ idle         │
│ 输入    │  │ 发送中…  │  │ 错误提示  │  │ 输入邮箱+密码 │
│ 邮箱    │  │ disabled │  │ 可重试   │  │              │
└───┬────┘  └─────┬────┘  └────┬─────┘  └──────┬───────┘
    │             │            │               │
    │ 点击        │ 发送       │ 3秒后自动      │ 点击
    │"发送        │ 成功       │ 消失或手动     │"登录"
    │ 验证码"     │            │ 关闭           │
    │             ▼            │               ▼
    │       ┌──────────┐      │        ┌──────────────┐
    │       │  code    │      │        │ submitting   │
    │       │  输入    │      │        │ 登录中…      │
    │       │  6位验证码│      │        │ disabled     │
    │       │  重新发送 │      │        └──────┬───────┘
    │       └────┬─────┘      │               │
    │            │            │        ┌───────┴───────┐
    │            │ 输入       │        ▼               ▼
    │            │ 6位后      │   ┌──────────┐  ┌──────────┐
    │            │ 自动提交   │   │ success  │  │  error   │
    │            ▼            │   │ 关闭弹窗  │  │ 错误提示  │
    │       ┌──────────┐     │   │ 检查      │  │ 可重试   │
    │       │verifying │     │   │ password  │  └──────────┘
    │       │ 验证中…  │     │   │ _set      │
    │       │ disabled │     │   └─────┬─────┘
    │       └────┬─────┘     │         │
    │            │           │    ┌────┴────────┐
    │       ┌────┴────┐      │    ▼             ▼
    │       ▼         ▼      │ ┌────────┐ ┌──────────┐
    │  ┌────────┐ ┌────────┐ │ │password│ │password  │
    │  │success │ │ error  │ │ │_set    │ │_set      │
    │  │关闭弹窗 │ │ 验证码 │ │ │= true  │ │≠ true    │
    │  │检查    │ │ 错误   │ │ │直接    │ │弹出设置   │
    │  │password│ │ 可重试 │ │ │进入App │ │密码引导   │
    │  │_set    │ └────────┘ │ └────────┘ └────┬─────┘
    │  └───┬────┘            │                  │
    │      │                 │           ┌──────┴──────┐
    │ ┌────┴────────┐        │           ▼             ▼
    │ ▼             ▼        │     ┌──────────┐  ┌──────────┐
    │ ┌────────┐ ┌──────────┐│     │ 设置密码  │  │ 稍后再说  │
    │ │password│ │password  ││     │ 输入密码  │  │ 关闭引导  │
    │ │_set    │ │_set      ││     │ + 确认   │  │ 进入App   │
    │ │= true  │ │≠ true    ││     └────┬─────┘  └──────────┘
    │ │直接    │ │弹出设置   ││          │
    │ │进入App │ │密码引导   ││     ┌────┴────┐
    │ └────────┘ └────┬─────┘│     ▼         ▼
    │                  │      │ ┌────────┐ ┌──────────┐
    │           ┌──────┴──────┐│ │success │ │  error   │
    │           ▼             ▼│ │密码    │ │ 密码     │
    │     ┌──────────┐  ┌──────────┐│ │已设置  │ │ 太短等   │
    │     │ 设置密码  │  │ 稍后再说  ││ │进入App │ │ 可重试   │
    │     └────┬─────┘  └──────────┘│ └────────┘ └──────────┘
    │          │                     │
    │     ┌────┴────┐               │
    │     ▼         ▼               │
    │ ┌────────┐ ┌──────────┐       │
    │ │success │ │  error   │       │
    │ │进入App │ │ 可重试   │       │
    │ └────────┘ └──────────┘       │
    └───────────────────────────────┘
```

### 3.2 状态详解

#### 验证码登录分支

| 状态 | 说明 | UI 表现 |
|------|------|---------|
| **idle** | 初始态，等待输入邮箱 | 邮箱输入框 + "发送验证码"按钮 |
| **sending** | 正在发送验证码邮件 | 按钮显示"发送中…"，disabled |
| **code** | 等待输入 6 位验证码 | 6 个数字输入框 + "重新发送"按钮（60s 倒计时） |
| **verifying** | 正在校验验证码 | 按钮显示"验证中…"，disabled |
| **success** | 验证成功 | 关闭 AuthModal → 检查 password_set |
| **error** | 发送或验证失败 | 红色错误提示，可重试 |
| **resend** | 重新发送验证码 | 与 sending 相同，但 code 态中倒计时结束后可点击 |

#### 密码登录分支

| 状态 | 说明 | UI 表现 |
|------|------|---------|
| **idle** | 初始态，等待输入邮箱+密码 | 邮箱输入框 + 密码输入框 + "登录"按钮 |
| **submitting** | 正在登录 | 按钮显示"登录中…"，disabled |
| **success** | 登录成功 | 关闭 AuthModal → 检查 password_set |
| **error** | 登录失败 | 红色错误提示，可重试 |

#### 登录成功后 password_set 检查

| 状态 | 触发条件 | UI 表现 |
|------|---------|---------|
| **password_set = true** | user_metadata.password_set 为真 | 直接进入 App，不弹引导 |
| **password_set ≠ true** | user_metadata.password_set 为假或不存在 | 弹出设置密码引导浮层 |
| **设置密码** | 用户点击"设置密码" | 密码 + 确认密码输入框 + "保存密码"按钮 |
| **setting password** | 正在保存密码 | 按钮显示"保存中…"，disabled |
| **设置成功** | updateUser 成功 | 关闭引导，进入 App |
| **稍后再说** | 用户点击"稍后再说" | 关闭引导，进入 App |

### 3.3 关键交互规则

| 规则 | 说明 |
|------|------|
| **自动提交** | 验证码输入满 6 位数字后自动调用 verifyOtp，不需要用户点击"确认"按钮 |
| **重发倒计时** | 发送验证码后，重发按钮倒计时 60 秒。倒计时期间 disabled，显示"重新发送（Xs）" |
| **Tab 切换** | 验证码 Tab ↔ 密码 Tab，切换时清空所有输入和错误信息 |
| **关闭弹窗** | 点击遮罩、× 按钮、ESC 键均可关闭，关闭时清空所有状态 |
| **登录成功自动关闭** | `isAuthenticated` 变为 true 时 useEffect 自动调用 `onClose()`（保留现有逻辑） |
| **设置密码引导不阻塞** | 引导浮层可以关闭（"稍后再说"），不强制设置密码 |

### 3.4 iOS/Android 键盘优化

| 平台 | 优化 |
|------|------|
| iOS | 验证码输入框设置 `autoComplete="one-time-code"`，iOS 键盘上方自动读取邮件中的验证码 |
| Android | 同上，Android 的 Google Play Services 也支持 SMS/邮件验证码自动填充 |
| 通用 | 6 个独立数字输入框（每个 1 位），自动跳转焦点 |

---

## 四、useAuth Hook 改造

### 4.1 当前接口（V2.1）

```typescript
// src/hooks/useAuth.ts — 当前导出
return {
  user,        // AuthUser | null
  isLoading,   // boolean
  signUp,      // (email, password) => Promise<void>
  signIn,      // (email, password) => Promise<void>
  signOut,     // () => Promise<void>
};
```

### 4.2 改造后接口（V2.1B）

```typescript
// src/hooks/useAuth.ts — V2.1B 导出
return {
  user,              // AuthUser | null  ← 不变
  isLoading,         // boolean         ← 不变
  sendOtp,           // (email: string) => Promise<void>  ← 新增
  verifyOtp,         // (email: string, token: string) => Promise<void>  ← 新增
  signInWithPassword,// (email: string, password: string) => Promise<void>  ← 重命名自 signIn
  signUp,            // (email: string, password: string) => Promise<void>  ← 保留（内部兼容）
  setPassword,       // (password: string) => Promise<void>  ← 新增
  signOut,           // () => Promise<void>  ← 不变
};
```

### 4.3 各函数实现

#### sendOtp

```typescript
async function sendOtp(email: string) {
  if (!supabase) throw new Error("AUTH_NOT_CONFIGURED");

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  if (error) {
    logSafeAuthError(error);
    throw error;
  }
  // 不设置 user — 等待 verifyOtp
}
```

#### verifyOtp

```typescript
async function verifyOtp(email: string, token: string) {
  if (!supabase) throw new Error("AUTH_NOT_CONFIGURED");

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

#### signInWithPassword（改名自 signIn）

```typescript
async function signInWithPassword(email: string, password: string) {
  if (!supabase) throw new Error("AUTH_NOT_CONFIGURED");

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    logSafeAuthError(error);
    throw error;
  }

  setUser(toAuthUser(data.user));

  // 兼容旧 V2.1 用户：如果 password_set 未标记，补写
  if (!data.user.user_metadata?.password_set) {
    await supabase.auth.updateUser({
      data: { password_set: true },
    }).catch(() => { /* 静默忽略 — 补写失败不阻塞登录 */ });
  }
}
```

**关键设计**：密码登录成功后检查 `user_metadata.password_set`。旧 V2.1 用户的 metadata 中没有此字段，因此第一次用密码登录时自动补写 `password_set: true`。补写失败（如网络问题）不影响登录——静默忽略。

#### setPassword

```typescript
async function setPassword(password: string) {
  if (!supabase) throw new Error("AUTH_NOT_CONFIGURED");

  const { data, error } = await supabase.auth.updateUser({
    password,
    data: { password_set: true },
  });

  if (error) {
    logSafeAuthError(error);
    throw error;
  }

  // updateUser 成功后 onAuthStateChange 触发 → user 更新（含新的 user_metadata）
  setUser(toAuthUser(data.user));
}
```

#### signUp（保留，内部兼容）

```typescript
// 完全保留 V2.1 的实现，不做修改
// 不作为 AuthModal 主入口，但保留在 Hook 中
async function signUp(email: string, password: string) {
  // ... 与 V2.1 完全相同
}
```

#### signOut（不变）

V2.1 的 signOut 实现完全保留。

### 4.4 onAuthStateChange 处理

**不变。** `onAuthStateChange` 的监听逻辑与 V2.1 完全相同：

```typescript
supabase.auth.onAuthStateChange((_event, session) => {
  setUser(toAuthUser(session?.user ?? null));
  setIsLoading(false);
});
```

- `signInWithOtp` 发送验证码 → 不触发（无 session 变化）
- `verifyOtp` 成功 → 触发 `SIGNED_IN` → user 更新
- `signInWithPassword` 成功 → 触发 `SIGNED_IN` → user 更新
- `updateUser` 成功 → 触发 `USER_UPDATED` → user 更新（含新的 user_metadata）
- `signOut` → 触发 `SIGNED_OUT` → user 变为 null

### 4.5 如何判断登录成功后是否需要提示设置密码

**判断逻辑在前端（AuthModal），不在 useAuth 中。**

```typescript
// 在 AuthModal 中
function needsPasswordSetup(user: AuthUser | null): boolean {
  if (!user) return false;
  // Supabase user 对象上的 user_metadata
  // useAuth 的 toAuthUser 需要扩展以包含 metadata
  return !user.metadata?.password_set;
}
```

**需要扩展 `AuthUser` 类型**（在 `src/lib/types.ts` 中）：

```typescript
// V2.1B：AuthUser 增加 metadata 字段
interface AuthUser {
  id: string;
  email: string | null;
  metadata?: {
    password_set?: boolean;
  };
}
```

**useAuth 中的 toAuthUser 需要同步扩展**，从 `session.user.user_metadata` 中读取 `password_set`。

> ⚠️ **注意**：`types.ts` 属于高风险文件。此处的修改是**架构必需的**（AuthUser 类型扩展），属于最小改动。如果 ChatGPT 审查认为不应修改 types.ts，备选方案是在 useAuth 内部维护一个独立的 `passwordSet` boolean 状态，但这样会引入状态同步问题——不推荐。

### 4.6 user / isLoading

**不变。** 类型签名、初始化逻辑、session 恢复逻辑与 V2.1 完全相同。

---

## 五、user_metadata.password_set 标记方案

### 5.1 能否仅依赖 Supabase Auth 判断用户是否设置过密码

**不能。** Supabase Auth 的 `auth.users` 表中有 `encrypted_password` 字段，但：

1. 前端无法直接查询 `auth.users` 表（不是 public schema）
2. `encrypted_password` 存在不代表"用户主动设置过密码"——`signInWithOtp` 自动创建账号时也可能有内部密码哈希
3. 靠 API 查询 `has_password` 没有直接的 Supabase JS SDK 方法

**因此需要显式标记。**

### 5.2 推荐方案：user_metadata.password_set

| 方案 | 说明 | 优势 | 劣势 |
|------|------|------|------|
| **A. user_metadata.password_set**（推荐） | 使用 Supabase Auth 内置的 `user_metadata` 字段 | 无需数据库变更；无需新增表；前端可直接读取 | 依赖 Supabase Auth 的 metadata 可靠性 |
| B. 新增数据库表 `user_profiles` | 在 public schema 创建 `user_profiles` 表存 `has_password` | 可控性强 | 违反"不修改数据库"约束；需 migration；额外 I/O |
| C. 每次登录后尝试 `signInWithPassword` | 用空密码尝试登录，根据错误判断 | 无需额外存储 | **绝对不可**——会触发 Supabase rate limit，且语义错误 |

**推荐方案 A**，理由：

- ✅ 不新增数据库表 / migration
- ✅ 不修改 `task_groups` / `tasks` 表
- ✅ `user.user_metadata` 已在 Supabase session 中，前端可直接读取
- ✅ `updateUser({ data: { password_set: true } })` 即可写入
- ✅ 写入失败不影响核心登录流程（降级为"每次都引导设置密码"，可接受）

### 5.3 写入时机

| 场景 | 写入操作 | 调用位置 |
|------|---------|---------|
| 用户通过验证码登录后设置密码 | `updateUser({ password, data: { password_set: true } })` | useAuth.setPassword() |
| 旧 V2.1 密码用户首次用密码登录 | `updateUser({ data: { password_set: true } })`（补写） | useAuth.signInWithPassword() 内部静默补写 |
| 新用户通过验证码首次登录（未设密码） | 不写入 | — |

### 5.4 读取路径

```
Supabase Auth Session
  → session.user.user_metadata.password_set
  → useAuth.toAuthUser() 映射到 AuthUser.metadata.password_set
  → AuthModal 判断是否需要弹出设置密码引导
```

### 5.5 旧 V2.1 密码用户兼容

V2.1 已注册的密码用户，其 `user_metadata` 中没有 `password_set` 字段。

**兼容策略**：密码登录成功后，如果 `password_set !== true`，静默补写 `password_set: true`（见 §四 4.3 signInWithPassword 实现）。

这样旧用户首次用密码登录后，下次登录不再弹出设置密码引导。

---

## 六、AuthModal / Auth UI 改造

### 6.1 改造概述

V2.1 的 AuthModal 是"登录/注册"双 Tab。V2.1B 改为"验证码登录/密码登录"双 Tab。

| V2.1（旧） | V2.1B（新） |
|-----------|-----------|
| Tab 1: 登录（邮箱+密码） | Tab 1: 验证码登录（默认） |
| Tab 2: 注册（邮箱+密码+确认） | Tab 2: 密码登录 |
| Props: `onSignIn`, `onSignUp` | Props: `onSendOtp`, `onVerifyOtp`, `onSignInWithPassword`, `onSetPassword` |

### 6.2 Props 变更

```typescript
// V2.1B AuthModal Props
interface AuthModalProps {
  isOpen: boolean;
  isAuthenticated: boolean;
  onClose: () => void;
  onSendOtp: (email: string) => Promise<void>;
  onVerifyOtp: (email: string, token: string) => Promise<void>;
  onSignInWithPassword: (email: string, password: string) => Promise<void>;
  onSetPassword: (password: string) => Promise<void>;
  user: AuthUser | null;  // 新增 — 用于检查 password_set
}
```

### 6.3 组件内部状态

```typescript
type AuthMode = "otp" | "password";
type OtpPhase = "idle" | "sending" | "code" | "verifying" | "success" | "error";

const [mode, setMode] = useState<AuthMode>("otp");         // 默认验证码登录
const [otpPhase, setOtpPhase] = useState<OtpPhase>("idle");
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [token, setToken] = useState("");                     // 6 位验证码（字符串拼接）
const [message, setMessage] = useState<string | null>(null);
const [errorMessage, setErrorMessage] = useState<string | null>(null);
const [isSubmitting, setIsSubmitting] = useState(false);
const [resendCountdown, setResendCountdown] = useState(0);  // 重发倒计时（秒）

// 设置密码引导
const [showSetPasswordPrompt, setShowSetPasswordPrompt] = useState(false);
const [newPassword, setNewPassword] = useState("");
const [confirmNewPassword, setConfirmNewPassword] = useState("");
```

### 6.4 验证码登录 UI（默认 Tab）

#### idle — 输入邮箱

```
┌────────────────────────────────────────────┐
│                                            │
│    [验证码登录]    |    密码登录              │  ← Tab 切换，默认选中"验证码登录"
│    ———————————                             │
│                                            │
│    ┌──────────────────────────────────┐    │
│    │  your@email.com                  │    │  ← type="email"
│    └──────────────────────────────────┘    │
│                                            │
│    ┌──────────────────────────────────┐    │
│    │         发送验证码                │    │
│    └──────────────────────────────────┘    │
│                                            │
└────────────────────────────────────────────┘
```

#### sending — 发送中

```
│    ┌──────────────────────────────────┐    │
│    │         发送中…                   │    │  ← disabled + loading
│    └──────────────────────────────────┘    │
```

#### code — 输入 6 位验证码

```
│                                            │
│    验证码已发送至 your@email.com            │  ← 提示文字
│                                            │
│    ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐        │
│    │ 1│ │ 2│ │ 3│ │ 4│ │ 5│ │ 6│        │  ← 6 个独立数字输入框
│    └──┘ └──┘ └──┘ └──┘ └──┘ └──┘        │    自动跳转焦点，满 6 位自动提交
│                                            │
│    没有收到？重新发送（45s）                 │  ← 倒计时中 disabled
│    没有收到？重新发送                       │  ← 倒计时结束后可点击
│                                            │
│    换个邮箱                                 │  ← 返回 idle 态
```

**关键交互**：
- 6 个独立 input，每个 `maxLength={1}`，`type="text"`，`inputMode="numeric"`，`pattern="[0-9]"`
- 输入一个数字后自动 focus 下一个
- Backspace 清空当前框后自动 focus 上一个
- 满 6 位自动调用 `onVerifyOtp(email, token)`
- 支持粘贴 6 位数字（粘贴到第一个框时自动分发到 6 个框）

#### verifying — 验证中

```
│    ┌──────────────────────────────────┐    │
│    │         验证中…                   │    │  ← disabled + loading
│    └──────────────────────────────────┘    │
```

#### error — 验证失败

```
│                                            │
│    ⚠️ 验证码错误，请重新输入。              │  ← 红色错误提示
│                                            │
│    验证码输入框保留，用户可修改后重新自动提交 │
```

### 6.5 密码登录 UI（Tab 2）

```
┌────────────────────────────────────────────┐
│                                            │
│    验证码登录    |    [密码登录]             │  ← Tab 切换
│                       ———————————          │
│                                            │
│    ┌──────────────────────────────────┐    │
│    │  your@email.com                  │    │
│    └──────────────────────────────────┘    │
│    ┌──────────────────────────────────┐    │
│    │  密码（至少 6 位）                │    │  ← type="password"
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
- 去掉了密码显示/隐藏切换（保留但默认隐藏）
- 去掉了注册 Tab（不再展示注册入口）
- 底部提示改为"没有密码？切换到「验证码登录」"

### 6.6 设置密码引导 UI

验证码登录成功或密码登录成功后，如果 `password_set !== true`，AuthModal 关闭后弹出引导：

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
│    │         保存密码                  │    │  ← 主按钮（突出样式）
│    └──────────────────────────────────┘    │
│                                            │
│           稍后再说                          │  ← 文字链接（弱化样式）
│                                            │
└────────────────────────────────────────────┘
```

**设计细节**：

| 元素 | 设计 |
|------|------|
| 引导浮层 | 独立于 AuthModal 的新组件 `SetPasswordPrompt`（或 AuthModal 的第三个视图）|
| 出现时机 | AuthModal 因登录成功而关闭后，由父组件检查 `needsPasswordSetup` 并弹出 |
| "稍后再说" | 关闭引导，正常使用 App。下次登录后再次弹出引导 |
| "保存密码" | 调用 `onSetPassword(password)`，成功后关闭引导 |
| 密码校验 | 前端 ≥6 位 + 确认密码一致性 |
| 成功后 | `user.metadata.password_set` 变为 true，下次登录不再弹出 |

**为什么引导浮层不是 AuthModal 的子视图**：

AuthModal 在登录成功后自动关闭（`isAuthenticated` 变化 → `useEffect` → `onClose()`）。设置密码引导需要在 AuthModal 关闭**之后**弹出，因此建议：

- **方案 A**：在 `page.tsx` 或 `Header.tsx` 中判断 `needsPasswordSetup`，渲染独立的 `SetPasswordPrompt` 组件
- **方案 B**：AuthModal 内部延迟关闭——登录成功后不立即 `onClose()`，而是先检查 password_set，如需引导则显示引导（引导完成后再关闭）——但这会改变现有 `useEffect` 逻辑

**推荐方案 A** — 最小改动，不改变 AuthModal 现有的"登录成功自动关闭"行为。

**Header.tsx 中的集成逻辑**：

```typescript
const { user, isLoading, sendOtp, verifyOtp, signInWithPassword, setPassword, signOut } = useAuth();
const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
const [showSetPasswordPrompt, setShowSetPasswordPrompt] = useState(false);

// 监听 user 变化：登录成功后检查是否需要提示设置密码
useEffect(() => {
  if (user && !user.metadata?.password_set) {
    setShowSetPasswordPrompt(true);
  }
}, [user]);
```

### 6.7 手机端优先

| 元素 | 做法 |
|------|------|
| 遮罩层 | `fixed inset-0 px-4 py-6` — 保留左右留白 |
| 弹窗宽度 | `max-w-sm w-full` — 375-414px 不溢出 |
| 输入框 | `min-h-12` — 44px 最小触控目标 |
| 验证码输入框 | 6 个，每个约 44px 宽，`text-lg` 字号 |
| 按钮 | `min-h-12` — 同上 |
| Tab 切换 | 内联按钮 + 底部下划线指示器（保留 V2.1 样式） |
| 键盘类型 | 邮箱输入框 `type="email"`；验证码输入框 `inputMode="numeric"`；密码输入框 `type="password"` |

### 6.8 错误码映射（新增 OTP 相关）

| Supabase Error | 中文提示 |
|----------------|---------|
| `Invalid login credentials` | 邮箱或密码错误，请重试。 |
| `User already registered` | 该邮箱已注册，请直接登录。 |
| `Password should be at least 6 characters` | 密码至少需要 6 位。 |
| `Unable to validate email address: invalid format` | 邮箱格式不正确。 |
| `Email not confirmed` | 邮箱尚未确认，请先点击确认邮件中的链接。 |
| `Token has expired or is invalid` | 验证码错误或已过期，请重新获取。 |
| `Email rate limit exceeded` | 操作过于频繁，请稍后再试。 |
| `For security purposes, you can only request this after...` | 请等待 %d 秒后再试。 |

保留现有 `getSafeErrorMessage` 函数，增加 OTP 相关错误映射。

---

## 七、Header 适配

### 7.1 当前 Header（V2.1）

```typescript
const { user, isLoading, signIn, signUp, signOut } = useAuth();
// ...
<AuthModal
  isAuthenticated={Boolean(user)}
  isOpen={isAuthModalOpen}
  onClose={() => setIsAuthModalOpen(false)}
  onSignIn={signIn}
  onSignUp={signUp}
/>
```

### 7.2 V2.1B Header 变更

```typescript
const {
  user, isLoading,
  sendOtp, verifyOtp, signInWithPassword, setPassword,
  signOut,
} = useAuth();

const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
const [showSetPasswordPrompt, setShowSetPasswordPrompt] = useState(false);

// 登录成功后检查是否需要设置密码引导
useEffect(() => {
  if (user && !user.metadata?.password_set) {
    setShowSetPasswordPrompt(true);
  }
}, [user]);

// ...

<AuthModal
  isAuthenticated={Boolean(user)}
  isOpen={isAuthModalOpen}
  onClose={() => setIsAuthModalOpen(false)}
  onSendOtp={sendOtp}
  onVerifyOtp={verifyOtp}
  onSignInWithPassword={signInWithPassword}
  onSetPassword={setPassword}
  user={user}
/>

{showSetPasswordPrompt && (
  <SetPasswordPrompt
    onSetPassword={async (password) => {
      await setPassword(password);
      setShowSetPasswordPrompt(false);
    }}
    onSkip={() => setShowSetPasswordPrompt(false)}
  />
)}
```

### 7.3 改动量

| 项目 | 说明 |
|------|------|
| useAuth 解构 | 约 2 行（方法名变化 + 新增方法） |
| AuthModal props | 约 5 行（props 名和数量变化） |
| SetPasswordPrompt | 约 5 行（条件渲染） |
| 其他（邮箱展示/登出按钮/历史按钮） | **不变** |

### 7.4 是否仍显示用户 email

**是，不变。** Header 中 `user.email` 展示逻辑与 V2.1 完全相同。

---

## 八、callback route 处理

### 8.1 当前 callback route（V2.1）

`src/app/auth/callback/route.ts` — 86 行，处理 `token_hash` + `type=email` 的邮箱确认回调。

```typescript
function getOtpType(type: string | null): EmailOtpType | null {
  if (type === "email") return "email";
  return null;
}
```

### 8.2 V2.1B 决策：保留不动

| 决策 | 理由 |
|------|------|
| **保留 callback route** | 旧 V2.1 注册用户的确认链接仍需要它 |
| **不修改代码** | 当前逻辑已正确：只接受 `type=email` |
| **OTP 主流程不依赖它** | `verifyOtp({ email, token, type: "email" })` 是纯客户端调用 |

### 8.3 不做的事

| 不做 | 原因 |
|------|------|
| 不在 callback route 中处理 OTP 验证码 | OTP 是客户端 verifyOtp，不需要 callback |
| 不删除 callback route | 旧确认链接 + 未来 reset password（V2.3）需要 |
| 不新增 `type=signup` 支持 | 确认链接始终使用 `type=email` |
| 不调整 callback 支持 reset password | 属于 V2.3，不在 V2.1B 范围 |

### 8.4 未来扩展（V2.3）

当 V2.3 引入忘记密码时，callback route 可能需要扩展以支持 `type=recovery`。届时在 `getOtpType` 中增加 `"recovery"` 即可。当前不动。

---

## 九、数据兼容性

### 9.1 匿名任务迁移

**完全不受影响。**

迁移触发条件：`user.id` 从 `null` 变为一个 UUID。无论通过 OTP 验证码还是密码登录，登录成功后 `user.id` 都是同一个 Supabase Auth UUID。

- `useTaskGroup.restoreForAuthUser()` — 不变
- `POST /api/task-group/migrate` — 不变
- `getAuthenticatedUserId()` — 不变

### 9.2 useTaskGroup

**不需要修改。** 迁移逻辑依赖 `user.id` 存在，与登录方式无关。

### 9.3 Phase 14 AI 复盘

**不受影响。** `POST /api/task-groups/review` 依赖 `getAuthenticatedUserId()`，返回值与登录方式无关。

### 9.4 Phase 15 智能任务调整

**不受影响。** `POST /api/generate-tasks` 中 `getAuthenticatedUserId()` 返回值不变，`computeAdjustment(stats)` 逻辑不变。

### 9.5 API session-aware 规则

**完全不变。** 所有 8 个 API Route 的 `getAuthenticatedUserId()` 调用逻辑零改动。

### 9.6 getAuthenticatedUserId()

**不变。** 返回 `user.id`（Supabase Auth UUID），与登录方式无关。

### 9.7 前端仍不传 userId

**不变。** 安全规则不变——userId 只来自服务端 session。

### 9.8 types.ts — AuthUser 扩展

唯一需要修改的类型文件：

```typescript
// 新增 metadata 字段
interface AuthUser {
  id: string;
  email: string | null;
  metadata?: {
    password_set?: boolean;
  };
}
```

`types.ts` 属于高风险文件。此修改是架构必需的——useAuth 和 AuthModal 需要读取 `password_set` 来判断是否弹出设置密码引导。

**修改边界声明**：`src/lib/types.ts` 的修改**仅限于** `AuthUser` 类型增加用于读取 `user_metadata.password_set` 的 `metadata` 字段；**不得修改** `Task`、`TaskGroup`、API 响应结构、任务业务类型或任何任务相关类型。该改动只服务于 Auth UI 判断是否展示设置密码引导，不参与任务保存、历史、统计、AI 复盘或智能任务调整的数据结构。

---

## 十、Supabase Dashboard 配置

### 10.1 新增配置：Magic Link / OTP 邮件模板

V2.1B 需要编辑 **Magic Link** 邮件模板（不是 Confirm signup 模板）：

**位置**：Supabase Dashboard → Authentication → Email Templates → **Magic Link**

**邮件主题**：

```
AI Todo 登录验证码
```

**邮件正文（HTML）**：

```html
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a2e;">

  <h2 style="color: #4f46e5; margin-bottom: 16px;">AI Todo</h2>

  <p style="font-size: 16px; line-height: 1.6;">你好，</p>

  <p style="font-size: 16px; line-height: 1.6;">
    你的登录验证码是：
  </p>

  <div style="text-align: center; margin: 32px 0;">
    <span style="display: inline-block; padding: 16px 32px; background-color: #f3f4f6; color: #4f46e5; font-size: 32px; font-weight: 700; letter-spacing: 8px; border-radius: 12px; font-family: 'Courier New', monospace;">
      {{ .Token }}
    </span>
  </div>

  <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
    请在 10 分钟内输入此验证码完成登录。验证码仅限本人使用，请勿转发给他人。
  </p>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

  <p style="font-size: 12px; color: #9ca3af; line-height: 1.5;">
    如果你没有请求此验证码，请忽略此邮件。<br/>
    此邮件由 AI Todo 自动发送，请勿回复。
  </p>

</body>
</html>
```

### 10.2 模板关键变量

| 变量 | 说明 | 示例值 |
|------|------|--------|
| `{{ .Token }}` | 6 位数字验证码 | `482931` |
| `{{ .SiteURL }}` | 站点 URL（Dashboard 配置） | `https://ai-todo-kappa-drab.vercel.app` |

> ⚠️ **绝对不使用**：
> - `{{ .ConfirmationURL }}` — 这是确认链接，不是验证码
> - `{{ .TokenHash }}` — 这是 hash 后的 token，用于确认链接（`/auth/callback?token_hash=...`），不是 6 位数字验证码
>
> Magic Link 模板中**只需要 `{{ .Token }}`**。Supabase 会自动将 6 位数字验证码填入 `{{ .Token }}` 占位符。

### 10.3 已有配置（不变）

| 配置项 | 当前值 | 是否改动 |
|--------|:---:|:---:|
| SMTP（阿里云邮件推送） | 已配置 | ❌ 不动 |
| Confirm signup 邮件模板 | 中文 + `type=email` | ❌ 不动（旧兼容） |
| Site URL | Vercel 域名 | ❌ 不动 |
| Redirect URLs | 生产域名 + localhost | ❌ 不动 |
| Confirm email | ON | ❌ 不动 |
| Allow unconfirmed sign in | OFF | ❌ 不动 |
| Allow new users to sign up | ON | ❌ 不动 |

**关于 Confirm email 和 Allow unconfirmed sign in 对 OTP 流程的影响**：

- **`Confirm email = ON`** — 建议保持开启。此开关控制 Supabase Auth 是否要求用户确认邮箱后才允许登录。
- **`Allow unconfirmed email sign in = OFF`** — 建议保持关闭。此开关控制是否允许未验证邮箱的用户直接绕过邮箱验证登录。
- **这两个开关不影响 OTP 主流程。** 原因：OTP 主流程通过 `verifyOtp({ email, token, type: "email" })` 校验 6 位验证码，验证码本身就已证明用户拥有该邮箱。一旦验证通过，Supabase 会为已验证邮箱建立 session，该 session 不依赖 Confirm signup 链接。
- `Allow unconfirmed email sign in = OFF` 不会阻断正确输入验证码的用户登录；它只阻止未验证邮箱的用户绕过验证直接登录。
- Confirm signup 链接仍保留用于旧 V2.1 邮箱密码注册链路的兼容（Confirm signup 邮件模板不动），但不参与 V2.1B 的 OTP 主流程——新用户通过 OTP 验证码自动创建账号后，邮箱已在 OTP 验证环节完成"所有权证明"，无需额外点击 Confirm signup 链接。

### 10.4 OTP 相关建议配置

| 配置项 | 建议值 | 说明 |
|--------|:---:|------|
| **OTP 过期时间** | 10 分钟（600s） | 平衡安全性和用户体验。Supabase 默认 3600s，建议在 Supabase Dashboard → Authentication → Settings 中找到 OTP Expiry / Email OTP Expiration 设置项（具体字段名以 Supabase Dashboard 当前界面为准），手动改为 600s |
| **重发间隔** | 60 秒（前端控制，不是 Supabase 配置） | 防止滥用，60s 足够用户收邮件+输入 |
| **OTP 长度** | 6 位数字（Supabase 默认） | 安全且易输入 |

> **说明**：OTP 过期时间（600s）是**建议配置**，不是本阶段的代码依赖。如果 Supabase Dashboard 中暂时无法找到或调整此设置项，不阻塞架构设计和代码实现，但实现验收时应记录实际值，确认是否符合 10 分钟预期。

---

## 十一、允许修改文件清单

按最小改动原则：

| # | 文件 | 操作 | 预计行数 | 说明 |
|---|------|:---:|:---:|------|
| 1 | `src/hooks/useAuth.ts` | **修改** | ~120 行（改） | 新增 sendOtp/verifyOtp/setPassword；signIn 重命名；保留 signUp；扩展 toAuthUser |
| 2 | `src/components/AuthModal.tsx` | **重写** | ~350 行（新） | 双模式（验证码/密码）；6 位验证码输入；状态机；移除注册 Tab |
| 3 | `src/components/Header.tsx` | **修改** | ~20 行（改） | useAuth 接口适配 + AuthModal props 变更 + SetPasswordPrompt 条件渲染 |
| 4 | `src/components/SetPasswordPrompt.tsx` | **新增** | ~80 行 | 设置密码引导浮层（新组件） |
| 5 | `src/lib/constants.ts` | **修改** | ~40 行（改） | AUTH_TEXT 新增 OTP 相关文案 |
| 6 | `src/lib/types.ts` | **修改** | ~6 行（改） | AuthUser 增加 metadata 字段 |

**总计：6 个文件（5 改 + 1 新增），约 616 行变更。**

### 关于 SetPasswordPrompt 为什么需要新增

SetPasswordPrompt 是一个独立于 AuthModal 的浮层组件，出现时机是 AuthModal **关闭之后**。原因：

1. **AuthModal 在登录成功后自动关闭** — V2.1 的 isAuthenticated 监听逻辑不变
2. **设置密码引导不应阻塞登录** — 用户已经登录成功，引导是"建议"而非"要求"
3. **独立组件更简单** — 如果集成到 AuthModal 中，需要改变"登录成功自动关闭"的行为，增加状态机复杂度

SetPasswordPrompt 的职责简单：密码输入 + 确认密码 + 保存 + 稍后再说。约 80 行。

---

## 十二、禁止修改文件清单

以下文件 **V2.1B 完全不动**：

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

# callback route — 保留不动
src/app/auth/callback/route.ts

# 配置
package.json
.env.local
数据库 schema / migration
```

---

## 十三、验收标准

### 13.1 配置验收

| # | 验收项 | 方法 |
|---|--------|------|
| 1 | Magic Link 邮件模板已编辑为中文验证码格式 | Supabase Dashboard → Email Templates → Magic Link 显示自定义内容 |
| 2 | 模板使用 `{{ .Token }}`（不是 ConfirmationURL / TokenHash） | 检查模板 HTML |
| 3 | SMTP（阿里云邮件推送）保持配置不动 | Dashboard 确认 |

### 13.2 功能验收 — 验证码登录

| # | 验收项 | 预期结果 |
|---|--------|---------|
| 4 | 输入邮箱 → 发送验证码 → 收到邮件 | 收到中文验证码邮件，邮件中包含 6 位数字验证码 |
| 5 | 新邮箱输入正确验证码 → 自动创建账号 + 登录 | 登录成功，Header 显示邮箱 |
| 6 | 老邮箱输入正确验证码 → 直接登录 | 登录成功，Header 显示邮箱 |
| 7 | 输入错误验证码 → 提示错误 | 显示"验证码错误或已过期，请重新获取。" |
| 8 | 验证码输入满 6 位 → 自动提交 | 不需要点击按钮，自动调用 verifyOtp |
| 9 | 重发倒计时 | 发送后重发按钮显示倒计时（60s→0），期间 disabled |
| 10 | 倒计时结束后可重新发送 | 按钮恢复可点击，点击后重新发送 |

### 13.3 功能验收 — 密码登录

| # | 验收项 | 预期结果 |
|---|--------|---------|
| 11 | 切换到密码登录 Tab | 显示邮箱+密码输入框 |
| 12 | 已设密码用户 → 邮箱+密码登录成功 | 登录成功，Header 显示邮箱 |
| 13 | 密码错误 → 提示错误 | 显示"邮箱或密码错误，请重试。" |
| 14 | 旧 V2.1 密码用户 → 密码登录成功 | 登录成功；user_metadata.password_set 自动补写为 true |
| 15 | 未设密码用户 → 切换到密码登录 | 可以尝试登录（但因为没密码，会提示错误） |

### 13.4 功能验收 — 设置密码引导

| # | 验收项 | 预期结果 |
|---|--------|---------|
| 16 | 验证码登录成功后，如果 password_set ≠ true | 弹出设置密码引导浮层 |
| 17 | 密码登录成功后，如果 password_set ≠ true | 同上（仅旧 V2.1 用户首次登录时会触发补写，补写后不再触发） |
| 18 | 设置密码引导 → 输入密码 + 确认密码 → 保存 | 提示成功，引导关闭，user_metadata.password_set = true |
| 19 | 设置密码引导 → 密码 < 6 位 → 保存 | 前端拦截，显示"密码至少需要 6 位。" |
| 20 | 设置密码引导 → 确认密码不一致 → 保存 | 前端拦截，显示"两次输入的密码不一致。" |
| 21 | 设置密码引导 → 点击"稍后再说" | 引导关闭，正常进入 App，password_set 仍为 false |
| 22 | 设置密码后 → 下次登录不再弹出引导 | password_set = true，直接进入 App |
| 23 | 稍后再说后 → 下次登录再次弹出引导 | password_set 仍为 false，再次弹出 |

### 13.5 功能验收 — 通用

| # | 验收项 | 预期结果 |
|---|--------|---------|
| 24 | 登录后刷新保持登录 | F5 刷新 → 仍显示已登录 |
| 25 | 登出正常 | 点击登出 → Header 恢复"登录"按钮 → 回退匿名模式 |
| 26 | AuthModal 默认 Tab 是验证码登录 | 打开 AuthModal → 默认选中"验证码登录" |
| 27 | Tab 切换清空输入 | 切换 Tab → 邮箱/密码/验证码输入清空 |

### 13.6 兼容验收

| # | 验收项 | 预期结果 |
|---|--------|---------|
| 28 | 未登录匿名模式正常 | 不登录 → 输入目标 → 生成任务 |
| 29 | 匿名任务登录后迁移正常 | 匿名创建任务 → 登录 → 任务保留且绑定到 user_id |
| 30 | Phase 14 AI 复盘不受影响 | 登录 → 生成复盘 → 正常 |
| 31 | Phase 15 智能调整不受影响 | 登录 → 生成任务 → stats 积累 → 调整建议正常 |
| 32 | `getAuthenticatedUserId()` 不变 | API Route 中 userId 来自 session |
| 33 | 前端请求体不含 userId | DevTools Network 确认 |
| 34 | 旧 V2.1 密码用户可继续使用 | 密码登录 → 成功 → metadata 补写 |

### 13.7 安全验收

| # | 验收项 | 方法 |
|---|--------|------|
| 35 | 验证码频率限制正常 | 短时间内多次发送验证码 → 报 rate limit |
| 36 | 密码不经过 Next.js 服务端 | DevTools Network → /api/* 不含 password |
| 37 | Service Role Key 不出现在前端 | DevTools Sources 搜索 |
| 38 | 登出后 API 不能访问 user_id 数据 | 登出 → 回退 device_id |

### 13.8 门禁验收

| # | 验收项 | 命令 |
|---|--------|------|
| 39 | TypeScript 编译通过 | `npm run lint` |
| 40 | Next.js 构建通过 | `npm run build` |
| 41 | `git status --short` 仅显示允许修改的文件 | 手动检查 |

---

## 十四、风险与回滚

### 14.1 风险矩阵

| # | 风险 | 等级 | 影响 | 缓解措施 |
|---|------|:---:|------|---------|
| 1 | OTP 邮件送达失败 | **P1** | 用户收不到验证码，无法登录 | SMTP 已在 V2.1-Follow-up 中验证稳定（阿里云邮件推送）；提供密码登录作为备选（已设密码的用户不受影响） |
| 2 | 用户不设置密码 | **P2** | 回头客每次等验证码，体验差 | 每次登录后都弹出引导（直到设置密码）；引导文案强调"下次更快登录" |
| 3 | 邮箱枚举风险 | **P2** | 攻击者可通过"发送验证码"探测邮箱是否注册 | `signInWithOtp({ shouldCreateUser: true })` 对已注册和未注册邮箱行为一致（都发邮件）。前端提示统一："验证码已发送（如邮箱已注册）"。Supabase 返回的 error 不做区分 |
| 4 | `user_metadata.password_set` 不准 | **P2** | 已设密码的用户仍被提示设置密码 | metadata 由 Supabase Auth 直接管理；密码登录时自动补写；设置密码引导允许"稍后再说"——最坏情况是用户多看到一次引导，不影响功能 |
| 5 | 旧 V2.1 密码用户 metadata 缺失 | **P2** | 旧用户密码登录后弹出设置密码引导 | 密码登录时自动补写 `password_set: true`（静默，不阻塞登录）；补写成功后下次不再弹出 |
| 6 | 验证码频率限制 | **P2** | 用户短时间内多次请求验证码被限流 | 前端重发倒计时 60s；Supabase 默认 rate limit 已内置保护 |
| 7 | OTP 模板误用 `{{ .ConfirmationURL }}` | **P1** | 发送的是链接而非 6 位验证码，用户无法登录 | 必须在 Magic Link 模板中使用 `{{ .Token }}`；禁止使用 `{{ .ConfirmationURL }}`；配置后立即测试完整链路 |
| 8 | AuthModal 状态机复杂度增加 | **P2** | UI bug（状态切换时残留错误提示/输入内容） | 每个 Tab 切换时清空状态；验证码各个 phase 有独立渲染分支 |
| 9 | types.ts 修改引入类型错误 | **P2** | 编译失败 | `npm run lint` 作为门禁；AuthUser 增加 optional metadata 字段向后兼容 |

### 14.2 回滚方案

如果混合方案出现严重问题（如 OTP 邮件大面积送达失败），回滚到纯 Email+Password：

#### 回滚步骤

1. **前端回滚**：
   - 恢复 AuthModal 为 V2.1 版本（登录/注册双 Tab）
   - 恢复 useAuth 为 V2.1 版本（signIn/signUp/signOut）
   - 删除 SetPasswordPrompt 组件
   - 恢复 constants.ts 中的 AUTH_TEXT
   - 恢复 types.ts 中的 AuthUser 类型

2. **Supabase 配置回滚**：
   - Magic Link 邮件模板不需要回滚（V2.1 不使用 Magic Link 模板，仅 Confirm signup 模板参与流程）
   - SMTP 配置不动（阿里云邮件推送继续用于 Confirm signup 邮件）

3. **数据回滚**：
   - `user_metadata.password_set` 字段不删除（不影响 V2.1 功能，保留即可）
   - 数据库无变更，无需回滚

#### 回滚后状态

- 回到 V2.1 的 Email+Password 注册/登录
- 已通过 OTP 设置密码的用户，metadata 中有 `password_set: true`，但 V2.1 不使用此字段，无影响
- 已通过 OTP 创建但未设密码的用户，仍可通过 OTP 重新登录（因为他们的 Supabase Auth 账号已存在），但 V2.1 AuthModal 不支持 OTP → 这些用户需用"忘记密码"重置密码（V2.3 功能）或等待 V2.1B 重新上线

#### 回滚成本

| 项目 | 说明 |
|------|------|
| 代码回滚 | `git revert` 一个 commit |
| 配置回滚 | 无需操作（SMTP/模板保持不动） |
| 数据回滚 | 无需操作 |
| 用户影响 | 仅影响 V2.1B 上线后通过 OTP 登录且未设密码的用户（预计极少） |

---

> **文档结束**
>
> **下一文档**：本文档经 ChatGPT 审查通过后 → `docs/Execution-Plan-V2.1B-OTP-Password.md`（V2.1B 执行方案）
>
> **关联文档**：
> - [Architecture-V2.1-Auth.md](Architecture-V2.1-Auth.md) — V2.1 Auth 架构方案（✅ 已完成）
> - [Execution-Plan-V2.1-Auth.md](Execution-Plan-V2.1-Auth.md) — V2.1 Auth 执行方案（✅ 已完成）
> - [Architecture-V2.1-Follow-up-SMTP.md](Architecture-V2.1-Follow-up-SMTP.md) — V2.1-Follow-up SMTP 架构方案（✅ 已完成）
> - [Execution-Plan-V2.1-Follow-up-SMTP.md](Execution-Plan-V2.1-Follow-up-SMTP.md) — V2.1-Follow-up SMTP 执行方案（✅ 已完成）
> - [Roadmap-V2.1-V2.3.md](Roadmap-V2.1-V2.3.md) — V2.1-V2.3 路线图
> - [PROJECT-CONTEXT.md](PROJECT-CONTEXT.md) — 项目长期上下文
> - [PROJECT-INDEX.md](PROJECT-INDEX.md) — 项目文件索引
