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
