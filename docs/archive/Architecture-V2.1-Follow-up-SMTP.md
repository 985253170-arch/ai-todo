# V2.1-Follow-up：自定义 SMTP 与邮件确认稳定化 架构方案

> **状态**：架构设计阶段
> **依赖**：V2.1 Auth 已完成并推送到 GitHub（HEAD = `d4ae86b`）
> **定位**：V2.1 的 Follow-up 收尾阶段，**不是 V2.2，不是 V2.3**
> **设计日期**：2026-07-02

---

## 目录

- [一、阶段目标](#一阶段目标)
- [二、为什么需要自定义 SMTP](#二为什么需要自定义-smtp)
- [三、为什么这是 V2.1-Follow-up，不是 V2.2](#三为什么这是-v21-follow-up不是-v22)
- [四、SMTP 服务商选择](#四smtp-服务商选择)
- [五、推荐方案](#五推荐方案)
- [六、Supabase Dashboard 配置清单](#六supabase-dashboard-配置清单)
- [七、Confirm signup 邮件模板改造](#七confirm-signup-邮件模板改造)
- [八、代码变更分析](#八代码变更分析)
- [九、依赖分析](#九依赖分析)
- [十、数据库变更分析](#十数据库变更分析)
- [十一、验收标准](#十一验收标准)
- [十二、风险矩阵](#十二风险矩阵)
- [十三、执行方式建议](#十三执行方式建议)

---

## 一、阶段目标

### 1.1 核心目标

| # | 目标 | 说明 |
|---|------|------|
| 1 | 配置自定义 SMTP | 替换 Supabase 默认邮件服务，解决发送额度低和频率限制问题 |
| 2 | 提高注册确认邮件发送稳定性 | 确保每次注册都能收到确认邮件，不被限流 |
| 3 | 允许编辑 Confirm signup 邮件模板 | 自定义 SMTP 配置后 Supabase 才会解锁邮件模板编辑功能 |
| 4 | 自定义确认注册链接格式 | 改为 `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email` |
| 5 | 保证注册确认邮件可正常发送 | 尽量保证送达；若未收到需检查垃圾箱和 Resend 发送日志 |
| 6 | 保证点击确认邮件后回到正式站点 | callback route 正确处理 `type=email` |
| 7 | 保证邮箱确认后可以正常登录 | 确认 → 登录完整链路畅通 |

### 1.2 成功判断

| 判断维度 | 标准 |
|---------|------|
| 邮件发送成功率 | 注册后能在合理时间内收到确认邮件；Resend Dashboard 显示 delivered |
| 发送额度 | 不被 Supabase 默认额度限制（内置邮件服务限制较低，以官方文档和 Dashboard 为准） |
| 邮件模板 | Confirm signup 模板已自定义为中文 + 标准回调 URL |
| 确认流程 | 点击确认链接 → 跳回站点 → 邮箱状态已确认 → 可登录 |
| 代码变更 | **零代码变更**（纯配置操作） |

---

## 二、为什么需要自定义 SMTP

### 2.1 Supabase 默认邮件服务的限制

Supabase 为每个项目提供内置的邮件发送服务，但有以下限制：

| 限制项 | 详情 | 影响 |
|--------|------|------|
| **发送额度** | 默认邮件服务额度很低（官方当前文档标注为 2 封/小时；具体额度以 Supabase Dashboard / 官方文档为准）。配置自定义 SMTP 后可调整相关邮件发送限制 | 测试阶段频繁注册即触发限流 |
| **不可自定义模板** | 新版 Supabase 要求先配置自定义 SMTP 才能编辑邮件模板 | Confirm signup 邮件使用 Supabase 默认英文模板，无法改为中文 + 自定义链接 |
| **发件人域名** | 默认发件人为 `noreply@mail.app.supabase.io` | 用户可能不信任非自有域名的发件人，增加进垃圾箱概率 |
| **不可控发送日志** | 无法查看邮件发送日志、送达率、打开率 | 排查邮件未送达问题时无数据支撑 |

### 2.2 实际影响

当前 V2.1 Auth 主流程已完成，注册、登录、登出功能可用，但：

1. **生产环境中频繁注册测试会触发限流** → 后续注册的新用户可能收不到确认邮件
2. **确认邮件是英文模板** → 中文用户看到英文邮件信任度低
3. **无法编辑邮件模板** → callback URL 使用 Supabase 默认格式而非自定义 `/auth/callback`

### 2.3 为什么必须在 V2.2 之前做

- V2.2 将引入页面路由结构升级（`/` `/login` `/app`），届时路由变化后如果 callback URL 格式有问题，排查会更复杂
- 邮件确认是整个账号体系的入口——入口不稳定，后续 UI 美化没有意义
- V2.2 可能引入新的注册/登录页面的独立路由，邮件模板中的回调 URL 需要与路由结构匹配

---

## 三、为什么这是 V2.1-Follow-up，不是 V2.2

### 3.1 定位对比

| 维度 | V2.1 | V2.1-Follow-up | V2.2 |
|------|:---:|:---:|:---:|
| **性质** | 代码改造 | 配置增强 | 代码改造 + UI |
| **改动面** | 5 个文件 | 0 个文件（纯 Dashboard 配置） | 路由 + 组件 + CSS |
| **依赖** | Magic Link → Email+Password | V2.1 代码已完成 | V2.1-Follow-up SMTP 稳定 |
| **目标** | 换个登录方式 | 让登录验证邮件可靠送达 | 让页面看起来像正式产品 |

### 3.2 为什么不并入 V2.2

1. **V2.2 是代码改造**（路由分离、组件重写），SMTP 配置是纯 Dashboard 操作——性质完全不同
2. **V2.2 改动面大**（路由 + 组件 + CSS），如果邮件确认不稳定，V2.2 部署后排查问题更复杂
3. **先让邮件稳定，再做路由升级**——路由变化可能引入新的回调兼容性问题，在邮件稳定的基础上排查更清晰
4. V2.1-Follow-up 是"收尾补齐"，V2.2 是"体验升级"——两者不应混在一起执行

### 3.3 当前路线

```
V2.1 Auth ✅ 已完成
  → V2.1-Follow-up SMTP 🔜 当前阶段
  → V2.2 页面结构与产品体验升级 ⏭️
  → V2.3 Security ⏭️
```

---

## 四、SMTP 服务商选择

### 4.1 候选方案一览

| 方案 | 免费额度 | 日发送量（免费） | 配置难度 | 国内可达性 | 月费（入门） |
|------|:---:|:---:|:---:|:---:|:---:|
| **Resend** | 100 封/天 | 100 | ⭐ 极低 | ✅ 良好 | $0（免费层） |
| **SendGrid** | 100 封/天 | 100 | ⭐⭐ 低 | ⚠️ 一般 | $0（免费层） |
| **Mailgun** | 无免费层 | N/A | ⭐⭐ 低 | ⚠️ 一般 | $35/月 |
| **Amazon SES** | 62,000 封/月（从 EC2 发） | 2,000 | ⭐⭐⭐⭐ 高 | ❌ 需验证域名 | ~$0.10/1000 封 |
| **Gmail SMTP** | 500 封/天（个人 Gmail） | 500 | ⭐ 极低 | ❌ 国内网络限制 | $0 |
| **Brevo（Sendinblue）** | 300 封/天 | 300 | ⭐⭐ 低 | ✅ 良好 | $0（免费层） |

### 4.2 详细分析

#### Resend ⭐ 推荐

| 维度 | 评价 |
|------|------|
| **定位** | 面向开发者的邮件 API，专注事务邮件 |
| **Supabase 集成** | Supabase 官方文档推荐，有 Resend 集成指南 |
| **配置** | 在 Resend 注册 → 验证域名 → 获取 API Key → 填入 Supabase SMTP 设置 |
| **免费额度** | 100 封/天，对于小项目注册确认邮件绰绰有余 |
| **React 生态** | 同团队有 react.email（邮件模板可视化开发），未来可扩展 |
| **Dashboard** | 实时发送日志、送达率、打开率、点击率 |
| **优点** | 配置极简、开发者友好、Supabase 官方推荐、免费层够用 |
| **缺点** | 需验证域名（需要 DNS 记录配置），免费层无专属 IP |

#### SendGrid

| 维度 | 评价 |
|------|------|
| **定位** | Twilio 旗下，老牌邮件服务商 |
| **Supabase 集成** | 支持，Supabase 文档有 SendGrid 配置指南 |
| **配置** | 注册 → 创建 API Key → 填入 Supabase |
| **免费额度** | 100 封/天 |
| **优点** | 老牌稳定、文档丰富、社区大 |
| **缺点** | 免费账户审核较严，有时被拒；Dashboard 不如 Resend 现代 |

#### Mailgun

| 维度 | 评价 |
|------|------|
| **定位** | 开发者邮件服务 |
| **配置** | 需验证域名 + SMTP credentials |
| **免费** | 无真正免费层（试用期后需付费） |
| **优点** | 送达率高、功能丰富 |
| **缺点** | 无免费长期方案、对小项目成本高 |

#### Amazon SES

| 维度 | 评价 |
|------|------|
| **定位** | AWS 企业级邮件服务 |
| **配置** | 需 AWS 账号 → 验证域名 → 申请 production access → 配置 SMTP |
| **免费** | 62,000 封/月（EC2 同区域） |
| **优点** | 极低成本、高送达率、企业级 |
| **缺点** | 配置复杂（IAM/域名/出站限制）、AWS 账号需企业认证、不适合快速集成 |

#### Gmail SMTP

| 维度 | 评价 |
|------|------|
| **定位** | 个人 Gmail 账号的 SMTP 发送 |
| **配置** | Gmail → 开启 2FA → 生成 App Password → 填入 Supabase |
| **免费** | 500 封/天（个人）、2,000 封/天（Google Workspace） |
| **优点** | 零外部依赖、配置简单 |
| **缺点** | 国内网络环境可能无法访问 Gmail SMTP 服务器；发件地址只能是 Gmail 地址；不够专业 |

### 4.3 对比总结

| 维度 | Resend | SendGrid | Mailgun | SES | Gmail | Brevo |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| 免费额度 | ✅ 100/天 | ✅ 100/天 | ❌ 无 | ✅ 62K/月 | ✅ 500/天 | ✅ 300/天 |
| 配置难度 | ⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐ | ⭐⭐ |
| Supabase 集成 | ✅ 官方推荐 | ✅ 官方文档 | ✅ 支持 | ✅ 支持 | ✅ 支持 | ✅ 支持 |
| 国内可达 | ✅ | ⚠️ | ⚠️ | ❌ | ❌ | ✅ |
| Dashboard | ✅ 极好 | ⭐⭐ | ⭐⭐⭐ | ⭐ | N/A | ⭐⭐⭐ |
| 适合小项目 | ✅✅✅ | ✅✅ | ❌ | ❌ | ⚠️ | ✅✅ |

---

## 五、推荐方案

### 5.1 推荐：Resend（首选）

**理由总结**：

1. **Supabase 官方推荐** — 集成文档最完善，踩坑最少
2. **100 封/天免费** — AI Todo 当前用户量小，注册频率低，免费额度完全够用
3. **配置极简** — 注册 → 验证域名 → API Key → 填入 Supabase，15 分钟可完成
4. **实时 Dashboard** — 可以查看每封确认邮件的发送状态（送达/打开/点击）
5. **react.email 生态** — 未来如果需要更丰富的邮件模板（如周报邮件），可直接复用同生态
6. **开发者友好** — 专注事务邮件，不做营销邮件，API 设计清晰

### 5.2 备选：Brevo（Sendinblue）

如果 Resend 因故不可用（如域名验证问题），Brevo 是合适的备选：

- 300 封/天免费，比 Resend 多
- 国内可达性好
- 配置难度略高于 Resend

### 5.3 配置成本估算

| 项目 | 时间 | 费用 |
|------|:---:|:---:|
| Resend 账号注册 | 2 分钟 | $0 |
| DNS 域名验证（添加 TXT/MX 记录） | 5-10 分钟 | $0 |
| Supabase SMTP 配置 | 5 分钟 | $0 |
| 邮件模板编辑 | 5 分钟 | $0 |
| 测试验证（注册→确认→登录） | 10 分钟 | $0 |
| **合计** | **~30 分钟** | **$0** |

---

## 六、Supabase Dashboard 配置清单

### 6.1 Authentication → Settings → Email → SMTP Settings

配置自定义 SMTP 后，Supabase 将使用自定义 SMTP 替代默认邮件服务发送所有 Auth 相关邮件。

| 配置项 | 说明 | Resend 示例值 |
|--------|------|------|
| **SMTP Host** | SMTP 服务器地址 | `smtp.resend.com` |
| **SMTP Port** | 端口号 | `465`（SSL）或 `587`（TLS） |
| **SMTP Username** | SMTP 认证用户名 | `resend` |
| **SMTP Password** | SMTP 认证密码 / API Key | Resend Dashboard 生成的 API Key |
| **Sender Name** | 发件人显示名称 | `AI Todo` |
| **Sender Email** | 发件人邮箱地址 | `noreply@<你的域名>` |
| **Enable SMTP** | 开启自定义 SMTP | **ON** |

> ⚠️ **Sender Email 必须是 Resend 中已验证的域名**（如 `noreply@aitodo.app`）。如果用 Gmail 地址作为发件人，Resend 会拒绝发送。

### 6.2 Authentication → Settings → Email → Auth Emails

| 配置项 | 推荐值 | 说明 |
|--------|:---:|------|
| **Confirm email** | **ON** | 保持开启（V2.1 已配置） |
| **Allow unconfirmed email sign in** | **OFF** | 保持关闭（V2.1 已配置） |
| **Allow new users to sign up** | **ON** | 保持开启（V2.1 已配置） |

### 6.3 Authentication → URL Configuration

| 配置项 | 值 | 说明 |
|--------|-----|------|
| **Site URL** | Vercel 生产域名 | 如 `https://ai-todo-kappa-drab.vercel.app`（V2.1 已配置） |
| **Redirect URLs** | 生产域名 + localhost | 如 `https://ai-todo-kappa-drab.vercel.app/**`, `http://localhost:3000/**`（V2.1 已配置） |

### 6.4 配置前后对比

| 项目 | 配置前 | 配置后 |
|------|--------|--------|
| 邮件发送服务 | Supabase 内置（默认额度很低） | Resend（100 封/天，可付费扩展） |
| 发件人 | `noreply@mail.app.supabase.io` | `noreply@<自有域名>` |
| Confirm signup 邮件模板 | 🔒 不可编辑 | 🔓 可编辑（中文 + 自定义链接） |
| 发送日志 | ❌ 不可见 | ✅ Resend Dashboard 实时可见 |
| 邮件模板 | 英文默认 | 中文自定义 |

---

## 七、Confirm signup 邮件模板改造

### 7.1 改造目标

SMTP 配置完成后，Supabase 解锁邮件模板编辑功能。需要编辑 **Confirm signup** 模板。

### 7.2 模板位置

Supabase Dashboard → Authentication → Email Templates → **Confirm signup**

### 7.3 关键改造：确认链接格式

Supabase 默认 Confirm signup 模板使用 `{{ .ConfirmationURL }}`，这会生成 Supabase 默认的确认链接（指向 Supabase 域名）。

**必须替换为自定义 callback URL 格式**：

```
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email
```

> ⚠️ **写 `type=email`，不写 `type=signup`。** V2.1 的 `src/app/auth/callback/route.ts` 中 `getOtpType()` 只接受 `"email"`。如果写 `type=signup`，callback route 会走 `tokenHash && otpType` 为 null 的分支 → 直接重定向首页，邮箱不会确认。

### 7.4 推荐模板内容

**邮件主题**：

```
确认你的 AI Todo 账号
```

**邮件正文（HTML）**：

```html
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a2e;">
  
  <h2 style="color: #4f46e5; margin-bottom: 16px;">AI Todo</h2>
  
  <p style="font-size: 16px; line-height: 1.6;">你好，</p>
  
  <p style="font-size: 16px; line-height: 1.6;">
    感谢注册 AI Todo！请点击下方按钮确认你的邮箱地址：
  </p>
  
  <div style="text-align: center; margin: 32px 0;">
    <a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email"
       style="display: inline-block; padding: 14px 32px; background-color: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 500;">
      确认邮箱地址
    </a>
  </div>
  
  <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
    如果按钮无法点击，请复制以下链接到浏览器打开：
  </p>
  
  <p style="font-size: 12px; color: #9ca3af; word-break: break-all; background: #f3f4f6; padding: 12px; border-radius: 6px;">
    {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email
  </p>
  
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
  
  <p style="font-size: 12px; color: #9ca3af; line-height: 1.5;">
    如果你没有注册 AI Todo 账号，请忽略此邮件。<br/>
    此邮件由 AI Todo 自动发送，请勿回复。
  </p>
  
</body>
</html>
```

### 7.5 模板要点

| 要点 | 说明 |
|------|------|
| `{{ .SiteURL }}` | Supabase 模板变量，自动替换为 Dashboard 中配置的 Site URL |
| `{{ .TokenHash }}` | Supabase 模板变量，自动替换为当次确认的 token_hash |
| `type=email` | 固定写死，必须 `email`，不能写 `signup` |
| 中文内容 | 与 App 整体中文界面一致 |
| 品牌色 `#4f46e5` | 与 App Tailwind `indigo-600` 保持一致 |
| 纯文本备用链接 | 邮件客户端不支持 HTML 按钮时仍可确认 |

### 7.6 模板改动前后对比

| 项目 | 改动前 | 改动后 |
|------|--------|--------|
| 语言 | 英文（Supabase 默认） | 中文 |
| 确认链接 | `{{ .ConfirmationURL }}`（Supabase 内部 URL） | `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email` |
| 品牌 | 无品牌标识 | 含 AI Todo 品牌名 + 品牌色 |
| 按钮 | 无 | 有"确认邮箱地址"按钮 |
| 收件人称呼 | 无 | "你好" |

---

## 八、代码变更分析

### 8.1 结论：零代码变更

V2.1-Follow-up SMTP 是一个**纯配置操作阶段**，不需要修改任何 `src/` 下的文件。

### 8.2 验证已有代码兼容性

逐一验证现有代码是否已兼容自定义 SMTP 场景：

| 文件 | 相关代码 | 是否兼容 | 说明 |
|------|---------|:---:|------|
| `src/app/auth/callback/route.ts` | `getOtpType("email")` → `verifyOtp({ token_hash, type: "email" })` | ✅ | 只要邮件模板写 `type=email`，callback 即可正确处理 |
| `src/hooks/useAuth.ts` | `signUp()` → 注册后不自动 setUser | ✅ | 注册后等待邮件确认流程不变 |
| `src/hooks/useAuth.ts` | `onAuthStateChange` → 监听 session 变化 | ✅ | 确认后 session 自动恢复 |
| `src/components/AuthModal.tsx` | 注册成功 → 显示"请查看邮箱确认" | ✅ | 文案不变 |
| `src/lib/supabase-server.ts` | `getAuthenticatedUserId()` | ✅ | 与邮件发送完全无关 |
| 所有 API Routes | 通过 `getAuthenticatedUserId()` 获取用户 | ✅ | 与邮件发送完全无关 |

### 8.3 callback route 兼容性保障

V2.1 的 `src/app/auth/callback/route.ts` 已经做了正确的简化——只接受 `type=email`：

```typescript
// 当前代码逻辑（V2.1 已实现）：
function getOtpType(type: string | null): EmailOtpType | null {
  if (type === "email") {
    return "email";
  }
  return null;
}
```

只要邮件模板中的链接写的是 `type=email`（不写 `type=signup`），callback 就能正确调用 `verifyOtp` 完成邮箱确认。**代码无需改动。**

### 8.4 唯一可能需要代码变更的场景

| 场景 | 可能性 | 应对 |
|------|:---:|------|
| 自定义 SMTP 配置后发现 callback route 不兼容自定义邮件模板 | **极低** | 仅当测试失败时，才排查 callback route。大概率是模板中 `type` 写错或 URL 拼写错误，修正模板即可 |

**如果测试发现 callback 确实不兼容，先汇报，不要自行修改 callback route。**

---

## 九、依赖分析

### 9.1 结论：零新增依赖

| 依赖类型 | 是否需要新增 | 说明 |
|----------|:---:|------|
| npm 依赖 | ❌ 不需要 | 不修改 `package.json` |
| 第三方服务 | ✅ 需要 | Resend（或备选 SMTP 服务商）账号 |
| 域名 DNS 配置 | ✅ 需要 | 在域名 DNS 中添加 TXT/MX 记录以验证域名所有权 |
| 环境变量 | ❌ 不需要 | SMTP 配置在 Supabase Dashboard 中完成，不在 `.env.local` |
| Supabase 配置 | ✅ 需要 | Dashboard 中配置 SMTP + 编辑邮件模板 |

### 9.2 为什么不新增 npm 依赖

- SMTP 发送由 Supabase Auth 服务端处理，不经过 Next.js
- Resend 提供 REST API，但 Supabase 已内置 SMTP 集成，不需要直接调用 Resend API
- 邮件模板是 Supabase Dashboard 中的 HTML，不涉及 react.email 等模板引擎

---

## 十、数据库变更分析

### 10.1 结论：零数据库变更

| 变更类型 | 是否需要 | 说明 |
|----------|:---:|------|
| Schema 变更 | ❌ 不需要 | 不新增表、不修改字段 |
| Migration | ❌ 不需要 | 无 DDL 变更 |
| RLS Policy | ❌ 不需要 | 权限策略不变 |
| 数据迁移 | ❌ 不需要 | 不涉及 `auth.users` 以外的任何数据 |
| `auth.users` 表 | ❌ 不需要手动操作 | Supabase Auth 自动管理，email_confirmed_at 字段自动更新 |

---

## 十一、验收标准

### 11.1 配置验收

| # | 验收项 | 验证方法 |
|---|--------|---------|
| 1 | Resend 账号已注册 | Resend Dashboard 可登录 |
| 2 | 域名已验证 | Resend Dashboard → Domains → Status = Verified |
| 3 | Supabase SMTP 已配置 | Supabase Dashboard → Email → SMTP Settings → Enable SMTP = ON |
| 4 | Confirm signup 邮件模板已自定义 | Supabase Dashboard → Email Templates → Confirm signup 显示自定义内容 |
| 5 | 模板中确认链接使用 `type=email` | 检查模板 HTML 中是否包含 `type=email`（不是 `type=signup`） |

### 11.2 功能验收

| # | 验收项 | 预期结果 | 环境 |
|---|--------|---------|------|
| 6 | 注册后收到确认邮件 | 输入新邮箱+密码注册 → 能在合理时间内收到确认邮件；若未出现在收件箱需检查垃圾箱 | 生产 |
| 7 | 确认邮件为中文 | 邮件主题和正文为中文 | 生产 |
| 8 | 确认邮件发件人为自定义域名 | 发件人显示 `AI Todo <noreply@<域名>>` | 生产 |
| 9 | 确认邮件送达检查 | 收件箱或垃圾箱中能找到确认邮件；若均未收到，检查 Resend 发送日志确认邮件是否已发送 | 生产 |
| 10 | 点击确认链接 → 邮箱状态变为已确认 | 点击确认链接 → 跳回站点 → Supabase Dashboard 中用户 email_confirmed_at 非空 | 生产 |
| 11 | 确认后可以正常登录 | 确认邮件 → 用该邮箱+密码登录 → 登录成功 | 生产 |
| 12 | 重复注册收到限流提示（非邮件丢失） | 短时间内多次注册 → 操作过于频繁的提示正常显示 | 生产 |
| 13 | 未确认邮箱登录被拒绝 | 注册后不点确认邮件 → 直接登录 → 显示"邮箱尚未确认" | 生产 |

### 11.3 稳定性验收

| # | 验收项 | 验证方法 |
|---|--------|---------|
| 14 | 连续注册 5 个测试账号均收到确认邮件 | 手动测试（使用不同邮箱或 Gmail +alias） |
| 15 | Resend Dashboard 显示所有邮件发送成功 | Resend Dashboard → Emails → 检查发送日志 |
| 16 | 24 小时后再注册仍可正常发送 | 次日回归测试 |

### 11.4 回归验收

| # | 验收项 | 验证方法 |
|---|--------|---------|
| 17 | 已有用户仍可正常登录 | 用 V2.1 阶段已注册的账号登录 → 成功 |
| 18 | 匿名模式不受影响 | 不登录 → 生成任务 → 正常 |
| 19 | 登录后任务迁移正常 | 匿名创建任务 → 登录 → 任务绑定到 user_id |
| 20 | 登出正常 | 登录 → 登出 → 回退匿名模式 |

### 11.5 门禁验收

| # | 验收项 | 命令 |
|---|--------|------|
| 21 | `git status --short` 无变更 | 因为零代码变更 |
| 22 | lint 通过 | `npm run lint` |
| 23 | build 通过 | `npm run build` |

---

## 十二、风险矩阵

| # | 风险 | 等级 | 影响 | 缓解措施 |
|---|------|:---:|------|---------|
| 1 | 域名验证失败（DNS 记录配置错误） | **P1** | Resend 无法发送邮件，注册确认流程中断 | 按 Resend 文档配置 TXT/MX 记录；等待 DNS 生效（通常 5-10 分钟）；Resend Dashboard 实时显示验证状态 |
| 2 | 邮件模板中 `type` 写成 `signup` 导致 callback 无法确认 | **P1** | 用户点击确认链接后邮箱未确认 | **必须在模板中写 `type=email`**；配置后立即用测试账号走通完整注册→确认→登录流程 |
| 3 | 确认邮件进垃圾箱 | **P2** | 用户看不到确认邮件 | 1) 使用自定义域名（非 supabase.io）；2) 配置 SPF/DKIM/MX 记录（Resend 验证域名时自动指导）；3) 邮件内容避免垃圾关键词 |
| 4 | SMTP 配置错误（Host/Port/Password） | **P2** | 注册后邮件未发送 | Supabase Dashboard → Email → 发送测试邮件；如果测试邮件失败，检查 SMTP 配置是否正确 |
| 5 | Supabase 免费计划 + Resend 免费额度耗尽 | **P3** | 无法发送确认邮件 | 100 封/天对小项目完全够用；Resend Dashboard 可监控用量；可随时付费升级 |
| 6 | callback route 与自定义模板中的 URL 格式不兼容 | **P2** | 确认链接无法正确处理 | 当前 callback route 已验证兼容 `type=email`；配置后立即测试；如果不兼容，先汇报不要自行改代码 |
| 7 | 现有用户（V2.1 已注册）的确认状态不受影响 | **P3** | N/A | 已确认的用户不受 SMTP 变更影响（SMTP 只影响新邮件的发送）；已注册但未确认的用户需重新注册 |

---

## 十三、执行方式建议

### 13.1 是否需要写执行方案

**建议：需要。**

虽然 V2.1-Follow-up 是纯配置操作（零代码变更），但：

1. 涉及 **第三方服务注册**（Resend）+ **DNS 配置** + **Supabase Dashboard 配置**——步骤多，容易遗漏
2. 需要明确的**执行顺序**（先 SMTP → 再模板 → 再测试）
3. 需要**验证清单**确保每步正确（特别是邮件模板中的 `type=email`）
4. 有 **P1 风险**（域名验证失败、type 写错）需要按步骤规避

**推荐执行方案**：`docs/Execution-Plan-V2.1-Follow-up-SMTP.md`

### 13.2 执行方案应包含

| 章节 | 内容 |
|------|------|
| Step 1 | Resend 账号注册 + 域名验证 |
| Step 2 | Supabase SMTP 配置 |
| Step 3 | Confirm signup 邮件模板编辑 |
| Step 4 | 本地测试验证（localhost + resend 测试模式） |
| Step 5 | 生产环境部署验证 |
| 验收清单 | 22 项验收标准检查表 |
| 回滚方案 | 如果 SMTP 配置失败，回退到 Supabase 默认邮件服务 |

### 13.3 执行方式

标准工作流：
1. Claude Code 写 `docs/Execution-Plan-V2.1-Follow-up-SMTP.md`
2. ChatGPT 审查
3. 人工按执行方案操作（注册 Resend / DNS / Supabase Dashboard 配置）
4. Claude Code 辅助验证（检查 callback route 是否兼容、lint+build）
5. ChatGPT 最终把关
6. 完成

### 13.4 本阶段禁止事项

| # | 禁止 | 原因 |
|---|------|------|
| 1 | 不修改 `src/` 任何文件 | SMTP 配置不涉及代码 |
| 2 | 不修改 `package.json` | 不新增依赖 |
| 3 | 不修改数据库 schema | 无变更需求 |
| 4 | 不修改 UI / AuthModal / Header | 不属于本阶段范围 |
| 5 | 不做 V2.2 路由结构改造 | V2.2 在 V2.1-Follow-up 之后 |
| 6 | 不做 Cloudflare Turnstile | 属于 V2.3 |
| 7 | 不做忘记密码 | 属于 V2.3 |
| 8 | 不新增 npm 依赖 | Resend 通过 SMTP 使用，不需要 SDK |
| 9 | 不提交 commit（除非有文档更新） | 如需提交文档，需经 ChatGPT 把关 |

---

> **文档结束**
>
> **下一文档**：`docs/Execution-Plan-V2.1-Follow-up-SMTP.md`（V2.1-Follow-up 执行方案，待编写）
>
> **关联文档**：
> - [Architecture-V2.1-Auth.md](Architecture-V2.1-Auth.md) — V2.1 Auth 架构方案
> - [Execution-Plan-V2.1-Auth.md](Execution-Plan-V2.1-Auth.md) — V2.1 Auth 执行方案
> - [Roadmap-V2.1-V2.3.md](Roadmap-V2.1-V2.3.md) — V2.1-V2.3 路线图
> - [PROJECT-CONTEXT.md](PROJECT-CONTEXT.md) — 项目长期上下文
> - [PROJECT-INDEX.md](PROJECT-INDEX.md) — 项目文件索引
