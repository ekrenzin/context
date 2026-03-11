"""Image generation CLI commands.

Delegates to the provider modules in tools/image-gen/providers/. Providers
are imported lazily so optional deps (openai, boto3, google-genai) are only
required when actually invoking the corresponding mode.
"""

import sys
from pathlib import Path
from typing import Optional

import typer

from ctx.config import root_dir

app = typer.Typer(no_args_is_help=True)

PROVIDERS_DIR = root_dir() / "tools" / "image-gen" / "providers"


def _ensure_dir(path: str) -> None:
    Path(path).mkdir(parents=True, exist_ok=True)


def _add_provider_path() -> None:
    gen_dir = str(root_dir() / "tools" / "image-gen")
    if gen_dir not in sys.path:
        sys.path.insert(0, gen_dir)


@app.command("generate")
def generate(
    prompt: str = typer.Option("banana", "--type", help="Image prompt"),
    fmt: str = typer.Option("png", "--format", help="Output format"),
    output: str = typer.Option("playground/images", help="Output directory"),
    mode: str = typer.Option("openai", help="Provider: openai, gemini, bedrock"),
    model: Optional[str] = typer.Option(None, help="Model ID override"),
    api_key: Optional[str] = typer.Option(None, "--api-key", help="API key override"),
) -> None:
    """Generate an image using AI providers."""
    _add_provider_path()
    _ensure_dir(output)

    safe_name = "".join(c if c.isalnum() else "_" for c in prompt)[:50]
    filepath = str(Path(output) / f"{safe_name}.{fmt}")

    if mode == "openai":
        from providers import openai_gen
        openai_gen.generate_image(prompt, filepath, model or "dall-e-3", api_key)
    elif mode == "gemini":
        from providers import gemini_gen
        gemini_gen.generate_image(
            prompt, filepath, model or "imagen-4.0-fast-generate-001", api_key,
        )
    elif mode == "bedrock":
        from providers import bedrock_gen
        bedrock_gen.generate_image(
            prompt, filepath, model or "amazon.titan-image-generator-v1",
        )
    else:
        typer.echo(f"Unknown mode: {mode}. Use openai, gemini, or bedrock.", err=True)
        raise typer.Exit(1)
