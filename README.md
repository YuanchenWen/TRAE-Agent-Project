# TRAE Agent Project

A Vite + React frontend with an Express + TypeScript backend for hackathon demos around email workflows and AI assistance.

## Current AI setup

The backend now targets MiniMax through its Anthropic-compatible API shape.

- Default model: `MiniMax-M2.7`
- Default base URL: `https://api.minimax.io/anthropic`
- Request path used by the server: `/v1/messages`
- Preferred env vars for this repo:
  - `MINIMAX_API_KEY`
  - `MINIMAX_API_BASE_URL`
  - `MINIMAX_MODEL`

The server also accepts Anthropic-style fallback env vars because MiniMax's official compatibility docs and coding-tool guides use them:

- `ANTHROPIC_AUTH_TOKEN`
- `ANTHROPIC_BASE_URL`
- `ANTHROPIC_MODEL`

## Environment

Create a local `.env` from `.env.example`.

## Development

```bash
npm install
npm run dev
```

Windows PowerShell note: if you hit the `npm.ps1 cannot be loaded` execution-policy error, use `npm.cmd install` and `npm.cmd run dev` instead, or run the same commands from Command Prompt.

Frontend: `http://localhost:5173`

Backend health check: `http://localhost:3001/api/health`

## AI endpoints

- `GET /api/ai/models`
- `POST /api/ai/summarize`
- `POST /api/ai/generate-reply`
- `POST /api/ai/analyze`

Example summarize request:

```bash
curl -X POST http://localhost:3001/api/ai/summarize \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Please summarize this message for me.",
    "options": {
      "format": "bullet",
      "maxLength": 120
    }
  }'
```

## Notes on MiniMax docs

- Official compatibility docs show Anthropic-style configuration against `https://api.minimax.io/anthropic`.
- Official release/news pages state `MiniMax-M2.7` is available on the API Platform.
- The public compatibility docs are still catching up in some places, so the model is configurable through env vars in case your account or region needs a fallback.
