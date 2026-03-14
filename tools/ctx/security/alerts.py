"""MQTT alerting for security scan events. Fails silently if broker is down."""

import json
import sys
from pathlib import Path

from ctx.runner import run, which
from ctx.security.scanners import Finding


_TOPIC_PREFIX = "ctx/security"


def publish(topic: str, payload: dict) -> None:
    """Publish a JSON message to the MQTT broker. No-op if unavailable."""
    if not which("mosquitto_pub"):
        return
    msg = json.dumps(payload, default=str)
    run(
        ["mosquitto_pub", "-t", topic, "-m", msg],
        check=False,
        capture=True,
    )


def on_scan_started(repos: list[str], scanners: list[str]) -> None:
    publish(f"{_TOPIC_PREFIX}/scan/started", {
        "repos": repos,
        "scanners": scanners,
    })


def on_finding(finding: Finding) -> None:
    publish(f"{_TOPIC_PREFIX}/vulnerability/found", {
        "package": finding.package,
        "version": finding.version,
        "ecosystem": finding.ecosystem,
        "cve_id": finding.cve_id,
        "severity": finding.severity,
        "title": finding.title,
        "fix_version": finding.fix_version,
        "url": finding.url,
    })


def on_scan_complete(summary: dict) -> None:
    publish(f"{_TOPIC_PREFIX}/scan/complete", summary)


def on_patch_applied(
    package: str, from_version: str, to_version: str, repo: str,
) -> None:
    publish(f"{_TOPIC_PREFIX}/patch/applied", {
        "package": package,
        "from": from_version,
        "to": to_version,
        "repo": repo,
    })
