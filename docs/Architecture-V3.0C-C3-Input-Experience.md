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

任务反馈采用 **TaskExecutionView 内部状态驱动的三态子视图**。

```text
TaskExecutionView（同一个组件、同一 AppShell、同一路由状态）
├─ default：任务信息 + 当前小步 + 112px 反馈框 + 完成动作
├─ guide-focused：专注阅读 AI 回复 + 写下现在的情况 + 完成动作
└─ feedback-focused：专注填写反馈 + 继续陪我推进 + 完成动作
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
- 保留"继续陪我推进""送出这份想法"等动作语义；
- 不显示消息气泡、聊天记录、`messages.map()`、全局聊天入口、聊天 Tab、发送箭头或"发消息"文案；
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
| executionPresentation、feedbackDraft、键盘 inset | `TaskExecutionView` | C3-A 新增，任务会话内唯一来源 |
| 我的反馈草稿、提示、提交成功态 | `MeFeedbackPage` | 继续本地拥有 |
| `meMode`、`confirmMode`、Me 列表 ref | `MeView` | 不提升到 page.tsx |
| Sheet 锁滚动生命周期 | `MeConfirmSheet` effect | 只锁传入的真实 Me 列表容器 |
| Base/Guard / popstate / pageshow | `WebHistoryGuard` | C3 完全只读，不修改 |

### 3.3 根因

1. AppShell 外层、`main` 和内容包装层都为 `h-[100svh]` / `overflow-hidden`；`TaskExecutionView` 也为单屏 `overflow-hidden`。`ExecutionGuideCard` 内的滚动区是 feedback 的兄弟节点，不能把 textarea 滚到键盘上方。
2. `ExecutionFeedbackBox` 本地持有草稿，默认 textarea 为 80px；新需求要求默认 112px+ 默认态 preview Guide + 两种专注态。
3. AI 回复卡在默认态仅约 40%-50% 的单屏高度，长内容在小卡片内滚动，没有显式"展开"入口，用户无法进入专注阅读。
4. `MeFeedbackPage` 的 PaperCard 为 `flex-1`，但没有明确 `overflow-y-auto` 内部容器，固定 180px 编辑区与提交按钮可能在键盘下不可达。
5. MeView home 已有真正的 `overflow-y-auto` 列表；MeConfirmSheet 目前没有该元素 ref、没有保存/恢复 `scrollTop`、没有背景 `touchmove` 阻止或 overscroll containment。

---

## 4. C3-A：任务反馈专注模式架构

### 4.1 状态类型

唯一采用三枚举，保证互斥：

```ts
type ExecutionPresentation =
  | "default"
  | "guide-focused"
  | "feedback-focused";
```

TaskExecutionView 唯一持有，不提升到 page.tsx。

### 4.2 三种 presentation 的组件显隐矩阵

| 组件 | default | guide-focused | feedback-focused |
|---|---|---|---|
| 顶部 "回到任务" / "先退出" Header | ✅ | ❌ | ❌ |
| 顶部 任务执行 / task.title / 收起 Header | ❌ | ✅ | ✅ |
| ExecutionTaskCard | ✅ | ❌ | ❌ |
| ExecutionGuideCard（视觉可见） | ✅（预览 4 行） | ✅（完整展开） | ❌ |
| ExecutionGuideCard（实例挂载） | ✅ | ✅ | ✅ |
| ExecutionFeedbackBox（视觉可见） | ✅（112px） | ❌ | ✅（flex） |
| ExecutionFeedbackBox（实例挂载） | ✅ | ✅ | ✅ |
| Guide 内 "展开查看完整建议" | ✅ | ❌ | ❌ |
| "写下现在的情况" | ❌ | ✅ | ❌ |
| "继续陪我推进" | ✅ | ❌ | ✅ |
| "我完成了这一小步" | ✅ | ✅ | ✅ |

约束：

- `ExecutionFeedbackBox` 始终只有一个实例，一个 textarea DOM；永远不用 key 强制重建。
- `ExecutionGuideCard` 始终只有一个实例；永远不用 key 强制重建。
- guide-focused 和 feedback-focused 互斥，永远不同时 visual-active。
- TaskCard 仅在 default 渲染（可为 null）；focused 时完全隐藏。

### 4.3 default 态

```text
任务执行 Header（回到任务 / 先退出）
当前任务卡
当前小步 Guide — 默认预览 4 行 + "展开查看完整建议"
112px 受控反馈 textarea
继续陪我推进
我完成了这一小步
```

Guide 默认预览：

- text 最多 4 行（line-clamp-4 或 Tailwind 可用的等价实现）；
- overflow-hidden；
- 不可内部滚动；
- 存在 guide 且 isProcessing=false 时始终显示展开入口。

### 4.4 guide-focused 态

```text
任务执行 / 当前任务标题 / 收起
AI 回复大纸张卡片（完整展开，内部 overflow-y-auto）
写下现在的情况
我完成了这一小步
```

进入方式：点击默认 Guide 正文预览区域，或点击"展开查看完整建议"——两者触发的都是同一个 `onExpand` 回调，由纸卡内一个 text-left button 包装。focus 直接调用 `setExecutionPresentation("guide-focused")`。

收起：右上角"收起"按钮，或返回事件。收起后 `setExecutionPresentation("default")`。

GuideCard 在 guide-focused 下取消 line clamp，PaperCard 使用 `min-h-0 flex-1 overflow-hidden`，正文在内部 `overflow-y-auto`。

### 4.5 feedback-focused 态

```text
任务执行 / 当前任务标题 / 收起
把现在的情况告诉我
同一个受控 textarea（最小 112px，长文本仅在 textarea 内滚动）
继续陪我推进
我完成了这一小步
```

进入方式：

- 从 default：用户点击 textarea → openFeedbackFocus。
- 从 guide-focused：用户点击"写下现在的情况" → 先用 `setExecutionPresentation("feedback-focused")`，再通过 `requestAnimationFrame` 聚焦 `feedbackTextareaRef`；不得简单使用 `?.focus()` 在布局同步前执行。

`requestAnimationFrame` 管理：

```ts
const focusFrameRef = useRef<number | null>(null);

