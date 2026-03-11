"""Context workspace developer tooling CLI."""

import typer

from ctx.skills.commands import app as skills_app
from ctx.image.commands import app as image_app
from ctx.knowledge.commands import app as knowledge_app
from ctx.localpypi.commands import app as localpypi_app
from ctx.memory.commands import app as memory_app
from ctx.profiler.commands import app as profiler_app
from ctx.workspace.commands import app as workspace_app

app = typer.Typer(
    name="ctx",
    help="Context workspace developer tooling.",
    no_args_is_help=True,
)

app.add_typer(memory_app, name="memory", help="Persistent agent memory.")
app.add_typer(profiler_app, name="profiler", help="Agent session transcript analysis.")
app.add_typer(localpypi_app, name="localpypi", help="Local Python package index server.")
app.add_typer(image_app, name="image", help="AI image generation.")
app.add_typer(knowledge_app, name="knowledge", help="Knowledge base vector search.")
app.add_typer(workspace_app, name="workspace", help="Workspace setup and validation.")
app.add_typer(skills_app, name="skills", help="External skills sync.")


def main() -> None:
    app()
