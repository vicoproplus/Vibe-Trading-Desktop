"""Tests for the agent-facing a-stock-data tool."""

from __future__ import annotations

import json

from src.tools.a_stock_data_tool import AStockDataTool


def test_a_stock_data_tool_returns_json_for_basic_data(monkeypatch) -> None:
    class FakeClient:
        def basic_data(self, code):
            return {"code": code, "name": "贵州茅台"}

    monkeypatch.setattr("src.tools.a_stock_data_tool.AStockDataClient", lambda: FakeClient())

    payload = json.loads(
        AStockDataTool().execute(category="basic", code="600519.SH", limit=1)
    )

    assert payload["status"] == "ok"
    assert payload["source"] == "a_stock_data"
    assert payload["category"] == "basic"
    assert payload["data"]["name"] == "贵州茅台"
