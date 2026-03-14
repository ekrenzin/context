"""Safe dependency patching with dry-run support."""

import re
from dataclasses import dataclass, field
from pathlib import Path

from ctx.config import info
from ctx.runner import capture_stdout, run, which
from ctx.security.scanners import Finding


@dataclass
class PatchAction:
    package: str
    ecosystem: str
    from_version: str
    to_version: str
    cve_ids: list[str] = field(default_factory=list)
    is_major: bool = False


def find_patches(
    findings: list[Finding],
    *,
    allow_major: bool = False,
) -> list[PatchAction]:
    """Group findings by package and determine patch actions."""
    by_pkg: dict[tuple[str, str], list[Finding]] = {}
    for f in findings:
        if not f.fix_version:
            continue
        key = (f.package, f.ecosystem)
        by_pkg.setdefault(key, []).append(f)

    actions: list[PatchAction] = []
    for (pkg, eco), pkg_findings in by_pkg.items():
        best_fix = _highest_fix(pkg_findings)
        if not best_fix:
            continue
        current = pkg_findings[0].version
        is_major = _is_major_bump(current, best_fix)
        if is_major and not allow_major:
            info(f"  Skipping {pkg} {current} -> {best_fix} (major bump, use --allow-major)")
            continue
        actions.append(PatchAction(
            package=pkg,
            ecosystem=eco,
            from_version=current,
            to_version=best_fix,
            cve_ids=[f.cve_id for f in pkg_findings],
            is_major=is_major,
        ))
    return actions


def apply_patches(
    actions: list[PatchAction],
    repo_path: Path,
    *,
    dry_run: bool = True,
) -> list[str]:
    """Apply patch actions, grouped by ecosystem."""
    applied: list[str] = []
    npm_actions = [a for a in actions if a.ecosystem == "npm"]
    pip_actions = [a for a in actions if a.ecosystem == "pip"]
    if npm_actions:
        applied.extend(_apply_npm(npm_actions, repo_path, dry_run=dry_run))
    if pip_actions:
        applied.extend(_apply_pip(pip_actions, repo_path, dry_run=dry_run))
    return applied


def _apply_npm(
    actions: list[PatchAction], repo_path: Path, *, dry_run: bool,
) -> list[str]:
    if not which("npm"):
        info("  npm not found, skipping npm patches")
        return []
    applied: list[str] = []
    for a in actions:
        target = f"{a.package}@{a.to_version}"
        if dry_run:
            info(f"  [dry-run] npm install {target}")
        else:
            run(["npm", "install", target], cwd=repo_path, check=False)
            info(f"  Applied: {a.package} {a.from_version} -> {a.to_version}")
        applied.append(f"{a.package}: {a.from_version} -> {a.to_version}")
    return applied


def _apply_pip(
    actions: list[PatchAction], repo_path: Path, *, dry_run: bool,
) -> list[str]:
    applied: list[str] = []
    req_file = repo_path / "requirements.txt"
    if req_file.exists():
        applied.extend(_patch_requirements_txt(actions, req_file, dry_run=dry_run))
    pyproject = repo_path / "pyproject.toml"
    if pyproject.exists():
        applied.extend(_patch_pyproject(actions, pyproject, dry_run=dry_run))
    return applied


def _patch_requirements_txt(
    actions: list[PatchAction], req_file: Path, *, dry_run: bool,
) -> list[str]:
    content = req_file.read_text(encoding="utf-8")
    applied: list[str] = []
    for a in actions:
        pattern = re.compile(
            rf"^({re.escape(a.package)})==[\d.]+",
            re.MULTILINE | re.IGNORECASE,
        )
        replacement = rf"\1=={a.to_version}"
        new_content = pattern.sub(replacement, content)
        if new_content != content:
            label = f"{a.package}: {a.from_version} -> {a.to_version}"
            if dry_run:
                info(f"  [dry-run] {req_file.name}: {label}")
            else:
                content = new_content
                info(f"  Applied: {req_file.name}: {label}")
            applied.append(label)
    if not dry_run and applied:
        req_file.write_text(content, encoding="utf-8")
    return applied


def _patch_pyproject(
    actions: list[PatchAction], pyproject: Path, *, dry_run: bool,
) -> list[str]:
    content = pyproject.read_text(encoding="utf-8")
    applied: list[str] = []
    for a in actions:
        pattern = re.compile(
            rf'("{re.escape(a.package)})((?:>=|==|~=)[\d.]+)"',
            re.IGNORECASE,
        )
        replacement = rf'\1>={a.to_version}"'
        new_content = pattern.sub(replacement, content)
        if new_content != content:
            label = f"{a.package}: {a.from_version} -> {a.to_version}"
            if dry_run:
                info(f"  [dry-run] pyproject.toml: {label}")
            else:
                content = new_content
                info(f"  Applied: pyproject.toml: {label}")
            applied.append(label)
    if not dry_run and applied:
        pyproject.write_text(content, encoding="utf-8")
    return applied


def preview_diff(repo_path: Path) -> str:
    """Show git diff after patching."""
    return capture_stdout(["git", "diff"], cwd=repo_path)


def _highest_fix(findings: list[Finding]) -> str:
    """Return the highest fix version from a set of findings."""
    versions = [f.fix_version for f in findings if f.fix_version]
    if not versions:
        return ""
    return max(versions, key=_version_tuple)


def _version_tuple(v: str) -> tuple[int, ...]:
    parts = re.findall(r"\d+", v)
    return tuple(int(p) for p in parts)


def _is_major_bump(current: str, target: str) -> bool:
    cur = _version_tuple(current)
    tgt = _version_tuple(target)
    if not cur or not tgt:
        return False
    return tgt[0] > cur[0]
