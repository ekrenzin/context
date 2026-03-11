"""Launch development services in background."""

import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional

import typer

from ctx.config import root_dir

app = typer.Typer()

PIDS: list[int] = []
LABELS: list[str] = []


def _cleanup() -> None:
    print("\nStopping all services...")
    for i, pid in enumerate(PIDS):
        try:
            os.killpg(pid, signal.SIGTERM)
        except (ProcessLookupError, OSError):
            try:
                os.kill(pid, signal.SIGTERM)
            except (ProcessLookupError, OSError):
                pass
        print(f"  Stopping {LABELS[i]} (pid {pid})...")
    print("All services stopped.")
    sys.exit(0)


def _start_service(label: str, cwd: Path, cmd: list[str]) -> None:
    print(f"[{label}] Starting in {cwd}...")
    proc = subprocess.Popen(
        cmd,
        cwd=cwd,
        preexec_fn=os.setsid if sys.platform != "win32" else None,
        start_new_session=True if sys.platform == "win32" else False,
    )
    PIDS.append(proc.pid)
    LABELS.append(label)
    print(f"[{label}] pid={proc.pid}")


@app.command()
def start(
    skip: Optional[list[str]] = typer.Option(None, "--skip", help="Skip one or more services"),
) -> None:
    """Start development services defined in your workspace."""
    skip_set = set(skip or [])
    root = root_dir()
    if sys.platform != "win32":
        signal.signal(signal.SIGINT, lambda s, f: _cleanup())
        signal.signal(signal.SIGTERM, lambda s, f: _cleanup())
    print("================================================")
    print("  Development Services")
    print("================================================\n")
    repos_dir = root / "repos"
    if repos_dir.is_dir():
        for repo_dir in sorted(repos_dir.iterdir()):
            if not repo_dir.is_dir():
                continue
            repo_name = repo_dir.name
            if repo_name in skip_set:
                continue
            pkg_json = repo_dir / "package.json"
            if pkg_json.exists():
                _start_service(repo_name, repo_dir, ["npm", "run", "dev"])
    print("\nAll requested services launched. Press Ctrl+C to stop.\n")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        _cleanup()
