"""Snapshot git state and file metrics across all repos."""

import json
import re
from datetime import datetime, timezone
from pathlib import Path

import typer

from ctx.config import root_dir
from ctx.runner import run

app = typer.Typer()


def _get_repo_names(root: Path) -> list[str]:
    manifest = root / "repos.yaml"
    if not manifest.exists():
        return []
    text = manifest.read_text(encoding="utf-8")
    names: list[str] = []
    for m in re.finditer(r"^\s*-\s*name:\s*(.+)$", text, re.MULTILINE):
        names.append(m.group(1).strip())
    return names


def _scan_repo(repos_dir: Path, name: str) -> dict:
    repo_path = repos_dir / name
    if not (repo_path / ".git").exists():
        return {"present": False}
    head = "unknown"
    branch = "unknown"
    try:
        r = run(["git", "-C", str(repo_path), "rev-parse", "--short", "HEAD"], capture=True, check=False)
        head = (r.stdout or "").strip() or "unknown"
    except Exception:
        pass
    try:
        r = run(["git", "-C", str(repo_path), "rev-parse", "--abbrev-ref", "HEAD"], capture=True, check=False)
        branch = (r.stdout or "").strip() or "unknown"
    except Exception:
        pass
    log = ""
    try:
        r = run(["git", "-C", str(repo_path), "log", "--oneline", "-10"], capture=True, check=False)
        log = (r.stdout or "").strip()[:500]
    except Exception:
        pass
    status_short = ""
    try:
        r = run(["git", "-C", str(repo_path), "status", "--short"], capture=True, check=False)
        status_short = (r.stdout or "").strip()
    except Exception:
        pass
    uncommitted = len([x for x in status_short.splitlines() if x.strip()]) if status_short else 0
    large_files = ""
    try:
        exts = ("*.ts", "*.tsx", "*.py", "*.js")
        found: list[tuple[int, str]] = []
        for ext in exts:
            for f in repo_path.rglob(ext):
                if "node_modules" in str(f) or ".git" in str(f) or "__pycache__" in str(f) or "dist" in str(f):
                    continue
                try:
                    lines = len(f.read_text(encoding="utf-8", errors="ignore").splitlines())
                    if lines > 200:
                        found.append((lines, str(f)))
                except Exception:
                    pass
        found.sort(key=lambda x: -x[0])
        large_files = "\n".join(f"{lines} {path}" for lines, path in found[:10])
    except Exception:
        pass
    return {
        "present": True,
        "head": head,
        "branch": branch,
        "recentLog": log,
        "uncommittedCount": uncommitted,
        "largeFiles": large_files,
    }


@app.command()
def scan() -> None:
    """Snapshot git state per repo to playground/output/codebase-scan.json."""
    root = root_dir()
    repos_dir = root / "repos"
    output_dir = root / "playground" / "output"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / "codebase-scan.json"
    repo_names = _get_repo_names(root)
    print("Scanning repos...")
    repos_data: dict = {}
    for name in repo_names:
        repos_data[name] = _scan_repo(repos_dir, name)
    data = {
        "scannedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "repos": repos_data,
    }
    output_file.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"Codebase scan complete -> {output_file}")
