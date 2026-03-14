"""Thin wrapper for running aws CLI with Context credentials."""

import json
import subprocess
import sys

from ctx.aws.credentials import aws_env
from ctx.config import err


def run_aws(*args: str, parse_json: bool = True) -> dict | str:
    """Run an aws CLI command with Context-managed credentials."""
    cmd = ["aws", *args]
    if parse_json:
        cmd.extend(["--output", "json"])
    result = subprocess.run(cmd, capture_output=True, text=True, env=aws_env())
    if result.returncode != 0:
        err(f"aws {' '.join(args[:3])}... failed: {result.stderr.strip()}")
        sys.exit(1)
    if parse_json and result.stdout.strip():
        return json.loads(result.stdout)
    return result.stdout.strip()
