# AGENTS.md

Auto-generated from canonical workspace. Do not edit directly.

## Rules

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
# Context Engineering

Context is the set of tokens present when sampling from the model. As context
grows, recall accuracy degrades (context rot). Your job is to maximize signal
per token at every inference step.

## Right-Altitude Instructions

Instructions exist on a spectrum from brittle (over-specified, hardcoded
if-else) to vague (under-specified, relies on assumptions). Aim for the middle:

- Provide strong heuristics, not exhaustive rules.
- Add specificity only after observing a concrete failure mode.
- Use structured sections (XML tags, Markdown headers) to delineate concerns.
- If a rule is longer than ~20 lines, it may be too low-altitude. Extract the
  intent and let the model reason about edge cases.

## Scoped Retrieval

Load only what the current task requires:

- Read `docs/repos/<name>.md` for repo-specific context before touching that
  repo. Do not load all repo docs at once.
- Load `context/` artifacts (schema, models, drift) only when the task involves
  database or model changes. Never front-load the entire directory.
- Use `AGENTS.md` as the navigation index, not as a dump of all knowledge.

## Just-in-Time Discovery

Prefer searching over pre-loading. The hybrid strategy:

- **Speed layer**: Always-applied rules and AGENTS.md are already in context.
  These cover orientation and standards.
- **Flexibility layer**: Use search tools to discover specifics on demand. Each
  search result is high-signal because the agent chose to look for it.
- Avoid reading entire large files when a targeted search would suffice. Read
  the section you need, not the whole file.

## Compaction During Long Sessions

As a session accumulates tool outputs and conversation history:

- Summarize findings before moving to the next phase of work. A two-sentence
  summary of what was learned replaces thousands of tokens of raw output.
- When referencing earlier work, cite the conclusion -- not the full trace.
- If you notice the conversation is very long, proactively summarize the
  current state (what has been done, what remains, key decisions) before
  continuing.

## Token Efficiency in Tool Outputs

When designing or using tools:

- Prefer concise, structured output over verbose narratives.
- Strip irrelevant fields from API responses before reasoning over them.
- If a tool returns more data than needed, extract the relevant subset and
  discard the rest from working memory.
# Contribute

Every agent session is an opportunity to grow the ecosystem. After completing any
task that produces code, reusable patterns, or operational knowledge, evaluate
whether your work should propagate to the broader tooling surface.

## The Manifest

`tools/manifest.yaml` is the single source of truth for all tooling. The
VS Code extension, tooling registry docs, and validation all derive from it.

When you add an entry, the ecosystem grows:
- The tool appears in `docs/tooling-registry.md` (run `ctx workspace validate registry`)
- Adding `dashboard: actions` to a tool makes it a Quick Action in the extension
- Adding a `tests` entry makes it appear in the extension's Tests panel
- Adding a `log_prefixes` entry makes it appear in the Logs dropdown

## Contribution Checklist

Before finishing a session that produced code, evaluate these quickly. Most
sessions will have zero contributions -- that is fine. The bar is: "Would another
agent or developer benefit from this existing?"

1. **Reusable script?** If you created a utility in `playground/scripts/` that
   proved useful, promote it to `tools/scripts/` and register it in the manifest.

2. **Repeatable workflow?** If you followed a multi-step process that other
   agents would benefit from, create a skill definition for it.

3. **Developer-facing tool?** If devs would want quick access, add
   `dashboard: actions` to the tool's manifest entry so it appears in the
   extension.

4. **New test suite?** If you set up tests for a new module, add a `tests` entry
   to the manifest so it appears in the extension.

5. **New log source?** If you discovered a useful CloudWatch log group prefix,
   add it to `log_prefixes` in the manifest.

6. **Architectural decision?** If you made a non-obvious technical choice,
   document it in `docs/decisions/`.

## Do Not Over-Contribute

Skip when:
- The script is truly one-off (leave it in `playground/scripts/`)
- The workflow is specific to a single ticket with no generalizable pattern
- The change is a routine bug fix

Organic growth means growing intentionally, not reflexively.
# Create Tooling

When asked to build a new utility or automation for the context repo, follow
this process to ensure the tool is discoverable, maintainable, and consistent
with existing tooling.

## Before Writing

1. **Check the registry.** Read `docs/tooling-registry.md` to see what already
   exists. Avoid duplicating functionality.
2. **Use Python.** All new tools are Python modules inside `tools/ctx/`. Shell
   scripts are only used as shims (backward-compat forwarders to the `ctx` CLI).
3. **Pick the right location.** See placement rules below.

## Placement

| Type | Location | When |
|------|----------|------|
| New command group | `tools/ctx/<domain>/` | Distinct concern area (aws, jira, workspace, etc.) |
| Subcommand of existing group | Add to existing `tools/ctx/<domain>/commands.py` | Extends an existing tool category |
| Shared utility | `tools/ctx/` (e.g., `runner.py`, `config.py`) | Cross-cutting logic used by multiple modules |
| One-off / experimental | `playground/scripts/` | Throwaway scripts not intended for long-term use |

## Module Structure

Every command group follows the same pattern:

```
tools/ctx/<domain>/
    __init__.py       # Empty or re-exports
    core.py           # Business logic (no typer imports)
    commands.py       # typer CLI definitions (thin wrappers over core)
```

Split `core.py` into multiple files if it would exceed 200 lines. The key
invariant: **CLI definitions and business logic are always separate files.**

### commands.py Template

```python
"""<Domain> CLI commands."""

import typer

from ctx.<domain>.core import do_something

app = typer.Typer(no_args_is_help=True)


@app.command("action")
def action(
    target: str = typer.Argument(help="What to act on"),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Verbose output"),
) -> None:
    """One-line description of what action does."""
    do_something(target, verbose=verbose)
```

### core.py Template

```python
"""<Domain> business logic."""

from pathlib import Path

from ctx.config import root_dir


def do_something(target: str, *, verbose: bool = False) -> None:
    root = root_dir()
    # Implementation here -- no typer imports, no CLI concerns
```

Key conventions:
- Use `typer` for all CLI interfaces (`app = typer.Typer()`).
- Use `ctx.config.root_dir()` for workspace root resolution.
- Use `ctx.runner.run()` for subprocess execution (never `shell=True`).
- Use `pathlib.Path` for all path operations.
- Use type hints on all function signatures.
- Dependencies go in `tools/pyproject.toml` -- core deps in `[dependencies]`,
  heavy/optional deps in `[project.optional-dependencies]`.
- Files stay under 200 lines, functions under 50 lines.

## Registering in the CLI

After creating the module, register it in `tools/ctx/cli.py`:

```python
from ctx.<domain>.commands import app as <domain>_app

app.add_typer(<domain>_app, name="<domain>", help="<One-line description>.")
```

## After Writing

1. **Test it:** `tools/.venv/bin/ctx <domain> --help` and verify it works.
2. **Register it:** Add an entry to `tools/manifest.yaml` (then run
   `ctx workspace validate registry` to regenerate docs/tooling-registry.md).
3. **Wire it up (optional):** If the tool should be agent-accessible, create a
   skill definition that describes when and how to invoke it.
4. **Create a shim (optional):** If backward compatibility with an old script
   path is needed, add a shim in `tools/scripts/`.

## ACI (Agent-Computer Interface) Fields

Every tool registered in `manifest.yaml` must include these fields so agents
can select and gate tools correctly:

| Field         | Required | Values / Description                                    |
|---------------|----------|---------------------------------------------------------|
| `risk`        | Yes      | `read-only`, `write`, or `destructive`                  |
| `agent_usage` | Yes      | One-line hint: when should an agent pick this tool?     |
| `skill`       | No       | Name of the skill that wraps this tool, if one exists   |

## Quality Checks

- No hardcoded secrets or credentials.
- Files under 200 lines. Split into multiple modules early.
- Error messages should be actionable (tell the user what to do, not just what
  failed).
- Temporary files go in `/tmp/`, never in the workspace.
- Never use `shell=True` in subprocess calls.
- Optional heavy deps (boto3, openai, etc.) go in
  `[project.optional-dependencies]` groups, not core `[dependencies]`.
# Agent Memory

Agents lose all state when a session ends. The `memory/` directory provides
persistent storage that survives context resets and allows knowledge to
accumulate across sessions.

## Shared vs Local

Not all memory is equal. Some knowledge benefits everyone; some is only relevant
to the current developer's session.

| Directory              | Committed | Purpose                                                                            |
| ---------------------- | --------- | ---------------------------------------------------------------------------------- |
| `memory/decisions/`    | Yes       | Architectural choices with reasoning. Shared across all developers and agents.     |
| `memory/known-issues/` | Yes       | Gotchas, workarounds, environment quirks. Shared across all developers and agents. |
| `memory/progress/`     | No        | In-flight session state for multi-session work. Local to the current machine.      |
| `memory/preferences/`  | No        | Developer coding style, naming conventions, review patterns. Local.                |
| `memory/observations/` | No        | Codebase learnings -- fragile modules, implicit patterns, structural notes. Local. |
| `memory/environment/`  | No        | Local tooling setup -- ports, versions, tool configs, shell quirks. Local.         |

**Decisions and known-issues are shared knowledge.** When you write to these
directories, the files will be committed and visible to every developer and
agent working in this repo.

**Local directories are per-developer.** They are gitignored and exist only on
the current machine.

## When to Read Memory

At the start of a session, before diving into implementation:

1. Check `memory/decisions/` for prior architectural choices relevant to the
   current task.
2. Check `memory/progress/` for any in-flight work related to the current
   ticket or feature.
3. Check `memory/known-issues/` for gotchas in the area you are about to touch.
4. Check `memory/preferences/` to recall how this developer likes to work.
5. Check `memory/observations/` for prior codebase learnings in the area.
6. Check `memory/environment/` for local setup details that affect the task.

Do not read all memory files. Use file names and search to find relevant entries.

## When to Write Memory

Write aggressively. The cost of a forgotten insight is higher than the cost of
an extra file. Write or update memory files when:

- **Making a decision** with non-obvious reasoning -> `memory/decisions/`
- **Completing a milestone** on multi-session work -> `memory/progress/`
- **Discovering a recurring issue** -> `memory/known-issues/`
- **Learning a developer preference** -> `memory/preferences/`
- **Noticing a codebase pattern** -> `memory/observations/`
- **Encountering environment friction** -> `memory/environment/`
- **End of session** -> Always write a progress summary to `memory/progress/`

## File Format

Use short, descriptive filenames: `memory/decisions/jwt-expiration-strategy.md`,
`memory/progress/SWE-142-webhook-retry.md`.

Keep files short and high-signal. A few paragraphs at most. One file per
topic -- prefer updating an existing file over creating a new one on the same
subject.

## Trigger Checklist

1. Did I make a non-obvious choice? --> `memory/decisions/`
2. Did I hit a wall or find a workaround? --> `memory/known-issues/`
3. Did the developer correct me or express a preference? --> `memory/preferences/`
4. Did I learn something about the local environment? --> `memory/environment/`
5. Is this session ending? --> `memory/progress/`

If any answer is yes and no memory file exists for it yet, write one now.

## Cleanup

Memory files for completed work should be pruned periodically. When a ticket
is fully merged and verified, its progress file can be deleted. Decision and
known-issue files persist longer since they remain useful as reference.
# Modular Design

Files must stay under 200 lines. Functions under 50 lines. No exceptions
without justification.

When creating new functionality, start with a directory (package) if it
might exceed 200 lines. When editing an existing file over 200 lines, extract
something to leave it shorter than you found it. If the file is over 400
lines, propose a split before continuing.
# Name Things Once

Names describe **what** something is or does. Nothing else. Don't repeat the
same concept across package, module, class, and variable.

- Only name the **What**. Who, When, Where, Why are metadata (use comments).
- No temporal markers (`_new`, `_v2`, `_old`). Replace the old thing.
- No jokes or codenames.
- Don't restate the enclosing context:

```typescript
// BAD
class Organization {
  organizationName: string;
  getOrganizationZones() { ... }
}

// GOOD
class Organization {
  name: string;
  getZones() { ... }
}
```

- **Dots-to-underscores test**: replace path separators with underscores. If the
  result looks absurd, the naming is redundant.
- Prefer flat namespaces. Break at responsibility boundaries, not one-export-
  per-file.
- No redundant type suffixes (`IUserInterface`, `UserException`). The type
  system communicates the kind.
# Agent Orchestration

Agents in this workspace are specialized by repo and function. They work best
when they coordinate rather than operate in isolation.

## Handoff Protocol

When a dev agent finishes implementation:

1. Run validation checks (`ctx workspace check --quick --repo <name>`).
2. Invoke a verifier agent to independently validate the work.
3. If verifier reports issues, fix them and re-invoke verifier (evaluator-
   optimizer loop). Do not present work as complete until verifier passes.
4. For platform changes, run visual verification to confirm the UI renders.

## Evaluator-Optimizer Loop

This pattern improves output quality through iterative feedback:

```
Dev agent produces implementation
  -> Verifier evaluates against standards
    -> Issues found? Dev agent fixes, then re-submits to verifier
    -> No issues? Work is ready for PR
```

The loop should terminate after at most 3 iterations. If issues persist after
3 rounds, escalate to the user rather than continuing to loop.

## Delegation Patterns

### Parallel Exploration

When investigating a problem that spans multiple files or repos, spawn parallel
sub-agents scoped to specific areas rather than searching sequentially. Each
sub-agent gets a clean context window focused on its target.

### Manager Pattern

A lead agent can delegate focused tasks to specialized agents. The lead agent
synthesizes results from delegates. Delegates return concise summaries, not
full traces.

### Cross-Repo Coordination

When a change affects multiple repos:

1. Identify all affected repos from cross-repo awareness sections.
2. Implement changes in the owning repo first.
3. Delegate downstream updates to the appropriate specialized agent.
4. Run verifier across all affected repos before declaring complete.
# Playground

`playground/` is a git-ignored scratch space for generated or temporary files.
The directory structure is tracked via `.gitkeep`; everything else is ignored.

## Structure

```
playground/
  csv/       -- generated CSVs, spreadsheets, tabular exports
  scripts/   -- throwaway scripts, one-off utilities, quick automation
  data/      -- raw data files, JSON dumps, API responses
  output/    -- command output, logs, report artifacts
  scratch/   -- anything else: notes, experiments, prototypes
```

## Rules

- When asked to generate a file (CSV, script, data, etc.) that is not part of a
  tracked feature, write it to the appropriate `playground/` subdirectory.
- If no subdirectory fits, use `playground/scratch/`.
- New subdirectories may be created inside `playground/` as needed -- they will
  be automatically ignored by git.
- NEVER commit playground content to the repository.
- Playground files are ephemeral. Do not rely on them persisting across worktree
  cleanups or system resets.
# PR Workflow

**CRITICAL**: Before executing any git commands, verify you're in the correct repository:

```bash
pwd
git rev-parse --show-toplevel
```

When creating or editing PRs in any repo (including root context or sub-repos under `repos/`):

- **Before generating diff**: Ask the user if they want to pull the latest main branch first.

- Generate a diff from main and use it as the source of truth:

```bash
git fetch origin --quiet
git diff origin/main...HEAD > /tmp/diff.file
```

**Always use `/tmp/` for temporary files to avoid git tracking issues.**

- Fill the correct PR summary template **exactly** (do not add/remove/reorder sections):
  - `your-app`: `tools/context-templates/PR_SUMMARY_TEMPLATE.md`
  - `your-service`: `tools/context-templates/PR_SUMMARY_TEMPLATE_NOTIFIER.md`

- PR title must be `{Category}: Description` (Category from the approved list).

- **Critical**: `/tmp/diff.file` is a temporary file for comparison only. It must **never be committed** to git and must be **deleted after use**:

```bash
rm -f /tmp/diff.file
```
# Quality Gates

Build the rail, then build the thing. Every implementation must be preceded by
its validation, and followed by proof that the validation passes.

## Validation First

Before writing implementation code, ensure the validation infrastructure exists:

1. **Tests exist** for the module being modified. If not, write them first.
2. **Linting passes** on the files you will touch.
3. **Type checks pass** (where applicable).

If creating something new, write the test alongside or before the implementation.

## Local Validation

```bash
ctx workspace check --quick --repo <repo-name>  # lint + types
ctx workspace check --repo <repo-name>           # lint + types + tests
ctx workspace check --root                       # root repo only
```

## Before Presenting Work as Complete

1. `ctx workspace check --quick --repo <name>` passes.
2. Relevant tests pass if the change is non-trivial.
3. Code review checklist applied.
4. For UI changes, use Playwright MCP to verify the page renders and key
   interactions work. See `skills/playwright/SKILL.md` for the workflow.
5. After verifying a UI flow, generate a Playwright test with
   `browser_generate_playwright_test` to guard against regressions.

## Before Creating a PR

1. All code-review criteria met.
2. `ctx workspace check` passes.
3. PR summary generated from diff (not fabricated).
4. Jira ticket linked.

## Tool Risk Classification

| Risk Level  | Behavior                                |
| ----------- | --------------------------------------- |
| read-only   | Execute freely.                         |
| write       | Execute normally. Log what was changed. |
| destructive | Pause and confirm with the user first.  |

For ad-hoc shell commands, classify by intent: reading = read-only,
creating/modifying = write, deleting/deploying = destructive.

## Escalation Triggers

Stop and ask the user when:

- **Repeated failure**: Same step failed 3 times.
- **Ambiguous requirements**: Multiple valid interpretations, wrong choice costly.
- **Cross-repo impact**: Schema, MQTT topics, event formats, or API contracts.
- **Security-sensitive**: Auth logic, encryption, secrets, access control.
- **Destructive operations**: Data deletion, force push, production deployment.

