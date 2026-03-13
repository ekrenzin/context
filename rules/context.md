---
apply: conditional
when: Developing or debugging the Command Center (server, web UI, routes)
---

# Command Center Development

The Command Center is a Fastify + Vite + React app in `tools/command-center/`.
It has a backend server (TypeScript, port 19471) and a frontend (React + MUI).

## Running the Dev Server

The server must be running to test any backend or frontend changes. The AI
should **never start or restart the server directly** -- prompt the user.

### Start / restart commands

All commands run from `tools/command-center/`:

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start both server (tsx watch) and web (vite) with hot reload |
| `npm run dev:server` | Start only the backend with file-watch auto-restart |
| `npm run dev:web` | Start only the Vite frontend dev server |
| `npm run start:server` | Start backend without file watching |

### When to prompt for a restart

Prompt the user to restart the server when:

- A new route file is registered in `server/routes/index.ts`
- Auth middleware exemptions change (`server/auth/middleware.ts`)
- Server-side module imports change (new files, renamed exports)
- Database schema or migration changes
- The `package.json` scripts or dependencies change

The `dev:server` script uses `tsx watch`, which auto-restarts on file saves.
If the user is running `npm run dev`, most TypeScript changes take effect
automatically. However, **new file additions and import graph changes may
require a manual restart**.

### Quick restart one-liner

If the server is already running in a terminal, the user can:

```
# Kill whatever is on port 19471 and restart
lsof -ti :19471 | xargs kill -9 2>/dev/null; npm run dev
```

This is also what `npm run prestart` does (the kill part).

## Project structure

```
server/           -- Fastify backend
  ai/             -- AI provider clients (Anthropic, OpenAI, Ollama)
  auth/           -- Token auth middleware
  db/             -- SQLite database layer
  routes/         -- Route registration modules
  terminal/       -- Persistent terminal session management
web/              -- Vite + React frontend
  src/components/ -- Reusable UI components
  src/views/      -- Top-level page views
  src/lib/        -- API client, theme, utilities
```

## Key conventions

- Route modules export `registerXxxRoutes(app, ...)` and are wired in
  `server/routes/index.ts`.
- New routes that should be accessible without auth must be added to
  `EXEMPT_PREFIXES` in `server/auth/middleware.ts`.
- The frontend API client lives in `web/src/lib/api.ts` -- add endpoints there,
  not as raw `fetch()` calls in components.
- Settings are whitelist-gated: add new keys to `ALLOWED_KEYS` in
  `server/routes/settings.ts`.
