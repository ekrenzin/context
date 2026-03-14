"""Proposal CLI commands -- list, show, and build proposals with AI agents."""

import json
import shlex
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Optional

import typer

from ctx.config import root_dir
from ctx.proposals.core import (
    build_prompt,
    list_proposals,
    read_proposal,
    set_status,
)

app = typer.Typer(no_args_is_help=True)

AGENTS = {"claude": "claude", "codex": "codex"}

CC_BASE = "http://localhost:19471"


@app.command("list")
def list_cmd(
    as_json: bool = typer.Option(False, "--json", help="Output as JSON"),
) -> None:
    """List available proposals."""
    proposals = list_proposals()
    if not proposals:
        print("No proposals found in docs/proposals/.")
        return

    if as_json:
        print(json.dumps(proposals, indent=2))
        return

    header = f"{'Slug':<30} {'Status':<14} {'Tasks':<8} Date"
    print(header)
    print(f"{'----':<30} {'------':<14} {'-----':<8} ----")
    for p in proposals:
        print(f"{p['slug']:<30} {p['status']:<14} {p['taskCount']:<8} {p['date']}")


@app.command()
def show(
    slug: str = typer.Argument(help="Proposal directory name"),
    task: Optional[int] = typer.Option(None, help="Show a specific task number"),
    as_json: bool = typer.Option(False, "--json", help="Output as JSON"),
) -> None:
    """Show the assembled prompt for a proposal."""
    try:
        data = read_proposal(slug)
    except FileNotFoundError as exc:
        typer.echo(str(exc), err=True)
        raise typer.Exit(1)

    if as_json:
        try:
            prompt = build_prompt(data, task_number=task)
        except ValueError as exc:
            typer.echo(str(exc), err=True)
            raise typer.Exit(1)
        print(json.dumps({"slug": slug, "task": task, "prompt": prompt}))
        return

    try:
        prompt = build_prompt(data, task_number=task)
    except ValueError as exc:
        typer.echo(str(exc), err=True)
        raise typer.Exit(1)

    print(prompt)


@app.command()
def build(
    slug: str = typer.Argument(help="Proposal directory name"),
    task: Optional[int] = typer.Option(None, help="Build a specific task only"),
    agent: str = typer.Option("claude", help="Agent to use: claude or codex"),
    embedded: bool = typer.Option(
        False, "--embedded", help="Dispatch via CC embedded terminal"
    ),
    dry_run: bool = typer.Option(
        False, "--dry-run", help="Print the command instead of running it"
    ),
) -> None:
    """Open a new terminal with an AI agent working on a proposal."""
    if agent not in AGENTS:
        typer.echo(f"Unknown agent: {agent}. Use: {', '.join(AGENTS)}", err=True)
        raise typer.Exit(1)

    try:
        data = read_proposal(slug)
    except FileNotFoundError as exc:
        typer.echo(str(exc), err=True)
        raise typer.Exit(1)

    try:
        prompt = build_prompt(data, task_number=task)
    except ValueError as exc:
        typer.echo(str(exc), err=True)
        raise typer.Exit(1)

    prompt_file = _write_prompt_file(slug, task, prompt)
    work_dir = str(root_dir())

    if embedded:
        _dispatch_embedded(agent, prompt_file, work_dir, slug, task, dry_run)
    else:
        _dispatch_terminal(agent, prompt_file, work_dir, slug, task, dry_run)

    if not dry_run:
        set_status(slug, "in-progress")
        if task is not None:
            set_status(slug, "in-progress", task_number=task)


def _write_prompt_file(slug: str, task: int | None, prompt: str) -> str:
    """Write prompt to a temp file and return its path."""
    suffix = f"-task-{task}" if task else ""
    fd, path = tempfile.mkstemp(
        prefix=f"ctx-proposal-{slug}{suffix}-",
        suffix=".md",
    )
    with open(fd, "w", encoding="utf-8") as f:
        f.write(prompt)
    return path


def _build_agent_cmd(agent: str, prompt_file: str, slug: str, task: int | None = None) -> tuple[str, list[str]]:
    """Return (command, args) for the agent."""
    context = Path(prompt_file).read_text(encoding="utf-8")
    task_label = f" task {task}" if task is not None else ""
    user_prompt = f'Build the proposal "{slug}"{task_label}. Follow the instructions in your system prompt.'
    if agent == "claude":
        return "claude", ["--append-system-prompt", context, user_prompt]
    if agent == "codex":
        return "codex", [context]
    return agent, []


def _dispatch_terminal(
    agent: str, prompt_file: str, work_dir: str, slug: str,
    task: int | None, dry_run: bool,
) -> None:
    """Open a new macOS Terminal tab with the agent."""
    cmd, args = _build_agent_cmd(agent, prompt_file, slug, task)
    shell_cmd = f"cd {shlex.quote(work_dir)} && {cmd} {' '.join(shlex.quote(a) for a in args)}"
    task_label = f" (task {task})" if task else ""
    title = f"Building: {slug}{task_label}"

    if dry_run:
        print("## Prompt file")
        print(f"  {prompt_file}\n")
        print("## Command")
        print(f"  {shell_cmd}\n")
        print("## Working directory")
        print(f"  {work_dir}")
        return

    if sys.platform != "darwin":
        typer.echo(f"Auto-open not supported on {sys.platform}. Run manually:\n\n  {shell_cmd}", err=True)
        return

    escaped_cmd = shell_cmd.replace("\\", "\\\\").replace('"', '\\"')
    escaped_title = title.replace("\\", "\\\\").replace('"', '\\"')
    script = f'''
    tell application "Terminal"
        activate
        set newTab to do script "{escaped_cmd}"
        set custom title of newTab to "{escaped_title}"
    end tell
    '''
    result = subprocess.run(["osascript", "-e", script], capture_output=True, text=True)
    if result.returncode != 0:
        typer.echo(f"Failed to open terminal: {result.stderr}", err=True)
        typer.echo(f"\nRun manually:\n  {shell_cmd}")
    else:
        print(f"Opened terminal: {title}")


def _dispatch_embedded(
    agent: str, prompt_file: str, work_dir: str, slug: str,
    task: int | None, dry_run: bool,
) -> None:
    """Dispatch via the Command Center embedded terminal API."""
    cmd, args = _build_agent_cmd(agent, prompt_file, slug, task)
    payload = {"command": cmd, "args": args, "cwd": work_dir}
    url = f"{CC_BASE}/api/terminal"

    if dry_run:
        print("## Prompt file")
        print(f"  {prompt_file}\n")
        print("## HTTP Request")
        print(f"  POST {url}")
        print(f"  {json.dumps(payload, indent=2)}\n")
        print("## Working directory")
        print(f"  {work_dir}")
        return

    import urllib.request
    import urllib.error

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read())
        print(f"Terminal session spawned: {result.get('id', 'unknown')}")
        print(f"View in Command Center: {CC_BASE}/terminal?session={result.get('id', '')}")
    except urllib.error.URLError as exc:
        typer.echo(f"Failed to reach Command Center at {CC_BASE}: {exc}", err=True)
        typer.echo("Is the Command Center running? Try without --embedded.")
        raise typer.Exit(1)
