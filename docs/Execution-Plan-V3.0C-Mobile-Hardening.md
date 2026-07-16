# V3.0C 文件级执行方案：手机端体验加固与安装基础

> 状态：待 ChatGPT 审查；本文档只定义施工，不代表已授权 Codex 写代码
> 适用工程：`apps/mobile-app/`
> 前置版本：`8d8a2111 docs: update handoff after V3.0B completion`
> 依据：`docs/Roadmap-V3.0C-to-V3.3-Mobile-Production.md`、`docs/Architecture-V3.0C-Mobile-Hardening.md`
> 创建日期：2026-07-15
> 核心边界：V3.0C 只做手机 Web 体验加固与基础可安装能力；不接真实后端、不装 Capacitor、不做 Service Worker

---

## 0. 文档目的与执行纪律

本文档将 V3.0C 拆成四个相互隔离的 Batch，并把每个 Batch 的文件范围、算法、验收、回滚点和 Codex 汇报格式锁定到文件级。

执行顺序固定：

```text
阶段 0 规划文档基线
  → 四份规划/交接文档经 ChatGPT 审查通过
  → Claude Code 逐文件提交并 push
  → tracked 工作区干净
C1 安全区、视口和触控基础
  → Claude Code Review + 用户手动验收 + ChatGPT 批准
  → Claude Code 逐文件提交并 push
C2 统一返回控制器
  → Claude Code Review + 用户手动验收 + ChatGPT 批准
  → Claude Code 逐文件提交并 push
C3 键盘与滚动锁
  → Claude Code Review + 真机手动验收 + ChatGPT 批准
  → Claude Code 逐文件提交并 push
C4 PWA 基础安装能力
  → 图标视觉闸门通过后才可施工
  → Claude Code Review + 安装验收 + ChatGPT 批准
  → Claude Code 逐文件提交并 push
```

每个 Batch 使用 `npm --prefix apps/mobile-app run <script>`；`--prefix` 表示在 `apps/mobile-app` 子工程中运行命令，无需反复切换当前目录。

全阶段纪律：

1. 一次只执行一个 Batch，不跨 Batch 并行写代码。
2. 每个 Batch 只允许修改该 Batch 明列的文件。
3. 条件文件不得写入初始 Codex 指令；必须先取得真实验收证据，再生成独立 Follow-up 指令。
4. 每个 Batch 固定流程为：Codex 完成 → Claude Code Review → lint/build → 用户手动或真机验收 → ChatGPT 批准 → Claude Code 逐文件提交当前 Batch → push → 确认 tracked 工作区干净。
5. 未通过当前 Batch 出口条件、未提交并 push 当前 Batch、或 tracked 工作区不干净，均不得进入下一 Batch；禁止携带累计未提交 diff 进入下一 Batch。
6. Codex 不得 `git add`、commit、push。Claude Code 只有获得 ChatGPT 对当次精确文件清单的明确授权后才能提交和 push。
7. 每次提交前必须列出精确文件，逐个 `git add -- <path>`；禁止 `git add .`、`git add -A` 或目录级模糊暂存。
8. `.agents/`、`.claude/`、`.codex/`、`.vscode/`、`skills-lock.json`、`start`、`stop`、`test_photo.jpeg` 等长期未跟踪项持续忽略，不暂存、不删除、不移动。
9. 本轮文档修订不授权修改或暂存 Roadmap、Architecture、Project-State-Handoff；它们只在阶段 0 的四份文档均获批后按精确清单一起建立基线。

### 0.1 阶段 0：规划文档基线与 Handoff 更新

当以下三份规划文档全部经 ChatGPT 实际文件审查通过后：

1. `docs/Roadmap-V3.0C-to-V3.3-Mobile-Production.md`
2. `docs/Architecture-V3.0C-Mobile-Hardening.md`
3. `docs/Execution-Plan-V3.0C-Mobile-Hardening.md`

Claude Code 才允许对 `docs/Project-State-Handoff.md` 做一次**最小、只追加当前有效状态的更新**。更新内容只能包含：

- V3.0C 路线已通过；
- V3.0C Architecture 已通过；
- V3.0C Execution Plan 已通过；
- 当前下一步为 C1；
- C1 尚未施工；
- Codex 尚未获授权；
- C1 → C2 → C3 → C4 的严格顺序；
- C4 图标视觉闸门；
- 三份规划文档的路径。

不得在 Handoff 中宣称 C1 已开始、已写代码、已接后端、已安装 Capacitor，或复制本执行方案的细节。Handoff 最小更新必须再次交 ChatGPT 审查。

获得 Handoff 更新的 ChatGPT 审查与四文件提交授权后，由 Claude Code 执行：

1. 记录提交前 `HEAD`，运行 `git status --short --untracked-files=all`，核验除四份文档及长期未跟踪项外无其他变化；
2. 逐一审查四份文档的实际 diff/未跟踪内容；
3. 向 ChatGPT 报告精确四文件清单并取得明确提交授权；
4. 只逐文件暂存四份文档，禁止 `git add .`；
5. 提交四份文档并 push；
6. 用 `git show --name-only --format=oneline HEAD` 确认提交只含四份文档；
7. 再运行 `git status --short --untracked-files=all`，确认 tracked 工作区干净，输出只剩长期未跟踪项；
8. push 成功且基线干净后，才允许 C1 施工。

阶段 0 最终文档清单：

```text
docs/Roadmap-V3.0C-to-V3.3-Mobile-Production.md
docs/Architecture-V3.0C-Mobile-Hardening.md
docs/Execution-Plan-V3.0C-Mobile-Hardening.md
docs/Project-State-Handoff.md
```

阶段 0 建议命令框架（现在不执行）：

```bash
cd C:\Dev\ai-todo
git rev-parse HEAD
git status --short --untracked-files=all
git add -- docs/Roadmap-V3.0C-to-V3.3-Mobile-Production.md
git add -- docs/Architecture-V3.0C-Mobile-Hardening.md
git add -- docs/Execution-Plan-V3.0C-Mobile-Hardening.md
git add -- docs/Project-State-Handoff.md
git diff --cached --name-only
# 仅在 ChatGPT 已明确授权后 commit，再 push；提交信息由当次授权确定
git show --name-only --format=oneline HEAD
git status --short --untracked-files=all
```

### 0.2 每个代码 Batch 的 Git 基线规则

每个 C1–C4 均执行同一闭环：

1. 开始前运行 `git rev-parse HEAD`，把输出记录为 `<BATCH_BASE_HEAD>`；
2. 开始前确认 tracked 工作区干净；长期未跟踪项不处理；
3. Codex 只写本 Batch 文件，不提交；
4. 完成后以 `<BATCH_BASE_HEAD>` 和本 Batch 允许文件清单双重核验，不接受范围外文件；
5. Claude Code Review、lint/build、用户验收完成后，等待 ChatGPT 批准；
6. Claude Code 报告精确文件清单并获得明确提交授权后，逐个 `git add -- <path>`；禁止 `git add .`；
7. 提交并 push 当前 Batch；
8. 用 `git show --name-only --format=oneline HEAD` 确认提交范围；
9. 确认 `git status` 只剩长期未跟踪项，tracked 工作区干净；
10. 不得使用累计未提交 diff 进入下一 Batch。

---

## 1. 已读取依据与实际代码核验结论

### 1.1 必读文档已核验

按指定顺序完整读取：

1. `docs/Project-State-Handoff.md`
2. `docs/Roadmap-V3.0C-to-V3.3-Mobile-Production.md`
3. `docs/Architecture-V3.0C-Mobile-Hardening.md`
4. `apps/mobile-app/docs/UI-Spec-Design-Screenshot-Lock-V3.0A.md`
5. `apps/mobile-app/docs/Mobile-Viewport-Layout-Lock-V3.0A.md`
6. `apps/mobile-app/docs/Frontend-UI-Boundary-Lock-V3.0A.md`
7. `apps/mobile-app/docs/UI-Spec-Mobile-App.md`
8. `apps/mobile-app/docs/Frontend-Architecture.md`
9. `apps/mobile-app/docs/Frontend-Execution-Plan.md`

优先级锁定：ChatGPT 当前指令 > 最新 V3.0C Architecture > 最新 V3.0C Roadmap > UI Screenshot/Viewport/Boundary 锁定文档 > 较早前端架构与执行文档。

### 1.2 实际代码核验摘要

| 事实 | 实际结果 |
|---|---|
| `app/layout.tsx` | Server Component；无 `"use client"`；Viewport 缺 `viewportFit: "cover"` |
| `app/page.tsx` | Client Component；当前 `Home` 自身拥有 auth/tab/today 状态；需要拆成 Provider 外层 + `HomeContent` 内层 |
| `app/globals.css` | 仅基础全局样式；适合集中定义 safe-area/layout CSS 变量和横屏降级类 |
| `tailwind.config.ts` | mobile-app 自有配置；已有 `min-h-touch`/`min-w-touch` 和 `safe-bottom`；本方案使用 globals.css 变量处理新增 safe-area，不修改该文件 |
| `AppShell.tsx` | `h-[100svh]`、固定 `px-6 pt-8 pb-[84px]`，底部避让未计入 safe-area-bottom |
| `BottomTabBar.tsx` | `min-h-[76px]` + `pb-safe-bottom` 已正确；原则上 C1 不修改 |
| 四个 Auth 页 | 每页根 `<main>` 都有 `px-6 py-7`，内层有 `min-h-[calc(100vh-3.5rem)]`；直接外包带 padding 的 AuthShell 会产生双重内边距 |
| `TaskListView.tsx` | “退出”是带 `onClick={onBackHome}` 的核心返回 `<button>`；自身真实点击盒仅 `min-h-[40px]`，父级只负责布局且没有扩大命中区域，必须纳入 C1 |
| Tab 挂载行为 | `page.tsx` 的 `renderContent()` 只渲染当前 `activeTab` 分支；未激活的 MeView/FootprintsView 会卸载，其 Handler 随 effect cleanup 注销；仍要求 Handler 显式校验当前 Tab，形成双重防护 |
| `TaskExecutionView` | 无可滚动祖先；外层 `overflow-hidden`，任务层单屏结构必须保留 |
| `MeFeedbackPage` | 根层 `overflow-hidden`；PaperCard 当前不是滚动容器；textarea 固定 180px |
| `MeView` | 真实滚动容器在第 49 行的 `overflow-y-auto` div；适合使用 ref 精确锁定 |
| `MeConfirmSheet` | overlay 未阻止 touchmove；Sheet 有 `overflow-y-auto`，无背景滚动锁和 overscroll containment |
| `FootprintsView` / `MeView` | 子页面状态是本地 `useState`，必须通过 Back Handler 注册，不提升到 page.tsx |
| 可选目录 | `apps/mobile-app/contexts/`、`hooks/`、`public/icons/` 当前均不存在；施工时只创建本文档明确授权的目录/文件 |

