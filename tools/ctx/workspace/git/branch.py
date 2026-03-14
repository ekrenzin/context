"""Create, delete, and list branches across repos."""

from typing import Optional

import typer

from ctx.config import root_dir
from ctx.workspace.git.shared import (
    git_cmd,
    iter_repos,
    parse_repos_filter,
    print_table,
)

app = typer.Typer()


@app.command("create")
def create(
    name: str = typer.Argument(help="Branch name to create."),
    repos: Optional[str] = typer.Option(
        None, help="Comma-separated repo names to scope to.",
    ),
) -> None:
    """Create a branch in all repos."""
    root = root_dir()
    filt = parse_repos_filter(repos)
    repo_list = iter_repos(root, filt)

    if not repo_list:
        typer.echo("No repos found.")
        return

    rows: list[list[str]] = []
    for repo_name, path in repo_list:
        try:
            git_cmd(path, "branch", name, check=True)
            rows.append([repo_name, f"created {name}"])
        except Exception as exc:
            rows.append([repo_name, f"error: {exc}"])

    print_table(rows, ["Repo", "Result"])


@app.command("delete")
def delete(
    name: str = typer.Argument(help="Branch name to delete."),
    repos: Optional[str] = typer.Option(
        None, help="Comma-separated repo names to scope to.",
    ),
) -> None:
    """Delete a branch in all repos."""
    root = root_dir()
    filt = parse_repos_filter(repos)
    repo_list = iter_repos(root, filt)

    if not repo_list:
        typer.echo("No repos found.")
        return

    rows: list[list[str]] = []
    for repo_name, path in repo_list:
        try:
            git_cmd(path, "branch", "-d", name, check=True)
            rows.append([repo_name, f"deleted {name}"])
        except Exception as exc:
            rows.append([repo_name, f"error: {exc}"])

    print_table(rows, ["Repo", "Result"])


@app.command("list")
def list_branches(
    repos: Optional[str] = typer.Option(
        None, help="Comma-separated repo names to scope to.",
    ),
) -> None:
    """List branches in all repos."""
    root = root_dir()
    filt = parse_repos_filter(repos)
    repo_list = iter_repos(root, filt)

    if not repo_list:
        typer.echo("No repos found.")
        return

    for repo_name, path in repo_list:
        try:
            output = git_cmd(path, "branch", "--list", check=False)
            typer.echo(f"\n{repo_name}:")
            if output.strip():
                typer.echo(output)
            else:
                typer.echo("  (no branches)")
        except Exception as exc:
            typer.echo(f"\n{repo_name}: error: {exc}")
