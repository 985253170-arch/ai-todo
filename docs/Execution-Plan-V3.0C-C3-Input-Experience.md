# V3.0C C3 执行方案：输入体验、键盘适配与滚动锁

> **状态**：ChatGPT 审查通过；执行方案已锁定，Codex 施工仍需单独授权
>
> **施工基线**：`5af8b67e0dbe09f01b518726970cdb0dc354091f` — `feat: add mobile back controller`
>
> **架构依据**：[Architecture-V3.0C-C3-Input-Experience.md](Architecture-V3.0C-C3-Input-Experience.md)
>
> **执行顺序**：C3-A → Review / 验收 / 批准 / 提交 → C3-B → Review / 验收 / 批准 / 提交

---

## 1. 执行纪律

C3 严格分为两个串行子批，禁止并行、禁止累计未提交 diff 进入下一子批。

```text
C3-A 任务反馈专注模式与键盘适配
  → Claude Code Review + 用户键盘验收 + ChatGPT 批准
  → 精确提交与 push，tracked 工作区干净
C3-B 我的反馈大编辑区与 Sheet 滚动锁
  → Claude Code Review + 用户滚动/键盘验收 + ChatGPT 批准
  → 精确提交与 push，tracked 工作区干净
C3 完成
  → C4 仍须图标源视觉闸门单独通过
```

不能：

- 在 C3-A 同时改 Me 文件；
- 在 C3-B 顺带改任务反馈文件；
- 修改 `app/page.tsx`、`BackControllerContext.tsx`、AppShell、BottomTabBar；
- 修改条件文件、服务、Mock、types、路由、根配置；
- 将任务执行页变成长网页、聊天页或第二个 AppShell；
- 用 body lock、`querySelector`、全局 CSS variable 或第三方 scroll-lock 库绕过设计。

---

## 2. 施工前 Git 检查

每个子批开始前，在 `C:\Dev\ai-todo`：

```powershell
$C3A_BASE_HEAD = git rev-parse HEAD  # C3-A 时，必须是 5af8b67e...
git branch --show-current
git rev-parse HEAD
git status --short --untracked-files=all
git diff --name-only
git diff --check
```

C3-A 开始时必须满足：

```text
branch = main
HEAD = 5af8b67e0dbe09f01b518726970cdb0dc354091f
tracked working tree = clean
```

C3-B 只能在 C3-A 已被批准、提交、push 后开始；记录新的 `$C3B_BASE_HEAD`，不得重新使用 C3-A 的 SHA。

允许继续存在、但绝不处理：

```text
.agents/
.claude/
.codex/
.vscode/
skills-lock.json
start
stop
test_photo.jpeg
```

任何额外 tracked 变更、错误 HEAD、已暂存文件或条件文件变化：立即停止，报告，不清理、不 reset、不 stash。

---

## 3. 精确文件范围

### C3-A 唯一允许修改（2 个）

1. `apps/mobile-app/components/today/TaskExecutionView.tsx`
2. `apps/mobile-app/components/today/ExecutionFeedbackBox.tsx`

### C3-B 唯一允许修改（3 个）

1. `apps/mobile-app/components/me/MeFeedbackPage.tsx`
2. `apps/mobile-app/components/me/MeView.tsx`
3. `apps/mobile-app/components/me/MeConfirmSheet.tsx`

### 新增文件

无。

### 条件文件（两个子批初始指令均禁止）

| 文件 | 可触发条件 | 允许动作 |
|---|---|---|
| `components/today/GoalInputCard.tsx` | Android/iOS 真机确认目标输入或生成按钮被键盘遮挡，含设备、浏览器、步骤、截图/录屏 | 单独 ChatGPT 审查后的最小 Follow-up |
| `components/auth/RegisterPage.tsx` | AuthShell 滚动祖先无法使确认密码或提交可达，含同等证据 | 单独 ChatGPT 审查后的最小 Follow-up |

### 只读参考

`app/page.tsx`、`contexts/BackControllerContext.tsx`、AppShell、BottomTabBar、ExecutionTaskCard、ExecutionGuideCard、globals.css、tailwind.config.ts、UI primitives、C1/C2 文档。

---

## 4. C3-A：任务反馈专注模式

### A1. `TaskExecutionView.tsx`

**允许做：**

1. 新增以下本地状态和 refs：