### 1.3 受控触控审计与锁定结果

本轮只读搜索范围限定为 `apps/mobile-app/**/*.tsx`，搜索 `<button>`、`<a>`、`role="button"`、`min-h-[…]`、`h-[…]`，只判断真实交互元素，不做全项目按钮重构。

按当前已确认项，C1 纳入 **9 个代码位置、7 个文件、7 种文案**：

| 文件 | 行号（当前代码） | 文案 | 代码证据 | 当前 → 目标 |
|---|---:|---|---|---|
| `components/today/TaskExecutionView.tsx` | 64–70 | 回到任务 | `<button onClick={onBack}>`，无父级命中区扩展 | `min-h-[38px]` → `min-h-touch` |
| 同上 | 72–78 | 先退出 | `<button onClick={onBack}>`，无父级命中区扩展 | `min-h-[38px]` → `min-h-touch` |
| `components/today/ExecutionFeedbackBox.tsx` | 44–52 | 继续陪我推进 | PrimaryButton 基类已有 `min-h-touch`，但局部 42px 表述与规范冲突；统一局部类为 `min-h-touch` | `min-h-[42px]` → `min-h-touch` |
| `components/me/MeFeedbackPage.tsx` | 30–37 | 返回我的（成功态） | `<button onClick={onBack}>`，无父级命中区扩展 | `min-h-[38px]` → `min-h-touch` |
| 同上 | 65–72 | 返回我的（输入态） | `<button onClick={onBack}>`，无父级命中区扩展 | `min-h-[38px]` → `min-h-touch` |
| `components/footprints/FootprintDetailView.tsx` | 22–29 | 回到足迹 | `<button onClick={onBack}>`，无父级命中区扩展 | `min-h-[38px]` → `min-h-touch` |
| `components/me/MePrivacyPage.tsx` | 40–47 | 返回我的 | `<button onClick={onBack}>`，无父级命中区扩展 | `min-h-[38px]` → `min-h-touch` |
| `components/today/TaskListView.tsx` | 32–39 | 退出 | 核心任务层返回 `<button onClick={onBackHome}>`；自身仅 40px，父级 grid/header 不可点击，未扩大命中区 | `min-h-[40px]` → `min-h-touch` |
| `components/today/UpcomingTaskList.tsx` | 38–44 | 陪我 | locked 任务真实 `<button onClick={onLockedTaskClick}>` 使用 `min-h-[34px]`；父级任务行是不可点击 `<div>`，未扩大命中区 | `min-h-[34px]` → `min-h-touch` |

文案种类按可见字符串计为：回到任务、先退出、继续陪我推进、返回我的、回到足迹、退出、陪我，共 7 种。

受控搜索中其他交互元素的结论：

- `PrimaryButton`、`SecondaryButton`、BottomTabBar、Today 设置按钮、MeMenuRow 已使用 `min-h-touch`/44px；
- `FootprintList` 行按钮有 `py-3` 且包含 36px 图标，实际高度明显超过 44px；
- Welcome/Auth 文本按钮虽未逐个写 `min-h-touch`，但搜索未发现对它们施加小于 44px 的固定高度；本轮不据此扩大 Auth UI 重构；
- 未发现 `<a>` 或 `role="button"` 形式的小于 44px 交互；
- 新发现项必须先由 ChatGPT 判断，禁止 Codex 自由扩大。

---

## 2. 全阶段架构锁定

### 2.1 BackController.dispatchBack()

唯一职责：

- 按 `priority` 从高到低调用已注册 Back Handler；
- 第一个返回 `true` 时停止并返回 `true`；
- 全部返回 `false` 时返回 `false`。

严格禁止：

- `pushState`；
- `replaceState`；
- `history.back()`；
- 监听 `popstate` / `pageshow`；
- 访问 Capacitor API。

### 2.2 WebHistoryGuard

WebHistoryGuard 是全项目唯一 Web 平台返回适配器，负责：

- 唯一 `popstate` 监听；
- `pageshow` / BFCache 恢复；
- Base/Guard 双条目；
- `isExitingRef`；
- 调用 `dispatchBack()`；
- 内部返回成功后重新建立 Guard；
- 根状态下尝试离开 Web 页面。

History State 精确锁定：

```ts
const BASE_STATE = { app: "qingxing", kind: "base" } as const;
const GUARD_STATE = { app: "qingxing", kind: "guard" } as const;
```

目标条目语义精确锁定：

- Guard → Base：`event.state.kind === "base"`；
- Base → Guard：`event.state.kind === "guard"`。

### 2.3 Provider 可实现结构

锁定为：

```tsx
export default function Page() {
  return (
    <BackControllerProvider>
      <HomeContent />
    </BackControllerProvider>
  );
}

function HomeContent() {
  // 当前 Home 的 authState/authScreen/activeTab/todayMode 等状态
  // 在 Provider 后代中使用 useBackController() 注册 page 级 Handler
}
```

约束：

- `app/layout.tsx` 保持 Server Component，不添加 `"use client"`；
- `BackControllerProvider` 是独立 Client Component；
- 禁止“组件自己返回 Provider，同时在 Provider 外层调用 useContext”的不可实现结构；
- 不创建第二个 AppShell，不改变底部四 Tab。

### 2.4 Capacitor 边界

V3.0C 不安装、不实现 Capacitor。执行方案只保留未来 V3.2 的接口关系：

```text
Capacitor backButton
  → BackController.dispatchBack()
  → handled === false 时 Capacitor App.exitApp()
```

Capacitor Back Adapter 不调用 WebHistoryGuard，不访问 Web History。

---

## 3. Safe Area 与视口精确实现锁定

### 3.1 变量位置

关键选择不留给 Codex：**新增 safe-area 和 shell 尺寸变量统一定义在 `app/globals.css` 的 `:root`**。现有 `tailwind.config.ts` 已提供 BottomTabBar 正在使用的 `safe-bottom`，本阶段不新增未被真实组件使用的 `safe-top` token，因此 C1 不修改 `tailwind.config.ts`。

```css
:root {
  color-scheme: light;
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --app-page-gutter: 24px;
  --app-top-spacing: 32px;
  --bottom-tab-base-height: 76px;
  --bottom-tab-buffer: 8px;
  --bottom-tab-total-height: calc(var(--bottom-tab-base-height) + var(--safe-bottom));
  --app-content-bottom-reserve: calc(var(--bottom-tab-total-height) + var(--bottom-tab-buffer));
}
```

### 3.2 AppShell 精确 padding

AppShell `<main>` 锁定为：

- 左：`max(24px, env(safe-area-inset-left, 0px))`；
- 右：`max(24px, env(safe-area-inset-right, 0px))`；
- 顶：`calc(32px + env(safe-area-inset-top, 0px))`，保留原 `pt-8` 的 32px 视觉间距；
- 底：`var(--app-content-bottom-reserve)`，即 76px Tab 基础高度 + safe-area-bottom + 8px 缓冲。

通过在 `<main>` 增加稳定类名（如 `app-shell-content`）并在 `globals.css` 写精确规则实现；不得把复杂表达式散落到多个组件。

### 3.3 BottomTabBar 统一高度

当前 `BottomTabBar` 已是：

- 内层 `min-h-[76px]`；
- 外层 `pb-safe-bottom`。

因此 C1 默认**不修改** `BottomTabBar.tsx`。统一关系由 `--bottom-tab-base-height: 76px` 与现有类保持一致，AppShell 引用 `--app-content-bottom-reserve`。

只有真机/代码 Review 证明现有 safe-bottom 位置错误或实际基础高度不再是 76px，才允许将 `BottomTabBar.tsx` 作为条件 Follow-up；不得为“统一”无理由修改。

### 3.4 AuthShell 精确结构

四个 Auth 页当前各自拥有根 `<main className="... px-6 py-7">`，所以 AuthShell **不得再添加 24px 常规 padding**。锁定结构：

- `AuthShell`：`h-[100svh] overflow-y-auto overscroll-y-contain bg-warm-bg`；
- 仅用 safe-area inset 作为外层附加 padding：top/right/bottom/left 分别为 `var(--safe-*)`；
- 四个 Auth 页面保留现有 `px-6 py-7`，因此最终常规视觉间距仍为 24px/28px，并额外叠加系统 safe-area，而不是重复 24px；
- `AuthShell` 可滚动，为 RegisterPage 小屏键盘场景提供受控滚动祖先；
- `page.tsx` 的 guest 分支统一包裹一个 AuthShell；各 Auth 页不各自再套 AuthShell；
- Auth 页面不进入 AppShell，不显示 BottomTabBar。

