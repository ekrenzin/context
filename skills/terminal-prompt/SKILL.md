---
name: terminal-prompt
description: Prompt the user to complete an interactive terminal command (e.g. npx wrangler login, claude login) via a FAB + modal with an embedded terminal. Use when a feature requires the user to execute a shell command that the app cannot run on their behalf -- authentication flows, CLI logins, system installs, or any interactive terminal operation.
related_skills:
  - frontend-patterns
  - deploy-site
---

# Terminal Prompt

Request user attention for an interactive terminal command. A pulsing FAB
appears; clicking it opens a modal with an embedded live terminal where the
user completes the action (OAuth, login, install, etc.).

## When to Use

- A feature requires CLI authentication (`npx wrangler login`, `claude login`)
- The user must install a system dependency
- Any interactive terminal command the app cannot run headlessly

## How to Trigger

### From an AI agent (MQTT)

Publish to `ctx/terminal/action/request`:

```json
{
  "command": "npx",
  "args": ["wrangler", "login"],
  "title": "Cloudflare Login Required",
  "description": "Authenticate with Cloudflare to enable deployments."
}
```

The server spawns a pty session and publishes to `ctx/terminal/action` which
makes the FAB appear in the UI.

### From server-side code (REST)

```bash
curl -X POST http://localhost:19471/api/terminal/action \
  -H "Content-Type: application/json" \
  -d '{"command":"npx","args":["wrangler","login"],"title":"Cloudflare Login Required"}'
```

### From frontend code

```tsx
import { api } from "../lib/api";

await api.requestTerminalAction(
  "npx", ["wrangler", "login"],
  "Cloudflare Login Required",
  "Authenticate with Cloudflare to enable deployments.",
);
```

## How It Works

1. Request arrives (MQTT or REST) -> server spawns pty session
2. Server publishes action to `ctx/terminal/action`
3. UI receives MQTT event -> `TerminalActionFab` appears (pulsing)
4. User clicks FAB -> `TerminalActionModal` opens with embedded xterm terminal
5. User completes the interactive command in the terminal
6. User clicks "Done" -> action marked complete, FAB dismissed
7. If user clicks "Close" instead, modal hides but FAB persists as reminder

## Components

| File | Purpose |
|------|---------|
| `web/src/components/TerminalActionFab.tsx` | Pulsing FAB with badge count |
| `web/src/components/TerminalActionModal.tsx` | Dialog with embedded `TerminalPanel` |
| `web/src/hooks/useTerminalActions.ts` | MQTT subscription + state management |
| `server/terminal/action-routes.ts` | REST endpoints + MQTT bridge |
| `server/terminal/action-store.ts` | In-memory action lifecycle store |

## MQTT Topics

| Topic | Direction | Purpose |
|-------|-----------|---------|
| `ctx/terminal/action/request` | Agent -> Server | Trigger a new action |
| `ctx/terminal/action` | Server -> UI | Notify UI of new action |
| `ctx/terminal/action/<id>/completed` | UI -> Server | User marked action done |

## REST Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/terminal/action` | Create an action |
| GET | `/api/terminal/actions` | List pending actions |
| PATCH | `/api/terminal/action/:id/complete` | Mark action completed |

## Design Decisions

- **Embedded terminal, not copy-paste.** The user completes the action inside
  the modal without leaving the app.
- **FAB position**: Bottom-right, offset above `MediaFab` when both are present.
- **Pulse animation**: 2s cycle -- draws attention without being disruptive.
- **Two-step dismiss**: "Close" keeps the FAB as a reminder. "Done" fully
  dismisses. Prevents users from accidentally losing the prompt.
- **MQTT-first**: Agents trigger via MQTT publish. REST is a convenience layer.
- **Deferred terminal mount**: `TerminalPanel` only mounts after the Dialog
  transition completes (`TransitionProps.onEntered`). Mounting xterm into a
  zero-sized container during the Dialog animation produces an empty terminal.

## Gotchas

- **Use global binaries, not npx.** `npx` can cache broken packages (e.g.
  `npx wrangler` fails if `@cloudflare/workerd-darwin-arm64` is missing from
  the npx cache). Prefer the globally installed binary (e.g. `wrangler` not
  `npx wrangler`). Check with `which <tool>` first.
- **Server port matters.** The backend runs on `:19470`, the Vite dev server
  proxies on `:19471`. When curling from an agent, hit `:19470` directly.
  The frontend calls go through the Vite proxy automatically.
- **In-memory store.** Actions are stored in memory. A server restart clears
  all pending actions. This is intentional -- actions are transient prompts,
  not durable state.
- **Multiple FABs.** `TerminalActionFab` offsets vertically (`bottom: 88`)
  when `MediaFab` is also visible. If adding more FABs in the future,
  extend the offset logic.
