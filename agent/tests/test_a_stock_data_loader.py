"""Tests for the a-stock-data A-share adapter.

These are no-network tests: HTTP/TCP clients are stubbed so the test suite
pins endpoint mapping and normalization without depending on public services.
"""

from __future__ import annotations

import json
from types import SimpleNamespace

import pandas as pd

from backtest.loaders.a_stock_data import (
    AStockDataClient,
    DataLoader,
    _extract_jsonp,
    _normalise_code,
    _tencent_symbol,
)
from backtest.loaders.registry import FALLBACK_CHAINS, LOADER_REGISTRY, VALID_SOURCES, _ensure_registered


def test_normalise_code_accepts_common_a_share_formats() -> None:
    assert _normalise_code("600519.SH") == "600519"
    assert _normalise_code("SH600519") == "600519"
    assert _normalise_code("sz000001") == "000001"
    assert _normalise_code("688017") == "688017"


def test_tencent_symbol_uses_exchange_prefix() -> None:
    assert _tencent_symbol("600519.SH") == "sh600519"
    assert _tencent_symbol("000001.SZ") == "sz000001"
    assert _tencent_symbol("832000.BJ") == "bj832000"


def test_extract_jsonp_returns_payload() -> None:
    assert _extract_jsonp('jQuery_news({"ok":true})') == {"ok": True}


def test_loader_fetches_mootdx_daily_bars_from_a_stock_data_shape() -> None:
    client = SimpleNamespace(
        get_k_data=lambda code, start_date, end_date: pd.DataFrame(
            {
                "open": [10.0],
                "close": [11.0],
                "high": [12.0],
                "low": [9.0],
                "vol": [12345],
            },
            index=pd.to_datetime(["2026-06-01"]),
        )
    )
    loader = DataLoader(quotes_factory=lambda: client)

    data = loader.fetch(["600519.SH"], "2026-06-01", "2026-06-02")

    assert list(data) == ["600519.SH"]
    frame = data["600519.SH"]
    assert list(frame.columns) == ["open", "high", "low", "close", "volume"]
    assert frame.iloc[0].to_dict() == {
        "open": 10.0,
        "high": 12.0,
        "low": 9.0,
        "close": 11.0,
        "volume": 12345.0,
    }


def test_loader_fetches_tencent_daily_bars_without_mootdx() -> None:
    def fake_kline(symbol, start_date, end_date):
        assert (symbol, start_date, end_date) == ("600519", "2026-06-01", "2026-06-02")
        return pd.DataFrame(
            {
                "open": [10.0],
                "high": [12.0],
                "low": [9.0],
                "close": [11.0],
                "volume": [12345.0],
            },
            index=pd.to_datetime(["2026-06-01"]),
        )

    data = DataLoader(kline_fetcher=fake_kline).fetch(["600519.SH"], "2026-06-01", "2026-06-02")

    assert data["600519.SH"].iloc[0]["close"] == 11.0


def test_research_reports_use_eastmoney_reportapi() -> None:
    seen = {}

    def fake_em_get(url, params=None, headers=None, timeout=15):
        seen["url"] = url
        seen["params"] = params
        return SimpleNamespace(
            json=lambda: {
                "data": [
                    {
                        "title": "贵州茅台深度报告",
                        "publishDate": "2026-06-10 00:00:00",
                        "orgSName": "示例证券",
                        "infoCode": "ABC123",
                    }
                ],
                "TotalPage": 1,
            }
        )

    rows = AStockDataClient(em_get=fake_em_get).research_reports("600519.SH", max_pages=1)

    assert "reportapi.eastmoney.com/report/list" in seen["url"]
    assert seen["params"]["code"] == "600519"
    assert rows == [
        {
            "title": "贵州茅台深度报告",
            "publish_date": "2026-06-10",
            "org": "示例证券",
            "info_code": "ABC123",
            "rating": "",
            "eps_this_year": None,
            "eps_next_year": None,
            "eps_next_two_year": None,
            "industry": "",
            "source": "eastmoney_reportapi",
        }
    ]


