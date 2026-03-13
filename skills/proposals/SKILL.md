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

## Building Proposals

Once a proposal is approved, dispatch an AI agent to build it:

### CLI

```bash
ctx proposals list                          # list all proposals with status
ctx proposals build <slug>                  # build full proposal in new terminal
ctx proposals build <slug> --task 2         # build a specific task
ctx proposals build <slug> --agent codex    # use codex instead of claude
ctx proposals build <slug> --embedded       # dispatch via CC embedded terminal
ctx proposals build <slug> --dry-run        # preview without executing
ctx proposals show <slug> --json            # inspect assembled prompt
```

### MCP Tools (via Command Center)

The CC MCP server exposes two tools (auto-discovered):

- `cc_proposal_list` -- list proposals with status
- `cc_proposal_build` -- dispatch an agent to build a proposal or task

### Command Center UI

Navigate to Solutions > Proposals in the dashboard. Each proposal card has a
"Build" button. The proposal detail view has per-task build buttons and a
header-level "Build All" button. Builds spawn embedded terminal sessions.

## Guidelines

- Proposals are gitignored (local working docs, not committed).
- Keep task count reasonable (3-13 tasks for most proposals).
- Each task should take one agent session to complete.
- Promote reusable patterns to `memory/decisions/` or `skills/` when done.
- If a proposal is rejected, document why in the PROPOSAL.md before archiving.