// 启动前先取消旧 frame
if (focusFrameRef.current !== null) cancelAnimationFrame(focusFrameRef.current);
focusFrameRef.current = requestAnimationFrame(() => {
  focusFrameRef.current = null;
  feedbackTextareaRef.current?.focus();
});
```

task.id 变化、收起、presentation 再次改变和 unmount 时必须取消残留 frame。

**视觉约束：** guide-focused 和 feedback-focused 永远不同时 visual-active。ExecutionGuideCard 和 ExecutionFeedbackBox 的实例都在 DOM 中挂载，只有可见性 wrapper 按 presentation 切换；没有两个 textarea、没有两个 GuideCard。

### 4.6 组件接口

`TaskExecutionView` 是唯一协调者，持有三枚举状态和所有 helper refs：

```ts
type ExecutionPresentation = "default" | "guide-focused" | "feedback-focused";

const [executionPresentation, setExecutionPresentation] = useState<ExecutionPresentation>("default");
const [feedbackDraft, setFeedbackDraft] = useState("");
const [keyboardInset, setKeyboardInset] = useState(0);

const executionRootRef = useRef<HTMLDivElement | null>(null);
const feedbackTextareaRef = useRef<HTMLTextAreaElement | null>(null);
const baselineViewportHeightRef = useRef<number | null>(null);
const executionPresentationRef = useRef<ExecutionPresentation>("default");
const viewportCleanupRef = useRef<(() => void) | null>(null);
const focusFrameRef = useRef<number | null>(null);
```

`ExecutionFeedbackBox` 受控组件：

```ts
interface ExecutionFeedbackBoxProps {
  value: string;
  focused: boolean;
  isProcessing: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onSubmit: (feedback: string) => void | Promise<void>;
}
```

不接受 `onCollapse`，不渲染"收起"，不改变 presentation，不注册 Back Handler。

`ExecutionGuideCard`：

```ts
interface ExecutionGuideCardProps {
  guide: CompanionStep | null;
  isProcessing: boolean;
  hasSubmittedFeedback: boolean;
  focused: boolean;
  onExpand: () => void;
}
```

`focused` 和 `onExpand` 为必填 Prop。组件不新增内部 useState，不复制 guide，不管理 presentation，不注册 Back Handler，不渲染"收起"，不渲染"写下现在的情况"。

展开入口结构：

- 预览正文与底部"展开查看完整建议"共同包裹在一个 `type="button"` 的 `text-left` 按钮内；
- 按钮仅在有 guide 且 `isProcessing === false` 时显示；
- 嵌套按钮禁止出现。

### 4.7 草稿规则

| 事件 | 状态转换 | 草稿 |
|---|---|---|
| 点击 textarea | default → feedback-focused | 保留 |
| 点击 Guide 预览 | default → guide-focused | 保留 |
| 点击"写下现在的情况" | guide-focused → feedback-focused | 保留 |
| 点击"收起" | guide/feedback-focused → default | 保留 |
| textarea blur / 键盘"完成" | 保持 feedback-focused | 保留 |
| 提交成功 | feedback-focused → default | 保留 |
| 提交失败 | 保持 feedback-focused | 保留 |
| 切换 task.id | → default + reset | 清空 |
| 任务完成 / Tab 切换 / 登出 | 卸载 | 清空 |

guide-focused 与 feedback-focused 之间切换不清 `feedbackDraft`。

### 4.8 visualViewport 所有权与键盘算法

只有 `feedbackPresentationRef.current === "feedback-focused"`（而非 guide-focused 或 default）且 textarea 处于 activeFocus 时注册 `visualViewport.resize` / `scroll`。聚焦基线、120px 阈值算法和局部 `--task-feedback-keyboard-inset` 消费规则与 C3-A 初次 Review 通过的实现保持一致。

### 4.9 BackController 集成

C2 的 WebHistoryGuard、Base/Guard、唯一 popstate/pageshow 监听器一律不改。

两个 C3-A Handler，三枚举天然保证互斥：

| id | priority | 条件 | 行为 |
|---|---:|---|---|
| `task-feedback-focus` | 95 | `executionPresentation === "feedback-focused"` | 收起、清键盘 UI、保留草稿，返回 true |
| `task-guide-focus` | 94 | `executionPresentation === "guide-focused"` | 收起、保留草稿，返回 true |

最终顺序：

```text
100 me-confirm
 95 task-feedback-focus
 94 task-guide-focus
 90 me-subpage
 80 footprint-detail
 60 page-auth-flow
 50 page-authenticated-root
