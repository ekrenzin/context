"""Deep retrospective analysis of sessions via LLM API."""

import json
import os
import urllib.request
import urllib.error
from pathlib import Path

from ctx.profiler.io import ANALYSES_DIR, SESSIONS_PATH, collect_transcript_files, find_transcript_dirs, load_jsonl, save_json

DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001"
DEFAULT_OPENAI_MODEL = "gpt-4.1-mini"
MAX_TRANSCRIPT_CHARS = 120_000

ANALYSIS_PROMPT = """\
You are analyzing an AI agent chat transcript. \
Produce a deep retrospective analysis as a JSON object. Evaluate BOTH the human user \
and the AI agent. Be honest and critical. Score stats 1-10 where 1 is terrible and 10 is exceptional.

Required JSON schema (respond with ONLY this JSON, no markdown fences, no explanation):
{
  "verdict": "<one of: productive, mixed, struggling, blocked>",
  "title": "<6 words max>",
  "summary": "<2-3 sentence narrative of what happened>",
  "wins": ["<concrete positive outcomes, features built, good patterns>"],
  "errors": ["<mistakes, failed attempts, wrong approaches>"],
  "gaps": ["<missing knowledge, tools not used, skills not invoked>"],
  "user_stats": {
    "clarity": "<1-10 how clear/specific the requests were>",
    "frustration": "<1-10 rising means session going poorly>",
    "engagement": "<1-10 active collaboration vs passive delegation>",
    "ambition": "<1-10 scope of what they asked for>",
    "adaptability": "<1-10 how well they pivoted when things changed>"
  },
  "agent_stats": {
    "competence": "<1-10 did it get things right>",
    "efficiency": "<1-10 minimal wasted cycles>",
    "creativity": "<1-10 novel solutions vs boilerplate>",
    "autonomy": "<1-10 worked independently vs needed hand-holding>",
    "thoroughness": "<1-10 covered edge cases, tested, reviewed>"
  },
  "efficiency": {
    "wasted_cycles": "<description of redundant or unnecessary work>",
    "bottlenecks": "<what slowed things down>",
    "score": "<1-10>"
  },
  "insights": ["<non-obvious observations, patterns, recurring issues>"],
  "recommendations": ["<actionable suggestions for future sessions>"]
}
"""


def _load_env_file() -> dict[str, str]:
    env_path = Path(__file__).resolve().parents[3] / ".env"
    vals: dict[str, str] = {}
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            vals[k.strip()] = v.strip().strip("'\"")
    return vals


def _resolve_key(env_names: list[str]) -> str | None:
    for var in env_names:
        key = os.environ.get(var, "").strip()
        if key:
            return key
    env_vals = _load_env_file()
    for var in env_names:
        if var in env_vals and env_vals[var]:
            return env_vals[var]
    return None


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


def _call_anthropic(transcript: str, model: str, api_key: str) -> dict | None:
    body = json.dumps({
        "model": model,
        "max_tokens": 2048,
        "messages": [
            {
                "role": "user",
                "content": f"{ANALYSIS_PROMPT}\n\n<transcript>\n{transcript}\n</transcript>",
            }
        ],
    }).encode()

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"Warning: Anthropic API returned {e.code}: {e.read().decode()[:200]}")
        return None
    except Exception as e:
        print(f"Warning: Anthropic API call failed: {e}")
        return None

    text = ""
    for block in data.get("content", []):
        if block.get("type") == "text":
            text += block["text"]

    return _extract_json(text)


def _call_openai(transcript: str, model: str, api_key: str) -> dict | None:
    body = json.dumps({
        "model": model,
        "max_tokens": 2048,
        "messages": [
            {"role": "system", "content": ANALYSIS_PROMPT},
            {
                "role": "user",
                "content": f"<transcript>\n{transcript}\n</transcript>",
            },
        ],
    }).encode()

    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"Warning: OpenAI API returned {e.code}: {e.read().decode()[:200]}")
        return None
    except Exception as e:
        print(f"Warning: OpenAI API call failed: {e}")
        return None

    text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    return _extract_json(text)


def _resolve_provider() -> tuple[str, str, str] | None:
    """Returns (provider, model, api_key) or None. Prefers OpenAI for cost."""
    openai_key = _resolve_key(["OPENAI_API_KEY", "OPENAI_KEY"])
    if openai_key:
        return ("openai", DEFAULT_OPENAI_MODEL, openai_key)
    anthropic_key = _resolve_key(["ANTHROPIC_API_KEY", "ANTHROPIC_KEY"])
    if anthropic_key:
        return ("anthropic", DEFAULT_ANTHROPIC_MODEL, anthropic_key)
    return None


def _call_llm(transcript: str, provider: str, model: str, api_key: str) -> dict | None:
    if provider == "anthropic":
        return _call_anthropic(transcript, model, api_key)
    return _call_openai(transcript, model, api_key)


# Exported for commands.py display
ANALYZE_MODEL = DEFAULT_ANTHROPIC_MODEL


def _provider_for_model(model: str) -> str:
    if model.startswith(("claude", "haiku", "sonnet", "opus")):
        return "anthropic"
    return "openai"


def run_analyze(
    chat_id: str | None,
    limit: int | None,
    model: str | None,
    force: bool,
) -> tuple[int, int] | None:
    if model:
        provider = _provider_for_model(model)
        model_val = model
        key_names = (["ANTHROPIC_API_KEY", "ANTHROPIC_KEY"] if provider == "anthropic"
                     else ["OPENAI_API_KEY", "OPENAI_KEY"])
        api_key = _resolve_key(key_names)
        if not api_key:
            print(f"Error: No {provider} API key found.")
            return None
    else:
        resolved = _resolve_provider()
        if not resolved:
            print("Error: No API key found.")
            print("  Set ANTHROPIC_API_KEY or OPENAI_API_KEY env var, or add to .env")
            return None
        provider, model_val, api_key = resolved

    dirs = find_transcript_dirs()
    if not dirs:
        return None

    sessions = load_jsonl(SESSIONS_PATH)
    if not sessions:
        return None

    # Build chat_id -> transcript path lookup across all dirs and formats
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

        result = _call_llm(text, provider, model_val, api_key)
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
