"""Regression tests for packaging dependency metadata."""

from __future__ import annotations

import tomllib
from pathlib import Path


def _pyproject() -> dict:
    return tomllib.loads(Path("pyproject.toml").read_text(encoding="utf-8"))


def test_ashare_extra_excludes_mootdx_conflict() -> None:
    extras = _pyproject()["project"]["optional-dependencies"]

    assert all(not dep.lower().startswith("mootdx") for dep in extras["ashare"])
    assert any(dep.lower().startswith("mootdx") for dep in extras["mootdx"])
