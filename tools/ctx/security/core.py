"""Scan orchestration -- repo discovery, scanner dispatch, result formatting."""

import json
import time
from datetime import datetime, timezone
from pathlib import Path

from ctx.config import info, root_dir
from ctx.security.scanners import (
    Finding,
    ScanResult,
    detect_scanners,
    npm_audit,
    osv_scan,
    pip_audit,
)
from ctx.workspace.git.shared import iter_repos

_SCANNER_FNS = {
    "npm": npm_audit,
    "pip": pip_audit,
    "osv": osv_scan,
}


def discover_repos() -> list[tuple[str, Path]]:
    """Return (name, path) pairs for all repos including root."""
    return iter_repos(root_dir(), include_root=True)


def scan_repo(
    name: str,
    path: Path,
    *,
    severities: set[str] | None = None,
) -> list[ScanResult]:
    """Run all detected scanners for a single repo."""
    scanner_names = detect_scanners(path)
    if not scanner_names:
        return []
    results: list[ScanResult] = []
    for scanner_name in scanner_names:
        fn = _SCANNER_FNS.get(scanner_name)
        if fn is None:
            continue
        start = time.monotonic()
        findings = fn(path)
        elapsed = int((time.monotonic() - start) * 1000)
        if severities:
            findings = [f for f in findings if f.severity in severities]
        results.append(ScanResult(
            repo=name,
            path=path,
            scanner=scanner_name,
            findings=findings,
            scanned_at=datetime.now(timezone.utc).isoformat(),
            duration_ms=elapsed,
        ))
    return results


def scan_workspace(
    *,
    repo_filter: str | None = None,
    severities: set[str] | None = None,
) -> list[ScanResult]:
    """Scan all repos or a single filtered repo."""
    repos = discover_repos()
    if repo_filter:
        repos = [(n, p) for n, p in repos if n == repo_filter]
        if not repos:
            info(f"No repo found matching '{repo_filter}'")
            return []
    all_results: list[ScanResult] = []
    for name, path in repos:
        all_results.extend(scan_repo(name, path, severities=severities))
    return all_results


def summarize(results: list[ScanResult]) -> dict:
    """Aggregate finding counts by severity."""
    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "total": 0}
    total_ms = 0
    for r in results:
        total_ms += r.duration_ms
        for f in r.findings:
            counts[f.severity] = counts.get(f.severity, 0) + 1
            counts["total"] += 1
    counts["duration_ms"] = total_ms
    return counts


def format_table(results: list[ScanResult]) -> str:
    """Human-readable table output."""
    lines: list[str] = []
    for r in results:
        if not r.findings:
            lines.append(f"  {r.repo} ({r.scanner}): no vulnerabilities found")
            continue
        lines.append(f"  {r.repo} ({r.scanner}): {len(r.findings)} finding(s)")
        lines.append(f"    {'SEVERITY':<10} {'PACKAGE':<25} {'VERSION':<15} {'FIX':<15} {'CVE'}")
        lines.append(f"    {'--------':<10} {'-------':<25} {'-------':<15} {'---':<15} {'---'}")
        for f in sorted(r.findings, key=_severity_rank):
            cve_short = f.cve_id[:30] if f.cve_id else "-"
            fix = f.fix_version or "none"
            lines.append(f"    {f.severity:<10} {f.package:<25} {f.version:<15} {fix:<15} {cve_short}")
    summary = summarize(results)
    lines.append("")
    lines.append(
        f"  Total: {summary['total']} "
        f"(critical: {summary['critical']}, high: {summary['high']}, "
        f"medium: {summary['medium']}, low: {summary['low']}) "
        f"in {summary['duration_ms']}ms"
    )
    return "\n".join(lines)


def format_json(results: list[ScanResult]) -> str:
    """Machine-readable JSON output."""
    payload = {
        "results": [_result_to_dict(r) for r in results],
        "summary": summarize(results),
    }
    return json.dumps(payload, indent=2, default=str)


def _result_to_dict(r: ScanResult) -> dict:
    return {
        "repo": r.repo,
        "scanner": r.scanner,
        "scanned_at": r.scanned_at,
        "duration_ms": r.duration_ms,
        "findings": [_finding_to_dict(f) for f in r.findings],
    }


def _finding_to_dict(f: Finding) -> dict:
    return {
        "package": f.package,
        "version": f.version,
        "ecosystem": f.ecosystem,
        "cve_id": f.cve_id,
        "severity": f.severity,
        "title": f.title,
        "fix_version": f.fix_version,
        "url": f.url,
    }


_SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def _severity_rank(f: Finding) -> int:
    return _SEVERITY_ORDER.get(f.severity, 4)
