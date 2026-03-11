"""Synthesize new memory files from recent session analyses and codebase scan."""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

from ctx.config import root_dir
from ctx.profiler.llm import call_agent

ANALYSES_DIR = root_dir() / "memory" / "profile" / "analyses"
MEMORY_DIR = root_dir() / "memory"
CODEBASE_SCAN = root_dir() / "playground" / "output" / "codebase-scan.json"
CANDIDATES_OUT = root_dir() / "playground" / "output" / "memory-candidates.json"
LOCAL_CATEGORIES = {"observations", "progress", "preferences", "environment"}
STAGED_CATEGORIES = {"decisions", "known-issues"}
SYNTHESIS_MODEL = "gemini-3-flash"


def load_recent_analyses(days: int) -> list[dict]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    results = []
    if not ANALYSES_DIR.exists():
        return results
    for f in ANALYSES_DIR.glob("*.json"):
        try:
            mtime = datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.utc)
            if mtime < cutoff:
                continue
            data = json.loads(f.read_text())
            results.append(data)
        except Exception:
            continue
    return results


def load_codebase_scan() -> dict:
    try:
        return json.loads(CODEBASE_SCAN.read_text())
    except Exception:
        return {}


def collect_existing_memory_names() -> list[str]:
    names = []
    for cat in LOCAL_CATEGORIES | STAGED_CATEGORIES:
        cat_dir = MEMORY_DIR / cat
        if cat_dir.exists():
            for f in cat_dir.glob("*.md"):
                names.append(f"{cat}/{f.name}")
    return names


def build_prompt(analyses: list[dict], scan: dict, existing: list[str]) -> str:
    analyses_text = json.dumps(analyses, indent=2)[:8000]
    scan_text = json.dumps(scan, indent=2)[:3000]
    existing_text = "\n".join(existing) if existing else "(none yet)"

    return f"""\
You are an autonomous memory agent for the Context development environment.

Analyze the following data sources and produce new memory entries that will help future
AI agents and developers work more effectively.

## Recent Session Analyses (last 7 days)
{analyses_text}

## Codebase Snapshot
{scan_text}

## Existing Memory Files (do NOT duplicate these)
{existing_text}

## Instructions

Produce a JSON array of new memory entries. Each entry must be:
{{
  "category": "<observations|progress|preferences|environment|decisions|known-issues>",
  "filename": "<short-descriptive-name.md>",
  "content": "<full markdown content of the memory file>"
}}

Rules:
- observations: codebase patterns, fragile modules, implicit conventions noticed
- progress: current state of in-flight work, what was completed, what remains
- preferences: developer style patterns observed from session behavior
- environment: local tooling quirks, port conflicts, version requirements
- decisions: architectural choices with reasoning (requires strong evidence)
- known-issues: reproducible gotchas with clear workarounds

Do NOT create entries that duplicate existing files. Merge insight into one well-targeted file.
Each content field must be concise markdown (under 300 words). Keep filename lowercase with hyphens.
If nothing meaningful can be synthesized, return an empty array [].
Respond with ONLY the JSON array, no markdown fences, no explanation.
"""


def _parse_json_array(output: str) -> list[dict] | None:
    start, end = output.find("["), output.rfind("]")
    if start == -1 or end == -1:
        print("Warning: Could not parse JSON array from agent output.", file=sys.stderr)
        return None
    try:
        return json.loads(output[start : end + 1])
    except json.JSONDecodeError as e:
        print(f"Warning: JSON parse error: {e}", file=sys.stderr)
        return None


def safe_filename(name: str) -> str:
    name = re.sub(r"[^a-z0-9\-]", "-", name.lower())
    name = re.sub(r"-{2,}", "-", name).strip("-")
    return name if name.endswith(".md") else name + ".md"


def write_entries(entries: list[dict], dry_run: bool) -> tuple[int, int]:
    written = 0
    staged = []
    root = root_dir()

    for entry in entries:
        category = str(entry.get("category", "")).strip()
        filename = safe_filename(str(entry.get("filename", "entry")))
        content = str(entry.get("content", "")).strip()

        if not content or category not in (LOCAL_CATEGORIES | STAGED_CATEGORIES):
            continue

        if category in LOCAL_CATEGORIES:
            dest = MEMORY_DIR / category / filename
            if dry_run:
                print(f"[dry-run] Would write {dest}")
            else:
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_text(content + "\n")
                print(f"Wrote {dest.relative_to(root)}")
            written += 1
        else:
            staged.append({"category": category, "filename": filename, "content": content})

    if staged:
        if dry_run:
            print(f"[dry-run] Would stage {len(staged)} candidates to {CANDIDATES_OUT}")
        else:
            CANDIDATES_OUT.parent.mkdir(parents=True, exist_ok=True)
            existing_candidates: list[dict] = []
            if CANDIDATES_OUT.exists():
                try:
                    existing_candidates = json.loads(CANDIDATES_OUT.read_text())
                except Exception:
                    existing_candidates = []
            existing_names = {c["filename"] for c in existing_candidates}
            new_ones = [c for c in staged if c["filename"] not in existing_names]
            all_candidates = existing_candidates + new_ones
            CANDIDATES_OUT.write_text(json.dumps(all_candidates, indent=2))
            print(f"Staged {len(new_ones)} candidates -> {CANDIDATES_OUT.relative_to(root)}")
        written += len(staged)

    return written, len(staged)


def run(
    dry_run: bool = False,
    days: int = 7,
    model: str = SYNTHESIS_MODEL,
) -> int:
    analyses = load_recent_analyses(days)
    if not analyses:
        print("No recent analyses found. Run 'ctx profiler analyze' first.")
        return 0

    scan = load_codebase_scan()
    existing = collect_existing_memory_names()

    print(f"Synthesizing from {len(analyses)} analyses, {len(existing)} existing memory files...")

    prompt = build_prompt(analyses, scan, existing)
    raw = call_agent(prompt, model, timeout=180)
    entries = _parse_json_array(raw) if raw else None

    if entries is None:
        print("LLM synthesis failed.", file=sys.stderr)
        return 1

    if not entries:
        print("No new memory entries to write.")
        return 0

    written, staged_count = write_entries(entries, dry_run)
    print(f"Done: {written} entries ({staged_count} staged for promotion).")
    return 0
