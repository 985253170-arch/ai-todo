# V3.0C C3 架构方案：输入体验、键盘适配与滚动锁

> **状态**：ChatGPT 审查通过；C3 架构已锁定，代码施工仍需单独授权
>
> **代码基线**：`5af8b67e0dbe09f01b518726970cdb0dc354091f` — `feat: add mobile back controller`
>
> **前置阶段**：C1 Safe Area / 触控 ✅；C2 BackController / Web History ✅
>
> **范围**：当前任务受控短反馈、我的反馈编辑区、键盘适配、MeConfirmSheet 精确滚动锁
>
> **不进入范围**：C4 PWA、V3.1 后端连接、路由化、全局聊天、真实 AI 请求

---

## 1. 背景与用户问题

C3 解决已确认的两个写作体验问题，同时完成 V3.0C 原计划中的键盘适配与 Sheet 背景滚动锁。

1. `ExecutionFeedbackBox` 默认 textarea 只有 80px，位于单屏任务执行页的底部；用户难以舒适输入当前进度、卡点、草稿、时间约束或对当前小步的判断。
2. `MeFeedbackPage` 已经是二级页，但 textarea 只有 180px，编辑区没有占据页面主要空间，也没有明确的可控滚动祖先，键盘可能遮住提交动作。
3. `MeConfirmSheet` 覆盖在 MeView 的真实列表滚动容器之上，却没有精确锁定该容器，iOS 手势可能穿透到背景。

C3 的结果必须让用户在手机上安静地写下有限、当前语境内的内容，而不是把清行变成聊天软件。

---

## 2. 产品判断与明确边界

### 2.1 唯一推荐方案

任务反馈采用 **TaskExecutionView 内部状态驱动的专注填写子视图**。

```text
TaskExecutionView（同一个组件、同一 AppShell、同一路由状态）
├─ 默认执行态：任务信息 + 当前小步 + 112px 反馈框 + 完成动作
└─ 专注填写态：精简任务上下文 + 同一个 textarea + 收起 + 继续推进 + 完成动作
```

不采用：

- 新 Next.js 路由；
- 第二套 AppShell；
- 覆盖系统的纯白聊天页；
- 通过 DOM 查询或 CSS 后代猜测来操控父/兄弟组件；
- 将任务执行页改造成无边界长网页；
- 仅靠 `scrollIntoView` 解决任务反馈键盘遮挡。

### 2.2 不做聊天软件

C3 允许的仅是**当前任务内、上限明确、无历史列表的受控短反馈**：

- 任务反馈 textarea 最大 300 字；
- 我的想法 textarea 最大 500 字；
- 保留“继续陪我推进”“送出这份想法”等动作语义；
- 不显示消息气泡、聊天记录、`messages.map()`、全局聊天入口、聊天 Tab、发送箭头或“发消息”文案；
- AI 仍只在当前任务中替换当前指引，不接真实 AI/后端。

### 2.3 视觉边界

保持暖米白、深蓝、纸张卡片、大圆角、柔和阴影、温柔低压力气质。390×844 为主验收视口；任务执行页仍在 AppShell 内，底部四 Tab（今日 / 足迹 / 成长 / 我的）结构不被移除、改名或替换。

软键盘可能物理遮住 fixed TabBar；C3 的硬验收是键盘打开时当前任务标题、textarea、继续推进、完成动作可见或可操作，键盘关闭后 TabBar 必须完整恢复。C3 不要求把 TabBar 跟随键盘上移。

---

## 3. 当前真实代码结构与根因

### 3.1 渲染树

```text
Page
└─ BackControllerProvider
   └─ HomeContent
      └─ AppShell
         ├─ main > 内容包装层（均 overflow-hidden）
         │  └─ activeTab === "today"
         │     └─ TaskExecutionView（todayMode === "execution"）
         │        ├─ Header
         │        ├─ ExecutionTaskCard
         │        ├─ ExecutionGuideCard（内部 guide 内容可滚动）
         │        ├─ ExecutionFeedbackBox
         │        └─ 完成当前小步按钮
         └─ BottomTabBar（fixed）
```

```text
MeView
├─ meMode === "home"
│  ├─ Header
│  ├─ 真实列表滚动容器（overflow-y-auto）
│  └─ confirmMode !== null → MeConfirmSheet
└─ meMode === "feedback"
   └─ MeFeedbackPage
      ├─ Header
      └─ PaperCard（当前没有内部滚动容器）
```

