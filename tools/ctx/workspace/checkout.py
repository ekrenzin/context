"""Clone or update sub-repositories from repos.yaml."""

import re
from pathlib import Path
from typing import Optional

import typer

from ctx.config import err, info, root_dir
from ctx.runner import run

app = typer.Typer()


def _parse_repos_yaml(manifest_path: Path) -> tuple[str, str, str, list[tuple[str, str, str]]]:
    text = manifest_path.read_text(encoding="utf-8")
    default_org = ""
    default_http = ""
    default_ssh = ""
    repos: list[tuple[str, str, str]] = []
    section = ""
    in_remote = False
    name, remote, branch = "", "", ""

    for line in text.splitlines():
        trimmed = line.strip()
        if trimmed == "defaults:":
            section = "defaults"
            in_remote = False
            continue
        if trimmed == "repositories:":
            if not default_org or not default_http or not default_ssh:
                err("Manifest must include defaults (org, remote.http, remote.ssh) before repositories.")
                raise typer.Exit(1)
            section = "repositories"
            in_remote = False
            continue
        if section != "repositories":
            if section == "defaults":
                if re.match(r"^org:\s*(.+)$", trimmed):
                    default_org = re.sub(r"^org:\s*(.+)$", r"\1", trimmed).strip()
                elif re.match(r"^remote:\s*$", trimmed) or re.match(r"^remote:\s*(.+)$", trimmed):
                    in_remote = True
                elif in_remote and re.match(r"^http:\s*(.+)$", trimmed):
                    default_http = re.sub(r"^http:\s*(.+)$", r"\1", trimmed).strip()
                elif in_remote and re.match(r"^ssh:\s*(.+)$", trimmed):
                    default_ssh = re.sub(r"^ssh:\s*(.+)$", r"\1", trimmed).strip()
            continue
        if not trimmed or trimmed.startswith("#"):
            continue
        m = re.match(r"^-\s*name:\s*(.+)$", trimmed)
        if m:
            if name and branch:
                repos.append((name, remote, branch))
            name = m.group(1).strip()
            remote = ""
            branch = ""
            continue
        if re.match(r"^remote:\s*(.+)$", trimmed):
            remote = re.sub(r"^remote:\s*(.+)$", r"\1", trimmed).strip()
        elif re.match(r"^branch:\s*(.+)$", trimmed):
            branch = re.sub(r"^branch:\s*(.+)$", r"\1", trimmed).strip()
    if name and branch:
        repos.append((name, remote, branch))
    return default_org, default_http, default_ssh, repos


def _validate_remote(remote: str, name: str, allowed_org: str) -> bool:
    if allowed_org not in remote:
        err(f"Remote URL for '{name}' does not belong to the allowed organization.")
        err(f"  Got: {remote}")
        err(f"  Expected URL containing: {allowed_org}")
        return False
    return True


def _process_repo(
    name: str,
    remote: str,
    branch: str,
    repos_dir: Path,
    default_http: str,
    default_ssh: str,
    default_org: str,
) -> bool:
    target = repos_dir / name
    info(f"Processing: {name}")
    if not _validate_remote(remote, name, default_org):
        err(f"Skipping '{name}' due to remote validation failure.")
        return False
    if (target / ".git").exists():
        info("  Repository exists. Fetching updates...")
        current_remote = ""
        try:
            r = run(["git", "remote", "get-url", "origin"], cwd=target, check=False, capture=True)
            current_remote = (r.stdout or "").strip()
        except Exception:
            pass
        if current_remote != remote:
            info("  Updating remote origin URL...")
            run(["git", "remote", "set-url", "origin", remote], cwd=target)
        run(["git", "fetch", "--prune", "origin"], cwd=target)
        r = run(["git", "branch", "--show-current"], cwd=target, check=False, capture=True)
        current_branch = (r.stdout or "").strip()
        if current_branch != branch:
            info(f"  Switching to branch '{branch}'...")
            run(["git", "checkout", branch], cwd=target, check=False)
            run(["git", "checkout", "-b", branch, f"origin/{branch}"], cwd=target, check=False)
        result = run(["git", "pull", "--ff-only", "origin", branch], cwd=target, check=False)
        if result.returncode != 0:
            info("  Fast-forward pull failed. Local branch may have diverged.")
            info(f"  Resolve manually: cd {target}")
        info(f"  Updated: {name} (branch: {branch})")
    else:
        repos_dir.mkdir(parents=True, exist_ok=True)
        result = run(
            ["git", "clone", "--branch", branch, remote, str(target)],
            check=False,
        )
        if result.returncode != 0:
            if target.exists():
                import shutil
                shutil.rmtree(target)
            result2 = run(["git", "clone", remote, str(target)], check=False)
            if result2.returncode != 0:
                target.mkdir(parents=True, exist_ok=True)
                run(["git", "init"], cwd=target)
                run(["git", "remote", "add", "origin", remote], cwd=target)
                run(["git", "checkout", "-b", branch], cwd=target)
            else:
                r = run(["git", "branch", "--show-current"], cwd=target, check=False, capture=True)
                current = (r.stdout or "").strip()
                if current and current != branch:
                    run(["git", "checkout", "-b", branch], cwd=target, check=False)
        info(f"  Cloned: {name} (branch: {branch})")
    if not (target / ".git").exists():
        err(f"  {target} is not a valid git repository after processing.")
        return False
    return True


def checkout_impl(
    ssh: bool = False,
    repo: Optional[str] = None,
) -> None:
    root = root_dir()
    manifest = root / "repos.yaml"
    repos_dir = root / "repos"
    if not manifest.exists():
        err(f"Manifest not found: {manifest}")
        raise typer.Exit(1)
    default_org, default_http, default_ssh, repos = _parse_repos_yaml(manifest)
    if not repos:
        err(f"No repositories found in {manifest}")
        raise typer.Exit(1)
    info("Workspace Checkout")
    info(f"Manifest: {manifest}")
    info(f"Target:   {repos_dir}")
    print()
    success = 0
    failed = 0
    for name, remote, branch in repos:
        if repo and name != repo:
            continue
        if not remote:
            if ssh:
                remote = f"{default_ssh}:{default_org}/{name}.git"
            else:
                remote = f"{default_http}/{default_org}/{name}.git"
        if _process_repo(name, remote, branch, repos_dir, default_http, default_ssh, default_org):
            success += 1
        else:
            failed += 1
        print()
    total = success + failed
    if repo and total == 0:
        err(f"Repository '{repo}' not found in manifest.")
        raise typer.Exit(1)
    print("---")
    info(f"Complete: {success}/{total} succeeded, {failed} failed.")
    if failed > 0:
        raise typer.Exit(1)


@app.command()
def checkout(
    repo: Optional[str] = typer.Option(None, "--repo", help="Process only the named repository"),
    ssh: bool = typer.Option(False, "--ssh", help="Use SSH clone URL instead of HTTPS"),
) -> None:
    """Clone or update sub-repositories from repos.yaml."""
    checkout_impl(ssh=ssh, repo=repo)
