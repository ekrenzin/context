"""File I/O and path constants for the profiler."""

import json
from pathlib import Path
from typing import Any

from ctx.config import root_dir

PROFILE_DIR = root_dir() / "memory" / "profile"
PROFILE_PATH = PROFILE_DIR / "agent-profile.json"
SESSIONS_PATH = PROFILE_DIR / "agent-sessions.jsonl"
HISTORY_PATH = PROFILE_DIR / "agent-history.jsonl"
ANALYSES_DIR = PROFILE_DIR / "analyses"
STATE_PATH = PROFILE_DIR / ".state.json"
CURSOR_PROJECTS_DIR = Path.home() / ".cursor" / "projects"
CLAUDE_PROJECTS_DIR = Path.home() / ".claude" / "projects"


def find_transcript_dirs() -> list[Path]:
    """Return all transcript directories matching the current workspace."""
    base = root_dir().name
    dirs: list[Path] = []

    # Cursor: ~/.cursor/projects/*/agent-transcripts
    candidates = list(CURSOR_PROJECTS_DIR.glob("*/agent-transcripts"))
    matched = [c for c in candidates if base in str(c)]
    dirs.extend(matched or candidates[:1])

    # Claude Code: ~/.claude/projects/*<workspace>*
    if CLAUDE_PROJECTS_DIR.is_dir():
        for entry in CLAUDE_PROJECTS_DIR.iterdir():
            if entry.is_dir() and base in entry.name:
                dirs.append(entry)

    return dirs


def find_transcripts_dir() -> Path | None:
    """Legacy helper -- returns first Cursor transcript dir or None."""
    dirs = find_transcript_dirs()
    return dirs[0] if dirs else None


def collect_transcript_files(dirs: list[Path]) -> list[Path]:
    """Gather .txt and .jsonl transcript files from the given directories."""
    files: list[Path] = []
    for d in dirs:
        # Flat .txt files (legacy Cursor format)
        files.extend(d.glob("*.txt"))
        # Flat .jsonl files (Claude Code format)
        files.extend(d.glob("*.jsonl"))
        # Nested <uuid>/<uuid>.jsonl (new Cursor format)
        for sub in d.iterdir():
            if sub.is_dir():
                files.extend(sub.glob("*.jsonl"))
    return sorted(set(files))


def load_json(path: Path) -> dict[str, Any]:
    if path.exists():
        with open(path) as f:
            return json.load(f)
    return {}


def save_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2, sort_keys=False)
        f.write("\n")


def append_jsonl(path: Path, record: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a") as f:
        f.write(json.dumps(record, separators=(",", ":")) + "\n")


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    records = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    return records
