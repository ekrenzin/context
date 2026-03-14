---
name: context-workspace
description: Connect to a Context workspace for persistent memory, semantic knowledge search, quality checks, security scanning, and real-time MQTT coordination across repos.
metadata: {"openclaw":{"requires":{"bins":["node"],"env":["CTX_WORKSPACE"]},"primaryEnv":"CTX_WORKSPACE"}}
user-invocable: true
---

# Context Workspace

You are connected to a **Context workspace** -- a poly-repo coordination layer
with persistent memory, semantic knowledge search, quality gates, security
scanning, and an MQTT message bus.

## Available Tools

### Memory (cross-session persistence)

- **ctx_memory_scan** -- Search memory for decisions, progress, known issues.
  Use before starting work to load relevant context from prior sessions.
- **ctx_memory_read** -- Read the full content of a specific memory entry.
- **ctx_memory_write** -- Persist decisions, progress, or observations so
  future sessions have context. Categories: decisions, known-issues, progress,
  preferences, observations, environment.
- **ctx_memory_list** -- Browse all memory entries, filter by type or recency.

### Knowledge (semantic search)

- **ctx_knowledge_search** -- Semantic search across docs, memory, rules,
  skills, and database schema. Use when you need architecture context, prior
  decisions, or institutional knowledge.
- **ctx_knowledge_read** -- Read full document content after finding it via
  search.

### Workspace Operations

- **ctx_workspace_check** -- Run lint, type checks, and tests on a repo.
  Always run before presenting work as complete.
- **ctx_workspace_verify** -- Read-only health check of workspace setup.
- **ctx_workspace_status** -- Get workspace config, repos, and service status.

### Security

- **ctx_security_scan** -- CVE scan on workspace repos. Check dependencies for
  known vulnerabilities.
- **ctx_security_patch** -- Auto-upgrade vulnerable dependencies. Defaults to
  dry-run mode.

### MQTT Bus (real-time coordination)

- **ctx_mqtt_publish** -- Publish events to the workspace message bus. Topics
  include session spawning, AI prompts, and agent coordination.
- **ctx_mqtt_read** -- Read retained state from the bus (workspace status,
  service health).
- **ctx_mqtt_status** -- Check if the MQTT broker is reachable.

## Workflow

1. **Start of session**: Run `ctx_memory_scan` with relevant keywords to load
   prior context. Check `ctx_mqtt_status` to see if the workspace is live.
2. **During work**: Use `ctx_knowledge_search` to find relevant docs and
   architecture decisions. Use `ctx_workspace_check` after making changes.
3. **End of session**: Use `ctx_memory_write` to persist important decisions,
   progress, or issues discovered.

## Key MQTT Topics

| Topic | Purpose |
|-------|---------|
| `ctx/status` | Workspace online/offline (retained) |
| `ctx/session/spawn` | Spawn a new terminal session |
| `ctx/local-ai/prompt` | Send prompt to local AI router |
| `ctx/local-ai/reply` | Receive AI response |
| `ctx/security/scan/complete` | Scan finished notification |
| `ctx/agent/<tool>/session/started` | Agent session lifecycle |
