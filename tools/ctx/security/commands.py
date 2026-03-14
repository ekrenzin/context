"""Security CLI commands -- scan, watch, patch."""

import typer

from ctx.config import info
from ctx.security.alerts import on_finding, on_patch_applied, on_scan_complete, on_scan_started
from ctx.security.core import format_json, format_table, scan_workspace, summarize
from ctx.security.patches import apply_patches, find_patches, preview_diff

app = typer.Typer(no_args_is_help=True)


@app.command("scan")
def scan(
    repo: str = typer.Option(None, "--repo", "-r", help="Scan a single repo by name"),
    fmt: str = typer.Option("table", "--format", "-f", help="Output format: table or json"),
    severity: str = typer.Option(None, "--severity", "-s", help="Filter by severity (comma-separated: critical,high)"),
) -> None:
    """Scan dependencies for known CVEs across workspace repos."""
    severities = _parse_severities(severity)
    info("Scanning for vulnerabilities...")
    on_scan_started(
        repos=[repo] if repo else ["all"],
        scanners=["npm", "pip", "osv"],
    )
    results = scan_workspace(repo_filter=repo, severities=severities)
    for r in results:
        for f in r.findings:
            on_finding(f)
    summary = summarize(results)
    on_scan_complete(summary)
    if fmt == "json":
        info(format_json(results))
    else:
        info(format_table(results))


@app.command("watch")
def watch(
    interval: str = typer.Option("30m", "--interval", "-i", help="Scan interval (e.g. 5m, 1h)"),
) -> None:
    """Print the command to run continuous background scanning."""
    info("To run continuous vulnerability scanning, execute:\n")
    info(f"  watch -n {_interval_to_seconds(interval)} ctx security scan\n")
    info("Or add to crontab:\n")
    cron_interval = _interval_to_cron(interval)
    info(f"  {cron_interval} ctx security scan --format json >> /tmp/ctx-security.log 2>&1\n")
    info("Tip: pipe JSON output to mosquitto_pub for MQTT-based dashboards.")


@app.command("patch")
def patch(
    repo: str = typer.Option(None, "--repo", "-r", help="Patch a single repo by name"),
    dry_run: bool = typer.Option(True, "--dry-run/--apply", help="Preview changes without applying"),
    allow_major: bool = typer.Option(False, "--allow-major", help="Allow major version bumps"),
) -> None:
    """Apply safe dependency upgrades for known CVEs."""
    info("Scanning for patchable vulnerabilities...")
    results = scan_workspace(repo_filter=repo)
    all_findings = [f for r in results for f in r.findings]
    if not all_findings:
        info("No vulnerabilities found. Nothing to patch.")
        return
    actions = find_patches(all_findings, allow_major=allow_major)
    if not actions:
        info("No auto-patchable vulnerabilities found (missing fix versions or major bumps).")
        return
    info(f"\nFound {len(actions)} patchable package(s):\n")
    for r in results:
        if not r.findings:
            continue
        repo_actions = [a for a in actions if a.ecosystem in _repo_ecosystems(r)]
        if repo_actions:
            applied = apply_patches(repo_actions, r.path, dry_run=dry_run)
            if not dry_run:
                for a in repo_actions:
                    on_patch_applied(a.package, a.from_version, a.to_version, r.repo)
                diff = preview_diff(r.path)
                if diff:
                    info(f"\nChanges in {r.repo}:\n{diff}")


def _parse_severities(raw: str | None) -> set[str] | None:
    if not raw:
        return None
    return {s.strip().lower() for s in raw.split(",")}


def _repo_ecosystems(r) -> set[str]:
    return {f.ecosystem for f in r.findings}


def _interval_to_seconds(interval: str) -> int:
    interval = interval.strip().lower()
    if interval.endswith("h"):
        return int(interval[:-1]) * 3600
    if interval.endswith("m"):
        return int(interval[:-1]) * 60
    return int(interval)


def _interval_to_cron(interval: str) -> str:
    interval = interval.strip().lower()
    if interval.endswith("h"):
        hours = int(interval[:-1])
        return f"0 */{hours} * * *"
    if interval.endswith("m"):
        minutes = int(interval[:-1])
        return f"*/{minutes} * * * *"
    return f"*/{interval} * * * *"