```ts
type FeedbackPresentation = "default" | "focused";

const [feedbackPresentation, setFeedbackPresentation] = useState<FeedbackPresentation>("default");
const [feedbackDraft, setFeedbackDraft] = useState("");
const [keyboardInset, setKeyboardInset] = useState(0);

const executionRootRef = useRef<HTMLDivElement | null>(null);
const feedbackTextareaRef = useRef<HTMLTextAreaElement | null>(null);
const baselineViewportHeightRef = useRef<number | null>(null);
```

`TaskExecutionView` 是 focused/default、`feedbackDraft`、顶部“收起”按钮、`collapseFeedbackFocus()`、`task-feedback-focus / 95` 和 visualViewport 生命周期的唯一所有者。`ExecutionFeedbackBox` 不接收 `onCollapse`、不渲染“收起”、不改变 presentation、不注册 Back Handler。

2. 将 `ExecutionFeedbackBox` 改为由 `feedbackDraft` 控制，并传递如下 Props：

```tsx
<ExecutionFeedbackBox
  value={feedbackDraft}
  focused={feedbackPresentation === "focused"}
  textareaRef={feedbackTextareaRef}
  isProcessing={isProcessing}
  onChange={setFeedbackDraft}
  onFocus={openFeedbackFocus}
  onSubmit={handleFeedback}
/>
```

3. 增加 `openFeedbackFocus()`：记录 visualViewport / innerHeight 基线，进入 focused。不得清草稿。
4. 增加统一 `collapseFeedbackFocus()`：**只允许**由专注态顶部标题区右侧“收起”、`task-feedback-focus / 95`、反馈提交成功、`task.id` 变化或 `TaskExecutionView` 卸载触发；它让 textarea blur、恢复 default、清 keyboard UI/listener/inset，保留草稿。
5. textarea blur、键盘“完成”、手动收起键盘或 viewport 高度恢复时，只清 visualViewport listener、keyboardInset、baseline 与局部 CSS variable；**不得**调用 `collapseFeedbackFocus()`、`setFeedbackPresentation("default")`、清草稿、卸载 textarea、隐藏 focused 操作或调用 BackController。
6. 成功提交后继续调用现有 `getCompanionStep(task.id, feedback)`、更新 guide 和 `hasSubmittedFeedback`；成功后才调用 `collapseFeedbackFocus()`，但**不得** `setFeedbackDraft("")`。提交失败保持 focused、保留 draft，允许继续编辑和再次提交。
7. 点击“继续陪我推进”导致 textarea 先 blur 时，focused UI 与按钮必须保持挂载，click 必须正常执行一次；不得因 blur 导致按钮卸载、重排或丢失 click。
8. `task.id` 变化时重置 task-scoped guide / submitted / draft / focus / keyboard 状态，避免跨任务草稿泄漏。
9. 当组件 unmount（任务完成、退出执行、Tab 切换、登出）时清 visualViewport listener 和局部状态；不持久化草稿。
10. 根节点添加 `ref={executionRootRef}`，在 focused 布局使用局部 CSS custom property，例如：

```tsx
style={{ "--task-feedback-keyboard-inset": `${keyboardInset}px` } as React.CSSProperties}
```

仅可在该根节点局部使用。实现所需 type import 可从 React 引入，不改 types 文件。
11. TaskExecutionView 只能渲染**一个** `ExecutionFeedbackBox` 实例。default/focused 切换只能改变周围内容显隐、className 和布局；不得分别渲染两个实例、不得用 `key` 强制重建、不得让 ExecutionFeedbackBox 因 presentation 切换卸载。focused 时 TaskCard/Guide 可使用条件 class 隐藏或仅条件渲染；onFocus 后 `document.activeElement` 必须仍是同一个 textarea。
12. focused 时隐藏完整任务卡/Guide 包装层并显示简洁任务上下文：执行身份、当前 task.title、专注态顶部标题区右侧唯一的 `收起`。必须保留：
    - 当前任务标题；
    - 任务执行身份；
    - textarea；
    - `继续陪我推进`；
    - `我完成了这一小步`。
13. 在 focused 时使用局部 flex 布局及 `--task-feedback-keyboard-inset` 使上述核心元素位于可用 visual viewport 区域；不改 AppShell 的 `100svh` 模型，不增加全页滚动。
14. 通过 `useBackController()` 注册：

