"""Install dependencies for all tools (pip, npm, uv)."""

import hashlib
import shutil
import subprocess
from pathlib import Path

from ctx.config import info, is_windows, root_dir, err
from ctx.runner import run


def ensure_uv() -> None:
    """Install uv if not present."""
    if shutil.which("uv"):
        info(f"uv found: {shutil.which('uv')}")
        return
    info("uv not found -- installing...")
    try:
        if is_windows():
            subprocess.run(
                ["powershell", "-ExecutionPolicy", "ByPass", "-c",
                 "irm https://astral.sh/uv/install.ps1 | iex"],
                check=True,
            )
        else:
            subprocess.run(
                ["sh", "-c", "curl -LsSf https://astral.sh/uv/install.sh | sh"],
                check=True,
            )
        local_bin = Path.home() / ".local" / "bin"
        cargo_bin = Path.home() / ".cargo" / "bin"
        for candidate in [local_bin, cargo_bin]:
            uv_path = candidate / ("uv.exe" if is_windows() else "uv")
            if uv_path.exists():
                info(f"uv installed at {uv_path}")
                return
        info("uv installed. Restart your shell or add ~/.local/bin to PATH.")
    except Exception as exc:
        err(f"Failed to install uv: {exc}")
        info("Install manually: brew install uv  or  curl -LsSf https://astral.sh/uv/install.sh | sh")


def run_deps(force: bool = False) -> None:
    root = root_dir()
    tools_dir = root / "tools"
    ensure_uv()
    info(f"Scanning for dependencies in {tools_dir}...")
    for req_file in tools_dir.rglob("requirements.txt"):
        tool_dir = req_file.parent
        venv_dir = tool_dir / ".venv"
        info(f"Found Python tool: {tool_dir.name}")
        needs = not venv_dir.exists() or force
        if not needs:
            hf = venv_dir / ".installed_hash"
            needs = not hf.exists() or hf.read_text().strip() != hashlib.md5(req_file.read_bytes()).hexdigest()
        if needs:
            if not venv_dir.exists():
                run([shutil.which("python3") or "python", "-m", "venv", str(venv_dir)])
            pip = venv_dir / ("Scripts/pip.exe" if is_windows() else "bin/pip")
            run([str(pip), "install", "--upgrade", "pip"])
            run([str(pip), "install", "-r", str(req_file)])
            (venv_dir / ".installed_hash").write_text(hashlib.md5(req_file.read_bytes()).hexdigest())
            info(f"Installed Python dependencies for {tool_dir.name}")
    for pkg_file in tools_dir.rglob("package.json"):
        if "node_modules" in str(pkg_file):
            continue
        tool_dir = pkg_file.parent
        nm = tool_dir / "node_modules"
        needs = not nm.exists() or force
        if not needs and nm.exists():
            try:
                needs = pkg_file.stat().st_mtime > nm.stat().st_mtime
            except Exception:
                needs = True
        if needs:
            run(["npm", "install"], cwd=tool_dir)
            info(f"Installed Node dependencies for {tool_dir.name}")
    info("Dependency installation complete.")