### 3.2 状态所有权

| 状态 | 当前/最终所有者 | C3 原则 |
|---|---|---|
| `activeTab`、`todayMode`、执行任务 id | `HomeContent` | 不提升更多局部状态 |
| 任务 guide、loading、已提交标记 | `TaskExecutionView` | 继续本地拥有 |
| 任务反馈草稿、专注态、键盘 inset | `TaskExecutionView` | C3-A 新增，任务会话内唯一来源 |
| 我的反馈草稿、提示、提交成功态 | `MeFeedbackPage` | 继续本地拥有 |
| `meMode`、`confirmMode`、Me 列表 ref | `MeView` | 不提升到 page.tsx |
| Sheet 锁滚动生命周期 | `MeConfirmSheet` effect | 只锁传入的真实 Me 列表容器 |
| Base/Guard / popstate / pageshow | `WebHistoryGuard` | C3 完全只读，不修改 |

### 3.3 根因

1. AppShell 外层、`main` 和内容包装层都为 `h-[100svh]` / `overflow-hidden`；`TaskExecutionView` 也为单屏 `overflow-hidden`。`ExecutionGuideCard` 内的滚动区是 feedback 的兄弟节点，不能把 textarea 滚到键盘上方。
2. `ExecutionFeedbackBox` 本地持有草稿，默认 textarea 为 80px；专注填写或组件重挂载会使草稿策略无法协调。
3. `MeFeedbackPage` 的 PaperCard 为 `flex-1`，但没有明确 `overflow-y-auto` 内部容器，固定 180px 编辑区与提交按钮可能在键盘下不可达。
4. MeView home 已有真正的 `overflow-y-auto` 列表；MeConfirmSheet 目前没有该元素 ref、没有保存/恢复 `scrollTop`、没有背景 `touchmove` 阻止或 overscroll containment。

---

## 4. C3-A：任务反馈专注模式架构

### 4.1 默认态

默认 textarea 高度锁定为 **112px**；最大 300 字。它仍位于当前任务执行页，不创建聊天界面。

```text
默认态
任务执行 Header
当前任务卡
当前小步 Guide
112px 受控反馈 textarea
继续陪我推进
我完成了这一小步
```

### 4.2 专注填写态

点击 textarea 后，同一 `TaskExecutionView` 进入专注态：

```text
专注态
任务执行 / 当前任务标题 / 收起
把现在的情况告诉我
同一个受控 textarea（最小 112px，长文本仅在 textarea 内滚动）
继续陪我推进
我完成了这一小步
```

完整任务卡与 Guide 在视觉上隐藏，以腾出写作空间；它们不应被重排、重新挂载或变成聊天历史。当前任务标题必须始终显示。收起或提交成功后回到默认执行态，Guide 仍由原状态保留并在成功后更新。

### 4.3 组件接口

`TaskExecutionView` 是唯一协调者，新增本地状态：

```ts
type FeedbackPresentation = "default" | "focused";

const [feedbackPresentation, setFeedbackPresentation] = useState<FeedbackPresentation>("default");
const [feedbackDraft, setFeedbackDraft] = useState("");
const [keyboardInset, setKeyboardInset] = useState(0);
```

refs：

```ts
const executionRootRef = useRef<HTMLDivElement | null>(null);
const feedbackTextareaRef = useRef<HTMLTextAreaElement | null>(null);
const baselineViewportHeightRef = useRef<number | null>(null);
```

`ExecutionFeedbackBox` 改为受控组件，最低接口：

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

`TaskExecutionView` 是 `feedbackPresentation`、`feedbackDraft`、`collapseFeedbackFocus()`、`task-feedback-focus / 95` 和 visualViewport 生命周期的唯一所有者。“收起”只位于**专注态 TaskExecutionView 顶部标题区右侧**；`ExecutionFeedbackBox` 只渲染 textarea、继续推进按钮及 loading/disabled 状态，不接收 `onCollapse`、不渲染“收起”、不改变 presentation、不注册 Back Handler。

### 4.4 草稿规则

