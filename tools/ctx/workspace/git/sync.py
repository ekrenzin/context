"""Fetch and pull across all repos."""

from typing import Optional

import typer

from ctx.config import root_dir
from ctx.workspace.git.shared import (
    git_cmd,
    iter_repos,
    parse_repos_filter,
    print_table,
)


def fetch(
    repos: Optional[str] = typer.Option(
        None, help="Comma-separated repo names to scope to.",
    ),
) -> None:
    """Fetch all remotes for each repo."""
    root = root_dir()
    filt = parse_repos_filter(repos)
    repo_list = iter_repos(root, filt)

    if not repo_list:
        typer.echo("No repos found.")
        return

    rows: list[list[str]] = []
    for name, path in repo_list:
        try:
            git_cmd(path, "fetch", "--all", "--prune", check=True)
            rows.append([name, "ok"])
        except Exception as exc:
            rows.append([name, f"error: {exc}"])

    print_table(rows, ["Repo", "Fetch"])


def pull(
    repos: Optional[str] = typer.Option(
        None, help="Comma-separated repo names to scope to.",
    ),
) -> None:
    """Fast-forward pull all repos. Skips dirty repos."""
    root = root_dir()
    filt = parse_repos_filter(repos)
    repo_list = iter_repos(root, filt)

    if not repo_list:
        typer.echo("No repos found.")
        return

    rows: list[list[str]] = []
    for name, path in repo_list:
        try:
            dirty = git_cmd(path, "status", "--porcelain", check=False)
            if dirty.strip():
                rows.append([name, "skipped (dirty)"])
                continue
            git_cmd(path, "pull", "--ff-only", check=True)
            rows.append([name, "ok"])
        except Exception as exc:
            rows.append([name, f"error: {exc}"])

    print_table(rows, ["Repo", "Pull"])