```ts
{
  id: "task-feedback-focus",
  priority: 95,
  handle: () => {
    if (feedbackPresentation !== "focused") return false;
    collapseFeedbackFocus();
    return true;
  },
}
```

Effect 依赖完整，cleanup 精确 `unregister("task-feedback-focus")`。

**ExecutionFeedbackBox 接口锁定：**

```ts
interface ExecutionFeedbackBoxProps {
  value: string;
  focused: boolean;
  isProcessing: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  onFocus: () => void;
  onSubmit: (feedback: string) => void | Promise<void>;
}
```

**visualViewport 规则：**

1. 只有 `feedbackPresentation === "focused"` 且 `window.visualViewport` 存在时监听 `resize` 和 `scroll`；
2. 聚焦时记录 `baselineViewportHeightRef.current`；
3. 计算必须等价于：

```ts
const viewportDrop = Math.max(0, baselineHeight - visualViewport.height);
const rawInset = Math.max(
  0,
  window.innerHeight - visualViewport.height - visualViewport.offsetTop,
);
const nextInset = viewportDrop >= 120 ? rawInset : 0;
```

4. `120px` 不可由 Codex 自行调整；
5. 高度恢复阈值内、textarea blur、键盘“完成”或手动收起键盘时，仅清 keyboardInset/baseline/局部 CSS variable 和 visualViewport listener；不得退出 focused。收起、成功提交、task.id 变化或 unmount 才能退出 presentation；
6. 不支持 visualViewport 时，focus 仍进入 focused fallback，inset 设 0；
7. 不监听普通 `window.resize`、`orientationchange` 或全局 DOM。

**不允许做：**

- 改 `page.tsx`、BackControllerContext、WebHistoryGuard；
- 直接 `history.back()` / `router.back()`；
- 新增 popstate/pageshow；
- 使用 `scrollIntoView` 作为任务执行页降级；
- 变更任务 Mock/service/完成逻辑；
- 变成聊天历史、聊天气泡、消息发送页；
- 隐藏当前任务标题、继续推进或完成动作；
- 让任务执行页 `overflow-y-auto` 成长网页。

**完成标准：**

- 默认 textarea 为 112px、最大 300 字；
- focused 输入态在同一 AppShell 内，有 `收起`，草稿不丢；
- focused Back → default execution；下一次 Back → tasks；再下一次 Back → home；
- 成功提交更新 Guide、回默认态、草稿仍在；
- 键盘/地址栏变化不会留下 listener 或局部 CSS variable。

### A2. `ExecutionFeedbackBox.tsx`

**允许做：**

1. 删除内部 `useState` 草稿所有权；使用父组件 `value` / `onChange`。
2. 接收 `focused`、`textareaRef`、`onFocus`，textarea 的 `onFocus` 调用父回调；`onChange` 只上报值。
3. 保持 textarea `maxLength={300}`，默认最低高度 112px。
4. focused 时以 className 让卡片成为 `flex min-h-0 flex-1 flex-col`，textarea 成为 `flex-1 min-h-[112px]` 且仅其自身滚动；default 时保持纸张卡片、简洁说明和主操作。
5. focused 时主操作继续使用准确文案“继续陪我推进”。“收起”只由 TaskExecutionView 在专注态顶部标题区右侧渲染；ExecutionFeedbackBox 不接收 `onCollapse`、不渲染“收起”、不调用 `setFeedbackPresentation`、不注册 Back Handler。
6. `handleSubmit` 使用 `value.trim()`；成功后不清父 draft。

**不允许做：**

- 内部维护第二份草稿；
- 自行监听 visualViewport；
- 新增 service 调用；
- 写聊天/发送 UI；
- 把草稿保存到 localStorage；
- 修改 task / guide 状态。

**完成标准：**

- 一个稳定 textarea DOM 节点跨 focused/default 存活；
- 收起、提交、失败各自符合草稿规则；
- 无值时继续按钮 disabled；loading 继续复用 PrimaryButton。

### A3. C3-A Code Review 清单

