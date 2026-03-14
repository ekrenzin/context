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

## Workspace-Wide Git Commands

Use `ctx workspace git` for coordinated operations across all sub-repos:

```bash
ctx workspace git status                  # branch, dirty/clean, ahead/behind
ctx workspace git fetch                   # fetch --all --prune per repo
ctx workspace git pull                    # ff-only pull (skips dirty repos)
ctx workspace git branch create <name>    # create branch in all repos
ctx workspace git branch delete <name>    # delete branch in all repos
ctx workspace git branch list             # list branches per repo
ctx workspace git switch <branch>         # switch branch (skips dirty repos)
```

All commands accept `--repos repo1,repo2` to scope to specific repos.

The root repo is included in `status` but excluded from branch/switch/pull/fetch
(the root is the workspace coordinator, not a sub-repo).

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
