---
apply: conditional
when: Developing or debugging the Command Center (server, web UI, routes)
---

# Command Center Development

The Command Center has two parts:

- **Engine** (backend): `tools/command-center/server/` -- Fastify, SQLite, AI, auth
- **UI** (frontend): `repos/context-ui/` -- standalone Vite + React + MUI repo

The UI is a user-owned open-source repo. See `rules/command-center.md` for
full development guide and `repos/context-ui/CLAUDE.md` for UI-specific docs.
