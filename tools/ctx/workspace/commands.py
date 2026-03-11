"""Register all workspace subcommands into a single typer app."""

import typer

from ctx.workspace.check import check as check_cmd
from ctx.workspace.checkout import checkout as checkout_cmd
from ctx.workspace.hooks import app as hooks_app
from ctx.workspace.scan import scan as scan_cmd
from ctx.workspace.setup import deps as deps_cmd, setup as setup_cmd, verify as verify_cmd
from ctx.workspace.start import start as start_cmd
from ctx.workspace.validate import app as validate_app
from ctx.workspace.worktrees import app as worktrees_app

app = typer.Typer(help="Workspace setup, validation, and development.")

app.command("check")(check_cmd)
app.command("checkout")(checkout_cmd)
app.command("setup")(setup_cmd)
app.command("verify")(verify_cmd)
app.command("deps")(deps_cmd)
app.add_typer(worktrees_app, name="worktrees", help="Create and prune git worktrees.")
app.add_typer(hooks_app, name="hooks", help="Install pre-commit hook.")
app.add_typer(validate_app, name="validate", help="Validate docs and sync registry.")
app.command("scan")(scan_cmd)
app.command("start")(start_cmd)
