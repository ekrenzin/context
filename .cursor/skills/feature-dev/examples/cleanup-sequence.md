# Standard Cleanup & Reset Sequence

To ensure a clean environment for the next session/agent, follow this sequence:

```bash
# 1. Commit/Push changes in sub-repo
cd repos/your-app
git add . && git commit -m "..." && git push

# 2. Return to main
git checkout main
git pull origin main

# 3. Clean up worktrees (if used)
git worktree prune

# 4. Return to root
cd /Users/eankrenzin/Documents/Dev/Repos/context

# 5. Verify status
git status
```