### 3.5 横屏降级

在 `globals.css` 定义媒体查询：

```css
.app-landscape-warning { display: none; }

@media (orientation: landscape) and (max-height: 500px) {
  .app-landscape-warning { display: flex; }
  .app-portrait-content { display: none; }
}
```

AppShell 和 AuthShell 各渲染同一文案结构：“清行更适合竖屏使用。转回来，我们继续今天的小步。”不新增路由、不修改业务状态。

---

## 4. 文件范围总表

### 4.1 表一：固定允许修改文件

以下文件不依赖“真机发现问题才改”，确定会在 C1–C4 中修改。按实际唯一文件路径计为 **16 个**（详见本文件末尾的计数说明）：

| # | 文件 | Batch |
|---:|---|---|
| 1 | `apps/mobile-app/app/layout.tsx` | C1 viewportFit；C4 Apple metadata |
| 2 | `apps/mobile-app/app/page.tsx` | C1 AuthShell；C2 Provider + page handlers |
| 3 | `apps/mobile-app/app/globals.css` | C1 safe-area/横屏；C3 keyboard CSS variable |
| 4 | `apps/mobile-app/components/shell/AppShell.tsx` | C1 safe-area/动态避让/横屏 |
| 5 | `apps/mobile-app/components/today/TaskListView.tsx` | C1 一处核心返回触控 |
| 6 | `apps/mobile-app/components/today/UpcomingTaskList.tsx` | C1 一处 locked 任务触控 |
| 7 | `apps/mobile-app/components/today/TaskExecutionView.tsx` | C1 两处触控；C3 紧凑状态和 props 编排 |
| 8 | `apps/mobile-app/components/today/ExecutionTaskCard.tsx` | C3 显式 `compact` prop |
| 9 | `apps/mobile-app/components/today/ExecutionGuideCard.tsx` | C3 显式 `compact` prop |
| 10 | `apps/mobile-app/components/today/ExecutionFeedbackBox.tsx` | C1 一处触控；C3 focus/compact 适配 |
| 11 | `apps/mobile-app/components/me/MeView.tsx` | C2 handlers；C3 scroll ref/lock |
| 12 | `apps/mobile-app/components/me/MePrivacyPage.tsx` | C1 一处触控 |
| 13 | `apps/mobile-app/components/me/MeFeedbackPage.tsx` | C1 两处触控；C3 受控滚动 |
| 14 | `apps/mobile-app/components/me/MeConfirmSheet.tsx` | C3 精确背景滚动锁/touchmove/overscroll |
| 15 | `apps/mobile-app/components/footprints/FootprintsView.tsx` | C2 handler |
| 16 | `apps/mobile-app/components/footprints/FootprintDetailView.tsx` | C1 一处触控 |

`apps/mobile-app/tailwind.config.ts` 已移出固定修改范围：C1 使用 globals.css 变量，不新增未使用的 `safe-top` token。

### 4.2 固定允许新增文件

共 **3 个**文本源文件：

| # | 文件 | Batch | 说明 |
|---:|---|---|---|
| 1 | `apps/mobile-app/components/auth/AuthShell.tsx` | C1 | Client-safe 共享 Auth 安全区/滚动/横屏容器 |
| 2 | `apps/mobile-app/contexts/BackControllerContext.tsx` | C2 | Client Component：Controller、Context、WebHistoryGuard |
| 3 | `apps/mobile-app/app/manifest.ts` | C4 | Next.js Manifest；与图标同批落地 |

`apps/mobile-app/contexts/` 当前不存在，C2 仅允许为上述文件创建该目录。`apps/mobile-app/hooks/` 当前不存在，本方案不创建 hooks 目录。

### 4.3 表二：条件允许修改文件

共 **3 个**条件文件：

| 文件 | 触发证据 | 未触发时规则 |
|---|---|---|
| `apps/mobile-app/components/today/GoalInputCard.tsx` | Android Chrome/iOS Safari 真机证明目标输入被键盘遮挡，需可复现步骤、设备、浏览器、截图/录屏 | 不修改；不得出现在 C1/C3 初始 Codex 指令 |
| `apps/mobile-app/components/auth/RegisterPage.tsx` | 375px/小屏真机确认 confirmPassword 或提交按钮仍被遮挡，且 AuthShell 滚动不能解决 | 不修改；优先使用 AuthShell 的滚动祖先和浏览器原生聚焦滚动 |
| `apps/mobile-app/components/shell/BottomTabBar.tsx` | Review/真机证明现有 `pb-safe-bottom` 位置错误、或实际基础高度与 76px 不一致 | 不修改；AppShell 仅通过统一变量修正避让 |

触发后必须由 ChatGPT/Claude Code生成独立 Follow-up 指令，列出证据与唯一文件范围；不得口头“顺手修”。

### 4.4 图标确认后允许新增的二进制资源

仅 C4 视觉闸门通过后允许新增：

1. `apps/mobile-app/public/icons/icon-192.png`
2. `apps/mobile-app/public/icons/icon-512.png`
3. `apps/mobile-app/public/icons/icon-512-maskable.png`
4. `apps/mobile-app/public/icons/icon-180.png`

`apps/mobile-app/public/icons/` 当前不存在；未通过闸门前不创建。

### 4.5 全阶段禁止文件

以下任何文件出现于 Batch diff，直接 Review 不通过：

```text
src/**
apps/mobile-app/services/**
apps/mobile-app/mockData/**
apps/mobile-app/types/**
apps/mobile-app/components/growth/**
apps/mobile-app/components/ui/**
apps/mobile-app/components/icons/**
根 package.json
根 next.config.*
根 tailwind.config.*
package-lock.json
所有 API Route
Supabase 配置或调用
数据库 migration
prompts/**
```

补充说明：实际工程当前还存在 `apps/mobile-app/mock-data/`（带连字符）目录；它与用户点名的 `mockData/**` 同属 Mock 数据边界，V3.0C 同样绝对禁止修改。

并禁止新增或实现：真实后端、Supabase Auth、Adapter/Facade、API 类型对齐、Service Worker、离线页面、Capacitor、Android 工程、Static Export、APK/AAB、国内部署、短信登录、聊天 Tab、项目管理入口。

### 4.6 每个 Batch 独立文件范围

| Batch | 固定修改 | 固定新增 | 条件文件 |
|---|---|---|---|
| C1 | `layout.tsx`、`page.tsx`、`globals.css`、`AppShell.tsx`、`TaskListView.tsx`、`UpcomingTaskList.tsx`、`TaskExecutionView.tsx`、`ExecutionFeedbackBox.tsx`、`MeFeedbackPage.tsx`、`MePrivacyPage.tsx`、`FootprintDetailView.tsx`（11 个） | `AuthShell.tsx`（1 个） | `BottomTabBar.tsx` 仅 Follow-up |
| C2 | `page.tsx`、`MeView.tsx`、`FootprintsView.tsx`（3 个） | `BackControllerContext.tsx`（1 个） | 无 |
| C3 | `globals.css`、`TaskExecutionView.tsx`、`ExecutionTaskCard.tsx`、`ExecutionGuideCard.tsx`、`ExecutionFeedbackBox.tsx`、`MeView.tsx`、`MeFeedbackPage.tsx`、`MeConfirmSheet.tsx`（8 个） | 无 | `GoalInputCard.tsx`、`RegisterPage.tsx` 仅 Follow-up |
| C4 | `layout.tsx`（1 个） | `manifest.ts`（1 个文本） + 4 个已确认图标 PNG | 无；但整个 Batch 被视觉闸门阻断 |

---

## 5. Batch C1：安全区、视口和触控基础

### 5.1 Batch 目标

- `viewport-fit=cover`；
- AppShell 顶部/左右 safe-area；
- AppShell 按 BottomTabBar 76px + safe-area-bottom + 8px 动态避让；
- 新增可滚动 AuthShell，不造成双重常规内边距；
- 修复锁定的 9 处触控高度（7 文件、7 种文案）；
- AppShell/AuthShell 横屏基础降级；
- 不接 History API，不做 PWA Manifest/图标。

### 5.2 前置条件

1. 阶段 0 四份基线文档已提交并 push，C1 从干净 tracked 基线开始。四份基线文档为：`docs/Roadmap-V3.0C-to-V3.3-Mobile-Production.md`、`docs/Architecture-V3.0C-Mobile-Hardening.md`、`docs/Execution-Plan-V3.0C-Mobile-Hardening.md`、`docs/Project-State-Handoff.md`。
2. ChatGPT 审查并明确授权 C1。
3. 开始前记录 PowerShell 变量 `$C1_BASE_HEAD = git rev-parse HEAD`（或等价记录实际 SHA），确认 tracked 工作区干净。
4. Codex 阅读 9 份必读文档和本文档 C1。

### 5.3 精确允许修改文件

1. `apps/mobile-app/app/layout.tsx`
2. `apps/mobile-app/app/page.tsx`
3. `apps/mobile-app/app/globals.css`
4. `apps/mobile-app/components/shell/AppShell.tsx`
5. `apps/mobile-app/components/today/TaskListView.tsx`
6. `apps/mobile-app/components/today/UpcomingTaskList.tsx`
7. `apps/mobile-app/components/today/TaskExecutionView.tsx`
8. `apps/mobile-app/components/today/ExecutionFeedbackBox.tsx`
9. `apps/mobile-app/components/me/MeFeedbackPage.tsx`
10. `apps/mobile-app/components/me/MePrivacyPage.tsx`
11. `apps/mobile-app/components/footprints/FootprintDetailView.tsx`

### 5.4 精确新增文件

- `apps/mobile-app/components/auth/AuthShell.tsx`

### 5.5 条件文件

