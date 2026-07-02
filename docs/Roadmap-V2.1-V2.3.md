# Roadmap V2.1–V2.3 — AI Todo 后续升级路线

> **状态**：V2.1 ✅ 已完成，V2.1-Follow-up SMTP 🔜 下一阶段
> **依赖**：V2.0 主线 Phase 12-15 已关闭
> **上一文档**：[Roadmap-Phase12-15.md](Roadmap-Phase12-15.md)（Phase 12-15 中期路线图）
> **关联文档**：[PRD-V2.0.md](PRD-V2.0.md) · [PROJECT-CONTEXT.md](PROJECT-CONTEXT.md) · [Architecture-V2.1-Auth.md](Architecture-V2.1-Auth.md)
> **设计日期**：2026-07-02

---

## 目录

- [一、路线总览](#一路线总览)
- [二、V2.1：账号系统稳定化](#二v21账号系统稳定化)
- [2.5、V2.1-Follow-up：自定义 SMTP 与邮件确认稳定化](#二点五v21-follow-up自定义-smtp-与邮件确认稳定化)
- [三、V2.2：页面结构与产品体验升级](#三v22页面结构与产品体验升级)
- [四、V2.3：安全增强](#四v23安全增强)
- [五、为什么不跳过 V2.1 直接做 V2.2](#五为什么不跳过-v21-直接做-v22)
- [六、为什么 V2.2 放在 Auth 后](#六为什么-v22-放在-auth-后)
- [七、为什么 V2.3 放最后](#七为什么-v23-放最后)
- [八、推荐执行顺序](#八推荐执行顺序)
- [九、风险矩阵](#九风险矩阵)
- [十、当前下一步](#十当前下一步)

---

## 一、路线总览

V2.0 主线（Phase 12-15）已完成并关闭，核心闭环打通：

```
目标 → AI 拆解 → 执行 → 记录 → 统计 → 复盘 → 智能调整
```

下一步不是直接进入 Phase 16，而是补齐产品基础体验的短板。

| 版本 | 定位 | 核心内容 | 依赖 |
|:---:|------|------|------|
| **V2.1** | 账号系统稳定化 | Magic Link → Email+Password | ✅ 已完成 |
| **V2.1-Follow-up** | 自定义 SMTP 与邮件确认稳定化 | 自定义 SMTP、邮件模板编辑、发送稳定性 | 🔜 下一阶段 |
| **V2.2** | 页面结构与产品体验升级 | 路由分离（/ /login /app）、登录页独立设计、主工作台 UI 美化、移动端优化 | ⏭️ V2.1-Follow-up 后 |
| **V2.3** | 安全增强 | Turnstile 防机器人、忘记密码、安全优化 | ⏭️ V2.2 后 |

**推荐顺序：V2.1 → V2.1-Follow-up → V2.2 → V2.3，顺序执行，不并行。**

---

## 二、V2.1：账号系统稳定化

### 2.1 目标

把当前 Magic Link 登录改造成普通产品更常见的 Email + Password 账号体系，解决生产环境 Magic Link cookie 写入时序问题。

### 2.2 范围

| # | 功能 | 说明 |
|---|------|------|
| 1 | 邮箱 + 密码注册 | `supabase.auth.signUp({ email, password })` |
| 2 | 邮箱 + 密码登录 | `supabase.auth.signInWithPassword({ email, password })` |
| 3 | 注册后邮箱确认链接 | Supabase 内置确认邮件 |
| 4 | 登录 / 登出稳定 | 不依赖邮件跳转，一步登录 |
| 5 | 保留匿名任务 | device_id 模式完全不受影响 |
| 6 | 登录后触发匿名 → 用户任务迁移 | 现有 `POST /api/task-group/migrate` 逻辑不变 |
| 7 | Phase 15 generate-tasks 基于 user_id stats | `getAuthenticatedUserId()` 不变 |
| 8 | 未登录时继续基于 device_id stats | 回退逻辑不变 |

### 2.3 不做

| # | 不做 | 原因 |
|---|------|------|
| 1 | 手机验证码 | 需 SMS 服务商，成本高 |
| 2 | 邮箱 6 位验证码 | 流程比密码更复杂，且 Supabase email OTP 也需要回调 |
| 3 | Cloudflare Turnstile | 留给 V2.3 |
| 4 | 忘记密码 | 留给 V2.3 |
| 5 | 修改密码 | 留给 V2.3 |
| 6 | 第三方登录（Google/GitHub/微信） | OAuth 配置复杂，后续版本 |
| 7 | 账号中心 / 个人资料页 | 最小账号系统原则 |
| 8 | 用户昵称 / 头像 | 同上 |
| 9 | 会员系统 | 不在产品路线图 |
| 10 | 数据库 schema 变更 | 不需要 |

### 2.4 文件变更面

已实施，仅 5 个文件（详见 [Architecture-V2.1-Auth.md](Architecture-V2.1-Auth.md)）：

| # | 文件 | 操作 | 状态 |
|---|------|:---:|
| 1 | `src/hooks/useAuth.ts` | 修改（signIn → email+password，新增 signUp，移除 verifyOtp） | ✅ |
| 2 | `src/components/AuthModal.tsx` | 重写（双模式：登录/注册） | ✅ |
| 3 | `src/app/auth/callback/route.ts` | 简化（移除 Magic Link 处理，保留邮箱确认回调） | ✅ |
| 4 | `src/lib/constants.ts` | 修改（AUTH_TEXT 更新） | ✅ |
| 5 | `src/components/Header.tsx` | 微调（AuthModal props 适配） | ✅ |

### 2.5 已完成配置

Supabase Dashboard 已配置：Email provider 已启用、Allow new users to sign up 已开启、Confirm email 已开启。Site URL: `https://ai-todo-kappa-drab.vercel.app`。Redirect URLs: 生产域名 + `http://localhost:3000/**`。

### 2.6 已知待处理（V2.1-Follow-up / V2.3）

- **Confirm signup 邮件模板未自定义**：Supabase 新版要求先配置自定义 SMTP 才能编辑邮件模板。当前使用 Supabase 默认确认邮件。自定义 SMTP 留到 V2.1-Follow-up 或 V2.3 处理。
- **忘记密码**：留到 V2.3。

### 2.7 架构与执行文档

- [docs/Architecture-V2.1-Auth.md](Architecture-V2.1-Auth.md) — 架构方案
- [docs/Execution-Plan-V2.1-Auth.md](Execution-Plan-V2.1-Auth.md) — 执行方案

---

## 二点五、V2.1-Follow-up：自定义 SMTP 与邮件确认稳定化

### 2.5.1 定位

这是 V2.1 Auth 的 Follow-up 收尾阶段，**不是 V2.2，不是 V2.3**。

目标是提高注册确认邮件的稳定性和可控性，补齐 V2.1 Auth 主流程中遗留的邮件配置短板。

### 2.5.2 背景

1. **Supabase 默认邮件服务发送额度很低**，生产环境需要可靠的自定义 SMTP。
2. **新版 Supabase 要求先配置自定义 SMTP 才能编辑邮件模板**，当前 Confirm signup 邮件模板暂未自定义。
3. **这属于 V2.1 账号系统的收尾增强**，不应混入 V2.2 UI 美化。
4. **V2.2 UI 美化应在邮件确认稳定化之后再进入**。

### 2.5.3 范围

| # | 事项 | 说明 |
|---|------|------|
| 1 | 自定义 SMTP 配置 | 替换 Supabase 默认邮件服务，提高发送额度和稳定性 |
| 2 | Confirm signup 邮件模板可编辑 | SMTP 配置后即可编辑邮件模板 |
| 3 | 确认注册链接改为标准回调格式 | `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email` |
| 4 | 邮件发送限额和发件稳定性验证 | 确保注册流程不被邮件发送限制阻塞 |

### 2.5.4 不做

| # | 不做 | 原因 |
|---|------|------|
| 1 | 不改 Auth 业务代码 | 除非测试发现 callback 与自定义邮件模板不兼容 |
| 2 | 不改 UI | 不变更任何组件或样式 |
| 3 | 不改数据库 | 无 schema 变更 |
| 4 | 不进入 V2.2 | V2.1-Follow-up 完成后再进入 V2.2 |

### 2.5.5 完成标准

- 自定义 SMTP 配置完成并验证发送正常
- Confirm signup 邮件模板已自定义，使用标准回调 URL 格式
- 注册 → 邮件确认 → 登录 完整链路在自定义 SMTP 下测试通过
- 生产环境邮件发送稳定，无额度限制问题

---

## 三、V2.2：页面结构与产品体验升级

### 3.1 目标

V2.2 不只是 UI 美化，还包括页面路由结构升级：

1. **页面结构分离**：登录/注册页与 AI 拆分任务页分开，各自独立路由
2. **产品体验升级**：让 AI Todo 从"功能可用"升级到"看起来像一个正式产品"

### 3.2 路由结构调整

```
/          产品首页 / Landing Page
/login     登录 / 注册页面（独立承载 AuthModal 流程）
/app       AI Todo 主工作台 / 拆分任务页面（需登录）
```

- `/login` 承载账号登录注册，聚焦 Auth 体验
- `/app` 承载目标输入、AI 拆分、任务执行、统计、历史、复盘
- 匿名模式策略需在 V2.2 架构阶段重新确认（匿名用户是否可访问 `/app`？是否需要 `/app` 自动重定向到 `/login`？）
- 页面拆分不在 V2.1-Follow-up SMTP 中进行

### 3.3 子阶段

V2.2 可拆分为 4 个子阶段，每步独立验收：

| 子阶段 | 名称 | 内容 |
|:---:|------|------|
| **V2.2A** | 页面路由结构升级 | Next.js App Router 路由重组：`/` `/login` `/app` 三页面结构，Auth 路由守卫，匿名模式策略确认 |
| **V2.2B** | 登录/注册页独立设计 | `/login` 页面 UI 设计，独立于主工作台，移动端优先 |
| **V2.2C** | 主工作台 UI 美化 | `/app` 页面整体 UI 美化：统一色板、字体层级、圆角/阴影/间距 Token、视觉一致性 |
| **V2.2D** | 移动端体验优化 | 底部安全区、触摸反馈、下拉刷新、键盘适配、任务卡片/统计/历史/复盘组件打磨 |

### 3.4 UI 美化范围（V2.2C + V2.2D）

| # | 模块 | 内容 |
|---|------|------|
| 1 | 整体 UI 美化 | 统一色板、字体层级、圆角/阴影/间距 Token、视觉一致性 |
| 2 | 首页视觉优化 | Landing Page 布局、品牌感提升 |
| 3 | 任务卡片优化 | TaskItem 样式、勾选动效、完成态视觉、触控反馈 |
| 4 | StatsBar 优化 | 统计卡片视觉升级、移动端 4 卡片不溢出 |
| 5 | HistoryPanel 优化 | 历史卡片样式、展开/收起动画、空状态插画 |
| 6 | AI 复盘卡片优化 | TaskReviewPanel 样式、状态机各态视觉、骨架屏 |
| 7 | 移动端细节优化 | 底部安全区、触摸反馈（active states）、下拉刷新体验、输入框键盘适配 |
| 8 | 空状态 / loading / error 三态统一 | LoadingState、EmptyState、ErrorMessage 视觉统一、Toast 提示系统 |
| 9 | 保持当前功能逻辑不变 | 不改 hook、不改 API、不改 AI 策略、不改数据流 |

### 3.5 不做

| # | 不做 | 原因 |
|---|------|------|
| 1 | 不改 Auth 逻辑 | V2.1 域 |
| 2 | 不改 generate-tasks 策略 | V2.0/Phase 15 域 |
| 3 | 不改 Supabase schema | 基础设施 |
| 4 | 不改 API 响应结构 | 后端协议不变 |
| 5 | 不做大型重构 | 不改组件数据流，路由升级只拆分页面不重构状态管理 |
| 6 | 不新增复杂动画库 | 优先 CSS transition/animation，不引入 framer-motion 等 |
| 7 | 不引入设计系统大迁移 | 不迁移到 shadcn/ui、Radix 等，保持 Tailwind CSS 原生 |

### 3.6 安全区

V2.2 触碰：`src/app/` 页面文件（路由重组）、所有 `src/components/*.tsx`、`tailwind.config.ts`、`globals.css`、`constants.ts`（仅 UI 常量）、新增 Auth 路由守卫（middleware 或 page-level guard）。

V2.2 不触碰：任何 `src/app/api/`、`src/hooks/`（除可能需适配路由变更的微小调整）、`src/lib/`（除 constants.ts 的 UI 部分）。

### 3.7 执行方式

- 先由 Claude Code 写 `docs/Architecture-V2.2-UI.md`（V2.2 页面结构与产品体验升级架构方案）
- 架构方案需明确：路由结构、匿名模式策略、Auth 路由守卫方案、子阶段拆分细节
- 再由 ChatGPT 审查
- 通过后写执行方案、Codex 实现

---

## 四、V2.3：安全增强

### 4.1 目标

在账号系统稳定后，增强注册登录安全和反滥用能力，降低机器人注册和暴力破解风险。

### 4.2 范围

| # | 功能 | 说明 |
|---|------|------|
| 1 | Cloudflare Turnstile 防机器人 | 注册/登录表单嵌入 Turnstile widget，服务端校验 |
| 2 | 忘记密码 | `supabase.auth.resetPasswordForEmail()` + 重置密码页面 |
| 3 | 邮箱验证码可选升级 | 探索 email OTP 作为二次验证（可选，非默认） |
| 4 | 账号安全优化 | 密码强度提示、登录错误信息脱敏、Supabase rate limit 配置检查 |
| 5 | 注册 / 登录错误提示优化 | 统一错误码映射、中文提示精细化、避免信息泄露 |

### 4.3 不做

| # | 不做 | 原因 |
|---|------|------|
| 1 | 手机验证码 | 需 SMS 服务商，成本高 |
| 2 | 第三方登录 | OAuth 配置复杂，后续版本 |
| 3 | 会员系统 | 不在产品路线图 |
| 4 | 复杂账号中心 | 最小账号系统原则 |
| 5 | 权限分级 | 当前单用户场景不需要 |

### 4.4 注意

V2.3 涉及 Supabase Dashboard 配置变更（开启 rate limit、自定义 SMTP、邮件模板）和 Cloudflare Turnstile 的 site key / secret key 配置。这些不是代码变更，但需要部署环境变量和第三方服务配置。

---

## 五、为什么不跳过 V2.1 直接做 V2.2

**V2.1 必须先做，V2.2 UI 美化不应先行。**

| 维度 | 说明 |
|------|------|
| **生产环境真实问题** | Magic Link 在 Vercel Serverless 环境中存在 cookie 写入时序问题，用户点击邮件链接后页面仍显示"未登录"。这是一个真实的功能缺陷，不是体验问题 |
| **账号稳定影响数据归属** | 登录不稳定 → 用户数据无法可靠绑定到 user_id → 多设备同步、历史记录、统计复盘的数据一致性受损 |
| **Auth 改造和 UI 美化不应混在一个版本** | 如果同时改 Auth 和 UI，出问题时无法快速定位是登录逻辑问题还是 UI 渲染问题 |
| **先保证功能可靠，再提升视觉体验** | 产品底线：用户能用 → 用得稳定 → 用得好看。不能先"好看"再"稳定" |

---

## 六、为什么 V2.2 放在 Auth 后

| 维度 | 说明 |
|------|------|
| **方便问题定位** | V2.1 上线后稳定运行一段时间，确认登录/注册/登出/迁移无 bug，再做 UI 改动。如果 UI 改动后出现问题，能确定是 UI 层而非 Auth 层 |
| **先稳定再美化** | 账号系统是数据归属的基石。基石不稳时美化 UI，等于在沙地上盖房子 |
| **用户心智** | 用户首次使用如果遇到登录问题，再好看的 UI 也无法挽回信任。先让登录"一气呵成"，再让界面"赏心悦目" |
| **改动面不重叠** | V2.1 改 5 个文件，V2.2 改组件层 + CSS。两者改动面完全正交，适合顺序执行 |

---

## 七、为什么 V2.3 放最后

| 维度 | 说明 |
|------|------|
| **CAPTCHA / 忘记密码属于安全增强** | 不是账号主流程的必需品。V2.1 的最小账号系统（注册+登录+登出）已经覆盖核心使用场景 |
| **需要额外配置** | Cloudflare Turnstile 需要注册站点、获取 site key/secret key、配置环境变量。Supabase 邮件模板需要额外配置。这些不应阻塞 V2.1 核心流程 |
| **不应阻塞 V2.1 的主流程** | V2.1 的核心价值是"稳定的 Email+Password 登录"。Turnstile 和忘记密码是锦上添花，不是雪中送炭 |
| **V2.3 可能根据 V2.1 上线后的实际数据调整** | 如果 V2.1 上线后没有机器人注册问题，Turnstile 的优先级可以降低。如果忘记密码需求很少，也可以后移 |

---

## 八、推荐执行顺序

```
V2.1 Auth（✅ 已完成）
  │
  ├── 1. ChatGPT 审查 Architecture-V2.1-Auth.md        ✅
  ├── 2. Claude Code 写 Execution-Plan-V2.1-Auth.md    ✅
  ├── 3. ChatGPT 审查执行方案                           ✅
  ├── 4. Codex 按执行方案实现（仅 5 个文件）            ✅
  ├── 5. Claude Code Code Review                       ✅
  ├── 6. ChatGPT 最终把关                               ✅
  ├── 7. 提交 + Vercel 部署                             ✅
  └── 8. 生产环境验证（登录/注册/登出/迁移）             ✅
  │
  ▼
V2.1-Follow-up SMTP（🔜 下一阶段）
  │
  ├── 1. 配置自定义 SMTP 服务
  ├── 2. 编辑 Confirm signup 邮件模板（回调 URL 格式）
  ├── 3. 验证注册 → 邮件确认 → 登录完整链路
  ├── 4. 确认邮件发送稳定性和额度
  └── 5. 完成 V2.1 收尾
  │
  ▼
V2.2 UI 升级（⏭️ V2.1-Follow-up 后）
  │
  ├── V2.2A 页面路由结构升级
  │   ├── 1. Claude Code 写 Architecture-V2.2-UI.md（含路由结构、匿名策略、Auth 守卫）
  │   ├── 2. ChatGPT 审查
  │   ├── 3. Codex 实现路由重组（/ /login /app）
  │   ├── 4. Claude Code Review
  │   └── 5. ChatGPT 把关 + 提交
  │
  ├── V2.2B 登录/注册页独立设计
  │   └── ... （同标准工作流）
  │
  ├── V2.2C 主工作台 UI 美化
  │   └── ... （同标准工作流）
  │
  └── V2.2D 移动端体验优化
      └── ... （同标准工作流）
  │
  ▼
V2.3 安全增强（⏭️ V2.2 后）
  │
  ├── 1. Claude Code 写 Architecture-V2.3-Security.md
  ├── 2. ... （同 V2.1 流程）
  └── 8. 提交 + 部署 + 第三方服务配置
```

**之所以不并行 V2.1 和 V2.2**：改动面虽然正交，但 V2.1 上线后需要观察期（确认登录稳定），V2.2 的 UI 设计也可能需要参考 V2.1 的新 AuthModal（双模式登录/注册 UI）来统一视觉风格。

---

## 九、风险矩阵

| # | 风险 | 等级 | 影响 | 版本 | 状态 |
|---|------|:---:|------|:---:|:--:|
| 1 | V2.1 Auth 改造可能影响匿名 → 登录任务迁移 | **P1** | 用户登录后任务丢失 | V2.1 | ✅ 已验证（迁移逻辑不变） |
| 2 | V2.1 `signInWithPassword` 在 Vercel Serverless 中 cookie 写入失败 | **P1** | 登录后 session 丢失 | V2.1 | ✅ 已验证（生产环境测试通过） |
| 3 | V2.1 现有 Magic Link 老用户无法登录 | **P2** | 需重新注册 | V2.1 | ✅ 已接受（用户量极少） |
| 4 | V2.2 路由重组可能影响现有功能逻辑 | **P1** | 页面拆分后路由守卫错误导致无限重定向、任务勾选/生成等功能异常 | V2.2 | V2.2A 路由升级为独立子阶段，每步 lint+build 门禁，架构方案明确匿名模式策略和 Auth 守卫方案 |
| 5 | V2.2 移动端适配可能在不同设备/浏览器上表现不一致 | **P2** | 部分用户视觉异常 | V2.2 | Tailwind CSS 响应式 class + safe-area-inset 已在 V1.0 验证；V2.2 不改布局结构 |
| 6 | V2.2 改动面大（路由 + 组件 + CSS），可能引入回归 bug | **P2** | 功能回归 | V2.2 | 拆分 V2.2 为子阶段（A:路由结构 → B:登录页设计 → C:主工作台美化 → D:移动端优化），每步独立验收 |
| 7 | V2.3 Cloudflare Turnstile 引入部署配置复杂度 | **P2** | 环境变量、第三方依赖 | V2.3 | V2.3 独立阶段，不阻塞 V2.1/V2.2。Turnstile 失败时降级为无 CAPTCHA 模式 |
| 8 | Confirm signup 邮件模板未自定义 | **P2** | 邮件确认体验不完整，依赖 Supabase 默认模板 | V2.1 | 已纳入 V2.1-Follow-up SMTP 阶段，不阻塞 V2.1 主流程关闭，但会作为下一阶段处理 |
| 9 | V2.3 忘记密码依赖 Supabase 邮件模板配置 | **P2** | 邮件模板未配置时用户体验差 | V2.3 | 自定义 SMTP 在 V2.1-Follow-up 中配置完成后，忘记密码邮件模板即可编辑 |

---

## 十、当前下一步

```
当前下一步：
  ── 不是 V2.2 UI 升级
  ── 不是 V2.3 安全增强
  ── 不是 Phase 16
  ── 是 V2.1-Follow-up：自定义 SMTP 与邮件确认稳定化

V2.1 Auth ✅ 已完成（代码 + Supabase Dashboard 配置 + 生产环境测试）。

路线：
  V2.1 Auth ✅ → V2.1-Follow-up SMTP 🔜 → V2.2 页面结构与产品体验升级 ⏭️ → V2.3 Security ⏭️

具体动作：
  1. 配置自定义 SMTP 服务（替换 Supabase 默认邮件服务）
  2. 编辑 Confirm signup 邮件模板为：
     {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email
  3. 验证注册 → 邮件确认 → 登录完整链路
  4. 确认邮件发送稳定后，关闭 V2.1-Follow-up，再进入 V2.2
```

**当前禁止**：修改 `src/` 任何文件、提交 git commit、修改数据库 schema、新增 npm 依赖。不要进入 V2.2 实现，直到 V2.1-Follow-up SMTP 完成。不要修改 Auth 业务代码，除非测试发现 callback 不兼容自定义邮件模板。

---

> **文档结束**
>
> **下一文档**：V2.1-Follow-up SMTP 配置完成后 → `docs/Architecture-V2.2-UI.md`（V2.2 页面结构与产品体验升级架构方案，待编写）
>
> **关联文档**：
> - [PRD-V2.0.md](PRD-V2.0.md) — V2.0 产品规划
> - [Roadmap-Phase12-15.md](Roadmap-Phase12-15.md) — Phase 12-15 中期路线图（已完成）
> - [Architecture-V2.1-Auth.md](Architecture-V2.1-Auth.md) — V2.1 Auth 架构方案（✅ 已完成）
> - [Execution-Plan-V2.1-Auth.md](Execution-Plan-V2.1-Auth.md) — V2.1 Auth 执行方案（✅ 已完成）
> - [PROJECT-CONTEXT.md](PROJECT-CONTEXT.md) — 项目长期上下文
> - [PROJECT-INDEX.md](PROJECT-INDEX.md) — 项目文件索引