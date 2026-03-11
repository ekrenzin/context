"""Core memory operations -- parsing, discovery, and scoring."""

import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

from ctx.config import root_dir

VALID_TYPES = [
    "decisions",
    "known-issues",
    "progress",
    "preferences",
    "observations",
    "environment",
]

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)
_KV_RE = re.compile(r"^(\w[\w-]*):\s*(.+)$", re.MULTILINE)


def memory_dir() -> Path:
    return root_dir() / "memory"


def parse_frontmatter(text: str) -> dict[str, str]:
    match = _FRONTMATTER_RE.match(text)
    if not match:
        return {}
    return {m.group(1): m.group(2).strip() for m in _KV_RE.finditer(match.group(1))}


def extract_summary(text: str, max_chars: int = 200) -> str:
    body = _FRONTMATTER_RE.sub("", text).strip()
    for line in body.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if stripped.startswith(("-", "*")):
            stripped = stripped.lstrip("-* ").strip()
        if len(stripped) > 20:
            tail = "..." if len(stripped) > max_chars else ""
            return stripped[:max_chars].rstrip() + tail
    return "(no summary)"


def discover_entries() -> list[dict]:
    entries: list[dict] = []
    mem = memory_dir()
    if not mem.is_dir():
        return entries
    for type_dir in mem.iterdir():
        if not type_dir.is_dir() or type_dir.name.startswith("."):
            continue
        mem_type = type_dir.name
        for md_file in type_dir.glob("*.md"):
            text = md_file.read_text(encoding="utf-8", errors="replace")
            fm = parse_frontmatter(text)
            mtime = datetime.fromtimestamp(md_file.stat().st_mtime, tz=timezone.utc)
            date_str = fm.get("date", mtime.strftime("%Y-%m-%d"))
            entries.append({
                "path": str(md_file.relative_to(root_dir())),
                "abs_path": md_file,
                "type": mem_type,
                "title": fm.get("title", md_file.stem.replace("-", " ").title()),
                "date": date_str,
                "ticket": fm.get("ticket", ""),
                "repo": fm.get("repo", ""),
                "status": fm.get("status", ""),
                "summary": extract_summary(text),
                "text": text,
            })
    return entries


def score_entry(
    entry: dict, ticket: str, repo: str, query: str, ref_date: datetime
) -> int:
    score = 0
    if ticket and entry["ticket"].upper() == ticket.upper():
        score += 50
    if repo and repo.lower() in entry["repo"].lower():
        score += 30

    entry_date = parse_date(entry["date"], ref_date)
    days_old = max((ref_date - entry_date).days, 0)
    if days_old <= 7:
        score += max(10 - days_old, 1)

    if query:
        haystack = f"{entry['title']} {entry['summary']} {entry['text'][:500]}".lower()
        for kw in query.lower().split():
            if kw in haystack:
                score += 5

    if score == 0:
        score = max(1, 5 - days_old)

    return score


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower().strip())
    return slug.strip("-")[:80] or "untitled"


def parse_date(date_str: str, fallback: datetime) -> datetime:
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return fallback
