"""Proposal reading, prompt assembly, and status management."""

import json
import re
from pathlib import Path

from ctx.config import root_dir


def proposals_dir() -> Path:
    return root_dir() / "docs" / "proposals"


def parse_frontmatter(text: str) -> dict:
    """Parse YAML frontmatter from a markdown file."""
    match = re.match(r"^---\n(.*?)\n---\n?(.*)$", text, re.DOTALL)
    if not match:
        return {}
    meta: dict = {}
    for line in match.group(1).split("\n"):
        idx = line.find(":")
        if idx < 0:
            continue
        key = line[:idx].strip()
        val = line[idx + 1:].strip()
        if val == "null":
            meta[key] = None
        elif val == "true":
            meta[key] = True
        elif val == "false":
            meta[key] = False
        elif val == "[]":
            meta[key] = []
        elif val.startswith("["):
            try:
                meta[key] = json.loads(val)
            except json.JSONDecodeError:
                meta[key] = val
        else:
            meta[key] = val
    return meta


def list_proposals() -> list[dict]:
    """Return structured list of proposals with metadata."""
    pdir = proposals_dir()
    if not pdir.is_dir():
        return []

    results = []
    for d in sorted(pdir.iterdir()):
        if not d.is_dir() or d.name.startswith("_"):
            continue
        proposal_file = d / "PROPOSAL.md"
        if not proposal_file.is_file():
            continue

        text = proposal_file.read_text(encoding="utf-8")
        meta = parse_frontmatter(text)

        tasks = _read_tasks(d)
        tasks_by_status: dict[str, int] = {}
        for t in tasks:
            s = t["status"]
            tasks_by_status[s] = tasks_by_status.get(s, 0) + 1

        results.append({
            "slug": d.name,
            "title": meta.get("title", d.name),
            "date": meta.get("date", ""),
            "status": meta.get("status", "draft"),
            "repo": meta.get("repo", ""),
            "taskCount": len(tasks),
            "tasksByStatus": tasks_by_status,
        })

    return sorted(results, key=lambda p: p.get("date", ""), reverse=True)


def read_proposal(slug: str) -> dict:
    """Read a proposal directory and return structured data."""
    pdir = proposals_dir() / slug
    if not pdir.is_dir():
        raise FileNotFoundError(f"Proposal not found: {slug}")

    proposal_file = pdir / "PROPOSAL.md"
    if not proposal_file.is_file():
        raise FileNotFoundError(f"No PROPOSAL.md in {slug}/")

    proposal_text = proposal_file.read_text(encoding="utf-8")
    meta = parse_frontmatter(proposal_text)

    impact_file = pdir / "impact.md"
    impact_text = ""
    if impact_file.is_file():
        impact_text = impact_file.read_text(encoding="utf-8")

    tasks = _read_tasks(pdir)

    return {
        "slug": slug,
        "title": meta.get("title", slug),
        "status": meta.get("status", "draft"),
        "proposal": proposal_text,
        "impact": impact_text,
        "tasks": tasks,
    }


def _read_tasks(pdir: Path) -> list[dict]:
    """Read numbered task files from a proposal directory."""
    pattern = re.compile(r"^(\d+)-(.+)\.md$")
    tasks = []
    for f in sorted(pdir.iterdir()):
        match = pattern.match(f.name)
        if not match:
            continue
        number = int(match.group(1))
        content = f.read_text(encoding="utf-8")
        meta = parse_frontmatter(content)
        tasks.append({
            "number": number,
            "filename": f.name,
            "name": meta.get("task", f.name),
            "status": meta.get("status", "pending"),
            "agent": meta.get("agent", "generalPurpose"),
            "model": meta.get("model", "default"),
            "depends_on": meta.get("depends_on", []),
            "content": content,
        })
    return tasks


def set_status(slug: str, status: str, task_number: int | None = None) -> None:
    """Update status in YAML frontmatter of a proposal or task file."""
    pdir = proposals_dir() / slug
    if not pdir.is_dir():
        raise FileNotFoundError(f"Proposal not found: {slug}")

    if task_number is not None:
        target = _find_task_file(pdir, task_number)
    else:
        target = pdir / "PROPOSAL.md"

    if not target.is_file():
        raise FileNotFoundError(f"File not found: {target}")

    text = target.read_text(encoding="utf-8")
    updated = re.sub(r"^(status:\s*).*$", rf"\g<1>{status}", text, count=1, flags=re.MULTILINE)
    target.write_text(updated, encoding="utf-8")


def _find_task_file(pdir: Path, task_number: int) -> Path:
    """Find a task file by its number prefix."""
    prefix = f"{task_number:02d}-"
    for f in pdir.iterdir():
        if f.name.startswith(prefix) and f.name.endswith(".md"):
            return f
    raise FileNotFoundError(f"Task {task_number} not found in {pdir.name}/")


def build_prompt(data: dict, task_number: int | None = None) -> str:
    """Assemble an agent prompt from proposal data."""
    slug = data["slug"]
    rel_path = f"docs/proposals/{slug}"

    parts = [
        "You are building a feature based on a design proposal.",
        "Read the CLAUDE.md and AGENTS.md files first for workspace context.",
        f"The proposal lives in {rel_path}/",
        "",
        "# Proposal",
        f"<!-- source: {rel_path}/PROPOSAL.md -->",
        "",
        data["proposal"].strip(),
    ]

    if data["impact"]:
        parts.extend([
            "",
            "# Impact Analysis",
            f"<!-- source: {rel_path}/impact.md -->",
            "",
            data["impact"].strip(),
        ])

    if task_number is not None:
        task = next(
            (t for t in data["tasks"] if t["number"] == task_number), None
        )
        if task is None:
            available = [str(t["number"]) for t in data["tasks"]]
            raise ValueError(
                f"Task {task_number} not found. Available: {', '.join(available)}"
            )
        parts.extend([
            "",
            f"# Your Task (#{task_number})",
            f"<!-- source: {rel_path}/{task['filename']} -->",
            "",
            task["content"].strip(),
        ])
    else:
        if data["tasks"]:
            parts.extend(["", "# Tasks", ""])
            for task in data["tasks"]:
                parts.extend([
                    f"## Task {task['number']}: {task['filename']}",
                    f"<!-- source: {rel_path}/{task['filename']} -->",
                    "",
                    task["content"].strip(),
                    "",
                ])

    parts.extend([
        "",
        "Implement this proposal. Work through the tasks in order, respecting "
        "dependencies. Run validation (ctx workspace check) before finishing.",
        f"Update task status in {rel_path}/ as you complete each task.",
    ])

    return "\n".join(parts)
