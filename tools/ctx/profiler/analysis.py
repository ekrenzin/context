"""Deep retrospective analysis of sessions via Cursor Agent CLI."""

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

from ctx.profiler.io import ANALYSES_DIR, SESSIONS_PATH, find_transcripts_dir, load_json, load_jsonl, save_json

ANALYZE_MODEL = "gemini-3-flash"

ANALYSIS_PROMPT = """\
Read the file at {transcript_path} — it is a full Cursor AI agent chat transcript.

Produce a deep retrospective analysis as a JSON object. Evaluate BOTH the human user \
and the AI agent. Be honest and critical. Score stats 1-10 where 1 is terrible and 10 is exceptional.

Required JSON schema (respond with ONLY this JSON, no markdown fences, no explanation):
{{
  "verdict": "<one of: productive, mixed, struggling, blocked>",
  "title": "<6 words max>",
  "summary": "<2-3 sentence narrative of what happened>",
  "wins": ["<concrete positive outcomes, features built, good patterns>"],
  "errors": ["<mistakes, failed attempts, wrong approaches>"],
  "gaps": ["<missing knowledge, tools not used, skills not invoked>"],
  "user_stats": {{
    "clarity": <1-10 how clear/specific the requests were>,
    "frustration": <1-10 rising means session going poorly>,
    "engagement": <1-10 active collaboration vs passive delegation>,
    "ambition": <1-10 scope of what they asked for>,
    "adaptability": <1-10 how well they pivoted when things changed>
  }},
  "agent_stats": {{
    "competence": <1-10 did it get things right>,
    "efficiency": <1-10 minimal wasted cycles>,
    "creativity": <1-10 novel solutions vs boilerplate>,
    "autonomy": <1-10 worked independently vs needed hand-holding>,
    "thoroughness": <1-10 covered edge cases, tested, reviewed>
  }},
  "efficiency": {{
    "wasted_cycles": "<description of redundant or unnecessary work>",
    "bottlenecks": "<what slowed things down>",
    "score": <1-10>
  }},
  "insights": ["<non-obvious observations, patterns, recurring issues>"],
  "recommendations": ["<actionable suggestions for future sessions>"]
}}
"""


def _resolve_agent_cmd() -> list[str]:
    env_cmd = os.environ.get("CURSOR_AGENT_CMD", "").strip()
    if env_cmd:
        return env_cmd.split()
    if shutil.which("agent"):
        return ["agent"]
    if shutil.which("cursor"):
        return ["cursor", "agent"]
    return ["agent"]


def _analyze_session(transcript_path: Path, model: str) -> dict | None:
    prompt = ANALYSIS_PROMPT.format(transcript_path=transcript_path)
    cmd = [
        *_resolve_agent_cmd(),
        "--print",
        "--mode", "ask",
        "--model", model,
        prompt,
    ]

    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    except FileNotFoundError:
        print(
            "Error: Cursor Agent CLI not found.\n"
            "  Install: curl https://cursor.com/install -fsSL | bash",
            file=sys.stderr,
        )
        return None
    except subprocess.TimeoutExpired:
        print("Warning: Agent CLI timed out.", file=sys.stderr)
        return None

    if proc.returncode != 0:
        print(f"Warning: Agent CLI returned exit code {proc.returncode}", file=sys.stderr)
        if proc.stderr:
            print(f"  stderr: {proc.stderr[:200]}", file=sys.stderr)
        return None

    output = proc.stdout.strip()
    start = output.find("{")
    end = output.rfind("}")
    if start == -1 or end == -1:
        print("Warning: Could not parse JSON object from agent output.", file=sys.stderr)
        print(f"  Output (first 300 chars): {output[:300]}", file=sys.stderr)
        return None

    try:
        return json.loads(output[start : end + 1])
    except json.JSONDecodeError as e:
        print(f"Warning: JSON parse error: {e}", file=sys.stderr)
        return None


def run_analyze(
    chat_id: str | None,
    limit: int | None,
    model: str | None,
    force: bool,
) -> tuple[int, int] | None:
    transcripts_dir = find_transcripts_dir()
    if not transcripts_dir:
        return None

    sessions = load_jsonl(SESSIONS_PATH)
    if not sessions:
        return None

    ANALYSES_DIR.mkdir(parents=True, exist_ok=True)

    if chat_id:
        target = [s for s in sessions if s["chat_id"] == chat_id]
        if not target:
            return None
        to_analyze = target
    else:
        to_analyze = [
            s for s in sessions
            if not (ANALYSES_DIR / f"{s['chat_id']}.json").exists() or force
        ]

    if not to_analyze:
        return (0, len(sessions))

    if not chat_id and limit:
        to_analyze = to_analyze[-limit:]

    model_val = model or ANALYZE_MODEL
    session_map = {s["chat_id"]: s for s in sessions}
    analyzed = 0

    for i, s in enumerate(to_analyze):
        cid = s["chat_id"]
        transcript = transcripts_dir / f"{cid}.txt"
        if not transcript.exists():
            print(f"  Skipping {cid[:8]}... (transcript not found)")
            continue

        print(f"  [{i + 1}/{len(to_analyze)}] Analyzing {cid[:8]}...")
        result = _analyze_session(transcript, model_val)
        if not result:
            continue

        save_json(ANALYSES_DIR / f"{cid}.json", result)

        if cid in session_map:
            session_map[cid]["title"] = result.get("title", session_map[cid].get("title", ""))
            session_map[cid]["summary"] = result.get("summary", session_map[cid].get("summary", ""))
            session_map[cid]["verdict"] = result.get("verdict", "")

        analyzed += 1

    updated = list(session_map.values())
    updated.sort(key=lambda s: s.get("timestamp", ""))
    SESSIONS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(SESSIONS_PATH, "w") as f:
        for s in updated:
            f.write(json.dumps(s, separators=(",", ":")) + "\n")

    return (analyzed, len(sessions))
