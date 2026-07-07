# V2.6：任务内受控反馈框与 AI 验收机制 架构方案

> **状态**：架构设计阶段。**只写架构方案，不写代码。**
> **前置**：V2.5.3 AI 主动辅助与帮助边界修正 ✅（已提交 `f4bf234`）
> **路线依据**：[Roadmap-V2.6-to-V3.0A-AI-Execution-Loop.md](Roadmap-V2.6-to-V3.0A-AI-Execution-Loop.md)
> **定位**：从"单向通道"到"双向反馈"——让用户能把当前进展、草稿、卡点反馈给 AI
> **下一文档**：`docs/Execution-Plan-V2.6-Task-Feedback-Input.md`（待本架构审查通过后编写）
> **设计日期**：2026-07-08

---

## 目录

- [一、背景与问题](#一背景与问题)
- [二、V2.6 核心目标](#二v26-核心目标)
- [三、产品判断](#三产品判断)
- [四、任务内受控反馈框定义](#四任务内受控反馈框定义)
- [五、用户输入范围](#五用户输入范围)
- [六、AI 验收机制](#六ai-验收机制)
- [七、UI 架构方案](#七ui-架构方案)
- [八、API / Hook 架构方案](#八api--hook-架构方案)
- [九、Prompt 架构方案](#九prompt-架构方案)
- [十、数据与存储边界](#十数据与存储边界)
- [十一、任务完成权边界](#十一任务完成权边界)
- [十二、技术方案比较](#十二技术方案比较)
- [十三、推荐方案](#十三推荐方案)
- [十四、文件影响预估](#十四文件影响预估)
- [十五、与 V2.7 的关系](#十五与-v27-的关系)
- [十六、与 V3.0A 的关系](#十六与-v30a-的关系)
- [十七、风险与缓解](#十七风险与缓解)
- [十八、验收标准](#十八验收标准)
- [十九、不做范围](#十九不做范围)
- [二十、后续 Execution Plan 要点](#二十后续-execution-plan-要点)

---

## 一、背景与问题

### 1.1 V2.5.3 达成了什么

V2.5.3 完成了 Prompt 帮助边界修正——方案 A（只改 Prompt），只修改了 2 个 Prompt 文件：

| 成果 | 说明 |
|------|------|
| AI 不再默认让用户去知乎/百度/小红书搜索 | 安全红线第 8 条 + 帮助边界分节明确禁止 |
| AI 可以主动给材料、框架、清单、低风险草稿 | 11 类材料分类写入 Prompt |
| AI 不替用户完成最终责任动作 | "不能替用户完成什么"分节 7 条规则 |
| 帮助边界从"太窄"修正为"精准" | 五类答案边界（Type 1-5） |

V2.5.3 让 AI 从"搜索引擎代理"升级为"材料提供者"——这是质的飞跃。

### 1.2 V2.5.3 暴露的新问题：单向通道

V2.5.3 上线后，AI 的行为模式发生了根本变化。AI 现在会说：

> "不用去搜，我先给你 5 个常见面试问题。你现在只选第 1 个，写三行：项目背景、你做了什么、结果是什么。写出来告诉我。"

**但问题来了**：用户写出来后，"告诉"AI 的通道不存在。

当前 TaskCompanionPanel 只有 4 个固定按钮：

```
[我完成了]  [我卡住了]
[太难了]    [鼓励我一下]
```

这 4 个按钮**无法表达** 7 种真实反馈：

| # | 用户想表达的 | 固定按钮能表达吗？ |
|---|------------|:--:|
| 1 | "我写了一句话，你看看行不行" | ❌ |
| 2 | "我只完成了一半" | ❌（点"我完成了"不准确，点"我卡住了"也不准确） |
| 3 | "我不知道这样算不算完成" | ❌ |
| 4 | "这是我的草稿" | ❌ |
| 5 | "我今天只有 3 分钟" | ❌ |
| 6 | "这个任务太大了" | ❌（点"太难了"部分接近，但不够精确） |
| 7 | "我做了一部分，剩下不太确定" | ❌ |

### 1.3 核心矛盾

```
V2.5.3 让 AI 能"给材料"        →  但用户无法把"材料使用结果"反馈给 AI
AI 说"写出来告诉我"             →  但界面上没有"告诉 AI"的通道
AI 说"写完这一行就可以先停"      →  但用户停在哪、写成什么样，AI 完全不知道
AI 说"只选第 1 个准备"          →  但用户选没选、准备成什么样，AI 无法判断
```

**V2.5.3 把 AI 的输出能力修好了，但用户→AI 的输入通道仍然是 4 个固定按钮。**

这就是 V2.6 要解决的核心问题。

---

## 二、V2.6 核心目标

### 2.1 一句话目标

**让用户能在当前任务陪伴卡片内，把当前进展、草稿、卡点、时间限制反馈给 AI；AI 基于反馈继续推进当前任务，并像老师一样验收当前小步质量。**

### 2.2 必须解决

| # | 目标 | 说明 |
|---|------|------|
| 1 | AI 说"写出来告诉我"，但用户没有输入通道 | 新增任务内反馈输入框 |
| 2 | 固定按钮表达能力不足 | 文本输入补充按钮无法表达的 7 种反馈 |
| 3 | 鼓励不应作为独立按钮 | 删除"鼓励我一下"，鼓励融入 stuck/too_hard/done/用户反馈 |
| 4 | AI 不只是给下一步，还要能判断当前小步质量 | 新增 AI 验收机制：基本可以过 / 还差一点 / 不算完成 / 可以勾选完成 |
| 5 | AI 可以给修改建议，但不能替用户完成完整最终稿 | 验收边界：给判断不给自动完成 |
| 6 | AI 可以建议"可以勾选完成"，但不能自动勾选任务 | Human-in-the-Loop 不动摇 |

### 2.3 不是目标

| # | 不是目标 | 说明 |
|---|----------|------|
| 1 | 不是做完整聊天系统 | 产品定位不变 |
| 2 | 不是做全局自由聊天框 | 只在 TaskCompanionPanel 内 |
| 3 | 不是做长期对话记忆 | 任务完成后清空 |
| 4 | 不是做任务自动完成 | Human-in-the-Loop 不动摇 |
| 5 | 不是做任务难度/数量动态调整 | 那是 V2.7 |

---

## 三、产品判断

### 判断 1：V2.6 不是完整聊天系统

V2.6 新增的输入框绑定当前任务、当前步骤、当前陪伴会话。任务完成后，上下文结束。不做全局聊天入口，不做聊天气泡列表，不做对话历史存储。

### 判断 2：V2.6 不做全局自由聊天框

输入框只存在于 TaskCompanionPanel 内部——它是"当前任务的反馈通道"，不是"App 级的聊天入口"。没有底部导航的"聊天"Tab，没有全局聊天按钮。

### 判断 3：V2.6 是当前任务内的"受控短反馈输入框"

| 维度 | 约束 |
|------|------|
| 绑定范围 | 当前任务 + 当前陪伴会话 |
| 文本长度 | 前端限制 300 字，后端截断 |
| 生命周期 | 任务完成后清空 |
| 存储策略 | 不落库，不保存长期对话 |
| UI 形态 | textarea（短多行），不是聊天输入框 |

### 判断 4：输入框只服务 7 种用途

1. **当前进展**："我写了一句话。"
2. **当前卡点**："我不知道项目结果怎么写。"
3. **当前草稿**："我本科是遥感专业，想转数据分析。"
4. **当前可用时间**："我现在只有 3 分钟。"
5. **当前难度反馈**："这个任务太大了。"
6. **当前验收请求**："这样算完成吗？"
7. **当前真实情况补充**："我没有真实数据分析实习，只有遥感项目。"

### 判断 5：不允许脱离当前任务闲聊

输入框不是"聊天框"。如果用户输入与当前任务无关的内容（如"今天天气怎么样""讲个笑话"），AI 应礼貌地将话题拉回当前任务。

### 判断 6：不允许 AI 替用户完成最终责任动作

所有 V2.5.3 的安全红线在 V2.6 中继续生效。AI 不能说"我已经帮你完成"，不能自动勾选任务，不能替用户填完整最终稿。

### 判断 7：不保存长期对话记忆

userFeedback 只参与当次 AI 请求。任务完成后，所有反馈上下文清空。不做对话历史存储。

### 判断 8：不新增聊天 Tab

底部导航不新增"聊天"入口。反馈框是陪伴面板内的组件，不是独立页面。

### 判断 9：不做对话气泡长列表

UI 保持当前设计：AI 输出区域 + 反馈输入框 + 快捷按钮。不引入聊天气泡 UI、对话历史滚动、多轮对话展示。

### 判断 10：任务完成后，反馈上下文结束

用户勾选任务完成（或退出陪伴）后，当前陪伴会话结束。反馈框和 AI 验收上下文随之清空。

---

## 四、任务内受控反馈框定义

### 4.1 什么是"任务内受控反馈框"

它是一个绑定当前任务、短文本、非持久化的输入区域，让用户把当前任务的执行状态用自然语言反馈给 AI。

### 4.2 核心约束

| 维度 | 约束 |
|------|------|
| **位置** | TaskCompanionPanel 内，AI 消息下方，快捷按钮上方 |
| **控件类型** | `<textarea>`，2-3 行高度 |
| **placeholder** | "写下你现在做到哪了 / 卡在哪里 / 贴一小段草稿" |
| **发送按钮文案** | "发送给 AI" |
| **字符限制** | 前端 maxLength 300，后端截断 300 字 |
| **发送行为** | 发送后清空输入框，触发 AI 请求 |
| **键盘行为** | Enter 发送，Shift+Enter 换行（P2 可后置） |
| **空输入** | 不可发送（发送按钮 disabled） |
| **loading 状态** | loading 时输入框和所有按钮 disabled |
| **移动端** | 键盘弹出时不破坏布局（执行方案重点） |

### 4.3 与 ChatGPT 式聊天的关键区别

| ChatGPT 式聊天 | 任务内受控反馈框 |
|--------------|---------------|
| 全局对话 | 绑定当前任务 |
| 无限轮次上下文 | 当前任务 + 最近 5 步 |
| 可聊任何话题 | 只能反馈当前任务执行状态 |
| 历史对话长期保留 | 任务完成后清空 |
| 用户可要求 AI 做任何事 | 安全红线仍然生效 |
| 聊天气泡 UI | 单条 AI 输出 + 输入框 |
| 独立聊天页面/Tab | 陪伴面板内的嵌入式组件 |

---

## 五、用户输入范围

### 5.1 允许输入（7 类）

| # | 类型 | 示例 |
|---|------|------|
| 1 | **当前进展** | "我写了第一句话。" |
| 2 | **当前卡点** | "我不知道项目结果怎么写。" |
| 3 | **一小段草稿** | "我本科是遥感专业，想转数据分析。" |
| 4 | **当前可用时间** | "我现在只有 3 分钟。" |
| 5 | **难度反馈** | "这个任务太大了。" |
| 6 | **验收请求** | "这样算完成吗？" |
| 7 | **真实情况补充** | "我没有真实数据分析实习，只有遥感项目。" |

### 5.2 禁止输入（8 类）

| # | 禁止 | 原因 |
|---|------|------|
| 1 | 脱离当前任务聊天 | "今天天气怎么样"——与任务无关 |
| 2 | 要求 AI 完成整件事 | "帮我写完整个简历"——安全红线 |
| 3 | 要求 AI 编造经历 | "帮我编一个项目经历"——安全红线 |
| 4 | 要求 AI 写完整最终稿 | "帮我写完整投递邮件"——安全红线 |
| 5 | 要求 AI 跳过 locked / 后续任务 | "帮我跳过这一步"——V2.5.1 规则 |
| 6 | 要求 AI 自动勾选完成 | "帮我勾选完成"——Human-in-the-Loop |
| 7 | 要求 AI 长期记住对话 | "记住我上次说的"——不做长期记忆 |
| 8 | 要求 AI 执行外部操作 | "帮我发邮件""帮我提交"——安全红线 |

### 5.3 AI 对禁止输入的回应策略

当用户输入越界内容时，AI 应**礼貌拒绝 + 拉回任务**：

> "这个我帮不了你。我们回到当前这一步——你刚才写的开头，需要补一句结果。现在只补这一句。"

不训斥用户，不展开解释"为什么不能"，只简短拒绝并拉回任务。

---

## 六、AI 验收机制

### 6.1 验收是什么

AI 验收是 V2.6 的核心新增能力——AI 不仅要推"下一步"，还要能判断"这一步够不够"。

当前 AI 只会推下一步，但不会判断上一步质量——用户不确定自己是不是真的"完成了"。有了验收能力，AI 可以像老师一样说"可以过了"或"还差一句"或"缺了 X"——这让"完成"有了质量标准。

### 6.2 四类验收结论

| 验收结论 | 含义 | 示例 |
|---------|------|------|
| ✅ **基本可以过** | 当前步骤达到了最低完成标准 | "这一步基本可以过。你已经写出了项目背景和你做了什么，接下来只补一句结果就够。" |
| ⚠️ **还差一点** | 方向对，但缺少某个关键要素 | "还差一点。你写了背景，但缺少'你做了什么'这一句。现在只补这一句。" |
| ❌ **不算完成** | 当前内容还不足以称为"完成这一步" | "这一步还不算完成，因为现在只是想法，还没有写出具体内容。先写一句开头。" |
| 🏁 **可以勾选完成** | 当前任务整体已达到最低完成标准 | "这一步已经达到最低完成标准。你可以自己勾选完成。" |

### 6.3 验收触发方式

AI 在以下情况下执行验收判断：

| 触发方式 | 说明 |
|---------|------|
| 用户点击"我完成了" | AI 判断当前步骤是否真的可以算完成 |
| 用户输入"这样算完成吗？" | AI 对用户当前进展做验收判断 |
| 用户贴了草稿 | AI 判断草稿质量，给出"基本可以过/还差一点/不算完成" |
| AI 给出下一步后用户反馈进展 | AI 判断进展是否达到该步骤的标准 |

### 6.4 验收边界（6 条红线）

| # | 边界 | 说明 |
|---|------|------|
| 1 | AI 只能建议"可以勾选完成"，不能自动勾选 | 勾选永远是用户手动操作 |
| 2 | AI 不能说"我已经帮你完成" | 不能替用户做任何最终动作 |
| 3 | AI 不能替用户填完整最终稿 | 可以说"补一句 X"，不能替用户写出那一句的完整内容 |
| 4 | AI 不能为了让用户通过验收而编造经历 | 不能说"你可以说你做过 XX" |
| 5 | AI 不能用过高标准卡住用户 | 优先判断"最低完成标准"，不是追求完美 |
| 6 | AI 验收是建议不是命令 | 用户可以不同意 AI 的判断，可以自己决定勾选 |

### 6.5 "最低完成标准"原则

AI 验收时应遵循：

```
优先判断"这一步是否达到了最低完成标准"
而不是"这一步是否做到了最好"

✅ "开头没问题，有项目背景和你做了什么——基本可以过。"
❌ "开头还可以更精彩，建议你再加一个金句、一个数据、一个故事……"
```

AI 不能说"还差一点"让用户永远无法完成。如果用户已经完成了该步骤的核心要素，就应该给"基本可以过"。

---

## 七、UI 架构方案

### 7.1 当前 UI 结构（代码核验）

基于 [TaskCompanionPanel.tsx](src/components/TaskCompanionPanel.tsx) 的真实代码结构：

```
┌─────────────────────────────────────┐
│  AI 陪你做               [退出陪伴] │
│  每次只推进一步...                  │
├─────────────────────────────────────┤
│  AI 消息区域（白色圆角卡片）          │
│  "不用去搜，我先给你 5 个..."        │
├─────────────────────────────────────┤
│  [DONE] 提示（isDone 时显示）       │
│  "如果你觉得这条任务已经推进到位..."  │
├─────────────────────────────────────┤
│  2 列按钮网格                        │
│  [我完成了]    [我卡住了]           │
│  [太难了]      [鼓励我一下]  ← 删除 │
│  [复制当前步骤] [退出陪伴]           │
└─────────────────────────────────────┘
```

**关键代码发现**：

- `SIGNAL_BUTTONS` 数组（第 24-32 行）：4 个按钮，含 `{ signal: "encourage", label: "鼓励我一下" }`
- `visibleSignalButtons`（第 65-71 行）：当 `isDone` 时只保留 `encourage` 按钮
- `handleSendSignal`（第 114-117 行）：只接受 signal 参数，无文本参数
- 按钮网格使用 `grid grid-cols-2 gap-2`（第 194 行）

### 7.2 目标 UI 结构

```
┌─────────────────────────────────────┐
│  AI 陪你做这一步            [退出陪伴]│
│  当前任务：准备常见面试问题          │
├─────────────────────────────────────┤
│  AI 消息区域（白色圆角卡片）          │
│  "不用去搜，我先给你 5 个常见问题..." │
├─────────────────────────────────────┤
│  [DONE] 提示（isDone 时显示）       │
│  "如果你觉得这条任务已经推进到位..."  │
├─────────────────────────────────────┤
│  反馈输入框（新增）                   │
│  ┌─────────────────────────────────┐│
│  │ 写下你现在做到哪了 / 卡在哪里 /   ││
│  │ 贴一小段草稿...                  ││
│  └─────────────────────────────────┘│
│  [发送给 AI]                         │
├─────────────────────────────────────┤
│  快捷按钮（2 列网格）                 │
│  [我完成了]    [我卡住了]           │
│  [太难了]                           │
│  [复制当前步骤] [退出陪伴]           │
└─────────────────────────────────────┘
```

### 7.3 详细 UI 变更

#### 7.3.1 删除"鼓励我一下"按钮

**当前代码**（第 24-32 行）：
```typescript
const SIGNAL_BUTTONS: Array<{
  signal: Exclude<CompanionUserSignal, "start">;
  label: string;
}> = [
  { signal: "done", label: "我完成了" },
  { signal: "stuck", label: "我卡住了" },
  { signal: "too_hard", label: "太难了" },
  { signal: "encourage", label: "鼓励我一下" },  // ← 删除此项
];
```

**目标代码**：
```typescript
const SIGNAL_BUTTONS: Array<{
  signal: Exclude<CompanionUserSignal, "start" | "user_feedback">;
  label: string;
}> = [
  { signal: "done", label: "我完成了" },
  { signal: "stuck", label: "我卡住了" },
  { signal: "too_hard", label: "太难了" },
];
```

**注意**：`encourage` 从 `CompanionUserSignal` 类型中是否删除需评估。建议保留类型以保持 Prompt 兼容性——因为用户可能在反馈框中输入"我需要鼓励"，AI 仍需响应。但从 UI 按钮和 `SIGNAL_BUTTONS` 数组中移除。

#### 7.3.2 isDone 状态下的按钮逻辑变更

**当前代码**（第 65-71 行）：
```typescript
const visibleSignalButtons = useMemo(() => {
  if (!isDone) {
    return SIGNAL_BUTTONS;
  }
  return SIGNAL_BUTTONS.filter((button) => button.signal === "encourage");
}, [isDone]);
```

**目标代码**：
```typescript
const visibleSignalButtons = useMemo(() => {
  if (!isDone) {
    return SIGNAL_BUTTONS;
  }
  // isDone 后不再显示快捷按钮——用户如需继续，通过反馈框输入
  return [];
}, [isDone]);
```

#### 7.3.3 新增反馈输入框组件

建议在 TaskCompanionPanel 内部新增以下 state 和逻辑：

```typescript
// 新增 state
const [feedbackText, setFeedbackText] = useState("");

// 新增发送反馈处理
const handleSendFeedback = () => {
  const trimmed = feedbackText.trim();
  if (!trimmed || isLoading) return;
  setLastSignal("user_feedback");
  sendFeedback(trimmed);  // 新 Hook 方法
  setFeedbackText("");
};

// 键盘处理
const handleFeedbackKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSendFeedback();
  }
};
```

**输入框 JSX**（插入到 AI 消息区域下方、按钮区域上方）：

```tsx
{/* 反馈输入框区域 */}
<div className="mt-3">
  <textarea
    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-5 text-slate-700 placeholder-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-200"
    disabled={isLoading}
    maxLength={300}
    onChange={(e) => setFeedbackText(e.target.value)}
    onKeyDown={handleFeedbackKeyDown}
    placeholder="写下你现在做到哪了 / 卡在哪里 / 贴一小段草稿"
    rows={2}
    value={feedbackText}
  />
  <div className="mt-2 flex justify-end">
    <button
      className="min-h-10 rounded-full bg-emerald-500 px-4 text-xs font-semibold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={isLoading || !feedbackText.trim()}
      onClick={handleSendFeedback}
      type="button"
    >
      {isLoading && activeSignal === "user_feedback" ? "处理中..." : "发送给 AI"}
    </button>
  </div>
</div>
```

#### 7.3.4 按钮布局调整

删除 encourage 后，快捷按钮从 4 个减少为 3 个（done / stuck / too_hard）。加上"复制当前步骤"和"退出陪伴"，共 5 个按钮。2 列网格布局可继续保持。

建议布局（2 列，5 个按钮自然分布）：
```
[我完成了]    [我卡住了]
[太难了]      [复制当前步骤]
[退出陪伴]
```

或者改为 3 个信号按钮一行 + 2 个工具按钮一行：
```
[我完成了] [我卡住了] [太难了]
[复制当前步骤] [退出陪伴]
```

具体布局由执行方案阶段基于真实 UI 效果决定。

#### 7.3.5 移动端适配

- 输入框使用 `rows={2}`，移动端不会占用过多屏幕空间
- 键盘弹出时，使用 `scrollIntoView` 或 CSS `position: sticky` 确保输入框可见
- 输入框 `maxLength={300}` 防止超长输入
- 所有按钮 `min-h-11`（44px+）满足触控最小尺寸

### 7.4 isDone 状态下的输入框

当 `isDone`（AI 给出 [DONE] 标记）时：
- 快捷按钮隐藏（不再有 encourage 按钮）
- 反馈输入框仍然可用——用户可能想输入"这个还差一点"或"确认完成"
- 退出陪伴按钮保留

---

## 八、API / Hook 架构方案

### 8.1 当前链路分析（代码核验）

**useTaskCompanion.ts** `requestCompanion()` 的请求体（第 100-114 行）：

```typescript
body: JSON.stringify({
  completedSteps: sequenceContext?.completedSteps,
  currentStep: currentStepMessage,
  currentStepNumber: sequenceContext?.currentStepNumber,
  goal,
  nextTaskTitle: sequenceContext?.nextTaskTitle,
  previousTaskTitle: sequenceContext?.previousTaskTitle,
  stepHistory: historySnapshot,
  taskTitle,
  totalSteps: sequenceContext?.totalSteps,
  userSignal,
  // ❌ 没有 userFeedback 字段
}),
```

**task-companion/route.ts**：
- `VALID_USER_SIGNALS` = `Set(["start", "done", "stuck", "too_hard", "encourage"])`
- `CompanionRequestBody` 接口没有 `userFeedback` 字段
- `isCompanionUserSignal()` 只验证 5 个信号

**types.ts**：
- `CompanionUserSignal` = `"start" | "done" | "stuck" | "too_hard" | "encourage"`

### 8.2 推荐变更

#### 8.2.1 types.ts — 新增 signal 类型

```typescript
export type CompanionUserSignal =
  | "start"
  | "done"
  | "stuck"
  | "too_hard"
  | "encourage"       // 保留类型，UI 层移除按钮
  | "user_feedback";  // ← 新增
```

**命名选择：`"user_feedback"` vs `"feedback"`**

| 考量 | `"user_feedback"` | `"feedback"` |
|------|:--:|:--:|
| 与现有风格一致（done/stuck/too_hard/encourage） | ✅ 两词下划线 | ✅ 单词 |
| 语义清晰——这是"用户的反馈"不是"系统的反馈" | ✅ | ⚠️ 略显模糊 |
| 便于 Prompt 区分 | ✅ | ✅ |
| 便于后续 V2.7 统计用户反馈类型 | ✅ | ⚠️ |

**推荐**：`"user_feedback"`。与现有 `too_hard` 两词下划线风格一致，语义明确。

#### 8.2.2 useTaskCompanion.ts — 新增 sendFeedback 方法

```typescript
// 新增方法
const sendFeedback = useCallback(
  async (feedbackText: string) => {
    // 在 requestCompanion 内部新增 userFeedback 参数
    await requestCompanion("user_feedback", feedbackText);
  },
  [requestCompanion],
);
```

`requestCompanion` 签名扩展：

```typescript
const requestCompanion = useCallback(
  async (userSignal: CompanionUserSignal, userFeedback?: string) => {
    // ... 现有逻辑 ...
    body: JSON.stringify({
      // ... 现有字段 ...
      userSignal,
      userFeedback: userFeedback?.trim().slice(0, 300),  // ← 新增
    }),
  },
  // ...
);
```

**必须保证**：
- 原有 `startCompanion()` → `requestCompanion("start")` 不受影响（userFeedback 为 undefined）
- 原有 `sendSignal(signal)` → `requestCompanion(signal)` 不受影响（userFeedback 为 undefined）
- 新增 `sendFeedback(text)` → `requestCompanion("user_feedback", text)`

#### 8.2.3 task-companion/route.ts — 新增 userFeedback 处理

**VALID_USER_SIGNALS 扩展**：

```typescript
const VALID_USER_SIGNALS = new Set<CompanionUserSignal>([
  "start",
  "done",
  "stuck",
  "too_hard",
  "encourage",
  "user_feedback",  // ← 新增
]);
```

**CompanionRequestBody 扩展**：

```typescript
interface CompanionRequestBody {
  // ... 现有字段 ...
  userFeedback?: unknown;  // ← 新增
}
```

**新增 normalizeUserFeedback**：

```typescript
const MAX_USER_FEEDBACK_LENGTH = 300;

function normalizeUserFeedback(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim().slice(0, MAX_USER_FEEDBACK_LENGTH);
  return trimmed || undefined;
}
```

**buildCompanionUserPrompt 调用扩展**：

```typescript
const userPrompt = buildCompanionUserPrompt({
  // ... 现有字段 ...
  userSignal: body.userSignal,
  userFeedback: normalizeUserFeedback(body.userFeedback),  // ← 新增
});
```

### 8.3 Hook 接口总结

| 方法 | 签名 | 用途 | 变更 |
|------|------|------|:--:|
| `startCompanion()` | `() => Promise<void>` | 开始陪伴 | 不变 |
| `sendSignal(signal)` | `(signal: Exclude<CompanionUserSignal, "start" \| "user_feedback">) => Promise<void>` | 发送固定信号 | 类型排除 encourage |
| `sendFeedback(text)` | `(text: string) => Promise<void>` | 发送自由文本反馈 | **新增** |
| `exitCompanion()` | `() => void` | 退出陪伴 | 不变 |
| `reset()` | `() => void` | 重置状态 | 不变 |

### 8.4 并发请求处理

现有 `inflightRef` 机制已处理并发请求（第 70 行、第 85-88 行）。当 loading 时，UI 层 disabled 所有按钮和输入框——包括新的反馈输入框。无需额外并发控制。

---

## 九、Prompt 架构方案

### 9.1 当前 Prompt 结构（代码核验）

基于 [task-companion.ts](src/prompts/task-companion.ts) 的真实结构：

- `COMPANION_SYSTEM_PROMPT`：11 个分节
- `SIGNAL_PROMPTS`：5 个信号（start / done / stuck / too_hard / encourage）
- `CompanionPromptInput` 接口：taskTitle, goal, currentStep, stepHistory, userSignal, sequenceContext
- `buildCompanionUserPrompt()` 函数

### 9.2 Prompt 新增内容

#### 9.2.1 COMPANION_SYSTEM_PROMPT 新增分节

在现有分节结构中新增两个分节：

**新增分节 1**：`═══ 用户反馈输入处理 ═══`（插入到"用户反馈处理"之前或升级"用户反馈处理"分节）

```
═══ 用户反馈输入处理 ═══
当用户通过反馈输入框发送自由文本（user_feedback 信号）时，你收到的是用户
关于当前任务执行状态的自由文本。请按以下规则处理：

1. 先理解用户反馈的内容，判断它是属于哪种类型：
   - 贴了草稿 → 先判断草稿质量
   - 说卡住了 → 识别具体卡点
   - 说没时间 → 给时间适配版本
   - 问"这样算完成吗" → 给验收判断
   - 说太大了 → 降级为更小动作
   - 说进展 → 基于进展推下一步

2. 回应结构：
   - 先理解用户反馈（一句话）
   - 给一句自然认可（行动导向，不空泛）
   - 判断当前小步质量（如适用）
   - 说明还差什么（如适用）
   - 给一个最小下一步动作
   - 必要时给短示例（标注"这是示例，请替换成你自己的内容"）
   - 最后收束到当前任务内部，不跳到后续任务

3. 如果用户输入脱离当前任务，礼貌拒绝并拉回任务：
   "这个我帮不了你。我们回到当前这一步——[拉回任务]。"
```

**新增分节 2**：`═══ AI 验收规则 ═══`

```
═══ AI 验收规则 ═══
当用户完成一个步骤或询问"这样算完成吗"时，你需要判断当前小步的质量。

你可以给出的验收结论：
1. 基本可以过：当前步骤达到了最低完成标准。
   示例："这一步基本可以过。你已经写出了项目背景和你做了什么，接下来只补一句结果就够。"
2. 还差一点：方向对，但缺少某个关键要素。
   示例："还差一点。你写了背景，但缺少'你做了什么'这一句。现在只补这一句。"
3. 不算完成：当前内容还不足以称为"完成这一步"。
   示例："这一步还不算完成，因为现在只是想法，还没有写出具体内容。先写一句开头。"
4. 可以勾选完成：当前任务整体已达到最低完成标准。
   示例："这一步已经达到最低完成标准。你可以自己勾选完成。"

验收边界（不可违反）：
- 只能建议"可以勾选完成"，不能自动勾选。
- 不能说"我已经帮你完成"。
- 不能替用户填完整最终稿。可以说"补一句 X"，但不能写出完整内容。
- 不能为了让用户通过验收而编造经历。
- 优先判断"最低完成标准"，不是追求完美。
- 如果用户已经完成了该步骤的核心要素，就给"基本可以过"。
- 不要用过高标准反复卡住用户。
```

#### 9.2.2 升级"用户反馈处理"分节

现有"用户反馈处理"分节（第 53-58 行）保留，新增 `user_feedback` 条目：

```
- user_feedback：用户通过反馈输入框发送了自由文本。先理解用户反馈内容，
  识别反馈类型（草稿/卡点/时间约束/验收请求/难度反馈/进展），
  按"用户反馈输入处理"分节的规则回应。优先基于用户反馈内容推进当前任务。
```

#### 9.2.3 SIGNAL_PROMPTS 新增

```typescript
const SIGNAL_PROMPTS: Record<CompanionUserSignal, string> = {
  start: "用户刚开始做这个任务，请给出当前第一小步。",
  done: "用户完成了你上一轮给出的步骤，请认可完成，并给出下一步。",
  stuck: "用户在上一步卡住了，请把当前步骤拆成更小、更容易执行的动作。优先直接给材料或更小动作，不要让用户自己去搜索。",
  too_hard: "用户觉得当前步骤太难了，请给出降级或简化方案，并主动降级为 3 分钟 / 最小版本。",
  encourage: "用户需要鼓励，请按主动鼓励机制给出简短、具体、行动导向的鼓励。",  // 保留，以备 feedback 文本中"我需要鼓励"
  user_feedback: "用户通过反馈输入框发送了自由文本。请先理解用户反馈内容，识别反馈类型（草稿/卡点/时间约束/验收请求/难度反馈/进展），按用户反馈输入处理规则回应。",  // ← 新增
};
```

#### 9.2.4 buildCompanionUserPrompt 扩展

```typescript
interface CompanionPromptInput {
  taskTitle: string;
  goal?: string;
  currentStep?: string;
  stepHistory?: string[];
  userSignal: CompanionUserSignal;
  sequenceContext?: CompanionSequenceContext;
  userFeedback?: string;  // ← 新增
}

export function buildCompanionUserPrompt(input: CompanionPromptInput): string {
  const parts: string[] = [];
  // ... 现有逻辑 ...

  // 新增：用户反馈文本
  if (input.userFeedback?.trim()) {
    parts.push(`用户反馈内容：${input.userFeedback.trim()}`);
  }

  parts.push(SIGNAL_PROMPTS[input.userSignal]);
  return parts.join("\n");
}
```

#### 9.2.5 encourage signal 策略

**保留 `encourage` 在 `CompanionUserSignal` 类型和 SIGNAL_PROMPTS 中**，但从 UI 层移除独立按钮。

理由：
- 用户可能在反馈框中输入"我需要鼓励"，AI 仍需识别并响应
- Prompt 中 `encourage` 的回应逻辑（主动鼓励机制）继续存在
- 只是 UI 层面不再暴露独立按钮——鼓励融入反馈流

#### 9.2.6 V2.5.3 安全红线全部保留

V2.5.3 的所有安全红线、帮助边界、不能替用户完成什么、高风险任务边界分节全部保留不变。V2.6 只新增不删除。

---

## 十、数据与存储边界

### 10.1 明确规则

| # | 规则 | 说明 |
|---|------|------|
| 1 | V2.6 不改数据库 | 零 schema 变更，零 migration |
| 2 | V2.6 不保存长期对话 | userFeedback 不存入任何表 |
| 3 | userFeedback 只参与当次 AI 请求 | 发送到 API → 传给 Prompt → AI 回应 → 结束 |
| 4 | stepHistory 不包含用户反馈 | stepHistory 只存 AI 的 step message，不存用户反馈文本 |
| 5 | 不新增对话存储表 | 不做 messages 表、不做 conversation 表 |
| 6 | 不新增对话历史 UI | 不做聊天气泡列表、不做对话滚动区域 |

### 10.2 stepHistory 处理策略

**当前 stepHistory 逻辑**（useTaskCompanion.ts 第 132-135 行）：

```typescript
setStepHistory((currentHistory) =>
  keepRecentSteps([...currentHistory, companionResponse.data.message]),
);
```

stepHistory 只追加 AI 的 response message，不追加用户的 feedback text。

**V2.6 保持此逻辑不变**。用户反馈只通过 `userFeedback` 字段传给 API，不存入 stepHistory。

**理由**：
- stepHistory 是"AI 给了哪些步骤"的历史，用于让 AI 知道之前说过什么
- 用户反馈是"用户对当前步骤的回应"，不是独立步骤
- 如果 stepHistory 也存用户反馈，语义混淆，增加 Prompt 复杂度
- V2.7 如需统计用户反馈模式，可再设计轻量计数器——不要提前复杂化

### 10.3 会话生命周期

```
用户点击"开始陪我做" → 陪伴会话开始
  ↓
AI 给出第一步 → 用户反馈 / 点击按钮
  ↓
AI 给出下一步 → 用户反馈 / 点击按钮
  ↓
... (循环) ...
  ↓
AI 给出 [DONE] / 用户点击"退出陪伴" / 用户勾选完成
  ↓
陪伴会话结束，所有反馈上下文清空
```

---

## 十一、任务完成权边界

### 11.1 核心原则

**AI 可以验收，但不能完成。**

这是 V2.6 的最高优先级产品约束。

### 11.2 详细边界

| AI 可以 | AI 不可以 |
|---------|----------|
| 说"这一步基本可以过" | 自动勾选任务 ❌ |
| 说"你可以自己勾选完成" | 调用 onToggle ❌ |
| 说"还差一句结果" | 修改 task.completed 字段 ❌ |
| 给修改建议 | 绕过 locked 顺序执行 ❌ |
| 判断草稿质量 | 说"我已经帮你完成" ❌ |
| 建议"可以勾选" | 替用户填完整最终稿 ❌ |

### 11.3 完成动作的唯一入口

用户点击 checkbox 仍是唯一完成动作。这个约束在代码层面由以下机制保证：

1. **UI 层**：checkbox 是用户手动点击，AI 面板没有任何自动勾选逻辑
2. **Hook 层**：`onToggle` 只在 TaskItem 的 checkbox onChange 中调用
3. **API 层**：task-companion API 只返回 AI 文本，不修改任务状态
4. **Prompt 层**：安全红线第 3 条明确"不自动替用户完成任务，不自动勾选任务"

V2.6 不改变以上任何一层。

---

## 十二、技术方案比较

### 方案 A：只在前端本地拼接 userFeedback 到现有 signal

**思路**：不新增 signal 类型，不改 API 请求体。用户输入文本后，hook 将其拼接到 `currentStep` 或作为独立字段附加到现有请求体中。

| 维度 | 评价 |
|------|------|
| API 改动 | ❌ 无 |
| types.ts 改动 | ❌ 无 |
| route 改动 | ❌ 无 |
| Prompt 改动 | ✅ 需要（让 AI 理解拼接的文本） |
| 结构清晰度 | 🔴 差——userFeedback 和 currentStep 语义混淆 |
| 扩展性 | 🔴 差——后续 V2.7 需要精确区分信号和反馈文本 |
| 结论 | **不推荐**——结构不清晰，语义混淆 |

### 方案 B：扩展现有 task-companion 链路，新增 userFeedback 可选字段 ✅

**思路**：
- `types.ts`：`CompanionUserSignal` 新增 `"user_feedback"`
- `TaskCompanionPanel.tsx`：新增反馈输入框 + 删除 encourage 按钮
- `useTaskCompanion.ts`：新增 `sendFeedback(text)` 方法
- `task-companion/route.ts`：接收 `userFeedback?: string`，新增 `"user_feedback"` 到有效信号集
- `task-companion.ts` (prompt)：新增 `user_feedback` 信号 Prompt + AI 验收规则

| 维度 | 评价 |
|------|------|
| API 改动 | ✅ 请求体新增可选字段 |
| types.ts 改动 | ✅ 新增 1 个 signal 值 |
| Prompt 改动 | ✅ 新增 2 个分节 + 1 个信号 |
| UI 改动 | ✅ TaskCompanionPanel 改 |
| Hook 改动 | ✅ useTaskCompanion 改 |
| 数据库改动 | ❌ 无 |
| 结构清晰度 | 🟢 好——userFeedback 是独立字段 |
| 扩展性 | 🟢 好——后续 V2.7 可基于 userFeedback 模式扩展 |
| 向后兼容 | 🟢 好——userFeedback 为可选字段，原有调用不受影响 |
| 结论 | **推荐方案** |

### 方案 C：完整聊天系统

**思路**：新增 messages 数组、新增聊天 UI、可能存储对话、引入对话历史。

| 维度 | 评价 |
|------|------|
| 改动范围 | 🔴 大——API + UI + Hook + 可能数据库 |
| 产品边界 | 🔴 超出——V2.6 明确不做聊天系统 |
| 风险 | 🔴 高——容易把产品变成聊天软件 |
| 结论 | **不推荐**——超出产品边界 |

### 方案对比总结

| 维度 | 方案 A | 方案 B ✅ | 方案 C |
|------|:--:|:--:|:--:|
| 改 types.ts | ❌ | ✅ 1 行 | ✅ |
| 改 UI | ✅ | ✅ | ✅ |
| 改 Hook | ✅ | ✅ | ✅ |
| 改 API Route | ❌ | ✅ | ✅ |
| 改 Prompt | ✅ | ✅ | ✅ |
| 改 Parser | ❌ | ❌ | 可能 |
| 改 task-execution | ❌ | ❌ | ❌ |
| 改数据库 | ❌ | ❌ | 可能 |
| 结构清晰 | 🔴 | 🟢 | 🟢 |
| 产品边界内 | ✅ | ✅ | 🔴 |
| 风险等级 | 🟡 中 | 🟢 低 | 🔴 高 |
| **推荐** | ❌ | **✅ 推荐** | ❌ |

---

## 十三、推荐方案

### 13.1 V2.6 = 方案 B

**核心思路**：在现有 task-companion 链路上新增一个可选字段 `userFeedback`，新增一个信号类型 `"user_feedback"`。最小改动，最大兼容。

### 13.2 为什么方案 B 是最优选择

| # | 理由 |
|---|------|
| 1 | **结构清晰**：userFeedback 是独立字段，语义明确 |
| 2 | **向后兼容**：userFeedback 为可选字段，原有 start/done/stuck/too_hard 调用完全不受影响 |
| 3 | **改动面小**：5 个文件，不改数据库、不改 parser、不改 task-execution |
| 4 | **扩展性好**：V2.7 可基于 userFeedback 模式做反馈类型统计 |
| 5 | **Prompt 可精准处理**：`user_feedback` 信号让 AI 明确知道"这是用户的自由文本，需要特殊处理" |
| 6 | **风险可控**：改动集中在陪伴链路内，不影响任务生成、历史、统计、复盘 |

---

## 十四、文件影响预估

### 14.1 建议修改文件（5 个）

基于代码核验后的精确影响清单：

| # | 文件 | 修改内容 | 改动量 | 风险 |
|:--:|------|------|:--:|:--:|
| 1 | `src/lib/types.ts` | `CompanionUserSignal` 新增 `"user_feedback"` | +1 行 | 低 |
| 2 | `src/components/TaskCompanionPanel.tsx` | 删除 encourage 按钮 + 新增反馈输入框 + 调整 isDone 按钮逻辑 + 调整按钮布局 | ~+60 行改 ~15 行 | 中 |
| 3 | `src/hooks/useTaskCompanion.ts` | `requestCompanion` 新增 `userFeedback` 可选参数 + 新增 `sendFeedback` 方法 + 返回类型扩展 | ~+15 行改 ~5 行 | 中 |
| 4 | `src/app/api/task-companion/route.ts` | `VALID_USER_SIGNALS` 新增 `"user_feedback"` + `CompanionRequestBody` 新增 `userFeedback` + 新增 `normalizeUserFeedback` + `buildCompanionUserPrompt` 调用新增 `userFeedback` | ~+15 行改 ~5 行 | 中 |
| 5 | `src/prompts/task-companion.ts` | COMPANION_SYSTEM_PROMPT 新增"用户反馈输入处理"分节 + 新增"AI 验收规则"分节 + 升级"用户反馈处理"分节 + SIGNAL_PROMPTS 新增 `user_feedback` + `CompanionPromptInput` 新增 `userFeedback` + `buildCompanionUserPrompt` 新增反馈文本拼接 | ~+60 行改 ~10 行 | 中 |

### 14.2 不建议修改文件

| # | 文件 | 原因 |
|:--:|------|------|
| 1 | `src/lib/task-companion-parser.ts` | 纯文本解析逻辑不变——仍然 strip markdown + [DONE] 检测 + 截断 300 字 |
| 2 | `src/lib/task-execution.ts` | 任务状态判断纯函数，与陪伴反馈无关 |
| 3 | `src/lib/ai-client.ts` | AI 调用逻辑不变 |
| 4 | `src/components/TaskAssistPanel.tsx` | V2.6 不改 AI 辅助面板 |
| 5 | `src/components/TaskItem.tsx` | 容器组件不变——它只负责传递 props 给 TaskCompanionPanel |
| 6 | `src/components/TaskList.tsx` | 列表渲染逻辑不变 |
| 7 | `src/hooks/useTaskGroup.ts` | 核心任务状态不变 |
| 8 | `src/hooks/useTaskAssist.ts` | 辅助 hook 不变 |
| 9 | `src/prompts/task-assist.ts` | V2.5.3 已是最终版，V2.6 不改 |
| 10 | 数据库 schema / migration | 零数据库变更 |
| 11 | `package.json` / `package-lock.json` | 无新依赖 |
| 12 | `.env.local` / `next.config.ts` | 环境变量和配置不变 |

### 14.3 预估总改动量

| 层 | 新增行数 | 修改行数 |
|----|:--:|:--:|
| types.ts | ~1 | 0 |
| TaskCompanionPanel.tsx | ~60 | ~15 |
| useTaskCompanion.ts | ~15 | ~5 |
| task-companion/route.ts | ~15 | ~5 |
| task-companion.ts (prompt) | ~60 | ~10 |
| **总计** | **~151** | **~35** |

预计总改动量 ~186 行，属于小 Phase。

---

## 十五、与 V2.7 的关系

### 15.1 V2.6 是 V2.7 的前置

V2.7（任务难度与数量动态调整）依赖 V2.6 建立的用户→AI 反馈通道：

| V2.7 需求 | 依赖 V2.6 的什么 |
|-----------|-----------------|
| 识别"用户多次卡住/太难/没时间" | userFeedback 文本语义分析 + 信号计数 |
| AI 建议降低任务量 | userFeedback 中的"太大了""做不动了"等语义 |
| "接受调整"按钮的上下文 | 基于 userFeedback 的 AI 理解 |
| 调整触发策略 | 按钮信号 + userFeedback 双通道信息 |

### 15.2 V2.6 不做但为 V2.7 预留

| # | V2.6 不做 | 为 V2.7 预留 |
|---|-----------|-------------|
| 1 | 不做任务数量调整 | `userFeedback` 字段已存在，V2.7 可基于此扩展 |
| 2 | 不新增"接受调整"按钮 | 按钮框架已存在，V2.7 可新增调整相关按钮 |
| 3 | 不修改任务列表 | 不改 task-execution，V2.7 再扩展 |
| 4 | 不新增任务状态字段 | V2.7 再设计 adjustment 字段 |
| 5 | 不统计反馈频率 | V2.7 可在 route 层加轻量计数器 |

### 15.3 概念边界

```
V2.6 建立通道：
  用户 → userFeedback → AI → 验收/推进

V2.7 利用通道：
  用户 → userFeedback(多次卡住) → AI → 调整建议 → 用户接受 → 调整任务
```

---

## 十六、与 V3.0A 的关系

### 16.1 V2.6 是新陪伴卡片形态的基础

V3.0A 做 App Shell + TodayView 重组时，陪伴卡片的形态应该基于 V2.6 的新设计（有输入框、无 encourage 按钮、有验收能力），而不是基于 V2.5.3 的旧设计（4 个固定按钮）。

### 16.2 当前 V3.0 架构需要修正

[Architecture-V3.0-Web-App-Separation.md](docs/Architecture-V3.0-Web-App-Separation.md) 中有 3 处需要修正的表述：

| 位置 | 当前表述 | 应修正为 |
|------|---------|---------|
| 第 13 节 "AI 陪伴面板结构" | "不出现通用输入框：使用固定反馈按钮（start / done / stuck / too_hard / encourage）" | "不出现全局自由聊天框；允许当前任务内受控短反馈输入框。使用反馈按钮 + 任务内受控反馈输入框。" |
| 第 4 节第 11 条 | "不做完整自由聊天系统" | "不做全局自由聊天系统；允许任务内受控短反馈输入框" |
| 第 17 节第 5 条 | "不新增自由输入框" | "不新增全局自由输入框；任务内反馈框需确保不变成聊天" |

### 16.3 V3.0A 不应把旧陪伴面板搬进 App Shell

V3.0A 做 UI 重组时，如果陪伴面板还是 V2.5.3 的旧形态（4 个固定按钮），那 App Shell 里装的就是过时体验。最理想的路径是：

```
V2.5.3 → V2.6 新陪伴卡片 → V3.0A App Shell 承载新卡片
```

如果 V3.0A 必须在 V2.6 之前做，至少要在 V3.0A 架构中为反馈输入框预留位置。

### 16.4 正确表述

> "不出现全局自由聊天框；允许当前任务内受控短反馈输入框。输入框只服务当前任务、当前步骤、当前草稿、当前卡点。不能变成通用聊天软件。"

---

## 十七、风险与缓解

### 17.1 P0 风险

| # | 风险 | 影响 | 缓解措施 |
|---|------|------|----------|
| **P0-1** | 输入框让产品变成普通聊天软件 | 产品定位崩塌 | 8 道防线：任务绑定 / 上下文限制 / 不存对话 / 安全红线 / 无全局入口 / 任务完成即结束 / 输入框定位是"反馈"不是"聊天" / UI 不是聊天界面 |
| **P0-2** | AI 根据用户草稿直接代写完整稿 | 用户失去自主判断，可能误用 AI 内容 | Prompt "用户反馈输入处理"分节明确"不能替用户填完整最终稿"；示例必须标注；V2.5.3 安全红线全部保留 |
| **P0-3** | AI 编造用户经历 | 用户在面试/求职中使用虚假信息 | Prompt 安全红线明确禁止；验收规则明确"不能为了让用户通过验收而编造经历" |
| **P0-4** | AI 自动判断完成并替用户完成 | Human-in-the-Loop 被破坏 | 代码层：checkbox 是唯一完成入口；Prompt 层：验收是建议不是命令；验收边界第 1 条明确禁止自动勾选 |
| **P0-5** | API 接收 userFeedback 后校验不足 | 超长文本、注入攻击、敏感信息泄露 | 前端 maxLength 300 + 后端 normalizeUserFeedback 截断 300 字；不做存储不记录日志；V2.5.3 安全红线适用 |

### 17.2 P1 风险

| # | 风险 | 影响 | 缓解措施 |
|---|------|------|----------|
| **P1-1** | 用户输入过长 | 增加 AI Token 消耗和响应延迟 | 前端 300 字限制 + 后端 300 字截断 |
| **P1-2** | AI 验收过严——永远"还差一点" | 用户永远无法完成，感到挫败 | Prompt "最低完成标准"原则；验收边界第 5 条明确禁止过高标准 |
| **P1-3** | AI 验收过松——什么都"可以过" | 验收失去意义，AI 变成"橡皮图章" | Prompt 验收规则给出明确的验收标准和示例 |
| **P1-4** | 删除 encourage 按钮后用户觉得少了支持 | 用户不习惯，感觉产品变冷 | 鼓励已内置到 stuck/too_hard/done/start + 用户反馈中；反馈框中的"写不出来"自然触发鼓励 |
| **P1-5** | 移动端输入体验差 | 键盘弹出遮挡输入框 | 执行方案重点：使用 scrollIntoView + 合理布局 + 2 行 textarea 不占过多空间 |
| **P1-6** | loading / 并发请求处理错误 | 重复请求或请求丢失 | 现有 inflightRef 机制已覆盖；loading 时 disabled 所有输入和按钮 |
| **P1-7** | stepHistory 混乱 | 用户反馈和 AI step 混淆 | stepHistory 只存 AI message，不存 userFeedback |

### 17.3 P2 风险

| # | 风险 | 影响 | 缓解措施 |
|---|------|------|----------|
| **P2-1** | 文案不够自然 | 用户不知道输入框可以做什么 | placeholder 明确："写下你现在做到哪了 / 卡在哪里 / 贴一小段草稿" |
| **P2-2** | 输入框位置需要 UI 微调 | 首版位置可能需要根据实际使用调整 | 架构方案给出推荐位置，执行方案允许微调 |
| **P2-3** | Enter / Shift+Enter 行为争议 | 用户习惯不同 | 默认 Enter 发送，Shift+Enter 换行；如争议大可加设置开关（P2 后置） |

---

## 十八、验收标准

### 18.1 功能验收

| # | 验收项 | 验证方式 |
|---|--------|----------|
| **F1** | "鼓励我一下"按钮从 UI 删除 | TaskCompanionPanel 中不再出现 encourage 按钮 |
| **F2** | TaskCompanionPanel 出现任务内反馈输入框 | 陪伴卡片中出现 textarea + "发送给 AI"按钮 |
| **F3** | 用户输入文本后可以发送给 AI | 输入文字 → 点击发送 → AI 返回回应 |
| **F4** | AI 回复能引用或理解用户反馈 | AI 回应中包含对用户输入内容的理解 |
| **F5** | 用户贴草稿，AI 能给质量判断和修改建议 | 输入草稿 → AI 说"基本可以过/还差一点/不算完成" + 具体建议 |
| **F6** | 用户问"这样算完成吗"，AI 能给验收判断 | 输入验收请求 → AI 给出四类验收结论之一 |
| **F7** | 用户说"只有 3 分钟"，AI 能降级任务 | 输入时间约束 → AI 给 3 分钟版本 |
| **F8** | 用户说"这个太大了"，AI 能给更小动作 | 输入难度反馈 → AI 降级为更小动作 |
| **F9** | AI 不自动勾选任务 | 任何情况下 checkbox 只由用户手动操作 |
| **F10** | AI 不跳到后续任务 | AI 回应不包含"你可以先做后面的" |
| **F11** | AI 不完整代写 | AI 不输出完整最终稿 |
| **F12** | AI 不编造经历 | AI 不说"你可以说你做过 XX" |
| **F13** | 原有 start / done / stuck / too_hard 仍正常 | 4 个按钮（去掉 encourage 后 3 个 + start 自动触发）功能正常 |
| **F14** | [DONE] 规则仍正常 | AI 在任务可收尾时输出 [DONE]，面板显示提示文字 |
| **F15** | 空输入不可发送 | 输入框为空时发送按钮 disabled |
| **F16** | loading 时输入和按钮 disabled | AI 请求进行中时所有交互 disabled |

### 18.2 技术验收

| # | 验收项 | 验证方式 |
|---|--------|----------|
| **T1** | 不改数据库 | `git diff` 无 schema/migration 变更 |
| **T2** | 不新增全局聊天 | 无新增聊天 Tab、无全局聊天按钮 |
| **T3** | 不新增对话存储 | 无新增 messages/conversation 表 |
| **T4** | 不破坏 V2.5.1 顺序执行 | locked 任务不可操作，current 任务正常 |
| **T5** | 不破坏 V2.5.2 序列上下文 | 第一步/中间步/最后一步 AI 仍有位置感知 |
| **T6** | 不破坏 V2.5.3 帮助边界 | AI 给材料不让用户去搜索；示例标注"这是示例" |
| **T7** | 不改 task-execution.ts | `git diff` 无该文件变更 |
| **T8** | 不改 task-companion-parser.ts | `git diff` 无该文件变更 |
| **T9** | `npm run lint` 通过 | 零 error |
| **T10** | `npm run build` 通过 | Compiled successfully |
| **T11** | `git status --short` 仅允许的 5 个文件 | 无意外修改，无新增文件 |

### 18.3 回归验收

| # | 验收项 | 验证方式 |
|---|--------|----------|
| **R1** | 任务生成正常 | 输入目标 → AI 生成任务列表 |
| **R2** | 任务勾选正常 | checkbox 勾选/取消正常 |
| **R3** | AI Assist 四种动作正常 | 怎么开始 / 拆小一点 / 5 分钟版本 / 我卡住了 |
| **R4** | 历史记录正常 | 历史面板可查看过往任务组 |
| **R5** | 统计正常 | 统计数据正确显示 |
| **R6** | AI 复盘正常 | 复盘 API 正常返回 |
| **R7** | Auth 正常 | 登录/登出/路由守卫正常 |

---

## 十九、不做范围

V2.6 明确不做：

| # | 不做 | 原因 |
|---|------|------|
| 1 | 不做全局聊天系统 | 产品定位：行动教练，不是聊天软件 |
| 2 | 不做长期记忆 | 任务完成后清空 |
| 3 | 不存储对话历史 | 不新增数据库表 |
| 4 | 不做消息气泡聊天 UI | 保持当前 AI 输出 + 输入框 + 按钮布局 |
| 5 | 不做任务难度/数量动态调整 | 属于 V2.7 |
| 6 | 不做"接受调整"按钮 | 属于 V2.7 |
| 7 | 不改任务列表状态 | 属于 V2.7 |
| 8 | 不新增任务字段 | 属于 V2.7 |
| 9 | 不改数据库 | 零 schema 变更 |
| 10 | 不自动勾选任务 | Human-in-the-Loop 不动摇 |
| 11 | 不跳过 locked 任务 | V2.5.1 规则 |
| 12 | 不做 V3.0 App Shell | 属于 V3.0A |
| 13 | 不改历史 / 统计 / 复盘功能 | 不属于陪伴链路 |
| 14 | 不做附件上传 | 不是产品方向 |
| 15 | 不做语音输入 | 不是当前产品方向 |
| 16 | 不改 task-assist.ts (prompt) | V2.5.3 已是稳定版 |
| 17 | 不改 task-assist-parser.ts | 不属于陪伴链路 |
| 18 | 不改 task-companion-parser.ts | 纯文本解析逻辑不变 |
| 19 | 不改 task-execution.ts | 任务状态逻辑不变 |
| 20 | 不改 ai-client.ts | AI 调用逻辑不变 |

---

## 二十、后续 Execution Plan 要点

### 20.1 执行方案必须包含

1. **精确到文件/行号的代码变更方案**
   - 每个修改文件的精确改动位置（基于本架构方案代码核验结果）
   - 每个函数的签名变更
   - 每个新增 state / props / 方法

2. **UI 组件完整代码变更**
   - TaskCompanionPanel 的完整 JSX 变更
   - 按钮布局调整方案
   - 键盘事件处理方案

3. **Prompt 升级完整文本**
   - "用户反馈输入处理"分节完整文本
   - "AI 验收规则"分节完整文本
   - 升级后的"用户反馈处理"分节完整文本
   - 新增的 `user_feedback` SIGNAL_PROMPT 完整文本

4. **验证方案**
   - 手动验证场景（至少 6 个：贴草稿 / 问验收 / 说卡住 / 说没时间 / 说太大 / 正常完成）
   - 回归验证清单
   - lint + build 命令

### 20.2 执行顺序建议

```
Phase A: types.ts 类型扩展
  └── CompanionUserSignal 新增 "user_feedback"

Phase B: Prompt 升级
  ├── COMPANION_SYSTEM_PROMPT 新增 2 个分节
  ├── "用户反馈处理"分节升级
  ├── SIGNAL_PROMPTS 新增 user_feedback
  ├── CompanionPromptInput 新增 userFeedback
  └── buildCompanionUserPrompt 新增反馈拼接

Phase C: API Route 扩展
  ├── VALID_USER_SIGNALS 新增 "user_feedback"
  ├── CompanionRequestBody 新增 userFeedback
  ├── 新增 normalizeUserFeedback
  └── buildCompanionUserPrompt 调用新增 userFeedback

Phase D: Hook 扩展
  ├── requestCompanion 新增 userFeedback 参数
  ├── 新增 sendFeedback 方法
  └── 返回类型扩展

Phase E: UI 组件升级
  ├── 删除 encourage 按钮
  ├── 新增反馈输入框
  ├── 调整 isDone 按钮逻辑
  ├── 新增 handleSendFeedback + 键盘处理
  └── 按钮布局调整

Phase F: 全量验证
  ├── lint + build
  ├── 手动功能验收
  └── 回归验收
```

### 20.3 给 ChatGPT 的建议审查点

1. 任务内受控反馈框的产品边界是否定义准确
2. "鼓励我一下"按钮删除后的体验是否有风险
3. AI 验收的四类结论和边界是否合理
4. 方案 B 的改动面是否可接受（5 个文件）
5. userFeedback 不存入 stepHistory 的策略是否合理
6. 与 V2.7 / V3.0A 的依赖关系是否清晰
7. Prompt 新增规则是否与 V2.5.3 安全红线有冲突
8. 是否有遗漏的风险或边界

---

> **文档结束**
>
> **下一文档**：本文档经 ChatGPT 审查通过后 → `docs/Execution-Plan-V2.6-Task-Feedback-Input.md`（V2.6 执行方案）
>
> **关联文档**：
> - [Roadmap-V2.6-to-V3.0A-AI-Execution-Loop.md](Roadmap-V2.6-to-V3.0A-AI-Execution-Loop.md) — V2.6→V3.0A 路线规划
> - [PRD-V2.0.md](PRD-V2.0.md) — V2.0 产品规划
> - [Project-State-Handoff.md](Project-State-Handoff.md) — 项目当前状态交接
> - [Architecture-V3.0-Web-App-Separation.md](Architecture-V3.0-Web-App-Separation.md) — V3.0 架构方案（待修订）
> - [archive/Architecture-V2.5.3-AI-Proactive-Help-Boundary.md](archive/Architecture-V2.5.3-AI-Proactive-Help-Boundary.md) — V2.5.3 架构（已关闭）
> - [archive/Execution-Plan-V2.5.3-AI-Proactive-Help-Boundary.md](archive/Execution-Plan-V2.5.3-AI-Proactive-Help-Boundary.md) — V2.5.3 执行方案（已关闭）