- `apps/mobile-app/components/shell/BottomTabBar.tsx`：初始指令中禁止修改；只有 Follow-up 证据触发。
- GoalInputCard/RegisterPage 不属于 C1 初始范围。

### 5.6 每个文件的修改内容

| 文件 | 精确修改 |
|---|---|
| `layout.tsx` | `viewport` 增加 `viewportFit: "cover"`；保持 Server Component，不添加 `"use client"`；C1 不加 PWA metadata |
| `globals.css` | 加 §3.1 变量、`.app-shell-content` padding、AuthShell safe inset 类、横屏 warning/content 类；不改品牌色和全局视觉 |
| `AppShell.tsx` | 外层/内容标注 `app-portrait-content` 和 `app-shell-content`；删除固定 `px-6 pb-[84px] pt-8`，改由 CSS 精确变量；渲染横屏提示；保持一个 AppShell 和 `h-[100svh]` |
| `AuthShell.tsx` | 可滚动 100svh 容器；只叠加系统 safe inset；渲染 `app-portrait-content` 和横屏提示；不包含 AppShell/BottomTabBar |
| `page.tsx` | guest 分支统一由 AuthShell 包裹，不能每个页面各套；不改现有业务状态和 mock Auth |
| 7 个触控文件 | 严格按 §1.3 的 9 处替换：含 `TaskListView` 40px“退出”和 `UpcomingTaskList` 34px“陪我”；不重构按钮、不改文案/样式层级 |

### 5.7 状态与数据流

C1 不新增业务状态。Auth 数据流仍为：

```text
page.tsx authState/authScreen
  → AuthShell（只负责布局）
    → Welcome/Otp/Password/Register（原 props 和 mock service 不变）
```

App 数据流仍为：

```text
page.tsx
  → AppShell（布局）
    → 当前 Tab 内容
    → BottomTabBar（现有切换逻辑不变）
```

### 5.8 禁止文件

除 §5.3/5.4 外全部禁止，尤其：`BottomTabBar.tsx`（初始施工）、services/mockData/types、growth/ui/icons、`src/**`、根配置。

### 5.9 禁止行为

- 不接 History API；
- 不创建 Context；
- 不创建 Manifest/图标；
- 不改四 Tab；
- 不把 Auth 页套 AppShell；
- 不把四个 Auth 页的现有 `px-6 py-7` 删除或与 AuthShell 形成双重 24px 常规 padding；
- 不扩大触控修复。

### 5.10 lint 命令

```bash
cd C:\Dev\ai-todo
npm --prefix apps/mobile-app run lint
```

### 5.11 build 命令

```bash
cd C:\Dev\ai-todo
npm --prefix apps/mobile-app run build
```

### 5.12 范围核验命令

```bash
cd C:\Dev\ai-todo
# $C1_BASE_HEAD 必须使用 Batch 开始前记录的 SHA，不得在完成后重新赋值
git rev-parse HEAD
git diff --name-only $C1_BASE_HEAD -- apps/mobile-app
git diff $C1_BASE_HEAD -- apps/mobile-app/app/layout.tsx apps/mobile-app/app/page.tsx apps/mobile-app/app/globals.css apps/mobile-app/components/shell/AppShell.tsx apps/mobile-app/components/auth/AuthShell.tsx apps/mobile-app/components/today/TaskListView.tsx apps/mobile-app/components/today/UpcomingTaskList.tsx apps/mobile-app/components/today/TaskExecutionView.tsx apps/mobile-app/components/today/ExecutionFeedbackBox.tsx apps/mobile-app/components/me/MeFeedbackPage.tsx apps/mobile-app/components/me/MePrivacyPage.tsx apps/mobile-app/components/footprints/FootprintDetailView.tsx
git diff --no-index NUL apps/mobile-app/components/auth/AuthShell.tsx
# 上一命令有差异时返回非零退出码属正常：目的是显示未跟踪新文件完整内容，不代表审查失败
git status --short --untracked-files=all
```

ChatGPT 批准并由 Claude Code 提交/push 后，再执行：

```bash
git show --name-only --format=oneline HEAD
git status --short --untracked-files=all
# 除长期未跟踪项外，tracked 工作区必须干净
```

### 5.13 Codex 完成汇报格式

1. 实际修改/新增文件；
2. 开始时记录的 `C1_BASE_HEAD` 和完成时 HEAD；
3. viewportFit 最终值；
4. safe-area CSS 变量与 AppShell 四向 padding；
5. AuthShell 是否可滚动、是否避免双重常规内边距；
6. BottomTabBar 是否零修改；
7. 9 处触控替换逐项结果（7 文件、7 文案）；
8. 横屏提示实现位置；
9. 375/390/430 浏览器验收结果；
10. lint/build 原始结果；
11. `git diff --name-only`；
12. 是否修改任何禁止文件；
13. 未解决风险。

### 5.14 Claude Code Review 清单

- [ ] 只改允许文件；条件 BottomTabBar 未擅改
- [ ] layout 仍是 Server Component
- [ ] safe area 变量和 AppShell 引用一致
- [ ] 顶部保留 32px 视觉间距
- [ ] 底部避让 = 76px + safe-bottom + 8px
- [ ] AuthShell 只增加系统 inset，不重复 24px 常规 padding
- [ ] AuthShell 可滚动但未改变 Auth 视觉结构
- [ ] 9 处/7 文件/7 文案精确完成，无扩大
- [ ] `TaskListView` 核心“退出”已从 40px 改为 `min-h-touch`
- [ ] `UpcomingTaskList` locked 任务“陪我”已从 34px 改为 `min-h-touch`
- [ ] 无双重 AppShell、四 Tab 不变
- [ ] 无 services/mockData/types/src/API/Auth/Supabase/prompts 改动
- [ ] 无 History/Capacitor/SW/PWA 资源
- [ ] 375/390/430 不崩；390×844 不成长网页
- [ ] 无强紫色、SaaS 风、聊天入口
- [ ] lint/build 通过

### 5.15 用户手动验收清单

- [ ] Android/iPhone 顶部不被状态栏/notch 遮挡
- [ ] 左右边距在 375/390/430 自然，无双重缩进
- [ ] BottomTabBar 和手势条不遮挡底部内容
- [ ] Welcome/Otp/Password/Register 可滚动且视觉结构未变
- [ ] 横屏显示友好提示，回竖屏后恢复
- [ ] 9 个已锁定目标按钮点击舒适

### 5.16 回滚点

以 `C1_BASE_HEAD` 为唯一回滚基线。若失败，只恢复 C1 允许文件和删除 `AuthShell.tsx`；不得触碰阶段 0 已提交的四份基线文档（含 `docs/Project-State-Handoff.md` 和三份 V3.0C 规划文档）、长期未跟踪项或其他 Batch 文件。禁止用累计未提交 diff 继续 C2。

### 5.17 进入 C2 的出口条件

C1 lint/build、Claude Code Review、375/390/430、至少一台移动设备 safe-area/横屏验收全部通过，P0/P1=0；ChatGPT 明确批准精确文件后，由 Claude Code 逐文件提交并 push；`git show` 范围正确且 tracked 工作区干净后，才能进入 C2。

---

## 6. Batch C2：统一返回控制器

### 6.1 Batch 目标

- BackControllerProvider + 平台无关 `dispatchBack()`；
- WebHistoryGuard 唯一 `popstate/pageshow` 监听；
- Guest/Auth 和 Authenticated 双分支返回；
- MeView、FootprintsView 本地状态 Handler；
- Strict Mode、BFCache、前进恢复；
- 不改 UI 视觉、不安装 Capacitor。

### 6.2 前置条件

1. C1 已提交并 push，tracked 工作区干净。
2. ChatGPT 明确授权 C2。
3. 开始前记录 PowerShell 变量 `$C2_BASE_HEAD = git rev-parse HEAD`（或等价实际 SHA），不得夹带 C1 未提交 diff。

### 6.3 精确允许修改文件

1. `apps/mobile-app/app/page.tsx`
2. `apps/mobile-app/components/me/MeView.tsx`
3. `apps/mobile-app/components/footprints/FootprintsView.tsx`

### 6.4 精确新增文件

- `apps/mobile-app/contexts/BackControllerContext.tsx`

### 6.5 条件文件

无。

### 6.6 History State 保留规则

Base/Guard 写入不得无条件覆盖整个 `window.history.state`。所有初始化、BFCache 恢复、内部返回后重建 Guard 的 History 写入都先读取现有对象并保留其字段：

```ts
const existingState =
  typeof window.history.state === "object" &&
  window.history.state !== null
    ? window.history.state
    : {};

window.history.replaceState(
  {
    ...existingState,
    app: "qingxing",
    kind: "base",
  },
  "",
);

window.history.pushState(
  {
    ...existingState,
    app: "qingxing",
    kind: "guard",
  },
  "",
);
```

锁定要求：

- `...existingState` 必须在 `app`/`kind` 之前，确保清行标记最终值正确；
- 不传第三个 URL 参数，因此 pathname 不变；
- 不构造新 URL，因此 search 参数不丢失；
- 不得删除或重置 Next.js/浏览器已有 state 字段；
- `replaceState` 后对应 Base，`pushState` 后对应 Guard；
- 每次 state 写入前后记录/对比 `Object.keys(history.state ?? {})`，确认已有 keys 被保留且仅新增或更新 `app`、`kind`；
- 若同名 `app`/`kind` 已存在，清行标记可以覆盖它们，其余字段必须保留。

### 6.7 每个文件的修改内容

#### `contexts/BackControllerContext.tsx`

必须包含：