## New Tooling

Scripts in `tools/` must validate their own output (e.g., `--dry-run` mode).
Register in `tools/manifest.yaml` (run `ctx workspace validate registry` to sync).
# Worktree Awareness

Sub-repos under `repos/` start with a **detached HEAD** in worktrees. Create a
feature branch before committing:

```bash
cd repos/<name> && git checkout -b feature/<description>
```

Sub-repo worktrees have independent file trees -- edits in one are invisible to
others. `node_modules` are not shared; run `npm install` per worktree.

For full worktree documentation, read `docs/workflows/worktrees.md`.

## Skills

## Skill: api-design

---
name: api-design
description: API endpoint design and contract conventions. Use when creating or modifying REST endpoints, refactoring API consumers, or aligning with OpenAPI specs. Covers route structure, request/response contracts, error responses, and cross-service consistency.
triggers:
  - cross-repo-check
  - code-review
related_skills:
  - feature-dev
  - security-audit
  - database-ops
  - frontend-patterns
---

# API Design

Apply these conventions when designing or modifying API endpoints in your
application (`repos/your-app/server/`).

## Route Structure

- RESTful resource naming: plural nouns, nested for ownership.
  `/organizations/:orgId/zones/:zoneId/devices`
- Use HTTP verbs correctly: GET (read), POST (create), PUT (full replace),
  PATCH (partial update), DELETE (remove).
- Avoid action verbs in URLs. Prefer resource state changes over RPC-style
  endpoints (`POST /alerts/:id/acknowledge` not `POST /acknowledgeAlert`).
- Version the API if breaking changes are unavoidable. The current codebase
  uses unversioned routes -- maintain consistency unless migrating.

## Request and Response Contracts

- Request bodies use camelCase keys (JavaScript convention).
- Response envelopes follow the existing pattern in the codebase. Check sibling
  endpoints before inventing a new shape.
- Pagination uses `limit` and `offset` query parameters with a default limit.
- Timestamps are ISO 8601 strings in UTC.

## Error Responses

- Use standard HTTP status codes: 400 (validation), 401 (unauthenticated),
  403 (unauthorized), 404 (not found), 409 (conflict), 500 (server error).
- Error bodies include a machine-readable `code` and human-readable `message`.
- Never expose stack traces, SQL queries, or internal paths in error responses.
- Validation errors list all failing fields, not just the first one.

## Maintaining API Stability

- When refactoring an endpoint, verify that existing consumers (React
  components, tests, external integrations) still work.
- Run `grep` for the endpoint path across the client codebase to find all
  callers before changing the contract.
- If an endpoint has tests, ensure they still pass without modification after
  your change. This was a key win pattern: maintaining public API stability
  so existing test files remain valid.

## Cross-Service APIs

- The platform communicates with the notifier via SQS/Kinesis. Message schemas
  are contracts -- changes require coordination.
- MQTT topic structures are shared between platform, Home Assistant, and the
  gateway. Check `docs/architecture.md` before modifying.
- When integrating with external APIs (Graph API, Jira, etc.), prefer raw
  REST calls with explicit error handling over SDK dependencies.

## Additional Resources

- For route structure and response envelope examples, see [references/endpoint-examples.md](references/endpoint-examples.md)
- For error response patterns and validation, see [references/error-patterns.md](references/error-patterns.md)

## Before Completing API Work

1. Test the endpoint with valid input, invalid input, and missing auth.
2. Verify all existing callers in the client still compile and function.
3. Check that error responses are informative but do not leak internals.
4. Run `/code-review` to validate the change.
## Skill: code-review

---
name: code-review
description: Apply code review standards for your organization. Use when reviewing code changes, completing features, or before committing. Covers security, infra, UI reuse, and cross-repo impact.
triggers:
  - security-audit
  - pre-commit-check
  - infra-migration
  - ui-refactor
related_skills:
  - refactoring
  - modular-design
  - cross-repo-check
  - file-analysis
---

# Code Review Standards

Apply this checklist systematically. Every change must pass these criteria. Refer to linked checklists for deep dives.

## Discovery & Strategy

- **Strategy Docs**: Before cross-cutting changes (auth, logging, events), search for `Standard` or `Strategy` docs (e.g., `Unified Structured Logging`).
- **UI Patterns**: Search for existing UI components (e.g., `drawer`, `logs`, `viewer`) before creating new ones. Use `rg` on UI strings to find entry points.
- **Zero-Guessing**: Avoid manual directory traversing. Use `rg` on unique identifiers immediately.
- **Memory**: Ensure the `/memory` skill was invoked to align with prior decisions.
- See [checklists/discovery-heuristics.md](checklists/discovery-heuristics.md).

## Validation & Testing

- **Full Check**: Run `ctx workspace check --quick --repo <name>`. Do not rely on targeted lints or wait for hook failures.
- **Test Integrity**: If modifying logging or infrastructure, update tests to capture `stdout/stderr` for verification.
- **Summary Quality**: Use `grep` or structured reporters for test summaries; avoid `tail` which can miss exit codes and critical summary lines.
- **Timing**: Use polling or event-based waits; avoid arbitrary `sleep` commands.

## UI & UX Excellence

- **CSS Audit**: Audit existing CSS files for class duplicates before adding new UI components.
- **Dynamic Mapping**: Prefer dynamic data mapping over hardcoded fields for generic tools (e.g., log viewers).
- **Layouts**: For system-wide requirements, consider global layout injection over per-page components.
- **Embedded Viewport**: If this component can render inside a smaller
  container (preview panel, card, modal), does it degrade gracefully? Controls
  must not overlap content at small sizes. Provide a `compact` prop or move
  controls to the parent container's chrome.
- **Activation Pattern**: Does the feature require explicit user action when
  contextual activation would suffice? Prefer auto-detection (e.g.,
  proximity-based selection on zoom) over click-to-activate when user intent
  is unambiguous.
- See [checklists/ui-ux-review.md](checklists/ui-ux-review.md) and [checklists/ui-reuse-audit.md](checklists/ui-reuse-audit.md).

## Infrastructure & Safe-Mode

- **macOS Sync**: Use mtime-based polling over `fs.watch` for reliable cross-process synchronization on macOS.
- **Logging**: Use `encryptedField` for at-rest encryption. Follow the pass-through context pattern for logger portability.
- **Builds**: For VS Code extensions, use `npm run build` to verify the `dist/` relationship.
- See [checklists/infrastructure-changes.md](checklists/infrastructure-changes.md).

## Maintainability & Architecture

- **Name Things Once**: No redundant context (e.g., `org.name`, not `org.orgName`). Apply dots-to-underscores test.
- **Modularity**: Use barrel exports (`index.ts`) early when splitting modules. Audit for dead code exports after refactoring.
- **Limits**: Files < 200 lines (max 400), functions < 50 lines. Extract logic to utilities.
- **Clarity**: Comments explain *why*, not *what*. No emojis in code or UI.

## Git & PR Readiness

- **Remote Check**: Proactively check for remote branch changes before proposing PRs in high-activity repositories.
- **Cleanup**: Remove unused dependencies and dead code. Ensure `package.json` and `requirements.txt` are hygienic.

## Additional Resources

- [checklists/security-deep-dive.md](checklists/security-deep-dive.md)
- [checklists/ui-reuse-audit.md](checklists/ui-reuse-audit.md)
- [checklists/infrastructure-changes.md](checklists/infrastructure-changes.md)
- [checklists/discovery-heuristics.md](checklists/discovery-heuristics.md)
- [checklists/dependency-hygiene.md](checklists/dependency-hygiene.md)
## Skill: commit-format

---
name: commit-format
description: Commit message format for your organization. Apply when creating git commits to ensure consistent, parseable, and secure commit messages across all repositories.
triggers: []
related_skills:
  - git-ops
  - feature-dev
  - finish-ticket
---

# Commit Format Skill

All commits across your organization's repositories must follow the format:

```
Category: Short description of the change
```

## Categories

| Category          | Usage                                                             |
| ----------------- | ----------------------------------------------------------------- |
| `Feature:`        | New functionality                                                 |
| `Fix:`            | Bug correction                                                    |
| `Improvement:`    | Enhancement, optimization, or refactoring (never use `Refactor:`) |
| `Dependency:`     | Adding, updating, or cleaning up unused libraries                 |
| `Configuration:`  | `.env`, settings, or environment variable changes                 |
| `Security:`       | Vulnerability patches, auth, encryption, or input validation      |
| `Test:`           | Adding or updating tests                                          |
| `Infrastructure:` | CI/CD, deployment scripts, or infrastructure-as-code              |

## Operational Rules

1. **Validation First**: Always run `ctx workspace check --quick --repo <name>` before committing. If tests fail, resolve them before finalizing the commit.
2. **Remote Alignment**: Before creating a branch or committing, check for existing remote branches or open PRs (`gh pr list`) to avoid redundant work or collisions.
3. **Pattern Consistency**: Search for existing UI patterns or utility functions (e.g., `drawer`, `logger`) before implementing "new" versions. Favor reuse over duplication.
4. **Test Synchronization**: When refactoring core utilities or loggers, update the corresponding test harnesses (e.g., intercepting `stdout` for new loggers) to ensure they reflect the new implementation.
5. **Staging Hygiene**: Use `git status`. Never stage `playground/`, `.env`, or temporary logs. Audit for unused dependencies and remove them in the same commit.
6. **Security Awareness**: Use `Security:` for vulnerability patches. Never commit secrets. Verify that data separators (e.g., colons) don't collide with credential formats.
7. **Detailed Bodies**: Explain the "Why" for non-trivial changes. Reference Jira tickets (e.g., `Closes SWE-482`) at the end of the body.
8. **Clean History**: Use `git rebase -i` to squash or reword commits before PR creation.

## Resources

- [Pre-Commit Checklist](checklists/pre-commit.md)
- [Complex Commit Examples](examples/complex-commits.md)
- [Remote Sync Guide](context/remote-sync.md)
## Skill: contribute

---
name: contribute
description: Register a new tool, test, log source, or skill in your organization's ecosystem. Use when you have created reusable tooling that should be discoverable by other agents and developers.
triggers:
  - memory
related_skills:
  - proactive-suggestions
  - feature-dev
---

# Contribute

Register new tooling in the ecosystem so it is discoverable by agents, the
VS Code extension, and validation.

## When to Use

- You created a script in `tools/scripts/` or `tools/<domain>/`
- You built a workflow that should become a skill
- You added a test suite that should appear in the extension
- You discovered a CloudWatch log group useful for debugging

## Prerequisites

- The tool exists and works (test it first)
- You know which category it belongs to (check `tools/manifest.yaml` for the list)

## Steps

### 1. Register the Tool

Open `tools/manifest.yaml` and add an entry under `tools`:

```yaml
  - path: ctx my-tool action
    language: python
    category: dev
    description: What it does in one line
```

Available fields:

| Field | Required | Purpose |
|-------|----------|---------|
| `path` | yes | Path relative to workspace root |
| `language` | yes | bash, python, node, node/ts, -- |
| `category` | yes | Must match a category id in the manifest |
| `description` | yes | One-line summary |
| `prerequisites` | no | What must be set up first (e.g., "AWS SSO session") |
| `skill` | no | Name of the agent skill that wraps this tool |
| `dashboard` | no | Set to `actions` to surface as a Quick Action |
| `dashboard_label` | no | Override the auto-derived dashboard label |

### 2. Surface in the VS Code Extension (Optional)

To make the tool a Quick Action in the Command Center, add:

```yaml
    dashboard: actions
    dashboard_label: Human-Friendly Label
```

If `dashboard_label` is omitted, the label is derived from the filename:
`my-tool.sh` becomes "My Tool".

To add a test runner, add under the `tests` section:

```yaml
  - name: My Module
    command: npm test
    cwd: repos/your-app
```

To add a log source, add under `log_prefixes`:

```yaml
  - label: My Service
    value: /aws/lambda/my-service
```

### 3. Sync the Registry

```bash
ctx workspace validate registry
```

This regenerates `docs/tooling-registry.md` from the manifest.

### 4. Create a Skill (Optional)

If the tool should be agent-invokable, create `.cursor/skills/<name>/SKILL.md`:

```yaml
---
name: <name>
description: When and why to invoke this skill
---
```

Include: when to use, prerequisites, step-by-step instructions, and which
tools/scripts it calls by their manifest paths.

If the skill should be **discoverable** (listed in `docs/tooling-registry.md` and visible to agents scanning the manifest), also register the skill file itself in `tools/manifest.yaml` as a `language: markdown` tool entry, then re-run:

```bash
ctx workspace validate registry
```

### 5. Validate

```bash
ctx workspace validate docs
```

This verifies:
- All manifest tool paths exist on disk
- The registry is in sync with the manifest
- Skill references in `.cursorrules` resolve

### 6. Add a New Category (Rare)

If no existing category fits, add one under `categories` in the manifest:

```yaml
  - id: my-category
    label: My Category
    note: Optional explanatory note that appears in the registry
```

## Format Rules

The manifest uses flat YAML parseable by the VS Code extension's built-in
loader. Follow these constraints:

- All values on one line (no YAML block scalars)
- Top-level keys flush left
- Array items indented 2 spaces with `- `
- Item properties indented 4 spaces
- No tabs
## Skill: create-rule

---
name: create-rule
description: Create Cursor rules for persistent AI guidance. Use when you want to create a rule, add coding standards, set up project conventions, configure file-specific patterns, create RULE.md files, or asks about .cursor/rules/ or AGENTS.md.
---
# Creating Cursor Rules

Create project rules in `.cursor/rules/` to provide persistent context for the AI agent.

## Gather Requirements

Before creating a rule, determine:

1. **Purpose**: What should this rule enforce or teach?
2. **Scope**: Should it always apply, or only for specific files?
3. **File patterns**: If file-specific, which glob patterns?

### Inferring from Context

If you have previous conversation context, infer rules from what was discussed. You can create multiple rules if the conversation covers distinct topics or patterns. Don't ask redundant questions if the context already provides the answers.

### Required Questions

If the user hasn't specified scope, ask:
- "Should this rule always apply, or only when working with specific files?"

If they mentioned specific files and haven't provided concrete patterns, ask:
- "Which file patterns should this rule apply to?" (e.g., `**/*.ts`, `backend/**/*.py`)

It's very important that we get clarity on the file patterns.

Use the AskQuestion tool when available to gather this efficiently.

---

## Rule File Format

Rules are `.mdc` files in `.cursor/rules/` with YAML frontmatter:

```
.cursor/rules/
  typescript-standards.mdc
  react-patterns.mdc
  api-conventions.mdc
```

### File Structure

```markdown
---
description: Brief description of what this rule does
globs: **/*.ts  # File pattern for file-specific rules
alwaysApply: false  # Set to true if rule should always apply
---

# Rule Title

Your rule content here...
```

### Frontmatter Fields

| Field | Type | Description |
|-------|------|-------------|
| `description` | string | What the rule does (shown in rule picker) |
| `globs` | string | File pattern - rule applies when matching files are open |
| `alwaysApply` | boolean | If true, applies to every session |

---

## Rule Configurations

### Always Apply

For universal standards that should apply to every conversation:

```yaml
---
description: Core coding standards for the project
alwaysApply: true
---
```

### Apply to Specific Files

For rules that apply when working with certain file types:

```yaml
---
description: TypeScript conventions for this project
globs: **/*.ts
alwaysApply: false
---
```

---

## Best Practices

### Keep Rules Concise

- **Under 50 lines**: Rules should be concise and to the point
- **One concern per rule**: Split large rules into focused pieces
- **Actionable**: Write like clear internal docs
- **Concrete examples**: Ideally provide concrete examples of how to fix issues

---

## Example Rules

### TypeScript Standards

```markdown
---
description: TypeScript coding standards
globs: **/*.ts
alwaysApply: false
---

# Error Handling

\`\`\`typescript
// ❌ BAD
try {
  await fetchData();
} catch (e) {}

// ✅ GOOD
try {
  await fetchData();
} catch (e) {
  logger.error('Failed to fetch', { error: e });
  throw new DataFetchError('Unable to retrieve data', { cause: e });
}
\`\`\`
```

### React Patterns

```markdown
---
description: React component patterns
globs: **/*.tsx
alwaysApply: false
---

# React Patterns

- Use functional components
- Extract custom hooks for reusable logic
- Colocate styles with components
```

---

## Checklist

- [ ] File is `.mdc` format in `.cursor/rules/`
- [ ] Frontmatter configured correctly
- [ ] Content under 500 lines
- [ ] Includes concrete examples
## Skill: create-skill

---
name: create-skill
description: Guides users through creating effective Agent Skills for Cursor. Use when you want to create, write, or author a new skill, or asks about skill structure, best practices, or SKILL.md format.
---
# Creating Skills in Cursor

This skill guides you through creating effective Agent Skills for Cursor. Skills are markdown files that teach the agent how to perform specific tasks: reviewing PRs using team standards, generating commit messages in a preferred format, querying database schemas, or any specialized workflow.

## Before You Begin: Gather Requirements

Before creating a skill, gather essential information from the user about:

1. **Purpose and scope**: What specific task or workflow should this skill help with?
2. **Target location**: Should this be a personal skill (~/.cursor/skills/) or project skill (.cursor/skills/)?
3. **Trigger scenarios**: When should the agent automatically apply this skill?
4. **Key domain knowledge**: What specialized information does the agent need that it wouldn't already know?
5. **Output format preferences**: Are there specific templates, formats, or styles required?
6. **Existing patterns**: Are there existing examples or conventions to follow?