- [ ] diff 只有 A1/A2 两个文件；
- [ ] `task-feedback-focus / 95` 注册、最新 state、cleanup 正确；
- [ ] C2 的 `me-confirm / 100`、`me-subpage / 90` 等既有 Handler 未变；
- [ ] 不改 WebHistoryGuard / popstate / pageshow；
- [ ] TaskExecutionView 只渲染一个 ExecutionFeedbackBox 实例；default/focused 不存在双分支或 `key` 强制重建；
- [ ] 页面中只有一个反馈 textarea；focus 后 `document.activeElement` 仍是同一 textarea；
- [ ] blur 只清键盘 UI，不改变 presentation、不清草稿、不卸载 textarea；
- [ ] 点击提交时 textarea blur 不会丢 click；提交失败仍保持 focused；
- [ ] 300 字、112px、顶部标题区右侧收起、草稿保留、成功返回默认态正确；
- [ ] visualViewport listener 仅 focused 期间存在，resize + scroll cleanup 完整；
- [ ] 120px 阈值、局部 inset、无 visualViewport fallback 正确；
- [ ] focused 不像聊天软件，不丢任务标题/两动作/底部 Tab 结构；
- [ ] 不出现全页滚动、双 AppShell、服务/Mock 修改。

### A4. C3-A 用户验收

- [ ] 375×812 / 390×844 / 430×932：默认 textarea 明显可写，focused 布局不溢出；
- [ ] 输入进度、卡点、草稿、时间约束，验证 300 字上限；
- [ ] 输入后收起再打开，草稿不丢；
- [ ] 键盘打开时直接点击“继续陪我推进”，一次点击即可提交；textarea blur 不丢 click；
- [ ] 点击键盘“完成”或手动收起键盘后，仍停留 focused；顶部“收起”和提交按钮仍可用；
- [ ] 成功提交后回默认任务执行页，Guide 更新，草稿仍可查看/编辑；
- [ ] Android Chrome：键盘下标题、textarea、继续、完成可用；地址栏单独收展不误入 keyboard inset；
- [ ] iPhone Safari（如可用）：同上，并验证键盘关闭完整恢复；
- [ ] 系统/浏览器 Back：focused → default execution → tasks → home；
- [ ] Tab 切换、任务完成、退出执行后不遗留 focused UI/listener，草稿按会话结束清理；
- [ ] 不显示聊天历史、气泡、发送箭头或聊天 Tab。

### A5. C3-A 提交建议

```text
feat: add focused task feedback mode
```

只有 ChatGPT 批准、Review 与设备验收通过后，才能逐个暂存 A1/A2、提交和 push。

---

## 5. C3-B：我的编辑区与 Sheet 锁滚动

### B1. `MeFeedbackPage.tsx`

**允许做：**

1. 保留当前 `feedback`、`hint`、`isSubmitted` 状态本地所有权，成功态 JSX 和 `onBack` 语义不改。
2. 新增明确 refs：

```ts
const feedbackScrollRef = useRef<HTMLDivElement | null>(null);
const feedbackFocusTargetRef = useRef<HTMLDivElement | null>(null);
const feedbackTextareaRef = useRef<HTMLTextAreaElement | null>(null);
```

3. 输入态 PaperCard 保持 `min-h-0 flex-1 overflow-hidden`；其内部新增唯一 `overflow-y-auto overscroll-y-contain` 滚动容器。
4. textarea 改为 `flex-1 min-h-[280px] max-h-[360px] resize-none`（或等价 CSS），`maxLength={500}`。
5. focus target 必须同时包围 textarea、提示和主按钮；textarea focus 后使用 `requestAnimationFrame` 对该 target 调用：

```ts
scrollIntoView({ block: "nearest", behavior: "auto" })
```

6. 仅在 textarea focus 期间，若 `visualViewport` 存在，监听其 resize/scroll，并在 viewport 变化后重新执行同一个 rAF reveal；同样使用 120px 阈值后才给明确滚动容器设局部 scroll-padding-bottom。blur/unmount 移除 listener 并清 local state/style。
7. 输入态主按钮文案改为 **`送出这份想法`**；成功态现有“回到我的小空间”不改。

**不允许做：**

- 新路由或第三级页面；
- 提升 state 至 MeView/page；
- body/AppShell 滚动；
- 真实反馈接口、消息历史、客服聊天；
- 改返回按钮/成功态/Me Handler。

**完成标准：**

- 390×844 编辑区约 280–360px；
- 500 字限制；
- 键盘下 textarea 与提交动作可通过唯一 card scroller 到达；
- 无双滚动、无长页面、成功态无回归。

