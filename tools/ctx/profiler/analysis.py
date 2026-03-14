"""Deep retrospective analysis of sessions via LLM API."""

import json
from pathlib import Path

from ctx.profiler.io import ANALYSES_DIR, SESSIONS_PATH, collect_transcript_files, find_transcript_dirs, load_jsonl, save_json
from ctx.profiler.llm import call_agent

ANALYZE_MODEL = "gpt-4.1-mini"
MAX_TRANSCRIPT_CHARS = 120_000

ANALYSIS_PROMPT = """\
You are analyzing an AI agent chat transcript. \
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
    "clarity": "<1-10 how clear/specific the requests were>",
    "frustration": "<1-10 rising means session going poorly>",
    "engagement": "<1-10 active collaboration vs passive delegation>",
    "ambition": "<1-10 scope of what they asked for>",
    "adaptability": "<1-10 how well they pivoted when things changed>"
  }},
  "agent_stats": {{
    "competence": "<1-10 did it get things right>",
    "efficiency": "<1-10 minimal wasted cycles>",
    "creativity": "<1-10 novel solutions vs boilerplate>",
    "autonomy": "<1-10 worked independently vs needed hand-holding>",
    "thoroughness": "<1-10 covered edge cases, tested, reviewed>"
  }},
  "efficiency": {{
    "wasted_cycles": "<description of redundant or unnecessary work>",
    "bottlenecks": "<what slowed things down>",
    "score": "<1-10>"
  }},
  "insights": ["<non-obvious observations, patterns, recurring issues>"],
  "recommendations": ["<actionable suggestions for future sessions>"]
}}
"""


def _extract_json(text: str) -> dict | None:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        print(f"Warning: No JSON in response: {text[:300]}")
        return None
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError as e:
        print(f"Warning: JSON parse error: {e}")
        return None


def run_analyze(
    chat_id: str | None,
    limit: int | None,
    model: str | None,
    force: bool,
) -> tuple[int, int] | None:
    dirs = find_transcript_dirs()
    if not dirs:
        return None

    sessions = load_jsonl(SESSIONS_PATH)
    if not sessions:
        return None

    transcript_map: dict[str, Path] = {}
    for fp in collect_transcript_files(dirs):
        cid = fp.stem
        if cid not in transcript_map:
            transcript_map[cid] = fp

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
        transcript = transcript_map.get(cid)
        if not transcript or not transcript.exists():
            continue

        print(f"  [{i + 1}/{len(to_analyze)}] Analyzing {cid[:8]}...")
        text = transcript.read_text(errors="replace")
        if len(text) > MAX_TRANSCRIPT_CHARS:
            text = text[:MAX_TRANSCRIPT_CHARS] + "\n\n[TRUNCATED]"

        prompt = ANALYSIS_PROMPT + f"\n\n<transcript>\n{text}\n</transcript>"
        raw = call_agent(prompt, model_val)
        result = _extract_json(raw) if raw else None
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
