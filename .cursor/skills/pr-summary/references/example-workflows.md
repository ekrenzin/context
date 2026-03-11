# Example Workflows

These examples work for **any repository** in the workspace, including the root context repo. Replace `<repo-name>` with the actual repo (e.g., `your-app`, `your-service`, or use `.` for root).

## When working in a sub-repo

```bash
# 0. Verify directory and repository
cd repos/<repo-name>
pwd
REPO_NAME=$(basename $(git rev-parse --show-toplevel))
echo "Working in repository: $REPO_NAME"

# 1. Generate diff (save to /tmp/ to avoid git tracking)
git fetch origin --quiet
git diff origin/main...HEAD > /tmp/diff.file

# 2. Identify repository and read correct template
# For your-app: ../../tools/context-templates/PR_SUMMARY_TEMPLATE.md
# For your-service: ../../tools/context-templates/PR_SUMMARY_TEMPLATE_NOTIFIER.md
# For others: ../../tools/context-templates/PR_SUMMARY_TEMPLATE.md (default)
cat ../../tools/context-templates/PR_SUMMARY_TEMPLATE.md
```

## When working in the root context repo

```bash
# 0. Verify directory and repository
pwd
REPO_NAME=$(basename $(git rev-parse --show-toplevel))
echo "Working in repository: $REPO_NAME"
# Should show: context

# 1. Generate diff (save to /tmp/ to avoid git tracking)
git fetch origin --quiet
git diff origin/main...HEAD > /tmp/diff.file

# 2. Read default template (root uses default template)
cat tools/context-templates/PR_SUMMARY_TEMPLATE.md

# 3. Fill template based on /tmp/diff.file analysis
# (Do this manually or with AI assistance)

# 4. Save to file in /tmp/
cat > /tmp/pr-body.md << 'EOF'
## Summary
[Description of changes]

## Environments
- No changes

## Frontend
- [Changes or "No changes"]

## Backend
- [Changes or "No changes"]

## Testing
- [ ] Unit Tests
- [ ] System Tests
EOF

# 5. Update PR (try gh pr edit first, fallback to REST API)
# Replace <org>, <repo-name>, and <number> with actual values
gh pr edit <number> --body-file /tmp/pr-body.md || \
  gh api -X PATCH repos/<org>/<repo-name>/pulls/<number> -f body="$(cat /tmp/pr-body.md)"

# 6. Verify update succeeded, then clean up temporary files
rm -f /tmp/diff.file /tmp/pr-body.md

# 7. Check for any leftover temp files in workspace
git status --short | grep -E "pr-body|diff\.file" && rm -f pr-body.md pr-body.txt diff.file || echo "Cleanup complete"
```
