# Codex 前端实现流程规范（AI Todo Mobile App）

> **文件定位**：手机 App 前端实现流程规范  
> **适用范围**：`apps/mobile-app/` 独立前端工程，以及后续合并回主项目路由前的所有前端 UI 实现  
> **强制原则**：Codex 不能直接看设计稿自由发挥；必须先有 UI 规格文档，再按执行方案写代码。  
> **协作角色**：用户 / ChatGPT / Claude Code / Codex  
> **创建目的**：防止设计稿到代码阶段失控、组件乱拆、数据写死、误接后端、出现双重界面。

---

## 1. 先说明当前流程的不足

原流程是：

```txt
.fig 原文件
↓
导出关键页面 PNG
↓
整理 UI-Spec-Mobile-App.md
↓
Codex 按 UI 规格文档 + PNG 参考图写前端
```

这个流程方向是对的，但还不够完整。

主要不足：

1. **不是全部由 Codex 完成**  
   Codex 只负责按文档写代码，不负责产品判断、设计稿理解、架构取舍和最终验收。

2. **Claude Code 不能可靠识别图片**  
   Claude Code 更适合扫描代码、写架构文档、写执行方案、做代码 Review。  
   它不应该被要求直接根据 PNG / Figma 图片判断页面结构、视觉层级和设计意图。

3. **Codex 也不能直接凭设计稿自由发挥**  
   Codex 可以参考 PNG，但不能跳过 UI 规格文档。  
   如果直接让 Codex 看图写前端，容易出现页面看起来像，但组件结构、状态逻辑、数据流全部混乱。

4. **用户必须参与设计确认**  
   图片转 UI 规格时，必须由用户确认：页面清单、按钮行为、跳转关系、文案、空状态、完成状态是否正确。

5. **ChatGPT 必须承担视觉理解和阶段把关**  
   ChatGPT 负责从图片中提取 UI 信息、判断产品结构、拆出页面规格，并给 Claude Code / Codex 分别写执行指令。

---

## 2. 正确协作分工

### 2.1 用户

用户负责提供和确认：

- `.fig` 原文件
- 关键页面 PNG
- 页面命名
- 页面优先级
- 文案是否满意
- 交互是否符合产品预期
- 最终视觉验收

用户不需要直接写代码。

---

### 2.2 ChatGPT

ChatGPT 负责：

- 识别 PNG 设计稿内容
- 提取页面结构
- 判断产品信息架构
- 整理 UI 规格文档初稿
- 判断哪些页面属于 MVP，哪些后置
- 给 Claude Code 写架构 / 文档整理 / Review 指令
- 给 Codex 写严格实现指令
- 阶段把关，决定是否进入下一步

ChatGPT 不直接写项目代码。

---

### 2.3 Claude Code

Claude Code 负责：

- 扫描项目文件
- 根据 ChatGPT / 用户确认后的 UI 规格，整理架构方案
- 整理 Codex 可执行的前端实现方案
- 做代码 Review
- 检查范围是否失控
- 检查是否误改后端 / API / Supabase / prompts
- 检查是否出现双重 App 壳
- 给出通过 / 不通过 / P0 / P1 / P2 问题

重要限制：

- Claude Code **不能作为图片识别来源**
- Claude Code **不能直接根据 PNG 推断完整 UI**
- Claude Code **不能替代用户确认设计**
- Claude Code **不能跳过 ChatGPT 审查直接让 Codex 写代码**

---

### 2.4 Codex

Codex 负责：

- 按 `Frontend-Execution-Plan.md` 写代码
- 按 `UI-Spec-Mobile-App.md` 还原页面
- 使用 mock data / mock service
- 创建 `apps/mobile-app/` 独立 Next.js 前端工程
- 跑 lint / build
- 汇报修改文件和验证结果

Codex 禁止：

- 禁止直接根据 `.fig` 自由发挥
- 禁止直接根据 PNG 自由发挥
- 禁止未读 UI Spec 就写代码
- 禁止改 `src/**`
- 禁止改 API Route
- 禁止改 Supabase
- 禁止改 AI prompts
- 禁止改数据库 schema / migration
- 禁止接真实后端
- 禁止使用 `git add .`
- 禁止处理未跟踪项：`.agents/`、`.claude/`、`.codex/`、`skills-lock.json`、`start`、`stop`

