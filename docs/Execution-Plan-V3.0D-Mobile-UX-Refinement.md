# V3.0D 执行方案：手机端核心体验修正

> **状态：** 等待 ChatGPT 审查；本文件不是 Codex 代码施工授权。
>
> **文档编写基线：** `88e40b8b0818449b812d26cb866b74e3b97fde41` — `docs: add V3.0D mobile UX architecture`
>
> **架构依据：** [Architecture-V3.0D-Mobile-UX-Refinement.md](Architecture-V3.0D-Mobile-UX-Refinement.md)
>
> **严格顺序：** D1 → 独立 Review / 验收 / ChatGPT 批准 / 精确提交 → D2 → 同样门禁 → D3 → 同样门禁 → D4。

---

## 1. 文档目的

本方案把已批准的 V3.0D Architecture 落为可交给 Codex 实施、可由 Claude Code 审查的文件级步骤。它不重做架构选择，不开放“顺带优化”，也不授权本轮写代码。

V3.0D 只修正五项手机端前端体验：Welcome 单屏、OTP Mock 的双状态视觉流程、任务总览的后续任务入口、行动清单二级页、任务执行 default 态的高度重分配。

不进入 V3.1-A：不接 Supabase、SMTP、真实 OTP、Session、真实 auth facade、首次设置密码、真实密码登录改造或任何后端/数据库/API Route 工作。

## 2. 当前基线与依赖

### 2.1 Git 前置条件与四层基线

**文档编写基线**固定为 `88e40b8b0818449b812d26cb866b74e3b97fde41`。它只表示编写本 Execution Plan 时的项目状态，绝不是 D1 施工基线；不得在任何 D1–D3 施工指令中将其写作当批 HEAD。

每个施工批次开始前均执行：

```powershell
cd C:\Dev\ai-todo
git branch --show-current
git rev-parse HEAD
git rev-parse origin/main
git status --short --untracked-files=all
git diff --name-only
git diff --cached --name-only
git diff --check
```

每批必须先由 ChatGPT 指令提供并核对该批准确 SHA。确认 `branch = main`、`HEAD = origin/main`、tracked 工作区干净、staged 为空，且 SHA 正确后，才执行：

```powershell
$D_BASE_HEAD = git rev-parse HEAD
```

`$D_BASE_HEAD` 只代表**当前批次**的实际施工基线；D1、D2、D3 各自重新设置，绝不跨批复用。

| 层级 | 实际施工基线 | 开工门槛 | SHA 来源 |
|---|---|---|---|
| 文档编写 | `88e40b8b0818449b812d26cb866b74e3b97fde41` | 仅说明本文件编写时的状态 | 已知 Architecture 提交 |
| D1 | 本 Execution Plan 经 ChatGPT 批准、独立提交并 Push 后的 HEAD | HEAD = origin/main、tracked clean、staged empty；HEAD 必须已含 V3.0D Architecture 与本 Execution Plan | ChatGPT 的 D1 Codex 指令；本文件不得猜测 SHA |
| D2 | D1 经 Review、验收、提交并 Push 后的 HEAD | HEAD = origin/main、tracked clean、staged empty | ChatGPT 的 D2 指令 |
| D3 | D2 经 Review、验收、提交并 Push 后的 HEAD | HEAD = origin/main、tracked clean、staged empty | ChatGPT 的 D3 指令 |

允许但绝不处理的长期未跟踪项：`.agents/`、`.claude/`、`.codex/`、`.vscode/`、`skills-lock.json`、`start`、`stop`、`test_photo.jpeg`。

任何额外 tracked diff、暂存内容、与当批 ChatGPT 指令不符的 SHA 或越界文件：立即停止，报告 ChatGPT；不得 reset、restore、stash、checkout、clean、删除或移动文件。

### 2.2 已核实的依赖事实

- 页面是单页状态机：[app/page.tsx](../apps/mobile-app/app/page.tsx)。`HomeContent` 已拥有 `authState`、`authScreen`、`activeTab`、`todayMode`、`todayState`、`executingTaskId`。
- `TodayMode` 当前为 `"home" | "tasks" | "execution"`，D2 只增加 `"action-list"`。
- Back API 是 `useBackController()`，通过 `backController.register({ id, priority, handle })` 注册，并在 effect cleanup 中 `backController.unregister(id)`。`handle` 返回 `boolean`。
- [BackControllerContext.tsx](../apps/mobile-app/contexts/BackControllerContext.tsx) 内的 `WebHistoryGuard` 是唯一 `popstate` / `pageshow` 所有者；D1–D3 不修改它，也不新增任何 History API 调用或监听。
- [AuthShell.tsx](../apps/mobile-app/components/auth/AuthShell.tsx) 已提供 `h-[100svh] overflow-hidden` 外壳及 `min-h-0 flex-1 overflow-y-auto overscroll-y-contain` 内层滚动安全兜底。
- [AppShell.tsx](../apps/mobile-app/components/shell/AppShell.tsx) 已提供唯一已登录壳和 BottomTabBar；D2 新页面只作为它的 children，不能再渲染 AppShell 或 BottomTabBar。
- 当前 C4 已确认的主视觉资产是 `apps/mobile-app/public/icons/icon-512.png`，浏览器 public URL 为 `/icons/icon-512.png`。该 PNG 是带圆角暖纸底的小径与嫩芽；D1 只读复用，不能改图、生成图或增加资产。
- `PaperCard` 只接受 `variant: "white" | "warm" | "yellow"`、`padding: "normal" | "large" | "compact"` 和 `className`；没有 click prop。可点击卡必须以原生 `button` 作为卡内唯一交互承载，避免嵌套 button。
- `PrimaryButton` 与 `SecondaryButton` 均透传原生 ButtonHTMLAttributes，默认 `type="button"`，支持 `className`、`disabled`、`onClick`；仅 PrimaryButton 支持 `loading` / `loadingText`。
- `TextInput` 是 `<input>` 包装，不适合 OTP 的“单逻辑 input + 六视觉格”形态；D1 在 OtpLoginPage 中直接使用一个原生 `<input>`。
- `Task` 字段严格为 `id`、`title`、可选 `details?: string[]`、可选 `estimatedMinutes?: number`、`status`；`TaskStatus` 只包含 `current | locked | completed`。
- C3 已锁定：TaskExecutionView 的三枚举、GuideCard / FeedbackBox / textarea 单 DOM 实例、`task-feedback-focus / 95`、`task-guide-focus / 94`、120px visualViewport 阈值和局部 CSS 变量均不可改写。

### 2.3 Architecture 已锁定的批次边界

| 批次 | 目的 | 唯一允许代码文件 |
|---|---|---|
| D1 | Welcome 单屏 + OTP Mock 双状态 | `components/auth/WelcomePage.tsx`、`components/auth/OtpLoginPage.tsx` |
| D2 | 任务总览 + 行动清单二级页 | `components/today/TaskListView.tsx`、新增 `components/today/ActionListView.tsx`、`app/page.tsx` |
| D3 | 执行页 default 态布局与 compact | `components/today/TaskExecutionView.tsx`、`components/today/ExecutionTaskCard.tsx` |
| D4 | 全量 Review、构建与真机验收 | 默认零代码文件 |

Architecture 已独立提交，不混入任何 D1–D3 代码提交。D1、D2、D3 绝不一次性交给 Codex；每一批必须独立实现、独立 Review、独立 lint/build、独立范围检查、经过 ChatGPT 判断和必要的用户验收后，才可进入下一批。

## 3. 总体施工纪律

### 3.1 必须只读

- `components/auth/AuthShell.tsx`、`PasswordLoginPage.tsx`、`RegisterPage.tsx`
- `components/shell/AppShell.tsx`、`BottomTabBar.tsx`
- `contexts/BackControllerContext.tsx`
- `components/today/CurrentTaskCard.tsx`、`UpcomingTaskList.tsx`、`TaskProgressCard.tsx`、`ExecutionGuideCard.tsx`、`ExecutionFeedbackBox.tsx`（其中 `TaskProgressCard` 仅允许由 D2 的 ActionListView 按 §10.1.1 原接口复用；其源码、Props 和进度语义均不得修改）
- 所有 `components/ui/**`、`components/icons/**`、`services/**`、`types/**`
- `app/globals.css`、`app/layout.tsx`、`app/manifest.ts`、全部 `public/**`

### 3.2 绝对禁止

