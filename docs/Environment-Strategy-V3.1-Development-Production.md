# 清行 V3.1 Development / Production 环境策略与交接

> **文档定位：** 本文是清行环境配置、Auth 环境与部署环境事实的长期单一事实源。新会话、Claude Code、Codex 在处理环境、Auth 或部署任务前必须先读取本文。
>
> **敏感信息：** 本文只记录非敏感环境事实、资源角色、变量名称和门禁；完整 Key、密码、Token、Cookie、数据库密码、原始 provider payload 一律不得写入。
>
> **维护规则：** 环境事实变化后，必须由 Claude Code 更新本文，ChatGPT Review、用户确认后再提交；不得只在聊天或临时提示词中记录。
>
> **文档阶段：** 初稿，等待 ChatGPT Review。
>
> **阶段状态：** A0-D：部分完成；A1：尚未授权；A1.5：尚未开始；Production：尚未创建、尚未启用。

---

## 1. 环境最高原则

```text
Development ≠ Production
```

Development 与 Production 必须是两套隔离环境，以下资源不得共用：

- Supabase Project；
- Auth 用户池与正式账号；
- Database 与正式业务数据；
- API URL；
- publishable key；
- server secret；
- 环境变量；
- Site URL；
- Redirect URL allowlist；
- Email Template；
- 测试账号；
- 日志与数据；
- Vercel Preview 与 Vercel Production。

强制规则：

1. Development 数据不得迁移为正式用户数据。
2. Production 不得复用 Development 的 Auth 用户池或数据库。
3. Vercel Preview 不是 Production，不得承载正式 Auth、正式用户或正式业务数据。
4. 未有明确、可审计证据时，任何现有 Vercel / Supabase 资源只能标为 `Unknown`；不得依名称推断环境角色。
5. 未获得逐项授权前，不得恢复或修改 Unknown Supabase 项目、修改 Vercel、写入环境变量、创建正式用户，或进入 A1 施工。

---

## 2. 当前环境资源事实

### 2.1 Supabase 资源表

| 资源 | 名称 / Ref | Region | 当前状态 | 环境角色 | 允许用途 | 禁止用途 |
|---|---|---|---|---|---|---|
| Development Supabase | `qingxing-dev` / `hrmxidnjgvdyynbrrxfs` | `ap-southeast-1`（新加坡） | `ACTIVE_HEALTHY` | **Development** | V3.1-A Auth 开发、OTP、密码、Session 恢复、local signOut、Recovery、多标签页、多浏览器 Profile、A1.5。 | Production、正式用户、正式业务数据、中国大陆正式上线、真实个人主账号测试。 |
| 旧 Supabase | `vcckgcgrzckxdzwjyvdp` | 未确认 | `INACTIVE`（已知状态） | **Unknown** | 无。 | 恢复、修改、Development、Production、A1.5、数据迁移、读取或输出任何 Key。 |
| Production Supabase | 尚未创建 | 尚未决定 | 尚未启用 | **Production（目标）** | 仅在 V3.1-A Development 验证关闭后按后续授权准备。 | 当前创建、启用、测试或接入。 |

### 2.2 `qingxing-dev` 的锁定规则

`qingxing-dev` 是唯一指定的 Development Supabase Project。

允许的 Development 验证范围：

- V3.1-A Auth 开发；
- 六位 Email OTP 测试；
- 显式注册与密码设置测试；
- password login；
- Session 初始化与恢复；
- `auth.signOut({ scope: "local" })`；
- Recovery fail-closed；
- 同一浏览器多标签页；
- 多浏览器 Profile / 隐私窗口隔离；
- A1.5 同源 Session / Cookie MVP。

账号与数据限制：

- 只使用专用测试账号和测试邮箱；
- 禁止使用真实个人主邮箱；
- 禁止写入或保留真实用户数据；
- Recovery 测试只在 Development 执行；
- Development Auth 用户、测试数据、邮件记录均不得迁移到 Production。