- `BackHandler`、`BackController` 接口；
- `Map<string, BackHandler>` 或等价稳定容器；
- `register` 同 id 覆盖；
- `unregister(id)`；
- `dispatchBack()` 按 priority 降序；相同 priority 用稳定注册顺序，不依赖对象键枚举偶然顺序；
- React Context + `useBackController()`；
- Provider 内创建单一 controller 实例；
- WebHistoryGuard，唯一注册 `popstate/pageshow`；
- effect cleanup 只移除监听，不通过 back/pop 改历史。

#### `app/page.tsx`

锁定重构：

```tsx
export default function Page() {
  return (
    <BackControllerProvider>
      <HomeContent />
    </BackControllerProvider>
  );
}

function HomeContent() {
  // 现有全部 useState/handler/render 函数移入这里
  // useBackController() 在 Provider 后代中合法调用
}
```

页面级 Handler 只注册两个聚合 Handler，内部按 auth 分支判断，防止两个分支同时消费：

| id | priority | 条件与行为 |
|---|---:|---|
| `page-auth-flow` | 60 | 仅 `authState === "guest"`：register/password-login → otp-login；otp-login → welcome；welcome 返回 false |
| `page-authenticated-root` | 50 | 仅 `authState === "authenticated"`，严格按“当前可见页面”顺序执行：先非 today Tab → today；再处理 today 的 execution → tasks；再 tasks → home；today/home 返回 false |

`page-authenticated-root` 的锁定伪代码：

```ts
if (authState !== "authenticated") return false;

if (activeTab !== "today") {
  setActiveTab("today");
  return true;
}

if (todayMode === "execution") {
  handleBackToTasks();
  return true;
}

if (todayMode === "tasks") {
  setTodayMode("home");
  return true;
}

return false;
```

原因：从任务执行页切换到我的/成长/足迹后，隐藏的 `todayMode` 可能仍是 `execution`。返回必须先把当前可见 Tab 切回今日，并保留原 `todayMode`，让用户回到原来的当前任务层；不可让隐藏状态先消费返回。

Handler 必须读取最新状态：useEffect 依赖含所读状态/回调，cleanup 注销；或使用 stable ref，但不得 stale closure。

#### `MeView.tsx`

| id | priority | 行为 |
|---|---:|---|
| `me-confirm` | 100 | `isActive && confirmMode !== null` → `setConfirmMode(null)` → true；否则 false |
| `me-subpage` | 90 | `isActive && meMode !== "home"` → `setMeMode("home")` → true；否则 false |

只有 MeView 挂载时注册；每个 handler 首先检查 `activeTab === "me"`，否则返回 false；cleanup 注销；confirm 优先于二级页。为提供显式可见性条件，`page.tsx` 向 MeView 传入 `isActive={activeTab === "me"}`（或等价布尔 prop），不得由 MeView 反向读取页面私有状态。

实际挂载核验：`page.tsx` 的 `renderContent()` 使用互斥分支，只渲染当前 activeTab；离开“我的”后 MeView 会卸载并 cleanup。显式 `isActive` 条件仍保留，防止未来渲染策略变化或 effect cleanup 边界错误导致不可见页面消费返回。

#### `FootprintsView.tsx`

| id | priority | 行为 |
|---|---:|---|
| `footprint-detail` | 80 | `isActive && footprintMode === "detail"` → `handleBackToList()` → true；否则 false |

cleanup 注销。每次 handler 先检查 `activeTab === "footprint"`，否则返回 false。`page.tsx` 向 FootprintsView 传入 `isActive={activeTab === "footprint"}`（或等价布尔 prop）。

实际挂载核验：当前互斥 `renderContent()` 会在离开足迹 Tab 时卸载 FootprintsView；显式 active 条件作为双重防护，确保不可见足迹详情永不消费返回。

### 6.8 状态与数据流

完整优先级：

```text
100 me-confirm
 90 me-subpage
 80 footprint-detail
 60 page-auth-flow
 50 page-authenticated-root
```

页面状态仍由原组件拥有；BackController 不拥有业务状态。

#### Base/Guard 初始化算法

```text
mount:
1. 读取 history.state；将当前对象快照为 `existingState`，记录写入前 state keys
2. 当前为 qingxing/guard：不重复 push
3. 当前为 qingxing/base：基于现有 state 展开字段后 push GUARD_STATE
4. 当前为 null/非 qingxing：基于现有 state 展开字段 replaceState(BASE_STATE)，再基于最新 state 展开字段 pushState(GUARD_STATE)
5. 每次写入后对比 state keys：既有 Next.js/浏览器 keys 必须仍存在，只有 `app`/`kind` 被新增或更新
6. 不传第三个 URL 参数，pathname/search 保持不变
7. Strict Mode cleanup 只解绑监听；第二次 mount 见 guard，跳过 push
```

#### popstate 精确分支

```text
A. event.state = qingxing/base（Guard → Base）
   1. 若 isExitingRef === true：不 dispatch、不 push
   2. 否则 handled = dispatchBack()
   3. handled === true：pushState(GUARD_STATE, "")
   4. handled === false：isExitingRef = true；history.back()

B. event.state = qingxing/guard（Base → Guard）
   1. isExitingRef = false
   2. 不 dispatchBack()
   3. 不重复 push Guard

C. event.state 为 null 或非 qingxing
   1. 已进入外部历史
   2. 不拦截、不 dispatch、不 push
```

#### pageshow / BFCache

仅恢复检查，不调用 `dispatchBack()`：

- 当前 guard：`isExitingRef=false`，不 push；
- 当前 base：仅当 `event.persisted === true` 且页面确实从 BFCache 恢复时，设置 `isExitingRef=false` 并 push 一个 guard；普通 `popstate` 进入 base 必须走上一节的 dispatch 分支，不得被恢复逻辑抢先 push；
- 当前外部：不拦截、不 push；
- `pageshow` 非 BFCache（`event.persisted === false`）不执行恢复 push；
- 不重复堆积 Guard。

### 6.9 禁止文件

除 §6.3/6.4 外全部禁止，包括 `layout.tsx`、AppShell、各 UI 文件和全部条件文件。

### 6.10 禁止行为

- `dispatchBack()` 访问 History/Capacitor；
- 子组件监听 popstate；
- 内部 Tab/子页切换 push history；
- Provider 自己在 Provider 外调用 Context；
- 提升 `meMode/confirmMode/footprintMode` 到 page.tsx；
- 修改 UI 视觉；
- Capacitor/SW/新路由。

### 6.11 lint 命令

```bash
cd C:\Dev\ai-todo
npm --prefix apps/mobile-app run lint
```

### 6.12 build 命令

```bash
cd C:\Dev\ai-todo
npm --prefix apps/mobile-app run build
```

### 6.13 范围核验命令

```bash
cd C:\Dev\ai-todo
git rev-parse HEAD
# $C2_BASE_HEAD 必须使用 Batch 开始前记录的 SHA，不得在完成后重新赋值
git diff --name-only $C2_BASE_HEAD -- apps/mobile-app
git diff $C2_BASE_HEAD -- apps/mobile-app/app/page.tsx apps/mobile-app/contexts/BackControllerContext.tsx apps/mobile-app/components/me/MeView.tsx apps/mobile-app/components/footprints/FootprintsView.tsx
git diff --no-index NUL apps/mobile-app/contexts/BackControllerContext.tsx
# 上一命令有差异时返回非零退出码属正常：目的是显示未跟踪新文件完整内容，不代表审查失败
git status --short --untracked-files=all
```

ChatGPT 批准并由 Claude Code 提交/push 后：

```bash
git show --name-only --format=oneline HEAD
git status --short --untracked-files=all
# 只剩长期未跟踪项；tracked 工作区干净
```

### 6.14 Codex 完成汇报格式

1. 实际文件；
2. `C2_BASE_HEAD` 和完成时 HEAD；
3. Provider/HomeContent 最终结构；
4. Controller 接口和纯调度边界；
5. Handler id/priority/可见性条件；
6. Strict Mode 注册与 cleanup；
7. Base/Guard 初始化；
8. 三个 popstate 分支；
9. pageshow/BFCache/前进恢复；
10. Android 返回至少 10 个场景结果；
11. History State 写入前后 keys 对比、保留既有字段的结论；
12. Git 范围与新增 Context 的 no-index 审查；
13. 提交/push 后 tracked 工作区状态；
14. 剩余风险。

### 6.15 Claude Code Review 清单

- [ ] Page → Provider → HomeContent 结构真实可用
- [ ] layout 未改且仍为 Server Component
- [ ] dispatchBack 纯调度，无 History/Capacitor
- [ ] 全项目只有一个 popstate/pageshow 监听器
- [ ] Handler 优先级和 auth 双分支正确
- [ ] authenticated 顺序先处理当前可见 Tab，再处理 todayMode；从其他 Tab 回今日时保留原 todayMode
- [ ] MeView/FootprintsView 当前虽随未激活 Tab 卸载，Handler 仍有 `isActive` 显式条件，不可见页面不能消费返回
- [ ] cleanup/同 id 覆盖/Strict Mode 正确
- [ ] Guard→Base 识别 `base`，Base→Guard 识别 `guard`
- [ ] 外部条目不拦截
- [ ] BFCache 不重复 Guard
- [ ] 每次 Base/Guard 写入都以 `existingState` 展开：写入前后 keys 对比确认 Next.js/浏览器已有字段未被删除
- [ ] 仅 `app`/`kind` 可被清行标记覆盖；不得整体替换 history.state
- [ ] `pushState`/`replaceState` 前后 `window.location.pathname` 不变
- [ ] 现有 `window.location.search` 参数不丢失（History 调用不传新 URL，或显式保持当前 URL）
- [ ] 页面刷新正常，history state 标记不导致白屏
- [ ] Next.js 单页状态机无导航异常；前进/后退不触发整页意外重载
- [ ] `app/layout.tsx` 保持 Server Component，无 `"use client"`
- [ ] 不提升子组件状态、不改 UI
- [ ] 无双重 AppShell/Tab 改动/长网页
- [ ] 禁止目录零修改；无 Capacitor/SW
- [ ] lint/build 通过

