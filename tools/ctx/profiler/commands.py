"""Profiler CLI commands."""

import json

import typer

from ctx.profiler.analysis import ANALYZE_MODEL, run_analyze
from ctx.profiler.io import (
    ANALYSES_DIR,
    HISTORY_PATH,
    PROFILE_PATH,
    SESSIONS_PATH,
    find_transcripts_dir,
    load_jsonl,
)
from ctx.profiler.query import _get, _match, _parse_where, _print_aggregate, _print_table
from ctx.profiler.report import run_history, run_report
from ctx.profiler.scan import run_scan
from ctx.profiler.synth import app as synth_app

app = typer.Typer(no_args_is_help=True)
app.add_typer(synth_app, name="synth", help="Synthesize agents, skills, or memory from analyses.")


@app.command()
def scan(full: bool = typer.Option(False, "--full", help="Rescan all transcripts from scratch")) -> None:
    result = run_scan(full)
    if result == 1:
        typer.echo("Error: Could not locate agent-transcripts directory.", err=True)
        raise typer.Exit(1)
    if result == 0:
        typer.echo("No new transcripts to scan.")
        return
    scanned, total, n_sessions, prof_path, sess_path, hist_path = result
    typer.echo(f"Scanned {scanned} transcript(s) ({total} total tracked).")
    typer.echo(f"Profile  -> {prof_path}")
    typer.echo(f"Sessions -> {sess_path} ({n_sessions} records)")
    typer.echo(f"History  -> {hist_path} (snapshot appended)")


@app.command()
def report(top: int = typer.Option(15, "--top", help="Entries per category")) -> None:
    if not run_report(top):
        typer.echo("No profile found. Run 'scan' first.", err=True)
        raise typer.Exit(1)


@app.command()
def query(
    field: str = typer.Option(..., "--field", "-f", help="Comma-separated fields to display or aggregate"),
    sort: str | None = typer.Option(None, "--sort", "-s", help="Field to sort by"),
    asc: bool = typer.Option(False, "--asc", help="Sort ascending"),
    limit: int | None = typer.Option(None, "--limit", "-n", help="Max rows to show"),
    where: str | None = typer.Option(None, "--where", "-w", help="Filter: field=value, field>value, etc."),
    aggregate: str | None = typer.Option(None, "--aggregate", "-a", help="Aggregate mode"),
) -> None:
    if not SESSIONS_PATH.exists():
        typer.echo("No sessions data found. Run 'scan' first.", err=True)
        raise typer.Exit(1)

    sessions = load_jsonl(SESSIONS_PATH)
    if not sessions:
        typer.echo("No session records found.")
        return

    if where:
        parsed = _parse_where(where)
        if parsed[0]:
            field_name, op, value = parsed
            sessions = [s for s in sessions if _match(s, field_name, op, value)]

    limit_val = limit or len(sessions)

    if aggregate:
        _print_aggregate(sessions, field, aggregate, limit_val)
    else:
        sort_field = sort or field.split(",")[0].strip()
        reverse = not asc
        try:
            sessions.sort(key=lambda s: _get(s, sort_field), reverse=reverse)
        except TypeError:
            pass
        _print_table(sessions[:limit_val], field)


@app.command()
def history(limit: int | None = typer.Option(None, "--limit", "-n", help="Number of recent entries")) -> None:
    entries = run_history(limit)
    if not entries:
        typer.echo("No history found. Run 'scan' first.", err=True)
        raise typer.Exit(1)

    typer.echo(f"{'date':>12s}  {'txns':>5s}  {'plan%':>6s}  {'tools/s':>7s}  {'chars/s':>7s}  top skills")
    typer.echo("-" * 90)
    for e in entries:
        date = e.get("scan_date", "?")
        n = e.get("transcripts", 0)
        plan = e.get("plan_mode_rate", 0)
        avg_tools = e.get("avg_tool_calls", 0)
        avg_chars = e.get("avg_response_chars", 0)
        top3 = ", ".join(e.get("top_skills", [])[:3])
        typer.echo(f"{date:>12s}  {n:>5d}  {plan:>5.1%}  {avg_tools:>7d}  {avg_chars:>7d}  {top3}")


@app.command()
def analyze(
    chat_id: str | None = typer.Option(None, "--chat-id", help="Analyze a single session by chat ID"),
    limit: int | None = typer.Option(None, "--limit", "-n", help="Max sessions to analyze"),
    model: str | None = typer.Option(None, "--model", "-m", help="Cursor Agent model"),
    force: bool = typer.Option(False, "--force", help="Re-analyze sessions that already have analyses"),
) -> None:
    typer.echo(f"Analyzing sessions via Cursor Agent CLI (model: {model or ANALYZE_MODEL})...")
    result = run_analyze(chat_id, limit, model, force)
    if result is None:
        if not find_transcripts_dir():
            typer.echo("Error: Could not locate agent-transcripts directory.", err=True)
        elif not load_jsonl(SESSIONS_PATH):
            typer.echo("No sessions found. Run 'scan' first.", err=True)
        else:
            typer.echo("Error: Session not found.", err=True)
        raise typer.Exit(1)

    analyzed, total = result
    if analyzed == 0 and total > 0:
        typer.echo(f"All {total} sessions already analyzed.")
        return

    typer.echo(f"Analyzed {analyzed} session(s).")
    typer.echo(f"Analyses -> {ANALYSES_DIR}/ ({analyzed} files)")
    typer.echo(f"Sessions -> {SESSIONS_PATH} (updated)")