### 2.3 旧 Unknown 项目隔离

旧项目 `vcckgcgrzckxdzwjyvdp` 的角色、用户和数据均未完成确认，因此必须保持隔离：

- 不恢复；
- 不修改；
- 不用于 Development；
- 不用于 Production；
- 不用于 A1.5；
- 不迁移数据；
- 不读取或输出 Key；
- 角色、用户和数据完成独立只读审计前，持续保持 `Unknown`。

---

## 3. Development 本地拓扑

### 3.1 目标结构

```text
Browser
  http://qingxing.localhost:<待锁定固定端口>
          │
          ▼
Development Unified Origin / local Gateway
  ├─ /              → mobile App http://127.0.0.1:3001
  └─ /api/auth/me   → root Web/API http://127.0.0.1:3000
```

| 组件 | 固定目标 | 当前状态 |
|---|---|---|
| root Web / API | `http://127.0.0.1:3000` | 本地 upstream 已锁定。 |
| mobile App | `http://127.0.0.1:3001` | 本地 upstream 已锁定。 |
| Development Unified Origin | `http://qingxing.localhost:<待锁定固定端口>` | 本地 Gateway 工具与固定端口尚未最终锁定。 |
| `/` | mobile `127.0.0.1:3001` | 目标路由。 |
| `/api/auth/me` | root `127.0.0.1:3000` | 仅用于 A1.5 同源验证的目标路由。 |

### 3.2 Gateway 边界

- 本地 Gateway 工具尚未最终锁定。
- 本地 Gateway 固定端口尚未最终锁定。
- Gateway 与固定端口是 **A1.5 前置条件**，必须在 A1.5 前经单独授权锁定。
- 它不是当前 A1 service/controller 代码设计的 Production Gateway。
- Production Gateway 后续单独建设；不得把本地 Gateway 临时实现当作 Production ingress。
- Vercel 不作为 A1.5 本地 Auth 验证入口。
- A1.5 只能以这个 Development Unified Origin 验证同源 Cookie、`/api/auth/me`、缓存策略和 local signOut 行为。

### 3.3 Development Redirect URL

Development Redirect URL 必须是 A0 后锁定的精确同源地址：

```text
http://qingxing.localhost:<待锁定固定端口>/
```

规则：

- 不得使用正式 Production HTTPS 域名；
- 必须在 A1.5 前，以准确地址加入 `qingxing-dev` 的 Redirect URL allowlist；
- Recovery 验证使用专用测试邮箱；
- 不在文档、日志或截图中记录 recovery token、`token_hash`、Cookie 或原始 provider payload；
- A1.5 结束后，临时 Development Redirect URL 默认应移除；如需保留，必须由 ChatGPT 明确记录理由。

---

## 4. 本地环境文件策略

### 4.1 Mobile Development 环境文件（未来授权创建）

预计文件：

```text
C:\Dev\ai-todo\apps\mobile-app\.env.local
```

预计变量名及目标含义：

| 变量名 | Development 目标含义 |
|---|---|
| `NEXT_PUBLIC_QINGXING_AUTH_MODE` | 固定为 `real`。 |
| `NEXT_PUBLIC_SUPABASE_URL` | `qingxing-dev` 的 public URL。 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `qingxing-dev` 的现代 publishable key。 |

当前状态：mobile `.env.local` **未创建**。

不得在本文写入任何实际值。

### 4.2 Root Development 环境文件

现有文件：

```text
C:\Dev\ai-todo\.env.local
```

当前事实：

- root `.env.local` 已存在；
- 当前配置指向旧 Unknown Supabase ref `vcckgcgrzckxdzwjyvdp`；
- 不得直接覆盖；
- 后续必须在独立、明确授权中，由 Claude Code 先确认 root API 所需变量名称与作用；
- root 与 mobile 的最终 Development 环境必须指向同一个 `qingxing-dev`；
- 修改前必须先备份变量名称和作用；不得把敏感值复制进本文、提示词、日志或 Git diff。

