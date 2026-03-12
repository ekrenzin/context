# Proposals

Per-task design declarations. Every piece of work the agent performs gets a
proposal directory here before implementation begins.

## Structure

Each proposal is a directory with at least three files:

```
<slug>/
  PROPOSAL.md              -- design declaration (what, why, scope, status)
  impact.md                -- affected files, systems, cross-repo risks
  01-<task-name>.md        -- delegatable task chunk with agent/model
  02-<task-name>.md        -- ...as many as the work requires
  NN-<task-name>.md
```

Each numbered task file specifies:
- **agent**: which sub-agent type should execute it
- **model**: recommended model (fast for simple, default for complex)
- **depends_on**: which task numbers must complete first
- **status**: pending / in-progress / completed / skipped

## Status Lifecycle

`draft` -> `in-progress` -> `completed` | `rejected`

## Governance

- Proposals are gitignored (local working docs).
- Promote reusable patterns to `memory/decisions/`, `.cursor/skills/`,
  or `docs/exec-plans/` when appropriate.
- See `.cursor/rules/proposals.mdc` for the full protocol.
- See `.cursor/skills/proposals/SKILL.md` for the scaffold workflow.
