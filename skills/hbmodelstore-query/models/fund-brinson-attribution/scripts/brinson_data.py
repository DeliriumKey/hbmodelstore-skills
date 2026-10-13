"""Public read-only Brinson transport; no database or model dependencies."""

from __future__ import annotations

import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from public_data import fetch_json

BASE_URL = "https://api.delirium.com.cn/models/fund-brinson-attribution"
FUND_CODE = re.compile(r"^[0-9]{6}(?:!\d+)?(?:\.OF)?$", re.IGNORECASE)


def normalize_code(value: str) -> str:
    if not FUND_CODE.fullmatch(value.strip()):
        raise ValueError("fund code must be six digits with optional !n and .OF suffixes")
    return value.strip().upper().removesuffix(".OF") + ".OF"


def fetch(
    endpoint: str,
    fund_code: str,
    *,
    period_end: str | None = None,
    period_ends: list[str] | tuple[str, ...] | None = None,
    limit=40,
):
    code = normalize_code(fund_code)
    params = {"fund_code": code}
    if endpoint == "history":
        if not 1 <= limit <= 40:
            raise ValueError("history limit must be between 1 and 40")
        params["limit"] = limit
    elif endpoint in {"period", "nav-comparison"}:
        params["period_end"] = date.fromisoformat(period_end).isoformat()
    elif endpoint in {"periods", "nav-comparisons"}:
        if not isinstance(period_ends, (list, tuple)) or not 1 <= len(period_ends) <= 40:
            raise ValueError("batch period_ends must contain between 1 and 40 dates")
        dates = []
        for value in period_ends:
            if not isinstance(value, str) or date.fromisoformat(value).isoformat() != value:
                raise ValueError("batch period_ends must use YYYY-MM-DD")
            if value[5:] not in {"06-30", "12-31"}:
                raise ValueError("batch period_ends must be June 30 or December 31")
            dates.append(value)
        if len(set(dates)) != len(dates):
            raise ValueError("batch period_ends must be unique")
        params["period_ends"] = dates
    else:
        raise ValueError("unsupported public endpoint")
    url = f"{BASE_URL}/{endpoint}?{urllib.parse.urlencode(params, doseq=True)}"
    try:
        return fetch_json(url)
    except urllib.error.HTTPError as exc:
        raise ValueError(f"public API {endpoint}: HTTP {exc.code}") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise ValueError(f"public API {endpoint}: network failure ({exc})") from exc
