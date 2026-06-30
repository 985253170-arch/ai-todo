# Phase 12：历史记录 — 技术架构方案

> **状态**：设计阶段，待 Review 通过后开发
> **依赖**：Phase 11（全部完成并提交）
> **对应文档**：docs/PRD-V2.0.md / docs/Roadmap-Phase12-15.md
> **设计日期**：2026-06-30

---

## 目录

- [一、Phase 12 总目标](#一phase-12-总目标)
- [二、不做范围与阶段红线](#二不做范围与阶段红线)
- [三、数据库设计](#三数据库设计)
- [四、API 设计](#四api-设计)
- [五、数据归属规则](#五数据归属规则)
- [六、localStorage 定位](#六localstorage-定位)
- [七、登录 / 登出 / 迁移后的行为](#七登录--登出--迁移后的行为)
- [八、前端 UI 设计](#八前端-ui-设计)
- [九、空状态 / 加载状态 / 错误状态](#九空状态--加载状态--错误状态)
- [十、移动端适配](#十移动端适配)
- [十一、安全设计](#十一安全设计)
- [十二、子阶段拆分](#十二子阶段拆分)
- [十三、验收标准汇总](#十三验收标准汇总)
- [十四、风险点](#十四风险点)
- [十五、与 Phase 11 的兼容关系](#十五与-phase-11-的兼容关系)
- [十六、为 Phase 13 预留](#十六为-phase-13-预留)

---

## 一、Phase 12 总目标

### 1.1 一句话目标

让用户能看到过去生成过的任务组，知道自己每天推进了什么。

### 1.2 核心问题

Phase 11 的数据模型是"单活跃任务组"——任何时候只有一个 TaskGroup 处于活跃状态。当用户点击"清空"或"开始新一天"时，`DELETE /api/task-group/delete` **硬删除** Supabase 中的 `task_groups` 行和关联的 `tasks` 行。数据永久丢失。

Phase 12 将"销毁式清空"改为"归档式清空"——清空时不再删除数据，而是标记 `archived_at`，数据保留在 Supabase 中，后续可通过历史 API 查询。

### 1.3 解决了什么

| 场景 | Phase 11 行为 | Phase 12 行为 |
|------|--------------|--------------|
| 用户周一生成任务 | 存为活跃 task_group | 同 |
| 周一晚上清空 | DELETE 永久删除 | UPDATE `archived_at = now()` |
| 周二生成新任务 | 新 task_group，旧数据已消失 | 新 task_group，周一数据在历史中 |
| 用户想看周一做了什么 | ❌ 看不到了 | ✅ 从历史加载 |

### 1.4 V2.0 产品主线中的位置

```
目标 → AI 拆解 → 执行 → [记录] → 复盘 → 智能调整
                            ↑
                       Phase 12
```

Phase 12 负责补齐 **记录** 环节。它是 Phase 13（统计）和 Phase 14（AI 复盘）的数据基础。

---

## 二、不做范围与阶段红线

### 2.1 Phase 12 明确不做

| 不做 | 原因 | 归属 Phase |
|------|------|-----------|
| 完成统计卡片（今日完成率 / 7 天趋势） | 统计是 Phase 13 | Phase 13 |
| 最近 7 天完成率 | 同上 | Phase 13 |
| 连续行动天数 | 同上 | Phase 13 |
| AI 复盘 / 今日反馈 | 复盘是 Phase 14 | Phase 14 |
| 智能任务调整 | 策略调整是 Phase 15 | Phase 15 |
| 搜索 / 筛选 / 标签 | 超出 V2.0 范围 | — |
| 历史记录编辑 | 历史是只读的 | — |
| 复杂图表（bar / sparkline / pie） | 统计可视化是 Phase 13 | Phase 13 |
| 多设备冲突合并 | Phase 11 已用 updated_at 覆盖 | — |
| Auth 流程修改 | Phase 11 已稳定 | — |
| `generate-tasks` 策略修改 | Phase 15 才做 | Phase 15 |

### 2.2 阶段越界红线

```
Phase 12 只做：
  ✅ 历史数据持久化存储
  ✅ 历史列表查询 API
  ✅ 历史详情查看 UI
  ✅ 归档（替代硬删除）

Phase 12 绝不做：
  ❌ 任何统计数字（数字在卡片上显示是属于 UI 层的，聚合计算属于统计层）
  ❌ 任何 AI 调用
  ❌ 任何任务生成策略变更
  ❌ 任何图表
```

> **关于卡片上的数字**：历史卡片显示 "完成了 3/5" 是**数据展示**（从存储的 tasks 数组读取 completed 计数），属于 Phase 12。
> "完成率 60%" 同样是数据展示。但 "最近 7 天完成率 62%" 涉及**跨天聚合计算**，属于 Phase 13。

---

## 三、数据库设计

### 3.1 核心决策：复用现有表 vs 新建表

**结论：复用现有 `task_groups` + `tasks` 表，新增 2 个字段。不新建表。**

| 方案 | 评估 |
|------|------|
| 新建 `task_history` 表 | ❌ 与 `task_groups` 结构 90% 重复；需要额外 RLS 策略；写入要跨表事务；PRD 明确建议"优先从 task_groups / tasks 聚合" |
| 复用 `task_groups` + 新增字段 | ✅ 符合 PRD 建议；改动最小；写入路径不变（save API 不受影响）；历史 = 带 `archived_at` 的 task_group |

### 3.2 `task_groups` 新增字段

```sql
-- Phase 12A：在 Supabase SQL Editor 中手动执行
-- 所有语句均可重复执行（幂等）

-- 1. 归档时间戳
--    NULL  = 活跃任务组（今天正在使用的）
--    有值  = 已归档（历史记录）
ALTER TABLE task_groups ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- 2. 索引：按归属 + 归档状态 + 创建时间查询历史列表
CREATE INDEX IF NOT EXISTS idx_task_groups_history
  ON task_groups(user_id, device_id, archived_at, created_at DESC);

-- 3. 索引：按归属 + 活跃状态查询当前任务组（load API 使用）
--    已存在的 idx_task_groups_user_updated 继续使用，Phase 12 只需确保
--    load API 查询条件增加 archived_at IS NULL
CREATE INDEX IF NOT EXISTS idx_task_groups_active
  ON task_groups(user_id, archived_at, updated_at DESC)
  WHERE archived_at IS NULL;
```

**为什么用 `archived_at` 而不是 `status` 枚举**：
- `archived_at` 为 NULL 天然表示"活跃"
- 不需要维护枚举值（active / archived / deleted）
- 同时记录了归档时间（对 Phase 13 统计可能有参考价值）
- Phase 11 代码在不读取 `archived_at` 时完全不受影响——新列的默认值是 NULL，save API 不设置它，旧行自动保持 NULL（活跃状态）

### 3.3 `tasks` 新增字段

```sql
-- Phase 12A：为任务增加完成时间追踪

-- 任务完成时间戳
--    NULL = 未完成
--    有值 = 完成时间
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
```

**为什么需要 `completed_at`**：
- Phase 13 统计需要知道"哪天完成了几个任务"，仅靠 `completed` boolean 无法关联到日期
- `completed_at` 记录了完成动作发生的时间点，是统计"今日完成数"和"连续行动天数"的可靠依据
- Phase 12 先落字段，Phase 13 直接使用

### 3.4 迁移 SQL 汇总

```sql
-- Phase 12A 完整迁移 SQL（在 Supabase SQL Editor 中执行，幂等）

-- task_groups 新增
ALTER TABLE task_groups ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- tasks 新增
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 索引
CREATE INDEX IF NOT EXISTS idx_task_groups_history
  ON task_groups(user_id, device_id, archived_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_groups_active
  ON task_groups(user_id, archived_at, updated_at DESC)
  WHERE archived_at IS NULL;

-- 验证
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'task_groups'
  AND column_name IN ('archived_at');

SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'tasks'
  AND column_name IN ('completed_at');
```

### 3.5 为什么不需要新增 RLS 策略

`task_groups` 和 `tasks` 的 RLS 策略在 Phase 11 已配置：

- `anon` → 全部拒绝
- `authenticated` → 只能操作自己的数据

新增的 `archived_at` 和 `completed_at` 列自动继承现有 RLS 保护。API Route 使用 service_role 绕过 RLS，安全由 `getAuthenticatedUserId()` 保证。

### 3.6 向后兼容性

对于 Phase 11 的现有代码：
- `archived_at` 默认为 NULL → 所有现有 `task_groups` 行自动处于"活跃"状态
- `completed_at` 默认为 NULL → 所有现有 `tasks` 行的完成时间为"未知"
- save API 不写 `archived_at` → 新生成的任务组自动为 NULL（活跃）
- load API 不加过滤 → 行为不变（取最新的 1 条，无论 archived_at 状态）——**Phase 12D 需要修改 load API 增加 `archived_at IS NULL` 条件**

---

## 四、API 设计

### 4.1 API 路由总览

| Method | Route | Phase 11 状态 | Phase 12 变更 |
|--------|-------|:---:|------|
| `POST` | `/api/task-group/save` | 已有 | **内部修改**：增加旧 `completed_at` 读取与保留逻辑（请求/响应签名不变） |
| `GET` | `/api/task-group/load` | 已有 | **修改**：增加 `archived_at IS NULL` 过滤 |
| `POST` | `/api/task-group/delete` | 已有 | **语义变更**：从硬 DELETE 改为 archive（`UPDATE archived_at = NOW()`），路径保留 |
| `POST` | `/api/task-group/migrate` | 已有 | **不改**（archived_at 在迁移时保持原值） |
| `GET` | `/api/task-groups/history` | **新增** | 查询历史任务组列表 |

### 4.2 `GET /api/task-groups/history` — 历史列表

```
Method:   GET
Query:    ?deviceId=xxx&limit=30&cursor=<created_at>&direction=older
           - deviceId: 未登录时必传（作为查询 device_id 的键），已登录时可选（API 内部忽略）
           - limit: 每页数量，默认 30，最大 50
           - cursor: 分页游标（上一页最后一条的 created_at 值），首次请求不传
           - direction: "older" 固定（只支持向下翻页）

Auth:     getAuthenticatedUserId() 决定归属
```

**服务端逻辑**：

```
1. getAuthenticatedUserId()
2. 构建查询：
   - 已登录:
     SELECT tg.id, tg.goal, tg.created_at, tg.updated_at, tg.archived_at,
            ARRAY_AGG(JSON_BUILD_OBJECT(
              'id', t.id, 'title', t.title, 'completed', t.completed,
              'createdAt', t.created_at, 'updatedAt', t.updated_at
            ) ORDER BY t.created_at ASC) AS tasks
     FROM task_groups tg
     LEFT JOIN tasks t ON t.task_group_id = tg.id
     WHERE tg.user_id = $1
       AND tg.archived_at IS NOT NULL     -- 只返回已归档的历史
     GROUP BY tg.id
     ORDER BY tg.created_at DESC
     LIMIT $2
     -- cursor 分页：WHERE tg.created_at < $cursor

   - 未登录:
     WHERE tg.device_id = $1 AND tg.user_id IS NULL
     其余同上

3. 返回:
   {
     success: true,
     data: HistoryTaskGroup[],   // 含 tasks（与 TaskGroup 结构一致）
     hasMore: boolean             // 是否还有更多数据
   }
```

**返回类型**：

```typescript
// 与 TaskGroup 结构一致，无需新 type
// 每个历史条目就是完整的 TaskGroup + tasks
interface HistoryListResponse {
  success: true;
  data: TaskGroup[];
  hasMore: boolean;
}
```

**为什么历史 API 一次返回 tasks 而不是分开**：
- 历史详情不需要单独 API——列表 API 每条记录带完整 tasks
- 单日任务通常 3-8 条，JSON 体积很小（约 2-5 KB），一次返回不构成性能问题
- 减少前端请求次数，历史面板打开即看
- Phase 13 统计 API 会承担聚合计算，无需历史 API 做冗余聚合

**分页方式选择 cursor-based（基于 `created_at`）**：
- `created_at` 天然有序且不可变
- 避免 offset 分页在数据变化时重复/遗漏行的问题
- cursor 传 `created_at` ISO 字符串，服务端用 `<` 比较

### 4.2.1 历史 API 数据口径

**核心规则：只有归档后的任务组才进入历史。**

```
活跃任务组（archived_at IS NULL）
  │
  │  用户点击"清空"或"开始新一天"
  │  → POST /api/task-group/delete
  │  → UPDATE archived_at = NOW()
  │
  ▼
已归档任务组（archived_at IS NOT NULL）
  │
  │  → GET /api/task-groups/history 可查询到
  ▼
```

**口径要点**：

| 场景 | 是否出现在历史 API 中 |
|------|:---:|
| 今天刚生成的任务组（未清空） | ❌ 不出现 — archived_at IS NULL |
| 用户清空后的任务组 | ✅ 出现 — archived_at IS NOT NULL |
| 用户"开始新一天"后的旧任务组 | ✅ 出现 — 同上 |
| Phase 11 遗留数据（从未被清空过） | ❌ 不出现 — archived_at 仍为 NULL |

**为什么活跃任务组不出现在历史里**：
- 历史记录是"过去完成的一天"的概念，不是"当前正在进行的一天"
- 活跃任务组由 `GET /api/task-group/load` 负责（archived_at IS NULL），历史 API 负责已归档的
- 两条 API 职责分离，互不重叠

**Phase 13 统计的数据范围（预留说明）**：
- Phase 13 统计 API 的数据口径与历史 API **不同**
- 统计 API 可以同时读取 `archived_at IS NULL`（活跃）+ `archived_at IS NOT NULL`（历史），覆盖"今天 + 过去 N 天"
- Phase 13 的统计口径在 `Architecture-Phase13.md` 中另行设计，Phase 12 不做统计

### 4.3 `POST /api/task-group/delete` — 语义变更为 archive

> **⚠️ 语义重要变更**：从 Phase 12 起，此 API 的**真实语义是 archive（归档）**，不再是 delete（删除）。
> 
> **路径保留原因**：`POST /api/task-group/delete` 路径保持不变，是为了兼容现有前端调用方（`useTaskGroup` 中的 `deleteTaskGroupFromCloud` 函数）。如果改路径，需要同步修改前端、类型定义、测试用例等多处代码，增加不必要的修改面。
> 
> **代码注释要求**：Phase 12A 修改此 API 时，必须在 route 文件顶部添加注释说明真实语义，避免后续开发者误解为物理删除：
> 
> ```
> // Phase 12: 此 API 的真实语义是 archive（归档），不再是 delete（物理删除）。
> // 路径保留 /api/task-group/delete 是为了兼容现有前端调用方。
> // 归档后 task_group.archived_at 被设置为当前时间，tasks 保留不动。
> // 归档的数据可通过 GET /api/task-groups/history 查询。
> ```
> 
> **行为变更总结**：
> - ❌ 不再执行 `DELETE FROM task_groups`
> - ❌ 不再依赖 `ON DELETE CASCADE` 删除 tasks
> - ✅ 改为 `UPDATE task_groups SET archived_at = NOW()`
> - ✅ tasks 保留不动（不需要任何操作）
> - ✅ 返回值从 `{ success: true }` 改为 `{ success: true, archivedCount: N }`

**当前 Phase 11 逻辑（硬删除）**：

```sql
DELETE FROM task_groups WHERE user_id = $1;          -- 已登录
DELETE FROM task_groups WHERE device_id = $1 AND user_id IS NULL;  -- 未登录
-- tasks 由 ON DELETE CASCADE 自动删除
```

**Phase 12 逻辑（软删除 / 归档）**：

```sql
-- 已登录：归档当前活跃任务组
UPDATE task_groups
SET archived_at = NOW()
WHERE user_id = $1
  AND archived_at IS NULL;          -- 只归档活跃的，不重复归档

-- 未登录：同理
UPDATE task_groups
SET archived_at = NOW()
WHERE device_id = $1
  AND user_id IS NULL
  AND archived_at IS NULL;

-- 返回归档行数
{ success: true, archivedCount: N }
```

**关键设计**：
- 只归档 `archived_at IS NULL` 的行（不重复归档已有历史）
- `tasks` 保留不动——归档只在 `task_groups` 上标记时间戳
- API route 文件和 path 保持不变（`/api/task-group/delete`），外部调用方 `useTaskGroup` 中的 `deleteTaskGroupFromCloud` 函数名不变
- 返回值新增 `archivedCount` 字段，告知调用方归档了几条记录
- route 文件顶部必须添加注释说明"此 API 的真实语义是 archive，路径保留为 delete 是为了兼容"
- **从 Phase 12 起，不再有任何物理删除 `task_groups` / `tasks` 的代码路径**

### 4.4 `GET /api/task-group/load` — 增加活跃过滤

**Phase 11 当前查询**：

```sql
SELECT ... FROM task_groups
WHERE user_id = $1 OR (device_id = $1 AND user_id IS NULL)
ORDER BY updated_at DESC LIMIT 1;
```

**Phase 12 增加条件**：

```sql
SELECT ... FROM task_groups
WHERE (user_id = $1 OR (device_id = $1 AND user_id IS NULL))
  AND archived_at IS NULL              -- 只返回活跃的
ORDER BY updated_at DESC LIMIT 1;
```

**原因**：归档后的任务组不应被 load API 返回。如果用户清空了今天的任务，load 应该返回 null（让前端显示 idle 状态），而不是返回最近的历史记录。

### 4.5 `POST /api/task-group/migrate` — 保持不变

Phase 11E 的 migrate API **不需要修改**：

- 迁移时 `UPDATE task_groups SET user_id = X, device_id = NULL` 不涉及 `archived_at`
- 归档状态在迁移前后保持一致——活跃的保持活跃，已归档的保持已归档
- 迁移后的历史查询按 `user_id` 可以查到所有（含迁移过来的）记录

### 4.6 `POST /api/task-group/save` — 增加 completed_at 保留逻辑

**对外行为**：save API 的请求/响应签名不变，前端 `useTaskGroup` 不需要任何修改。

**内部变更**：tasks 重写前必须先读取旧 `completed_at`，防止数据丢失。

#### 4.6.1 问题

当前 save API 的 tasks 写入流程是：

```
1. upsert task_groups 行
2. DELETE 所有旧 tasks（WHERE task_group_id = $id）
3. INSERT 新 tasks（从前端传来的 taskGroup.tasks）
```

这个流程会**丢失旧的 `completed_at`**——因为旧 tasks 被物理删除后，其 `completed_at` 信息也随之消失。新插入的 tasks 无法区分"刚刚完成的"和"之前就完成的"。

#### 4.6.2 解决方案

在删除旧 tasks **之前**，先读取它们的 `completed_at`，建立映射，然后在新 tasks 插入时根据规则写入正确的 `completed_at`。

#### 4.6.3 完整流程

```
save API 执行顺序（Phase 12A）：

第 1 步：归属校验（同 Phase 11，不变）
  - 已登录：检查 task_group.user_id === session.user.id
  - 未登录：检查 task_group.device_id === deviceId && user_id IS NULL

第 2 步：upsert task_groups 行（不变）
  - taskGroupRow 不含 archived_at
  - taskGroupRow 不含 completed_at（completed_at 在 tasks 表）
  - ─── 注意：如果 Supabase upsert 对未指定列使用 DEFAULT（NULL），
  -      已归档的 task_group 可能在重新生成时被意外取消归档。
  -      Phase 12A 必须验证此行为。如确认有此问题，则改为：
  -      先 SELECT 检查 archived_at，若已有值则保留。───

第 3 步：【新增】读取旧 tasks 的 completed_at
  目的：保存"任务首次完成时间"，不被 DELETE + INSERT 冲掉

  const { data: oldTasks } = await supabase
    .from("tasks")
    .select("id, completed_at")
    .eq("task_group_id", taskGroup.id);

  // 构建映射：task.id → 旧的 completed_at
  const oldCompletedAtMap = new Map<string, string | null>();
  for (const t of oldTasks ?? []) {
    oldCompletedAtMap.set(t.id, t.completed_at);
  }

第 4 步：DELETE 旧 tasks（不变）
  await supabase.from("tasks").delete().eq("task_group_id", taskGroup.id);

第 5 步：【修改】INSERT 新 tasks，附带正确的 completed_at

  const taskRows = taskGroup.tasks.map((task) => {
    const oldCompletedAt = oldCompletedAtMap.get(task.id);

    let completed_at: string | null = null;

    if (task.completed && oldCompletedAt === undefined) {
      // 情况 A：新任务（旧映射中找不到此 id），且已完成
      //          → 写 NOW() 作为首次完成时间
      completed_at = new Date().toISOString();
    } else if (task.completed && oldCompletedAt === null) {
      // 情况 B：旧任务之前未完成（completed_at 为 NULL），现在完成了
      //          → 写 NOW() 作为首次完成时间
      completed_at = new Date().toISOString();
    } else if (task.completed && oldCompletedAt !== null && oldCompletedAt !== undefined) {
      // 情况 C：旧任务之前已完成（completed_at 有值），现在仍然完成
      //          → 保留旧 completed_at，不覆盖
      completed_at = oldCompletedAt;
    } else if (!task.completed) {
      // 情况 D：任务未完成
      //          → 写 NULL
      completed_at = null;
    }

    return {
      id: task.id,
      task_group_id: taskGroup.id,
      title: task.title,
      completed: task.completed,
      completed_at,                               // ← Phase 12 新增
      created_at: task.createdAt,
      updated_at: task.updatedAt,
    };
  });

  await supabase.from("tasks").insert(taskRows);
```

#### 4.6.4 completed_at 决策表

| task.completed | oldCompletedAt（旧值） | completed_at（写入值） | 含义 |
|:---:|:---:|:---:|---|
| `true` | `undefined`（找不到旧 task） | `NOW()` | 新任务首次完成 |
| `true` | `null` | `NOW()` | 旧任务从 ☐ → ✅ 首次完成 |
| `true` | `"2026-06-29T10:00:00Z"` | 保留原值 `"2026-06-29T10:00:00Z"` | 已完成 → 保持完成，不变时间 |
| `false` | 任意 | `NULL` | 取消完成 / 从未完成 |

#### 4.6.5 边界情况

| 场景 | 行为 |
|------|------|
| 用户 toggle 完成 → 保存 | completed_at = NOW()（情况 B） |
| 用户 toggle 取消完成 → 保存 | completed_at = NULL（情况 D） |
| 用户 toggle 完成 → 取消 → 再完成 → 保存 | completed_at = NOW()（情况 B，因为旧值为 NULL） |
| 用户第一天完成 task-A → 第二天清空/重新生成 → task-A 重新出现且已完成 | 如果 task.id 相同 → 保留旧 completed_at（情况 C） |
| 全新 task_group（首次保存，无旧 tasks） | oldCompletedAtMap 为空 → 所有已完成 task 写 NOW()（情况 A） |
| AI 重新生成（同一天 regenerate） | task.id 全部变化 → 旧映射全部 undefined → 新任务按情况 A 处理 |

#### 4.6.6 为什么这对 Phase 13 至关重要

Phase 13 统计需要稳定的完成时间：

- "今天完成了几条任务" → 需要 `completed_at` 在某个日期范围内
- "连续行动天数" → 需要知道每天是否有 `completed_at` 不为 NULL 的任务
- 如果 `completed_at` 每次保存都被覆盖为 NOW()，则第一天完成的任务在第二天保存后看起来像"第二天完成的"
- 保留旧 `completed_at` 确保统计口径稳定

> **Phase 12 只负责写入正确的 `completed_at`，Phase 13 才做统计查询。**

---

## 五、数据归属规则

### 5.1 完全延续 Phase 11D 的 session-aware 模型

| 状态 | `user_id` | `device_id` | `archived_at` | 查询条件 |
|------|-----------|-------------|:---:|------|
| 已登录 + 活跃任务 | `session.user.id` | `NULL` | NULL | `WHERE user_id = X AND archived_at IS NULL` |
| 已登录 + 历史 | `session.user.id` | `NULL` | NOT NULL | `WHERE user_id = X AND archived_at IS NOT NULL` |
| 未登录 + 活跃任务 | `NULL` | `deviceId` | NULL | `WHERE device_id = X AND user_id IS NULL AND archived_at IS NULL` |
| 未登录 + 历史 | `NULL` | `deviceId` | NOT NULL | `WHERE device_id = X AND user_id IS NULL AND archived_at IS NOT NULL` |

### 5.2 归属校验

所有 API Route 的主安全层是 `getAuthenticatedUserId()`——userId 永远从服务端 session cookie 获取，前端不能传 userId。

- History API：同 load API，按 session 归属查询
- Delete/Archive API：同 save API，只能操作自己归属的数据
- 与 Phase 11D 的 403 归属校验模式完全一致

---

## 六、localStorage 定位

### 6.1 localStorage 不存储历史

| 存储层 | 存储内容 | 原因 |
|--------|---------|------|
| `localStorage` | **仅活跃任务组**（Phase 11 行为保持不变） | 快速恢复、离线可用 |
| Supabase `task_groups` | **活跃任务组 + 全部历史** | 持久化、跨设备、历史查询的数据源 |

### 6.2 历史数据流

```
用户生成任务
  │
  ├── localStorage ← 活跃 TaskGroup（scope: user:<id> 或 device:<id>）
  └── Supabase ← 活跃 TaskGroup（archived_at = NULL）

用户清空 / 开始新一天
  │
  ├── localStorage ← 删除活跃 TaskGroup
  └── Supabase ← UPDATE archived_at = NOW()（数据保留为历史）

用户查看历史
  │
  └── Supabase ← GET /api/task-groups/history（localStorage 不参与）
```

### 6.3 Scope 隔离在历史查询中的作用

- 历史查询不需要 localStorage scope
- 前端调用 history API 时，API 内部通过 `getAuthenticatedUserId()` 获取 scope
- 已登录 → 查询 `user_id = session.user.id`
- 未登录 → 前端传 `deviceId`，API 查询 `device_id = X AND user_id IS NULL`

---

## 七、登录 / 登出 / 迁移后的行为

### 7.1 未登录 → 登录

```
1. 用户未登录时有 device_id 的历史记录
2. 用户登录
3. Phase 11E 迁移逻辑触发 → 更新 device_id 的历史 task_groups：
   - user_id = session.user.id
   - device_id = NULL
   - archived_at 保持原值（活跃的仍活跃，已归档的仍已归档）
4. 迁移后：
   - 活跃任务按 user_id 访问
   - 历史记录按 user_id 查询，包含迁移过来的全部记录
```

### 7.2 登录 → 登出

```
1. 用户登录时有 user_id 的历史记录
2. 用户登出
3. supabase.auth.signOut() 清除 session cookie
4. useTaskGroup 自动回退 device_id 模式
5. 历史记录：
   - 按 device_id 查询 → 只能看到当前设备 device_id 的历史
   - user_id 的历史记录不可见（API 返回 null → 无法通过 session 验证）
   - 这是预期行为——历史记录归属账号，登出后不可访问
6. 重新登录同一账号 → 历史记录恢复可见
```

### 7.3 匿名迁移（Phase 11E 兼容）

迁移后 device_id 的历史数据自动归属 user_id：

```
迁移前：
  task_groups:
    id=1, user_id=NULL, device_id=A, archived_at=NULL  (活跃)
    id=2, user_id=NULL, device_id=A, archived_at=T1    (历史)
    id=3, user_id=NULL, device_id=A, archived_at=T2    (历史)

迁移后：
  task_groups:
    id=1, user_id=UX, device_id=NULL, archived_at=NULL  (活跃)
    id=2, user_id=UX, device_id=NULL, archived_at=T1    (历史)
    id=3, user_id=UX, device_id=NULL, archived_at=T2    (历史)

历史查询 GET /api/task-groups/history：
  返回 id=2 和 id=3（archived_at IS NOT NULL + user_id = UX）
```

### 7.4 边界情况

| 场景 | 行为 |
|------|------|
| 未登录，无任何历史 | history API 返回空数组 |
| 登录后，无任何历史 | history API 返回空数组 |
| 登录后，有迁移过来的历史 + 自己的历史 | 全部返回（按 `created_at DESC` 排序） |
| 登出后查看历史 | 只能看到当前 device_id 的历史 |
| 同一账号，不同设备 | 两台设备看到完全相同的历史（按 user_id 查询） |
| 同一设备，切换账号 | 新账号只能看到新账号 user_id 的历史 |

---

## 八、前端 UI 设计

### 8.1 组件树

```
page.tsx
├── Header                          (已有 — 新增 "历史" 按钮)
├── HeroSection                     (已有 — 不改)
├── GoalInput                       (已有 — 不改)
├── NewDayPrompt                    (已有 — 不改 UI，只改行为：调用 archive 而非 delete)
├── LoadingState                    (已有 — 不改)
├── TaskList                        (已有 — 不改)
│   ├── TaskProgress                (已有 — 不改)
│   ├── TaskItem × N                (已有 — 不改)
│   └── CompleteAllPrompt           (已有 — 不改)
├── HistoryPanel                ←  NEW (历史面板，默认折叠)
│   ├── HistoryPanelHeader      ←  NEW (面板标题 + 收起按钮)
│   ├── HistoryItem × N         ←  NEW (单日历史卡片)
│   │   └── HistoryTaskList     ←  NEW (展开后的只读任务列表)
│   ├── HistoryEmpty            ←  NEW (空历史状态)
│   └── HistoryLoadMore         ←  NEW (加载更多按钮)
```

### 8.2 `Header` — 新增入口

```
现有 Header：
┌───────────────────────────────────────────────────┐
│  AI Todo  [今日行动教练]          user@e... [登出]  │
└───────────────────────────────────────────────────┘

Phase 12 Header：
┌───────────────────────────────────────────────────┐
│  AI Todo  [今日行动教练]  [📋 历史]  user@e... [登出]│
└───────────────────────────────────────────────────┘
```

- "历史" 按钮：text-indigo-600 文字按钮，简洁低调
- 点击切换 `HistoryPanel` 展开/折叠
- 未登录用户同样显示此按钮（未登录也有 device_id 历史）
- 不显示 badge 数字（那是 Phase 13 的统计范畴）

### 8.3 `HistoryPanel` — 历史面板

```
┌──────────────────────────────────────────────────┐
│  📋 历史记录                          [收起 ▲]    │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │ 6月30日                                      │ │
│  │ 目标：学习 Next.js App Router                │ │
│  │ 完成了 3/5 项                                │ │
│  │                                    [展开 ▼]  │ │
│  ├──────────────────────────────────────────────┤ │
│  │ 6月29日                                      │ │
│  │ 目标：整理 Supabase Auth 文档                │ │
│  │ 完成了 5/5 项 ✅                             │ │
│  │                                    [收起 ▲]  │ │
│  │ ┌──────────────────────────────────────────┐ │ │
│  │ │ ✅ 阅读 Supabase Auth 文档                │ │ │
│  │ │ ✅ 配置 RLS 策略                          │ │ │
│  │ │ ✅ 实现 Magic Link 登录                   │ │ │
│  │ │ ✅ 测试多设备同步                         │ │ │
│  │ │ ✅ 编写使用说明                           │ │ │
│  │ └──────────────────────────────────────────┘ │ │
│  ├──────────────────────────────────────────────┤ │
│  │ 6月28日                                      │ │
│  │ 目标：复习 TypeScript 泛型                   │ │
│  │ 完成了 2/4 项                                │ │
│  │                                    [展开 ▼]  │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│                    [加载更多]                       │
└──────────────────────────────────────────────────┘
```

**设计要点**：

- 面板位于主内容区下方（在 TaskList 之后），不打断今日任务流程
- 默认**折叠**（用户主动点击 Header 才展开）
- 每条卡片显示：日期、目标文本、完成数/总数
- 点击 "展开" 显示只读任务列表
- 一次只展开一条（手风琴模式），避免列表过长
- 分页：初始 30 条，滚动到底加载更多

### 8.4 `HistoryItem` — 单日历史卡片

**折叠态**：
```
┌────────────────────────────────────────────┐
│  6月30日                                   │
│  目标：学习 Next.js App Router             │
│  完成了 3/5 项                             │
│                                   [展开 ▼] │
└────────────────────────────────────────────┘
```

**展开态**（只读任务列表）：
```
┌────────────────────────────────────────────┐
│  6月30日                                   │
│  目标：学习 Next.js App Router             │
│  完成了 3/5 项                             │
│                                   [收起 ▲] │
│  ┌──────────────────────────────────────┐  │
│  │ ✅ 阅读 App Router 文档              │  │
│  │ ✅ 理解 Server Component             │  │
│  │ ☐ 实践 Data Fetching                │  │
│  │ ✅ 配置 Tailwind CSS                 │  │
│  │ ☐ 部署到 Vercel                     │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

**只读约束**：
- Checkbox 灰色不可点击（或直接用 ✅ / ☐ emoji 替代交互式 checkbox）
- 已完成的标题加 `line-through` 删除线
- 不可 toggle、不可编辑、不可删除
- 数据完全来自 API 返回的 `tasks` 数组

### 8.5 新 Hook: `useTaskHistory`

```
src/hooks/useTaskHistory.ts

导出内容：
  historyList: TaskGroup[]        // 历史任务组列表
  isLoading: boolean              // 首次加载中
  isLoadingMore: boolean          // 加载更多中
  hasMore: boolean                // 是否还有更多数据
  isOpen: boolean                 // 面板是否展开
  error: string | null            // 加载错误信息
  togglePanel(): void             // 切换面板展开/折叠
  loadHistory(): Promise<void>    // 首次加载
  loadMore(): Promise<void>       // 加载更多（分页）
  refreshHistory(): Promise<void> // 强制刷新（用于迁移后重新加载）

内部实现：
  - 调用 GET /api/task-groups/history
  - cursor 分页管理
  - deviceId 从 getOrCreateDeviceId() 获取
  - 用户登录/登出时自动刷新（监听 onAuthStateChange）
```

### 8.6 `useTaskGroup` 修改点

| 方法 | Phase 11 行为 | Phase 12 行为 |
|------|-------------|--------------|
| `handleClearTasks` | `deleteTaskGroupFromCloud()` → 硬删除 | 不变（API 内部改为软删除） |
| `handleStartNewDay` | 同上 | 不变（API 内部改为软删除） |
| `handleToggleTask` | 更新 `completed` boolean | 增加 `completed_at` 写入（在 save 到 Supabase 时自动处理） |

**关键**：`useTaskGroup` 的业务逻辑不需要改——`deleteTaskGroupFromCloud` 仍然调用 `POST /api/task-group/delete`，函数名不变。API Route 内部将行为从硬删除改为软归档。

### 8.7 `save API` 中 `tasks.completed_at` 的写入

> **详细逻辑见 [4.6 `POST /api/task-group/save` — 增加 completed_at 保留逻辑](#46-post-apitasksave--增加-completedat-保留逻辑)。**

前端 `useTaskGroup` 不需要任何修改——`handleToggleTask` 继续更新 `task.completed` 并调用 save API，`completed_at` 的保留和写入由 save API Route 在服务端完成。

**前端不变，后端增强**：
- 前端传来的 `task.completed` boolean → save API 根据旧 `completed_at` 映射决定写入值
- 首次完成 → NOW()
- 保持完成 → 保留旧值
- 取消完成 → NULL
- 找不到旧 task → 按新任务处理（首次完成写 NOW()）

---

## 九、空状态 / 加载状态 / 错误状态

### 9.1 历史面板状态机

| 状态 | 条件 | UI 展示 |
|------|------|---------|
| **折叠** | 面板未展开 | 不显示任何历史内容 |
| **加载中** | 首次请求进行中 | 骨架屏（3 个灰色占位卡片 + 脉冲动画） |
| **空历史** | 请求完成，列表为空 | "📋 还没有历史记录。完成今天的任务后，清空时任务会自动保存到历史。" |
| **有数据** | 请求完成，列表非空 | 历史卡片列表 |
| **加载更多** | 分页请求中 | 底部 "加载中..." spinner |
| **加载错误** | 网络错误 / API 异常 | "加载失败，请稍后重试" + "重试" 按钮 |
| **全部加载** | `hasMore === false` | 底部 "已加载全部历史记录" 灰色文字 |

### 9.2 空状态文案

```
┌──────────────────────────────────────────────────┐
│                                                    │
│                    📋                              │
│          还没有历史记录                             │
│    完成今天的任务后，清空时任务会自动保存到历史。      │
│                                                    │
└──────────────────────────────────────────────────┘
```

### 9.3 加载骨架屏

```
┌──────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────┐ │
│  │ ██████████████                               │ │
│  │ ████████████████████████                     │ │
│  │ ████████████                                │ │
│  ├──────────────────────────────────────────────┤ │
│  │ ██████████████                               │ │
│  │ ████████████████████████                     │ │
│  │ ████████████                                │ │
│  ├──────────────────────────────────────────────┤ │
│  │ ██████████████                               │ │
│  │ ████████████████████████                     │ │
│  │ ████████████                                │ │
│  └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

3 个脉冲灰色块，高度与实际卡片一致。不显示具体文字。

### 9.4 错误状态

```
┌──────────────────────────────────────────────────┐
│                                                    │
│                    ⚠️                              │
│          加载失败                                  │
│          请检查网络连接后重试。                     │
│                                                    │
│              [重试]                                │
└──────────────────────────────────────────────────┘
```

- 错误不阻塞今日任务主流程
- 错误只影响历史面板区域
- 重试按钮重新调用 history API

---

## 十、移动端适配

### 10.1 设计原则

- 历史面板在移动端同样默认折叠
- 展开后历史卡片全宽显示，与今日任务卡片宽度一致
- 手风琴展开的任务列表可滚动，不超出屏幕
- 触控区域足够大（最小 44×44px 可点击区域）
- 文字大小保持可读（不缩小）

### 10.2 移动端布局

```
移动端（宽度 < 640px）：

┌────────────────────────────┐
│  AI Todo  [教练]  [📋]     │   ← Header 紧凑模式
├────────────────────────────┤
│  今日行动计划               │   ← 主内容区
│  ...                       │
├────────────────────────────┤
│  📋 历史记录      [收起]    │   ← 历史面板全宽
│  ┌──────────────────────┐  │
│  │ 6月30日              │  │
│  │ 目标：学习 Next.js   │  │
│  │ 完成了 3/5 项        │  │
│  │              [展开]  │  │
│  └──────────────────────┘  │
│  ...                       │
└────────────────────────────┘
```

### 10.3 触摸交互

- 历史卡片整行可点击展开（不仅仅是 "展开" 文字区域）
- 展开/收起有 `transition` 动画（`max-height` 过渡，约 200ms）
- 手风琴模式：点击新卡片时自动收起上一个展开的卡片
- "加载更多" 按钮在底部居中，足够大的触控区域

---

## 十一、安全设计

### 11.1 安全分层（延续 Phase 11）

| 层级 | 机制 | Phase 12 体现 |
|------|------|--------------|
| **主安全层** | API Route `getAuthenticatedUserId()` | 所有 history / archive API 必须通过 session 验证 |
| **归属校验** | 写入前检查 user_id / device_id | archive API 只归档自己的数据；history API 只查询自己的数据 |
| **防御层** | RLS（service_role 绕过） | 新增列自动继承现有 RLS |

### 11.2 Phase 12 安全规则

| # | 规则 | 实现 |
|---|------|------|
| 1 | 前端不传 userId | history API 不接收 userId 参数——服务端从 session 获取 |
| 2 | 不暴露 service_role key | Phase 11 已保证，Phase 12 不新增前端 Supabase 调用 |
| 3 | 不暴露 token / cookie | Phase 11 已保证 |
| 4 | 不能查看其他用户的历史 | history API 查询强制 `WHERE user_id = session.user.id` |
| 5 | 不能归档其他用户的任务 | archive API 校验 `user_id` / `device_id` 归属 |
| 6 | 登出后不能访问 user_id 历史 | session 清除后 `getAuthenticatedUserId()` 返回 null → API 返回未登录模式（device_id 查询） |
| 7 | 不信任前端传来的 task 数据 | save / archive API 与服务端校验 task_group 归属 |

### 11.3 新增安全审查点

- History API 必须在 `getAuthenticatedUserId()` 返回 null 时走 device_id 路径（不报错，不暴露 user_id 数据）
- Archive API 不能归档非当前用户/设备的 task_group（需比对 user_id/device_id）
- 不新增前端 Supabase client 调用（所有数据操作通过 API Route）

---

## 十二、子阶段拆分

### Phase 12A：数据库迁移 + archive 行为

**目标**：数据库新增字段 + 删除改为归档。

**内容**：
- [ ] Supabase SQL Editor 执行迁移 SQL（archived_at + completed_at + 索引）
- [ ] 修改 `POST /api/task-group/delete`：从 DELETE 改为 UPDATE `archived_at = NOW()` + 返回 `archivedCount`
- [ ] 修改 `GET /api/task-group/load`：增加 `archived_at IS NULL` 过滤
- [ ] 修改 `POST /api/task-group/save`：在 DELETE 旧 tasks 前读取旧 `completed_at` 映射，INSERT 时按决策表写入正确的 `completed_at`
- [ ] 在 delete API route 文件顶部添加语义说明注释（"真实语义是 archive，路径保留为 delete 是为了兼容"）

**禁止**：
- 不创建 history API
- 不创建前端 history 组件
- 不修改 useTaskGroup 逻辑
- 不搞前端 UI

**验收标准**：
1. SQL migration 幂等执行不报错
2. Supabase Dashboard 确认 `archived_at`、`completed_at` 列存在
3. 生成任务 → 清空 → Supabase Dashboard 确认 task_group 的 `archived_at` 不为 NULL
4. 清空后 load API 返回 `data: null`（因为 archived_at IS NULL 过滤）
5. toggle 任务 → Supabase Dashboard 确认 tasks 的 `completed_at` 更新
6. 未登录用户清空行为正常（device_id 模式）
7. `npm run lint` + `npm run build` 通过

---

### Phase 12B：history API

**目标**：新增历史列表查询 API。

**内容**：
- [ ] 新增 `GET /api/task-groups/history` route
- [ ] 实现 cursor-based 分页
- [ ] session-aware 查询（user_id / device_id 隔离）
- [ ] 新增 types.ts 中的 `HistoryListResponse` 类型（如需要）
- [ ] 手动 curl 测试验证

**禁止**：
- 不创建前端 history UI
- 不修改任何组件
- 不创建 useTaskHistory hook

**验收标准**：
1. `GET /api/task-groups/history?deviceId=xxx` 返回 200 + 历史数组
2. 已登录返回 user_id 历史，未登录返回 device_id 历史
3. 分页 cursor 正确工作（`hasMore` 准确）
4. 空历史返回空数组 `[]`，不报错
5. 历史按 `created_at DESC` 排序
6. 每条记录包含完整 tasks 数组
7. 登出后不能访问 user_id 历史
8. `npm run lint` + `npm run build` 通过

---

### Phase 12C：history UI

**目标**：前端历史面板组件 + useTaskHistory hook。

**内容**：
- [ ] 新增 `src/hooks/useTaskHistory.ts`
- [ ] 新增 `src/components/HistoryPanel.tsx`
- [ ] 新增 `src/components/HistoryItem.tsx`
- [ ] 修改 `src/components/Header.tsx`（增加 "历史" 按钮）
- [ ] 修改 `src/app/page.tsx`（集成 HistoryPanel）
- [ ] 手风琴展开/折叠交互
- [ ] 分页加载更多
- [ ] 空状态 / 加载骨架屏 / 错误状态

**禁止**：
- 不做统计数字聚合 UI
- 不做 AI 复盘 UI
- 不引入图表库
- 不引入新 npm 依赖

**验收标准**：
1. Header "历史" 按钮可切换 HistoryPanel 展开/折叠
2. 展开后显示历史卡片列表，按日期倒序
3. 每条卡片显示日期、目标、完成数/总数
4. 点击卡片展开只读任务详情（checkbox 不可交互）
5. 手风琴模式：同时只展开一条
6. 滚动到底 "加载更多" 正常分页
7. 空历史显示空状态文案
8. 加载中显示骨架屏
9. 网络错误显示重试按钮
10. 未登录用户也能查看 device_id 历史
11. 手机端适配正常（卡片全宽、触控区域足够）
12. `npm run lint` + `npm run build` 通过

---

### Phase 12D：端到端集成 + 最终 Review

**目标**：全链路验证 + 边界 case 修复。

**内容**：
- [ ] 全流程人工验证：
  - 未登录生成 → 清空 → 历史可见
  - 登录生成 → 清空 → 历史可见
  - 登录 → 迁移 device 历史 → 历史合并正确
  - 多次清空 → 历史有多条记录
  - 登出 → 历史切换为 device_id 模式
  - 重新登录 → 历史恢复 user_id 模式
  - 空历史状态验证
- [ ] 性能检查：history API 响应 < 500ms（30 条）
- [ ] 移动端 + 桌面端 UI 走查
- [ ] 检查：`archived_at IS NULL` 不影响 Phase 11 的活跃任务恢复流程
- [ ] Final Review checklist 通过
- [ ] 零 P0 / P1 问题

**禁止**：
- 不新增功能
- 不改 API 签名
- 不进入 Phase 13

**验收标准**：
1. 所有边界 case 通过
2. Phase 11 所有功能不受影响（回归验证）
3. 移动端 UI 验收通过
4. `npm run lint` + `npm run build` 通过
5. git status 干净（除 docs 外的变更已提交）

---

## 十三、验收标准汇总

### 13.1 功能验收

| # | 验收项 | 阶段 |
|---|--------|:---:|
| 1 | 清空任务后数据不丢失，可在历史中查看 | 12A |
| 2 | 历史列表按日期倒序展示 | 12B |
| 3 | 每条历史记录显示日期、目标、完成数/总数 | 12C |
| 4 | 点击历史记录可展开只读任务详情 | 12C |
| 5 | 已登录只展示当前 user_id 的历史 | 12B |
| 6 | 未登录只展示当前 device_id 的历史 | 12B |
| 7 | 登出后不显示 user_id 历史 | 12D |
| 8 | 历史数据跨设备同步（同一账号） | 12D |
| 9 | 空历史时有合理空状态 | 12C |
| 10 | 网络错误时有重试机制 | 12C |

### 13.2 质量验收

| # | 验收项 |
|---|--------|
| 11 | `npm run lint` 通过 |
| 12 | `npm run build` 通过 |
| 13 | 手机端可用 |
| 14 | Phase 11 全部功能不受影响（回归） |

### 13.3 安全验收

| # | 验收项 |
|---|--------|
| 15 | `SUPABASE_SERVICE_ROLE_KEY` 不出现在前端 bundle |
| 16 | 前端请求体不含 userId |
| 17 | history API 不能越权返回其他用户数据 |
| 18 | archive API 不能越权归档其他用户数据 |
| 19 | 登出后 history API 返回 device_id 模式（不暴露 user_id 数据） |

---

## 十四、风险点

| # | 风险 | 概率 | 影响 | 缓解措施 |
|---|------|:---:|------|------|
| 1 | **load API 忘记加 `archived_at IS NULL`** → 清空后仍返回历史任务组 | 中 | 用户清空后看到旧任务 | Phase 12A 必须修改 load API；12D 回归验证 |
| 2 | **save API 的 upsert 覆盖 `archived_at`** | 低 | 归档状态被意外重置 | save API 构造的 upsert 对象不包含 `archived_at` 列，upsert 不会覆盖 NULL → 已归档行不受影响。但需要验证 Supabase upsert 行为——如果 upsert 对未指定列使用 DEFAULT，则 archived_at 会被重置为 NULL。**Phase 12A 必须验证此行为** |
| 3 | **大量历史数据影响 load API 性能** | 低 | 查询变慢 | load API 有 `LIMIT 1`，且 `archived_at IS NULL` + 索引确保快速定位活跃行 |
| 4 | **cursor 分页在数据更新时出现重复/遗漏** | 低 | 用户体验瑕疵 | `created_at` 不可变，cursor 用 `<` 比较避免重复；但如果新数据插入比当前 cursor 更早（几乎不可能），会漏一条——影响极小 |
| 5 | **迁移后历史数据 user_id 归属正确但 device_id 历史查询返回空** | 低 | 用户迁移后登出看不到旧历史 | 预期行为——迁移后数据归属 user_id。Phase 12D 文档说明此行为即可 |
| 6 | **`completed_at` 在 undo toggle 时重置不正确** | 低 | 统计数据偏差（Phase 13） | 已通过 4.6 节 completed_at 决策表解决：`completed = true → false` 时置 NULL；`false → true` 首次完成时置 NOW()；`true → true` 保留旧值。Phase 12A 验证 toggle 行为 |

### 风险 2 详细说明：upsert 与 archived_at 的交互

当前 save API 的 upsert：

```typescript
const taskGroupRow = {
  id: taskGroup.id,
  device_id: userId ? null : normalizedDeviceId,
  user_id: userId,
  goal: taskGroup.goal,
  created_at: taskGroup.createdAt,
  updated_at: taskGroup.updatedAt,
  // 注意：没有 archived_at
};

await supabase.from("task_groups").upsert(taskGroupRow);
```

**需要验证**：Supabase 的 upsert 对已有行中没有指定的列，是保留原值还是设为 DEFAULT（NULL）。如果设为 DEFAULT，则已归档的 task_group 在同一天重新生成时会被重置为活跃状态。

**缓解**：如果 Supabase 默认重置未指定列，则需要在 save API 的 upsert 前手动检查该 task_group 是否已归档，如果是则保留 `archived_at` 值。

---

## 十五、与 Phase 11 的兼容关系

| Phase 11 逻辑 | Phase 12 影响 | 变更说明 |
|---------------|:---:|------|
| `task_groups` 表结构 | ⚠️ 新增 1 列 | `archived_at TIMESTAMPTZ` |
| `tasks` 表结构 | ⚠️ 新增 1 列 | `completed_at TIMESTAMPTZ` |
| save API | ⚠️ 内部增强 | upsert 不含新增列，新增旧 completed_at 读取与保留逻辑 |
| load API | ⚠️ 新增过滤条件 | 增加 `archived_at IS NULL` |
| delete API | ⚠️ 行为变更 | DELETE → UPDATE archived_at |
| migrate API | ✅ 不改 | archived_at 保持原值 |
| RLS 策略 | ✅ 不改 | 新增列自动继承 |
| `useTaskGroup` | ✅ 不改 | 调用的 API 函数名和路径不变 |
| `useAuth` / AuthModal | ✅ 不改 | — |
| localStorage scope | ✅ 不改 | — |
| Header 组件 | ⚠️ 新增按钮 | 加一个 "历史" 按钮，不影响现有功能 |
| page.tsx | ⚠️ 新增组件 | 加 HistoryPanel，不影响现有功能 |

**兼容性总结**：Phase 12 对 Phase 11 的修改是"增强型"的——不删除任何逻辑，只增加归档能力和历史查询能力。Phase 11 的 session-aware 数据隔离、前端请求体格式、localStorage 策略全部保留。

---

## 十六、为 Phase 13 预留

Phase 12 完成后，以下数据和字段已就绪，Phase 13 可直接使用：

| 预留内容 | Phase 12 产出 | Phase 13 用途 |
|---------|-------------|--------------|
| `tasks.completed_at` 字段 | 每次 toggle 写入完成时间 | 计算"今日完成数"、"连续行动天数" |
| `task_groups.archived_at` 字段 | 每次清空写入归档时间 | 区分"活跃"和"历史"任务组 |
| `task_groups.created_at` 字段 | Phase 10 已有 | 按日期聚合统计 |
| history API 返回结构 | `TaskGroup[]`（含 tasks） | 统计 API 可直接复用查询逻辑 |
| cursor 分页 | history API 已实现 | 统计 API 可参考分页模式 |

Phase 13 不需要再次修改数据库 schema，统计直接基于 Phase 12 的字段做聚合查询。

---

> **下一阶段**：本文档经 Review 通过后，进入 Phase 12A（数据库迁移 + archive 行为）。
>
> **关联文档**：
> - `docs/PRD-V2.0.md` — V2.0 产品规划
> - `docs/Roadmap-Phase12-15.md` — Phase 12-15 中期路线图
> - `Architecture-Phase11.md` — Phase 11 技术架构（上游依赖）