`src/**`、API Route、Supabase、数据库、migration、prompts、根配置、package/lockfile、Service Worker、Capacitor、新路由、第二 AppShell、第二 BottomTabBar、聊天 UI/历史/气泡/Tab、真实 Auth、修改 C4 图标。

不允许添加 `popstate`、`pageshow`、`history.back()`、`router.back()`、第二个验证码页面路由、六个独立 OTP input、Todo checkbox、任务状态编辑、或全局 DOM/全局 CSS 方案。

### 3.3 通用验证、合并范围核验与停止条件

每批代码完成后、Review 前执行：

```powershell
npm --prefix apps/mobile-app run lint
npm --prefix apps/mobile-app run build
git diff --check
git status --short --untracked-files=all

$D_TRACKED_CHANGED = @(
  git diff --name-only $D_BASE_HEAD -- apps/mobile-app
)

$D_UNTRACKED_CHANGED = @(
  git ls-files --others --exclude-standard -- apps/mobile-app
)

$D_CHANGED = @(
  $D_TRACKED_CHANGED
  $D_UNTRACKED_CHANGED
) | Where-Object { $_ } | Sort-Object -Unique

$D_CHANGED
```

- `git status` 负责显示工作区状态；`$D_CHANGED` 才负责与当批允许集合严格比较。普通 `git diff` 与 `git diff --check` 都不能单独证明未跟踪新文件安全。
- 每批必须将 `$D_CHANGED` 与本批允许文件**集合**精确比对；顺序不作为判断条件。D1/D3 即使预期没有新文件，也必须运行同一合并核验，以阻断私自创建的额外文件。
- 新文件尚未暂存时，普通 `git diff --check` 不会检查它。任何新增文件都需额外以 `git diff --no-index --check -- NUL <新文件路径>` 检查空白，并以 `git diff --no-index -- NUL <新文件路径>` 只读审查完整内容。`--no-index` 比较 NUL 与新文件的差异返回状态属于预期；只要输出出现 `trailing whitespace`、`space before tab` 或 `whitespace error`，即停止。
- Review 前 staged 必须保持为空。不得为让普通 diff 显示新文件而执行 `git add`、`git add -N` 或任何暂存操作。

任一 lint/build/TypeScript 失败、`git diff --check` 报错、额外未跟踪文件、`$D_CHANGED` 与允许集合不一致、或新文件 no-index 空白检查报错：停止；不得借机改只读文件，也不得处理其他工作区项目。

---

# D1：Welcome 单屏 + OTP Mock 双状态

## 4. D1 目标、文件范围与顺序

### 4.1 目标

把 Welcome 从网页式长 Landing Page 改为单屏 App Welcome Screen；把现有“输入邮箱后直接登录”的 Mock 改为同一 OtpLoginPage 内的 email-entry → code-entry 两视觉状态。该流程只用于前端体验，必须诚实说明不发送真实邮件。

### 4.2 D1 唯一允许文件

1. `apps/mobile-app/components/auth/WelcomePage.tsx`
2. `apps/mobile-app/components/auth/OtpLoginPage.tsx`

禁止改 `app/page.tsx`、AuthShell、PasswordLoginPage、RegisterPage、BackControllerContext、services、types、public 及其他组件。

### 4.3 修改顺序

1. 先改 WelcomePage，保留其现有 `onNavigate: (screen: AuthScreen) => void` 接口不变。
2. 再改 OtpLoginPage，保留 `onNavigate` 与 `onLoginSuccess: () => void` 接口不变。
3. 只在两个文件 diff 中完成 lint/build/范围审查；D1 不触及 page.tsx。

## 5. D1-A：WelcomePage.tsx 文件级施工

### 5.1 删除的当前区域

从 [WelcomePage.tsx](../apps/mobile-app/components/auth/WelcomePage.tsx) 删除：

- 顶部右侧“登录” button；登录入口仅保留在底部“已有账号，去登录”。
- 模拟任务展示 PaperCard，包括“行动中”标签、占位条、“今天的一小步”文案和所有模拟任务内容。
- `IconPaperPlane` 作为主视觉的区域及其 import。
- 网页式“今天从一句话开始”提示及造成长页面的 `min-h-screen` / `min-h-[calc(100vh-3.5rem)]` 高度策略。

`IconStar` 可以作为轻量装饰保留，但不可替代小径与嫩芽主视觉。

### 5.2 保留的接口、品牌与按钮

- 保留 `WelcomePageProps` 和 `onNavigate` 签名，不能修改 page.tsx 调用方式。
- “开始使用”与“已有账号，去登录”均继续调用 `onNavigate("otp-login")`。
- 保持现有暖米白、深蓝、PaperCard 圆角/阴影 token、PrimaryButton、SecondaryButton，不重做设计 token。
- 顶部只显示“清行”；不能新增顶部登录按钮、设置入口或第三个 CTA。

### 5.3 锁定的最终内容顺序

```text
main（h-full，flex，min-h-0，flex-col）
├─ 顶部品牌区（shrink-0）
│  └─ 清行
├─ 中间品牌区（min-h-0 flex-1，flex，flex-col，justify-center）
│  ├─ 今天，也从一小步开始
│  ├─ <img src="/icons/icon-512.png"> 小径与嫩芽主视觉
│  ├─ 慢一点，也在向前走
│  └─ 不用完整计划，先写下今天想推进的事。
└─ 底部操作区（shrink-0）
   ├─ 开始使用
   └─ 已有账号，去登录
```

推荐最外层 class 组合为 `h-full min-h-0 bg-warm-bg px-6 py-7`，内部保持 `mx-auto flex h-full min-h-0 max-w-mobile flex-col`；中间品牌区使用 `min-h-0 flex-1`。不得再使用 `min-h-screen` 或基于 `100vh` 的最小高度。

底部 footer 使用 `shrink-0 space-y-3 pb-safe-bottom`，按钮保持自身 `min-h-touch`。顶部和 footer 都不参与压缩；中间品牌区承担可用高度。375×812 下先确保底部两个按钮完整可见，不能以不可读的小字号换空间。AuthShell 的内层滚动仅为异常/键盘安全兜底，正常竖屏不得依赖滚动完成 Welcome。

### 5.4 主视觉的精确实现

- **资产：** 只读 `apps/mobile-app/public/icons/icon-512.png`。
- **页面 URL：** 精确使用 `src="/icons/icon-512.png"`。
- **元素：** 使用原生 `<img>`，不引入 `next/image`；该公共静态资产不需要 Next Image 的尺寸/配置决策。
- **尺寸：** 推荐 class `mx-auto h-auto w-[min(58vw,280px)]`；在 375px 宽度约为 218px，在 430px 宽度不超过 249px，保持标题与按钮空间。
- **适配：** `object-contain`，`alt="一条通向嫩芽的小径"`。
- **圆角：** 不额外加容器圆角或裁切；图像本身已经含圆角纸张视觉。可保持轻微阴影/留白，但不得把它包回模拟任务 PaperCard。
- 不修改图片、不生成新图片、不继续使用纸飞机作为 Welcome 主视觉。

## 6. D1-B：OtpLoginPage.tsx 文件级施工

### 6.1 保留接口与移除真实 Mock service 调用

保留：

```ts
interface OtpLoginPageProps {
  onNavigate: (screen: AuthScreen) => void;
  onLoginSuccess: () => void;
}
```

删除 `loginWithOtp` 的 import 与调用。D1 不调用任何 service，包括 `authService.mock.ts`。不显示“验证码已发送”“发送成功”或“验证码已发送到某邮箱”。不接 Supabase、SMTP、API、真实 Session，不自动注册，不引导设置密码。

### 6.2 本地状态与 refs

在 OtpLoginPage 内定义，且不提升到 page.tsx：

