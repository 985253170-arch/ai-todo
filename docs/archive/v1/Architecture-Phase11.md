# Phase 11：登录注册与多设备同步 — 技术架构方案

> **状态**：设计阶段，待 Review 通过后开发
> **依赖**：Phase 10（V1.3）完整通过
> **对应 PRD**：AI Todo PRD V1.0
> **设计日期**：2026-06-29

---

## 目录

- [一、Phase 11 总体目标](#一phase-11-总体目标)
- [二、账号体系设计](#二账号体系设计)
- [三、数据库迁移设计](#三数据库迁移设计)
- [四、RLS 权限设计](#四rls-权限设计)
- [五、登录状态与前端架构](#五登录状态与前端架构)
- [六、同步策略升级](#六同步策略升级)
- [七、device_id → user_id 迁移](#七device_id--user_id-迁移)
- [八、API Route 设计](#八api-route-设计)
- [九、环境变量设计](#九环境变量设计)
- [十、UI / UX 设计](#十ui--ux-设计)
- [十一、文件结构设计](#十一文件结构设计)
- [十二、Phase 11 开发拆分](#十二phase-11-开发拆分)
- [十三、错误处理方案](#十三错误处理方案)
- [十四、安全边界](#十四安全边界)
- [十五、验收标准](#十五验收标准)
- [十六、风险点](#十六风险点)

---

## 一、Phase 11 总体目标

### 1.1 为什么需要登录注册

Phase 10 的 device_id 方案解决了「清缓存数据丢失」和「单设备云端备份」问题，但存在三个结构性限制：

| 限制 | 场景 | 用户痛点 |
|------|------|---------|
| **无法跨设备** | 电脑生成任务 → 手机上查看 | 用户带着手机出门，打开 AI Todo 是空的 |
| **设备间数据不互通** | 同一台电脑 Chrome ↔ Edge | 换个浏览器就要重新生成任务 |
| **device_id 无法找回** | 清除站点数据 → 新 device_id → 旧数据成孤儿 | 数据库里堆积无人认领的数据 |

Phase 11 引入 **Supabase Auth 邮箱登录**，将数据归属从「设备级（device_id）」升级为「账号级（user_id）」，实现真正的多设备同步。

### 1.2 Phase 10 device_id 方案的局限

```
Chrome (device_id: A)         Safari (device_id: B)        手机浏览器 (device_id: C)
     │                              │                              │
     └── 云端数据 A ────────────────┤── 云端数据 B ────────────────┘── 云端数据 C
                                    各自一片孤岛
```

每个设备各存各的，三份数据互不相通。

### 1.3 Phase 11 要解决什么

```
登录 user_id: abc-123
     │
     ├── Chrome ──────┐
     ├── Safari ──────┼── 同一份云端数据
     └── 手机浏览器 ──┘
```

| 功能 | 说明 |
|------|------|
| ✅ 邮箱验证码登录 | 无需密码，输入邮箱 + 6 位验证码即可登录 |
| ✅ 登出 | 退出登录后回到本地模式，数据不丢失 |
| ✅ 多设备同步 | 电脑生成任务，手机登录同一账号即可恢复 |
| ✅ 跨设备勾选同步 | 手机勾选任务，电脑刷新后看到更新 |
| ✅ device_id 迁移 | 登录时将当前设备的任务绑定到账号 |
| ✅ 未登录可用 | 不登录也能生成任务、勾选、本地保存——Phase 10 全部功能保留 |

### 1.4 Phase 11 不做什么

| 不做 | 原因 |
|------|------|
| ❌ 邮箱密码登录 | 增加密码管理负担，验证码更轻量 |
| ❌ 第三方登录（Google/GitHub/微信） | 需要额外 OAuth 配置，Phase 12+ 再考虑 |
| ❌ 用户头像/个人资料 | 最小账号系统，仅 email + user_id |
| ❌ 历史记录/版本管理 | 保持单 taskGroup 模型 |
| ❌ 多人协作/分享 | 不在产品路线图中 |
| ❌ 实时同步（WebSocket） | 手动刷新或操作时同步即可，不引入 Supabase Realtime |
| ❌ 离线队列/同步冲突解决 UI | 采用「最新 updated_at 优先」自动策略，不弹窗询问用户 |

### 1.5 登录后如何实现电脑 / 手机同步

```
┌──────────────────────────────────────────────────────────────┐
│  电脑 Chrome                  手机 Safari                     │
│  ┌──────────────┐            ┌──────────────┐               │
│  │ React State  │            │ React State  │               │
│  │ localStorage │            │ localStorage │               │
│  └──────┬───────┘            └──────┬───────┘               │
│         │ 异步保存                   │ 异步保存               │
│         ▼                           ▼                        │
│  ┌──────────────────────────────────────────┐               │
│  │        POST /api/task-group/save          │               │
│  │        body: { deviceId, taskGroup }      │               │
│  │        (userId 由服务端从 session 获取)     │               │
│  └──────────────────┬───────────────────────┘               │
│                     │                                        │
│                     ▼                                        │
│          ┌──────────────────┐                               │
│          │    Supabase       │                               │
│          │  task_groups      │                               │
│          │  ├── user_id      │  ← 同一 user_id               │
│          │  ├── goal         │                               │
│          │  └── updated_at   │                               │
│          │  tasks             │                               │
│          │  ├── task_group_id│                               │
│          │  └── completed    │                               │
│          └──────────────────┘                               │
│                     │                                        │
│         ┌───────────┴───────────┐                           │
│         ▼                       ▼                            │
│  手机打开 AI Todo          手机刷新后                          │
│  → GET load?deviceId=xxx   → 看到电脑生成的                    │
│  → 服务端按 session         任务和勾选状态                       │
│     user_id 查询                                              │
└──────────────────────────────────────────────────────────────┘
```

**核心流程**：
1. 两台设备登录同一账号 → 共享同一个 `user_id`
2. 任何设备上的生成/勾选/清空 → 异步写入云端同一 `user_id` 下的记录
3. 另一台设备打开/刷新页面 → 本地无数据时从云端拉取最新数据
4. 勾选状态变化 → 云端 updated_at 更新 → 另一设备看到最新状态

---

## 二、账号体系设计

### 2.1 Supabase Auth 是否合适

| 评估维度 | 结论 |
|---------|------|
| **集成难度** | 低——已使用 Supabase PostgreSQL，Auth 是同平台原生功能 |
| **免费额度** | Supabase Free Tier：50,000 MAU、无限社交登录、每月 50 封自定义邮件 |
| **JS SDK 成熟度** | 高——`@supabase/supabase-js` 已安装，`@supabase/ssr` 生态成熟 |
| **Next.js App Router 兼容** | `@supabase/ssr` 提供 `createServerClient` + `createBrowserClient`，完美适配 |
| **中文用户适配** | 中——邮件验证码对国内用户门槛略高，但比密码登录门槛低；后续可扩展短信登录 |

**结论：Supabase Auth 是当前最优解。** Phase 10 已使用 Supabase 数据库，无需额外注册第三方 Auth 服务。

### 2.2 支持的登录方式

| 方式 | Supabase 支持 | 实现难度 | 用户体验 | 推荐 |
|------|:---:|:---:|------|:---:|
| **邮箱验证码（OTP）** | ✅ 原生 | 低 | 输入邮箱 → 收验证码 → 输入 6 位数字 → 登录 | ✅ **主推** |
| **Magic Link** | ✅ 原生 | 低 | 输入邮箱 → 收邮件 → 点击链接 → 跳转回 App | 备选 |
| **邮箱 + 密码** | ✅ 原生 | 中（需注册/登录/找回页） | 设置密码 → 每次输入密码 | 暂缓 |
| **GitHub OAuth** | ✅ 原生 | 中（需注册 OAuth App） | 点击 → GitHub 授权 → 跳转回 App | 暂缓 |
| **Google OAuth** | ✅ 原生 | 中（需 GCP 配置） | 点击 → Google 授权 → 跳转回 App | 暂缓 |
| **微信扫码** | ❌ 需第三方 | 高 | 扫码登录 | 暂缓 |

### 2.3 对当前小项目最推荐：邮箱 OTP（6 位数字验证码）

**理由**：
1. **零密码管理**：用户无需创建/记忆/找回密码，降低 80% 的账号管理摩擦
2. **体验简洁**：输入邮箱 → 输入验证码 → 登录成功，两步完成，心智负担极低
3. **实现最简单**：Supabase `signInWithOtp()` 一行代码，自定义邮件模板即可
4. **本地开发零配置**：Supabase 开发模式下验证码输出到 Dashboard 日志，不需要真实 SMTP
5. **生产环境可控**：配置 Supabase 自定义 SMTP 或使用内置邮件服务即可

**Magic Link vs OTP 选择**：
- Magic Link 在手机上体验差（需要切换到邮箱 App）
- OTP 数字验证码在手机上可被键盘自动填充（iOS/macOS 均已支持）
- **推荐 OTP 作为默认方式**，Magic Link 作为备选（邮件中同时包含链接和验证码）

### 2.4 是否需要注册页

**不需要独立的注册页。** 邮箱 OTP 天然统一了注册和登录——用户输入邮箱，Supabase 自动判断：
- 邮箱已注册 → 发送验证码，用户输入后登录
- 邮箱未注册 → 自动创建用户 + 发送验证码，用户输入后登录

这称为**无感注册（Passwordless Sign-up = Sign-in）**，用户心智模型仅：「输入邮箱 → 输入验证码 → 进去了」。

### 2.5 是否需要登录页

**不需要独立登录页。** 使用**登录弹窗（AuthModal）**——从 Header 点击触发，不打断用户当前浏览状态。详见[第十章 UI/UX 设计](#十ui--ux-设计)。

### 2.6 是否需要用户头像 / 个人资料

**不需要。** Phase 11 只做最小账号系统：
- 用户标识：显示邮箱前缀（如 `user@example.com` → 「user」）
- 无头像上传、无昵称设置、无个人资料编辑
- Phase 12+ 可扩展

### 2.7 Phase 11：最小账号系统

| 有 | 没有 |
|----|------|
| 邮箱 OTP 登录 | 密码登录 |
| 登出 | 注册页 |
| Header 显示登录状态 | 头像/昵称 |
| 登录弹窗 | 密码找回 |
| Session 持久化 | OAuth 第三方登录 |
| user_id 数据绑定 | 账号删除 |

---

## 三、数据库迁移设计

### 3.1 当前表结构（Phase 10）

```sql
-- task_groups
CREATE TABLE task_groups (
  id         TEXT PRIMARY KEY,
  device_id  TEXT NOT NULL,
  goal       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_task_groups_device_id ON task_groups(device_id);

-- tasks
CREATE TABLE tasks (
  id            TEXT NOT NULL,
  task_group_id TEXT NOT NULL REFERENCES task_groups(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  completed     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, task_group_id)
);
CREATE INDEX idx_tasks_task_group_id ON tasks(task_group_id);
```

### 3.2 迁移方案

#### 3.2.1 task_groups 新增 user_id

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `user_id` | `UUID` | 可为 NULL | 关联 `auth.users.id`。NULL 表示未登录的 device_id 模式数据 |

#### 3.2.2 user_id 类型：`UUID`，关联 `auth.users.id`

Supabase Auth 的 `auth.users.id` 是 `UUID` 类型，所以 task_groups 的 user_id 也使用 `UUID`。不推荐使用 `TEXT`——类型一致便于索引和外键。

#### 3.2.3 device_id 保留

**保留 device_id 字段**，原因：
1. 未登录用户继续使用 device_id 模式（Phase 10 完全兼容）
2. 登录后 device_id 降级为辅助字段（用于统计分析、排查问题）
3. 不改动现有字段减少迁移风险

#### 3.2.4 未登录用户继续使用 device_id

**device_id 和 user_id 互斥使用**：

| 状态 | device_id | user_id | 查询条件 |
|------|:---:|:---:|------|
| 未登录 | 有值 | NULL | `WHERE device_id = $1` |
| 已登录 | 有值（辅助） | 有值 | `WHERE user_id = $1` |

未登录时，user_id 为 NULL，系统完全按 Phase 10 逻辑工作。

#### 3.2.5 登录用户优先使用 user_id

登录后所有云端操作通过 user_id 查询/写入，不再依赖 device_id。同一用户的多个设备共享同一个 user_id 下的数据。

#### 3.2.6 是否需要 profiles 表

**Phase 11 不需要 profiles 表。** `auth.users` 自带 `email` 字段，直接读取即可。profiles 表虽然是最佳实践，但当前阶段：
- 无自定义头像/昵称需求
- 增加一张表 + RLS 策略的维护负担
- Phase 12+ 如需扩展再加也不迟

#### 3.2.7 迁移 SQL

```sql
-- Phase 11A：在 Supabase SQL Editor 中手动执行
-- 所有语句均为可重复执行（幂等），重复执行不会报错

-- 1. 新增 user_id 列（可为 NULL，兼容未登录数据）
--    IF NOT EXISTS 避免重复执行报错
ALTER TABLE task_groups ADD COLUMN IF NOT EXISTS user_id UUID;

-- 2. 添加外键约束（可选，关联 auth.users）
--    注意：外键引用 auth.users 需要数据库 superuser 权限，
--    如果 Supabase 不允许，可跳过外键，仅靠后端逻辑约束。
--    推荐先不加外键，Phase 11 由 API Route 校验 user_id 有效性。
-- ALTER TABLE task_groups
--   ADD CONSTRAINT IF NOT EXISTS fk_task_groups_user
--   FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. 创建索引：按 user_id 查询（IF NOT EXISTS 幂等）
CREATE INDEX IF NOT EXISTS idx_task_groups_user_id ON task_groups(user_id);

-- 4. 创建索引：按 user_id + updated_at 联合查询（最新任务组）
CREATE INDEX IF NOT EXISTS idx_task_groups_user_updated
  ON task_groups(user_id, updated_at DESC);

-- 5. device_id 列改为可为 NULL（登录用户的记录不依赖 device_id）
--    DROP NOT NULL 多次执行不报错
ALTER TABLE task_groups ALTER COLUMN device_id DROP NOT NULL;

-- 验证
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'task_groups'
  AND column_name IN ('user_id', 'device_id');
-- 预期：user_id 存在且可为 NULL，device_id 可为 NULL
```

**为什么先不加外键约束**：
- Supabase 的 `auth.users` 表在 `auth` schema 下，跨 schema 外键需要 superuser 权限
- Supabase 托管实例可能拒绝该操作
- 改为在 API Route 层通过 `supabase.auth.getUser()` 验证用户有效性后，再拿 `user.id` 去查数据
- 这比数据库外键更灵活（可以记录审计日志、处理用户删除的清理逻辑等）

---

## 四、RLS 权限设计

### 4.1 安全分层：主安全层 + RLS 防御层

Phase 11 的安全性分为两层，职责明确：

**主安全层（Phase 11 实际生效）— 后端 session 校验**

- 每个 API Route 调用 `getAuthenticatedUserId()` 从 Supabase Auth session cookie 中获取当前 `user.id`
- 后端所有读写操作**只使用 session 中的 `user.id`**，绝不信任前端传来的 userId
- 未登录时回退 Phase 10 的 `device_id` 模式

```
请求进入 API Route
  │
  ├── 1. getAuthenticatedUserId()  ← 从 cookie 读取 session
  │       ├── 有 user.id → 所有 DB 操作 WHERE user_id = user.id
  │       └── 无 user.id → 回退 device_id 模式（Phase 10 兼容）
  │
  └── 2. 前端请求体中只有 deviceId + taskGroup
         （没有 userId 字段——userId 永远不从请求体/查询参数中读取）
```

**防御层（当前不生效，未来兼容）— RLS**

- Service Role Key 默认绕过 RLS，因此 RLS **不能**限制当前 API Route 的数据操作
- RLS 的定位是**防御层 / 未来兼容层**：
  - 防止未来某天误用 anon key 直接访问表（如错误地加 `NEXT_PUBLIC_` 前缀）
  - 如果未来架构演进为前端直连 Supabase（anon key + RLS），策略已就绪
- **不要把 RLS 写成能限制 Service Role 的主权限控制**——在当前架构下它做不到

### 4.2 为什么仍然配置 RLS

| 理由 | 说明 |
|------|------|
| **Key 泄露兜底** | 如果 Service Role Key 不小心暴露到前端，RLS 确保 anon key 无法读数据 |
| **纵深防御** | 安全不依赖单一机制——session 校验 + RLS 两层 |
| **未来兼容** | 如果后续改为前端直连 Supabase，RLS 策略已就绪 |
| **Supabase 最佳实践** | Supabase 官方推荐所有表开启 RLS |

### 4.3 RLS 策略设计

```sql
-- Phase 11A：在 Supabase SQL Editor 中执行
-- 所有语句均为可重复执行（幂等），重复执行不会报错

-- 1. 开启 RLS（幂等——已开启时再次执行无影响）
ALTER TABLE task_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- 2. Task_groups 表策略

-- ⚠️ 重要前提：API Route 使用 Service Role Key，Service Role 默认绕过所有 RLS 策略。
--   以下 RLS 策略仅针对 anon / authenticated 角色生效。

-- 策略 2.1：anon 角色拒绝所有操作
--   目的：防止 anon key 被误用直接访问数据表
DROP POLICY IF EXISTS "Deny all for anon on task_groups" ON task_groups;
CREATE POLICY "Deny all for anon on task_groups"
  ON task_groups
  FOR ALL
  TO anon
  USING (false);

-- 策略 2.2：authenticated 用户只能操作自己的数据（防御层）
--   注意：当前架构下 API Route 用 Service Role Key，此策略不生效。
--   此策略为未来可能的前端直连架构预留。
DROP POLICY IF EXISTS "Users can only access their own task_groups" ON task_groups;
CREATE POLICY "Users can only access their own task_groups"
  ON task_groups
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Tasks 表策略（与 task_groups 一致）

DROP POLICY IF EXISTS "Deny all for anon on tasks" ON tasks;
CREATE POLICY "Deny all for anon on tasks"
  ON tasks
  FOR ALL
  TO anon
  USING (false);

DROP POLICY IF EXISTS "Users can only access tasks of their own task_groups" ON tasks;
CREATE POLICY "Users can only access tasks of their own task_groups"
  ON tasks
  FOR ALL
  TO authenticated
  USING (
    task_group_id IN (
      SELECT id FROM task_groups WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    task_group_id IN (
      SELECT id FROM task_groups WHERE user_id = auth.uid()
    )
  );
```

### 4.4 RLS 策略总结

| 角色 | task_groups 权限 | tasks 权限 | 说明 |
|------|:---:|:---:|------|
| `anon` | 全部拒绝 | 全部拒绝 | 防止 anon key 被误用直接操作数据表 |
| `authenticated` | 只能操作自己 user_id 的行 | 只能操作自己 task_group 下的 tasks | 未来兼容层（当前 Service Role 绕过） |
| `service_role` | 全部允许（绕过 RLS） | 全部允许（绕过 RLS） | API Route 当前使用的角色 |

### 4.5 关键说明

- **主安全层是后端 session 校验，不是 RLS**：`getAuthenticatedUserId()` → `user.id` → 所有 DB 操作强制 `WHERE user_id = $1`。这个校验在每个 API Route 中执行，不依赖 RLS。
- **Service Role Key 会绕过 RLS**：当前 API Route 使用 Service Role Key 操作数据，RLS 策略对 Service Role 不生效。这意味着 RLS 在当前架构下**不是**主权限控制——它是防御层。
- **RLS 不影响现有 device_id 功能**：Service Role Key 操作不受 RLS 限制，device_id 模式的查询/写入正常进行。
- **不要混淆**：RLS 的策略 `auth.uid() = user_id` 是为 `authenticated` 角色设计的。当 API Route 使用 Service Role Key 时，`auth.uid()` 在 Service Role 上下文中为 NULL，但 Service Role 绕过 RLS 所以不受影响。

---

## 五、登录状态与前端架构

### 5.1 是否新增 AuthProvider

**新增 `useAuth` Hook，不需要 React Context Provider。**

理由：
- Supabase Auth SDK 自带 session 管理（cookie-based），多个组件可以独立调用 `supabase.auth.getSession()`
- 当前项目组件树扁平（page.tsx 直调 useTaskGroup），不需要全局 Provider
- 避免引入 Context 重渲染问题

### 5.2 useAuth Hook 设计

`src/hooks/useAuth.ts`：

```
导出内容：
  user: User | null           // 当前登录用户（null = 未登录）
  isLoading: boolean          // 是否正在加载 auth 状态（首次渲染时）
  signIn(email): Promise<>    // 发送 OTP
  verifyOtp(email, token, type): Promise<>  // 验证 OTP 完成登录
  signOut(): Promise<>        // 登出
  authModalOpen: boolean      // 登录弹窗开关
  openAuthModal(): void       // 打开弹窗
  closeAuthModal(): void      // 关闭弹窗

内部实现：
  - 使用 @supabase/supabase-js 浏览器客户端
  - createBrowserClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
  - useEffect 初始化时调用 supabase.auth.getSession()
  - 监听 supabase.auth.onAuthStateChange() 实时更新 user 状态
```

### 5.3 页面如何判断登录/未登录

```
page.tsx:
  const { user, isLoading, openAuthModal } = useAuth();
  const taskGroup = useTaskGroup();  // 不传 userId——由 useTaskGroup 内部通过 /api/auth/me 判断

  if (isLoading) → 不渲染（或显示骨架屏）
  if (!user) → 渲染未登录 UI（Header 显示"登录"按钮）
  if (user) → 渲染已登录 UI（Header 显示邮箱前缀 + "登出"按钮）
```

**为什么 useTaskGroup 不接受 userId 参数**：
- userId 必须由服务端 session 确定，不能信任前端传入
- useTaskGroup 内部在调用云端 API 时，API Route 会自行从 session cookie 获取 user.id
- 前端只传 deviceId + taskGroup——和 Phase 10 完全一致的接口

### 5.4 useTaskGroup 改动概述

useTaskGroup 无需新增参数——云端 API 内部自行判断用户身份：

```
现有签名：
  export function useTaskGroup()

新签名（不变）：
  export function useTaskGroup()
  // 不接收 userId 参数——API Route 从 session cookie 自行获取

变化逻辑：
  - 云端保存：前端始终发送 { deviceId, taskGroup }
              API Route 内部：getAuthenticatedUserId()
                → 有 user.id → 写入 task_groups.user_id = user.id
                → 无 user.id → 写入 task_groups.device_id = deviceId（Phase 10 兼容）
  - 云端恢复：前端始终发送 GET load?deviceId=xxx
              API Route 内部：getAuthenticatedUserId()
                → 有 user.id → 按 user_id 查询
                → 无 user.id → 按 deviceId 查询（Phase 10 兼容）
  - 云端删除：同理
  - 登录时迁移：POST /api/task-group/migrate body: { deviceId }
                API Route 内部从 session 获取目标 userId
```

**与 Phase 10 的接口兼容性**：前端请求体格式完全不变（`{ deviceId, taskGroup }`），API Route 内部升级为 session-aware。

### 5.5 Header 显示设计

```
未登录状态：
  ┌──────────────────────────────────────────┐
  │ AI Todo  [今日行动教练]           [登录]  │
  └──────────────────────────────────────────┘

已登录状态：
  ┌──────────────────────────────────────────┐
  │ AI Todo  [今日行动教练]    user@e... [登出]│
  └──────────────────────────────────────────┘
```

- 登录按钮：文字链或小按钮，不抢眼
- 登录后显示邮箱前缀（截断，如 `user@example.com` → `user@e...`）
- 登出按钮紧邻用户名

### 5.6 登录后是否显示账号状态

**最少显示**：邮箱前缀 + 登出按钮。

不显示同步状态指示器（如「已同步到云端」），因为：
- 云端同步是静默的，Phase 10 以来用户已经习惯了
- 显示同步状态反而制造焦虑（「为什么还没同步？」）

### 5.7 登出后如何处理本地任务

**保留本地任务，回退到 device_id 模式。**

```
登出流程：
  1. supabase.auth.signOut()
  2. 不清除 localStorage（任务数据保留）
  3. user 变为 null
  4. useTaskGroup 自动切换回 device_id 模式
  5. 后续云端操作使用 device_id（如果之前登录后绑定了 user_id，云端那份数据仍归 user 所有）
```

### 5.8 是否需要 loading auth 状态

**需要。** 页面初始化时 Supabase Auth 需要从 cookie 恢复 session（约 200-500ms），在此期间不渲染主内容：

```
auth loading → 不渲染（或只渲染 Header）
auth ready → 渲染完整页面
```

这是为了避免「先渲染未登录界面 → 0.5s 后闪变为已登录界面」的闪烁问题。

### 5.9 是否影响现有 useTaskGroup

**有限影响。** useTaskGroup 核心逻辑不变，改动点：
1. 函数签名不变——不接收 `userId` 参数
2. 云端辅助函数请求体/查询参数不变（仍传 deviceId + taskGroup）
3. 新增一个 `migrateFromDevice()` 方法供登录时调用（内部调 POST /api/task-group/migrate，只传 deviceId）
4. localStorage 逻辑完全不变
5. API Route 内部自行判断 session，useTaskGroup 无需感知登录状态

---

## 六、同步策略升级

### 6.1 未登录（Phase 10 兼容）

完全保持 Phase 10 行为：
- localStorage 主存储
- 云端使用 device_id 备份
- 本地优先，云端兜底

### 6.2 登录后

| 维度 | 未登录 | 已登录 |
|------|--------|--------|
| 存储标识符 | device_id | user_id（由 API Route 从 session 获取） |
| localStorage | 主存储 | 主存储 |
| 云端查询 | `WHERE device_id = $1` | `WHERE user_id = $1`（服务端从 session 决定） |
| 多设备共享 | ❌ | ✅（同一 user_id） |
| 跨设备勾选同步 | ❌ | ✅（云端 updated_at 传递） |
| 云端不可用时 | 静默降级 | 静默降级 |
| 前端请求体 | `{ deviceId, taskGroup }` | `{ deviceId, taskGroup }`（与未登录完全一致） |

**关键**：前端请求体格式在登录/未登录状态下完全一致，不新增 userId 字段。API Route 内部通过 `getAuthenticatedUserId()` 自行判断走 user_id 还是 device_id 路径。

### 6.3 页面初始化优先读 localStorage 还是云端

```
初始化流程：

1. 读 localStorage
   ├── 有数据 → 使用本地数据 ✅（不读云端）
   │    └── 异步保底：调 POST /api/task-group/save
   │         API Route 内部判断 session → 按 user_id 或 device_id 保存
   │         （这是静默备份，不覆盖本地数据，不更新 UI）
   └── 无数据 →
        调 GET /api/task-group/load?deviceId=xxx
        API Route 内部判断 session：
        ├── 有 user.id → 按 user_id 云端恢复
        │    ├── 云端有数据 → 恢复到 localStorage + setTaskGroup ✅
        │    └── 云端无数据 → 保持 idle 状态 ✅
        └── 无 user.id → 按 deviceId 云端恢复（Phase 10 行为）
             ├── 云端有数据 → 恢复到 localStorage + setTaskGroup ✅
             └── 云端无数据 → 保持 idle 状态 ✅
```

**核心原则不变**：localStorage 始终优先。即使已登录，如果本地有任务，也不自动用云端覆盖。用户感知到的是「即时（本地数据）」。

### 6.4 登录后如果本地有任务、云端也有任务——冲突策略

这是最关键的同步场景。用户在手机 A 上生成了任务（已同步云端），在电脑 B 上打开时本地有另一份任务（之前生成的）。

**推荐方案：「最新 updated_at 优先」自动策略。**

```
登录时或初始化时：

如果本地有 taskGroup AND 云端有 taskGroup → 比较 updated_at
  ├── 本地 updated_at > 云端 → 保留本地，异步把本地同步到云端（覆盖云端旧版本）
  └── 云端 updated_at > 本地 → 用云端数据覆盖本地 localStorage + setTaskGroup

如果只有本地有 → 本地同步到云端
如果只有云端有 → 云端恢复到本地
```

### 6.5 为什么选择自动策略而非弹窗询问

| 策略 | 用户体验 | 实现复杂度 | 风险 |
|------|---------|:---:|------|
| **自动 updated_at 优先（推荐）** | 零摩擦，用户无感知 | 低 | 如果手机和电脑分别修改不同任务，后保存的设备会覆盖另一设备的修改 |
| **弹窗选择：保留本地/使用云端** | 每次登录都要选择，烦人 | 中 | 用户不知道本地和云端分别是什么内容，无法做出有意义的选择 |

**Phase 11 选择自动策略的理由**：
1. AI Todo 是个人工具，不存在多用户编辑冲突
2. 用户通常只有一个活跃设备（在电脑上工作时手机不在手边，反之亦然）
3. `updated_at` 天然记录了最后操作时间，用它判断新旧是合理的
4. 如果用户真的同时在两个设备上做了不同操作，后操作的那个覆盖前一个——这是合理的（最后一次操作意图优先）

**后续优化（Phase 12+）**：如果需要，可以引入任务级合并（而非 taskGroup 级覆盖），但超出 Phase 11 范围。

### 6.6 跨设备同步的触发时机

| 动作 | 电脑 | 手机 | 同步时机 |
|------|------|------|---------|
| AI 生成任务 | 本地 + 云端 save | — | 手机下次打开/刷新时从云端拉取 |
| 勾选任务 | 本地 + 云端 save | — | 同上 |
| 手机勾选任务 | — | 本地 + 云端 save | 电脑下次打开/刷新时从云端拉取 |
| 清空任务 | 本地删除 + 云端 delete | — | 手机打开时本地无数据 → 云端也无 → 保持空闲 |
| 重新生成 | 本地 + 云端 save | — | 手机下次刷新时获取最新 |

**注意：Phase 11 不做实时同步。** 用户需要手动刷新页面（或重新打开 App）才能看到另一设备的更新。这是有意为之——保持简单，不引入 WebSocket/Realtime 复杂度。

---

## 七、device_id → user_id 迁移

### 7.1 迁移时机

用户**首次登录成功时**触发。只迁移一次（判断 user_id 下是否已有数据）。

### 7.2 迁移逻辑

```
首次登录（user_id 下无任何 task_group）：

1. 获取当前 device_id 对应的 task_group（从本地或云端）
2. 如果有数据：
   a. 调 POST /api/task-group/migrate  body: { deviceId }
      （API Route 内部从 session 获取目标 userId，不信任前端传入）
   b. 服务端将 task_group 的 user_id 从 NULL 更新为 session user.id
   c. task_group 的 device_id 保留（辅助字段）
   d. tasks 数据通过 task_group_id 关联，无需额外迁移
3. 如果无数据：
   无操作（用户首次使用，或数据已清理）
```

```
再次登录（user_id 下已有 task_group）：

1. 云端已有该 user_id 的数据
2. 比较本地数据（如果有）和云端数据的 updated_at
3. 使用最新 updated_at 的数据（参见第六章冲突策略）
4. 不再做 device_id → user_id 迁移（避免覆盖云端已有数据）
```

### 7.3 迁移边界条件

| 场景 | 行为 |
|------|------|
| 首次登录，device_id 有数据，user_id 无数据 | 迁移：device_id 数据绑定到 user_id |
| 首次登录，device_id 无数据，user_id 也无数据 | 无事发生，页面保持 idle |
| 再次登录，user_id 已有数据，本地无数据 | 从云端恢复 user_id 数据 |
| 再次登录，user_id 已有数据，本地有数据 | 比较 updated_at，取最新 |
| 用户分别在两个设备上首次登录 | 先登录的设备迁移成功，后登录的设备检测到 user_id 已有数据 → 比较 updated_at |

### 7.4 如何避免重复迁移

- 标记：迁移完成后，前端的 `localStorage` 中存储 `ai_todo_migrated_to` = `user_id`
- 下次登录时检查此标记：如果已迁移到当前 user_id，跳过迁移逻辑
- 如果迁移标记存在但 user_id 不匹配（用户换了账号），重新执行迁移判断

### 7.5 迁移后的旧 device_id 数据处理

- **不主动删除**旧的 device_id 数据（user_id 为 NULL 的行）
- 旧数据成为孤儿记录，不影响用户后续使用
- 如需清理，可后续做定时任务（Phase 12+）

---

## 八、API Route 设计

### 8.1 需要新增或修改的 API

#### 新增

| 接口 | 方法 | 用途 | 需要认证 |
|------|:---:|------|:---:|
| `/api/auth/me` | GET | 获取当前 session 的用户信息（从 cookie 读取） | ✅ |
| `/api/task-group/migrate` | POST | device_id → user_id 数据迁移（userId 从 session 获取） | ✅ |

#### 修改（Phase 10 已有接口，升级为 session-aware）

| 接口 | Phase 10 | Phase 11 变更 |
|------|---------|------|
| `POST /api/task-group/save` | body: `{ deviceId, taskGroup }` | **接口不变**。内部新增 `getAuthenticatedUserId()` → 有 session 时写入 user_id 列，无 session 时回退 device_id |
| `GET /api/task-group/load` | query: `?deviceId=xxx` | **接口不变**。内部新增 `getAuthenticatedUserId()` → 有 session 时按 user_id 查询，无 session 时按 deviceId 查询 |
| `POST /api/task-group/delete` | body: `{ deviceId }` | **接口不变**。内部新增 `getAuthenticatedUserId()` → 有 session 时按 user_id 删除，无 session 时按 deviceId 删除 |

**关键原则：前端请求体/查询参数与 Phase 10 完全一致。userId 永远不从请求体或 query 参数中读取——由 API Route 内部从 session cookie 获取。**

### 8.2 如何在 API Route 中获取当前 user

```typescript
// 新增 supabase-server.ts 导出函数

// 1. createSupabaseAuthClient() — 用于验证用户 session
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,  // 验证 session 用 Anon Key 即可
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // 服务端只读 session，不需要 set
        },
      },
    }
  );
}

// 2. getAuthenticatedUserId() — API Route 中调用的辅助函数
export async function getAuthenticatedUserId(): Promise<string | null> {
  const supabase = await createSupabaseAuthClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user.id;
}
```

**注意**：Supabase Auth 的 session token 存在 cookie 中（由前端 `supabase.auth.signInWithOtp()` 写入）。API Route 通过 `@supabase/ssr` 的 `createServerClient` 读取 cookie → 调用 `getUser()` → 获取用户身份。

**具体实现要点**：
- 使用 `@supabase/ssr` 包（不是 `@supabase/supabase-js`）
- `createServerClient` 需要 `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`（验证用户 token 用 anon key 即可，不需要 service_role）
- cookie 读取通过 `next/headers` 的 `cookies()`

### 8.3 服务端客户端分层

Phase 11 需要在服务端维护两个 Supabase 客户端：

| 客户端 | Key | 用途 | 文件 |
|--------|-----|------|------|
| `supabaseAuthClient` | **Anon Key** | 验证用户 session（`getUser()`） | `supabase-server.ts` 新增 |
| `supabaseDataClient` | **Service Role Key** | 数据操作（upsert/delete/select） | `supabase-server.ts` 已有 |

```typescript
// supabase-server.ts 的 Phase 11 版本

// === 已有（Phase 10）===
// Service Role Key 客户端 — 用于数据操作
import { createClient } from "@supabase/supabase-js";

export function getSupabaseDataClient() {
  // 原名 getSupabaseServerClient()
  // 使用 SUPABASE_SERVICE_ROLE_KEY
  // 用于 upsert / delete / select
}

// === 新增（Phase 11）===
// Anon Key 客户端 — 用于 session 验证
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseAuthClient() {
  // 使用 NEXT_PUBLIC_SUPABASE_ANON_KEY + cookies
  // 用于 supabase.auth.getUser()
}

export async function getAuthenticatedUserId(): Promise<string | null> {
  // 调用 createSupabaseAuthClient() → auth.getUser() → 返回 user.id
  // 失败或未登录 → 返回 null
}
```

### 8.4 API Route 改造示例逻辑

**保存接口改造**（`POST /api/task-group/save`）：

```
Phase 10 逻辑（保留）：
  - 校验 deviceId
  - 用 deviceId 查询/写入

Phase 11 新增：
  - 尝试 getAuthenticatedUserId()
    ├── 成功（用户已登录）→
    │    优先使用 user_id，写入 task_groups.user_id = user.id
    │    device_id 作为辅助字段（记录写入的设备）
    └── 失败（未登录或 session 过期）→
        回退到 Phase 10 逻辑（使用请求体中的 deviceId）
```

**读取接口改造**（`GET /api/task-group/load`）：

```
Phase 10 逻辑：
  - 按 deviceId 查询

Phase 11 新增：
  - 尝试 getAuthenticatedUserId()
    ├── 成功 → 按 user_id 查询，忽略 URL 中的 deviceId
    └── 失败 → 按 URL 中的 deviceId 查询（Phase 10 兼容）
```

**删除接口改造**（`POST /api/task-group/delete`）：

```
同理：先尝试 user_id，失败则用 deviceId
```

### 8.5 迁移接口设计

`POST /api/task-group/migrate`：

```
请求体：
  {
    "deviceId": "xxx"      // 当前设备的 device_id
  }
  // 注意：不传 userId——userId 由服务端从 session cookie 获取

服务端逻辑：
  1. getAuthenticatedUserId() → 获取当前 user.id（如果为 null，返回 NOT_AUTHENTICATED）
  2. 查询该 device_id 下最新的 task_group（user_id 为 NULL 的）
  3. 查询该 user_id 下是否已有 task_group
     ├── 有 → 比较 updated_at，取最新
     └── 无 → 将 device_id 的任务 UPDATE user_id = session_user.id
  4. 返回结果：
     { success: true, data: { taskGroup, migrated: true/false } }
```

**安全保证**：迁移的目标 userId 完全由服务端 session 决定，前端无法伪造迁移目标。

### 8.6 错误码新增

```typescript
// types.ts 新增
export type AuthErrorCode =
  | "NOT_AUTHENTICATED"
  | "SESSION_EXPIRED"
  | "OTP_SEND_FAILED"
  | "OTP_VERIFY_FAILED"
  | "MIGRATION_FAILED";

// CloudTaskGroupErrorCode 扩展
export type CloudTaskGroupErrorCode =
  | "INVALID_DEVICE_ID"
  | "INVALID_TASK_GROUP"
  | "NOT_CONFIGURED"
  | "CLOUD_SAVE_FAILED"
  | "CLOUD_LOAD_FAILED"
  | "CLOUD_DELETE_FAILED"
  | "NOT_AUTHENTICATED"       // 新增
  | "MIGRATION_FAILED";       // 新增
```

---

## 九、环境变量设计

### 9.1 Phase 10 已有变量

```bash
# .env.local（已存在）
AI_API_KEY=your-api-key-here
AI_API_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

### 9.2 Phase 11 需要新增

```bash
# .env.local 新增

# Supabase Anon Key — 可暴露到浏览器的公开密钥
# 用于前端 Supabase Auth 客户端（signIn/signOut/session）
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 9.3 哪些可以暴露到前端

| 变量 | 前端可见 | 说明 |
|------|:---:|------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase 项目 URL，不是秘密 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Anon Key 专为客户端设计，权限由 RLS 限制 |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ | 服务端专用，绕过了 RLS，绝对不能暴露 |
| `AI_API_KEY` | ❌ | 服务端 AI 调用专用 |

**注意**：`SUPABASE_URL` 目前是 `SUPABASE_URL`（非 `NEXT_PUBLIC_` 前缀）。Phase 11 前端需要此 URL 来初始化 Supabase Auth 客户端，有两个选择：

1. **新增** `NEXT_PUBLIC_SUPABASE_URL` 同时保留 `SUPABASE_URL`（两个变量指向同一个值）
2. **改为** `NEXT_PUBLIC_SUPABASE_URL`（统一用一个变量）

**推荐方案 1**：新增 `NEXT_PUBLIC_SUPABASE_URL`，保持 `SUPABASE_URL` 不变。这样：
- 服务端代码不需要改（继续使用 `SUPABASE_URL`）
- 前端使用 `NEXT_PUBLIC_SUPABASE_URL`
- 两者指向同一个 Supabase 项目 URL，但明确区分了服务端/客户端来源

### 9.4 SUPABASE_JWT_SECRET 是否需要

**不需要。** Supabase Auth 的 JWT 签名和验证由 Supabase 托管服务处理，Next.js 服务端无需手动验证 JWT。`@supabase/ssr` 的 `createServerClient` + `auth.getUser()` 内部完成了 JWT 解析和验证。

### 9.5 .env.example 更新

```bash
# .env.example Phase 11 版本

# AI API 配置
AI_API_KEY=your-api-key-here
AI_API_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini

# Supabase 配置
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Supabase 前端配置（Phase 11 新增）
# ⚠️ Anon Key 可以安全地暴露到浏览器端
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 9.6 Vercel 部署需要更新的环境变量

| 变量 | 操作 | 备注 |
|------|:---:|------|
| `SUPABASE_URL` | 保留 | 已有 |
| `SUPABASE_SERVICE_ROLE_KEY` | 保留 | 已有 |
| `NEXT_PUBLIC_SUPABASE_URL` | **新增** | Phase 11 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **新增** | Phase 11 |

---

## 十、UI / UX 设计

### 10.1 设计原则

**不破坏 Phase 9.1 的行动教练风格。** 登录是辅助功能，不是产品焦点。

- 登录入口低调（Header 右侧小按钮/文字链）
- 弹窗简洁（不超过 3 个输入步骤）
- 颜色使用现有 Indigo / Slate 色系
- 不新增页面、不改变布局结构

### 10.2 登录入口位置

**Header 右侧**——与现有 AI Todo 品牌名 + 行动教练标签形成左右平衡：

```
┌─────────────────────────────────────────────────────┐
│  AI Todo  [今日行动教练]                    [登录 →]  │
└─────────────────────────────────────────────────────┘
```

登录按钮样式：文字链 + 箭头，使用 `text-indigo-600 hover:text-indigo-700` 的低调配色。

### 10.3 登录弹窗设计

使用 Modal/Dialog 组件，点击 Header 的「登录」按钮触发：

```
┌────────────────────────────────────────────┐
│                                            │
│          🔐 登录 AI Todo                    │
│                                            │
│    跨设备同步你的任务，随时随地推进目标。      │
│                                            │
│    ┌──────────────────────────────────┐    │
│    │  your@email.com                  │    │
│    └──────────────────────────────────┘    │
│                                            │
│    ┌──────────────────────────────────┐    │
│    │         发送验证码                │    │
│    └──────────────────────────────────┘    │
│                                            │
│    未登录也可继续使用本地模式。              │
│                                            │
└────────────────────────────────────────────┘

输入验证码后：

┌────────────────────────────────────────────┐
│                                            │
│          🔐 输入验证码                       │
│                                            │
│    验证码已发送至 your@email.com             │
│                                            │
│    ┌──────────────────────────────────┐    │
│    │  输入 6 位验证码                  │    │
│    └──────────────────────────────────┘    │
│                                            │
│    ┌──────────────────────────────────┐    │
│    │         验证并登录                │    │
│    └──────────────────────────────────┘    │
│                                            │
│    没有收到？[重新发送]                      │
│                                            │
└────────────────────────────────────────────┘
```

### 10.4 弹窗关键设计细节

| 元素 | 设计 |
|------|------|
| 标题 | 「登录 AI Todo」 |
| 副标题 | 「跨设备同步你的任务，随时随地推进目标。」 |
| 邮箱输入框 | 占位符 `your@email.com` |
| 验证码输入 | **一个文本输入框**（`type="text"`，输入 6 位数字，不做 6 格拆分——6 格拆分是可选优化） |
| 发送按钮 | Indigo 色，与现有「生成今日任务」按钮风格一致 |
| 错误提示 | 邮箱格式错误 / 验证码错误 / 发送失败 — 红色文字内联显示 |
| 底部提示 | 「未登录也可继续使用本地模式。」— 安抚不想登录的用户 |
| 关闭方式 | 点击遮罩 / 右上角 ✕ / ESC 键 |
| 加载状态 | 发送验证码时按钮显示「发送中...」并禁用 |

### 10.5 登录/登出提示（可选优化）

**Phase 11C 首版不强制要求 Toast 组件。** 登录成功/登出成功直接通过 Header 状态变化体现（邮箱前缀出现/消失）。

Toast 轻提示可以作为可选优化（Phase 11C 验收不做要求）：
```
┌──────────────────────────────────────┐
│  ✅ 已登录，任务将在设备间自动同步。    │
└──────────────────────────────────────┘
```

### 10.6 登出按钮

位于 Header 用户邮箱旁。点击后：
1. 弹窗确认？**不需要**——登出不是破坏性操作（本地数据保留）
2. 直接登出，Header 恢复为「登录」按钮
3. Header 状态变化足够反馈用户，无需额外提示

### 10.7 未登录提示文案

在 Header「登录」按钮旁可以用 tooltip 显示简短说明：「登录后可跨设备同步」，但不是必须的——避免界面过载。

### 10.8 是否需要同步状态指示器

**Phase 11 不需要。** 理由同 §5.6——云端同步是静默的，显示状态制造焦虑。

也不需要以下提示：
- ❌ 「正在同步...」
- ❌ 「已同步到云端」
- ❌ 「当前为本地模式」

一切都静默发生。如果云端保存失败，用户也不会看到任何提示（Phase 10 以来的行为）。

---

## 十一、文件结构设计

### 11.1 新增文件

```
src/lib/supabase-client.ts           # 浏览器端 Supabase Auth 客户端（~30 行）
src/hooks/useAuth.ts                 # 登录状态管理 Hook（~150 行）
src/components/AuthModal.tsx         # 登录弹窗组件（~200 行）
src/components/Toast.tsx             # Toast 轻提示组件（可选优化，~50 行）
src/app/api/auth/me/route.ts         # GET 获取当前 session（~30 行）
src/app/api/task-group/migrate/route.ts  # POST device_id → user_id 迁移（~80 行）
```

### 11.2 修改文件（Phase 10 已有）

```
src/lib/supabase-server.ts           # 新增 createSupabaseAuthClient() + getAuthenticatedUserId()
src/lib/types.ts                     # 新增 AuthErrorCode、扩展 CloudTaskGroupErrorCode
src/lib/constants.ts                 # 新增 UI_TEXT 登录相关文案 + ERROR_MESSAGES 新增
src/app/api/task-group/save/route.ts # 支持 user_id
src/app/api/task-group/load/route.ts # 支持 user_id
src/app/api/task-group/delete/route.ts # 支持 user_id
src/hooks/useTaskGroup.ts            # 新增 migrateFromDevice() 方法；API 调用接口不变（userId 由服务端 session 决定）
src/components/Header.tsx            # 新增登录/登出按钮 + useAuth 集成
src/app/page.tsx                     # 新增 useAuth + AuthModal 集成（Toast 可选）
.env.example                          # 新增 NEXT_PUBLIC_SUPABASE_* 变量
README.md                            # 新增 Phase 11 登录与同步说明
```

### 11.3 不修改的文件

```
src/lib/storage.ts                   # localStorage 逻辑不变
src/lib/device-id.ts                # device_id 生成逻辑不变
src/lib/ai-client.ts                # AI 调用不变
src/lib/task-parser.ts              # 任务解析不变
src/lib/input-validator.ts          # 输入校验不变
src/lib/date-utils.ts               # 日期工具不变
src/app/api/generate-tasks/route.ts # AI 生成 API 不变
src/components/HeroSection.tsx      # 不变
src/components/GoalInput.tsx        # 不变
src/components/TaskList.tsx         # 不变
src/components/EmptyState.tsx       # 不变
src/components/LoadingState.tsx     # 不变
src/components/TaskProgress.tsx     # 不变
src/components/NewDayPrompt.tsx     # 不变
public/manifest.json                # PWA 不变
```

---

## 十二、Phase 11 开发拆分

### Phase 11A：Auth 技术方案与数据库迁移

> **这是纯人工操作阶段，Codex 不参与。不写代码、不安装依赖。**

| 项目 | 内容 |
|------|------|
| **目标** | 数据库 user_id 迁移 + Supabase Auth 配置 + 环境变量 |
| **执行人** | 开发者手动操作 |
| **允许操作** | ① Supabase SQL Editor 执行迁移 SQL（§3.2.7 + §4.3）<br>② Supabase Dashboard 找到 Project Settings → API → 复制 `anon public` key<br>③ 本地 `.env.local` 新增 `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`<br>④ Supabase Dashboard → Authentication → Settings → 配置邮件模板（OTP 验证码） |
| **禁止事项** | ❌ 不写代码<br>❌ 不安装依赖<br>❌ 不修改 Git 文件 |
| **验收标准** | ① `SELECT * FROM task_groups` 确认 `user_id` 列存在<br>② `SELECT * FROM pg_policies` 确认 RLS 策略已创建<br>③ `.env.local` 中存在 `NEXT_PUBLIC_SUPABASE_ANON_KEY`<br>④ Supabase Dashboard Authentication → Users 页面可访问 |

### Phase 11B：Supabase Auth 基础接入（打通前后端 session）

> **Codex 开始写代码。**
>
> **Phase 11B 的核心不是 UI，而是打通 Supabase Auth 的前端 session 与 Next.js API Route 服务端 session。**
> 只有服务端能正确读取 user.id，后续 Phase 11D 的 user_id 同步才有安全基础。

| 项目 | 内容 |
|------|------|
| **目标** | ① 浏览器端 Supabase Auth 客户端 + useAuth Hook<br>② **服务端 `/api/auth/me` 能从 cookie 读取当前 user.id** |
| **执行人** | Codex |
| **允许修改** | ✅ `npm install @supabase/ssr`（新增依赖，提供 `createBrowserClient`/`createServerClient`）<br>✅ `src/lib/supabase-client.ts`（新增：浏览器端 createBrowserClient）<br>✅ `src/lib/supabase-server.ts`（新增 `createSupabaseAuthClient` + `getAuthenticatedUserId`）<br>✅ `src/hooks/useAuth.ts`（新增：signIn / verifyOtp / signOut / user / isLoading）<br>✅ `src/app/api/auth/me/route.ts`（新增：GET → 从 cookie 读 session → 返回 user.id）<br>✅ `src/lib/types.ts`（新增 AuthErrorCode）<br>✅ `src/lib/constants.ts`（新增 ERROR_MESSAGES）<br>✅ `package.json` |
| **禁止事项** | ❌ 不改 UI 组件<br>❌ 不改 useTaskGroup.ts<br>❌ 不新增登录弹窗 UI<br>❌ 不新增 Toast UI<br>❌ 不修改 API Route（save/load/delete） |
| **验收标准** | **必须全部通过才能进入 Phase 11C/11D**：<br>① `npm run lint` + `npm run build` 通过<br>② 浏览器端 OTP 登录成功（`signInWithOtp` + `verifyOtp` 返回 session）<br>③ **登录成功后 `GET /api/auth/me` 能在服务端读取到当前 user.id**（核心验收）<br>④ **刷新页面后 `/api/auth/me` 仍能读取 user.id**（cookie 持久化验收）<br>⑤ **登出后 `/api/auth/me` 返回 `{ user: null }`**（登出清理验收）<br>⑥ 手机浏览器 / PWA 中登录态能保持<br>⑦ **硬性门禁：如果 `/api/auth/me` 无法在服务端读取 session，不允许进入 Phase 11C/11D** |

**`/api/auth/me` 的实现要点**：
- 使用 `@supabase/ssr` 的 `createServerClient`（不是 `@supabase/supabase-js`）
- 使用 `NEXT_PUBLIC_SUPABASE_ANON_KEY`（验证用户 token 用 anon key 即可）
- 通过 `next/headers` 的 `cookies()` 读取 cookie
- 调用 `supabase.auth.getUser()` 返回 `{ user }` 或 `{ user: null }`
- 不返回敏感信息（只返回 `user.id` 和 `user.email`）

**为什么这是安全基础**：
- Phase 11D 的 API Route（save/load/delete）都依赖 `getAuthenticatedUserId()` 从 session 获取 user.id
- 如果 Phase 11B 无法在服务端读取 session，则 Phase 11D 的所有 user_id 操作都不可信
- `/api/auth/me` 是验证「Supabase Auth cookie → 服务端 session」链路打通的唯一手段

### Phase 11C：登录 / 登出 UI

| 项目 | 内容 |
|------|------|
| **目标** | 登录弹窗 + Header 登录/登出按钮（Toast 为可选优化，非必须） |
| **执行人** | Codex |
| **允许修改** | ✅ `src/components/AuthModal.tsx`（新增：邮箱输入 → 发送验证码 → 验证码输入 → 验证并登录）<br>✅ `src/components/Header.tsx`（修改：新增登录/登出按钮）<br>✅ `src/app/page.tsx`（修改：集成 useAuth + AuthModal）<br>✅ `src/components/Toast.tsx`（可选：登录成功 Toast 提示） |
| **禁止事项** | ❌ 不改 useTaskGroup.ts<br>❌ 不改 API Route<br>❌ 不改 HeroSection / GoalInput / TaskList 等核心组件<br>❌ 不改 localStorage / storage.ts |
| **Phase 11C 首版 UI 要求** | ① 一个邮箱输入框<br>② 一个验证码输入框（不做 6 格拆分）<br>③ 发送验证码按钮<br>④ 验证并登录按钮<br>⑤ 登录/登出 Header 按钮<br>⑥ 弹窗内错误提示（红色内联文字） |
| **验收标准** | ① 点击 Header「登录」→ 弹窗出现<br>② 输入邮箱 → 点击发送验证码 → 进入验证码输入界面<br>③ 输入验证码 → 登录成功 → Header 显示邮箱前缀（登录按钮变为邮箱 + 登出）<br>④ 点击「登出」→ 立即登出 → Header 恢复「登录」按钮<br>⑤ 未登录状态下 Phase 10 所有功能正常<br>⑥ `npm run lint` + `npm run build` 通过

### Phase 11D：API Route 升级为 session-aware

| 项目 | 内容 |
|------|------|
| **目标** | API Route 内部从 session 获取 userId + useTaskGroup 无需感知登录状态 |
| **执行人** | Codex |
| **允许修改** | ✅ `src/app/api/task-group/save/route.ts`（新增 getAuthenticatedUserId → 写入 user_id）<br>✅ `src/app/api/task-group/load/route.ts`（新增 getAuthenticatedUserId → 按 user_id 查询）<br>✅ `src/app/api/task-group/delete/route.ts`（新增 getAuthenticatedUserId → 按 user_id 删除）<br>✅ `src/hooks/useTaskGroup.ts`（新增 migrateFromDevice 方法；云端调用接口不变） |
| **禁止事项** | ❌ 不改 UI 组件<br>❌ 不改 storage.ts<br>❌ 不改 localStorage 逻辑<br>❌ 不改迁移逻辑（留给 Phase 11E）<br>❌ API Route 不接收前端传来的 userId |
| **验收标准** | ① 登录后生成任务 → Supabase Dashboard 确认 task_groups.user_id 为 session user.id<br>② 登录后勾选任务 → Dashboard 确认 tasks.completed 更新<br>③ 登录后清空任务 → Dashboard 确认数据删除<br>④ 未登录时 Phase 10 device_id 模式正常<br>⑤ 前端请求体中不含 userId（DevTools Network 验证）<br>⑥ `npm run lint` + `npm run build` 通过 |

### Phase 11E：device_id 数据迁移到 user_id

| 项目 | 内容 |
|------|------|
| **目标** | 首次登录时自动迁移 device_id 数据到 user_id |
| **执行人** | Codex |
| **允许修改** | ✅ `src/app/api/task-group/migrate/route.ts`（新增）<br>✅ `src/hooks/useTaskGroup.ts`（新增 `migrateFromDevice`，登录时触发）<br>✅ `src/lib/types.ts`（新增 MIGRATION_FAILED 错误码） |
| **禁止事项** | ❌ 不改 UI 组件<br>❌ 不改 localStorage 逻辑<br>❌ 不改迁移外的 API Route |
| **验收标准** | ① 未登录时生成任务（device_id 模式）→ 登录 → 该任务绑定到 user_id<br>② 再次登录 → 不重复迁移<br>③ 登录时本地有任务 + 云端 user_id 已有任务 → 取 updated_at 最新<br>④ `npm run lint` + `npm run build` 通过 |

### Phase 11F：多设备同步验收与 Vercel 部署

| 项目 | 内容 |
|------|------|
| **目标** | 端到端验收多设备同步 + 部署 |
| **执行人** | 开发者 + Codex（仅 README 更新） |
| **允许修改** | ✅ Vercel Dashboard 操作<br>✅ `README.md`（更新说明） |
| **禁止事项** | ❌ 不修改代码 |
| **验收标准** | ① Vercel 部署成功<br>② 电脑生成任务 → 手机登录同一账号 → 刷新后看到任务<br>③ 手机勾选任务 → 电脑刷新后看到勾选状态<br>④ 清除 localStorage → 刷新 → 从云端恢复<br>⑤ 浏览器 DevTools 看不到 `SUPABASE_SERVICE_ROLE_KEY`<br>⑥ 浏览器 DevTools 可以看到 `NEXT_PUBLIC_SUPABASE_ANON_KEY`（这是正常且安全的）<br>⑦ 一个浏览器登出 → 另一个浏览器数据不受影响 |

---

## 十三、错误处理方案

| 错误场景 | 位置 | 处理策略 | 用户感知 |
|---------|------|---------|---------|
| **邮箱格式错误** | AuthModal 前端校验 | 内联红色文字提示「请输入正确的邮箱地址」 | 即时反馈 |
| **验证码发送失败** | Supabase Auth | `signInWithOtp` 抛出错误 → Modal 显示「验证码发送失败，请稍后重试」 | 红色内联提示 |
| **验证码错误** | Supabase Auth | `verifyOtp` 抛出错误 → Modal 显示「验证码不正确，请重新输入」 | 红色内联提示 |
| **Session 过期** | `getAuthenticatedUserId` | 返回 null → useTaskGroup 回退 device_id 模式 | 无感知 |
| **用户未登录** | API Route | `getAuthenticatedUserId` 返回 null → 按 device_id 处理 | 无感知，Phase 10 行为 |
| **云端同步失败** | useTaskGroup | 同 Phase 10——静默失败，localStorage 不受影响 | 无感知 |
| **迁移失败** | migrate API | 返回 MIGRATION_FAILED → useTaskGroup 静默跳过迁移，继续使用 device_id | 无感知 |
| **Supabase Auth 配置错误** | `supabase-client.ts` 初始化 | `createBrowserClient` 参数缺失 → console.warn → 所有 auth 操作返回错误 | 登录弹窗无法使用，但本地功能正常 |
| **本地/云端冲突** | useTaskGroup `useEffect` | 自动采用 updated_at 最新（§6.4），不弹窗 | 无感知 |

**静默失败原则延续**：所有云端操作失败均静默——Phase 10 的核心设计哲学在 Phase 11 中被完整保留。

---

## 十四、安全边界

| # | 规则 | 实现方式 |
|---|------|---------|
| 1 | 不把 Service Role Key 暴露到前端 | `SUPABASE_SERVICE_ROLE_KEY` 无 `NEXT_PUBLIC_` 前缀，仅 `supabase-server.ts` 引用 |
| 2 | 不把 JWT Secret 暴露到前端 | Supabase Auth 管理 JWT，JWT Secret 由 Supabase 托管，不经过 Next.js |
| 3 | 不把真实 Key 写入代码 | 所有 Key 通过 `.env.local` 注入，`.env.example` 只有占位符 |
| 4 | 不提交 `.env.local` | `.gitignore` 已有 `.env*` 规则 |
| 5 | 前端只使用 Anon Key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` 是 Supabase 公开 API Key，设计上可暴露 |
| 6 | **后端绝不信任前端传来的 userId** | userId 永远不从请求体或 query 参数中读取；API Route 必须从 session cookie 获取 user.id |
| 7 | 用户不能访问别人的 task_groups | **主安全层**：API Route 用 `getAuthenticatedUserId()` 获取 session user.id → 所有 DB 操作强制 `WHERE user_id = session_user.id`<br>**防御层**：RLS 策略 `auth.uid() = user_id`（仅对 authenticated 角色生效，Service Role 绕过） |
| 8 | 登录态不能只靠 localStorage 判断 | 使用 Supabase Auth cookie session（httpOnly + secure），不由前端 JS 变量控制 |
| 9 | 登出后不能访问云端 user_id 数据 | `signOut()` 清除 cookie → API Route 中 `getAuthenticatedUserId()` 返回 null → 回退 device_id 模式 |
| 10 | 迁移接口防止未授权访问 | `/api/task-group/migrate` 请求体只接收 `deviceId`；目标 userId 完全从 session cookie 获取 |
| 11 | API Route 不返回敏感信息 | 所有响应只包含 `success` + `data` + `error`，不含 Supabase Key / JWT |
| 12 | **RLS 不是主权限控制** | Service Role Key 绕过 RLS——主安全层必须是 API Route 中的 session user.id 校验 |

---

## 十五、验收标准

### 15.1 功能验收

| # | 验收项 | 验收方法 |
|---|--------|---------|
| 1 | 未登录时 Phase 10 功能全部正常 | 不登录 → 生成/勾选/清空/刷新恢复 → 全部正常 |
| 2 | 可以登录 | 点击登录 → 输入邮箱 → 收验证码 → 登录成功 |
| 3 | 可以登出 | 点击登出 → 立即登出 → 本地任务保留 |
| 4 | 登录后当前任务绑定 session user_id | 登录 → 生成任务 → Supabase Dashboard 确认 task_groups.user_id = 当前 session user.id（非前端传入） |
| 5 | 同一账号多设备看到同一任务 | 电脑生成任务 → 手机登录 → 刷新 → 看到任务 |
| 6 | 勾选状态跨设备同步 | 电脑勾选 → 手机登录 → 刷新 → 勾选状态一致 |
| 7 | 清空任务跨设备同步 | 电脑清空 → 手机登录 → 刷新 → 无任务 |
| 8 | localStorage 清除后登录恢复 | 登录状态 → 清除 localStorage → 刷新 → 从云端恢复 |
| 9 | 不登录也能继续使用本地模式 | 全程不登录 → 功能完整 + PWA + 本地存储正常 |

### 15.2 质量验收

| # | 验收项 | 方法 |
|---|--------|------|
| 10 | `npm run lint` 通过 | 命令行 |
| 11 | `npm run build` 通过 | 命令行 |
| 12 | Vercel 部署成功 | 浏览器访问生产 URL |
| 13 | 浏览器端看不到 Service Role Key | DevTools → Sources → 搜索 `sb_secret` → 无结果 |
| 14 | 浏览器端可看到 Anon Key（正常） | DevTools → Sources → 搜索 `eyJ` → 可见（这是安全的） |
| 15 | 前端请求体不含 userId（安全） | DevTools → Network → save/load/delete 请求 → 请求体/query 参数中无 userId 字段 |
| 16 | 用户不能读取其他用户数据 | curl 测试：不携带 cookie → GET /api/task-group/load → 按 deviceId 查询（未登录模式）；伪造 session → 返回当前 session user.id 的数据（不会按前端传的 userId 返回） |

### 15.3 安全验收

| # | 验收项 |
|---|--------|
| 17 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` 出现在前端 bundle（正常） |
| 18 | `SUPABASE_SERVICE_ROLE_KEY` 不出现在前端 bundle |
| 19 | `.env.local` 不被 Git 跟踪 |
| 20 | Session cookie 由 Supabase Auth 管理（httpOnly） |
| 21 | 登出后 API Route 无法用旧的 session 访问 user_id 数据 |
| 22 | **`/api/auth/me` 在服务端正确读取 session（Phase 11B 硬性门禁）** |
| 23 | 前端请求体中无 userId 字段（DevTools Network 验证） |
| 24 | migrate 接口请求体不含 userId（DevTools Network 验证） |

---

## 十六、风险点

### 16.1 RLS 配置风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| RLS 策略配置错误拒绝 Service Role 操作 | **无影响**——Service Role 默认绕过 RLS。主安全层是 API Route 的 session 校验，不依赖 RLS | 不依赖 RLS 作为主安全层 |
| RLS 策略未生效 | 如果未来 Key 泄露且有人用 anon key 访问，数据无保护 | Phase 11A 验收时确认 `pg_policies` 中存在策略 |
| `auth.uid()` 在 Service Role 上下文中为 NULL | **无影响**——Service Role 绕过 RLS。`auth.uid()` 只在 authenticated 角色中有效 | RLS 策略仅针对 `anon` 和 `authenticated` 角色生效，不影响 Service Role |
| **误以为 RLS 能保护 Service Role 操作** | **高风险**——如果开发者错误地认为 RLS 限制了 Service Role，可能忽略 API Route 中的 session 校验 | 文档和代码注释明确标注：主安全层是 `getAuthenticatedUserId()`，RLS 仅是防御层 |

### 16.2 多设备冲突风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| 两台设备同时修改不同任务 | 后保存的一方覆盖先保存的一方（updated_at 优先） | Phase 11 范围可接受——用户通常只有一个活跃设备 |
| 设备 A 清空任务，设备 B 正在编辑 | B 下次保存时云端已无数据，B 的数据会重新写入 | 可接受——B 的保存请求会重新创建 task_group |
| 手机离线时勾选了任务 | 离线期间的勾选未同步，联网后下次操作才同步 | 可接受——Phase 11 不做离线队列 |

### 16.3 登录后本地/云端任务冲突

| 风险 | 影响 | 缓解 |
|------|------|------|
| 手机和电脑各有一份不同的任务，登录后哪个保留 | updated_at 较新的保留，旧数据被覆盖 | 用户可在覆盖前在「旧设备」上截图保存 |
| 用户期望弹窗选择 | 自动策略可能覆盖用户想要的数据 | Phase 11 选择简洁优先，实际场景中用户极少同时维护两份不同任务 |

### 16.4 迁移 device_id 数据风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| device_id 下数据已损坏（JSON 解析失败） | 迁移失败，云端该记录成为孤儿 | 不影响登录后的正常使用 |
| 迁移时网络中断 | 迁移不完整（user_id 未写入但已标记迁移完成） | 迁移标记在迁移成功后写入 localStorage，网络中断不会写入标记 |
| 重复迁移 | 如果迁移标记未写入，下次登录可能再次触发迁移 | 再次迁移判断 `user_id` 是否已有数据 → 有则跳过 |
| 前端伪造 deviceId 迁移他人数据 | 前端传入任意 deviceId 尝试绑定到自己的 session user_id | **无实际风险**——迁移只是将 deviceId 的孤儿数据绑定到当前用户，不涉及跨用户数据访问。且迁移前检查 device_id 数据 user_id 为 NULL，已绑定的数据不会重复迁移 |

### 16.5 Supabase Auth 邮件配置风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| 邮件被归入垃圾箱 | 用户收不到验证码 | Supabase 提供自定义 SMTP，可配置主流邮件服务提高送达率 |
| 本地开发无 SMTP | 无法发送真实邮件 | Supabase 本地开发模式下验证码输出到终端/Dashboard 日志 |
| 生产环境超过免费额度 | Supabase Free Tier：50 封/月 | 当前小项目预期用户量不会超过；超过后配置自定义 SMTP |

### 16.6 PWA 登录态保持风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| PWA standalone 模式下 cookie 可能被清除 | 登录态丢失，用户需要重新登录 | Supabase Auth 的 session cookie 在 PWA 中正常持久化（已验证），PWA 清除 cookie 时 device_id 也会变化，此时无差别恢复 |
| 手机 PWA 添加到桌面后 session 过期 | 需要重新登录 | Supabase Auth 默认 session 过期时间为 1 周（可配置），过期后重新登录即可——本地数据不受影响 |

---

## 附录：与 Phase 10 的核心差异对比

| 维度 | Phase 10 | Phase 11 |
|------|---------|---------|
| 身份标识 | device_id（匿名） | user_id（账号） + device_id（辅助） |
| 数据归属 | 设备 | 用户账号 |
| 跨设备同步 | ❌ | ✅ |
| 登录方式 | 无 | 邮箱 OTP 验证码 |
| 前端 Supabase SDK | ❌（仅服务端） | ✅（Auth 客户端，仅用于登录和 session） |
| RLS | ❌ | ✅（防御层） |
| 云端同步方式 | API Route + Service Role Key | API Route + Service Role Key（不变）+ RLS |
| localStorage 优先级 | 始终优先 | 始终优先（不变） |
| 静默失败 | ✅ | ✅（不变） |
| 冲突处理 | 不适用（单设备） | updated_at 自动优先 |

---

> **下一阶段**：本文档经 Review 通过后，进入 Phase 11A（数据库迁移 + Supabase Auth 配置）。
> Phase 12 候选方向：任务历史记录、多任务组管理、第三方登录（GitHub/Google/微信）、离线优先架构。
