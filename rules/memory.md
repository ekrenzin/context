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
