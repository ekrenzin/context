"""Shared LLM invocation via API (Anthropic or OpenAI)."""

import json
import os
import urllib.request
import urllib.error
from pathlib import Path


def _load_env_file() -> dict[str, str]:
    env_path = Path(__file__).resolve().parents[3] / ".env"
    vals: dict[str, str] = {}
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            vals[k.strip()] = v.strip().strip("'\"")
    return vals


def _resolve_key(env_names: list[str]) -> str | None:
    for var in env_names:
        key = os.environ.get(var, "").strip()
        if key:
            return key
    env_vals = _load_env_file()
    for var in env_names:
        if var in env_vals and env_vals[var]:
            return env_vals[var]
    return None


def _provider_for_model(model: str) -> str:
    if model.startswith(("claude", "haiku", "sonnet", "opus")):
        return "anthropic"
    return "openai"


def _call_anthropic(prompt: str, model: str, api_key: str) -> str | None:
    body = json.dumps({
        "model": model,
        "max_tokens": 4096,
        "messages": [{"role": "user", "content": prompt}],
    }).encode()

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=240) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"Warning: Anthropic API returned {e.code}: {e.read().decode()[:200]}")
        return None
    except Exception as e:
        print(f"Warning: Anthropic API call failed: {e}")
        return None

    text = ""
    for block in data.get("content", []):
        if block.get("type") == "text":
            text += block["text"]
    return text.strip() or None


def _call_openai(prompt: str, model: str, api_key: str) -> str | None:
    body = json.dumps({
        "model": model,
        "max_tokens": 4096,
        "messages": [{"role": "user", "content": prompt}],
    }).encode()

    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=240) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"Warning: OpenAI API returned {e.code}: {e.read().decode()[:200]}")
        return None
    except Exception as e:
        print(f"Warning: OpenAI API call failed: {e}")
        return None

    text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    return text.strip() or None


def _resolve_provider(model: str) -> tuple[str, str] | None:
    """Returns (provider, api_key) or None."""
    provider = _provider_for_model(model)
    if provider == "anthropic":
        key = _resolve_key(["ANTHROPIC_API_KEY", "ANTHROPIC_KEY"])
        if key:
            return ("anthropic", key)
        key = _resolve_key(["OPENAI_API_KEY", "OPENAI_KEY"])
        if key:
            return ("openai", key)
    else:
        key = _resolve_key(["OPENAI_API_KEY", "OPENAI_KEY"])
        if key:
            return ("openai", key)
        key = _resolve_key(["ANTHROPIC_API_KEY", "ANTHROPIC_KEY"])
        if key:
            return ("anthropic", key)
    return None


def call_agent(prompt: str, model: str, timeout: int = 240) -> str | None:
    resolved = _resolve_provider(model)
    if not resolved:
        print(
            "Error: No API key found.\n"
            "  Set ANTHROPIC_API_KEY or OPENAI_API_KEY env var, or add to .env"
        )
        return None

    provider, api_key = resolved
    if provider == "anthropic":
        return _call_anthropic(prompt, model, api_key)
    return _call_openai(prompt, model, api_key)
