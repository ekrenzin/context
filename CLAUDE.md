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

## MCP Servers

The following MCP servers are configured and available as tools:

- **playwright**: `npx @playwright/mcp@latest --caps testing --viewport-size 1280,720`
- **file-preview**: `node tools/file-preview-mcp/dist/index.js` (standalone) or auto-registered in Command Center MCP

Use these tools directly. See `skills/<name>/SKILL.md` for usage guidance.

## Available Skills

Read `skills/<name>/SKILL.md` for details on any skill.

- api-design
- code-review
- commit-format
- contribute
- create-rule
- create-skill
- create-subagent
- cross-repo-check
- database-ops
- debug
- deploy
- deploy-site
- feature-dev
- file-analysis
- frontend-patterns
- git-ops
- idor-audit
- image-gen
- local-ai
- memory
- migrate-to-skills
- modular-design
- playwright
- preview
- pr-summary
- preflight
- proactive-suggestions
- proposals
- refactoring
- retrospective
- security-audit
- terminal-prompt
- test-plan
- ui-design
- update-cursor-settings

## Always-Apply Rules

The following rules apply to every session. They are extracted from `rules/`
so you don't need to read them separately.

---

# Commit Format

All commits must follow the format: `Category: Short description of the change`

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

See `skills/commit-format/SKILL.md` for full details on staging hygiene,
validation, and examples.

---

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

---

# Modular Design

Files must stay under 200 lines. Functions under 50 lines. No exceptions
without justification.

When creating new functionality, start with a directory (package) if it
might exceed 200 lines. When editing an existing file over 200 lines, extract
something to leave it shorter than you found it. If the file is over 400
lines, propose a split before continuing.

---

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

---

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

---

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

---

# Self-Bootstrapping

Capability gaps are build tasks, not blockers. When you lack a tool, library,
or skill to complete a request, build the missing piece -- do not explain why
you cannot do it and ask the user for help.

## The Rule

If a task requires a capability you do not currently have:

1. **Say what is missing** in one sentence.
2. **Search the workspace** for existing tools, skills, or libraries that could
   solve or partially solve the problem (`tools/`, `skills/`, `rules/`).
3. **Build the solution** using what exists. Follow `rules/create-tooling.md`
   for new Python tools or `skills/create-skill/SKILL.md` for new skills.
4. **Ask the user only for things you literally cannot do** -- installing
   system packages, starting long-running processes, or providing credentials.
5. **Use the solution** to complete the original request.

## Anti-Patterns

- Listing what you would need and stopping. This is never acceptable.
- Explaining the theory of how something could work without building it.
- Asking the user to build the tool for you.
- Saying "I can't do X" when you can write code that does X.

## Decision Heuristic

```
Can I write code that does this?
  YES --> Write it, save it, use it.
  NO  --> Can I compose existing tools to do this?
    YES --> Compose them.
    NO  --> Is this a system-level action (install, run server, deploy)?
      YES --> Ask the user to do that one step, then continue.
      NO  --> Propose a design and start building.
```

---

# Terminal State Reporting

When running inside a Context terminal session, report your state at the end
of every message by emitting an OSC escape sequence to stdout:

    \x1b]ctx:state=<STATE>\x07

| State     | When to report                                              |
|-----------|-------------------------------------------------------------|
| `running` | You are actively working: generating code, calling tools    |
| `waiting` | You asked the user a question or need user input to proceed |
| `idle`    | The task is complete, no pending work                       |

Default to `running` if uncertain. Emit exactly one marker per message, at the
end. The terminal host strips it from visible output.

---

## Conditional Rules

Read these from `rules/` when the task requires them:

| Rule | When to read |
|------|-------------|
| `rules/command-center.md` | Developing or debugging the Command Center (server, web UI, routes) |
| `rules/contribute.md` | End of session that produced reusable code or tooling |
| `rules/create-tooling.md` | Building new Python modules for the ctx CLI |
| `rules/memory.md` | Multi-session tasks, architectural decisions, recurring issues |
| `rules/orchestration.md` | Delegating to sub-agents or coordinating cross-repo work |
| `rules/pr-workflow.md` | Creating or editing pull requests |
| `rules/worktrees.md` | Working in sub-repos under repos/ |

## Memory Protocol

Before substantial work, scan `memory/` for relevant context (decisions,
progress, known issues). Write memory proactively -- see `rules/memory.md`
for the full protocol.
