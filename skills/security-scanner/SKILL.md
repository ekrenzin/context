---
name: security-scanner
description: Automated CVE scanning for project dependencies with real-time MQTT alerting and safe patching. Use when checking for known vulnerabilities, before deployments, or as part of quality gates.
triggers:
  - deploy
  - code-review
related_skills:
  - security-audit
  - deploy
  - cross-repo-check
---

# Security Scanner

Automated dependency vulnerability detection across all workspace repos.
Scans npm, pip, and OSV ecosystems. Publishes findings to MQTT in real time.

## When to Use

- Before deploying any service
- As part of quality gates (alongside `ctx workspace check`)
- When adding or upgrading dependencies
- Periodically via `ctx security watch` for continuous monitoring

## Commands

```bash
ctx security scan                              # scan all repos
ctx security scan --repo context-ui            # scan one repo
ctx security scan --severity critical,high     # filter by severity
ctx security scan --format json                # machine-readable output
ctx security patch --dry-run                   # preview safe upgrades
ctx security patch --apply                     # apply semver-compatible fixes
ctx security patch --apply --allow-major       # include major bumps
ctx security watch --interval 1h              # print cron/watch command
```

## MQTT Topics

| Topic | When |
|-------|------|
| `ctx/security/scan/started` | Scan begins |
| `ctx/security/vulnerability/found` | Each CVE found |
| `ctx/security/scan/complete` | Scan ends with summary |
| `ctx/security/patch/applied` | Dependency upgraded |

## Scanners

Automatically detected per repo based on lockfiles:

| Lockfile | Scanner |
|----------|---------|
| `package-lock.json`, `yarn.lock` | `npm audit` |
| `pyproject.toml`, `requirements.txt` | `pip-audit` |
| `go.sum`, `Cargo.lock` | `osv-scanner` |

Missing scanner binaries are skipped with a warning.

## Relationship to security-audit

This skill handles **dependency-level** CVE scanning (known vulnerabilities in
third-party packages). The `security-audit` skill handles **code-level**
security review (auth, encryption, IDOR, secrets). Run both for full coverage.

## Integration with Quality Gates

Add to your pre-deploy checklist:

1. `ctx workspace check --repo <name>` (lint + types + tests)
2. `ctx security scan --repo <name> --severity critical,high` (CVE scan)
3. If findings exist: `ctx security patch --dry-run` to review fixes
