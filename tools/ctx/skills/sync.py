"""Clone/pull a skills repo and symlink into user-level Cursor skills.

Security model:
- Allowlisted remote only -- rejects clones whose origin diverges from ALLOWED_REMOTE.
- ff-only pulls -- refuses merge commits that could rewrite history.
- Skill directory names validated against a strict pattern (alphanumeric + hyphens).
- Symlinks inside the cloned repo are never followed; only real directories qualify.
- Symlink targets are canonicalized and verified to stay inside CACHE_DIR.
- Stale link cleanup only touches links that point into CACHE_DIR (never user content).
"""

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ALLOWED_REMOTE = "https://github.com/anthropics/skills.git"
ALLOWED_REMOTE_SSH = "git@github.com:anthropics/skills.git"
REPO_BRANCH = "main"
SKILLS_SUBDIR = "skills"
_SAFE_NAME = re.compile(r"^[a-z0-9][a-z0-9\-]*$")
_MAX_SKILL_SIZE_MB = 50

_WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
CACHE_DIR = _WORKSPACE_ROOT / ".cache" / "anthropic-skills"

_HOME = Path(os.environ.get("HOME", os.environ.get("USERPROFILE", "")))
TARGET_DIR = _HOME / ".cursor" / "skills-cursor"


def _git(args: list[str], cwd: Path, timeout: int = 60) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=str(cwd),
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if result.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed: {result.stderr.strip()}")
    return result.stdout.strip()


def _verify_remote(cwd: Path) -> None:
    """Reject the cache if its origin doesn't match the allowlisted remote."""
    origin = _git(["remote", "get-url", "origin"], cwd=cwd)
    if origin not in (ALLOWED_REMOTE, ALLOWED_REMOTE_SSH):
        raise SecurityError(
            f"Remote origin mismatch: got {origin!r}, "
            f"expected {ALLOWED_REMOTE!r}. "
            "Cache may have been tampered with -- run with --force to re-clone."
        )


def _is_safe_name(name: str) -> bool:
    return bool(_SAFE_NAME.match(name)) and ".." not in name


class SecurityError(RuntimeError):
    """Raised when a security invariant is violated during sync."""


def _clone_or_pull(force: bool = False) -> bool:
    """Ensure the cache has an up-to-date clone. Returns True if new commits were pulled."""
    if force and CACHE_DIR.exists():
        shutil.rmtree(CACHE_DIR)

    if not CACHE_DIR.exists():
        CACHE_DIR.parent.mkdir(parents=True, exist_ok=True)
        _git(
            ["clone", "--depth", "1", "--branch", REPO_BRANCH,
             ALLOWED_REMOTE, str(CACHE_DIR)],
            cwd=CACHE_DIR.parent,
        )
        _verify_remote(CACHE_DIR)
        return True

    _verify_remote(CACHE_DIR)

    old_sha = _git(["rev-parse", "HEAD"], cwd=CACHE_DIR)
    _git(["fetch", "origin", "--quiet"], cwd=CACHE_DIR)
    _git(["pull", "--ff-only", "origin", REPO_BRANCH], cwd=CACHE_DIR)
    new_sha = _git(["rev-parse", "HEAD"], cwd=CACHE_DIR)
    return old_sha != new_sha


def _available_skills() -> list[str]:
    """Return validated skill directory names from the cached clone.

    Rejects symlinks, names with path-traversal characters, and directories
    that lack a SKILL.md file.
    """
    skills_root = CACHE_DIR / SKILLS_SUBDIR
    if not skills_root.is_dir():
        return []

    valid: list[str] = []
    for entry in sorted(skills_root.iterdir()):
        if entry.is_symlink():
            print(f"  SECURITY: skipping symlink {entry.name}", file=sys.stderr)
            continue
        if not entry.is_dir():
            continue
        if not _is_safe_name(entry.name):
            print(f"  SECURITY: skipping unsafe name {entry.name!r}", file=sys.stderr)
            continue
        if not (entry / "SKILL.md").exists():
            continue
        resolved = entry.resolve()
        if not str(resolved).startswith(str(CACHE_DIR.resolve())):
            print(f"  SECURITY: {entry.name} escapes cache dir", file=sys.stderr)
            continue
        valid.append(entry.name)
    return valid


def _clean_stale_symlinks(managed: set[str]) -> list[str]:
    """Remove symlinks in TARGET_DIR that point into CACHE_DIR but are dangling or removed upstream."""
    removed: list[str] = []
    if not TARGET_DIR.exists():
        return removed
    cache_prefix = str(CACHE_DIR)
    for entry in TARGET_DIR.iterdir():
        if not entry.is_symlink():
            continue
        link_target = os.readlink(entry)
        if not link_target.startswith(cache_prefix):
            continue
        if entry.name not in managed or not entry.exists():
            entry.unlink()
            removed.append(entry.name)
    return removed


def sync(
    force: bool = False,
    dry_run: bool = False,
) -> dict[str, object]:
    """Run a full sync cycle: clone/pull, validate, symlink, clean stale links."""
    if dry_run:
        print("[dry-run] Would clone/pull:", ALLOWED_REMOTE)
        print("[dry-run] Cache dir:", CACHE_DIR)
        print("[dry-run] Target dir:", TARGET_DIR)
        if CACHE_DIR.exists():
            _verify_remote(CACHE_DIR)
            skills = _available_skills()
            print(f"[dry-run] {len(skills)} skills available:", ", ".join(skills))
        return {"dry_run": True}

    updated = _clone_or_pull(force=force)

    skills = _available_skills()
    TARGET_DIR.mkdir(parents=True, exist_ok=True)
    linked: list[str] = []
    skipped: list[str] = []

    for name in skills:
        dest = TARGET_DIR / name
        src = CACHE_DIR / SKILLS_SUBDIR / name

        src_resolved = src.resolve()
        if not str(src_resolved).startswith(str(CACHE_DIR.resolve())):
            print(f"  SECURITY: {name} source escapes cache", file=sys.stderr)
            skipped.append(name)
            continue

        if dest.exists() and not dest.is_symlink():
            print(f"  skip: {name} (non-symlink already exists)", file=sys.stderr)
            skipped.append(name)
            continue

        if dest.is_symlink():
            current_target = os.readlink(dest)
            if current_target == str(src):
                linked.append(name)
                continue
            dest.unlink()

        dest.symlink_to(src)
        linked.append(name)

    removed = _clean_stale_symlinks(set(skills))

    return {
        "updated": updated,
        "linked": len(linked),
        "skipped": skipped,
        "removed": removed,
        "total_skills": len(skills),
        "cache_dir": str(CACHE_DIR),
        "target_dir": str(TARGET_DIR),
    }
