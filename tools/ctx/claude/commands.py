"""ctx claude -- run Claude Code headlessly with escalation to the user."""

import json
import subprocess
import sys
import urllib.error
import urllib.request
from typing import Optional

import typer

from ctx.config import root_dir, info, err

app = typer.Typer(no_args_is_help=True)

CC_BASE = "http://localhost:19471"


def _cc_available() -> bool:
    try:
        urllib.request.urlopen(f"{CC_BASE}/api/health", timeout=2)
        return True
    except Exception:
        return False


def _create_terminal_action(title: str, description: str, command: str, args: list[str]) -> str | None:
    """Ask the Command Center to spawn a terminal action (surfaces the FAB)."""
    payload = json.dumps({
        "command": command,
        "args": args,
        "title": title,
        "description": description,
        "cwd": str(root_dir()),
    }).encode()
    req = urllib.request.Request(
        f"{CC_BASE}/api/terminal/action",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read())
        return result.get("id")
    except Exception:
        return None


@app.command("run")
def run_cmd(
    prompt: str = typer.Argument(help="What Claude should do"),
    system: Optional[str] = typer.Option(None, "--system", "-s", help="Additional system prompt context"),
    model: Optional[str] = typer.Option(None, "--model", "-m", help="Model override (sonnet, opus, haiku)"),
    permission: str = typer.Option(
        "acceptEdits",
        "--permission-mode",
        help="Permission mode: acceptEdits (default), bypassPermissions, default",
    ),
    budget: Optional[float] = typer.Option(None, "--budget", help="Max spend in USD"),
    embedded: bool = typer.Option(False, "--embedded", "-e", help="Run in Command Center terminal instead of locally"),
    dry_run: bool = typer.Option(False, "--dry-run", help="Print the command without running it"),
) -> None:
    """Run Claude Code headlessly on a task. Escalates to user on failure."""
    args = _build_args(prompt, system, model, permission, budget)

    if embedded:
        _run_embedded(prompt, args, dry_run)
    else:
        _run_local(prompt, args, dry_run)


def _build_args(
    prompt: str,
    system: str | None,
    model: str | None,
    permission: str,
    budget: float | None,
) -> list[str]:
    args = [
        "-p",
        "--permission-mode", permission,
    ]
    if system:
        args.extend(["--append-system-prompt", system])
    if model:
        args.extend(["--model", model])
    if budget is not None:
        args.extend(["--max-budget-usd", str(budget)])
    args.append(prompt)
    return args


def _run_local(prompt: str, args: list[str], dry_run: bool) -> None:
    """Run Claude in the current terminal with -p (print) mode."""
    cmd = ["claude", *args]

    if dry_run:
        info(f"[dry-run] {' '.join(cmd)}")
        return

    info(f"Running Claude headlessly: {prompt[:80]}...")
    result = subprocess.run(cmd, cwd=root_dir(), text=True)

    if result.returncode != 0:
        _escalate(prompt, result.returncode)


def _run_embedded(prompt: str, args: list[str], dry_run: bool) -> None:
    """Spawn Claude in a Command Center terminal session."""
    payload = {
        "command": "claude",
        "args": args,
        "cwd": str(root_dir()),
    }

    if dry_run:
        info(f"POST {CC_BASE}/api/terminal")
        info(json.dumps(payload, indent=2))
        return

    req = urllib.request.Request(
        f"{CC_BASE}/api/terminal",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read())
        session_id = result.get("id", "unknown")
        info(f"Claude session spawned: {session_id}")
        info(f"View: {CC_BASE}/terminal?session={session_id}")
    except urllib.error.URLError as exc:
        err(f"Command Center not reachable at {CC_BASE}: {exc}")
        err("Run without --embedded or start the Command Center first.")
        raise typer.Exit(1)


def _escalate(prompt: str, exit_code: int) -> None:
    """Claude failed or got stuck. Notify the user via Command Center if available."""
    msg = f"Claude exited with code {exit_code} while working on: {prompt[:120]}"

    if _cc_available():
        action_id = _create_terminal_action(
            title="Claude needs help",
            description=msg,
            command="claude",
            args=["--append-system-prompt", f"Previous attempt failed (exit {exit_code}). The task was: {prompt}", prompt],
        )
        if action_id:
            info(f"Escalated to Command Center. Check the terminal action FAB.")
            return

    err(msg)
    err("Claude could not complete the task. Try running interactively.")
    raise typer.Exit(exit_code)
