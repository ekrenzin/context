# Context

An AI-native workspace framework for multi-repo development, built on three
pillars: **Poly Repo**, **MQTT Bus**, and **Memory**.

Context gives AI coding agents persistent memory, structured skills, and
real-time communication across tools -- turning a collection of repositories
into a coherent development environment that gets smarter over time.

---

## Three Pillars

### 1. Poly Repo

Manage multiple repositories as a single workspace. Define your repos in
`repos.yaml`, check them all out with one command, run cross-repo quality
gates, and give AI agents the context they need to work across service
boundaries.

- **repos.yaml** -- declarative manifest of all your repositories
- **Workspace CLI** -- `ctx workspace checkout`, `ctx workspace check`, worktrees
- **Skills** -- procedural workflows agents follow (code review, debugging, deployment)
- **Rules** -- coding standards injected into every AI session
- **AGENTS.md** -- the navigation index agents read first

### 2. MQTT Bus

A universal message backbone connecting every tool in the workspace. The CLI,
web dashboard, VS Code extension, and any custom service all communicate over
MQTT topics. Multiple AI agents can coordinate through the bus. External
integrations plug in the same way.

- **Mosquitto broker** -- auto-configured with TLS and auth
- **ctx-mqtt** -- Node.js client library
- **Command Center** -- Fastify + React web dashboard, connected via MQTT
- **VS Code Extension** -- bridges the IDE to the MQTT bus
- **Topic conventions** -- `ctx/agents/#`, `ctx/tools/#`, `ctx/events/#`

### 3. Memory

Persistent cross-session context that makes AI agents accumulate knowledge
instead of starting from zero. File-based memory with YAML frontmatter,
vector search for semantic retrieval, and an MCP server that exposes it all
to the IDE.

- **File-based memory** -- decisions, known issues, progress, preferences
- **Knowledge search** -- LanceDB + sentence-transformers for semantic queries
- **MCP server** -- Model Context Protocol integration for Cursor / VS Code
- **Profiler** -- analyze agent session transcripts, synthesize new skills

---

## Quick Start

```bash
# Clone the repo
git clone https://github.com/ekrenzin/context.git
cd context

# Bootstrap the CLI
python tools/bootstrap.py

# Activate the virtual environment
source tools/.venv/bin/activate  # or tools/.venv/Scripts/activate on Windows

# Configure your repos in repos.yaml, then:
ctx workspace checkout

# Verify setup
ctx workspace verify
```

### Optional Extras

```bash
# Vector search for knowledge/memory
python tools/bootstrap.py --extras knowledge

# AI image generation
python tools/bootstrap.py --extras image

# Everything
python tools/bootstrap.py --extras all
```

---

## Project Structure

```
context/
  .cursor/
    rules/             Coding standards injected into AI sessions
    skills/            Procedural workflows for AI agents
  docs/
    architecture.md    System overview
    principles.md      Coding standards
    workflows/         Setup, development, worktrees
    repos/             Per-repo context docs (you create these)
  mcps/
    workspace/         MCP server (memory + knowledge tools)
  memory/
    decisions/         Architectural decisions (committed, shared)
    known-issues/      Known issues and workarounds (committed)
    progress/          Session progress (local, gitignored)
    preferences/       Developer preferences (local, gitignored)
  tools/
    ctx/               Python CLI
    command-center/    Web dashboard (Fastify + React)
    ctx-mqtt/          Node.js MQTT client library
    vscode-ext/        VS Code extension (MQTT bridge)
    bootstrap.py       One-command setup
    manifest.yaml      Tool registry
  repos/               Sub-repos (gitignored, managed by checkout)
  playground/          Scratch space (gitignored)
  AGENTS.md            Agent navigation index
  repos.yaml           Repository manifest
```

---

## CLI Reference

```
ctx workspace checkout    Clone/update repos from repos.yaml
ctx workspace check       Run lint, types, tests across repos
ctx workspace setup       Full workspace bootstrap
ctx workspace verify      Validate setup completeness
ctx workspace worktrees   Manage parallel development worktrees
ctx memory scan           Search memory for relevant context
ctx memory write          Create a memory entry
ctx memory list           List memory entries
ctx memory prune          Remove stale entries
ctx profiler scan         Analyze agent session transcripts
ctx profiler report       Generate usage reports
ctx profiler synth        Synthesize skills from session patterns
```

---

## Configuration

### repos.yaml

```yaml
defaults:
  org: your-github-org
  remote:
    http: https://github.com
    ssh: git@github.com

repositories:
  - name: your-app
    branch: main
    description: Main application
```

### manifest.yaml

Register tools so agents and the dashboard can discover them:

```yaml
tools:
  - path: ctx workspace check
    language: python
    category: setup
    description: Unified local validation runner
    risk: read-only
    agent_usage: Run before presenting work as complete
```

### Skills

Create `.cursor/skills/<name>/SKILL.md` with YAML frontmatter:

```yaml
---
name: my-skill
description: When and why to use this skill
triggers: [keyword1, keyword2]
related_skills: [memory, code-review]
---

## Steps

1. Do the thing
2. Verify the thing
```

### Rules

Create `.cursor/rules/<name>.mdc` with frontmatter:

```yaml
---
description: What this rule enforces
alwaysApply: true
---

# Rule content (Markdown)
```

---

## How It Works

```
AI IDE (Cursor / VS Code)
  |
  |-- MCP --> Memory + Knowledge (read/write persistent context)
  |-- reads --> Skills + Rules (procedural workflows, standards)
  |-- reads --> AGENTS.md (workspace navigation)
  |
  +-- MQTT Bus
        |
        +-- Command Center (web dashboard)
        +-- VS Code Extension (IDE bridge)
        +-- Your services (plug anything in)
        +-- Other AI agents (coordination)
```

1. Agent starts a session, reads `AGENTS.md` for orientation
2. Agent invokes `/memory` skill, scans for relevant prior context
3. Agent follows skills and rules while working across repos
4. Agent writes memory at milestones (decisions, progress, issues)
5. All tools communicate over MQTT in real time
6. The profiler analyzes sessions and synthesizes better skills

---

## License

MIT