### Inferring from Context

If you have previous conversation context, infer the skill from what was discussed. You can create skills based on workflows, patterns, or domain knowledge that emerged in the conversation.

### Gathering Additional Information

If you need clarification, use the AskQuestion tool when available:

```
Example AskQuestion usage:
- "Where should this skill be stored?" with options like ["Personal (~/.cursor/skills/)", "Project (.cursor/skills/)"]
- "Should this skill include executable scripts?" with options like ["Yes", "No"]
```

If the AskQuestion tool is not available, ask these questions conversationally.

---

## Skill File Structure

### Directory Layout

Skills are stored as directories containing a `SKILL.md` file:

```
skill-name/
├── SKILL.md              # Required - main instructions
├── reference.md          # Optional - detailed documentation
├── examples.md           # Optional - usage examples
└── scripts/              # Optional - utility scripts
    ├── validate.py
    └── helper.sh
```

### Storage Locations

| Type | Path | Scope |
|------|------|-------|
| Personal | ~/.cursor/skills/skill-name/ | Available across all your projects |
| Project | .cursor/skills/skill-name/ | Shared with anyone using the repository |

**IMPORTANT**: Never create skills in `~/.cursor/skills-cursor/`. This directory is reserved for Cursor's internal built-in skills and is managed automatically by the system.

### SKILL.md Structure

Every skill requires a `SKILL.md` file with YAML frontmatter and markdown body:

```markdown
---
name: your-skill-name
description: Brief description of what this skill does and when to use it
---

# Your Skill Name

## Instructions
Clear, step-by-step guidance for the agent.

## Examples
Concrete examples of using this skill.
```

### Required Metadata Fields

| Field | Requirements | Purpose |
|-------|--------------|---------|
| `name` | Max 64 chars, lowercase letters/numbers/hyphens only | Unique identifier for the skill |
| `description` | Max 1024 chars, non-empty | Helps agent decide when to apply the skill |

---

## Writing Effective Descriptions

The description is **critical** for skill discovery. The agent uses it to decide when to apply your skill.

### Description Best Practices

1. **Write in third person** (the description is injected into the system prompt):
   - ✅ Good: "Processes Excel files and generates reports"
   - ❌ Avoid: "I can help you process Excel files"
   - ❌ Avoid: "You can use this to process Excel files"

2. **Be specific and include trigger terms**:
   - ✅ Good: "Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction."
   - ❌ Vague: "Helps with documents"

3. **Include both WHAT and WHEN**:
   - WHAT: What the skill does (specific capabilities)
   - WHEN: When the agent should use it (trigger scenarios)

### Description Examples

```yaml
# PDF Processing
description: Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.

# Excel Analysis
description: Analyze Excel spreadsheets, create pivot tables, generate charts. Use when analyzing Excel files, spreadsheets, tabular data, or .xlsx files.

# Git Commit Helper
description: Generate descriptive commit messages by analyzing git diffs. Use when the user asks for help writing commit messages or reviewing staged changes.

# Code Review
description: Review code for quality, security, and best practices following team standards. Use when reviewing pull requests, code changes, or when the user asks for a code review.
```

---

## Core Authoring Principles

### 1. Concise is Key

The context window is shared with conversation history, other skills, and requests. Every token competes for space.

**Default assumption**: The agent is already very smart. Only add context it doesn't already have.

Challenge each piece of information:
- "Does the agent really need this explanation?"
- "Can I assume the agent knows this?"
- "Does this paragraph justify its token cost?"

**Good (concise)**:
```markdown
## Extract PDF text

Use pdfplumber for text extraction:

\`\`\`python
import pdfplumber

with pdfplumber.open("file.pdf") as pdf:
    text = pdf.pages[0].extract_text()
\`\`\`
```

**Bad (verbose)**:
```markdown
## Extract PDF text

PDF (Portable Document Format) files are a common file format that contains
text, images, and other content. To extract text from a PDF, you'll need to
use a library. There are many libraries available for PDF processing, but we
recommend pdfplumber because it's easy to use and handles most cases well...
```

### 2. Keep SKILL.md Under 500 Lines

For optimal performance, the main SKILL.md file should be concise. Use progressive disclosure for detailed content.

### 3. Progressive Disclosure

Put essential information in SKILL.md; detailed reference material in separate files that the agent reads only when needed.

```markdown
# PDF Processing

## Quick start
[Essential instructions here]

## Additional resources
- For complete API details, see [reference.md](reference.md)
- For usage examples, see [examples.md](examples.md)
```

**Keep references one level deep** - link directly from SKILL.md to reference files. Deeply nested references may result in partial reads.

### 4. Set Appropriate Degrees of Freedom

Match specificity to the task's fragility:

| Freedom Level | When to Use | Example |
|---------------|-------------|---------|
| **High** (text instructions) | Multiple valid approaches, context-dependent | Code review guidelines |
| **Medium** (pseudocode/templates) | Preferred pattern with acceptable variation | Report generation |
| **Low** (specific scripts) | Fragile operations, consistency critical | Database migrations |

---

## Common Patterns

### Template Pattern

Provide output format templates:

```markdown
## Report structure

Use this template:

\`\`\`markdown
# [Analysis Title]

## Executive summary
[One-paragraph overview of key findings]

## Key findings
- Finding 1 with supporting data
- Finding 2 with supporting data

## Recommendations
1. Specific actionable recommendation
2. Specific actionable recommendation
\`\`\`
```

### Examples Pattern

For skills where output quality depends on seeing examples:

```markdown
## Commit message format

**Example 1:**
Input: Added user authentication with JWT tokens
Output:
\`\`\`
feat(auth): implement JWT-based authentication

Add login endpoint and token validation middleware
\`\`\`

**Example 2:**
Input: Fixed bug where dates displayed incorrectly
Output:
\`\`\`
fix(reports): correct date formatting in timezone conversion

Use UTC timestamps consistently across report generation
\`\`\`
```

### Workflow Pattern

Break complex operations into clear steps with checklists:

```markdown
## Form filling workflow

Copy this checklist and track progress:

\`\`\`
Task Progress:
- [ ] Step 1: Analyze the form
- [ ] Step 2: Create field mapping
- [ ] Step 3: Validate mapping
- [ ] Step 4: Fill the form
- [ ] Step 5: Verify output
\`\`\`

**Step 1: Analyze the form**
Run: \`python scripts/analyze_form.py input.pdf\`
...
```

### Conditional Workflow Pattern

Guide through decision points:

```markdown
## Document modification workflow

1. Determine the modification type:

   **Creating new content?** → Follow "Creation workflow" below
   **Editing existing content?** → Follow "Editing workflow" below

2. Creation workflow:
   - Use docx-js library
   - Build document from scratch
   ...
```

### Feedback Loop Pattern

For quality-critical tasks, implement validation loops:

```markdown
## Document editing process

1. Make your edits
2. **Validate immediately**: \`python scripts/validate.py output/\`
3. If validation fails:
   - Review the error message
   - Fix the issues
   - Run validation again
4. **Only proceed when validation passes**
```

---

## Utility Scripts

Pre-made scripts offer advantages over generated code:
- More reliable than generated code
- Save tokens (no code in context)
- Save time (no code generation)
- Ensure consistency across uses

```markdown
## Utility scripts

**analyze_form.py**: Extract all form fields from PDF
\`\`\`bash
python scripts/analyze_form.py input.pdf > fields.json
\`\`\`

**validate.py**: Check for errors
\`\`\`bash
python scripts/validate.py fields.json
# Returns: "OK" or lists conflicts
\`\`\`
```

Make clear whether the agent should **execute** the script (most common) or **read** it as reference.

---

## Anti-Patterns to Avoid

### 1. Windows-Style Paths
- ✅ Use: `scripts/helper.py`
- ❌ Avoid: `scripts\helper.py`

### 2. Too Many Options
```markdown
# Bad - confusing
"You can use pypdf, or pdfplumber, or PyMuPDF, or..."

# Good - provide a default with escape hatch
"Use pdfplumber for text extraction.
For scanned PDFs requiring OCR, use pdf2image with pytesseract instead."
```

### 3. Time-Sensitive Information
```markdown
# Bad - will become outdated
"If you're doing this before August 2025, use the old API."

# Good - use an "old patterns" section
## Current method
Use the v2 API endpoint.

## Old patterns (deprecated)
<details>
<summary>Legacy v1 API</summary>
...
</details>
```

### 4. Inconsistent Terminology
Choose one term and use it throughout:
- ✅ Always "API endpoint" (not mixing "URL", "route", "path")
- ✅ Always "field" (not mixing "box", "element", "control")

### 5. Vague Skill Names
- ✅ Good: `processing-pdfs`, `analyzing-spreadsheets`
- ❌ Avoid: `helper`, `utils`, `tools`

---

## Skill Creation Workflow

When helping a user create a skill, follow this process:

### Phase 1: Discovery

Gather information about:
1. The skill's purpose and primary use case
2. Storage location (personal vs project)
3. Trigger scenarios
4. Any specific requirements or constraints
5. Existing examples or patterns to follow

If you have access to the AskQuestion tool, use it for efficient structured gathering. Otherwise, ask conversationally.

### Phase 2: Design

1. Draft the skill name (lowercase, hyphens, max 64 chars)
2. Write a specific, third-person description
3. Outline the main sections needed
4. Identify if supporting files or scripts are needed

### Phase 3: Implementation

1. Create the directory structure
2. Write the SKILL.md file with frontmatter
3. Create any supporting reference files
4. Create any utility scripts if needed

### Phase 4: Verification

1. Verify the SKILL.md is under 500 lines
2. Check that the description is specific and includes trigger terms
3. Ensure consistent terminology throughout
4. Verify all file references are one level deep
5. Test that the skill can be discovered and applied

---

## Complete Example

Here's a complete example of a well-structured skill:

**Directory structure:**
```
code-review/
├── SKILL.md
├── STANDARDS.md
└── examples.md
```

**SKILL.md:**
```markdown
---
name: code-review
description: Review code for quality, security, and maintainability following team standards. Use when reviewing pull requests, examining code changes, or when the user asks for a code review.
---

# Code Review

## Quick Start

When reviewing code:

1. Check for correctness and potential bugs
2. Verify security best practices
3. Assess code readability and maintainability
4. Ensure tests are adequate

## Review Checklist

- [ ] Logic is correct and handles edge cases
- [ ] No security vulnerabilities (SQL injection, XSS, etc.)
- [ ] Code follows project style conventions
- [ ] Functions are appropriately sized and focused
- [ ] Error handling is comprehensive
- [ ] Tests cover the changes

## Providing Feedback

Format feedback as:
- 🔴 **Critical**: Must fix before merge
- 🟡 **Suggestion**: Consider improving
- 🟢 **Nice to have**: Optional enhancement

## Additional Resources

- For detailed coding standards, see [STANDARDS.md](STANDARDS.md)
- For example reviews, see [examples.md](examples.md)
```

---

## Summary Checklist

Before finalizing a skill, verify:

### Core Quality
- [ ] Description is specific and includes key terms
- [ ] Description includes both WHAT and WHEN
- [ ] Written in third person
- [ ] SKILL.md body is under 500 lines
- [ ] Consistent terminology throughout
- [ ] Examples are concrete, not abstract

### Structure
- [ ] File references are one level deep
- [ ] Progressive disclosure used appropriately
- [ ] Workflows have clear steps
- [ ] No time-sensitive information

### If Including Scripts
- [ ] Scripts solve problems rather than punt
- [ ] Required packages are documented
- [ ] Error handling is explicit and helpful
- [ ] No Windows-style paths
## Skill: create-subagent

---
name: create-subagent
description: Create custom subagents for specialized AI tasks. Use when you want to create a new type of subagent, set up task-specific agents, configure code reviewers, debuggers, or domain-specific assistants with custom prompts.
disable-model-invocation: true
---
# Creating Custom Subagents

This skill guides you through creating custom subagents for Cursor. Subagents are specialized AI assistants that run in isolated contexts with custom system prompts.

## When to Use Subagents

Subagents help you:
- **Preserve context** by isolating exploration from your main conversation
- **Specialize behavior** with focused system prompts for specific domains
- **Reuse configurations** across projects with user-level subagents

### Inferring from Context

If you have previous conversation context, infer the subagent's purpose and behavior from what was discussed. Create the subagent based on specialized tasks or workflows that emerged in the conversation.

## Subagent Locations

| Location | Scope | Priority |
|----------|-------|----------|
| `.cursor/agents/` | Current project | Higher |
| `~/.cursor/agents/` | All your projects | Lower |

When multiple subagents share the same name, the higher-priority location wins.

**Project subagents** (`.cursor/agents/`): Ideal for codebase-specific agents. Check into version control to share with your team.

**User subagents** (`~/.cursor/agents/`): Personal agents available across all your projects.

## Subagent File Format

Create a `.md` file with YAML frontmatter and a markdown body (the system prompt):

```markdown
---
name: code-reviewer
description: Reviews code for quality and best practices
---

You are a code reviewer. When invoked, analyze the code and provide
specific, actionable feedback on quality, security, and best practices.
```

### Required Fields

| Field | Description |
|-------|-------------|
| `name` | Unique identifier (lowercase letters and hyphens only) |
| `description` | When to delegate to this subagent (be specific!) |

## Writing Effective Descriptions

The description is **critical** - the AI uses it to decide when to delegate.

```yaml
# ❌ Too vague
description: Helps with code

# ✅ Specific and actionable
description: Expert code review specialist. Proactively reviews code for quality, security, and maintainability. Use immediately after writing or modifying code.
```

Include "use proactively" to encourage automatic delegation.

## Example Subagents

### Code Reviewer

```markdown
---
name: code-reviewer
description: Expert code review specialist. Proactively reviews code for quality, security, and maintainability. Use immediately after writing or modifying code.
---

You are a senior code reviewer ensuring high standards of code quality and security.

When invoked:
1. Run git diff to see recent changes
2. Focus on modified files
3. Begin review immediately

Review checklist:
- Code is clear and readable
- Functions and variables are well-named
- No duplicated code
- Proper error handling
- No exposed secrets or API keys
- Input validation implemented
- Good test coverage
- Performance considerations addressed

Provide feedback organized by priority:
- Critical issues (must fix)
- Warnings (should fix)
- Suggestions (consider improving)

Include specific examples of how to fix issues.
```

### Debugger

```markdown
---
name: debugger
description: Debugging specialist for errors, test failures, and unexpected behavior. Use proactively when encountering any issues.
---

You are an expert debugger specializing in root cause analysis.

When invoked:
1. Capture error message and stack trace
2. Identify reproduction steps
3. Isolate the failure location
4. Implement minimal fix
5. Verify solution works

Debugging process:
- Analyze error messages and logs
- Check recent code changes
- Form and test hypotheses
- Add strategic debug logging
- Inspect variable states

For each issue, provide:
- Root cause explanation
- Evidence supporting the diagnosis
- Specific code fix
- Testing approach
- Prevention recommendations

Focus on fixing the underlying issue, not the symptoms.
```

### Data Scientist

```markdown
---
name: data-scientist
description: Data analysis expert for SQL queries, BigQuery operations, and data insights. Use proactively for data analysis tasks and queries.
---

You are a data scientist specializing in SQL and BigQuery analysis.

When invoked:
1. Understand the data analysis requirement
2. Write efficient SQL queries
3. Use BigQuery command line tools (bq) when appropriate
4. Analyze and summarize results
5. Present findings clearly

Key practices:
- Write optimized SQL queries with proper filters
- Use appropriate aggregations and joins
- Include comments explaining complex logic
- Format results for readability
- Provide data-driven recommendations

For each analysis:
- Explain the query approach
- Document any assumptions
- Highlight key findings
- Suggest next steps based on data

Always ensure queries are efficient and cost-effective.
```

## Subagent Creation Workflow

### Step 1: Decide the Scope

- **Project-level** (`.cursor/agents/`): For codebase-specific agents shared with team
- **User-level** (`~/.cursor/agents/`): For personal agents across all projects

### Step 2: Create the File

```bash
# For project-level
mkdir -p .cursor/agents
touch .cursor/agents/my-agent.md

# For user-level
mkdir -p ~/.cursor/agents
touch ~/.cursor/agents/my-agent.md
```

### Step 3: Define Configuration

Write the frontmatter with the required fields (`name` and `description`).

### Step 4: Write the System Prompt

The body becomes the system prompt. Be specific about:
- What the agent should do when invoked
- The workflow or process to follow
- Output format and structure
- Any constraints or guidelines

### Step 5: Test the Agent

Ask the AI to use your new agent:

```
Use the my-agent subagent to [task description]
```

## Best Practices

1. **Design focused subagents**: Each should excel at one specific task
2. **Write detailed descriptions**: Include trigger terms so the AI knows when to delegate
3. **Check into version control**: Share project subagents with your team
4. **Use proactive language**: Include "use proactively" in descriptions

## Troubleshooting

### Subagent Not Found
- Ensure file is in `.cursor/agents/` or `~/.cursor/agents/`
- Check file has `.md` extension
- Verify YAML frontmatter syntax is valid
## Skill: cross-repo-check

---
name: cross-repo-check
description: Cross-repo impact analysis for multi-service changes. Use when modifying shared contracts -- database schemas, MQTT topics, SQS message formats, API endpoints consumed by other services, or event structures. Low frequency but high severity when missed.
triggers: []
related_skills:
  - mqtt
  - feature-dev
  - database-ops
  - deploy
  - code-review
  - api-design
