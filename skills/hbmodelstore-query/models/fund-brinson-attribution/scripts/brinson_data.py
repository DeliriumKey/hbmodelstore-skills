"""Public read-only Brinson transport; no database or model dependencies."""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import date

BASE_URL = "https://api.delirium.com.cn/models/fund-brinson-attribution"
FUND_CODE = re.compile(r"^[0-9]{6}(?:\.OF)?$", re.IGNORECASE)


def normalize_code(value: str) -> str:
    if not FUND_CODE.fullmatch(value.strip()):
        raise ValueError("fund code must be six digits with optional .OF suffix")
    return value.strip()[:6] + ".OF"


def fetch(endpoint: str, fund_code: str, *, period_end: str | None = None, limit=40):
    code = normalize_code(fund_code)
    params = {"fund_code": code}
    if endpoint == "history":
        if not 1 <= limit <= 40:
            raise ValueError("history limit must be between 1 and 40")
        params["limit"] = limit
    elif endpoint in {"period", "nav-comparison"}:
        params["period_end"] = date.fromisoformat(period_end).isoformat()
    else:
        raise ValueError("unsupported public endpoint")
    url = f"{BASE_URL}/{endpoint}?{urllib.parse.urlencode(params)}"
    # Retry transport failures once; a business error or empty response is not retried.
    for attempt in range(2):
        try:
            with urllib.request.urlopen(url, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            raise ValueError(f"public API {endpoint}: HTTP {exc.code}") from exc
        except (urllib.error.URLError, TimeoutError) as exc:
            if attempt:
                raise ValueError(f"public API {endpoint}: network failure ({exc})") from exc
    raise AssertionError("unreachable")
