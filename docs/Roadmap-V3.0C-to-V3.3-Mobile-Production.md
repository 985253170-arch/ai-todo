# V3.0C → V3.3：清行手机 App 生产化路线

> 状态：正式路线文档
> 定位：V3.0C 手机端加固 → V3.3 中国大陆稳定部署，严格顺序推进
> 依据：V3.0C 只读审计 + ChatGPT 修正 + 现有代码核验
> 创建日期：2026-07-15
> 最后修订：2026-07-19（同步 V3.1-A Architecture Review 通过状态、显式注册流程、A0–A5 阶段与安全门禁）

---

## 1. 背景

V3.0B 已完成四 Tab 前端闭环（今日/足迹/成长/我的）及二级页面、轻确认弹层、入口总检查。当前 [apps/mobile-app/](../apps/mobile-app/) 是纯前端 Mock 工程，所有数据来自 `services/*.mock.ts`，未接真实后端。

V3.0A 架构文档曾将 V3.0C 定义为"移动端细节优化（safe-area、触控、滚动）"，但当前实现已覆盖部分内容。2026-07-15 V3.0C 只读审计发现多个 P1/P2 问题。经 ChatGPT 修正后，V3.0C 范围重新锁定为"手机端体验加固与安装基础"，并制定 V3.0C→V3.3 四阶段路线。

## 2. 当前完成状态

| 阶段 | 内容 | 状态 |
|------|------|:--:|
| V3.0A | App Shell + 底部导航 + 四 Tab 前端闭环 + Auth 页面 | ✅ |
| V3.0B-1 | 任务执行页 AI 陪伴反馈区 | ✅ |
| V3.0B-2 | 我的页二级页面（隐私/反馈） | ✅ |
| V3.0B-3 | 我的页轻确认弹层 | ✅ |
| V3.0B-4 | 一级入口与动作闭环总检查 | ✅ |
| V3.0B | 二级页面与动作闭环 | ✅ |

工程状态：
- 单页状态机：[app/page.tsx](../apps/mobile-app/app/page.tsx)，无子路由
- 状态所有权分散：page.tsx 拥有 auth/activeTab/todayMode，FootprintsView 拥有 footprintMode，MeView 拥有 meMode/confirmMode
- 所有数据通过 mock service 获取
- `h-[100svh]` 视口模型，`max-w-mobile: 430px`
- `pb-safe-bottom` 底部安全区，`min-h-touch: 44px` 设计 token
- 无 PWA manifest、无 Service Worker、无 Capacitor
- 无 History API 返回栈

## 3. V3.0C：手机端体验加固与安装基础

### 3.1 目标

在不动后端、不动 Mock、不装 Capacitor 的前提下，完成手机端 Web 体验的最后加固和 PWA 基础安装能力。让清行在 Android Chrome 和 iOS Safari 上成为一个可添加到主屏幕、触控友好、键盘不遮挡、返回键行为正确的手机 Web App。

### 3.2 允许范围

| # | 项目 | 说明 |
|---|------|------|
| 1 | `viewport-fit=cover` | layout.tsx 补充 viewportFit 配置 |
| 2 | 顶部 safe-area | AppShell + AuthShell 通过 globals.css CSS 变量实现 |
| 3 | 底部 safe-area | 已有 pb-safe-bottom，复查完整性 + pb 避让修正 |
| 4 | 左右 safe-area | AppShell + AuthShell 通过 app/globals.css 中的 CSS 变量和 max(24px, env(...)) 规则实现 |
| 5 | Auth 页面 safe-area | 新增 AuthShell 共享容器，覆盖 Welcome/Otp/Password/Register |
| 6 | 核心按钮 ≥44px | 修复 9 处违规（7 文件） |
| 7 | Sheet 背景滚动穿透 | MeConfirmSheet 锁定页面级滚动容器 + iOS touchmove |
| 8 | GoalInputCard 键盘适配 | 分析 + 如真机有问题则最小修复（无问题则不改） |
| 9 | ExecutionFeedbackBox 键盘适配 | visualViewport + 布局调整（无滚动祖先，scrollIntoView 不可用） |
| 10 | MeFeedbackPage 键盘适配 | 受控滚动容器 + scrollIntoView |
| 11 | 375 / 390 / 430 宽度验证 | 三档视口逐页验收 |
| 12 | 横屏降级策略 | CSS 媒体查询，横屏时给出友好提示 |
| 13 | Android Chrome 真机验证 | 至少一台 Android 真机 Chrome 验收 |
| 14 | 统一返回栈 | Back Controller + 子模块注册 Back Handler（方案 B） |
| 15 | History API 返回支持 | popstate → WebHistoryGuard → dispatchBack() |
| 16 | Web App Manifest | `app/manifest.ts` 或 `public/manifest.json` |
| 17 | 192 / 512 / maskable / 180 图标 | 经 ChatGPT 产品把关和用户确认的源视觉 → 导出 PNG |
| 18 | Apple touch icon | `<link rel="apple-touch-icon">` |
| 19 | 添加到主屏幕验证 | Android Chrome（安装入口）+ iOS Safari（Share→Add） |
| 20 | lint / build / 真机验收矩阵 | 完整验收清单 |

