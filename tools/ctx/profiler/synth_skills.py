"""Evolve frequently-used skills in-place using recent session analyses."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from ctx.profiler.llm import call_agent
from ctx.profiler.skill_synth_io import (
    CANDIDATES_PATH,
    apply_evolution,
    find_skill_path,
    load_analyses_for_skill,
    load_top_skills,
)

SYNTHESIS_MODEL = "gpt-4.1-mini"


def _auto_index_skill(file_paths: list[str]) -> None:
    """Index evolved skill files into the knowledge base."""
    try:
        from ctx.knowledge.incremental import index_file
        from ctx.config import root_dir
        root = root_dir()
        for fpath in file_paths:
            try:
                rel = str(Path(fpath).relative_to(root))
                count = index_file(rel)
                if count:
                    print(f"[knowledge] Indexed {count} chunk(s) from {rel}")
            except Exception:
                pass
    except ImportError:
        pass


def _parse_json(output: str) -> dict | None:
    start, end = output.find("{"), output.rfind("}")
    if start == -1 or end == -1:
        print("Warning: Could not parse JSON from agent output.", file=sys.stderr)
        return None
    try:
        return json.loads(output[start : end + 1])
    except json.JSONDecodeError as e:
        print(f"Warning: JSON parse error: {e}", file=sys.stderr)
        return None


def build_skill_prompt(skill_name: str, current_skill_md: str, analyses: list[dict]) -> str:
    analyses_text = json.dumps(
        [
            {
                "summary": a.get("summary", ""),
                "gaps": a.get("gaps", []),
                "recommendations": a.get("recommendations", []),
                "insights": a.get("insights", []),
            }
            for a in analyses
        ],
        indent=2,
    )[:6000]

    return f"""\
You are an autonomous skill-evolution agent for the Context development environment.

The skill "{skill_name}" is frequently used by AI agents in this project. Based on recent
session analyses that invoked this skill, produce an improved version of its SKILL.md and
any new resource files that would make future agents more effective.

## Current SKILL.md content
{current_skill_md}

## Recent session analyses that used this skill
{analyses_text}

## Instructions

Produce a JSON object with this exact schema:
{{
  "skill_md": "<full updated SKILL.md content as a string>",
  "resources": [
    {{
      "path": "<relative path inside the skill directory, e.g. examples/usage.md>",
      "content": "<file content>"
    }}
  ]
}}

Rules:
- Preserve the frontmatter (--- block at the top) and extend it if needed.
- Integrate patterns and gaps from the analyses. Prioritize actionable guidance.
- Keep SKILL.md under 200 lines. Extract reusable content into resource files.
- Resource files should be in subdirectories: examples/, checklists/, context/.
- If no meaningful improvements can be made, return the original skill_md unchanged and resources as [].
- Respond with ONLY the JSON object, no markdown fences, no explanation.
"""


def evolve_skill(skill_name: str, dry_run: bool, model: str, stage: bool = False) -> bool | dict:
    from ctx.config import root_dir

    skill_path = find_skill_path(skill_name)
    if not skill_path:
        print(f"Skill '{skill_name}' not found in known skill directories.", file=sys.stderr)
        return False

    analyses = load_analyses_for_skill(skill_name)
    if not analyses:
        print(f"No recent analyses mention skill '{skill_name}'. Skipping.")
        return True

    current_md = skill_path.read_text()
    print(f"Evolving '{skill_name}' ({len(analyses)} relevant analyses)...")

    prompt = build_skill_prompt(skill_name, current_md, analyses)
    raw = call_agent(prompt, model)
    result = _parse_json(raw) if raw else None
    if not result:
        return False

    if stage:
        return {
            "skillName": skill_name,
            "skillDir": str(skill_path.parent.relative_to(root_dir())),
            "currentMd": current_md,
            "skillMd": str(result.get("skill_md", "")).strip(),
            "resources": result.get("resources", []),
            "analysisCount": len(analyses),
        }

    updated = apply_evolution(skill_path, result, dry_run)
    if not dry_run and updated:
        _auto_index_skill(updated)
    return True


def run(top: int = 5, skill: str = "", dry_run: bool = False, stage: bool = False, model: str = SYNTHESIS_MODEL) -> int:
    if skill:
        targets = [(skill, 0)]
    else:
        targets = load_top_skills(top)
        if not targets:
            print("No skill usage data found. Run 'ctx profiler scan' first.")
            return 0

    print(f"Evolving {len(targets)} skill(s): {', '.join(n for n, _ in targets)}")

    if stage:
        candidates = []
        for name, _ in targets:
            print(f"\n--- {name} ---")
            result = evolve_skill(name, dry_run=False, model=model, stage=True)
            if isinstance(result, dict):
                candidates.append(result)
        CANDIDATES_PATH.parent.mkdir(parents=True, exist_ok=True)
        CANDIDATES_PATH.write_text(json.dumps(candidates, indent=2) + "\n")
        print(f"\nStaged {len(candidates)} candidate(s) -> {CANDIDATES_PATH}")
        return 0 if candidates else 1

    success_count = 0
    for name, count in targets:
        label = f"{name} (used {count}x)" if count else name
        print(f"\n--- {label} ---")
        if evolve_skill(name, dry_run, model):
            success_count += 1

    print(f"\nDone: {success_count}/{len(targets)} skills evolved.")
    return 0 if success_count > 0 else 1
