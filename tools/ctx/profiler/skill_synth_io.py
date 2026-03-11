"""I/O helpers for skill synthesis."""

from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

from ctx.config import root_dir
from ctx.profiler.io import ANALYSES_DIR, PROFILE_PATH, SESSIONS_PATH

SKILLS_DIRS = [
    root_dir() / ".cursor" / "skills",
    Path.home() / ".cursor" / "skills-cursor",
]
CANDIDATES_PATH = root_dir() / "playground" / "output" / "skill-candidates.json"
LOOKBACK_DAYS = 7


def find_skill_path(name: str) -> Path | None:
    for base in SKILLS_DIRS:
        candidate = base / name / "SKILL.md"
        if candidate.exists():
            return candidate
    return None


def load_top_skills(top_n: int) -> list[tuple[str, int]]:
    import sys

    try:
        data = json.loads(PROFILE_PATH.read_text())
        skills = data.get("skills", {})
        if isinstance(skills, list):
            pairs = [(s["name"], s.get("count", 0)) for s in skills if "name" in s]
        elif isinstance(skills, dict):
            pairs = [
                (k, v["count"] if isinstance(v, dict) else v)
                for k, v in skills.items()
            ]
        else:
            return []
        pairs.sort(key=lambda x: x[1], reverse=True)
        return pairs[:top_n]
    except Exception as e:
        print(f"Warning: could not load profile: {e}", file=sys.stderr)
        return []


def load_analyses_for_skill(skill_name: str) -> list[dict]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)
    relevant_ids: set[str] = set()
    if SESSIONS_PATH.exists():
        for raw in SESSIONS_PATH.read_text().splitlines():
            if not raw.strip():
                continue
            try:
                session = json.loads(raw)
                skills_used = session.get("skills", [])
                if not isinstance(skills_used, list):
                    continue
                if not any(skill_name in str(s) for s in skills_used):
                    continue
                ts = session.get("timestamp", "")
                if ts:
                    try:
                        session_dt = datetime.fromisoformat(ts)
                        if session_dt.tzinfo is None:
                            session_dt = session_dt.replace(tzinfo=timezone.utc)
                        if session_dt < cutoff:
                            continue
                    except ValueError:
                        pass
                chat_id = session.get("chat_id", "")
                if chat_id:
                    relevant_ids.add(chat_id)
            except Exception:
                continue

    results = []
    if not ANALYSES_DIR.exists():
        return results
    for cid in relevant_ids:
        analysis_file = ANALYSES_DIR / f"{cid}.json"
        if not analysis_file.exists():
            continue
        try:
            results.append(json.loads(analysis_file.read_text()))
        except Exception:
            continue
    return results


def apply_evolution(skill_md_path: Path, result: dict, dry_run: bool) -> list[str]:
    updated = []
    skill_dir = skill_md_path.parent
    root = root_dir()

    new_skill_md = str(result.get("skill_md", "")).strip()
    if new_skill_md:
        if dry_run:
            print(f"[dry-run] Would update {skill_md_path}")
        else:
            skill_md_path.write_text(new_skill_md + "\n")
            print(f"Updated {skill_md_path.relative_to(root)}")
        updated.append(str(skill_md_path))

    for resource in result.get("resources", []):
        rel_path = str(resource.get("path", "")).strip().lstrip("/")
        content = str(resource.get("content", "")).strip()
        if not rel_path or not content:
            continue
        dest = skill_dir / rel_path
        if dry_run:
            print(f"[dry-run] Would create {dest}")
        else:
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(content + "\n")
            print(f"Created {dest.relative_to(root)}")
        updated.append(str(dest))

    return updated
