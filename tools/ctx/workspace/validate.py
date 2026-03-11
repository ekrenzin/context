"""Validate docs structure and sync tooling registry."""

import re
from pathlib import Path

import typer

from ctx.config import root_dir
from ctx.runner import run

app = typer.Typer()


def _get_repo_names(root: Path) -> list[str]:
    manifest = root / "repos.yaml"
    if not manifest.exists():
        return []
    text = manifest.read_text(encoding="utf-8")
    names: list[str] = []
    for m in re.finditer(r"^\s*-\s*name:\s*(.+)$", text, re.MULTILINE):
        names.append(m.group(1).strip())
    return names


def _get_repo_doc_map(root: Path) -> dict[str, str]:
    """Build repo-to-doc mapping dynamically from docs/repos/."""
    docs_dir = root / "docs" / "repos"
    if not docs_dir.is_dir():
        return {}
    mapping: dict[str, str] = {}
    for doc in docs_dir.glob("*.md"):
        mapping[doc.stem] = doc.name
    return mapping


@app.command()
def docs() -> None:
    """Validate docs/ structure, cross-links, line budgets, repo alignment."""
    root = root_dir()
    errors = 0
    warnings = 0

    def fail(msg: str) -> None:
        nonlocal errors
        print(f"  FAIL: {msg}")
        errors += 1

    def warn(msg: str) -> None:
        nonlocal warnings
        print(f"  WARN: {msg}")
        warnings += 1

    def ok(msg: str) -> None:
        print(f"  OK: {msg}")

    repo_to_doc = _get_repo_doc_map(root)
    doc_to_repo = {v: k for k, v in repo_to_doc.items()}

    print("=== Docs Validation ===\n")
    print("[1] Repo doc coverage")
    for repo in _get_repo_names(root):
        doc_file = repo_to_doc.get(repo)
        if not doc_file:
            warn(f"{repo} has no matching doc file in docs/repos/")
            continue
        if (root / "docs" / "repos" / doc_file).exists():
            ok(f"{repo} -> docs/repos/{doc_file}")
        else:
            fail(f"{repo} missing docs/repos/{doc_file}")
    print("\n[2] Orphan doc check")
    docs_dir = root / "docs" / "repos"
    if docs_dir.exists():
        for doc_path in docs_dir.glob("*.md"):
            if doc_path.name not in doc_to_repo:
                warn(f"docs/repos/{doc_path.name} has no matching repo in repos.yaml")
    else:
        ok("No orphan doc files")
    print("\n[3] AGENTS.md line budget (max 150)")
    agents = root / "AGENTS.md"
    if agents.exists():
        lines = len(agents.read_text(encoding="utf-8").splitlines())
        if lines <= 150:
            ok(f"AGENTS.md is {lines} lines")
        else:
            fail(f"AGENTS.md is {lines} lines (budget: 150)")
    print("\n[4] Docs file size (max 400 lines each)")
    oversized = 0
    for doc_file in (root / "docs").rglob("*.md"):
        lines = len(doc_file.read_text(encoding="utf-8").splitlines())
        rel = doc_file.relative_to(root)
        if lines > 400:
            fail(f"{rel} is {lines} lines")
            oversized += 1
    if oversized == 0:
        ok("All docs files within budget")
    print("\n[5] Cross-link validation")
    link_errors = 0
    for doc_file in list((root / "docs").rglob("*.md")) + [root / "AGENTS.md"]:
        if not doc_file.exists():
            continue
        rel = doc_file.relative_to(root)
        text = doc_file.read_text(encoding="utf-8")
        for m in re.finditer(r"`(docs/[^`]+|AGENTS\.md)`", text):
            ref = m.group(1)
            if not (root / ref).exists():
                fail(f"{rel} references `{ref}` (not found)")
                link_errors += 1
    if link_errors == 0:
        ok("All cross-links resolve")
    print("\n[6] Skill references")
    cursorrules = root / ".cursorrules"
    if cursorrules.exists():
        text = cursorrules.read_text(encoding="utf-8")
        for m in re.finditer(r"^\s*/([a-z][-a-z]+)\s*$", text, re.MULTILINE):
            skill_name = m.group(1)
            skill_path = root / ".cursor" / "skills" / skill_name / "SKILL.md"
            if skill_path.exists():
                ok(f"/{skill_name} -> .cursor/skills/{skill_name}/SKILL.md")
            else:
                fail(f"/{skill_name} referenced in .cursorrules but .cursor/skills/{skill_name}/SKILL.md not found")
    print("\n[7] Manifest tool paths")
    manifest = root / "tools" / "manifest.yaml"
    ctx_bin = root / "tools" / ".venv" / "bin" / "ctx"
    if manifest.exists():
        text = manifest.read_text(encoding="utf-8")
        for m in re.finditer(r"path:\s+(\S+)", text):
            tool_path = m.group(1).strip()
            if tool_path.startswith("ctx"):
                if ctx_bin.exists():
                    ok(f"{tool_path} (ctx CLI)")
                else:
                    fail(f"Manifest lists {tool_path} but tools/.venv/bin/ctx not found (run: python tools/bootstrap.py)")
            elif (root / tool_path).exists():
                ok(f"{tool_path} exists")
            else:
                fail(f"Manifest lists {tool_path} but not found on disk")
    else:
        fail("tools/manifest.yaml not found")
    print("\n[8] Registry sync")
    sync_script = root / "tools" / "scripts" / "sync-registry.cjs"
    if manifest.exists() and sync_script.exists():
        result = run(
            ["node", str(root / "tools" / "scripts" / "sync-registry.cjs"), str(root), "--check"],
            check=False,
            capture=True,
        )
        if result.returncode == 0:
            ok("docs/tooling-registry.md is in sync with manifest")
        else:
            fail("docs/tooling-registry.md is out of date -- run: ctx workspace validate registry")
    else:
        warn("Cannot verify registry sync (manifest or sync script missing)")
    print("\n=== Summary ===")
    print(f"  Errors:   {errors}")
    print(f"  Warnings: {warnings}")
    if errors > 0:
        print("\nValidation failed with", errors, "error(s).")
        raise typer.Exit(1)
    print("\nValidation passed.")


@app.command()
def registry(
    check: bool = typer.Option(False, "--check", help="Verify registry is up to date without overwriting"),
) -> None:
    """Generate docs/tooling-registry.md from tools/manifest.yaml."""
    root = root_dir()
    script = root / "tools" / "scripts" / "sync-registry.cjs"
    if not script.exists():
        typer.echo("sync-registry.cjs not found")
        raise typer.Exit(1)
    cmd = ["node", str(script), str(root)]
    if check:
        cmd.append("--check")
    result = run(cmd, check=False)
    if check and result.returncode != 0:
        raise typer.Exit(1)
