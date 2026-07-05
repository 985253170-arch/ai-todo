# Architecture-V2.2B-Login — 登录/注册页高级感设计 架构方案

> **状态**：架构方案，非执行方案
> **依赖**：V2.2A 页面路由结构升级 ✅（已完成并提交 `088a05b`）
> **定位**：V2.2B 仅美化 `/login` 页面视觉体验，不修改任何 Auth 逻辑、API、数据库
> **上一文档**：[Architecture-V2.2A-Routing.md](Architecture-V2.2A-Routing.md) · [Roadmap-V2.2-UI-Upgrade.md](Roadmap-V2.2-UI-Upgrade.md)
> **设计日期**：2026-07-05

---

## 目录

- [一、阶段目标](#一阶段目标)
- [二、当前登录页现状分析](#二当前登录页现状分析)
- [三、设计方向](#三设计方向)
- [四、页面结构方案](#四页面结构方案)
- [五、登录卡片设计](#五登录卡片设计)
- [六、Tab 设计](#六tab-设计)
- [七、输入框设计](#七输入框设计)
- [八、按钮设计](#八按钮设计)
- [九、提示信息设计](#九提示信息设计)
- [十、设置密码引导边界](#十设置密码引导边界)
- [十一、文件改动范围建议](#十一文件改动范围建议)
- [十二、不做事项](#十二不做事项)
- [十三、风险分析](#十三风险分析)
- [十四、验收标准](#十四验收标准)
- [十五、后续执行建议](#十五后续执行建议)

---

## 一、阶段目标

### 1.1 V2.2B 是什么

V2.2B 是 V2.2 UI 升级三阶段中的**第一步**：登录/注册页高级感设计。

**一句话目标**：让 `/login` 看起来像正式产品，而不是普通表单页。

### 1.2 范围边界

| 维度 | V2.2B 范围 |
|------|-----------|
| **做什么** | 美化 `/login` 页面的视觉设计：背景、卡片、Tab、输入框、按钮、提示信息 |
| **不做什么** | 不改 Auth 逻辑、不改 useAuth、不改 AuthModal、不改 API、不改数据库、不改 `/app`、不做 AI 辅助执行 |
| **改多少文件** | 3-5 个文件（详见 §十一） |

### 1.3 为什么 V2.2B 先做

| 原因 | 说明 |
|------|------|
| **涉及文件最少** | 仅 LoginPageContent + Header + login/page.tsx，改动面可控 |
| **风险最低** | 不触碰核心业务逻辑（useAuth / API / 数据库零变更） |
| **用户第一印象** | 登录页是新用户的第一触点，打磨登录页能立即提升产品感知质量 |
| **建立风格基调** | V2.2B 的视觉方向将作为 V2.2C（主工作台美化）的风格参考 |
| **独立验收** | B 完成后可独立上线，用户能立即受益 |

---

## 二、当前登录页现状分析

### 2.1 涉及文件及职责

| 文件 | 当前职责 | V2.2A 状态 |
|------|---------|:--:|
| `src/app/login/page.tsx` | `/login` 路由入口，渲染 Header(login) + LoginPageContent | 新增（25 行薄壳） |
| `src/components/LoginPageContent.tsx` | 登录表单核心组件：OTP/密码双 Tab、邮箱输入、验证码输入、密码输入、按钮、错误提示 | 新增（~420 行） |
| `src/components/Header.tsx` | Header variant="login"：显示"返回首页"链接 + App 名称 | V2.2A 修改 |

### 2.2 当前功能状态

| 功能 | 状态 | 说明 |
|------|:--:|------|
| 邮箱验证码登录 | ✅ | 输入邮箱 → 发送 OTP → 输入 6 位码 → 自动验证 → 登录成功 |
| 密码登录 | ✅ | 切换到密码 Tab → 输入邮箱+密码 → 登录 |
| 登录成功跳转 `/app` | ✅ | `router.replace("/app")` |
| 已登录访问 `/login` 自动跳转 `/app` | ✅ | `useEffect` + `router.replace` |
| 验证码倒计时重新发送 | ✅ | 60 秒倒计时，使用 `window.setTimeout` |
| 邮箱保留（Tab 切换） | ✅ | 切换 Tab 时邮箱不清空 |
| 密码显示/隐藏切换 | ✅ | 密码输入框右侧按钮 |
| 错误提示（空邮箱/错误码/错误密码） | ✅ | 表单内 amber 风格提示 |
| 成功提示（验证码已发送） | ✅ | 表单内 indigo 风格提示 |
| Header login variant | ✅ | "返回首页"链接 + App 名称 |
| SetPasswordPrompt | ✅ | 由 Header variant="app" 管理，LoginPageContent 不涉及 |

### 2.3 当前视觉评估

**诚实评价：功能完整，视觉仍偏基础。**

| 维度 | 当前状态 | 问题 |
|------|---------|------|
| **页面背景** | `bg-[#F8FAFF]` + `from-indigo-50 via-white to-sky-50` 渐变 | 可用，但与 Landing 和 App 背景相同，缺乏登录页的独立视觉识别 |
| **登录卡片** | `rounded-3xl` 白色卡片 + `shadow-[0_18px_60px_rgba(15,23,42,0.08)]` | 风格基础，阴影偏灰暗，缺少轻量色彩倾向的阴影（如 indigo tint） |
| **Tab 切换** | `rounded-full` pill 切换，`bg-slate-100` 底 + 白色选中态 | 功能清晰，选中态对比度可增强 |
| **输入框** | `border-slate-200` 边框 + `focus:border-indigo-500` + `focus:ring-4 focus:ring-indigo-100` | 焦点态有 ring，但 default 态边框偏淡 |
| **主按钮** | `from-indigo-600 to-blue-500` 渐变 + 彩色阴影 | 视觉突出，但 disabled 态 `from-slate-400 to-slate-400` 偏灰 |
| **错误提示** | `amber-50` 背景 + `amber-100` 边框 | 颜色温和，但 amber 与 indigo 主色不协调 |
| **成功提示** | `indigo-50` 背景 + `indigo-100` 边框 | 与主色一致 |
| **重发按钮** | `rounded-full` 文字按钮 | 清晰，hover 态有反馈 |
| **移动端** | 卡片 `max-w-[420px]` 居中 | 在 375px 宽度手机上可用，但上下留白和间距可优化 |
| **键盘弹起** | 未专门处理 | 可能遮挡验证码输入框和提交按钮 |

### 2.4 当前设计的优点（保留）

以下方面不需要大改：

- **Tab pill 切换的交互模式**：`rounded-full` pill + 白色选中态，交互清晰，用户已习惯
- **表单在卡片内的布局**：卡片包裹表单，视觉聚焦
- **OTP 6 位自动提交**：输入满 6 位自动调用 `handleVerifyOtp`，体验流畅
- **密码显示/隐藏切换**：按钮在输入框右侧，符合惯例
- **错误提示在表单内展示**：不弹 toast，位置就近
- **主按钮渐变**：indigo → blue 的品牌渐变已建立识别

---

## 三、设计方向

### 3.1 视觉关键词

| 关键词 | 含义 |
|--------|------|
| **简洁高级** | 不花哨、不堆砌装饰、用留白和层级表达品质感 |
| **蓝紫渐变** | 与 Landing Page 和 App 主色一致（indigo-600 → blue-500） |
| **轻量玻璃感** | 白色卡片 + 极淡彩色阴影 + 微透明边框，不引入真正 glassmorphism（backdrop-blur 在移动端性能差） |
| **移动端优先** | 所有设计以 375px 宽度手机为第一目标，桌面端为居中增强 |
| **表单聚焦** | 视觉重点在表单本身，背景和装饰不分散注意力 |
| **不引入复杂动画** | 仅使用 CSS transition（`duration-150`），不做入场动画、不引入 framer-motion |

### 3.2 色彩体系

以现有 Tailwind indigo/blue 色系为基础，建立登录页专用色彩映射：

| 用途 | 颜色 | Tailwind Class 参考 |
|------|------|-------------------|
| **页面背景** | 柔和蓝紫渐变（与 App 背景有差异但同色系） | `from-indigo-50/60 via-white to-sky-50/40` |
| **卡片背景** | 白色 | `bg-white` |
| **卡片边框** | 极淡灰色 + 微透明 | `border border-slate-100` |
| **卡片阴影** | 轻量彩色阴影（indigo tint） | `shadow-xl shadow-indigo-500/5` |
| **主色** | indigo-600 | `text-indigo-600` `bg-indigo-600` |
| **主色渐变** | indigo-600 → blue-500 | `from-indigo-600 to-blue-500` |
| **成功色** | emerald-500 | `text-emerald-700` `bg-emerald-50` `border-emerald-100` |
| **错误色** | red-400（温和红，非大红） | `text-red-700` `bg-red-50` `border-red-100` |
| **文字主色** | slate-900 / slate-950 | `text-slate-950` |
| **文字辅色** | slate-500 | `text-slate-500` |
| **边框色** | slate-200（default）/ indigo-500（focus） | `border-slate-200` `focus:border-indigo-500` |

### 3.3 与 Landing Page 和 App 的视觉关系

| 页面 | 背景 | 关系 |
|------|------|------|
| `/` Landing | `bg-[#F8FAFF]` | 最简洁，静态展示 |
| `/login` | 蓝紫柔和渐变（介于 Landing 和 App 之间） | 比 Landing 多一层深度，比 App 少一些内容密度 |
| `/app` | `from-indigo-50 via-white to-sky-50` | 有内容时渐变作为背景层 |

三者保持同色系（indigo/blue/sky），但渐变深度和色彩浓度有微妙差异，形成视觉层次。

### 3.4 字体层级

| 层级 | 元素 | 大小/粗细 | Tailwind Class 参考 |
|------|------|----------|-------------------|
| **H1** | 卡片标题（"登录 AI Todo"） | 24px / semibold | `text-2xl font-semibold tracking-tight` |
| **Body** | 描述文案 | 14px / regular | `text-sm leading-6 text-slate-500` |
| **Label** | 输入框标签 | 14px / medium | `text-sm font-medium text-slate-700` |
| **Input** | 输入文字 | 16px / regular | `text-base`（防止 iOS 缩放） |
| **Button** | 按钮文字 | 16px / semibold | `text-base font-semibold` |
| **Hint** | 辅助文字/切换提示 | 14px / regular | `text-sm text-slate-500` |
| **Error/Success** | 提示信息 | 14px / regular | `text-sm` |

### 3.5 不引入的设计元素

| 不引入 | 原因 |
|--------|------|
| 复杂入场动画（fade-in、slide-up） | 增加 JS 复杂度，移动端性能差 |
| backdrop-blur 玻璃效果 | 移动端 Safari 性能差，滚动时卡顿 |
| 品牌插画/大图 | 增加页面加载体积，移动端浪费首屏空间 |
| 视频背景 | 加载慢、耗流量、分散注意力 |
| 粒子/星空动画 | 花哨、消耗 GPU、与"简洁高级"矛盾 |
| 渐变文字（bg-clip-text） | 仅用于 Landing Hero，登录页不需要 |
| 装饰性网格线/纹理 | 容易过时，增加 CSS 复杂度 |
| framer-motion / GSAP | 不引入新依赖 |

---

## 四、页面结构方案

### 4.1 移动端布局（375px 宽度）

```
┌──────────────────────────────────────┐
│  ← 返回首页              AI Todo     │  ← Header login variant
├──────────────────────────────────────┤
│                                      │
│                                      │  ← 柔和蓝紫渐变背景
│  ┌────────────────────────────────┐  │
│  │                                │  │
│  │        登录 AI Todo             │  │  ← 卡片标题
│  │  登录后可多设备同步任务数据      │  │  ← 描述文案
│  │                                │  │
│  │  ┌──────────┬──────────┐       │  │
│  │  │ 验证码登录│ 密码登录  │       │  │  ← Tab pill
│  │  └──────────┴──────────┘       │  │
│  │                                │  │
│  │  邮箱                          │  │
│  │  ┌────────────────────────┐   │  │
│  │  │ you@example.com         │   │  │  ← 邮箱输入框
│  │  └────────────────────────┘   │  │
│  │                                │  │
│  │  [验证码输入框（6 位）]         │  │  ← 条件显示（otpSent 时）
│  │                                │  │
│  │  [提示信息]                    │  │  ← 条件显示（message/error）
│  │                                │  │
│  │  ┌────────────────────────┐   │  │
│  │  │       发送验证码         │   │  │  ← 主按钮（渐变）
│  │  └────────────────────────┘   │  │
│  │                                │  │
│  │  [重新发送（60s）]             │  │  ← 条件显示
│  │                                │  │
│  │  已有密码？使用密码登录 →       │  │  ← 切换提示
│  │                                │  │
│  └────────────────────────────────┘  │
│                                      │
│    登录后即可同步你的任务记录与行动数据  │  ← 底部辅助文案
│                                      │
└──────────────────────────────────────┘
```

### 4.2 桌面端布局（≥640px）

桌面端保持**单列居中**，不采用左右双栏布局。原因：

| 原因 | 说明 |
|------|------|
| **一致性** | 移动端和桌面端视觉一致，减少维护成本 |
| **聚焦** | 登录表单本身不需要侧边栏装饰，居中更聚焦 |
| **不引入 LoginVisualPanel** | 不创建桌面端专用装饰面板，保持简单 |
| **与 App 一致** | App 主工作台也是单列居中（`max-w-[720px]`），登录页保持一致 |

桌面端的差异仅在：
- 卡片 `max-w-sm`（384px）→ 居中，上下留白更大（`py-16` vs `py-12`）
- 背景渐变更明显（更大面积的渐变层）
- 可选：卡片增加 `hover:shadow-2xl` 微交互（鼠标悬停时阴影加深）

### 4.3 页面背景

```
移动端背景：
- 柔和蓝紫渐变：from-indigo-50/50 via-white to-sky-50/30
- 不抢卡片焦点
- 与 App 背景同色系但更淡

桌面端背景：
- 同色系渐变，面积更大
- 可选：增加一个极淡的装饰性圆形光晕（CSS radial-gradient，不引入图片）
```

### 4.4 Header login variant

当前 Header `variant="login"` 设计已可用（"返回首页" + App 名称），V2.2B 保持其结构不变。可微调项：

- "返回首页"链接颜色和 hover 态
- App 名称的字体间距
- 整体 Header 的上下内边距

**不改 Header 的结构、不改 variant 逻辑、不改 AuthModal 相关代码。**

### 4.5 底部辅助文案

在登录卡片下方增加一行轻量辅助文案：

```
登录后即可同步你的任务记录与行动数据
```

- 字号小（`text-xs`）、颜色淡（`text-slate-400`）
- 纯展示文案，无链接
- 不暗示已有使用条款或隐私政策页面
- 不增加页面高度负担
- 说明登录的核心价值（跨设备同步），而非法律义务

---

## 五、登录卡片设计

### 5.1 卡片整体规格

| 属性 | 移动端 | 桌面端 |
|------|--------|--------|
| **宽度** | `w-full max-w-sm`（100% 宽度，最大 384px） | `max-w-sm`（384px）居中 |
| **圆角** | `rounded-3xl`（24px） | 同移动端 |
| **边框** | `border border-slate-100` | 同移动端 |
| **阴影** | `shadow-xl shadow-indigo-500/5`（轻量 indigo 彩色阴影） | `shadow-2xl shadow-indigo-500/8`（略深） |
| **背景** | `bg-white` | 同移动端 |
| **内边距** | `p-5`（20px）→ sm:`p-6`（24px） | `p-6`（24px） |
| **水平位置** | 居中（`mx-auto`） | 居中 |

### 5.2 卡片设计原则

| 原则 | 说明 |
|------|------|
| **卡片与背景有分离感** | 白色卡片浮在柔和渐变背景之上，通过阴影和边框实现层次 |
| **不引入纯玻璃效果** | 不使用 `backdrop-blur`（移动端 Safari 性能差），用白色 + 极淡彩色阴影模拟轻量玻璃感 |
| **卡片内部有呼吸感** | 标题区、Tab 区、表单区之间有明确但不过大的间距 |
| **移动端不贴边** | 卡片左右两侧与屏幕边缘保持 `px-4`（16px）间距 |

### 5.3 卡片标题区

```
┌──────────────────────────────────────┐
│                                      │
│         登录 AI Todo                  │  ← h1: text-2xl font-semibold
│  登录后可多设备同步任务数据。          │  ← p: text-sm text-slate-500
│                                      │
└──────────────────────────────────────┘
```

- 标题居中
- 标题和描述之间有 `mt-2`（8px）间距
- 标题区和 Tab 区之间有 `mb-5` 或 `mb-6` 间距
- 标题文案使用 `AUTH_TEXT.MODAL_TITLE`（现有常量，不改）
- 描述文案使用 `AUTH_TEXT.MODAL_DESCRIPTION`（现有常量，不改）

### 5.4 移动端间距

| 间距位置 | 值 | 说明 |
|----------|-----|------|
| 卡片左右距屏幕边缘 | `px-4`（16px） | 由外层容器提供 |
| 卡片上下距 Header/底部 | `py-8` 到 `py-12` | 垂直居中但不过紧 |
| 卡片内边距 | `p-5` 移动端 / `p-6` 桌面端 | 内部留白 |
| 标题到描述 | `mt-2` | 紧凑 |
| 描述到 Tab | `mt-5` | 中等间距 |
| Tab 到表单 | `mt-4` | 紧凑 |
| 输入框之间 | `gap-3` | 12px |
| 最后一个输入框到按钮 | `mt-3` | 12px |
| 按钮到切换提示 | `mt-3` | 12px |

### 5.5 键盘弹起时

- 页面使用 `min-h-[100dvh]`（dynamic viewport height）而非 `min-h-screen`，确保键盘弹起后可视区域正确
- 表单区域不应被键盘完全遮挡——页面使用 `overflow-auto` 允许滚动
- 验证码输入框和提交按钮在键盘弹起后应仍可触达（通过页面自动滚动）
- 不依赖 `window.scrollTo` 或手动滚动逻辑——依赖浏览器原生 `scrollIntoView` 行为（输入框 focus 时自动滚动）

---

## 六、Tab 设计

### 6.1 当前 Tab 结构（不改逻辑）

```tsx
// 当前实现（V2.2A），逻辑层不动
<div className="grid grid-cols-2 rounded-full bg-slate-100 p-1">
  <button onClick={() => switchMode("otp")} type="button">
    {AUTH_TEXT.OTP_LOGIN_TAB}    // "验证码登录"
  </button>
  <button onClick={() => switchMode("password")} type="button">
    {AUTH_TEXT.PASSWORD_LOGIN_TAB} // "密码登录"
  </button>
</div>
```

**V2.2B 不改 `switchMode` 逻辑、不改 `AUTH_TEXT` 常量、不改 Tab 结构（grid-cols-2 pill）。**

### 6.2 Tab 视觉规格

| 状态 | 视觉要求 | Tailwind 参考 |
|------|---------|-------------|
| **选中态** | 白色背景 + indigo 文字 + 轻量阴影 | `bg-white text-indigo-700 shadow-sm` |
| **未选中态** | 透明背景 + slate-500 文字 | `text-slate-500` |
| **hover（未选中）** | 文字颜色加深 | `hover:text-slate-700` |
| **active（按下）** | 微缩放反馈 | `active:scale-[0.97] transition` |
| **disabled / loading** | 降低透明度 + 不可点击 | `disabled:opacity-50 disabled:cursor-not-allowed` |

### 6.3 Tab 容器规格

| 属性 | 值 | 说明 |
|------|-----|------|
| **容器背景** | `bg-slate-100` | 保持现有 |
| **容器圆角** | `rounded-full` | 保持现有 pill 风格 |
| **容器内边距** | `p-1` | 保持现有 |
| **每个 Tab 高度** | `min-h-[42px]` | 触控友好 |
| **每个 Tab 圆角** | `rounded-full` | 保持现有 |
| **每个 Tab 文字** | `text-sm font-semibold` | 保持现有 |

### 6.4 Tab 切换行为（不改）

| 行为 | 说明 |
|------|------|
| 切换时清空密码/验证码输入 | `switchMode` 中 `setPassword("")` `setToken("")` |
| 切换时清空 otpSent 状态 | `setOtpSent(false)` |
| 切换时清空提示信息 | `setMessage(null)` `setErrorMessage(null)` |
| 切换时保留邮箱 | `setEmail` 不在 `switchMode` 中清空 |
| 切换时重置重发倒计时 | `setResendSeconds(0)` |
| 切换时重置提交状态 | `setIsSubmitting(false)` |

**以上全部不改——V2.2B 仅改 Tab 的 className，不改 onClick / switchMode 逻辑。**

---

## 七、输入框设计

### 7.1 涉及的输入控件

| 输入控件 | 当前实现 | V2.2B 改动 |
|---------|---------|:--:|
| 邮箱输入框 | `<input type="email">` | 仅改 className |
| 密码输入框 | `<input type="password">` + 显示/隐藏按钮 | 仅改 className |
| 6 位验证码输入框 | `<input inputMode="numeric" maxLength={6}>` | 仅改 className |

**V2.2B 不改 `onChange` / `onSubmit` / `handleTokenChange` / `autoComplete` 逻辑。**

### 7.2 通用输入框规格

| 属性 | 值 | 说明 |
|------|-----|------|
| **高度** | `min-h-[48px]` | 触控友好（≥44px） |
| **圆角** | `rounded-xl`（12px） | 与按钮圆角一致 |
| **内边距** | `px-4`（16px） | 文字不贴边 |
| **字号** | `text-base`（16px） | 防止 iOS Safari 自动缩放 |
| **文字颜色** | `text-slate-950` | |
| **placeholder 颜色** | `placeholder:text-slate-400` | |

### 7.3 各状态视觉规格

| 状态 | 边框 | 背景 | 其他 |
|------|------|------|------|
| **default** | `border-slate-200` | `bg-white` | — |
| **focus** | `border-indigo-500` | `bg-white` | `ring-4 ring-indigo-500/10`（微透明 ring） |
| **error** | `border-red-300` | `bg-white` | `ring-4 ring-red-500/5` |
| **disabled** | `border-slate-100` | `bg-slate-50` | `text-slate-400 cursor-not-allowed` |
| **loading** | `border-slate-200` | `bg-white` | `opacity-70 cursor-wait` |

### 7.4 邮箱输入框

```
┌──────────────────────────────────────────────┐
│  邮箱                                        │  ← label
│  ┌──────────────────────────────────────┐   │
│  │  ✉  you@example.com                  │   │  ← 可选：添加小图标前缀
│  └──────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

- 可选用 emoji 或 SVG 图标作为前缀（`✉` 或邮箱 icon），提升视觉识别
- 图标放在输入框内左侧，使用 `pl-10` 为文字腾出空间
- 不改 `type="email"`、不改 `placeholder`、不改 `value`/`onChange`

### 7.5 密码输入框

```
┌──────────────────────────────────────────────┐
│  密码                                        │  ← label
│  ┌──────────────────────────────────────┐   │
│  │  🔒  ●●●●●●●●          显示/隐藏    │   │  ← 前缀图标 + 后缀按钮
│  └──────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

- 密码输入框 + 显示/隐藏按钮的组合容器保持 `flex` + `items-center` + 统一边框
- focus 态：整体容器的边框和 ring 统一变化（通过 `focus-within:` 实现）
- 显示/隐藏按钮：`min-h-[48px] px-4 text-sm font-semibold text-slate-500`
- 不改 `type` 切换逻辑、不改 `isPasswordVisible` state

### 7.6 6 位验证码输入框

```
┌──────────────────────────────────────────────┐
│  验证码                                      │  ← label
│  ┌──────────────────────────────────────┐   │
│  │  _  _  _  _  _  _                    │   │  ← 6 位输入框（单 input）
│  └──────────────────────────────────────┘   │
│  已发送至 you@example.com                   │  ← 可选提示
└──────────────────────────────────────────────┘
```

- 保持单 `<input>` 实现（不拆成 6 个独立 input，减少 DOM 复杂度）
- 文字居中：`text-center`
- 字间距：`tracking-[0.35em]`（保持现有，让 6 位数字视觉上分开）
- 字号：`text-lg font-semibold`
- `inputMode="numeric"` 保持（触发手机数字键盘）
- `autoComplete="one-time-code"` 保持（iOS 自动填充短信验证码）
- `maxLength={6}` 保持
- `onChange` → `handleTokenChange` 保持（自动过滤非数字、满 6 位自动提交）

### 7.7 手机数字键盘体验

- `inputMode="numeric"` 确保 iOS 和 Android 弹出数字键盘
- 验证码输入框 focus 时，确保页面滚动到输入框可见
- 键盘弹起后，提交按钮应在可视区域内（不需要手动关闭键盘）

---

## 八、按钮设计

### 8.1 涉及的按钮

| 按钮 | 当前存在 | V2.2B 改动 |
|------|:--:|:--:|
| 主提交按钮（发送验证码 / 验证 / 密码登录） | ✅ | 仅改 className |
| 重新发送按钮 | ✅ | 仅改 className |
| Tab 切换提示按钮（"使用密码登录 →"） | ✅ | 仅改 className |
| 密码显示/隐藏按钮 | ✅ | 仅改 className |

### 8.2 主按钮规格

| 属性 | 值 | 说明 |
|------|-----|------|
| **高度** | `min-h-[48px]` | 触控友好（≥44px） |
| **宽度** | `w-full` | 占满卡片宽度 |
| **圆角** | `rounded-xl`（12px） | 与输入框圆角一致 |
| **背景（default）** | `from-indigo-600 to-blue-500` | 品牌渐变（保持现有） |
| **文字** | `text-base font-semibold text-white` | |
| **阴影** | `shadow-md shadow-indigo-500/20` | 轻量彩色阴影 |

### 8.3 主按钮各状态

| 状态 | 视觉 | Tailwind 参考 |
|------|------|-------------|
| **default** | 蓝紫渐变 + 彩色阴影 | `bg-gradient-to-r from-indigo-600 to-blue-500 shadow-md shadow-indigo-500/20` |
| **hover（桌面）** | 微上浮 + 阴影加深 | `hover:-translate-y-px hover:shadow-lg hover:shadow-indigo-500/25` |
| **active** | 恢复位置 + 微缩放 | `active:translate-y-0 active:scale-[0.98]` |
| **disabled** | 灰色渐变 + 无阴影 + 不可点击 | `disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none disabled:cursor-not-allowed` |
| **loading** | disabled 态 + 文字变为"发送中..." / "验证中..." | 由 `isSubmitting` 控制，`AUTH_TEXT` 已有对应文案 |

### 8.4 重新发送按钮规格

| 属性 | 值 |
|------|-----|
| **高度** | `min-h-[44px]` |
| **宽度** | `w-full` |
| **圆角** | `rounded-full`（保持 pill 风格） |
| **背景（default）** | 透明 |
| **文字（default）** | `text-sm font-semibold text-slate-500` |
| **hover** | `hover:bg-slate-100 hover:text-indigo-700` |
| **disabled（倒计时中）** | `disabled:opacity-60 disabled:cursor-not-allowed` |
| **倒计时文案** | `AUTH_TEXT.OTP_RESEND_COUNTDOWN` + `{resendSeconds}s`（保持现有） |

### 8.5 防止重复提交

- 所有按钮通过 `disabled={isSubmitting}` 防止重复提交（现有逻辑，不改）
- loading 期间按钮文字变化提供视觉反馈（现有逻辑，不改）
- `isSubmitting` 在 `finally` 块中重置为 `false`（现有逻辑，不改）

### 8.6 按钮文案清晰性

| 场景 | 文案来源 | 说明 |
|------|---------|------|
| 发送验证码（初始） | `AUTH_TEXT.OTP_SEND_BUTTON` | 不改 |
| 发送中 | `AUTH_TEXT.OTP_SEND_LOADING` | 不改 |
| 验证（已发送） | `AUTH_TEXT.OTP_VERIFY_BUTTON` | 不改 |
| 验证中 | `AUTH_TEXT.OTP_VERIFY_LOADING` | 不改 |
| 密码登录 | `AUTH_TEXT.PASSWORD_LOGIN_BUTTON` | 不改 |
| 密码登录中 | `AUTH_TEXT.PASSWORD_LOGIN_LOADING` | 不改 |

**所有按钮文案通过 `AUTH_TEXT` 常量管理，V2.2B 不改文案内容。**

---

## 九、提示信息设计

### 9.1 提示类型

| 类型 | 当前颜色 | V2.2B 调整 |
|------|---------|-----------|
| **成功提示**（验证码已发送） | `indigo-50` + `indigo-100` 边框 | 改为 `emerald-50` + `emerald-100` 边框 + `emerald-700` 文字 |
| **错误提示**（验证失败/密码错误） | `amber-50` + `amber-100` 边框 | 改为 `red-50` + `red-100` 边框 + `red-700` 文字 |
| **倒计时提示**（重新发送按钮文字） | 按钮内文字 | 保持 |
| **信息提示**（可选：验证码发送至邮箱） | — | 新增（可选） |

### 9.2 色彩调整核心理由

当前错误提示使用 amber（暖黄），与品牌主色 indigo（蓝紫）不协调。改为 red 系（温和红），与行业标准一致（错误=红色），同时保持温和（`red-50` 淡红背景 + `red-100` 边框，非大红 `red-500`）。

成功提示从 indigo 改为 emerald（翠绿），区分"信息提示"和"操作成功"，语义更清晰：
- **indigo** = 品牌信息（如"验证码已发送至 xxx"）
- **emerald** = 操作成功
- **red** = 操作失败

### 9.3 提示信息视觉规格

```
┌──────────────────────────────────────────────┐
│  ✓  验证码已发送，请查看邮箱                  │  ← emerald 成功提示
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  ⚠  验证码错误，请重新输入                    │  ← red 错误提示
└──────────────────────────────────────────────┘
```

| 属性 | 成功提示 | 错误提示 |
|------|---------|---------|
| **背景** | `bg-emerald-50` | `bg-red-50` |
| **边框** | `border border-emerald-100` | `border border-red-100` |
| **文字** | `text-emerald-700` | `text-red-700` |
| **圆角** | `rounded-xl` | `rounded-xl` |
| **内边距** | `px-3 py-2` | `px-3 py-2` |
| **字号** | `text-sm` | `text-sm` |
| **位置** | 相关输入框下方 / 按钮上方 | 相关输入框下方 / 按钮上方 |
| **图标** | 可选 `✓` 前缀 | 可选 `⚠` 前缀 |

### 9.4 文案要求

| 要求 | 说明 |
|------|------|
| **中文清晰** | 用户一眼能看懂发生了什么 |
| **温和** | 不使用感叹号堆叠、不使用"错误！"、"失败！"等大字警告 |
| **不制造焦虑** | 错误提示不闪烁、不弹窗、不加红色大字标题 |
| **不暴露技术细节** | 不显示"Supabase error 400"、"token_hash mismatch"等技术信息 |
| **就近展示** | 提示在相关输入框下方，不在页面顶部全局弹 toast |

### 9.5 文案常量（不改）

所有文案通过 `AUTH_TEXT` 和 `ERROR_MESSAGES` 常量管理。V2.2B **不改**这些常量的值。色彩调整只在 JSX className 中进行，文案本身不变。

现有文案示例（仅参考，不改）：
- `AUTH_TEXT.OTP_SENT_MESSAGE` — "验证码已发送"
- `AUTH_TEXT.EMAIL_REQUIRED` — "请输入邮箱"
- `AUTH_TEXT.EMAIL_INVALID` — "邮箱格式不正确"
- `AUTH_TEXT.OTP_INVALID` — "验证码错误"
- `AUTH_TEXT.PASSWORD_LOGIN_ERROR` — "密码错误"
- `ERROR_MESSAGES.AUTH_OPERATION_FAILED` — "操作失败，请稍后再试"

---

## 十、设置密码引导边界

### 10.1 明确边界

| 边界 | 说明 |
|------|------|
| **V2.2B 不改 SetPasswordPrompt 逻辑** | `SetPasswordPrompt.tsx` 的 `isOpen` / `onClose` / `onSetPassword` / `onSkip` 逻辑全不动 |
| **登录成功后仍跳转 `/app`** | `router.replace("/app")` 不变 |
| **SetPasswordPrompt 仍由 Header variant="app" 管理** | Header 中的 `shouldShowSetPasswordPrompt` 逻辑不动 |
| **V2.2B 不在 LoginPageContent 中 import SetPasswordPrompt** | LoginPageContent 登录成功后直接 `router.replace("/app")`，不管理设置密码引导 |
| **V2.2B 不判断 `password_set`** | 不读取 `user.metadata.password_set`，不对其做任何判断 |

### 10.2 为什么 LoginPageContent 不管 SetPasswordPrompt

当前 V2.2A 架构中，LoginPageContent 登录成功后直接跳转 `/app`。SetPasswordPrompt 由 Header `variant="app"` 统一管理（检测 `password_set !== true` → 弹出 SetPasswordPrompt）。

这个设计有两个好处：
1. **单一职责**：LoginPageContent 只管登录，SetPasswordPrompt 只管引导设置密码
2. **避免双弹窗**：无论用户从 `/login` 还是 AuthModal 登录，最终都进入 `/app`，由同一个 Header 管理 SetPasswordPrompt

**V2.2B 保持这个架构不变。**

### 10.3 SetPasswordPrompt 视觉统一（可选）

如果 V2.2B 之后发现 SetPasswordPrompt 的卡片样式与新的登录卡片风格差异过大，可以作为**可选微调项**：

| 微调项 | 说明 |
|--------|------|
| 卡片圆角、阴影、边框统一 | 仅改 className |
| 不改弹出逻辑 | `isOpen` / `onClose` / `onSkip` 全不动 |
| 不改 `setPassword` 调用 | `onSetPassword` 回调不动 |

**注意**：这是可选项，不作为 V2.2B 必做项。如果在 V2.2B 中做了 SetPasswordPrompt 样式微调，必须在执行方案中明确标注"仅样式微调，不改逻辑"。

---

## 十一、文件改动范围建议

### 11.1 允许修改文件

| # | 文件 | 操作 | 预计改动量 | 说明 |
|---|------|:---:|:---:|------|
| 1 | `src/app/login/page.tsx` | **修改** | 小（~5 行） | 页面级背景渐变调整 |
| 2 | `src/components/LoginPageContent.tsx` | **主要修改** | 中（~60 行 className 改动） | 卡片、Tab、输入框、按钮、提示信息视觉升级 |
| 3 | `src/components/Header.tsx` | **可选微调** | 极小（~3 行） | login variant 的 Header 样式微调（间距、颜色） |

**总计：3 个文件（全部为修改），约 70 行 className 改动。**

### 11.2 可选新增文件

| # | 文件 | 说明 | 建议 |
|---|------|------|:--:|
| 4 | `src/components/OtpInputGroup.tsx` | 将 6 位验证码输入框逻辑抽取为独立组件 | **不建议在 V2.2B 中抽取**——当前单 `<input>` 实现已足够简洁，抽取组件增加不必要的复杂度 |

**V2.2B 不建议新增任何文件。** 所有改动集中在现有文件的 className 调整。

### 11.3 谨慎项

| # | 文件 | 操作 | 约束 |
|---|------|:---:|------|
| 5 | `src/components/SetPasswordPrompt.tsx` | 可选样式微调 | **仅改 className，禁止改逻辑**。不改 `isOpen`/`onClose`/`onSetPassword`/`onSkip`。如涉及，必须在 Execution Plan 中明确标注 |

### 11.4 明确禁止修改

| # | 禁止修改 | 原因 |
|---|---------|------|
| 1 | `src/hooks/useAuth.ts` | Auth 逻辑层 |
| 2 | `src/app/api/*` | 全部 API Route |
| 3 | `src/lib/*` | 全部 lib（types.ts / constants.ts / ai-client.ts / supabase-*.ts / device-id.ts 等） |
| 4 | `src/prompts/*` | AI prompts |
| 5 | `src/components/AuthModal.tsx` | 弹窗登录组件，不属于 V2.2B |
| 6 | `src/components/MainWorkspace.tsx` | 属于 `/app`，不属于 V2.2B |
| 7 | `src/components/GoalInput.tsx` | 属于 `/app` |
| 8 | `src/components/TaskList.tsx` | 属于 `/app` |
| 9 | `src/components/StatsBar.tsx` | 属于 `/app` |
| 10 | `src/components/HistoryPanel.tsx` | 属于 `/app` |
| 11 | `src/components/TaskReviewPanel.tsx` | 属于 `/app` |
| 12 | `src/app/app/page.tsx` | 属于 `/app` |
| 13 | `src/app/page.tsx` | Landing Page，不属于 V2.2B |
| 14 | `package.json` | 无新依赖 |
| 15 | 数据库 schema / migration | 零变更 |
| 16 | `.env.local` | 无新环境变量 |
| 17 | `tailwind.config.ts` | V2.2B 只用现有 Tailwind class |
| 18 | `src/app/globals.css` | 尽量不改，除非确实需要新增 1-2 个 CSS 自定义属性（需在执行方案中单独说明理由） |

---

## 十二、不做事项

### 12.1 产品层面不做

| # | 不做 | 原因 |
|---|------|------|
| 1 | 不做忘记密码 | 属于 V2.3 安全增强 |
| 2 | 不做 Turnstile 人机验证 | 属于 V2.3 安全增强 |
| 3 | 不做第三方登录（Google/GitHub/微信） | 属于 V2.3 或之后 |
| 4 | 不做手机验证码登录 | 需 SMS 服务商，成本高 |
| 5 | 不做注册/登录分离页面 | 当前 OTP 自动注册已覆盖注册场景 |
| 6 | 不做使用条款/隐私政策页面 | 后续版本考虑 |

### 12.2 技术层面不做

| # | 不做 | 原因 |
|---|------|------|
| 1 | 不改 Auth 逻辑 | useAuth / sendOtp / verifyOtp / signInWithPassword 全部不动 |
| 2 | 不改验证码发送逻辑 | Supabase `signInWithOtp` 调用不动 |
| 3 | 不改验证码验证逻辑 | Supabase `verifyOtp` 调用不动 |
| 4 | 不改密码登录逻辑 | Supabase `signInWithPassword` 调用不动 |
| 5 | 不改 useAuth | Hook 接口不动 |
| 6 | 不改 AuthModal | 弹窗登录组件零改动 |
| 7 | 不改 API | 零 API Route 变更 |
| 8 | 不改数据库 | 零 schema / migration 变更 |
| 9 | 不新增 npm 依赖 | package.json 不动 |
| 10 | 不引入 UI 组件库 | 不引入 shadcn/ui、Radix、Headless UI 等 |
| 11 | 不引入动画库 | 不引入 framer-motion、GSAP 等 |

### 12.3 范围层面不做

| # | 不做 | 原因 |
|---|------|------|
| 1 | 不做 `/app` 美化 | 属于 V2.2C |
| 2 | 不做 Landing Page 美化 | 属于 V2.2C |
| 3 | 不做移动端专项优化 | 属于 V2.2D（但 V2.2B 本身移动端优先） |
| 4 | 不做 AI 辅助执行入口 | 属于 V2.4+ |
| 5 | 不做任务卡片 AI 帮助按钮 | 属于 V2.4+ |
| 6 | 不做 TaskAssistPanel | 属于 V2.4+ |
| 7 | 不做 Header app variant 美化 | 属于 V2.2C |
| 8 | 不做 AuthModal 美化 | AuthModal 将在 V2.2B 之后单独评估（或在 V2.2C 中随整体 UI 统一） |

---

## 十三、风险分析

### 13.1 风险矩阵

| # | 风险 | 等级 | 影响 | 缓解措施 |
|---|------|:---:|------|---------|
| 1 | **登录流程被 UI 改动破坏** | **P1** | className 改动意外影响 onClick/handler，导致 OTP 发送失败、密码登录失败、登录后不跳转 | **只改 className，不改任何 JS 逻辑。** Review 时用 `git diff` 逐文件确认：LoginPageContent.tsx 中所有 `onClick`/`onChange`/`onSubmit`/`useEffect` 不变 |
| 2 | **验证码自动提交失效** | **P1** | 改动 `handleTokenChange` 或 `useEffect` 导致满 6 位后不自动验证 | `handleTokenChange` 和 `useEffect`（token.length === 6）一行不改。Review 时确认 |
| 3 | **密码登录按钮状态错误** | **P1** | disabled/loading 态视觉改动导致按钮在错误状态下可点击 | `disabled={isSubmitting}` 属性不改。仅改 disabled 态的 className（颜色、阴影） |
| 4 | **已登录访问 `/login` 跳转 `/app` 回归** | **P1** | 改动 login/page.tsx 或 LoginPageContent 的路由守卫导致循环跳转 | `useEffect` 中 `if (user && !isLoading) router.replace("/app")` 一行不改。Review 时确认 |
| 5 | **未登录访问 `/login` 不显示表单** | **P1** | `isLoading` 或 `user` 条件渲染改动导致表单不渲染 | `if (isLoading \|\| user) return null` 一行不改 |
| 6 | **登录成功后没有进入 `/app`** | **P1** | `router.replace("/app")` 被误删或改动 | 两处 `router.replace("/app")`（OTP 验证成功、密码登录成功）不改 |
| 7 | **移动端键盘遮挡** | **P2** | 改动了页面高度或 overflow 导致键盘弹起后表单不可见 | 页面容器保持 `overflow-auto`。如改为 `h-screen` + `overflow-hidden` 会导致键盘弹起后无法滚动 |
| 8 | **Header login variant 被误改** | **P2** | Header 改动影响 landing 或 app variant | Header 中 `if (resolvedVariant === "login")` 分支只改 className，不改结构、不改 Link href |
| 9 | **误改 AuthModal 或 useAuth** | **P1** | 改动范围控制不严，蔓延到禁止文件 | 严格执行 §11.4 禁止修改清单。Review 时 `git diff --stat` 确认仅允许文件有变更 |
| 10 | **提前引入 V2.4 AI 辅助执行内容** | **P2** | 在 LoginPageContent 或 Header 中加入 AI 辅助入口 | LoginPageContent 和 Header login variant 中不加任何 AI 辅助相关 UI。Review 时确认 |

### 13.2 风险等级说明

| 等级 | 含义 |
|:---:|------|
| **P1** | 影响核心登录流程，必须在 Review 中逐项确认 |
| **P2** | 影响体验但不阻塞登录，验收时检查 |

---

## 十四、验收标准

### 14.1 视觉验收

| # | 验收项 | 预期结果 |
|---|--------|---------|
| V1 | `/login` 页面视觉明显提升 | 卡片、输入框、按钮、Tab 比 V2.2A 更精致、更有产品感 |
| V2 | 页面背景为柔和蓝紫渐变 | 与 Landing（`bg-[#F8FAFF]`）和 App（`from-indigo-50 via-white to-sky-50`）同色系但视觉独立 |
| V3 | 登录卡片有分离感 | 白色卡片浮于背景之上，阴影和边框层次清晰 |
| V4 | Tab 选中态对比度增强 | 选中 Tab 白色背景 + indigo 文字 + 轻量阴影，未选中 Tab 淡灰文字 |
| V5 | 输入框 focus 态有明显反馈 | indigo 边框 + 微透明 ring，过渡平滑 |
| V6 | 输入框 error 态有明显反馈 | red 边框 + 微透明 red ring |
| V7 | 主按钮 disabled 态清晰 | 灰色渐变 + 无阴影 + 不可点击 |
| V8 | 成功提示为翠绿色调 | emerald-50 背景 + emerald-100 边框 + emerald-700 文字 |
| V9 | 错误提示为温和红色调 | red-50 背景 + red-100 边框 + red-700 文字 |
| V10 | 底部辅助文案显示 | "登录后即可同步你的任务记录与行动数据"（text-xs text-slate-400，无链接） |

### 14.2 功能回归验收

| # | 验收项 | 预期结果 |
|---|--------|---------|
| F1 | 验证码登录正常 | 输入邮箱 → 发送验证码 → 输入 6 位码 → 自动验证 → 登录成功 → 跳转 `/app` |
| F2 | 密码登录正常 | 切换到密码 Tab → 输入邮箱+密码 → 登录成功 → 跳转 `/app` |
| F3 | 已登录访问 `/login` 自动跳转 `/app` | 不显示登录表单，直接跳转 |
| F4 | 未登录访问 `/login` 显示登录页 | 表单正常显示，不跳转 |
| F5 | 发送验证码正常 | 点击发送 → API 调用成功 → 收到邮件 |
| F6 | 重新发送倒计时正常 | 发送后显示 60 秒倒计时，倒计时结束后显示"重新发送" |
| F7 | 6 位验证码自动验证正常 | 输入第 6 位数字后自动调用 `handleVerifyOtp` |
| F8 | 错误提示正常 | 空邮箱、错误验证码、错误密码分别显示对应的中文提示 |
| F9 | 邮箱保留正常 | 从 OTP Tab 切换到密码 Tab，邮箱不清空 |
| F10 | 密码显示/隐藏正常 | 点击切换按钮，密码可见性切换 |
| F11 | 登录成功后 `/app` SetPasswordPrompt 正常 | 登录后进入 `/app`，Header 检测到 `password_set !== true` 弹出引导 |
| F12 | Header 返回首页正常 | 点击"返回首页"链接 → 跳转 `/`（未登录）/ 跳转 `/app`（已登录） |

### 14.3 兼容验收

| # | 验收项 | 预期结果 |
|---|--------|---------|
| C1 | AuthModal 不受影响 | `/app` 内点击登录按钮，AuthModal 弹窗正常，与 V2.2A 体验一致 |
| C2 | `/app` 不受影响 | 主工作台所有功能正常（任务生成、勾选、统计、历史、复盘） |
| C3 | Landing Page 不受影响 | `/` 页面视觉和功能不变 |
| C4 | V2.4 AI 辅助执行路线不受影响 | 未在登录页引入任何 AI 辅助 UI |
| C5 | 手机端布局不溢出 | 375px 宽度无横向滚动条 |
| C6 | 键盘弹出后仍可操作 | 输入框和按钮在键盘弹起后可触达 |

### 14.4 门禁验收

| # | 验收项 | 命令/预期 |
|---|--------|---------|
| G1 | lint 通过 | `npm run lint` 零 error |
| G2 | build 通过 | `npm run build` 成功 |
| G3 | git status 只出现允许文件 | `git status --short` 仅显示：`src/app/login/page.tsx`、`src/components/LoginPageContent.tsx`、`src/components/Header.tsx`（可选） |

---

## 十五、后续执行建议

### 15.1 标准工作流

```
本文档（Architecture-V2.2B-Login.md）
    │
    ├── 1. ChatGPT 审查本文档
    │      - 确认视觉方向、文件范围、风险缓解
    │      - 如有调整，修改本文档
    │
    ├── 2. Claude Code 写 docs/Execution-Plan-V2.2B-Login.md
    │      - 基于本文档的 §三~§九 设计方向
    │      - 精确到每个文件的每一处 className 改动
    │      - 给 Codex 的逐步实现指令
    │
    ├── 3. ChatGPT 审查 Execution Plan
    │
    ├── 4. Codex 按执行方案实现
    │      - 仅改允许文件清单中的文件
    │      - 只改 className，不改任何 JS 逻辑
    │
    ├── 5. Claude Code Code Review
    │      - git diff 逐文件确认：只改 className
    │      - 确认 onClick / onChange / useEffect 全部不变
    │
    ├── 6. ChatGPT 最终把关 → 提交 V2.2B
    │
    └── 7. V2.2B 上线后 → 进入 V2.2C
```

### 15.2 执行方案要求

Execution Plan 必须：
- **精确到每个 className 的旧值和新值**
- **明确标注"不改"的部分**（所有 JS 逻辑）
- **给出修改前后对比**（ClassName diff）
- **不允许 Codex 自行扩大到 `/app` 美化**
- **不允许 Codex 提前实现 AI 辅助执行**
- **不允许 Codex 修改禁止文件清单中的任何文件**

### 15.3 和 V2.2C 的衔接

V2.2B 建立的视觉方向（卡片风格、输入框规格、色彩体系、字体层级）将作为 V2.2C 主工作台 UI 美化的**风格参考**。V2.2C 的 Architecture 文档应引用本文档的 §三（设计方向）作为风格基调来源。

---

> **文档结束**
>
> **下一文档**：本文档经 ChatGPT 审查通过后 → `docs/Execution-Plan-V2.2B-Login.md`（V2.2B 登录/注册页高级感设计 执行方案）
>
> **关联文档**：
> - [Roadmap-V2.2-UI-Upgrade.md](Roadmap-V2.2-UI-Upgrade.md) — V2.2 UI 升级总规划
> - [Architecture-V2.2A-Routing.md](Architecture-V2.2A-Routing.md) — V2.2A 路由架构（✅ 已完成）
> - [Execution-Plan-V2.2A-Routing.md](Execution-Plan-V2.2A-Routing.md) — V2.2A 执行方案（✅ 已完成）
> - [Roadmap-V2.1-V2.3.md](Roadmap-V2.1-V2.3.md) — V2.1-V2.3 路线图
> - [Roadmap-AI-Assisted-Execution.md](Roadmap-AI-Assisted-Execution.md) — AI 辅助执行路线总稿（V2.4+）
> - [PROJECT-CONTEXT.md](PROJECT-CONTEXT.md) — 项目长期上下文
> - [PROJECT-INDEX.md](PROJECT-INDEX.md) — 项目文件索引
