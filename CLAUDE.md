# Context -- AI Agent Workspace Framework

You are an agent operating inside a Context workspace -- a poly-repo
coordination layer with an MQTT message bus and persistent memory. No emojis in
code.

## Navigation

- Read `AGENTS.md` for system architecture, repo map, and workspace rules.
- Read `rules/` for the full set of workspace rules (shared across all AI tools).
- Read `docs/proposals/` for feature proposals and design docs.

## Operational Rules

- DO NOT run servers or long-running processes directly. Prompt the user to do so.
- DO NOT write docs or summaries unless explicitly asked.

## Always-Apply Rules

The following rules apply to every session. They are extracted from `rules/`
so you don't need to read them separately.

---

### Context Engineering

Context is the set of tokens present when sampling from the model. As context
grows, recall accuracy degrades (context rot). Maximize signal per token.

- Provide strong heuristics, not exhaustive rules.
- Use structured sections (XML tags, Markdown headers) to delineate concerns.
- Load only what the current task requires -- use `AGENTS.md` as the index.
- Prefer searching over pre-loading. Use search tools on demand.
- Summarize findings before moving to the next phase of work.
- Strip irrelevant fields from tool outputs before reasoning over them.

---

### Modular Design

Files must stay under 200 lines. Functions under 50 lines. No exceptions
without justification.

When creating new functionality, start with a directory (package) if it
might exceed 200 lines. When editing an existing file over 200 lines, extract
something to leave it shorter than you found it. If the file is over 400
lines, propose a split before continuing.

---

### Name Things Once

Names describe **what** something is or does. Nothing else. Don't repeat the
same concept across package, module, class, and variable.

- Only name the **What**. Who, When, Where, Why are metadata (use comments).
- No temporal markers (`_new`, `_v2`, `_old`). Replace the old thing.
- Don't restate the enclosing context (e.g., `Organization.name` not `Organization.organizationName`).
- No redundant type suffixes (`IUserInterface`, `UserException`).

---

### Quality Gates

Build the rail, then build the thing.

1. Ensure tests, lint, and type checks exist before writing implementation.
2. Run `ctx workspace check --quick --repo <name>` before presenting work as complete.
3. Stop and ask the user on: repeated failure (3x), ambiguous requirements,
   cross-repo impact, security-sensitive changes, or destructive operations.

Tool risk classification:
- `read-only`: Execute freely.
- `write`: Execute normally, log changes.
- `destructive`: Pause and confirm with user.

---

### Playground

`playground/` is a git-ignored scratch space. When asked to generate temporary
files (CSV, scripts, data), write them to the appropriate `playground/`
subdirectory. Never commit playground content.

---

## Conditional Rules

Read these from `rules/` when the task requires them:

| Rule | When to read |
|------|-------------|
| `rules/memory.md` | Multi-session tasks, architectural decisions, recurring issues |
| `rules/contribute.md` | End of session that produced reusable code or tooling |
| `rules/create-tooling.md` | Building new Python modules for the ctx CLI |
| `rules/orchestration.md` | Delegating to sub-agents or coordinating cross-repo work |
| `rules/pr-workflow.md` | Creating or editing pull requests |
| `rules/worktrees.md` | Working in sub-repos under `repos/` |
| `rules/command-center.md` | Developing or debugging the Command Center (server, web UI, routes) |

## Memory Protocol

Before substantial work, scan `memory/` for relevant context (decisions,
progress, known issues). Write memory proactively -- see `rules/memory.md`
for the full protocol.
