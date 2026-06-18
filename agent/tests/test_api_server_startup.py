"""Regression tests for API server startup compatibility."""

from __future__ import annotations

from types import SimpleNamespace

import api_server


def test_has_root_route_ignores_route_entries_without_path() -> None:
    routes = [object(), SimpleNamespace(path="/health"), SimpleNamespace(path="/")]

    assert api_server._has_root_route(routes) is True


def test_has_root_route_returns_false_without_root_path() -> None:
    routes = [object(), SimpleNamespace(path="/health")]

    assert api_server._has_root_route(routes) is False
