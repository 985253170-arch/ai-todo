# V3.0A：手机 App 前端独立工程 — 项目级架构决策

> **状态**：架构设计阶段。只写文档，不写代码。
> **前置**：V2.7 任务难度与数量动态调整 ✅（commit `cd8b99f`）
> **定位**：项目级决策文档——说明**为什么**要做前端隔离、**为什么**选择 `apps/mobile-app`、**为什么**本阶段不接后端、以及根 `docs/` 与 `apps/mobile-app/docs/` 的文档边界。
> **前端内部设计文档**：[`apps/mobile-app/docs/Frontend-Architecture.md`](../apps/mobile-app/docs/Frontend-Architecture.md)
> **前端执行方案**：[`apps/mobile-app/docs/Frontend-Execution-Plan.md`](../apps/mobile-app/docs/Frontend-Execution-Plan.md)
> **设计日期**：2026-07-08

---

## 目录

- [1. 阶段背景](#1-阶段背景)
- [2. 为什么要前后端隔离](#2-为什么要前后端隔离)
- [3. 为什么采用同仓库 apps/mobile-app 独立前端工程](#3-为什么采用同仓库-appsmobile-app-独立前端工程)
- [4. 为什么不是直接改 src/](#4-为什么不是直接改-src)
- [5. 为什么本阶段不接后端](#5-为什么本阶段不接后端)
- [6. 为什么验证成熟后合并回主项目路由](#6-为什么验证成熟后合并回主项目路由)
- [7. 根 docs/ 与 apps/mobile-app/docs/ 的文档边界](#7-根-docs-与-appsmobile-appdocs-的文档边界)
- [8. 项目工程边界](#8-项目工程边界)
- [9. 禁止修改范围](#9-禁止修改范围)
- [10. 风险与缓解](#10-风险与缓解)
- [11. 验收标准（项目级）](#11-验收标准项目级)

---

## 1. 阶段背景

### 1.1 当前状态

AI Todo 当前所有功能集中在 `src/app/app/page.tsx`（主工作台），由 `MainWorkspace.tsx`（254 行）在一个长页面中渲染所有功能：

- GoalInput（目标输入）
- StatsBar（统计栏）
- TaskList → TaskItem（任务列表）
- TaskAssistPanel（AI 帮我一下）
- TaskCompanionPanel（开始陪我做）
- TaskReviewPanel（AI 复盘）
- HistoryPanel（历史记录）

所有功能堆叠在一个页面，视觉和使用体验差。虽然 CSS 做了响应式适配，但信息架构不是为手机端设计的——没有底部导航、没有单屏单任务的交互逻辑、没有 App 级的页面切换体验。

### 1.2 已有设计稿

用户已有明确的手机 App 设计稿，信息架构锁定为**四 Tab**：

```
今日  |  足迹  |  成长  |  我的
```

### 1.3 与旧 V3.0 架构文档的关系

旧文档 `docs/Architecture-V3.0-Web-App-Separation.md` 提出的方案是**在现有 `src/` 内修改组件**来实现 App Shell。本方案替代旧方案，核心变化：

| 维度 | 旧 V3.0 方案 | 新 V3.0A 方案 |
|------|-------------|--------------|
| 工程位置 | 在 `src/` 内修改现有文件 | 新建独立 `apps/mobile-app/` |
| 对现有代码影响 | 需修改 10+ 现有组件 | 零修改，完全隔离 |
| 后端依赖 | 继续依赖真实 API | mock service 独立运行 |
| 风险 | 改动面大，可能破坏现有功能 | 零风险，不影响现有系统 |
| 开发效率 | 受现有代码耦合约束 | 独立开发，快速迭代 |

旧文档归档为参考，V3.0A 以本文档为准。

---

## 2. 为什么要前后端隔离

### 2.1 核心原因

1. **现有 `/app` 页面功能堆叠严重**：目标输入、任务列表、统计、历史、复盘、AI 辅助、AI 陪伴全堆在一个长页面
2. **信息架构不是手机端原生思考的**：现有页面是"桌面页面缩小到手机"，不是"为手机设计的 App"
3. **直接在现有代码上重构风险大**：MainWorkspace.tsx 承载了所有核心业务逻辑，改动容易引入回归 bug
4. **新旧两套 UI 需要并存过渡期**：旧 Web 页面需要继续服务现有用户，新 App UI 需要独立开发验证
5. **开发效率**：独立工程可以有自己的 lint/build 配置，不影响主工程 CI/CD

### 2.2 隔离收益

- 新前端可以完全按 App 信息架构设计，不受旧代码约束
- mock service 让前端能独立跑起来，不依赖数据库/AI API
- 验证成熟前，零风险影响现有系统
- 两个工程可以独立开发、独立部署

---

## 3. 为什么采用同仓库 apps/mobile-app 独立前端工程

### 3.1 monorepo 惯例

`apps/` 是 monorepo 的事实标准目录名（参见 Turborepo、Nx、Vercel 官方示例）。将独立前端放在 `apps/mobile-app/` 符合业界惯例。

### 3.2 路径对比

| 候选路径 | 优点 | 缺点 |
|----------|------|------|
| `apps/mobile-app/` ✅ | monorepo 惯例，清晰标识为独立 App | 需新建目录 |
| `mobile-app/` (根目录) | 简单 | 与 src/ 平级，容易混淆，不符合 monorepo 惯例 |
| `packages/mobile-app/` | monorepo 惯例 | `packages/` 通常用于共享库，不适合独立应用 |
| 直接在 `src/` 内改 | 无新目录 | 与旧代码耦合，风险大 |

**选择 `apps/mobile-app/`**。

### 3.3 为什么 mobile-app 也用 Next.js

1. **最终要合并回主项目**：主项目是 Next.js App Router，mobile-app 用同一框架，合并时组件/路由可以直接迁移
2. **团队技术栈统一**：不需要引入 React Native / Flutter / 其他框架的学习成本
3. **App Router 的文件系统路由**：`app/` 目录下的 `page.tsx` 天然支持四 Tab 路由
4. **PWA 支持**：Next.js 内置 metadata/viewport API，PWA 配置与主项目一致
5. **Tailwind CSS 生态**：与主项目共享相同的样式方案
6. **TypeScript**：类型系统一致，后续合并时类型定义可以直接复用

### 3.4 不做 React Native / Flutter 的原因

- 当前阶段目标是验证 App 信息架构，不是发布原生 App
- 引入新框架会增加技术栈复杂度
- PWA 已能满足"添加到桌面"的需求
- 后续如果需要原生 App，当前 Next.js App Shell 可作为迁移蓝图

---

## 4. 为什么不是直接改 src/

### 4.1 `src/` 是什么

`src/` 是**现有 Next.js 全栈主项目**（也是 legacy 主项目），不是纯后端目录。它包含：

| 层级 | 位置 | 说明 |
|------|------|------|
| 前端页面 | `src/app/` | Landing Page、主工作台、登录页等 |
| 前端组件 | `src/components/` | 25 个 UI 组件 |
| 前端 Hooks | `src/hooks/` | 7 个业务逻辑 Hook |
| API Route（后端能力） | `src/app/api/` | 11 个 API 端点 |
| 数据访问层 | `src/lib/supabase-*.ts` | Supabase 客户端 |
| AI 客户端 | `src/lib/ai-client.ts` | DeepSeek API 调用 |
| 业务逻辑 | `src/lib/` | 类型、解析、校验、存储等 17 个文件 |
| AI Prompts | `src/prompts/` | 4 个 Prompt 模板 |

**关键认知**：`src/` 是一个完整的全栈 Next.js 应用（前端 + 后端 + 数据 + AI），不是可以随意修改的纯后端。

### 4.2 后端能力集中在哪

后端能力（后续 mobile-app 需要对接的部分）主要集中在：

- `src/app/api/` — 所有 API Route（任务生成、保存、加载、历史、统计、复盘、AI 辅助、陪伴）
- `src/lib/supabase-server.ts` — Supabase 服务端 client
- `src/lib/supabase-client.ts` — Supabase 浏览器 client
- `src/lib/ai-client.ts` — DeepSeek API 客户端

### 4.3 不在 src/ 内改的原因

1. MainWorkspace.tsx 承载了所有核心业务逻辑，改动容易引入回归 bug
2. 旧 `/app` 页面仍在服务现有用户，不能中断
3. 新 UI 信息架构与旧页面完全不同，强行在旧代码上改会导致两套逻辑混杂
4. 独立工程可以快速迭代，不受旧代码耦合约束

---

## 5. 为什么本阶段不接后端

### 5.1 原因

1. **先验证信息架构**：四 Tab 的交互体验、组件拆分、页面流转是否合理，需要先跑通前端
2. **避免耦合**：接真实后端意味着依赖 Supabase、AI API、数据库——这些在快速迭代前端 UI 时会成为阻碍
3. **快速迭代**：mock service 让前端能即时看到效果，不需要等待 API 响应、处理网络错误
4. **独立验收**：前端可以独立验收交互体验，不需要后端环境

### 5.2 本阶段只允许前端 mock

- Service 层接口与未来真实后端接口**签名一致**
- 页面组件**不直接写死数据**，必须通过 service 层获取
- Mock 数据模拟真实数据结构和边界情况（空状态、加载态、错误态）
- 后续替换为真实后端时，只需修改 service 层实现，页面组件不动

---

## 6. 为什么验证成熟后合并回主项目路由

### 6.1 三步走路径

```
Phase A（本阶段）       Phase B（后续）         Phase C（后续）
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ apps/mobile-app  │    │ 抽取 AppShell    │    │ 合并回主路由     │
│ 独立开发          │ →  │ Views/Components │ →  │ src/app/app/    │
│ Mock Service     │    │ 对接真实 API     │    │ 替换旧页面       │
│ 验证 UI/交互      │    │ 验证数据流       │    │ 清理旧组件       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 6.2 为什么不是直接替换

- 旧 `/app` 页面仍在服务现有用户，不能中断
- 新 UI 需要经过充分验证才能替换
- 两套 UI 需要并存过渡期

### 6.3 合并时不做什么

- 不保留两套 App Shell（旧 MainWorkspace 会被清理）
- 不保留 mock service（替换为真实 API）
- 不出现"双重界面"

---

## 7. 根 docs/ 与 apps/mobile-app/docs/ 的文档边界

### 7.1 文档归属原则

```
根 docs/                          apps/mobile-app/docs/
（项目级决策文档）                  （前端内部设计与执行文档）
├── 为什么做某个决策                ├── 前端目录架构
├── 技术选型理由                    ├── 组件树与 Props 设计
├── 工程边界定义                    ├── Mock Service 实现细节
├── 合并策略                        ├── 视觉 Token 设计
├── 禁止修改范围                    ├── 执行方案（文件清单、代码片段）
└── 项目级验收标准                  └── UI 风格约束
```

### 7.2 当前 V3.0A 文档分布

| 文档 | 位置 | 性质 |
|------|------|------|
| Architecture-V3.0A-Frontend-Isolation.md | `docs/`（本文档） | 项目级架构决策 |
| Frontend-Architecture.md | `apps/mobile-app/docs/` | 前端内部架构设计 |
| Frontend-Execution-Plan.md | `apps/mobile-app/docs/` | 前端执行方案（Codex 操作手册） |

### 7.3 边界规则

- 根 `docs/` 管**项目级决策**：为什么做、为什么不做的权衡
- `apps/mobile-app/docs/` 管**前端内部设计和执行**：怎么做、组件怎么拆、Mock 怎么写
- 不要在两处保留重复内容
- 根 `docs/` 中的文档指向 `apps/mobile-app/docs/` 中的详细文档

---

## 8. 项目工程边界

### 8.1 目录结构

```
C:\Dev\ai-todo\
├── src/                          # 现有 Next.js 全栈主项目（不动）
│   ├── app/api/                  # 后端 API Route
│   ├── app/                      # 前端页面
│   ├── components/               # 前端组件
│   ├── hooks/                    # 业务逻辑 Hook
│   ├── lib/                      # 工具函数 + AI Client + Supabase
│   └── prompts/                  # AI Prompt
│
├── apps/
│   └── mobile-app/               # 新增：独立手机 App 前端工程
│       └── docs/                 # 前端专属文档
│           ├── Frontend-Architecture.md
│           └── Frontend-Execution-Plan.md
│
├── docs/                         # 项目级文档
│   └── Architecture-V3.0A-Frontend-Isolation.md  # 本文档
│
├── memory/                       # Claude Code Memory
└── package.json                  # 主项目 package.json（不动）
```

### 8.2 边界规则

```
┌─────────────────────────────────────────────────────────┐
│  C:\Dev\ai-todo                                         │
│                                                         │
│  ┌──────────────────────┐   ┌─────────────────────────┐ │
│  │  src/ (现有全栈主项目) │   │  apps/mobile-app/ (新)   │ │
│  │                      │   │                         │ │
│  │  ✅ 继续正常运行       │   │  ✅ 独立开发              │ │
│  │  ✅ 不被本阶段修改     │   │  ✅ Mock Service         │ │
│  │  ✅ 服务现有用户       │   │  ✅ 不引用 src/          │ │
│  │                      │   │                         │ │
│  │  ❌ 不能引用 apps/    │   │  ❌ 不能引用 src/        │ │
│  └──────────────────────┘   └─────────────────────────┘ │
│                                                         │
│  边界：两个工程完全独立，互不引用                          │
└─────────────────────────────────────────────────────────┘
```

- `apps/mobile-app` 不能 `import` 任何 `src/` 下的代码
- `src/` 不能 `import` 任何 `apps/mobile-app/` 下的代码
- 两边各自有独立的 `package.json`、`tsconfig.json`、`tailwind.config.ts`

---

## 9. 禁止修改范围

### 9.1 绝对禁止

| 范围 | 说明 |
|------|------|
| `src/**` | 所有现有源码 |
| `src/app/api/**` | 所有 API Route |
| `src/lib/supabase-*.ts` | Supabase 客户端 |
| `src/lib/ai-client.ts` | AI 客户端 |
| `src/prompts/**` | 所有 AI Prompt |
| `package.json` | 主项目配置 |
| `next.config.ts` | 主项目配置 |
| `tsconfig.json` | 主项目配置 |
| `tailwind.config.ts` | 主项目配置 |
| `postcss.config.mjs` | 主项目配置 |
| `docs/archive/**` | 归档文档 |
| 数据库 schema / migration | 数据库结构 |
| Supabase 配置 | 认证和数据 |

### 9.2 允许操作

| 操作 | 说明 |
|------|------|
| 创建 `apps/mobile-app/docs/**` | 前端专属文档 |
| 修改 `docs/Architecture-V3.0A-Frontend-Isolation.md` | 本文档（项目级） |
| 在 `docs/Project-State-Handoff.md` 末尾追加 | 仅追加，不改现有内容 |

---

## 10. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Mock 接口与真实 API 不一致 | 后续对接时需要改组件 | Service 层接口设计参考现有 API Route 的请求/响应格式 |
| App Shell 出现双重界面 | 底部导航内又套一层导航 | Code Review 重点检查，验收标准明确禁止 |
| 把旧 /app 页面简单套壳 | 信息架构没有实质改进 | 四 Tab 必须按设计稿实现，不接受"把 MainWorkspace 包一层 BottomTab" |
| Tailwind 配置与主项目不一致 | 合并后样式冲突 | 设计 Token 独立管理，合并时统一 |
| PWA safe-area 冲突 | 底部导航被系统手势条遮挡 | 使用 `env(safe-area-inset-bottom)` padding |
| mobile-app 类型与主项目 types.ts 脱节 | 合并时需要大量对齐 | types/app.ts 中的类型定义尽量与主项目 types.ts 同名同结构 |

---

## 11. 验收标准（项目级）

### 11.1 必须通过（P0）

- [ ] `apps/mobile-app/` 作为独立 Next.js 工程存在
- [ ] `npm run dev` 在 `apps/mobile-app/` 目录下正常启动
- [ ] 四 Tab 底部导航正常显示和切换
- [ ] 页面组件不直接写死数据（通过 service 层获取）
- [ ] 页面组件不直接 import mockData
- [ ] 不出现双重 App 壳
- [ ] 不出现把旧 /app 简单套壳的情况
- [ ] 未修改 `src/` 下任何文件
- [ ] 未修改主项目 `package.json`
- [ ] `npm run lint` 通过（在 apps/mobile-app/ 下）
- [ ] `npm run build` 通过（在 apps/mobile-app/ 下）

---

> **文档结束**
>
> **下一文档**：
> - 前端内部架构设计 → [`apps/mobile-app/docs/Frontend-Architecture.md`](../apps/mobile-app/docs/Frontend-Architecture.md)
> - 前端执行方案（Codex 操作手册）→ [`apps/mobile-app/docs/Frontend-Execution-Plan.md`](../apps/mobile-app/docs/Frontend-Execution-Plan.md)
>
> **关联文档**：
> - [Project-State-Handoff.md](Project-State-Handoff.md) — 项目当前状态交接文档
> - [Architecture-V3.0-Web-App-Separation.md](Architecture-V3.0-Web-App-Separation.md) — 旧 V3.0 架构方案（参考，已被本文档替代）
> - [PRD-V2.0.md](PRD-V2.0.md) — V2.0 产品规划
