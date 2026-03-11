"""Git worktree management for parallel development."""

import os
from pathlib import Path
from typing import Optional

import typer

from ctx.config import err, root_dir
from ctx.runner import run

app = typer.Typer()


def _create_impl(root_path: Optional[Path] = None) -> None:
    root = root_path or Path(os.environ.get("ROOT_WORKTREE_PATH", ""))
    if not root or not root.exists():
        err("ROOT_WORKTREE_PATH is not set or invalid.")
        err("This script is run by worktree setup or manually with:")
        err("  ROOT_WORKTREE_PATH=/path/to/main/checkout ctx workspace worktrees create")
        raise typer.Exit(1)
    worktree_dir = Path.cwd()
    worktree_name = worktree_dir.name
    print(f"Setting up worktree: {worktree_name}")
    print(f"  Main worktree: {root}")
    print(f"  This worktree: {worktree_dir}")
    if (root / ".env").exists():
        import shutil
        shutil.copy(root / ".env", worktree_dir / ".env")
        print("  copied:    .env")
    else:
        print("  skipped:   .env (not found in main worktree)")
    (worktree_dir / "repos").mkdir(parents=True, exist_ok=True)
    repos_src = root / "repos"
    if repos_src.exists():
        for repo_dir in repos_src.iterdir():
            if not repo_dir.is_dir():
                continue
            repo_name = repo_dir.name
            target = worktree_dir / "repos" / repo_name
            git_dir = repo_dir / ".git"
            if git_dir.exists() or (repo_dir / ".git").is_file():
                result = run(
                    ["git", "-C", str(repo_dir), "worktree", "add", "--detach", str(target)],
                    check=False,
                )
                if result.returncode == 0:
                    print(f"  worktree:  repos/{repo_name}")
                else:
                    target.symlink_to(repo_dir.resolve())
                    print(f"  symlink:   repos/{repo_name} (worktree add failed, falling back)")
            else:
                target.symlink_to(repo_dir.resolve())
                print(f"  symlink:   repos/{repo_name} (not a git repo)")
    else:
        print("  skipped:   repos/ (directory not found in main worktree)")
    if (root / "context").exists():
        ctx_link = worktree_dir / "context"
        if ctx_link.exists():
            ctx_link.unlink()
        ctx_link.symlink_to((root / "context").resolve())
        print("  symlink:   context/")
    for sub in ["csv", "scripts", "data", "output", "scratch"]:
        (worktree_dir / "playground" / sub).mkdir(parents=True, exist_ok=True)
    print("  created:   playground/")
    db_tool = worktree_dir / "tools" / "db"
    if (db_tool / "package.json").exists():
        result = run(["npm", "ci", "--prefer-offline"], cwd=db_tool, check=False)
        if result.returncode == 0:
            print("  installed: tools/db deps")
        else:
            print("  skipped:   tools/db deps (npm ci failed)")
    print("Worktree setup complete.")


def _prune_impl(dry_run: bool, list_only: bool) -> None:
    root = root_dir()
    repos_dir = root / "repos"
    if not repos_dir.exists():
        print("No repos/ directory found at", repos_dir)
        return
    for repo_dir in repos_dir.iterdir():
        if not repo_dir.is_dir():
            continue
        repo_name = repo_dir.name
        git_dir = repo_dir / ".git"
        if not git_dir.exists() and not (repo_dir / ".git").is_file():
            continue
        if list_only:
            print(f"=== {repo_name} ===")
            run(["git", "-C", str(repo_dir), "worktree", "list"])
            print()
        elif dry_run:
            result = run(
                ["git", "-C", str(repo_dir), "worktree", "prune", "--dry-run"],
                check=False,
                capture=True,
            )
            if result.stdout or result.stderr:
                print(f"{repo_name}: {result.stdout or result.stderr}")
        else:
            r1 = run(["git", "-C", str(repo_dir), "worktree", "list"], capture=True)
            before = len((r1.stdout or "").splitlines())
            run(["git", "-C", str(repo_dir), "worktree", "prune"], check=False)
            r2 = run(["git", "-C", str(repo_dir), "worktree", "list"], capture=True)
            after = len((r2.stdout or "").splitlines())
            pruned = before - after
            if pruned > 0:
                print(f"{repo_name}: pruned {pruned} stale worktree(s)")
    if not list_only and not dry_run:
        r1 = run(["git", "-C", str(root), "worktree", "list"], capture=True)
        before = len((r1.stdout or "").splitlines())
        run(["git", "-C", str(root), "worktree", "prune"], check=False)
        r2 = run(["git", "-C", str(root), "worktree", "list"], capture=True)
        after = len((r2.stdout or "").splitlines())
        root_pruned = before - after
        if root_pruned > 0:
            print("context (root): pruned", root_pruned, "stale worktree(s)")
        print("Done.")


@app.command()
def create(
    root_path: Optional[Path] = typer.Option(None, "--root", help="Main worktree path (or set ROOT_WORKTREE_PATH)"),
) -> None:
    """Bootstrap a worktree for isolated parallel work."""
    _create_impl(root_path)


@app.command()
def prune(
    dry_run: bool = typer.Option(False, "--dry-run", help="Show what would be pruned without removing"),
    list_only: bool = typer.Option(False, "--list", help="List all worktrees per sub-repo"),
) -> None:
    """Clean up stale worktree metadata across all sub-repos."""
    _prune_impl(dry_run, list_only)