### 4.3 环境文件规则

- `.env.local` 只保存在本机；
- root [`.gitignore`](../.gitignore) 已忽略 `.env*`，仅保留 `.env.example`；
- mobile [`.gitignore`](../apps/mobile-app/.gitignore) 已忽略 `.env.local`；
- `.env.local` 不得提交 GitHub；
- 不得将 `.env.local` 内容写入 Markdown；
- 不得将完整 Key 粘贴到 Codex 或 Claude Code 提示词；
- Claude Code、Codex 仅可在本地获授权的运行过程中读取必要变量；
- Git diff、ChatGPT Review 材料、日志与截图不得出现完整 Key。

---

## 5. Key 与敏感信息规则

### 5.1 可进入浏览器的公开配置

以下是 mobile Real Auth 的公开客户端配置：

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

现代 publishable key 是公开客户端配置，可以进入 browser bundle，但仍不得：

- 写入 Git；
- 写入本文或任何 Markdown；
- 写入日志；
- 无关传播；
- 被误称为 server secret。

### 5.2 绝对禁止项

以下内容绝不允许进入客户端、browser bundle、文档、日志、analytics、URL 或无关组件：

```text
SUPABASE_SERVICE_ROLE_KEY
sb_secret_*
任何服务端 secret key
数据库密码
access token
refresh token
原始 Cookie
邮件 recovery token
token_hash
raw provider payload
```

额外规则：

- mobile Real Auth 不得默认使用 `NEXT_PUBLIC_SUPABASE_ANON_KEY`；
- 不得使用旧 Unknown 项目的任何 Key；
- email、六位 OTP、password、confirmPassword 仅可短期存在于当前表单局部 state 或原生输入控件，不得进入顶层 AuthState、Facade 长期状态、URL、storage、Cookie、日志或 analytics；
- OTP、密码和确认密码必须按 Execution Plan 规定在 submit、success、screen change、signOut、unmount 等节点清理。

---

## 6. Vercel 当前状态与边界

| 项目 | 当前已知事实 | 当前角色 / 结论 |
|---|---|---|
| Vercel Team | 已存在；本地仓库没有 `.vercel/project.json`。 | Unknown；需平台只读证据确认。 |
| Vercel Project | `ai-todo`。 | Unknown；不得因项目名称视为 Development 或 Production。 |
| 已确认项目数量 | 当前只有一个已确认的 Vercel project。 | 是否存在第二项目仍须在 Vercel Dashboard 只读核验。 |
| 最近 Production deployment | `ERROR`。 | 不等同于 Production 环境可用。 |
| Deployment Root Directory / Build context | 未确认。 | 当前构建问题的主要调查方向。 |
| Vercel Preview | 未确认具体 domain / 配置。 | 明确不是 Production。 |

### 6.1 已知构建错误与本地核验

已知 Vercel 构建错误涉及：

```text
apps/mobile-app/app/page.tsx
无法解析：@/components/auth/AuthShell
```

本地只读核验已确认：

- [AuthShell.tsx](../apps/mobile-app/components/auth/AuthShell.tsx) 存在；
- import 与文件、目录大小写一致；
- 文件已被 Git 跟踪，且其提交是当前 HEAD 的祖先；
- mobile [tsconfig.json](../apps/mobile-app/tsconfig.json) 的 `@/* → ./*` alias 正确；
- root [tsconfig.json](../tsconfig.json) 使用不同的 `@/* → ./src/*` alias；
- root 与 mobile 是两个独立 Next.js package，均有独立 `package.json` 与 `next build`；仓库没有 tracked Vercel Root Directory、build command 或 monorepo 编排配置。

当前结论：

