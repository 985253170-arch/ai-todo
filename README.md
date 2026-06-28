# AI Todo

AI Todo 是一个 Next.js V1.0 小应用，用来把模糊目标拆成今天可以执行的任务。用户输入目标后，应用通过后端 API 调用 AI 生成 3 到 8 条任务，并支持任务勾选、进度展示和本地保存恢复。

## 技术栈

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- ESLint
- localStorage
- Vercel 部署

## V1.0 功能清单

- 首页目标输入和基础校验
- 高风险输入前端预检和后端兜底拦截
- AI 生成今日可执行任务
- AI 返回 JSON 解析和异常提示
- 任务列表展示
- 任务完成状态勾选和取消勾选
- 完成进度展示
- 当前任务组保存到 localStorage
- 刷新页面后恢复任务和完成状态
- localStorage 异常数据容错
- 加载状态、网络异常和解析失败提示

## 本地运行

安装依赖：

```bash
npm install
```

复制环境变量示例文件：

```powershell
Copy-Item .env.example .env.local
```

然后在 `.env.local` 中填写你自己的 API Key。不要提交 `.env.local`。

启动开发服务器：

```bash
npm run dev
```

浏览器打开：

```text
http://localhost:3000
```

## 环境变量

本地和 Vercel 线上环境都需要配置：

```bash
AI_API_KEY=your-api-key-here
AI_API_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
```

- `AI_API_KEY`：必填，AI 服务 API Key。
- `AI_API_BASE_URL`：可选，默认可使用 `https://api.openai.com/v1`。
- `AI_MODEL`：可选，默认可使用 `gpt-4o-mini`。

安全要求：

- 不要把真实 API Key 写入代码。
- 不要提交 `.env.local`。
- `.env.example` 只能保留示例值。
- 前端只调用本项目的 `/api/generate-tasks`，真实 API Key 只在服务端读取。

## 构建检查

提交或部署前建议执行：

```bash
npm run lint
npm run build
```

## GitHub 推送

如果还没有远程仓库，可以先在 GitHub 创建一个空仓库，然后执行：

```bash
git remote add origin https://github.com/<your-name>/ai-todo.git
git branch -M main
git push -u origin main
```

如果已经配置过 `origin`，只需要执行：

```bash
git push
```

## Vercel 部署

1. 登录 Vercel。
2. 选择从 GitHub 导入项目仓库。
3. Framework Preset 选择 Next.js。
4. Build Command 保持 `npm run build`。
5. 在 Environment Variables 中配置：
   - `AI_API_KEY`
   - `AI_API_BASE_URL`（可选）
   - `AI_MODEL`（可选）
6. 点击 Deploy。

## 线上验收

部署完成后，打开 Vercel 生成的线上地址，按下面流程验收：

1. 输入一个普通目标，例如“我要学习 Python”。
2. 点击“AI 拆分任务”。
3. 页面显示 3 到 8 条可执行任务。
4. 勾选任务后，完成进度实时变化。
5. 刷新页面后，任务列表和完成状态仍然恢复。
6. 输入高风险目标时，页面展示安全提示，不能生成任务。
7. 断网或 AI 服务异常时，页面展示对应错误提示且不崩溃。
8. 浏览器端不能看到真实 API Key。
