"""AWS credential resolution from Context settings."""

import json
import os
import sys
import urllib.request

CC_BASE = os.environ.get("CTX_CC_URL", "http://localhost:19471")

SETTING_KEYS = [
    "aws_access_key_id",
    "aws_secret_access_key",
    "aws_region",
]


def load_from_settings() -> dict[str, str]:
    """Fetch AWS credentials from Command Center settings DB."""
    try:
        req = urllib.request.Request(f"{CC_BASE}/api/settings")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
    except Exception as exc:
        print(f"Error: cannot reach Command Center: {exc}", file=sys.stderr)
        print("Set AWS credentials via the Command Center settings UI.", file=sys.stderr)
        sys.exit(1)

    result: dict[str, str] = {}
    for key in SETTING_KEYS:
        val = data.get(key, "")
        if val:
            result[key] = val
    return result


def require_credentials() -> dict[str, str]:
    """Load credentials and abort if access key is missing."""
    creds = load_from_settings()
    if not creds.get("aws_access_key_id") or not creds.get("aws_secret_access_key"):
        print("Error: AWS credentials not configured.", file=sys.stderr)
        print("Set aws_access_key_id and aws_secret_access_key in Command Center settings.", file=sys.stderr)
        sys.exit(1)
    return creds


def aws_env() -> dict[str, str]:
    """Return env dict with AWS credentials injected for subprocess calls."""
    creds = require_credentials()
    env = {**os.environ}
    env["AWS_ACCESS_KEY_ID"] = creds["aws_access_key_id"]
    env["AWS_SECRET_ACCESS_KEY"] = creds["aws_secret_access_key"]
    env["AWS_DEFAULT_REGION"] = creds.get("aws_region", "us-east-1")
    # Clear any profile so only our explicit keys are used
    env.pop("AWS_PROFILE", None)
    env.pop("AWS_SHARED_CREDENTIALS_FILE", None)
    return env