1. 当前代码基线中的 `AuthShell` 文件缺失、大小写或 mobile alias 错误，不是已证实根因；
2. 问题更可能来自 Vercel Root Directory、build context、部署源码基线，或外部 project 配置；
3. 当前不修复；
4. Production 准备阶段再处理 Vercel 项目拆分、正式域名和正式 ingress；
5. 所需下一份只读证据为：Vercel Team、Project Git connection、deployment commit、Root Directory、Install Command、Build Command、完整 build log、Production / Preview domain、环境变量范围与是否存在第二项目。

---

## 7. Production 目标策略

Production 现在只规划，**不得创建、不得启用、不得使用**。

### 7.1 开始时间

| 事项 | 最早时间 |
|---|---|
| Production 基础准备 | V3.1-A Development 验证关闭后。 |
| 真实业务数据内部 Production 验证 | V3.1-B 完成后。 |
| 正式开放用户 | V3.3。 |

### 7.2 唯一目标模型

Production 必须采用以下相互隔离的资源：

```text
正式 HTTPS Domain
        │
        ▼
正式 public ingress / same-origin Gateway
  ├─ /              → 正式 mobile deployment
  └─ /api/auth/me   → 正式 root API deployment

独立 Production Supabase Project
  ├─ 独立 Auth 用户池
  ├─ 独立 Database
  ├─ 独立 Site URL / Redirect URL allowlist
  ├─ 独立 Email Template
  └─ 独立 Production environment variables
```

Production 必须具备：

- 正式 HTTPS 域名；
- 正式 public ingress / same-origin Gateway；
- 正式 mobile deployment；
- 正式 root API deployment；
- 独立 Production Supabase Project；
- 独立 Auth 用户池和 Database；
- 独立 Production environment variables；
- 正式 Site URL；
- 正式 Redirect URL allowlist；
- 正式六位 OTP Email Template；
- Auth / Session 路径的 Cookie、`Set-Cookie`、`Cache-Control`、`Expires`、`Pragma` 透传；
- Auth / Session / `/api/auth/me` 路径 Caching Disabled 或 Minimum TTL=0，禁止 shared cache、ISR 和静态缓存；
- 正式数据、正式账号与测试数据完全隔离；
- 中国大陆部署、网络稳定性、域名、ICP备案、合规与邮件服务在 V3.3 单独评估。

Production 不得：

- 复用 `qingxing-dev` 的 Supabase Project、Auth 用户池、Database、公开 URL、publishable key、server secret、Site URL、Redirect URL、Email Template、日志或测试数据；
- 使用 Vercel Preview 作为正式域名或正式 Auth 环境；
- 混入 Development 测试账号、Recovery 测试记录或测试任务；
- 在 V3.1-A 阶段提前创建或启用。

---

## 8. A0-D、A1、A1.5 与 Production 门禁

### 8.1 A0-D

**已完成：**

- 独立 Development Supabase `qingxing-dev` 已创建；
- Region 锁定为新加坡；
- Development 环境角色锁定；
- 旧 Unknown 项目隔离。

**待完成：**

- mobile 本地环境变量；
- root Development 环境变量；
- 本地 Gateway 工具；
- 本地 Gateway 固定端口；
- Development Redirect URL；
- 专用测试邮箱；
- Development Email OTP 模板确认为六位 Token / OTP。

### 8.2 A1

状态：**尚未授权。**

A1 获授权后的范围仅包括：

- Auth facade；
- Real / Mock adapter；
- Supabase browser client；
- Auth controller；
- 精确锁定的必要依赖；
- Development 环境读取。

A1 仍不得：

- 接入真实任务、历史、成长、AI 或 V3.1-B；
- 修改 `src/**`、根 API Route、数据库、RLS 或 Mock source；
- 创建 Production；
- 省略 ChatGPT Review、精确文件范围与独立授权。

### 8.3 A1.5

状态：**尚未开始。**

前置条件：

