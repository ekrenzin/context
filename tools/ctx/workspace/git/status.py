"""Show branch, dirty/clean, and ahead/behind for all repos."""

from pathlib import Path
from typing import Optional

import typer

from ctx.config import root_dir
from ctx.workspace.git.shared import (
    git_cmd,
    iter_repos,
    parse_repos_filter,
    print_table,
)


def _ahead_behind(repo_path: Path) -> str:
    """Return ahead/behind counts relative to upstream."""
    try:
        upstream = git_cmd(
            repo_path,
            "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}",
            check=False,
        )
        if not upstream:
            return "no upstream"
        counts = git_cmd(
            repo_path,
            "rev-list", "--left-right", "--count", f"HEAD...{upstream}",
            check=False,
        )
        if not counts:
            return "?"
        parts = counts.split()
        ahead, behind = int(parts[0]), int(parts[1])
        if ahead == 0 and behind == 0:
            return "up to date"
        segments = []
        if ahead:
            segments.append(f"+{ahead}")
        if behind:
            segments.append(f"-{behind}")
        return " ".join(segments)
    except Exception:
        return "?"


def _dirty_status(repo_path: Path) -> str:
    """Return 'clean' or count of dirty files."""
    output = git_cmd(repo_path, "status", "--porcelain", check=False)
    if not output:
        return "clean"
    count = len([l for l in output.splitlines() if l.strip()])
    return f"{count} changed"


def status(
    repos: Optional[str] = typer.Option(
        None, help="Comma-separated repo names to scope to.",
    ),
) -> None:
    """Show branch, status, and ahead/behind for all repos."""
    root = root_dir()
    filt = parse_repos_filter(repos)
    repo_list = iter_repos(root, filt, include_root=True)

    if not repo_list:
        typer.echo("No repos found. Check repos.yaml and run ctx workspace checkout.")
        return

    rows: list[list[str]] = []
    for name, path in repo_list:
        try:
            branch = git_cmd(path, "rev-parse", "--abbrev-ref", "HEAD", check=False)
            dirty = _dirty_status(path)
            sync = _ahead_behind(path)
            rows.append([name, branch or "?", dirty, sync])
        except Exception as exc:
            rows.append([name, "error", str(exc), ""])

    print_table(rows, ["Repo", "Branch", "Status", "Sync"])
