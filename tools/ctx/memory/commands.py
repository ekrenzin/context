"""Memory CLI commands -- search, write, list, and prune agent memory."""

from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import typer

from ctx.config import root_dir
from ctx.memory.core import (
    VALID_TYPES,
    discover_entries,
    memory_dir,
    parse_date,
    parse_frontmatter,
    score_entry,
    slugify,
)

app = typer.Typer(no_args_is_help=True)


@app.command()
def scan(
    ticket: Optional[str] = typer.Option(None, help="Filter/boost by ticket ID"),
    repo: Optional[str] = typer.Option(None, help="Filter/boost by repo name"),
    days: Optional[int] = typer.Option(None, help="Only entries from the last N days"),
    query: Optional[str] = typer.Option(None, help="Free-text keywords to match"),
    top: int = typer.Option(10, help="Max results to return"),
    semantic: bool = typer.Option(False, help="Use vector search (requires knowledge index)"),
) -> None:
    """Search memory for relevant entries."""
    if semantic and query:
        _semantic_scan(query, top, repo)
        return

    entries = discover_entries()
    if not entries:
        print("No memory files found.")
        return

    now = datetime.now(timezone.utc)
    if days:
        cutoff = now - timedelta(days=days)
        entries = [e for e in entries if parse_date(e["date"], now) >= cutoff]

    scored = [
        (score_entry(e, ticket or "", repo or "", query or "", now), e)
        for e in entries
    ]
    scored.sort(key=lambda x: x[0], reverse=True)
    scored = scored[:top]

    total = len(entries)
    print(f"## Memory Scan ({len(scored)} shown / {total} total)\n")
    for score, e in scored:
        date_part = f" ({e['date']})" if e["date"] else ""
        status_part = f" [{e['status']}]" if e["status"] else ""
        print(f"[{score:>3}] {e['path']}{date_part}{status_part}")
        print(f"  {e['summary']}\n")


def _semantic_scan(query: str, top: int, repo: Optional[str]) -> None:
    try:
        from ctx.knowledge.indexer import search as vector_search
    except ImportError:
        typer.echo(
            "Error: knowledge dependencies not installed for --semantic.\n"
            "Run: pip install ctx-tools[knowledge]",
            err=True,
        )
        raise typer.Exit(1)

    results = vector_search(query, top=top, doc_type="memory", repo=repo or "")
    if not results:
        print("No results. Run 'ctx knowledge index' to build the vector index.")
        return

    print(f"## Semantic Memory Scan: \"{query}\" ({len(results)} results)\n")
    for r in results:
        similarity = 1 - r.get("_distance", 0)
        path = r.get("source_path", "")
        heading = r.get("heading", "")
        snippet = r.get("text", "")[:200].replace("\n", " ").strip()
        print(f"[{similarity:.3f}] {path}")
        if heading:
            print(f"  {heading}")
        print(f"  {snippet}...\n")


@app.command("list")
def list_entries(
    type: Optional[str] = typer.Option(None, help="Filter by memory type"),
    days: Optional[int] = typer.Option(None, help="Only entries from the last N days"),
) -> None:
    """List memory files with metadata."""
    entries = discover_entries()
    if not entries:
        print("No memory files found.")
        return

    if type:
        if type not in VALID_TYPES:
            typer.echo(f"Error: --type must be one of: {', '.join(VALID_TYPES)}", err=True)
            raise typer.Exit(1)
        entries = [e for e in entries if e["type"] == type]

    if days:
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(days=days)
        entries = [e for e in entries if parse_date(e["date"], now) >= cutoff]

    entries.sort(key=lambda e: e["date"], reverse=True)
    print(f"## Memory Files ({len(entries)})\n")
    header = f"{'Type':<16} {'Date':<12} {'Title':<40} Path"
    print(header)
    print(f"{'----':<16} {'----':<12} {'-----':<40} ----")
    for e in entries:
        t = e["title"][:38] + (".." if len(e["title"]) > 38 else "")
        print(f"{e['type']:<16} {e['date']:<12} {t:<40} {e['path']}")


@app.command()
def write(
    type: str = typer.Option(..., help="Memory category"),
    title: str = typer.Option(..., help="Entry title"),
    ticket: Optional[str] = typer.Option(None, help="Ticket ID"),
    repo: Optional[str] = typer.Option(None, help="Repository name"),
    body: str = typer.Option(..., help="Path to file with entry body"),
) -> None:
    """Create a structured memory entry."""
    if type not in VALID_TYPES:
        typer.echo(f"Error: --type must be one of: {', '.join(VALID_TYPES)}", err=True)
        raise typer.Exit(1)

    body_path = Path(body)
    if not body_path.is_file():
        typer.echo("Error: --body must point to an existing file.", err=True)
        raise typer.Exit(1)

    body_text = body_path.read_text(encoding="utf-8")
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    fm_lines = ["---", f"title: {title}", f"date: {date_str}"]
    if ticket:
        fm_lines.append(f"ticket: {ticket}")
    if repo:
        fm_lines.append(f"repo: {repo}")
    if type == "progress":
        fm_lines.append("status: in-progress")
    elif type == "decisions":
        fm_lines.append("status: accepted")
    fm_lines.append("---")

    content = "\n".join(fm_lines) + "\n\n" + body_text.lstrip()
    slug = slugify(ticket if ticket else title)
    target = memory_dir() / type / f"{slug}.md"
    rel = target.relative_to(root_dir())

    action = "Updating existing" if target.exists() else "Creating"
    print(f"[memory] {action}: {rel}")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    print(f"[memory] Written: {rel}")

    _auto_index(str(rel))


def _auto_index(rel_path: str) -> None:
    """Incrementally index a newly written memory file into the knowledge base."""
    try:
        from ctx.knowledge.incremental import index_file
        count = index_file(rel_path)
        if count:
            print(f"[knowledge] Indexed {count} chunk(s) from {rel_path}")
    except ImportError:
        pass
    except Exception as exc:
        print(f"[knowledge] Auto-index skipped: {exc}")


@app.command()
def prune(
    type: str = typer.Option(..., help="Memory category to prune"),
    days: int = typer.Option(..., help="Remove entries older than N days"),
    confirm: bool = typer.Option(False, help="Actually delete (default: dry-run)"),
) -> None:
    """Remove stale memory files."""
    if type not in VALID_TYPES:
        typer.echo(f"Error: --type must be one of: {', '.join(VALID_TYPES)}", err=True)
        raise typer.Exit(1)

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days)
    type_dir = memory_dir() / type

    if not type_dir.is_dir():
        print(f"No {type}/ directory found.")
        return

    candidates: list[tuple[Path, str]] = []
    for md_file in type_dir.glob("*.md"):
        text = md_file.read_text(encoding="utf-8", errors="replace")
        fm = parse_frontmatter(text)
        mtime = datetime.fromtimestamp(md_file.stat().st_mtime, tz=timezone.utc)
        date_str = fm.get("date", mtime.strftime("%Y-%m-%d"))
        if parse_date(date_str, now) < cutoff:
            candidates.append((md_file, date_str))

    if not candidates:
        print(f"No {type} files older than {days} days.")
        return

    if not confirm:
        print(f"## Dry Run -- would remove {len(candidates)} file(s):\n")
        for f, d in candidates:
            print(f"  {f.relative_to(root_dir())} ({d})")
        print("\nRe-run with --confirm to delete.")
        return

    for f, d in candidates:
        f.unlink()
        print(f"[memory] Removed: {f.relative_to(root_dir())} ({d})")
    print(f"\n[memory] Pruned {len(candidates)} file(s) from {type}/.")
