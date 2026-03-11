# AGENTS.md - Context Workspace

Context is an AI agent workspace framework built on three pillars:

1. **Poly Repo** -- multiple independent repositories coordinated through a
   single workspace root with shared tooling and configuration.
2. **MQTT Bus** -- a lightweight message bus connecting local dev services,
   extensions, and automation via publish/subscribe topics.
3. **Memory** -- persistent cross-session storage for decisions, progress,
   known issues, and preferences so agents retain context across conversations.

---

## System Architecture

```
Replace this diagram with your project's architecture.

  Service A (web app + API)
       |
       |--- HTTP/WebSocket ---> browser clients
       |
       |--- database writes --> PostgreSQL / other DB
       |
       |--- queue -----------> Service B (event processor)
       |                              |
       |                              |--- downstream integrations
       |
       |--- MQTT --------------> IoT / automation layer
```

## Repository Map

<!-- Add your repositories here. One row per repo. -->

| Repository | Purpose | Details |
| ---------- | ------- | ------- |
| _example_  | _Short description of what this repo does_ | `docs/repos/example.md` |

## Developer Tooling

| Tool              | Location                | Purpose                                                                                       |
| ----------------- | ----------------------- | --------------------------------------------------------------------------------------------- |
| ctx CLI           | `tools/.venv/bin/ctx`   | Unified tooling (workspace, profiler, memory). Run `python tools/bootstrap.py` to install.    |
| MQTT Broker       | Mosquitto (1883/9001)   | Universal message bus for all local dev tooling (`ctx/#` topics)                              |
| Command Center    | `tools/command-center/` | Local web UI for sessions, analytics, logs, ops                                               |
| VS Code Extension | `tools/vscode-ext/`     | Spawns Command Center server, bridges VS Code APIs via MQTT                                   |
| Profiler          | `ctx profiler`          | Scan and analyze agent session transcripts                                                    |
| Memory            | `ctx memory`            | Cross-session persistent memory                                                               |

The **Command Center** auto-launches when the editor opens (Fastify server on
`localhost:19470`, React frontend in the browser, MQTT on `localhost:1883`).
Verify with `curl -s http://127.0.0.1:19470/api/stats`. Debug MQTT traffic with
`mosquitto_sub -t "ctx/#" -v`.

## Knowledge Base Navigation

| Topic                                      | Location                        |
| ------------------------------------------ | ------------------------------- |
| Cross-repo data flows and shared infra     | `docs/architecture.md`          |
| Coding principles, security, commit format | `docs/principles.md`            |
| Initial setup and context generation       | `docs/workflows/setup.md`       |
| Git worktrees for parallel development     | `docs/workflows/worktrees.md`   |
| Branching, PRs, cross-repo coordination    | `docs/workflows/development.md` |
| Technical proposals (local, git-ignored)   | `docs/proposals/`               |
| Architectural decision records             | `docs/decisions/`               |
| Execution plans for complex work           | `docs/exec-plans/`              |
| Quality grades per repo/domain             | `docs/quality/`                 |
| Scripts and tools index                    | `docs/tooling-registry.md`      |

## Workspace Rules

This workspace contains multiple independent repositories under `repos/`. Each
has its own git history, remote, and CI/CD pipeline.

- Commits inside `repos/<name>/` affect only that sub-repo.
- The root repo tracks only workspace-level config, tooling, and docs.
- Never stage or commit sub-repo files into the root repository (the pre-commit
  hook enforces this).
- `context/` is git-ignored and regenerated locally.

## Security

- All remote URLs in `repos.yaml` are validated against the configured GitHub
  organization by `ctx workspace checkout` to prevent manifest tampering.
- The pre-commit hook prevents accidental commit of sub-repo contents into the
  root repo.
- Each sub-repo manages its own `.env` files and secrets independently.
- The root `.env` contains only profile/region names and secret reference
  names -- never actual credentials or keys.
- Generated `context/` artifacts are git-ignored and must be regenerated locally.
- Sub-repo CI/CD pipelines remain independent and are not affected by root
  repo changes.
