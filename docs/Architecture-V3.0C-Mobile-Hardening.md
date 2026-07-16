# V3.0C 架构方案：手机端体验加固与安装基础

> 状态：架构设计阶段
> 定位：V3.0C 技术架构方案，只写文档不写代码
> 依赖：V3.0B 完成 ✅ | V3.0C 只读审计完成 ✅
> 关联路线：[Roadmap-V3.0C-to-V3.3-Mobile-Production.md](Roadmap-V3.0C-to-V3.3-Mobile-Production.md)
> 创建日期：2026-07-15
> 最后修订：2026-07-15（15 项修正）

---

## 目录

1. [V3.0C 产品目标](#1-v30c-产品目标)
2. [当前移动端架构](#2-当前移动端架构)
3. [Safe Area 方案](#3-safe-area-方案)
4. [视口方案](#4-视口方案)
5. [键盘方案](#5-键盘方案)
6. [滚动锁方案](#6-滚动锁方案)
7. [44px 触控规范](#7-44px-触控规范)
8. [统一返回栈架构](#8-统一返回栈架构)
9. [Web History 与未来 Capacitor 的衔接](#9-web-history-与未来-capacitor-的衔接)
10. [Manifest 和图标方案](#10-manifest-和图标方案)
11. [Service Worker 明确延期](#11-service-worker-明确延期)
12. [文件级预计范围](#12-文件级预计范围)
13. [禁止文件](#13-禁止文件)
14. [风险矩阵](#14-风险矩阵)
15. [真机测试矩阵](#15-真机测试矩阵)
16. [375 / 390 / 430 验收](#16-375--390--430-验收)
17. [Android Chrome 验收](#17-android-chrome-验收)
18. [iPhone Safari 验收](#18-iphone-safari-验收)
19. [lint / build](#19-lint--build)
20. [V3.0C 退出条件](#20-v30c-退出条件)
A. [附录：冲突 P2 复核](#a-附录冲突-p2-复核)

---

## 1. V3.0C 产品目标

在不动后端、不动 Mock、不装 Capacitor 的前提下，让清行在 Android Chrome 和 iOS Safari 上成为一个：

- **安全区正确**：顶部/底部/左右不被系统 UI 遮挡
- **触控友好**：所有核心交互区域 ≥44px
- **键盘不遮挡**：输入框聚焦时不会被键盘遮盖
- **返回键正确**：Android 返回键按用户预期工作
- **可安装**：能添加到主屏幕，standalone 模式正常运行

---

## 2. 当前移动端架构

### 2.1 状态机拓扑与状态所有权

当前 `app/page.tsx` 使用单页状态机，不依赖 Next.js 路由。**状态所有权分散在多个文件中**，这是返回栈方案的关键约束：

```
page.tsx (Home 组件) ─── 拥有以下状态 ───
  authState: "guest" | "authenticated"
  authScreen: "welcome" | "otp-login" | "password-login" | "register"
  activeTab: "today" | "footprint" | "growth" | "me"
  todayMode: "home" | "tasks" | "execution"
  todayState: TodayState | null
  isGenerating: boolean
  taskHint: string
  executingTaskId: string | null

FootprintsView ─── 拥有以下本地状态 ───
  footprintMode: "empty" | "list" | "detail"     ← page.tsx 不可直接访问
  selectedFootprintId: string | null               ← page.tsx 不可直接访问

MeView ─── 拥有以下本地状态 ───
  meMode: "home" | "privacy" | "feedback"         ← page.tsx 不可直接访问
  confirmMode: ConfirmMode | null                  ← page.tsx 不可直接访问
```

**关键事实**：`page.tsx` 当前没有任何方式直接读取或写入 `footprintMode`、`meMode`、`confirmMode`。这些是子组件的本地 `useState`，不是提升到 `page.tsx` 的共享状态。任何架构方案必须以此为起点。

### 2.2 当前已实现的移动端能力

| 能力 | 状态 | 位置 |
|------|:--:|------|
| `h-[100svh]` 视口高度 | ✅ | AppShell.tsx:13 |
| `max-w-mobile: 430px` | ✅ | tailwind.config.ts |
| `pb-safe-bottom` (env safe-area-inset-bottom) | ✅ | BottomTabBar.tsx:26 + tailwind.config.ts |
| `pb-[84px]` BottomTabBar 预留 | ✅ | AppShell.tsx:14 |
| `min-h-touch: 44px` token | ✅ | tailwind.config.ts |
| `-webkit-tap-highlight-color: transparent` | ✅ | globals.css |
| `touch-action: manipulation` | ✅ | globals.css |
| `userScalable: false` | ✅ | layout.tsx:13 |

### 2.3 当前缺失的移动端能力

| 能力 | 缺失详情 |
|------|------|
| viewport-fit=cover | layout.tsx 无 `viewportFit: "cover"` |
| 顶部 safe-area | 无 `pt-safe-top` / `env(safe-area-inset-top)`。Auth 页面也不做安全区 |
| 左右 safe-area | 使用固定 `px-6`，未使用 `env(safe-area-inset-left/right)`。Auth 页面同 |
| 统一返回栈 | 无 History API / popstate 监听 |
| PWA Manifest | 无 manifest 文件 |
| 图标 | 无 PWA 图标、无 apple-touch-icon |
| 键盘适配 | 无 scrollIntoView / visualViewport 处理 |
| 滚动锁 | MeConfirmSheet 无 body/容器 scroll lock |
| 横屏处理 | 无横屏降级策略 |

---

## 3. Safe Area 方案

### 3.1 问题分析

当前状态：
- **底部安全区**：✅ 已通过 `pb-safe-bottom` (BottomTabBar.tsx) 和 `pb-[84px]` (AppShell.tsx) 处理
- **顶部安全区**：❌ 缺失。`pt-8` 是固定值，在 iPhone 灵动岛机型上会被状态栏遮挡
- **左右安全区**：❌ 缺失。`px-6` 是固定 24px，在折叠屏或横屏时可能不足
- **viewport-fit**：❌ 缺失。未设置 `viewport-fit=cover`，iOS 不会将内容延伸到 safe area
- **Auth 页面**：❌ 全部缺失。Auth 页面渲染在 AppShell 外（[page.tsx:263-291](../apps/mobile-app/app/page.tsx#L263-L291)），没有任何 safe-area 保护

### 3.2 方案

#### 3.2.1 viewport-fit=cover

**文件**：[app/layout.tsx](../apps/mobile-app/app/layout.tsx)

```typescript
export const viewport: Viewport = {
  themeColor: "#0F3155",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",  // 新增
};
```

`viewport-fit=cover` 全局生效，影响所有页面（包括 Auth 页面和 AppShell 内页面）。它告知 iOS 内容可以延伸到 safe area 区域。但这**只让内容可以延伸**，不自动添加 padding——各页面仍需自行处理 safe-area 内边距。

#### 3.2.2 顶部 safe-area

顶部 safe-area 通过 `app/globals.css` 中定义的 CSS 变量实现；此文件是复杂 safe-area 和 shell 尺寸变量的集中位置。不再依赖 `tailwind.config.ts` 新增 safe-area padding token。AppShell `<main>` 顶部通过 CSS 变量计算 `calc(32px + env(safe-area-inset-top, 0px))` 保留原有 32px 视觉间距。

#### 3.2.3 Auth 页面 safe-area

Auth 页面（WelcomePage、OtpLoginPage、PasswordLoginPage、RegisterPage）渲染在 AppShell 外，需要独立的 safe-area 处理。

**推荐方案：共享 AuthShell 包装器**

新增 `components/auth/AuthShell.tsx`，为所有 Auth 页面提供统一的 safe-area 容器：

```
AuthShell
  仅叠加系统 safe-area inset（top/left/right/bottom）
  children (具体 Auth 页面内容)
```

**涉及文件**：

| 文件 | 改动类型 | 说明 |
|------|:--:|------|
| [page.tsx](../apps/mobile-app/app/page.tsx) | 修改 | Auth 页面分支用 AuthShell 包裹 |
| `components/auth/AuthShell.tsx` | **新增** | 共享 Auth 安全区容器 |
| WelcomePage / OtpLoginPage / PasswordLoginPage / RegisterPage | 不修改 | 页面本身不需要改，安全区由 AuthShell 提供 |

**备选方案**：逐页处理——在每个 Auth 页面的根 `<div>` 上各自添加 safe-area。代码重复度高，不推荐。

不论哪种方案，Auth 页面的**顶部/左右/底部 safe-area** 和**键盘区域底部安全区**都必须覆盖。

#### 3.2.4 左右 safe-area

使用 CSS `max()` 确保左右内边距不小于 safe-area-inset：

```css
/* 方案 A：内联 style（推荐，Tailwind v3 限制最少） */
padding-left: max(24px, env(safe-area-inset-left, 0px));
padding-right: max(24px, env(safe-area-inset-right, 0px));

/* 方案 B：CSS 变量桥接（可在 globals.css 中定义） */
/* 执行方案阶段选定 */
```

AppShell 和 AuthShell 都需要此处理。

#### 3.2.5 BottomTabBar 底部 safe-area 与内容避让

**当前实现**：

- BottomTabBar：[nav](../apps/mobile-app/components/shell/BottomTabBar.tsx#L26)：`fixed bottom-0` + `pb-safe-bottom`
  - 内部 grid：`min-h-[76px]`（4 个 `min-h-touch` 按钮排列）
  - 实际占用屏幕高度 = 76px + `env(safe-area-inset-bottom)`
- AppShell main：[main](../apps/mobile-app/components/shell/AppShell.tsx#L14)：`pb-[84px]`

**避让计算**：
- 无安全区设备（safe-area-inset-bottom = 0）：TabBar 占 ~76px，main pb 84px → ✅ 有 8px 缓冲
- iPhone 14 Pro（safe-area-inset-bottom ≈ 34px）：TabBar 占 ~110px，main pb 84px → ❌ 差 26px
- 安全区较大设备：底部内容可能被 TabBar 遮挡

**修正方案**：将 `pb-[84px]` 替换为表达式，明确 TabBar 基础高度 + safe-area-bottom 的关系。执行方案阶段确定使用 CSS 变量还是 Tailwind 任意值。

**Sheet 打开时的覆盖关系**：MeConfirmSheet 使用 `fixed inset-y-0`，覆盖整个屏幕包括 BottomTabBar。不需要额外处理。

#### 3.2.6 Safe Area 涉及文件汇总

| 文件 | 改动类型 | 说明 |
|------|:--:|------|
| `app/layout.tsx` | 修改 | 添加 `viewportFit: "cover"` |
| `app/globals.css` | 修改 | 集中定义 safe-area/layout CSS 变量，AppShell/AuthShell padding 规则 |
| `components/shell/AppShell.tsx` | 修改 | pt/px 替换为 safe-area 感知值、pb 避让修正 |
| `components/auth/AuthShell.tsx` | **新增** | Auth 页面统一 safe-area 容器 |
| `app/page.tsx` | 修改 | Auth 页面分支包裹 AuthShell |

---

## 4. 视口方案

### 4.1 当前方案

当前视口模型已经正确：

```
h-[100svh]              ← AppShell 外层
  flex flex-col
  overflow-hidden
  ├─ main (flex-1, min-h-0, overflow-hidden)
  │   └─ children (页面内容)
  └─ BottomTabBar (fixed bottom-0)
```

使用 `svh`（small viewport height）而非 `vh`。

### 4.2 svh 行为说明

- `svh`（Small Viewport Height）：使用浏览器 UI **展开时**的视口高度，通常保持稳定，不随地址栏收展跳动
- `lvh`（Large Viewport Height）：使用浏览器 UI **收起时**的视口高度
- `dvh`（Dynamic Viewport Height）：**随浏览器 UI 动态改变**——这才是会跳动的单位

当前使用 `svh` 是正确的选择：它提供稳定的视口尺寸，避免 `dvh` 的跳动问题。但 `svh` 本身不解决键盘弹出后的遮挡问题——键盘不一定改变 viewport unit，键盘适配仍需 visualViewport / 真机验证。

### 4.3 375 / 390 / 430 宽度验证

三档目标宽度：

| 宽度 | 对应机型 | 验证重点 |
|------|------|------|
| 375px | iPhone 6/7/8/SE, iPhone 12/13 mini | 最小宽度不崩 |
| 390px | iPhone 14 Pro（主验收视口） | 核心验收标准 |
| 430px | iPhone 14 Pro Max, 部分 Android | 最大宽度不崩 |

验证方法：Chrome DevTools Responsive Mode 逐页截图。

### 4.4 横屏降级策略

当设备宽度 > 高度（横屏）或宽度 < 320px 时，显示友好提示而非崩溃布局。

**方案**：在 AppShell 或 layout.tsx 中通过 CSS 媒体查询处理：

```css
/* 横屏时居中提示 */
@media (orientation: landscape) and (max-height: 500px) {
  .app-landscape-warning {
    display: flex;
  }
  .app-content {
    display: none;
  }
}
```

**实现位置**：`components/shell/AppShell.tsx` 中新增条件渲染，或纯 CSS 方案。

横屏提示文案建议："清行更适合竖屏使用。\n转回来，我们继续今天的小步。"

---

## 5. 键盘方案

### 5.1 先决分析：真实滚动容器

在讨论键盘方案之前，必须先明确每个页面的滚动容器。`scrollIntoView` 需要**可滚动祖先**才能生效。

#### 5.1.1 AppShell 层

```
AppShell outer div:  h-[100svh] overflow-hidden    ← 不可滚动
  main:               overflow-hidden               ← 不可滚动
    inner div:        overflow-hidden               ← 不可滚动
      [页面内容]
  BottomTabBar:       fixed bottom-0
```

**AppShell 的所有层级均为 `overflow-hidden`。AppShell 本身不提供任何可滚动容器。**

#### 5.1.2 各页面内部容器

| 页面/组件 | 外层容器 | 内层可滚动容器 | 可滚动？ |
|------|------|------|:--:|
| TodayHomeView | `overflow-hidden` | 无 overflow-y-auto | ❌ |
| TaskListView | `overflow-hidden` | 需确认 | ⚠️ |
| TaskExecutionView | `overflow-hidden` | 无 overflow-y-auto | ❌ |
| ExecutionFeedbackBox | (在 TaskExecutionView 内) | 继承上级 `overflow-hidden` | ❌ |
| MeView (home) | `overflow-hidden` | `overflow-y-auto` 在 flex-1 子 div | ✅ |
| MePrivacyPage | `overflow-hidden` | `overflow-y-auto` 在 flex-1 子 div | ✅ |
| MeFeedbackPage | `overflow-hidden` | 无 overflow-y-auto | ❌ |
| FootprintsView (list) | `overflow-hidden` | 无 overflow-y-auto | ❌ |
| FootprintDetailView | `overflow-hidden` | `overflow-y-auto` 在内部子 div | ✅ |
| GrowthView | `overflow-hidden` | 需确认 | ⚠️ |
| OtpLoginPage | 居中布局 | 无 | ❌ |
| PasswordLoginPage | 居中布局 | 无 | ❌ |
| RegisterPage | 居中布局 | 无 | ❌ |

#### 5.1.3 关键发现

1. **TaskExecutionView 没有可滚动祖先**：[TaskExecutionView.tsx:61](../apps/mobile-app/components/today/TaskExecutionView.tsx#L61)：`overflow-hidden` + 所有子元素 `shrink-0`。这是**有意设计**——任务执行页不是无边界长页，当前通过固定视口和 overflow-hidden 控制为单屏任务层，所有内容在 flex 布局中分配空间，不允许内部滚动。`scrollIntoView` 在此页面上**没有可滚动祖先可供调用**。

2. **ExecutionFeedbackBox 是 TaskExecutionView 的子组件**：textarea 和按钮在 `shrink-0` 的 PaperCard 中。当前布局假设键盘不会遮挡。真机上键盘弹出后，整个 TaskExecutionView 被 AppShell 的 `h-[100svh]` 限制在剩余空间内。

3. **MeFeedbackPage 没有可滚动祖先**：[MeFeedbackPage.tsx:63](../apps/mobile-app/components/me/MeFeedbackPage.tsx#L63)：`overflow-hidden`，PaperCard 使用 `min-h-0 flex-1` 但无 `overflow-y-auto`。textarea `h-[180px]` 固定高度。

4. **有 `overflow-y-auto` 的页面**（MeView home、MePrivacyPage、FootprintDetailView）可以直接使用 `scrollIntoView`。

### 5.2 方案比较

| 方案 | 原理 | 适用场景 | 侵入性 | 兼容性 |
|------|------|------|:--:|:--:|
| 1. 原生浏览器自动滚动 | 浏览器默认行为 | 页面有自然滚动、输入框在视口内 | 零侵入 | ✅ 全部 |
| 2. focus 时 scrollIntoView | JS 主动滚动到输入框 | **需要有可滚动祖先** | 低 | ✅ 全部 |
| 3. visualViewport API | 监听 viewport resize | 无滚动祖先时调整布局 | 中 | ⚠️ 部分 Android 不支持 |
| 4. 为页面添加受控滚动容器 | 新增 overflow-y-auto | 当前 overflow-hidden 的页面 | 中 | ✅ 全部 |
| 5. CSS scroll-padding-bottom | 纯 CSS | 有滚动容器的页面 | 极低 | ✅ 全部 |

**推荐策略**：不采用统一方案。根据每个组件的实际滚动容器情况分别处理。

### 5.3 逐组件分析

#### 5.3.1 GoalInputCard

**文件**：[GoalInputCard.tsx](../apps/mobile-app/components/today/GoalInputCard.tsx)
**滚动容器**：无。TodayHomeView 使用 `overflow-hidden`。
**场景**：单个 TextInput 在 TodayHomeView 中上部。
**风险等级**：**低**
**分析**：单个输入框，在 390×844 下位于视口上半部。即使 iPhone SE (375×667)，输入框也在首屏可见位置。
**推荐方案**：方案 1（原生浏览器自动滚动）。**如果真机无问题，不为统一而强制修改。**
**不推荐**：无需 visualViewport 复杂处理。

#### 5.3.2 ExecutionFeedbackBox

**文件**：[ExecutionFeedbackBox.tsx](../apps/mobile-app/components/today/ExecutionFeedbackBox.tsx)
**滚动容器**：无。TaskExecutionView 使用 `overflow-hidden`。
**场景**：textarea + "继续陪我推进" 按钮，在 TaskExecutionView 底部。
**风险等级**：**高**
**分析**：textarea 和按钮位于页面的最后一个 `shrink-0` 区域。键盘弹出后，AppShell 的 `h-[100svh]` 将 TaskExecutionView 压缩，textarea 和按钮可能被键盘完全覆盖。
**关键约束**：不允许把任务执行页改为可滚动长页——这会影响现有的 flex 布局设计和 UI Spec。
**推荐方案**：方案 3（visualViewport）为主，方案 4（受控滚动容器）为备选。

visualViewport 方式：监听 `window.visualViewport.height` 变化，在键盘弹出时将 ExecutionFeedbackBox 区域上推或调整 TaskExecutionView 的底部 padding。CSS 变量 `--keyboard-inset` 保存当前键盘高度，用于动态调整布局。

**不可行方案**：方案 2（scrollIntoView）——TaskExecutionView 没有可滚动祖先。

#### 5.3.3 MeFeedbackPage

**文件**：[MeFeedbackPage.tsx](../apps/mobile-app/components/me/MeFeedbackPage.tsx)
**滚动容器**：无。`overflow-hidden`，PaperCard 无 `overflow-y-auto`。
**场景**：textarea (h-[180px]) + "轻轻提交" 按钮 + "返回我的" 按钮。
**风险等级**：**中高**
**分析**：无滚动祖先意味着 scrollIntoView 无法工作。180px textarea 在 390×844 下占据约 21% 高度，键盘弹出后按钮区域很可能被遮挡。
**关键约束**：textarea focus 时不得未经 UI Spec 自动缩小高度。
**推荐方案**：方案 4（为 PaperCard 添加受控 `overflow-y-auto`）+ 方案 2（scrollIntoView）。在 PaperCard 容器上添加 `overflow-y-auto` 提供滚动祖先，textarea focus 时 scrollIntoView 将按钮区域滚动到可见位置。

或使用 visualViewport 调整 PaperCard 的 max-height。

#### 5.3.4 OtpLoginPage

**文件**：[OtpLoginPage.tsx](../apps/mobile-app/components/auth/OtpLoginPage.tsx)
**滚动容器**：无。页面使用居中布局。
**场景**：单个 email TextInput，页面居中。
**风险等级**：**低**
**推荐方案**：方案 1（原生浏览器自动滚动）。

#### 5.3.5 PasswordLoginPage

**文件**：[PasswordLoginPage.tsx](../apps/mobile-app/components/auth/PasswordLoginPage.tsx)
**滚动容器**：无。页面使用居中布局。
**场景**：email + password 两个 TextInput，页面居中。
**风险等级**：**低**
**推荐方案**：方案 1（原生浏览器自动滚动）。

#### 5.3.6 RegisterPage

**文件**：[RegisterPage.tsx](../apps/mobile-app/components/auth/RegisterPage.tsx)
**滚动容器**：无。页面使用居中布局。
**场景**：4 个输入框（email + code + password + confirmPassword），页面居中。
**风险等级**：**中**
**分析**：4 个输入框堆叠。较小屏幕（375×667）上后两个可能被遮挡。confirmPassword 是最后一个输入框。
**推荐方案**：方案 2（scrollIntoView），在 confirmPassword focus 时触发。如果 AuthShell 提供可滚动容器，scrollIntoView 可以正常工作。如果 AuthShell 不提供，考虑方案 4（为 RegisterPage 添加可滚动包装）。

### 5.4 键盘适配总结

| 组件 | 方案 | 前提条件 | 优先级 |
|------|------|------|:--:|
| GoalInputCard | 原生浏览器滚动 | — | P2（真机无问题则不改） |
| ExecutionFeedbackBox | visualViewport + 布局调整 | 需 CSS 变量保存 keyboard inset | **P1** |
| MeFeedbackPage | 添加 overflow-y-auto + scrollIntoView | PaperCard 需改为可滚动容器 | **P1** |
| OtpLoginPage | 原生浏览器滚动 | — | — |
| PasswordLoginPage | 原生浏览器滚动 | — | — |
| RegisterPage | scrollIntoView（或 AuthShell 提供滚动） | AuthShell 需可滚动或逐页处理 | P2 |

### 5.5 键盘关闭后布局恢复

- visualViewport 方式：`window.visualViewport.height` 恢复时自动清除 CSS 变量
- scrollIntoView 方式：失焦时浏览器自动恢复滚动位置
- 不使用固定 300ms 作为唯一可靠逻辑——不同设备键盘动画时长不同
- 键盘关闭后清除 `--keyboard-inset` CSS 变量，恢复原始布局

### 5.6 降级策略

- visualViewport 不存在或识别失败 → textarea focus 直接触发 `isKeyboardCompact = true`，进入同一受控紧凑模式
- iOS Safari 完整支持 visualViewport + scrollIntoView
- 桌面 DevTools 无法准确模拟 → **必须真机验证**

---

## 6. 滚动锁方案

### 6.1 先决分析：真实滚动容器

在设计滚动锁之前，必须核验实际滚动发生的位置：

1. **`document.body` 能否滚动？**
   AppShell 使用 `h-[100svh] overflow-hidden`。在正常使用中，body 不可滚动——所有内容约束在 100svh 内。但 body 本身可能没有 `overflow: hidden`，存在被意外滚动的可能。

2. **AppShell `<main>` 能否滚动？**
   [AppShell.tsx:14](../apps/mobile-app/components/shell/AppShell.tsx#L14)：`overflow-hidden`。不可滚动。

3. **页面内部是否存在 `overflow-y-auto` 容器？**
   见 §5.1.2 表格。存在以下可滚动容器：
   - MeView home：[div](../apps/mobile-app/components/me/MeView.tsx#L50)：`overflow-y-auto`
   - MePrivacyPage：[div](../apps/mobile-app/components/me/MePrivacyPage.tsx#L65)：`overflow-y-auto`
   - FootprintDetailView：[div](../apps/mobile-app/components/footprints/FootprintDetailView.tsx#L67)：`overflow-y-auto`

4. **Sheet 打开时实际需要锁定哪个容器？**
   MeConfirmSheet 使用 `fixed inset-y-0` 覆盖层。Sheet 背后的内容（MeView home）有 `overflow-y-auto` 容器。需要锁定的是**这个页面级可滚动容器**，不是 `document.body`。

### 6.2 方案设计

#### 6.2.1 锁定真实滚动容器（精确 ref）

MeView 使用 `useRef` 绑定真实 `overflow-y-auto` 容器，并通过明确 prop 传递给 MeConfirmSheet：

```tsx
// MeView 内部
const scrollContainerRef = useRef<HTMLDivElement>(null);

<div ref={scrollContainerRef} className="... overflow-y-auto ..." />
<MeConfirmSheet scrollContainerRef={scrollContainerRef} ... />
```

Sheet effect：
1. 读取 `scrollContainerRef.current`
2. 保存原 `style.overflow`、`style.overscrollBehavior` 和 `scrollTop`
3. 设置 `overflow: hidden`、`overscrollBehavior: contain`
4. cleanup 恢复原样式和保存的 `scrollTop`
5. Strict Mode 每次 mount/cleanup 对称
6. 不修改 body，不锁其他页面滚动容器
7. 不使用全局 `document.querySelector`

如果页面内没有滚动容器（大多数 `overflow-hidden` 页面），不需要 scroll lock——这些页面本身不可滚动。

#### 6.2.2 overlay 防止滚动穿透

Sheet overlay 使用 `overscroll-behavior: contain`：

```tsx
<section
  className="... max-h-[80vh] overflow-y-auto overscroll-contain ..."
>
```

#### 6.2.3 阻止背景 touchmove（iOS）

在 Sheet 背景遮罩上阻止 touchmove 穿透：

```tsx
<div
  className="fixed inset-0 bg-black/15 touch-none"
  onTouchMove={(e) => e.preventDefault()}
/>
```

或使用 `touch-action: none`。

#### 6.2.4 滚动位置恢复

关闭 Sheet 后恢复原滚动容器的滚动位置：

```typescript
const scrollTop = scrollContainer.scrollTop;
// ... Sheet 关闭后
scrollContainer.scrollTop = scrollTop;
```

#### 6.2.5 水平跳动防护

`body position: fixed` 可能导致 `max-w-mobile` 居中内容水平跳动（滚动条消失/出现改变视口宽度）。如果必须锁定 body，使用以下防护：

- 记录 `document.documentElement.clientWidth`
- 锁定后补偿 `body.style.paddingRight`

**优先方案**：只锁定页面级滚动容器，不锁定 body。这样不会触发水平跳动。

### 6.3 涉及文件

| 文件 | 改动类型 | 说明 |
|------|:--:|------|
| [MeConfirmSheet.tsx](../apps/mobile-app/components/me/MeConfirmSheet.tsx) | 修改 | 添加 scroll lock（通过 ref 锁定 MeView 滚动容器）+ touchmove 防护 + overscroll-behavior |
| [MeView.tsx](../apps/mobile-app/components/me/MeView.tsx) | 修改 | 给滚动容器绑定 ref，传递给 MeConfirmSheet |

### 6.4 不改变 AppShell 整体高度模型

滚动锁方案**不修改** AppShell 的 `h-[100svh] flex flex-col overflow-hidden` 模型。

### 6.5 React Strict Mode 与重复打开

- useEffect cleanup 确保组件卸载时恢复原始样式
- Sheet 重复打开/关闭：每次打开重新记录当前状态，关闭时恢复
- React Strict Mode（double-mount）：cleanup 正确恢复，第二次 mount 重新记录和锁定

---

## 7. 44px 触控规范

### 7.1 当前违规项（完整搜索）

`tailwind.config.ts` 已定义 `min-h-touch: 44px` 和 `min-w-touch: 44px` token。以下 9 处未使用 `min-h-touch`：

| # | 文件 | 行 | 元素真实文案 | 当前值 |
|---|------|:--:|------|:--:|
| 1 | [TaskExecutionView.tsx](../apps/mobile-app/components/today/TaskExecutionView.tsx) | 65 | "回到任务" | `min-h-[38px]` |
| 2 | [TaskExecutionView.tsx](../apps/mobile-app/components/today/TaskExecutionView.tsx) | 74 | "先退出" | `min-h-[38px]` |
| 3 | [ExecutionFeedbackBox.tsx](../apps/mobile-app/components/today/ExecutionFeedbackBox.tsx) | 46 | "继续陪我推进" | `min-h-[42px]` |
| 4 | [MeFeedbackPage.tsx](../apps/mobile-app/components/me/MeFeedbackPage.tsx) | 32 | "返回我的" | `min-h-[38px]` |
| 5 | [MeFeedbackPage.tsx](../apps/mobile-app/components/me/MeFeedbackPage.tsx) | 67 | "返回我的" | `min-h-[38px]` |
| 6 | [FootprintDetailView.tsx](../apps/mobile-app/components/footprints/FootprintDetailView.tsx) | 24 | "回到足迹" | `min-h-[38px]` |
| 7 | [MePrivacyPage.tsx](../apps/mobile-app/components/me/MePrivacyPage.tsx) | 42 | "返回我的" | `min-h-[38px]` |
| 8 | [TaskListView.tsx](../apps/mobile-app/components/today/TaskListView.tsx) | 34 | "退出" | `min-h-[40px]` |
| 9 | [UpcomingTaskList.tsx](../apps/mobile-app/components/today/UpcomingTaskList.tsx) | 39 | "陪我" | `min-h-[34px]` |

**统计**：9 个代码位置，涉及 7 个文件，7 种按钮文案。

> 注：TaskExecutionView.tsx:100 的"我完成了这一小步"已使用 `min-h-[44px]`，不在违规列表中。

### 7.2 修复方案

统一替换：

```
min-h-[38px]  →  min-h-touch   （44px）
min-h-[42px]  →  min-h-touch   （44px）
min-h-[40px]  →  min-h-touch   （44px）
min-h-[34px]  →  min-h-touch   （44px）
```

### 7.3 涉及文件

| 文件 | 修复数量 |
|------|:--:|
| [TaskExecutionView.tsx](../apps/mobile-app/components/today/TaskExecutionView.tsx) | 2 处 |
| [ExecutionFeedbackBox.tsx](../apps/mobile-app/components/today/ExecutionFeedbackBox.tsx) | 1 处 |
| [MeFeedbackPage.tsx](../apps/mobile-app/components/me/MeFeedbackPage.tsx) | 2 处 |
| [FootprintDetailView.tsx](../apps/mobile-app/components/footprints/FootprintDetailView.tsx) | 1 处 |
| [MePrivacyPage.tsx](../apps/mobile-app/components/me/MePrivacyPage.tsx) | 1 处 |
| [TaskListView.tsx](../apps/mobile-app/components/today/TaskListView.tsx) | 1 处 |
| [UpcomingTaskList.tsx](../apps/mobile-app/components/today/UpcomingTaskList.tsx) | 1 处 |

---

## 8. 统一返回栈架构

### 8.1 问题约束

当前状态所有权如下（见 §2.1）：

- `page.tsx`：`authState`、`authScreen`、`activeTab`、`todayMode`、`todayState`
- `FootprintsView`：`footprintMode`（本地 `useState`）
- `MeView`：`meMode`、`confirmMode`（本地 `useState`）

**`page.tsx` 不能直接读写 `footprintMode`、`meMode`、`confirmMode`。**

### 8.2 方案比较

| 方案 | 描述 | 复杂度 | 侵入性 | 推荐 |
|------|------|:--:|:--:|:--:|
| **A. 提升所有子状态到 page.tsx** | 将 footprintMode、meMode、confirmMode 全部提升为 page.tsx 的 useState | 中 | 高——需修改 FootprintsView 和 MeView 的接口 | ❌ |
| **B. 集中式 Back Controller + 子模块注册 Back Handler** | page.tsx 创建唯一的 BackController 实例，子组件通过 context/props 注册自己的 handler | 中 | 低——子组件只需添加注册调用 | ✅ |
| C. 各模块分别监听 popstate | 每个组件各自监听 popstate | 低但碎片 | 高——违反统一管理原则 | ❌ |
| D. Next.js 路由化 | 引入子路由 | 高 | 太高——推翻现有单页状态机 | ❌ |

### 8.3 推荐方案：B（集中式 Back Controller + 子模块注册）

**核心设计**：

1. **全项目只有一个 `popstate` 监听器**，位于 WebHistoryGuard 中（挂载在 `page.tsx` 的 BackControllerProvider 内）
2. **子组件不得各自监听 `popstate`**
3. **子组件注册 Back Handler**——一个返回 `boolean` 的函数：
   - `true` = 已处理（消费了返回事件），停止传播
   - `false` = 未处理，继续传递给下一个 handler
4. **Handlers 按优先级排序**，高优先级先执行
5. **组件卸载时自动注销** handler
6. **平台无关**：BackController.dispatchBack() 不访问任何平台 API（popstate、history、Capacitor），由外部调用方负责平台适配

### 8.4 返回规则

`authState` 由 `page.tsx` 拥有，纳入 BackController 管理。返回规则按 `authState` 分为两个独立分支：

#### Guest/Auth 返回分支

`authState === "guest"` 时，用户在 Auth 页面流程中。返回键控制 `authScreen` 的导航：

```
当前 authScreen          → 返回行为                     注册者
──────────────────────────────────────────────────────────────────
register                → setAuthScreen("otp-login")    page.tsx (内置)
password-login          → setAuthScreen("otp-login")    page.tsx (内置)
otp-login               → setAuthScreen("welcome")      page.tsx (内置)
welcome                 → 应用根状态，可以退出            page.tsx (内置)
```

#### Authenticated 返回分支

`authState === "authenticated"` 时，用户在清行主界面中。返回键控制 Tab 内子页面和任务层的导航：

```
当前状态                                      → 返回行为                      注册者
──────────────────────────────────────────────────────────────────────────────────────
confirmMode !== null (MeView)                → setConfirmMode(null)           MeView
meMode !== "home" (MeView)                  → setMeMode("home")              MeView
footprintMode === "detail" (FootprintsView) → handleBackToList()             FootprintsView
activeTab !== "today"                       → setActiveTab("today")          page.tsx (内置)
todayMode === "execution"                   → handleBackToTasks()            page.tsx (内置)
todayMode === "tasks"                       → setTodayMode("home")           page.tsx (内置)
activeTab === "today" && todayMode === "home" → 应用根状态，可以退出           page.tsx (内置)
```

`page-authenticated-root` 内部锁定顺序：

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

原因：从任务执行页切换到其他 Tab 后，隐藏的 `todayMode` 可能仍是 execution。返回必须先把当前可见 Tab 切回今日，保留原 todayMode，让用户回到原来的当前任务层；不可让隐藏状态先消费返回。

#### 根状态退出

当 Guest 分支的 `welcome` 或 Authenticated 分支的 `today home` 收到返回时，`dispatchBack()` 返回 `false`，表示已到达应用根状态，允许平台退出。Web 退出行为见 §9 的 WebHistoryGuard 设计。

### 8.5 Back Controller 接口设计

```typescript
interface BackHandler {
  id: string;                    // 唯一标识，用于注销
  priority: number;              // 数字越大优先级越高
  handler: () => boolean;        // true=已消费, false=未处理
}

interface BackController {
  register(handler: BackHandler): void;    // 注册
  unregister(id: string): void;            // 注销（组件卸载时调用）
  dispatchBack(): boolean;                 // 只遍历执行 Back Handler，true=内部已消费, false=已到达应用根状态
}
```

**`dispatchBack()` 职责边界**：

- ✅ 按 priority 降序遍历已注册 Back Handler
- ✅ 第一个返回 `true` 的 handler 停止遍历，返回 `true`
- ✅ 所有 handler 返回 `false` → 返回 `false`（已到达应用根状态）
- ❌ 不调用 `pushState`
- ❌ 不调用 `replaceState`
- ❌ 不调用 `history.back()`
- ❌ 不访问 Capacitor

`dispatchBack()` 是平台无关的纯逻辑调度器。平台特定行为（Web popstate、Capacitor backButton）由外部调用方（WebHistoryGuard、Capacitor Back Adapter）负责。

### 8.6 子组件注册示例（设计示意）

**MeView** 注册 2 个 handler（使用 `isActive` 可见性条件）：

```typescript
// MeView 内部（从 page.tsx 接收 isActive prop）
useEffect(() => {
  backController.register({
    id: 'me-confirm',
    priority: 100,
    handler: () => {
      if (isActive && confirmMode !== null) { setConfirmMode(null); return true; }
      return false;
    }
  });
  backController.register({
    id: 'me-subpage',
    priority: 90,
    handler: () => {
      if (isActive && meMode !== 'home') { setMeMode('home'); return true; }
      return false;
    }
  });
  return () => {
    backController.unregister('me-confirm');
    backController.unregister('me-subpage');
  };
}, [confirmMode, meMode, isActive]);
```

**FootprintsView** 注册 1 个 handler（使用 `isActive` 可见性条件）：

```typescript
// FootprintsView 内部（从 page.tsx 接收 isActive prop）
useEffect(() => {
  backController.register({
    id: 'footprint-detail',
    priority: 80,
    handler: () => {
      if (isActive && footprintMode === 'detail') { handleBackToList(); return true; }
      return false;
    }
  });
  return () => backController.unregister('footprint-detail');
}, [footprintMode, isActive]);
```

### 8.7 实现约束

1. **React Strict Mode 兼容**：useEffect cleanup 确保双重挂载不产生重复注册。`register` 调用覆盖已存在的同名 handler。
2. **Stale Closure 防护**：useEffect 依赖数组包含 handler 读取的所有状态。或使用 ref 保存最新 handler。
3. **BackController 传递方式**：React Context。BackControllerProvider 是独立客户端组件，由 `app/page.tsx` 内包裹 Guest/Auth 和 authenticated 内容。`app/layout.tsx` 保持 Server Component，不添加 `"use client"`（详见 §9.5）。
4. **`dispatchBack()` 返回值**：
   - `true` = 内部 handler 已消费返回事件，调用方（WebHistoryGuard）应重新建立 Guard Entry
   - `false` = 所有 handler 返回 false（已在应用根状态），调用方（WebHistoryGuard 或 Capacitor Back Adapter）应执行平台特定的退出流程

### 8.8 禁止的做法

- ❌ 各组件自己监听 `window.popstate`
- ❌ 在多个 useEffect 中各自 pushState
- ❌ page.tsx 直接 import 或调用 `setFootprintMode`、`setMeMode`、`setConfirmMode`
- ❌ 使用 Next.js router.back()（当前是单页状态机，无路由历史）

---

## 9. Web History Guard（WebHistoryGuard）+ Capacitor 衔接

### 9.1 目标

- Android 返回键（触发 `popstate`）→ WebHistoryGuard → `dispatchBack()` 统一入口
- 未来 Capacitor `backButton` 事件 → `dispatchBack()` 统一入口（不经过 WebHistoryGuard）
- 不在浏览器历史中积累无意义的条目
- 防止 `popstate → history.back() → popstate` 无限循环
- 用户点击浏览器前进按钮时不出现意外行为
- 刷新后 Guard 正确初始化
- 从 BFCache 恢复后不永久跳过 Back Handler
- 从外部页面进入清行后能正常退出

### 9.2 WebHistoryGuard 职责

WebHistoryGuard 是**全项目唯一的 popstate 监听器**，负责 Web 平台的返回键适配。它调用 `BackController.dispatchBack()`（平台无关调度器），根据返回值决定 Web 特定行为：

**WebHistoryGuard 职责清单**：

| # | 职责 | 说明 |
|---|------|------|
| 1 | 唯一 popstate 监听器 | 全项目只有 WebHistoryGuard 注册 `window.popstate` 事件 |
| 2 | 维护 Base Entry 和 Guard Entry | 初始化时建立双条目，内部返回后重新建立 Guard |
| 3 | 调用 `dispatchBack()` | `popstate` 进入 Base Entry 且 `isExitingRef === false` 时调用 BackController.dispatchBack() |
| 4 | dispatchBack() = true → 重新建立 Guard | `pushState(Guard Entry)` 重建拦截层 |
| 5 | dispatchBack() = false → Web 根退出流程 | 设置 `isExitingRef = true` → `history.back()` 退出 |
| 6 | 管理 `isExitingRef` | React ref（非 state），阻止退出过程中的后续 popstate 进入 dispatchBack() |
| 7 | 管理 `pageshow` / BFCache 恢复 | `event.persisted === true` 时按当前 Base/Guard/外部条目分别恢复 |
| 8 | 浏览器前进恢复 | 进入 Guard Entry 时重置 `isExitingRef = false`，不调用 dispatchBack()，不重复 push Guard |

**WebHistoryGuard 不做什么**：

- ❌ 不直接操作 React state（state 变更由 BackHandler 通过 setState 完成）
- ❌ 不访问 Capacitor
- ❌ 不在内部 Tab/页面切换时 pushState
- ❌ 不处理 Capacitor backButton 事件

### 9.3 Base + Guard Entry 模型

#### 9.3.1 模型概述

采用 **Base Entry + Guard Entry** 双条目模型：

```
浏览器历史栈（从旧到新）：

  ... (外部页面条目)
  Base Entry    ← 清行首次加载时的锚点
  Guard Entry   ← 在 Base 之上 push 的拦截条目
```

**核心机制**：

1. **初始化**：以当前浏览器历史条目为 Base Entry（`replaceState` 写入 Base 标记），在其上 `pushState` 一个 Guard Entry
2. **用户按返回键**：浏览器从 Guard Entry 回到 Base Entry，触发一次 `popstate`
3. **dispatchBack() 返回 true**：WebHistoryGuard 重新 push Guard Entry → 下一次返回仍可被拦截
4. **dispatchBack() 返回 false**：已位于应用根状态 → WebHistoryGuard 设置 `isExitingRef = true` → 调用 `history.back()` 退出
5. **退出防护**：`isExitingRef` 确保退出过程中产生的第二次 `popstate` 不再进入 `dispatchBack()`

#### 9.3.2 状态标记（锁定格式）

History State 使用以下**精确且不可变**的标记：

**Base Entry**：

```json
{ "app": "qingxing", "kind": "base" }
```

**Guard Entry**：

```json
{ "app": "qingxing", "kind": "guard" }
```

`popstate` 事件中的 `event.state` 表示浏览器完成导航后进入的**目标历史条目**。处理时必须根据 `event.state.kind` 判断当前进入的是 Base、Guard 还是外部历史：

| `event.state` | 判定 | 行为 |
|------|------|------|
| `{ app: "qingxing", kind: "base" }` | 用户从 Guard 按返回进入 Base | 检查 `isExitingRef`；为 `false` 时调用 `dispatchBack()`。返回 `true` 则 `pushState` 重新建立 Guard；返回 `false` 则设置 `isExitingRef = true` 并调用 `history.back()` 尝试离开清行 |
| `{ app: "qingxing", kind: "guard" }` | 用户通过前进按钮或恢复流程重新进入 Guard | 重置 `isExitingRef = false`；不调用 `dispatchBack()`；不重复 push Guard |
| `null` 或不是 `{ app: "qingxing", ... }` | 已进入外部历史 | 不拦截；不调用 `dispatchBack()`；不重新建立 Guard |

#### 9.3.3 History State 保留规则

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
- 不传第三个 URL 参数，pathname 不变；
- 不构造新 URL，search 参数不丢失；
- 不得删除或重置 Next.js/浏览器已有 state 字段；
- `app`/`kind` 可以覆盖同名旧值，其余已有字段必须保留。

#### 9.3.4 首次初始化推荐流程

```
1. 检查当前 history.state
2. 如果当前不是清行 Guard（kind !== "guard"）：
   a. replaceState({ ...existingState, app: "qingxing", kind: "base" }, "")  ← 将当前条目标记为 Base
   b. pushState({ ...latestState, app: "qingxing", kind: "guard" }, "")    ← 在 Base 之上建立 Guard
3. 如果当前已经是清行 Guard（kind === "guard"）：
   a. 不重复建立 Guard（当前 Guard 仍然有效）
   b. Base 即 Guard 的前一个条目（或通过 replaceState 在初始化时已标记）
4. React Strict Mode 下：
   a. 第一次 mount：执行步骤 1-2，建立 Base + Guard
   b. Cleanup：不 pop/修改历史（历史操作不可逆）
   c. 第二次 mount：检测到 kind === "guard" → 跳过步骤 2
5. 最终只保留一个 Base Entry 和一个 Guard Entry（Strict Mode 安全）
```

#### 9.3.5 状态图

```
应用初始化
  │
  ▼
replaceState(Base) → pushState(Guard)
  │
  ▼
等待用户交互（当前位于 Guard Entry）
  │
  │ 用户按返回键
  ▼
Guard → Base
popstate：event.state.kind === "base"
  │
  │ isExitingRef === false
  ▼
dispatchBack()
  ├─ true（内部处理了返回）
  │    └─ pushState(Guard Entry)
  │         └─ 回到等待用户交互
  │
  └─ false（已在根状态）
       └─ isExitingRef = true
            └─ history.back()
                 └─ 进入外部历史
                      └─ 不调用 dispatchBack()，不重新建立 Guard

浏览器前进或 Guard 恢复：
Base → Guard
popstate：event.state.kind === "guard"
  └─ isExitingRef = false
       └─ 不调用 dispatchBack()，不重复 push Guard
```

#### 9.3.6 时序说明

**场景 A：用户在清行内部按返回键（dispatchBack 返回 true）**

```
1. 当前位于 Guard Entry
2. 用户按返回键
3. 浏览器进入 Base Entry（Guard Entry → Base Entry）
4. popstate 触发
5. event.state.kind === "base"
6. WebHistoryGuard 调用 BackController.dispatchBack()
7. 某个 handler 返回 true（如 setMeMode("home")）
8. React 内部状态返回一层，UI 切换到上一级
9. WebHistoryGuard 调用 pushState(Guard Entry) —— 在 Base 之上重新建立新的 Guard Entry
10. 等待下一次用户返回
```

**场景 B：用户在根状态按返回键（dispatchBack 返回 false）**

```
1. 当前位于 Guard Entry
2. 用户按返回键
3. 浏览器进入 Base Entry（Guard Entry → Base Entry）
4. popstate 触发
5. event.state.kind === "base"
6. WebHistoryGuard 调用 BackController.dispatchBack()，返回 false（已在根状态）
7. WebHistoryGuard 设置 isExitingRef = true
8. WebHistoryGuard 调用 history.back()，尝试从 Base 进入外部历史
9. 如外部历史的 popstate 触发，event.state 为 null 或不是 qingxing
10. WebHistoryGuard 不拦截、不调用 dispatchBack()、不重新建立 Guard
```

**场景 C：应用初始化（含 React Strict Mode）**

```
1. React 首次挂载
2. WebHistoryGuard 初始化：
   a. 检查 window.history.state 是否有 { app: "qingxing", kind: "guard" }
   b. 如无标记：replaceState({ ...existingState, app: "qingxing", kind: "base" }, "") → pushState({ ...latestState, app: "qingxing", kind: "guard" }, "")
   c. 如有标记：当前条目已是 Guard，不重复 push
3. React Strict Mode double-mount：
   a. 第一次 mount：建立 Base + Guard
   b. Cleanup：不 pop/修改历史（历史操作不可逆）
   c. 第二次 mount：检测到 kind === "guard" → 不重复 push
4. 最终只有 1 个 Base Entry + 1 个 Guard Entry
```

#### 9.3.7 防循环机制

循环路径不存在的原因：

```
popstate 进入 Base Entry（event.state.kind === "base"）
  → 检查 isExitingRef === false
  → WebHistoryGuard 调用 dispatchBack()
  → dispatchBack() 返回 true（内部处理）
    → pushState(Guard Entry)    ← 只 push，不调用 history.back()
    → 不触发 popstate            ← pushState 不触发 popstate
  → dispatchBack() 返回 false（根退出）
    → isExitingRef = true        ← 设置退出标志
    → history.back()             ← 尝试进入外部历史
    → 外部历史的 popstate 触发
    → event.state 为 null 或不是 qingxing
    → 不调用 dispatchBack()，循环终止
```

**与旧设计的区别**：不使用 "popstate → pushState → history.back() → popstate" 循环。内部返回只做 `pushState`（重建 Guard），不调用 `history.back()`。`history.back()` 只在根退出时由 WebHistoryGuard 调用一次，且 `isExitingRef` 阻止再次进入。

#### 9.3.8 浏览器前进按钮

- Base Entry → Guard Entry 时，`popstate` 的 `event.state.kind === "guard"`
- 视为浏览器前进恢复或 Guard 恢复：重置 `isExitingRef = false`
- 不调用 `dispatchBack()`，不重复建立 Guard
- 内部返回被消费后重新 `pushState(Guard Entry)` 会**清除浏览器前进栈**（这是 `pushState` 的标准行为）
- 移动端 App 模式下，前进按钮极少被使用，此限制可接受
- 记录为已知限制，不做额外处理

#### 9.3.9 刷新后 Guard 初始化

- 页面刷新后 React state 重置为初始值
- `window.history.state` 如包含 `{ app: "qingxing", kind: "guard" }`，说明当前条目为 Guard Entry
- 不需要重复 push——当前 Guard 仍然有效
- `window.history.state` 如为 null 或不含标记 → 当前条目作为 Base（replaceState 标记），重新 push Guard

#### 9.3.10 从外部页面进入后的退出

- 用户从外部页面点击链接进入清行 → `history.length` 增加
- 清行初始化：replaceState 标记当前条目为 Base，push Guard Entry
- 根状态返回 → `history.back()` → 回到外部页面 ✅

#### 9.3.11 BFCache 与 pageshow 恢复

当用户通过浏览器前进按钮重新进入清行，或浏览器从 BFCache 恢复页面时，必须按当前目标条目正确处理：

1. **`pageshow` 事件监听**：WebHistoryGuard 同时监听 `window.pageshow` 事件
2. **`event.persisted === true`**：页面从 BFCache 恢复，而非全新加载
3. **恢复时按 `history.state` 分支处理**：
   - 当前是 `{ app: "qingxing", kind: "guard" }`：重置 `isExitingRef = false`；不调用 `dispatchBack()`；不重复 push Guard
   - 当前是 `{ app: "qingxing", kind: "base" }`：根据恢复场景重新建立 Guard，不调用 `dispatchBack()`
   - 当前是 `null` 或不是 qingxing：已处于外部条目，不拦截、不调用 `dispatchBack()`、不建立 Guard
4. **浏览器前进恢复**：Base Entry → Guard Entry 时，`event.state.kind === "guard"`；重置 `isExitingRef = false`，不执行 `dispatchBack()`，不重复建立 Guard
5. **不得重复堆积 Guard**：每次 pageshow/popstate 处理前先检查目标条目；当前已是 Guard 时绝不再 push
6. **浏览器前进栈被 pushState 清除**：属于已知限制，记录但不做额外处理

#### 9.3.12 关键约束

1. **禁止** `pushState → history.back → popstate` 循环
2. **禁止** 内部 Tab/任务层/二级页面切换产生浏览器历史条目（不 pushState）
3. **禁止** 刷新 Guard Entry 后重复创建多个 Guard（检测 `kind === "guard"` 已有标记）
4. **禁止** React Strict Mode 下初始化执行两次（检测已有标记 + useEffect cleanup 模式）
5. **禁止** 从 BFCache 恢复后永久跳过 Back Handler（pageshow 重置 `isExitingRef`）
6. `isExitingRef` 必须是 ref（非 state），确保在 popstate 回调中读取到最新值，不触发重渲染
7. 浏览器前进栈被 `pushState` 清除属于已知限制

### 9.4 Capacitor Back Adapter（仅作为 V3.2 设计）

V3.0C 不做：安装 `@capacitor/app`、监听原生 backButton、实现 `App.exitApp()`。

V3.2 时的 Capacitor Back Adapter 设计：

```typescript
// V3.2 伪代码
import { App as CapacitorApp } from '@capacitor/app';

CapacitorApp.addListener('backButton', ({ canGoBack }) => {
  const handled = backController.dispatchBack();  // 复用同一个平台无关调度器
  if (!handled) {
    CapacitorApp.exitApp();  // 只有未处理时才退出 App
  }
});
```

**Capacitor Back Adapter 职责**：

| # | 职责 | 说明 |
|---|------|------|
| 1 | 监听 Capacitor `backButton` 事件 | `@capacitor/app` 的 backButton listener |
| 2 | 调用 `dispatchBack()` | 复用平台无关的 BackController.dispatchBack() |
| 3 | `dispatchBack() = false` 时退出 App | `CapacitorApp.exitApp()` —— 一次返回直接退出 |
| 4 | `dispatchBack() = true` 时不操作 | 内部返回已消费，无需额外动作 |

**Capacitor Back Adapter 不做什么**：

- ❌ 不调用 WebHistoryGuard（WebHistoryGuard 只处理 Web popstate）
- ❌ 不执行 `pushState` / `replaceState` / `history.back()`
- ❌ 不管理 `isExitingRef`（那是 WebHistoryGuard 的职责）
- ❌ 不监听 popstate

### 9.5 Provider 放置位置

**关键约束**：`app/layout.tsx` 保持 Server Component。

| 文件 | 组件类型 | 职责 |
|------|:--:|------|
| `app/layout.tsx` | Server Component | metadata、viewport、字体、根 `<html>`/`<body>` 布局。**不添加 `"use client"`** |
| `contexts/BackControllerContext.tsx` | Client Component (`"use client"`) | 创建 BackController 实例 + WebHistoryGuard（popstate/pageshow 监听）+ React Context Provider |
| `app/page.tsx` | Client Component | 在 Guest/Auth 和 authenticated 内容外层包裹 `<BackControllerProvider>` |

**Provider 包裹结构**：

```tsx
// app/page.tsx (Client Component)
export default function Page() {
  return (
    <BackControllerProvider>
      <HomeContent />
    </BackControllerProvider>
  );
}

function HomeContent() {
  // authState/authScreen/activeTab/todayMode 等全部页面状态
  // useBackController() 在 Provider 后代中合法调用
  // Guest/Auth 与 AppShell 渲染
  // page 级 Handler 注册
}
```

**为什么不在 layout.tsx 中放 Provider**：

- `layout.tsx` 是 Server Component，BackControllerProvider 需要 `"use client"`（popstate 监听 + React Context）
- 将 Provider 放在 `page.tsx` 中意味着只有清行主页面使用返回栈，不影响可能的其他页面（如未来的 landing page）
- `layout.tsx` 继续只负责 metadata、viewport、字体和根布局——符合 Next.js Server Component 最佳实践

### 9.6 文件预计范围

| 文件 | 改动类型 | 说明 |
|------|:--:|------|
| [page.tsx](../apps/mobile-app/app/page.tsx) | 修改 | 重构为 Page→BackControllerProvider→HomeContent 三层；内置双分支返回；向 MeView/FootprintsView 传入 `isActive` 可见性条件 |
| [MeView.tsx](../apps/mobile-app/components/me/MeView.tsx) | 修改 | 注册 confirm/subpage Back Handler，显式检查 `isActive` |
| [FootprintsView.tsx](../apps/mobile-app/components/footprints/FootprintsView.tsx) | 修改 | 注册 detail Back Handler，显式检查 `isActive` |
| `contexts/BackControllerContext.tsx` | **新增** | BackController 实现 + WebHistoryGuard（popstate/pageshow 监听）+ React Context Provider |

---

## 10. Manifest 和图标方案

### 10.1 Manifest 方案

#### 方案 A：Next.js `app/manifest.ts`（推荐）

```typescript
// app/manifest.ts
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '清行',
    short_name: '清行',
    description: '慢一点，也在向前走',
    start_url: '/',
    display: 'standalone',
    background_color: '#F7F3EA',
    theme_color: '#0F3155',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
```

**优点**：Next.js 原生支持，自动生成 `<link rel="manifest">`，无需 `public/` 目录
**缺点**：需要 Next.js 13.1+
**风险**：在 static export（V3.2）下的兼容性需验证。不兼容时回退到 `public/manifest.json`。

#### 方案 B：`public/manifest.json`

传统方案，手动添加 `<link rel="manifest" href="/manifest.json">`。

**推荐方案 A**（`app/manifest.ts`），图标文件放在 `public/icons/`。

### 10.2 图标规划

| 尺寸 | 用途 | 格式 | 来源 |
|------|------|------|------|
| 192×192 | PWA 小图标 | PNG | SVG 导出 |
| 512×512 | PWA 大图标 / maskable | PNG | SVG 导出（含 safe zone padding） |
| 180×180 | Apple Touch Icon | PNG | SVG 导出 |

图标设计原则：
- 使用清行品牌色（深蓝 #0F3155 + 暖米白 #F7F3EA）
- 源视觉由 ChatGPT 产品把关、用户确认；Codex 不得自行选择图形
- maskable safe zone 以最终确认的图标规范和实际核验为准

### 10.3 Apple Touch Icon

在 [app/layout.tsx](../apps/mobile-app/app/layout.tsx) 中通过 metadata 添加：

```typescript
export const metadata: Metadata = {
  title: "清行",
  description: "慢一点，也在向前走",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "清行",
  },
  icons: {
    apple: [{ url: "/icons/icon-180.png", sizes: "180x180" }],
  },
};
```

### 10.4 PWA 验收标准

#### Android Chrome

- Manifest 可访问（`/manifest.webmanifest` 或 `/manifest.json`）
- 浏览器识别为可安装（DevTools → Application → Manifest 无错误）
- 安装菜单或安装入口可用（地址栏安装图标 或 菜单 → "添加到主屏幕"）
- 用户能够完成安装流程
- standalone 模式启动正常（无浏览器工具栏）
- 如 `beforeinstallprompt` 事件触发，只作为辅助证据，不作为唯一验收标准

#### iOS Safari

- Share → "Add to Home Screen" 可用
- Apple touch icon 显示正确
- standalone 模式启动正常（无 Safari 工具栏）

#### 不做

- ❌ 不依赖 Chrome 自动弹出安装横幅作为验收标准
- ❌ 不实现自定义 PWA 安装弹窗

### 10.5 视觉资产前置闸门

当前架构设计阶段不生成图标文件。V3.0C 实施阶段**必须**提供以下实际图标文件：

| 文件 | 尺寸 | 用途 |
|------|------|------|
| `public/icons/icon-192.png` | 192×192 | PWA 小图标 |
| `public/icons/icon-512.png` | 512×512 | PWA 大图标 |
| `public/icons/icon-512-maskable.png` | 512×512 | maskable 图标（safe zone 以最终确认规范为准） |
| `public/icons/icon-180.png` | 180×180 | Apple Touch Icon |

**图标生成流程必须经过以下闸门**：

1. **源视觉设计** → ChatGPT 产品把关（确认品牌调性、颜色、图形方向）
2. **源图呈现** → 用户视觉确认（非 Codex 自行决定）
3. **确认通过后** → Codex 按已确认源图进行 PNG 尺寸导出和代码接入
4. **Codex 不得自由设计图标**——Codex 只能执行已确认源图的尺寸导出和文件放置

放置路径：`public/icons/`。导出方法（手动或脚本）由执行方案阶段确定。

---

## 11. Service Worker 明确延期

### 11.1 V3.0C 不做 Service Worker

- Service Worker **不是** PWA 安装的前提条件
- Chrome 和 Safari 在没有 SW 的情况下仍可安装 PWA（有 Manifest + 图标即可）
- SW 的离线缓存、更新策略需要独立的设计和测试

### 11.2 V3.2 也不强制 Service Worker

- V3.2 的 APK 打包不依赖 Service Worker
- SW 在 Capacitor WebView 中的作用有限（WebView 由 APK 管理生命周期）
- SW 在 V3.2 为**独立可选 PWA 增强**，不作为 APK 验收条件
- 如果 V3.2 static export 成功后决定添加 SW，作为独立增强项单独验收

### 11.3 不得出现的错误表述

❌ "没有 Service Worker 就不能安装 PWA"
❌ "PWA 必须包含离线功能"
❌ "APK 打包需要 Service Worker"

✅ "V3.0C 的 PWA 目标是基础可安装（Manifest + 图标），SW 为独立可选增强"

---

## 12. 文件级预计范围

### 12.1 修改文件

以下文件按 C1–C4 分组列出。完整计数（按唯一路径）：固定修改 **16 个**、固定新增文本源文件 **3 个**、条件修改 **3 个**、C4 另新增 4 个图片资源。

#### C1 固定修改文件（11 个）

| # | 文件 | 改动内容 |
|---|------|------|
| 1 | `app/layout.tsx` | viewportFit |
| 2 | `app/page.tsx` | Auth 页面分支包裹 AuthShell |
| 3 | `app/globals.css` | safe-area/layout CSS 变量、横屏降级 CSS |
| 4 | `components/shell/AppShell.tsx` | pt/px/pb 改为 safe-area 感知值、横屏降级条件渲染 |
| 5 | `components/today/TaskListView.tsx` | "退出" `min-h-[40px]` → `min-h-touch` |
| 6 | `components/today/UpcomingTaskList.tsx` | "陪我" `min-h-[34px]` → `min-h-touch` |
| 7 | `components/today/TaskExecutionView.tsx` | "回到任务"/"先退出" 2 处 `min-h-[38px]` → `min-h-touch`；C3 键盘紧凑状态编排和 props 分发 |
| 8 | `components/today/ExecutionFeedbackBox.tsx` | "继续陪我推进" `min-h-[42px]` → `min-h-touch`；C3 focus/compact 适配 |
| 9 | `components/me/MeFeedbackPage.tsx` | 2 处 `min-h-[38px]` → `min-h-touch`；C3 受控滚动容器改造 |
| 10 | `components/me/MePrivacyPage.tsx` | `min-h-[38px]` → `min-h-touch` |
| 11 | `components/footprints/FootprintDetailView.tsx` | `min-h-[38px]` → `min-h-touch` |

#### C1 新增文件

- `components/auth/AuthShell.tsx` — Auth 页面统一 safe-area/滚动/横屏容器

#### C2 固定修改文件（3 个）

| # | 文件 | 改动内容 |
|---|------|------|
| 1 | `app/page.tsx` | 重构为 Page→BackControllerProvider→HomeContent 三层；Guest/Auth 和 Authenticated 双分支返回 |
| 2 | `components/me/MeView.tsx` | 注册 confirm/subpage Back Handler；C3 滚动容器 ref |
| 3 | `components/footprints/FootprintsView.tsx` | 注册 detail Back Handler |

#### C2 新增文件

- `contexts/BackControllerContext.tsx` — BackController、Context Provider、WebHistoryGuard

#### C3 固定修改文件（8 个）

| # | 文件 | 改动内容 |
|---|------|------|
| 1 | `app/globals.css` | 键盘紧凑模式 CSS 变量/class |
| 2 | `components/today/TaskExecutionView.tsx` | visualViewport 监听、isKeyboardCompact 状态、紧凑 props 分发给 ExecutionTaskCard/ExecutionGuideCard/ExecutionFeedbackBox |
| 3 | `components/today/ExecutionTaskCard.tsx` | 新增 `compact?: boolean` prop；紧凑时只隐藏非核心元素，始终保留当前任务标题 |
| 4 | `components/today/ExecutionGuideCard.tsx` | 新增 `compact?: boolean` prop；紧凑时压缩装饰和次级说明，始终保留核心行动内容 |
| 5 | `components/today/ExecutionFeedbackBox.tsx` | focus 上报、compact 适配 |
| 6 | `components/me/MeView.tsx` | scroll container ref（供 MeConfirmSheet 锁定） |
| 7 | `components/me/MeFeedbackPage.tsx` | 受控滚动祖先 + focus 滚动 |
| 8 | `components/me/MeConfirmSheet.tsx` | 背景滚动锁、iOS touchmove、overscroll、scrollTop 恢复 |

#### C4 固定修改文件

- `app/layout.tsx` — Apple Web App metadata

#### C4 新增文件

- `app/manifest.ts` — Web App Manifest
- `public/icons/icon-192.png`、`icon-512.png`、`icon-512-maskable.png`、`icon-180.png` — 图标（须通过 ChatGPT 产品把关和用户源视觉确认后才允许新增）

#### 条件修改文件（不进入初始 Codex 指令）

- `components/today/GoalInputCard.tsx` — 仅真机遮挡证据触发
- `components/auth/RegisterPage.tsx` — 仅 AuthShell 仍不能解决真机遮挡时触发
- `components/shell/BottomTabBar.tsx` — 仅 safe-bottom 位置错误或实际基础高度 ≠ 76px 的证据触发

### 12.2 不修改文件

所有未列在 12.1 中的文件均不修改。特别强调：

- 所有 `services/*.mock.ts` — 不动
- 所有 `mockData/` — 不动
- 所有 `types/` — 不动
- `components/growth/*` — 不动（无触控违规）
- `components/ui/*` — 不动
- `components/icons/*` — 不动
- `components/today/TodayHomeView.tsx` — 不动（已使用 min-h-touch）
- `components/auth/WelcomePage.tsx` — 不动（已使用 min-h-touch）
- `components/auth/OtpLoginPage.tsx` — 不动（已使用 min-h-touch）
- `tailwind.config.ts` — 不动（新增 safe-area 通过 globals.css 变量实现，不新增未使用的 Tailwind token）

---

## 13. 禁止文件与 V3.0C Auth 边界

### 13.1 禁止文件

以下目录/文件在 V3.0C 期间**绝对禁止修改**：

```
src/**
apps/mobile-app/services/*
apps/mobile-app/mockData/*
apps/mobile-app/types/*
apps/mobile-app/components/growth/*
apps/mobile-app/components/ui/*
apps/mobile-app/components/icons/*
根 package.json
根 next.config.ts
根 tailwind.config.ts
package-lock.json
```

> 注：`components/footprints/*`、`components/today/*`（除 TodayHomeView/ReadyCard）、`components/me/*`（除 MeAccountCard/MeSyncCard/MeMoreList/MeMenuRow）均可能在特定 Batch 范围内修改。TaskListView、UpcomingTaskList、ExecutionTaskCard、ExecutionGuideCard 已列入 C1/C3 固定允许范围，不再属于禁止目录。

### 13.2 V3.0C Auth 禁止与允许边界

#### 禁止（不得触碰）

| # | 禁止项 | 原因 |
|---|--------|------|
| 1 | 修改真实认证业务逻辑 | V3.1 范围 |
| 2 | 修改 `authService.mock.ts` | 保留 Mock 完整性 |
| 3 | 接入 Supabase Auth | V3.1 范围 |
| 4 | 修改验证码流程 | V3.1 范围 |
| 5 | 修改密码处理逻辑 | V3.1 范围 |
| 6 | 修改 Session 行为 | V3.1 范围 |
| 7 | 修改 Auth 页面视觉结构 | UI Spec 锁定 |

#### 允许（V3.0C 范围内）

| # | 允许项 | 说明 |
|---|--------|------|
| 1 | 新增 `AuthShell.tsx` | 为 4 个 Auth 页面提供统一 safe-area 容器 |
| 2 | Safe Area 包装 | 通过 `app/globals.css` CSS 变量实现系统 safe inset，不新增未使用的 Tailwind token |
| 3 | 键盘适配 | RegisterPage 等页面的键盘不遮挡方案 |
| 4 | BackController 中的 `authScreen` 返回逻辑 | Guest 返回分支（register→otp-login, password-login→otp-login, otp-login→welcome, welcome→root） |
| 5 | 不改变页面视觉结构的最小容器修改 | 如为 safe-area/键盘添加必要的 wrapper div |
| 6 | Auth 页面包裹 AuthShell | [page.tsx](../apps/mobile-app/app/page.tsx) 中 Auth 分支加 AuthShell |

---

## 14. 风险矩阵

| # | 风险 | 概率 | 影响 | 缓解 |
|---|------|:--:|:--:|------|
| 1 | iOS Safari viewport-fit=cover 不生效 | 低 | P1 | iOS 14+ 支持良好，真机验证 |
| 2 | Android Chrome popstate 行为不一致 | 中 | P1 | 三台 Android 真机验证 |
| 3 | visualViewport 不存在或识别失败 | 低 | P2 | textarea focus 触发 `isKeyboardCompact = true`，进入同一受控紧凑模式；真机仍遮挡时单独审查有限滚动容器 Follow-up |
| 4 | `app/manifest.ts` 在 static export 下不可用 | 低 | P1 | V3.2 验证，不兼容则回退 `public/manifest.json` |
| 5 | 横屏降级策略影响 PWA standalone | 低 | P2 | standalone 下 orientation 锁定 |
| 6 | MeConfirmSheet scroll lock 与页面级滚动容器交互 | 中 | P1 | 通过 ref 锁定页面级容器，不锁 body |
| 7 | maskable 图标 safe zone 不够 | 低 | P2 | 以最终确认的图标规范和实际核验为准 |
| 8 | BackController Context 在 Strict Mode 下双重注册 | 中 | P1 | register 覆盖同名 handler；cleanup 正确注销 |
| 9 | TaskExecutionView 无滚动祖先 → scrollIntoView 不可用 | 高 | P1 | visualViewport 为主方案；不支持时 focus 驱动紧凑模式 |
| 10 | pb-[84px] 在 notch 机型上不足以避让 BottomTabBar | 中 | P1 | 执行方案阶段改用 CSS 变量或计算表达式 |

---

## 15. 真机测试矩阵

### 15.1 必须测试的设备

| # | 设备类型 | 浏览器 | 优先级 |
|---|------|------|:--:|
| 1 | Android 真机 (Chrome) | Chrome 最新版 | **P0** |
| 2 | Android 真机 (Chrome) | Chrome 另一台不同品牌 | **P1** |
| 3 | iPhone 真机 (Safari) | iOS Safari 最新版 | **P1** |
| 4 | Android Chrome DevTools | Responsive Mode | P2 |
| 5 | iOS Safari 模拟器 | Xcode Simulator | P2 |
| 6 | 桌面 Chrome | DevTools 390×844 | P2 |

### 15.2 测试场景

| # | 场景 | 验证点 |
|---|------|------|
| 1 | 完整登录流程 | 键盘不遮挡、safe area 正确 |
| 2 | 目标输入 → 任务生成 | 键盘、滚动、按钮触控 |
| 3 | 任务执行 → 反馈输入 | 键盘遮挡、visualViewport |
| 4 | 我的页 → 隐私/反馈 | 二级页面返回键 |
| 5 | Sheet 弹出 | 背景滚动锁定、关闭后恢复 |
| 6 | Android 返回键 | 逐层级返回（Guest/Auth + Authenticated 双分支） |
| 7 | 添加到主屏幕 | standalone 模式正常运行 |
| 8 | PWA 启动 | 闪屏颜色、display standalone |
| 9 | 横屏 | 友好降级提示 |
| 10 | Tab 切换 | BottomTabBar 正确、safe area 不遮挡 |
| 11 | 375 / 390 / 430 宽度 | 三档逐页无崩 |

---

## 16. 375 / 390 / 430 验收

### 16.1 验收方法

Chrome DevTools → Responsive Mode → 逐宽度逐页截图：

| 页面 | 375 | 390 | 430 | 通过标准 |
|------|:--:|:--:|:--:|------|
| WelcomePage | ☐ | ☐ | ☐ | 布局不崩 |
| OtpLoginPage | ☐ | ☐ | ☐ | 居中不溢出 |
| PasswordLoginPage | ☐ | ☐ | ☐ | 居中不溢出 |
| RegisterPage | ☐ | ☐ | ☐ | 居中不溢出 |
| TodayHomeView | ☐ | ☐ | ☐ | 核心卡片首屏可见 |
| TaskListView | ☐ | ☐ | ☐ | 当前任务卡 + "后面再做"可见 |
| TaskExecutionView | ☐ | ☐ | ☐ | 所有模块首屏可见 |
| FootprintsView | ☐ | ☐ | ☐ | 列表不崩 |
| FootprintDetailView | ☐ | ☐ | ☐ | 详情不崩 |
| GrowthView | ☐ | ☐ | ☐ | 三张卡片首屏可见 |
| MeView | ☐ | ☐ | ☐ | 列表不崩 |
| MePrivacyPage | ☐ | ☐ | ☐ | 正文可读 |
| MeFeedbackPage | ☐ | ☐ | ☐ | textarea + 按钮可见 |

### 16.2 判定标准

- **P0**：375px 下任何页面崩溃（水平溢出、内容不可见）
- **P1**：390px 下核心内容需要滚动 > 100px 才能看到
- **P2**：430px 下右侧留白过大（> 80px）或左对齐偏移

---

## 17. Android Chrome 验收

### 17.1 必须验证

| # | 验收项 | 方法 |
|---|------|------|
| 1 | 返回键逐层级返回 | 从执行页 → 任务页 → 首页 → Tab → 退出 |
| 2 | Sheet 返回键关闭 | 弹出 Sheet → 按返回 → Sheet 关闭 |
| 3 | 键盘弹出不遮挡 | 每个输入组件真机输入 |
| 4 | 底部 safe area | 手势条不遮挡 BottomTabBar |
| 5 | 顶部 safe area | 状态栏不遮挡标题 |
| 6 | PWA 安装入口可用 | 浏览器识别为可安装、安装菜单可用 |
| 7 | PWA standalone | 添加到主屏幕后图标启动 |
| 8 | svh 视口稳定性 | Chrome 地址栏显示/隐藏时布局不崩 |
| 9 | 触控按钮 | 所有按钮点击不误触 |
| 10 | 横屏 | 横屏显示降级提示 |

### 17.2 最低要求

- 至少 1 台 Android 真机（Android 10+，Chrome 最新版）
- 推荐 2 台（不同品牌/屏幕尺寸）
- 返回键至少测试 10 个场景

---

## 18. iPhone Safari 验收

### 18.1 必须验证

| # | 验收项 | 方法 |
|---|------|------|
| 1 | viewport-fit=cover | 灵动岛 / notch 区域正确延伸 |
| 2 | 顶部 safe area | 标题不被灵动岛遮挡 |
| 3 | 底部 safe area | 手势条不遮挡 BottomTabBar |
| 4 | 键盘弹出不遮挡 | 每个输入组件真机输入 |
| 5 | PWA 添加到主屏幕 | Safari Share → Add to Home Screen |
| 6 | PWA standalone | standalone 模式下无 Safari 工具栏 |
| 7 | Apple touch icon | 添加到主屏幕时显示正确图标 |
| 8 | 触控按钮 | 所有按钮点击不误触 |
| 9 | 横屏 | 横屏显示降级提示 |
| 10 | overscroll-behavior | Sheet 内容滚动边界不穿透 |

### 18.2 最低要求

- 至少 1 台 iPhone 真机（iOS 16+，Safari）
- 推荐 iPhone 14 Pro 或以上（验证灵动岛 safe area）
- PWA 添加到主屏幕至少验证 1 次

---

## 19. lint / build

```bash
cd C:\Dev\ai-todo
npm --prefix apps/mobile-app run lint
npm --prefix apps/mobile-app run build
```

通过标准：
- lint：0 errors, 0 warnings（或仅 existing non-blocking warnings）
- build：成功，无 error
- 不允许新增 any/ts-nocheck/未使用变量

---

## 20. V3.0C 退出条件

以下**全部**通过后，V3.0C 才能标记为完成：

### 20.1 代码质量

- [ ] `npm --prefix apps/mobile-app run lint` 通过（0 errors）
- [ ] `npm --prefix apps/mobile-app run build` 通过
- [ ] `git diff --name-only` 不包含禁止文件
- [ ] 所有修改文件在 §12.1 范围内

### 20.2 功能验收

- [ ] `viewport-fit=cover` 已配置
- [ ] 顶部 safe area 在 iPhone notch 下正确（AppShell + Auth 页面）
- [ ] 底部 safe area 在 Android 手势条下正确
- [ ] 左右 safe area 正确（AppShell + Auth 页面）
- [ ] 9 处触控违规已全部改为 `min-h-touch`（≥44px）
- [ ] Sheet 打开时背景不可滚动（iOS + Android）
- [ ] ExecutionFeedbackBox 键盘不遮挡按钮（visualViewport 方案）
- [ ] MeFeedbackPage 键盘不遮挡按钮（受控滚动 + scrollIntoView 方案）
- [ ] 375 / 390 / 430 三档宽度 13 个页面全部通过
- [ ] 横屏显示降级提示
- [ ] 统一返回栈双分支（Guest/Auth + Authenticated）逐级正确（至少 10 个场景）
- [ ] Base + Guard Entry 模型正确：内部返回后重新建立 Guard，根退出不形成循环；`pushState`/`replaceState` 保留现有 history.state 字段
- [ ] 根状态返回：有外部历史时能正常返回外部页面；无外部历史时不会重复进入内部状态或堆积 Guard
- [ ] WebHistoryGuard popstate/pageshow 监听正确
- [ ] BackController handler 注册/注销正确（Strict Mode 下无重复）
- [ ] BFCache / 浏览器前进恢复后 `isExitingRef` 正确重置，不永久跳过 Back Handler
- [ ] Android Chrome/PWA 的实际根返回行为已真机记录（有外部历史和无外部历史两种场景）
- [ ] BackControllerProvider 放置在 `app/page.tsx` 中，`app/layout.tsx` 保持 Server Component
- [ ] Android 返回键逐层级返回
- [ ] PWA manifest 可访问
- [ ] 图标文件齐全（192/512/maskable/180）
- [ ] Android Chrome 安装入口可用、安装完成、standalone 正常
- [ ] iOS Safari "添加到主屏幕" 可用、standalone 正常（如设备可用）
- [ ] PWA standalone 模式正常运行

### 20.3 文档

- [ ] 本文档和执行方案经 ChatGPT 审查通过
- [ ] 真机验收结果附截图/照片

### 20.4 禁止文件确认

- [ ] `src/` 零修改
- [ ] API Route 零修改
- [ ] services/mockData 零修改
- [ ] types 零修改
- [ ] `components/growth/*` 零修改

---

## A. 附录：冲突 P2 复核

V3.0C 审计报告（pre-compaction session）中声称发现以下两个 P2 问题。经本架构方案阶段**逐文件代码核验**，结果如下：

### A.1 "成长页'看看下次怎么开始'按钮无回调"

- **审计声称**：GrowthView 中"看看下次怎么开始"按钮没有 onClick 回调
- **核验文件**：[GrowthView.tsx](../apps/mobile-app/components/growth/GrowthView.tsx)（当前最新代码，commit `d6f4bf9b`）
- **核验结果**：**该按钮不存在**
- **证据**：
  - GrowthView.tsx 渲染三个子组件：`GrowthSummaryCard`、`GrowthRhythmCard`、`GrowthTaskSizeCard`
  - 不存在任何"看看下次怎么开始"按钮或 `GrowthSuggestionCard` 组件
  - 根据 Project-State-Handoff.md §9.7，`GrowthSuggestionCard` 已在 V3.0A Batch 5 第一轮修正中移除
- **结论**：从问题清单中删除。不进入 V3.0C 范围。

### A.2 "足迹页'最近 7 天/30 天'切换无回调"

- **审计声称**：FootprintsView 中"最近 7 天/30 天"切换按钮没有 onClick 回调
- **核验文件**：[FootprintsView.tsx](../apps/mobile-app/components/footprints/FootprintsView.tsx)（当前最新代码，commit `d6f4bf9b`）
- **核验结果**：**该切换组件不存在**
- **证据**：
  - FootprintsView.tsx 使用简化足迹模型：`FootprintSummaryCard` + `FootprintList`
  - 数据来自组件内 `MOCK_FOOTPRINTS_DATA` 数组，无日期范围过滤
  - 不存在 `HistoryRangeTabs` 组件或"最近 7 天/30 天"Segment Control
- **结论**：从问题清单中删除。不进入 V3.0C 范围。

### A.3 复核结论

审计报告中的这两个 P2 项基于旧架构文档/UI Spec 的预期功能，但实际代码在 V3.0A 实现过程中进行了简化。两项均不进入 V3.0C 执行范围。

---

> **文档结束**
>
> **关联文档**：
> - [Roadmap-V3.0C-to-V3.3-Mobile-Production.md](Roadmap-V3.0C-to-V3.3-Mobile-Production.md) — V3.0C→V3.3 路线
> - [Project-State-Handoff.md](Project-State-Handoff.md) — 项目当前状态交接文档
> - [Architecture-V3.0-Web-App-Separation.md](Architecture-V3.0-Web-App-Separation.md) — V3.0 架构总方案