---

# Cross-Repo Check

Run this analysis when a change touches a shared boundary between
services. Missing cross-repo impact is rare (2% of gaps) but causes the
hardest-to-diagnose production issues.

## When to Trigger

Apply this check if the change involves any of:

- Database schema (models, migrations, triggers) -- the notifier and platform
  share the same PostgreSQL database.
- MQTT topic structure or payload format -- shared between platform, Home
  Assistant, your-gateway, and local dev tooling (`ctx/cc/*` topics for
  Command Center, VS Code extension, Teams bot).
- SQS/Kinesis message schemas -- platform writes, your-service consumes.
- API endpoint contracts -- if the endpoint is called by external services
  or other repos.
- Event types or webhook payload structures.
- Shared environment variables or secrets.

## Analysis Steps

### 1. Identify the Contract

What exactly is changing? Name the specific:
- Table/column/trigger being modified
- MQTT topic and payload field
- SQS message type and field
- API endpoint and request/response field

### 2. Find All Consumers

Search across all repos for references to the contract:

```bash
# From the workspace root
for repo in repos/*/; do
  echo "=== $repo ==="
  grep -r "<contract-name>" "$repo" --include="*.{js,ts,py,yaml,json}" -l 2>/dev/null
done
```

Check `docs/architecture.md` for the data flow diagram to identify services
you might miss with grep.

### 3. Assess Impact

For each consumer found:
- Will it break if the contract changes? (breaking vs additive change)
- Does it need a coordinated update? (deploy order matters)
- Is there a graceful degradation path? (can it handle both old and new format?)

### 4. Coordinate the Change

- **Additive changes** (new field, new topic): Deploy the producer first, then
  update consumers. No coordination needed.
- **Breaking changes** (rename, remove, type change): Deploy consumers to
  handle both formats first, then deploy the producer change, then clean up
  the old format handling.
- **Database triggers**: These are invisible to grep. Check for triggers on
  any table being modified: `SELECT * FROM information_schema.triggers WHERE
  event_object_table = '<table>';`

### 5. Document

If the change affects cross-repo contracts, note it in:
- The PR description (which other repos are affected)
- `memory/decisions/` if the contract change is non-obvious
- The commit message (reference affected repos)

## Known Landmines

- **Platform DB triggers affecting notifier**: The platform has triggers that
  fire on certain table changes. The notifier reads the same tables. A
  migration that changes trigger behavior can silently break notifications.
- **MQTT topic naming**: Topic structure is hierarchical and position-dependent.
  Changing a level affects all subscribers at that level and below.
- **Contact list normalization**: Phone number formatting differs between
  services. A normalization change in one repo can corrupt routing in another.
## Skill: database-ops

---
name: database-ops
description: Database schema, migrations, and model operations for the platform. Use when creating migrations, modifying Sequelize models, fixing schema drift, generating context, or working with encryption at the model level.
triggers:
  - cross-repo-check
related_skills:
  - deploy
  - feature-dev
  - security-audit
---

# Database Operations

Apply these patterns when working with the PostgreSQL database, Sequelize
models, or migrations in `repos/your-app/`.

## Schema Ownership

- The platform repo owns the database schema. All migrations live in the
  platform's migration directory.
- The `context/` directory in the root repo contains generated artifacts
  (schema dumps, drift reports, TypeScript interfaces). These are derived
  from the live DB and models -- never edit them manually.

## Migrations

- Every schema change requires a migration file. Never modify the database
  directly.
- Migrations must be reversible. The `down` function must undo exactly what
  `up` does.
- Use transactions in migrations. Wrap the entire `up` and `down` in a
  transaction so partial failures do not leave the schema in a broken state.
- Name migrations descriptively:
  `YYYYMMDDHHMMSS-add-encryption-to-webhook-secrets.js`
- When adding encryption to existing plaintext columns, write a data migration
  that: (a) reads existing values, (b) encrypts them, (c) writes them back,
  with a guard against double-encryption and a rollback path.

## Sequelize Models

- Models define the source of truth for column types, constraints, and
  associations.
- Use getters/setters for transparent field-level encryption. The application
  code should not need to know that a field is encrypted.
- Validate model definitions against the actual DB state using drift reports.
  The `tools/db/` scripts generate these.

## Schema Drift Detection

- Drift reports compare Sequelize model definitions against the live database
  schema. Discrepancies indicate either a missing migration or a model that
  is out of sync.
- After fixing drift, regenerate context artifacts to keep them current.
- Common drift sources: default values that differ between model and migration,
  column types that were changed in the DB but not the model, indexes added
  directly via SQL.

## Query Patterns

- Use Sequelize query methods (findAll, findOne, create, update, destroy)
  over raw SQL unless performance requires it.
- Always scope queries by organization. Multi-tenant data leakage is a
  critical security concern.
- Include appropriate `attributes` lists to avoid selecting unnecessary columns,
  especially encrypted fields.

## Before Completing Database Work

1. Verify the migration runs cleanly: `up` then `down` then `up` again.
2. Check drift reports before and after to confirm the change resolved the
   discrepancy.
3. If the change touches encrypted fields, verify the encryption roundtrip.
4. Regenerate context artifacts if the schema changed.
5. Run `/code-review` and `/security-audit` for any encryption-related changes.

## Additional Resources

- For migration templates, encryption data migration, and drift workflow, see [references/migration-patterns.md](references/migration-patterns.md)
## Skill: debug

---
name: debug
description: Systematic debugging and diagnosis workflow. Use when investigating bugs, unexpected behavior, test failures, or production incidents. Covers root cause analysis, isolation techniques, and verification. Addresses the most common agent error pattern -- wrong approach first.
triggers:
  - memory
  - cloudwatch-logs
related_skills:
  - preflight
  - guardduty
  - file-analysis
---

# Debug

Follow this structured workflow when diagnosing a bug or unexpected behavior.
The goal is to find the root cause, not just suppress the symptom.

## Step 1: Reproduce

Before theorizing, confirm you can observe the failure:

- Read the error message, stack trace, or user description carefully.
- Identify the exact input, state, and sequence that triggers the bug.
- If the bug is intermittent, note the conditions under which it appears
  and does not appear.
- Do not skip this step. Many debugging failures start with an assumed
  reproduction that turns out to be wrong.

## Step 2: Isolate

Narrow the search space before reading code:

- **Binary search the call chain**: Start at the failure point and trace
  backward. Is the bad data coming from the caller, the database, the API,
  or the UI?
- **Check the boundaries**: Bugs often hide at integration points -- between
  frontend and backend, between services, between the app and the database.
- **Timestamp and format mismatches**: A recurring pattern in this codebase.
  ISO 8601 vs human-readable, UTC vs local, string vs Date object.
- **Re-mount state resets**: In React, component unmount/remount cycles reset
  `useState`. If state disappears on re-render, the component is being
  unmounted by a parent conditional.

## Step 3: Root Cause

Identify the actual cause, not a proximate symptom:

- Ask "why" at least twice. The first answer is usually the symptom.
- **Common root causes in this codebase**:
  - Missing encryption key on webhook reset (crash-level).
  - DB triggers in your-app causing unexpected side effects in your-service.
  - Contact list routing normalization silently corrupting phone numbers.
  - React lifecycle issues where modals reset state on parent re-render.
  - IAM credential expiration during long-running operations.
- Look for "landmine" bugs: code that works in the common case but fails on
  edge inputs. Normalization functions and regex parsers are frequent culprits.

## Step 4: Fix

Apply the minimal correct fix:

- Fix the root cause, not the symptom. A try/catch that swallows the error
  is not a fix.
- If the fix is in one repo but the bug manifests in another, check
  `docs/architecture.md` for the data flow to ensure the fix is in the
  right place.
- Consider whether the bug class could exist elsewhere. If a timestamp
  format mismatch caused this bug, grep for similar patterns.

## Step 5: Verify

Prove the fix works and does not regress:

- Reproduce the original failure scenario and confirm it no longer occurs.
- Run the existing test suite to check for regressions.
- If no test covers this case, write one.
- For cross-repo bugs, verify the fix at both ends of the integration.

## Anti-Patterns to Avoid

- **Shotgun debugging**: Making multiple changes at once without understanding
  which one fixes the issue. Change one thing, test, repeat.
- **Wrong approach first**: The most common agent error (157 occurrences).
  Resist the urge to start coding a fix before completing Steps 1-3.
- **Searching empty paths**: If a search returns nothing, do not retry the
  same search with minor variations. Re-evaluate your assumptions about
  where the code lives.
- **Ignoring empty tool output**: Empty search results are information. They
  mean the thing you are looking for does not exist at that path.

## Additional Resources

- For detailed codebase-specific root causes, see [references/codebase-patterns.md](references/codebase-patterns.md)
## Skill: deploy

---
name: deploy
description: CI/CD and deployment workflows for your services. Use when modifying GitHub Actions, deploying to staging/production, managing environment configuration, or troubleshooting deployment failures. Covers the full pipeline from branch to production.
triggers:
  - staging-test
related_skills:
  - database-ops
  - cross-repo-check
  - cloudwatch-logs
  - security-audit
  - git-ops
---

# Deploy

Apply this workflow when working with CI/CD pipelines, deployment
configuration, or promoting changes through environments.

## Pipeline Structure

- Each repo has independent CI/CD via GitHub Actions.
- PRs trigger lint, type-check, and test jobs. Merges to main trigger deploy.
- The platform deploys to AWS Elastic Beanstalk. The notifier deploys as
  Lambda functions via Serverless Framework.
- Secrets are managed via GitHub Actions secrets, sourced from AWS Secrets
  Manager.

## Pre-Deployment Checklist

1. `git status` shows a clean staging area -- no untracked files that should
   be committed, no accidentally staged files.
2. All quality gates pass locally: lint, types, tests.
3. Environment variables and secrets required by the change are present in
   the target environment. Use `gh secret list` to verify.
4. If the change adds a new secret, update the GitHub Action workflow to
   reference it and coordinate the secret creation in AWS.

## Common Deployment Patterns

- **Git stash/branch isolation**: When cleanup changes mix with feature work,
  use `git stash` to isolate them into separate branches and PRs.
- **Incremental CI/CD blockers**: Deployment failures often cascade. Fix the
  first failure, re-run, and address the next. Do not try to fix all blockers
  in a single pass without verifying each fix.
- **JSON/YAML validation**: Validate configuration files before deploying.
  A malformed config can take down the service.

## Environment Configuration

- Staging and production share the same codebase but differ in environment
  variables. Changes that depend on new env vars must have those vars set
  in the target environment before deploying.
- AWS credentials use IAM roles with SSO. Credential timing issues (expired
  tokens) are a known failure mode -- refresh SSO before long operations.
- Elastic Beanstalk deployments can take several minutes. Do not cancel and
  retry impatiently -- check the EB console for status.

## Troubleshooting Failures

- Check GitHub Actions logs first. The failing step usually names the issue.
- For EB deployment failures, check the EB health dashboard and recent events.
- For Lambda deployment failures, check CloudFormation stack events.
- IAM permission errors often manifest as vague "access denied" messages.
  Check the role's policy and trust relationship.

## Before Completing Deployment Work

1. Verify the pipeline runs green on a test push.
2. Confirm secrets and env vars are set in the target environment.
3. For workflow changes, validate YAML syntax before committing.
4. Run `/code-review` on any modified workflow files.

## Additional Resources

- For pipeline structure, secrets flow, and failure modes, see [references/pipeline-details.md](references/pipeline-details.md)
## Skill: feature-dev

---
name: feature-dev
description: Feature development workflow for your organization. Optimized for high-autonomy agents handling multi-repo implementations, schema migrations, and Jira-integrated PRs.
triggers:
  - preflight
  - commit-format
  - cross-repo-check
  - code-review
related_skills:
  - mqtt
  - action-ticket
  - finish-ticket
  - refactoring
  - database-ops
  - security-audit
  - playwright
---

# Feature Development Workflow

Guidelines for developing new features across your organization's repositories with high architectural awareness and operational trust.

## 1. Discovery & Strategy

- **Memory & Standards**: Invoke `/memory` immediately. Search for 'Standard', 'Strategy', or 'Principles' docs before implementing cross-cutting concerns (logging, auth, UI).
- **Pattern Matching**: Search for existing UI components (e.g., 'drawer', 'viewer') and patterns before creating 'new' ones. Use `grep` or `glob` to find prior art.
- **Dependency Audit**: Verify `package.json` or `requirements.txt` before assuming a library is available. Do not guess versions.

## 2. Baseline & Pre-flight

- **Git Freshness**: Check `git status -sb` and `git fetch`. If `behind`, warn the user. Starting on a stale branch increases merge conflict risk.
- **Integration Health**: Verify reachability of Jira and AWS. Use direct API fallbacks if local caches/sync tools are incomplete.
- **Environment**: Ensure JIRA_PROJECTS and AWS_PROFILE are set. See `checklists/pre-flight.md`.

## 3. Implementation & Quality Gates

- **Quality Tools**: Prefer `ctx workspace check --quick` over individual lints. Use structured test reporters or `grep` to analyze results; avoid `tail` as it misses exit codes.
- **Modular Design**: Extract logic into custom hooks early. Use barrel exports (index.ts) when splitting modules to maintain clean import paths.
- **Dynamic UI**: Prioritize extensible, dynamic data mapping over hardcoded views. Address information density concerns by enhancing existing components rather than overwriting.

## 4. Commits & PR Lifecycle

- **Migration Safety**: For data/schema changes, implement validation scripts and 'dry-run' modes. Use `checklists/migration-safety.md`.
- **PR Generation**: Summarize from the full diff (`git diff main...HEAD`). Ensure Jira tickets transition only after successful integration.
- **Final Cleanup**: Return all sub-repos to `main`. Navigate to the context root before ending.

## 5. Checklists

- [ ] **Pre-flight Check**: Memory invoked, git up-to-date, environment verified (`checklists/pre-flight.md`).
- [ ] **Discovery Sweep**: Existing patterns found, strategy docs read (`examples/discovery-sweep.md`).
- [ ] **UI/UX Alignment**: Dynamic mapping used, layout injection considered (`checklists/ui-ux-standards.md`).
- [ ] **Quality Verification**: `ctx workspace check` passed, no `tail` used for summaries.
- [ ] **Cleanup**: No floating branches, repos on main.
## Skill: file-analysis

---
name: file-analysis
description: Structured file analysis for your organization's codebases. Use when examining, understanding, or preparing to modify a file. Covers responsibility identification, dependency tracing, code quality, security posture, and testability assessment.
triggers: []
related_skills:
  - code-review
  - refactoring
  - cross-repo-check
  - modular-design
---

# File Analysis Standards

When examining or modifying a file, apply this structured analysis to understand
the file's role, quality, and security posture before making changes.

## Identify Responsibility

- What is this file's single responsibility? If it has multiple, flag for
  potential splitting.
- Which repository does this file belong to? Check `AGENTS.md` for that repo's
  ownership boundaries.
- Is this file a handler, service, utility, model, controller, component, or
  configuration? Understand its architectural layer.

## Trace Dependencies

- Map the file's imports: what does it depend on?
- Map the file's exports: what depends on it?
- Identify cross-repo touchpoints:
  - Does it read/write to the shared PostgreSQL database?
  - Does it publish/subscribe to MQTT topics?
  - Does it produce/consume SQS or Kinesis messages?
  - Does it call external APIs (Twilio, SendGrid, RapidResponse, CAD)?
- Flag circular dependencies or overly deep import chains.

## Assess Code Quality

- **Size**: Is the file approaching or exceeding ~400 lines? Consider splitting.
- **Complexity**: Are there deeply nested conditionals or long function bodies?
  Flag for extraction.
- **Naming**: Do variables, functions, and classes clearly convey intent?
- **Dead code**: Are there unused imports, unreachable branches, or
  commented-out blocks?
- **Duplication**: Is logic repeated that could be extracted to a shared utility?
- **Error handling**: Are errors caught, logged with context, and propagated
  appropriately?

## Assess Security Posture

- Are user inputs validated and sanitized before use?
- Are database queries parameterized (no string concatenation for SQL)?
- Is sensitive data (passwords, tokens, PII) handled securely?
  - Not logged in plaintext
  - Encrypted at rest and in transit
  - Not exposed in error messages
- Are authentication/authorization checks present where needed?
- Are external service calls made over HTTPS with proper certificate validation?
- Are secrets fetched from environment variables or a secrets manager (not
  hardcoded)?

## Assess Testability

- Can the core logic be tested without I/O (network, DB, filesystem)?
- Are side effects isolated at the edges, or entangled with business logic?
- Does the file have corresponding test coverage? If not, flag the gap.
- Are there implicit dependencies (global state, singletons) that make
  testing difficult?

## Report Format

When analyzing a file, provide a concise assessment covering:
1. **Purpose**: One-sentence description of the file's responsibility.
2. **Layer**: Architectural layer (handler, service, utility, model, component).
3. **Dependencies**: Key imports and what depends on this file.
4. **Issues**: Any code quality, security, or maintainability concerns.
5. **Recommendations**: Specific, actionable improvements if applicable.
## Skill: frontend-patterns

---
name: frontend-patterns
description: React frontend patterns and conventions. Use when building or modifying UI components, dashboard views, modals, forms, or CSS in your-app. Covers component structure, state management, styling, and accessibility.
triggers:
  - code-review
  - staging-test
  - ui-design
related_skills:
  - feature-dev
  - api-design
  - ui-design
  - security-audit
  - sos-branding
