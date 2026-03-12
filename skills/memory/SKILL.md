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
