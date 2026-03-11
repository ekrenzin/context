"""Local validation checks across the workspace or a specific repo."""

import sys
from pathlib import Path
from typing import Optional

import typer

from ctx.config import root_dir
from ctx.workspace.check_repos import _run_check

app = typer.Typer()


def _check_root(root: Path, results: list[str], skip: list[int], pass_count: list[int], fail_count: list[int]) -> None:
    cmd = [sys.executable, "-m", "ctx.cli", "workspace", "validate", "docs"]
    _run_check("Docs validation", root, cmd, results, skip, pass_count, fail_count)


@app.command()
def check(
    repo: Optional[str] = typer.Option(None, "--repo", help="Target a specific sub-repo"),
    root: bool = typer.Option(False, "--root", help="Check root repo only"),
    quick: bool = typer.Option(False, "--quick", help="Lint and type checks only (skip tests)"),
    full: bool = typer.Option(False, "--full", help="Run everything including tests"),
    all_repos: bool = typer.Option(False, "--all", help="Check root + all sub-repos"),
) -> None:
    """Run local validation (lint, types, tests) per repo."""
    if full:
        quick = False
    if not repo and not root and not all_repos:
        typer.echo("No target specified. Use --repo <name>, --root, or --all.")
        raise typer.Exit(1)
    root_path = root_dir()
    results: list[str] = []
    pass_count, fail_count, skip_count = [0], [0], [0]
    print("=========================================\n  Local Validation\n=========================================")
    print(f"  Mode: {'quick (lint + types)' if quick else 'full (lint + types + tests)'}")
    if all_repos:
        _check_root(root_path, results, skip_count, pass_count, fail_count)
    elif root:
        _check_root(root_path, results, skip_count, pass_count, fail_count)
    elif repo:
        typer.echo(f"Unknown repo: {repo}. Configure check_repos.py with your repo checks.")
        raise typer.Exit(1)
    print("\n=========================================\n  Results\n=========================================")
    for r in results:
        print(r)
    print(f"\n  Pass: {pass_count[0]}  Fail: {fail_count[0]}  Skip: {skip_count[0]}")
    if fail_count[0] > 0:
        print("\nValidation FAILED.")
        raise typer.Exit(1)
    print("\nValidation PASSED.")
