# V2.1-Follow-up SMTP 执行方案

> **状态**：执行方案，待 ChatGPT 审查
> **依赖**：[Architecture-V2.1-Follow-up-SMTP.md](Architecture-V2.1-Follow-up-SMTP.md)（架构方案已通过 ChatGPT 审查）
> **上一文档**：[Architecture-V2.1-Follow-up-SMTP.md](Architecture-V2.1-Follow-up-SMTP.md)
> **编写日期**：2026-07-02
> **受众**：人工操作者（非 Codex）

---

## 目录

- [一、阶段目标](#一阶段目标)
- [二、前置条件检查](#二前置条件检查)
- [三、Resend 配置步骤](#三resend-配置步骤)
- [四、Supabase SMTP 配置步骤](#四supabase-smtp-配置步骤)
- [五、Confirm signup 邮件模板配置](#五confirm-signup-邮件模板配置)
- [六、测试流程](#六测试流程)
- [七、失败排查](#七失败排查)
- [八、回滚方案](#八回滚方案)
- [九、验收标准](#九验收标准)
- [十、是否需要 Codex](#十是否需要-codex)
- [十一、完成后文档收尾](#十一完成后文档收尾)

---

## 一、阶段目标

### 1.1 我们要做什么

本阶段是 **纯后台配置操作**，不写任何代码。目标是：

| # | 目标 | 说明 |
|---|------|------|
| 1 | 注册 Resend 账号并验证自有域名 | 获取一个专业的邮件发送服务 |
| 2 | 在 Supabase 中配置自定义 SMTP | 让 Supabase 用 Resend 发送注册确认邮件 |
| 3 | 编辑 Confirm signup 邮件模板 | 把默认英文邮件改成中文邮件 |
| 4 | 走通注册→收邮件→点击确认→登录完整链路 | 确保一切正常 |

### 1.2 做完之后的效果

- 用户注册 AI Todo 后会收到一封**中文确认邮件**，发件人是你自己的域名
- 邮件发送不受 Supabase 默认额度限制
- 可以在 Resend 后台查看每封邮件的发送状态

### 1.3 本阶段不改的东西

| 不改 | 原因 |
|------|------|
| `src/` 任何代码 | SMTP 配置是 Supabase 后台操作，不涉及代码 |
| `package.json` | 不需要新增 npm 依赖 |
| 数据库 | 不需要改表结构 |
| UI / 页面 | 不属于本阶段范围 |
| V2.2 路由 | 等 SMTP 稳定后再做 |

### 1.4 预计耗时

约 30–60 分钟（大部分时间在等待 DNS 生效）。

---

## 二、前置条件检查

在开始配置之前，请逐项确认以下条件。

### 2.1 GitHub + Vercel

| # | 检查项 | 确认命令 | 判断标准 |
|---|--------|---------|---------|
| 1 | 最新代码已推送到 GitHub main 分支 | `git status -sb`<br>`git log --oneline -3` | `git status -sb` 不应显示 `ahead` 或 `behind`；`HEAD` 和 `origin/main` 应在同一个最新提交上。如果显示 `ahead`，说明本地有提交还没推送，需要先执行 `git push origin main` |
| 2 | Vercel 正式域名可以正常访问 | 浏览器打开 Vercel 域名 | 能看到 AI Todo 页面 |

### 2.2 Supabase 配置

打开 [Supabase Dashboard](https://supabase.com/dashboard)，选择你的项目，然后检查：

| # | 检查项 | 在哪里看 | 应该是什么 |
|---|--------|---------|-----------|
| 3 | Site URL 是正式 Vercel 域名 | 左侧菜单「身份验证 Authentication」→「URL 配置 URL Configuration」→ Site URL | `https://你的域名.vercel.app`（不是 localhost） |
| 4 | Redirect URLs 包含正式域名 | 同上 → Redirect URLs | 包含 `https://你的域名.vercel.app/**` 和 `http://localhost:3000/**` |

> ⚠️ 如果 Site URL 还是 localhost，请先改成正式 Vercel 域名，否则确认邮件的链接会指向 localhost，手机和外部网络打不开。

### 2.3 域名

| # | 检查项 | 说明 |
|---|--------|------|
| 5 | 你有一个可以用来发邮件的域名 | 例如 `aitodo.app`、`yourdomain.com` |

**关于域名的说明**：

- Resend 最稳定的方式需要**验证自有域名**。你需要能在域名服务商（如阿里云、腾讯云、Cloudflare、Namecheap 等）的后台添加 DNS 记录。
- **如果你没有自有域名**：本阶段可以暂停，先继续使用 Supabase 默认邮件服务。等有域名后再回来配置。不建议用个人 Gmail SMTP 做生产发件。
- **如果你有域名但不确定能不能改 DNS**：登录你的域名服务商后台，找一下有没有"DNS 管理"或"域名解析"的功能，有就可以。

### 2.4 安全提醒

在开始之前，请记住一条最重要的规则：

> 🔒 **SMTP 密码 / Resend API Key 只能粘贴到 Supabase 后台。**
>
> 不能提交到 GitHub。
> 不能写进 `.env.local`。
> 不能截图发到聊天（包括发给 ChatGPT / Claude）。
> 如果 API Key 泄露，任何拿到它的人都可以用你的名义发邮件。

---

## 三、Resend 配置步骤

Resend 是我们选用的邮件发送服务。这一步我们注册 Resend、验证域名、获取 SMTP 信息。

### 3.1 注册 / 登录 Resend

1. 打开浏览器，访问 [https://resend.com](https://resend.com)
2. 点击页面上的「Sign up」或「Get started」注册账号
   - 可以用 GitHub 账号登录，也可以用邮箱注册
3. 注册后登录，进入 Resend Dashboard（后台面板）

### 3.2 添加并验证域名

1. 在 Resend 后台左侧菜单，点击「Domains」（域名）
2. 点击「Add Domain」（添加域名）按钮
3. 输入你的域名，例如 `aitodo.app`（不要带 `https://`，不要带 `www`）
4. 选择区域（Region）。一般选离你最近的：
   - 亚洲用户选 `ap-southeast-1`（新加坡）
   - 或者用默认推荐区域
5. 点击「Add」（添加）

### 3.3 获取 DNS 记录

添加域名后，Resend 会显示一组 DNS 记录，让你去域名服务商那边添加。通常会显示 3–4 条记录：

| 类型 | 名称 / 主机记录 | 值 / 记录值 |
|------|----------------|------------|
| TXT | `@`（或你的域名） | `resend-verification=...` |
| MX | `@`（或你的域名） | `feedback-smtp.ap-southeast-1.amazonses.com` |
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3...`（很长一串） |
| TXT | （可能还有一条 DMARC 记录） | `v=DMARC1; p=none;` |

> 📋 **具体记录以 Resend 页面显示的为准，不要从本文档复制。** 每人的记录值不同。

### 3.4 到域名服务商后台添加 DNS 记录

打开你的域名服务商后台（阿里云、腾讯云、Cloudflare、Namecheap 等），找到 DNS 管理 / 域名解析 页面。

逐条添加 Resend 让你添加的 DNS 记录：

**通用步骤**（不同服务商界面不同，但逻辑一样）：

1. 点击「添加记录」或「Add Record」
2. 选择记录类型（TXT / MX / CNAME）
3. 填写主机记录（@ 表示根域名，其他填完整名称）
4. 填写记录值（从 Resend 页面复制）
5. TTL（生存时间）保持默认即可
6. 保存

**常见服务商说明**：

- **阿里云**：登录 → 控制台 → 域名 → 解析 → 添加记录
- **腾讯云**：登录 → 控制台 → 域名管理 → 解析 → 添加记录
- **Cloudflare**：登录 → 选择域名 → DNS → Records → Add record
- **Namecheap**：登录 → Domain List → Manage → Advanced DNS → Add New Record

### 3.5 等待 DNS 验证

1. 回到 Resend 的域名页面
2. 点击「Verify DNS」（验证 DNS）按钮
3. 等待验证结果

**关于等待时间**：

- DNS 生效通常需要 **几分钟到几小时**（取决于你的域名服务商）
- 如果验证失败，等 5-10 分钟后再试
- 如果超过 1 小时还没通过，检查：
  - 主机记录有没有写错（有些服务商要求写 `@`，有些要求留空，有些要求写完整域名）
  - 记录值有没有多复制/少复制空格
  - MX 记录的优先级（Priority）是否正确

4. 当 Resend 页面显示域名状态为 **「Verified」（已验证）** 时，域名验证完成。

### 3.6 创建 API Key

1. 在 Resend 后台左侧菜单，点击「API Keys」（API 密钥）
2. 点击「Create API Key」（创建 API 密钥）
3. 输入一个名称，例如 `AI Todo SMTP`
4. 权限（Permission）选择「Sending」（发送）
5. 点击「Create」（创建）
6. Resend 会显示一串以 `re_` 开头的密钥

> 🔒 **这个 API Key 只显示一次。** 请立即复制并保存到安全的地方（如密码管理器）。不要发给 ChatGPT，不要截图，不要写进 `.env.local`，不要提交到 GitHub。

### 3.7 记录 SMTP 信息

记下以下信息，下一步会用到：

| 信息 | 值 |
|------|-----|
| SMTP Host（服务器地址） | `smtp.resend.com` |
| SMTP Port（端口） | `465` 或 `587` |
| SMTP Username（用户名） | `resend` |
| SMTP Password（密码） | 你刚才创建的 API Key（以 `re_` 开头） |

---

## 四、Supabase SMTP 配置步骤

这一步在 Supabase 后台配置自定义 SMTP，让 Supabase 通过 Resend 发送邮件。

### 4.1 进入 SMTP 设置页面

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 点击左侧菜单「身份验证 Authentication」
4. 点击「电子邮件 Emails」或「邮件设置 Email Settings」
5. 找到「SMTP 设置 SMTP Settings」区域

> 如果你的 Supabase 界面是英文的，没关系，按照上面的中英对照就能找到对应按钮。

### 4.2 开启自定义 SMTP

1. 找到「Enable Custom SMTP」（开启自定义 SMTP）开关
2. 把它**打开（ON）**
3. 开启后会显示 SMTP 配置表单

### 4.3 填写 SMTP 信息

将第三步获取的 Resend SMTP 信息填入以下字段：

| 字段（中英文） | 填什么 | 示例值 |
|---------------|--------|--------|
| SMTP Host<br>SMTP 服务器地址 | `smtp.resend.com` | `smtp.resend.com` |
| SMTP Port<br>SMTP 端口 | `465`（推荐）或 `587` | `465` |
| SMTP Username<br>SMTP 用户名 | `resend` | `resend` |
| SMTP Password<br>SMTP 密码 | 你的 Resend API Key（以 `re_` 开头） | `re_xxxxxxxxxxxx` |
| Sender name<br>发件人名称 | `AI Todo` | `AI Todo` |
| Sender email<br>发件人邮箱 | `noreply@你的域名` | `noreply@aitodo.app` |

> ⚠️ **Sender email 的域名必须和 Resend 中已验证的域名一致。** 例如你在 Resend 验证了 `aitodo.app`，那么发件人必须是 `xxx@aitodo.app`。不能用 Gmail 或其他不是你的域名。

### 4.4 保存

1. 检查所有字段填写无误
2. 点击页面底部的「保存 Save」或「应用更改 Apply Changes」
3. 如果保存成功，Supabase 会显示成功提示

### 4.5 发送测试邮件（如果有测试按钮）

部分 Supabase 版本在 SMTP 设置页面有「发送测试邮件 Send Test Email」按钮。

1. 如果有这个按钮，输入一个你可以收邮件的邮箱地址
2. 点击「发送测试邮件」
3. 检查邮箱是否收到测试邮件

如果测试邮件发送失败，跳到[七、失败排查](#七失败排查)查看常见原因。

### 4.6 确认 Auth 邮件设置

在同一个「电子邮件 Emails」页面，确认以下开关：

| 设置项（中英文） | 应该是 |
|-----------------|--------|
| Confirm email<br>确认邮箱 | **ON** ✅ |
| Allow unconfirmed email sign in<br>允许未确认邮箱登录 | **OFF** ❌ |
| Allow new users to sign up<br>允许新用户注册 | **ON** ✅ |

**不要让 Allow unconfirmed 开着**——否则用户不确认邮箱也能登录，配置邮件确认就没有意义了。

---

## 五、Confirm signup 邮件模板配置

SMTP 配置完成后，Supabase 会解锁邮件模板编辑功能。这一步我们把默认的英文确认邮件改成中文。

### 5.1 进入邮件模板

1. Supabase 左侧菜单 →「身份验证 Authentication」
2. 点击「电子邮件模板 Email Templates」
3. 在模板列表中找到「Confirm signup」（确认注册）并点击

### 5.2 邮件主题

在「Subject」（主题）字段中，把默认的英文主题替换为：

```
确认你的 AI Todo 账号
```

### 5.3 邮件正文（HTML）

在「Message」（邮件正文）字段中，**切换到 HTML 编辑模式**（如果有 HTML / Visual 切换按钮，选择 HTML）。

**删除默认内容**，复制以下完整 HTML 粘贴进去：

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

### 5.4 模板关键说明

模板中有几个 `{{ }}` 包裹的变量，这些是 Supabase 自动替换的，**不要修改它们**：

| 变量 | 作用 | 会自动变成什么 |
|------|------|--------------|
| `{{ .SiteURL }}` | Supabase Dashboard 中配置的 Site URL | `https://你的域名.vercel.app` |
| `{{ .TokenHash }}` | 当次注册的验证 token | 一串随机字符 |

### 5.5 确认链接格式检查 ⚠️ 非常重要！

模板中的确认链接必须是：

```
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email
```

**逐项确认**：

- [ ] 链接最后是 `&type=email`
- [ ] **不是** `&type=signup`（写 `signup` 会导致确认失败）
- [ ] **不是** `{{ .ConfirmationURL }}`（Supabase 默认格式，不会走我们的 callback route）
- [ ] **不是** 邮箱 6 位验证码的格式
- [ ] 参数是 `token_hash`（不是 `token`）

### 5.6 保存模板

1. 仔细检查 HTML 中的链接格式
2. 点击「保存 Save」或「应用更改 Apply Changes」
3. 保存成功后，模板配置完成

---

## 六、测试流程

SMTP 和邮件模板配置完成后，需要逐项测试确认一切正常。**请按顺序测试。**

### 6.1 准备工作

- 准备 **2–3 个从未注册过 AI Todo 的邮箱地址**
  - 可以是你自己的其他邮箱（QQ、163、Outlook、iCloud 等）
  - 如果你用的是 Gmail，可以加 `+` 别名，例如 `youraccount+test1@gmail.com`（Gmail 会把这封邮件送到 `youraccount@gmail.com`）
- 打开 Resend Dashboard，切换到「Emails」（邮件）页面，准备观察发送日志

### 6.2 测试 1：注册新账号并收到确认邮件

1. 浏览器打开 Vercel 正式域名（`https://你的域名.vercel.app`）
2. 点击「登录」按钮
3. 切换到「注册」Tab
4. 输入一个**从未注册过**的邮箱和密码（密码至少 6 位）
5. 点击「注册」
6. 页面显示「确认邮件已发送」

**然后检查邮箱**：

7. 打开这个邮箱的收件箱
8. 看是否有来自「AI Todo」的确认邮件
9. 邮件主题是否为「确认你的 AI Todo 账号」
10. 邮件内容是否为中文

**如果收件箱没有**：

11. 检查垃圾箱 / 垃圾邮件文件夹
12. 如果垃圾箱也没有，打开 Resend Dashboard →「Emails」，查看是否有发送记录

### 6.3 测试 2：点击确认链接

1. 在确认邮件中，点击「确认邮箱地址」按钮
2. 浏览器会打开一个新标签页，跳回 AI Todo 站点
3. 如果看到 AI Todo 主页面（不论是否已登录），说明确认成功

**验证确认状态**（可选，如果你想确认得更彻底）：

4. 回到 Supabase Dashboard → 左侧「身份验证 Authentication」→「用户 Users」
5. 找到刚才注册的邮箱
6. 查看 `Email Confirmed`（邮箱已确认）一列是否为 ✅

### 6.4 测试 3：确认后登录

1. 回到 AI Todo 站点
2. 点击「登录」（如果还没弹窗的话）
3. 切换到「登录」Tab
4. 输入刚才注册的邮箱和密码
5. 点击「登录」
6. 登录成功后，页面顶部应显示你的邮箱 +「登出」按钮

### 6.5 测试 4：登录后刷新保持登录

1. 按 F5 或 Cmd+R 刷新页面
2. 页面顶部仍显示你的邮箱（保持登录状态）

### 6.6 测试 5：未确认邮箱不能登录

用另一个新邮箱做这个测试：

1. 注册一个新邮箱（第 2 个测试邮箱）
2. **不要点击确认邮件**
3. 回到 AI Todo，尝试用这个邮箱登录
4. 预期结果：登录失败，显示「邮箱尚未确认，请先点击确认邮件中的链接」

### 6.7 测试 6：登出

1. 点击页面顶部的「登出」按钮
2. 页面顶部恢复为「登录」按钮
3. 匿名模式正常工作（可以输入目标生成任务）

### 6.8 测试 7：匿名生成任务正常

1. 不登录状态
2. 输入目标 → 点击「生成任务」
3. 任务正常生成

### 6.9 测试 8：匿名任务迁移正常

1. 不登录状态 → 生成一组任务
2. 点击「登录」→ 切换到「登录」Tab → 用已确认的邮箱登录
3. 登录成功后，之前匿名生成的任务应仍然存在
4. 这些任务现在归属于你的 user_id

### 6.10 测试 9：Resend Dashboard 确认

1. 打开 Resend Dashboard →「Emails」
2. 确认所有测试邮件都显示 `delivered`（已送达）
3. 如果有 `bounced`（退信）或 `failed`（失败），查看详情排查原因

---

## 七、失败排查

如果测试过程中遇到问题，按以下顺序排查。

### 7.1 注册后没收到邮件

**先检查 Resend Dashboard**：

1. 打开 Resend →「Emails」
2. 看有没有发送记录
   - **有发送记录，状态是 `delivered`**：邮件已送达，检查收件箱的垃圾邮件文件夹
   - **有发送记录，状态是 `bounced` 或 `failed`**：查看 Resend 的失败原因
   - **没有任何发送记录**：说明 Supabase 没有成功调用 Resend SMTP → 跳到 7.3

**然后检查垃圾箱**：

3. 打开邮箱的垃圾箱 / 垃圾邮件文件夹
4. 搜索 "AI Todo" 或 "noreply"
5. 如果垃圾箱有，点击「这不是垃圾邮件」或「标记为安全」

### 7.2 Resend 域名未验证

**现象**：Resend Dashboard 中域名状态不是 `Verified`。

**解决**：

1. 回到 Resend →「Domains」
2. 检查域名状态。如果显示 `Not Verified`（未验证）：
   - 点击域名查看需要哪些 DNS 记录
   - 回到域名服务商后台，逐条核对 DNS 记录是否正确
   - **常见错误**：
     - 主机记录写错：有的服务商要求 `@`，有的要求留空
     - 记录值复制不完整：特别是 DKIM 记录，值很长，确认没被截断
     - MX 记录优先级：确保 Priority 填写正确
   - 修改后等 5-10 分钟再验证

### 7.3 Supabase SMTP 配置错误

**现象**：Resend 没有任何发送记录，注册后也没有邮件。

**检查 Supabase SMTP 设置**：

1. Supabase →「身份验证 Authentication」→「电子邮件 Emails」→「SMTP 设置」
2. 逐项核对：

| 检查项 | 常见错误 |
|--------|---------|
| SMTP Host | 是否写成了 `smtp.resend.com`（注意是 resen**d**，不是 resen**t**） |
| SMTP Port | 是否选了 `465` 或 `587`（不要用 25） |
| SMTP Username | 是否填了 `resend`（全部小写） |
| SMTP Password | 是否填了完整的 API Key（以 `re_` 开头）。不要多复制空格 |
| Sender email | 域名是否和 Resend 已验证的域名一致 |
| Enable SMTP | 开关是否打开了 |

3. 如果有「发送测试邮件」按钮，用测试邮件验证 SMTP 配置
4. 如果测试邮件也失败，常见原因：
   - API Key 选错了权限（需要「Sending」权限）
   - API Key 已过期或被删除（回 Resend 重新创建一个）
   - 端口被防火墙拦截（换另一个端口试试）

### 7.4 确认链接点击后没有确认成功

**现象**：点击确认邮件中的按钮，跳转到 AI Todo 站点，但是登录时报「邮箱尚未确认」。

**可能原因**：

1. **邮件模板中 `type` 写错了**（最可能的原因）
   - 打开 Supabase →「电子邮件模板 Email Templates」→「Confirm signup」
   - 检查 HTML 中的链接，确认最后是 `&type=email`
   - 如果写的是 `&type=signup` → **改成 `&type=email`** → 保存 → 重新注册测试

2. **Site URL 配置不对**
   - Supabase →「身份验证 Authentication」→「URL 配置」→ Site URL
   - 确认是正式 Vercel 域名，不是 localhost

3. **Redirect URLs 缺少正式域名**
   - 同上，确认 Redirect URLs 包含 `https://你的域名.vercel.app/**`

### 7.5 邮件进垃圾箱

邮件发送成功（Resend 显示 `delivered`）但出现在垃圾箱：

1. 在邮箱中点击「这不是垃圾邮件」或「标记为安全」
2. 将发件人地址 `noreply@你的域名` 添加到通讯录
3. 随着收件人对邮件的正向操作增多，邮件服务商会逐渐提高信任度

### 7.6 多次注册被限流

**现象**：短时间内注册太多次，提示「操作过于频繁」或收不到新邮件。

这是 Supabase Auth 的正常保护机制，不是 SMTP 的问题。

**解决**：等几分钟再试。或用另一个邮箱测试。

---

## 八、回滚方案

如果 SMTP 配置后出现严重问题（如：所有注册都收不到邮件，且短期无法解决），可以回滚到 Supabase 默认邮件服务。

### 8.1 回滚步骤

1. Supabase →「身份验证 Authentication」→「电子邮件 Emails」→「SMTP 设置」
2. 找到「Enable Custom SMTP」开关
3. **把它关掉（OFF）**
4. 保存

### 8.2 回滚后的状态

- Supabase 恢复使用默认邮件服务发送确认邮件
- 确认邮件恢复为英文默认模板
- V2.1 Auth 的登录/注册功能不受影响（代码没改）
- 不需要回滚 Git commit
- 不需要改数据库

### 8.3 回滚后可以重新配置

SMTP 问题修好后可以随时重新开启。Resend 的域名验证和 API Key 不会因为关掉 Supabase SMTP 而失效。

---

## 九、验收标准

### 9.1 配置验收

| # | 验收项 | 怎么确认 |
|---|--------|---------|
| 1 | Resend 域名已验证 | Resend → Domains → 域名状态 = **Verified** |
| 2 | Supabase SMTP 保存成功 | Supabase → Email → SMTP Settings → Enable SMTP = ON，保存无报错 |
| 3 | Confirm signup 模板已编辑 | Supabase → Email Templates → Confirm signup 显示中文内容 |
| 4 | 模板链接包含 `type=email` | 模板 HTML 中搜索 `type=email`，能搜到 |

### 9.2 功能验收

| # | 验收项 | 预期结果 |
|---|--------|---------|
| 5 | 注册后收到确认邮件 | 邮件出现在收件箱或垃圾箱（如均未收到，查 Resend 日志） |
| 6 | 确认邮件为中文 | 主题和正文都是中文 |
| 7 | 发件人是自定义域名 | 发件人显示 `AI Todo <noreply@你的域名>` |
| 8 | 点击确认链接 → 邮箱已确认 | 跳回站点，Supabase Users 中 Email Confirmed = ✅ |
| 9 | 确认后可以登录 | 用邮箱+密码登录成功 |
| 10 | 未确认邮箱不能登录 | 新注册但不点确认邮件，直接登录 → 报错「邮箱尚未确认」 |
| 11 | 登录后刷新保持登录 | F5 刷新 → 仍显示已登录 |
| 12 | 登出正常 | 点击登出 → 恢复到未登录状态 |
| 13 | 匿名生成任务正常 | 不登录 → 输入目标 → 生成任务 |
| 14 | 匿名任务迁移正常 | 匿名生成任务 → 登录 → 任务保留且绑定到 user_id |
| 15 | Resend 显示 delivered | Resend → Emails → 所有测试邮件状态为 delivered |

### 9.3 安全验收

| # | 验收项 | 怎么确认 |
|---|--------|---------|
| 16 | API Key 未写入 Git | `git status --short` 无未提交变更 |
| 17 | API Key 未写入 `.env.local` | 打开 `.env.local`，搜索 `re_`，不应出现 |
| 18 | API Key 未发到聊天 | 确认没有把 API Key 粘贴到 ChatGPT/Claude 对话中 |
| 19 | SMTP 密码未截图公开 | 确认没有截图或拍照包含 API Key |

### 9.4 门禁验收

| # | 验收项 | 命令 |
|---|--------|------|
| 20 | `git status --short` 无变更 | 因为本阶段是纯配置，不改代码 |
| 21 | lint 通过 | `npm run lint` |
| 22 | build 通过 | `npm run build` |

---

## 十、是否需要 Codex

**默认不需要 Codex。**

本阶段是纯人工后台配置操作：
- 注册 Resend → 人工操作
- DNS 配置 → 人工操作
- Supabase SMTP 配置 → 人工操作
- 邮件模板编辑 → 人工操作
- 测试 → 人工操作

### 只有在以下情况下才需要 Codex：

| 场景 | 可能性 | 怎么办 |
|------|:---:|------|
| 测试发现 callback route 不兼容 | **极低** | 先汇报给 Claude Code / ChatGPT，由它们判断是否需要 Codex 修改 `src/app/auth/callback/route.ts`。**不要自行修改代码。** |

大多数情况下，测试不通过的原因是模板中 `type` 写成了 `signup`，改模板就行，不需要改代码。

---

## 十一、完成后文档收尾

SMTP 配置完成后，建议更新以下文档（**本次只写执行方案，不做收尾**）：

1. `docs/PROJECT-CONTEXT.md` — 更新 §9 下一阶段：V2.1-Follow-up SMTP 标记为 ✅ 完成
2. `docs/PROJECT-INDEX.md` — 更新路线表格和当前重点
3. `docs/Roadmap-V2.1-V2.3.md` — 更新路线状态

**记忆更新**：

阶段记忆更新另行安排，本执行方案不修改 memory。SMTP 配置完成并验收通过后，如项目规则要求维护 memory，再由 ChatGPT / Claude Code 单独安排。

文档收尾和 Memory 更新的时机是 SMTP 配置成功、全部验收通过之后。届时由 Claude Code 或 ChatGPT 另行安排。

---

> **文档结束**
>
> **下一文档**：SMTP 配置完成并验收通过后 → `docs/Architecture-V2.2-UI.md`（V2.2 页面结构与产品体验升级架构方案，待编写）
>
> **关联文档**：
> - [Architecture-V2.1-Follow-up-SMTP.md](Architecture-V2.1-Follow-up-SMTP.md) — V2.1-Follow-up SMTP 架构方案
> - [Architecture-V2.1-Auth.md](Architecture-V2.1-Auth.md) — V2.1 Auth 架构方案
> - [Execution-Plan-V2.1-Auth.md](Execution-Plan-V2.1-Auth.md) — V2.1 Auth 执行方案
> - [Roadmap-V2.1-V2.3.md](Roadmap-V2.1-V2.3.md) — V2.1-V2.3 路线图
> - [PROJECT-CONTEXT.md](PROJECT-CONTEXT.md) — 项目长期上下文
> - [PROJECT-INDEX.md](PROJECT-INDEX.md) — 项目文件索引
