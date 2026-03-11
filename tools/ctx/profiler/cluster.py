"""Session clustering by skill co-occurrence."""

from __future__ import annotations

import json
from datetime import datetime, timezone, timedelta
from itertools import combinations

from ctx.profiler.io import ANALYSES_DIR, SESSIONS_PATH


def load_sessions(days: int) -> list[dict]:
    if not SESSIONS_PATH.exists():
        return []
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    sessions = []
    for raw in SESSIONS_PATH.read_text().splitlines():
        if not raw.strip():
            continue
        try:
            s = json.loads(raw)
        except json.JSONDecodeError:
            continue
        ts = s.get("timestamp", "")
        if ts:
            try:
                dt = datetime.fromisoformat(ts)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                if dt < cutoff:
                    continue
            except ValueError:
                pass
        sessions.append(s)
    return sessions


def load_analyses(chat_ids: list[str]) -> list[dict]:
    results = []
    for cid in chat_ids:
        path = ANALYSES_DIR / f"{cid}.json"
        if not path.exists():
            continue
        try:
            results.append(json.loads(path.read_text()))
        except Exception:
            continue
    return results


def cluster(
    sessions: list[dict],
    min_sessions: int = 3,
    max_combo_size: int = 4,
) -> list[dict]:
    combo_map: dict[frozenset, list[dict]] = {}

    for s in sessions:
        raw_skills = s.get("skills", [])
        if isinstance(raw_skills, dict):
            skill_names = list(raw_skills.keys())
        else:
            skill_names = list(raw_skills)

        unique = sorted(set(skill_names))
        if len(unique) < 2:
            continue

        for size in range(2, min(len(unique) + 1, max_combo_size + 1)):
            for combo in combinations(unique, size):
                key = frozenset(combo)
                combo_map.setdefault(key, []).append(s)

    clusters = []
    seen_chat_ids_per_key: dict[frozenset, set] = {}

    for skills_set, raw_sessions in combo_map.items():
        deduped: list[dict] = []
        seen: set[str] = set()
        for s in raw_sessions:
            cid = s.get("chat_id", "")
            if cid and cid not in seen:
                seen.add(cid)
                deduped.append(s)

        if len(deduped) < min_sessions:
            continue

        seen_chat_ids_per_key[skills_set] = seen

        productive = sum(1 for s in deduped if s.get("verdict") == "productive")
        productivity_rate = productive / len(deduped)
        latest = max((s.get("date", "") for s in deduped), default="")
        freq = len(deduped)
        specificity = len(skills_set)
        score = round(freq * (1 + productivity_rate) * specificity, 2)

        clusters.append(
            {
                "skills": sorted(skills_set),
                "chat_ids": [s["chat_id"] for s in deduped],
                "frequency": freq,
                "productivity_rate": round(productivity_rate, 2),
                "latest": latest,
                "score": score,
            }
        )

    clusters.sort(key=lambda c: c["score"], reverse=True)
    final = []
    for candidate in clusters:
        skills_c = frozenset(candidate["skills"])
        dominated = any(
            skills_c < frozenset(existing["skills"])
            and frozenset(candidate["chat_ids"]).issubset(frozenset(existing["chat_ids"]))
            for existing in final
        )
        if not dominated:
            final.append(candidate)

    return final