### 6.16 用户手动验收清单

至少覆盖：

1. Sheet → 返回关闭 Sheet；
2. 我的隐私页 → 返回我的首页；
3. 我的反馈页 → 返回我的首页；
4. 足迹详情 → 足迹列表；
5. execution → tasks；
6. tasks → home；
7. 足迹/成长/我的一级 Tab → 第一次返回只切回今日，并保留原 todayMode；若原为 execution，回到今日后仍显示当前任务执行层；
8. 在我的/足迹页面存在本地子状态时切换离开，确认不可见 Handler 不消费返回；
9. register/password → otp；
10. otp → welcome；
11. welcome 或 authenticated today/home → 尝试离开；
12. 浏览器前进进入 Guard 时不重复 dispatch；
13. 刷新/Strict Mode/BFCache 后不堆积 Guard；
14. 有外部历史和无外部历史两种根返回均记录实际行为；
15. 初始化和内部返回重建 Guard 前后 pathname 保持不变；
16. 带 search 参数打开页面，初始化/前进/后退后 search 参数不丢失；
17. 在写入前后记录 history.state keys，确认已有字段保留且只更新 `app`/`kind`；
18. 刷新正常，无白屏；history state 标记不破坏 Next.js 页面；
19. 前进/后退不触发整页意外重载或 Next.js 导航异常。

### 6.17 回滚点

以 `C2_BASE_HEAD` 为基线，仅恢复 C2 三个修改文件并删除新增 Context 文件/空 contexts 目录；不得回滚已提交的 C1。若 C2 未通过，不得用其累计 diff 开始 C3。

### 6.18 进入 C3 的出口条件

lint/build、Claude Code Review、至少 10 个返回场景、当前可见 Tab 顺序、不可见 Handler 防护、Next.js History 运行检查、前进/BFCache/Strict Mode、有/无外部历史根返回均通过，P0/P1=0；ChatGPT 批准精确文件后，由 Claude Code 逐文件提交并 push；提交范围正确且 tracked 工作区干净后进入 C3。

---

## 7. Batch C3：键盘与滚动锁

### 7.1 Batch 目标

- ExecutionFeedbackBox 使用 visualViewport 主方案；
- 不支持 visualViewport 时采用真实、受控、非长页的紧凑模式备选；
- MeFeedbackPage 增加受控滚动祖先 + focus 滚动；
- MeConfirmSheet 精确锁定 MeView 真实滚动容器；
- iOS touchmove/overscroll；
- 关闭后恢复 overflow 与 scrollTop。

### 7.2 前置条件

1. C2 已提交并 push，tracked 工作区干净。
2. 至少一台 Android Chrome + 一台可用 iOS Safari（如设备可用）准备真机验收。
3. ChatGPT 明确授权 C3。
4. 开始前记录 PowerShell 变量 `$C3_BASE_HEAD = git rev-parse HEAD`（或等价实际 SHA），不得夹带 C2 未提交 diff。

### 7.3 精确允许修改文件

1. `apps/mobile-app/app/globals.css`
2. `apps/mobile-app/components/today/TaskExecutionView.tsx`
3. `apps/mobile-app/components/today/ExecutionTaskCard.tsx`
4. `apps/mobile-app/components/today/ExecutionGuideCard.tsx`
5. `apps/mobile-app/components/today/ExecutionFeedbackBox.tsx`
6. `apps/mobile-app/components/me/MeView.tsx`
7. `apps/mobile-app/components/me/MeFeedbackPage.tsx`
8. `apps/mobile-app/components/me/MeConfirmSheet.tsx`

### 7.4 精确新增文件

无。

### 7.5 条件文件

- `GoalInputCard.tsx`：仅目标输入真机遮挡证据触发 Follow-up。
- `RegisterPage.tsx`：仅 AuthShell 滚动仍无法解决遮挡证据触发 Follow-up。

### 7.6 每个文件的修改内容

#### ExecutionFeedbackBox / TaskExecutionView / 显式 compact props 主方案

锁定所有权与实现：

1. `TaskExecutionView` 持有 `executionRootRef`、`isKeyboardFocused` 和 `isKeyboardCompact`；它是唯一计算 compact 状态的容器；
2. `TaskExecutionView` 必须显式传入同一 `isKeyboardCompact`：

```tsx
<ExecutionTaskCard task={task} compact={isKeyboardCompact} />
<ExecutionGuideCard
  guide={guide}
  isProcessing={isProcessing}
  hasSubmittedFeedback={hasSubmittedFeedback}
  compact={isKeyboardCompact}
/>
<ExecutionFeedbackBox
  isProcessing={isProcessing}
  onSubmit={handleFeedback}
  onFocusChange={setIsKeyboardFocused}
  compact={isKeyboardCompact}
/>
```

3. `ExecutionTaskCardProps` 新增 `compact?: boolean`，默认 `false`；`ExecutionGuideCardProps` 新增 `compact?: boolean`，默认 `false`；`ExecutionFeedbackBox` 可接收同一 `compact?: boolean`，或只接收等价 focus 状态，但必须由 TaskExecutionView 明确传入，禁止自行猜测父 DOM；
4. 禁止 `nth-child`、根据 Tailwind 类名猜 DOM、全局脆弱后代选择器；紧凑模式必须通过这三个组件的显式 prop 和组件内部条件渲染/className 完成；
5. `TaskExecutionView` 仅在 `isKeyboardFocused === true` 时监听 `window.visualViewport` 的 `resize` 和 `scroll`；
6. 聚焦瞬间记录 `baselineViewportHeight = window.visualViewport?.height ?? window.innerHeight`，键盘 inset 计算为：

```ts
const viewportDrop = Math.max(0, baselineViewportHeight - visualViewport.height);
const rawInset = Math.max(
  0,
  window.innerHeight - visualViewport.height - visualViewport.offsetTop,
);
const keyboardInset = viewportDrop >= 120 ? rawInset : 0;
```

7. **120px 是锁定的初始触发阈值**：普通地址栏收展通常小于该量级；只有 textarea 已聚焦且 visualViewport 相对聚焦基线下降至少 120px 才进入键盘紧凑模式，避免把浏览器地址栏变化误判为键盘；该阈值必须经 Android/iOS 真机验证，不能由 Codex自由改动；
8. 将数值写到 `executionRootRef.current` 的局部 CSS 变量 `--keyboard-inset: ${keyboardInset}px`，并在 `keyboardInset > 0` 时添加锁定类 `execution-keyboard-compact`；不得写到 `document.documentElement` 或其他全局根；
9. `globals.css` 只用该局部 class/变量压缩锁定的非核心区域，不通过自由 CSS selector 隐藏核心内容；
10. visualViewport 高度恢复到阈值内、textarea blur 或组件卸载时：`isKeyboardCompact=false`、清除局部变量/class、还原全部 padding/gap/说明/装饰；
11. effect cleanup 移除 `resize`/`scroll` listener，并从 `executionRootRef.current` 移除 CSS 变量/class；
12. 保持 TaskExecutionView `h-full overflow-hidden`，不改成整页 `overflow-y-auto`。

#### 键盘紧凑模式的实际 JSX 元素边界

根据当前 `TaskExecutionView`、`ExecutionTaskCard`、`ExecutionGuideCard`、`ExecutionFeedbackBox` JSX，锁定如下。

**始终保留，不得隐藏：**

1. `TaskExecutionView` 顶部导航中的返回能力（“回到任务”/“先退出”至少保留一个可操作返回入口）和页面身份；
2. `ExecutionTaskCard` 中 `task.title` 当前任务标题；
3. `ExecutionGuideCard` 中当前小步核心内容：标题“给你一个更轻的下一步”以及当前 guide/默认/反馈后的主要行动内容；
4. `ExecutionFeedbackBox` 标题、textarea；
5. “继续陪我推进”按钮；
6. “我完成了这一小步”按钮；
7. AppShell 外层固定的底部四 Tab。

**允许临时压缩但不得删除：**

- `TaskExecutionView` 根 `gap-3` 和 header `space-y-2`；
- `ExecutionTaskCard`、`ExecutionGuideCard`、`ExecutionFeedbackBox` 的上下 padding/内部 gap；
- header 主标题字号/上下间距，但页面身份仍可辨认；
- Guide 卡可用 flex 高度，但当前小步核心文字必须可读；
- textarea 高度可从 `h-20` 压缩到执行方案锁定的紧凑高度下限 64px，不得低于 64px。

**允许临时隐藏的非核心元素，仅限以下清单：**

- header 副文案“不用一次做好，只把这一小步推进一点。”；
- `ExecutionTaskCard` 状态标签“正在做”；
- `ExecutionTaskCard` 的 details 列表、预计分钟数、说明“完成要不要打勾，最后由你决定。”；
- `ExecutionGuideCard` 的纸飞机/星星装饰；
- `ExecutionFeedbackBox` 次级说明“不用写很多，一句话也可以。”；
- 其他纯装饰图标。

禁止 Codex 自由决定隐藏其他元素，尤其禁止完全隐藏/折叠 `ExecutionTaskCard` 或当前任务标题。

#### visualViewport 不支持时的真实备选

不得使用“单纯 scrollIntoView”。锁定为同一 **受控键盘紧凑模式**：

