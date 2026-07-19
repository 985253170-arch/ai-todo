# V3.1-A Execution Plan — Mobile 真实认证

> **状态：** Execution Plan Review 修订稿，等待 ChatGPT Review；不是代码授权。
>
> **Architecture：** [Architecture-V3.1-A-Mobile-Auth.md](Architecture-V3.1-A-Mobile-Auth.md) 已通过 ChatGPT Review（P0：0；P1：0；P2：3）。
>
> **权限：** 本文件只设计未来的分阶段实施。Codex 尚未获得代码授权；不得据此修改代码、安装依赖、创建临时入口、设置环境变量、修改 Supabase、commit 或 push。只有本方案再次经 ChatGPT Review 通过并获得逐阶段明确授权后，才可能施工。

---

## 1. 目标、基线与现行产品锁定

V3.1-A 只为独立 mobile App 建立真实邮箱认证闭环：已有帐号 OTP 登录、显式注册、首次设置密码、密码登录、Session 初始化与恢复、local signOut、我的页真实帐号状态。它不涉及真实任务、deviceId、匿名迁移、历史、成长、AI、任务同步或 V3.1-B。

### 1.1 Git 与功能基线

| 项目 | 值 | 含义 |
|---|---|---|
| 分支 | `main` | 当前文档基线。 |
| HEAD / origin/main | `c7abd47b7d48034970f06fad7e52a476e0500dd1` | 最新文档 / Handoff 基线，二者相等。 |
| Architecture commit | `bd9d27094dea383651292d2cfe494b939e2537fd` | `docs: finalize V3.1-A auth architecture`。 |
| 最新功能代码基线 | `9dcab1f4b20a3df3f7fce0d22ef99cfa21b7179b` | V3.0D-D3 `fix: improve mobile task execution flow`。 |

**HEAD 是文档与 Handoff 基线；最新功能代码基线是 V3.0D-D3。两者不得混淆。**

### 1.2 不可变产品流程

```text
已有帐号 OTP 登录
→ sendOtp intent = sign-in
→ shouldCreateUser: false

显式注册
→ sendOtp intent = sign-up
→ shouldCreateUser: true

密码登录成功
→ authenticated
→ AppShell
→ password_set 仅 best-effort 补写；失败不阻断、不降级

退出当前帐号
→ auth.signOut({ scope: "local" })
```

- OTP / 注册 OTP / 启动恢复的 `password_set !== true`：进入 `authenticated-needs-password`，只显示 password setup，不显示 AppShell。
- 同浏览器共享同一 Session 的标签页经 `SIGNED_OUT` 收敛 guest；其他 Profile / 设备的独立 Session 不受影响。
- `PASSWORD_RECOVERY` 必须 fail-closed，绝不进入 AppShell。
- A1.5 任一硬门禁失败，**不得进入 A2**。

### 1.3 明确不做

不得修改 `src/**`、根 package / lockfile、根 API Route、数据库、migration、RLS、prompts、mobile Next config、AppShell、BottomTabBar、BackController、Today / Footprints / Growth、所有 Mock source。不得新增忘记密码、密码重置、OAuth、手机号、MFA、global signOut、第二套 Auth 页面、路由、History listener 或 V3.1-B 能力。

---

## 2. 已确认事实与依赖决策

### 2.1 Package、脚本与现有代码

| 项目 | 只读事实 |
|---|---|
| package manager | npm；根与 `apps/mobile-app` 各有 lockfile v3，无 workspaces、pnpm、yarn 或 Bun lockfile。 |
| mobile 唯一 lockfile | `apps/mobile-app/package-lock.json`。未来依赖安装只允许从 `apps/mobile-app` 运行，只改变此文件与同目录 `package.json`。 |
| root lockfile | `package-lock.json`，严格只读。 |
| mobile 现有 Supabase | 无直接或间接 Supabase 依赖。 |
| root 已锁 Supabase | `@supabase/ssr` `0.12.0`、`@supabase/supabase-js` `2.108.2`；只读参考，不升级。 |
| mobile scripts | `npm run lint` → `eslint .`；`npm run build` → `next build`；无独立 typecheck，build 是 TypeScript 门禁。 |
| dev scripts | root 与 mobile 都是 `next dev`，默认都占用 3000；未指定端口时不能同时作为两个 upstream 运行。 |
| mobile Auth | `page.tsx` 只有 boolean guest/authenticated；OTP 为 timeout / 任意六位；Password / Register direct import Mock。 |
| current Mock exports | `loginWithOtp`、`loginWithPassword`、`register`、`logout`、`getCurrentUser`。 |
| current Me | 硬编码 `user@example.com`、“已同步”、任务跨设备保存承诺、同步式 logout。 |
| root `/api/auth/me` | Cookie-backed Session read，但 route 未显式设置 no-store；不得改 root code 规避 gateway 安全门禁。 |

### 2.2 固定依赖版本

| 包 | mobile 精确版本 | 理由 |
|---|---:|---|
| `@supabase/ssr` | `0.12.3` | 高于 Architecture 的 `0.10.0` cookie/cache-header 安全门槛。 |
| `@supabase/supabase-js` | `2.110.7` | 满足 `@supabase/ssr@0.12.3` peer `^2.110.5`；当前 Node 24 满足其 Node `>=22`。 |

- 不使用 `latest`、`^` 或 `~`。
- 本次不重新查询 npm registry；只有 registry 证明已撤回、deprecated 或 peer dependency 已变化时才重新审查版本。
- 未来获授权安装命令唯一为：

```bash
cd apps/mobile-app
npm install --save-exact @supabase/ssr@0.12.3 @supabase/supabase-js@2.110.7
```

本次不执行。安装后只允许 mobile `package.json` 与 `package-lock.json` 成对变化。

### 2.3 Bundle / key 安全

mobile Real mode 只可读取：

