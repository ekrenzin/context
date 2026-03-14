"""ctx agent -- emit agent events to the MQTT bus via Command Center."""

import json
import sys
import urllib.error
import urllib.request
from typing import Optional

import typer

from ctx.config import info, err

app = typer.Typer(no_args_is_help=True)

CC_BASE = "http://localhost:19471"


@app.command("emit")
def emit_cmd(
    tool: str = typer.Option(..., "--tool", "-t", help="Agent tool name (e.g. claude-code)"),
    event: str = typer.Option(..., "--event", "-e", help="Event type (e.g. tool/used, file/edited)"),
    data: Optional[str] = typer.Option(None, "--data", "-d", help="JSON payload string"),
) -> None:
    """Publish an agent event to the MQTT bus."""
    payload: dict = {"tool": tool, "event": event}

    if data:
        try:
            payload["data"] = json.loads(data)
        except json.JSONDecodeError:
            err(f"Invalid JSON in --data: {data}")
            raise typer.Exit(1)

    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{CC_BASE}/api/agent/emit",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=2) as resp:
            result = json.loads(resp.read())
        if not result.get("ok"):
            err(f"Server error: {result}")
    except urllib.error.URLError:
        # CC not running -- fail silently. Agent events are best-effort.
        pass
    except Exception as exc:
        # Any other error -- log and continue. Never block the caller.
        print(f"[ctx agent emit] {exc}", file=sys.stderr)