| 事件 | 专注态 | 草稿 |
|---|---|---|
| 点击 textarea | 进入 focused | 保留 |
| 点击“收起” | 回 default | 保留 |
| focused 状态中的 textarea blur / 键盘“完成” / 手动收起键盘 | 保持 focused，仅清键盘 UI | 保留 |
| 提交成功 | 回 default、更新 Guide | 保留 |
| 提交失败 | 保持 focused | 保留 |
| 切换 task.id | reset | 清空，防止跨任务泄漏 |
| 任务完成 / 退出执行 / Tab 切换 / 登出 | TaskExecutionView 卸载 | 清空，保持既有执行会话边界 |

C3 不将草稿提升至 `page.tsx`，不使用 localStorage，不承诺跨 Tab、跨退出或跨刷新保留。

### 4.5 visualViewport 所有权与键盘算法

只有 `TaskExecutionView` 在**任务反馈 textarea 已 focused**期间监听 `window.visualViewport` 的 `resize` / `scroll`。不监听 `window.resize`，不创建共享全局键盘监听器。

聚焦时记录基线：

```ts
const baselineHeight = window.visualViewport?.height ?? window.innerHeight;
```

计算：

```ts
const viewportDrop = Math.max(0, baselineHeight - visualViewport.height);
const rawInset = Math.max(
  0,
  window.innerHeight - visualViewport.height - visualViewport.offsetTop,
);
const nextInset = viewportDrop >= 120 ? rawInset : 0;
```

120px 是锁定初始阈值，用来避免地址栏收展被误判为键盘。`nextInset` 仅写到 `executionRootRef` 的局部 `--task-feedback-keyboard-inset`；focused 布局使用本地 padding/bottom space 消费该数值。不得写入 `document.documentElement`、body 或 `globals.css` 全局值。

当 `visualViewport` 不存在时，focus 仍进入同一 focused 布局，但 inset 为 0；不以 `scrollIntoView` 或全页滚动替代。

当 textarea blur、键盘“完成”、手动收起键盘或 viewport 高度恢复时，**只**移除两个 visualViewport 监听器、清理局部 CSS variable、清空 inset/baseline；不得改变 `feedbackPresentation`、清草稿、卸载 textarea 或调用 BackController。

focused → default 只允许由：用户点击顶部标题区右侧“收起”、`task-feedback-focus / 95` 消费系统/浏览器返回、反馈提交成功、`task.id` 变化或 `TaskExecutionView` 卸载触发。提交按钮导致 textarea 先 blur 时，focused UI 必须保持挂载直到 click 正常执行；成功后才退出 default。提交失败保持 focused，允许继续编辑和再次提交。

不得用固定 300ms 定时器作为唯一机制。

---

## 5. C3-B：我的反馈大编辑区与 Sheet 锁滚动

### 5.1 MeFeedbackPage 大编辑区

保持二级页与现有成功态，不新建第三级页。

输入态结构锁定为：

```text
MeFeedbackPage root（overflow-hidden）
├─ Header（shrink-0）
└─ PaperCard（flex-1 / min-h-0 / overflow-hidden）
   └─ 内部受控滚动容器（overflow-y-auto / overscroll-y-contain）
      ├─ 标题与辅助文案
      └─ focus target
         ├─ textarea（flex-1、min 280px、max 360px）
         ├─ 校验提示
         └─ “送出这份想法”
```

textarea：最大 500 字，`resize-none`，优先按可用剩余空间扩展；390×844 下视觉高度应约为 280–360px。提交成功后继续使用现有“收到啦”状态。

聚焦时，通过 `requestAnimationFrame` 让包含 textarea 与提交按钮的 focus target 在**明确的内部容器**中 `scrollIntoView({ block: "nearest", behavior: "auto" })`。必要时仅在 focus 期间监听本组件的 visualViewport resize/scroll，再次执行相同 reveal；用同一 120px 阈值设置局部 scroll padding。不得让 AppShell/body 变成滚动页，不得产生双滚动条。

### 5.2 MeConfirmSheet 精确锁定

`MeView` 在现有 home 列表 `overflow-y-auto` 元素上持有：

```ts
const scrollContainerRef = useRef<HTMLDivElement | null>(null);
```

并向 Sheet 传递：

```ts
<MeConfirmSheet scrollContainerRef={scrollContainerRef} ... />
```

Sheet mount effect：

1. 获取 `scrollContainerRef.current`；
2. 保存原 inline `overflow`、`overscrollBehavior`、当前 `scrollTop`；
3. 仅将该真实列表容器设为 `overflow: hidden`、`overscrollBehavior: contain`；
4. cleanup 恢复原 inline 值与保存的 `scrollTop`。