```

返回链：

```text
guide-focused → default execution → tasks → home
feedback-focused → default execution → tasks → home
```

---

## 5. C3-B：我的反馈大编辑区与 Sheet 锁滚动

（内容与本方案初次审查通过时一致，保持不变。）

---

## 6. BackController 集成总结

（紧上方 §4.9 已包含两个 C3-A Handler；C3-B 不新增 Handler；继续保留 MeView 的 `me-confirm / 100` 与 `me-subpage / 90` 及其 isActive 防护和 cleanup。）

---

## 7. Safe Area、BottomTabBar 与宽度策略

- C1 的 Safe Area 变量、AppShell 高度模型和 BottomTabBar 保持只读。
- C3 不修改 BottomTabBar、AppShell、tailwind.config.ts 或全局 Safe Area reserve。
- 三种 presentation 都必须在现有 `h-[100svh]` 约束内完成；feedback-focused 仅使用局部键盘 inset 调整底部空间，不扩展页面高度。
- 375×812：优先保证 focused 标题、textarea、继续与完成动作；内部 textarea 可滚动。
- 390×844：主视觉验收；Me editor 约 280–360px。
- 430×932：不出现异常大空白，卡片保持 max mobile 宽度。
- 横屏仍遵循 C1 的既有提示；C3 不创建第二个横屏系统。

---

## 8. Android / iOS 差异与 GoalInputCard

| 场景 | Android Chrome | iPhone Safari / 等价 iOS |
|---|---|---|
| `visualViewport` | 用聚焦基线 + 120px 阈值验证地址栏行为 | 用同一算法验证软键盘、offsetTop 与恢复 |
| 无 visualViewport | focus 直接进入 feedback-focused fallback | 同样测试，但预期 Safari 通常支持 visualViewport |
| Me editor | 验证内部容器 reveal 与提交可达 | 同样验证，尤其键盘收起后的 scroll 恢复 |
| Sheet | 验证背景 lock、连续开关 | 重点验证 backdrop touchmove 与 overscroll 不穿透 |

`GoalInputCard` 经过代码审计位于 Today 首页上部，当前无可复现遮挡证据。**C3 初始范围明确不修改。** 只有提供设备、浏览器、复现步骤与截图/录屏后才允许独立 Follow-up；`RegisterPage` 同理。

---

## 9. C3 拆分结论

**明确结论：C3-A → C3-B，严格串行，不可并行。**

| 子批 | 目的 | 代码文件 | 独立门禁 |
|---|---|---|---|
| C3-A | 任务反馈默认放大、AI guide 专注阅读、反馈专注填写、键盘适配与 Back Handler | TaskExecutionView、ExecutionFeedbackBox、ExecutionGuideCard | draft/focus/back/Android+iOS 键盘验证 |
| C3-B | 我的大编辑区、内部键盘滚动、Sheet 背景锁 | MeFeedbackPage、MeView、MeConfirmSheet | editor reachability、scroll lock/touchmove/Strict Mode 验证 |

---

## 10. 文件影响范围

### C3-A 修改（3 个）

1. `apps/mobile-app/components/today/TaskExecutionView.tsx`
2. `apps/mobile-app/components/today/ExecutionFeedbackBox.tsx`
3. `apps/mobile-app/components/today/ExecutionGuideCard.tsx`

### C3-B 修改（3 个）

1. `apps/mobile-app/components/me/MeFeedbackPage.tsx`
2. `apps/mobile-app/components/me/MeView.tsx`
3. `apps/mobile-app/components/me/MeConfirmSheet.tsx`

### 条件文件（初始施工禁止）

- `apps/mobile-app/components/today/GoalInputCard.tsx`
- `apps/mobile-app/components/auth/RegisterPage.tsx`

### 只读参考

- `app/page.tsx`、`contexts/BackControllerContext.tsx`
- `components/shell/AppShell.tsx`、`BottomTabBar.tsx`
- `ExecutionTaskCard.tsx`
- `app/globals.css`、UI primitives、C1/C2 文档

### 明确禁止

所有 `src/**`、根 API Route、Supabase、migration、prompts、真实 Auth、services/mock data、types、根配置、PWA/Manifest/Service Worker/Capacitor、路由、新 AppShell、聊天组件/历史/Tab、C4/V3.1 文件。

---

## 11. 风险矩阵

| 级别 | 风险 | 缓解 / 阻断条件 |
|---|---|---|
| P0 | focus 切换导致 textarea 重挂载、失焦或丢草稿 | textarea DOM 必须稳定；C3-A Review 验证 |
| P0 | guide-focused → feedback-focused 时 textarea 隐藏，focus 失败 | 使用 rAF + ref-based 聚焦，清旧 frame，校验 activeElement |
| P0 | blur 在提交按钮 click 前收起 feedback-focused 导致 click 丢失 | blur 只清键盘 UI |
| P0 | focused 时间时 Guide 和 Feedback 争抢 flex 空间，核心动作挤出 | 三枚举互斥 + 视觉 wrapper 显隐矩阵；同一时刻只有一个 flex-1 区域 |
| P0 | Back 跳过默认执行页直接进入任务列表 | 两个 Handler 先回 default，再让底层 handler 处理逐级返回 |
| P0 | Sheet cleanup 后页面永久不可滚动 | 保存并精确恢复 inline styles/scrollTop；Strict Mode 验证 |
| P1 | 默认 Guide 仍是内部小框滚动 | line-clamp-4 + overflow-hidden，Focus Review 验证 |
| P1 | 展开入口判断不稳定 | guide 非 null 且非 loading 即显示，不依赖 scrollHeight/ResizeObserver |
| P1 | 地址栏收展误判键盘 | 基线 + 120px 阈值；仅 feedback-focused 时监听 visualViewport |
| P1 | keyboard 仍遮挡核心动作 | 局部 inset 必须实际参与布局 |
| P1 | 双实例 / key 导致 DOM 重建 | 每个卡片只有一个组件实例，无 key 强制重建；Review 校验 |
| P1 | Me 双滚动 / Sheet 穿透 / backdrop 触摸策略误伤 | 兄弟层、精确 ref、touch-none/preventDefault 仅在 backdrop |
| P1 | C2 Handler 或 WebHistoryGuard 回归 | 不修改 Context/page |
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
5. C3-A：default Guide 仅 4 行预览且不能内部滚动；展开入口始终可见；guide-focused 完整阅读；"写下现在的情况"点击一次聚焦 textarea；两种 focused 返回都先回 default；300 字限制；draft 保留；成功回 default 更新 Guide；Keyboard 关闭后不退出 focused。
6. C3-B：500 字限制、编辑与提交可达、成功态不回归、Sheet 背景不可滚、backdrop/section 兄弟层、Sheet 自身可滚、touchmove、scrollTop/样式恢复、连续开关/Strict Mode。
7. 无聊天化、无双重 AppShell、无 Tab/品牌/页面层级变化；
8. 条件文件无真机证据时保持零修改。

两子批均经 ChatGPT 批准、独立提交并 push，且 tracked 工作区干净后，C3 才视为完成；C4 还受图标源视觉闸门单独阻断。
