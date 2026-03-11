"""Per-repo check implementations for workspace check.

Add your own repo-specific check functions here following the pattern below.
"""

from pathlib import Path

from ctx.runner import run


def _run_check(label: str, dir_path: Path, cmd: list[str], results: list[str],
               skip: list[int], pass_count: list[int], fail_count: list[int]) -> None:
    print(f"\n--- {label} ---")
    if not dir_path.is_dir():
        print(f"  SKIP: directory {dir_path} not found")
        skip[0] += 1
        results.append(f"  SKIP  {label} (directory not found)")
        return
    result = run(cmd, cwd=dir_path, check=False)
    if result.returncode == 0:
        print("  PASS")
        pass_count[0] += 1
        results.append(f"  PASS  {label}")
    else:
        print("  FAIL")
        fail_count[0] += 1
        results.append(f"  FAIL  {label}")


def check_has_node_modules(dir_path: Path, results: list[str], skip: list[int]) -> bool:
    if not (dir_path / "node_modules").is_dir():
        print(f"\n--- {dir_path}: node_modules missing ---")
        print(f"  SKIP: Run 'cd {dir_path} && npm install' first")
        skip[0] += 1
        results.append(f"  SKIP  {dir_path} (node_modules missing)")
        return False
    return True
