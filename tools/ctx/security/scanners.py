"""Scanner wrappers that normalize CVE findings from multiple tools."""

import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

from ctx.config import info
from ctx.runner import run, which


@dataclass
class Finding:
    package: str
    version: str
    ecosystem: str
    cve_id: str
    severity: str
    title: str
    fix_version: str
    url: str


@dataclass
class ScanResult:
    repo: str
    path: Path
    scanner: str
    findings: list[Finding] = field(default_factory=list)
    scanned_at: str = ""
    duration_ms: int = 0


_SEVERITY_MAP = {
    "critical": "critical",
    "high": "high",
    "moderate": "medium",
    "medium": "medium",
    "low": "low",
    "info": "low",
}


def _normalize_severity(raw: str) -> str:
    return _SEVERITY_MAP.get(raw.lower(), "medium")


def detect_scanners(repo_path: Path) -> list[str]:
    """Return scanner names applicable to a repo based on lockfiles present."""
    scanners: list[str] = []
    if (repo_path / "package-lock.json").exists() or (repo_path / "yarn.lock").exists():
        scanners.append("npm")
    if (repo_path / "pyproject.toml").exists() or (repo_path / "requirements.txt").exists():
        scanners.append("pip")
    if (repo_path / "go.sum").exists() or (repo_path / "Cargo.lock").exists():
        scanners.append("osv")
    return scanners


def npm_audit(repo_path: Path) -> list[Finding]:
    """Run npm audit and parse findings."""
    if not which("npm"):
        _warn("npm not found, skipping npm audit")
        return []
    result = run(
        ["npm", "audit", "--json"],
        cwd=repo_path, capture=True, check=False,
    )
    if not result.stdout.strip():
        return []
    return _parse_npm_output(result.stdout)


def _parse_npm_output(raw: str) -> list[Finding]:
    """Handle both npm v6 and v9+ JSON schemas."""
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        _warn("Failed to parse npm audit JSON")
        return []
    findings: list[Finding] = []
    vulns = data.get("vulnerabilities", {})
    if vulns:
        findings.extend(_parse_npm_v9(vulns))
    elif "advisories" in data:
        findings.extend(_parse_npm_v6(data["advisories"]))
    return findings


def _parse_npm_v9(vulns: dict) -> list[Finding]:
    findings: list[Finding] = []
    for pkg_name, info_obj in vulns.items():
        severity = _normalize_severity(info_obj.get("severity", "medium"))
        for via in info_obj.get("via", []):
            if not isinstance(via, dict):
                continue
            findings.append(Finding(
                package=pkg_name,
                version=info_obj.get("range", ""),
                ecosystem="npm",
                cve_id=via.get("cve") or via.get("url", ""),
                severity=severity,
                title=via.get("title", via.get("name", "")),
                fix_version=_first_fix(info_obj),
                url=via.get("url", ""),
            ))
    return findings


def _parse_npm_v6(advisories: dict) -> list[Finding]:
    findings: list[Finding] = []
    for _id, adv in advisories.items():
        findings.append(Finding(
            package=adv.get("module_name", ""),
            version=adv.get("findings", [{}])[0].get("version", ""),
            ecosystem="npm",
            cve_id=", ".join(adv.get("cves", [])) or str(_id),
            severity=_normalize_severity(adv.get("severity", "medium")),
            title=adv.get("title", ""),
            fix_version=adv.get("patched_versions", ""),
            url=adv.get("url", ""),
        ))
    return findings


def _first_fix(info_obj: dict) -> str:
    fix_available = info_obj.get("fixAvailable")
    if isinstance(fix_available, dict):
        return fix_available.get("version", "")
    return ""


def pip_audit(repo_path: Path) -> list[Finding]:
    """Run pip-audit and parse findings."""
    if not which("pip-audit"):
        _warn("pip-audit not found, skipping (install: pip install pip-audit)")
        return []
    result = run(
        ["pip-audit", "--format=json", "--desc"],
        cwd=repo_path, capture=True, check=False,
    )
    if not result.stdout.strip():
        return []
    return _parse_pip_output(result.stdout)


def _parse_pip_output(raw: str) -> list[Finding]:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        _warn("Failed to parse pip-audit JSON")
        return []
    findings: list[Finding] = []
    deps = data if isinstance(data, list) else data.get("dependencies", [])
    for dep in deps:
        for vuln in dep.get("vulns", []):
            findings.append(Finding(
                package=dep.get("name", ""),
                version=dep.get("version", ""),
                ecosystem="pip",
                cve_id=vuln.get("id", ""),
                severity=_normalize_severity(vuln.get("fix_versions", [""])[0] and "high"),
                title=vuln.get("description", "")[:120],
                fix_version=vuln.get("fix_versions", [""])[0],
                url=f"https://osv.dev/vulnerability/{vuln.get('id', '')}",
            ))
    return findings


def osv_scan(repo_path: Path) -> list[Finding]:
    """Run osv-scanner and parse findings."""
    if not which("osv-scanner"):
        _warn("osv-scanner not found, skipping (install: go install github.com/google/osv-scanner/cmd/osv-scanner@latest)")
        return []
    result = run(
        ["osv-scanner", "--json", str(repo_path)],
        cwd=repo_path, capture=True, check=False,
    )
    if not result.stdout.strip():
        return []
    return _parse_osv_output(result.stdout)


def _parse_osv_output(raw: str) -> list[Finding]:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        _warn("Failed to parse osv-scanner JSON")
        return []
    findings: list[Finding] = []
    for result_obj in data.get("results", []):
        for pkg_info in result_obj.get("packages", []):
            pkg = pkg_info.get("package", {})
            for vuln in pkg_info.get("vulnerabilities", []):
                severity = _extract_osv_severity(vuln)
                findings.append(Finding(
                    package=pkg.get("name", ""),
                    version=pkg.get("version", ""),
                    ecosystem=pkg.get("ecosystem", "").lower(),
                    cve_id=vuln.get("id", ""),
                    severity=severity,
                    title=vuln.get("summary", "")[:120],
                    fix_version=_extract_osv_fix(vuln),
                    url=f"https://osv.dev/vulnerability/{vuln.get('id', '')}",
                ))
    return findings


def _extract_osv_severity(vuln: dict) -> str:
    for sev in vuln.get("severity", []):
        score_str = sev.get("score", "")
        if "CVSS" in sev.get("type", ""):
            return _cvss_to_severity(score_str)
    return "medium"


def _cvss_to_severity(score_str: str) -> str:
    try:
        parts = score_str.split("/")
        score = float(parts[0]) if len(parts) == 1 else float(parts[0].split(":")[-1])
    except (ValueError, IndexError):
        return "medium"
    if score >= 9.0:
        return "critical"
    if score >= 7.0:
        return "high"
    if score >= 4.0:
        return "medium"
    return "low"


def _extract_osv_fix(vuln: dict) -> str:
    for affected in vuln.get("affected", []):
        for rng in affected.get("ranges", []):
            for event in rng.get("events", []):
                if "fixed" in event:
                    return event["fixed"]
    return ""


def _warn(msg: str) -> None:
    sys.stderr.write(f"Warning: {msg}\n")
