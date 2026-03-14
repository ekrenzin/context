"""Shared LLM invocation via Cursor Agent CLI."""

import os
import shutil
import subprocess
import sys


def resolve_agent_cmd() -> list[str]:
    env_cmd = os.environ.get("CURSOR_AGENT_CMD", "").strip()
    if env_cmd:
        return env_cmd.split()
    if shutil.which("agent"):
        return ["agent"]
    if shutil.which("cursor"):
        return ["cursor", "agent"]
    return ["agent"]


def call_agent(prompt: str, model: str, timeout: int = 240) -> str | None:
    cmd = [*resolve_agent_cmd(), "--print", "--trust", "--mode", "ask", "--model", model, prompt]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except FileNotFoundError:
        print(
            "Error: Cursor Agent CLI not found.\n"
            "  Install: curl https://cursor.com/install -fsSL | bash",
            file=sys.stderr,
        )
        return None
    except subprocess.TimeoutExpired:
        print("Warning: Agent CLI timed out.", file=sys.stderr)
        return None

    if proc.returncode != 0:
        print(f"Warning: Agent CLI exit {proc.returncode}", file=sys.stderr)
        if proc.stderr:
            print(f"  stderr: {proc.stderr[:200]}", file=sys.stderr)
        return None

    return proc.stdout.strip()
