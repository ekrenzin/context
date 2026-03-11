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
