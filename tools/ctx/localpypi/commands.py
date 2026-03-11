"""CLI commands for local PyPI server."""

from __future__ import annotations

import typer

from ctx.localpypi.app import create_app

app = typer.Typer(help="Serve local Python package artifacts.", invoke_without_command=True)


@app.callback()
def serve(
    host: str = typer.Option("127.0.0.1", help="Host to bind."),
    port: int = typer.Option(1505, help="Port to bind."),
) -> None:
    """Run local package index server."""
    flask_app = create_app()
    flask_app.run(host=host, port=port)