```ts
type OtpStep = "email-entry" | "code-entry";

const [otpStep, setOtpStep] = useState<OtpStep>("email-entry");
const [email, setEmail] = useState("");
const [emailError, setEmailError] = useState("");
const [formError, setFormError] = useState("");
const [verificationCode, setVerificationCode] = useState("");
const [resendTimer, setResendTimer] = useState(0);
const [isSending, setIsSending] = useState(false);
const [isCodeInputFocused, setIsCodeInputFocused] = useState(false);
const codeInputRef = useRef<HTMLInputElement | null>(null);
const sendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

`isCodeInputFocused` 仅服务视觉焦点格；不创建第二个逻辑验证码状态。若实现选择对验证按钮显示短暂 loading，必须只在 OtpLoginPage 增加最小 `isVerifying` 状态，不能增加任何 service 调用；但默认方案是验证点击直接调用 `onLoginSuccess()`，无需额外状态。

### 6.3 email-entry → code-entry

保留当前 `validateEmail(email)` 函数和当前 email TextInput 的 `autoComplete="email"`、`inputMode="email"`、`IconMail` 用法。

提交顺序严格为：

1. `event.preventDefault()`，调用 `validateEmail(email)`。
2. 设置 `emailError`、清空 `formError`；无效时返回。
3. 有效时设置 `isSending=true`。该按钮显示视觉过渡，例如 `loadingText="正在准备验证码..."`；文字不能暗示邮件真的已发送。
4. 清理旧 `sendTimeoutRef` 后，使用仅用于前端过渡的短 timeout（建议 250ms）进入 code-entry：`setOtpStep("code-entry")`、`setVerificationCode("")`、`setResendTimer(60)`、`setIsSending(false)`。
5. timeout/组件 unmount 时对称 `clearTimeout`，避免卸载后 setState。

进入 code-entry 时 email 保留、错误清空；邮箱 TextInput 不保留 DOM。D1 不把 code-entry 分拆成路由或新页面。

### 6.4 code-entry 内容、导航结构与诚实文案

`OtpLoginPage` 始终在同一 AuthShell 中以 `otpStep` 切换以下两种结构；不分拆为路由或新页面。

**email-entry 只显示：**

- 清行品牌；
- “验证码登录 / 密码登录”登录方式 Tab；
- 邮箱输入；
- “发送验证码”；
- 注册入口。

**code-entry 只显示：**

- 清行品牌与现有星形轻装饰；
- 标题：`继续输入验证码`；
- 次要诚实说明（`text-xs text-text-tertiary`）：

  ```text
  当前是前端体验流程，暂时不会发送真实邮件。
  输入任意 6 位数字即可继续体验。
  ```

- 脱敏邮箱与固定标签“演示邮箱”；不得出现“验证码已发送到”；
- 一个逻辑 input + 六个视觉数字格；
- PrimaryButton：`验证并进入清行`；
- “重新发送（XX 秒）”；
- “更换邮箱”。

登录方式 Tab **只在 email-entry 显示**。code-entry 不显示验证码登录 / 密码登录 Tab、密码登录入口、注册入口、原邮箱输入框或任何其他第三入口。用户要改用密码登录时，必须先通过“更换邮箱”或系统返回回到 email-entry，再点击密码登录 Tab；不允许 code-entry 直接跳到 PasswordLoginPage。“更换邮箱”是页面内唯一回到 email-entry 的动作，系统返回则由 `otp-code-entry / 65` 走同一个 `returnToEmailEntry` 路径。

### 6.5 单逻辑 input 与六视觉格

不得使用 TextInput，必须只渲染一个稳定的原生 `<input>`：

```tsx
<div className="relative" onClick={() => codeInputRef.current?.focus()}>
  <input
    ref={codeInputRef}
    aria-label="6 位验证码"
    autoComplete="one-time-code"
    inputMode="numeric"
    maxLength={6}
    type="text"
    value={verificationCode}
    className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
    onChange={...}
    onFocus={() => setIsCodeInputFocused(true)}
    onBlur={() => setIsCodeInputFocused(false)}
  />
  {/* pointer-events-none 的六格视觉层 */}
</div>
```

- 容器本身和透明 input 都是同一个输入目标；点击任一视觉格可聚焦 input，视觉层加 `pointer-events-none`。
- `onChange` 必须使用 `value.replace(/\D/g, "").slice(0, 6)`；粘贴也自然复用该路径。
- 六格按 index `0..5` 从 `verificationCode[index] ?? ""` 映射；当前焦点格是 `isCodeInputFocused && verificationCode.length === index`，满六位时最后一格保留 active 边框。视觉格 `aria-hidden="true"`，语义由真实 input 的 aria-label 提供。
- 每格至少 44px 高，保持暖白底、纸张边框和深蓝 focus 边框；不能显示六个可编辑 input，不能用 key 让 input 重挂载。
- 不自动提交。`verificationCode.length !== 6` 时 PrimaryButton disabled；等于 6 时才可点击。

### 6.6 验证、邮箱脱敏与倒计时

**验证：** 点击“验证并进入清行”时再次确认 `/^\d{6}$/`；不足六位只保持 disabled。完整六位时清 `formError` 并直接调用现有 `onLoginSuccess()`。D1 不校验真实 code，不写成功消息，不自动完成任何密码设置或注册。

**脱敏函数（在文件内纯函数）：**

```ts
function maskDemoEmail(value: string): string {
  const trimmed = value.trim();
  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0 || atIndex !== trimmed.lastIndexOf("@") || atIndex === trimmed.length - 1) {
    return "你的演示邮箱";
  }

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  if (!domain) return "你的演示邮箱";
  if (local.length === 1) return `* @${domain}`.replace("* @", "*@");
  if (local.length === 2) return `${local[0]}*@${domain}`;
  return `${local[0]}${"*".repeat(Math.max(1, local.length - 2))}${local.at(-1)}@${domain}`;
}
```

实现可避免 `.at()` 兼容性顾虑而使用 `local[local.length - 1]`，但输出规则必须相同：普通 local part 显示首尾字符，中间以至少一个 `*` 替代；1 字符显示 `*@domain`；2 字符显示首字符加 `*`；异常输入回退“你的演示邮箱”。标签始终显示“演示邮箱”。

**倒计时：**

- 进入 code-entry 后 `resendTimer=60`。
- 用只在 `otpStep === "code-entry" && resendTimer > 0` 时生效的 useEffect 建立每秒 interval，函数式递减到 0。
- effect cleanup 必须 `clearInterval`；切到 email-entry、卸载或 Strict Mode 重挂均不残留 interval。
- `resendTimer > 0` 时重发 button disabled，文案 `重新发送（${resendTimer} 秒）`。
- 到 0 时文案为“重新发送”，可点击；点击只做前端 Mock 重发：清 `formError`、保留 email、保留 code、将 timer 重设 60。不得调用 service，亦不得声称真实发送。

**更换邮箱 / 返回 email-entry：** 统一由 `returnToEmailEntry` 完成：取消发送 timeout、`setIsSending(false)`、`setOtpStep("email-entry")`、`setVerificationCode("")`、`setResendTimer(0)`、清 `formError` 和 code 相关临时视觉状态；保留 `email`，保留合理的 email validation state（推荐清 `emailError` 使用户可继续编辑）。

### 6.7 D1 BackController

从 `@/contexts/BackControllerContext` 导入 `useBackController`。在 OtpLoginPage 中：

```ts
const backController = useBackController();

useEffect(() => {
  backController.register({
    id: "otp-code-entry",
    priority: 65,
    handle: () => {
      if (otpStep !== "code-entry") return false;
      returnToEmailEntry();
      return true;
    },
  });

  return () => backController.unregister("otp-code-entry");
}, [backController, otpStep, returnToEmailEntry]);
```

- priority 固定 `65`，高于 `page-auth-flow / 60`；不得调整 page.tsx 的 handler。
- `returnToEmailEntry` 用 `useCallback` 保持可作为 effect 依赖。
- Handler 只在 code-entry 消费；email-entry 返回 false，让现有 `page-auth-flow / 60` 完成 otp-login → welcome。
- 不新增 popstate/pageshow，不调用 `history.back()` 或 router API。

## 7. D1 验证、Review、验收、回退

### 7.1 范围检查

每次 D1 开工时先按 §2.1 核对 ChatGPT D1 指令提供的 SHA，再重新设置本批 `$D_BASE_HEAD`；不得使用文档编写基线或其他批次变量。

```powershell
$D1_ALLOWED = @(
  "apps/mobile-app/components/auth/OtpLoginPage.tsx",
  "apps/mobile-app/components/auth/WelcomePage.tsx"
) | Sort-Object

$D_TRACKED_CHANGED = @(
  git diff --name-only $D_BASE_HEAD -- apps/mobile-app
)

$D_UNTRACKED_CHANGED = @(
  git ls-files --others --exclude-standard -- apps/mobile-app
)

$D_CHANGED = @(
  $D_TRACKED_CHANGED
  $D_UNTRACKED_CHANGED
) | Where-Object { $_ } | Sort-Object -Unique

