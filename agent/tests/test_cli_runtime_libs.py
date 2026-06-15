"""Tests for cli runtime libs sys.path injection.

The injection lives in ``cli/main.py`` as the module-level helper
``_apply_runtime_libs_path``, which reads ``VIBE_RUNTIME_LIBS`` and
appends the dir to ``sys.path`` (append, not insert, so it lands
AFTER bundle site-packages — core deps keep priority).
"""

from __future__ import annotations

import sys

from cli.main import _apply_runtime_libs_path


def test_injection_appends_libs_after_site_packages(monkeypatch, tmp_path):
    """VIBE_RUNTIME_LIBS pointing at an existing dir appends it to sys.path."""
    libs_dir = tmp_path / "libs"
    libs_dir.mkdir()
    monkeypatch.setenv("VIBE_RUNTIME_LIBS", str(libs_dir))

    # 基线：模拟 bundle site-packages 等已有路径，确保 libs 排在它们之后
    baseline = ["/fake/bundle/site-packages", "/fake/other"]
    monkeypatch.setattr(sys, "path", list(baseline))

    _apply_runtime_libs_path()

    assert str(libs_dir) in sys.path
    # append 语义：libs 必须排在所有原有路径之后（核心依赖优先）
    assert sys.path[-1] == str(libs_dir)
    # 关键不变量：bundle site-packages 的 index 小于 libs 的 index
    assert sys.path.index("/fake/bundle/site-packages") < sys.path.index(str(libs_dir))


def test_injection_skips_missing_dir(monkeypatch, tmp_path):
    """A non-existent VIBE_RUNTIME_LIBS is silently skipped (no crash)."""
    missing = tmp_path / "does_not_exist"
    monkeypatch.setenv("VIBE_RUNTIME_LIBS", str(missing))
    baseline = ["/fake/bundle/site-packages"]
    monkeypatch.setattr(sys, "path", list(baseline))

    _apply_runtime_libs_path()

    assert str(missing) not in sys.path


def test_injection_skips_when_env_unset(monkeypatch):
    """Without VIBE_RUNTIME_LIBS the path is untouched."""
    monkeypatch.delenv("VIBE_RUNTIME_LIBS", raising=False)
    baseline = ["/fake/bundle/site-packages", "/keep/me"]
    monkeypatch.setattr(sys, "path", list(baseline))

    _apply_runtime_libs_path()

    assert sys.path == baseline


def test_injection_skips_empty_env(monkeypatch):
    """An empty VIBE_RUNTIME_LIBS string is treated as unset."""
    monkeypatch.setenv("VIBE_RUNTIME_LIBS", "")
    baseline = ["/fake/bundle/site-packages"]
    monkeypatch.setattr(sys, "path", list(baseline))

    _apply_runtime_libs_path()

    assert sys.path == baseline
