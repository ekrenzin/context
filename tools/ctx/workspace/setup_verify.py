"""Verify workspace setup - returns number of failures."""

import os
import shutil
import subprocess
from pathlib import Path

from ctx.config import env, load_env, root_dir
from ctx.runner import run


def _run(desc: str, fn) -> bool:
    try:
        if fn():
            print(f"  [PASS]  {desc}")
            return True
    except Exception:
        pass
    print(f"  [FAIL]  {desc}")
    return False


def _discover_localpypi_projects(root: Path) -> list[str]:
    repos_dir = root / "repos"
    if not repos_dir.is_dir():
        return []
    projects: list[str] = []
    for pyproject in sorted(repos_dir.glob("*/pyproject.toml")):
        repo_name = pyproject.parent.name.strip()
        if not repo_name:
            continue
        projects.append(repo_name.replace("-", "_"))
    return sorted(set(projects))


def _parse_localpypi(raw: str) -> list[str]:
    return sorted({part.strip() for part in raw.split(",") if part.strip()})


def _format_localpypi(projects: list[str]) -> str:
    return ",".join(sorted(set(projects)))


def _upsert_env_key(env_file: Path, key: str, value: str) -> None:
    lines = env_file.read_text(encoding="utf-8").splitlines()
    key_prefix = f"{key}="
    updated = False
    out_lines: list[str] = []
    for line in lines:
        if line.startswith(key_prefix):
            out_lines.append(f"{key}={value}")
            updated = True
        else:
            out_lines.append(line)
    if not updated:
        if out_lines and out_lines[-1].strip():
            out_lines.append("")
        out_lines.append(f"{key}={value}")
    env_file.write_text("\n".join(out_lines) + "\n", encoding="utf-8")
    os.environ[key] = value


def _read_env_key(env_file: Path, key: str) -> str | None:
    key_prefix = f"{key}="
    for line in env_file.read_text(encoding="utf-8").splitlines():
        if line.startswith(key_prefix):
            return line[len(key_prefix):].strip()
    return None


def _choose_localpypi_action() -> str:
    print("  LOCALPYPI mismatch detected. Choose one:")
    print("    1) bring LOCALPYPI in line with repos/")
    print("    2) add all repos/ to LOCALPYPI")
    print("    3) remove non-existent repos/ from LOCALPYPI")
    if not os.isatty(0):
        print("  Non-interactive mode detected, defaulting to: bring in line")
        return "1"
    while True:
        choice = input("  Enter choice [1-3]: ").strip()
        if choice in {"1", "2", "3"}:
            return choice
        print("  Invalid choice. Enter 1, 2, or 3.")


def _check_localpypi(root: Path, env_file: Path) -> bool:
    repo_projects = _discover_localpypi_projects(root)
    configured = _read_env_key(env_file, "LOCALPYPI")
    if configured is None:
        value = _format_localpypi(repo_projects)
        _upsert_env_key(env_file, "LOCALPYPI", value)
        print("  [PASS]  .env: LOCALPYPI set from repos/*/pyproject.toml")
        return True
    env_projects = _parse_localpypi(configured)
    repo_set = set(repo_projects)
    env_set = set(env_projects)
    if repo_set == env_set:
        print("  [PASS]  .env: LOCALPYPI matches repos/*/pyproject.toml")
        return True

    missing_in_env = sorted(repo_set - env_set)
    missing_in_repos = sorted(env_set - repo_set)
    if missing_in_env:
        print("  [INFO]  In repos/ but missing from LOCALPYPI: " + ", ".join(missing_in_env))
    if missing_in_repos:
        print("  [INFO]  In LOCALPYPI but missing from repos/: " + ", ".join(missing_in_repos))

    choice = _choose_localpypi_action()
    if choice == "1":
        next_projects = sorted(repo_set)
        action = "brought in line with repos/"
    elif choice == "2":
        next_projects = sorted(repo_set | env_set)
        action = "expanded to include all repos/"
    else:
        next_projects = sorted(env_set & repo_set)
        action = "trimmed to existing repos/"

    _upsert_env_key(env_file, "LOCALPYPI", _format_localpypi(next_projects))
    print(f"  [PASS]  .env: LOCALPYPI {action}")
    return True


def run_verify() -> int:
    root = root_dir()
    load_env()
    failures = 0
    print("\nPrerequisites\n")
    for cmd in ["git", "node", "npm", "uv"]:
        if not _run(f"{cmd} installed", lambda c=cmd: shutil.which(c) is not None):
            failures += 1
    try:
        v = subprocess.run(["node", "--version"], capture_output=True, text=True)
        major = int((v.stdout or "v0").strip().replace("v", "").split(".")[0])
        if major >= 22:
            print(f"  [PASS]  Node.js >= 22 (v{v.stdout.strip()})")
        else:
            print("  [FAIL]  Node.js >= 22")
            failures += 1
    except Exception:
        print("  [FAIL]  Node.js >= 22")
        failures += 1
    print("\nGit hooks\n")
    hook = root / ".git" / "hooks" / "pre-commit"
    if not _run("Pre-commit hook installed", lambda: hook.exists() and os.access(hook, os.X_OK)):
        failures += 1
    print("\nEnvironment configuration\n")
    env_file, example = root / ".env", root / ".env.example"
    if not env_file.exists():
        print("  [FAIL]  .env file missing")
        failures += 1
    else:
        print("  [PASS]  .env file exists")
        if example.exists():
            for line in example.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key = line.split("=")[0].strip()
                if not _run(f".env: {key} is set", lambda k=key: bool(env(k))):
                    failures += 1
            if not _check_localpypi(root, env_file):
                failures += 1
    print("\n" + "-" * 72)
    if failures == 0:
        print("  All checks passed. Workspace is fully set up.")
    else:
        print(f"  {failures} check(s) failed. Run ctx workspace setup to fix.")
    print("-" * 72 + "\n")
    return failures
