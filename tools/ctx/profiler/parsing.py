"""Transcript parsing and regex patterns."""

import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

TOOL_CALL_RE = re.compile(r"^\[Tool call\]\s+(\w+)")
TOOL_RESULT_RE = re.compile(r"^\[Tool result\]")
PATH_LINE_RE = re.compile(r"^\s+path:\s+(.+)$")
SKILL_PATH_RE = re.compile(r"\.cursor/skills/([^/]+)/SKILL\.md$")
SUBAGENT_RE = re.compile(r"^\s+subagent_type:\s+(\w+)")
THINKING_RE = re.compile(r"^\[Thinking\]")
USER_TURN_RE = re.compile(r"^user:")
ASSISTANT_TURN_RE = re.compile(r"^assistant:")
USER_QUERY_TAG_RE = re.compile(r"</?user_query>")


def parse_transcript(filepath: Path) -> dict:
    tools: Counter = Counter()
    skills: Counter = Counter()
    subagent_types: Counter = Counter()
    sequences: list[list[str]] = []
    current_turn_tools: list[str] = []
    last_tool_name: str | None = None

    user_turns = 0
    assistant_turns = 0
    assistant_chars = 0
    assistant_turn_lengths: list[int] = []
    thinking_blocks = 0
    plan_mode_used = False
    current_speaker: str | None = None
    current_turn_chars = 0
    first_query_lines: list[str] = []
    capturing_first_query = False

    stat = filepath.stat()
    file_date = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).strftime("%Y-%m-%d")
    file_ts = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(timespec="seconds")

    with open(filepath, errors="replace") as f:
        for line in f:
            stripped = line.rstrip("\n")

            if USER_TURN_RE.match(stripped):
                if current_speaker == "assistant" and current_turn_chars > 0:
                    assistant_turn_lengths.append(current_turn_chars)
                current_speaker = "user"
                current_turn_chars = 0
                user_turns += 1
                if user_turns == 1:
                    capturing_first_query = True
                if current_turn_tools:
                    sequences.append(current_turn_tools)
                current_turn_tools = []
                last_tool_name = None
                continue

            if ASSISTANT_TURN_RE.match(stripped):
                if current_speaker == "assistant" and current_turn_chars > 0:
                    assistant_turn_lengths.append(current_turn_chars)
                capturing_first_query = False
                current_speaker = "assistant"
                current_turn_chars = 0
                assistant_turns += 1
                if current_turn_tools:
                    sequences.append(current_turn_tools)
                current_turn_tools = []
                last_tool_name = None
                continue

            if capturing_first_query and current_speaker == "user":
                clean = USER_QUERY_TAG_RE.sub("", stripped).strip()
                if clean and not clean.startswith("<") and not clean.startswith("@"):
                    first_query_lines.append(clean)
                continue

            tool_match = TOOL_CALL_RE.match(stripped)
            if tool_match:
                tool_name = tool_match.group(1)
                tools[tool_name] += 1
                current_turn_tools.append(tool_name)
                if tool_name in ("SwitchMode", "CreatePlan"):
                    plan_mode_used = True
                last_tool_name = tool_name
                continue

            if TOOL_RESULT_RE.match(stripped):
                last_tool_name = None
                continue

            if last_tool_name:
                path_match = PATH_LINE_RE.match(stripped)
                if path_match and last_tool_name in ("Read", "ReadFile"):
                    skill_match = SKILL_PATH_RE.search(path_match.group(1))
                    if skill_match:
                        skills[skill_match.group(1)] += 1
                    last_tool_name = None
                    continue

                subagent_match = SUBAGENT_RE.match(stripped)
                if subagent_match and last_tool_name == "Task":
                    subagent_types[subagent_match.group(1)] += 1
                    continue

                if stripped and not stripped.startswith(" "):
                    last_tool_name = None

            if THINKING_RE.match(stripped):
                thinking_blocks += 1
                continue

            if current_speaker == "assistant":
                if stripped and not TOOL_CALL_RE.match(stripped):
                    current_turn_chars += len(stripped)
                    assistant_chars += len(stripped)

    if current_speaker == "assistant" and current_turn_chars > 0:
        assistant_turn_lengths.append(current_turn_chars)
    if current_turn_tools:
        sequences.append(current_turn_tools)

    total_tool_calls = sum(tools.values())
    avg_response = round(assistant_chars / assistant_turns) if assistant_turns else 0
    max_response = max(assistant_turn_lengths) if assistant_turn_lengths else 0
    first_query = " ".join(first_query_lines).strip()[:500]

    session = {
        "chat_id": filepath.stem,
        "date": file_date,
        "timestamp": file_ts,
        "first_query": first_query,
        "file_bytes": stat.st_size,
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


def extract_ngrams(sequences: list[list[str]], n: int) -> Counter:
    ngrams: Counter = Counter()
    for seq in sequences:
        for i in range(len(seq) - n + 1):
            gram = " -> ".join(seq[i : i + n])
            ngrams[gram] += 1
    return ngrams
