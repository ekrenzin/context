#!/usr/bin/env python3
"""Bootstrap the Context tooling environment.

Creates a virtual environment and installs the context-tools package.
Works cross-platform (macOS, Linux, Windows).

Examples:
    python tools/bootstrap.py
    python tools/bootstrap.py --extras all
    python tools/bootstrap.py --extras image,knowledge
"""

import argparse
import subprocess
import sys
import venv
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parent
VENV_DIR = TOOLS_DIR / ".venv"
MIN_PYTHON = (3, 10)


def check_python() -> None:
    if sys.version_info < MIN_PYTHON:
        ver = f"{sys.version_info.major}.{sys.version_info.minor}"
        req = f"{MIN_PYTHON[0]}.{MIN_PYTHON[1]}"
        sys.stderr.write(f"Error: Python {req}+ required (found {ver}).\n")
        sys.exit(1)


def create_venv(force: bool = False) -> None:
    if VENV_DIR.exists() and not force:
        print(f"Virtual environment exists: {VENV_DIR}")
        return
    if VENV_DIR.exists():
        import shutil

        print(f"Removing stale virtual environment: {VENV_DIR}")
        shutil.rmtree(VENV_DIR)
    print(f"Creating virtual environment: {VENV_DIR} ...")
    venv.create(str(VENV_DIR), with_pip=True)


def _pip() -> str:
    if sys.platform == "win32":
        return str(VENV_DIR / "Scripts" / "pip")
    return str(VENV_DIR / "bin" / "pip")


def install_package(extras: str | None = None) -> None:
    target = f".[{extras}]" if extras else "."
    print(f"Installing context-tools ({target}) ...")
    subprocess.run(
        [_pip(), "install", "--upgrade", "-e", target],
        cwd=str(TOOLS_DIR),
        check=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Bootstrap Context tooling environment.")
    parser.add_argument(
        "--extras",
        default=None,
        help="Optional dependency groups (e.g. image, knowledge, all)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Recreate the virtual environment even if it exists",
    )
    args = parser.parse_args()

    check_python()
    create_venv(force=args.force)
    install_package(args.extras)

    scripts = "Scripts" if sys.platform == "win32" else "bin"
    ctx_bin = VENV_DIR / scripts / "ctx"
    print(f"\nDone. CLI available at: {ctx_bin}")
    print(f"Quick test: {ctx_bin} --help")


if __name__ == "__main__":
    main()
