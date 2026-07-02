# Phase 10：数据库与云端保存 — 技术架构方案

> **状态**：设计阶段，待 Review 通过后开发
> **依赖**：Phase 8 + Phase 9（V1.2）完整通过
> **对应 PRD**：AI Todo PRD V1.0
> **设计日期**：2026-06-29

---

## 目录

- [一、Phase 10 总体目标](#一phase-10-总体目标)
- [二、数据库选型](#二数据库选型)
- [三、数据模型设计](#三数据模型设计)
- [四、device_id 方案](#四device_id-方案)
- [五、API Route 设计](#五api-route-设计)
- [六、同步策略](#六同步策略)
- [七、环境变量设计](#七环境变量设计)
- [八、文件结构设计](#八文件结构设计)
- [九、Phase 10 开发拆分](#九phase-10-开发拆分)
- [十、错误处理方案](#十错误处理方案)
- [十一、安全边界](#十一安全边界)
- [十二、验收标准](#十二验收标准)
- [十三、风险点](#十三风险点)

---

## 一、Phase 10 总体目标

### 1.1 为什么要引入数据库

V1.0–V1.2 的 localStorage 方案有三个硬伤：

| 问题 | 影响 |
|------|------|
| **清缓存即丢失** | 用户清理浏览器数据后任务全部消失，无任何恢复手段 |
| **无法跨浏览器** | 同一设备 Chrome → Edge 需要重新生成任务 |
| **设备丢失无备份** | 换电脑 / 重装系统后数据不可恢复 |

Phase 10 的定位不是"多设备实时同步"，而是**当前设备的云端备份/恢复**——给 localStorage 加一个安全网。

### 1.2 localStorage 与数据库如何共存

```
┌─────────────────────────────────────────────┐
│                  用户操作                      │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
        ┌─────────────────┐
        │   React State   │  ◀── 即时更新（~0ms）
        │  (useTaskGroup) │
        └────────┬────────┘
                 │
        ┌────────▼────────┐
        │   localStorage  │  ◀── 同步写入（~0ms）
        │   (本地主存储)   │      永远先写本地
        └────────┬────────┘
                 │
        ┌────────▼────────┐
        │  Supabase       │  ◀── 异步写入（~50-200ms）
        │  (云端备份)      │      静默失败不阻塞 UI
        └─────────────────┘
```

**核心原则**：
- **localStorage 是主存储**：UI 渲染永远依赖本地数据，保证秒开
- **数据库是备份**：异步写入，静默失败，不阻塞用户操作
- **云端恢复是兜底**：只在本地数据为空时尝试从云端拉回

### 1.3 Phase 10 做什么

| 功能 | 说明 |
|------|------|
| ✅ 云端保存任务组 | 生成/勾选/重新生成后，异步保存到 Supabase |
| ✅ 云端恢复任务组 | 页面初始化时，如果 localStorage 为空则从云端拉取 |
| ✅ 云端清空任务组 | "清空任务"/"开始新一天" 同步删除云端数据 |
| ✅ device_id 机制 | 用设备标识符关联数据，无需登录 |
| ✅ 降级可用 | 数据库不可用时，本地功能完全不受影响 |

### 1.4 Phase 10 不做什么

| 不做 | 原因 |
|------|------|
| ❌ 登录/注册 | Phase 11 |
| ❌ 多设备同步 | Phase 11（需要用户账号 + 冲突解决） |
| ❌ 历史记录 | 每个设备只保存当前 1 个 taskGroup |
| ❌ 多任务组管理 | 保持 V1.0 单任务组模型 |
| ❌ 离线队列/重试 | 数据库失败静默，下次成功自动覆盖 |
| ❌ 冲突合并 | 本地永远优先，云端只做备份 |
| ❌ 实时订阅 | 不引入 Supabase Realtime |
| ❌ RLS 策略 | 使用 Service Role Key 直连，Phase 11 再引入 RLS |

---

## 二、数据库选型

### 2.1 推荐：Supabase PostgreSQL

**推荐 Supabase**，理由如下：

| 维度 | 评估 |
|------|------|
| **Next.js 兼容** | `@supabase/supabase-js` 在 API Route（Node.js runtime）中可用 |
| **Vercel 兼容** | Supabase 是外部服务，不依赖 Vercel 的 serverless 限制 |
| **免费额度** | 500MB 数据库 + 2GB 带宽/月，V1.0 足够 |
| **无运维** | 托管 PostgreSQL，无需自己搭服务器 |
| **Phase 11 可升级** | Supabase Auth + RLS 直接内建，天然支持未来登录 |
| **SQL 生态** | 标准 PostgreSQL，迁移成本低 |

### 2.2 备选方案对比

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| **Supabase** | 免费、托管、Auth 内建 | 需注册第三方账号 | ✅ 推荐 |
| **Vercel Postgres** | 与 Vercel 深度集成 | 免费额度小、绑定 Vercel | 备选 |
| **PlanetScale** | MySQL 兼容、免费 | 无 Auth、Phase 11 需另接 | 不推荐 |
| **自建 PostgreSQL** | 完全控制 | 运维成本高，不符合项目定位 | 不推荐 |

### 2.3 Key 的使用规则

Supabase 提供两种 Key：

| Key | 权限 | 是否可暴露前端 | Phase 10 用途 |
|-----|------|--------------|--------------|
| `anon/public` | 受限（受 RLS 控制） | ✅ 可以 | **不使用**（Phase 10 不做客户端直连） |
| `service_role` | 完全权限（绕过 RLS） | ❌ **绝对不能** | ✅ API Route 服务端使用 |

**Phase 10 只用 Service Role Key**，因为：
1. Phase 10 没有 RLS 策略（没有 user_id 概念）
2. 所有数据库操作通过 Next.js API Route 代理
3. 前端完全不接触 Supabase SDK，只调用自己的 API Route

### 2.4 npm 依赖

只需新增一个依赖：

```
@supabase/supabase-js  (latest)
```

用于在 `src/lib/supabase-server.ts` 中创建服务端 Supabase 客户端。

---

## 三、数据模型设计

### 3.1 表结构

#### task_groups

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | `TEXT` | PRIMARY KEY | 复刻前端生成的 taskGroup.id（如 `task_group_1719000000000`） |
| `device_id` | `TEXT` | NOT NULL | 设备标识符（UUID v4） |
| `goal` | `TEXT` | NOT NULL | 用户输入的目标文本 |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | 任务组创建时间 |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | 最后更新时间 |

**DDL**：

```sql
CREATE TABLE task_groups (
  id         TEXT PRIMARY KEY,
  device_id  TEXT NOT NULL,
  goal       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_groups_device_id ON task_groups(device_id);
```

#### tasks

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | `TEXT` | NOT NULL | 复刻前端生成的 task.id（如 `task_001`） |
| `task_group_id` | `TEXT` | NOT NULL, REFERENCES task_groups(id) ON DELETE CASCADE | 所属任务组 |
| `title` | `TEXT` | NOT NULL | 任务标题 |
| `completed` | `BOOLEAN` | NOT NULL, DEFAULT false | 是否完成 |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | 任务创建时间 |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT now() | 最后更新时间 |

**主键**：`(id, task_group_id)` 复合主键——同一个 taskGroup 内 task.id 唯一，但不同 taskGroup 可复用 `task_001` 这样的 ID。

**DDL**：

```sql
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

### 3.2 是否需要 user_id

**Phase 10：不需要。**

理由：
- Phase 10 不做登录，没有 user 概念
- `device_id` 足够区分不同设备的数据
- 每个设备只有 1 条 taskGroup 记录（后续生成会覆盖旧记录），不存在需要 user 级别的聚合

### 3.3 Phase 11 如何迁移到 user_id

迁移路径（不破坏现有数据）：

```
Phase 10                           Phase 11
─────────                          ─────────
task_groups                        task_groups
├── id (PK)                        ├── id (PK)
├── device_id                      ├── user_id (新增，可为 NULL)
├── goal                           ├── device_id (保留但降级为辅助字段)
├── created_at                     ├── goal
└── updated_at                     ├── created_at
                                   └── updated_at

迁移 SQL（Phase 11 首日执行）：
ALTER TABLE task_groups ADD COLUMN user_id UUID;
-- 为老数据设置 user_id = NULL，新登录用户写入真实 user_id
-- Phase 11 查询：WHERE user_id = $1（优先）OR device_id = $2（兜底未登录数据）
```

---

## 四、device_id 方案

### 4.1 生成方式

```
device_id = crypto.randomUUID()   // 浏览器原生 API，无需额外依赖
```

在用户首次访问时生成，之后持久化到 localStorage。

### 4.2 存储位置

| 层级 | Key | 说明 |
|------|-----|------|
| **localStorage** | `ai_todo_device_id` | 持久存储，不受清理缓存影响（除非用户主动清除站点数据） |
| **API 请求体** | `deviceId` 字段 | 每次云端操作时携带 |
| **数据库** | `task_groups.device_id` | 标记记录归属 |

### 4.3 生命周期

```
首次访问 → 生成 UUID → 存入 localStorage → 此后每次请求携带
清除站点数据 → 生成新 UUID → 旧数据成为"孤儿"（无法找回）
Phase 11 登录 → device_id 关联到 user_id → 旧数据迁移到用户账号
```

### 4.4 安全风险

| 风险 | 严重度 | 说明 |
|------|--------|------|
| **device_id 可被窃取** | 低 | 存储在 localStorage，同源策略保护。XSS 攻击可读取，但 Phase 10 无敏感数据 |
| **device_id 可被伪造** | 低 | 知道别人的 device_id 可访问其任务数据，但任务数据本身不敏感 |
| **清除数据后数据孤儿** | 中 | 无登录无法找回。Phase 11 通过 user_id 解决 |
| **多设备无法关联** | 中 | 同一用户 Chrome 和 Safari 有不同 device_id，数据独立。Phase 11 解决 |

### 4.5 为什么它只能代表设备

device_id 是个**匿名标识符**，不验证用户身份：
- 任何人拿到 device_id 就能访问对应数据
- 同一台电脑的不同浏览器 = 不同 device_id
- 清除站点数据后 = 新 device_id

这是 Phase 10 不做登录的**设计取舍**——牺牲安全性换取零摩擦体验。Phase 11 引入登录后会从根本上解决。

---

## 五、API Route 设计

### 5.1 基础约定

- **Base URL**：所有接口在 `/api/task-group/` 下
- **Content-Type**：`application/json`
- **错误码**：复用 `ApiErrorCode` 类型，新增 `CLOUD_SAVE_FAILED`、`CLOUD_LOAD_FAILED`
- **device_id 校验**：每个接口必传 `deviceId`，缺失或空字符串返回 400
- **Supabase 调用**：全部通过 `src/lib/supabase-server.ts` 中使用 Service Role Key 创建的客户端

### 5.2 POST /api/task-group/save

**用途**：保存/更新当前设备的任务组（upsert 语义：存在则更新，不存在则插入）。

#### 请求

```json
POST /api/task-group/save
Content-Type: application/json

{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "taskGroup": {
    "id": "task_group_1719000000000",
    "goal": "我要学习 Python",
    "tasks": [
      {
        "id": "task_001",
        "title": "安装 Python 环境",
        "completed": true,
        "createdAt": "2026-06-29T08:00:00.000Z",
        "updatedAt": "2026-06-29T09:00:00.000Z"
      },
      {
        "id": "task_002",
        "title": "完成第一个 Hello World",
        "completed": false,
        "createdAt": "2026-06-29T08:00:00.000Z",
        "updatedAt": "2026-06-29T08:00:00.000Z"
      }
    ],
    "createdAt": "2026-06-29T08:00:00.000Z",
    "updatedAt": "2026-06-29T09:00:00.000Z"
  }
}
```

#### 成功响应

```json
200 OK

{
  "success": true
}
```

#### 错误响应

```json
400 Bad Request
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "deviceId is required."
  }
}
```

```json
500 Internal Server Error
{
  "success": false,
  "error": {
    "code": "CLOUD_SAVE_FAILED",
    "message": "无法保存到云端，请稍后重试。"
  }
}
```

#### 服务端逻辑

Phase 10B 采用**简单 replace 策略**（非数据库事务）：

```
1. 校验 deviceId 非空
2. 校验 taskGroup 基本结构（id、goal、tasks 存在且类型正确）
3. UPSERT task_groups（ON CONFLICT (id) DO UPDATE）
   - 更新 goal、updated_at
   - device_id 在 INSERT 时写入，UPDATE 时保持不变（不覆盖归属）
4. DELETE 该 task_group_id 下所有旧 tasks
5. INSERT 新 tasks（批量）
6. 任一步失败 → 返回 CLOUD_SAVE_FAILED（500）
7. 前端静默失败，localStorage 不受影响
```

> **注意**：步骤 3-5 是依次执行的三个独立 SQL 操作，**不在同一个数据库事务中**。`@supabase/supabase-js` 的 `upsert()`、`delete()`、`insert()` 各自是独立请求，不能声称事务原子性。这意味着步骤 4 成功但步骤 5 失败时，云端 tasks 短暂为空。由于 localStorage 是主存储，用户本地数据不受影响。后续如需严格原子性，可新增 Supabase RPC（PostgreSQL function）用一个函数完成 save 全流程。

### 5.3 GET /api/task-group/current

**用途**：读取当前设备的最新任务组。

#### 请求

```
GET /api/task-group/current?deviceId=550e8400-e29b-41d4-a716-446655440000
```

#### 成功响应（有数据）

```json
200 OK

{
  "success": true,
  "data": {
    "taskGroup": {
      "id": "task_group_1719000000000",
      "goal": "我要学习 Python",
      "tasks": [ ... ],
      "createdAt": "2026-06-29T08:00:00.000Z",
      "updatedAt": "2026-06-29T09:00:00.000Z"
    }
  }
}
```

#### 成功响应（无数据——设备从未保存过）

```json
200 OK

{
  "success": true,
  "data": null
}
```

#### 错误响应

```json
400 Bad Request
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "deviceId is required."
  }
}
```

#### 服务端逻辑

```
1. 校验 deviceId 非空（从 query string 读取）
2. 查询 task_groups WHERE device_id = $1 ORDER BY updated_at DESC LIMIT 1
3. 如果有 taskGroup，JOIN 查询其所有 tasks
4. 组装为前端 TaskGroup 格式返回
5. 如果没有，返回 { data: null }
```

### 5.4 DELETE /api/task-group/current

**用途**：删除当前设备的云端任务组。

#### 请求

```json
DELETE /api/task-group/current
Content-Type: application/json

{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**注意**：使用 DELETE 方法但携带 JSON body。由于 Next.js API Route 支持从 `request.json()` 读取 DELETE 请求的 body。

备选方案：如果遇到兼容性问题，可改为 `POST /api/task-group/delete`。

#### 成功响应

```json
200 OK

{
  "success": true
}
```

#### 服务端逻辑

```
1. 校验 deviceId 非空
2. DELETE FROM task_groups WHERE device_id = $1
   - CASCADE 自动删除关联 tasks
3. 返回 { success: true }
   - 即使没有匹配的行也返回 success（幂等操作）
```

### 5.5 校验规则

| 校验项 | 接口 | 规则 |
|--------|------|------|
| `deviceId` 非空 | 全部 | 缺失、空字符串、非字符串 → 400 |
| `taskGroup` 存在 | save | 缺失或非对象 → 400 |
| `taskGroup.id` 非空 | save | 缺失或空字符串 → 400 |
| `taskGroup.goal` 非空 | save | 缺失或空字符串 → 400 |
| `taskGroup.tasks` 为数组 | save | 缺失或非数组 → 400 |
| `task.id` / `task.title` | save | 每个 task 必查，不合格的跳过（宽容策略） |
| 数据结构防污染 | save | 只提取需要的字段（id, goal, tasks, createdAt, updatedAt），忽略多余字段 |

### 5.6 如何防止前端直接操作 Service Role Key

**架构保证**（不依赖开发者的自觉）：

```
浏览器                        Next.js Server                   Supabase
──────                        ──────────────                   ────────
fetch('/api/task-group/save') → API Route handler
                               ├── 读取 SUPABASE_SERVICE_ROLE_KEY
                               │   （process.env，浏览器不可见）
                               ├── 校验 deviceId + taskGroup
                               ├── supabase.from('task_groups').upsert(...)
                               └── 返回结果
                                                            → PostgreSQL
```

关键点：
- `SUPABASE_SERVICE_ROLE_KEY` 只存在于 `.env.local`，由 `process.env` 读取
- `src/lib/supabase-server.ts` 只在服务端模块中 import（API Route）
- 前端代码不 import supabase-server，构建时即使尝试也会因 tree-shaking 而报错
- `NEXT_PUBLIC_` 前缀的环境变量才会暴露给前端，`SUPABASE_SERVICE_ROLE_KEY` 不此前缀

---

## 六、同步策略

### 6.1 页面初始化

```
┌──────────────────────────────────────────────────────┐
│                  页面加载（useEffect）                  │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ loadTaskGroup() │
              │ 读 localStorage │
              └────────┬────────┘
                       │
            ┌──────────┴──────────┐
            │                     │
            ▼                     ▼
      有本地数据              无本地数据
            │                     │
            ▼                     ▼
   直接渲染（~0ms）        GET /api/task-group/current
   showNewDayPrompt              │
   根据日期判断          ┌───────┴───────┐
            │            │               │
            │            ▼               ▼
            │      云端有数据        云端无数据
            │            │               │
            │            ▼               ▼
            │    saveTaskGroup()    保持空状态
            │    恢复到 localStorage  EmptyState
            │    渲染任务列表
            │
            ▼
      （可选）异步检查云端版本
      如果云端 updatedAt > 本地 updatedAt
      → 不自动覆盖（Phase 10 不做冲突解决）
      → 本地永远优先
```

**关键设计决策**：本地数据存在时，不用云端覆盖。原因：
- 用户可能在不同设备操作，云端数据可能是旧的
- Phase 10 不做冲突合并，本地优先是最安全的选择
- Phase 11 引入时间戳比较 + 用户选择（"检测到其他设备的任务，要替换吗？"）

### 6.2 任务变化（生成/勾选/重新生成）

```
用户操作（勾选任务）
    │
    ▼
handleToggleTask(taskId)
    │
    ├──▶ setTaskGroup(updated)         // 1. 更新 React state（即时）
    │
    ├──▶ saveTaskGroup(updated)        // 2. 写入 localStorage（同步）
    │
    └──▶ saveToCloud(deviceId, updated) // 3. 异步写云端（不 await，静默失败）
              │
              ├── 成功 → 无感知
              └── 失败 → console.warn("Cloud save failed", error)
                        // 不影响 UI，不显示错误提示
```

**静默失败的理由**：
- 云端保存失败不应阻止用户继续使用
- 如果失败后用户刷新页面，localStorage 数据仍然存在
- 下次写入成功时会覆盖旧数据
- 如果每次失败都弹错误提示，反而影响体验

### 6.3 清空任务（处理）

```
handleClearTasks()
    │
    ├──▶ setTaskGroup(null)            // 1. 清空 React state
    ├──▶ removeTaskGroup()             // 2. 清除 localStorage
    └──▶ deleteFromCloud(deviceId)     // 3. 异步删除云端（不 await）
              │
              ├── 成功 → 无感知
              └── 失败 → 不提示
                        // 最坏情况：云端残留一条旧记录
                        // 下次生成新任务时会被覆盖
```

### 6.4 开始新一天

```
handleStartNewDay()
    │
    ├──▶ setTaskGroup(null)            // 1. 清空 React state
    ├──▶ setInputGoal("")              // 2. 清空输入框
    ├──▶ removeTaskGroup()             // 3. 清除 localStorage
    └──▶ deleteFromCloud(deviceId)     // 4. 异步删除云端
```

### 6.5 重新生成

```
handleRegenerate()
    │
    ├──▶ requestTaskGroup(goal)        // 1. 调 AI 生成新任务
    │       │
    │       ├── 成功
    │       │   ├──▶ setTaskGroup(newData)    // 更新 state
    │       │   ├──▶ saveTaskGroup(newData)   // 覆盖 localStorage
    │       │   └──▶ saveToCloud(deviceId, newData)  // 覆盖云端（upsert）
    │       │
    │       └── 失败
    │           └──▶ 保留旧任务（state + localStorage + 云端均不变）
    │               显示 regenerateError
```

---

## 七、环境变量设计

### 7.1 新增环境变量

| 变量名 | 前缀 | 可暴露前端 | 说明 | 示例值 |
|--------|------|-----------|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `NEXT_PUBLIC_` | ✅ 是 | Supabase 项目 URL | `https://abc123.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | 无 | ❌ 否 | 服务端完全权限 Key | `sb_secret_...` |

### 7.2 为什么 SUPABASE_URL 需要 NEXT_PUBLIC_ 前缀

虽然在 Phase 10 中前端不直接调用 Supabase，但 `NEXT_PUBLIC_SUPABASE_URL` 加前缀的理由：

1. **未来 Phase 11 可能需要**：如果客户端使用 Supabase Auth，需要此 URL
2. **URL 本身不敏感**：知道 Supabase URL 不能做任何操作（没有 Key）
3. **避免重构**：Phase 10 加了前缀，Phase 11 无需改动

如果用不到，也可以不加前缀（纯服务端使用 `SUPABASE_URL`）。两种方案均可。

**推荐方案**：不加前缀，使用 `SUPABASE_URL`（纯服务端），因为 Phase 10 确实不需要前端访问 Supabase。如果 Phase 11 需要，届时再加 `NEXT_PUBLIC_`。

### 7.3 .env.example 模板

```bash
# ==========================================
# AI Todo — 环境变量配置
# ==========================================
# 复制此文件为 .env.local 并填入真实值
# .env.local 不会被提交到 Git

# --- AI API（Phase 4-5，必填）---
AI_API_KEY=your-api-key-here
AI_API_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini

# --- Supabase 云端保存（Phase 10，可选）---
# 访问 https://supabase.com → 创建项目 → Settings → API
# 如果不填，云端保存功能不启用，本地 localStorage 仍正常使用
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_your_service_role_key_here
```

### 7.4 Vercel 环境变量配置

在 Vercel Dashboard → Project → Settings → Environment Variables 中添加：

| Name | Value | Environments |
|------|-------|-------------|
| `AI_API_KEY` | `sk-...` | Production, Preview, Development |
| `AI_API_BASE_URL` | `https://api.openai.com/v1` | Production, Preview, Development |
| `AI_MODEL` | `gpt-4o-mini` | Production, Preview, Development |
| `SUPABASE_URL` | `https://xxx.supabase.co` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_...` | Production, Preview, Development |

所有 5 个变量都需要在 Vercel 配置。

---

## 八、文件结构设计

### 8.1 新增文件

```
src/
├── lib/
│   ├── supabase-server.ts          # Supabase 服务端客户端（~40 行）
│   └── device-id.ts                # device_id 生成/读取工具（~20 行）
│
├── app/
│   └── api/
│       └── task-group/             # Phase 10 新增 API Route
│           ├── save/
│           │   └── route.ts        # POST /api/task-group/save
│           ├── current/
│           │   └── route.ts        # GET /api/task-group/current
│           └── current/
│               └── route.ts        # DELETE /api/task-group/current
│                                    # （注：实际目录结构见下方说明）
```

**API Route 目录结构说明**：

Next.js App Router 的 API Route 不支持同一个路径同时支持 GET 和 DELETE 的两个不同文件。解决方案有两种：

**方案 A（推荐）**：拆成两个路径
```
api/task-group/
├── save/route.ts          → POST /api/task-group/save
├── load/route.ts          → GET  /api/task-group/load?deviceId=...
└── delete/route.ts        → POST /api/task-group/delete  { deviceId }
```

**方案 B**：单文件处理多方法
```
api/task-group/
└── route.ts               → 内部判断 request.method
                             GET    → 读取
                             POST   → 保存
                             DELETE → 删除
```

推荐**方案 A**，与现有 `api/generate-tasks/route.ts` 的单文件单职责风格一致。

### 8.2 修改文件

| 文件 | 改动性质 | 说明 |
|------|---------|------|
| `src/lib/types.ts` | 新增类型 | `SaveToCloudRequest`、`LoadFromCloudResponse`、`DeleteFromCloudRequest`、`CloudApiResponse` |
| `src/lib/constants.ts` | 新增常量 | `DEVICE_ID_KEY`、`CLOUD_ERROR_MESSAGES` |
| `src/lib/storage.ts` | 无改动 | 保持纯 localStorage 操作，不引入云端逻辑 |
| `src/hooks/useTaskGroup.ts` | 新增云端同步调用 | `handleGenerate`/`handleToggleTask`/`handleClearTasks`/`handleRegenerate`/`handleStartNewDay` 末尾异步调用云端 API；`useEffect` 中新增云端恢复逻辑 |
| `.env.example` | 新增变量 | `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` |
| `README.md` | 新增说明 | Supabase 初始化步骤、环境变量说明 |
| `package.json` | 新增依赖 | `@supabase/supabase-js` |

### 8.3 不修改的文件

| 文件 | 理由 |
|------|------|
| `route.ts` (generate-tasks) | AI 核心逻辑不动 |
| `ai-client.ts` | AI 核心逻辑不动 |
| `task-parser.ts` | AI 核心逻辑不动 |
| `task-generation.ts` | AI 核心逻辑不动 |
| `input-validator.ts` | 校验逻辑不动 |
| `date-utils.ts` | Phase 8 逻辑不动 |
| `src/components/*` | 所有 UI 组件不动 |
| `src/app/page.tsx` | 页面结构不动 |
| `src/app/layout.tsx` | 布局不动 |
| `src/app/globals.css` | 样式不动 |
| `public/*` | PWA 资源不动 |

### 8.4 各新文件职责

**`src/lib/device-id.ts`**：

```
导出函数：
  getDeviceId(): string
    └── 从 localStorage 读取 'ai_todo_device_id'
    └── 如果不存在，生成 crypto.randomUUID() 并存储
    └── 返回 device_id

约定：
  - 纯浏览器端函数（使用 window.localStorage + crypto）
  - 不在服务端调用
  - 不需要 isBrowser() 守卫（useTaskGroup 只在客户端运行）
```

**`src/lib/supabase-server.ts`**：

```
导出函数：
  createSupabaseClient(): SupabaseClient
    └── 使用 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
    └── 在每次 API Route 调用时创建新实例（serverless 友好）

导出函数：
  saveTaskGroupToCloud(deviceId, taskGroup): Promise<{success, error?}>
  loadTaskGroupFromCloud(deviceId): Promise<{success, data?, error?}>
  deleteTaskGroupFromCloud(deviceId): Promise<{success, error?}>

约定：
  - 只在 API Route 文件中 import（服务端 only）
  - 不在任何 'use client' 文件中 import
  - 如果 SUPABASE_URL 未配置，所有函数返回 { success: false, error: 'NOT_CONFIGURED' }
```

---

## 九、Phase 10 开发拆分

### Phase 10A：Supabase 初始化与表结构

> **这是纯人工操作阶段，Codex 不参与。不写代码、不安装依赖、不修改 Git 文件。**

| 项目 | 内容 |
|------|------|
| **目标** | Supabase 项目创建 + 表结构建立 + 环境变量配置 |
| **执行人** | 开发者手动操作（Supabase Dashboard + 本地 `.env.local`） |
| **允许操作** | ① Supabase Dashboard 创建项目<br>② SQL Editor 执行建表 DDL<br>③ 本地 `.env.local` 手动添加 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` |
| **禁止事项** | ❌ 不写任何代码<br>❌ 不安装任何依赖（`npm install`）<br>❌ 不修改任何 Git 跟踪文件（`.env.local` 已在 `.gitignore`，不算 Git 变更）<br>❌ 不创建新文件<br>❌ 不运行 Codex |
| **验收标准** | ① Supabase SQL Editor 中 `SELECT * FROM task_groups` 不报错（表存在）<br>② `SELECT * FROM tasks` 不报错（表存在）<br>③ `.env.local` 中已添加 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 两个变量 |

**具体步骤**：
1. 访问 [supabase.com](https://supabase.com) → 注册/登录 → 创建新项目 → 记下 Project URL 和 Service Role Key
2. 进入 SQL Editor → 执行第三节中的建表 DDL（`CREATE TABLE task_groups ...` + `CREATE TABLE tasks ...` + 两个 `CREATE INDEX`）
3. 在 SQL Editor 中验证：`SELECT * FROM task_groups; SELECT * FROM tasks;` 均返回空结果集（不报错即成功）
4. 打开项目本地 `.env.local`，追加两行：
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
   ```

> Phase 10A 完成后，通知 Codex 进入 Phase 10B。

### Phase 10B：后端 API Route

> **Codex 开始写代码的第一个阶段。** 只做后端基础设施，不碰前端同步。

| 项目 | 内容 |
|------|------|
| **目标** | 实现 3 个 API Route + supabase-server.ts + device-id.ts |
| **执行人** | Codex（写代码） |
| **允许修改** | ✅ `package.json`（`npm install @supabase/supabase-js`）<br>✅ `src/lib/supabase-server.ts`（新增）<br>✅ `src/lib/device-id.ts`（新增）<br>✅ `src/app/api/task-group/save/route.ts`（新增）<br>✅ `src/app/api/task-group/load/route.ts`（新增）<br>✅ `src/app/api/task-group/delete/route.ts`（新增）<br>✅ `src/lib/types.ts`（新增 API 请求/响应类型）<br>✅ `src/lib/constants.ts`（新增 ERROR_MESSAGES 条目）<br>✅ `.env.example`（新增 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 说明）<br>✅ `README.md`（新增 Supabase 初始化步骤说明） |
| **禁止事项** | ❌ 不改 `useTaskGroup.ts`（前端同步留给 Phase 10C）<br>❌ 不改任何 `src/components/*`<br>❌ 不改 `src/lib/storage.ts`<br>❌ 不改 `src/app/page.tsx`<br>❌ 不改 AI API（`route.ts`、`ai-client.ts`、`task-parser.ts`）<br>❌ 不新增 UI 组件<br>❌ 不新增页面 |
| **验收标准** | ① `npm run lint` + `npm run build` 通过<br>② curl POST `/api/task-group/save` → 200 → Supabase Dashboard 可见数据<br>③ curl GET `/api/task-group/load?deviceId=xxx` → 200 返回刚保存的数据<br>④ curl POST `/api/task-group/delete` → 200 → Supabase Dashboard 数据被删除<br>⑤ 不传 `deviceId` → 400 `INVALID_REQUEST`<br>⑥ 删掉 `.env.local` 中 `SUPABASE_URL` → 调 save → 200（静默跳过，不崩溃） |

**关键实现细节**：
- `save/route.ts`：步骤 ① upsert task_groups → ② delete 旧 tasks → ③ insert 新 tasks。三步依次执行但非同一事务（见 §5.2 服务器端逻辑说明）
- `load/route.ts`：deviceId 从 `request.nextUrl.searchParams.get('deviceId')` 读取
- `supabase-server.ts`：检查 `SUPABASE_URL` 是否配置，未配置时返回特定错误码 `NOT_CONFIGURED`

### Phase 10C：前端接入云端保存与恢复

| 项目 | 内容 |
|------|------|
| **目标** | 在 useTaskGroup 中接入云端 API，实现保存/恢复/删除 |
| **允许修改** | `src/hooks/useTaskGroup.ts`（核心改动）<br>`src/lib/storage.ts`（不改，仅供对比确认） |
| **禁止事项** | 不改 UI 组件<br>不改 AI API Route<br>不新增页面<br>不新增状态变量（复用现有 state）<br>不新增错误提示（云端失败静默） |
| **验收标准** | ① 本地生成任务 → Supabase Dashboard 可看到数据 ② 勾选任务 → 云端 completed 字段更新 ③ 清空任务 → 云端数据被删除 ④ 清除 localStorage 后刷新 → 页面从云端恢复数据 ⑤ 云端不可用（关掉 Supabase 或删 Key）→ 本地功能完全不受影响 ⑥ `npm run build` + `npm run lint` 通过 |

**useTaskGroup.ts 改动点**（逐方法）：

| 方法 | 新增行为 | 调用时机 |
|------|---------|---------|
| `handleGenerate`（成功分支） | `saveToCloud(deviceId, result.data)` | `saveTaskGroup` 之后，不 await |
| `handleToggleTask` | `saveToCloud(deviceId, updatedTaskGroup)` | `saveTaskGroup` 之后，不 await |
| `handleRegenerate`（成功分支） | `saveToCloud(deviceId, result.data)` | `saveTaskGroup` 之后，不 await |
| `handleClearTasks` | `deleteFromCloud(deviceId)` | `removeTaskGroup` 之后，不 await |
| `handleStartNewDay` | `deleteFromCloud(deviceId)` | `removeTaskGroup` 之后，不 await |
| `useEffect`（初始化） | 如果 `loadTaskGroup()` 返回 null → 尝试 `loadFromCloud(deviceId)` → 成功则 `saveTaskGroup(data)` + `setTaskGroup(data)` | localStorage 为空时 |

### Phase 10D：部署与 Vercel 环境变量

| 项目 | 内容 |
|------|------|
| **目标** | 部署到 Vercel 并配置环境变量 |
| **允许修改** | Vercel Dashboard 操作（无代码变更） |
| **禁止事项** | 不修改代码 |
| **验收标准** | ① Vercel 部署成功 ② 浏览器 DevTools Network 标签中看不到 Supabase Key ③ 本地功能正常 ④ 清除 localStorage 后云端恢复正常 |

---

## 十、错误处理方案

### 10.1 错误分类与处理

| 错误场景 | 发生位置 | 处理策略 | 用户感知 |
|---------|---------|---------|---------|
| **Supabase 未配置**（Key 为空） | supabase-server.ts | 返回 `NOT_CONFIGURED`，所有操作静默跳过 | 无感知，本地功能正常 |
| **数据库连接失败** | API Route → Supabase | 返回 500 + `CLOUD_SAVE_FAILED`，前端 `catch` 后静默 | 无感知，本地功能正常 |
| **保存失败** | API Route | 同上 | 无感知 |
| **读取失败** | API Route | 返回 500 + `CLOUD_LOAD_FAILED`，前端视为"无云端数据" | 无感知，保持本地数据 |
| **device_id 缺失** | useTaskGroup | `getDeviceId()` 自动生成，不可能缺失 | 无感知 |
| **云端数据损坏**（JSON 解析失败） | load/route.ts | 返回 null（视为无数据） | 无感知，本地数据不受影响 |
| **网络超时** | useTaskGroup | `fetch` 不设 timeout（依赖浏览器默认），失败静默 | 无感知 |

### 10.2 静默失败的边界

**以下情况必须静默（不显示任何错误提示）**：
- 云端保存失败
- 云端删除失败
- 云端恢复失败
- Supabase 未配置

**以下情况保持现有错误提示**：
- AI 生成失败（`AI_GENERATION_FAILED`）→ GoalInput 的 ErrorMessage
- 网络错误（`NETWORK_ERROR`）→ GoalInput 的 ErrorMessage
- 重新生成失败（`REGENERATE_FAILED`）→ TaskList 的 ErrorMessage
- 输入校验失败 → GoalInput 的 ErrorMessage

**原则**：本地功能的错误提示保持不变，云端操作全部静默。

### 10.3 开发阶段的调试支持

```typescript
// supabase-server.ts
const isDev = process.env.NODE_ENV === 'development';

// 仅在开发环境打印云端保存失败日志
if (isDev) {
  console.warn('[Cloud] Save failed:', error);
}
```

---

## 十一、安全边界

### 11.1 硬性规则

| # | 规则 | 检查方式 |
|---|------|---------|
| 1 | `SUPABASE_SERVICE_ROLE_KEY` 不出现 `NEXT_PUBLIC_` 前缀 | code review |
| 2 | 不在任何 `'use client'` 文件中 import `supabase-server.ts` | ESLint / code review |
| 3 | 不在 `.env.example` 中写入真实 Key | code review |
| 4 | `.env.local` 已在 `.gitignore` 中 | 文件检查（V1.0 已满足） |
| 5 | 不在 `console.log` 打印 Key | code review |
| 6 | 前端不直接 `import { createClient } from '@supabase/supabase-js'` | `grep` 检查 |
| 7 | 前端不出现 `supabase.from(...)` 调用 | `grep` 检查 |
| 8 | Phase 10 不做登录、不做权限系统 | code review |

### 11.2 架构安全审查点

```
浏览器                                         服务器
──────                                         ──────
✅ 可看到 NEXT_PUBLIC_SUPABASE_URL              ✅ 可读取 SUPABASE_SERVICE_ROLE_KEY
❌ 不可访问 SUPABASE_SERVICE_ROLE_KEY           ✅ 可访问 Supabase 数据库
❌ 不可直接调 Supabase SDK                       ✅ 校验 deviceId + taskGroup 结构
✅ 可调 /api/task-group/save                    ✅ 使用 Service Role Key 操作数据库
✅ 可读自己的 localStorage                      ❌ 不将 Key 注入 HTML 响应
```

### 11.3 Vercel 部署安全

- Vercel 环境变量通过 Dashboard 配置，不会出现在 Git 仓库中
- 构建日志中可能打印环境变量名，但不会打印值（Vercel 自动脱敏）
- 生产环境使用独立的 Supabase 项目（推荐但非强制，V1.0 可用同一项目）

---

## 十二、验收标准

### 12.1 功能验收

| # | 验收项 | 预期行为 | 验证方式 |
|---|--------|---------|---------|
| 1 | 本地任务正常生成 | 与 Phase 9 行为一致 | 输入目标 → 生成任务 → 正常展示 |
| 2 | 勾选正常保存 | 勾选后刷新 → 勾选状态保留 | localStorage 恢复 |
| 3 | 刷新恢复正常 | localStorage 有数据时秒开 | 刷新页面 → 任务直接出现 |
| 4 | 云端保存成功 | 生成任务后 → Supabase Dashboard 可见数据 | 查 Supabase 表 |
| 5 | 云端恢复成功 | 清除 localStorage → 刷新 → 从云端恢复 | DevTools 清除站点数据 |
| 6 | 清空任务同步云端 | 点清空 → Supabase 表中数据被删除 | 查 Supabase 表 |
| 7 | 重新生成同步云端 | 重新生成 → 云端数据为新任务 | 查 Supabase 表 |
| 8 | 无数据库时本地可用 | 删除 SUPABASE_SERVICE_ROLE_KEY → 本地功能正常 | 本地测试 |
| 9 | lint 通过 | `npm run lint` 无错误 | CLI |
| 10 | build 通过 | `npm run build` 无错误 | CLI |
| 11 | Vercel 部署成功 | 生产环境可访问 | 浏览器打开 Vercel URL |
| 12 | 浏览器端看不到 Key | DevTools Network/Sources 搜不到 service_role | 手动检查 |

### 12.2 回归验收

Phase 8 + Phase 9 的所有功能必须在 Phase 10 后保持不变：

| # | Phase 8-9 功能 | 验证 |
|---|---------------|------|
| 1 | 清空任务 | ✅ |
| 2 | 重新生成 | ✅ |
| 3 | 示例目标填入 | ✅ |
| 4 | 全部完成提示 | ✅ |
| 5 | 开始新一天 | ✅ |
| 6 | PWA manifest 可访问 | ✅ |
| 7 | 移动端触控 | ✅ |
| 8 | animate-spin 旋转 | ✅ |

---

## 十三、风险点

### 13.1 device_id 的局限（无登录）

| 风险 | 影响 | 缓解 | Phase 11 解决 |
|------|------|------|-------------|
| 清除站点数据后无法找回 | 用户数据丢失（本地+云端都不可达） | Phase 10 无法解决，需 Phase 11 登录 | ✅ 登录后通过 user_id 找回 |
| device_id 碰撞（极低概率） | 两个设备拿到相同 device_id | UUID v4 碰撞概率 < 10^-15 | ✅ 登录后 user_id 替代 device_id |
| device_id 泄露 | 他人可通过 device_id 查看任务 | 任务数据不敏感 | ✅ 登录后需认证 token |

### 13.2 云端与本地冲突

**Phase 10 策略**：本地永远优先，不尝试合并。

| 场景 | 处理 |
|------|------|
| 本地有数据 + 云端有数据 | 本地优先，不读取云端 |
| 本地无数据 + 云端有数据 | 从云端恢复 |
| 本地有数据 + 云端无数据 | 下一次保存时写入云端 |
| 本地无数据 + 云端无数据 | 空状态 |

这避免了所有冲突场景，代价是：
- 如果用户在设备 A 生成任务 → 在设备 B 也生成任务 → A 的云端数据被 B 覆盖
- 这是 Phase 10 的设计取舍，Phase 11 通过用户账号 + 时间戳冲突检测解决

### 13.2.1 非事务 replace 策略风险

| 风险 | 说明 | 影响 | 缓解 |
|------|------|------|------|
| **delete 成功但 insert 失败** | save 接口依次执行 upsert → delete → insert。如果 delete 成功而 insert 因网络/Supabase 内部错误失败，云端 tasks 表暂时为空（task_groups 行仍在） | 如果此时用户清除 localStorage 后刷新，会从云端恢复到空任务列表 | ① localStorage 是主存储，用户本地数据不受影响 ② 用户极少在 save 请求进行中的瞬间清除 localStorage ③ 如果发生，用户可重新生成任务 ④ Phase 11 可用 Supabase RPC（`CREATE OR REPLACE FUNCTION save_task_group(...)`）在一个 PostgreSQL 事务中完成全部操作 |
| **upsert 成功但后续失败** | task_groups 行已更新为新 goal，但 tasks 仍是旧的 | 云端 tasks 与 goal 不匹配 | 用户重新生成后自然修复 ⑤ 后续可结合边缘函数重试机制 |

### 13.3 RLS（Row Level Security）

**Phase 10：不开启 RLS。**

理由：
- 使用 Service Role Key 直连，RLS 对其不生效
- 没有 user_id 概念，无法设计有意义的 RLS 策略
- Phase 11 引入 Auth 后，开启 RLS + 使用 anon key + 用户 token

### 13.4 Service Role Key 使用风险

| 风险 | 缓解 |
|------|------|
| Key 泄露到前端 | `NEXT_PUBLIC_` 前缀检查 + code review |
| Key 泄露到 Git | `.env.local` 已在 `.gitignore` |
| Service Role 权限过大 | Phase 10 只有 task_groups + tasks 两张表，Phase 11 限制为 anon key |
| 恶意请求写入大量数据 | API Route 校验 taskGroup 结构 + tasks 数量 ≤ 8 |

### 13.5 Phase 11 登录迁移风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| device_id → user_id 数据迁移 | 老用户登录后看不到旧数据 | Phase 11 首日执行迁移：将 device_id 对应的数据关联到新 user_id |
| RLS 策略变更 | Service Role → anon key + RLS 切换 | Phase 11 分步骤：① 加 user_id 列 ② 写迁移脚本 ③ 开启 RLS ④ 切换为 anon key |
| 多设备数据合并 | 同一用户有多个 device_id 的数据 | Phase 11 提供合并策略（取最新的 / 用户手动选择） |
| 未登录用户的降级 | 如果用户不想登录 | Phase 11 保留 device_id 降级路径（无登录时仍可用本地+云端） |

---

> **文档版本**：V1.0（Phase 10 方案）
> **依赖文档**：Architecture.md V1.2
> **适用范围**：AI Todo Phase 10
> **最后更新**：2026-06-29
