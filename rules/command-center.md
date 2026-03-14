---
apply: conditional
when: Developing or debugging the Command Center (UI, pages, components, engine SDK)
---

# Command Center Development

The Command Center UI is a standalone repo (`context-ui`) cloned into
`repos/context-ui/`. It is a Vite + React + MUI application that communicates
with the engine through REST API and MQTT.

The engine backend (Fastify server, SQLite, AI, profiler) lives in
`tools/command-center/server/`. The engine serves the UI from the workspace
directory specified by `uiSource` in `workspace.yaml`.

## Running

The engine server must be running for the UI to work. The AI should **never
start or restart the server directly** -- prompt the user.

### Engine (backend)

Commands run from `tools/command-center/`:

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start server (tsx watch) with hot reload |
| `npm run dev:server` | Start only the backend with file-watch auto-restart |
| `npm run start:server` | Start backend without file watching |

### UI (frontend)

Commands run from `repos/context-ui/`:

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start Vite dev server with hot reload |
| `npm run build` | Production build to `dist/` |

### When to prompt for a restart

Prompt the user to restart the engine when:

- A new route file is registered in `server/routes/index.ts`
- Auth middleware exemptions change
- Database schema or migration changes
- The engine `package.json` changes

The UI hot-reloads automatically via Vite -- no restart needed for frontend
changes.

## Architecture

```
Engine (tools/command-center/server/)    UI (repos/context-ui/)
  routes/          REST API        -->     lib/engine-sdk/client.ts
  MQTT broker      WebSocket       -->     lib/engine-sdk/mqtt.ts
  db/              SQLite                  pages/
  ai/              AI providers            components/
  auth/            Token auth              theme/
```

## Key conventions

- Route modules export `registerXxxRoutes(app, ...)` and are wired in
  `server/routes/index.ts`.
- The UI API client lives in `repos/context-ui/src/lib/engine-sdk/` -- add
  types and client methods there, not as raw `fetch()` calls in components.
- The UI repo has its own `CLAUDE.md` with full API documentation.
- Settings are whitelist-gated: add new keys to `ALLOWED_KEYS` in
  `server/routes/settings.ts`.