### 3.3 禁止范围

| # | 禁止项 | 原因 |
|---|--------|------|
| 1 | 接真实后端 | V3.1 范围 |
| 2 | 删除或覆盖 mock service | V3.1 范围（V3.1 也只新增 adapter，不删除 mock） |
| 3 | 对齐旧 API 类型 | V3.1 范围 |
| 4 | 修改 `src/**` | 项目隔离规则 |
| 5 | 修改根 API Route | 项目隔离规则 |
| 6 | 修改 Supabase | 项目隔离规则 |
| 7 | 修改真实认证业务 / authService.mock.ts / Supabase Auth / 验证码 / 密码 / Session | V3.1 范围。允许新增 AuthShell、safe-area 包装、键盘适配、authScreen 返回逻辑 |
| 8 | 修改数据库 | 项目隔离规则 |
| 9 | 修改 prompts | 项目隔离规则 |
| 10 | 安装 Capacitor | V3.2 范围 |
| 11 | 创建 Android 工程 | V3.2 范围 |
| 12 | Next.js static export 配置 | V3.2 范围 |
| 13 | 生成 APK / AAB | V3.2 范围 |
| 14 | 国内部署 | V3.3 范围 |
| 15 | Service Worker | 明确延期到 V3.2（V3.2 也仅作为可选增强） |
| 16 | 离线页面 | V3.2 范围（独立可选） |
| 17 | 自定义 PWA 安装弹窗 | 不做 |
| 18 | 新增底部 Tab | 四 Tab 已锁定 |
| 19 | 修改 `components/growth/*` | 无触控违规，无需修改 |

### 3.4 返回栈方案

采用方案 B：**集中式 Back Controller + 子模块注册 Back Handler**。

原因：page.tsx 不拥有 footprintMode、meMode、confirmMode 状态（这些是子组件的本地 useState）。方案 A（提升状态到 page.tsx）侵入性过高。

方案 B 分为三层：

| 层 | 组件 | 职责 |
|------|------|------|
| 平台无关调度器 | `BackController.dispatchBack()` | 遍历执行已注册 Back Handler，返回 boolean。不访问任何平台 API |
| Web 平台适配 | `WebHistoryGuard` | 全项目唯一 popstate/pageshow 监听器，维护 Base/Guard Entry，管理 isExitingRef 和 BFCache 恢复 |
| 未来原生适配 | `Capacitor Back Adapter`（V3.2） | 监听 Capacitor backButton，调用 dispatchBack()。handled=false 时 exitApp() |

核心约束：
- 全项目只一个 popstate 监听器（WebHistoryGuard）
- 子组件不得各自监听 popstate
- 子组件注册 handler（优先级排序），handler 返回 boolean 表示是否消费
- 组件卸载时自动注销
- React Strict Mode 下不重复注册
- 未来 Capacitor backButton → dispatchBack() 复用同一个平台无关调度器
- BackControllerProvider 是独立客户端组件，由 `app/page.tsx` 包裹；`app/layout.tsx` 保持 Server Component

详见架构文档 §8–§9。

### 3.5 PWA 边界

- V3.0C 只做**基础可安装能力**：Manifest + 图标 + standalone 模式 + 颜色
- Manifest 使用 Next.js `app/manifest.ts` 方案（不强制 `public/` 目录）
- 图标放置方式由架构方案比较后决定
- **Service Worker 不属于 V3.0C**。V3.2 中 SW 为独立可选增强，不作为 APK 验收条件
- 不得写"无 Service Worker 就绝对无法安装 PWA"

