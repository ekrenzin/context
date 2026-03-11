"""Flask app factory for local Python package index."""

from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass
from pathlib import Path

from flask import Flask, abort, render_template_string, send_from_directory

from ctx.config import env, load_env

INDEX_TEMPLATE = """
<ul>
{% for package in packages %}
<li><a href="/{{ package.slug }}/">{{ package.slug }}</a></li>
{% endfor %}
</ul>
"""

PACKAGE_TEMPLATE = """
<h1>{{ package.slug }}</h1>
<ul>
{% for file_name in files %}
<li><a href="/{{ package.slug }}/{{ file_name }}">{{ file_name }}</a></li>
{% endfor %}
</ul>
"""


@dataclass(frozen=True)
class PackageConfig:
    slug: str
    dist_dir: Path


def _resolve_root_dir() -> Path:
    load_env()
    configured_root = env("LOCALPYPI_ROOT", "").strip()
    if configured_root:
        return Path(configured_root).expanduser().resolve()
    git_top = subprocess.check_output(
        ["git", "rev-parse", "--show-toplevel"],
        text=True,
    ).strip()
    return (Path(git_top) / "repos").resolve()


def _project_slug(project: str) -> str:
    return project.replace("_", "-")


def _source_name(project: str) -> str:
    return project


def _build_package_map(root_dir: Path) -> dict[str, PackageConfig]:
    raw = env("LOCALPYPI", "")
    projects = [project.strip() for project in raw.split(",") if project.strip()]
    packages: dict[str, PackageConfig] = {}
    for project in projects:
        slug = _project_slug(project)
        packages[slug] = PackageConfig(
            slug=slug,
            dist_dir=root_dir / _source_name(project) / "dist",
        )
    return packages


def _artifact_names(dist_dir: Path) -> list[str]:
    if not dist_dir.is_dir():
        return []
    artifacts: list[str] = []
    for path in sorted(dist_dir.iterdir(), key=lambda item: item.name.lower()):
        if not path.is_file():
            continue
        if path.suffix == ".whl" or path.name.endswith(".tar.gz"):
            artifacts.append(path.name)
    return artifacts


def create_app() -> Flask:
    """Build and configure flask app."""
    app = Flask(__name__)
    root_dir = _resolve_root_dir()
    os.chdir(root_dir)
    package_map = _build_package_map(root_dir)
    app.config["LOCALPYPI_ROOT"] = str(root_dir)
    app.config["LOCALPYPI_PACKAGES"] = package_map

    @app.get("/")
    def index() -> str:
        return render_template_string(
            INDEX_TEMPLATE,
            packages=list(app.config["LOCALPYPI_PACKAGES"].values()),
        )

    @app.get("/<package_slug>")
    @app.get("/<package_slug>/")
    def list_package(package_slug: str) -> str:
        package = app.config["LOCALPYPI_PACKAGES"].get(package_slug)
        if package is None:
            abort(404)
        return render_template_string(
            PACKAGE_TEMPLATE,
            package=package,
            files=_artifact_names(package.dist_dir),
        )

    @app.get("/<package_slug>/<path:file_name>")
    def fetch_artifact(package_slug: str, file_name: str):
        package = app.config["LOCALPYPI_PACKAGES"].get(package_slug)
        if package is None:
            abort(404)
        if not (file_name.endswith(".whl") or file_name.endswith(".tar.gz")):
            abort(404)
        if file_name not in _artifact_names(package.dist_dir):
            abort(404)
        return send_from_directory(package.dist_dir, file_name, as_attachment=False)

    return app