### B2. `MeView.tsx`

**允许做：**

1. 从 React 引入 `useRef`。
2. 创建：

```ts
const scrollContainerRef = useRef<HTMLDivElement | null>(null);
```

3. 只将 ref 绑定到 home 分支原有的 `overflow-y-auto` 列表 div。
4. 向已存在的 MeConfirmSheet 传递 `scrollContainerRef`。
5. 原有 `me-confirm / 100`、`me-subpage / 90` 的 state、priority、isActive 检查、effect 依赖和 cleanup 必须逐字语义保持。

**不允许做：**

- 提升 `meMode` / `confirmMode`；
- 改 Me 菜单、退出/清缓存 Mock 行为、视觉文案；
- 改 BackControllerContext/page；
- 绑定 ref 到 AppShell/body/其他 Tab。

**完成标准：** Sheet 始终收到实际 Me home scroll container；离开 Me 或 Strict Mode 不造成 Handler 或 ref 错乱。

### B3. `MeConfirmSheet.tsx`

**允许做：**

1. Props 新增：

```ts
scrollContainerRef: RefObject<HTMLDivElement | null>;
```

2. 新增 effect，mount 时读取当前 ref 元素，保存：
   - `style.overflow`；
   - `style.overscrollBehavior`；
   - `scrollTop`。
3. 只锁该元素：

```ts
scrollContainer.style.overflow = "hidden";
scrollContainer.style.overscrollBehavior = "contain";
```

4. cleanup 恢复精确原 style 字符串与 scrollTop。
5. Sheet overlay DOM 必须唯一实现为 backdrop 与 section 的兄弟层：

```tsx
<div className="fixed ...">
  <button
    type="button"
    aria-label="关闭确认弹层"
    className="absolute inset-0 touch-none ..."
    onClick={onClose}
    onTouchMove={(event) => event.preventDefault()}
  />

  <section
    role="dialog"
    className="relative ... overflow-y-auto overscroll-y-contain"
  >
    ...
  </section>
</div>
```

6. overlay root 只负责定位：不得有 `touch-none` 或统一 `preventDefault`。backdrop 是唯一 `touch-none` 与 `onTouchMove(preventDefault)` 的元素；section 必须是其兄弟，绝不调用 `preventDefault`，继续自身触摸滚动。
7. Sheet dialog section 增加 `overscroll-y-contain`，保留其 own `overflow-y-auto`。

**不允许做：**

- 锁 body/html/AppShell；
- `document.querySelector`；
- 在 overlay root 或 Sheet section 上放 `touch-none` 或 `onTouchMove(preventDefault)`；
- 使用 `stopPropagation` 作为唯一滚动方案；
- 新增全局 scroll-lock utility/dependency；
- 改 Sheet 内容、文案、确认动作或角色语义。

**完成标准：**

- Sheet 打开时 Me home 背景不能滚；
- Sheet 内容超高仍可自身滚动，边界不穿透；
- backdrop/按钮/Back 关闭、clear-cache → success、连续开关、卸载与 Strict Mode 后，原 scrollTop 和 inline styles 完整恢复。

### B4. C3-B Code Review 清单

- [ ] diff 只有 B1/B2/B3 三个文件；
- [ ] MeFeedback 只有一个 card 内部 scroller；
- [ ] 280–360px、500 字、`送出这份想法` 正确；
- [ ] focus target 包含 textarea + submit，rAF reveal 的祖先真实可滚；
- [ ] focus 期 visualViewport listener/cleanup/120px threshold 局部化；
- [ ] 成功态、Me C2 Back Handler、返回行为无回归；
- [ ] MeView ref 指向 home list，非 body/AppShell；
- [ ] Sheet 保存/恢复 overflow/overscroll/scrollTop 对称；
- [ ] backdrop 与 Sheet section 为兄弟层；overlay root 不含 touch-none/preventDefault；
- [ ] touch-none 与 backdrop onTouchMove(preventDefault) 只在 backdrop；Sheet section 无 preventDefault，`overflow-y-auto overscroll-y-contain` 仍可滚；
- [ ] 超高 Sheet 滚动到边界后背景不移动；
- [ ] 没有 selector、body lock、第三方依赖、文案/Mock/服务扩大。