- 当 `window.visualViewport` 不存在时，textarea `focus` 直接设置 `isKeyboardCompact=true` 并添加 `execution-keyboard-compact`，不依赖 inset 数值；
- 只按上述白名单压缩或隐藏非核心元素；当前任务标题、当前小步、反馈区、两个动作按钮和底部四 Tab 始终保留；
- textarea `blur` 或组件卸载立即恢复；
- 任务执行根仍 `overflow-hidden`，没有无边界滚动；
- 若特定浏览器仍遮挡，才允许后续建立仅限任务执行内容区、带明确 `max-height` 的受控滚动容器，必须单独审查，不在 Codex 本批自由选择。

#### `MeFeedbackPage.tsx`

锁定：

- 在现有 PaperCard 内新增明确 `ref` 指向的 `overflow-y-auto overscroll-contain` 内容容器；
- PaperCard 保持 `min-h-0 flex-1 overflow-hidden`，滚动只发生在内部容器；
- textarea focus 后以 `requestAnimationFrame`（必要时监听 visualViewport resize 后再调用）对该明确容器中的目标区域执行 `scrollIntoView({ block: "nearest" })`；
- 不缩小 textarea 180px，除非后续 UI Spec 单独批准；
- 成功态结构不改；
- 两处触控修复应保留。

#### `MeView.tsx` + `MeConfirmSheet.tsx`

禁止 `document.querySelector("[data-scroll-lock]")`。锁定为 ref 传递：

```tsx
const scrollContainerRef = useRef<HTMLDivElement>(null);
<div ref={scrollContainerRef} className="... overflow-y-auto ..." />
<MeConfirmSheet scrollContainerRef={scrollContainerRef} ... />
```

Sheet effect：

1. 读取 `scrollContainerRef.current`；
2. 保存原 `style.overflow`、`style.overscrollBehavior` 和 `scrollTop`；
3. 设置 `overflow: hidden`、`overscrollBehavior: contain`；
4. cleanup 恢复原样式和保存的 `scrollTop`；
5. Strict Mode 每次 mount/cleanup 对称；
6. 遮罩 `onTouchMove={(event) => event.preventDefault()}` + `touch-none`；
7. Sheet section 加 `overscroll-contain`；
8. 不修改 body，不锁其他页面滚动容器。

### 7.7 状态与数据流

```text
ExecutionFeedbackBox textarea focus
  → 通知 TaskExecutionView 键盘聚焦态
  → visualViewport resize/scroll
  → 更新 TaskExecutionView 局部 --keyboard-inset
  → CSS 调整单屏布局
blur/unmount
  → 清变量、清 class、解绑 listeners、恢复布局
```

```text
MeView scrollContainerRef
  → MeConfirmSheet prop
  → Sheet mount 精确锁 overflow + 保存 scrollTop
  → Sheet cleanup 恢复 overflow/overscroll/scrollTop
```

### 7.8 禁止文件

除 §7.3 外全部禁止；两个条件文件未触发时同样禁止。

### 7.9 禁止行为

- ExecutionFeedbackBox 只调用 scrollIntoView 作为降级；
- 把任务执行页改成长网页；
- 全局 querySelector 锁滚动；
- 锁 body 作为首选；
- 固定 300ms 定时器作为唯一键盘逻辑；
- 未清 listener/CSS 变量；
- 改任务/Mock 数据流、UI 文案或 Tab。

### 7.10 lint 命令

```bash
cd C:\Dev\ai-todo
npm --prefix apps/mobile-app run lint
```

### 7.11 build 命令

```bash
cd C:\Dev\ai-todo
npm --prefix apps/mobile-app run build
```

### 7.12 范围核验命令

```bash
cd C:\Dev\ai-todo
git rev-parse HEAD
# $C3_BASE_HEAD 必须使用 Batch 开始前记录的 SHA，不得在完成后重新赋值
git diff --name-only $C3_BASE_HEAD -- apps/mobile-app
git diff $C3_BASE_HEAD -- apps/mobile-app/app/globals.css apps/mobile-app/components/today/TaskExecutionView.tsx apps/mobile-app/components/today/ExecutionTaskCard.tsx apps/mobile-app/components/today/ExecutionGuideCard.tsx apps/mobile-app/components/today/ExecutionFeedbackBox.tsx apps/mobile-app/components/me/MeView.tsx apps/mobile-app/components/me/MeFeedbackPage.tsx apps/mobile-app/components/me/MeConfirmSheet.tsx
git status --short --untracked-files=all
```

ChatGPT 批准并由 Claude Code 提交/push 后：

```bash
git show --name-only --format=oneline HEAD
git status --short --untracked-files=all
# 只剩长期未跟踪项；tracked 工作区干净
```

### 7.13 Codex 完成汇报格式

1. 实际文件；
2. `C3_BASE_HEAD` 和完成时 HEAD；
3. visualViewport 基线、inset 公式和 120px 阈值；
4. CSS 变量/class 作用域、设置/清除时机；
5. listener 列表和 cleanup；
6. 始终保留、允许压缩、允许隐藏的实际 JSX 清单；
7. 无 visualViewport 时如何由 focus 进入同一紧凑模式；
8. 是否保持当前任务标题/当前小步/反馈区/两动作按钮/底部四 Tab；
9. 是否保持单屏任务层；
10. MeFeedback 明确滚动祖先和 focus 流程；
11. MeView ref → Sheet 流程；
12. Strict Mode/重复开关/scrollTop 恢复；
13. Android/iOS 键盘与 Sheet 结果；
14. 条件文件是否零修改；
15. lint/build/Git 范围；
16. 提交/push 后 tracked 工作区状态；
17. 剩余风险。

### 7.14 Claude Code Review 清单

- [ ] visualViewport 聚焦基线、inset 公式、120px 防地址栏误判阈值和 cleanup 正确
- [ ] 不支持时不是单纯 scrollIntoView，而是 focus 驱动的同一受控紧凑模式
- [ ] 当前任务标题、当前小步核心内容、FeedbackBox、继续按钮、完成按钮、底部四 Tab 始终保留
- [ ] `ExecutionTaskCard` 添加 `compact?: boolean` 默认 `false`
- [ ] `ExecutionGuideCard` 添加 `compact?: boolean` 默认 `false`
- [ ] 紧凑模式通过显式 `compact` prop 传递到 `ExecutionTaskCard`、`ExecutionGuideCard` 和 `ExecutionFeedbackBox`；未使用 `nth-child`、Tailwind 类名猜 DOM 或全局后代选择器
- [ ] 只压缩/隐藏白名单中的 padding、gap、次级说明和装饰；未隐藏整个 ExecutionTaskCard
- [ ] TaskExecutionView 未成长网页，BottomTabBar 可见
- [ ] 键盘关闭/blur/unmount 恢复原布局
- [ ] MeFeedback 只有内部受控滚动
- [ ] MeConfirmSheet 使用精确 ref，不用全局 selector
- [ ] 不锁 body；overflow/overscroll/scrollTop 对称恢复
- [ ] iOS 遮罩 touchmove 和 Sheet overscroll 正确
- [ ] 条件文件无证据时零修改
- [ ] 无双重 AppShell/Tab/UI 风格变化
- [ ] 禁止目录零修改；无 Capacitor/SW
- [ ] 375/390/430 和 lint/build 通过

### 7.15 用户手动验收清单

- [ ] ExecutionFeedbackBox 在 Android Chrome 键盘下当前任务标题、当前小步、textarea、继续按钮、完成按钮、底部四 Tab均可见或可操作
- [ ] iOS Safari 同场景通过
- [ ] 地址栏收展但键盘未打开时，不误进入紧凑模式
- [ ] 无 visualViewport 的模拟/目标设备通过 focus 进入紧凑模式，核心元素完整且未成长页
- [ ] 键盘关闭后任务卡/Guide/间距/次级内容/装饰全部恢复
- [ ] MeFeedback textarea 与提交按钮可见，可在内部滚动
- [ ] Sheet 打开时我的页背景不可滚动
- [ ] Sheet 自身超高时可滚动且不穿透
- [ ] 遮罩关闭/按钮关闭/返回键关闭后原 scrollTop 恢复
- [ ] 连续打开关闭、Strict Mode 下无残留锁
- [ ] GoalInput/Register 如无问题，确认零改；如有问题，保存证据等待 Follow-up

### 7.16 回滚点

以 `C3_BASE_HEAD` 为基线恢复 C3 八个固定文件；不得回滚已提交的 C1/C2。若 Sheet 锁失败，先整体撤销 C3 的 Sheet ref/锁逻辑，不允许临时改 body 逃避 Review；不得用 C3 累计未提交 diff 开始 C4。

### 7.17 进入 C4 的出口条件

C3 lint/build、Claude Code Review、Android 真机键盘/滚动锁、iOS（如可用）、地址栏误判防护、核心上下文保留均通过，任务层无长页，P0/P1=0；ChatGPT 批准精确文件后由 Claude Code 逐文件提交并 push，tracked 工作区干净；同时 C4 图标视觉闸门通过后，才可进入 C4。

---

## 8. Batch C4：PWA 基础安装能力

### 8.1 Batch 目标

- `app/manifest.ts`；
- Apple Web App metadata；
- 192/512/maskable/180 图标；
- Android Chrome 安装和 standalone 验证；
- iOS Safari 添加到主屏幕和 standalone 验证。

### 8.2 前置条件（视觉阻断闸门）

以下全部满足前，C4 **不得交给 Codex**：

1. Codex 不得自由设计清行图标。
2. Codex 不得自行选择叶子、纸飞机、小芽或任何其他图形。
3. 图标设计先由 ChatGPT 做产品方向把关。
4. 用户确认源视觉后，才允许导出 PNG。
5. 用户未确认源视觉前，不创建 `public/icons/`，不写 Manifest 引用。
6. Manifest 与四个图标必须在同一可用 Batch 落地，避免长期引用不存在资源。
7. C1–C3 已通过、分别提交并 push，tracked 工作区干净，ChatGPT 明确授权 C4。
8. 开始前记录 PowerShell 变量 `$C4_BASE_HEAD = git rev-parse HEAD`（或等价实际 SHA）。

