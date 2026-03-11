"""Cross-platform subprocess execution for workspace tooling."""

import os
import shutil
import subprocess
from pathlib import Path
from typing import Sequence


class CommandError(Exception):
    def __init__(self, cmd: list[str], returncode: int, stderr: str = ""):
        self.cmd = cmd
        self.returncode = returncode
        self.stderr = stderr
        super().__init__(f"Command failed (exit {returncode}): {' '.join(cmd)}")


def run(
    cmd: Sequence[str | Path],
    *,
    cwd: Path | None = None,
    env_extra: dict[str, str] | None = None,
    check: bool = True,
    capture: bool = False,
    dry_run: bool = False,
) -> subprocess.CompletedProcess[str]:
    """Execute a command using list args (never shell=True) for portability."""
    str_cmd = [str(c) for c in cmd]

    if dry_run:
        print(f"[dry-run] {' '.join(str_cmd)}")
        return subprocess.CompletedProcess(str_cmd, 0, stdout="", stderr="")

    run_env = None
    if env_extra:
        run_env = {**os.environ, **env_extra}

    return subprocess.run(
        str_cmd,
        cwd=cwd,
        env=run_env,
        text=True,
        capture_output=capture,
        check=False if not check else True,
    )


def capture_stdout(
    cmd: Sequence[str | Path],
    *,
    cwd: Path | None = None,
    check: bool = True,
) -> str:
    """Run a command and return stripped stdout."""
    result = run(cmd, cwd=cwd, check=check, capture=True)
    return result.stdout.strip()


def which(program: str) -> Path | None:
    """Cross-platform program lookup."""
    found = shutil.which(program)
    return Path(found) if found else None


def require(program: str, install_hint: str = "") -> Path:
    """Like which(), but exits with a helpful message if not found."""
    path = which(program)
    if path is None:
        msg = f"'{program}' not found in PATH."
        if install_hint:
            msg += f" Install: {install_hint}"
        from ctx.config import err
        err(msg)
        raise SystemExit(1)
    return path