$D_CHANGED
```

`$D_CHANGED` 必须作为集合严格等于 `$D1_ALLOWED`。即使 D1 预期只修改既有文件，也必须合并检查未跟踪文件；不得仅凭普通 `git diff` 判断范围。D1 不允许新增文件；任一未跟踪 `apps/mobile-app/**` 文件、services/authService.mock、page.tsx、AuthShell、PasswordLoginPage、RegisterPage、BackControllerContext 或 public asset diff 均阻断。Review 前 staged 必须为空，不得使用 `git add` 或 `git add -N`。

### 7.2 Claude Code Review 清单

- [ ] Welcome 顶部仅“清行”，无顶部登录；底部只有两个指定入口。
- [ ] Welcome 无 `min-h-screen`，没有模拟任务大卡/纸飞机主视觉/网页式功能区。
- [ ] Welcome 原生 img URL 精确为 `/icons/icon-512.png`，无 C4 资产变更。
- [ ] 正常 375×812 不依赖 AuthShell 滚动，底部两个按钮可见。
- [ ] OtpLoginPage 不 import/call `loginWithOtp` 或其他 service。
- [ ] email-entry 只显示品牌、登录方式 Tab、邮箱输入、发送验证码和注册入口；code-entry 只显示锁定的品牌、验证码、Mock、演示邮箱、单逻辑 input/六格、验证、倒计时和更换邮箱内容，无 Tab、密码入口、注册入口、邮箱输入或第三入口。
- [ ] 登录方式 Tab 只在 email-entry 显示；code-entry 的“更换邮箱”和系统 Back 都复用 `returnToEmailEntry`，想改用密码登录必须先回 email-entry 再点击密码登录 Tab，绝不直接跳 PasswordLoginPage。
- [ ] 一个逻辑 input、六个纯视觉格、numeric/one-time-code/maxLength=6、无 key 重建、无六 input。
- [ ] 未满六位 disabled；完整后仅点击才 `onLoginSuccess`；无自动提交。
- [ ] 诚实 Mock 文案、演示邮箱标签、无真实发送声称。
- [ ] 60 秒倒计时与 timeout/interval/Back cleanup 对称。
- [ ] `otp-code-entry / 65` 依赖完整、卸载 unregister；无新的 history listener。

### 7.3 用户验收

375×812、390×844、430×932 下检查：Welcome 单屏、主视觉可辨、两按钮可触；email-entry 只含品牌、登录方式 Tab、邮箱输入、发送验证码、注册入口；email 校验；发送后进入只含锁定内容的 code-entry；code-entry 无登录方式 Tab、密码登录入口、注册入口、原邮箱输入或第三入口；数字键盘；点击视觉格聚焦；粘贴/输入过滤；六格显示；未满禁用；满六位点击才进入 app；重发倒计时及归零；更换邮箱回填；系统 Back：code-entry → email-entry → welcome；需要密码登录时必须先回 email-entry 再点击密码登录 Tab。Android Chrome 必测，iPhone Safari 可用时测。

### 7.4 D1 失败与回退

D1 任意问题停止在 D1；不得转入 D2。只有 ChatGPT 重新限定时才修。D1 经批准的回退范围仅为 WelcomePage 和 OtpLoginPage 的 D1 commit；不跨批回退。

---

# D2：任务总览 + 行动清单二级页面

## 8. D2 目标、文件范围与顺序

### 8.1 目标

移除 TaskListView 中被压缩的 UpcomingTaskList，改为轻量、可读的行动清单入口；在单页状态机里加入只读 ActionListView。用户可以阅读当前与后续小步，但不能提前开始、完成、排序或编辑任务。

### 8.2 D2 唯一允许文件

**修改：**

1. `apps/mobile-app/components/today/TaskListView.tsx`
2. `apps/mobile-app/app/page.tsx`

**新增：**

3. `apps/mobile-app/components/today/ActionListView.tsx`

禁止 CurrentTaskCard、UpcomingTaskList、TaskProgressCard、AppShell、BottomTabBar、BackControllerContext、types、services、TaskExecutionView。

### 8.3 修改顺序

1. 在 TaskListView 删除 UpcomingTaskList 使用、增加入口 prop 和入口卡。
2. 新建 ActionListView，在该文件内部定义 ActionListTaskCard。
3. 最后在 page.tsx 扩展 todayMode、连接入口/页面和 BackController。
4. 三文件独立验证与 Review，D2 不触及 D1/D3 文件。

## 9. D2-A：TaskListView.tsx 文件级施工

### 9.1 imports、props 与数据

- 删除 `UpcomingTaskList` import 和唯一渲染位置；不修改、不删除、不移动 `UpcomingTaskList.tsx`。
- 保留 `CurrentTaskCard`、`TaskProgressCard`、`IconBack`、`IconStar`、`PaperCard` imports。
- 扩展真实 props：

```ts
interface TaskListViewProps {
  todayState: TodayState;
  hint?: string;
  onBackHome: () => void;
  onStartTask: (taskId: string) => void;
  onCompleteTask: (taskId: string) => void;
  onLockedTaskClick: () => void;
  onOpenActionList: () => void;
}
```

`onOpenActionList` 是无参数回调。为避免在本批顺带重构既有 page 层状态，保留现有 `hint` 及其条件渲染。`onLockedTaskClick` 必须继续作为**兼容接口**保留在 `TaskListViewProps`，page.tsx 继续按当前方式传入；但删除 UpcomingTaskList 后，TaskListView 的函数参数解构必须精确只包含实际使用的 `todayState`、`hint`、`onBackHome`、`onStartTask`、`onCompleteTask`、`onOpenActionList`：

```ts
export function TaskListView({
  todayState,
  hint,
  onBackHome,
  onStartTask,
  onCompleteTask,
  onOpenActionList,
}: TaskListViewProps) { ... }
```

不得在函数参数解构中写入 `onLockedTaskClick`，不得创建未使用局部变量、不得命名为 `_onLockedTaskClick`，也不得调用该回调。接口清理不是 V3.0D 范围，后续如需移除此字段，必须作为独立维护任务处理；不得以此为理由修改 CurrentTaskCard、UpcomingTaskList 或 page.tsx 的既有 `onLockedTaskClick` 行为。

数据计算必须锁定为：

```ts
const currentTask = todayState.tasks.find((task) => task.status === "current");
const upcomingTasks = todayState.tasks.filter(
  (task) => task.status !== "completed" && task.status !== "current",
);
const remainingCount = upcomingTasks.length;
const allCompleted =
  todayState.totalCount > 0 && todayState.completedCount === todayState.totalCount;
```

这里的 `upcomingTasks` 保持 `todayState.tasks` 原顺序；不要仅写 `status === "locked"`，不要排序，不补造 current，不提升 locked，不改变 todayState。

### 9.2 行动清单入口卡

只在 `remainingCount > 0 && !allCompleted` 时渲染入口。N=0 和 allCompleted 均不渲染；数字来自真实 `upcomingTasks.length`，禁止硬编码或红点/数字徽章。

结构锁定为可点击的 `PaperCard variant="white" padding="compact"` 内单一 `<button type="button" onClick={onOpenActionList}>`，button 覆盖卡内全部内容、`w-full min-h-touch text-left`，不制造嵌套 button。PaperCard 本身不承担 click。

文案与层级：

- 眼眉/标题：`后面还有 ${remainingCount} 步`，深蓝 serif 或与现有标题同层级；
- 辅助：`现在不用一次看完，想知道接下来有什么时再打开。`，`text-sm leading-6 text-text-secondary`；
- 尾部文本箭头：`查看行动清单 →`，使用文字箭头而非新增 icon 资产；
- 暖白 `variant="white"`、浅边框、现有 shadow，视觉权重低于黄色 CurrentTaskCard。

不得像设置列表（不使用右侧 chevron 行结构、分割线列表或数字 badge），不得出现 checkbox，不抢 CurrentTaskCard 的主按钮。

### 9.3 高度与既有条件

TaskListView 外层保持 `flex h-full min-h-0 flex-col ... overflow-hidden`。header、TaskProgressCard、hint、CurrentTaskCard、入口卡、allCompleted 提示均为固定 `shrink-0` 区域；移除 `flex-1` 的 UpcomingTaskList 后不新增页面级滚动。

维持现有 currentTask 缺失时 CurrentTaskCard 不渲染、allCompleted 条件内容、hint 条件内容。375×812 下入口卡为完整纸张卡而非压扁横条；若固定区确实超出，不能擅自把 TaskListView 变为长滚动页，应停止并报告。

## 10. D2-B：ActionListView.tsx 新文件施工

### 10.1 唯一文件内组件与 imports

新建 `apps/mobile-app/components/today/ActionListView.tsx`。仅在本文件中定义：

```ts
interface ActionListViewProps {
  todayState: TodayState;
  onBack: () => void;
}

interface ActionListTaskCardProps {
  task: Task;
  variant: "yellow" | "white";
}

function ActionListTaskCard(...) { ... }
export function ActionListView(...) { ... }
```

从 `@/types/app` import `Task`、`TodayState`；从 `@/components/icons` import `IconBack`；从 `@/components/ui/PaperCard` import `PaperCard`；从同目录 import `TaskProgressCard`。不得创建 `ActionListTaskCard.tsx`，不接收任务变更/完成/提前开始回调，不导入 AppShell/BottomTabBar/services。

### 10.1.1 TaskProgressCard 的已核实接口与复用边界

以下 interface 来自当前只读的 `components/today/TaskProgressCard.tsx`，三个 Props 都是**必填**，组件和 Props 均**没有默认值**：

```ts
interface TaskProgressCardProps {
  goal: string;
  completedCount: number;
  totalCount: number;
}
```

当前 `TaskListView` 的准确 JSX 调用为：

```tsx
<TaskProgressCard
  goal={todayState.goal}
  completedCount={todayState.completedCount}
  totalCount={todayState.totalCount}
/>
```

`ActionListView` 必须按相同数据语义、使用相同的既有 `todayState` 字段复用同一个组件，准确调用同样锁定为：

```tsx
<TaskProgressCard
  goal={todayState.goal}
  completedCount={todayState.completedCount}
  totalCount={todayState.totalCount}
/>
```

逐 Prop 数据来源固定如下：

| TaskProgressCard Prop | 类型 / 必填 / 默认值 | TaskListView 来源 | ActionListView 来源 |
|---|---|---|---|
| `goal` | `string` / 必填 / 无默认值 | `todayState.goal` | `todayState.goal` |
| `completedCount` | `number` / 必填 / 无默认值 | `todayState.completedCount` | `todayState.completedCount` |
| `totalCount` | `number` / 必填 / 无默认值 | `todayState.totalCount` | `todayState.totalCount` |

强制边界：不修改 `TaskProgressCard.tsx`，不新增其 Props，不为 ActionListView 创建第二个进度卡组件，不自行重新计算进度，也不把已完成任务的隐藏规则混入进度卡计算。ActionListView 只复用 `todayState` 已有的目标与进度数据；任务的展示/隐藏规则只属于本页的分组派生。

### 10.2 双条件数据规则（不可变）

在 ActionListView 以同一公式派生数据：

```ts
const currentTask = todayState.tasks.find((task) => task.status === "current");
const upcomingTasks = todayState.tasks.filter(
  (task) => task.status !== "completed" && task.status !== "current",
);
const nextTask = upcomingTasks[0];
const remainingTasks = upcomingTasks.slice(1);
const remainingCount = upcomingTasks.length;
```

| currentTask | N | 正在做 | 接下来 | 后面再做 |
|---|---:|:---:|:---:|:---:|
| 存在 | 0 | 显示 | 隐藏 | 隐藏 |
| 存在 | 1 | 显示 | 显示 | 隐藏 |
| 存在 | >=2 | 显示 | 显示 | 显示 |
| 不存在 | 0 | 隐藏 | 隐藏 | 隐藏 |
| 不存在 | 1 | 隐藏 | 显示 | 隐藏 |
| 不存在 | >=2 | 隐藏 | 显示 | 显示 |

固定规则：不补造 currentTask；不提升 locked；不修改 todayState；不显示额外空状态卡；已完成任务不展示；`接下来 = upcomingTasks[0]`；`后面再做 = upcomingTasks.slice(1)`；原数组顺序不变。D2 不因 N=0 创建说明卡；一般入口本已阻止进入，组件仍须按表安全渲染。

### 10.3 页面与卡片结构

```text
ActionListView（h-full min-h-0 flex flex-col overflow-hidden）
├─ header（shrink-0）
│  ├─ 返回 button：IconBack + 回到任务
│  ├─ 行动清单
│  └─ 不用一次看完，先把眼前这一小步做好。
├─ TaskProgressCard（shrink-0）
└─ list（min-h-0 flex-1 overflow-y-auto overscroll-y-contain）
   ├─ 正在做（currentTask 存在）
   ├─ 接下来（N >= 1）
   └─ 后面再做（N >= 2）
```

header 返回 button 调 `onBack`，使用现有 `IconBack size={18}` 和至少 `min-h-touch`。标题精确为“行动清单”。说明严格为两行：

```text
不用一次看完，
先把眼前这一小步做好。
```

列表容器使用 `min-h-0 flex-1 overflow-y-auto overscroll-y-contain`，可加与既有页面一致的 `pr-1` / scrollbar hiding，并保留底部 `pb-[var(--app-content-bottom-reserve)]` 或等价的内部安全间距，确保最末卡不被 fixed BottomTabBar 遮挡。外层不能 page-scroll，不能渲染第二 AppShell 或第二 BottomTabBar。

每个分组是语义 section，标题清楚可读。当前任务分组用 `ActionListTaskCard variant="yellow"`；后续分组都用 `variant="white"`。可在“接下来”后显示静态温柔辅助语“完成当前小步后再来看”，在“后面再做”后显示“现在不用着急”，但它们不是 button、任务或空状态卡。

### 10.4 ActionListTaskCard 的准确内容

ActionListTaskCard 必须是纯展示 `PaperCard`：

- 当前任务 `variant="yellow"`；后续任务 `variant="white"`，必要时用浅边框，绝不 disabled 灰化。
- 永远显示 `task.title`，不截断为不可读的 Todo 单行项；推荐 `font-serif text-xl leading-snug`，可随卡片自然换行。
- detail 从 `task.details?.find((detail) => detail.trim())?.trim()` 取得第一条非空字符串。存在时显示一次；不存在时不渲染该行，不编造默认动作。
- `task.estimatedMinutes` 存在时显示“约 X 分钟”一次；不存在时不渲染时间；不以时间代替 detail。
- 无 `<button>`、checkbox、click handler、状态标签、拖拽、排序、优先级、截止日期、分类、批量操作、删除线、KPI/百分比。

## 11. D2-C：page.tsx 文件级施工

### 11.1 import、状态与渲染接线

- 新增 `import { ActionListView } from "@/components/today/ActionListView";`。
- 修改本地类型为：

```ts
type TodayMode = "home" | "tasks" | "action-list" | "execution";
```

- TaskListView 增加：`onOpenActionList={() => setTodayMode("action-list")}`。
- 在 `renderTodayContent()` 中，优先或明确新增 `todayMode === "action-list" && todayState` 分支：

```tsx
<ActionListView
  todayState={todayState}
  onBack={() => setTodayMode("tasks")}
/>
```

- 无 `todayState` 时维持现有 TodayHomeView fallback；不创建 action-list 独立数据副本、不引入 router/route。
- 从 action-list 返回时仅 `setTodayMode("tasks")`。`todayState` 不变，`executingTaskId` 不因浏览页而改动；不调用任务服务。

### 11.2 action-list Back Handler

在 HomeContent 追加独立 effect：

```ts
useEffect(() => {
  if (authState !== "authenticated") return;

  backController.register({
    id: "action-list",
    priority: 85,
    handle: () => {
      if (
        authState !== "authenticated" ||
        activeTab !== "today" ||
        todayMode !== "action-list"
      ) {
        return false;
      }
      setTodayMode("tasks");
      return true;
    },
  });

  return () => backController.unregister("action-list");
}, [activeTab, authState, backController, todayMode]);
```

priority 固定 85，在 `me-subpage / 90` 与 `footprint-detail / 80` 之间；不改 BackControllerContext。系统返回与页面内返回均回 tasks；不调用 History API。

### 11.3 page-authenticated-root / 50

保留现有 id、priority、effect 模式和其他 Tab 行为。`page-authenticated-root / 50` 的返回处理必须精确为两个独立分支，不能合并条件，也不能在外层统一清空 `executingTaskId`：

```ts
if (todayMode === "execution") {
  setExecutingTaskId(null);
  setTodayMode("tasks");
  return true;
}

if (todayMode === "action-list") {
  setTodayMode("tasks");
  return true;
}
```

第一个分支保持原有 execution 清理语义。第二个分支只修改 `todayMode`，绝不调用 `setExecutingTaskId(null)`；随后既有 `todayMode === "tasks"` 分支继续回 home。完整返回链：`action-list → tasks → home`。该决定已锁定，不留给 Codex 选择。

## 12. D2 验证、Review、验收、回退

### 12.1 范围检查

每次 D2 开工时先按 §2.1 核对 ChatGPT D2 指令提供的 SHA，再重新设置本批 `$D_BASE_HEAD`；不得复用 D1 的变量。

```powershell
$D2_ALLOWED = @(
  "apps/mobile-app/app/page.tsx",
  "apps/mobile-app/components/today/ActionListView.tsx",
  "apps/mobile-app/components/today/TaskListView.tsx"
) | Sort-Object

$D_TRACKED_CHANGED = @(
  git diff --name-only $D_BASE_HEAD -- apps/mobile-app
)

$D_UNTRACKED_CHANGED = @(
  git ls-files --others --exclude-standard -- apps/mobile-app
)

$D_CHANGED = @(
  $D_TRACKED_CHANGED
  $D_UNTRACKED_CHANGED
) | Where-Object { $_ } | Sort-Object -Unique

$D_CHANGED
```

`$D_CHANGED` 必须作为集合严格等于 `$D2_ALLOWED`，顺序不作为判断条件。它必须包含 `apps/mobile-app/components/today/ActionListView.tsx`，否则停止；多出或漏掉任一文件也停止。`git status` 用于显示状态，而 `$D_CHANGED` 是唯一用于严格文件集合比较的结果；不得仅凭普通 `git diff` 或 `git diff --check` 判断新文件安全。

在 ActionListView 尚未暂存时，额外执行：

```powershell
git diff --no-index --check -- NUL apps/mobile-app/components/today/ActionListView.tsx
git diff --no-index -- NUL apps/mobile-app/components/today/ActionListView.tsx
```

前一条命令专门检查新文件空白：NUL 与新文件存在差异导致的返回状态是预期，不得误判为施工失败；若输出含 `trailing whitespace`、`space before tab` 或 `whitespace error`，必须停止。第二条仅用于 Review 前完整审查新文件内容。Review 前 staged 必须为空；不得执行 `git add`、`git add -N` 或任何暂存操作来让普通 diff 看见新文件。

### 12.2 Claude Code Review 清单

- [ ] `$D_CHANGED` 与 D2 三文件允许集合严格相同，且明确包含未暂存的 `ActionListView.tsx`；普通 git diff / diff check 没有被当作唯一范围依据。
- [ ] ActionListView 在未暂存状态已通过 `git diff --no-index --check -- NUL ...` 空白检查，并已通过 `git diff --no-index -- NUL ...` 完整内容审查；`--no-index` 的预期差异返回状态没有被误判为失败；Review 前 staged 为空，未使用 `git add` / `git add -N`。
- [ ] TaskListView 继续使用只读 CurrentTaskCard，未 import ExecutionTaskCard。
- [ ] `TaskListViewProps` 保留 `onLockedTaskClick: () => void` 兼容字段，page.tsx 仍按原行为传入；TaskListView 函数参数不解构、不调用、不创建 `_onLockedTaskClick` 或其他未使用变量；接口清理未混入 D2，UpcomingTaskList 零 diff。
- [ ] TaskProgressCard 源码与 Props 零 diff；TaskListView 与 ActionListView 均以 `goal={todayState.goal}`、`completedCount={todayState.completedCount}`、`totalCount={todayState.totalCount}` 调用同一组件；无第二进度卡、无重新计算进度、无把完成任务隐藏规则混入进度。
- [ ] 入口 N 是排除 `completed` / `current` 的原序任务数；N=0/allCompleted 不显示。
- [ ] ActionListView 是唯一新文件，ActionListTaskCard 在文件内部。
- [ ] 六种 currentTask × N 表路径与固定规则准确；无额外空状态。
- [ ] 说明严格为“`不用一次看完，` / `先把眼前这一小步做好。`”，旧表述已完全移除；入口卡仍为“现在不用一次看完，想知道接下来有什么时再打开。”。
- [ ] 当前黄色、后续暖白；卡片没有 click/checkbox/任务操作或 Todo 化元素。
- [ ] 外层无第二 AppShell/BottomTabBar；仅中间列表滚动且 overscroll contain。
- [ ] `action-list / 85` cleanup 正确；`page-authenticated-root / 50` 保留独立 execution 分支（唯一清 `executingTaskId`）和独立 action-list 分支（只设 `todayMode="tasks"`），无合并条件或外层清理。
- [ ] 无 services/types/BackControllerContext/TaskExecutionView 改动。

### 12.3 用户验收

375×812、390×844、430×932 测试 N=0、N=1、N>=2 且分别有/无 currentTask 的六种组合。确认入口隐藏规则、分组/顺序/卡片颜色、ActionListView 标题下说明为两行“不用一次看完，/先把眼前这一小步做好。”、入口卡仍为“现在不用一次看完，想知道接下来有什么时再打开。”、长清单仅内部滚动、末项不被 Tab 遮挡、无 checkbox/点击任务。确认 TaskProgressCard 与 TaskListView 使用同一 `todayState.goal`、`todayState.completedCount`、`todayState.totalCount` 语义与显示进度，且 ActionListView 没有第二进度卡或独立进度计算。确认页面内 Back 与 Android 系统 Back 均为 action-list → tasks → home。

### 12.4 D2 失败与回退

D2 发现问题即停止，不进入 D3。以下任一情形均属于 D2 停止条件：`onLockedTaskClick` 被从 Props 删除、被 TaskListView 解构/调用、被改名为未使用变量，或 page.tsx 既有传入行为被改动；TaskProgressCard 被修改、扩展 Props、替换为第二组件，或 ActionListView 自行重新计算进度；UpcomingTaskList 被修改；`$D_CHANGED` 缺少/额外文件或不含 ActionListView；ActionListView 的 no-index 空白检查报错；Review 前出现任何 staged 内容；page-authenticated-root 使用合并 execution/action-list 条件，或 action-list 清空 `executingTaskId`。经批准的 D2 回退只包含 TaskListView、page.tsx 和删除 ActionListView 的 D2 commit；不影响 D1。

---

# D3：任务执行布局与三状态优化

## 13. D3 目标与文件范围

D3 只让 default 态的 AI Guide 获得主要弹性空间，并为 ExecutionTaskCard 增加 compact 表示。C3 的三枚举、草稿规则、聚焦、keyboard 与 BackController 结构不是重做对象。

唯一允许修改：

1. `apps/mobile-app/components/today/TaskExecutionView.tsx`
2. `apps/mobile-app/components/today/ExecutionTaskCard.tsx`

禁止 ExecutionGuideCard、ExecutionFeedbackBox、CurrentTaskCard、page.tsx、visualViewport 核心逻辑、BackControllerContext、services/types。

修改顺序：先在 ExecutionTaskCard 完成后向兼容 `compact` prop；再仅在 TaskExecutionView 的 default 路径传 `compact={true}` 并调整 flex classes；最后按三状态矩阵 Review。

## 14. D3-A：ExecutionTaskCard.tsx compact 规则

### 14.1 props 与完整模式

将接口锁定为：

```ts
interface ExecutionTaskCardProps {
  task: Task;
  compact?: boolean;
}

export function ExecutionTaskCard({ task, compact = false }: ExecutionTaskCardProps) { ... }
```

`compact=false` 必须保留当前完整卡片的全部视觉和 fallback 行为：当前完整状态标签、最多两条 existing details、无 details 时的现有温柔 fallback 文案、底部完成权提示和可选时间。不得因新增 prop 回归任何既有调用。

### 14.2 compact=true 的固定内容

compact 分支只保留：

1. `task.title`：永远显示，`line-clamp-1`，最多一行。
2. 第一条非空 detail：`task.details?.find((detail) => detail.trim())?.trim()`；存在才显示一次，最多一行。
3. `task.estimatedMinutes`：存在才独立显示“约 X 分钟”，整张卡最多一次。

缺失规则：无 detail 不渲染说明行；无时间不渲染时间；绝不以时间代替 detail；绝不编造文案或空占位行；不重复时间。不得压缩成只有“正在做”标签和一行标题。

可压缩/隐藏：多条 details、重复的“现在这件事/正在做”标签（最多保留一个组合提示）、底部完成权长提示、额外装饰、过大留白。卡仍使用 `PaperCard variant="yellow" padding="compact"` 与 `shrink-0`。

标题/detail/time 分别最多一行。高度目标约 88–110px，但不能以死高度裁剪可读内容；最终判断是 375×812 下 title、可用 detail、可用时间、Guide、反馈区和完成按钮均可识别。

## 15. D3-B：TaskExecutionView.tsx 高度与三状态

### 15.1 唯一使用位置与 default 布局

TaskExecutionView 是 V3.0D 唯一明确使用 ExecutionTaskCard 的页面。在既有：

```tsx
{isDefault ? <ExecutionTaskCard task={task} /> : null}
```

仅改为：

```tsx
{isDefault ? <ExecutionTaskCard task={task} compact /> : null}
```

不让 TaskListView import 或使用 ExecutionTaskCard。

在 default 态维持如下布局次序：

```text
header                         shrink-0
ExecutionTaskCard compact      shrink-0
Guide wrapper                  min-h-0 flex-1
ExecutionFeedbackBox wrapper   shrink-0（现有默认 112px）
完成按钮                        shrink-0
```

当前 Guide wrapper 已为 default 下 `flex min-h-0 flex-1 flex-col`；保留/精确保障这一点，使 ExecutionGuideCard 成为 default 的主要弹性区域。不可改 ExecutionGuideCard 文件。Guide 默认维持约 4–6 行可辨预览和既有“展开查看完整建议”入口，不能用极小字体压缩内容。

保持 FeedbackBox 默认 112px（其源码的 `h-28`）及 300 字限制、受控 draft、提交成功后草稿规则；不创建第二输入框，不改 ExecutionFeedbackBox 文件。

### 15.2 三状态显隐矩阵（逐项不变）

| 项目 | default | guide-focused | feedback-focused |
|---|---|---|---|
| TaskExecutionView default header | 显示 | 隐藏 | 隐藏 |
| 紧凑 header / 收起 | 隐藏 | 显示 | 显示 |
| ExecutionTaskCard | 显示，`compact` | 视觉隐藏 | 视觉隐藏 |
| ExecutionGuideCard 实例 | 挂载 | 挂载 | 挂载 |
| Guide 视觉区域 | 显示、主要 flex | 显示、focused 内滚 | 视觉隐藏 |
| ExecutionFeedbackBox 实例 / textarea | 挂载 | 挂载 | 挂载 |
| Feedback 视觉区域 | 显示、默认 112px | 视觉隐藏 | 显示、`flex-1` |
| “写下现在的情况” | 隐藏 | 显示 | 隐藏 |
| 完成按钮 | 显示 | 显示 | 显示 |

guide-focused 继续由 GuideCard 内部 `min-h-0 flex-1 overflow-y-auto` 阅读；feedback-focused 继续由 FeedbackBox `flex min-h-0 flex-1 flex-col` 编辑。D3 不改 header 逻辑、focus 逻辑、guide/feedback 切换、完成回调。

### 15.3 DOM、草稿、visualViewport 与 Back 保护

严格保持：

- 不用 React `key` 强制重挂载。
- ExecutionGuideCard 永远一个实例。
- ExecutionFeedbackBox 永远一个实例。
- textarea 永远一个 DOM。
- 三状态通过既有 wrapper 的 class / visual state 切换；不能新增第二套 JSX card/input。
- `feedbackDraft` 在 presentation 切换和提交成功后保持，在 task.id 变化/卸载时按 C3 既有规则清除。
- `startViewportTracking`、`stopViewportTracking`、120px 阈值、`--task-feedback-keyboard-inset`、rAF focus、blur cleanup 一行不改；D3 不增加 visualViewport listener。
- `task-feedback-focus / 95` 与 `task-guide-focus / 94` id、priority、effect、返回值与 cleanup 都不改。

## 16. D3 验证、Review、验收、回退

### 16.1 范围检查

每次 D3 开工时先按 §2.1 核对 ChatGPT D3 指令提供的 SHA，再重新设置本批 `$D_BASE_HEAD`；不得复用 D1 或 D2 的变量。

```powershell
$D3_ALLOWED = @(
  "apps/mobile-app/components/today/ExecutionTaskCard.tsx",
  "apps/mobile-app/components/today/TaskExecutionView.tsx"
) | Sort-Object

$D_TRACKED_CHANGED = @(
  git diff --name-only $D_BASE_HEAD -- apps/mobile-app
)

$D_UNTRACKED_CHANGED = @(
  git ls-files --others --exclude-standard -- apps/mobile-app
)

$D_CHANGED = @(
  $D_TRACKED_CHANGED
  $D_UNTRACKED_CHANGED
) | Where-Object { $_ } | Sort-Object -Unique

$D_CHANGED
```

`$D_CHANGED` 必须作为集合严格等于 `$D3_ALLOWED`。D3 不允许新增文件；因此任何未跟踪 `apps/mobile-app/**` 文件都阻断。不得仅凭普通 `git diff` 判断范围；Review 前 staged 必须为空，不得使用 `git add` 或 `git add -N`。

### 16.2 Claude Code Review 清单

- [ ] 只两个 D3 文件；GuideCard/FeedbackBox/page.tsx/Context 无 diff。
- [ ] `compact?: boolean` 默认 false；所有非-D3 调用仍为完整模式。
- [ ] compact 只显示 title + 第一非空 detail（如有）+ 单次 estimatedMinutes（如有），无占位/编造/重复。
- [ ] TaskExecutionView default 唯一传入 `compact`，TaskListView 不使用 ExecutionTaskCard。
- [ ] Guide wrapper 是 default 的 `min-h-0 flex-1` 主弹性区；反馈与完成仍 shrink-0。
- [ ] 三枚举状态矩阵、单实例 DOM、draft 生命周期无回归。
- [ ] visualViewport 函数和 two Back handler 的 id/priority/cleanup 零变更。

### 16.3 用户验收

在 375×812、390×844、430×932 验证 default 下 compact 卡、AI 输出、112px 输入区与完成按钮同时可识别；无 detail/无 estimated/空字符串 detail 的数据均符合缺失规则；guide-focused 内部阅读可滚；feedback-focused 键盘弹出、收起后无巨大空白且草稿不丢；Back 链依次为 guide-focused → default → tasks → home，feedback-focused → default → tasks → home。

### 16.4 D3 失败与回退

D3 失败立即停止，D4 不得开始。批准后的回退仅为 TaskExecutionView 与 ExecutionTaskCard 的 D3 commit，不跨批影响 D1/D2。

---

# D4：整体 Code Review、构建与真机验收

## 17. D4 默认零代码修改

D4 的允许范围是 Review、技术验证和真机验收，默认**不得修改任何代码**，不产生默认代码提交。发现问题时停止 D4，只报告可复现现象、影响、文件和建议归属；由 ChatGPT 重新限定修复批次与文件，禁止以“最小调整”为由自行修复。

## 18. D4 Claude Code 全量 Review

逐批检查 D1/D2/D3 的实际 diff 与批准清单：

- 每批文件范围是否严格一致，是否修改只读文件；是否已在暂存前将 `$D_TRACKED_CHANGED` 与 `$D_UNTRACKED_CHANGED` 合并为 `$D_CHANGED` 并与允许集合精确比对。
- 每个未跟踪新增文件是否已通过 no-index 空白检查与完整内容审查；是否曾用 `git add -N` 或提前暂存来伪造普通 diff 覆盖。
- D2 的 ActionListView 是否由 `$D_CHANGED` 覆盖；`page-authenticated-root / 50` 是否严格保留独立 execution 分支（清 `executingTaskId`）与 action-list 分支（只设 `todayMode="tasks"`），无合并条件或外层清理。
- 是否有第二 AppShell、第二 BottomTabBar、新路由或页面级长滚动。
- 是否有第二 `popstate` / `pageshow`、直接 history/router Back 调用或 Context 修改。
- 是否有聊天泡、消息记录、messages map、发送箭头或聊天 Tab。
- 是否有 Todo checkbox、任务点击修改、提前开始、状态操作或 disabled 灰化的行动清单。
- 是否调用真实 Auth、Supabase、SMTP/API/service，或修改 `services/**`/`types/**`。
- 是否修改 C4 图标/manifest/public 资产。
- 是否修改 C3 的 Guide/Feedback/textarea 单实例、visualViewport、Back handlers。

## 19. D4 技术验证

```powershell
npm --prefix apps/mobile-app run lint
npm --prefix apps/mobile-app run build
git diff --check
git status --short --untracked-files=all
```

仅既有 multiple-lockfiles 或 LF/CRLF 警告可记录，不得掩盖 lint/build/TypeScript/diff check 失败。

## 20. D4 真机与视口验收

### 20.1 三档视口与平台

- 375×812
- 390×844
- 430×932
- Android Chrome 必测
- iPhone Safari 设备可用时必测

### 20.2 返回链

逐项验证：

```text
code-entry → email-entry → welcome
action-list → tasks → home
guide-focused → default → tasks → home
feedback-focused → default → tasks → home
```

其中 code-entry 的页面内“更换邮箱”和系统返回都必须回 email-entry；code-entry 不得直接跳 PasswordLoginPage。用户要进入密码登录，必须先回 email-entry，再点击仅在该状态显示的密码登录 Tab。

### 20.3 键盘与草稿

- OTP 可呼出数字键盘，视觉格点击聚焦，输入/粘贴过滤正确。
- 更换邮箱或 Back 后邮箱保留、code 清空，倒计时/timeout 无残留。
- feedback-focused 键盘弹出，textarea、继续推进、完成可操作。
- 键盘关闭后无巨大空白，TabBar 恢复，草稿不因三状态切换丢失。

### 20.4 视觉与滚动

- Welcome 单屏，顶部只有清行，底部两个入口，小径与嫩芽为主视觉。
- OTP email-entry 只显示登录方式 Tab、邮箱输入、发送验证码和注册入口；code-entry 只显示锁定验证码内容，明确无登录方式 Tab、密码入口、注册入口、原邮箱输入或第三入口；用户改用密码登录时必须先回 email-entry。
- ActionListView 保持清行纸张卡而不是普通 Todo；标题下说明严格为两行“不用一次看完，/先把眼前这一小步做好。”，当前/后续层级和双条件分组正确；其进度卡与 TaskListView 复用同一 `todayState` 目标/完成数/总数语义。
- action list 只中间区滚动，Bottom Tab 不遮挡内容，无双重界面。
- default 执行页 AI 输出与输入区同时清晰可识别。

---

## 21. Git 范围核验与提交策略

### 21.1 每批提交前

每个批次都必须使用 §2.1 规定、由当批 ChatGPT 指令提供的准确施工 SHA，并在核对 `HEAD = origin/main`、tracked clean、staged empty 后重新设置该批 `$D_BASE_HEAD`。D1 的 `$D_BASE_HEAD` 来自已提交并 Push 的 Execution Plan HEAD；D2 来自已 Review/验收/提交并 Push 的 D1 HEAD；D3 来自已 Review/验收/提交并 Push 的 D2 HEAD。不得以文档编写基线代替施工基线，也不得跨批复用变量。

仅在该批通过 Codex 实现、Claude Code Review、lint/build、用户必要验收、ChatGPT 明确批准之后，Claude Code 才可提交。Codex 不得 commit 或 push。

每批在暂存前执行：

```powershell
$D_TRACKED_CHANGED = @(
  git diff --name-only $D_BASE_HEAD -- apps/mobile-app
)

$D_UNTRACKED_CHANGED = @(
  git ls-files --others --exclude-standard -- apps/mobile-app
)

$D_CHANGED = @(
  $D_TRACKED_CHANGED
  $D_UNTRACKED_CHANGED
) | Where-Object { $_ } | Sort-Object -Unique

$D_CHANGED
git diff --check
git status --short --untracked-files=all
```

`$D_CHANGED` 必须在任何暂存前严格等于该批允许集合；普通 `git diff` 与 `git diff --check` 不能作为未跟踪新文件的唯一范围/安全依据。每个新增文件还必须按 §3.3 执行 no-index 空白检查和完整内容审查。D2 的 ActionListView 在此阶段仍为未跟踪文件，必须已被 `$D_CHANGED` 和 no-index 检查覆盖。Review 前 staged 为空；禁止以 `git add -N` 让普通 diff 看见新文件。

只在 ChatGPT 批准提交后逐个精确暂存允许文件，禁止：

```text
git add .
git add -A
git add --all
git add -N
```

建议的精确暂存范围：

```powershell
# D1
git add -- apps/mobile-app/components/auth/WelcomePage.tsx
git add -- apps/mobile-app/components/auth/OtpLoginPage.tsx

# D2
git add -- apps/mobile-app/components/today/TaskListView.tsx
git add -- apps/mobile-app/components/today/ActionListView.tsx
git add -- apps/mobile-app/app/page.tsx

# D3
git add -- apps/mobile-app/components/today/TaskExecutionView.tsx
git add -- apps/mobile-app/components/today/ExecutionTaskCard.tsx
```

暂存后均执行 `git diff --cached --name-only`、`git diff --cached --check`、`git diff --cached --stat`。任何第二批文件、文档、只读文件、长期未跟踪项进入暂存：停止，不提交。

### 21.2 提交顺序

```text
Architecture（文档编写基线 88e40b8b）
→ Execution Plan：ChatGPT Review / 批准 → Claude Code 精确提交并 Push，形成 D1 施工基线
→ D1：Codex 实施 → Review/验收/ChatGPT 批准 → Claude Code 精确提交并 Push，形成 D2 施工基线
→ D2：同上，形成 D3 施工基线
→ D3：同上
→ D4：Review/验收；默认无提交
```

D1–D3 提交信息、是否 push 均需当时 ChatGPT 单独授权；不得预先提交或 push。V3.1-A 在 V3.0D 全阶段关闭且获得新的 Architecture/Execution Plan/授权前仍暂停。

## 22. 风险、停止条件与完成定义

| 级别 | 风险 | 阻断/缓解 |
|---|---|---|
| P0 | Welcome 固定区在小视口遮住按钮 | h-full/flex/min-h-0、品牌区 flex-1；不可用缩小字号掩盖 |
| P0 | OTP 被误实现为真实认证或虚假“发送成功” | 删除 service 调用；固定诚实说明；Review 搜索 service/Auth API |
| P0 | code-entry Back 被 page-auth-flow 抢走 | 强制 `otp-code-entry / 65`，完整 deps 与 unregister |
| P0 | action-list 返回跳过 tasks 或误清 execution 选择 | `action-list / 85` 先消费；root / 50 用两个独立分支，action-list 只回 tasks、不清 `executingTaskId` |
| P0 | D1 从文档编写 SHA 而非已提交 Execution Plan 开工 | 四层基线；当批 ChatGPT 提供 SHA、核对 HEAD=origin/main 后重新设置 D_BASE_HEAD |
| P0 | ActionListView 撑开 AppShell | `h-full min-h-0 flex flex-col overflow-hidden`，仅中间内部滚动 |
| P0 | D3 破坏 C3 textarea/Guide 单实例或 keyboard | 不修改 Guide/Feedback/viewport 核心；逐 presentation 核验 |
| P1 | TaskListView 误用 ExecutionTaskCard | 继续只用 CurrentTaskCard；Review 搜 import |
| P1 | 双条件分组遗漏 currentTask 缺失路径 | 六格表逐条验收 |
| P1 | compact 编造/重复详情或时间 | 第一条非空 detail + 单次 estimated 规则 |
| P1 | interval/timeout/handler cleanup 残留 | effects 对称 cleanup，Strict Mode 重复开关验证 |
| P1 | 移除 UpcomingTaskList 后误清理 `onLockedTaskClick` 兼容接口 | Props/page.tsx 传入保持，TaskListView 不解构/调用；清理另立维护任务 |
| P1 | ActionListView 偏离现有 TaskProgressCard 进度语义 | 精确复用三个既有必填 Props；不改组件、不新增组件、不重新计算 |
| P1 | 普通 diff 漏报未跟踪施工文件或其空白错误 | 每批合并 tracked/untracked 为 D_CHANGED；新增文件 no-index 空白检查与完整审查，Review 前不暂存 |
| P2 | 平台键盘、安全区和间距差异 | 三视口 + Android/iOS 记录 |

V3.0D 只有在本 Execution Plan 经 ChatGPT 批准、独立提交并 Push，随后 D1、D2、D3 各自从当批 ChatGPT 提供且已 Push 的正确施工基线开始，完成批准的实现/Review/构建/验收/提交并 Push，且 D4 全量 Review 与真机矩阵通过、tracked 工作区干净、ChatGPT 明确关闭后才算完成。当前本文件完成不代表 Codex 获得施工授权。
