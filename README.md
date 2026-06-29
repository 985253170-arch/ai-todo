# AI Todo

Phase 10 completed: Supabase cloud backup and restore

AI Todo 是一个 Next.js 应用，用来把模糊目标拆成今天可以执行的小任务。当前版本支持 AI 生成任务、任务勾选、本地保存恢复，并通过 Supabase API 为当前设备提供云端备份/恢复能力。

## 技术栈

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Supabase
- ESLint
- Vercel

## 本地运行

```bash
npm install
```

复制环境变量示例：

```powershell
Copy-Item .env.example .env.local
```

然后在 `.env.local` 中填写你自己的 Key。不要提交 `.env.local`。

```bash
npm run dev
```

打开：

```text
http://localhost:3000
```

## 环境变量

AI 生成任务：

```bash
AI_API_KEY=your-api-key-here
AI_API_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
```

Supabase 云端保存 API：

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

说明：

- `AI_API_KEY`：服务端调用 AI 使用。
- `AI_API_BASE_URL`：可选，默认可使用 OpenAI 兼容地址。
- `AI_MODEL`：可选，默认可使用 `gpt-4o-mini`。
- `SUPABASE_URL`：Supabase 项目地址。
- `SUPABASE_SERVICE_ROLE_KEY`：Supabase 服务端密钥，仅允许服务端 API Route 使用。

安全要求：

- 不要把真实 API Key 或 Supabase service role key 写入代码。
- 不要提交 `.env.local`。
- `.env.example` 只能保留占位符。
- 浏览器端代码不要直接 import 或调用 Supabase service role key。

## Phase 10 云端备份

localStorage 仍然是主存储，Supabase 只作为当前设备的云端备份。

Phase 10C 前端行为：

- 页面初始化时优先读取 localStorage。
- 如果 localStorage 有任务组，不请求云端覆盖本地数据。
- 如果 localStorage 没有任务组，会用 `ai_todo_device_id` 调用云端读取接口。
- AI 生成、任务勾选、重新生成成功后，先写 localStorage，再异步备份到云端。
- 清空任务和开始新一天时，先清空本地，再异步删除云端数据。
- 云端失败不会影响本地生成、勾选、刷新恢复等核心流程。

## Phase 10B 云端 API

Phase 10B 只提供后端 API 能力，尚未接入前端 `useTaskGroup`。

### 保存当前任务组

```http
POST /api/task-group/save
```

请求体：

```json
{
  "deviceId": "device-id",
  "taskGroup": {
    "id": "task-group-id",
    "goal": "我要学习 Python",
    "tasks": [],
    "createdAt": "2026-06-29T00:00:00.000Z",
    "updatedAt": "2026-06-29T00:00:00.000Z"
  }
}
```

保存逻辑采用非事务 replace 策略：upsert `task_groups`，删除旧 `tasks`，再插入新 `tasks`。

### 读取当前任务组

```http
GET /api/task-group/load?deviceId=device-id
```

无数据时返回：

```json
{ "success": true, "data": null }
```

### 删除当前任务组

```http
POST /api/task-group/delete
```

请求体：

```json
{ "deviceId": "device-id" }
```

删除 `task_groups`，关联 `tasks` 依赖数据库 `ON DELETE CASCADE` 清理。

## 构建检查

```bash
npm run lint
npm run build
```

## 部署提醒

Vercel 需要配置：

- `AI_API_KEY`
- `AI_API_BASE_URL`（可选）
- `AI_MODEL`（可选）
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
