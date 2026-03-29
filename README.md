# TRAE Agent Project

一个基于 MiniMax 的邮件 Agent 原型。

它现在有两条入口：

- 本地网页聊天界面
- Apple iMessage bridge，基于 [`@photon-ai/imessage-kit`](https://github.com/photon-hq/imessage-kit)

Agent 的核心模式不是“固定流程页面”，而是：

1. 用户提出要求
2. MiniMax 选择并调用邮件工具
3. 工具读取 / 搜索 / 发送 Gmail 邮件
4. Agent 汇总结果、起草回复，并在确认后发送

## 技术栈

- Frontend: Vite + React + TypeScript
- Backend: Express + TypeScript
- LLM: MiniMax Anthropic-compatible API
- Mail tools: Gmail API
- Message channel: iMessage via `@photon-ai/imessage-kit`

## 当前工具能力

当前 agent 使用的是 MCP-style 工具集：

- `search_emails`
- `read_email`
- `list_account_emails`
- `send_email`

MiniMax 会基于用户请求决定何时调用这些工具；发送邮件默认仍然走“先起草，再确认发送”的安全路径。

## 环境变量

复制 `.env.example` 为 `.env`。

### MiniMax

- `MINIMAX_API_KEY`
- `MINIMAX_API_BASE_URL`
- `MINIMAX_MODEL`

也支持 Anthropic 风格兼容变量：

- `ANTHROPIC_AUTH_TOKEN`
- `ANTHROPIC_BASE_URL`
- `ANTHROPIC_MODEL`

### Gmail

- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REDIRECT_URI`
- `SESSION_SECRET` 或 `JWT_SECRET`

### Agent Session

- `AGENT_SESSION_FILE`

这个文件用于把当前网页登录后的 Gmail 会话持久化给后台 agent 使用。iMessage watcher 不会带浏览器 cookie，所以这是必须的。

### iMessage Bridge

- `IMESSAGE_AGENT_ENABLED=true|false`
- `IMESSAGE_AGENT_DEBUG=true|false`
- `IMESSAGE_TRIGGER_PREFIX=@mail`
- `IMESSAGE_ALLOWED_SENDERS=foo@example.com,+1234567890`
- `IMESSAGE_POLL_INTERVAL_MS=2000`

## macOS 权限要求

`imessage-kit` 读取 `~/Library/Messages/chat.db`，所以你必须给运行这个项目的终端或 IDE 开启 **Full Disk Access**。

路径：

`System Settings -> Privacy & Security -> Full Disk Access`

把你实际运行 `npm run dev` 的应用加入进去，例如 Terminal、Warp、iTerm、Cursor 或 VS Code。

## 开发启动

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5173` 或 Vite 自动切换后的端口
- Backend health: `http://localhost:3001/api/health`

## 首次启用 iMessage Agent

1. 启动项目
2. 打开本地网页并连接 Gmail
3. 在网页顶部点击 `Activate For iMessage`
4. 确认 `.env` 中设置了 `IMESSAGE_AGENT_ENABLED=true`
5. 重启后端
6. 在 iMessage 中发送类似下面的消息：

```text
@mail 帮我查一下谁给我发了 team request，然后先起草一个回复
```

如果当前聊天里已经有待确认草稿，后续回复就不需要再加前缀。

## 相关接口

### Gmail / Agent

- `GET /api/auth/me`
- `GET /api/auth/agent-session`
- `POST /api/auth/agent-session/activate`
- `DELETE /api/auth/agent-session`
- `POST /api/agent/chat`

### iMessage Bridge

- `GET /api/imessage/status`

## 说明

- `imessage-kit` 能把 agent 接进系统 iMessage，但它本身不是 Apple 原生 iMessage App Extension。
- 这意味着它适合做“通过 iMessage 收发消息的 agent”，不适合直接在 Messages.app 里渲染截图里那种自定义 tool card UI。
- 当前仓库里的网页端承担的是 rich UI / 调试面板角色，iMessage 入口承担的是真实消息渠道角色。