Sheet overlay DOM 唯一锁定为 backdrop 与 dialog 的兄弟层：

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

overlay root 只负责定位，不能使用 `touch-none` 或统一 `preventDefault`。`touch-none` 与 `onTouchMove(event.preventDefault())` 只能在 backdrop；Sheet section 必须是 backdrop 的兄弟元素，绝不调用 `preventDefault`，继续自身滚动并通过 `overscroll-y-contain` 避免在边界穿透背景。backdrop 点击仍只关闭 Sheet，Sheet 的角色、文案、按钮与确认逻辑不变。

禁止锁 body、AppShell、其他 Tab 容器、`document.querySelector`、`stopPropagation` 作为唯一方案和第三方 scroll-lock 库。

连续开关、clear-cache → success 内容切换、C2 `me-confirm` 返回关闭以及 Strict Mode mount/cleanup 都必须保持样式和位置恢复对称。

---

## 6. BackController 集成

C2 的 WebHistoryGuard、Base/Guard、唯一 popstate/pageshow 监听器一律不改。

新增 C3-A Handler：

| id | priority | 条件 | 行为 |
|---|---:|---|---|
| `task-feedback-focus` | 95 | `feedbackPresentation === "focused"` | 复用收起逻辑，blur、清理键盘 UI、保留草稿，返回 true |

最终顺序：

```text
100 me-confirm
 95 task-feedback-focus
 90 me-subpage
 80 footprint-detail
 60 page-auth-flow
 50 page-authenticated-root
```

focused 以外该 Handler 返回 false。系统/浏览器返回链固定为：

```text
专注填写 → 默认任务执行页 → 任务列表 → 今日首页
```

C3-B 不新增 Handler；保留 MeView 的 `me-confirm / 100` 与 `me-subpage / 90`、`isActive` 防护和 cleanup。

---

## 7. Safe Area、BottomTabBar 与宽度策略

- C1 的 Safe Area 变量、AppShell 高度模型和 BottomTabBar 保持只读。
- C3 不修改 BottomTabBar、AppShell、tailwind.config.ts 或全局 Safe Area reserve。
- 默认 / focused 任务布局都必须在现有 `h-[100svh]` 约束内完成；focused 仅使用局部键盘 inset，不扩展页面高度。
- 375×812：优先保证 focused 标题、textarea、继续与完成动作；内部 textarea 可滚动。
- 390×844：主视觉验收；Me editor 约 280–360px。
- 430×932：不出现异常大空白，卡片保持 max mobile 宽度。
- 横屏仍遵循 C1 的既有提示；C3 不创建第二个横屏系统。

---

## 8. Android / iOS 差异与 GoalInputCard

| 场景 | Android Chrome | iPhone Safari / 等价 iOS |
|---|---|---|
| `visualViewport` | 用聚焦基线 + 120px 阈值验证地址栏行为 | 用同一算法验证软键盘、offsetTop 与恢复 |
| 无 visualViewport | focus 直接进入 focused fallback | 同样测试，但预期 Safari 通常支持 visualViewport |
| Me editor | 验证内部容器 reveal 与提交可达 | 同样验证，尤其键盘收起后的 scroll 恢复 |
| Sheet | 验证背景 lock、连续开关 | 重点验证 backdrop touchmove 与 overscroll 不穿透 |

`GoalInputCard` 经过代码审计位于 Today 首页上部，当前无可复现遮挡证据。**C3 初始范围明确不修改。** 只有提供设备、浏览器、复现步骤与截图/录屏后才允许独立 Follow-up；`RegisterPage` 同理。

---

## 9. C3 拆分结论

**明确结论：C3-A → C3-B，严格串行，不可并行。**

| 子批 | 目的 | 代码文件 | 独立门禁 |
|---|---|---|---|
| C3-A | 任务反馈默认放大、专注填写态、键盘与 Back Handler | TaskExecutionView、ExecutionFeedbackBox | draft/focus/back/Android+iOS 键盘验证 |
| C3-B | 我的大编辑区、内部键盘滚动、Sheet 背景锁 | MeFeedbackPage、MeView、MeConfirmSheet | editor reachability、scroll lock/touchmove/Strict Mode 验证 |