### B5. C3-B 用户 / 真机验收

- [ ] 375×812 / 390×844 / 430×932：编辑区与提交可达，无双滚动；
- [ ] 输入 500 字验证上限；主按钮为“送出这份想法”；
- [ ] Android Chrome、iOS Safari（如可用）键盘 focus/close 后 card 内 reveal 正确；
- [ ] 成功态仍为现有确认页，可返回我的；
- [ ] 滚动 Me home 后，打开 clear-cache/logout/success Sheet，背景不滚；
- [ ] Sheet 超高时 Sheet 自身可正常触摸滚动，滚动到边界后背景仍不移动；
- [ ] iOS Safari 连续上下滑动，backdrop 不穿透且 Sheet 自身不被 touch 策略误伤；
- [ ] 遮罩、主操作、系统 Back、模式切换、连续开关、Strict Mode、logout 卸载后 scrollTop 和样式恢复；
- [ ] C2 返回：Sheet 优先关闭，其次二级页返回 Me home。

### B6. C3-B 提交建议

```text
fix: improve mobile feedback editing and sheet locking
```

只有 C3-A 已完成提交、C3-B Review/验收/ChatGPT 批准通过后，才能逐个暂存 B1/B2/B3、提交和 push。

---

## 6. 全项目搜索与越界检查

每个子批代码完成后：

```powershell
cd C:\Dev\ai-todo

git diff --name-only $C3A_BASE_HEAD -- apps/mobile-app
# C3-B 时替换为 $C3B_BASE_HEAD

git diff --check

git diff $C3A_BASE_HEAD | Select-String -Pattern `
"popstate|pageshow|pushState|replaceState|history\.back|router\.back|manifest|apple-touch-icon|serviceWorker|Capacitor|touchmove|querySelector|document\.body|document\.documentElement"
```

解释：

- C3-A 的 `visualViewport`、C3-B 的 backdrop `touchmove` 是经本方案授权的例外；
- 其他 History / PWA / Capacitor / global DOM 项均应为零；
- C3-A 不应出现 `scrollIntoView`；C3-B 仅应在明确 focus target 使用它；
- `querySelector`、body/html lock、WebHistoryGuard/BackController 改动必须为零。

范围核验：

```powershell
# C3-A
$C3A_ALLOWED = @(
  "apps/mobile-app/components/today/TaskExecutionView.tsx",
  "apps/mobile-app/components/today/ExecutionFeedbackBox.tsx"
)
git diff --name-only $C3A_BASE_HEAD -- apps/mobile-app

# C3-B
$C3B_ALLOWED = @(
  "apps/mobile-app/components/me/MeFeedbackPage.tsx",
  "apps/mobile-app/components/me/MeView.tsx",
  "apps/mobile-app/components/me/MeConfirmSheet.tsx"
)
git diff --name-only $C3B_BASE_HEAD -- apps/mobile-app
```

任何额外文件：停止，不提交，不自行回退其他文件，报告 ChatGPT。

---

## 7. 技术验证命令

每个子批完成及任何 Follow-up 后：

```powershell
cd C:\Dev\ai-todo
npm --prefix apps/mobile-app run lint
npm --prefix apps/mobile-app run build
git diff --check
git status --short --untracked-files=all
```

通过标准：lint 零 error；build 成功；TypeScript 通过；`git diff --check` 无错误；仅可存在既有 multiple lockfiles 警告。

---

## 8. Git 提交前核验

子批通过 Review、用户验收和 ChatGPT 批准后才允许提交。

```powershell
# C3-A
$C3A_BASE_HEAD = <C3-A 开始时记录的 SHA>
git diff --name-only $C3A_BASE_HEAD
git diff --check
# 只能逐个 git add 两个 A 文件

# C3-B
$C3B_BASE_HEAD = <C3-B 开始时记录的 SHA>
git diff --name-only $C3B_BASE_HEAD
git diff --check
# 只能逐个 git add 三个 B 文件
```

禁止：

```text
git add .
git add -A
git add --all
git reset --hard
git clean
git stash
```

每次 commit 后必须：

```powershell
git show --name-only --format=fuller HEAD
git status --short --untracked-files=all
```

确认只包含当前子批文件、无条件文件、无文档、无 C1/C2 文件、无长期未跟踪项。
