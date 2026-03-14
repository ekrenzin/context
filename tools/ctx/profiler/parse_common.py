"""Shared parsing utilities, constants, and result builder."""

import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

TOOL_CALL_RE = re.compile(r"^\[Tool call\]\s+(\w+)")
SKILL_PATH_RE = re.compile(r"(?:\.cursor/)?skills/([^/]+)/SKILL\.md$")
USER_QUERY_TAG_RE = re.compile(r"</?user_query>")


def file_metadata(filepath: Path) -> tuple[str, str, int]:
    stat = filepath.stat()
    file_date = datetime.fromtimestamp(
        stat.st_mtime, tz=timezone.utc
    ).strftime("%Y-%m-%d")
    file_ts = datetime.fromtimestamp(
        stat.st_mtime, tz=timezone.utc
    ).isoformat(timespec="seconds")
    return file_date, file_ts, stat.st_size


def build_result(
    filepath: Path,
    file_date: str,
    file_ts: str,
    file_bytes: int,
    tools: Counter,
    skills: Counter,
    subagent_types: Counter,
    sequences: list[list[str]],
    user_turns: int,
    assistant_turns: int,
    assistant_chars: int,
    assistant_turn_lengths: list[int],
    thinking_blocks: int,
    plan_mode_used: bool,
    first_query: str,
) -> dict:
    total_tool_calls = sum(tools.values())
    avg_response = (
        round(assistant_chars / assistant_turns) if assistant_turns else 0
    )
    max_response = max(assistant_turn_lengths) if assistant_turn_lengths else 0

    session = {
        "chat_id": filepath.stem,
        "date": file_date,
        "timestamp": file_ts,
        "first_query": first_query,
        "file_bytes": file_bytes,
        "user_turns": user_turns,
        "assistant_turns": assistant_turns,
        "total_tool_calls": total_tool_calls,
        "tools": dict(tools.most_common()),
        "skills": list(skills.elements()),
        "skill_counts": dict(skills.most_common()),
        "subagent_types": dict(subagent_types.most_common()),
        "plan_mode": plan_mode_used,
        "thinking_blocks": thinking_blocks,
        "response_chars_total": assistant_chars,
        "response_chars_avg": avg_response,
        "response_chars_max": max_response,
    }

    return {
        "session": session,
        "tools": tools,
        "skills": skills,
        "skill_dates": {s: file_date for s in skills},
        "sequences": sequences,
    }
