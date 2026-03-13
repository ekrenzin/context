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
