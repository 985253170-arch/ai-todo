# 技术架构文档（Architecture.md）

## 目录

- [一、技术栈选择](#一技术栈选择)
- [二、项目目录结构](#二项目目录结构)
- [三、页面组件拆分](#三页面组件拆分)
- [四、状态管理方案](#四状态管理方案)
- [五、数据流设计](#五数据流设计)
- [六、localStorage 保存方案](#六localstorage-保存方案)
- [七、AI API 调用方案](#七ai-api-调用方案)
- [八、API Key 安全方案](#八api-key-安全方案)
- [九、AI Prompt 设计建议](#九ai-prompt-设计建议)
- [十、AI 输出 JSON 解析方案](#十ai-输出-json-解析方案)
- [十一、错误处理方案](#十一错误处理方案)
- [十二、响应式设计建议](#十二响应式设计建议)
- [十三、开发阶段拆分](#十三开发阶段拆分)
- [十四、每个 Phase 的技术实现重点](#十四每个-phase-的技术实现重点)
- [十五、潜在风险与规避方案](#十五潜在风险与规避方案)
- [十六、部署架构](#十六部署架构)
- [十七、Phase 8：任务管理体验升级](#十七phase-8任务管理体验升级)
- [十八、Phase 9：视觉美化--pwa--移动端优化](#十八phase-9视觉美化--pwa--移动端优化)
- [十九、Phase 8 与 Phase 9 关系](#十九phase-8-与-phase-9-关系)

---

## 一、技术栈选择

### 1.1 选型原则

V1.0 技术选型遵循以下原则：

- **简单优先**：适合小白项目，降低学习和调试成本
- **单仓库**：前后端不分离，一个项目完成所有开发
- **无数据库**：V1.0 不使用数据库，仅用浏览器 localStorage
- **安全第一**：AI API Key 绝不暴露在前端

### 1.2 推荐技术栈

| 层级 | 技术 | 版本建议 | 选型理由 |
|------|------|----------|----------|
| **前端框架** | Next.js | `create-next-app` 默认最新版（App Router） | 前后端一体，API Route 可做后端代理；Vercel 一键部署 |
| **语言** | TypeScript | 5.x | 类型安全，减少运行时错误，AI 返回数据结构可定义 interface |
| **样式** | Tailwind CSS | 3.x | 原子化 CSS，快速出样式；响应式内置；适合独立开发 |
| **代码检查** | ESLint | 默认配置 | Next.js 自带，保持代码规范 |
| **包管理** | npm | 最新稳定版 | 项目初始化默认，零额外配置 |
| **AI 服务** | OpenAI API / 兼容接口 | — | 通过后端 API Route 调用，前端不直接接触 |
| **本地存储** | localStorage | 浏览器原生 | V1.0 存储方案，无需数据库 |
| **部署** | Vercel | — | Next.js 原生支持，免费额度足够 V1.0 使用 |

### 1.3 明确不使用

以下技术在 V1.0 中**不使用**：

| 技术 | 不使用原因 |
|------|-----------|
| 数据库（PostgreSQL / Supabase / MySQL 等） | V1.0 用 localStorage，V2.0 再引入 |
| 状态管理库（Redux / Zustand / Jotai） | 单页面简单状态，React useState 足够 |
| 后端框架（Express / Fastify） | Next.js API Route 内建后端能力 |
| 认证服务（NextAuth / Clerk / Auth0） | V1.0 无登录注册 |
| UI 组件库（shadcn/ui / Ant Design 等） | V1.0 统一使用 Tailwind CSS 手写基础组件，不引入第三方 UI 库 |
| 拖拽排序库 | V1.0 不涉及任务排序 |
| 图表库 | V1.0 不涉及数据报表 |

> V1.0 不引入任何第三方 UI 组件库，所有 UI 均由 Tailwind CSS 手写实现，保持项目简单、零额外依赖。

---

## 二、项目目录结构

### 2.1 V1.0 实际目录结构

> 以下为 V1.0 完成后的实际目录结构。与初始设计相比，实际实现中未创建 `useLocalStorage.ts`（其职责已合并到 `storage.ts` 和 `useTaskGroup.ts` 中），`public/` 目录为空（V1.0 无静态资源需求）。

```
ai-todo/
├── .env.local                  # 环境变量（AI API Key），不提交 Git
├── .env.example                # 环境变量示例模板
├── .gitignore                  # Git 忽略规则
├── Architecture.md             # 技术架构文档
├── PRD.md                      # 产品需求文档
├── README.md                   # 项目说明
├── eslint.config.mjs           # ESLint 配置（flat config）
├── next.config.ts              # Next.js 配置
├── postcss.config.mjs          # PostCSS 配置
├── tailwind.config.ts          # Tailwind 配置
├── tsconfig.json               # TypeScript 配置
├── package.json                # 项目依赖
├── package-lock.json           # 依赖锁定
│
├── public/                     # 静态资源（V1.0 为空，V1.2 将加入 PWA 图标和 manifest）
│
└── src/
    ├── app/                    # Next.js App Router 页面
    │   ├── layout.tsx          # 根布局（全局 HTML 结构 + metadata）
    │   ├── page.tsx            # 首页（唯一页面，状态中心）
    │   ├── globals.css         # 全局样式 + Tailwind 指令
    │   │
    │   └── api/                # API Route（后端接口）
    │       └── generate-tasks/ # AI 任务生成接口
    │           └── route.ts    # POST /api/generate-tasks
    │
    ├── components/             # 可复用组件（10 个）
    │   ├── Header.tsx          # 页面顶部（产品名称）
    │   ├── HeroSection.tsx     # 产品介绍区域
    │   ├── GoalInput.tsx       # 目标输入组件（受控组件：输入框 + 按钮）
    │   ├── ExampleGoals.tsx    # 示例目标快捷提示（纯展示）
    │   ├── TaskList.tsx        # 任务列表容器
    │   ├── TaskItem.tsx        # 单条任务项（勾选框 + 标题）
    │   ├── TaskProgress.tsx    # 完成进度（已完成 X / Y）
    │   ├── EmptyState.tsx      # 空状态展示
    │   ├── LoadingState.tsx    # 加载状态展示
    │   └── ErrorMessage.tsx    # 错误提示组件（支持 error/warning/info 三种类型）
    │
    ├── hooks/                  # 自定义 Hooks
    │   └── useTaskGroup.ts     # 任务组状态管理 Hook（142 行，核心状态中心）
    │
    ├── lib/                    # 工具函数与业务逻辑
    │   ├── types.ts            # TypeScript 类型定义
    │   ├── constants.ts        # 常量定义（STORAGE_KEY、UI_TEXT、ERROR_MESSAGES）
    │   ├── storage.ts          # localStorage 操作函数（save/load/remove + type guard 校验）
    │   ├── ai-client.ts        # AI 服务调用封装（3 层 fallback）
    │   ├── task-parser.ts      # AI 返回 JSON 解析与校验（Markdown 清理 + JSON.parse + 正则兜底）
    │   └── input-validator.ts  # 用户输入校验 + 高风险输入检测
    │
    └── prompts/                # AI Prompt 模板
        └── task-generation.ts  # 任务生成 Prompt（System + User + 大目标检测）

### 2.2 目录设计原则

1. **`src/app/`** — Next.js App Router 约定目录，`page.tsx` 是首页，`api/` 下是后端接口
2. **`src/components/`** — 所有 UI 组件按功能拆分，一个文件一个组件
3. **`src/hooks/`** — 状态逻辑抽离到自定义 Hook，保持组件简洁
4. **`src/lib/`** — 纯函数工具，不依赖 React，方便单独测试和复用
5. **`src/prompts/`** — Prompt 模板与组件解耦，方便后续优化 AI 输出质量
6. **`.env.local`** — 环境变量仅存本地，通过 `.gitignore` 排除

### 2.3 V1.0 不需要的目录

以下目录结构 V1.0 暂不需要：

```
# 不需要
├── prisma/              # 数据库 schema（V2.0 需要）
├── middleware.ts         # 认证中间件（V2.0 需要）
├── src/app/login/       # 登录页（V2.0 需要）
├── src/app/history/     # 历史记录页（V2.0 需要）
├── src/app/settings/    # 设置页（V2.0 需要）
```

---

## 三、页面组件拆分

### 3.1 组件树

```
layout.tsx (根布局)
└── page.tsx (首页)
    ├── Header.tsx                    # 产品名称：AI Todo
    ├── HeroSection.tsx              # 一句话介绍
    ├── GoalInput.tsx                # 目标输入框 + AI 拆分按钮
    │   └── ErrorMessage.tsx         # 输入校验错误提示
    ├── ExampleGoals.tsx             # 示例目标提示
    ├── LoadingState.tsx             # AI 生成中加载状态
    ├── TaskList.tsx                 # 任务列表区域
    │   ├── TaskItem.tsx (×N)       # 每条任务
    │   ├── TaskProgress.tsx         # 完成进度
    │   └── EmptyState.tsx           # 空状态
    └── ErrorMessage.tsx             # 全局错误提示
```

### 3.2 组件职责与 Props

#### Header.tsx

```typescript
// 职责：展示产品名称
// Props：无
// 状态：无（纯展示组件）
// 渲染内容：<h1>AI Todo</h1>
```

#### HeroSection.tsx

```typescript
// 职责：展示产品一句话介绍
// Props：无
// 状态：无（纯展示组件）
// 渲染内容：<p>把模糊目标拆成今天可以执行的任务。</p>
```

#### GoalInput.tsx

```typescript
// 职责：渲染输入框与按钮，所有状态由父组件管理（受控组件）
// Props：
//   - value: string                          // 输入框当前值（由 page.tsx 或 useTaskGroup 管理）
//   - onChange: (value: string) => void      // 输入框内容变化回调
//   - onSubmit: () => void                   // 点击按钮回调
//   - isLoading: boolean                     // 是否正在生成
//   - errorMessage: string | null            // 校验/接口错误信息
// 内部状态：无（纯受控组件，不维护内部 inputValue）
// 关键行为：
//   1. 输入框 value 由父组件 Props.value 控制，onChange 向上通知
//   2. 按钮点击调用 onSubmit，校验逻辑在父组件完成
//   3. 加载中 → 按钮禁用，文案变为"生成中..."
```

#### ExampleGoals.tsx

```typescript
// 职责：展示示例目标，降低用户输入门槛
// Props：无（V1.0 纯展示组件，Phase 8 将增加 onClick 回调变为可交互按钮）
// 状态：无
// 示例列表：
//   - 我要学习 Python
//   - 我要准备面试
//   - 我要做一个小项目
//   - 我要减肥
//
// Phase 8 变更：新增 onClick prop，<span> 改为 <button>
```

#### TaskList.tsx

```typescript
// 职责：任务列表容器，管理列表展示逻辑
// Props：
//   - tasks: Task[]                          // 任务数组
//   - onToggleTask: (taskId: string) => void // 切换完成状态回调
// 渲染逻辑：
//   - tasks.length === 0 → 渲染 <EmptyState />
//   - tasks.length > 0  → 渲染 TaskItem 列表 + TaskProgress
```

#### TaskItem.tsx

```typescript
// 职责：单条任务的展示与勾选交互
// Props：
//   - task: Task                             // 任务数据对象
//   - onToggle: (taskId: string) => void     // 勾选/取消勾选回调
// 视觉状态：
//   - task.completed === false → 普通样式，未选中勾选框
//   - task.completed === true  → 勾选框选中，文字删除线 + 灰色弱化
```

#### TaskProgress.tsx

```typescript
// 职责：展示任务完成进度
// Props：
//   - completedCount: number                 // 已完成数量
//   - totalCount: number                     // 总数量
// 渲染内容：已完成 2 / 5
```

#### EmptyState.tsx

```typescript
// 职责：无任务时的空状态展示
// Props：无
// 渲染内容：还没有任务，输入一个目标试试。
```

#### LoadingState.tsx

```typescript
// 职责：AI 生成任务时的加载状态展示
// Props：无
// 渲染内容：AI 正在拆解任务...（可加简单动画）
```

#### ErrorMessage.tsx

```typescript
// 职责：统一错误提示组件
// Props：
//   - message: string                        // 错误文案
//   - type: 'error' | 'warning' | 'info'     // 错误类型（影响颜色）
// 渲染：红色/黄色背景 + 错误文案
```

### 3.3 组件间数据流

```
page.tsx (状态中心)
  │
  ├── inputGoal: string ─────→ GoalInput (受控组件: value + onChange)
  │
  ├── tasks: Task[] ─────────→ TaskList → TaskItem[] + TaskProgress
  │
  ├── isLoading: boolean ────→ GoalInput (按钮禁用) + LoadingState
  │
  ├── error: string | null ──→ ErrorMessage
  │
  └── 回调函数 ─────────────── 子组件向上通知事件
       ├── handleGenerate(goal)  ← GoalInput 点击按钮
       └── handleToggle(id)      ← TaskItem 点击勾选框
```

> **核心原则**：所有状态集中在 `page.tsx`（或通过 `useTaskGroup` Hook），子组件通过 Props 接收数据，通过回调函数向上通知事件。不引入全局状态管理库。

---

## 四、状态管理方案

### 4.1 状态设计

V1.0 只需要管理一组核心状态，使用 React `useState` + 自定义 Hook 即可。

#### 页面状态枚举

```typescript
// lib/types.ts

/** 页面当前所处的状态 */
export type PageStatus =
  | 'idle'        // 初始状态：刚打开页面，还没有任务
  | 'editing'     // 用户正在输入目标
  | 'loading'     // AI 正在生成任务
  | 'success'     // 任务列表展示中
  | 'error'       // AI 调用失败（但用户输入保留）
  | 'parse_error' // AI 返回格式无法解析
```

#### 核心数据模型

```typescript
// lib/types.ts

/** 单条任务 */
export interface Task {
  id: string;          // 唯一标识，如 "task_001"，可用 crypto.randomUUID()
  title: string;       // 任务标题，如 "安装 Python 开发环境"
  completed: boolean;  // 是否已完成
  createdAt: string;   // ISO 时间戳
  updatedAt: string;   // ISO 时间戳
}

/** 一次 AI 拆解生成的完整任务组 */
export interface TaskGroup {
  id: string;          // 任务组唯一 ID
  goal: string;        // 用户输入的原始目标
  tasks: Task[];       // AI 生成的任务列表
  createdAt: string;   // ISO 时间戳
  updatedAt: string;   // ISO 时间戳
}
```

#### 页面状态聚合

```typescript
// hooks/useTaskGroup.ts 内部管理

interface PageState {
  pageStatus: PageStatus;        // 当前页面状态
  taskGroup: TaskGroup | null;   // 当前任务组
  inputGoal: string;             // 输入框中的目标文本
  errorMessage: string | null;   // 错误提示文案
}
```

### 4.2 useTaskGroup Hook 设计

```typescript
// hooks/useTaskGroup.ts

// 对外暴露的接口（V1.0 实际接口 + Phase 8 新增标注）
interface UseTaskGroupReturn {
  // 状态
  pageStatus: PageStatus;
  taskGroup: TaskGroup | null;
  inputGoal: string;
  errorMessage: string | null;

  // 派生状态
  tasks: Task[];                              // taskGroup?.tasks ?? []
  completedCount: number;                     // 已完成任务数
  totalCount: number;                         // 总任务数
  isGenerateDisabled: boolean;                // 按钮是否应禁用

  // 操作方法（V1.0）
  setInputGoal: (goal: string) => void;       // 更新输入框内容
  handleGenerate: () => Promise<void>;        // 点击 AI 拆分按钮
  handleToggleTask: (taskId: string) => void; // 勾选/取消任务

  // Phase 8 新增（V1.1）
  showNewDayPrompt: boolean;                  // 是否显示"新一天"提示
  regenerateError: string | null;             // 重新生成失败的错误
  isAllCompleted: boolean;                    // 是否全部完成
  handleClearTasks: () => void;               // 清空当前任务
  handleRegenerate: () => Promise<void>;      // 重新生成任务
  handleExampleClick: (goal: string) => void; // 示例点击填入
  handleStartNewDay: () => void;              // 开始新一天
}
```

### 4.3 状态转换图

```
           ┌──────────────────────────────────────┐
           │                                      │
           ▼                                      │
  ┌──────────┐   输入有效点击按钮   ┌──────────┐  │
  │  idle /  │ ──────────────────→ │ loading  │  │
  │ editing  │                     └────┬─────┘  │
  └──────────┘                          │        │
       ↑        ┌───────────────────────┤        │
       │        │                       │        │
       │        ▼                       ▼        │
       │  ┌──────────┐            ┌──────────┐   │
       ├──│  error   │ 接口失败   │ success  │   │
       │  └──────────┘ ←───────── └────┬─────┘   │
       │                     │          │        │
       │    用户修改输入     │          │ 勾选    │
       │    重新点击按钮     │          │ 任务    │
       │    ───────────────→│          │         │
       │                     │          ▼         │
       │                     │    ┌──────────┐   │
       │                     │    │ success  │───┘
       │                     │    │(更新完成)│
       │                     │    └──────────┘
       │                     │
       │  清空任务            │
       └─────────────────────┘
```

### 4.4 为什么不用全局状态管理

- V1.0 只有一个页面，无页面间共享状态需求
- 组件树扁平，Props 传递不超过 2 层
- 引入 Redux/Zustand 等会增加概念负担和打包体积
- `useTaskGroup` Hook 已经足够封装所有业务逻辑
- **后续 V2.0 如需跨页面共享状态，可再引入 Zustand（轻量）**

---

## 五、数据流设计

### 5.1 整体数据流

```
┌─────────────────────────────────────────────────────────┐
│                      浏览器                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │              React 前端 (src/app/page.tsx)        │   │
│  │                                                   │   │
│  │  useTaskGroup Hook                                │   │
│  │  ┌──────────┐   ┌──────────┐   ┌──────────┐     │   │
│  │  │ 输入目标  │→  │ 校验输入  │→  │ 调用 API │     │   │
│  │  └──────────┘   └──────────┘   └────┬─────┘     │   │
│  │                                     │            │   │
│  │                          ┌──────────▼────────┐   │   │
│  │                          │ POST /api/         │   │   │
│  │                          │ generate-tasks     │   │   │
│  │                          └──────────┬─────────┘   │   │
│  └─────────────────────────────────────┼─────────────┘   │
│                                        │                  │
│  ┌─────────────────────────────────────▼─────────────┐   │
│  │            Next.js API Route (后端)                 │   │
│  │  ┌──────────────┐   ┌──────────────┐              │   │
│  │  │ 读取 API Key  │→  │ 调用 AI 服务  │              │   │
│  │  │ (环境变量)    │   │ (OpenAI etc.) │              │   │
│  │  └──────────────┘   └──────┬───────┘              │   │
│  └─────────────────────────────┼──────────────────────┘   │
│                                │                          │
│                        ┌───────▼───────┐                  │
│                        │   AI 服务      │                  │
│                        │ (外部)         │                  │
│                        └───────┬───────┘                  │
│                                │                          │
│  返回 JSON 任务列表 ←──────────┘                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  前端解析 JSON → 展示任务列表 → localStorage 保存  │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### 5.2 请求/响应格式

#### 前端 → 后端 API

```
POST /api/generate-tasks
Content-Type: application/json

{
  "goal": "我要学习 Python"
}
```

#### 后端 → AI 服务

由后端 API Route 构造 Prompt，请求 AI 服务（具体格式取决于所选 AI 服务商）。

#### 后端 → 前端（成功响应）

```
HTTP 200
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "group_001",
    "goal": "我要学习 Python",
    "tasks": [
      {
        "id": "task_001",
        "title": "安装 Python 开发环境",
        "completed": false,
        "createdAt": "2026-06-28T10:00:00.000Z",
        "updatedAt": "2026-06-28T10:00:00.000Z"
      },
      {
        "id": "task_002",
        "title": "学习变量和数据类型",
        "completed": false,
        "createdAt": "2026-06-28T10:00:00.000Z",
        "updatedAt": "2026-06-28T10:00:00.000Z"
      }
    ],
    "createdAt": "2026-06-28T10:00:00.000Z",
    "updatedAt": "2026-06-28T10:00:00.000Z"
  }
}
```

#### 后端 → 前端（失败响应）

```
HTTP 500 (或 400)
Content-Type: application/json

{
  "success": false,
  "error": {
    "code": "AI_GENERATION_FAILED",
    "message": "任务生成失败，请稍后重试。"
  }
}
```

### 5.3 错误码定义

| 错误码 | HTTP 状态码 | 说明 | 用户提示 |
|--------|-----------|------|---------|
| `EMPTY_INPUT` | 400 | 输入为空 | 请先输入一个目标。 |
| `INPUT_TOO_SHORT` | 400 | 输入过短 | 请输入更具体的目标，例如：我要学习 Python。 |
| `INPUT_TOO_LONG` | 400 | 输入过长 | 目标描述太长，请简化为一句话。 |
| `HIGH_RISK_INPUT` | 400 | 检测到高风险输入（违法/自伤/伤害等） | 这个目标可能会带来伤害或风险，我不能帮你拆解执行步骤。请换一个安全、积极的目标。 |
| `AI_GENERATION_FAILED` | 500 | AI 接口调用失败 | 任务生成失败，请稍后重试。 |
| `AI_PARSE_FAILED` | 500 | AI 返回格式无法解析 | 任务解析失败，请重新生成。 |
| `NETWORK_ERROR` | 500 | 网络异常 | 网络连接异常，请检查后重试。 |
| `RATE_LIMITED` | 429 | 请求过于频繁 | 操作太频繁，请稍后再试。 |

---

## 六、localStorage 保存方案

> ⚠️ **SSR 安全警告**：所有使用 `localStorage` 的逻辑**必须只在浏览器环境执行**。Next.js 在 SSR / 构建阶段没有 `window` 对象，直接访问 `localStorage` 会导致构建报错或服务端渲染异常。
>
> **防护措施**：
> ```typescript
> // 所有 localStorage 操作前检查运行环境
> const isBrowser = typeof window !== 'undefined';
>
> // 示例：安全的 localStorage 读取
> function safeGetItem(key: string): string | null {
>   if (!isBrowser) return null;
>   return localStorage.getItem(key);
> }
> ```
> - `useEffect` 中的 localStorage 操作天然安全（`useEffect` 只在客户端执行）
> - `lib/storage.ts` 中裸调用的函数需要加 `typeof window !== 'undefined'` 守卫
> - 组件 `useState` 初始值不要从 localStorage 同步读取（改用 `useEffect` 或惰性初始化）

### 6.1 保存策略

V1.0 使用浏览器 localStorage 保存当前任务组。设计原则：

- **只保存当前任务组**，不保留历史
- **自动保存**：生成任务后、勾选任务后、取消勾选后自动写入
- **自动恢复**：页面初始化时自动读取
- **异常容忍**：数据损坏时回到空状态，不崩溃

### 6.2 键名设计

```
localStorage 键名：ai_todo_current_task_group
```

仅使用**一个键**，存储序列化后的 `TaskGroup` JSON。

### 6.3 保存时机

| 时机 | 操作 | 说明 |
|------|------|------|
| AI 生成任务成功 | `saveTaskGroup(taskGroup)` | 存储完整任务组 |
| 用户勾选任务 | `updateTask(taskId, { completed: true })` | 更新单条任务状态 |
| 用户取消勾选 | `updateTask(taskId, { completed: false })` | 更新单条任务状态 |

> **V1.0 实际实现简化**：未实现独立的 `updateTask` 函数。勾选操作由 `useTaskGroup.handleToggleTask` 内部通过 `setTaskGroup` 不可变更新 + 直接调用 `saveTaskGroup(updatedTaskGroup)` 完成，效果等价。
| 用户清空任务 | `removeTaskGroup()` | 删除 localStorage 数据 |
| 用户重新生成 | `saveTaskGroup(newTaskGroup)` | 覆盖旧任务组 |

### 6.4 读取时机

| 时机 | 操作 | 说明 |
|------|------|------|
| 页面初始化 | `loadTaskGroup()` | 读取并校验，恢复上次任务 |
| 不存在数据 | 返回 `null` | 展示空状态 |
| 数据损坏 | 返回 `null` + 清除损坏数据 | 展示空状态，不崩溃 |

### 6.5 核心函数设计

```typescript
// lib/storage.ts

const STORAGE_KEY = 'ai_todo_current_task_group';

/**
 * 检查是否在浏览器环境
 * 所有 localStorage 操作前必须调用此守卫
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * 保存任务组到 localStorage
 * 失败时不抛异常，控制台 warn
 */
function saveTaskGroup(taskGroup: TaskGroup): boolean {
  if (!isBrowser()) return false;
  try {
    const json = JSON.stringify(taskGroup);
    localStorage.setItem(STORAGE_KEY, json);
    return true;
  } catch (error) {
    console.warn('保存任务失败:', error);
    return false; // 可能是 localStorage 满或隐私模式限制
  }
}

/**
 * 从 localStorage 读取并校验任务组
 * 数据完整 → 返回 TaskGroup
 * 数据缺失/损坏 → 清除数据，返回 null
 */
function loadTaskGroup(): TaskGroup | null {
  if (!isBrowser()) return null;
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return null;

    const data = JSON.parse(json);

    // === 数据校验 ===
    if (!data || typeof data !== 'object') throw new Error('数据格式错误');
    if (!data.id || !data.goal || !Array.isArray(data.tasks)) throw new Error('缺少必需字段');

    for (const task of data.tasks) {
      if (!task.id || !task.title || typeof task.completed !== 'boolean') {
        throw new Error('任务数据格式错误');
      }
    }

    return data as TaskGroup;
  } catch (error) {
    console.warn('读取任务数据失败，将清除异常数据:', error);
    // 清除损坏数据，防止持续报错
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    return null;
  }
}

/**
 * 更新单条任务的部分字段
 * 注意：V1.0 未实现此函数，实际采用更简单的方案：
 * useTaskGroup.handleToggleTask 内部 setTaskGroup + saveTaskGroup
 */
function updateTask(taskId: string, updates: Partial<Task>): TaskGroup | null {
  const group = loadTaskGroup();
  if (!group) return null;

  const taskIndex = group.tasks.findIndex(t => t.id === taskId);
  if (taskIndex === -1) return null;

  group.tasks[taskIndex] = {
    ...group.tasks[taskIndex],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  group.updatedAt = new Date().toISOString();

  saveTaskGroup(group);
  return group;
}

/**
 * 删除任务组
 */
function removeTaskGroup(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}
```

### 6.6 数据校验规则

读取 localStorage 时必须逐层校验，防止脏数据导致页面崩溃：

1. `json` 不为 null
2. `JSON.parse` 成功
3. `data` 是对象 且不为 null
4. `data.id` 存在且为 string
5. `data.goal` 存在且为 string
6. `data.tasks` 存在且为 Array
7. 每条 task 包含 `id`(string)、`title`(string)、`completed`(boolean)

**任何校验失败 → 清除数据 → 返回 null → 展示空状态**

---

## 七、AI API 调用方案

### 7.1 架构图

```
浏览器前端                    Next.js 后端                  外部 AI 服务
┌──────────┐    HTTP POST    ┌──────────────┐   HTTPS    ┌──────────┐
│ page.tsx │ ───────────────→│ API Route     │ ─────────→ │ OpenAI / │
│          │                 │ /api/         │            │ 兼容接口  │
│          │ ←───────────────│ generate-tasks│ ←───────── │          │
│          │   JSON 响应     │              │   JSON     │          │
└──────────┘                 └──────────────┘            └──────────┘
                                   │
                                   │ process.env
                                   │ AI_API_KEY
```

### 7.2 前端调用代码示例

```typescript
// hooks/useTaskGroup.ts 中调用

async function generateTasks(goal: string): Promise<TaskGroup> {
  const response = await fetch('/api/generate-tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = errorData?.error?.message || '任务生成失败，请稍后重试。';
    throw new Error(message);
  }

  const result = await response.json();
  return result.data as TaskGroup;
}
```

### 7.3 后端 API Route 实现概要

```typescript
// app/api/generate-tasks/route.ts

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // 1. 解析请求体
    const body = await request.json();
    const { goal } = body;

    // 2. 校验输入
    if (!goal || goal.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'EMPTY_INPUT', message: '请先输入一个目标。' } },
        { status: 400 }
      );
    }
    if (goal.trim().length === 1) {
      return NextResponse.json(
        { success: false, error: { code: 'INPUT_TOO_SHORT', message: '请输入更具体的目标，例如：我要学习 Python。' } },
        { status: 400 }
      );
    }
    if (goal.trim().length > 100) {
      return NextResponse.json(
        { success: false, error: { code: 'INPUT_TOO_LONG', message: '目标描述太长，请简化为一句话。' } },
        { status: 400 }
      );
    }

    // 3. 读取 API Key（从环境变量）
    const apiKey = process.env.AI_API_KEY;
    if (!apiKey) {
      console.error('AI API Key 未配置');
      return NextResponse.json(
        { success: false, error: { code: 'AI_GENERATION_FAILED', message: '任务生成失败，请稍后重试。' } },
        { status: 500 }
      );
    }

    // 4. 高风险输入检测（在调用 AI 之前）
    const riskCheck = checkRiskInput(goal);
    if (riskCheck.isRisk) {
      return NextResponse.json(
        { success: false, error: { code: 'HIGH_RISK_INPUT', message: '这个目标可能会带来伤害或风险，我不能帮你拆解执行步骤。请换一个安全、积极的目标。' } },
        { status: 400 }
      );
    }

    // 5. 构造 Prompt
    const prompt = buildPrompt(goal);

    // 6. 调用 AI 服务
    const aiResponse = await callAIService(apiKey, prompt);

    // 7. 解析 AI 返回 JSON
    const tasks = parseAIResponse(aiResponse, goal);

    // 8. 构造 TaskGroup 并返回
    const taskGroup: TaskGroup = {
      id: generateId(),
      goal: goal.trim(),
      tasks: tasks.map(title => ({
        id: generateId(),
        title,
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, data: taskGroup });

  } catch (error) {
    console.error('生成任务失败:', error);
    return NextResponse.json(
      { success: false, error: { code: 'AI_GENERATION_FAILED', message: '任务生成失败，请稍后重试。' } },
      { status: 500 }
    );
  }
}
```

### 7.4 AI 服务调用封装

根据实际使用的 AI 服务商，封装为统一接口：

```typescript
// lib/ai-client.ts

/**
 * 调用 AI 服务生成任务
 * 此函数封装具体的 AI 服务调用细节
 * 支持 OpenAI、Azure OpenAI、或其他兼容接口
 */
async function callAIService(apiKey: string, prompt: string): Promise<string> {
  // 示例：使用 OpenAI API
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // 推荐使用性价比高的模型
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI 服务返回错误: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
```

### 7.5 AI 模型推荐

| 模型 | 推荐度 | 理由 |
|------|--------|------|
| **gpt-4o-mini** | ⭐⭐⭐ (首选) | 性价比极高，任务拆解能力足够，Token 便宜 |
| gpt-4o | ⭐⭐ | 质量更高但成本高，非必要 |
| claude-3-haiku | ⭐⭐ | 速度快，成本低 |
| DeepSeek-V3 | ⭐⭐ | 国内服务，价格低 |
| 通义千问 / 文心一言 | ⭐ | 需要适配接口格式，可作为备选 |

> V1.0 推荐使用 **gpt-4o-mini**，单次调用成本极低，任务拆解质量足够。

---

## 八、API Key 安全方案

### 8.1 安全原则

> **API Key 绝对不能出现在浏览器能访问到的任何地方。**

### 8.2 安全措施清单

| 措施 | 说明 |
|------|------|
| ✅ 环境变量 | API Key 存储在 `.env.local` 中，通过 `process.env.AI_API_KEY` 读取 |
| ✅ 后端代理 | 前端只请求 `/api/generate-tasks`，由后端转发 AI 请求 |
| ✅ .gitignore | `.env.local` 必须加入 `.gitignore`，绝不提交 Git |
| ✅ .env.example | 提供 `.env.example` 模板文件（不含真实 Key），供协作者参考 |
| ✅ 不落日志 | 后端打印日志时不应输出 API Key |
| ✅ 最小权限 | 如 AI 服务支持，使用限制额度的 API Key |
| ❌ 前端直接调用 | 绝不在浏览器端直接调用 AI 服务 |
| ❌ 硬编码 | 绝不在代码中写死 API Key |
| ❌ 提交 Git | 绝不将含有真实 Key 的文件提交到仓库 |

### 8.3 环境变量配置

#### .env.local（本地开发）

```bash
# AI API 配置
AI_API_KEY=sk-your-api-key-here
AI_API_BASE_URL=https://api.openai.com/v1    # 可选，兼容其他服务
AI_MODEL=gpt-4o-mini                          # 可选，默认 gpt-4o-mini
```

#### .env.example（提交到 Git）

```bash
# AI API 配置示例
# 复制此文件为 .env.local 并填入真实 API Key
AI_API_KEY=your-api-key-here
AI_API_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
```

#### .gitignore 关键条目

```
# 环境变量
.env
.env.local
.env*.local

# 依赖
node_modules/
.next/
```

### 8.4 Vercel 部署时的环境变量

在 Vercel 项目设置 → Environment Variables 中添加：
- Key: `AI_API_KEY`，Value: 真实 API Key
- Key: `AI_MODEL`，Value: `gpt-4o-mini`（可选）

---

## 九、AI Prompt 设计建议

### 9.1 Prompt 设计原则

根据 PRD 第八部分和第九部分的 AI 生成规则，Prompt 设计应遵循：

1. **角色明确**：AI 是任务规划助手，不是聊天机器人
2. **输出限定**：只返回 JSON，不返回解释文字
3. **数量控制**：3 到 8 条
4. **质量约束**：具体、可执行、动词开头、当天可完成
5. **禁止事项**：不生成空泛任务、不闲聊、不回答百科知识

### 9.2 System Prompt 模板

```typescript
// prompts/task-generation.ts

export const SYSTEM_PROMPT = `你是一个任务规划助手（Task Planner），你的唯一职责是根据用户的目标，生成具体、轻量、可执行的任务列表。

## 核心规则

1. **只返回 JSON**，不返回任何解释、问候语或额外文字
2. 任务数量：3 到 8 条（根据目标复杂度调整）
3. 每条任务 10 到 30 个字
4. 必须用**动词开头**，如"安装""学习""完成""阅读""整理"
5. 任务必须**今天可以完成**
6. 按从易到难的顺序排列
7. 任务之间不能重复

## 禁止生成

- 空泛任务："努力学习""提升能力""坚持下去""成为高手"
- 百科知识："Python 是一种编程语言..."
- 长篇计划：不要生成需要数月完成的长期路线图
- 危险建议：不生成涉及违法、自伤、伤害他人的任务

## 输出格式

严格使用以下 JSON 格式（不要用 Markdown 代码块包裹）：

{"tasks":[{"title":"具体任务"},{"title":"具体任务"}]}

## 好的示例

用户目标："我要学习 Python"
输出：
{"tasks":[{"title":"安装 Python 开发环境"},{"title":"学习变量和数据类型"},{"title":"跟着教程写一个 print 示例"},{"title":"完成 2 道变量练习题"},{"title":"记录今天遇到的问题"}]}

## 不好的示例

❌ {"tasks":[{"title":"努力学习 Python"},{"title":"成为编程高手"}]}
❌ 好的！以下是你的 Python 学习任务：1. 安装环境...
`;
```

### 9.3 User Prompt 模板

```typescript
export function buildUserPrompt(goal: string): string {
  return `请根据以下目标生成任务列表：\n\n${goal}`;
}
```

### 9.4 Prompt 优化建议

如果 AI 输出质量不稳定，按以下顺序优化（与 Phase 5 的 AI 调用策略一致）：

1. **优先启用 Structured Output / JSON Mode**：如果 AI 服务支持，直接使用 `response_format` 参数锁定 JSON 输出格式，从根本上避免格式问题
2. **加强约束**：如果模型不支持结构化输出，在 System Prompt 中更明确地写出禁止行为
3. **增加示例**：提供更多好/坏示例对比（few-shot）
4. **后置校验**：代码层面 `parseAIResponse` 校验 AI 返回结果，任务数量 <3 条判定失败、>8 条截取前 8 条

### 9.5 高风险输入检测（独立于 Prompt 构造）

高风险输入检测在前端和后端**各执行一次**，确保安全：

```typescript
// lib/input-validator.ts

// V1.0 实际关键词列表（与 src/lib/input-validator.ts 保持一致）
const RISK_KEYWORDS = ["自杀", "自残", "伤害", "杀人", "报复", "诈骗", "毒品", "炸弹", "攻击", "违法"];

export function checkRiskInput(goal: string): { isRisk: boolean; reason?: string } {
  const trimmed = goal.trim().toLowerCase();
  for (const kw of RISK_KEYWORDS) {
    if (trimmed.includes(kw)) {
      return { isRisk: true, reason: `输入包含高风险关键词：${kw}` };
    }
  }
  return { isRisk: false };
}
```

**处理规则**：
- 前端检测到风险输入 → 阻止提交，展示安全提示
- 后端检测到风险输入 → 返回 `HIGH_RISK_INPUT` 错误码（**不可被 `AI_GENERATION_FAILED` 吞没**）→ 前端展示专用安全提示

### 9.6 特殊输入场景的 Prompt 处理

```typescript
/**
 * 对不同类型的用户输入做 Prompt 调整（不含风险检测，风险检测由 checkRiskInput 独立处理）
 */
export function buildPrompt(goal: string): string {
  const trimmed = goal.trim();

  // 过大目标 → 提示 AI 聚焦今天第一步
  const bigGoalKeywords = ['成为', '考上', '精通', '一年', '三个月'];
  if (bigGoalKeywords.some(kw => trimmed.includes(kw))) {
    return `用户有一个较大的长期目标，请只拆解今天可以开始的第一步行动：\n\n${trimmed}`;
  }

  // 模糊目标 → 提示 AI 生成轻量通用任务
  const vagueKeywords = ['变好', '自律', '提升自己'];
  if (vagueKeywords.some(kw => trimmed.includes(kw))) {
    return `用户的目标比较宽泛，请生成 3-5 条轻量通用行动任务：\n\n${trimmed}`;
  }

  // 默认处理
  return buildUserPrompt(trimmed);
}
```

---

## 十、AI 输出 JSON 解析方案

### 10.1 解析流程

```
AI 返回原始文本
      │
      ▼
┌─────────────┐
│ 清理文本     │  去除首尾空白、可能的 Markdown 代码块标记
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ JSON.parse   │  尝试解析
└──────┬──────┘
       │
   ┌───┴───┐
   │ 成功？  │
   └───┬───┘
       │
  ┌────┴────┐
  │ 是      │ 否
  ▼         ▼
┌──────┐  ┌──────────┐
│ 校验  │  │ 二次尝试  │  尝试用正则提取 JSON 片段
│ 结构  │  │ 再解析    │
└──┬───┘  └────┬─────┘
   │           │
   ▼           ▼
┌──────┐  ┌──────────┐
│ 合格  │  │ 成功？    │
│返回   │  └──┬───┬───┘
│Task[] │     │   │
└──────┘  是 │   │ 否
            ▼   ▼
        ┌────┐ ┌──────────┐
        │校验│ │ 抛出错误  │
        └────┘ │ parse    │
               │ error    │
               └──────────┘
```

### 10.2 解析函数实现

```typescript
// lib/task-parser.ts

/**
 * 解析 AI 返回的原始文本，提取任务标题数组
 * 成功 → 返回 string[]（任务标题列表）
 * 失败 → 抛出 ParseError
 */
export function parseAIResponse(rawText: string): string[] {
  // 1. 清理文本
  let cleaned = rawText.trim();

  // 2. 去除可能的 Markdown 代码块标记
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
  cleaned = cleaned.replace(/\s*```$/i, '');

  // 3. 首次尝试 JSON.parse
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // 4. 二次尝试：用正则提取 JSON 对象
    const jsonMatch = cleaned.match(/\{[\s\S]*"tasks"[\s\S]*\}/);
    if (!jsonMatch) {
      throw new ParseError('AI 返回内容不包含有效任务数据');
    }
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      throw new ParseError('AI 返回内容无法解析为 JSON');
    }
  }

  // 5. 结构校验
  if (!parsed || typeof parsed !== 'object') {
    throw new ParseError('AI 返回数据格式错误');
  }

  const data = parsed as Record<string, unknown>;

  if (!Array.isArray(data.tasks)) {
    throw new ParseError('AI 返回数据缺少 tasks 字段');
  }

  // 6. 提取任务标题
  const titles: string[] = [];
  for (const item of data.tasks) {
    if (!item || typeof item !== 'object') continue;
    const task = item as Record<string, unknown>;
    if (typeof task.title === 'string' && task.title.trim().length > 0) {
      titles.push(task.title.trim());
    }
  }

  // 7. 数量校验（严格：必须 3-8 条）
  if (titles.length < 3) {
    throw new ParseError(`AI 返回任务数量不足（${titles.length} 条，要求至少 3 条），请重新生成`);
  }
  if (titles.length > 8) {
    // 超过 8 条 → 截取前 8 条
    console.warn(`任务数量超过上限: ${titles.length} 条，截取前 8 条`);
    titles.length = 8;
  }

  if (titles.length === 0) {
    throw new ParseError('AI 返回任务列表为空');
  }

  return titles;
}

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}
```

### 10.3 校验规则汇总

| 校验项 | 规则 | 不通过的处理 |
|--------|------|-------------|
| JSON 可解析 | 文本能解析为 JSON 对象 | 尝试正则提取，仍失败则报错 |
| tasks 存在 | 包含 `tasks` 字段 | 报错 |
| tasks 是数组 | `Array.isArray(tasks)` | 报错 |
| 每条有 title | `typeof task.title === 'string'` | 跳过该条 |
| title 非空 | `title.trim().length > 0` | 跳过该条 |
| 数量 < 3 条 | `titles.length >= 3` | 抛出 ParseError，判定为不合格，前端提示重新生成 |
| 数量 > 8 条 | `titles.length <= 8` | 截取前 8 条，warn 日志 |
| 最终展示 | 严格 3-8 条 | 前端展示稳定在 3-8 条之间 |

---

## 十一、错误处理方案

### 11.1 分层错误处理

```
┌────────────────────────────────────────────┐
│                错误边界层                    │
│  React Error Boundary (可选，防止整页崩溃)   │
├────────────────────────────────────────────┤
│                页面状态层                    │
│  根据 pageStatus 渲染不同 UI                │
│  - idle/editing/loading/success/error       │
├───────────────┬────────────────────────────┤
│   Hook 层      │          API 层            │
│ useTaskGroup  │  /api/generate-tasks        │
│ try/catch     │  try/catch + 错误码         │
├───────────────┴────────────────────────────┤
│              工具函数层                      │
│  storage.ts / task-parser.ts                │
│  返回 null 或 throw 明确错误                 │
└────────────────────────────────────────────┘
```

### 11.2 各类异常的处理策略

| 异常场景 | 处理方式 | 用户看到 |
|---------|---------|---------|
| 输入为空 | 前端校验，不发请求 | "请先输入一个目标。" |
| 输入过短（1字） | 前端校验，不发请求 | "请输入更具体的目标，例如：我要学习 Python。" |
| 2-100 字（含无意义输入） | 允许提交，但明显无意义输入需提示 | 无意义输入示例：可加"输入内容看起来不太像目标，请确认后重新输入。" |
| 输入过长（>100字） | 前端校验，不发请求 | "目标描述太长，请简化为一句话。" |
| 加载中重复点击 | 按钮禁用 | 按钮灰色，无法点击 |
| AI 接口调用失败 | 后端 catch，返回 500 | "任务生成失败，请稍后重试。" |
| AI 返回无法解析 | parseAIResponse 抛异常 | "任务解析失败，请重新生成。" |
| 网络异常 | fetch 抛异常 | "网络连接异常，请检查后重试。" |
| localStorage 写入失败 | 静默失败，console.warn | 当前页面任务保留，刷新后可能丢失（可提示） |
| localStorage 读取损坏 | 清除数据，返回 null | 回到空状态 |
| 高风险输入 | 后端关键词检测，返回 `HIGH_RISK_INPUT` 错误码（不可被 `AI_GENERATION_FAILED` 吞没） | 专用安全提示文案 |
| API Key 未配置 | 后端检测，返回 500 | "任务生成失败，请稍后重试。" |

### 11.3 前端错误展示逻辑

```typescript
// page.tsx 中的渲染逻辑

switch (pageStatus) {
  case 'idle':
  case 'editing':
    // 展示输入框 + 按钮 + 空状态（或已有的任务列表）
    break;

  case 'loading':
    // 展示加载动画 + 禁用按钮 + 保留输入框内容
    break;

  case 'success':
    // 展示任务列表 + 清空错误提示
    break;

  case 'error':
  case 'parse_error':
    // 展示错误提示 + 恢复按钮可用 + 保留输入内容
    break;
}
```

### 11.4 错误文案汇总

```typescript
// lib/constants.ts

export const ERROR_MESSAGES = {
  EMPTY_INPUT: '请先输入一个目标。',
  INPUT_TOO_SHORT: '请输入更具体的目标，例如：我要学习 Python。',
  INPUT_TOO_LONG: '目标描述太长，请简化为一句话。',
  AI_GENERATION_FAILED: '任务生成失败，请稍后重试。',
  AI_PARSE_FAILED: '任务解析失败，请重新生成。',
  NETWORK_ERROR: '网络连接异常，请检查后重试。',
  SAVE_FAILED: '任务暂时无法保存，请稍后重试。',
  HIGH_RISK_INPUT: '这个目标可能会带来伤害或风险，我不能帮你拆解执行步骤。请换一个安全、积极的目标。',
  CHAT_INPUT: '我是用来帮你拆解任务的。请输入一个目标，例如：我要准备面试。',
} as const;
```

---

## 十二、响应式设计建议

### 12.1 设计原则

V1.0 使用 **移动优先（Mobile First）** 策略，保证手机和电脑端都能正常使用：

- 使用 Tailwind CSS 响应式前缀（`sm:` `md:` `lg:`）
- 最大内容宽度限制，避免超宽屏下内容过度拉伸
- 触控友好的按钮和勾选框尺寸
- 不出现横向滚动条

### 12.2 布局方案

#### 整体布局

```html
<!-- 居中卡片布局，两端适配 -->
<main class="min-h-screen bg-gray-50">
  <div class="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
    <!-- 所有内容在卡片内 -->
  </div>
</main>
```

#### 断点策略

| 断点 | 宽度 | 布局调整 |
|------|------|---------|
| 手机（默认） | < 640px | 输入框 + 按钮上下排列；全宽 |
| 平板/桌面（sm+） | ≥ 640px | 输入框 + 按钮可横向排列 |
| 大屏（lg+） | ≥ 1024px | 内容居中，最大宽度 2xl（约 672px） |

### 12.3 组件响应式要点

| 组件 | 手机端 | 电脑端 |
|------|--------|--------|
| 输入框 | 全宽，height ≥ 44px（触控友好） | 适当宽度，可与按钮同行 |
| 按钮 | 全宽，height ≥ 44px，margin-top 12px | 与输入框同行或下方 |
| 勾选框 | ≥ 24×24px（方便手指点击） | 默认大小即可 |
| 任务标题 | 自动换行，不溢出 | 正常展示 |
| 示例目标 | 竖向排列 | 可横向排列 |

### 12.4 推荐 Tailwind 类名组合

```typescript
// 输入框
className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base 
           focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"

// 按钮
className="w-full rounded-lg bg-blue-600 px-6 py-3 text-white font-medium
           hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed
           sm:w-auto"

// 勾选框
className="h-6 w-6 rounded border-gray-300 text-blue-600 
           focus:ring-blue-500 cursor-pointer"

// 任务卡片
className="flex items-center gap-3 rounded-lg bg-white p-4 shadow-sm"
```

---

## 十三、开发阶段拆分

### 13.1 阶段总览

| 阶段 | 名称 | 目标 | 预计工作量 |
|------|------|------|-----------|
| Phase 0 | 项目初始化 | Next.js + TS + Tailwind 项目创建 | 30 分钟 |
| Phase 1 | 首页静态页面 | 完整静态 UI | 1-2 小时 |
| Phase 2 | 输入与状态管理 | 输入框交互 + 校验 | 1-2 小时 |
| Phase 3 | 假数据任务生成 | 假数据跑通列表展示 | 1-2 小时 |
| Phase 4 | 任务勾选与保存 | 勾选 + localStorage | 2-3 小时 |
| Phase 5 | 接入 AI 生成任务 | 真实 AI 接口替代假数据 | 2-3 小时 |
| Phase 6 | 异常处理与体验优化 | 加载/错误/响应式 | 2-3 小时 |
| Phase 7 | 部署上线 | GitHub + Vercel | 30 分钟-1 小时 |
| Phase 8 | 任务管理体验升级 | 清空/重生成/示例点击/全部完成/新一天 | 2-3 小时 |
| Phase 9 | 视觉美化 + PWA | 视觉层次/移动端/PWA/品牌 | 2-3 小时 |

### 13.2 阶段依赖关系

```
Phase 0 (项目初始化)
  └── Phase 1 (静态页面)
        └── Phase 2 (输入 + 状态)
              └── Phase 3 (假数据展示)
                    └── Phase 4 (勾选 + 保存)
                          └── Phase 5 (接入 AI)
                                └── Phase 6 (异常 + 体验)
                                      └── Phase 7 (部署)
                                            └── Phase 8 (任务管理体验升级) ← V1.1
                                                  └── Phase 9 (视觉美化 + PWA) ← V1.2
```

**关键点**：Phase 3 和 Phase 4 使用假数据，可以在没有 AI API Key 的情况下跑通完整 UI 流程。Phase 5 才接入真实 AI。

---

## 十四、每个 Phase 的技术实现重点

### Phase 0：项目初始化

**目标**：创建 Next.js 项目，完成基础工程配置

**技术重点**：
1. 使用 `create-next-app` 创建项目，选择 TypeScript + Tailwind CSS + App Router
2. 清理 `app/page.tsx` 中的默认示例代码
3. 建立目录结构：`src/components/`、`src/hooks/`、`src/lib/`、`src/prompts/`
4. 创建 `src/lib/types.ts`，定义 `Task` 和 `TaskGroup` 接口
5. 创建 `src/lib/constants.ts`，定义提示文案常量
6. 创建 `.env.example` 和配置 `.gitignore`
7. 确认 `npm run dev` 可以正常启动

**目录创建清单**：
```
src/
├── app/
│   ├── api/generate-tasks/   (预留，Phase 5 实现)
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/                (空目录)
├── hooks/                     (空目录)
├── lib/
│   ├── types.ts              (创建)
│   └── constants.ts          (创建)
└── prompts/                   (空目录)
```

**验收要点**：
- ✅ `npm run dev` 启动成功
- ✅ 浏览器访问 `localhost:3000` 不报错
- ✅ 目录结构创建完毕
- ✅ `.gitignore` 包含 `.env.local`

---

### Phase 1：首页静态页面

**目标**：完成静态 UI，不实现交互

**技术重点**：
1. 在 `layout.tsx` 中设置基础 HTML 结构和全局字体
2. 在 `page.tsx` 中组装各组件
3. 创建所有 UI 组件文件（`Header`、`HeroSection`、`GoalInput`、`ExampleGoals`、`TaskList`、`TaskItem`、`EmptyState`）
4. 使用 Tailwind 完成样式
5. 利用 Tailwind 响应式类名适配手机端

**组件实现要点**：
- `Header.tsx`：简单的 `<h1>`，字号大，居中或左对齐
- `HeroSection.tsx`：`<p>` 副标题，灰色文字
- `GoalInput.tsx`（静态版）：输入框 + 按钮，无事件处理
- `ExampleGoals.tsx`：显示 3-4 个示例文案
- `EmptyState.tsx`：灰色文字 + 居中展示
- 所有组件先以最简单方式实现，不引入复杂逻辑

**暂不实现**：
- ❌ 按钮点击事件
- ❌ 输入框状态绑定
- ❌ 任务数据逻辑
- ❌ localStorage

**验收要点**：
- ✅ 产品名称可见
- ✅ 输入框 + 按钮可见
- ✅ 示例目标可见
- ✅ 空状态提示可见
- ✅ 手机端不出现布局错位
- ✅ 无控制台错误

---

### Phase 2：输入与状态管理

**目标**：输入框和按钮具备基础交互能力

**技术重点**：
1. 使用 `useState` 管理输入框的 `inputGoal` 状态
2. 在 `page.tsx` 中实现 `handleGenerate` 函数（目前只做校验，不调 AI）
3. 实现输入校验逻辑：
   - 空值 → 显示"请先输入一个目标。"
   - 1 个字 → 显示"请输入更具体的目标，例如：我要学习 Python。"
   - 2-100 字 → 允许提交（明显无意义输入需提示）
   - 超过 100 字 → 显示"目标描述太长，请简化为一句话。"
   - 有效 → 清除错误
4. 错误提示使用 `ErrorMessage` 组件展示（红色文字，输入框下方）
5. `GoalInput` 变为受控组件，接收 `value` + `onChange` + `onSubmit` props

**状态管理**：
```typescript
// page.tsx 中调用 useTaskGroup Hook
const {
  inputGoal,
  setInputGoal,
  errorMessage,
  handleGenerate,
} = useTaskGroup();
// GoalInput 作为受控组件：<GoalInput value={inputGoal} onChange={setInputGoal} onSubmit={handleGenerate} ...>
```

**暂不实现**：
- ❌ 不调用 AI
- ❌ 不生成任务
- ❌ 不使用 localStorage

**验收要点**：
- ✅ 可以正常输入文字
- ✅ 空输入点击按钮 → 提示错误
- ✅ 过短输入 → 提示错误
- ✅ 有效输入点击按钮 → 不报错
- ✅ 输入内容修改后错误消失

---

### Phase 3：假数据任务生成

**目标**：不接 AI，用假数据跑通任务展示流程

**技术重点**：
1. 创建 `hooks/useTaskGroup.ts`（初版：仅管理假数据和展示状态）
2. 点击按钮后，使用假数据填充 `taskGroup` 状态
3. `TaskList` 组件根据 `tasks` 数组渲染任务列表
4. `TaskItem` 组件展示勾选框 + 任务标题（勾选功能 Phase 4 实现）
5. `TaskProgress` 组件展示"已完成 0 / N"
6. 有任务时隐藏 `EmptyState`，无任务时展示 `EmptyState`

**假数据**：
```typescript
const MOCK_TASKS: Task[] = [
  { id: 'task_001', title: '安装 Python 开发环境', completed: false, createdAt: now, updatedAt: now },
  { id: 'task_002', title: '学习变量和数据类型', completed: false, createdAt: now, updatedAt: now },
  { id: 'task_003', title: '完成 2 道变量练习题', completed: false, createdAt: now, updatedAt: now },
];
```

**hooks/useTaskGroup.ts（Phase 3 版）**：
- 管理 `taskGroup: TaskGroup | null`
- 提供 `generateTasks(goal)` → 使用假数据创建 TaskGroup
- 派生 `tasks`、`completedCount`、`totalCount`

**暂不实现**：
- ❌ 不调用 AI
- ❌ 不实现勾选切换
- ❌ 不使用 localStorage

**验收要点**：
- ✅ 输入有效目标后点击按钮 → 展示任务列表
- ✅ 每条任务前有勾选框
- ✅ 任务标题完整显示
- ✅ 空状态在有任务后消失
- ✅ 无控制台报错

---

### Phase 4：任务勾选与保存

**目标**：实现任务完成状态切换 + localStorage 持久化

**技术重点**：
1. 创建 `lib/storage.ts`，实现 `saveTaskGroup`、`loadTaskGroup`、`removeTaskGroup`
2. 在 `useTaskGroup` 中：
   - AI 生成/假数据生成任务后 → 调用 `saveTaskGroup`
   - 勾选任务 → 更新内存状态 + 调用 `saveTaskGroup` 持久化（V1.0 实际采用此种方式，未创建独立的 `updateTask` 函数）
   - 页面初始化 → 调用 `loadTaskGroup` 恢复数据
3. `TaskItem` 的勾选框绑定 `onClick`，调用 `handleToggleTask(taskId)`
4. 已完成任务 → 勾选框选中 + 文字删除线 (`line-through`) + 灰色 (`text-gray-400`)
5. 未完成任务 → 正常样式
6. `TaskProgress` 实时显示"已完成 X / Y"

**勾选逻辑**：
```typescript
function handleToggleTask(taskId: string) {
  setTaskGroup(prev => {
    if (!prev) return prev;
    const updatedTasks = prev.tasks.map(t =>
      t.id === taskId
        ? { ...t, completed: !t.completed, updatedAt: new Date().toISOString() }
        : t
    );
    const updated = { ...prev, tasks: updatedTasks, updatedAt: new Date().toISOString() };
    saveTaskGroup(updated); // 持久化
    return updated;
  });
}
```

**页面初始化恢复**：
```typescript
useEffect(() => {
  const saved = loadTaskGroup();
  if (saved) {
    setTaskGroup(saved);
  }
}, []);
```

**异常处理**：
- localStorage 读取失败 → 清除数据，展示空状态
- localStorage 写入失败 → console.warn，不清空页面数据

**验收要点**：
- ✅ 勾选任务 → 状态变为已完成（视觉变化）
- ✅ 再次点击 → 状态恢复未完成
- ✅ 刷新页面 → 任务仍在
- ✅ 刷新页面 → 完成状态正确
- ✅ 修改 localStorage 为无效数据 → 页面不崩溃，展示空状态

---

### Phase 5：接入 AI 生成任务

**目标**：将假数据替换为真实 AI 生成

**⚠️ AI 调用策略优先级**（从高到低）：
1. **首选：Structured Output（结构化输出）** — 如果所选 AI 模型支持（如 GPT-4o 的 `response_format: { type: "json_schema" }`），优先使用结构化输出，确保返回格式 100% 符合预期
2. **次选：JSON Mode** — 如果模型不支持 Structured Output 但支持 JSON Mode（如 `response_format: { type: "json_object" }`），启用 JSON Mode
3. **兜底：Prompt 约束 + parseAIResponse** — 如果模型不支持以上两种模式，使用 System Prompt 约束输出格式 + `parseAIResponse` 多层容错解析

> 无论使用哪种策略，`parseAIResponse` 作为最后防线始终保留。

**技术重点**：

1. **创建 API Route** `src/app/api/generate-tasks/route.ts`：
   - 接收 POST 请求，读取 `goal`
   - 校验输入（空/1字/过长）+ 高风险输入检测
   - 从 `process.env.AI_API_KEY` 读密钥
   - 构造 Prompt + 调用 AI 服务（优先启用 Structured Output / JSON Mode）
   - 解析 AI 返回 JSON → 构造 TaskGroup
   - 返回结果或错误

2. **创建 `src/lib/ai-client.ts`**（封装 AI 调用）：
   - `callAIService(apiKey, prompt, options?)` → 返回 AI 原始响应文本
   - 支持 `useJsonMode?: boolean` 参数，启用 JSON Mode
   - 支持 `useStructuredOutput?: boolean` 参数，启用 Structured Output

3. **创建 `src/lib/task-parser.ts`**：
   - `parseAIResponse(rawText, goal)` → 返回 `string[]`（任务标题数组）
   - 包含 JSON 清理、解析、结构校验、任务数量校验（<3 条判定失败，>8 条截取前 8 条）

4. **创建 `src/prompts/task-generation.ts`**：
   - 定义 `SYSTEM_PROMPT`
   - 导出 `buildPrompt(goal)` 函数

5. **修改 `useTaskGroup`**：
   - `handleGenerate` 改为调用 `fetch('/api/generate-tasks', ...)`
   - 成功后保存到 localStorage
   - 失败后展示对应错误信息（区分 `HIGH_RISK_INPUT`、`AI_GENERATION_FAILED`、`AI_PARSE_FAILED`）

6. **配置环境变量** `.env.local`：
   ```
   AI_API_KEY=sk-your-actual-key
   ```

**安全审查清单**：
- [ ] API Key 仅在 `.env.local` 中
- [ ] `.env.local` 在 `.gitignore` 中
- [ ] 前端代码中无 API Key 字符串
- [ ] 前端只调用 `/api/generate-tasks`
- [ ] 后端 API Route 从 `process.env` 读取 Key

**验收要点**：
- ✅ 输入真实目标 → AI 生成 3-8 条任务
- ✅ 任务具体、可执行
- ✅ 不包含空泛鸡汤
- ✅ AI 失败时页面不崩溃
- ✅ API Key 不在浏览器网络请求中出现
- ✅ 生成后仍可勾选、保存、刷新恢复

---

### Phase 6：异常处理与体验优化

**目标**：补齐错误处理、加载状态和移动端适配

**技术重点**：

1. **加载状态**：
   - 创建 `LoadingState` 组件（简单文字 + 可选 spinner）
   - 请求发送后立即显示加载状态
   - 按钮进入 `disabled` 状态，文案变为"生成中..."

2. **按钮防重复点击**：
   - `isLoading` 为 true 时按钮 `disabled`
   - 使用 `useRef` 或状态锁防止双击

3. **输入校验完善**：
   - 空值提示："请先输入一个目标。"
   - 1 个字提示："请输入更具体的目标，例如：我要学习 Python。"
   - 2-100 字：允许提交（明显无意义输入需提示）
   - 超过 100 字提示："目标描述太长，请简化为一句话。"

4. **错误提示完善**：
   - AI 生成失败
   - AI 返回格式异常
   - 网络异常
   - localStorage 异常（静默处理，仅展示空状态）

5. **完成进度**：
   - `TaskProgress` 组件展示"已完成 X / Y"

6. **移动端优化**：
   - 测试 320px-428px 宽度下的显示效果
   - 确保勾选框 ≥ 24×24px
   - 确保按钮高度 ≥ 44px
   - 确保无横向滚动

**可选增强（P2，已在 Phase 8 实现）**：
- 重新生成任务按钮
- 清空任务按钮
- 示例目标可点击快捷填入

**验收要点**：
- ✅ 加载状态及时展示
- ✅ 加载中不能重复点击
- ✅ 各类错误有明确提示
- ✅ 错误不清空用户输入
- ✅ 手机端体验正常
- ✅ 核心流程不受影响

---

### Phase 7：部署上线

**目标**：项目部署到 Vercel，可通过链接访问

**技术重点**：

1. **构建检查**：
   ```bash
   npm run build  # 确认无构建错误
   ```

2. **GitHub 仓库**：
   - 初始化 Git，提交代码
   - 确认 `.env.local` 不会被提交
   - Push 到 GitHub

3. **Vercel 部署**：
   - 在 Vercel 中导入 GitHub 仓库
   - 配置 Environment Variables（`AI_API_KEY`）
   - 触发部署

4. **线上验证**：
   - 打开线上链接
   - 测试完整流程：输入 → 生成 → 勾选 → 刷新恢复
   - 检查控制台无报错
   - 确认 API Key 未暴露

**部署检查清单**：
- [ ] `npm run build` 成功
- [ ] `.env.local` 不在 Git 中
- [ ] `.gitignore` 包含 `.env.local`
- [ ] Vercel 环境变量已配置
- [ ] 线上页面可访问
- [ ] AI 生成任务功能正常
- [ ] 任务勾选 + 刷新恢复正常

**验收要点**：
- ✅ 线上页面可打开
- ✅ 输入目标后 AI 正常生成
- ✅ 勾选任务正常
- ✅ 刷新后任务不丢失
- ✅ API Key 未暴露
- ✅ 控制台无明显错误

---

## 十五、潜在风险与规避方案

### 15.1 风险清单

| 序号 | 风险 | 影响 | 概率 | 规避方案 |
|------|------|------|------|---------|
| 1 | **AI 输出质量不稳定** | 任务太空泛，用户不满意 | 中 | 优化 System Prompt + few-shot 示例 + 代码层校验 + 二次生成机制 |
| 2 | **AI API 调用失败** | 用户无法生成任务 | 中 | 明确错误提示 + 保留输入 + 重试按钮 + 未来可加模板兜底 |
| 3 | **AI 返回格式异常** | 前端解析失败 | 中 | `parseAIResponse` 多层容错 + 正则兜底提取 + 清楚提示用户重试 |
| 4 | **localStorage 数据丢失** | 用户刷新后任务丢失 | 中 | 明确告知用户这是本地存储的限制 + 建议不要清浏览器缓存 + V2.0 上数据库 |
| 5 | **API Key 泄露** | 密钥被盗用，产生费用 | 低 | 后端代理模式 + 环境变量 + .gitignore + 使用限制额度的 Key |
| 6 | **AI 成本失控** | 频繁请求导致高额费用 | 低 | 输入长度限制 + 防重复点击 + 输出 token 限制 + 未来可加每日次数限制 |
| 7 | **开发范围膨胀** | 项目越做越大，无法按时完成 | 中 | 严格按 PRD V1.0 范围执行 + 每个 Phase 验收 + 禁止擅自新增功能 |
| 8 | **移动端体验差** | 手机用户无法正常使用 | 中 | 移动优先设计 + Tailwind 响应式 + 每个 Phase 在手机上验证 |
| 9 | **浏览器兼容问题** | 部分浏览器异常 | 低 | 仅支持现代浏览器（Chrome/Edge/Safari/Firefox 近 2 年版本） |
| 10 | **用户输入过于模糊** | AI 生成通用任务，用户体验差 | 高 | Prompt 中指示 AI 面对模糊输入生成轻量通用任务 + 未来加多轮追问 |

### 15.2 高风险场景的兜底方案

#### 风险 1+3：AI 失败或输出异常

```
用户点击生成
    │
    ▼
第一次调用 AI
    │
    ├── 成功 → 解析 JSON
    │           ├── 解析成功 → 展示任务 ✅
    │           └── 解析失败 → 提示用户重试
    │
    └── 失败 → 提示用户重试（最多 2 次自动重试）
```

**自动重试策略**（可选，Phase 6 实现）：
- 第一次失败 → 等待 1 秒后自动重试
- 第二次失败 → 提示用户手动重试
- 不进行第三次自动重试（避免无限等待）

#### 风险 10：模糊输入处理

在 Prompt 中已经指示 AI 面对模糊输入时生成轻量通用任务。如果仍不满意，未来 V2.0 可引入追问机制。

---

## 十六、部署架构

### 16.1 V1.0 部署架构

```
用户浏览器
    │
    │ HTTPS
    ▼
┌──────────────────────┐
│   Vercel (部署平台)   │
│                      │
│  ┌────────────────┐  │
│  │ Next.js 应用    │  │
│  │                │  │
│  │ 前端 SSR/CSR   │  │
│  │ API Route 后端  │  │
│  │                │  │
│  │ env: AI_API_KEY │  │
│  └───────┬────────┘  │
└──────────┼───────────┘
           │
           │ HTTPS
           ▼
    ┌──────────────┐
    │  AI 服务      │
    │ (OpenAI 等)   │
    └──────────────┘
```

### 16.2 环境变量（Vercel）

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `AI_API_KEY` | `sk-xxxx` | AI 服务的 API Key |
| `AI_API_BASE_URL` | `https://api.openai.com/v1` | (可选) AI 服务地址 |
| `AI_MODEL` | `gpt-4o-mini` | (可选) 使用的模型 |

### 16.3 成本提醒

> ⚠️ **AI 调用会产生费用**。开发和使用时需注意控制：
> - **请求次数**：避免频繁重复调用，前端做好防重复点击
> - **输入长度**：用户输入限制在 100 字以内
> - **输出长度**：设置合理的 `max_tokens`，AI 输出仅需返回 3-8 条简短任务
>
> 具体费用取决于所选 AI 服务商和模型，请参考对应平台的定价页面。

---

## 附录 A：TypeScript 类型定义完整清单

```typescript
// src/lib/types.ts

/** 页面状态 */
export type PageStatus =
  | 'idle'
  | 'editing'
  | 'loading'
  | 'success'
  | 'error'
  | 'parse_error';

/** 单条任务 */
export interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 任务组 */
export interface TaskGroup {
  id: string;
  goal: string;
  tasks: Task[];
  createdAt: string;
  updatedAt: string;
}

/** API 请求 - 生成任务 */
export interface GenerateTasksRequest {
  goal: string;
}

/** API 响应 - 成功 */
export interface GenerateTasksSuccessResponse {
  success: true;
  data: TaskGroup;
}

/** API 响应 - 失败 */
export interface GenerateTasksErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

/** API 响应 - 联合类型 */
export type GenerateTasksResponse =
  | GenerateTasksSuccessResponse
  | GenerateTasksErrorResponse;

/** useTaskGroup Hook 返回类型（V1.0 实际接口） */
export interface UseTaskGroupReturn {
  // 状态
  pageStatus: PageStatus;
  taskGroup: TaskGroup | null;
  inputGoal: string;
  errorMessage: string | null;

  // 派生状态
  tasks: Task[];                              // taskGroup?.tasks ?? []
  completedCount: number;                     // 已完成任务数
  totalCount: number;                         // 总任务数
  isGenerateDisabled: boolean;                // 按钮是否应禁用（pageStatus === "loading"）

  // 操作方法
  setInputGoal: (goal: string) => void;       // 更新输入框内容 + 自动清除 error
  handleGenerate: () => Promise<void>;        // 点击 AI 拆分按钮
  handleToggleTask: (taskId: string) => void; // 勾选/取消任务 + 自动保存

  // Phase 8 新增（V1.1）
  showNewDayPrompt: boolean;                  // 是否显示"新一天"提示
  regenerateError: string | null;             // 重新生成失败的错误（独立于 errorMessage）
  isAllCompleted: boolean;                    // 是否全部完成
  handleClearTasks: () => void;               // 清空当前任务
  handleRegenerate: () => Promise<void>;      // 重新生成任务
  handleExampleClick: (goal: string) => void; // 示例点击填入（不调用 AI）
  handleStartNewDay: () => void;              // 开始新一天
}
```

## 附录 B：提示文案清单

### V1.0 实际常量

```typescript
// src/lib/constants.ts

export const STORAGE_KEY = "ai_todo_current_task_group";

export const UI_TEXT = {
  // 页面文案
  APP_NAME: "AI Todo",
  APP_TAGLINE: "把模糊目标拆成今天可以执行的任务。",

  // 输入框
  INPUT_PLACEHOLDER: "例如：我要学习 Python / 我要准备面试 / 我要做一个小项目",
  BUTTON_GENERATE: "AI 拆分任务",
  GENERATING_BUTTON: "生成中...",

  // 示例目标
  EXAMPLE_LABEL: "试试：",
  EXAMPLE_GOALS: [
    "我要学习 Python",
    "我要准备面试",
    "我要做一个小项目",
    "我要减肥",
  ],

  // 任务列表
  TASK_LIST_TITLE: "今日任务",
  EMPTY_STATE: "还没有任务，输入一个目标试试。",
  LOADING_TEXT: "AI 正在拆解任务...",

  // 隐私提示
  PRIVACY_NOTICE: "请勿输入密码、证件号等敏感信息。",
} as const;

export const ERROR_MESSAGES = {
  EMPTY_INPUT: "请先输入一个目标。",
  INPUT_TOO_SHORT: "请输入更具体的目标，例如：我要学习 Python。",
  INPUT_TOO_LONG: "目标描述太长，请简化为一句话。",
  AI_GENERATION_FAILED: "任务生成失败，请稍后重试。",
  AI_PARSE_FAILED: "任务解析失败，请重新生成。",
  NETWORK_ERROR: "网络连接异常，请检查后重试。",
  SAVE_FAILED: "任务暂时无法保存，请稍后重试。",
  HIGH_RISK_INPUT: "这个目标可能会带来伤害或风险，我不能帮你拆解执行步骤。请换一个安全、积极的目标。",
  CHAT_INPUT: "我是用来帮你拆解任务的。请输入一个目标，例如：我要准备面试。",
} as const;
```

### Phase 8 新增常量（V1.1）

```typescript
// 在 UI_TEXT 中新增：
CLEAR_TASKS_BUTTON: "清空",
REGENERATE_BUTTON: "重新生成",
START_NEW_DAY_BUTTON: "开始新一天",
NEW_DAY_PROMPT: "这是上次的任务，要开始新一天吗？",
COMPLETE_ALL_MESSAGE: "🎉 全部完成！干得漂亮。",

// 在 ERROR_MESSAGES 中新增：
REGENERATE_FAILED: "重新生成失败，请稍后重试。",
```

---

## 十七、Phase 8：任务管理体验升级

### 17.1 阶段定位

| 属性 | 说明 |
|------|------|
| 阶段编号 | Phase 8 |
| 所属版本 | V1.1 |
| 前置依赖 | Phase 0-7 全部通过 |
| 核心目标 | 补齐当前任务组的基础管理能力，不推翻 V1.0 架构 |
| 新增依赖 | **0 个** |
| 修改 AI 调用 | **不修改** |
| 修改 API Route | **不修改** |
| 预计工作量 | 2-3 小时 |

### 17.2 功能清单

| # | 功能 | 说明 |
|---|------|------|
| 1 | 清空当前任务 | 一键清空 taskGroup，localStorage 同步清除，页面回到空状态 |
| 2 | 重新生成任务 | 基于输入框目标（或 taskGroup.goal）重新调用 AI，成功后替换旧任务组，失败时保留旧任务 |
| 3 | 示例目标点击填入 | 点击示例目标按钮 → 文本填入输入框，**不自动调用 AI** |
| 4 | 全部完成提示 | totalCount > 0 且 completedCount === totalCount 时显示完成提示 |
| 5 | 第二天新一天提示 | 恢复非今天创建的任务组时，显示提示 + "开始新一天"按钮，不清除旧数据 |

### 17.3 类型系统变更 — 无需修改

**`TaskGroup` 不做任何修改**。当前 `createdAt: string`（ISO 8601）已足够支撑"是否为今天创建"的判断。判断逻辑抽取为独立纯函数，不侵入类型定义：

```typescript
// src/lib/date-utils.ts（新增文件）

/**
 * 判断 taskGroup 是否为今天创建
 * 使用本地时区，与用户感知的"今天"一致
 */
export function isTaskGroupFromToday(taskGroup: TaskGroup): boolean {
  const createdDate = new Date(taskGroup.createdAt);
  const today = new Date();

  return (
    createdDate.getFullYear() === today.getFullYear() &&
    createdDate.getMonth() === today.getMonth() &&
    createdDate.getDate() === today.getDate()
  );
}
```

**`PageStatus` 不做修改**。现有状态机 `"idle" | "editing" | "loading" | "success" | "error" | "parse_error"` 已覆盖 Phase 8 所有页面状态。

### 17.4 useTaskGroup Hook 变更

#### 17.4.1 新增内部状态

```typescript
// 新增 Hook 内部状态（不暴露到类型系统外）
const [showNewDayPrompt, setShowNewDayPrompt] = useState(false);
const [regenerateError, setRegenerateError] = useState<string | null>(null);
```

**为什么 `regenerateError` 要独立于 `errorMessage`**：
- `errorMessage` 被 `GoalInput` 消费，渲染在输入卡片内
- 重新生成失败时，页面状态必须保持 `"success"`（旧任务不能丢失）
- 如果复用 `errorMessage` + `pageStatus="error"`，`TaskList` 的条件渲染逻辑会把旧任务隐藏
- `regenerateError` 单独渲染在 `TaskList` 区域，不影响旧任务展示

#### 17.4.2 新增派生状态

```typescript
const isAllCompleted = totalCount > 0 && completedCount === totalCount;
```

#### 17.4.3 修改 `useEffect` 恢复逻辑

```
V1.0 逻辑：
  loadTaskGroup() → 存在 → setTaskGroup + setPageStatus("success")

Phase 8 逻辑：
  loadTaskGroup() → 存在 →
    setTaskGroup(savedTaskGroup)
    setPageStatus("success")
    if (!isTaskGroupFromToday(savedTaskGroup)):
      setShowNewDayPrompt(true)
    // 关键：不自动清除旧任务，用户自行决定
```

#### 17.4.4 新增方法

**handleClearTasks()**

```typescript
function handleClearTasks() {
  setTaskGroup(null);
  removeTaskGroup();
  setPageStatus("idle");
  setShowNewDayPrompt(false);
  setRegenerateError(null);
  // inputGoal 不清空，方便用户输入新目标
}
```

**handleRegenerate()**

```
重新生成流程：
1. 确定目标文本：
   - 如果 inputGoal.trim() 非空 → 使用 inputGoal
   - 否则如果 taskGroup.goal 存在 → 使用 taskGroup.goal
   - 否则 → 等同于空输入（触发 EMPTY_INPUT 校验）
2. 输入校验（validateGoalInput + checkRiskInput）→ 同 handleGenerate
3. setPageStatus("loading")
4. setRegenerateError(null)
5. 调用 /api/generate-tasks
6. 成功：
   - setTaskGroup(result.data)
   - saveTaskGroup(result.data)
   - setPageStatus("success")
   - setInputGoal("")
7. 失败：
   - 保持 taskGroup 不变 ← 旧任务不丢失
   - 保持 pageStatus("success") ← 旧任务继续显示
   - setRegenerateError("重新生成失败，请稍后重试。")
```

**重新生成失败时的数据流**：

```
失败前：taskGroup=旧任务组, pageStatus="success", 任务列表正常显示
失败后：taskGroup=旧任务组(不变), pageStatus="success"(不变)
        regenerateError="重新生成失败,请稍后重试。"
        → TaskList 下方显示可关闭的 error banner
        → 旧任务完整保留，用户可继续勾选
```

**handleExampleClick(goal: string)**

```typescript
function handleExampleClick(goal: string) {
  setInputGoal(goal);
  setErrorMessage(null);
  setPageStatus("editing");
  // 不调用 AI，不触发任何 fetch
}
```

**handleStartNewDay()**

```typescript
function handleStartNewDay() {
  setTaskGroup(null);
  removeTaskGroup();
  setPageStatus("idle");
  setShowNewDayPrompt(false);
  setRegenerateError(null);
  setInputGoal("");
}
```

#### 17.4.5 返回值扩展

在现有 return 对象基础上新增：

```typescript
showNewDayPrompt: boolean;
regenerateError: string | null;
isAllCompleted: boolean;
handleClearTasks: () => void;
handleRegenerate: () => Promise<void>;
handleExampleClick: (goal: string) => void;
handleStartNewDay: () => void;
```

### 17.5 组件变更

#### 17.5.1 新增组件

**CompleteAllPrompt.tsx**

```typescript
// 职责：全部任务完成时显示鼓励提示
// Props：无
// 渲染条件：isAllCompleted === true 时，在 TaskProgress 下方渲染
// 渲染内容：🎉 全部完成！干得漂亮。
// 取消勾选任一条 → isAllCompleted 变 false → 组件消失
```

**NewDayPrompt.tsx**

```typescript
// 职责：恢复非今天的旧任务时提示用户开始新一天
// Props：
//   - onStartNewDay: () => void
// 渲染条件：showNewDayPrompt === true 时，在 GoalInput 和 TaskList 之间渲染
// 渲染内容：
//   - 提示文字："这是上次的任务，要开始新一天吗？"
//   - 按钮："开始新一天"
//   - 次要操作：用户可以忽略提示，继续使用旧任务（勾选/取消仍有效）
```

#### 17.5.2 修改组件

**ExampleGoals.tsx**

```
变更前：渲染 <span>，无交互
变更后：
  - 新增 Props: onClick: (goal: string) => void
  - 渲染 <button>（保留原有样式 + cursor-pointer + hover 效果）
  - onClick 调用 props.onClick(goal)
  - 保持 flex-wrap 布局
```

**TaskList.tsx**

```
新增 Props:
  isAllCompleted: boolean
  onClearTasks: () => void
  onRegenerate: () => void
  regenerateError: string | null

渲染变更：
  - 标题栏右侧新增两个小按钮：[重新生成] [清空]
  - isAllCompleted 为 true 时，TaskProgress 下方渲染 CompleteAllPrompt
  - regenerateError 不为 null 时，渲染 ErrorMessage（type="error"）
  - 清空/重新生成按钮仅在 totalCount > 0 时显示
```

**page.tsx**

```
新增解构：
  showNewDayPrompt, regenerateError, isAllCompleted,
  handleClearTasks, handleRegenerate, handleExampleClick, handleStartNewDay

渲染变更：
  - ExampleGoals 传递 onClick={handleExampleClick}
  - GoalInput 和 TaskList 之间条件渲染 NewDayPrompt
  - TaskList 传递新增 props
```

#### 17.5.3 不修改的组件

| 组件 | 原因 |
|------|------|
| `Header.tsx` | 无逻辑变更 |
| `HeroSection.tsx` | 无逻辑变更 |
| `GoalInput.tsx` | API 接口不变 |
| `LoadingState.tsx` | 逻辑不变 |
| `ErrorMessage.tsx` | 现有接口已满足 |
| `EmptyState.tsx` | 无变更 |
| `TaskItem.tsx` | 无变更 |
| `TaskProgress.tsx` | 无变更 |

### 17.6 UI 按钮布局

```
┌─────────────────────────────────────────────┐
│  Hero Section                                │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐    │
│  │  [输入框..........................] [生成] │    │
│  └─────────────────────────────────────┘    │
│  试试：[示例1] [示例2] [示例3] [示例4]        │  ← 改为 button
├─────────────────────────────────────────────┤
│  ⚠ 这是上次的任务，要开始新一天吗？ [开始]    │  ← NewDayPrompt
├─────────────────────────────────────────────┤
│  今日任务              [重新生成] [清空]      │  ← 新增操作按钮
│  ┌─────────────────────────────────────┐    │
│  │ ☐ 任务 1    ☑ 任务 2    ☐ 任务 3    │    │
│  └─────────────────────────────────────┘    │
│  已完成 1/3                                 │
│  🎉 全部完成！干得漂亮。                     │  ← CompleteAllPrompt
│  ⚠ 重新生成失败，请稍后重试。               │  ← regenerateError
└─────────────────────────────────────────────┘
```

### 17.7 localStorage 兼容性

**V1.0 存储数据**已包含 `createdAt` 字段，`isTaskGroup` type guard 已校验 `typeof taskGroup.createdAt === "string"`。Phase 8 **不修改 `STORAGE_KEY`**，**不修改存储结构**，**不修改 `isTaskGroup` 验证逻辑**。

如果极端情况下旧数据缺少 `createdAt`，`isTaskGroup` 会拒绝 → `removeTaskGroup()` 清除 → 等价于首次访问。不需要显式迁移函数。

**storage.ts 无需新增任何函数**。现有 `removeTaskGroup()` 已满足清空需求。

### 17.8 常量新增

在 `UI_TEXT` 中：

```typescript
CLEAR_TASKS_BUTTON: "清空",
REGENERATE_BUTTON: "重新生成",
START_NEW_DAY_BUTTON: "开始新一天",
NEW_DAY_PROMPT: "这是上次的任务，要开始新一天吗？",
COMPLETE_ALL_MESSAGE: "🎉 全部完成！干得漂亮。",
```

在 `ERROR_MESSAGES` 中：

```typescript
REGENERATE_FAILED: "重新生成失败，请稍后重试。",
```

### 17.9 文件变更汇总

| 操作 | 文件 | 说明 |
|------|------|------|
| **新增** | `src/lib/date-utils.ts` | `isTaskGroupFromToday` 函数 (~10 行) |
| **新增** | `src/components/CompleteAllPrompt.tsx` | 全部完成提示 (~15 行) |
| **新增** | `src/components/NewDayPrompt.tsx` | 新一天提示 (~20 行) |
| **修改** | `src/lib/constants.ts` | 新增 6 个常量 (~7 行) |
| **修改** | `src/hooks/useTaskGroup.ts` | 新增状态、方法、派生值 (~60 行) |
| **修改** | `src/components/ExampleGoals.tsx` | span→button + onClick (~10 行) |
| **修改** | `src/components/TaskList.tsx` | 按钮 + 条件渲染 (~25 行) |
| **修改** | `src/app/page.tsx` | 传递新 props + 条件渲染 (~15 行) |
| **不动** | 其余所有文件 | — |

### 17.10 严禁事项

| 禁止 | 说明 |
|------|------|
| 数据库 | 不引入 |
| 登录/注册 | 不引入 |
| 历史记录 | 不存储多于 1 个 taskGroup |
| 多任务组管理 | 不同时维护多个 taskGroup |
| 日历提醒 | 不引入 |
| 推送通知 | 不引入 |
| PWA | 不进入 Phase 9 范围 |
| API Route 修改 | 不动 `route.ts` |
| AI 调用修改 | 不动 `ai-client.ts`、`task-parser.ts`、prompts |
| 新依赖 | 0 个新 npm 包 |
| types.ts 修改 | 决不允许 |
| storage.ts 修改 | 决不允许（`removeTaskGroup` 已满足需求） |

### 17.11 Phase 8 验收标准

| # | 验收项 | 预期行为 |
|---|--------|---------|
| 1 | 清空任务 | 点击清空 → taskGroup 消失 → localStorage 清除 → 页面回到空状态 |
| 2 | 清空后输入保留 | inputGoal 不清空，用户可直接输入新目标 |
| 3 | 重新生成（输入框有值） | 使用输入框目标 → loading → 新任务替换旧任务 → completed 全 false |
| 4 | 重新生成（输入框为空，有 goal） | 使用 taskGroup.goal → loading → 新任务替换 → 输入框不自动填充 |
| 5 | 重新生成失败 | 旧任务保留 → 页面仍为 success → 显示重生成错误提示 → 用户可继续勾选 |
| 6 | 示例点击填入 | 点击示例 → 文本填入输入框 → 不自动调用 AI → 显示 editing 状态 |
| 7 | 全部完成提示 | 勾选最后一条 → 显示 "🎉 全部完成！" → 取消任一条 → 提示消失 |
| 8 | 第二天恢复提示 | 昨天创建的任务组 → 今天打开 → 显示旧任务 + "这是上次的任务" 提示 |
| 9 | 开始新一天 | 点击 "开始新一天" → 清空一切 → 回到空状态 |
| 10 | 忽略新一天提示 | 不点击 "开始新一天" → 旧任务可正常勾选/取消 → 功能不受影响 |
| 11 | 当天任务不显示提示 | 今天创建的任务组 → 刷新/重新打开 → 不显示新一天提示 |
| 12 | localStorage 兼容 | V1.0 存储的旧数据正常恢复 + 正确判断是否为今天 |
| 13 | 按钮在无任务时隐藏 | totalCount === 0 时，不显示清空和重新生成按钮 |
| 14 | lint + build 通过 | `npm run lint` 和 `npm run build` 无错误 |
| 15 | 不越界 | 不包含任何 Phase 9 内容（PWA、视觉美化等） |

### 17.12 开发任务拆分

```
Task 8.1  [基础]   新增 src/lib/date-utils.ts                     (~10 行)
Task 8.2  [基础]   constants.ts 新增 UI_TEXT 和 ERROR_MESSAGES     (~7 行)
Task 8.3  [核心]   useTaskGroup 新增状态、方法、派生值              (~60 行变更)
Task 8.4  [组件]   新增 CompleteAllPrompt.tsx                      (~15 行)
Task 8.5  [组件]   新增 NewDayPrompt.tsx                           (~20 行)
Task 8.6  [组件]   修改 ExampleGoals.tsx（span→button + onClick）  (~10 行变更)
Task 8.7  [组件]   修改 TaskList.tsx（按钮 + 条件渲染）             (~25 行变更)
Task 8.8  [组装]   修改 page.tsx（传递新 props + 条件渲染）         (~15 行变更)
Task 8.9  [验证]   lint + build + 手动验收 15 条
```

---

## 十八、Phase 9：视觉美化 + PWA + 移动端优化

### 18.1 阶段定位

| 属性 | 说明 |
|------|------|
| 阶段编号 | Phase 9 |
| 所属版本 | V1.2 |
| 前置依赖 | Phase 8 全部通过 |
| 核心目标 | 视觉层次美化 + PWA 基础支持 + 移动端触控和布局优化 |
| 新增依赖 | **0 个** |
| 修改 AI 调用 | **不修改** |
| 修改 API Route | **不修改** |
| 修改业务逻辑 | **不修改任何 useState / useEffect / 事件处理函数** |
| 预计工作量 | 2-3 小时 |

### 18.2 功能清单

| # | 功能 | 说明 |
|---|------|------|
| 1 | 视觉美化 | 组件卡片层次、按钮四态、错误提示视觉增强、进度条 |
| 2 | 移动端优化 | 触控目标 ≥ 44px、安全区适配、示例按钮防溢出 |
| 3 | PWA 支持 | manifest.json + 图标 + metadata，支持添加到主屏幕 |
| 4 | 品牌文案 | app name 保持 AI Todo，视觉风格简洁清爽 |

### 18.3 PWA 实现 — 零依赖方案

**不引入 `next-pwa` 或任何 PWA 相关 npm 包。**

"添加到主屏幕"所需的最小技术集：

| 要求 | 实现方式 | 需要依赖？ |
|------|---------|-----------|
| Web App Manifest | `public/manifest.json` | ❌ |
| App Icons | `public/icon-192.png` + `public/icon-512.png` | ❌ |
| Theme Color | `<meta name="theme-color">` in layout.tsx | ❌ |
| Apple Touch Icon | `<link rel="apple-touch-icon">` in layout.tsx | ❌ |
| Service Worker | **不做** | ❌ |

**为什么不做 Service Worker**：离线 AI 生成不可用（需要网络），缓存策略对 V1.2 过度设计。如果后续版本需要离线缓存，再评估引入 `next-pwa`。

#### 18.3.1 manifest.json 设计

采用 `public/manifest.json`（而非 `app/manifest.ts`），所有浏览器原生支持，不依赖 Next.js 特性，Vercel 默认支持：

```json
{
  "name": "AI Todo",
  "short_name": "AI Todo",
  "description": "把模糊目标拆成今天可以执行的任务。",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#f8fafc",
  "theme_color": "#0f172a",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

配色说明：
- `background_color: "#f8fafc"` = Tailwind `bg-slate-50`
- `theme_color: "#0f172a"` = Tailwind `slate-900`，与现有按钮色系一致

#### 18.3.2 App Icon 方案

不依赖设计师，使用简洁几何图形：
- 192×192 PNG：白色背景 + 深色 ✓ 勾选图标
- 512×512 PNG：同上，高分辨率
- 在 README.md 中注明图标为自绘

文件位置：
```
public/
  icon-192.png
  icon-512.png
  manifest.json
```

#### 18.3.3 layout.tsx metadata 配置

在现有 `src/app/layout.tsx` 中增加：

```typescript
// 新增 metadata 字段
export const metadata: Metadata = {
  // ... 现有字段保持不变
  manifest: "/manifest.json",
  themeColor: "#0f172a",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AI Todo",
  },
};
```

同时在 `<head>` 中保留静态 meta 标签作为 fallback：

```html
<meta name="theme-color" content="#0f172a" />
<link rel="apple-touch-icon" href="/icon-192.png" />
```

#### 18.3.4 明确不做的 PWA 功能

| 功能 | 原因 |
|------|------|
| Service Worker | 离线 AI 生成不可用，缓存策略过度设计 |
| 推送通知 | Phase 9 禁止 |
| 离线页面 | 超出范围 |
| 安装提示横幅 | 浏览器原生行为已足够 |
| 高级缓存策略 | 留给后续版本 |

### 18.4 视觉美化方案

#### 18.4.1 美化原则

1. **增量优化**：只改 Tailwind 类名，不改 HTML 结构（除非必要 wrapper）
2. **不引入设计系统**：不定义 color token、不引入 CSS 变量体系
3. **可逐条 revert**：每个组件的变更独立
4. **移动端优先**：每个美化项同时在手机端验证

#### 18.4.2 逐组件美化

**Header.tsx**
```
当前：text-xl font-semibold
优化：增加左侧小装饰线（border-l-2 border-slate-800 pl-3）
      增加 tracking-tight
```

**HeroSection.tsx**
```
当前：h1 text-4xl/5xl + p text-lg/xl text-slate-600
优化：h1 使用 gradient text（bg-gradient-to-r from-slate-900 to-slate-500 bg-clip-text text-transparent）
      p 改为 text-slate-500（更柔和）
```

**GoalInput.tsx**
```
当前：rounded-lg border border-slate-200 shadow-sm
优化：rounded-xl shadow-md（更明显卡片感）
      input focus 环从 ring-slate-200 → ring-slate-300
      button 增加 hover:bg-slate-900 active:bg-slate-800 transition-colors duration-150
      privacy notice 改为 text-slate-400
```

**TaskList.tsx**
```
当前：rounded-lg border shadow-sm
优化：rounded-xl shadow-md
      标题 h2 增加 tracking-tight
      清空/重新生成按钮：text-xs text-slate-500 hover:text-slate-700 transition-colors
```

**TaskItem.tsx**
```
当前：rounded-md border bg-white
优化：rounded-lg
      增加 hover:bg-slate-50 transition-colors
      checkbox 增加 cursor-pointer accent-slate-950
```

**EmptyState.tsx**
```
当前：简单文字
优化：增加居中 emoji 图标 + text-slate-400
```

**LoadingState.tsx**
```
当前：静态圆环 + 文字
优化：**修复 animate-spin**（已知 Phase 6 P2）
      文字改为 text-slate-500
```

**ErrorMessage.tsx**
```
当前：按 type 显示不同文字颜色
优化：增加左边框色条（border-l-2）
      error: border-l-red-500 bg-red-50
      warning: border-l-amber-500 bg-amber-50
      info: border-l-slate-400 bg-slate-50
      保留 role="alert"
```

**TaskProgress.tsx**
```
当前：简单文字 "已完成 X / Y"
优化：增加进度条（bg-slate-200 底 + bg-slate-800 填充，h-1 rounded-full）
      保留文字百分比
```

**CompleteAllPrompt.tsx**（Phase 8 新增组件）
```
优化配色：border-emerald-200 bg-emerald-50 text-emerald-700
```

**NewDayPrompt.tsx**（Phase 8 新增组件）
```
优化配色：border-amber-200 bg-amber-50 text-amber-700
```

#### 18.4.3 全局美化

```
页面背景：保持 bg-slate-50
Header 增加 pt-[env(safe-area-inset-top,0px)]
main 增加 pb-[env(safe-area-inset-bottom,1rem)]
```

### 18.5 移动端优化

#### 18.5.1 触控目标检查

| 元素 | V1.0 状态 | Phase 9 优化 |
|------|----------|-------------|
| input | min-h-12 = 48px ✅ | 保持，增加 touch-action:manipulation |
| button 生成 | min-h-12 = 48px ✅ | 保持 |
| checkbox | h-6 + padding ≈ 48px ✅ | 保持 |
| 示例 button | px-3 py-2 = ≤44px ⚠️ | 调整为 min-h-[44px] |
| 清空/重新生成 | 文字按钮，可能不足 ⚠️ | 增加 min-h-[44px] + 足够 padding |

#### 18.5.2 安全区适配

在 `page.tsx` 的 `<main>` 最外层：
```
pb-[env(safe-area-inset-bottom,1rem)]
```

在 `Header` 增加：
```
pt-[env(safe-area-inset-top,0px)]
```

#### 18.5.3 示例目标防溢出

```
当前：flex flex-wrap gap-2
优化：如果 4 个示例在小屏换行后仍过宽 → flex-nowrap overflow-x-auto
      每个 button shrink-0
      增加 touch-action: manipulation 消除 300ms 延迟
```

### 18.6 不修改的文件

| 文件 | 理由 |
|------|------|
| `route.ts` | AI 核心逻辑不动 |
| `ai-client.ts` | AI 核心逻辑不动 |
| `task-parser.ts` | AI 核心逻辑不动 |
| `task-generation.ts` | AI 核心逻辑不动 |
| `input-validator.ts` | 校验逻辑不动 |
| `storage.ts` | 存储逻辑不动 |
| `types.ts` | 类型系统不动 |
| `useTaskGroup.ts` | 状态管理不动 |
| `date-utils.ts` | Phase 8 逻辑不动 |

### 18.7 文件变更汇总

| 操作 | 文件 | 说明 |
|------|------|------|
| **新增** | `public/manifest.json` | PWA manifest (~18 行) |
| **新增** | `public/icon-192.png` | App 图标 192×192 |
| **新增** | `public/icon-512.png` | App 图标 512×512 |
| **修改** | `src/app/layout.tsx` | metadata + head meta (~10 行) |
| **修改** | `src/components/HeroSection.tsx` | 字体层次 (~5 行) |
| **修改** | `src/components/GoalInput.tsx` | 卡片圆角阴影 + 按钮四态 (~10 行) |
| **修改** | `src/components/TaskList.tsx` | 卡片圆角阴影 (~5 行) |
| **修改** | `src/components/TaskItem.tsx` | 圆角 + hover (~5 行) |
| **修改** | `src/components/EmptyState.tsx` | emoji + 颜色 (~5 行) |
| **修改** | `src/components/LoadingState.tsx` | 修复 animate-spin + 颜色 (~3 行) |
| **修改** | `src/components/ErrorMessage.tsx` | 左边框 + 背景色 (~8 行) |
| **修改** | `src/components/TaskProgress.tsx` | 进度条 (~5 行) |
| **修改** | `src/components/CompleteAllPrompt.tsx` | 绿色配色 (~3 行) |
| **修改** | `src/components/NewDayPrompt.tsx` | 琥珀配色 (~3 行) |
| **修改** | `src/components/ExampleGoals.tsx` | hover + touch-action (~5 行) |
| **修改** | `src/app/page.tsx` | 安全区适配 (~3 行) |
| **不动** | 其余所有文件 | — |

### 18.8 Phase 9 验收标准

| # | 验收项 | 预期行为 |
|---|--------|---------|
| 1 | manifest.json 可访问 | `GET /manifest.json` 返回 200，Content-Type 正确 |
| 2 | 图标可访问 | `GET /icon-192.png` 和 `/icon-512.png` 返回 200 |
| 3 | Android 添加到主屏幕 | Chrome → 添加到主屏幕 → standalone 模式 |
| 4 | iOS 添加到主屏幕 | Safari → 添加到主屏幕 → 无浏览器地址栏 |
| 5 | theme-color | 状态栏/头部颜色为 `#0f172a` |
| 6 | Apple touch icon | iOS 主屏幕图标正确显示 |
| 7 | 视觉一致性 | 所有页面状态（idle/editing/loading/success/error/parse_error）视觉统一 |
| 8 | 按钮四态 | hover / active / focus / disabled 四种状态均有合适样式 |
| 9 | 手机端触控目标 | 所有可交互元素 ≥ 44px |
| 10 | 手机端示例不溢出 | 4 个示例按钮不产生横向滚动（或可接受的水平滚动） |
| 11 | 手机端任务卡片 | 勾选框触控区域足够，长文本不溢出 |
| 12 | iPhone 安全区 | 底部横条不遮挡内容，顶部刘海不遮挡 Header |
| 13 | animate-spin 修复 | LoadingState 的 spinner 有旋转动画 |
| 14 | 核心逻辑不变 | AI 生成、任务保存、刷新恢复、Phase 8 所有功能与 Phase 8 行为一致 |
| 15 | lint + build 通过 | 无错误 |
| 16 | 不越界 | 不包含数据库、登录、历史记录、推送通知等 |

### 18.9 开发任务拆分

```
Task 9.1  [PWA]    public/manifest.json                             (~18 行)
Task 9.2  [PWA]    public/icon-192.png + public/icon-512.png         (2 个文件)
Task 9.3  [PWA]    layout.tsx metadata + head meta 标签              (~10 行变更)
Task 9.4  [美化]   HeroSection 字体层次                              (~5 行变更)
Task 9.5  [美化]   GoalInput 卡片 + 按钮四态                          (~10 行变更)
Task 9.6  [美化]   TaskList + TaskItem 卡片 + hover                  (~10 行变更)
Task 9.7  [美化]   EmptyState + LoadingState（修 animate-spin P2）   (~8 行变更)
Task 9.8  [美化]   ErrorMessage + TaskProgress 视觉增强              (~13 行变更)
Task 9.9  [美化]   CompleteAllPrompt + NewDayPrompt 配色             (~6 行变更)
Task 9.10 [移动端] page.tsx 安全区 + 触控目标优化                     (~3 行变更)
Task 9.11 [移动端] ExampleGoals 移动端防溢出                          (~5 行变更)
Task 9.12 [验证]   lint + build + 移动端真机验收 + PWA 安装测试
```

---

## 十九、Phase 8 与 Phase 9 关系

### 19.1 为什么必须拆开

| 维度 | Phase 8 | Phase 9 |
|------|---------|---------|
| 变更性质 | 行为逻辑（新增状态、方法、交互） | 纯表现层（CSS + 静态资源） |
| Review 重点 | 状态机正确性、边界条件、localStorage 兼容 | 视觉一致性、移动端适配、PWA 安装流程 |
| 失败影响 | 最多影响任务管理功能 | 最多影响视觉 |
| diff 可读性 | 核心文件 ~160 行 | 零逻辑变更，仅 className + 静态文件 |
| 可独立上线 | ✅ V1.1 即可上线 | ✅ V1.2 独立上线 |

### 19.2 推荐开发节奏

```
Week 1: Phase 8 开发（Task 8.1 → 8.8）→ Review → 修复 → 通过 → 上线 V1.1
Week 2: Phase 9 开发（Task 9.1 → 9.12）→ Review → 修复 → 通过 → 上线 V1.2
```

### 19.3 风险点

| # | 风险 | 影响 Phase | 严重度 | 缓解措施 |
|---|------|-----------|--------|---------|
| 1 | `isTaskGroupFromToday` 时区问题：用户跨时区旅行 | Phase 8 | 低 | 使用本地时区 `new Date()`，与用户感知的"今天"一致 |
| 2 | 重新生成失败时 regenerateError 与 success 状态共存，需确保组件能正确渲染 | Phase 8 | 中 | TaskList 中独立渲染 regenerateError，不经过 GoalInput 的 ErrorMessage |
| 3 | 示例点击填入后用户期望自动生成 | Phase 8 | 低 | 产品决策：明确行为是"只填入不生成" |
| 4 | Vercel 上 manifest.json Content-Type | Phase 9 | 低 | Vercel 默认支持 manifest.json，无需额外配置 |
| 5 | iOS Safari 对 manifest 支持不完整，需 apple-mobile-web-app-capable meta 标签 | Phase 9 | 中 | 同时在 layout.tsx 配置 appleWebApp metadata |
| 6 | 视觉美化引入 Tailwind class 冲突 | Phase 9 | 低 | 逐组件修改，每次改完验证该组件所有状态 |
| 7 | 图标手绘可能不专业 | Phase 9 | 低 | 使用简洁几何图形（✓ + 纯色背景），可接受 |

---

> **文档版本**：V1.2
> **对应 PRD**：AI Todo PRD V1.0
> **适用范围**：AI Todo V1.0 — V1.2
> **最后更新**：2026-06-29