### 3.6 触控违规统计

| 统计项 | 数量 |
|------|:--:|
| 违规代码位置 | 9 |
| 涉及文件 | 7 |
| 按钮文案种类 | 7（"回到任务"/"先退出"/"继续陪我推进"/"返回我的"/"回到足迹"/"退出"/"陪我"） |

7 个涉及文件：

1. `components/today/TaskExecutionView.tsx` — "回到任务"、"先退出"
2. `components/today/ExecutionFeedbackBox.tsx` — "继续陪我推进"
3. `components/me/MeFeedbackPage.tsx` — "返回我的"（两处）
4. `components/footprints/FootprintDetailView.tsx` — "回到足迹"
5. `components/me/MePrivacyPage.tsx` — "返回我的"
6. `components/today/TaskListView.tsx` — "退出"（min-h-[40px] → min-h-touch）
7. `components/today/UpcomingTaskList.tsx` — "陪我"（min-h-[34px] → min-h-touch）

详见架构文档 §7。

### 3.7 验收出口

- [ ] `viewport-fit=cover` 已配置
- [ ] 顶部/底部/左右 safe-area 在 iPhone notch + Android 手势条下正确（包括 Auth 页面）
- [ ] 所有 9 处触控违规已改为 ≥44px
- [ ] Sheet 打开时背景不可滚动
- [ ] ExecutionFeedbackBox + MeFeedbackPage 键盘不遮挡
- [ ] 375 / 390 / 430 三档宽度逐页通过
- [ ] 横屏显示友好降级提示
- [ ] Android Chrome 真机返回键逐场景正确（Guest/Auth + Authenticated 双分支返回）
- [ ] Android Chrome 安装入口可用、安装完成、standalone 正常
- [ ] iOS Safari "添加到主屏幕" 可用、standalone 正常（如设备可用）
- [ ] lint + build 通过
- [ ] 真机验收矩阵全部通过

---

## 4. V3.1：Mobile Service Adapter 与真实后端连接

V3.1 严格拆分为两个串行子阶段：先完成真实 Auth，再连接真实业务数据。所有 Mock 保留，通过 facade / adapter 切换；不修改现有 `src/app/api/**`、数据库 schema 或 RLS。

```text
V3.1-A：Mobile 真实认证
  → A0 / A1 / A1.5 / A2 / A3 / A4 / A5 全部通过
  → Review、用户验收、获授权后才可提交
  → V3.1-B：任务、足迹、成长与其他真实 Service Adapter 接入
```

### 4.1 V3.1-A：Mobile 真实认证

V3.1-A 只负责真实 Auth：

- Auth facade；
- Mock / Real adapter；
- Supabase Browser Client；
- 已有账号 OTP 登录；
- 显式注册；
- 首次设置密码；
- 密码登录；
- Session 恢复；
- local signOut；
- 我的页真实账号状态。

它不负责真实任务、deviceId、匿名任务迁移、历史、足迹、成长、AI 或任务同步；这些严格留在 V3.1-B。

#### 登录与注册流程

```text
已有账号验证码登录
sendOtp intent = sign-in
→ shouldCreateUser = false
→ verifyOtp
→ password_set=true：AppShell
→ 其他：首次设置密码门禁
```

未知邮箱不得在登录流程中自动创建账号，页面只温和引导到 RegisterPage。

```text
显式注册
RegisterPage
→ sendOtp intent = sign-up
→ shouldCreateUser = true
→ verifyOtp
→ Session
→ 首次设置密码
→ AppShell
```

密码登录成功直接进入 `authenticated` / AppShell；`password_set` metadata 仅 best-effort 补写，失败不阻断。

#### V3.1-A 小阶段与硬门禁

