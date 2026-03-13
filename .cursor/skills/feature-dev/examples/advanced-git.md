# Advanced Git Workflows for Agents

Efficiently manage branches and commits in the development environment.

## Rebase & Prune

When branching from a feature-specific parent branch that has unrelated changes:

```bash
# Prune unrelated commits during rebase
git rebase --skip

# Granular commit control (interactive rebase)
git rebase -i HEAD~N
```

## Verify Merge Status

Before starting a new branch from `main`:

```bash
git fetch origin
git log HEAD..origin/main --oneline
# If behind, suggest git pull --ff-only to user
```

## Handling Pre-commit Failures

If a commit is rejected by a hook:

1. Fix the specific error (e.g., linting or type error).
2. Run `ctx workspace check --quick --repo <name>` to verify.
3. Create a NEW commit (do not use `commit --amend` if it failed the hook).