1. A1 已完成并通过 Review；
2. 本地 Gateway 已完成；
3. Development Redirect URL 已完成并被允许；
4. 专用测试账号已准备；
5. 真实 Recovery 测试路径可用；
6. `qingxing-dev` 的 Email OTP 模板已确认使用六位 Token / OTP；
7. 同源 Cookie / `Set-Cookie` / cache-policy 验证条件具备。

A1.5 失败时必须停止，不得进入 A2；不得以跨域、前端 userId、service role 或 Production / Unknown 项目绕过。

### 8.4 Production

状态：**尚未创建、尚未启用。**

Production 不是当前 A1 的阻断条件。当前 A1 的阻断条件是 Development 环境事实、A0-D 待完成项与 ChatGPT 逐阶段授权。

---

## 9. 职责分工

| 角色 | 职责 |
|---|---|
| ChatGPT | 环境方向判断、阶段授权、产品与安全门禁、审查 Claude Code 报告、决定是否允许 Codex、决定是否提交。 |
| Claude Code | 读取本文；环境只读盘点；执行方案；检查环境文件是否被忽略；检查代码是否使用正确变量；Review；lint / build；Git 范围核验；更新本文；按授权提交。 |
| Codex | 只在明确授权后按精确文件范围写代码；不得决定环境架构、创建 Production、自行修改 Supabase 或 Vercel、自行提交。 |
| 用户 | 确认关键环境选择；提供必要平台权限；执行测试邮箱操作；最终验收；确认提交。 |

---

## 10. 环境变更流程

任何环境事实或配置变化必须遵循：

```text
环境事实变化
→ Claude Code 更新本文
→ ChatGPT Review
→ 用户确认
→ Claude Code 按指定文件提交
```

禁止：

- 只在聊天中记录；
- 只写入临时提示词；
- 未经 Review 直接修改环境；
- 未经确认直接提交；
- 将 Key、密码、Token、Cookie、数据库密码写入本文或其他 Markdown。

---

## 11. 当前下一步

1. Claude Code 完成 A1 开工前最终只读核验；
2. 锁定 mobile `.env.local` 与 root `.env.local` 的处理方式；
3. 锁定本地 Gateway 工具和固定端口；
4. ChatGPT 审查本文与 A0-D 事实；
5. 用户确认是否进入 A1；
6. ChatGPT 下发 Codex A1 精确施工指令。

不得将 Production 当成当前阻断 A1 的条件；Production 仅按本文件第 7 节在 V3.1-A Development 验证关闭后准备。

---

## 12. 文档末尾状态摘要

| 项目 | 当前状态 | 下一门禁 |
|---|---|---|
| `qingxing-dev` | `ACTIVE_HEALTHY` / Development | 本地变量接入。 |
| 旧 Supabase | `Unknown` / 隔离 | 不处理。 |
| Mobile env | 未创建 | A1 授权。 |
| Root env | 已存在旧配置，待安全处理 | Claude Code 只读核验。 |
| Local Gateway | 未锁定 | A1.5 前完成。 |
| A1 | 未授权 | ChatGPT 授权。 |
| A1.5 | 未开始 | A1 Review 通过。 |
| Production | 未创建 | V3.1-A 后准备。 |
| Codex | 未授权 | A1 条件满足。 |

---

## 13. 关联文档与读取顺序

处理环境、Auth 或部署任务时，优先读取：

1. 本文；
2. [Project-State-Handoff.md](Project-State-Handoff.md)；
3. [Architecture-V3.1-A-Mobile-Auth.md](Architecture-V3.1-A-Mobile-Auth.md)；
4. [V3.1-A-Auth-Flow-Lock.md](V3.1-A-Auth-Flow-Lock.md)；
5. [Execution-Plan-V3.1-A-Mobile-Auth.md](Execution-Plan-V3.1-A-Mobile-Auth.md)；
6. [Roadmap-V3.0C-to-V3.3-Mobile-Production.md](Roadmap-V3.0C-to-V3.3-Mobile-Production.md)。

本文记录环境事实与交接，不替代 Architecture、Execution Plan 或逐阶段施工授权。
