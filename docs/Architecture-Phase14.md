# Architecture Phase 14 — AI 复盘

> **状态**：设计阶段，待 Review 通过后开发
> **依赖**：Phase 13（全部完成并通过验收）
> **对应文档**：docs/PRD-V2.0.md / docs/Roadmap-Phase12-15.md / docs/Architecture-Phase12.md / docs/Architecture-Phase13.md / docs/Future-Architecture-Notes-Phase13-15.md
> **设计日期**：2026-07-01

---

## 目录

- [一、Phase 14 总目标](#一phase-14-总目标)
- [二、不做范围与阶段红线](#二不做范围与阶段红线)
- [三、产品原则](#三产品原则)
- [四、用户流程](#四用户流程)
- [五、AI 复盘触发方式设计](#五ai-复盘触发方式设计)
- [六、API 设计](#六api-设计)
- [七、数据访问与权限设计](#七数据访问与权限设计)
- [八、AI 输入数据设计](#八ai-输入数据设计)
- [九、AI Prompt 设计](#九ai-prompt-设计)
- [十、持久化决策](#十持久化决策)
- [十一、前端 UI 设计](#十一前端-ui-设计)
- [十二、State Management 设计](#十二state-management-设计)
- [十三、错误处理设计](#十三错误处理设计)
- [十四、Token 与成本控制](#十四token-与成本控制)
- [十五、与现有功能的关系](#十五与现有功能的关系)
- [十六、Phase 14 子阶段拆分](#十六phase-14-子阶段拆分)
- [十七、验收标准汇总](#十七验收标准汇总)
- [十八、风险与权衡](#十八风险与权衡)
- [十九、为 Phase 15 预留](#十九为-phase-15-预留)

---

## 一、Phase 14 总目标

### 1.1 一句话目标

让 AI 基于用户当前任务完成情况和 Phase 13 统计结果，给出**短、温和、低压力、行动导向**的反馈。

### 1.2 产品定位

AI Todo 不是普通 Todo List，而是**手机端优先的 AI 行动教练**。

Phase 14 是 V2.0 产品主线中"复盘"环节的首次实现：

```
目标 → AI 拆解 → 执行 → 记录 → 统计 → [复盘] → 智能调整
                                            ↑
                                       Phase 14
```

### 1.3 解决了什么

| 场景 | Phase 13 行为 | Phase 14 行为 |
|------|--------------|--------------|
| 用户完成了今天的 3/5 任务 | 看到统计数字 "60%" | AI 给出温和反馈："今天完成了 3 个任务，已经把目标推进了一步。剩下 2 个可以明天从小步骤继续。" |
| 用户今天还没开始 | StatsBar 显示 "今天还没有开始" | 不显示复盘入口（无任务时不调用 AI） |
| 用户全部完成 | 看到 "100%" | AI 给出简短正反馈 |
| 用户完成率很低 | 看到 "0%" | AI 以支持性表达给出下一步建议 |
| AI 调用失败 | N/A | 显示温和错误提示 + 重试按钮，不崩溃 |

### 1.4 核心设计原则

| 原则 | 说明 |
|------|------|
| **手动触发** | 用户主动点击才调用 AI，不自动生成复盘 |
| **温和** | 不批评、不制造压力、不评价人格 |
| **具体** | 告诉用户完成了什么、可以下一步做什么 |
| **短** | 120–180 字，3 段短句以内 |
| **低耦合** | 不影响任务生成、勾选、清空、历史、统计 |
| **session-aware** | 已登录复盘 user_id 数据，未登录复盘 device_id 数据 |
| **不持久化** | Phase 14 首版复盘结果只存前端 state，不写数据库 |

---

## 二、不做范围与阶段红线

### 2.1 Phase 14 明确不做

| 不做 | 原因 | 归属 Phase |
|------|------|-----------|
| 智能任务调整（自动改任务数量/难度） | 策略调整是 Phase 15 | Phase 15 |
| 修改 generate-tasks 策略 | 同上 | Phase 15 |
| 自动新增/删除/修改任务 | 复盘是只读反馈 | — |
| 心理分析 / 情绪诊断 | 超出产品范围 | — |
| 医疗 / 心理治疗式建议 | 超出产品范围 | — |
| 长篇报告（>180 字） | V2.0 复盘定位为轻量反馈 | — |
| 复杂周报 | 超出 V2.0 范围 | — |
| 排行榜 | 不做社交竞争 | — |
| 社交分享 | 不做社交 | — |
| 通知系统 | 超出 V2.0 范围 | — |
| 多轮 Agent 对话 | 超出 Phase 14 范围 | — |
| 长期用户画像系统 | 超出 V2.0 范围 | — |
| 付费系统 | 超出 V2.0 范围 | — |
| 数据库 schema 变更 | Phase 14 不持久化复盘，不需要新表或新字段 | — |
| 新增 npm 依赖 | 复用现有 AI 调用链路 | — |
| 新增 Supabase 表 | 复盘结果只在前端展示 | — |

### 2.2 阶段越界红线

```
Phase 14 只做：
  ✅ POST /api/task-groups/review（AI 复盘 API）
  ✅ useTaskReview hook（前端复盘状态管理）
  ✅ TaskReviewPanel 组件（复盘入口 + 结果展示）
  ✅ AI Prompt 构建（基于 active task_group + stats）
  ✅ JSON 解析与错误兜底
  ✅ Phase 15 预留字段（suggestedDifficulty / suggestedTaskCountRange）

Phase 14 绝不做：
  ❌ 任何任务自动修改
  ❌ 任何 generate-tasks 策略变更
  ❌ 任何数据库 schema 变更
  ❌ 任何新表创建
  ❌ 任何新 npm 依赖
  ❌ 任何推送通知
  ❌ 任何自动触发 AI 的逻辑
  ❌ 任何心理评估文案
```

---

## 三、产品原则

### 3.1 复盘文案五原则

| # | 原则 | 正面示例 | 反面示例 |
|---|------|---------|---------|
| 1 | **不批评** | "今天完成了 2 个任务，已经把目标往前推了一步。" | ❌ "你今天完成率很低，需要更加努力。" |
| 2 | **行动导向** | "明天可以从最小的一步开始继续。" | ❌ "你最近表现不好。" |
| 3 | **简短** | 3 段短句，≤ 180 字 | ❌ 长篇分析报告 |
| 4 | **承认努力** | "今天全部完成了，节奏很好。" | ❌ "继续保持，不许松懈。" |
| 5 | **不制造压力** | 使用"可以""试试""或许" | ❌ 使用"你应该""你必须""要" |

### 3.2 各完成状态的文案策略

| 完成状态 | 策略 | 语气 |
|---------|------|------|
| 全部完成（100%） | 给正反馈，不夸张 | "今天全部完成了，节奏很好。" |
| 部分完成（≥ 50%） | 先肯定已完成，再指出下一步 | "完成了 X 个任务，推进了目标。剩下 Y 个可以明天继续。" |
| 部分完成（< 50%） | 不批评，用支持性表达 | "今天推进了一部分。明天从最小的一步开始试试看。" |
| 零完成（有任务） | 不批评，建议最小一步 | "今天还没有勾选任务。没关系，从小任务开始会更容易。" |
| 无活跃任务 | 不调用 AI | 直接返回 `NO_ACTIVE_TASK_GROUP` |

---

## 四、用户流程

### 4.1 主流程

```
用户打开 AI Todo
  │
  ├── 生成今日任务（generate-tasks）
  ├── 执行并勾选任务
  │     │
  │     └── StatsBar 实时更新完成率
  │
  ├── 用户滑动到 TaskList 下方
  │     │
  │     └── 看到"生成今日复盘"按钮
  │
  ├── 点击按钮
  │     │
  │     ├── 按钮变为 loading 态（禁用 + spinner）
  │     ├── POST /api/task-groups/review
  │     │     │
  │     │     ├── 成功 → 展示 feedbackText
  │     │     └── 失败 → 展示温和错误 + 重试按钮
  │     │
  │     └── 按钮消失，显示复盘卡片
  │
  ├── 用户继续勾选/取消勾选任务
  │     │
  │     └── taskGroup 变化 → 复盘标记为 stale
  │           │
  │           └── 显示 "任务状态已变化，可重新生成复盘"
  │
  └── 用户清空/开始新一天
        │
        └── 复盘清空（新 taskGroup → 无复盘）
```

### 4.2 登录态流程

```
未登录用户：
  └── 按 deviceId 复盘当前活跃 task_group
        │
        └── 与未登录 task_group / stats / history 数据范围一致

已登录用户：
  └── 按 user_id 复盘当前活跃 task_group
        │
        └── 与已登录 task_group / stats / history 数据范围一致

登录切换：
  └── 登录后 → useTaskReview 自动重置（新身份 → 新复盘）
  └── 登出后 → useTaskReview 自动重置（新 device 身份 → 新复盘）
```

---

## 五、AI 复盘触发方式设计

### 5.1 方案比较

| 维度 | 方案 A：手动点击 | 方案 B：清空后自动触发 | 方案 C：固定轻量入口 |
|------|:---:|:---:|:---:|
| 用户可控 | ✅ 完全可控 | ❌ 用户无感知 | ✅ 可控 |
| Token 成本 | ✅ 按需 | ❌ 每次清空都调用 | ✅ 按需 |
| 打扰程度 | ✅ 不打扰 | ❌ 可能打扰 | ✅ 不打扰 |
| 遗忘风险 | ⚠️ 用户可能忘记 | ✅ 无遗忘风险 | ⚠️ 用户可能忽略 |
| 实现复杂度 | ✅ 简单 | ✅ 中等 | ✅ 简单 |

### 5.2 推荐：方案 A — 手动点击"生成今日复盘"

**理由**：
1. **控制 token 成本**：不自动调用 AI，用户主动需要时才生成。
2. **不打扰用户**：用户正在执行任务时不会被复盘打断。
3. **产品哲学一致**：AI Todo 的 AI 是教练工具，不是自动裁判。
4. **没有任务时不调用**：天然规避空数据场景的 AI 浪费。

### 5.3 首版具体交互

```
┌──────────────────────────────────────────────┐
│                                              │
│  [ 生成今日复盘 ]                   ← 按钮    │
│                                              │
│  点击后 → loading 态 → 展示复盘卡片           │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  💬 今日复盘                           │  │
│  │                                        │  │
│  │  今天完成了 3 个任务，已经把目标往前     │  │
│  │  推进了一步。                          │  │
│  │                                        │  │
│  │  剩下 2 个任务可以从最小的一步开始，    │  │
│  │  明天继续推进。                        │  │
│  │                                        │  │
│  │  你已经连续行动 5 天了，节奏很稳定。    │  │
│  │                                        │  │
│  │  [重新生成]  ← 复盘可能因勾选变化变旧    │  │
│  └────────────────────────────────────────┘  │
│                                              │
└──────────────────────────────────────────────┘
```

---

## 六、API 设计

### 6.1 API 路由

```
Method:   POST
Path:     /api/task-groups/review
Auth:     getAuthenticatedUserId() 决定归属
```

### 6.2 请求参数

```typescript
interface ReviewRequest {
  deviceId?: string;          // 未登录时必传（作为查询 device_id 的键），已登录时忽略
  taskGroupId?: string;       // 可选：指定复盘的任务组 ID。不传时默认取当前 active task_group
  timezoneOffset?: number;    // 用户本地时区偏移量（分钟），默认 -480（UTC+8）
}
```

**字段说明**：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:---:|--------|------|
| `deviceId` | `string` | 未登录时必填 | — | 前端从 `getOrCreateDeviceId()` 获取 |
| `taskGroupId` | `string` | 否 | — | 不传时默认取当前活跃 task_group（`archived_at IS NULL`） |
| `timezoneOffset` | `number` | 否 | `-480` | 前端从 `new Date().getTimezoneOffset()` 获取 |

### 6.3 服务端逻辑

```
1. getAuthenticatedUserId()
   ├── 已登录 → userId = session.user.id
   └── 未登录 → userId = null

2. 验证参数
   ├── 未登录 && !deviceId → 400 INVALID_DEVICE_ID
   ├── timezoneOffset 范围校验（-720 ~ 720，否则使用默认值 -480）
   └── taskGroupId 如果传入 → 校验归属

3. 确定复盘对象 task_group
   ├── 如果传了 taskGroupId：
   │     ├── 查询该 task_group
   │     ├── 校验归属（userId 匹配 user_id，或 deviceId 匹配 device_id + user_id IS NULL）
   │     ├── 不匹配 → 403 UNAUTHORIZED_TASK_GROUP
   │     └── 不存在 → 404 TASK_GROUP_NOT_FOUND
   └── 如果没传 taskGroupId：
         ├── 查询 active task_group（archived_at IS NULL）
         ├── 不存在 → 404 NO_ACTIVE_TASK_GROUP
         └── 存在 → 使用它

4. 读取任务数据
   ├── task_group.goal + task_group.tasks
   ├── 如果 tasks 为空 → 400 NO_TASKS_TO_REVIEW（不调用 AI）

5. 读取 Phase 13 统计数据
   └── 调用 computeAllStats(supabase, ownerFilter, timezoneOffset)

6. 构建 AI Prompt（详见 §9）
   └── 传入 goal + tasks summary + stats summary

7. 调用 AI（服务端发起）
   └── 复用现有 AI API 配置（AI_API_KEY / AI_API_BASE_URL / AI_MODEL）

8. 解析 AI 响应
   ├── 尝试 JSON 解析
   ├── 校验 feedbackText、suggestedDifficulty、suggestedTaskCountRange
   └── 失败 → 500 AI_RESPONSE_INVALID

9. 返回 ReviewResponse
```

### 6.4 返回格式

```typescript
// ─── 成功响应 ───

interface ReviewSuccessResponse {
  success: true;
  data: ReviewData;
}

interface ReviewData {
  feedbackText: string;                            // 人类可读的复盘文案（120-180 字）
  sections: {                                      // 三段式拆分（必填——服务端保证永远返回完整结构）
    summary: string;                               // 今天完成了什么
    encouragement: string;                         // 温和鼓励
    nextStep: string;                              // 下一步建议
  };
  suggestedDifficulty: "lighter" | "normal" | "deeper";    // Phase 15 预留：建议任务难度
  suggestedTaskCountRange: [number, number];               // Phase 15 预留：建议任务数量范围
}
```

**字段说明**：

| 字段 | 用途 | Phase 14 UI 展示 | Phase 15 使用 |
|------|------|:---:|:---:|
| `feedbackText` | 给用户看的复盘文案 | ✅ 展示 | 不直接使用 |
| `sections.summary` | 完成情况总结 | 可选展示 | 不直接使用 |
| `sections.encouragement` | 温和鼓励 | 可选展示 | 不直接使用 |
| `sections.nextStep` | 下一步建议 | 可选展示 | 不直接使用 |
| `suggestedDifficulty` | AI 建议的任务难度 | ❌ 不展示 | ✅ 传给 generate-tasks |
| `suggestedTaskCountRange` | AI 建议的任务数量范围 `[min, max]` | ❌ 不展示 | ✅ 传给 generate-tasks |

**返回示例**：

```json
{
  "success": true,
  "data": {
    "feedbackText": "今天完成了 3 个任务，已经把目标往前推进了一步。剩下 2 个任务可以从最小的一步开始，明天继续推进。你已经连续行动 5 天了，节奏很稳定。",
    "sections": {
      "summary": "今天完成了 3/5 个任务，推进了学习 Next.js 的目标。",
      "encouragement": "已经连续行动 5 天，节奏保持得很好。",
      "nextStep": "剩下 2 个任务可以明天从小步骤开始继续。"
    },
    "suggestedDifficulty": "normal",
    "suggestedTaskCountRange": [3, 5]
  }
}
```

### 6.5 错误格式

延续 Phase 12 / 13 的统一错误格式：

```typescript
// ─── 错误响应 ───

interface ReviewErrorResponse {
  success: false;
  error: {
    code: ReviewErrorCode;
    message: string;
  };
}

type ReviewErrorCode =
  | "INVALID_DEVICE_ID"        // 未登录且未传 deviceId
  | "INVALID_TASK_GROUP_ID"    // taskGroupId 格式无效
  | "TASK_GROUP_NOT_FOUND"     // taskGroupId 对应的记录不存在
  | "UNAUTHORIZED_TASK_GROUP"  // taskGroupId 属于其他用户/设备
  | "NO_ACTIVE_TASK_GROUP"     // 未传 taskGroupId 且当前无活跃任务组
  | "NO_TASKS_TO_REVIEW"       // 活跃任务组存在但 tasks 为空
  | "AI_REVIEW_FAILED"         // AI 调用失败（网络、超时、模型错误）
  | "AI_RESPONSE_INVALID"      // AI 返回非 JSON / 字段缺失 / 枚举非法
  | "RATE_LIMITED"             // 请求过于频繁
  | "INTERNAL_ERROR";          // 未知内部错误
```

### 6.6 错误码与 HTTP 状态码映射

| 错误码 | HTTP 状态码 | 何时使用 |
|------|:---:|------|
| `INVALID_DEVICE_ID` | 400 | 未登录且未传 deviceId |
| `INVALID_TASK_GROUP_ID` | 400 | 传入的 taskGroupId 格式无效（非 UUID） |
| `NO_TASKS_TO_REVIEW` | 400 | 活跃 task_group 存在但 tasks 数组为空 |
| `UNAUTHORIZED_TASK_GROUP` | 403 | taskGroupId 属于其他 user_id / device_id |
| `TASK_GROUP_NOT_FOUND` | 404 | taskGroupId 在数据库中不存在 |
| `NO_ACTIVE_TASK_GROUP` | 404 | 未传 taskGroupId 且无活跃任务组 |
| `RATE_LIMITED` | 429 | 同一用户 60 秒内超过 N 次请求 |
| `AI_REVIEW_FAILED` | 500 | AI API 网络错误 / 超时 / 模型不可用 |
| `AI_RESPONSE_INVALID` | 500 | AI 返回非 JSON 或字段校验失败 |
| `INTERNAL_ERROR` | 500 | 未知异常 |

### 6.7 请求/响应类型定义（追加到 types.ts）

```typescript
// ─── 追加到 src/lib/types.ts ───

export type ReviewErrorCode =
  | "INVALID_DEVICE_ID"
  | "INVALID_TASK_GROUP_ID"
  | "TASK_GROUP_NOT_FOUND"
  | "UNAUTHORIZED_TASK_GROUP"
  | "NO_ACTIVE_TASK_GROUP"
  | "NO_TASKS_TO_REVIEW"
  | "AI_REVIEW_FAILED"
  | "AI_RESPONSE_INVALID"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export type SuggestedDifficulty = "lighter" | "normal" | "deeper";

export interface ReviewSections {
  summary: string;
  encouragement: string;
  nextStep: string;
}

export interface ReviewData {
  feedbackText: string;
  sections: ReviewSections;
  suggestedDifficulty: SuggestedDifficulty;
  suggestedTaskCountRange: [number, number];
}

export interface ReviewSuccessResponse {
  success: true;
  data: ReviewData;
}

export interface ReviewErrorResponse {
  success: false;
  error: {
    code: ReviewErrorCode;
    message: string;
  };
}

export type ReviewResponse = ReviewSuccessResponse | ReviewErrorResponse;
```

### 6.8 API 实现位置

```
src/app/api/task-groups/review/route.ts   ← Phase 14A 新建
```

---

## 七、数据访问与权限设计

### 7.1 完全延续 Phase 11–13 的 session-aware 模型

| 状态 | 查询条件 | 说明 |
|------|---------|------|
| 已登录 | `WHERE task_groups.user_id = session.user.id` | 只复盘自己的数据 |
| 未登录 | `WHERE task_groups.device_id = deviceId AND task_groups.user_id IS NULL` | 只复盘当前设备的数据 |

### 7.2 安全规则

| # | 规则 | 实现 |
|---|------|------|
| 1 | userId 永远从 `getAuthenticatedUserId()` 获取 | review API 不从 body/query 读取 userId |
| 2 | 前端不传 userId | review API 请求体只有 `deviceId`、`taskGroupId`、`timezoneOffset` |
| 3 | 已登录时忽略 body 中的 `deviceId` | API 内部：`if (userId) { /* 使用 userId 过滤 */ }` |
| 4 | taskGroupId 如果传入，必须验证归属 | 比对 task_group.user_id === session.user.id 或 task_group.device_id === deviceId |
| 5 | taskGroupId 不传时，默认取当前活跃 task_group | 查询 `archived_at IS NULL` + 归属过滤，取最新一条 |
| 6 | API 允许复盘 archived task_group | 传入 taskGroupId → 验证归属 → 即使已归档也允许复盘（为未来"复盘历史某一天"兼容）。Phase 14B 首版 UI 不提供复盘历史入口 |
| 7 | API Key 只在服务端使用 | AI 调用在 API Route 内完成，前端不可见 |
| 8 | service_role 只在 API Route 服务端使用 | 同 Phase 11–13 |
| 9 | 错误信息不泄露密钥/SQL/堆栈 | 统一错误消息映射 |

### 7.3 复盘对象规则（统一口径）

Phase 14A API 复盘对象规则：

| 场景 | 行为 |
|------|------|
| 不传 `taskGroupId` | 取当前 active task_group（`archived_at IS NULL`） |
| 传入 `taskGroupId` + 验证归属通过 | 允许复盘，**即使该 task_group 已归档** |
| 传入 `taskGroupId` + 验证归属失败 | 返回 403 `UNAUTHORIZED_TASK_GROUP` |
| 传入 `taskGroupId` + 记录不存在 | 返回 404 `TASK_GROUP_NOT_FOUND` |

设计意图：
- API 层允许复盘 archived task_group，作为未来"复盘历史某一天"的兼容能力
- Phase 14B 首版 UI **不提供**"复盘历史某一天"的入口——按钮只对 active task_group 出现
- 如果未来 UI 需要此功能，不需要改 API，只需前端新增入口

### 7.4 登出行为

```
登出后：
  - session cookie 清除
  - getAuthenticatedUserId() 返回 null
  - review API 回退到 device_id 模式
  - 前端 useTaskReview 自动重置（user?.id 变化触发）
  - user_id 的复盘数据不可见（预期行为）
  - 重新登录后 user_id 数据恢复
```

---

## 八、AI 输入数据设计

### 8.1 主路径：active task_group + stats（不读 history）

Phase 14 首版**默认不读取 history**。复盘基于：
1. 当前 active task_group（goal + tasks）
2. Phase 13 stats（所有 12 个统计字段）

理由：
- 最近 7 天轻量复盘通过 stats 的 `sevenDay.completionRate`、`total.activeDayStreak`、`performanceLabel`、`recentIncompleteTaskCount` 等字段已充分覆盖。
- 不读取完整历史明细，避免 token 成本膨胀。
- 如果后续复盘效果验证需要历史上下文，再按 §8.2 的摘要策略扩展。

### 8.2 备选路径：轻量历史摘要（最多 3–5 条）

如果未来复盘需要感知"用户过去几天做了什么目标"，最多读取最近 3–5 个 archived task_group 的**摘要信息**（不传完整 tasks）：

```typescript
// 摘要格式（仅当需要时）
interface HistorySummaryItem {
  goal: string;                    // 目标文本
  completedCount: number;          // 完成了几个
  totalCount: number;              // 共几个任务
  createdAt: string;               // 创建日期
}
```

**约束**：
- 最多 3–5 条摘要
- 不传完整 tasks 数组
- 不传 task 标题（避免 prompt 过长）
- Phase 14 首版不开启此路径，保留为 Phase 14B/C 可选增强

### 8.3 Prompt 中传入的完整字段

#### 8.3.1 Task 数据（当前活跃 task_group）

```typescript
interface TaskForPrompt {
  title: string;
  completed: boolean;
}
```

传入当前活跃 task_group 的完整 tasks 数组（只有 `title` + `completed`，不含 id、时间戳）。

#### 8.3.2 Stats 数据（从 Phase 13 stats API 获取）

```typescript
interface StatsForPrompt {
  today: {
    completedCount: number;
    totalCount: number;
    completionRate: number | null;
  };
  sevenDay: {
    completedCount: number;
    totalCount: number;
    completionRate: number | null;
  };
  total: {
    totalCompleted: number;
    activeDayStreak: number;
  };
  recentIncompleteTaskCount: number;
  recentAverageTaskCount: number;
  performanceLabel: "稳定行动" | "有点吃力" | "刚刚开始";
}
```

### 8.4 总 Token 估算

| 模块 | 内容 | 估计 token |
|------|------|:---:|
| System prompt | 复盘角色 + 输出规则 | ~80 tokens |
| Task 数据 | 最多 8 条 × (title 约 15 字符 + boolean) | ~80 tokens |
| Stats 数据 | 结构化 JSON | ~100 tokens |
| User prompt wrapper | 固定文案 | ~30 tokens |
| **合计** | | **~300 输入 tokens** |
| AI 输出 | 180 字中文 | ~200 输出 tokens |
| **单次复盘 token 预算** | | **~500 total tokens** |

---

## 九、AI Prompt 设计

### 9.1 System Prompt

```
你是一个温和的 AI 行动教练。你的任务是根据用户今天的任务完成情况和近期统计数据，给出一段简短、温和、行动导向的复盘反馈。

规则：
1. 使用中文。
2. 最多 120-180 字。
3. 不批评用户，不使用"失败""落后""拖延""太差""做得不好"等压力词汇。
4. 如果全部完成（100%）：给予简短正反馈，不夸张。
5. 如果部分完成（> 0%）：先肯定已完成部分，再指出下一步。
6. 如果零完成（有任务但 0%）：不批评，建议从最小一步开始。
7. 如果用户连续行动 ≥ 3 天且完成率 ≥ 70%：认可节奏稳定性。
8. 如果用户完成率 < 50%：温和建议减少任务或从更小目标开始。
9. 最多 3 段短句。
10. 不做心理诊断，不做医疗建议。
11. 根据数据的实际内容给出具体反馈，不要使用空洞的模板话术。

你必须以 JSON 格式输出，格式如下：
{
  "feedbackText": "完整复盘文案，120-180字",
  "sections": {
    "summary": "今天完成了什么，1-2句",
    "encouragement": "温和鼓励，1句",
    "nextStep": "下一步建议，1句"
  },
  "suggestedDifficulty": "lighter" | "normal" | "deeper",
  "suggestedTaskCountRange": [min数量, max数量]
}

suggestedDifficulty 判断标准：
- "lighter"：最近7天完成率 < 50%，或 totalCompleted 极低，建议更轻量的任务
- "deeper"：最近7天完成率 ≥ 80%，连续行动 ≥ 7 天，可以适度增加挑战
- "normal"：其他情况，保持当前节奏

suggestedTaskCountRange 判断标准：
- 默认 [3, 5]
- 最近7天完成率 < 50% → [2, 3]
- 最近7天完成率 ≥ 80% 且 streak ≥ 7 → [5, 7]
- 不要超过 [2, 8] 的范围
```

### 9.2 User Prompt 模板

```
用户今天的目标："{goal}"

任务列表：
{tasksList}

今日统计：
- 完成任务数：{todayCompletedCount}/{todayTotalCount}
- 完成率：{todayCompletionRate}

最近 7 天统计：
- 完成率：{sevenDayCompletionRate}
- 总完成任务数：{totalCompleted}
- 连续行动天数：{activeDayStreak} 天
- 最近未完成任务数：{recentIncompleteTaskCount}
- 最近平均任务数：{recentAverageTaskCount}
- 表现状态：{performanceLabel}

请根据以上数据生成今日复盘反馈。
```

### 9.3 User Prompt 示例填充

```
用户今天的目标："学习 Next.js App Router"

任务列表：
- ✅ 阅读 App Router 文档
- ✅ 理解 Server Component
- ☐ 实践 Data Fetching
- ☐ 配置 Tailwind CSS
- ☐ 部署到 Vercel

今日统计：
- 完成任务数：2/5
- 完成率：40%

最近 7 天统计：
- 完成率：62%
- 总完成任务数：18
- 连续行动天数：5 天
- 最近未完成任务数：10
- 最近平均任务数：5.6
- 表现状态：刚刚开始

请根据以上数据生成今日复盘反馈。
```

### 9.4 预期 AI 输出示例

```json
{
  "feedbackText": "今天完成了 2 个任务，已经推进了学习 Next.js 的目标。最近 7 天完成了 62% 的任务，节奏在慢慢建立。明天可以试试先做 2-3 个小任务，这样更容易完成。",
  "sections": {
    "summary": "今天完成了 2/5 个任务，推进了学习 Next.js 的目标。",
    "encouragement": "最近 7 天完成了 62% 的任务，行动在持续。",
    "nextStep": "明天可以从 2-3 个小任务开始，更容易建立完成感。"
  },
  "suggestedDifficulty": "normal",
  "suggestedTaskCountRange": [3, 4]
}
```

### 9.5 AI 响应解析与校验

服务端收到 AI 响应后，执行严格的 JSON 解析和字段校验：

```
1. 尝试 JSON.parse(rawAIResponse)
   ├── 成功 → 进入字段校验
   └── 失败 → 500 AI_RESPONSE_INVALID

2. 字段校验：
   ├── feedbackText:
   │     ├── 必须是 string
   │     ├── 长度 > 0
   │     └── 长度 ≤ 300 字（放宽以应对模型差异）
   │
   ├── sections:
   │     ├── 如果 AI 原始输出缺失 sections → fallback 为 { summary: "", encouragement: "", nextStep: "" }
   │     ├── sections.summary: string（必填，缺失时 fallback 为 ""）
   │     ├── sections.encouragement: string（必填，缺失时 fallback 为 ""）
   │     └── sections.nextStep: string（必填，缺失时 fallback 为 ""）
   │     └── 前端永远收到完整的 sections 对象（3 个 string 字段），UI 实现更简单
   │
   ├── suggestedDifficulty:
   │     ├── 必须是 string
   │     ├── 必须是 "lighter" | "normal" | "deeper" 之一
   │     └── 否则 → fallback 到 "normal"
   │
   └── suggestedTaskCountRange:
         ├── 必须是长度为 2 的数组
         ├── 元素必须是整数
         ├── range[0] ≥ 2 且 range[1] ≤ 8
         ├── range[0] ≤ range[1]
         └── 否则 → fallback 到 [3, 5]

3. fallback 策略：
   ├── feedbackText 缺失 → 视为 AI_RESPONSE_INVALID（必须字段）
   ├── sections 缺失 → sections 所有字段设为空字符串
   ├── suggestedDifficulty 缺失/非法 → 设为 "normal"
   └── suggestedTaskCountRange 缺失/非法 → 设为 [3, 5]
```

### 9.6 无任务时的早期返回

```
如果 active task_group 存在但 tasks 数组为空：
  → 不调用 AI
  → 直接返回 400 NO_TASKS_TO_REVIEW
  → 理由：没有任务就没有可复盘的内容
```

### 9.7 无活跃 task_group 时的返回

```
如果没有活跃 task_group（archived_at IS NULL）：
  → 不调用 AI
  → 直接返回 404 NO_ACTIVE_TASK_GROUP
  → 前端显示："先生成今日任务，再让 AI 帮你复盘"
```

---

## 十、持久化决策

### 10.1 方案比较

| 维度 | 方案 A：前端 state | 方案 B：localStorage 缓存 | 方案 C：task_groups 加字段 | 方案 D：新增表 |
|------|:---:|:---:|:---:|:---:|
| 实现复杂度 | ✅ 最简单 | ⚠️ 需处理 scope | ❌ 需 schema migration | ❌ 最复杂 |
| 刷新后保留 | ❌ 丢失 | ✅ 保留 | ✅ 保留 | ✅ 保留 |
| 跨设备 | ❌ 不支持 | ❌ 不支持 | ✅ 支持 | ✅ 支持 |
| 不改 schema | ✅ | ✅ | ❌ | ❌ |
| 不改数据库 | ✅ | ✅ | ❌ | ❌ |
| 数据隔离风险 | ✅ 无（state 随组件销毁） | ⚠️ 需 scope key | ✅ 天然隔离 | ✅ 天然隔离 |

### 10.2 推荐：Phase 14 首版 = 方案 A（仅前端 state）

**理由**：
1. Phase 14 首版不修改数据库 schema——明确红线。
2. AI 复盘成本极低（~500 tokens/次），用户重复生成也不构成显著成本。
3. 前端 state 最安全——不存在 scope 串读风险。
4. 符合 Roadmap 建议：Phase 14 先验证复盘效果，不急于持久化。
5. 如果未来复盘需要历史可见，Phase 15+ 单独设计 `task_group_reviews` 表。

### 10.3 localStorage 缓存路径（Phase 14B/C 可评估）

**当前不实现，仅作为架构预留**。如果后续需要 localStorage 缓存：

```
Key 格式（带 scope）：
  - 已登录：review:user:{userId}:taskGroup:{taskGroupId}
  - 未登录：review:device:{deviceId}:taskGroup:{taskGroupId}

Scope 隔离规则：
  - 登录态不读取匿名 cache
  - 匿名态不读取 user cache
  - 登出时清空 user scope cache
```

### 10.4 今后持久化方向

如果 Phase 14 复盘效果验证良好，且用户需要查看历史复盘记录，可在 Phase 15+ 新增：

```sql
-- 示意，不纳入 Phase 14 范围
CREATE TABLE IF NOT EXISTS task_group_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_group_id UUID REFERENCES task_groups(id) ON DELETE CASCADE,
  feedback_text TEXT NOT NULL,
  sections JSONB,
  suggested_difficulty TEXT,
  suggested_task_count_range INT4RANGE,
  user_id UUID,
  device_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Phase 14 不做此表。**

---

## 十一、前端 UI 设计

### 11.1 UI 位置：TaskList 下方、HistoryPanel 上方

```
投票结果：

方案 A（StatsBar 下方、TaskList 上方）：
  ❌ 手机端挤压今日任务主流程
  ❌ "复盘"不应该挡在"执行"前面

方案 B（TaskList 下方、HistoryPanel 上方）：
  ✅ 不挡任务执行 → 用户先完成再复盘
  ✅ 符合"做完后复盘"的认知顺序
  ✅ StatsBar 在 GoalInput 和 TaskList 之间已承担"今日状态"角色
```

**推荐方案 B**。在 page.tsx 中的渲染顺序：

```
GoalInput
StatsBar
NewDayPrompt
TaskList
TaskReviewPanel    ← Phase 14 新增（在此位置）
HistoryPanel
```

### 11.2 组件树

```
page.tsx
├── Header                              (不改)
├── HeroSection                         (不改)
├── GoalInput                           (不改)
├── StatsBar                            (不改 — Phase 13 已有)
├── NewDayPrompt                        (不改)
├── TaskList                            (不改)
├── TaskReviewPanel                 ←  NEW (复盘入口 + 结果展示)
│   ├── ReviewButton                ←  NEW ("生成今日复盘" 按钮)
│   ├── ReviewCard                  ←  NEW (复盘结果卡片)
│   │   ├── feedbackText            (完整文案)
│   │   ├── sections.summary        (可选展示)
│   │   ├── sections.encouragement   (可选展示)
│   │   └── sections.nextStep       (可选展示)
│   ├── ReviewStaleNotice           ←  NEW (任务变化提示)
│   └── ReviewError                 ←  NEW (错误 + 重试)
└── HistoryPanel                        (不改 — Phase 12 已有)
```

### 11.3 UI 状态机

| 状态 | 条件 | UI 展示 |
|------|------|---------|
| **hidden** | 无 active task_group | 不显示任何复盘相关 UI |
| **empty** | 有 active task_group 但无任务（tasks 为空） | 显示 "先生成今日任务，再让 AI 帮你复盘" |
| **ready** | 有 active task_group + tasks > 0 + 未生成复盘 | 显示 "生成今日复盘" 按钮 |
| **loading** | AI 正在生成复盘 | 按钮禁用 + spinner 动画 + "正在生成复盘…" |
| **success** | 复盘已生成 | 显示 ReviewCard（feedbackText + 可选 sections） |
| **stale** | 复盘已生成，但 taskGroup 已变化 | ReviewCard 上方显示 "任务状态已变化，可重新生成复盘" + "重新生成"按钮 |
| **error** | AI 调用失败 | 显示温和错误文案 + "重试"按钮 |

### 11.4 `TaskReviewPanel` 布局

```
┌──────────────────────────────────────────────┐
│                                              │
│  [状态 = ready]                              │
│  ┌────────────────────────────────────────┐  │
│  │        [ 💬 生成今日复盘 ]              │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [状态 = loading]                            │
│  ┌────────────────────────────────────────┐  │
│  │        ◌ 正在生成复盘…                  │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [状态 = success]                            │
│  ┌────────────────────────────────────────┐  │
│  │  💬 今日复盘                           │  │
│  │                                        │  │
│  │  今天完成了 3 个任务，已经把目标往前    │  │
│  │  推进了一步。                          │  │
│  │                                        │  │
│  │  剩下 2 个任务可以从最小的一步开始，   │  │
│  │  明天继续推进。                        │  │
│  │                                        │  │
│  │  你已经连续行动 5 天了，节奏很稳定。    │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [状态 = stale（叠加在 success 上）]          │
│  ┌────────────────────────────────────────┐  │
│  │  ⚠️ 任务状态已变化，可重新生成复盘       │  │
│  │  [重新生成]                            │  │
│  └────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────┐  │
│  │  （原有的 ReviewCard 内容，半透明）      │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  [状态 = error]                              │
│  ┌────────────────────────────────────────┐  │
│  │  ⚠️ 复盘生成失败，请稍后重试              │  │
│  │  [重试]                                │  │
│  └────────────────────────────────────────┘  │
│                                              │
└──────────────────────────────────────────────┘
```

### 11.5 移动端适配

```
移动端（宽度 < 640px）：

┌────────────────────────────┐
│  GoalInput                 │
│  StatsBar (2×2 grid)       │
│  TaskList                  │
│  ┌──────────────────────┐  │
│  │  💬 生成今日复盘      │  │
│  └──────────────────────┘  │
│  HistoryPanel              │
└────────────────────────────┘
```

- ReviewCard 全宽显示，与 TaskList 卡片宽度一致
- 按钮触控区域 ≥ 44×44px
- 复盘文案不换行溢出时使用正常换行，不截断

### 11.6 新组件文件

```
src/components/TaskReviewPanel.tsx   ← Phase 14B 新建
src/hooks/useTaskReview.ts           ← Phase 14B 新建
```

是否拆出独立的 `ReviewCard.tsx`：
- Phase 14 首版建议 TaskReviewPanel 内部包含所有 UI 逻辑（ready/loading/success/stale/error），不额外拆组件。
- 如果后续复盘变得更复杂（如支持多次复盘对比），再拆分。

---

## 十二、State Management 设计

### 12.1 `useTaskReview` hook

```typescript
// src/hooks/useTaskReview.ts — Phase 14B 新建

interface UseTaskReviewReturn {
  review: ReviewData | null;            // 当前复盘数据（null = 未生成）
  isLoading: boolean;                   // AI 正在生成复盘
  error: string | null;                 // 错误信息
  isStale: boolean;                     // 复盘是否因 taskGroup 变化而变旧
  generateReview: () => Promise<void>;  // 手动触发复盘生成
  resetReview: () => void;              // 清空当前复盘
}

function useTaskReview(options: {
  taskGroupId: string | undefined;
  taskGroupUpdatedAt: string | undefined;
  deviceId: string;
  timezoneOffset: number;
}): UseTaskReviewReturn;
```

### 12.2 Hook 内部逻辑

```
useTaskReview 负责：
  ✅ 管理 review state（null → loading → success/error）
  ✅ 管理 isStale 状态（内部根据 taskGroupId / taskGroupUpdatedAt 自动判断）
  ✅ 调用 POST /api/task-groups/review
  ✅ 解析响应并存入 state
  ✅ 错误处理
  ✅ 自动处理 stale：
       - taskGroupId 变化 → resetReview()（新任务组，清空旧复盘）
       - taskGroupUpdatedAt 变化且已有 review → isStale = true
       - 登录/登出变化（user?.id 变化）→ resetReview()

useTaskReview 不暴露：
  ❌ markStale（stale 由 hook 内部自动管理，外部不可手动调用）

useTaskReview 不应该：
  ❌ 修改 taskGroup
  ❌ 修改 tasks
  ❌ 修改 stats
  ❌ 调用 generate-tasks
  ❌ 耦合 useTaskGroup
  ❌ 耦合 useTaskHistory
```

### 12.3 `page.tsx` 胶水层

```typescript
// page.tsx Phase 14 集成（示意）

const {
  // ... 现有 useTaskGroup 返回值
  taskGroup,  // 需要暴露 taskGroup.id 和 taskGroup.updatedAt
} = useTaskGroup();

const taskStats = useTaskStats();

const taskReview = useTaskReview({
  taskGroupId: taskGroup?.id,
  taskGroupUpdatedAt: taskGroup?.updatedAt,
  deviceId: getOrCreateDeviceId(),
  timezoneOffset: new Date().getTimezoneOffset(),
});

// page.tsx 只负责传参，不手动调用 markStale。
// stale 由 useTaskReview 内部根据 taskGroupId / taskGroupUpdatedAt 变化自动管理。

// 渲染：
<StatsBar ... />
<TaskList ... />
{taskGroup ? (
  <TaskReviewPanel
    error={taskReview.error}
    isLoading={taskReview.isLoading}
    isStale={taskReview.isStale}
    onGenerate={taskReview.generateReview}
    onReset={taskReview.resetReview}
    review={taskReview.review}
  />
) : null}
<HistoryPanel ... />
```

### 12.4 Stale 处理策略

以下逻辑全部在 `useTaskReview` 内部实现，外部不暴露 `markStale`：

| 触发条件 | Hook 内部行为 |
|---------|------|
| 用户 toggle 任务后 | taskGroupUpdatedAt 变化 → `isStale = true`。显示 stale 提示，不自动清空 review。 |
| 用户清空任务后 | taskGroupId 变为 undefined → `resetReview()`（清空 review，回到 hidden/empty 状态） |
| 用户重新生成任务后 | taskGroupId 变化 → `resetReview()` + `isStale = false` |
| 用户开始新一天 | 同上（taskGroupId 变化） |
| 用户登录/登出 | `resetReview()`（user?.id 变化 → 新身份新起点） |

**设计原则**：
- Stale 不清空 review 内容——用户可能刚看完复盘还没消化。
- Stale 提示用半透明遮罩 + 文字提示，不遮挡原有内容。
- 用户可以选择忽略 stale、重新生成、或清空复盘。

### 12.5 并发控制

与 Phase 13 `useTaskStats` 的 inflightRef 模式一致：

```typescript
// useTaskReview 内部
const inflightRef = useRef<Promise<void> | null>(null);

const generateReview = useCallback(async () => {
  if (inflightRef.current) {
    return inflightRef.current;  // 复用进行中的请求
  }

  const promise = (async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/task-groups/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: options.deviceId,
          timezoneOffset: options.timezoneOffset,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.success ? "复盘生成失败" : result.error.message);
      }
      setReview(result.data);
      setIsStale(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "复盘生成失败，请稍后重试。");
    } finally {
      setIsLoading(false);
      inflightRef.current = null;
    }
  })();

  inflightRef.current = promise;
  return promise;
}, [options.deviceId, options.taskGroupId, options.timezoneOffset]);
```

---

## 十三、错误处理设计

### 13.1 前端错误文案映射

| 错误码 | 前端展示文案 |
|------|------|
| `NO_ACTIVE_TASK_GROUP` | "还没有今天的任务，先生成任务再让 AI 复盘。" |
| `NO_TASKS_TO_REVIEW` | "还没有任务内容，无法生成复盘。" |
| `AI_REVIEW_FAILED` | "AI 复盘生成失败，请稍后重试。" |
| `AI_RESPONSE_INVALID` | "AI 回复格式异常，请重试。" |
| `RATE_LIMITED` | "请求过于频繁，请稍后再试。" |
| `INTERNAL_ERROR` | "服务异常，请稍后重试。" |
| 网络错误（fetch 异常） | "网络连接失败，请检查网络后重试。" |

### 13.2 服务端错误处理原则

```
1. catch 块不吞错误 → 返回统一 { success: false, error: { code, message } }
2. AI 调用失败：
   - 网络超时（30s timeout）→ AI_REVIEW_FAILED
   - API Key 无效 → AI_REVIEW_FAILED（不暴露 key 细节）
   - 模型不可用 → AI_REVIEW_FAILED
   - 不重试多次（避免 token 浪费）→ 只试 1 次
3. JSON 解析失败：
   - 不把原始 AI 响应返回前端
   - 记录日志 → 返回 AI_RESPONSE_INVALID
4. 不把任何异常堆栈返回前端
```

### 13.3 前端错误处理行为

```
1. 错误显示在 TaskReviewPanel 中（不弹窗、不跳出）
2. 错误不影响 TaskList / StatsBar / HistoryPanel 正常使用
3. "重试"按钮重新调用 generateReview
4. loading 中按钮禁用（防止重复点击 + 重复请求）
5. 错误不影响用户继续执行任务
```

---

## 十四、Token 与成本控制

### 14.1 控制原则

| # | 原则 | 实现 |
|---|------|------|
| 1 | **不自动生成** | 用户手动点击才调用 AI |
| 2 | **没任务不调** | tasks 为空 → 直接返回 `NO_TASKS_TO_REVIEW`，不消耗 token |
| 3 | **输出限制** | System Prompt 要求 120–180 字，`max_tokens` 设为 400（复盘专用，低于 generate-tasks 的 700） |
| 4 | **Prompt 精炼** | 只传 task titles + completed boolean + 核心 stats 字段 |
| 5 | **不传 history** | Phase 14 首版默认不读历史明细 |
| 6 | **前端防抖** | inflightRef 确保同时只有 1 个进行中请求；loading 时按钮禁用 |
| 7 | **不重试失败** | AI 调用失败不自动重试（用户手动点重试） |
| 8 | **冷却时间** | 建议后端加简单 rate limit（见 §14.2） |

### 14.2 Rate Limit 设计

#### 14.2.1 分层防护策略

| 层级 | 机制 | 可靠性 | Phase 14A |
|------|------|:---:|:---:|
| **前端防重复点击** | loading 时按钮禁用 + inflightRef 防并发 | ✅ 可靠 | **必须实现** |
| **RATE_LIMITED 错误码** | 保留在类型定义和错误码表中 | — | **必须保留** |
| **后端 best-effort 内存计数** | 服务端内存 Map，同一 scope 60 秒内最多 3 次请求 | ⚠️ 不可靠 | **可选** |

#### 14.2.2 为什么内存计数不是生产级限流

在 Vercel / Serverless 环境中：
- 每个请求可能命中不同的函数实例（冷启动）
- 内存 Map 不在实例间共享——同一用户连续请求可能打到不同实例，计数器各自独立
- 实例可能随时被回收——计数器随之消失
- **结论**：内存计数只能作为低成本防重复请求保护，不是可靠的生产级限流方案

#### 14.2.3 Phase 14A 实现要求

**必须做**：
- 保留 `RATE_LIMITED` 错误码（types.ts、错误码表、前端文案映射）
- 前端 `useTaskReview` 实现 inflightRef 防重复点击 + loading 时按钮禁用

**可选做（best-effort）**：
- 服务端实现简单内存计数（< 20 行代码）
- scope 定义：已登录 `user:{userId}`，未登录 `device:{deviceId}`
- 超过阈值（60s / 3 次）返回 429 `RATE_LIMITED`

**如果实现 best-effort 内存计数**，超过阈值时应返回 429 `RATE_LIMITED`，前端已有对应错误文案。

**如果不实现**，必须：
- 保留 `RATE_LIMITED` 错误码定义和前端文案映射（预留）
- 前端防重复点击机制仍然生效（inflightRef）
- 不把 rate limit 写入 Phase 14A 验收标准

#### 14.2.4 可靠限流方案（后续评审，非 Phase 14 范围）

以下方案留到后续单独评审，不在 Phase 14 实现：

| 方案 | 复杂度 | 可靠性 |
|------|:---:|:---:|
| Redis / Upstash Redis | 中 | ✅ 可靠（跨实例共享） |
| Supabase 表 + 时间窗口查询 | 中 | ✅ 可靠 |
| Vercel KV | 低 | ✅ 可靠 |
| 外部 API Gateway 限流 | 高 | ✅ 可靠 |

### 14.3 成本估算

```
假设场景：用户每天点击 1 次复盘
  → ~300 input tokens + ~200 output tokens = ~500 tokens/次
  → 30 天 = ~15000 tokens
  → 使用 gpt-4o-mini（约 $0.15/1M input + $0.60/1M output）
     ≈ $0.00015/次，几乎可忽略

假设场景：用户每天重复生成 5 次复盘
  → 2500 tokens/天 → unrate-limited 但 token 成本仍很低
  → 如果 rate limit 配置为 60s 3 次，每天最多约 72 次（极少场景）
```

### 14.4 不在前端暴露的信息

```
❌ 不暴露 AI_API_KEY
❌ 不暴露 AI_API_BASE_URL
❌ 不暴露 AI_MODEL
❌ 不暴露系统 Prompt 文本
❌ 不暴露服务端统计查询细节
```

---

## 十五、与现有功能的关系

### 15.1 与各模块的协作方式

| 模块 | 关系 | 说明 |
|------|------|------|
| **TaskList** | 互不修改 | 复盘不修改任务；任务变化 → 复盘变 stale |
| **StatsBar** | 互不修改 | 统计继续独立运行；复盘读取 stats 作为输入 |
| **HistoryPanel** | 互不修改 | 历史面板继续独立运行 |
| **useTaskGroup** | 写入零耦合 | useTaskGroup 不引入 review 依赖 |
| **useTaskStats** | 写入零耦合 | useTaskStats 不引入 review 依赖 |
| **useTaskHistory** | 写入零耦合 | useTaskHistory 不引入 review 依赖 |
| **Supabase Auth** | 复用 session 获取 | `getAuthenticatedUserId()` 决定复盘数据归属 |
| **DeepSeek / OpenAI-compatible API** | 复用 AI 调用链路 | `AI_API_KEY` / `AI_API_BASE_URL` / `AI_MODEL` 环境变量复用 |
| **localStorage deviceId** | 复用匿名标识 | `getOrCreateDeviceId()` 传递 deviceId 给复盘 API |
| **generate-tasks** | 互不修改 | 复盘不影响任务生成；Phase 15 才加入联动 |

### 15.2 关键隔离规则

```
1. review 不影响 task 保存
2. review 不影响 stats 计算
3. review 不影响 history 查询
4. review 不影响 generate-tasks 逻辑
5. review 不写入数据库
6. page.tsx 作为胶水层协调各模块
7. 不把 review 逻辑塞进 useTaskGroup
8. 不把 review 逻辑塞进 useTaskStats
```

---

## 十六、Phase 14 子阶段拆分

### Phase 14A：AI 复盘 API

**目标**：实现 `POST /api/task-groups/review`，支持 session-aware AI 复盘。

**内容**：
- [ ] 新增 `src/lib/types.ts` 中的 Review 相关类型（`ReviewErrorCode`, `ReviewData`, `ReviewResponse` 等）
- [ ] 新增 `src/app/api/task-groups/review/route.ts`
- [ ] 实现 session-aware 数据查询（task_group + stats）
- [ ] 实现 AI Prompt 构建（复用现有 `callAIService` 或扩展 `ai-client.ts`）
- [ ] 实现 JSON 解析与字段校验 + fallback
- [ ] 实现错误码映射
- [ ] 预留 RATE_LIMITED 错误码与响应路径（best-effort 内存计数可选实现）
- [ ] 手动 curl 测试验证

**允许修改文件**：
- `src/lib/types.ts`（追加类型定义）
- `src/app/api/task-groups/review/route.ts`（新建）
- `src/lib/ai-client.ts`（如需新增 review 专用调用函数）

**禁止**：
- 不创建前端 hook / 组件
- 不修改 useTaskGroup / useTaskStats / useTaskHistory
- 不修改 page.tsx
- 不修改数据库 schema
- 不新增 npm 依赖

**验收标准**：
1. `POST /api/task-groups/review` 返回 200 + 完整 `ReviewData`
2. 已登录复盘 user_id 数据，未登录复盘 device_id 数据
3. 无活跃 task_group 时返回 `NO_ACTIVE_TASK_GROUP`
4. tasks 为空时返回 `NO_TASKS_TO_REVIEW`（不调用 AI）
5. `suggestedDifficulty` 和 `suggestedTaskCountRange` 正确返回
6. AI 响应格式非法时返回 `AI_RESPONSE_INVALID`（不崩溃）
7. 越权访问返回 403 `UNAUTHORIZED_TASK_GROUP`
8. RATE_LIMITED 错误码已定义且前端有对应文案（后端 best-effort 内存计数可选）
9. 不暴露 API Key / 系统 Prompt
10. `npm run lint` + `npm run build` 通过

---

### Phase 14B：AI 复盘 UI

**目标**：前端复盘入口 + 结果展示组件。

**内容**：
- [ ] 新增 `src/hooks/useTaskReview.ts`
- [ ] 新增 `src/components/TaskReviewPanel.tsx`
- [ ] 修改 `src/app/page.tsx`（集成 TaskReviewPanel）
- [ ] 实现 6 种状态（hidden / empty / ready / loading / success / stale / error）
- [ ] 实现 inflightRef 并发控制
- [ ] 实现 stale 检测与提示
- [ ] 移动端 + 桌面端适配

**允许修改文件**：
- `src/hooks/useTaskReview.ts`（新建）
- `src/components/TaskReviewPanel.tsx`（新建）
- `src/app/page.tsx`（集成）

**禁止**：
- 不修改 useTaskGroup / useTaskStats / useTaskHistory 核心逻辑
- 不修改 TaskList / StatsBar / HistoryPanel / Header
- 不修改 review API
- 不引入新 npm 依赖
- 不展示 `suggestedDifficulty` 和 `suggestedTaskCountRange` 给用户

**验收标准**：
1. 有 active task_group 且有 tasks 时显示"生成今日复盘"按钮
2. 点击按钮后显示 loading 态（按钮禁用 + spinner）
3. 复盘成功显示 feedbackText（可选展示 sections）
4. 无任务时不显示复盘入口
5. 无 active task_group 时不显示复盘入口
6. 错误状态显示温和文案 + 重试按钮
7. 任务 toggle 后复盘标记为 stale
8. Stale 状态显示提示 + 重新生成按钮
9. 清空任务后复盘自动清空
10. 登录/登出后复盘自动重置
11. 手机端布局正确（卡片全宽）
12. `npm run lint` + `npm run build` 通过

---

### Phase 14C：集成刷新 + 边界 Cases

**目标**：与现有功能完整集成，验证边界行为。

**内容**：
- [ ] 验证：未登录生成复盘（device_id 模式）
- [ ] 验证：登录生成复盘（user_id 模式）
- [ ] 验证：登录/登出切换后复盘状态正确
- [ ] 验证：0 完成 → 温和复盘文案
- [ ] 验证：部分完成 → 具体建议
- [ ] 验证：全部完成 → 正反馈
- [ ] 验证：AI 异常 → UI 错误提示
- [ ] 验证：RATE_LIMITED 错误码前端文案展示正确（如后端实现了 best-effort 限流）
- [ ] 验证：stats 数据影响复盘语气/建议
- [ ] 验证：连续快速点击 → inflightRef 防重复请求
- [ ] 验证：不影响 TaskList 勾选
- [ ] 验证：不影响 StatsBar 统计
- [ ] 验证：不影响 HistoryPanel 历史
- [ ] 验证：不影响 generate-tasks
- [ ] 验证：不影响清空/开始新一天
- [ ] Token 消耗合理性检查
- [ ] 安全性检查（API Key 不泄露、越权防护）
- [ ] 移动端 UI 完整走查

**禁止**：
- 不新增功能
- 不改 API 签名
- 不进入 Phase 15

**验收标准**：
1. 所有边界 case 通过
2. Phase 11 / 12 / 13 所有功能不受影响（回归验证）
3. 移动端 UI 验收通过
4. Token 消耗在预期范围内
5. `npm run lint` + `npm run build` 通过

---

### Phase 14D：端到端验收 + 最终 Review

**目标**：全链路最终检查。

**内容**：
- [ ] 全流程人工验证：
  - 未登录生成复盘 → 内容正确
  - 登录生成复盘 → 内容正确
  - 登录/登出隔离验证
  - 复盘文案质量检查（真实场景采样：0 完成 / 部分完成 / 全部完成 / 连续 7 天）
  - `suggestedDifficulty` / `suggestedTaskCountRange` 与实际情况一致性
- [ ] 回归验证：Phase 11 / 12 / 13 全部功能
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `git status --short`
- [ ] Final Review checklist 通过
- [ ] 零 P0 / P1 问题

**禁止**：
- 不新增功能
- 不改 API 签名
- 不进入 Phase 15

**验收标准**：
1. 所有人工验收场景通过
2. Phase 11 / 12 / 13 全功能回归通过
3. `npm run lint` + `npm run build` 通过
4. git status 干净

---

## 十七、验收标准汇总

### 17.1 功能验收

| # | 验收项 | 阶段 |
|---|--------|:---:|
| 1 | 未登录可生成复盘 | 14A + 14C |
| 2 | 登录可生成复盘 | 14A + 14C |
| 3 | 登录/未登录数据隔离正确 | 14A + 14C |
| 4 | 没有任务时不调用 AI | 14A |
| 5 | 有任务但 0 完成时能生成温和复盘 | 14C |
| 6 | 部分完成时能生成具体建议 | 14C |
| 7 | 全部完成时能生成正反馈 | 14C |
| 8 | 最近 7 天统计能影响复盘语气或建议 | 14C |
| 9 | API 返回 `suggestedDifficulty` | 14A |
| 10 | API 返回 `suggestedTaskCountRange` | 14A |
| 11 | AI 返回异常时 UI 有错误提示 | 14B |
| 12 | 任务状态变化后复盘不会误导用户（stale 提示） | 14B |
| 13 | 不影响任务生成 | 14C |
| 14 | 不影响勾选 | 14C |
| 15 | 不影响取消勾选 | 14C |
| 16 | 不影响清空 | 14C |
| 17 | 不影响历史 | 14C |
| 18 | 不影响统计 | 14C |
| 19 | 不暴露 API Key | 14A |
| 20 | 复盘文案简短、温和、行动导向 | 14C |
| 21 | 不超过 180 字 | 14A + 14C |
| 22 | `suggestedDifficulty` / `suggestedTaskCountRange` 不展示给用户 | 14B |

### 17.2 质量验收

| # | 验收项 |
|---|--------|
| 23 | `npm run lint` 通过 |
| 24 | `npm run build` 通过 |
| 25 | 手机端可用 |
| 26 | Phase 11 全部功能不受影响（回归） |
| 27 | Phase 12 全部功能不受影响（回归） |
| 28 | Phase 13 全部功能不受影响（回归） |

### 17.3 安全验收

| # | 验收项 |
|---|--------|
| 29 | `SUPABASE_SERVICE_ROLE_KEY` 不出现在前端 bundle |
| 30 | `AI_API_KEY` 不出现在前端 bundle |
| 31 | 前端请求体不含 userId |
| 32 | review API 不能越权复盘其他用户数据 |
| 33 | 登出后 review API 返回 device_id 模式（不暴露 user_id 数据） |
| 34 | 错误信息不泄露密钥/SQL/堆栈 |

### 17.4 Token 验收

| # | 验收项 |
|---|--------|
| 35 | 不自动调用 AI（用户手动触发） |
| 36 | 无任务时不调用 AI |
| 37 | 同一时间只有 1 个进行中的复盘请求（并发控制） |

---

## 十八、风险与权衡

### 18.1 风险矩阵

| # | 风险 | 概率 | 影响 | 缓解措施 |
|---|------|:---:|------|------|
| 1 | **AI 输出不稳定**（非 JSON、错字段、过长文案） | 中 | 用户看到错误/空白 | JSON Schema prompt + 服务端校验 + fallback；非法字段设默认值；只试 1 次 |
| 2 | **文案变得说教或制造压力** | 中 | 用户体验下降、弃用 | System Prompt 强硬约束；Phase 14C 人工采样审核文案质量；禁止压力词汇列表 |
| 3 | **Token 成本意外上升**（用户频繁点击） | 低 | 运营成本增加 | Rate limit（60s 3 次）；inflightRef 防重复；手动触发 |
| 4 | **登录/未登录数据串读**（user_id vs device_id 归属错） | 低 | 数据隐私泄露 | 复用 Phase 11–13 已验证的 session-aware 模型；Phase 14C 隔离验证 |
| 5 | **UI 抢占主流程**（复盘卡片太大或太显眼） | 低 | 手机端体验下降 | TaskList 下方布局；轻度配色；不自动展开 |
| 6 | **刷新丢失复盘**（不持久化，用户刷新后复盘消失） | 低 | 用户需重新生成 | 成本低（~500 tokens），可接受。如果反馈强烈，Phase 14B/C 可加 localStorage 缓存 |
| 7 | **Phase 14 越界进入 Phase 15**（复盘 API 开始调 generate-tasks 逻辑） | 低 | 阶段边界模糊 | 明确红线：review API 绝不调用 generate-tasks；Code Review 时重点检查 |
| 8 | **localStorage cache scope 串读**（如果后续加入缓存） | 低 | 数据隐私 | 当前不做 localStorage；如果未来做，key 必须含 scope（`user:{id}` 或 `device:{id}`） |

### 18.2 权衡记录

| 权衡 | 选择 | 理由 |
|------|------|------|
| 手动触发 vs 自动触发 | 手动触发 | 控制成本 + 不打扰用户 |
| 持久化 vs 不持久化 | 不持久化 | 不改 Schema + 首版验证 AI 效果 |
| 读 history vs 不读 history | 首版不读 | stats 已充分覆盖 7 天趋势；避免 token 膨胀 |
| sections API 必填 vs 可选 | API Response 中 sections 必填（服务端保证），AI 原始输出可缺失 → 服务端 fallback 为 `{ summary: "", encouragement: "", nextStep: "" }` | 前端永远收到完整 sections，UI 实现更简单；AI 输出不稳定时仅 feedbackText 有实质内容 |
| Rate limit 做 vs 不做 | 做简单内存计数 | 代码很少（< 20 行），防重放攻击 |
| 独立 ReviewCard 组件 vs 合并 | 首版合并进 TaskReviewPanel | 复盘逻辑简单，拆分为时尚早 |

---

## 十九、为 Phase 15 预留

### 19.1 Phase 14 交付给 Phase 15 的字段

| 交付物 | 格式 | Phase 15 用途 |
|--------|------|--------------|
| `suggestedDifficulty` | `"lighter" \| "normal" \| "deeper"` | generate-tasks 决定任务拆解粒度 |
| `suggestedTaskCountRange` | `[number, number]`，范围 2–8 | generate-tasks 决定本次生成多少条任务 |
| review API 返回结构 | `ReviewData` | Phase 15 可选择在生成任务前调用复盘获取建议 |

### 19.2 Phase 15 如何使用这些字段

```
Phase 15 generate-tasks 增强后：

1. 服务端读取当前 user/device 的 stats（复用 Phase 13）
2. 【Phase 15 新增】可选：调用 review API 获取最新 suggestedDifficulty + suggestedTaskCountRange
3. 将 suggestedDifficulty 注入 Prompt："建议本次任务难度：{lighter|normal|deeper}"
4. 将 suggestedTaskCountRange 注入 Prompt："建议生成 {min}-{max} 条任务"
5. 保持任务数量在 3–8 条的产品上限内（suggestedTaskCountRange 可建议 2，但 generate-tasks 的 JSON Schema 最大 8）
```

### 19.3 Phase 15 不需要重复实现

Phase 14 已构建的基础设施，Phase 15 可直接复用：

| 基础设施 | Phase 14 产出 | Phase 15 复用方式 |
|---------|--------------|------------------|
| 统计计算 | `stats-calculator.ts`（Phase 13） | 直接调用 `computeAllStats()` |
| AI 调用链路 | `ai-client.ts` | 扩展（复用 baseUrl / apiKey / model 配置） |
| session-aware 数据查询 | review API 的归属过滤模式 | 复制模式到 generate-tasks 增强 |
| JSON 解析 + fallback | review API 的响应校验逻辑 | 参考实现（两套校验规则不同但模式一致） |
| Rate limit | review API 的计数器 | 独立计数或合并 |

---

> **下一阶段**：本文档经 Review 通过后，进入 Phase 14A（AI 复盘 API）。
>
> **关联文档**：
> - `docs/PRD-V2.0.md` — V2.0 产品规划（§10: AI 复盘与反馈设计）
> - `docs/Roadmap-Phase12-15.md` — Phase 12-15 中期路线图（§6: Phase 14 定义）
> - `docs/Architecture-Phase12.md` — Phase 12 技术架构（数据基础）
> - `docs/Architecture-Phase13.md` — Phase 13 技术架构（统计依赖 + §11: 为 Phase 14 预留）
> - `docs/Future-Architecture-Notes-Phase13-15.md` — Phase 13-15 架构备忘录（§4: Phase 14 备忘录）
