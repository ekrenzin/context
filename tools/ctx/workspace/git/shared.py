"""Shared helpers for cross-repo git operations."""

import re
from pathlib import Path
from typing import Optional

import typer

from ctx.config import root_dir
from ctx.runner import capture_stdout


def iter_repos(
    root: Path,
    repos_filter: Optional[list[str]] = None,
    include_root: bool = False,
) -> list[tuple[str, Path]]:
    """Yield (name, path) for each repo on disk from repos.yaml."""
    repos_dir = root / "repos"
    manifest = root / "repos.yaml"
    names: list[str] = []
    if manifest.exists():
        text = manifest.read_text(encoding="utf-8")
        for m in re.finditer(r"^\s*-\s*name:\s*(.+)$", text, re.MULTILINE):
            names.append(m.group(1).strip())

    result: list[tuple[str, Path]] = []
    if include_root:
        if not repos_filter or "(root)" in repos_filter:
            result.append(("(root)", root))

    for name in names:
        if repos_filter and name not in repos_filter:
            continue
        repo_path = repos_dir / name
        if repo_path.is_dir() and (repo_path / ".git").exists():
            result.append((name, repo_path))
    return result


def git_cmd(repo_path: Path, *args: str, check: bool = True) -> str:
    """Run a git command in repo_path and return stdout."""
    return capture_stdout(
        ["git", "-C", str(repo_path), *args],
        check=check,
    )


def print_table(rows: list[list[str]], headers: list[str]) -> None:
    """Print a column-aligned table."""
    if not rows:
        return
    widths = [len(h) for h in headers]
    for row in rows:
        for i, cell in enumerate(row):
            if i < len(widths):
                widths[i] = max(widths[i], len(cell))
    header_line = "  ".join(h.ljust(widths[i]) for i, h in enumerate(headers))
    separator = "  ".join("-" * w for w in widths)
    typer.echo(header_line)
    typer.echo(separator)
    for row in rows:
        line = "  ".join(
            (row[i] if i < len(row) else "").ljust(widths[i])
            for i in range(len(headers))
        )
        typer.echo(line)


def repos_option() -> Optional[str]:
    """Typer Option for --repos filter."""
    return typer.Option(None, help="Comma-separated repo names to scope to.")


def parse_repos_filter(repos: Optional[str]) -> Optional[list[str]]:
    """Parse --repos string into a list."""
    if not repos:
        return None
    return [r.strip() for r in repos.split(",") if r.strip()]
