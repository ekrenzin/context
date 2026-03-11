"""Workspace bootstrap, verification, and dependency installation."""

import shutil
from pathlib import Path

import typer

from ctx.config import env, err, info, load_env, root_dir
from ctx.runner import run
from ctx.workspace.checkout import checkout_impl
from ctx.workspace.hooks import install_impl
from ctx.workspace.setup_deps import ensure_uv, run_deps
from ctx.workspace.setup_verify import run_verify

app = typer.Typer()


def _section(title: str) -> None:
    print(f"\n=== {title} ===\n")


def _validate_env(root: Path, skip_db: bool) -> bool:
    env_file, example = root / ".env", root / ".env.example"
    if not env_file.exists():
        if example.exists():
            info(".env not found. Copying from .env.example...")
            shutil.copy(example, env_file)
        else:
            err(".env.example not found at workspace root.")
            raise typer.Exit(1)
    missing = []
    for line in example.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key = line.split("=")[0].strip()
        if not env(key):
            missing.append(key)
    if missing:
        info("The following .env variables are empty: " + ", ".join(missing))
        if not skip_db:
            info("DB introspection requires all variables. Use --skip-db to skip.")
            return False
    else:
        info(".env validated -- all required variables are set.")
    return True


@app.command()
def setup(
    ssh: bool = typer.Option(False, "--ssh", help="Use SSH clone URLs"),
    skip_db: bool = typer.Option(False, "--skip-db", help="Skip DB introspection steps"),
) -> None:
    """Full workspace bootstrap."""
    root = root_dir()
    load_env()
    _section("Step 1/4: Install uv")
    ensure_uv()
    _section("Step 2/4: Clone or update sub-repositories")
    checkout_impl(ssh=ssh)
    _section("Step 3/4: Install pre-commit hook")
    install_impl()
    _section("Step 4/4: Validate root .env")
    if not _validate_env(root, skip_db):
        info("Partial setup complete. Run ctx workspace setup later to finish.")
        return
    print("\n" + "=" * 72 + "\n  Setup complete.\n" + "=" * 72)


@app.command()
def verify() -> None:
    """Validate workspace setup without modifying anything."""
    failures = run_verify()
    if failures > 0:
        raise typer.Exit(failures)


@app.command()
def deps(
    force: bool = typer.Option(False, "--force", help="Force reinstall even if up to date"),
) -> None:
    """Install dependencies for all tools (pip, npm)."""
    run_deps(force=force)