---

## 3. 强制流程总览

```txt
Step 0：用户提供设计资产
  ↓
Step 1：ChatGPT 读取 PNG，提取 UI 信息
  ↓
Step 2：ChatGPT 整理 UI-Spec-Mobile-App.md 初稿
  ↓
Step 3：用户确认 UI 规格
  ↓
Step 4：Claude Code 根据 UI Spec 整理前端架构和执行方案
  ↓
Step 5：ChatGPT 审查 Claude Code 文档
  ↓
Step 6：Codex 按 UI Spec + Execution Plan 写前端代码
  ↓
Step 7：Claude Code 做代码 Review
  ↓
Step 8：ChatGPT 做产品与范围把关
  ↓
Step 9：用户做视觉验收
  ↓
Step 10：通过后，再进入后端接入或主项目路由合并
```

---

## 4. 设计资产规范

### 4.1 必须保存的设计资产

建议放在：

```txt
apps/mobile-app/docs/designs/
```

推荐结构：

```txt
apps/mobile-app/docs/designs/
├─ AI-Todo-Mobile.fig
└─ screens/
   ├─ 01-login-otp.png
   ├─ 02-login-password.png
   ├─ 03-register.png
   ├─ 04-today-empty.png
   ├─ 05-today-active.png
   ├─ 06-task-execution.png
   ├─ 07-footprint-empty.png
   ├─ 08-footprint-history.png
   ├─ 09-growth.png
   └─ 10-me.png
```

### 4.2 `.fig` 文件用途

`.fig` 是设计源文件，用于：

- 设计存档
- 用户继续修改
- 后续人工打开 Figma 查看图层
- 作为设计版本依据

不建议：

- 不建议让 Codex 直接读取 `.fig` 写代码
- 不建议让 Claude Code 直接根据 `.fig` 判断 UI
- 不建议把 `.fig` 解压结果当作代码规格

### 4.3 PNG 文件用途

PNG 是视觉参考，用于：

- ChatGPT 识别页面结构
- Codex 对照视觉还原
- Claude Code Review 时检查页面范围
- 用户视觉验收

PNG 不是最终执行说明，必须转成 UI 规格文档。

---

## 5. UI-Spec-Mobile-App.md 必须包含

文件位置：

```txt
apps/mobile-app/docs/UI-Spec-Mobile-App.md
```

必须包含：

1. 页面清单
2. 每个页面对应设计图文件名
3. 页面目标
4. 页面模块结构
5. 文案清单
6. 按钮行为
7. 输入框行为
8. 页面跳转关系
9. 底部 Tab 规则
10. 空状态
11. 加载状态
12. 错误状态
13. 完成状态
14. mock 数据字段
15. 后续真实后端接入点
16. 不允许出现的设计偏差
17. 手动验收清单

---

## 6. UI Spec 生成责任

UI Spec 不能由 Codex 直接生成。

推荐责任链：

```txt
ChatGPT 根据 PNG 提取 UI Spec 初稿
↓
用户确认页面和文案
↓
Claude Code 根据确认后的 UI Spec 补充工程实现约束
↓
ChatGPT 审查
↓
Codex 执行
```

如果 UI Spec 中存在不确定项，必须先问用户，不允许 Codex 自行决定。

---

## 7. Codex 执行前置条件

Codex 开始写前端代码前，必须同时满足：

- [ ] `.fig` 原文件已保存或确认不需要保存
- [ ] 关键页面 PNG 已导出并保存
- [ ] `UI-Spec-Mobile-App.md` 已完成
- [ ] `Frontend-Architecture.md` 已完成
- [ ] `Frontend-Execution-Plan.md` 已完成
- [ ] ChatGPT 已审查通过
- [ ] 用户已确认页面清单和关键文案
- [ ] 明确本阶段只做前端 mock，不接真实后端
- [ ] 明确禁止修改 `src/**`

任何一项不满足，Codex 不得开始写代码。

---

## 8. Codex 实现时必须遵守

Codex 实现前端时必须：

