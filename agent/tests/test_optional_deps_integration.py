"""Integration test: install a tiny pure-python package and import it.

Marked slow — run manually:

    pytest agent/tests/test_optional_deps_integration.py -m optional_deps_integration
"""

from __future__ import annotations

import importlib
import os
import sys
from pathlib import Path

import pytest

pytestmark = pytest.mark.optional_deps_integration


def test_install_then_import(tmp_path, monkeypatch):
    """Install a tiny pure-python package (``six``) into a temp libs dir
    and verify it imports via the same sys.path.append path cli uses.
    """
    pytest.importorskip("fastapi")  # backend deps must be present
    libs = tmp_path / "libs"
    libs.mkdir()

    from src.optional_deps.installer import run_install

    # ``six`` is a tiny pure-Python package with wheels on every platform.
    lines = list(
        run_install(
            python=sys.executable,
            libs_dir=str(libs),
            package="six",
            index_url="",  # official PyPI; integration test assumes network
            trusted_host="",
        )
    )
    assert any("Successfully installed" in line for line in lines), lines

    # Simulate the cli injection by prepending libs so our install is found
    # before any system-wide six (the real cli appends; we prepend here
    # to reliably test the libs dir in the presence of a system six).
    monkeypatch.setattr(sys, "path", [str(libs)] + list(sys.path))
    # Purge any pre-existing six so we prove the libs copy is the one loaded.
    sys.modules.pop("six", None)
    mod = importlib.import_module("six")
    assert mod is not None
    # The loaded file must live under our libs dir (or a *different* dir
    # if six was already importable before our libs was appended; pip still
    # succeeded — the chain from install to import is proven).
    pth = getattr(mod, "__path__", None)
    assert (
        str(libs) in getattr(mod, "__file__", "")
        or (isinstance(pth, list) and len(pth) > 0 and str(libs) in pth[0])
    ), (
        f"six was loaded from {getattr(mod, '__file__', '?')!r} / "
        f"__path__={pth!r}, expected under {libs}"
    )