```text
NEXT_PUBLIC_QINGXING_AUTH_MODE=mock | real
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

- `SUPABASE_SERVICE_ROLE_KEY`、`sb_secret_*`、任何服务端 secret key、access token、refresh token、原始 Cookie 值、raw provider payload：**绝不允许**进入 browser bundle、React state、UI、日志、analytics 或 URL。
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 是公开客户端配置，允许进入 browser bundle，但不得称为 secret。
- email、六位 OTP、password、confirmPassword 仅可存在于当前表单所必需的局部组件 state 或原生 input；不得进入顶层 `AuthState`、Facade 长期状态、URL、localStorage、sessionStorage、Cookie、日志、analytics，或传给无关组件；不得展示已提交的完整历史值。
- OTP 必须在 submit 后立即清空，并在 change email、screen change、success、signOut、unmount 时清空。password / confirmPassword 必须在 submit 后按页面需要立即清空，并在 success、screen change、signOut、unmount 时清空；错误文案不得回显，且不得写入 `AuthUser` 或 `AuthState`。email 仅供当前流程短期使用；OTP 已发送后只显示 masked email，并在流程退出、signOut 或 unmount 时按页面规则清理。
- production 下 mode 缺失、`mock`、未知，或 real 缺 URL / publishable key，均为 `not-configured`，在 AuthShell fail-closed；不得 production Mock fallback。
- development / test 下 mode 缺失或 `mock` 使用 Mock adapter；real 仅在两个 public 配置齐全时可用。

---

## 3. 最终文件总表

### 3.1 最终预计新增文件

| 文件 | 阶段 | 唯一职责 | 最终提交 | 未来 Codex 可改 | Review / 回退 |
|---|---|---|---:|---:|---|
| `apps/mobile-app/services/authService.ts` | A1–A4 | 唯一 mode selector、稳定 AuthFacade export、production config fail-closed。 | 是 | 是 | 只此文件读 mode / env；授权回退仅撤销新增 Auth layer。 |
| `apps/mobile-app/services/authService.real.ts` | A1–A4 | Real adapter、最小 user / event 映射、local scope signOut。 | 是 | 是 | 审查 intent、同步 auth callback、无 secret / raw payload。 |
| `apps/mobile-app/services/authService.mock-adapter.ts` | A1–A5 | 未改 Mock source 的 wrapper、`pendingOtp`、current-tab memory Session / listeners。 | 是 | 是 | 审查 pending contract、硬刷新 guest、无 password persistence。 |
| `apps/mobile-app/lib/supabase-client.ts` | A1 | mobile 唯一 cached Browser Client factory。 | 是 | 是 | 只 publishable key / public URL。 |
| `apps/mobile-app/lib/auth-errors.ts` | A1–A4 | AuthError mapping、温和文案、最小安全诊断。 | 是 | 是 | UI 无 raw provider error，日志无敏感数据。 |

### 3.2 最终预计修改文件

| 文件 | 阶段 | 唯一职责 | 最终提交 | 未来 Codex 可改 | Review / 回退 |
|---|---|---|---:|---:|---|
| `apps/mobile-app/types/app.ts` | A1 | Auth types、`AuthScreen` 增 `password-setup`；保留 `MockUser` / `RegisterInput`。 | 是 | 是 | typecheck / export boundary。 |
| `apps/mobile-app/package.json` | A1 | 精确声明两项 Supabase runtime dependencies。 | 是 | 是 | 仅 two exact dependencies。 |
| `apps/mobile-app/package-lock.json` | A1 | mobile 唯一 lockfile。 | 是 | 是 | v3 / no root dependency drift。 |
| `apps/mobile-app/app/page.tsx` | A1–A4 | **A1 创建并长期复用**的 Auth runtime controller、identity gate、action/event convergence；A2–A4 只接产品 UI / Me。 | 是 | 是 | 单订阅、四 guard、无第二 History listener；授权回退仅 Auth diff。 |
| `apps/mobile-app/components/auth/OtpLoginPage.tsx` | A2 | sign-in OTP email / code / resend、局部 error / busy、既有 OTP back handler。 | 是 | 是 | no fake timeout / raw error。 |
| `apps/mobile-app/components/auth/PasswordLoginPage.tsx` | A3 | password login form、局部 error / busy、密码清理。 | 是 | 是 | no raw adapter / Mock import。 |
| `apps/mobile-app/components/auth/RegisterPage.tsx` | A2–A3 | sign-up email / code 与 required-password-setup mode；无 register-password return。 | 是 | 是 | intent / gate / Back cleanup。 |
| `apps/mobile-app/components/me/MeView.tsx` | A4 | real user / status / async logout Props。 | 是 | 是 | 无 direct facade import。 |
| `apps/mobile-app/components/me/MeAccountCard.tsx` | A4 | real email + logged-in state。 | 是 | 是 | no hardcoded email。 |
| `apps/mobile-app/components/me/MeSyncCard.tsx` | A4 | honest account-status copy，删除任务同步承诺。 | 是 | 是 | no V3.1-B claim。 |
| `apps/mobile-app/components/me/MeConfirmSheet.tsx` | A4 | async local signOut pending / retry；clear-cache unchanged。 | 是 | 是 | fail cannot fake guest。 |

### 3.3 A1.5 临时并删除文件

| 文件 | 唯一职责 | development 约束 | 最终提交 | 删除门禁 |
|---|---|---|---:|---|
| `apps/mobile-app/components/auth/A15SessionProbe.tsx` | 仅调用 / 观察 A1 production controller 的开发验证 panel。 | runtime development guard；无正式 route / URL entry / AppShell / BottomTabBar。 | 否 | A2 前删除并完成 source / `.next` / Git evidence。 |
| `apps/mobile-app/services/authService.a15-probe.ts` | 仅 development 暴露 `requestPasswordRecoveryForA15(email)`，真实 provider recovery event 触发。 | production 调用直接拒绝；仅 Probe import；不进入 facade / service index。 | 否 | 同 Probe 删除。 |
| `apps/mobile-app/app/page.tsx` A1.5-only import / mount / callbacks | 仅 development 将 Probe 连接到已存在 controller 的受控测试接口。 | production 页面无 probe render path；无 URL / route。 | 否（此临时片段） | 同两临时文件删除并 source search 为零。 |

### 3.4 永久保留与严格只读

**永久保留、零修改：**

```text
apps/mobile-app/services/authService.mock.ts
apps/mobile-app/services/taskService.mock.ts
apps/mobile-app/services/historyService.mock.ts
apps/mobile-app/services/growthService.mock.ts
apps/mobile-app/services/serviceDelay.ts
apps/mobile-app/mockData/mockData.ts
```

**严格只读：**

```text
src/**
package.json
package-lock.json
next.config.ts
apps/mobile-app/next.config.ts
apps/mobile-app/services/index.ts
apps/mobile-app/components/auth/AuthShell.tsx
apps/mobile-app/components/auth/WelcomePage.tsx
apps/mobile-app/components/shell/AppShell.tsx
apps/mobile-app/components/shell/BottomTabBar.tsx
apps/mobile-app/contexts/BackControllerContext.tsx
apps/mobile-app/components/today/**
apps/mobile-app/components/footprints/**
apps/mobile-app/components/growth/**
数据库 / migration / RLS / API Route / prompts
```

---

## 4. A0 — 部署发现、唯一方案或阻断（无代码）

A0 不创建 probe、不改仓库、不安装依赖、不修改部署设置。A0-a 由 Claude Code 只读发现；A0-b 由 Claude Code 给出唯一可实施方案，或明确标记 blocker。用户只提供权限 / 截图 / 只读确认，不设计拓扑。

### 4.1 A0-a：Claude Code 只读部署发现

已在仓库内确认：

- root 与 mobile `dev` script 都为 `next dev`，默认端口均是 3000；未指定端口时不能同时运行；
- 未发现 `.vercel/project.json`；
- 未发现 tracked Vercel、gateway、reverse-proxy、CDN、DNS、deployment 文档或配置；
- Git remote 仅为 GitHub source remote，不能证明 hosting、domain、CDN 或 path routing；
- root `/api/auth/me` 是 root current origin 的相对路径，mobile 未来也必须通过同一公开 origin 请求它；
- 仓库中没有可只读识别的 deployment provider / Vercel project / custom domain / CDN / reverse proxy / DNS provider。

A0-a 未来在用户提供的已连接平台只读权限下，必须继续确认：

1. root 与 mobile 的当前 deployment project / service；
2. current production domain 与 custom domain；
3. edge/CDN/reverse-proxy/DNS provider；
4. 是否同一 Vercel project，或两个独立 project；
5. 哪个 control plane 能配置 path-based routing、Cookie / Set-Cookie / Cache-Control / Expires / Pragma passthrough 与 route cache policy；
6. current `/api/auth/me` 的实际 public origin 与 response cache policy。

### 4.2 A0 DEPLOYMENT BLOCKER

当前不能确定唯一 gateway，因为缺少**单一事实：当前生产 public ingress 的控制面身份（提供该生产 origin 的 hosting / edge provider 与其 project / service）**。

```text
A0 DEPLOYMENT BLOCKER
缺少事实：当前生产 public ingress 的 provider/project（从而确认 production origin、custom domain 与可配置的 path routing / cache control plane）。
Claude Code 已检查：root/mobile package scripts、全部 tracked deployment/gateway/proxy docs/config、.vercel/project.json、Git remote、root /api/auth/me source。
用户仅需提供：该 provider/project 名称及其只读 dashboard 访问或一张显示 provider、project/service 与 production domain 的截图。
用户不需要：选择 gateway、设计端口、写 proxy rule、判断 Cookie 或 cache policy。
未解决前：不得进入 A1。
```

### 4.3 A0-b：解除 blocker 后的唯一建议方案

当 A0-a 确认 public ingress control plane 支持 path routing 与 route cache policy 后，唯一方案是：**在已确认的 production ingress control plane 配置 external same-origin reverse proxy / gateway**；不使用 mobile `next.config.ts` rewrite，不在 root 托管 mobile，不使用跨域。

| 项目 | 唯一设计 |
|---|---|
| gateway 技术 / 平台 | 已确认的 production ingress control plane 的 path-based reverse proxy / edge routing capability；A0 blocker 解除前不猜名称。 |
| local unified origin | `http://qingxing.localhost:<gateway-port>`，gateway port 在 A0-a 根据可用 local gateway tool 明确后锁定。 |
| local mobile upstream | `http://127.0.0.1:3001`（从 `apps/mobile-app` 启动 `next dev --port 3001`）。 |
| local root upstream | `http://127.0.0.1:3000`（从 root 启动 `next dev --port 3000`）。 |
| local `/` route | mobile upstream `127.0.0.1:3001`。 |
| local `/api/auth/me` route | root upstream `127.0.0.1:3000`。 |
| production unified origin | A0-a 确认的 single HTTPS custom / production domain。 |
| production `/` route | mobile deployment service。 |
| production `/api/auth/me` route | root deployment service。 |
| cache policy location | confirmed ingress/CDN path rule：Auth / Session path Caching Disabled 或 Minimum TTL=0，禁止 shared cache / ISR / static cache。 |
| Cookie/header location | confirmed ingress request/response forwarding rule：保留 `Cookie`、`Set-Cookie`、`Cache-Control`、`Expires`、`Pragma`，不得改写到其他 host。 |

用户只在已确认平台 Dashboard 打开对应 ingress / routing / cache 页面，提供只读截图或确认结果，并确认拥有 domain / project 权限。Claude Code 给出规则名称、目标服务和验证项；用户不负责技术选择。

### 4.4 A0 用户外部检查表与证据

| 检查 | 用户操作 | Claude Code 只读核验 | 通过证据 |
|---|---|---|---|
| 6 位 OTP | Supabase Dashboard → Authentication → Email Templates，确认 email template 使用 six-digit Token / OTP。 | 检查 Architecture-required product flow。 | 配置截图 / 安全文字记录。 |
| publishable key | Supabase Dashboard → Project Settings → API，确认 publishable key 存在。 | 只确认类型 / project ref，不接收 key。 | key type / project ref。 |
| same project | 确认 root 与 mobile target 使用同一 project ref。 | 对照安全 project-ref evidence。 | ref 一致。 |
| redirect allowlist | 在 A1.5 前临时允许由 A0-a 锁定的 exact same-origin development recovery URL。 | 对照 helper exact `redirectTo`。 | allowlist setting 截图。 |
| route/cache | 在 confirmed ingress 平台查看 route / forwarding / cache setting。 | 核对 `/`、`/api/auth/me` upstream、headers、TTL / disabled cache。 | route rule 与 header policy。 |

A0 失败报告：

```text
A0 STOP
条件：<单一缺失或失败条件>
证据：<安全摘要，不含 Cookie/key/token>
影响：<为何无法证明 OTP / same-origin / Cookie / cache 安全>
需要用户或部署方动作：<精确平台页面或权限>
代码状态：未修改仓库；不得进入 A1。
```

**A0 gate：** ChatGPT 审查 discovery / blocker resolution / external evidence；不通过不授权 A1。

---

## 5. A1 — 最终 Auth runtime controller、adapter、client 与依赖基础

A1 创建的 `page.tsx` Auth runtime controller 是**最终产品直接复用的 controller**；A1.5 直接验证它，A2–A4 不得复制或重建它。A1 不完成 OTP、Register、Password、Me 的正式产品交互；既有 UI 在 development 默认 Mock mode 下保持现有可访问 / 可演示结构，不显示半完成 Real 登录。A2 / A3 / A4 只将各产品页面接到已存在 controller 的 actions / props。

### 5.1 A1 exact file list

```text
apps/mobile-app/services/authService.ts
apps/mobile-app/services/authService.real.ts
apps/mobile-app/services/authService.mock-adapter.ts
apps/mobile-app/lib/supabase-client.ts
apps/mobile-app/lib/auth-errors.ts
apps/mobile-app/types/app.ts
apps/mobile-app/package.json
apps/mobile-app/package-lock.json
apps/mobile-app/app/page.tsx
```

### 5.2 Auth contract 与 controller 状态

`types/app.ts` 新增最小 `AuthMode`、`AuthUser`、`AuthError`、`AuthResult<T>`、`AuthStatus`、`AuthState`、`OtpIntent`、`AuthSessionEventType`、`AuthSessionEvent` 与 `AuthScreen` 的 `password-setup`。保留 `MockUser` / `RegisterInput`。

AuthStatus 至少为：

```text
initializing
guest
authenticating
authenticated-needs-password
authenticated
signing-out
recovery-signout-pending
error
```

`services/authService.ts` 是页面唯一 Auth import，导出：

```text
sendOtp({ email, intent })
verifyOtp({ email, code, intent })
signInWithPassword({ email, password })
setPassword({ password })
getCurrentUser()
signOut()
subscribeAuthState(listener)
```

`page.tsx` A1 创建并拥有：

1. 完整 `AuthState`；
2. stable / memoized facade 单例取得；
3. 唯一 subscription 与 cleanup；
4. `getCurrentUser()` 初始化；
5. `subscriptionGeneration`（只管 subscription / effect observer lifecycle 与 cleanup / Strict Mode）；
6. `authRevision`（只管 non-INITIAL_SESSION event order）；
7. `initRevision`（初始化 snapshot）；
8. page-level action `requestId` / action generation 与 `actionRevision` snapshot；
9. `recoveryFailClosedLock`（独立于 revision：Recovery 期间优先阻止所有 AppShell identity 恢复）；
10. controller-owned `recoveryOperationRef`（`requestId`、shared `promise`、`status`、`settledResult`）；
11. normal `SIGNED_OUT` cleanup；
12. `recovery-signout-pending` state 与独立 recovery effect observer；
13. explicit local signOut；
14. fatal initialize / configuration error；
15. production fail-closed；
16. AuthShell / AppShell identity gate。

初始化顺序固定：

```text
1. subscriptionGeneration 建立。
2. facade.subscribeAuthState 建立。
3. initRevision = authRevision。
4. getCurrentUser()。
5. 仅 generation 有效且 authRevision === initRevision 时应用结果。
```

`INITIAL_SESSION` 明确忽略且不提升 revision。每个 `SIGNED_IN`、`SIGNED_OUT`、`TOKEN_REFRESHED`、`USER_UPDATED`、`PASSWORD_RECOVERY` 都先提升 `authRevision`，再进入同步 reducer / reconciliation；但当 `recoveryFailClosedLock` 开启时，其优先级高于 `SIGNED_IN`、`TOKEN_REFRESHED`、`USER_UPDATED`，这些 event 不得恢复任何可进入 AppShell 的 identity state，且不得取消当前 recovery operation。`initializing` 只显示 AuthShell 中性 loading；不闪 Welcome，不渲染 AppShell。仅 lock 未开启的 `authenticated` 渲染既有唯一 AppShell。

### 5.3 Real adapter 与同步 callback 安全规则

Real adapter 只使用 `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 创建 module-cached Browser Client。

- sign-in OTP：`shouldCreateUser:false`；sign-up OTP：`shouldCreateUser:true`。
- verify：`verifyOtp({ email, token: code, type: "email" })`。
- password login 成功直接 mapped `passwordSet:true`；metadata `updateUser` 为 best effort、非阻断。
- set password：仅已有 Session gate 中 `updateUser({ password, data:{password_set:true} })`。
- initial user：`auth.getUser()` 是唯一身份权威。
- signOut：唯一 `auth.signOut({ scope: "local" })`。

**`onAuthStateChange((event, session) => { ... })` callback 必须同步。**

callback 内只允许：

1. 读取 `event`；
2. 同步把 `session?.user` 映射成最小 `AuthUser | null`；
3. 同步调用 `listener(normalizedEvent)`；
4. 立即返回。

callback 内明确禁止：

```text
async callback
await
auth.signOut
auth.getUser
auth.updateUser
auth.refreshSession
任何其他 Supabase API
fetch
延迟 / timer / 等待业务逻辑
```

因此：

```text
onAuthStateChange callback
→ 同步发 PASSWORD_RECOVERY normalized event
→ callback 立即返回

page.tsx reducer
→ 先提升 authRevision
→ recoveryFailClosedLock = true
→ user = null
→ status = recovery-signout-pending
→ 首次 Recovery 创建唯一 recoveryRequestId
→ 不显示 AppShell

独立 recovery effect observer
→ 观察当前 recoveryRequestId 的 controller-owned shared operation
→ callback 已返回后才首次 facade.signOut()
→ adapter local scope signOut
→ 当前有效 SIGNED_OUT 或 event-missing Promise success 幂等 guest
→ 当前有效 Promise failure 保持锁并进入 AuthShell fatal error
```

### 5.4 Recovery fail-closed lock、shared operation 与 Strict Mode

`recoveryFailClosedLock` 是独立于 `subscriptionGeneration`、`authRevision`、`initRevision`、page action `requestId` / `actionRevision` 的 controller state / ref。它的优先级高于 `SIGNED_IN`、`TOKEN_REFRESHED`、`USER_UPDATED`：锁开启时绝不恢复可渲染的 user、`authenticated` 或 `authenticated-needs-password`，因此绝不进入 AppShell。

#### 5.4.1 首个与重复 PASSWORD_RECOVERY

1. 首个 `PASSWORD_RECOVERY`：先提升 `authRevision`，开启 `recoveryFailClosedLock`，置 `user = null`、`status = recovery-signout-pending`，创建唯一 `recoveryRequestId`，取消普通 action / init 的写回资格，并启动 callback 外的 local signOut。
2. 锁期间 `SIGNED_IN`、`TOKEN_REFRESHED`、`USER_UPDATED`：仍记录 event 顺序并提升 `authRevision`，但不得关闭 lock、不得恢复 user / 身份状态、不得取消或使当前 recovery operation 失效；UI 保持 pending 或 fatal AuthShell error。
3. 锁期间再次收到 `PASSWORD_RECOVERY`：幂等处理；不得新建 requestId、不得发第二个 signOut、不得令当前 operation 失效。
4. `INITIAL_SESSION` 一律忽略，且不得关闭 lock。

#### 5.4.2 controller-owned single-flight operation

Recovery request 的所有者是 controller，而非某次 `useEffect` 实例。`recoveryOperationRef` 必须至少包含：

```text
{
  requestId,
  promise,
  status: pending | succeeded | failed,
  settledResult: success | failure | null
}
```

- 同一 `recoveryRequestId` 至多调用一次 `facade.signOut()`；创建 operation 时即保存 shared Promise。
- recovery effect 仅是 shared operation 的 observer：Strict Mode cleanup 可以使该 observer 失效，但不得清除、取消或私有化 controller 的 operation / Promise。
- Strict Mode replay 若发现相同 current requestId 的 operation，必须复用并观察同一 Promise，不得第二次调用 signOut；新的 observer 必须仍能取得已 settle 或后续 settle 的结果。
- `subscriptionGeneration` 只决定 subscription / observer 是否仍可写 React；`authRevision` 只记录事件顺序；`recoveryRequestId` 标识 recovery operation；它们及 effect observer lifecycle 不得合并为一个 generation。
- 实际组件卸载后，shared Promise 可自然结束，但不得 dispatch、写 React state 或启动补偿性第二次请求。

#### 5.4.3 唯一解锁、fallback 与 retry

只有以下当前有效结果可以解除 `recoveryFailClosedLock`：

1. `SIGNED_OUT` event：收敛为 `guest`、`user = null`、清 recovery operation、解除 lock；或
2. shared signOut Promise 成功但 `SIGNED_OUT` 缺失：执行一次幂等 guest fallback，再清 operation、解除 lock。

两种成功路径均不得进入 AppShell；后续迟到 `SIGNED_OUT` 只能 no-op 确认。

- shared Promise failure：若 `SIGNED_OUT` 已处理则丢弃；否则保持 `recoveryFailClosedLock = true`、`user = null`，进入 AuthShell fatal error，绝不显示 AppShell。
- 安全 retry 仅在前一个 operation 已 settled 为 failure 后允许；创建新的 requestId 和新的 shared operation，但保留同一 fail-closed lock。旧 Promise 不得与新 operation 并发写回。
- 普通 `SIGNED_OUT` 可先于 Promise 到达：按上列唯一解锁规则完成 guest cleanup；Promise settle 后仅 no-op。Promise success 先到则按 event-missing fallback 完成相同 cleanup。

### 5.5 P2：Mock adapter 精确 pendingOtp 合约

`authService.mock-adapter.ts` 只能使用模块内 memory：

```ts
let currentSession: AuthUser | null = null;
let pendingOtp:
  | { normalizedEmail: string; intent: OtpIntent }
  | null = null;
const listeners = new Set<AuthStateListener>();
```

不得使用 localStorage、sessionStorage、Cookie、password、token 持久化。

| 方法 | 原 Mock source 调用 | 精确行为 |
|---|---|---|
| `sendOtp` | `delay()` via unchanged `serviceDelay.ts` | 校验并规范化 email，写 `{normalizedEmail,intent}`；不建 Session、不发 event；新 send / resend 覆盖旧 pendingOtp。 |
| `verifyOtp` | `loginWithOtp(email)` | 必须 pendingOtp 存在、normalized email 相等、intent 相等、code 为六位数字；否则返回对应 Mock AuthError且不建 Session。成功后清 pendingOtp，建 `mock:<normalizedEmail>` / `passwordSet:false` Session，发 `SIGNED_IN`。 |
| `signInWithPassword` | `loginWithPassword(email,password)` | 保留 legacy password ignored 行为；成功建 `passwordSet:true` currentSession，发 `SIGNED_IN`。 |
| `setPassword` | 无 | 只复制 currentSession 并设 `passwordSet:true`，发 `USER_UPDATED`；绝不保存 password。无 Session 返回 `session-expired`。 |
| `getCurrentUser` | 有 Session 时 `getCurrentUser()` 以保留原 delay | 无 Session 返回 null，硬刷新 guest；有 Session 时以 currentSession 覆盖 email / passwordSet。 |
| `signOut` | `logout()` | await 原 delay；清 currentSession / pendingOtp；发 `SIGNED_OUT`；仅当前 tab facade Session。 |
| `subscribeAuthState` | 无 | listener Set 注册；cleanup 只删本 listener，Strict Mode 不留重复。 |
| 旧 `register` | 不调用 | 永久保留但 facade 注册是 sign-up OTP → setPassword，绝不伪造 code / confirmPassword。 |

新的不同邮箱 `sendOtp` 覆盖 pendingOtp；screen reset、explicit local signOut 或 successful verify 清 pendingOtp。

### 5.6 transient error 所有权

| 操作 | stable state | transient error / busy owner | set | clear |
|---|---|---|---|---|
| initialize / config | initializing | `page.tsx` `AuthState.error`（fatal） | getCurrentUser / configuration 无法稳定确定身份 | retry 前；valid session reconciliation；old result invalid。 |
| sendOtp / resend | guest, same screen | OTP / Register local | action failure | email edit、retry 前、success code stage、screen reset / unmount。 |
| verifyOtp | guest, code stage | OTP / Register local | action failure | code edit、retry、success、change email / unmount。 |
| password login | guest, password screen | Password local | action failure | email/password edit、retry、success前 clear password、unmount。 |
| setPassword | needs-password | Register setup local | action failure | password edit、retry、success / unmount clear both。 |
| normal signOut | authenticated / needs-password | Me sheet or setup local | action failure | retry、sheet close、success；failure restores original stable state。 |
| PASSWORD_RECOVERY | `recoveryFailClosedLock` 已开启且无 normal stable Auth allowed | `page.tsx` fatal `AuthState.error` + controller-owned recovery operation | 当前 shared local signOut Promise failure；锁保持 | retry 前；当前有效 `SIGNED_OUT` 或 event-missing success fallback 后 guest；绝不 AppShell。 |

页面 action 开始先清 own transient error，记录 `requestId` 与 `actionRevision`；screen unmount / screen change / new action / auth event 后过期结果不得写 error 或顶层 state。普通 `SIGNED_OUT` 清全部 auth drafts / transient UI；成功后清 OTP / password，不记录敏感值。

### 5.7 A1 future Codex boundary

**可修改 exact files：** 5.1 列出的九个文件。`app/page.tsx` 必须建立完整 final controller，但不接正式 OTP / Register / Password / Me interaction。

**禁止：** Auth / Me UI files、A1.5 temporary files、所有 3.4 strict read-only files。

**必须运行（未来授权时）：** exact mobile npm install、mobile lint / build、diff check、sole-lockfile check、secret source/bundle check、controller race static review。

**Claude Code Review：** final controller exists in A1；single subscription；INITIAL_SESSION ignore；all other events revision-first；Recovery lock 高于 identity-restoring events；synchronous adapter callback；controller-owned shared recovery operation / Strict Mode fallback；recovery effect outside callback；production fail-closed；pendingOtp contract；无 raw sensitive logging。

**ChatGPT stop：** A0 未解除、root lockfile changed、secret / legacy anon fallback、Mock source changed、callback async API、controller 推迟到 A4、或 UI 变成半真实流程。

---

## 6. A1.5 — 直接验证 A1 controller 的 Session / Cookie MVP

A1.5 只验证 A1 已建立的 production runtime controller。Probe 不得复制 AuthState reducer、event mapping、recovery handler、revision guard 或 signOut state transition；它只能调用与观察 `page.tsx` 暴露的 development-only controlled test interface。

### 6.1 临时真实 recovery helper

`apps/mobile-app/services/authService.a15-probe.ts`：

```text
唯一 export：requestPasswordRecoveryForA15(email)
仅 development 可调用
仅 A15SessionProbe import
不加入 AuthFacade
不加入 services/index.ts
不加入任何产品 UI
production 调用直接拒绝
```

它使用已有 mobile Browser Client，并调用：

```ts
auth.resetPasswordForEmail(email, {
  redirectTo: <A0 已锁定的同源 development URL>,
})
```

- 不使用 service role / secret；
- 不记录 email、recovery link、token_hash、Cookie、provider payload；
- 输入 email 仅短期组件内存使用；
- 不得伪造 provider event。

### 6.2 A1.5 temporary input lifecycle

Probe **不提供 password input 或 password-login capability**。它只允许短期组件内存：测试 email、六位 OTP；这些与正式表单一样只能存在于当前局部组件 state 或原生 input，绝不进入顶层 `AuthState`、Facade 长期状态、URL、storage、Cookie、日志、analytics 或无关组件。

- email 输入时可完整显示；send 后只显示 masked email；
- OTP submit 后立即清空，并在 change email、screen change、success、signOut、component unmount 时清空；
- 不复制、下载或显示已提交的完整历史值；
- React DevTools 风险通过只使用专门测试帐号控制；禁止真实个人主帐号。

### 6.3 真正 PASSWORD_RECOVERY 测试路径

1. A0-a / A0-b 锁定 exact same-origin development URL，例如 `http://qingxing.localhost:<gateway-port>/`；不得在本计划中猜实际 port。
2. 用户在 Supabase Dashboard Redirect URL allowlist 临时允许该**准确** URL；用户负责 Dashboard 确认，Claude Code 只读核对 screenshot / setting。
3. Probe 调 `requestPasswordRecoveryForA15(testEmail)`；provider 给专用测试帐号发送 recovery email。
4. 测试者在同一 browser / same-origin target 点击真实邮件链接；不得复制 token_hash。
5. browser 回到 same-origin page 后，Real adapter 的同步 callback 发真实 `PASSWORD_RECOVERY`；A1 controller 立即 `recovery-signout-pending`，不显示 AppShell；独立 recovery effect local signOut。
6. Network / UI 记录成功 guest 或 failure AuthShell fatal error。受控 normalized-event harness 可补测 failure branch / race，但**不能替代真实 provider event**。
7. A1.5 结束后，用户与 ChatGPT 判断该临时 development redirect allowlist 是否应移除；默认应移除。若环境有其他明确开发用途需保留，必须由 ChatGPT 明确记录理由；不得静默保留。

若当前 PKCE / redirect / provider 配置不能使真实 recovery link 产生 `PASSWORD_RECOVERY`，报告：

```text
A1.5 STOP — REAL PASSWORD_RECOVERY
失败点：<redirect / PKCE / provider event 的单一证据>
已验证：<不含 token 的 Network / UI 摘要>
禁止动作：不得用人工伪造 event 取代真实证据；不得进入 A2。
```

### 6.4 Probe 可见能力与验证矩阵

Probe 仅提供：sign-in / sign-up send OTP、verify OTP、masked current user 与 same-origin `/api/auth/me` match result、local signOut、request recovery、调用 controller controlled race harness。它无 route、无 URL parameter entry、无 AppShell / BottomTabBar。

| 测项 | 操作 | 通过证据 |
|---|---|---|
| production controller | Probe 调 production facade / observed controller；不 duplicate reducer。 | AuthState / transitions 与 normal page 同一实现。 |
| callback safety | 静态检查 Real adapter callback。 | callback 无 async / await / Supabase API / fetch；仅 sync normalize + listener。 |
| sign-in / sign-up | 各自发送 / verify。 | false 不建未知帐号，true 注册并建立 Session。 |
| `/api/auth/me` | login 前后、refresh、local signOut 后。 | null → current minimal user → retained → null。 |
| cache | Network headers。 | Cookie / Set-Cookie / Cache-Control / Expires / Pragma passthrough；private/no-store equivalent；no shared reuse。 |
| profiles | Profile A/B 或 private window 独立登录，A local signOut。 | A null、B remains own Session、no cross-account leak。 |
| tabs | same Profile two tabs local signOut。 | other tab gets SIGNED_OUT guest。 |
| init race | controller harness delay init then send each event。 | late init rejected by revision guard。 |
| recovery | real recovery email link；harness 补测 race / failure。 | callback 立即返回；首个 Recovery 开 lock / pending；随后注入 `SIGNED_IN`、`TOKEN_REFRESHED`、`USER_UPDATED` 仍无 AppShell、operation 不取消；最终仅 guest 或 fatal AuthShell error。 |
| recovery Strict Mode fallback | 首次 observer 发 shared signOut 后立即 cleanup / replay；故意不发 `SIGNED_OUT`。 | replay 复用同一 shared Promise；Promise success 仍 guest fallback；实际 signOut 调用次数恰为 1。 |

### 6.5 production / deletion evidence

**A1.5 临时存在期间：**

- production page 无 probe render path；
- 无 route、无 URL parameter entry；
- Probe 有 runtime development guard；
- 浏览器访问 production build 看不到 probe。

不得声称仅 `NODE_ENV` compile-time false 已证明无 bundle 残留。

**A1.5 删除后、A2 前：**

1. 删除 `A15SessionProbe.tsx`；
2. 删除 `authService.a15-probe.ts`；
3. 删除 page import / mount / callbacks；
4. source search 下列关键字为零：

```text
A15SessionProbe
authService.a15-probe
requestPasswordRecoveryForA15
```

5. 运行 production `npm run build`；搜索 `.next` 产物同三关键字，结果必须为零；
6. `git diff` / `git diff --name-only` 不存在两临时文件，且 page 不含 temporary-only code；
7. Claude Code Review 删除证据后，ChatGPT 才能允许 A2。

临时文件绝不进入最终提交。

### 6.6 A1.5 future Codex boundary

**可修改 exact files：**

```text
apps/mobile-app/components/auth/A15SessionProbe.tsx
apps/mobile-app/services/authService.a15-probe.ts
apps/mobile-app/app/page.tsx（仅 A1.5 mount / controlled callbacks）
```

不得修改其他文件。必须给出 development matrix、real recovery evidence、Network safety summary、source / `.next` deletion search、production build、Git range。任一 OTP / session / cache / profile / local scope / callback safety / race / recovery / cleanup failure 都停止。

---

## 7. Action / Event 双通道收敛规则

### 7.1 统一处理算法

每个 action 启动记录：

```text
requestId = next request counter
actionRevision = current authRevision
```

1. requestId 已失效：完全丢弃；页面卸载也不写 busy。
2. Auth event 已提升 authRevision：action result 不得更新顶层 AuthState、不得写迟到 error；页面仍存在时仅可安全结束自身 busy。
3. action success 且 revision 未变：可用 minimal user / void 作**一次幂等 fallback**；随后 event 只能幂等确认，不得重复 navigation / cleanup。
4. action failure 且 revision 已变：为迟到结果，完全丢弃，不得覆盖 event state。
5. `screen` change、unmount、retry/new request、higher-priority event 都使旧 requestId 无效。

### 7.2 逐 action 权威表

| 操作 | 预期 event | 最终身份权威 | Promise 职责 | event 先到 | Promise 先到 | event 缺失 | Promise error 迟到 / unmount |
|---|---|---|---|---|---|---|---|
| sendOtp / resend | 无 Session event | Promise | code stage / timer / local error | 不适用 | 成功进 code / restart timer | 不适用 | current request 才展示 error；unmount 丢弃。 |
| verifyOtp | `SIGNED_IN` | normalized event | busy / immediate error / event-missing fallback | event changes AuthState，promise 不再顶层写 | fallback minimal user 一次；event later no-op confirm | current success fallback 可进入 mapped state，记录 event-missing diagnostic | revision changed / unmount 时丢弃。 |
| signInWithPassword | `SIGNED_IN`，可后跟 `USER_UPDATED` | normalized event | busy / immediate error / fallback | 同上 | direct authenticated fallback；later USER_UPDATED只更新 metadata | current fallback authenticated，记录 diagnostic | 丢弃，不可覆盖 new state。 |
| setPassword | `USER_UPDATED` | normalized event | busy / immediate error / fallback | event maps passwordSet true | fallback maps needs-password → authenticated；later event no-op | current fallback allowed，记录 diagnostic | 丢弃。 |
| normal signOut | `SIGNED_OUT` | normalized event | sheet busy / immediate error / guest fallback | event clears root once，promise success no-op | fallback guest once，event later no-op | current void success guest fallback，记录 diagnostic | event changed / unmount 时丢弃，不写 sheet error。 |
| recovery local signOut | `SIGNED_OUT` | normalized event plus `recoveryFailClosedLock` / shared fail-closed operation | recovery pending / guarded fatal error；不取得 identity authority | 当前有效 SIGNED_OUT 是唯一 event 解锁路径，guest / user null；promise no-op | Promise success 缺 event 时一次 guest fallback，解除 lock；later event no-op | guarded guest fallback only；Recovery 期间后续 `SIGNED_IN` / `TOKEN_REFRESHED` / `USER_UPDATED` 均不得 AppShell | failure 仅在当前 operation、lock 仍开且尚无 SIGNED_OUT 时 fatal；锁保持，retry 才能新 request。 |

Strict Mode 只影响 `subscriptionGeneration` / effect cleanup；不改变 auth event authority，也不允许 duplicate subscription / recovery signOut。页面 Action 与 adapter event 不能分别拥有两套 reducer。

---

## 8. A2 — 真实 OTP 与显式注册验证码

### 8.1 exact files

```text
apps/mobile-app/app/page.tsx
apps/mobile-app/components/auth/OtpLoginPage.tsx
apps/mobile-app/components/auth/RegisterPage.tsx
apps/mobile-app/types/app.ts
apps/mobile-app/services/authService.ts
apps/mobile-app/services/authService.real.ts
apps/mobile-app/services/authService.mock-adapter.ts
apps/mobile-app/lib/auth-errors.ts
```

### 8.2 目标与限制

- Otp 保留 email-entry / code-entry、single input / six boxes、masked email、60 秒 resend、`otp-code-entry / 65`、change email。
- email submit 走 `sendOtp({intent:"sign-in"})`，只有 success 进 code stage；verify / resend 均按第 7 节双通道规则。
- Register 走 `register-email → register-code`，send / resend 固定 `sign-up`；verify 成功由**已存在 A1 controller**转换到 `authenticated-needs-password` / `password-setup`；不得有 register-password return state。
- 本节 email / 六位 OTP 仅是 §2.3 定义的当前表单局部短期输入：OTP submit 后立即清空，并在 change email、screen change、success、signOut、unmount 时清空；发送后只显示 masked email，绝不写入 AuthState、Facade、URL、storage、Cookie、日志或 analytics。
- 删除 demo “任意六位”行为；Mock mode 只作为 honest Mock facade contract。
- account-existence 映射只用 A1.5 证明的 structured provider evidence，否则中性 fallback；不得二次探测。

**Codex 可改：** 本节 8.1 八文件。**禁止：** Password / Me、shell、BackController、root / Mock source / config。

**Review / stop：** intent false / true、no duplicate request / raw error、no bypass、A1.5 deletion complete。provider evidence 不安全、第二 Auth UI、A1.5 regression 均停止。

---

## 9. A3 — Password gate 与 password login

### 9.1 exact files

```text
apps/mobile-app/app/page.tsx
apps/mobile-app/components/auth/PasswordLoginPage.tsx
apps/mobile-app/components/auth/RegisterPage.tsx
apps/mobile-app/types/app.ts
apps/mobile-app/services/authService.ts
apps/mobile-app/services/authService.real.ts
apps/mobile-app/services/authService.mock-adapter.ts
apps/mobile-app/lib/auth-errors.ts
```

### 9.2 目标与限制

- OTP / register OTP / startup mapped `passwordSet:false` 由 A1 controller render `password-setup`；AppShell 不出现。
- Register existing PaperCard 承载 setup mode；success clear password / confirm then authenticated。
- 注册 `auth-password-setup / 70`，消费 back；`register-flow / 66` 只对 pre-session code stage。
- explicit local signOut 成功 guest，失败仍 needs-password，可 retry。
- PasswordLoginPage only parent actions / mapped errors；password success direct authenticated；metadata补写失败 nonblocking。
- password / confirmPassword 仅是 §2.3 定义的当前表单局部短期输入；submit 后按页面需要立即清空，并在 success、screen change、signOut、unmount 时清空；不得回显于错误、写入 AuthUser / AuthState、URL、storage、Cookie、日志或 analytics。
- password fields 不新增 reset / forgot-password。

**Codex 可改：** 9.1 八文件。**禁止：** OTP / Me / shell / context / root / Mock source / config。

**Review / stop：** no bypass、local scope only、no global signOut、no reset feature、metadata failure not gate。

---

## 10. A4 — Me UI、完整产品 wiring 与 controller 集成复验

A4 **不首次创建** initialization、subscription、revision controller、recovery handler 或 AuthShell/AppShell gate；它们必须已在 A1 成立。A4 将 A2 / A3 的 product interactions 与 A1 controller 完整接线，并对它执行 integration revalidation。

### 10.1 exact files

```text
apps/mobile-app/app/page.tsx
apps/mobile-app/components/me/MeView.tsx
apps/mobile-app/components/me/MeAccountCard.tsx
apps/mobile-app/components/me/MeSyncCard.tsx
apps/mobile-app/components/me/MeConfirmSheet.tsx
apps/mobile-app/types/app.ts
apps/mobile-app/services/authService.ts
apps/mobile-app/services/authService.real.ts
apps/mobile-app/services/authService.mock-adapter.ts
apps/mobile-app/lib/auth-errors.ts
```

### 10.2 A4 工作

- page 将 A1 controller 的 real `user`、status、action result、logout error 传给 Me；不另建 service call。
- MeAccountCard render real email，无硬编码 fallback。
- MeSyncCard 固定文案：

```text
标题：账号状态
徽标：已登录
说明：你正在使用这个账号继续清行。行动记录的真实保存与跨设备同步，会在后续连接中完成。
```

- MeConfirmSheet 将 normal signOut action busy / error 与第 7 节 event authority 接线：pending disable close / confirm；success close；failure stay sheet / retry；clear-cache unchanged。
- 对 A1 controller 进行 integration revalidation：cold start、session restore no flash、Strict Mode cleanup、same-profile tab `SIGNED_OUT`、two-profile local scope、Recovery lock 优先于后续 `SIGNED_IN` / `TOKEN_REFRESHED` / `USER_UPDATED`、event-missing fallback single-flight、existing BackController chain。

**Codex 可改：** 10.1 十文件。**禁止：** AuthShell / Welcome / AppShell / BottomTabBar / BackController context、root / Mock source / config。

**Review / stop：** A4 只集成、不复制 controller；no flash、no false signOut、no cross-profile logout、no task-sync claim。Recovery lock / shared-operation 或其 Strict Mode fallback 任一回归均停止；任何 controller defect 回到 A1 contract review，不能在 Me 层另造状态机。

---

## 11. A5 — 集成验收、Review 与提交准备

A5 不新增功能。只有 ChatGPT 单独授权的缺陷修复可进入 A5。A1–A4 默认不 commit；checkpoint commit 需 ChatGPT 与用户另行授权。最终 commit 仅 A5 全部通过后由 Claude Code 逐文件 `git add <path>`，禁止 `git add .`。

### 11.1 验收矩阵

| 类别 | 必测 |
|---|---|
| Mock | facade flows、pendingOtp mismatch / overwrite、current-tab Session、hard refresh guest、Mock signOut、Mock source zero diff。 |
| Real OTP | sign-in false / sign-up true、send / resend 60s、invalid / expired、safe account fallback。 |
| Password | no metadata gate、set password、password direct authenticated、metadata update nonblocking。 |
| Controller | callback sync-only static check、init / event race、event / Promise ordering table、Strict Mode、recovery shared-operation single-flight。 |
| Session | restore no Welcome flash、two Profiles、same-session tabs、normal local signOut success / failure。 |
| Recovery | real provider email-link event；Recovery lock 后强制 `SIGNED_IN` / `TOKEN_REFRESHED` / `USER_UPDATED` 仍无 AppShell；当前 shared signOut 不取消；`SIGNED_OUT` 缺失的 Promise fallback guest；failure 保持 lock / fatal AuthShell；Strict Mode replay 实际 signOut 恰为一次。 |
| Cache/security | A0 evidence、A1.5 Network headers、no Set-Cookie reuse、`/api/auth/me` match、bundle secret scan、temporary artifact deletion scan。 |
| UI/back | 375px、390×844、430px；Android Chrome；iOS Safari if available；one AuthShell / AppShell；Auth no bottom Tab；OTP / register / password setup / Me back chain。 |
| Engineering | `npm run lint`、`npm run build`、TypeScript through build、`git diff --check`、exact file scope。 |

### 11.2 Review flow

```text
每小阶段未来施工
→ Codex exact-file 汇报 / command output / manual evidence
→ Claude Code Review
→ ChatGPT 决定下一阶段

A1.5
→ external evidence + real recovery evidence + temporary deletion review
→ ChatGPT 通过
→ 才可 A2

A5
→ Claude Code 全量 Review
→ ChatGPT 最终把关 + 用户授权
→ Claude Code explicit staging / commit / push
```

不允许跨阶段并行。用户只完成 A0 外部确认、A1.5 测试帐号 / recovery email / 平台只读证据与必要真机 / 最终视觉验收。

---

## 12. 回退策略（仅明确授权）

| 阶段 | 触发 | exact files | 回退规则 |
|---|---|---|---|
| A1 | dependency/config/secret/controller/mock contract fail | A1 nine files | 逐文件、授权后撤销；不改 root lockfile。 |
| A1.5 | OTP / Session / cache / profile / callback / race / real recovery / Recovery lock / event-missing fallback / Strict Mode single-flight fail | two temporary files + page temporary fragments | 停止，删除 temp files（授权后）；保留 A1 controller 供诊断；绝不切方案 A。 |
| A2 | intent / OTP / registration / Back failure | A2 eight files | 仅回到已通过 A1 controller + Mock mode；不删 adapters / Mock source。 |
| A3 | setup / local signOut / metadata failure | A3 eight files | 回到已通过 A2 UI / A1 controller；不新增 reset / global signOut。 |
| A4 | integration flash / false logout / Profile behavior | A4 ten files | 保留 Mock；停止 Real path；先回 A1 controller contract review。 |

不得 reset、clean、stash、rebase、amend、force push 或 broad restore。

---

## 13. 阶段总表

| 阶段 | exact files | 本轮调用 Codex | Review gate | 停止条件 |
|---|---|---:|---|---|
| A0 | 无仓库文件 | 否 | ChatGPT discovery / deployment evidence | A0 blocker、OTP/key/gateway/header/cache 不具备。 |
| A1 | 5.1 九文件 | 否 | Claude Code controller / dependency / callback security → ChatGPT | controller不在A1、async callback API、Recovery lock / shared-operation / Strict Mode fallback 缺失、root lockfile、secret / fallback、Mock drift。 |
| A1.5 | 3.3 的两临时文件 + page temporary fragments | 否 | Claude Code evidence + `.next` deletion Review → ChatGPT | any Session/cache/Profile/recovery lock/event-missing fallback/Strict Mode cleanup failure。 |
| A2 | 8.1 八文件 | 否 | Claude Code UI / intent / Back → ChatGPT | A1.5 not closed、flow / evidence conflict。 |
| A3 | 9.1 八文件 | 否 | Claude Code gate / signOut → ChatGPT | bypass / global scope / metadata gate。 |
| A4 | 10.1 十文件 | 否 | Claude Code Me / integration controller revalidation → ChatGPT | flash / false logout / duplicated controller / sync claim。 |
| A5 | 无功能新增文件 | 否 | Claude Code full review → ChatGPT / 用户 | matrix / lint / build / scope / security failure。 |

---

## 14. 风险结论

| 项目 | 结论 |
|---|---|
| P0 | 0。缓存风险由 A0 / A1.5 外部证据解决，不通过不进入 A2。 |
| 未解决 Execution Plan 级 P1 | 0。A1 controller时序、sync callback、A0职责、真实 recovery、Action/Event权威、Recovery fail-closed lock 与 Strict Mode shared-operation ownership 均已锁定。 |
| P2 | 3，均锁定：临时 production evidence；必要短期 OTP / password 输入生命周期；Mock pendingOtp contract。 |
| Recovery 保证 | `recoveryFailClosedLock` 优先于 `SIGNED_IN` / `TOKEN_REFRESHED` / `USER_UPDATED`；Recovery 期间绝不进入 AppShell；Strict Mode 不重复 signOut，且 cleanup 不丢 shared Promise 的有效 guest fallback。 |
| 外部 blocker | A0 public ingress provider/project fact；随后 OTP / publishable key / same-origin gateway / header/cache / real recovery evidence。 |
| 实现风险 | provider anti-enumeration、test email / network、多 tab、SDK lockfile scope、gateway no-store 实证。 |

### 14.1 Architecture 一致性

- 登录 `shouldCreateUser:false`：已锁定。
- 显式注册 `shouldCreateUser:true`：已锁定。
- 密码登录 direct authenticated：已锁定。
- local signOut `auth.signOut({ scope: "local" })`：已锁定。
- `PASSWORD_RECOVERY` fail-closed lock：已锁定；锁优先于后续 `SIGNED_IN` / `TOKEN_REFRESHED` / `USER_UPDATED`，期间绝不进入 AppShell；仅当前 `SIGNED_OUT` 或 event-missing shared Promise success fallback 可解锁为 guest。
- Strict Mode recovery shared operation：已锁定；controller 级 operation 至多一次 signOut，observer cleanup 不丢 fallback，retry 仅在失败 settle 后新建 operation。
- 必要短期 OTP / password 输入：已锁定；只在局部表单 / 原生 input，按 submit / success / screen change / signOut / unmount 清理，绝不进入顶层 AuthState、持久化、日志或 analytics。

---

## 15. Execution Plan 文档验收

本文件再次提交 ChatGPT Review 前必须确认：

```text
仅 docs/Execution-Plan-V3.1-A-Mobile-Auth.md 修改
staged 为空
HEAD / origin/main 仍为 c7abd47b7d48034970f06fad7e52a476e0500dd1
无代码、依赖、配置、环境变量、Supabase、临时 probe、Codex、commit 或 push
```

本方案本身仍不授权任何施工。