| 阶段 | 目标与门禁 |
|---|---|
| V3.1-A0 | 部署与 Supabase 前置检查：6 位 Email OTP、publishable key、同源 gateway/CDN、Cookie / Set-Cookie 及认证路径禁用共享缓存能力。环境不具备即停止。 |
| V3.1-A1 | Auth 合约、client 与 adapter 最小基础：facade、Mock / Real adapter、Browser Client、错误映射、精确依赖版本与唯一 lockfile。 |
| V3.1-A1.5 | Session / Cookie 最小可行性验证：真实 OTP、Session、同源 `/api/auth/me`、local signOut、缓存安全、双 Profile 隔离与事件竞态验证。**A1.5 失败不得进入 A2。** |
| V3.1-A2 | 真实 OTP 登录与注册验证码：intent 分流、resend、错误和页面接入。 |
| V3.1-A3 | 首次设置密码与密码登录：required-password gate、显式退出、metadata 体验标记。 |
| V3.1-A4 | Session 恢复、我的页与登出：初始化 gate、订阅、真实邮箱、诚实账号状态、async local signOut。 |
| V3.1-A5 | 集成 Review、真机验收与提交准备：按 Architecture 验收矩阵完成 Mock / Real / 返回链 / 视口 / 工程门禁。 |

#### 部署与安全方向

- 默认采用同源 gateway；当前不采用跨域；
- 认证响应禁止共享缓存：gateway、CDN、反向代理与 ISR 不得缓存认证 / Session 路径；
- mobile Real adapter 使用 `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`；
- Real signOut 固定 `auth.signOut({ scope: "local" })`：只退出当前浏览器 Session，同 Session 标签页收敛 guest，其他 Profile 与设备不受影响；
- A1.5 是真实 Session / Cookie / 缓存 / local signOut 的硬门禁，不能以跨域、前端 userId 或 service role 绕过。

详细架构见 [Architecture-V3.1-A-Mobile-Auth.md](Architecture-V3.1-A-Mobile-Auth.md)，产品流程见 [V3.1-A-Auth-Flow-Lock.md](V3.1-A-Auth-Flow-Lock.md)。

### 4.2 V3.1-B：任务、足迹、成长与其他真实 Service Adapter 接入

范围：

- 真实任务；
- deviceId；
- 匿名任务迁移；
- 历史、足迹与成长；
- AI 与其他非认证业务 adapter；
- 任务同步；
- 保留所有 Mock service，并通过统一 facade 切换 Mock / Real。

V3.1-B 在 V3.1-A 完成、Review 和验收关闭前不得开始。

### 4.3 V3.1 共通边界

- 页面视觉结构和产品 UI 锁定；如真实 Auth 需最小状态调整，必须在后续 Execution Plan 明确列出；
- 不删除或覆盖任何 `*.mock.ts`，真实能力只通过新增 adapter 层接入；
- 不修改 `src/**`、根 API Route、Supabase schema、RLS 或 AI prompts；
- V3.1-A 当前已通过 Architecture Review，但尚未创建 Execution Plan，Codex 未获代码授权。
---

## 5. V3.2：Capacitor Android APK 与发布测试

### 5.1 目标

使用 Capacitor 将清行打包为 Android APK，实现原生安装体验。Capacitor 为暂定推荐路线。

### 5.2 进入条件

进入 V3.2 只依赖 **V3.1 完成**。V3.2 内部分为三个子阶段，严格顺序推进。

### 5.3 V3.2-A：Static Export 可行性验证

**目标**：验证 Next.js `output: "export"` 是否与现有架构兼容。

| # | 项目 | 说明 |
|---|------|------|
| 1 | `next.config.ts` 添加 `output: "export"` | 配置静态导出 |
| 2 | `npm run build` | 验证构建是否成功 |
| 3 | 检查所有页面是否成功导出为静态 HTML | 逐页验证 |
| 4 | 分析阻塞项（如有） | 动态路由、middleware、ISR 等冲突 |
| 5 | 输出可行性结论 | 通过 / 阻塞 / 替代方案 |

**退出条件**：
- [ ] static export 构建成功
- [ ] 所有页面静态 HTML 可访问
- [ ] 可行性结论文档 → ChatGPT 审查通过
- [ ] **未通过前，禁止进入 V3.2-B**

**如 static export 不可行**，评估替代方案：
- Capacitor `server.url` 模式（在线壳，有离线/网络/审核风险）
- TWA（Trusted Web Activity）
- 仅保留 PWA + 添加到主屏幕

### 5.4 V3.2-B：Capacitor 工程与 Android 平台

**进入条件**：V3.2-A 通过。

