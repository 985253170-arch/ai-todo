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

### C3-A 唯一允许修改（3 个）

1. `apps/mobile-app/components/today/TaskExecutionView.tsx`
2. `apps/mobile-app/components/today/ExecutionFeedbackBox.tsx`
3. `apps/mobile-app/components/today/ExecutionGuideCard.tsx`

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

`app/page.tsx`、`contexts/BackControllerContext.tsx`、AppShell、BottomTabBar、ExecutionTaskCard、globals.css、tailwind.config.ts、UI primitives、C1/C2 文档。

---

## 4. C3-A：任务反馈专注模式（含 Follow-up：AI 回复卡专注阅读模式）

C3-A 初始实施文件为 TaskExecutionView + ExecutionFeedbackBox（已完成初次 Review）；本次 Follow-up 在此基础上增加 ExecutionGuideCard 的专注阅读模式，并将 `FeedbackPresentation` 二枚举升级为 `ExecutionPresentation` 三枚举。

---

### A1. `TaskExecutionView.tsx` — 状态升级为三枚举

**初始 C3-A 已完成状态的搬入。** Follow-up 新增的修改仅限以下步骤：

**做：**

1. 将 `FeedbackPresentation` 类型重命名为 `ExecutionPresentation`，值改为 `"default" | "guide-focused" | "feedback-focused"`。
2. 重命名 `feedbackPresentation` → `executionPresentation`，`feedbackPresentationRef` → `executionPresentationRef`；Ref 类型同步为 `RefObject<ExecutionPresentation>`。
3. 新增 `openGuideFocus` — 设置 `executionPresentationRef.current = "guide-focused"` 和 `setExecutionPresentation("guide-focused")`。
4. 新增 `collapseGuideFocus` — 设置 ref 和 state 为 `"default"`，不修改 draft。
5. `collapseFeedbackFocus` 改为回到 `"default"`（保持不变，语义一致）。
6. 新增 `focusFrameRef = useRef<number | null>(null)`，在 presentation 变化、task.id 变化和 unmount 时 cancel 残留 frame。
7. `openFeedbackFocus` 改为设置 `ref/state = "feedback-focused"` 然后调用 `startViewportTracking`。
8. 所有现有 `feedbackPresentation` 引用替换为 `executionPresentation`。

**禁止：** 修改 `feedbackDraft` 逻辑、visualViewport 监听算法、`backController` register/unregister 语义。

---

### A2. `TaskExecutionView.tsx` — 三种 presentation 渲染与 flex 约束

**做：**

1. default Header 保持不变（回到任务 / 先退出 + 陪你走这一步）。
2. guide-focused 和 feedback-focused 共用专注态顶部：任务执行 / task.title / 收起（收起按钮组件相同，click 调用当前 presentation 对应的 collapse 函数）。
3. TaskCard 仅在 `executionPresentation === "default"` 渲染。
4. 保留 `!isFeedbackFocused` 条件隐藏 GuideCard 视觉区域（但组件实例保留）。
5. 将 `isFeedbackFocused` 替换为更通用的 `needsCompactHeader` 判断，或直接按三枚举逐个分支。
6. guide-focused 时显示 `ExecutionGuideCard` 为 `focused={true}`。
7. guide-focused 时在 GuideCard 之后渲染独立的 `"写下现在的情况"` PrimaryButton：

```tsx
<PrimaryButton
  className="shrink-0 min-h-touch py-3 text-sm"
  onClick={() => {
    setExecutionPresentation("feedback-focused");
    if (focusFrameRef.current !== null) cancelAnimationFrame(focusFrameRef.current);
    focusFrameRef.current = requestAnimationFrame(() => {
      focusFrameRef.current = null;
      // 再次确认此时 presentation 和 DOM 已就位
      if (executionPresentationRef.current === "feedback-focused") {
        feedbackTextareaRef.current?.focus();
      }
    });
  }}
>
  写下现在的情况
</PrimaryButton>
```

8. guide-focused 时 FeedbackBox 视觉区域隐藏（`focused={false}`，shrink-0），但实例保持挂载。
9. feedback-focused 时 GuideCard 视觉区域隐藏（通过 wrapper class hidden），但实例保持挂载。
10. 在三种 presentation 下始终不重新创建或卸载 `ExecutionFeedbackBox` 或 `ExecutionGuideCard` 实例。唯一一个 `ExecutionFeedbackBox` 和唯一一个 `ExecutionGuideCard` 在 JSX 中始终挂载，视觉可见/隐藏由 presentation 和 className 控制。

**禁止：** 用 `key` 强制重建；双组件实例；条件渲染 `null` 让 React 卸载 textarea 节点。

---

### A3. `TaskExecutionView.tsx` — Back Handler

**做：**

现有 `task-feedback-focus / 95` 的判断条件改为 `executionPresentation !== "feedback-focused"`。

新增第二个 useEffect 注册：

```ts
{
  id: "task-guide-focus",
  priority: 94,
  handle: () => {
    if (executionPresentation !== "guide-focused") return false;
    collapseGuideFocus();
    return true;
  },
}
```

