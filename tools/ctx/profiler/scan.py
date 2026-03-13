"""Scan transcripts and build profile."""

import json
from collections import Counter
from datetime import datetime, timezone

from ctx.profiler.io import (
    HISTORY_PATH,
    PROFILE_PATH,
    SESSIONS_PATH,
    STATE_PATH,
    append_jsonl,
    collect_transcript_files,
    find_transcript_dirs,
    load_json,
    save_json,
)
from ctx.profiler.parsing import parse_transcript
from ctx.profiler.profile import build_history_snapshot, finalize_sequences, merge_into_profile


def run_scan(full: bool):
    dirs = find_transcript_dirs()
    if not dirs:
        return 1

    txt_files = collect_transcript_files(dirs)
    if not txt_files:
        return 1

    state = load_json(STATE_PATH) if not full else {}
    processed = state.get("processed", {})

    to_scan = []
    unchanged = []
    for fp in txt_files:
        key = str(fp)
        prev = processed.get(key) or processed.get(fp.name)
        if prev and prev.get("size") == fp.stat().st_size and not full:
            unchanged.append(fp)
        else:
            to_scan.append(fp)

    if not to_scan and not full:
        return 0

    profile: dict = {"_raw_sequences": []}
    new_processed: dict = {}
    sessions: list[dict] = []

    for fp in unchanged:
        key = str(fp)
        cached = processed.get(key) or processed.get(fp.name, {})
        cached_result = cached.get("result", {})
        merge_into_profile(
            profile,
            {
                "tools": Counter(cached_result.get("tools", {})),
                "skills": Counter(cached_result.get("skills", {})),
                "skill_dates": cached_result.get("skill_dates", {}),
                "sequences": cached_result.get("sequences", []),
            },
            cached_result.get("file_date", ""),
        )
        new_processed[key] = cached
        cached_session = cached.get("session")
        if cached_session:
            sessions.append(cached_session)

    scanned = 0
    for fp in to_scan:
        result = parse_transcript(fp)
        file_date = datetime.fromtimestamp(fp.stat().st_mtime, tz=timezone.utc).strftime("%Y-%m-%d")
        merge_into_profile(profile, result, file_date)

        new_processed[str(fp)] = {
            "size": fp.stat().st_size,
            "scanned_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "session": result["session"],
            "result": {
                "tools": dict(result["tools"]),
                "skills": dict(result["skills"]),
                "skill_dates": result["skill_dates"],
                "sequences": result["sequences"],
                "file_date": file_date,
            },
        }
        sessions.append(result["session"])
        scanned += 1

    finalize_sequences(profile)

    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    profile["last_scan"] = now
    profile["transcripts_scanned"] = len(new_processed)

    prof_skills = profile.get("skills", {})
    profile["skills"] = dict(sorted(prof_skills.items(), key=lambda x: x[1]["count"], reverse=True))
    prof_tools = profile.get("tools", {})
    profile["tools"] = dict(sorted(prof_tools.items(), key=lambda x: x[1], reverse=True))

    save_json(PROFILE_PATH, profile)
    save_json(STATE_PATH, {"processed": new_processed})

    sessions.sort(key=lambda s: s.get("timestamp", ""))
    with open(SESSIONS_PATH, "w") as f:
        for s in sessions:
            f.write(json.dumps(s, separators=(",", ":")) + "\n")

    snapshot = build_history_snapshot(profile, sessions)
    append_jsonl(HISTORY_PATH, snapshot)

    return scanned, len(new_processed), len(sessions), PROFILE_PATH, SESSIONS_PATH, HISTORY_PATH
