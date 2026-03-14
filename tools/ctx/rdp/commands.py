"""ctx rdp -- RDP bridge for Command Center."""

import typer

app = typer.Typer(no_args_is_help=True)


@app.command("connect")
def connect_cmd(
    host: str = typer.Option(..., "--host", "-h", help="RDP hostname"),
    port: int = typer.Option(3389, "--port", "-p", help="RDP port"),
    username: str = typer.Option(..., "--username", "-u", help="Username"),
    password: str = typer.Option("", "--password", help="Password"),
    domain: str = typer.Option("", "--domain", help="Domain"),
    width: int = typer.Option(1280, "--width", help="Screen width"),
    height: int = typer.Option(720, "--height", help="Screen height"),
) -> None:
    """Connect to an RDP host and stream frames as JSON lines on stdout."""
    import asyncio
    from ctx.rdp.bridge import run_bridge

    asyncio.run(run_bridge(
        host=host,
        port=port,
        username=username,
        password=password,
        domain=domain,
        width=width,
        height=height,
    ))
