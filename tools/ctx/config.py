"""Shared configuration -- env loading, path resolution, platform detection."""

import os
import sys
from pathlib import Path

_root: Path | None = None
_env_loaded = False


def root_dir() -> Path:
    """Workspace root (the directory containing AGENTS.md)."""
    global _root
    if _root is not None:
        return _root

    candidate = Path(__file__).resolve().parent.parent.parent
    if (candidate / "AGENTS.md").exists():
        _root = candidate
        return _root

    candidate = Path.cwd()
    while candidate != candidate.parent:
        if (candidate / "AGENTS.md").exists():
            _root = candidate
            return _root
        candidate = candidate.parent

    _root = Path.cwd()
    return _root


def load_env(required: list[str] | None = None) -> dict[str, str]:
    """Parse .env from workspace root into os.environ (setdefault)."""
    global _env_loaded
    env_file = root_dir() / ".env"
    loaded: dict[str, str] = {}

    if env_file.is_file():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            key, _, value = line.partition("=")
            key, value = key.strip(), value.strip()
            os.environ.setdefault(key, value)
            loaded[key] = value

    _env_loaded = True

    if required:
        missing = [v for v in required if not os.environ.get(v)]
        if missing:
            err(f"Missing required env vars in {env_file}: {', '.join(missing)}")
            sys.exit(1)

    return loaded


def env(key: str, default: str = "") -> str:
    """Read an env var, loading .env on first call if needed."""
    if not _env_loaded:
        load_env()
    return os.environ.get(key, default)


def is_windows() -> bool:
    return sys.platform == "win32"


def err(msg: str) -> None:
    sys.stderr.write(f"Error: {msg}\n")


def info(msg: str) -> None:
    print(msg)