---

# Frontend Patterns

Apply these patterns when working on React components in the platform
frontend (`repos/your-app/client/`).

## Component Structure

- One component per file unless tightly coupled (e.g., a list + list item).
- Prefer functional components with hooks over class components.
- Extract reusable logic into custom hooks (`useAlerts`, `useZones`, etc.).
- Keep components under ~200 lines. Split into sub-components at that threshold.
- Co-locate component-specific styles, types, and test files.

## State Management

- Local state (`useState`) for UI-only concerns (modals, form inputs, toggles).
- Context for cross-component state that does not need persistence (auth user,
  theme, active organization).
- API state via the existing fetch/cache pattern in the codebase -- check how
  sibling components handle data loading before introducing new patterns.
- Avoid prop drilling beyond 2 levels. Lift state or use context.

## Compact / Embedded Mode

Components that appear in both full-size views and embedded previews (e.g.,
InteractiveMap inside FloorplanPreviewPanel) should accept a `compact` prop.

- When `compact` is true, hide chrome that only makes sense at full size:
  toolbars, filter panels, floor selectors, settings overlays.
- Move essential controls (e.g., floor navigation) to the parent container's
  header instead of overlaying them on the embedded content.
- Design for this from the start when building any component that may be
  reused in a card, panel, or modal.

## Imperative Libraries + React Lifecycle

Map libraries (Mapbox GL, Leaflet), canvas-based renderers, and D3 manage
their own DOM. React's useEffect teardown/recreate cycle conflicts with this.

- **Separate mount from update.** One effect for adding the source/layer
  (runs on mount, cleans up on unmount). A second effect for updating
  properties in-place (`updateImage()`, `setPaintProperty()`).
- **Use refs for mutable state** (`addedRef`) to track whether the
  imperative resource exists, avoiding redundant add/remove cycles.
- **Use stable IDs.** Key imperative resources on identity (e.g., `orgId`),
  not on volatile props (e.g., `floor`, `timestamp`). Update those properties
  in-place instead of destroying and recreating.
- **Set fade/transition durations to 0** for programmatic updates. Animated
  transitions during data-driven repaints look like flicker.

## Proximity-Based Auto-Selection

For map views where a zoomed-in state should activate context (overlays,
panels, details) for the nearest entity:

- Compute nearest entity to viewport center using squared-distance (no sqrt
  needed for comparison).
- Use a `didAutoSelect` ref to prevent re-running on every pan while zoomed.
- Clear the selection and reset the ref when zoom drops below threshold so
  re-detection works on the next zoom-in.
- Still allow manual selection (pin click) to override the auto-selected
  entity.

## Common Pitfalls in This Codebase

- **React lifecycle re-mount resets**: Modal state resets when the parent
  re-renders and the modal component unmounts/remounts. Use stable keys or
  lift state above the conditional render.
- **AlertNotificationBadge and AppBar coupling**: These share UserAlerts API
  data. Changes to one often require changes to the other.
- **Form validation**: Validate on blur and on submit. Server-side validation
  errors must surface in the UI, not just console.
- **useEffect placement**: If an effect references variables from hooks or
  memos, define the effect after those declarations. ESLint's
  `no-use-before-define` will reject the commit otherwise.

## CSS Conventions

- Use the existing variable system (`--sos-gold`, `--sos-gold-light`, etc.)
  for brand colors. Never hardcode hex values for brand colors. The
  authoritative palette is in `/sos-branding` -- consult it when adding new
  tokens or verifying existing ones.
- Responsive breakpoints: mobile at 500px, tablet at 768px.
- Prefer CSS Grid for layout, Flexbox for alignment within rows.

## Before Completing Frontend Work

1. Verify the component renders without console errors.
2. Check that interactive elements have hover/focus states.
3. Confirm the change works at the narrowest responsive breakpoint.
4. Run `/code-review` to validate naming, security, and maintainability.
5. For platform changes, run `/staging-test` or `/browser-checker` to confirm
   the UI renders correctly in the running app.

## Additional Resources

- For component structure examples and common patterns, see [references/component-examples.md](references/component-examples.md)
- For CSS variable reference and styling guide, see [references/css-variables.md](references/css-variables.md)
## Skill: git-ops

---
name: git-ops
description: Git operations and workflow patterns for your organization's repos. Use when managing branches, resolving merge conflicts, handling pre-commit hooks, staging changes, or coordinating multi-branch work. Complements /commit-format which covers message conventions only.
triggers:
  - commit-format
related_skills:
  - feature-dev
  - finish-ticket
  - deploy
---

# Git Operations

Apply these patterns for git operations across your organization's repositories. Each sub-repo
under `repos/` has its own git history and remote. The root repo tracks only
workspace-level config.

## Branching

- Feature branches: `feature/<ticket-id>-<short-description>`
- Bug fixes: `fix/<ticket-id>-<short-description>`
- Always branch from the latest `main`. Pull before branching:
  `git checkout main && git pull && git checkout -b feature/SWE-XXX-desc`
- Check for existing branches before creating:
  `git branch -a | grep <ticket-id>`
- Never commit sub-repo files into the root repo. The pre-commit hook
  enforces this.

## Pre-Commit Hooks

This workspace uses pre-commit hooks that run lint and format checks. Common
issues:

- **Large commits fail slowly**: Hooks run on all staged files. For large
  merges or bulk changes, consider committing in smaller batches.
- **Hook failures are not errors in your code**: Read the hook output. It
  often auto-fixes files (formatting, import sorting). After a hook failure,
  check `git diff` -- the fix may already be applied and just needs to be
  re-staged.
- **Do not skip hooks** (`--no-verify`) unless explicitly asked by the user.
  The hooks exist to maintain code quality.

## Staging Strategy

- Stage intentionally. Use `git add <specific-files>` over `git add .` to
  avoid accidentally staging unrelated changes.
- Review staged changes before committing: `git diff --cached`.
- If working changes mix feature work with unrelated cleanup, isolate them:
  ```
  git stash push -m "feature work"
  git add <cleanup-files> && git commit
  git stash pop
  ```

## Merge Conflicts

- When resolving conflicts, understand both sides before choosing. Read the
  PR description or commit messages for context on what the other branch was
  doing.
- After resolving, run the test suite to confirm the merge did not break
  anything.
- For complex conflicts (5+ files), resolve one file at a time and verify
  each resolution compiles before moving to the next.

## Multi-Branch Coordination

- When working across repos (e.g., platform schema change + service handler),
  create branches in both repos with the same ticket ID.
- Merge the dependency first (usually platform/schema), then the dependent
  (service/handler).
- Use `git stash` to context-switch between repos without losing work.

## Recovery Patterns

- **Undo last commit (not pushed)**: `git reset --soft HEAD~1`
- **Discard unstaged changes**: `git checkout -- <file>` (destructive)
- **Wrong branch**: `git stash && git checkout correct-branch && git stash pop`
- **Committed to main by accident**: Ask the user before force-pushing. Move
  the commit to a feature branch instead.
## Skill: idor-audit

---
name: idor-audit
description: Focused IDOR / tenant-boundary audit. Use when changes affect permissions, controller/authorizer logic, list filters, or any endpoint that accepts IDs (org_id, agency_id, contactlist_id, etc.).
triggers:
  - security-audit
related_skills:
  - code-review
  - cross-repo-check
---

# IDOR / Tenant Boundary Audit

Use this when reviewing or shipping changes that might let a user access or mutate something they shouldn't.

## Step 0: Permission / Exposure Delta (Answer explicitly)

- **Permission delta**: Did this change alter *who* can read/write/delete anything?
  - New roles allowed? Existing roles widened?
  - Any "associated via junction table" path now authorizes mutations?
- **Exposure delta**: Did this change add/modify endpoints, filters, modes, joins, or includes that return more data?
  - New list endpoints or new query params that can be used for enumeration?
  - Any "drop the org filter" pattern introduced (e.g., switching to `id IN (...)` without scoping)?
- **Tenant boundary**: Is the request allowed to name tenant IDs (org_id/agency_id/etc.)?
  - If yes, where is the server-side validation that the requested ID is within the actor's authorized set?
  - If no, ensure scope is derived from session/user context and client-supplied scope is rejected.

## Read Paths (List/Show)

- **Org scoping stays explicit**: list endpoints must scope by `org_id` (or equivalent join constraint) for non-super-admins.
- **Search/pagination cannot widen scope**: `_search`, `filter.*`, and `sort` must filter *within* already-authorized rows.
- **Association-based reads are bounded**: if records are multi-tenant via junction tables, confirm associations cannot be abused to read cross-tenant data.

## Write Paths (Create/Update/Delete)

- **Owner vs consumer roles**: for shared resources (e.g., agency-owned objects used by child orgs), decide who can *mutate* vs who can only *read*.
- **Association mutation is scoped**: any `setOrganizations/addOrganizations` must validate target org IDs are allowed for the actor (and within the owning agency when applicable).
- **No ownership field writes**: ownership fields should not be editable unless super-admin and explicitly audited.
- **Secondary effects**: deletes/updates must not trigger cross-tenant cleanup.

## Required Security Tests (Small, High-Value)

At minimum, add or confirm tests that cover:

- **Negative authorization**: unauthorized role gets 403 for cross-tenant Show/List and Update/Delete.
- **Association mutation**: unauthorized org IDs in association updates are rejected.
- **Shared resources**: child-org admins cannot mutate agency-owned/shared assets.

## Cross-Repo Check (your-app vs your-service)

If the change touches platform DB associations that your-service uses for routing, validate your-service assumptions too:

- `OrganizationContactList`, contact list triggers, message profile contact list joins
- Alert type / event type routing changes

Sanity checks:

- your-service queries should not rely on platform-side associations that platform allows untrusted actors to mutate.
- If routing semantics change, update your-service tests that encode routing expectations.
## Skill: image-gen

---
name: image-gen
description: >-
  Generate AI images using OpenAI (DALL-E 3), AWS Bedrock, or Google
  Gemini/Imagen. Requires OPENAI_API_KEY or GEMINI_API_KEY.
related_skills:
  - announce
  - sos-branding
---

# Image Generation

Generate AI images using OpenAI (DALL-E 3), AWS Bedrock, or Google Gemini/Imagen.

## Capabilities

- **OpenAI (Default):** Uses DALL-E 3 for high-quality generation. Requires `OPENAI_API_KEY`.
- **AWS Bedrock:** Uses Titan or Nova Canvas. Requires AWS credentials in `us-east-1` or `us-west-2` (not available in GovCloud West 1).
- **Google Gemini:** Uses Imagen 3/4. Requires `GEMINI_API_KEY`.

## Usage

Run the image generation tool via the ctx CLI.

### Basic (OpenAI DALL-E 3)

```bash
ctx image generate --mode openai --type "a futuristic city"
```

### AWS Bedrock

```bash
ctx image generate --mode bedrock --type "dashboard UI mockup"
```

### Google Gemini (Imagen)

```bash
ctx image generate --mode gemini --type "satellite view map"
```

## Configuration

- **Output:** Images are saved to `playground/images/` by default.
- **API Keys:** set `OPENAI_API_KEY` or `GEMINI_API_KEY` in `.env`.

## Branding

When generating images for your organization's materials (announcement cards, marketing,
presentations), include brand cues in the prompt: dark backgrounds
(`#0A0A0C`), gold accents (`#C9A84C`), and the authority/protection
aesthetic. See `/sos-branding` for the full palette and logo rules.
## Skill: local-ai

---
name: local-ai
description: Interact with the local Ollama model running on the MQTT bus. Use when you need zero-cost, low-latency inference -- drafting text, naming things, summarizing, brainstorming, or triaging errors. Triggers on mentions of local model, Ollama, quick draft, or free inference.
---

# Local AI

A tiny Ollama model runs as an MQTT background service on the workspace bus.
Zero cost, zero latency, runs entirely on the user's machine.

## MCP Tools

| Tool | Use case |
|------|----------|
| `cc_local_ai_prompt` | Synchronous prompt -- send text, get a response back immediately |
| `cc_local_ai_status` | Check if the local model is running and which model is loaded |
| `cc_local_ai_mqtt_prompt` | Async prompt via MQTT -- fire-and-forget, reply on a topic |

## When to Use

- **Session naming**: Handled automatically. The service listens to `ctx/session/+/started` and labels sessions.
- **Quick drafts**: Commit messages, PR titles, short descriptions. Use `cc_local_ai_prompt`.
- **Brainstorming**: Generate name ideas, taglines, or alternatives. Fast iteration at zero cost.
- **Summaries**: Condense log output, error traces, or long text into a short summary.
- **Triage**: Pipe an error message through and get a one-line explanation.

## MQTT Protocol

Any service on the bus can use the local AI by publishing to MQTT:

**Request** -- publish to `ctx/local-ai/prompt`:
```json
{
  "prompt": "Summarize this error: ...",
  "maxTokens": 200,
  "temperature": 0.7,
  "replyTo": "ctx/my-service/ai-reply"
}
```

**Response** -- arrives on `replyTo` (default `ctx/local-ai/reply`):
```json
{ "ok": true, "response": "..." }
```

## Limitations

- Model is small (qwen2.5:0.5b by default) -- good for short generation, not complex reasoning.
- First call after cold start has ~8s model load latency. Subsequent calls are ~100ms.
- Max useful output is ~200 tokens. Beyond that, quality degrades.

## Checking Status

Use `cc_local_ai_status` or read the retained MQTT topic:

```
Topic: ctx/local-ai/status
Payload: { "status": "online", "model": "qwen2.5:0.5b" }
```
## Skill: memory

---
name: memory
description: Persistent agent memory for cross-session context. Use when starting a session, making an architectural decision, hitting a recurring issue, or wrapping up work. Manages progress, decisions, known issues, and preferences across sessions.
triggers: []
related_skills:
  - preflight
  - retrospective
  - contribute
  - action-ticket
---

# Memory Skill

Persistent memory survives across sessions. This skill automates reading
relevant context at the start of work and writing structured entries at
milestones and session end.

The backing tool is `ctx memory`, which indexes all files in
`memory/` and supports scored search, structured writes, listing, and pruning.

For file format and trigger guidance, see the `memory.mdc` rule.

---

## Session-Start Read

Run this workflow at the beginning of any session involving implementation,
debugging, or investigation. The goal is to load relevant prior decisions,
progress, and known issues before touching code.

### 1. Determine Context

Extract the current ticket and repo from available signals:

- **Branch name**: `git branch --show-current` often contains a ticket ID
  (e.g., `feature/swe-559-rtsp-transcoding`)
- **User's stated task**: the user may reference a ticket, repo, or topic
- **Open files**: the repo can be inferred from file paths under `repos/`

If no ticket or repo can be determined, skip to a broad scan.

### 2. Run Scan

```bash
ctx memory scan --ticket SWE-XXX --repo your-app --top 10
```

Use whichever flags are available. All are optional -- the scan scores and
ranks all memory files, with higher relevance for matching ticket, repo,
recency, and keyword overlap.

If the user mentions a topic rather than a ticket:

```bash
ctx memory scan --query "transcoding rtsp"
```

### 3. Review Results

The scan returns a scored summary. For entries scoring above 50, read the
full file with the Read tool to load detailed context. For entries scoring
below 50, the one-line summary is usually sufficient.

### 4. Report

Briefly mention what was found (or that nothing relevant exists) before
proceeding with the task. Do not dump full file contents to the user unless
asked -- a one-sentence summary per relevant entry is enough.

---

## Write: Progress

Write a progress entry when:

- Completing a milestone on multi-session work
- Creating a PR
- Ending a session where code changes were made

Use the template at [assets/progress-template.md](assets/progress-template.md).
Save to `/tmp/memory-progress.md`, then run the write command. Writes to
`memory/progress/<slug>.md`. Clean up: `rm -f /tmp/memory-progress.md`.

---

## Write: Decision

Write a decision entry when a non-obvious architectural or design choice is
made. The audience is future developers and agents with no context on the
current session.

Use the template at [assets/decision-template.md](assets/decision-template.md).
Save to `/tmp/memory-decision.md`, then:

```bash
ctx memory write --type decisions --title "JWT expiration strategy" --ticket SWE-400 --repo your-app --body /tmp/memory-decision.md
```

Clean up: `rm -f /tmp/memory-decision.md`.

---

## Write: Known Issue

Write when discovering a recurring issue, environment quirk, or workaround
that others should know about.

Use the template at [assets/known-issue-template.md](assets/known-issue-template.md).
Save to `/tmp/memory-known-issue.md`, then:

```bash
ctx memory write --type known-issues --title "Sequelize migration lock on concurrent deploys" --body /tmp/memory-known-issue.md
```

Clean up: `rm -f /tmp/memory-known-issue.md`.

---

## Other Memory Types

For preferences, observations, and environment entries, use the same write
pattern with the appropriate `--type` flag. These are gitignored (local to
the current machine) and can be less formal:

```bash
ctx memory write \
  --type preferences \
  --title "Naming and style" \
  --body /tmp/memory-pref.md
```

---

## Listing and Pruning

### List All Memory

```bash
ctx memory list
ctx memory list --type progress --days 14
```

### Prune Stale Progress

Progress files for completed and merged work can be cleaned up:

```bash
ctx memory prune --type progress --days 30
ctx memory prune --type progress --days 30 --confirm
```

Prune is dry-run by default. Pass `--confirm` to actually delete. Only run
prune on `progress` files -- decisions and known-issues are long-lived.

---

## Trigger Checklist

Use this during and after a session:

