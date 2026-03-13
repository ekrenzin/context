"""Plain-text (.txt) Cursor transcript parser."""

import re
from collections import Counter
from pathlib import Path

from ctx.profiler.parse_common import (
    TOOL_CALL_RE,
    USER_QUERY_TAG_RE,
    SKILL_PATH_RE,
    build_result,
    file_metadata,
)

TOOL_RESULT_RE = re.compile(r"^\[Tool result\]")
PATH_LINE_RE = re.compile(r"^\s+path:\s+(.+)$")
SUBAGENT_RE = re.compile(r"^\s+subagent_type:\s+(\w+)")
THINKING_RE = re.compile(r"^\[Thinking\]")
USER_TURN_RE = re.compile(r"^user:")
ASSISTANT_TURN_RE = re.compile(r"^assistant:")


def parse_txt(filepath: Path) -> dict:
    """Parse legacy plain-text Cursor transcript."""
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

    file_date, file_ts, file_bytes = file_metadata(filepath)

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

    first_query = " ".join(first_query_lines).strip()[:500]

    return build_result(
        filepath, file_date, file_ts, file_bytes,
        tools, skills, subagent_types, sequences,
        user_turns, assistant_turns, assistant_chars,
        assistant_turn_lengths, thinking_blocks, plan_mode_used,
        first_query,
    )