Effect 依赖完整，cleanup 精确 `unregister("task-guide-focus")`。

**禁止：** 修改 BackControllerContext、WebHistoryGuard、popstate/pageshow 或 History API。

---

### A4. `ExecutionFeedbackBox.tsx`

**保持当前 C3-A 实现不变。** 不新增 prop 或逻辑改动。外部 `focused` prop 在 guide-focused 时传入 false，组件自然以 shrink-0 默认态呈现。

---

### A5. `ExecutionGuideCard.tsx` — 默认预览 + 专注阅读

**做：**

1. Props 锁定为：

```ts
interface ExecutionGuideCardProps {
  guide: CompanionStep | null;
  isProcessing: boolean;
  hasSubmittedFeedback: boolean;
  focused: boolean;
  onExpand: () => void;
}
```

2. 默认预览（`!focused`）：正文使用 `line-clamp-4` 截断、`overflow-hidden`；移除默认态的 `overflow-y-auto`，不允许框内滚动完整内容。
3. 展开入口：当 `guide !== null` 且 `isProcessing === false` 时，始终渲染一个 `type="button"` 的 `text-left` 按钮，内部同时包含正文预览和底部文案"展开查看完整建议"。按钮 `onClick` 触发 `onExpand`。
4. 专注阅读（`focused`）：取消 `line-clamp`；PaperCard 使用 `min-h-0 flex-1 overflow-hidden`；正文 div 使用 `min-h-0 flex-1 overflow-y-auto`，内部可滚动。
5. 不显示展开入口。
6. 加载中和无 guide 时不渲染按钮区域。
7. 不新增内部 useState，不复制 guide 数据，不管理 presentation，不注册 Back Handler，不渲染"收起"或"写下现在的情况"。

**完成标准：** 默认仅 4 行预览；存在 guide 且非 loading 时展开入口可见；focused 完整内滚，不撑开 AppShell。

---

### A6. C3-A Follow-up Code Review 清单

- [ ] diff 只有 3 个文件（TaskExecutionView、ExecutionFeedbackBox、ExecutionGuideCard）
- [ ] `executionPresentation` 三枚举互斥，无同时 active 路径
- [ ] textarea DOM 稳定（三种 presentation 均不重挂载）
- [ ] `feedbackDraft` 在三种 presentation 间始终保留
- [ ] `task-guide-focus / 94` 与 `task-feedback-focus / 95` 互斥，cleanup 正确
- [ ] guide-focused Back → default execution → tasks → home
- [ ] "写下现在的情况"点击一次 → rAF 聚焦 textarea → 键盘弹出
- [ ] `focusFrameRef` click、presentation 改变、task.id 改、unmount 均 cancel
- [ ] 提交成功回 default，Guide 更新，draft 保留
- [ ] task.id 变化 / 卸载清空
- [ ] visualViewport listener 仅 feedback-focused 存在
- [ ] GuideCard 默认 line-clamp-4，focused 内 overflow-y-auto
- [ ] 展开入口始终显示（guide 非 null 且非 loading）
- [ ] ExecutionTaskCard 仅在 default 渲染；focused 时完全隐藏
- [ ] Guide 与 Feedback 实例各只有一个，无 key、无双实例、无卸载
- [ ] 未修改 Context、page.tsx、AppShell、BottomTabBar、services
- [ ] lint / build / TypeScript 通过

---

### A7. C3-A Follow-up 用户验收

- [ ] default Guide 只显示 4 行；框内不可滚动
- [ ] 存在 guide 且非 loading 时展开入口可见
- [ ] 点击正文预览或"展开查看完整建议"→ 进入 guide-focused
- [ ] guide-focused 长正文内可滚动
- [ ] guide-focused 不显示完整 FeedbackBox 或继续按钮
- [ ] feedback-focused 不显示 GuideCard 视觉区域
- [ ] Guide 与 Feedback 组件保持挂载
- [ ] 点击"写下现在的情况"一次即可聚焦 textarea；手机键盘自动弹出
- [ ] guide-focused → feedback-focused 草稿不丢
- [ ] 两种 focused 收起或返回都先回 default
- [ ] 页面不是长网页，不聊天化
- [ ] 375/390/430 宽度下核心动作与标题不溢出

---

### A8. C3-A 提交建议

```text
feat: add focused task feedback mode
```

只有 ChatGPT 批准、Review 与设备验收通过后，才可逐个暂存三个 C3-A 文件、提交和 push。

---

## 5. C3-B：我的编辑区与 Sheet 锁滚动

（内容与初次审查通过时保持一致，见下方 B1-B6。）

### B1. `MeFeedbackPage.tsx` ... (same as original)
### B2. `MeView.tsx` ... (same)
### B3. `MeConfirmSheet.tsx` ... (same)
### B4. C3-B Code Review 清单
### B5. C3-B 用户 / 真机验收
### B6. C3-B 提交建议 (`fix: improve mobile feedback editing and sheet locking`)

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
  "apps/mobile-app/components/today/ExecutionFeedbackBox.tsx",
  "apps/mobile-app/components/today/ExecutionGuideCard.tsx"
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
# 只能逐个 git add 三个 A 文件

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