1. **Session starting?** Run scan to load context.
2. **Made a non-obvious choice?** Write a decision.
3. **Hit a wall or found a workaround?** Write a known issue.
4. **Developer corrected you or expressed a preference?** Write a preference.
5. **Learned something about the local environment?** Write an environment note.
6. **Session ending with code changes?** Write a progress entry.

If any answer is yes and no memory entry exists for it, write one now.

---

## Error Handling

- If `memory.sh` is not executable, ensure `ctx` CLI is available (e.g., `pip install -e tools/` or activate venv).
- If the scan returns no results, proceed without prior context and note the
  gap to the user.
- If the write fails (missing --body file, invalid --type), fix the input and
  retry. Do not skip the memory write silently.
- Never include secrets, credentials, or PII in memory entries.
## Skill: migrate-to-skills

---
name: migrate-to-skills
description: Convert 'Applied intelligently' Cursor rules (.cursor/rules/*.mdc) and slash commands (.cursor/commands/*.md) to Agent Skills format (.cursor/skills/). Use when you want to migrate rules or commands to skills, convert .mdc rules to SKILL.md format, or consolidate commands into the skills directory.
disable-model-invocation: true
---
# Migrate Rules and Slash Commands to Skills

Convert Cursor rules ("Applied intelligently") and slash commands to Agent Skills format.

**CRITICAL: Preserve the exact body content. Do not modify, reformat, or "improve" it - copy verbatim.**

## Locations

| Level | Source | Destination |
|-------|--------|-------------|
| Project | `{workspaceFolder}/**/.cursor/rules/*.mdc`, `{workspaceFolder}/.cursor/commands/*.md` |
| User | `~/.cursor/commands/*.md` |

Notes:
- Cursor rules inside the project can live in nested directories. Be thorough in your search and use glob patterns to find them.
- Ignore anything in ~/.cursor/worktrees
- Ignore anything in ~/.cursor/skills-cursor. This is reserved for Cursor's internal built-in skills and is managed automatically by the system.

## Finding Files to Migrate

**Rules**: Migrate if rule has a `description` but NO `globs` and NO `alwaysApply: true`.

**Commands**: Migrate all - they're plain markdown without frontmatter.

## Conversion Format

### Rules: .mdc → SKILL.md

```markdown
# Before: .cursor/rules/my-rule.mdc
---
description: What this rule does
globs:
alwaysApply: false
---
# Title
Body content...
```

```markdown
# After: .cursor/skills/my-rule/SKILL.md
---
name: my-rule
description: What this rule does
---
# Title
Body content...
```

Changes: Add `name` field, remove `globs`/`alwaysApply`, keep body exactly.

### Commands: .md → SKILL.md

```markdown
# Before: .cursor/commands/commit.md
# Commit current work
Instructions here...
```

```markdown
# After: .cursor/skills/commit/SKILL.md
---
name: commit
description: Commit current work with standardized message format
disable-model-invocation: true
---
# Commit current work
Instructions here...
```

Changes: Add frontmatter with `name` (from filename), `description` (infer from content), and `disable-model-invocation: true`, keep body exactly.

**Note:** The `disable-model-invocation: true` field prevents the model from automatically invoking this skill. Slash commands are designed to be explicitly triggered by the user via the `/` menu, not automatically suggested by the model.

## Notes

- `name` must be lowercase with hyphens only
- `description` is critical for skill discovery
- Optionally delete originals after verifying migration works

### Migrate a Rule (.mdc → SKILL.md)

1. Read the rule file
2. Extract the `description` from the frontmatter
3. Extract the body content (everything after the closing `---` of the frontmatter)
4. Create the skill directory: `.cursor/skills/{skill-name}/` (skill name = filename without .mdc)
5. Write `SKILL.md` with new frontmatter (`name` and `description`) + the EXACT original body content (preserve all whitespace, formatting, code blocks verbatim)
6. Delete the original rule file

### Migrate a Command (.md → SKILL.md)

1. Read the command file
2. Extract description from the first heading (remove `#` prefix)
3. Create the skill directory: `.cursor/skills/{skill-name}/` (skill name = filename without .md)
4. Write `SKILL.md` with new frontmatter (`name`, `description`, and `disable-model-invocation: true`) + blank line + the EXACT original file content (preserve all whitespace, formatting, code blocks verbatim)
5. Delete the original command file

**CRITICAL: Copy the body content character-for-character. Do not reformat, fix typos, or "improve" anything.**

## Workflow

If you have the Task tool available:
DO NOT start to read all of the files yourself. That function should be delegated to the subagents. Your job is to dispatch the subagents for each category of files and wait for the results.

1. [ ] Create the skills directories if they don't exist (`.cursor/skills/` for project, `~/.cursor/skills/` for user)
2. Dispatch three fast general purpose subagents (NOT explore) in parallel to do the following steps for project rules (pattern: `{workspaceFolder}/**/.cursor/rules/*.mdc`), user commands (pattern: `~/.cursor/commands/*.md`), and project commands (pattern: `{workspaceFolder}/**/.cursor/commands/*.md`):
  I. [ ] Find files to migrate in the given pattern
  II. [ ] For rules, check if it's an "applied intelligently" rule (has `description`, no `globs`, no `alwaysApply: true`). Commands are always migrated. DO NOT use the terminal to read files. Use the read tool.
  III. [ ] Make a list of files to migrate. If empty, done.
  IV. [ ] For each file, read it, then write the new skill file preserving the body content EXACTLY. DO NOT use the terminal to write these files. Use the edit tool.
  V. [ ] Delete the original file. DO NOT use the terminal to delete these files. Use the delete tool.
  VI. [ ] Return a list of all the skill files that were migrated along with the original file paths.
3. [ ] Wait for all subagents to complete and summarize the results to the user. IMPORTANT: Make sure to let them know if they want to undo the migration, to ask you to.
4. [ ] If the user asks you to undo the migration, do the opposite of the above steps to restore the original files.


If you don't have the Task tool available:
1. [ ] Create the skills directories if they don't exist (`.cursor/skills/` for project, `~/.cursor/skills/` for user)
2. [ ] Find files to migrate in both project (`.cursor/`) and user (`~/.cursor/`) directories
3. [ ] For rules, check if it's an "applied intelligently" rule (has `description`, no `globs`, no `alwaysApply: true`). Commands are always migrated. DO NOT use the terminal to read files. Use the read tool.
4. [ ] Make a list of files to migrate. If empty, done.
5. [ ] For each file, read it, then write the new skill file preserving the body content EXACTLY. DO NOT use the terminal to write these files. Use the edit tool.
6. [ ] Delete the original file. DO NOT use the terminal to delete these files. Use the delete tool.
7. [ ] Summarize the results to the user. IMPORTANT: Make sure to let them know if they want to undo the migration, to ask you to.
8. [ ] If the user asks you to undo the migration, do the opposite of the above steps to restore the original files.
## Skill: modular-design

---
name: modular-design
description: Enforce modular, bite-sized file design across all repos. Use when creating new files, reviewing code, or refactoring. Files should be single-responsibility, under 200 lines, and organized into cohesive packages. Apply when touching any file over 200 lines or creating new functionality.
triggers:
  - file-analysis
related_skills:
  - refactoring
  - code-review
---

# Modular Design

Every file should do one thing and be small enough to read in a single pass.
This is not a suggestion -- it is the design target for all codebases.

## Hard Limits

| Metric          | Target      | Hard Limit | Action When Exceeded     |
| --------------- | ----------- | ---------- | ------------------------ |
| File length     | < 150 lines | 200 lines  | Split immediately        |
| Function length | < 30 lines  | 50 lines   | Extract helpers          |
| Parameters      | < 4         | 5          | Introduce options object |
| Import depth    | < 3 levels  | 4 levels   | Flatten or re-export     |

These limits apply to all languages: TypeScript, Python, shell, CSS.

## Package Structure

Organize code into packages (directories) that group related functionality.
Each package has a clear public API and internal implementation.

### TypeScript Pattern

```
feature/
  index.ts          # Public API re-exports
  types.ts          # Shared types for this feature
  core.ts           # Primary logic (< 200 lines)
  helpers.ts        # Internal utilities
  constants.ts      # Feature-specific constants
```

### Python Pattern

```
feature/
  __init__.py       # Public API
  types.py          # Dataclasses, TypedDicts
  core.py           # Primary logic
  commands.py       # CLI subcommands
  formatters.py     # Output formatting
```

### Shell Pattern

```
scripts/
  feature.sh        # Entry point (arg parsing, dispatch)
  _feature-lib.sh   # Shared functions (sourced, not executed)
  feature-sub1.sh   # Subcommand implementation
  feature-sub2.sh   # Subcommand implementation
```

## Splitting Heuristics

When a file exceeds the limit, split along these seams:

1. **By responsibility**: Message handlers, data loaders, renderers, formatters
   are separate concerns. They should be separate files.
2. **By feature**: A dashboard with services, tunnels, sessions, and stats has
   four natural split points.
3. **By subcommand**: CLI tools with scan/report/query/analyze subcommands
   should have one file per subcommand.
4. **By layer**: Parsing, transformation, and output are separate layers.
   A function that reads a file, transforms data, and writes output should
   be three functions in up to three files.

## When Creating New Code

Before writing, decide the package structure:

- Will this be a single file or a directory with multiple files?
- If it might grow beyond 200 lines, start with a directory.
- Name the directory after the feature, not the file type.
  `tools/profiler/` not `tools/python-scripts/`.
- Create `index.ts` / `__init__.py` as the public API from day one.

## When Touching Existing Code

If the file you are editing is over 200 lines:

1. Check if your change makes it longer. If yes, extract something first.
2. If the file is over 400 lines, propose a split to the user before
   continuing.
3. Apply the Boy Scout Rule: leave the file shorter than you found it.

## Known Oversized Files (Split Backlog)

These files currently exceed limits and should be split when next touched:

| File                                | Lines | Suggested Split                                     |
| ----------------------------------- | ----- | --------------------------------------------------- |
| `tools/teams-bot/bot.py`            | 1864  | By feature: commands, handlers, graph-api, webhooks |
| `tools/cloudwatch/logs.py`          | 694   | By subcommand: tail, insights, groups, formatters   |
| `tools/profiler/analyze.py`         | 607   | Parsing, commands, anthropic-analysis               |
| `tools/tunnel/src/server.ts`        | 458   | Route handlers, tunnel management, state            |
| `tools/guardduty/findings.py`       | 426   | Formatters, commands, filtering                     |
| `tools/memory/scan.py`              | 347   | Discovery/scoring, commands, output                 |
| `tools/sos/workspace/checkout.py`   | -     | ctx workspace checkout; repo logic in helpers      |
| `tools/sos/workspace/check.py`      | -     | ctx workspace check; per-repo checks               |
| `tools/db/format.js`                | 302   | Extract formatters by output type                   |
| `tools/db/parse-models.js`          | 299   | Parser vs output                                    |

## Anti-Patterns

- **God files**: One file that handles everything for a feature. Split it.
- **Util dumps**: A `utils.ts` that grows indefinitely. Group utilities by
  domain (`string-utils.ts`, `date-utils.ts`, `api-utils.ts`).
- **Circular imports**: If splitting creates circular dependencies, the
  abstraction boundary is wrong. Re-draw it.
- **One-export-per-file**: Going too far. Files can have multiple related
  exports. Split at responsibility boundaries, not at function boundaries.
## Skill: playwright

---
name: playwright
description: Browser automation and E2E testing via Playwright MCP. Triggers on UI verification, E2E tests, browser testing, visual confirmation, click-through testing, or when a user asks to verify something works in the browser.
triggers:
  - feature-dev
  - test-plan
  - frontend-patterns
related_skills:
  - test-plan
  - code-review
  - preflight
---

# Playwright

Use the Playwright MCP server to drive a real browser for E2E verification,
visual confirmation, and automated testing. The server exposes browser
automation as MCP tools -- no Playwright API code needed.

## MCP Tools (provided by `@playwright/mcp`)

The Playwright MCP server provides snapshot-based and interaction tools.
Use snapshot tools by default (faster, more reliable). Vision tools are
available when coordinate-based interaction is needed.

### Core tools

| Tool | Purpose |
|------|---------|
| `browser_navigate` | Go to a URL |
| `browser_click` | Click an element (by `ref` from snapshot) |
| `browser_type` | Type into an input field |
| `browser_snapshot` | Get accessibility tree of current page |
| `browser_take_screenshot` | Capture a screenshot |
| `browser_wait` | Wait for a specified duration |
| `browser_close` | Close the current tab |

### Form and interaction

| Tool | Purpose |
|------|---------|
| `browser_select_option` | Select from dropdown |
| `browser_hover` | Hover over element |
| `browser_press_key` | Press keyboard key |
| `browser_drag` | Drag element to target |

### Tab and navigation

| Tool | Purpose |
|------|---------|
| `browser_tab_list` | List open tabs |
| `browser_tab_new` | Open new tab |
| `browser_tab_select` | Switch to tab |
| `browser_tab_close` | Close a tab |
| `browser_back` | Navigate back |
| `browser_forward` | Navigate forward |

### Advanced

| Tool | Purpose |
|------|---------|
| `browser_console_messages` | Read browser console logs |
| `browser_evaluate` | Execute JS in page context |
| `browser_file_upload` | Upload file to input |
| `browser_generate_playwright_test` | Generate a `.spec.ts` from session |
| `browser_network_requests` | View network activity |
| `browser_pdf_save` | Save page as PDF |
| `browser_resize` | Resize viewport |

## When to use

- **After UI changes**: Navigate to the affected page, take a snapshot, verify
  elements render correctly.
- **Form flows**: Fill out forms, submit, verify success/error states.
- **Regression checks**: Click through adjacent features to confirm they still
  work after a change.
- **Visual confirmation**: Screenshot a page to verify layout, styling, or
  responsiveness.
- **Console errors**: Check `browser_console_messages` for JS errors after
  navigation.
- **Generate test files**: Use `browser_generate_playwright_test` after a
  manual walkthrough to produce a reusable `.spec.ts`.

## Verification workflow

When the user asks you to verify something works, or after completing a UI
change:

1. **Navigate** to the relevant URL (`browser_navigate`).
2. **Snapshot** the page (`browser_snapshot`) to inspect the accessibility tree.
3. **Interact** if needed (click, type, submit).
4. **Assert** by reading the snapshot or screenshot -- confirm expected elements
   are present, text matches, no error banners.
5. **Check console** (`browser_console_messages`) for errors.
6. **Generate test** (`browser_generate_playwright_test`) if the flow should be
   repeatable.

## Test generation

After verifying a flow manually, use `browser_generate_playwright_test` to
produce a Playwright test file. Save generated tests to the repo's test
directory (e.g., `tests/e2e/`).

Generated tests serve as regression guards -- they capture the exact flow
that was just verified and can be re-run in CI.

## Configuration

The Playwright MCP server runs as a stdio subprocess. Configuration is in
`.cursor/mcp.json` (Cursor) or `.claude/mcp.json` (Claude Code).

Key flags:

| Flag | Purpose |
|------|---------|
| `--browser chromium` | Browser engine (chromium, firefox, webkit) |
| `--caps testing` | Enable assertion and test generation tools |
| `--viewport-size 1280,720` | Default viewport |
| `--headless` | Run without visible browser (CI mode) |

## Limitations

- Snapshot-based tools use accessibility refs, not CSS selectors. Use
  `browser_snapshot` to discover available refs before interacting.
- The browser session persists across tool calls within a conversation but
  resets between conversations.
- Auth state is not preserved by default. Use `--storage-state` for persistent
  login, or log in via `browser_click`/`browser_type` each session.
## Skill: pr-summary

---
name: pr-summary
description: Generate PR summaries using repo-specific templates. Use when creating or updating PR descriptions for any repository including the root context repo.
triggers: []
related_skills:
  - finish-ticket
  - md-to-teams
  - teams-notify
---

# PR Summary Generation

Generate structured PR summaries from git diffs using repository-specific templates. Ensures consistency across all pull requests and follows your organization's PR summary standards.

## Prerequisites

- You are in a git repository (sub-repo or root context)
- Branch is pushed to origin
- `gh` CLI available (optional; REST API fallback)
- Works for all repositories in the workspace

## Verify Context

Before starting, verify you're in the correct repository:

```bash
pwd
git rev-parse --show-toplevel
```

If wrong directory, navigate before proceeding. Never assume.

Repository-to-template mapping and template-specific guidelines: [references/template-mapping.md](references/template-mapping.md)

Example workflows: [references/example-workflows.md](references/example-workflows.md)

## Step 1: Ensure Fresh Main Branch

```bash
git fetch origin main --quiet
```

## Step 2: Generate Diff File

```bash
git fetch origin --quiet
git diff origin/main...HEAD > /tmp/diff.file
```

Rules: Save to `/tmp/diff.file` only. Use as source of truth; ignore chat history if it conflicts. Never commit. Delete after PR summary is applied.

## Step 3: Identify Repository and Template

Determine repo from current directory. See [references/template-mapping.md](references/template-mapping.md) for the full table.

## Step 4: Read the Template

Read the appropriate template from `tools/context-templates/`. Path varies: from root use `tools/context-templates/`; from sub-repo use `../../tools/context-templates/`.

## Step 5: Fill the Template Exactly

- Do NOT add, remove, or reorder sections
- Fill every section with concise, note-form content
- Use bullet points where appropriate
- Be factual and specific based on the diff

When reading `diff.file`, focus on: files added/modified/deleted, new functions/classes/modules, migrations, API changes, config changes, test files, dependencies.

## Step 6: Determine PR Title

Format: `{Category}: Description`. Categories: `Feature:`, `Fix:`, `Improvement:`, `Dependency:`, `Configuration:`, `Security:`, `Test:`, `Infrastructure:`. If Jira-linked: `Fix: SWE-460 <description>`.

## Step 7: Save PR Summary

```bash
cat > /tmp/pr-body.md << 'EOF'
[Filled PR summary content]
EOF
```

Always use `/tmp/` to avoid git tracking and workspace pollution.

## Step 8: Apply to PR (if PR exists)

### Option A: `gh pr edit` (Preferred)

```bash
gh pr edit <number> --body-file /tmp/pr-body.md
```

### Option B: REST API (if Option A fails)

```bash
gh api -X PATCH repos/<org>/<repo>/pulls/<number> -f body="$(cat /tmp/pr-body.md)"
```

### Option C: Update Title (if needed)

```bash
gh api -X PATCH repos/<org>/<repo>/pulls/<number> -f title='<Category>: <Description>'
```

Verify update succeeded before cleanup.

## Step 9: Verify and Clean Up

1. Verify PR update succeeded
2. Delete temp files: `rm -f /tmp/diff.file /tmp/pr-body.md`
3. Check workspace: `git status --short | grep -E "pr-body|diff\.file" || echo "No temp files found"`
4. If found: `rm -f pr-body.md pr-body.txt diff.file`

Never delete temp files until after API call succeeds. If API fails, still clean up but log the error.

## Error Handling

- **Wrong directory**: Stop. Ask user to navigate.
- **git diff fails**: Verify repo, ensure branch exists
- **Template not found**: Verify cwd, check `tools/context-templates/`
- **gh pr edit fails**: Use REST API
- **PR number unknown**: Ask user or run `gh pr list`

## Security Notes

- Never include secrets, API keys, or credentials in PR summaries
- Do not expose internal infrastructure details beyond necessity
- Sanitize sensitive paths or config values
## Skill: preflight

---
name: preflight
description: Pre-work validation checklist. Use before starting implementation on any non-trivial task. Verifies environment, branches, assumptions, docs, and available tooling to avoid the most common agent failure -- starting work on wrong assumptions. Addresses 200+ identified gaps across session history.
triggers:
  - memory
related_skills:
  - action-ticket
  - feature-dev
  - debug
---

# Preflight

Run this checklist before writing any implementation code. The single most
common gap in session history (34% of all gaps) is failing to verify
assumptions before starting work. This skill exists to prevent that.

## 1. Verify the Environment

Before touching code, confirm the working context is correct:

- [ ] Correct repo and branch. Run `git branch --show-current` and confirm
  it matches the expected target. If working on a ticket, check for existing
  branches (`git branch -a | grep <ticket-id>`).
- [ ] Working directory is clean or intentionally dirty. Run `git status`.
  Stash or commit unrelated changes before starting.
- [ ] Required secrets and env vars exist. If the task involves encryption,
  API keys, or AWS services, verify the credentials are available before
  writing code that depends on them.
- [ ] Dependencies are installed and current. If unsure, run the install
  command for the repo.

## 2. Read Before Writing

Consult existing knowledge before making assumptions:

- [ ] Check `memory/` for prior decisions, known issues, and progress on
  this topic. Run `/memory` scan with relevant keywords.
- [ ] Read `docs/repos/<name>.md` for the target repo's conventions and
  architecture.
- [ ] Check `docs/architecture.md` if the task touches cross-service
  boundaries (MQTT, SQS, API contracts).
- [ ] Read the existing code in the area you will modify. Understand the
  current patterns before introducing new ones.
- [ ] Search for prior PRs or branches related to this work. Someone may
  have started this already.

## 3. Validate Assumptions

Challenge your initial understanding:

- [ ] If the task mentions a specific file, endpoint, or component -- verify
  it exists at the expected path before building on that assumption.
- [ ] If the task involves a bug -- reproduce it before theorizing. Run
  `/debug` Step 1.
- [ ] If the task scope seems large -- confirm the boundaries with the user
  before going broad. Scope creep wastes cycles.
- [ ] If working with data (DB, API responses) -- check actual data shape,
  not assumed shape. Timestamps, nullability, and field names are common
  sources of wrong assumptions.

## 4. Inventory Available Tools

Check what already exists before building from scratch:

- [ ] Search `tools/scripts/` for scripts that do what you need.
- [ ] Check `docs/tooling-registry.md` for registered tools.
- [ ] Check available skills with the skill list. A skill may already encode
  the workflow you need.
- [ ] If the task involves AWS, check for existing wrapper scripts before
  writing raw CLI commands.

## 5. Plan the Approach

For non-trivial tasks, state the plan before executing:

- [ ] Identify which files will be modified.
- [ ] Identify which tests will validate the change.
- [ ] Identify cross-repo impact if any.
- [ ] If the plan has more than 5 steps, use `/feature-dev` for structured
  planning.

## When to Skip

This checklist is for non-trivial work. Skip it for:
- Single-file edits with obvious scope
- Questions and read-only exploration
- Quick fixes where the problem and solution are both clear
## Skill: proactive-suggestions

---
name: proactive-suggestions
description: Offer related improvements alongside the requested work. Use at the end of any implementation task to surface adjacent opportunities the user may not have asked for. Addresses 30 identified gaps where the agent completed the task but missed obvious related improvements.
triggers: []
related_skills:
  - retrospective
  - code-review
  - contribute
---

# Proactive Suggestions

After completing the requested work, scan for adjacent improvements and offer
them to the user. Do not implement them without permission -- just surface
them.

## When to Suggest

At the end of any implementation task that touches 3+ files or takes more
than a few minutes, pause and check for:

### Dead Code and Cleanup

- Did the change make any existing code unused? Imports, functions, variables,
  CSS classes, config entries that are no longer referenced.
- Are there commented-out blocks near the code you touched?
- Did you notice any `TODO` or `FIXME` comments in the area?

### Related Fixes

- While reading the surrounding code, did you notice any bugs or issues
  unrelated to the current task? Note them without fixing.
- Does the component you modified have sibling components that need the same
  change? (e.g., if you fixed a pattern in one form, do other forms have the
  same problem?)
- Are there related config files that should be updated? (`.gitignore`,
  `tsconfig`, `package.json` scripts, VS Code settings)

### Tooling Gaps

- Could the manual work you just did be automated with a script?
- Is there a VS Code extension that would help with this kind of work?
- Would a new entry in `tools/manifest.yaml` make this operation discoverable
  from the command center?

### Documentation Opportunities

- Did the change introduce behavior that is not obvious from the code alone?
- Would a memory entry help future sessions avoid re-discovering what you
  just learned?
- Is there a `docs/repos/<name>.md` that should be updated?

## How to Suggest

At the end of your work summary, add a brief section:

> **Related opportunities I noticed:**
> - [description of improvement] -- [which file/area]
> - [description of improvement] -- [which file/area]
>
> Want me to tackle any of these?

Keep it to 2-4 suggestions. More than that becomes noise. Prioritize by
impact: security issues first, then bugs, then cleanup, then nice-to-haves.

## What Not to Suggest

- Style-only changes with no functional benefit.
- Refactors that would require extensive testing to validate.
- Changes outside the repo you are currently working in (use
  `/cross-repo-check` instead).
- Anything that would derail the current task's PR scope.
## Skill: proposals

---
name: proposals
description: Scaffold and manage design proposals before implementation begins. Use when planning new features, architectural changes, multi-task work, or when the user says "write a proposal" or "plan this out".
---

# Proposals

Design declarations that precede implementation. Every non-trivial piece of
work gets a proposal in `docs/proposals/` before code is written.

## When to Use

- New features or architectural changes
- Work that spans multiple files, systems, or repos
- Anything requiring more than one delegatable task
- When the user asks to "plan", "propose", or "design" something

## Directory Structure

Create a directory under `docs/proposals/<slug>/` with these files:

```
<slug>/
  PROPOSAL.md        -- design declaration
  impact.md          -- affected files, systems, risks
  01-<task-name>.md  -- first delegatable task
  02-<task-name>.md  -- second task
  NN-<task-name>.md  -- as many as needed
```

## PROPOSAL.md Template

```markdown
---
title: <Title>
date: <YYYY-MM-DD>
status: draft
ticket: null
repo: <primary repo or tool affected>
---

# <Title>

## Summary
One paragraph: what this proposal does and why.

## Motivation
Why this work is needed. What problem exists today.

## Scope

### In Scope
- Bulleted list of what this proposal covers

### Out of Scope
- What it explicitly does not cover

## Architecture
How the pieces fit together. Diagrams welcome (ASCII or Mermaid).

## Key Design Decisions
Numbered list of decisions with rationale for each.

## Relationship to Other Proposals
How this relates to existing proposals (if any).
```

## impact.md Template

```markdown
# Impact Analysis

## Files

### New
- `path/to/file.ts` -- what it does

### Modified
- `path/to/file.ts` -- what changes

## Systems
Which systems are affected (DB, MQTT, file system, AI backend, etc.).

## Cross-Repo
Other repos or packages affected.

## Risks
Bulleted list of risks with mitigations.
```

## Task File Template

Each numbered task file has YAML frontmatter:

```markdown
---
task: <kebab-case-name>
agent: generalPurpose
model: fast
depends_on: []
status: pending
---

# NN: <Task Title>

## Objective
What this task accomplishes.

## Context
Why this task exists and what it depends on.

## Steps
Numbered list of implementation steps. Each step ends with:
-- validation: how to verify the step is done

## Acceptance Criteria
Bulleted list of conditions for completion.
```

### Task Frontmatter Fields

| Field | Values | Purpose |
|-------|--------|---------|
| agent | generalPurpose, explore, plan | Sub-agent type to execute |
| model | fast, default | fast for simple tasks, default for complex |
| depends_on | [] or [1, 3] | Task numbers that must complete first |
| status | pending, in-progress, completed, skipped | Lifecycle state |

## Workflow

1. **Analyze** the problem. Read relevant code and existing proposals.
2. **Draft PROPOSAL.md** with summary, motivation, scope, architecture.
3. **Write impact.md** listing all affected files, systems, and risks.
4. **Break into tasks** -- each task should be independently delegatable.
   Order by dependency. Keep tasks focused (one concern each).
5. **Review** -- present the proposal to the user before implementation.

## Status Lifecycle

`draft` -> `in-progress` -> `completed` | `rejected`

## Guidelines

- Proposals are gitignored (local working docs, not committed).
- Keep task count reasonable (3-13 tasks for most proposals).
- Each task should take one agent session to complete.
- Promote reusable patterns to `memory/decisions/` or `skills/` when done.
- If a proposal is rejected, document why in the PROPOSAL.md before archiving.
## Skill: refactoring

---
name: refactoring
description: Refactoring guidelines for your organization. Use when restructuring code, splitting files, extracting utilities, or improving code quality without changing behavior. Covers extraction patterns, behavior preservation, and cross-repo safety.
triggers:
  - file-analysis
  - modular-design
  - code-review
related_skills:
  - feature-dev
  - cross-repo-check
---

# Refactoring Guidelines

Standards for restructuring code without changing its external behavior.

## When to Refactor

- A file exceeds ~400 lines and has multiple responsibilities.
- A function exceeds ~50 lines or has more than 3 levels of nesting.
- The same logic appears in two or more places (DRY violation).
- A module has grown to depend on too many external modules (high coupling).
- Test setup is complex because business logic is entangled with I/O.
- The Boy Scout Rule applies: you are already modifying the file for another
  reason and spot an improvement opportunity.

## Before Refactoring

- Ensure existing tests pass and cover the behavior you are about to change.
- If test coverage is insufficient, add characterization tests first to lock
  down current behavior before restructuring.
- Understand the file's role and dependencies (apply the /file-analysis skill).
- Identify all consumers of the code being refactored; check for cross-repo
  impact.

## Extraction Patterns

### Extract Function
- Pull a block of code into a named function with a clear, descriptive name.
- The function should have a single responsibility and return a meaningful value.
- Keep the extracted function in the same file unless it is reusable elsewhere.

### Extract Module
- When a file has grown beyond ~400 lines, split it along responsibility
  boundaries.
- Create a new file with a name that describes its responsibility.
- Re-export from the original module if needed to preserve the public API.
- Update all import paths in consumers.

### Extract Utility
- When the same logic appears in multiple files, extract it to a shared
  utility module (`utils/` or `lib/`).
- The utility must have a stable, documented API.
- Add tests for the extracted utility.

### Deduplicate Names (Name Things Once)
- When a concept name repeats across namespace levels (directory, module, class,
  variable), collapse the redundancy.
- Example: `services/user/UserService.ts` exporting class `UserService` should
  become `services/user/index.ts` exporting class `Service` (or a plain
  function if the class only wraps a single method).
- Rename class properties that redundantly include the class name
  (e.g., `organization.organizationName` becomes `organization.name`).
- Replace single-method classes with plain functions.
- These renames change public API, so update all consumers in the same commit
  and treat the rename like any other behavior-preserving refactor (run tests
  after each step).

### Push I/O to the Edges
- If a function mixes business logic with database queries, API calls, or
  file system operations, separate them:
  1. Pure function that computes the result from inputs.
  2. Thin wrapper that performs I/O and calls the pure function.
- This makes the core logic testable without mocks.

## Preserving Behavior

- Refactoring must not change observable behavior. If it does, it is a feature
  change and should be treated as such (separate branch, separate PR).
- Run the full test suite after each refactoring step, not just at the end.
- Make small, incremental changes; commit after each successful step so you
  can revert if something breaks.
- If renaming exports, update all consumers in the same commit to avoid
  broken intermediate states.

## Cross-Repo Refactoring

- If the refactored code is consumed across repositories (shared DB schemas,
  message formats, API contracts), coordinate changes carefully.
- Database schema refactors must go through your-app migrations.
- Message format changes require simultaneous updates in producer and consumer
  repos.
- Prefer backward-compatible changes; deprecate before removing.

## Anti-Patterns to Avoid

- Do not refactor and add features in the same commit.
- Do not refactor without tests; you need a safety net.
- Do not introduce abstraction layers that add complexity without clear benefit.
- Do not rename things for style preference alone; rename only when the current
  name is misleading or unclear.
- Do not move code across repo boundaries without explicit coordination.
## Skill: retrospective

---
name: retrospective
description: Analyze past session performance to improve current behavior. Use when starting a session, after completing work, or when the user says "retrospective", "review analyses", "learn from past sessions", "what patterns do you see", or "improve from history".
triggers:
  - memory
related_skills:
  - proactive-suggestions
  - preflight
---

# Retrospective

Read past session analyses to identify recurring strengths, weaknesses, and
patterns. Use those insights to improve the current session's approach.

## When to Use

- At the start of a session, to load behavioral context
- When the user asks to review past performance
- After completing a task, to compare against historical patterns
- When stuck -- past analyses may reveal the same failure mode

## Step 1: Load Recent Analyses

Read the analyses directory and load the most recent files:

```bash
ls -t memory/profile/analyses/*.json | head -20
```

Read each file to extract its content. Focus on:

- `verdict` distribution (how many productive vs struggling vs blocked)
- `errors` and `gaps` that repeat across sessions
- `recommendations` that keep appearing
- `user_stats` and `agent_stats` trends

## Step 2: Extract Patterns

Build a mental model from the analyses. Look for:

### Recurring Errors (fix these first)

Scan `errors` arrays across all analyses. Group similar items. If the same
class of error appears in 3+ sessions, it is a systemic issue.

Common categories:

- **State awareness**: losing track of filesystem, environment, or session state
- **Tool misuse**: using the wrong tool or using tools inefficiently
- **Scope creep**: taking on too much, not finishing before starting new work
- **Communication**: not clarifying requirements, not reporting progress

### Recurring Gaps (skills or knowledge to acquire)

Scan `gaps` arrays. These point to missing capabilities:

- Skills that should have been invoked but were not
- Tools that exist but were not discovered
- Documentation that was not consulted

### Recurring Recommendations (behaviors to adopt)

Scan `recommendations` arrays. Deduplicate and rank by frequency.

### Stat Trends

Compare `user_stats` and `agent_stats` across sessions:

- Is `frustration` consistently high? The agent is underperforming.
- Is `efficiency` consistently low? Too many wasted cycles.
- Is `autonomy` low? The agent is asking too many questions.
- Is `thoroughness` low? Skipping tests, reviews, or edge cases.

## Step 3: Report Findings

Present a concise summary to the user:

```
Retrospective Summary (N sessions analyzed)
--------------------------------------------
Verdict distribution: X productive, Y mixed, Z struggling, W blocked

Top recurring errors:
1. <error pattern> (seen in N sessions)
2. ...

Top recurring gaps:
1. <gap> (seen in N sessions)
2. ...

Top recommendations:
1. <recommendation> (appears N times)
2. ...

Stat averages:
  User:  clarity=X frustration=X engagement=X ambition=X adaptability=X
  Agent: competence=X efficiency=X creativity=X autonomy=X thoroughness=X
```

## Step 4: Apply to Current Session

Based on the findings, adjust behavior for the current session:

1. **Avoid top errors**: Before each action, check if it matches a recurring
   error pattern. If so, take the alternative approach.
2. **Fill gaps**: If a gap indicates a skill should be used, invoke it.
3. **Follow recommendations**: Treat the top 3 recommendations as active rules
   for this session.
4. **Monitor stats**: If frustration trends high, be more proactive about
   confirming direction. If efficiency trends low, minimize exploratory tool
   calls.

## Step 5: Suggest Improvements

If patterns suggest structural improvements, offer to create:

- **Skills**: For recurring recommendation patterns that could be automated
  (use the Command Center UI or create directly in `.cursor/skills/`)
- **Rules**: For behavioral guidelines that should always apply
  (create in `.cursor/rules/`)
- **Memory entries**: For known issues or decisions that should persist
  (use `ctx memory write`)

## Error Handling

- If no analysis files exist, inform the user and suggest running
  `ctx profiler analyze --limit 10` to generate them.
- If analyses are sparse (< 5), note that patterns may not be reliable yet.
- Never fabricate or assume analysis data that does not exist in the files.
## Skill: security-audit

---
name: security-audit
description: Code-level security audit for platform features. Use when implementing authentication, encryption, access control, webhook security, secret management, or any feature that handles sensitive data. Distinct from /guardduty which covers AWS-level threat detection.
triggers:
  - code-review
related_skills:
  - guardduty
  - cross-repo-check
  - deploy
  - database-ops
---

# Security Audit

Apply this checklist when writing or modifying code that touches authentication,
authorization, encryption, secrets, or sensitive data flows.

## Authentication and Authorization

- Every API endpoint has an explicit auth check. No endpoint should be
  accessible without authentication unless intentionally public.
- Role-based access control (RBAC) is enforced at the route/controller level,
  not just the UI. The frontend hides elements but the backend must reject.
- Token validation checks expiration, signature, and issuer. Do not trust
  client-supplied claims without server-side verification.
- Session invalidation works correctly on logout and password change.

## Encryption and Secrets

- Sensitive fields (webhook URLs, API keys, phone numbers) use model-level
  encryption via Sequelize getters/setters. Follow the existing pattern in
  the codebase.
- Encryption keys come from AWS Secrets Manager, never from environment
  variables or hardcoded values.
- When adding encryption to existing plaintext fields, write a reversible
  migration with transaction guards and rollback capability.
- Never log decrypted values. Redact sensitive fields in all log output.

## Webhook Security

- Webhook endpoints validate request signatures before processing.
- Webhook secret rotation must not break in-flight deliveries. Support a
  grace period with both old and new secrets.
- Webhook reset flows must verify the encryption key exists before attempting
  re-encryption. Missing keys cause crash-level bugs.

## Secret Management

- AWS SSO + Secrets Manager is the standard auth pattern. Replicate it when
  adding new services.
- Scan all new scripts (shell, JS, Python) for hardcoded secrets before
  staging. Check for patterns: API keys, tokens, passwords, connection strings.
- `.env` files are gitignored. Verify this before committing.

## Data Handling

- Implement two-tier redaction where appropriate: write-time redaction for
  permanent removal, read-time redaction for display masking that preserves
  the original for authorized users.
- PII fields require encryption at rest. Audit new model fields against this
  requirement.
- Error messages must not leak internal details (stack traces, query structures,
  file paths) to API consumers.

## IDOR / Tenant Boundary Audit

For permission/exposure review (IDOR risks, tenant boundary checks, and cross-repo routing impact), run `/idor-audit`.

## Before Completing Security-Sensitive Work

1. Grep the diff for secrets patterns: `password`, `apikey`, `secret`, `token`,
   `bearer`, connection strings.
2. Verify encryption roundtrip: write -> read -> compare.
3. Confirm RBAC enforcement with a test scenario for an unauthorized role.
4. Run `/code-review` with extra attention to the security section.

## Additional Resources

- For encryption and secret management patterns, see [references/encryption-patterns.md](references/encryption-patterns.md)
- For RBAC and auth enforcement, see [references/rbac-patterns.md](references/rbac-patterns.md)
## Skill: test-plan

---
name: test-plan
description: Create concise developer self-vetting test plans (new behavior + regression checks). Use when the user asks for a "test plan", "QA steps", "manual test steps", "how to verify", or "dev testing" a change.
triggers: []
related_skills:
  - code-review
  - pr-summary
  - staging-test
  - start-platform
---

# Test Plan

When the user asks for a **test plan**, produce a short developer self-vetting doc that:

- **Verifies the new/changed behavior works**
- **Verifies related/touched behavior did not regress**

## Where test plans live in context

Test plans are **local artifacts** and must **not** be committed.

- **Write to**: `playground/test-plans/`
- **Default filename**: `playground/test-plans/TEST_PLAN.md` (overwrite if it exists)

This directory is git-ignored by design, so it won't accidentally land in a PR.

## Pull PR context from GitHub (required when PR-based)

If the test plan is for a GitHub PR, fetch context using `gh` so the plan includes the **branch name** and a short **gist** of what changed.

Use:

```bash
gh pr view <PR_NUMBER> -R <OWNER/REPO> --json headRefName,title,url,body
```

Then include near the top of the doc:

- **Branch name**: `<headRefName>`
- **PR gist**: 1–2 bullets summarizing the change (from title/body + touched files if known)

## Required content (keep it short)

### 1) Scope header

- Feature name / PR / branch (always include branch name when PR-based)

### 2) Preconditions

- Auth role(s) required (e.g., `Super Admin`, `Org Admin`, `Monitoring Operator`)
- Environment assumptions (local vs staging, mobile vs web)
- Any required feature flags / toggles

### 3) Verify the change (happy path)

Write steps as if the tester has never used the product:

- "Go to X"
- "Click Y on the left/right side"
- "Type Z into field"
- "Press Save"
- "Verify A changes to B"

Keep each step to one line. Prefer short numbered lists.

### 4) Regression checks (related/touched behavior)

Add a short checklist of "adjacent" behaviors to verify didn't break. Prefer a small set of high-signal checks over exhaustive lists.

Good sources for regression checks:

- **Files/endpoints touched** (UI routes, API endpoints, DB writes)
- **Same UI area** (navigation, lists/detail pages, filters, pagination)
- **Permissions** (can/can't see or edit; cross-role checks when risky)
- **State transitions** (create -> edit -> disable/delete; undo/cancel flows)
- **Side effects** (notifications, audits/logs, webhooks, background jobs)
- **Error handling** (invalid input shows a validation error; no 500s)

Format as "verify" bullets:

- Verify <previous behavior> still works
- Verify <role> cannot do <action> (if permissions changed/are risky)
- Verify <failure mode> shows a user-safe error (no stack traces)

### 5) Seed data / state flips (instructions only — do not execute)

If verification requires data that may not exist locally, include:

- **What to seed** and **why**
- **Exact copy/paste commands** in code blocks
- **No execution** (the agent must not run these)

### 6) Expected results (tight assertions)

Use a short checklist of expected outcomes:

- UI shows Y
- API returns X
- No console errors / no 500s
- Audit/logging behavior is correct (if relevant)

## Output template (write `TEST_PLAN.md` like this)

````markdown
# Test Plan — <feature>

## Scope
- PR: <url>
- Branch name: <headRefName>
- PR gist:
  - <one-liner>
  - <optional one-liner>
- Apps: <put relevant apps here>

## Preconditions
- Login as: <role>
- Environment: <local/staging> | <mobile/web>
- Flags/Toggles: <none | ...>

## Verify the Change (Happy Path)
1. <step>
2. <step>
3. <verify>

## Regression Checks (Related/Touched Behavior)
- [ ] Verify <adjacent behavior> still works
- [ ] Verify <permissions expectation> still holds
- [ ] Verify <error/edge case> fails safely (no 500s)

## Seed / State (do not run automatically)
### Why
<one sentence>

### Commands
```bash
<copy/paste>
```

## Expected Results
- [ ] <assertion>
- [ ] <assertion>
````

## Multiple PRs -> index file (allowed + preferred)

When the user asks for test plans for multiple PRs, create:

- `playground/test-plans/TEST_PLANS_INDEX.md`
- One file per PR in `playground/test-plans/` (do not commit)

The index must include, per PR:

- Repo + PR number (link)
- **Branch name**
- **PR gist** (one line)
- Filename for the full test plan
## Skill: ui-design

---
name: ui-design
description: >-
  UI design thinking for adaptive, data-driven interfaces. Use when building or
  modifying any visual component -- React, HTML, dashboards, modals, lists,
  forms, graphs, or layout containers. Enforces dynamic values over hardcoding,
  flexible layouts over fixed dimensions, graceful edge-case handling, and
  composition patterns that don't box the UI into a corner. Apply alongside
  /frontend-patterns (structural conventions) and /code-review (quality gates).
related_skills:
  - frontend-patterns
  - branding
  - code-review
---

# UI Design

These heuristics govern how agents think about UI. They sit above
framework-specific conventions (covered by `/frontend-patterns`) and focus on
the design decisions that determine whether a component survives contact with
real data.

## Core Principle

**The UI serves the data, not the other way around.**

Every value the user sees should trace back to a variable, prop, API response,
or derived computation. If a value is typed directly into JSX/HTML as a literal,
it must be either a true constant (a label that will never change) or a
design token. Everything else is a hardcode waiting to break.

## Heuristics

### 1. Derive, Don't Hardcode

Render from data. Counts, labels, column headers, list lengths, status
text, badge colors, empty-state messages -- all of these come from state or
props, never from literals scattered across the template.

```jsx
// rigid -- breaks when categories change
<Tabs>
  <Tab label="Active" />
  <Tab label="Resolved" />
  <Tab label="Pending" />
</Tabs>

// adaptive -- tabs follow the data
<Tabs>
  {categories.map((c) => (
    <Tab key={c.id} label={c.name} />
  ))}
</Tabs>
```

Ask: "If the data changes shape or size tomorrow, does this component still
render correctly without a code change?"

### 2. Design for the Extremes

Every component will encounter:

- **Zero items** -- show an empty state, not a broken layout.
- **One item** -- no plural labels, no unnecessary chrome.
- **Hundreds of items** -- paginate, virtualize, or summarize.
- **Very long strings** -- truncate with a tooltip or wrap gracefully.
- **Missing/null fields** -- fallback text or conditional render, never crash.

Handle all five before considering the component done.

### 3. Flexible Containers, Not Fixed Boxes

Prefer constraints that describe relationships (`min-width`, `max-width`,
`flex`, `grid` fractions, `clamp()`) over absolute pixel values. A fixed
`width: 320px` is a commitment that the content will always be exactly that
wide -- it almost never will be.

Reserve hard pixel values for design-token spacing (4px, 8px, 16px grid) and
icon sizes. Everything else should be fluid or bounded.

### 4. Compose, Don't Configure

When a component needs variants, prefer composition (children, slots, render
props) over a growing props API. A component with 15 boolean props is
harder to maintain than one that accepts children.

```jsx
// configuration explosion
<Card showHeader showFooter showBadge badgeColor="red" headerSize="lg" />

// composable -- each concern is a separate, testable piece
<Card>
  <Card.Header size="lg" />
  <Card.Badge color="red" />
  <Card.Footer />
</Card>
```

The composable version survives new requirements without modifying the Card
component itself.

### 5. Separate Structure from Content

Layout components (Grid, Stack, Page, Sidebar) should know nothing about the
domain data they contain. Data components (AlertRow, ZoneCard, DeviceList)
should know nothing about where they sit on the page. When structure and content
are entangled, every layout change risks breaking data rendering.

### 6. Name by Role, Not by Data

Use semantic/role-based names (`primary`, `secondary`, `danger`, `muted`) for
colors, sizes, and variants. Not `red`, `large`, or `bold`. Role names survive
theme changes and rebrandings; literal names don't. For the canonical palette
and token names, see `/branding`.

### 7. Make State Transitions Visible

If a component has loading, error, empty, and populated states, all four should
be explicitly handled in the render path -- not left to fall through as a blank
screen. Users interpret a blank screen as broken.

```jsx
if (isLoading) return <Skeleton />;
if (error) return <ErrorBanner message={error.message} />;
if (!data?.length) return <EmptyState prompt="No alerts yet." />;
return <AlertList alerts={data} />;
```

### 8. Contextual Activation Over Explicit Activation

Default to showing relevant context automatically when the user's intent is
clear from their actions (zooming, navigating, filtering). Reserve explicit
activation (click-to-open, button-to-show) for destructive or expensive
operations.

Ask: "Can the system infer what the user wants from what they just did?"
If yes, activate contextually. If the inference could be wrong, make it easy
to dismiss or override -- but still default to showing it.

Examples:
- Zooming into an area near one entity on a map -> auto-show that entity's
  overlay and details panel.
- Opening a device page -> auto-expand the most recent alert, not a blank
  state requiring a click.
- Filtering a list to one result -> auto-select it.

### 9. Embedded Viewport Awareness

When a component may render inside a smaller container (preview panel, card,
modal sidebar), ask: "Do the controls still make sense at half the size?"

- If controls overlap content at small sizes, move them to the container
  chrome (header bar, footer) or hide them entirely.
- Provide a `compact` prop for suppressing chrome rather than relying on
  CSS media queries, since embedded size has no relationship to screen size.

## Decision Checklist

Before completing any UI work, verify:

| Question | If no... |
|---|---|
| Could this component render 0, 1, and 1000 items? | Add boundary handling. |
| Are all user-visible strings derived from data or i18n? | Extract literals. |
| Would a theme or brand change break the layout? | Use role-based tokens. |
| Does the layout survive 2x the expected text length? | Add truncation/wrap. |
| Can a new variant be added without modifying this file? | Refactor to compose. |
| Are loading, error, and empty states explicit? | Add missing branches. |
| Is every pixel value either a design token or fluid? | Replace magic numbers. |
| Can the system infer activation from user context? | Add contextual activation. |
| Does this work at half the viewport size (embedded)? | Add compact mode. |

## Anti-Patterns Reference

For concrete bad-to-good rewrites covering the most common agent mistakes, see
[references/anti-patterns.md](references/anti-patterns.md).
## Skill: update-cursor-settings

---
name: update-cursor-settings
description: Modify Cursor user settings in settings.json. Use when you want to change editor settings, preferences, configuration, themes, font size, tab size, format on save, auto save, keybindings, or any settings.json values.
---
# Updating Cursor Settings

This skill guides you through modifying Cursor user settings. Use this when you want to change editor settings, preferences, configuration, themes, keybindings, or any `settings.json` values.

## Settings File Location

| OS | Path |
|----|------|
| macOS | ~/Library/Application Support/Cursor/User/settings.json |
| Linux | ~/.config/Cursor/User/settings.json |
| Windows | %APPDATA%\Cursor\User\settings.json |

## Before Modifying Settings

1. **Read the existing settings file** to understand current configuration
2. **Preserve existing settings** - only add/modify what the user requested
3. **Validate JSON syntax** before writing to avoid breaking the editor

## Modifying Settings

### Step 1: Read Current Settings

```typescript
// Read the settings file first
const settingsPath = "~/Library/Application Support/Cursor/User/settings.json";
// Use the Read tool to get current contents
```

### Step 2: Identify the Setting to Change

Common setting categories:
- **Editor**: `editor.fontSize`, `editor.tabSize`, `editor.wordWrap`, `editor.formatOnSave`
- **Workbench**: `workbench.colorTheme`, `workbench.iconTheme`, `workbench.sideBar.location`
- **Files**: `files.autoSave`, `files.exclude`, `files.associations`
- **Terminal**: `terminal.integrated.fontSize`, `terminal.integrated.shell.*`
- **Cursor-specific**: Settings prefixed with `cursor.` or `aipopup.`

### Step 3: Update the Setting

When modifying settings.json:
1. Parse the existing JSON (handle comments - Cursor settings support JSON with comments)
2. Add or update the requested setting
3. Preserve all other existing settings
4. Write back with proper formatting (2-space indentation)

### Example: Changing Font Size

If user says "make the font bigger":

```json
{
  "editor.fontSize": 16
}
```

### Example: Enabling Format on Save

If user says "format my code when I save":

```json
{
  "editor.formatOnSave": true
}
```

### Example: Changing Theme

If user says "use dark theme" or "change my theme":

```json
{
  "workbench.colorTheme": "Default Dark Modern"
}
```

## Important Notes

1. **JSON with Comments**: Cursor settings.json supports comments (`//` and `/* */`). When reading, be aware comments may exist. When writing, preserve comments if possible.

2. **Restart May Be Required**: Some settings take effect immediately, others require reloading the window or restarting Cursor. Inform the user if a restart is needed.

3. **Backup**: For significant changes, consider mentioning the user can undo via Ctrl/Cmd+Z in the settings file or by reverting git changes if tracked.

4. **Commit Attribution**: When the user asks about commit attribution, clarify whether they want to edit the **CLI agent** or the **IDE agent**. For the CLI agent, modify `~/.cursor/cli-config.json`. For the IDE agent, it is controlled from the UI at **Cursor Settings > Agent > Attribution** (not settings.json).

## Common User Requests → Settings

| User Request | Setting |
|--------------|---------|
| "bigger/smaller font" | `editor.fontSize` |
| "change tab size" | `editor.tabSize` |
| "format on save" | `editor.formatOnSave` |
| "word wrap" | `editor.wordWrap` |
| "change theme" | `workbench.colorTheme` |
| "hide minimap" | `editor.minimap.enabled` |
| "auto save" | `files.autoSave` |
| "line numbers" | `editor.lineNumbers` |
| "bracket matching" | `editor.bracketPairColorization.enabled` |
| "cursor style" | `editor.cursorStyle` |
| "smooth scrolling" | `editor.smoothScrolling` |

## Workflow

1. Read ~/Library/Application Support/Cursor/User/settings.json
2. Parse the JSON content
3. Add/modify the requested setting(s)
4. Write the updated JSON back to the file
5. Inform the user the setting has been changed and whether a reload is needed
