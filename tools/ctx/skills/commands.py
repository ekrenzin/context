"""Skills CLI commands."""

import typer

app = typer.Typer(no_args_is_help=True)


@app.command("sync")
def sync_cmd(
    force: bool = typer.Option(False, "--force", help="Re-clone from scratch"),
    dry_run: bool = typer.Option(False, "--dry-run", help="Preview without changes"),
) -> None:
    """Sync community skills into user-level Cursor skills."""
    from ctx.skills.sync import sync

    try:
        result = sync(force=force, dry_run=dry_run)
    except RuntimeError as exc:
        typer.echo(f"Sync failed: {exc}", err=True)
        raise typer.Exit(1)

    if dry_run:
        return

    typer.echo(
        f"Synced {result['total_skills']} skills "
        f"({result['linked']} linked, "
        f"{len(result['skipped'])} skipped)"
    )
    if result["removed"]:
        typer.echo(f"Removed stale: {', '.join(result['removed'])}")
    if result["updated"]:
        typer.echo("New commits pulled from upstream.")
