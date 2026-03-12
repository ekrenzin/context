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
TRANSCRIPTS_DIR = Path.home() / ".cursor" / "projects"


def find_transcripts_dir() -> Path | None:
    base = root_dir().name
    candidates = list(TRANSCRIPTS_DIR.glob("*/agent-transcripts"))
    for c in candidates:
        if base in str(c):
            return c
    return candidates[0] if candidates else None


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
