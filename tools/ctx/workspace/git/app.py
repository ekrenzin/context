"""Typer wiring for ctx workspace git subcommands."""

import typer

from ctx.workspace.git.branch import app as branch_app
from ctx.workspace.git.status import status
from ctx.workspace.git.switch import switch
from ctx.workspace.git.sync import fetch, pull

app = typer.Typer(help="Coordinated git operations across repos.")

app.command("status")(status)
app.command("fetch")(fetch)
app.command("pull")(pull)
app.command("switch")(switch)
app.add_typer(branch_app, name="branch", help="Create, delete, and list branches.")