1. 只在 `apps/mobile-app/` 下创建和修改文件
2. 使用 Next.js
3. 使用 TypeScript
4. 使用 Tailwind
5. 使用 mock data
6. 使用 mock service
7. 页面组件不能直接 import mockData
8. 页面组件通过 service 层取数据
9. 底部 Tab 固定
10. 不出现双重 App 壳
11. 不把旧 `/app` 页面简单套壳
12. 不接真实 Supabase
13. 不接真实 AI API
14. 不改主项目 `src/**`
15. 不改根 `package.json`
16. 完成后运行 `npm run lint`
17. 完成后运行 `npm run build`
18. 汇报所有新增 / 修改文件

---

## 9. Claude Code Review 必查项

Claude Code Review 时必须检查：

### P0 必查

- 是否修改了 `src/**`
- 是否修改了 API Route
- 是否修改了 Supabase / Auth / AI prompts
- 是否创建了真实后端连接
- 是否跳过 mock service 直接写死数据
- 是否组件直接 import `mockData`
- 是否出现双重 App Shell
- 是否把旧 `/app` 页面套进新壳
- 是否底部 Tab 与设计稿不一致
- 是否没有运行 lint / build

### P1 必查

- 页面是否符合 UI Spec
- 四个 Tab 是否完整
- 登录 / 注册 / 今日 / 足迹 / 成长 / 我的是否都有对应页面
- 任务执行页是否存在
- 空状态是否存在
- mock service 接口是否方便后续替换真实 API
- 组件拆分是否清晰

### P2 建议

- 动画是否可以后置
- 图标是否可替换
- 卡片细节是否需要二次打磨
- 视觉还原是否需要人工微调

---

## 10. ChatGPT 阶段把关标准

ChatGPT 每个阶段必须判断：

1. 当前阶段是否应该继续
2. 是否有越界风险
3. 是否需要用户确认
4. 是否应该交给 Claude Code
5. 是否应该交给 Codex
6. 是否需要先补文档
7. 是否需要回滚或返工
8. 是否可以进入下一阶段

ChatGPT 不能只给“可以”，必须说明：

```txt
当前判断：
是否通过：
下一步给谁：
禁止事项：
验收标准：
```

---

## 11. 用户确认节点

以下节点必须由用户确认：

1. 页面清单确认
2. 页面命名确认
3. 底部 Tab 文案确认
4. 登录 / 注册流程确认
5. 今日页核心结构确认
6. 任务执行页交互确认
7. 足迹 / 成长 / 我的页面内容确认
8. UI Spec 最终确认
9. Codex 实现后的视觉验收
10. 是否进入后端接入

用户未确认前，不进入下一阶段。

---

## 12. 不允许跳过的关卡

```txt
设计稿
↓
ChatGPT 视觉理解
↓
UI Spec
↓
用户确认
↓
Claude Code 执行方案
↓
ChatGPT 审查
↓
Codex 写代码
↓
Claude Code Review
↓
ChatGPT 把关
↓
用户验收
```

任何人不得跳过：

- UI Spec
- 用户确认
- ChatGPT 审查
- Claude Code Review
- lint / build
- 用户视觉验收

---

## 13. 后续接后端的流程

前端 mock 通过后，才允许进入后端接入。

后端接入流程另开文档，不在本文件中执行。

接后端前必须先完成：

- `Frontend-Backend-Integration-Plan.md`
- API 对照表
- mock service 到真实 service 的替换方案
- Auth 接入方案
- 数据同步方案
- 回归测试清单

Codex 不得在前端 mock 阶段提前接后端。

---

## 14. 标准结论

本流程长期锁定为：

```txt
.fig 原文件
↓
导出关键页面 PNG
↓
ChatGPT 读取图片并整理 UI Spec
↓
用户确认 UI Spec
↓
Claude Code 写前端架构 / 执行方案
↓
ChatGPT 审查
↓
Codex 按 UI Spec + PNG + 执行方案写前端
↓
Claude Code Review
↓
ChatGPT 产品把关
↓
用户视觉验收
```

一句话：

**Codex 只在规格明确后写代码；Claude Code 不负责识别图片；ChatGPT 负责视觉理解和阶段把关；用户负责最终确认。**
