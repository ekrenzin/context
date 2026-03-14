"""Switch branches across repos."""

from typing import Optional

import typer

from ctx.config import root_dir
from ctx.workspace.git.shared import (
    git_cmd,
    iter_repos,
    parse_repos_filter,
    print_table,
)


def switch(
    branch: str = typer.Argument(help="Branch name to switch to."),
    repos: Optional[str] = typer.Option(
        None, help="Comma-separated repo names to scope to.",
    ),
) -> None:
    """Switch branch across repos. Skips dirty repos."""
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
            git_cmd(path, "switch", branch, check=True)
            rows.append([name, f"switched to {branch}"])
        except Exception as exc:
            rows.append([name, f"error: {exc}"])

    print_table(rows, ["Repo", "Result"])
