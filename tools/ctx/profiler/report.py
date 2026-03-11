"""Report and history display logic."""

from ctx.profiler.io import HISTORY_PATH, PROFILE_PATH, load_json, load_jsonl
from ctx.profiler.query import _print_delta


def run_report(top: int) -> bool:
    profile = load_json(PROFILE_PATH)
    if not profile:
        return False

    print(f"Last scan: {profile.get('last_scan', 'never')}")
    print(f"Transcripts scanned: {profile.get('transcripts_scanned', 0)}")

    history = load_jsonl(HISTORY_PATH)
    if len(history) >= 2:
        prev = history[-2]
        curr = history[-1]
        print(f"\n--- Trends (vs previous scan on {prev.get('scan_date', '?')}) ---")
        _print_delta("  Transcripts", prev.get("transcripts", 0), curr.get("transcripts", 0))
        _print_delta("  Plan mode rate", prev.get("plan_mode_rate", 0), curr.get("plan_mode_rate", 0), pct=True)
        _print_delta("  Avg tool calls/session", prev.get("avg_tool_calls", 0), curr.get("avg_tool_calls", 0))
        _print_delta("  Avg response chars", prev.get("avg_response_chars", 0), curr.get("avg_response_chars", 0))
        prev_skills = prev.get("top_skills", [])[:5]
        curr_skills = curr.get("top_skills", [])[:5]
        new_in_top = [s for s in curr_skills if s not in prev_skills]
        dropped = [s for s in prev_skills if s not in curr_skills]
        if new_in_top:
            print(f"  Skills rising:  {', '.join(new_in_top)}")
        if dropped:
            print(f"  Skills falling: {', '.join(dropped)}")

    skills = profile.get("skills", {})
    if skills:
        print(f"\n--- Skills (top {min(top, len(skills))}) ---")
        for i, (name, data) in enumerate(skills.items()):
            if i >= top:
                break
            print(f"  {name:30s}  {data['count']:>5d}  (last: {data['last_seen']})")

    tools = profile.get("tools", {})
    if tools:
        print(f"\n--- Tools (top {min(top, len(tools))}) ---")
        for i, (name, count) in enumerate(tools.items()):
            if i >= top:
                break
            print(f"  {name:30s}  {count:>5d}")

    sequences = profile.get("sequences", {})
    if sequences:
        print(f"\n--- Sequences (top {min(top, len(sequences))}) ---")
        for i, (seq, count) in enumerate(sequences.items()):
            if i >= top:
                break
            print(f"  {seq:50s}  {count:>5d}")

    return True


def run_history(limit: int | None) -> list[dict] | None:
    history_data = load_jsonl(HISTORY_PATH)
    if not history_data:
        return None
    limit_val = limit or len(history_data)
    return history_data[-limit_val:]