理由：两域没有共享源文件或状态；C3-A 风险集中于 keyboard/focus/history handler，C3-B 风险集中于内部滚动与 Sheet cleanup。拆分可分别 Review、真机验收、提交，避免累计 diff 掩盖问题。

---

## 10. 文件影响范围

### C3-A 修改

1. `apps/mobile-app/components/today/TaskExecutionView.tsx`
2. `apps/mobile-app/components/today/ExecutionFeedbackBox.tsx`

### C3-B 修改

1. `apps/mobile-app/components/me/MeFeedbackPage.tsx`
2. `apps/mobile-app/components/me/MeView.tsx`
3. `apps/mobile-app/components/me/MeConfirmSheet.tsx`

### 条件文件（初始施工禁止）

- `apps/mobile-app/components/today/GoalInputCard.tsx`
- `apps/mobile-app/components/auth/RegisterPage.tsx`

### 只读参考

- `app/page.tsx`、`contexts/BackControllerContext.tsx`
- `components/shell/AppShell.tsx`、`BottomTabBar.tsx`
- `ExecutionTaskCard.tsx`、`ExecutionGuideCard.tsx`
- `app/globals.css`、UI primitives、C1/C2 文档

### 明确禁止

所有 `src/**`、根 API Route、Supabase、migration、prompts、真实 Auth、services/mock data、types、根配置、PWA/Manifest/Service Worker/Capacitor、路由、新 AppShell、聊天组件/历史/Tab、C4/V3.1 文件。

---

## 11. 风险矩阵

| 级别 | 风险 | 缓解 / 阻断条件 |
|---|---|---|
| P0 | focus 切换导致 textarea 重挂载、失焦或丢草稿 | textarea DOM 必须稳定；C3-A Review 验证 |
| P0 | blur 在提交按钮 click 前收起 focused 视图，导致提交点击丢失 | blur 只清键盘 UI；只有收起、Back、提交成功、task.id 变化或 unmount 可退出 presentation |
| P0 | Back 跳过默认执行页直接进入任务列表 | `task-feedback-focus / 95` 必须 first-consume focused 状态 |
| P0 | Sheet cleanup 后页面永久不可滚动 | 保存并精确恢复 inline styles/scrollTop；Strict Mode 验证 |
| P1 | 地址栏收展误判键盘 | focus 基线 + 120px 阈值；Android/iOS 真机验证 |
| P1 | keyboard 仍遮挡核心动作 | focused 局部 inset 必须实际影响布局；验收核心动作可达 |
| P1 | Me 双滚动 / Sheet 穿透 | 仅 card 内部滚动；ref 精确锁 Me 列表；overlay containment |
| P1 | backdrop 触摸策略误伤 Sheet 自身滚动 | backdrop 与 section 必须为兄弟；touch-none/preventDefault 仅在 backdrop；section 可滚 |
| P1 | C2 Handler 或 WebHistoryGuard 回归 | C3 不修改 Context/page；回归完整优先级 |
| P1 | 无证据扩大 GoalInput 范围 | 条件文件默认零 diff |
| P2 | 个别设备键盘 / safe-area 间距差异 | 375/390/430 + Android/iOS 实机记录 |
| P2 | 既有 multiple lockfiles warning | 仅记录，不在 C3 修复 |

---

## 12. 验收出口

C3-A 与 C3-B 各自都必须通过：

1. 精确文件范围、lint、build、TypeScript、`git diff --check`；
2. Claude Code Code Review，P0/P1 = 0；
3. 375×812、390×844、430×932 视觉检查；
4. Android Chrome 真机；iOS Safari 如设备可用；
5. C3-A：300 字限制、focused draft 保留、收起、成功返回默认态、Back 链、地址栏误判、键盘关闭后仍保持 focused、直接点击提交不丢 click、键盘 UI 清理；
6. C3-B：500 字限制、编辑与提交可达、成功态不回归、Sheet 背景不可滚、backdrop/section 兄弟层、Sheet 自身可滚、touchmove、scrollTop/样式恢复、连续开关/Strict Mode；
7. 无聊天化、无双重 AppShell、无 Tab/品牌/页面层级变化；
8. 条件文件无真机证据时保持零修改。

两子批均经 ChatGPT 批准、独立提交并 push，且 tracked 工作区干净后，C3 才视为完成；C4 还受图标源视觉闸门单独阻断。
