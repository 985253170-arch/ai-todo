# V2.6：任务内受控反馈框与 AI 验收机制 执行方案

> **状态**：执行方案阶段。**只写文档，不写代码。**
> **前置**：架构方案 [Architecture-V2.6-Task-Feedback-Input.md](Architecture-V2.6-Task-Feedback-Input.md) 经 ChatGPT 审查通过 ✅
> **定位**：Codex 实现 V2.6 的精确操作手册——改哪一行、加什么、删什么
> **设计日期**：2026-07-08
> **代码核验日期**：2026-07-08（基于当前 `main` 分支代码）
> **版本锁定**：遵守 [Upgrade-Lock-V2.6-to-V3.0A.md](Upgrade-Lock-V2.6-to-V3.0A.md) 第 4 节 V2.6 锁定范围

---

## 目录

- [1. 执行目标](#1-执行目标)
- [2. 当前代码核验结果](#2-当前代码核验结果)
- [3. 文件修改总览](#3-文件修改总览)
- [4. 逐文件执行方案](#4-逐文件执行方案)
  - [4A. src/lib/types.ts — 类型扩展](#4a-srclibtypests--类型扩展)
  - [4B. src/prompts/task-companion.ts — Prompt 升级](#4b-srcpromptstask-companionts--prompt-升级)
  - [4C. src/app/api/task-companion/route.ts — API Route 扩展](#4c-srcappapitask-companionroutets--api-route-扩展)
  - [4D. src/hooks/useTaskCompanion.ts — Hook 扩展](#4d-srchooksusetaskcompanionts--hook-扩展)
  - [4E. src/components/TaskCompanionPanel.tsx — UI 升级](#4e-srccomponentstaskcompanionpaneltsx--ui-升级)
- [5. 类型扩展方案](#5-类型扩展方案)
- [6. API 请求体扩展方案](#6-api-请求体扩展方案)
- [7. Hook 扩展方案](#7-hook-扩展方案)
- [8. UI 执行方案](#8-ui-执行方案)
- [9. Prompt 执行方案](#9-prompt-执行方案)
- [10. 安全边界与产品红线](#10-安全边界与产品红线)
- [11. 禁止修改范围](#11-禁止修改范围)
- [12. Codex 实现顺序](#12-codex-实现顺序)
- [13. 验证命令](#13-验证命令)
- [14. 手动验收场景](#14-手动验收场景)
- [15. 回归验收清单](#15-回归验收清单)
- [16. 风险与 Review 重点](#16-风险与-review-重点)

---

## 1. 执行目标

### 1.1 一句话目标

在 TaskCompanionPanel 内新增任务内受控反馈输入框（textarea，300 字上限），删除"鼓励我一下"独立按钮，新增 `"user_feedback"` signal 类型让 AI 能处理用户的自由文本反馈，新增 AI 验收规则让 AI 能判断当前小步质量。

### 1.2 必须达成的 7 项

| # | 目标 | 验收方式 |
|---|------|----------|
| 1 | "鼓励我一下"按钮从 UI 删除 | 视觉确认 TaskCompanionPanel 中不再有此按钮 |
| 2 | 新增任务内反馈输入框（textarea + 发送按钮） | 视觉确认输入框出现，可输入文字并发送 |
| 3 | AI 能理解用户自由文本反馈 | 输入"我写了一句话，你看看"→ AI 回应引用该内容 |
| 4 | AI 能给出验收判断（四类结论） | 输入"这样算完成吗"→ AI 给出验收结论 |
| 5 | AI 不能自动勾选任务 | 任何情况下 checkbox 仅用户手动操作 |
| 6 | 不改数据库 | `git diff` 零 schema/migration 变更 |
| 7 | 原有陪伴功能不受影响 | done/stuck/too_hard 按钮仍正常工作 |

### 1.3 改动范围

**仅 5 个文件**，预计新增 ~151 行，修改 ~35 行，总改动量 ~186 行。

---

## 2. 当前代码核验结果

> 以下核验基于 2026-07-08 的 `main` 分支代码。架构方案中的代码引用均经逐行核对。

### 2.1 types.ts（`src/lib/types.ts`）

| 项目 | 位置 | 当前内容 |
|------|------|----------|
| `CompanionUserSignal` | 第 255-260 行 | `"start" \| "done" \| "stuck" \| "too_hard" \| "encourage"` — 5 个值 |
| 相关响应类型 | 第 262-293 行 | `CompanionStatus`, `CompanionErrorCode`, `CompanionStep`, `CompanionSuccessResponse`, `CompanionErrorResponse`, `CompanionResponse` |

**核验结论**：架构方案中引用的类型定义位置准确。`CompanionUserSignal` 需新增 `"user_feedback"`。

### 2.2 TaskCompanionPanel.tsx（`src/components/TaskCompanionPanel.tsx`）

| 项目 | 位置 | 当前内容 |
|------|------|----------|
| `SIGNAL_BUTTONS` 数组 | 第 24-32 行 | 4 个按钮，含 `{ signal: "encourage", label: "鼓励我一下" }` |
| `visibleSignalButtons` | 第 65-71 行 | 当 `isDone` 时过滤为只保留 `encourage` |
| `handleSendSignal` | 第 114-117 行 | 只接受 `signal` 参数，无文本参数 |
| 按钮网格 | 第 194 行 | `grid grid-cols-2 gap-2` |
| `lastSignal` state | 第 59-61 行 | `Exclude<CompanionUserSignal, "start"> \| null` |

**核验结论**：架构方案中引用的代码位置（第 24-32 行、第 65-71 行、第 114-117 行）全部准确。需要删除 encourage 按钮、调整 isDone 按钮逻辑、新增反馈输入框。

### 2.3 useTaskCompanion.ts（`src/hooks/useTaskCompanion.ts`）

| 项目 | 位置 | 当前内容 |
|------|------|----------|
| `requestCompanion` 签名 | 第 84 行 | `async (userSignal: CompanionUserSignal)` — 仅 1 个参数 |
| 请求体 | 第 100-114 行 | 10 个字段，**没有 `userFeedback`** |
| `sendSignal` | 第 164-169 行 | `async (userSignal: Exclude<CompanionUserSignal, "start">)` — 仅限 sendSignal |
| `startCompanion` | 第 160-162 行 | `await requestCompanion("start")` |
| `inflightRef` 并发控制 | 第 70 行 | 已有 `useRef(false)` |
| stepHistory 更新 | 第 132-135 行 | 只追加 AI message，不追加用户文本 |
| 返回类型 | 第 29-39 行 | `UseTaskCompanionReturn` — 无 `sendFeedback` |

**核验结论**：需要 `requestCompanion` 新增可选 `userFeedback` 参数、新增 `sendFeedback` 方法、扩展返回类型。

### 2.4 task-companion/route.ts（`src/app/api/task-companion/route.ts`）

| 项目 | 位置 | 当前内容 |
|------|------|----------|
| `VALID_USER_SIGNALS` | 第 19-25 行 | 5 个信号，**没有 `"user_feedback"`** |
| `CompanionRequestBody` | 第 46-57 行 | 9 个字段，**没有 `userFeedback`** |
| `isCompanionUserSignal` | 第 86-91 行 | 验证逻辑 |
| `buildCompanionUserPrompt` 调用 | 第 212-225 行 | 6 个字段传入，**没有 `userFeedback`** |
| normalize 函数 | 第 127-178 行 | 现有 `normalizeStepHistory` 等，无 `normalizeUserFeedback` |

**核验结论**：需要新增 `"user_feedback"` 到有效信号集、新增 `userFeedback` 字段到请求体接口、新增 `normalizeUserFeedback` 函数、传递到 `buildCompanionUserPrompt`。

### 2.5 task-companion.ts Prompt（`src/prompts/task-companion.ts`）

| 项目 | 位置 | 当前内容 |
|------|------|----------|
| `COMPANION_SYSTEM_PROMPT` | 第 3-76 行 | 11 个分节：安全红线、帮助边界、不能替用户完成、高风险边界、输出规则、序列上下文、用户反馈处理、主动鼓励、收尾判断、输出风格 |
| `CompanionPromptInput` | 第 86-93 行 | 6 个字段，**没有 `userFeedback`** |
| `SIGNAL_PROMPTS` | 第 95-104 行 | 5 个信号，**没有 `user_feedback`** |
| `buildCompanionUserPrompt` | 第 133-162 行 | 支持 taskTitle, goal, currentStep, stepHistory, sequenceContext, userSignal |

**核验结论**：需要新增"用户反馈输入处理"和"AI 验收规则"两个分节、升级"用户反馈处理"分节、新增 `user_feedback` signal prompt、扩展 `CompanionPromptInput`、扩展 `buildCompanionUserPrompt`。

### 2.6 确认不需要修改的文件

| 文件 | 原因 |
|------|------|
| `src/lib/task-companion-parser.ts` | 纯文本解析：strip markdown + [DONE] 检测 + 截断 300 字。V2.6 不改变 AI 输出格式 |
| `src/lib/task-execution.ts` | 纯函数：getCurrentTaskIndex/getTaskExecutionStatus/hasIncompleteTasks。与陪伴反馈无关 |
| `src/lib/ai-client.ts` | AI 调用逻辑不变 |
| `src/components/TaskItem.tsx` | 容器组件——只负责传递 props 给 TaskCompanionPanel。V2.6 不改变 TaskCompanionPanel 的 props 接口 |
| `src/components/TaskList.tsx` | 列表渲染——不改变 |
| `src/components/TaskAssistPanel.tsx` | AI 辅助面板——V2.6 不改 |
| `src/prompts/task-assist.ts` | V2.5.3 已是稳定版——V2.6 不改 |
| 数据库 schema / migration | 零数据库变更——V2.6 不改 |

### 2.7 架构方案与真实代码一致性结论

**零不一致。** 架构方案（Architecture-V2.6-Task-Feedback-Input.md）中的代码引用（行号、结构、字段名）全部与当前 `main` 分支代码匹配。执行方案可直接基于架构方案的两层设计（方案 B：新增可选 `userFeedback` 字段 + `"user_feedback"` signal）落地。

---

## 3. 文件修改总览

| # | 文件 | 新增行 | 修改行 | 风险 |
|:--:|------|:--:|:--:|:--:|
| 1 | `src/lib/types.ts` | ~1 | 0 | 低 |
| 2 | `src/prompts/task-companion.ts` | ~60 | ~10 | 中 |
| 3 | `src/app/api/task-companion/route.ts` | ~15 | ~5 | 中 |
| 4 | `src/hooks/useTaskCompanion.ts` | ~15 | ~5 | 中 |
| 5 | `src/components/TaskCompanionPanel.tsx` | ~60 | ~15 | 中 |
| **合计** | | **~151** | **~35** | |

---

## 4. 逐文件执行方案

### 4A. `src/lib/types.ts` — 类型扩展

#### 4A.1 变更内容

**文件**：`src/lib/types.ts`
**改动量**：+1 行（新增 1 个 union 成员）

**当前代码**（第 255-260 行）：
```typescript
export type CompanionUserSignal =
  | "start"
  | "done"
  | "stuck"
  | "too_hard"
  | "encourage";
```

**目标代码**：
```typescript
export type CompanionUserSignal =
  | "start"
  | "done"
  | "stuck"
  | "too_hard"
  | "encourage"
  | "user_feedback";
```

#### 4A.2 变更说明

- **新增**：`"user_feedback"` — 表示用户通过反馈输入框发送了自由文本
- **保留**：`"encourage"` — 虽然 UI 层删除按钮，但类型保留以兼容 Prompt（用户可能在反馈框中输入"我需要鼓励"，AI 仍需响应鼓励逻辑）
- **不改**：`CompanionStatus`, `CompanionErrorCode`, `CompanionStep`, `CompanionSuccessResponse`, `CompanionErrorResponse`, `CompanionResponse`

#### 4A.3 Codex 操作指令

```
在 src/lib/types.ts 的 CompanionUserSignal 类型定义中：
- 在 "encourage" 后面新增一行：  | "user_feedback";
- 不要修改该类型的其他任何部分
- 不要修改文件中的其他任何类型
```

---

### 4B. `src/prompts/task-companion.ts` — Prompt 升级

#### 4B.1 变更内容

**文件**：`src/prompts/task-companion.ts`
**改动量**：~60 行新增，~10 行修改

#### 4B.2 变更 1：COMPANION_SYSTEM_PROMPT 新增分节

**操作**：在 `═══ 用户反馈处理 ═══` 分节之后（第 59 行之后）、`═══ 主动鼓励机制 ═══` 分节之前（第 60 行之前），插入两个新分节。

**注意**：现有 `COMPANION_SYSTEM_PROMPT` 是模板字符串常量（第 3 行 `` `你是 AI Todo...` ``）。新增分节直接插入到字符串内，保持反引号模板字符串格式。

**新增分节 1**：`═══ 用户反馈输入处理 ═══`

```
═══ 用户反馈输入处理 ═══
当用户通过反馈输入框发送自由文本（user_feedback 信号）时，你收到的是用户关于当前任务执行状态的自由文本。请按以下规则处理：

1. 先理解用户反馈的内容，判断它属于哪种类型：
   - 贴了草稿 → 先判断草稿质量，再给具体建议
   - 说卡住了 → 识别具体卡点，给出针对性帮助
   - 说没时间 → 给时间适配版本（如"3 分钟版本"）
   - 问"这样算完成吗" → 按 AI 验收规则给验收判断
   - 说太大了 → 降级为更小动作
   - 说进展 → 基于进展推下一步
   - 表达了情绪 → 简短承认（一句话），然后给行动导向的下一步

2. 回应结构：
   - 先理解用户反馈（一句话概括你理解的内容）
   - 给一句自然认可（行动导向，不空泛。例如"这个开头没问题"而不是"你真棒"）
   - 判断当前小步质量（如适用，按 AI 验收规则给出结论）
   - 说明还差什么（如适用，具体到"补一句 X"）
   - 给一个最小下一步动作（只一个，具体可执行）
   - 必要时给短示例（必须标注"这是示例，请替换成你自己的内容"）
   - 最后收束到当前任务内部，不跳到后续任务

3. 如果用户输入脱离当前任务（如"今天天气怎么样""讲个笑话"），礼貌拒绝并拉回任务：
   "这个我帮不了你。我们回到当前这一步——[拉回任务]。"
   不训斥用户，不展开解释"为什么不能"，只简短拒绝并拉回任务。

4. 如果用户要求你完成最终稿、编造经历、自动勾选任务等越界行为，按安全红线处理：
   - 简短拒绝（一句话）
   - 不展开解释
   - 拉回当前步骤
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
- 只能建议"可以勾选完成"，不能自动勾选。勾选永远是用户手动操作。
- 不能说"我已经帮你完成"。不能替用户做任何最终动作。
- 不能替用户填完整最终稿。可以说"补一句 X"，但不能写出那一句的完整内容（框架和示例除外，需标注）。
- 不能为了让用户通过验收而编造经历。不能说"你可以说你做过 XX"。
- 优先判断"最低完成标准"，不是追求完美。用户完成了核心要素就应该给"基本可以过"。
- 不要用过高标准反复卡住用户。如果用户已经做了合理的部分，就说"可以过了"。
```

#### 4B.3 变更 2：升级"用户反馈处理"分节

**当前代码**（第 53-58 行）：
```
═══ 用户反馈处理 ═══
- start：主动降低门槛...
- done：轻量认可完成...
- stuck：先承认...
- too_hard：主动承认难度...
- encourage：保持行动导向...
```

**操作**：在 `encourage` 条目之后新增 `user_feedback` 条目：

```
- user_feedback：用户通过反馈输入框发送了自由文本。先理解用户反馈内容，识别反馈类型（草稿/卡点/时间约束/验收请求/难度反馈/进展/情绪），按"用户反馈输入处理"分节的规则回应。优先基于用户反馈内容推进当前任务，不因为收到自由文本就跳到后续任务。
```

**注意**：这一行直接追加在现有 `encourage` 条目后。现有 5 个条目（start/done/stuck/too_hard/encourage）全部保留不变。

#### 4B.4 变更 3：SIGNAL_PROMPTS 新增

**当前代码**（第 95-104 行）：
```typescript
const SIGNAL_PROMPTS: Record<CompanionUserSignal, string> = {
  start: "用户刚开始做这个任务...",
  done: "用户完成了...",
  stuck: "用户在上一步卡住了...",
  too_hard: "用户觉得当前步骤太难了...",
  encourage: "用户需要鼓励...",
};
```

**操作**：在 `encourage` 条目之后新增：

```typescript
  user_feedback:
    "用户通过反馈输入框发送了自由文本。请先理解用户反馈内容，识别反馈类型（草稿/卡点/时间约束/验收请求/难度反馈/进展），按用户反馈输入处理规则回应。",
```

**注意**：`encourage` 条目保留不变（用户可能在反馈框中写"我需要鼓励"，AI 需要知道如何响应）。

#### 4B.5 变更 4：CompanionPromptInput 扩展

**当前代码**（第 86-93 行）：
```typescript
interface CompanionPromptInput {
  taskTitle: string;
  goal?: string;
  currentStep?: string;
  stepHistory?: string[];
  userSignal: CompanionUserSignal;
  sequenceContext?: CompanionSequenceContext;
}
```

**操作**：新增 `userFeedback` 可选字段：

```typescript
interface CompanionPromptInput {
  taskTitle: string;
  goal?: string;
  currentStep?: string;
  stepHistory?: string[];
  userSignal: CompanionUserSignal;
  sequenceContext?: CompanionSequenceContext;
  userFeedback?: string;
}
```

#### 4B.6 变更 5：buildCompanionUserPrompt 扩展

**当前代码**（第 133-162 行）：
```typescript
export function buildCompanionUserPrompt(input: CompanionPromptInput): string {
  const parts: string[] = [];
  // ...
  parts.push(SIGNAL_PROMPTS[input.userSignal]);
  return parts.join("\n");
}
```

**操作**：在 `parts.push(SIGNAL_PROMPTS[input.userSignal]);` 之前，插入用户反馈文本：

```typescript
  // 新增：拼接用户反馈文本（如果存在）
  if (input.userFeedback?.trim()) {
    parts.push(`用户反馈内容：${input.userFeedback.trim()}`);
  }

  parts.push(SIGNAL_PROMPTS[input.userSignal]);
```

**插入位置**：在 `parts.push(...buildSequenceContextLines(input.sequenceContext));` 之后、`parts.push(SIGNAL_PROMPTS[input.userSignal]);` 之前。

#### 4B.7 V2.5.3 安全红线保留确认

以下现有分节**完全不改动**：
- `═══ 安全红线（最高优先级，不可违反） ═══`（第 4-10 行）
- `═══ 帮助边界：可以直接给什么 ═══`（第 12-18 行）
- `═══ 不能替用户完成什么 ═══`（第 20-24 行）
- `═══ 高风险任务边界 ═══`（第 26-28 行）
- `═══ 输出规则 ═══`（第 30-36 行）
- `═══ 序列上下文使用规则 ═══`（第 38-51 行）
- `═══ 主动鼓励机制 ═══`（第 60-65 行）
- `═══ 收尾判断 ═══`（第 67-69 行）
- `═══ 输出风格 ═══`（第 71-75 行）

#### 4B.8 Codex 操作指令

```
在 src/prompts/task-companion.ts 中：

Step 1: 在 COMPANION_SYSTEM_PROMPT 模板字符串中，找到 "═══ 用户反馈处理 ═══" 分节末尾
        （即 encourage 条目最后一行之后），在其后插入两个新分节：
        "═══ 用户反馈输入处理 ═══" 和 "═══ AI 验收规则 ═══"。
        插入位置：在现有 "═══ 用户反馈处理 ═══" 分节之后、"═══ 主动鼓励机制 ═══" 分节之前。
        
        注意：在模板字符串内插入时，保持与其他分节一致的格式（空行 + ═══ 标题 ═══ + 内容）。

Step 2: 在现有 "用户反馈处理" 分节中，在 encourage 条目之后新增一行：
        "- user_feedback：用户通过反馈输入框发送了自由文本。先理解用户反馈内容..."

Step 3: 在 SIGNAL_PROMPTS 对象中，在 encourage 条目之后新增：
        user_feedback: "用户通过反馈输入框发送了自由文本..."

Step 4: 在 CompanionPromptInput 接口中，新增可选字段：
        userFeedback?: string;

Step 5: 在 buildCompanionUserPrompt 函数中，在 push(SIGNAL_PROMPTS[...]) 之前新增：
        if (input.userFeedback?.trim()) {
          parts.push(`用户反馈内容：${input.userFeedback.trim()}`);
        }

不要删除任何现有分节。不要修改 import 语句。
```

---

### 4C. `src/app/api/task-companion/route.ts` — API Route 扩展

#### 4C.1 变更内容

**文件**：`src/app/api/task-companion/route.ts`
**改动量**：~15 行新增，~5 行修改

#### 4C.2 变更 1：VALID_USER_SIGNALS 扩展

**当前代码**（第 19-25 行）：
```typescript
const VALID_USER_SIGNALS = new Set<CompanionUserSignal>([
  "start",
  "done",
  "stuck",
  "too_hard",
  "encourage",
]);
```

**操作**：新增 `"user_feedback"`：

```typescript
const VALID_USER_SIGNALS = new Set<CompanionUserSignal>([
  "start",
  "done",
  "stuck",
  "too_hard",
  "encourage",
  "user_feedback",
]);
```

#### 4C.3 变更 2：CompanionRequestBody 扩展

**当前代码**（第 46-57 行）：
```typescript
interface CompanionRequestBody {
  taskTitle?: unknown;
  goal?: unknown;
  currentStep?: unknown;
  stepHistory?: unknown;
  userSignal?: unknown;
  currentStepNumber?: unknown;
  totalSteps?: unknown;
  completedSteps?: unknown;
  previousTaskTitle?: unknown;
  nextTaskTitle?: unknown;
}
```

**操作**：新增 `userFeedback` 字段：

```typescript
interface CompanionRequestBody {
  taskTitle?: unknown;
  goal?: unknown;
  currentStep?: unknown;
  stepHistory?: unknown;
  userSignal?: unknown;
  userFeedback?: unknown;  // ← 新增
  currentStepNumber?: unknown;
  totalSteps?: unknown;
  completedSteps?: unknown;
  previousTaskTitle?: unknown;
  nextTaskTitle?: unknown;
}
```

#### 4C.4 变更 3：新增 normalizeUserFeedback 函数

**位置**：紧接 `normalizeSequenceContext` 函数之后（第 178 行之后），`export async function POST` 之前。

**代码**：

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

说明：
- 类型守卫：非 string → `undefined`（不影响现有调用）
- 截断：超过 300 字截断，与前端 `maxLength={300}` 双重保障
- 空串：trim 后为空 → `undefined`（不影响现有调用）
- 不存储、不记日志、不持久化

#### 4C.5 变更 4：buildCompanionUserPrompt 调用扩展

**当前代码**（第 212-225 行）：
```typescript
    const userPrompt = buildCompanionUserPrompt({
      currentStep:
        typeof body.currentStep === "string"
          ? body.currentStep.trim().slice(0, MAX_CURRENT_STEP_LENGTH)
          : undefined,
      goal:
        typeof body.goal === "string"
          ? body.goal.trim().slice(0, MAX_GOAL_LENGTH)
          : undefined,
      sequenceContext: normalizeSequenceContext(body),
      stepHistory: normalizeStepHistory(body.stepHistory),
      taskTitle: body.taskTitle.trim().slice(0, MAX_TASK_TITLE_LENGTH),
      userSignal: body.userSignal,
    });
```

**操作**：新增 `userFeedback` 行：

```typescript
    const userPrompt = buildCompanionUserPrompt({
      currentStep:
        typeof body.currentStep === "string"
          ? body.currentStep.trim().slice(0, MAX_CURRENT_STEP_LENGTH)
          : undefined,
      goal:
        typeof body.goal === "string"
          ? body.goal.trim().slice(0, MAX_GOAL_LENGTH)
          : undefined,
      sequenceContext: normalizeSequenceContext(body),
      stepHistory: normalizeStepHistory(body.stepHistory),
      taskTitle: body.taskTitle.trim().slice(0, MAX_TASK_TITLE_LENGTH),
      userFeedback: normalizeUserFeedback(body.userFeedback),  // ← 新增
      userSignal: body.userSignal,
    });
```

#### 4C.6 确认不需要修改的部分

| 项目 | 原因 |
|------|------|
| `POST` 函数整体结构 | 不变——认证→解析→验证→限流→调用→解析→返回 |
| `getAuthenticatedUserId()` | 不变 |
| `checkRateLimit` | 不变——10 次/分钟限流仍然有效 |
| `parseCompanionAIResponse` | 不变——AI 响应解析逻辑不变 |
| `callAIWithPlainText` | 不变——AI 调用参数不变 |
| `errorResponse` | 不变 |
| `normalizeStepHistory` | 不变——stepHistory 仍只存 AI message |
| `normalizeSequenceContext` | 不变 |
| `COMPANION_ERROR_MESSAGES` | 不变 |
| `INVALID_SIGNAL` 错误码 | 不变——新增 signal 后自动生效（通过 `VALID_USER_SIGNALS` Set） |

#### 4C.7 Codex 操作指令

```
在 src/app/api/task-companion/route.ts 中：

Step 1: 在 VALID_USER_SIGNALS 的 Set 中新增 "user_feedback"（在 "encourage" 之后）

Step 2: 在 CompanionRequestBody 接口中新增一行：
        userFeedback?: unknown;

Step 3: 在 MAX_STEP_HISTORY_ITEM_LENGTH 常量附近（第 32 行附近），新增常量：
        const MAX_USER_FEEDBACK_LENGTH = 300;

Step 4: 在 normalizeSequenceContext 函数之后，新增 normalizeUserFeedback 函数

Step 5: 在 buildCompanionUserPrompt 调用中，在 userSignal 之前新增：
        userFeedback: normalizeUserFeedback(body.userFeedback),

不要修改 POST 函数的整体结构。不要修改 import 语句。
```

---

### 4D. `src/hooks/useTaskCompanion.ts` — Hook 扩展

#### 4D.1 变更内容

**文件**：`src/hooks/useTaskCompanion.ts`
**改动量**：~15 行新增，~5 行修改

#### 4D.2 变更 1：requestCompanion 签名扩展

**当前代码**（第 83-84 行）：
```typescript
  const requestCompanion = useCallback(
    async (userSignal: CompanionUserSignal) => {
```

**操作**：新增可选 `userFeedback` 参数：

```typescript
  const requestCompanion = useCallback(
    async (userSignal: CompanionUserSignal, userFeedback?: string) => {
```

#### 4D.3 变更 2：请求体新增 userFeedback

**当前代码**（第 100-114 行）：
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
          }),
```

**操作**：新增 `userFeedback` 字段（截断 300 字）：

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
            userFeedback: userFeedback?.trim().slice(0, 300) || undefined,
            userSignal,
          }),
```

**注意**：空字符串或纯空格 → `undefined`（JSON.stringify 会省略 `undefined` 值，后端收到请求体时字段不存在，`normalizeUserFeedback` 返回 `undefined`，不影响现有调用）。

#### 4D.4 变更 3：新增 sendFeedback 方法

**位置**：在 `sendSignal` 函数之后（第 169 行之后）、`exitCompanion` 之前。

```typescript
  const sendFeedback = useCallback(
    async (feedbackText: string) => {
      await requestCompanion("user_feedback", feedbackText);
    },
    [requestCompanion],
  );
```

#### 4D.5 变更 4：sendSignal 类型更新

**当前代码**（第 36 行）：
```typescript
  sendSignal: (userSignal: Exclude<CompanionUserSignal, "start">) => Promise<void>;
```

**操作**：排除 `"user_feedback"`（因为用户通过 `sendFeedback` 发送文本，不通过 `sendSignal`）：

```typescript
  sendSignal: (userSignal: Exclude<CompanionUserSignal, "start" | "user_feedback">) => Promise<void>;
```

同理更新 `sendSignal` 实现（第 164-168 行）的类型注解：

```typescript
  const sendSignal = useCallback(
    async (userSignal: Exclude<CompanionUserSignal, "start" | "user_feedback">) => {
      await requestCompanion(userSignal);
    },
    [requestCompanion],
  );
```

#### 4D.6 变更 5：返回类型扩展

**当前代码**（第 29-39 行）：
```typescript
interface UseTaskCompanionReturn {
  status: TaskCompanionStatus;
  currentStep: CompanionStep | null;
  error: string | null;
  stepHistory: string[];
  activeSignal: CompanionUserSignal | null;
  startCompanion: () => Promise<void>;
  sendSignal: (userSignal: Exclude<CompanionUserSignal, "start">) => Promise<void>;
  exitCompanion: () => void;
  reset: () => void;
}
```

**操作**：新增 `sendFeedback` 方法：

```typescript
interface UseTaskCompanionReturn {
  status: TaskCompanionStatus;
  currentStep: CompanionStep | null;
  error: string | null;
  stepHistory: string[];
  activeSignal: CompanionUserSignal | null;
  startCompanion: () => Promise<void>;
  sendSignal: (userSignal: Exclude<CompanionUserSignal, "start" | "user_feedback">) => Promise<void>;
  sendFeedback: (feedbackText: string) => Promise<void>;
  exitCompanion: () => void;
  reset: () => void;
}
```

#### 4D.7 变更 6：return 对象新增

**当前代码**（第 175-185 行）：
```typescript
  return {
    activeSignal,
    currentStep,
    error,
    exitCompanion,
    reset,
    sendSignal,
    startCompanion,
    status,
    stepHistory,
  };
```

**操作**：新增 `sendFeedback`：

```typescript
  return {
    activeSignal,
    currentStep,
    error,
    exitCompanion,
    reset,
    sendFeedback,
    sendSignal,
    startCompanion,
    status,
    stepHistory,
  };
```

#### 4D.8 stepHistory 确认不改

**确认**：stepHistory 更新逻辑（第 132-135 行）**完全不变**。

```typescript
setStepHistory((currentHistory) =>
  keepRecentSteps([...currentHistory, companionResponse.data.message]),
);
```

用户反馈文本**不**存入 stepHistory。stepHistory 只存 AI 的 response message。这与架构方案第 10.2 节完全一致。

#### 4D.9 兼容性保证

| 调用场景 | 调用方式 | V2.6 行为 |
|---------|---------|----------|
| `startCompanion()` | `requestCompanion("start")` | 与现在完全相同——`userFeedback` 为 `undefined` |
| `sendSignal("done")` | `requestCompanion("done")` | 与现在完全相同——`userFeedback` 为 `undefined` |
| `sendSignal("stuck")` | `requestCompanion("stuck")` | 与现在完全相同 |
| `sendSignal("too_hard")` | `requestCompanion("too_hard")` | 与现在完全相同 |
| `sendFeedback("我写了一句话")` → 新增 | `requestCompanion("user_feedback", "我写了一句话")` | 新行为——userFeedback 不为 undefined |

#### 4D.10 Codex 操作指令

```
在 src/hooks/useTaskCompanion.ts 中：

Step 1: UseTaskCompanionReturn 接口：
        - sendSignal 类型更新为 Exclude<CompanionUserSignal, "start" | "user_feedback">
        - 新增 sendFeedback: (feedbackText: string) => Promise<void>;

Step 2: requestCompanion 签名新增可选参数：
        async (userSignal: CompanionUserSignal, userFeedback?: string)

Step 3: 请求体 JSON.stringify 中新增：
        userFeedback: userFeedback?.trim().slice(0, 300) || undefined,

Step 4: sendSignal 实现的类型注解更新：
        async (userSignal: Exclude<CompanionUserSignal, "start" | "user_feedback">)

Step 5: 新增 sendFeedback 方法（在 sendSignal 之后、exitCompanion 之前）

Step 6: return 对象中新增 sendFeedback

不要修改 import 语句。不要修改 requestIdRef/inflightRef 逻辑。
不要修改 stepHistory 更新逻辑（第 132-135 行）。
不要修改 reset/exitCompanion/startCompanion 函数。
```

---

### 4E. `src/components/TaskCompanionPanel.tsx` — UI 升级

#### 4E.1 变更内容

**文件**：`src/components/TaskCompanionPanel.tsx`
**改动量**：~60 行新增，~15 行修改/删除

#### 4E.2 变更 1：删除 encourage 按钮

**当前代码**（第 24-32 行）：
```typescript
const SIGNAL_BUTTONS: Array<{
  signal: Exclude<CompanionUserSignal, "start">;
  label: string;
}> = [
  { signal: "done", label: "我完成了" },
  { signal: "stuck", label: "我卡住了" },
  { signal: "too_hard", label: "太难了" },
  { signal: "encourage", label: "鼓励我一下" },
];
```

**操作**：删除 encourage 条目，更新类型排除 `"user_feedback"`：

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

#### 4E.3 变更 2：调整 isDone 状态下的按钮逻辑

**当前代码**（第 65-71 行）：
```typescript
  const visibleSignalButtons = useMemo(() => {
    if (!isDone) {
      return SIGNAL_BUTTONS;
    }

    return SIGNAL_BUTTONS.filter((button) => button.signal === "encourage");
  }, [isDone]);
```

**操作**：isDone 后不再显示快捷按钮（encourage 已不存在）：

```typescript
  const visibleSignalButtons = useMemo(() => {
    if (!isDone) {
      return SIGNAL_BUTTONS;
    }
    // isDone 后不显示快捷按钮——用户如需继续，通过反馈输入框
    return [];
  }, [isDone]);
```

#### 4E.4 变更 3：新增 feedbackText state

**操作**：在 `lastSignal` state 之后新增：

```typescript
  const [feedbackText, setFeedbackText] = useState("");
```

**插入位置**：第 61 行 `const [lastSignal, setLastSignal] = ...` 之后。

#### 4E.5 变更 4：获取 sendFeedback 方法

**当前代码**（第 43-56 行）：
```typescript
  const {
    activeSignal,
    currentStep,
    error,
    exitCompanion,
    sendSignal,
    startCompanion,
    status,
  } = useTaskCompanion({
```

**操作**：从 hook 返回值中新增提取 `sendFeedback`：

```typescript
  const {
    activeSignal,
    currentStep,
    error,
    exitCompanion,
    sendFeedback,
    sendSignal,
    startCompanion,
    status,
  } = useTaskCompanion({
```

#### 4E.6 变更 5：新增 handleSendFeedback 和键盘处理

**操作**：在 `handleSendSignal` 函数（第 114-117 行）之后新增：

```typescript
  const handleSendFeedback = () => {
    const trimmed = feedbackText.trim();
    if (!trimmed || isLoading) return;
    setLastSignal("user_feedback" as Exclude<CompanionUserSignal, "start">);
    sendFeedback(trimmed);
    setFeedbackText("");
  };

  const handleFeedbackKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendFeedback();
    }
  };
```

**注意**：`setLastSignal("user_feedback" as ...)` 使用了类型断言。`lastSignal` 的类型是 `Exclude<CompanionUserSignal, "start"> | null`。由于 `TSCcompanionPanel` 中的 `lastSignal` state 类型是 `Exclude<CompanionUserSignal, "start"> | null`，而 `"user_feedback"` 现在确实是 `CompanionUserSignal` 的有效值（排除 `"start"`）。

可选替代方案（更安全）：扩展 `lastSignal` 的类型：

```typescript
  const [lastSignal, setLastSignal] = useState<
    CompanionUserSignal | null
  >(null);
```

然后用：
```typescript
    setLastSignal("user_feedback");
```

**推荐使用扩展 `lastSignal` 类型的方案**，更安全无断言。

#### 4E.7 变更 6：新增反馈输入框 JSX

**插入位置**：在 `{isDone ? (...提示... ) : null}` 之后（第 188-192 行）、按钮网格 `<div className="mt-3 grid grid-cols-2 gap-2">` 之前（第 194 行）。

**代码**：

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
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {feedbackText.length}/300
          </span>
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

#### 4E.8 变更 7：handleSendSignal 类型更新

**当前代码**（第 114 行）：
```typescript
  const handleSendSignal = (signal: Exclude<CompanionUserSignal, "start">) => {
```

**操作**：更新为排除 `"user_feedback"`（因为用户通过 `sendFeedback` 发送文本，不走 `sendSignal`）：

```typescript
  const handleSendSignal = (signal: Exclude<CompanionUserSignal, "start" | "user_feedback">) => {
```

#### 4E.9 变更 8：lastSignal 类型扩展

**当前代码**（第 59-61 行）：
```typescript
  const [lastSignal, setLastSignal] = useState<
    Exclude<CompanionUserSignal, "start"> | null
  >(null);
```

**操作**：扩展为允许所有 `CompanionUserSignal`（包括 `"user_feedback"`）：

```typescript
  const [lastSignal, setLastSignal] = useState<
    CompanionUserSignal | null
  >(null);
```

#### 4E.10 按钮布局说明

删除 encourage 后，SIGNAL_BUTTONS 从 4 个减少为 3 个。加上"复制当前步骤"和"退出陪伴"，共 5 个按钮。当前 2 列网格布局（`grid grid-cols-2 gap-2`）可继续使用：

```
[我完成了]    [我卡住了]
[太难了]      [复制当前步骤]
[退出陪伴]
```

**注意**：`isDone` 时 `visibleSignalButtons` 返回 `[]`，但"复制当前步骤"和"退出陪伴"按钮不在 `visibleSignalButtons` 中——它们是直接渲染的独立按钮（第 208-221 行），在 `isDone` 时仍然显示。这是对架构方案 7.4 节的一个小差异的修正说明——架构方案提到 isDone 时输入框仍可用，快捷按钮隐藏，退出陪伴保留。执行方案确认：isDone 时复制和退出按钮仍显示。

#### 4E.11 Codex 操作指令

```
在 src/components/TaskCompanionPanel.tsx 中：

Step 1: 从 SIGNAL_BUTTONS 数组中删除 { signal: "encourage", label: "鼓励我一下" } 条目
        更新类型为 Exclude<CompanionUserSignal, "start" | "user_feedback">

Step 2: visibleSignalButtons useMemo：
        isDone 时返回 []（不再过滤 encourage）

Step 3: 新增 state：
        const [feedbackText, setFeedbackText] = useState("");

Step 4: 更新 lastSignal state 类型：
        CompanionUserSignal | null

Step 5: 从 useTaskCompanion() 解构中新增 sendFeedback

Step 6: 新增 handleSendFeedback 和 handleFeedbackKeyDown 函数

Step 7: 更新 handleSendSignal 类型签名，排除 "user_feedback"

Step 8: 在 DONE 提示之后、按钮网格之前，插入反馈输入框 JSX（textarea + 发送按钮 + 字数统计）

Step 9: 在按钮网格的 loading disabled 条件中，确认 isLoading 时所有交互 disabled
        （现有逻辑已包含，只需确认新增的 textarea 和发送按钮也受 isLoading 控制）

不要修改 import 语句。不要修改 handleCopy/handleExit/handleRetry。
不要修改 AI 消息区域的 JSX。不要修改 DONE 提示的 JSX。
```

---

## 5. 类型扩展方案

### 5.1 变更汇总

| 类型 | 文件 | 变更 |
|------|------|------|
| `CompanionUserSignal` | `types.ts` | 新增 `"user_feedback"` — 共 6 个值 |
| `CompanionPromptInput` | `task-companion.ts` (prompt) | 新增 `userFeedback?: string` |
| `CompanionRequestBody` | `task-companion/route.ts` | 新增 `userFeedback?: unknown` |
| `UseTaskCompanionReturn` | `useTaskCompanion.ts` | 新增 `sendFeedback` 方法；`sendSignal` 排除 `"user_feedback"` |
| `SIGNAL_BUTTONS` 类型 | `TaskCompanionPanel.tsx` | 排除 `"user_feedback"`（保留 `"start"` 排除） |

### 5.2 类型兼容性矩阵

| 调用方 | 传给 API 的 signal | V2.5 类型 | V2.6 类型 | 兼容？ |
|--------|-------------------|-----------|-----------|:--:|
| `startCompanion()` | `"start"` | ✅ | ✅ | ✅ |
| `sendSignal("done")` | `"done"` | ✅ | ✅ | ✅ |
| `sendSignal("stuck")` | `"stuck"` | ✅ | ✅ | ✅ |
| `sendSignal("too_hard")` | `"too_hard"` | ✅ | ✅ | ✅ |
| — (按钮已删除) | `"encourage"` | ✅ | ✅（保留类型） | — |
| `sendFeedback(text)` → 新增 | `"user_feedback"` | ❌ | ✅ | ✅ |

---

## 6. API 请求体扩展方案

### 6.1 请求体变更

**V2.5 请求体**（`useTaskCompanion.ts` 第 103-114 行）：
```json
{
  "completedSteps": 2,
  "currentStep": "不用去搜...",
  "currentStepNumber": 1,
  "goal": "准备面试",
  "nextTaskTitle": "复习 SQL",
  "previousTaskTitle": null,
  "stepHistory": ["第一步...", "第二步..."],
  "taskTitle": "准备常见面试问题",
  "totalSteps": 5,
  "userSignal": "done"
}
```

**V2.6 新增字段**（仅当 `userFeedback` 不为 undefined 时）：
```json
{
  "...以上字段保持不变...": "...",
  "userFeedback": "我写了一句话，你看看行不行"
}
```

### 6.2 后端处理链路

```
前端 sendFeedback("我写了一句话")
  ↓
useTaskCompanion.requestCompanion("user_feedback", "我写了一句话")
  ↓
POST /api/task-companion
  body: { ...所有现有字段..., userSignal: "user_feedback", userFeedback: "我写了一句话" }
  ↓
route.ts parseRequestBody → CompanionRequestBody
  ↓
normalizeUserFeedback(body.userFeedback) → "我写了一句话"
  ↓
buildCompanionUserPrompt({ ...现有字段..., userFeedback: "我写了一句话" })
  ↓
Prompt 拼接：
  用户的任务：准备常见面试问题
  用户的目标：准备面试
  ...
  用户反馈内容：我写了一句话，你看看行不行
  用户通过反馈输入框发送了自由文本...
  ↓
AI 回应（基于反馈内容）
```

### 6.3 错误处理

| 场景 | 行为 |
|------|------|
| `userFeedback` 不是 string | `normalizeUserFeedback` 返回 `undefined`，视为无反馈 |
| `userFeedback` 超过 300 字 | 前端 `maxLength` 阻止 + 后端 `.slice(0, 300)` 截断 |
| `userFeedback` 为空串 | `normalizeUserFeedback` 返回 `undefined` |
| `userSignal` 不是 `"user_feedback"` 但有 `userFeedback` | `userFeedback` 仍被传入 Prompt，AI 可忽略 |
| 并发请求 | `inflightRef` 阻止重复请求，UI disabled 所有交互 |

---

## 7. Hook 扩展方案

### 7.1 新增方法：sendFeedback

```typescript
const sendFeedback = useCallback(
  async (feedbackText: string) => {
    await requestCompanion("user_feedback", feedbackText);
  },
  [requestCompanion],
);
```

### 7.2 方法对比

| 方法 | V2.5 签名 | V2.6 签名 | 用途 |
|------|----------|----------|------|
| `startCompanion()` | `() => Promise<void>` | 不变 | 开始陪伴 |
| `sendSignal(signal)` | `(signal: Exclude<..., "start">) => ...` | `(signal: Exclude<..., "start" \| "user_feedback">) => ...` | 发送固定信号 |
| `sendFeedback(text)` | 不存在 | `(text: string) => Promise<void>` | **新增** 发送自由文本 |
| `exitCompanion()` | `() => void` | 不变 | 退出陪伴 |
| `reset()` | `() => void` | 不变 | 重置状态 |

### 7.3 加载状态

| 状态 | isLoading | UI 行为 |
|------|:--:|------|
| idle | false | 输入框可用，发送按钮可用 |
| loading（任意 signal） | true | 输入框 disabled，所有按钮 disabled |
| active | false | 全部可用 |
| done | false | 输入框可用，快捷按钮隐藏 |
| error | false | 全部可用（含重试） |

---

## 8. UI 执行方案

### 8.1 目标 UI 结构

```
┌─────────────────────────────────────────┐
│  AI 陪你做                        [退出] │
│  每次只推进一步，完成与否仍由你自己判断。  │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐│
│  │ AI 消息区域（白色圆角卡片）          ││
│  │ "不用去搜，我先给你 5 个..."        ││
│  └─────────────────────────────────────┘│
├─────────────────────────────────────────┤
│  [DONE] 提示（isDone 时显示）           │
│  "如果你觉得这条任务已经推进到位..."     │
├─────────────────────────────────────────┤
│  反馈输入框                             │
│  ┌─────────────────────────────────────┐│
│  │ 写下你现在做到哪了 / 卡在哪里 /     ││
│  │ 贴一小段草稿...                     ││
│  └─────────────────────────────────────┘│
│  0/300                        [发送给 AI]│
├─────────────────────────────────────────┤
│  [我完成了]    [我卡住了]               │
│  [太难了]      [复制当前步骤]           │
│  [退出陪伴]                             │
└─────────────────────────────────────────┘
```

### 8.2 按钮布局

3 个信号按钮 + 2 个工具按钮 × 2 列网格：

```
Row 1: [我完成了]      [我卡住了]
Row 2: [太难了]        [复制当前步骤]
Row 3: [退出陪伴]
```

"退出陪伴"独占一行（2 列网格中占满宽度）。如需更紧凑的 3 列布局，可改为：

```
Row 1: [我完成了] [我卡住了] [太难了]
Row 2: [复制当前步骤] [退出陪伴]
```

**推荐保持当前 2 列网格**（`grid grid-cols-2 gap-2`），不做布局重构，降低 CSS 意外影响的风险。

### 8.3 移动端适配

| 关注点 | 措施 |
|--------|------|
| 键盘弹出遮挡 | `rows={2}` 不占过多空间；iOS Safari `visualViewport` API 由浏览器自动处理 |
| 触控目标 | 发送按钮 `min-h-10` (40px)，有足够触控面积 |
| 输入框高度 | 2 行，不会在移动端占据过多空间 |
| 字数统计 | 显示 `N/300`，帮助用户控制输入长度 |

### 8.4 isDone 状态

| 元素 | isDone = false | isDone = true |
|------|:--:|:--:|
| AI 消息区域 | 显示 | 显示 |
| DONE 提示 (第 188-192 行) | 隐藏 | **显示** |
| 反馈输入框 | 显示 | **显示**（用户可能想反馈"还差一点"） |
| 快捷按钮 (第 195-207 行) | 显示 | **隐藏**（返回 `[]`） |
| 复制当前步骤 (第 208-213 行) | 显示 | **显示** |
| 退出陪伴 (第 214-220 行) | 显示 | **显示** |

---

## 9. Prompt 执行方案

### 9.1 Prompt 变更汇总

| 变更 | 内容 | 位置 |
|------|------|------|
| 新增分节 1 | `═══ 用户反馈输入处理 ═══` | 插入到"用户反馈处理"之后、"主动鼓励机制"之前 |
| 新增分节 2 | `═══ AI 验收规则 ═══` | 同上 |
| 升级 | "用户反馈处理"分节新增 `user_feedback` 条目 | 现有分节追加 1 行 |
| 新增 | `SIGNAL_PROMPTS` 新增 `user_feedback` 条目 | 现有 Record 追加 1 个 key |
| 扩展 | `CompanionPromptInput` 新增 `userFeedback?: string` | 接口新增 1 行 |
| 扩展 | `buildCompanionUserPrompt` 新增反馈文本拼接 | 函数新增 3 行 |

### 9.2 COMPANION_SYSTEM_PROMPT 分节顺序（V2.6 目标）

```
1. 安全红线（最高优先级，不可违反）        ← 不变
2. 帮助边界：可以直接给什么                  ← 不变
3. 不能替用户完成什么                        ← 不变
4. 高风险任务边界                            ← 不变
5. 输出规则                                  ← 不变
6. 序列上下文使用规则                        ← 不变
7. 用户反馈处理                              ← 升级：新增 user_feedback 条目
8. 用户反馈输入处理                          ← 🆕 新增分节
9. AI 验收规则                               ← 🆕 新增分节
10. 主动鼓励机制                             ← 不变
11. 收尾判断                                ← 不变
12. 输出风格                                ← 不变
```

### 9.3 V2.5.3 安全红线完整保留确认

V2.5.3 的全部安全红线（第 4-28 行的 5 个分节）**一字不改**：

- 安全红线 8 条 ✅
- 帮助边界 11 类材料 ✅
- 不能替用户完成 7 条 ✅
- 高风险任务边界 3 条 ✅
- 输出规则 6 条 ✅

V2.6 只新增 2 个分节 + 升级 1 个分节 + 新增 1 个 signal prompt，**不删除任何现有内容**。

---

## 10. 安全边界与产品红线

### 10.1 如何验证它不会变成聊天系统（8 道防线）

| # | 防线 | 执行方案如何保证 |
|---|------|-----------------|
| 1 | 任务绑定 | 输入框仅在 `TaskCompanionPanel` 内部，不创建独立页面或路由 |
| 2 | 上下文限制 | 只传最近 5 步 `stepHistory`（`keepRecentSteps` 不变），不扩上下文窗口 |
| 3 | 不存对话 | `userFeedback` 不存入数据库、不写入 stepHistory、不落 localStorage |
| 4 | 安全红线 | 所有 V2.5.3 安全红线在 Prompt 中逐字保留（见 9.3 节） |
| 5 | 无全局入口 | 不新增聊天 Tab、不新增聊天按钮、不新增路由 |
| 6 | 任务完成即结束 | `exitCompanion()` → `reset()` 清空所有 state（包括 feedbackText） |
| 7 | 输入框定位 | placeholder："写下你现在做到哪了 / 卡在哪里 / 贴一小段草稿"（不是"聊点什么"） |
| 8 | UI 不是聊天界面 | 不做气泡列表、不做对话滚动、只保留当前 AI 输出 |

### 10.2 如何验证 AI 不自动勾选任务（4 层保障）

| 层 | 保障 |
|----|------|
| UI 层 | checkbox 由用户手动点击，`TaskCompanionPanel` 没有 checkbox、没有 `onToggle` |
| Hook 层 | `onToggle` 仅在 `TaskItem` 的 checkbox `onChange` 中调用 |
| API 层 | `task-companion/route.ts` 只返回文本，不修改任务状态 |
| Prompt 层 | 安全红线第 3 条 + AI 验收规则明确禁止自动勾选 |

### 10.3 如何验证 AI 不完整代写（Prompt 层保障）

| 机制 | Prompt 中位置 |
|------|-------------|
| 不能输出完整最终稿 | 安全红线 → "不能替用户完成什么" 分节 |
| 框架/示例必须标注 | 帮助边界分节："示例必须标注'这是示例，请替换成你自己的内容'" |
| 验收规则禁止编造经历 | 新增 "AI 验收规则" 分节第 4 条 |
| 用户反馈处理禁止代写 | 新增 "用户反馈输入处理" 分节第 4 条 |

### 10.4 Human-in-the-Loop 保障

| 保障 | 实现 |
|------|------|
| 任务完成：用户手动勾选 checkbox | UI 层：`TaskItem.tsx` `onChange` → `onToggle` |
| AI 验收：AI 只能建议 | Prompt 层：验收规则第 1 条 |
| 完成动作唯一入口：checkbox | 代码层：无其他调用 `onToggle` 的路径 |

---

## 11. 禁止修改范围

> 以下每一条都是硬约束。Codex 实现时如遇到必须修改以下范围才能完成的情况，**先汇报给 Claude Code，不自行扩大修改范围。**

### 11.1 绝对不改

| # | 禁止修改 | 原因 |
|---|---------|------|
| 1 | 数据库 schema / migration | V2.6 零数据库变更 |
| 2 | `src/lib/task-execution.ts` | 任务状态逻辑不变 |
| 3 | `src/lib/task-companion-parser.ts` | 纯文本解析不变 |
| 4 | `src/lib/ai-client.ts` | AI 调用逻辑不变 |
| 5 | `src/prompts/task-assist.ts` | V2.5.3 已是稳定版 |
| 6 | `src/components/TaskItem.tsx` | 容器组件不变 |
| 7 | `src/components/TaskList.tsx` | 列表渲染不变 |
| 8 | `src/components/TaskAssistPanel.tsx` | AI 辅助面板不变 |
| 9 | `src/hooks/useTaskGroup.ts` | 核心任务状态不变 |
| 10 | `src/hooks/useTaskAssist.ts` | 辅助 hook 不变 |
| 11 | `package.json` / `package-lock.json` | 无新依赖 |
| 12 | `.env.local` / `next.config.ts` | 环境配置不变 |

### 11.2 绝对不做

| # | 不做 | 归属 |
|---|------|:--:|
| 1 | 不做全局聊天系统 | 永远不做 |
| 2 | 不做长期对话记忆 | 永远不做 |
| 3 | 不新增聊天 Tab | 永远不做 |
| 4 | 不做消息气泡聊天 UI | V2.6 不做 |
| 5 | 不新增数据库表/字段 | V2.6 不做 |
| 6 | 不存储对话历史 | V2.6 不做 |
| 7 | 不做"接受调整"按钮 | V2.7 |
| 8 | 不做任务数量/难度动态调整 | V2.7 |
| 9 | 不做任务标记（明日继续/降级版/暂缓） | V2.7 |
| 10 | 不做 App Shell / 底部导航 / TodayView | V3.0A |
| 11 | 不新增路由 | V2.6 不改路由 |
| 12 | 不自动勾选任务 | 永远不做 |

### 11.3 允许修改范围

**仅限以下 5 个文件：**

```
1. src/lib/types.ts                     ← CompanionUserSignal 新增 1 个值
2. src/prompts/task-companion.ts        ← Prompt 新增 2 个分节 + 1 个 signal
3. src/app/api/task-companion/route.ts  ← API 接收 userFeedback 字段
4. src/hooks/useTaskCompanion.ts        ← Hook 新增 sendFeedback 方法
5. src/components/TaskCompanionPanel.tsx ← UI 删除 encourage + 新增反馈输入框
```

---

## 12. Codex 实现顺序

> **严格按照以下顺序实施，每完成一个 Phase 后停止，等 Claude Code Review 确认后再继续。**

### Phase A：types.ts 类型扩展（预计 1 行，1 分钟）

```
文件：src/lib/types.ts
变更：CompanionUserSignal 新增 "user_feedback"
验证：TypeScript 编译无错误
```

### Phase B：Prompt 升级（预计 ~70 行，15 分钟）

```
文件：src/prompts/task-companion.ts
变更：
  1. COMPANION_SYSTEM_PROMPT 新增 2 个分节
  2. "用户反馈处理"分节新增 user_feedback 条目
  3. SIGNAL_PROMPTS 新增 user_feedback 条目
  4. CompanionPromptInput 新增 userFeedback 字段
  5. buildCompanionUserPrompt 新增反馈拼接
验证：TypeScript 编译无错误
```

### Phase C：API Route 扩展（预计 ~20 行，10 分钟）

```
文件：src/app/api/task-companion/route.ts
变更：
  1. VALID_USER_SIGNALS 新增 "user_feedback"
  2. CompanionRequestBody 新增 userFeedback 字段
  3. 新增 normalizeUserFeedback 函数
  4. buildCompanionUserPrompt 调用新增 userFeedback
验证：TypeScript 编译无错误；curl 测试现有接口仍正常
```

### Phase D：Hook 扩展（预计 ~20 行，10 分钟）

```
文件：src/hooks/useTaskCompanion.ts
变更：
  1. requestCompanion 新增可选 userFeedback 参数
  2. 请求体新增 userFeedback 字段
  3. 新增 sendFeedback 方法
  4. 返回类型新增 sendFeedback
  5. sendSignal 类型排除 "user_feedback"
验证：TypeScript 编译无错误
```

### Phase E：UI 组件升级（预计 ~75 行，20 分钟）

```
文件：src/components/TaskCompanionPanel.tsx
变更：
  1. SIGNAL_BUTTONS 删除 encourage
  2. visibleSignalButtons 调整 isDone 逻辑
  3. 新增 feedbackText state
  4. 更新 lastSignal 类型
  5. 获取 sendFeedback
  6. 新增 handleSendFeedback + 键盘处理
  7. 新增反馈输入框 JSX
  8. 更新 handleSendSignal 类型
验证：视觉确认 UI 变化
```

### Phase F：全量验证（预计 10 分钟）

```
命令：
  npm run lint
  npm run build
  git status --short

手动验收（见第 14 节）
回归验收（见第 15 节）
```

---

## 13. 验证命令

### 13.1 每次修改后

```bash
npm run lint    # 必须零 error
npm run build   # 必须 Compiled successfully
```

### 13.2 全量修改完成后

```bash
npm run lint
npm run build
git status --short
```

### 13.3 预期 git status 输出

```
M src/lib/types.ts
M src/prompts/task-companion.ts
M src/app/api/task-companion/route.ts
M src/hooks/useTaskCompanion.ts
M src/components/TaskCompanionPanel.tsx
```

**仅此 5 个文件，不应有任何其他文件变更。**

---

## 14. 手动验收场景

### 场景 1：贴草稿 → AI 判断质量（核心场景）

1. 打开 `/app`，输入目标，生成任务
2. 对"当前任务"点击"开始陪我做"
3. AI 给出第一步后，在反馈输入框输入一段草稿：`"我叫张三，在XX公司做了3年数据分析，主要负责用户增长和留存分析。"`
4. 点击"发送给 AI"
5. **期望**：AI 回应中包含对该草稿的评价（如"这个开头没问题"），并给出下一步建议
6. **不期望**：AI 只说"去搜索"或忽略草稿内容

### 场景 2：问"这样算完成吗" → AI 给验收判断

1. 在陪伴过程中，在反馈输入框输入：`"这样算完成吗？"`
2. 点击"发送给 AI"
3. **期望**：AI 给出四类验收结论之一（基本可以过 / 还差一点 / 不算完成 / 可以勾选完成）
4. **不期望**：AI 说"请去搜索"或自动勾选任务

### 场景 3：说卡住了 → AI 识别卡点

1. 在反馈输入框输入：`"我不知道怎么写项目结果"`
2. 点击"发送给 AI"
3. **期望**：AI 针对"项目结果"这个具体卡点给出帮助（如"结果可以从三个方向写..."）
4. **不期望**：AI 泛泛说"坚持下去"或建议跳过任务

### 场景 4：说只有 3 分钟 → AI 降级

1. 在反馈输入框输入：`"今天只有 3 分钟"`
2. 点击"发送给 AI"
3. **期望**：AI 给出 3 分钟版本（如"只做第一步：写一句话"）
4. **不期望**：AI 忽略时间约束或建议"那就别做了"

### 场景 5：说太大了 → AI 给更小动作

1. 在反馈输入框输入：`"这个任务太大了"`
2. 点击"发送给 AI"
3. **期望**：AI 将当前步骤降级为更小动作
4. **不期望**：AI 无动于衷或建议跳过

### 场景 6：正常完成按钮流程仍正常

1. 不使用反馈输入框
2. 仅通过"我完成了""我卡住了""太难了"三个按钮交互
3. **期望**：三个按钮均正常工作，与 V2.5.3 行为一致
4. **验证**：各信号按钮正常触发 AI 回应，[DONE] 标记正常

### 场景 7：空输入不可发送

1. 反馈输入框为空（或仅空格）
2. **期望**："发送给 AI"按钮 disabled，不可点击
3. **验证**：点击无反应

### 场景 8：loading 时所有交互 disabled

1. 点击"我完成了"触发 AI 请求
2. 在 AI 请求进行中，尝试点击其他按钮或输入文字
3. **期望**：所有按钮 disabled，输入框 disabled

### 场景 9：Enter 发送，Shift+Enter 换行

1. 在反馈输入框中输入多行文字（用 Shift+Enter 换行）
2. 按 Enter 发送
3. **期望**：Enter 发送消息，发送后输入框清空

### 场景 10：isDone 后输入框仍可用

1. 通过按钮交互直到 AI 返回 [DONE]
2. **期望**：快捷按钮隐藏，DONE 提示出现，反馈输入框仍可用
3. 在输入框中输入"这个还差一点"
4. **期望**：AI 回应验收相关

### 场景 11：脱离任务 → AI 拉回

1. 在反馈输入框输入：`"今天天气怎么样"`
2. **期望**：AI 礼貌拒绝并拉回任务（"这个我帮不了你。我们回到当前这一步..."）

### 场景 12：要求代写 → AI 拒绝

1. 在反馈输入框输入：`"帮我写完整个简历"`
2. **期望**：AI 拒绝，不输出完整最终稿

---

## 15. 回归验收清单

### 15.1 陪伴功能回归

| # | 验收项 | 预期 |
|---|--------|------|
| R1 | "开始陪我做"触发 startCompanion | 正常 |
| R2 | "我完成了"按钮 → AI 给下一步 | 正常 |
| R3 | "我卡住了"按钮 → AI 给帮助 | 正常 |
| R4 | "太难了"按钮 → AI 给降级 | 正常 |
| R5 | "鼓励我一下"按钮 | **不再出现** ✅ |
| R6 | [DONE] 标记 → 面板显示提示 | 正常 |
| R7 | "复制当前步骤" → 剪贴板 | 正常 |
| R8 | "退出陪伴" → 关闭面板 | 正常 |
| R9 | 重试按钮（error 状态） | 正常 |
| R10 | 序列上下文（第几步/共几步） | 正常 |
| R11 | locked 任务不能进入陪伴 | 正常 |
| R12 | 任务完成后陪伴面板关闭 | 正常 |

### 15.2 核心功能回归

| # | 验收项 | 预期 |
|---|--------|------|
| R13 | 任务生成（输入目标→AI 生成任务列表） | 正常 |
| R14 | 任务勾选/取消 | 正常 |
| R15 | 全部完成后 CompleteAllPrompt | 正常 |
| R16 | AI Assist 四种动作 | 正常 |
| R17 | 历史记录（HistoryPanel） | 正常 |
| R18 | 统计数据（StatsBar） | 正常 |
| R19 | AI 复盘（TaskReviewPanel） | 正常 |
| R20 | Auth 登录/登出/路由守卫 | 正常 |
| R21 | 未完成任务跨天继承 | 正常 |
| R22 | 顺序执行（locked/unlocked） | 正常 |

### 15.3 技术回归

| # | 验收项 | 预期 |
|---|--------|------|
| R23 | `npm run lint` | 零 error |
| R24 | `npm run build` | Compiled successfully |
| R25 | `git status --short` | 仅 5 个文件 |
| R26 | 无数据库变更 | `git diff` 无 schema/migration |
| R27 | 无新增依赖 | `git diff package.json` 无变更 |

---

## 16. 风险与 Review 重点

### 16.1 Claude Code Review 必查 10 项

| # | 检查项 | 重点 |
|---|--------|------|
| 1 | `types.ts` 改动 | 仅新增 1 个 union member，未改其他类型 |
| 2 | Prompt 完整性 | V2.5.3 安全红线 5 个分节一字未动 |
| 3 | `normalizeUserFeedback` | 类型守卫 + 截断 + 空串处理 |
| 4 | `requestCompanion` 向后兼容 | 原有 start/done/stuck/too_hard 调用不受影响 |
| 5 | `sendSignal` 类型 | 正确排除 `"user_feedback"` |
| 6 | `sendFeedback` 实现 | 调用 `requestCompanion("user_feedback", text)` |
| 7 | stepHistory 不变 | 仍只存 AI message |
| 8 | inflightRef 不变 | 并发控制逻辑未被修改 |
| 9 | TaskCompanionPanel encourage 按钮 | 已从 SIGNAL_BUTTONS 删除，JSX 中不再出现 |
| 10 | 反馈输入框 JSX | 在 isDone 提示和按钮网格之间，disabled 受 isLoading 控制 |

### 16.2 Codex 提交前自检

- [ ] `npm run lint` 零 error
- [ ] `npm run build` 成功
- [ ] `git status --short` 仅 5 个文件
- [ ] `git diff` 无 `.tsx` 以外的意外文件
- [ ] 未修改 `task-execution.ts`
- [ ] 未修改 `task-companion-parser.ts`
- [ ] 未修改 `ai-client.ts`
- [ ] 未修改 `package.json`
- [ ] 未新增任何文件
- [ ] 未删除任何文件

### 16.3 常见实现错误预警

| # | 错误 | 正确做法 |
|---|------|----------|
| 1 | 删除 `encourage` 从 `CompanionUserSignal` 类型中 | **保留** `encourage` 在类型中——Prompt 仍需要它 |
| 2 | `sendSignal` 允许 `"user_feedback"` | `sendSignal` 应排除 `"user_feedback"`——用户只能通过 `sendFeedback` 发送文本 |
| 3 | `userFeedback` 存入 stepHistory | stepHistory 只存 AI message，不存用户文本 |
| 4 | 忘记更新 `UseTaskCompanionReturn` 中的 `sendSignal` 类型 | 两处类型都要排除 `"user_feedback"`：接口定义 + 实现签名 |
| 5 | 忘记更新 `TaskCompanionPanel` 中的 `handleSendSignal` 类型 | 与 `sendSignal` 类型一致 |
| 6 | `userFeedback` 空字符串发送请求 | `userFeedback?.trim() || undefined` 确保空串不发送 |
| 7 | 错误修改 COMPANION_SYSTEM_PROMPT 中的旧分节 | 只新增，不删除、不修改旧分节 |
| 8 | 修改了 `task-companion-parser.ts` | V2.6 不改 parser——AI 输出格式不变 |

---

> **文档结束**
>
> **关联文档**：
> - [Architecture-V2.6-Task-Feedback-Input.md](Architecture-V2.6-Task-Feedback-Input.md) — V2.6 架构方案（本文档的上游）
> - [Upgrade-Lock-V2.6-to-V3.0A.md](Upgrade-Lock-V2.6-to-V3.0A.md) — 版本锁定关系（本文档必须遵守）
> - [Roadmap-V2.6-to-V3.0A-AI-Execution-Loop.md](Roadmap-V2.6-to-V3.0A-AI-Execution-Loop.md) — V2.6→V3.0A 路线规划
> - [Project-State-Handoff.md](Project-State-Handoff.md) — 项目当前状态交接
>
> **下一文档**：本文档经 ChatGPT 审查通过后 → Codex 按 Phase A→F 顺序实现代码