def test_stock_news_parses_eastmoney_jsonp_articles() -> None:
    payload = {
        "result": {
            "cmsArticleWebOld": [
                {
                    "title": "<em>茅台</em>新闻",
                    "content": "<p>正文</p>",
                    "date": "2026-06-11 09:30:00",
                    "mediaName": "东财",
                    "url": "https://example.test/news",
                }
            ]
        }
    }

    def fake_em_get(url, params=None, headers=None, timeout=15):
        assert "search-api-web.eastmoney.com/search/jsonp" in url
        assert json.loads(params["param"])["keyword"] == "600519"
        return SimpleNamespace(text=f"jQuery_news({json.dumps(payload, ensure_ascii=False)})")

    rows = AStockDataClient(em_get=fake_em_get).stock_news("600519.SH", page_size=5)

    assert rows[0]["title"] == "茅台新闻"
    assert rows[0]["content"] == "正文"
    assert rows[0]["source"] == "东财"
    assert rows[0]["provider"] == "eastmoney_search"


def test_basic_data_combines_tencent_quote_and_eastmoney_info() -> None:
    def fake_quote(codes):
        assert codes == ["600519"]
        return {"600519": {"name": "贵州茅台", "price": 1500.0, "pe_ttm": 22.0, "pb": 8.0}}

    def fake_em_get(url, params=None, headers=None, timeout=15):
        assert "push2.eastmoney.com/api/qt/stock/get" in url
        return SimpleNamespace(
            json=lambda: {
                "data": {
                    "f57": "600519",
                    "f58": "贵州茅台",
                    "f127": "酿酒行业",
                    "f84": 1256197800,
                    "f85": 1256197800,
                    "f116": 1800000000000,
                    "f117": 1800000000000,
                    "f189": 20010827,
                    "f43": 1500.0,
                }
            }
        )

    info = AStockDataClient(em_get=fake_em_get, quote_fetcher=fake_quote).basic_data("600519.SH")

    assert info["code"] == "600519"
    assert info["industry"] == "酿酒行业"
    assert info["quote"]["pe_ttm"] == 22.0
    assert info["source"] == "tencent_quote+eastmoney_push2"


def test_basic_data_falls_back_to_tencent_quote_when_eastmoney_disconnects() -> None:
    def fake_quote(codes):
        return {"600519": {"name": "贵州茅台", "price": 1500.0, "pe_ttm": 22.0}}

    def failing_em_get(*args, **kwargs):
        raise OSError("remote disconnected")

    info = AStockDataClient(em_get=failing_em_get, quote_fetcher=fake_quote).basic_data("600519.SH")

    assert info["code"] == "600519"
    assert info["name"] == "贵州茅台"
    assert info["price"] == 1500.0
    assert info["source"] == "tencent_quote"


def test_announcements_use_cninfo_orgid_mapping() -> None:
    def fake_get(url, **kwargs):
        assert "szse_stock.json" in url
        return SimpleNamespace(json=lambda: {"stockList": [{"code": "600519", "orgId": "gssh0600519"}]})

    def fake_post(url, data=None, headers=None, timeout=15):
        assert data["stock"] == "600519,gssh0600519"
        return SimpleNamespace(
            json=lambda: {
                "announcements": [
                    {
                        "announcementTitle": "年度报告",
                        "announcementTypeName": "定期报告",
                        "announcementTime": 1780272000000,
                        "announcementId": "121212",
                    }
                ]
            }
        )

    rows = AStockDataClient(http_get=fake_get, http_post=fake_post).announcements("600519.SH")

    assert rows == [
        {
            "title": "年度报告",
            "type": "定期报告",
            "date": "2026-06-01",
            "url": "https://www.cninfo.com.cn/new/disclosure/detail?annoId=121212",
            "source": "cninfo",
        }
    ]


def test_registry_exposes_a_stock_data_without_removing_existing_sources() -> None:
    _ensure_registered()
    assert "a_stock_data" in LOADER_REGISTRY
    assert "a_stock_data" in VALID_SOURCES
    chain = FALLBACK_CHAINS["a_share"]
    assert chain.index("a_stock_data") < chain.index("akshare")
    for source in ("tushare", "mootdx", "baostock", "tencent", "akshare"):
        assert source in chain
