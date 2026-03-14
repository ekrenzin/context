"""Synthesize agent skills from recurring session workflow clusters."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from ctx.config import root_dir
from ctx.profiler.cluster import cluster, load_analyses, load_sessions
from ctx.profiler.llm import call_agent

AGENTS_DIR = root_dir() / ".cursor" / "skills" / "agents"
CANDIDATES_PATH = root_dir() / "playground" / "output" / "agent-candidates.json"
SYNTHESIS_MODEL = "claude-haiku-4-5-20251001"
DEFAULT_LOOKBACK_DAYS = 30
DEFAULT_MIN_SESSIONS = 3
DEFAULT_TOP = 5


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9-]", "-", name.lower()).strip("-")


def build_prompt(c: dict, analyses: list[dict]) -> str:
    analyses_text = json.dumps(
        [
            {
                "summary": a.get("summary", ""),
                "wins": a.get("wins", []),
                "gaps": a.get("gaps", []),
                "insights": a.get("insights", []),
                "recommendations": a.get("recommendations", []),
            }
            for a in analyses
        ],
        indent=2,
    )[:5000]

    skill_list = ", ".join(c["skills"])

    return f"""\
You are an autonomous agent-builder for the Context development environment.

Analysis of {c["frequency"]} Cursor AI agent sessions has revealed a recurring workflow
cluster. Sessions in this cluster consistently invoke the following skills together:
  {skill_list}

Productivity rate: {c["productivity_rate"] * 100:.0f}%
Most recent session: {c["latest"]}

## Session analyses from this cluster
{analyses_text}

## Task

Synthesize a specialized SKILL.md for a PURPOSE-BUILT AGENT that encapsulates this
workflow. This agent should be invoked when a user's request maps to this cluster's
workflow pattern.

An agent SKILL.md differs from a regular skill:
- It describes WHEN to invoke this agent (trigger phrases, task signatures).
- It specifies the full workflow: pre-conditions, skill chain order, and done criteria.
- It carries domain context extracted from the session analyses (insights, failure modes).
- It is concise -- under 150 lines -- so agents load it quickly.

Respond with ONLY a JSON object (no markdown fences) matching this schema:
{{
  "agent_name": "<kebab-case name, 2-4 words, describes the workflow>",
  "skill_md": "<full SKILL.md content as a string>",
  "trigger_phrases": ["<phrase 1>", "<phrase 2>"],
  "confidence": <0.0-1.0, how strongly this cluster represents a distinct workflow>
}}

Rules:
- agent_name must be kebab-case, 2-4 words, NO temporal markers or redundant words.
- skill_md must start with a YAML frontmatter block (--- ... ---).
- skill_md must include: trigger, pre-conditions, workflow steps, done criteria, known pitfalls.
- Embed insights from the analyses as "Known Pitfalls" or "Domain Context" sections.
- No emojis. No documentation prose. No "this skill does X" narration.
- If the cluster is too generic to justify a distinct agent, set confidence below 0.5.
"""


def _parse_json_object(output: str) -> dict | None:
    start, end = output.find("{"), output.rfind("}")
    if start == -1 or end == -1:
        print(f"Warning: No JSON in output: {output[:200]}", file=sys.stderr)
        return None
    try:
        return json.loads(output[start : end + 1])
    except json.JSONDecodeError as e:
        print(f"Warning: JSON parse error: {e}", file=sys.stderr)
        return None


def apply_agent(result: dict, dry_run: bool) -> str | None:
    name = _slug(result.get("agent_name", ""))
    skill_md = str(result.get("skill_md", "")).strip()
    if not name or not skill_md:
        return None

    dest = AGENTS_DIR / name / "SKILL.md"
    root = root_dir()
    if dry_run:
        print(f"[dry-run] Would write {dest.relative_to(root)}")
    else:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(skill_md + "\n")
        print(f"Written  {dest.relative_to(root)}")
    return name


def run(
    top: int = DEFAULT_TOP,
    min_sessions: int = DEFAULT_MIN_SESSIONS,
    days: int = DEFAULT_LOOKBACK_DAYS,
    dry_run: bool = False,
    stage: bool = False,
    model: str = SYNTHESIS_MODEL,
    min_confidence: float = 0.5,
) -> int:
    sessions = load_sessions(days)
    if not sessions:
        print("No sessions found. Run 'ctx profiler scan' first.")
        return 1

    clusters = cluster(sessions, min_sessions=min_sessions)
    if not clusters:
        print(f"No clusters found with >= {min_sessions} sessions in the last {days} days.")
        return 0

    targets = clusters[:top]
    print(f"Found {len(clusters)} clusters, synthesizing top {len(targets)}...")

    candidates = []
    applied = 0
    for i, c in enumerate(targets):
        label = " + ".join(c["skills"])
        print(f"\n[{i + 1}/{len(targets)}] {label} ({c['frequency']} sessions, score={c['score']})")

        analyses = load_analyses(c["chat_ids"])
        prompt = build_prompt(c, analyses)
        raw = call_agent(prompt, model)
        result = _parse_json_object(raw) if raw else None
        if not result:
            print("  Skipped (LLM error).")
            continue

        confidence = result.get("confidence", 0)
        if confidence < min_confidence:
            print(f"  Skipped (confidence={confidence:.2f} < {min_confidence}).")
            continue

        if stage:
            candidates.append(
                {
                    "agentName": result.get("agent_name", ""),
                    "skills": c["skills"],
                    "frequency": c["frequency"],
                    "confidence": confidence,
                    "triggerPhrases": result.get("trigger_phrases", []),
                    "skillMd": result.get("skill_md", ""),
                }
            )
            print(f"  Staged  '{result.get('agent_name', '')}' (confidence={confidence:.2f})")
        else:
            name = apply_agent(result, dry_run)
            if name:
                applied += 1
                print(f"  Agent   '{name}' (confidence={confidence:.2f})")

    if stage:
        CANDIDATES_PATH.parent.mkdir(parents=True, exist_ok=True)
        CANDIDATES_PATH.write_text(json.dumps(candidates, indent=2) + "\n")
        print(f"\nStaged {len(candidates)} agent(s) -> {CANDIDATES_PATH.relative_to(root_dir())}")
        return 0 if candidates else 1

    print(f"\nDone: {applied}/{len(targets)} agent(s) written.")
    return 0 if applied > 0 else 1
