"""Profile merging and history snapshot building."""

from collections import Counter

from ctx.profiler.parsing import extract_ngrams


def merge_into_profile(profile: dict, result: dict, file_date: str) -> None:
    prof_skills = profile.setdefault("skills", {})
    for skill, count in result["skills"].items():
        entry = prof_skills.setdefault(skill, {"count": 0, "last_seen": ""})
        entry["count"] += count
        if file_date > entry["last_seen"]:
            entry["last_seen"] = file_date

    prof_tools = profile.setdefault("tools", {})
    for tool, count in result["tools"].items():
        prof_tools[tool] = prof_tools.get(tool, 0) + count

    profile.setdefault("_raw_sequences", []).extend(result["sequences"])


def finalize_sequences(profile: dict) -> None:
    raw = profile.pop("_raw_sequences", [])
    bigrams = extract_ngrams(raw, 2)
    trigrams = extract_ngrams(raw, 3)
    merged = bigrams + trigrams
    profile["sequences"] = dict(merged.most_common(50))


def build_history_snapshot(profile: dict, sessions: list[dict]) -> dict:
    n = len(sessions)
    skills_with_sessions = sum(1 for s in sessions if s.get("skills"))
    plan_sessions = sum(1 for s in sessions if s.get("plan_mode"))
    total_tools = sum(s.get("total_tool_calls", 0) for s in sessions)
    total_chars = sum(s.get("response_chars_total", 0) for s in sessions)

    skill_ranks = list(profile.get("skills", {}).keys())[:10]
    tool_ranks = list(profile.get("tools", {}).keys())[:10]
    seq_ranks = list(profile.get("sequences", {}).keys())[:5]

    return {
        "scan_ts": profile.get("last_scan", ""),
        "scan_date": profile.get("last_scan", "")[:10],
        "transcripts": n,
        "sessions_with_skills": skills_with_sessions,
        "sessions_with_plan_mode": plan_sessions,
        "plan_mode_rate": round(plan_sessions / n, 3) if n else 0,
        "avg_tool_calls": round(total_tools / n) if n else 0,
        "avg_response_chars": round(total_chars / n) if n else 0,
        "total_tool_calls": total_tools,
        "total_response_chars": total_chars,
        "top_skills": skill_ranks,
        "top_tools": tool_ranks,
        "top_sequences": seq_ranks,
    }
