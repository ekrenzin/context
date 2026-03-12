# Create Tooling

When asked to build a new utility or automation for the context repo, follow
this process to ensure the tool is discoverable, maintainable, and consistent
with existing tooling.

## Before Writing

1. **Check the registry.** Read `docs/tooling-registry.md` to see what already
   exists. Avoid duplicating functionality.
2. **Use Python.** All new tools are Python modules inside `tools/ctx/`. Shell
   scripts are only used as shims (backward-compat forwarders to the `ctx` CLI).
3. **Pick the right location.** See placement rules below.

## Placement

| Type | Location | When |
|------|----------|------|
| New command group | `tools/ctx/<domain>/` | Distinct concern area (aws, jira, workspace, etc.) |
| Subcommand of existing group | Add to existing `tools/ctx/<domain>/commands.py` | Extends an existing tool category |
| Shared utility | `tools/ctx/` (e.g., `runner.py`, `config.py`) | Cross-cutting logic used by multiple modules |
| One-off / experimental | `playground/scripts/` | Throwaway scripts not intended for long-term use |

## Module Structure

Every command group follows the same pattern:

```
tools/ctx/<domain>/
    __init__.py       # Empty or re-exports
    core.py           # Business logic (no typer imports)
    commands.py       # typer CLI definitions (thin wrappers over core)
```

Split `core.py` into multiple files if it would exceed 200 lines. The key
invariant: **CLI definitions and business logic are always separate files.**

### commands.py Template

```python
"""<Domain> CLI commands."""

import typer

from ctx.<domain>.core import do_something

app = typer.Typer(no_args_is_help=True)


@app.command("action")
def action(
    target: str = typer.Argument(help="What to act on"),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Verbose output"),
) -> None:
    """One-line description of what action does."""
    do_something(target, verbose=verbose)
```

### core.py Template

```python
"""<Domain> business logic."""

from pathlib import Path

from ctx.config import root_dir


def do_something(target: str, *, verbose: bool = False) -> None:
    root = root_dir()
    # Implementation here -- no typer imports, no CLI concerns
```

Key conventions:
- Use `typer` for all CLI interfaces (`app = typer.Typer()`).
- Use `ctx.config.root_dir()` for workspace root resolution.
- Use `ctx.runner.run()` for subprocess execution (never `shell=True`).
- Use `pathlib.Path` for all path operations.
- Use type hints on all function signatures.
- Dependencies go in `tools/pyproject.toml` -- core deps in `[dependencies]`,
  heavy/optional deps in `[project.optional-dependencies]`.
- Files stay under 200 lines, functions under 50 lines.

## Registering in the CLI

After creating the module, register it in `tools/ctx/cli.py`:

```python
from ctx.<domain>.commands import app as <domain>_app

app.add_typer(<domain>_app, name="<domain>", help="<One-line description>.")
```

## After Writing

1. **Test it:** `tools/.venv/bin/ctx <domain> --help` and verify it works.
2. **Register it:** Add an entry to `tools/manifest.yaml` (then run
   `ctx workspace validate registry` to regenerate docs/tooling-registry.md).
3. **Wire it up (optional):** If the tool should be agent-accessible, create a
   skill definition that describes when and how to invoke it.
4. **Create a shim (optional):** If backward compatibility with an old script
   path is needed, add a shim in `tools/scripts/`.

## ACI (Agent-Computer Interface) Fields

Every tool registered in `manifest.yaml` must include these fields so agents
can select and gate tools correctly:

| Field         | Required | Values / Description                                    |
|---------------|----------|---------------------------------------------------------|
| `risk`        | Yes      | `read-only`, `write`, or `destructive`                  |
| `agent_usage` | Yes      | One-line hint: when should an agent pick this tool?     |
| `skill`       | No       | Name of the skill that wraps this tool, if one exists   |

## Quality Checks

- No hardcoded secrets or credentials.
- Files under 200 lines. Split into multiple modules early.
- Error messages should be actionable (tell the user what to do, not just what
  failed).
- Temporary files go in `/tmp/`, never in the workspace.
- Never use `shell=True` in subprocess calls.
- Optional heavy deps (boto3, openai, etc.) go in
  `[project.optional-dependencies]` groups, not core `[dependencies]`.
