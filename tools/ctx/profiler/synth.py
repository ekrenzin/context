"""Synthesis subcommands: agents, skills, memory."""

import typer

from ctx.profiler.synth_agents import run as run_agents
from ctx.profiler.synth_memory import run as run_memory
from ctx.profiler.synth_skills import run as run_skills

app = typer.Typer(no_args_is_help=True)


@app.command()
def agents(
    top: int = typer.Option(5, "--top", help="Max agents to generate"),
    min_sessions: int = typer.Option(3, "--min-sessions", help="Min sessions per cluster"),
    days: int = typer.Option(30, "--days", help="Lookback window in days"),
    dry_run: bool = typer.Option(False, "--dry-run", help="Print actions without writing"),
    stage: bool = typer.Option(False, "--stage", help="Write candidates JSON instead of applying"),
    model: str = typer.Option("gemini-3-flash", "--model", help="LLM model"),
    min_confidence: float = typer.Option(0.5, "--min-confidence", help="Min confidence threshold"),
) -> None:
    raise typer.Exit(run_agents(top, min_sessions, days, dry_run, stage, model, min_confidence))


@app.command()
def skills(
    top: int = typer.Option(5, "--top", help="Number of top skills to evolve"),
    skill: str = typer.Option("", "--skill", help="Evolve a specific skill by name"),
    dry_run: bool = typer.Option(False, "--dry-run", help="Print actions without writing"),
    stage: bool = typer.Option(False, "--stage", help="Write candidates JSON instead of applying"),
    model: str = typer.Option("gemini-3-flash", "--model", help="LLM model"),
) -> None:
    raise typer.Exit(run_skills(top, skill, dry_run, stage, model))


@app.command()
def memory(
    dry_run: bool = typer.Option(False, "--dry-run", help="Print actions without writing"),
    days: int = typer.Option(7, "--days", help="Lookback window for analyses"),
    model: str = typer.Option("gemini-3-flash", "--model", help="LLM model"),
) -> None:
    raise typer.Exit(run_memory(dry_run, days, model))
