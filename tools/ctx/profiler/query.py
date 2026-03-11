"""Query helpers for session data."""

import json
from collections import Counter



def _get(obj: dict, key: str):
    for part in key.split("."):
        if isinstance(obj, dict):
            obj = obj.get(part, 0)
        else:
            return 0
    return obj


def _parse_where(expr: str) -> tuple:
    for op in (">=", "<=", "!=", "=", ">", "<"):
        if op in expr:
            field, value = expr.split(op, 1)
            try:
                value = int(value)
            except ValueError:
                try:
                    value = float(value)
                except ValueError:
                    if value.lower() == "true":
                        value = True
                    elif value.lower() == "false":
                        value = False
            return field.strip(), op, value
    return None, None, None


def _match(session: dict, field: str, op: str, value) -> bool:
    actual = _get(session, field)
    try:
        if op == "=":
            return actual == value
        if op == "!=":
            return actual != value
        if op == ">":
            return actual > value
        if op == "<":
            return actual < value
        if op == ">=":
            return actual >= value
        if op == "<=":
            return actual <= value
    except TypeError:
        return False
    return False


def _print_table(sessions: list[dict], field: str) -> None:
    fields = [f.strip() for f in field.split(",")]
    header = "  ".join(f"{f:>20s}" for f in fields)
    print(header)
    print("-" * len(header))
    for s in sessions:
        vals = []
        for f in fields:
            v = _get(s, f)
            if isinstance(v, (dict, list)):
                v = json.dumps(v, separators=(",", ":"))
            vals.append(f"{str(v):>20s}")
        print("  ".join(vals))


def _print_aggregate(sessions: list[dict], field: str, agg: str, limit: int) -> None:
    if agg == "sum":
        total = sum(_get(s, field) for s in sessions)
        print(f"sum({field}) = {total}")
    elif agg == "avg":
        vals = [_get(s, field) for s in sessions]
        avg = sum(vals) / len(vals) if vals else 0
        print(f"avg({field}) = {avg:.1f}")
    elif agg in ("distribution", "top"):
        counter: Counter = Counter()
        for s in sessions:
            v = _get(s, field)
            if isinstance(v, list):
                for item in v:
                    counter[item] += 1
            elif isinstance(v, dict):
                for k, cnt in v.items():
                    counter[k] += cnt if isinstance(cnt, int) else 1
            elif isinstance(v, bool):
                counter[str(v)] += 1
            else:
                counter[v] += 1
        for val, cnt in counter.most_common(limit):
            print(f"  {str(val):40s}  {cnt:>5d}")


def _print_delta(label: str, prev, curr, pct: bool = False) -> None:
    delta = curr - prev
    if pct:
        print(f"{label}: {prev:.1%} -> {curr:.1%} ({delta:+.1%})")
    elif isinstance(curr, float):
        print(f"{label}: {prev:.1f} -> {curr:.1f} ({delta:+.1f})")
    else:
        print(f"{label}: {prev} -> {curr} ({delta:+d})")