### 8.3 精确允许修改文件

- `apps/mobile-app/app/layout.tsx`

### 8.4 精确新增文件

1. `apps/mobile-app/app/manifest.ts`
2. `apps/mobile-app/public/icons/icon-192.png`
3. `apps/mobile-app/public/icons/icon-512.png`
4. `apps/mobile-app/public/icons/icon-512-maskable.png`
5. `apps/mobile-app/public/icons/icon-180.png`

### 8.5 条件文件

无；C4 是整批条件阻断，不拆成无图标 Manifest 半批。

### 8.6 每个文件的修改内容

| 文件 | 精确修改 |
|---|---|
| `manifest.ts` | `name/short_name="清行"`、description、`start_url:"/"`、`display:"standalone"`、`background_color:"#F7F3EA"`、`theme_color:"#0F3155"`、`orientation:"portrait"`；引用 192、512 any、512 maskable |
| `layout.tsx` | 保留 Server Component；metadata 加 `appleWebApp` 和 `icons.apple` 指向 `/icons/icon-180.png`；不加 `"use client"` |
| 四个 PNG | 只能从用户确认的同一源视觉导出；尺寸/透明度/maskable safe zone 经检查；不得由 Codex重新设计 |

Manifest 与磁盘文件逐项一致，不允许死链接。

### 8.7 状态与数据流

无 React 业务状态。浏览器读取 metadata/Manifest/图标；不引入 Service Worker，不改应用数据流。

### 8.8 禁止文件

除 §8.3/8.4 外全部禁止。

### 8.9 禁止行为

- 自由设计图标或擅选图形；
- Manifest 先引用不存在图标；
- Service Worker/离线页面/自定义安装弹窗；
- Capacitor/static export/APK；
- 修改 Next 配置、依赖、页面 UI。

### 8.10 lint 命令

```bash
cd C:\Dev\ai-todo
npm --prefix apps/mobile-app run lint
```

### 8.11 build 命令

```bash
cd C:\Dev\ai-todo
npm --prefix apps/mobile-app run build
```

### 8.12 范围核验命令

```bash
cd C:\Dev\ai-todo
git rev-parse HEAD
# $C4_BASE_HEAD 必须使用 Batch 开始前记录的 SHA，不得在完成后重新赋值
git diff --name-only $C4_BASE_HEAD -- apps/mobile-app
git diff $C4_BASE_HEAD -- apps/mobile-app/app/layout.tsx apps/mobile-app/app/manifest.ts
git diff --no-index NUL apps/mobile-app/app/manifest.ts
# 上一命令有差异时返回非零退出码属正常：目的是显示未跟踪新文件完整内容，不代表审查失败
git status --short --untracked-files=all
```

ChatGPT 批准并由 Claude Code 逐文件提交/push 后：

```bash
git show --name-only --format=oneline HEAD
git status --short --untracked-files=all
# 只剩长期未跟踪项；tracked 工作区干净
```

另逐个核验 PNG（不做文本 diff）：

```text
1. 文件存在：public/icons/icon-192.png、icon-512.png、icon-512-maskable.png、icon-180.png
2. 实际尺寸与文件名一致：192×192、512×512、512×512、180×180
3. 格式为 PNG，能正常打开，非损坏或文本文件错误命名
4. maskable 版本满足已确认 safe zone
5. 路径与 Manifest 引用一致
```

### 8.13 Codex 完成汇报格式

1. 用户确认源视觉的引用/确认结论；
2. `C4_BASE_HEAD` 和完成时 HEAD；
3. 实际文件；
4. Manifest 全字段；
5. 四图标尺寸、格式、来源；
6. maskable safe zone 检查；
7. metadata/Manifest 路径一致性；
8. Android Chrome Manifest/安装/standalone；
9. iOS Add to Home Screen/icon/standalone；
10. 证明未新增 SW/Capacitor；
11. lint/build/Git 范围；
12. 提交/push 后 tracked 工作区状态；
13. 剩余风险。

### 8.14 Claude Code Review 清单

- [ ] 有 ChatGPT 产品把关和用户源视觉确认
- [ ] Codex 未自由设计/选图形
- [ ] Manifest 与四个实际文件同批存在
- [ ] 名称、品牌色、start_url、display、orientation 正确
- [ ] 192/512/maskable/180 尺寸和引用正确
- [ ] layout 仍是 Server Component
- [ ] 无 SW/离线/自定义安装弹窗/Capacitor/static export
- [ ] 未改页面 UI/Tab/禁止目录
- [ ] Android/iOS 安装验收和 lint/build 通过

### 8.15 用户手动验收清单

- [ ] 主屏幕图标与确认源视觉一致
- [ ] Android Chrome 识别 Manifest，无图标错误
- [ ] Android 可完成安装，standalone 无浏览器工具栏
- [ ] iOS Safari Share → 添加到主屏幕可用
- [ ] iOS 主屏幕使用 180 图标，standalone 正常
- [ ] 启动背景/主题色符合暖米白+深蓝
- [ ] 375/390/430 页面视觉无回归

### 8.16 回滚点

以 `C4_BASE_HEAD` 为基线恢复 `layout.tsx` 的 C4 metadata，删除 `manifest.ts` 和本批四个 PNG/空 icons 目录；不得回滚 C1 的 `viewportFit` 或已提交的 C2/C3。

### 8.17 V3.0C 出口条件

C4 视觉闸门、lint/build、Claude Code Review、Android 安装、iOS 添加到主屏幕（设备可用时）、standalone、全阶段禁止范围核验均通过，P0/P1=0；经 ChatGPT 最终批准后由 Claude Code 按精确文件逐个暂存、提交并 push；提交范围正确、tracked 工作区干净后，V3.0C 才可完成。

---

## 9. 每 Batch 通用 Review 红线

每次 Claude Code Review 必查：

- 是否只修改该 Batch 允许文件；
- 是否出现双重 AppShell；
- 是否改变“今日/足迹/成长/我的”四 Tab；
- 是否把任务执行页改成长网页；
- 是否修改 services/mockData/types；
- 是否修改 `src/**`；
- 是否修改 API/Auth/Supabase/prompts；
- 是否引入 Capacitor；
- 是否新增 Service Worker；
- 是否破坏 375/390/430 布局；
- 是否出现强紫色、SaaS 风、聊天入口；
- 是否通过 lint/build；
- 是否记录 `<BATCH_BASE_HEAD>`，并只按当前 Batch 白名单核验 diff；
- 是否在 ChatGPT 批准前保持未暂存/未提交；
- 获得授权后是否由 Claude Code 逐文件暂存，未使用 `git add .`；
- 提交/push 后是否用 `git show` 核验精确范围，并确认 tracked 工作区干净；
- 条件文件是否在无证据情况下被修改；
- 16 个固定修改文件、3 个固定新增文本源文件、3 个条件文件、4 个图片资源的边界在 Review 中完整覆盖；
- Codex 是否执行了 `git add`、commit、push（均禁止）。

---

## 10. 条件 Follow-up 指令规则

若条件文件触发，必须先形成证据记录：

```text
设备/系统：
浏览器与版本：
视口/方向：
复现步骤：
预期：
实际：
截图/录屏：
为何固定 Batch 文件无法解决：
唯一建议条件文件：
```

然后由 ChatGPT/Claude Code 单独发出 Follow-up，且只允许一个最小问题域。禁止使用“可能修改其他相关文件”“视情况扩大”“如有需要自由调整”。

---

## 11. 最终禁止项确认

V3.0C 不得加入：

- 真实后端；
- Supabase Auth；
- Adapter / Facade；
- API 类型对齐；
- Service Worker；
- 离线页面；
- Capacitor；
- Android 工程；
- Static Export；
- APK / AAB；
- 中国大陆部署；
- 短信登录；
- 新增聊天 Tab；
- 新增项目管理入口。

---

## 12. 全文计数汇总

以下数字为本文档唯一权威统计，所有章节、表格、命令、Review 清单必须与此一致。

| 维度 | 最终值 |
|---|---|
| 全阶段固定修改文件（按唯一路径） | **16 个** |
| 全阶段固定新增文本源文件 | **3 个** |
| 全阶段条件修改文件 | **3 个** |
| C4 新增图片资源 | **4 个 PNG** |
| C1 固定修改文件 | **11 个** |
| C1 固定新增文件 | **1 个** |
| C2 固定修改文件 | **3 个** |
| C2 固定新增文件 | **1 个** |
| C3 固定修改文件 | **8 个** |
| C3 固定新增文件 | **0 个** |
| C4 固定修改文件 | **1 个** |
| C4 固定新增文件 | **1 个文本 + 4 个 PNG** |
| 触控锁定 | **9 个代码位置 · 7 个文件 · 7 种文案** |
| 触控变更映射 | 涉及 `min-h-[@{38,40,42,34}px]` → `min-h-touch` |

## 13. 本执行方案自身验收

- [ ] 只新增 `docs/Execution-Plan-V3.0C-Mobile-Hardening.md`
- [ ] 未修改 Roadmap、Architecture、Project-State-Handoff
- [ ] 未修改任何代码
- [ ] 未创建 Manifest/图标/目录
- [ ] 未安装依赖
- [ ] 未运行自动修复
- [ ] 未 git add/commit/push
- [ ] 已运行 `git status --short --untracked-files=all`
- [ ] 已运行 `git diff --no-index NUL docs/Execution-Plan-V3.0C-Mobile-Hardening.md`

---

> 文档结束。等待 ChatGPT 对 Execution Plan 做实际文件审查；通过前不交给 Codex。