| # | 项目 | 说明 |
|---|------|------|
| 1 | Capacitor 工程初始化 | `npx cap init` |
| 2 | Android 平台添加 | `npx cap add android` |
| 3 | Web 资源路径配置 | 生产 APK 优先 `webDir` 静态资源 |
| 4 | Capacitor backButton 监听 | 复用 V3.0C BackController.dispatchBack()（不经过 WebHistoryGuard） |
| 5 | StatusBar / Safe Area 原生适配 | Capacitor StatusBar plugin |

**退出条件**：
- [ ] `npx cap init` 成功
- [ ] `npx cap add android` 成功
- [ ] Android 工程可被 Android Studio 打开
- [ ] **未完成前，禁止进入 V3.2-C**

### 5.5 V3.2-C：APK/AAB 构建与真机验收

**进入条件**：V3.2-B 完成。

| # | 项目 | 说明 |
|---|------|------|
| 1 | APK / AAB 构建 | Android Studio 或 `npx cap build android` |
| 2 | 签名配置 | debug + release keystore |
| 3 | Android 真机安装测试 | 至少 3 台不同品牌/屏幕尺寸 |
| 4 | Service Worker 离线支持 | **独立可选 PWA 增强**，不作为 APK 验收条件 |

**退出条件**：
- [ ] APK 在 3 台 Android 真机上安装运行
- [ ] Capacitor backButton → dispatchBack() 正常工作
- [ ] Safe area 在原生的 StatusBar + 手势条下正确
- [ ] 所有页面在 WebView 中可正常使用
- [ ] lint + build 通过

### 5.6 V3.2 禁止范围

| # | 禁止项 |
|---|--------|
| 1 | React Native / Flutter / 原生 Kotlin 重写 |
| 2 | iOS 工程（V3.2 只做 Android） |
| 3 | Google Play 上架 |
| 4 | 国内应用商店上架 |
| 5 | 修改 mobile-app 页面组件 |
| 6 | 修改后端 API |
| 7 | 使用 `npx cap serve` 作为开发/调试方案 |
| 8 | live reload 配置提交到生产配置 |
| 9 | V3.2-A 未通过时安装 Capacitor |
| 10 | V3.2-B 未完成时构建 APK |

### 5.7 Capacitor 开发与调试

- **开发调试**：`server.url` 或 `npx cap run android --live-reload`
- **生产 APK**：优先使用 `webDir` 静态资源
- `server.url` 只能作为在线壳候选方案，必须单独评估离线、网络和审核风险
- live reload 配置禁止提交到生产配置

### 5.8 V3.2 验收出口

- [ ] V3.2-A：static export 可行性结论（通过/阻塞/替代方案）
- [ ] V3.2-B：Capacitor 工程初始化成功
- [ ] V3.2-C：APK 在 3 台 Android 真机上安装运行
- [ ] Capacitor backButton → dispatchBack() 正常工作
- [ ] Safe area 在原生的 StatusBar + 手势条下正确
- [ ] 所有页面在 WebView 中可正常使用
- [ ] lint + build 通过

---

## 6. V3.3：中国大陆稳定部署

### 6.1 目标

将清行部署到中国大陆可访问的服务器，确保 API、Auth、数据库在国内网络环境下稳定运行。

### 6.2 允许范围

| # | 项目 | 说明 |
|---|------|------|
| 1 | 国内服务器选型 | 阿里云/腾讯云 ECS 或 Serverless |
| 2 | 域名注册 + ICP 备案 | 个人或企业备案 |
| 3 | Supabase 国内替代方案 | 自建 PostgreSQL 或使用国内兼容服务 |
| 4 | DeepSeek API 国内直连验证 | 确认国内网络可用性 |
| 5 | SMTP 国内替换 | 如阿里云邮件推送不可用，替换为国内服务 |
| 6 | CDN 配置 | 静态资源国内加速 |
| 7 | HTTPS 证书 | 国内 CA 或 Let's Encrypt |
| 8 | 部署脚本 | CI/CD 适配国内环境 |
| 9 | 真机国内网络验证 | 移动 4G/5G + 联通 + 电信 |

### 6.3 可并行的非代码准备（可在 V3.0C–V3.2 期间提前启动）

