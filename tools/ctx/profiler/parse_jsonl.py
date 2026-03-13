"""JSONL transcript parser (Cursor nested dirs and Claude Code)."""

import json
from collections import Counter
from pathlib import Path

from ctx.profiler.parse_common import (
    TOOL_CALL_RE,
    USER_QUERY_TAG_RE,
    SKILL_PATH_RE,
    build_result,
    file_metadata,
)


def parse_jsonl(filepath: Path) -> dict:
    """Parse JSONL transcript (Cursor nested or Claude Code format)."""
    tools: Counter = Counter()
    skills: Counter = Counter()
    subagent_types: Counter = Counter()
    sequences: list[list[str]] = []
    current_turn_tools: list[str] = []

    user_turns = 0
    assistant_turns = 0
    assistant_chars = 0
    assistant_turn_lengths: list[int] = []
    thinking_blocks = 0
    plan_mode_used = False
    first_query = ""

    file_date, file_ts, file_bytes = file_metadata(filepath)
    last_role: str | None = None

    with open(filepath, errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue

            role = _detect_role(obj)
            if role not in ("user", "assistant"):
                continue
            content_blocks = _extract_content(obj)
            if not content_blocks:
                continue

            if role == "user" and last_role != "user":
                if current_turn_tools:
                    sequences.append(current_turn_tools)
                    current_turn_tools = []
                user_turns += 1
            elif role == "assistant" and last_role != "assistant":
                if current_turn_tools:
                    sequences.append(current_turn_tools)
                    current_turn_tools = []
                assistant_turns += 1

            turn_chars = 0
            for block in content_blocks:
                btype = block.get("type", "")

                if btype == "text":
                    text = block.get("text", "")
                    if role == "user" and user_turns == 1 and not first_query:
                        clean = _clean_user_text(text)
                        if clean:
                            first_query = clean[:500]
                    if role == "assistant":
                        turn_chars += len(text)
                        assistant_chars += len(text)
                        _extract_text_tools(text, tools, current_turn_tools)
                        if "[Thinking]" in text:
                            thinking_blocks += 1

                elif btype == "tool_use":
                    name = block.get("name", "")
                    if name:
                        tools[name] += 1
                        current_turn_tools.append(name)
                        if name in ("SwitchMode", "CreatePlan"):
                            plan_mode_used = True
                        inp = block.get("input", {})
                        if name == "Agent":
                            st = inp.get("subagent_type", "")
                            if st:
                                subagent_types[st] += 1
                        if name in ("Read", "ReadFile"):
                            p = inp.get("file_path", inp.get("path", ""))
                            sm = SKILL_PATH_RE.search(p)
                            if sm:
                                skills[sm.group(1)] += 1

                elif btype == "thinking":
                    thinking_blocks += 1

            if role == "assistant" and turn_chars > 0:
                assistant_turn_lengths.append(turn_chars)

            last_role = role

    if current_turn_tools:
        sequences.append(current_turn_tools)

    return build_result(
        filepath, file_date, file_ts, file_bytes,
        tools, skills, subagent_types, sequences,
        user_turns, assistant_turns, assistant_chars,
        assistant_turn_lengths, thinking_blocks, plan_mode_used,
        first_query,
    )


def _detect_role(obj: dict) -> str:
    """Detect message role from Cursor or Claude Code JSONL formats."""
    typ = obj.get("type", "")
    if typ in ("user", "assistant"):
        return typ
    role = obj.get("role", "")
    if role in ("user", "assistant"):
        return role
    msg = obj.get("message", {})
    if isinstance(msg, dict):
        return msg.get("role", "")
    return ""


def _extract_content(obj: dict) -> list[dict]:
    """Extract content blocks from either JSONL format."""
    msg = obj.get("message", {})
    if isinstance(msg, dict):
        content = msg.get("content", "")
    else:
        content = ""

    if isinstance(content, list):
        return content
    if isinstance(content, str) and content:
        return [{"type": "text", "text": content}]
    return []


def _clean_user_text(text: str) -> str:
    """Strip markup from user query text."""
    clean = USER_QUERY_TAG_RE.sub("", text).strip()
    if clean.startswith("<"):
        return ""
    return clean


def _extract_text_tools(
    text: str,
    tools: Counter,
    current_turn_tools: list[str],
) -> None:
    """Extract tool calls embedded in plain text (Cursor format)."""
    for line in text.split("\n"):
        m = TOOL_CALL_RE.match(line)
        if m:
            name = m.group(1)
            tools[name] += 1
            current_turn_tools.append(name)
