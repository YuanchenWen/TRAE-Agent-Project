# TRAE Agent Project

A mail agent prototype built on top of MiniMax.

It currently has two entry points:

- A local web chat interface
- An Apple iMessage bridge powered by [`@photon-ai/imessage-kit`](https://github.com/photon-hq/imessage-kit)

The core interaction model is not a "fixed workflow page," but rather:

1. The user makes a request
2. MiniMax chooses and calls the appropriate mail tools
3. The tools read / search / send Gmail messages
4. The agent summarizes the results, drafts a reply, and sends it after confirmation

## Tech Stack

- Frontend: Vite + React + TypeScript
- Backend: Express + TypeScript
- LLM: MiniMax Anthropic-compatible API
- Mail tools: Gmail API
- Message channel: iMessage via `@photon-ai/imessage-kit`

## Current Tooling Capabilities

The current agent uses an MCP-style toolset:

- `search_emails`
- `read_email`
- `list_account_emails`
- `send_email`

MiniMax decides when to call these tools based on the user's request. Sending email still follows the safer "draft first, confirm before sending" path by default.

## Environment Variables

Copy `.env.example` to `.env`.

### MiniMax

- `MINIMAX_API_KEY`
- `MINIMAX_API_BASE_URL`
- `MINIMAX_MODEL`

Anthropic-style compatibility variables are also supported:

- `ANTHROPIC_AUTH_TOKEN`
- `ANTHROPIC_BASE_URL`
- `ANTHROPIC_MODEL`

### Gmail

- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REDIRECT_URI`
- `SESSION_SECRET` or `JWT_SECRET`

### Agent Session

- `AGENT_SESSION_FILE`

This file persists the Gmail session from the current web login so the backend agent can use it. The iMessage watcher does not carry browser cookies, so this is required.

### iMessage Bridge

- `IMESSAGE_AGENT_ENABLED=true|false`
- `IMESSAGE_AGENT_DEBUG=true|false`
- `IMESSAGE_TRIGGER_PREFIX=@mail`
- `IMESSAGE_ALLOWED_SENDERS=foo@example.com,+1234567890`
- `IMESSAGE_POLL_INTERVAL_MS=2000`

## macOS Permission Requirements

`imessage-kit` reads `~/Library/Messages/chat.db`, so you must grant **Full Disk Access** to the terminal or IDE running this project.

Path:

`System Settings -> Privacy & Security -> Full Disk Access`

Add the application you actually use to run `npm run dev`, such as Terminal, Warp, iTerm, Cursor, or VS Code.

## Development

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5173` or whatever port Vite switches to automatically
- Backend health: `http://localhost:3001/api/health`

## Enabling the iMessage Agent for the First Time

1. Start the project
2. Open the local web app and connect Gmail
3. Click `Activate For iMessage` at the top of the page
4. Make sure `.env` contains `IMESSAGE_AGENT_ENABLED=true`
5. Restart the backend
6. Send a message in iMessage like this:

```text
@mail Help me check who sent me a team request, then draft a reply first
```

If there is already a pending draft in the current chat, you do not need to add the prefix again in follow-up replies.

## Related Endpoints

### Gmail / Agent

- `GET /api/auth/me`
- `GET /api/auth/agent-session`
- `POST /api/auth/agent-session/activate`
- `DELETE /api/auth/agent-session`
- `POST /api/agent/chat`

### iMessage Bridge

- `GET /api/imessage/status`

## Notes

- `imessage-kit` can connect the agent to the system iMessage channel, but it is not an Apple-native iMessage App Extension.
- That means it works well for an agent that sends and receives messages through iMessage, but it is not suitable for rendering the kind of custom tool card UI shown in screenshots directly inside Messages.app.
- In this repository, the web app serves as the rich UI / debugging panel, while the iMessage entry point serves as the real message channel.