| # | 项目 | 最早启动时间 | 预计耗时 |
|---|------|:---:|---|
| 1 | 域名注册 | 现在 | 1–3 天 |
| 2 | ICP 备案 | V3.1 开始后 | 15–30 天 |
| 3 | 服务器选型与采购 | V3.1 开始后 | 1–3 天 |
| 4 | 商标检索（"清行"） | 现在 | 1–2 周 |
| 5 | 隐私政策/用户协议撰写 | V3.1 开始后 | 1–2 周 |

ICP 备案和服务器准备可以提前并行，但代码不能跳级。

### 6.4 验收出口

- [ ] 国内 4G/5G 网络下首屏加载 < 3 秒
- [ ] API 调用在国内网络下成功率 > 99%
- [ ] Auth 在国内网络下正常
- [ ] ICP 备案完成
- [ ] HTTPS 已配置
- [ ] lint + build 通过

---

## 7. 每阶段允许范围总览

| 维度 | V3.0C | V3.1 | V3.2 | V3.3 |
|------|:---:|:---:|:---:|:---:|
| 修改 mobile-app 代码 | ✅ | ✅（以 adapter 为主） | ✅（仅 config） | ✅（仅 config） |
| 修改页面组件 | ✅（已列出范围） | ✅（最小修改，需审批） | ❌ | ❌ |
| 修改 `src/**` | ❌ | ❌ | ❌ | ❌ |
| 修改 API Route | ❌ | ❌ | ❌ | ❌ |
| Mock service | 保留 | 保留（新增 adapter + facade） | 保留 | 保留 |
| PWA Manifest | ✅ 新增 | — | — | — |
| Service Worker | ❌ 不做 | ❌ | ✅ 可选（独立增强） | — |
| Capacitor | ❌ | ❌ | ✅（V3.2-B） | — |
| APK | ❌ | ❌ | ✅（V3.2-C） | — |
| 国内部署 | ❌ | ❌ | ❌ | ✅ |

---

## 8. 每阶段禁止范围总览

| 禁止项 | V3.0C | V3.1 | V3.2 | V3.3 |
|------|:---:|:---:|:---:|:---:|
| 接真实后端 | ✅ | — | — | — |
| 删除 mock service | ✅ | ✅ | ✅ | ✅ |
| 安装 Capacitor | ✅ | ✅ | — | — |
| 做 APK | ✅ | ✅ | — | — |
| 国内部署 | ✅ | ✅ | ✅ | — |
| React Native/Flutter | ✅ | ✅ | ✅ | ✅ |
| iOS 工程 | ✅ | ✅ | ✅ | ✅（暂不做） |
| Google Play 上架 | ✅ | ✅ | ✅ | ✅（暂不做） |
| 新增底部 Tab | ✅ | ✅ | ✅ | ✅ |
| 修改 `src/**` | ✅ | ✅ | ✅ | ✅ |

---

## 9. 前置依赖

```
V3.0B ✅ → V3.0C → V3.1 → V3.2 → V3.3

V3.0C 依赖：V3.0B 完成 ✅
V3.1 依赖：V3.0C 完成
V3.2 依赖：V3.1 完成
  V3.2-A：进入 V3.2 即可开始
  V3.2-B：依赖 V3.2-A 通过
  V3.2-C：依赖 V3.2-B 完成
V3.3 依赖：V3.2 完成 + ICP 备案完成
```

**严格顺序推进，不允许跳级。不允许并行开发多个代码阶段。**

---

## 10. 验收出口汇总

| 阶段 | 核心验收标准 |
|------|------|
| V3.0C | 真机验收矩阵通过、PWA 可安装、返回键正确（Guest/Auth + Authenticated 双分支返回）、键盘不遮挡、9 处触控违规已修复、lint+build ✅ |
| V3.1 | 全流程真实数据、visual/UI 锁定（最小修改需审批）、mock 保留 + adapter + facade 可切换、真机数据流通过、lint+build ✅ |
| V3.2-A | static export 可行性结论（通过/阻塞/替代方案） |
| V3.2-B | Capacitor 工程初始化成功、Android 平台就绪 |
| V3.2-C | APK 三台真机运行、Capacitor backButton → dispatchBack() 正确、SW 为可选增强、lint+build ✅ |
| V3.3 | 国内 4G/5G < 3s、API 成功率 > 99%、ICP 完成、HTTPS 配置 |

---

## 11. 风险

