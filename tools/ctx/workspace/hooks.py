"""Install git hooks for the root context repository."""

from pathlib import Path

import typer

from ctx.config import err, root_dir

app = typer.Typer()

PRE_COMMIT_HOOK = '''#!/usr/bin/env bash
#
# pre-commit hook for root context repository
#
# Rejects any commit that attempts to stage files under the repos/ directory.
# This is a defense-in-depth safeguard complementing .gitignore to ensure
# sub-repository contents are never tracked in the root repo.

staged_repos_files="$(git diff --cached --name-only | grep -E '^repos/' || true)"

if [ -n "$staged_repos_files" ]; then
    echo ""
    echo "========================================================================"
    echo "  COMMIT BLOCKED - Sub-repository files detected in staging area"
    echo "========================================================================"
    echo ""
    echo "  The following files under repos/ were staged for commit:"
    echo ""
    echo "$staged_repos_files" | sed 's/^/    /'
    echo ""
    echo "  The repos/ directory contains independent git repositories that"
    echo "  must NOT be tracked by the root context repo."
    echo ""
    echo "  To fix this, unstage the files:"
    echo "    git reset HEAD repos/"
    echo ""
    echo "  To commit within a sub-repo, cd into it first:"
    echo "    cd repos/<name> && git add . && git commit"
    echo ""
    echo "========================================================================"
    exit 1
fi
'''


def install_impl() -> None:
    root = root_dir()
    hooks_dir = root / ".git" / "hooks"
    hook_file = hooks_dir / "pre-commit"
    if not (root / ".git").exists():
        err(f"Not a git repository: {root}")
        err("        Run 'git init' first.")
        raise typer.Exit(1)
    hooks_dir.mkdir(parents=True, exist_ok=True)
    hook_file.write_text(PRE_COMMIT_HOOK, encoding="utf-8")
    hook_file.chmod(0o755)
    print(f"[OK] Pre-commit hook installed at: {hook_file}")
    print("     Commits staging files under repos/ will be rejected.")


@app.command()
def install() -> None:
    """Install pre-commit hook that blocks staging repos/ files."""
    install_impl()