| 风险 | 影响 | 阶段 | 缓解 |
|------|------|:--:|------|
| static export 与 Next.js 动态特性冲突 | V3.2 路线受阻 | V3.2-A | V3.2-A 验证，不通过则评估替代方案（server.url/TWA/纯 PWA） |
| ICP 备案耗时超预期（30+ 天） | V3.3 延迟 | V3.3 | 提前到 V3.1 启动备案 |
| Supabase 国内访问不稳定 | V3.3 需自建数据库 | V3.3 | V3.1 开始调研替代方案 |
| Capacitor WebView 兼容性 | 部分 API 行为差异 | V3.2 | 三台真机提前验证 |
| DeepSeek API 国内网络限制 | AI 功能不可用 | V3.3 | 提前验证，准备代理方案 |
| 旧 API 类型不兼容（resolved_today 等） | Adapter 复杂度提高 | V3.1 | 提前记录为已知风险 |
| BackController Strict Mode 双重注册 | 返回栈行为异常 | V3.0C | register 覆盖同名 handler + cleanup 正确注销 + history.state.kind 检测 |
| TaskExecutionView 无滚动祖先 | scrollIntoView 不可用 | V3.0C | visualViewport 为主方案 |
| pb-[84px] 在 notch 机型上不足 | 底部内容被 TabBar 遮挡 | V3.0C | 改为动态计算表达式 |

---

## 12. 不并行开发规则

1. V3.0C → V3.1 → V3.2 → V3.3 **严格顺序推进**
2. 每个阶段完成后必须经过 ChatGPT 把关才能进入下一阶段
3. ICP 备案、商标检索、域名注册可提前并行
4. 每个阶段内部可以分 Batch，但不可跨阶段并行

---

## 13. ICP 等可并行的非代码准备

以下事项可以在 V3.0C 或更早启动，不依赖代码：

| # | 事项 | 建议启动时间 | 预计耗时 | 备注 |
|---|------|:---:|---|------|
| 1 | 域名注册 | 现在 | 1–3 天 | 需确认品牌名可用 |
| 2 | ICP 备案 | V3.1 开始 | 15–30 天 | 可在 V3.1 开发期间排队 |
| 3 | "清行"商标检索 | 现在 | 1–2 周 | 仅检索，不注册 |
| 4 | 服务器选型 | V3.1 开始 | 1–3 天 | 阿里云/腾讯云 |
| 5 | 隐私政策/用户协议草案 | V3.1 开始 | 1–2 周 | 国内合规必需 |
| 6 | DeepSeek API 国内网络测试 | 现在 | 1 小时 | 确认国内直连可用性 |

---

## 14. Capacitor 为暂定推荐路线

Capacitor 是当前推荐的 APK 打包方案，理由：

- 与现有 Next.js Web 技术栈兼容
- 不需要重写 UI
- backButton 监听可复用 V3.0C BackController.dispatchBack()（平台无关调度器）
- 社区活跃，文档完善

**但在 V3.2 正式启动前，必须先完成 static export 可行性验证。** 如果 static export 不可行，评估以下替代方案：

1. Capacitor `server.url` 模式（指向在线 URL，不做 static export）——有离线/网络/审核风险
2. TWA（Trusted Web Activity）
3. 仅保留 PWA + 添加到主屏幕

---

## 15. V3.2 子阶段严格顺序

V3.2 不一次性推进所有工作。三个子阶段严格顺序：

```
V3.2-A（Static Export 验证）
  → 通过后 →
V3.2-B（Capacitor 工程初始化）
  → 完成后 →
V3.2-C（APK/AAB 构建与真机验收）
```

- V3.2-A 未通过前，禁止安装 Capacitor（`npx cap init`）
- V3.2-B 未完成前，禁止构建 APK
- 每个子阶段完成后需 ChatGPT 审查通过才能进入下一子阶段

---

> **文档结束**
>
> **关联文档**：
> - [Architecture-V3.0C-Mobile-Hardening.md](Architecture-V3.0C-Mobile-Hardening.md) — V3.0C 架构方案
> - [Project-State-Handoff.md](Project-State-Handoff.md) — 项目当前状态交接文档
> - [Architecture-V3.0-Web-App-Separation.md](Architecture-V3.0-Web-App-Separation.md) — V3.0 架构总方案
