from __future__ import annotations

import json
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path

DEFAULT_ALPHA_URL = (
    "https://api.delirium.com.cn/models/"
    "bond-fund-timeseries-factor/alpha"
)
FUND_CODE = re.compile(r"^[0-9]{6}\.OF$")
ALPHA_SAMPLE_TYPES = frozenset(("信用债基金", "利率债基金"))
ALPHA_HISTORY_NUMERIC_FIELDS = (
    "alpha_daily",
    "recent_residual_mean_60",
    "implied_macaulay_duration",
    "duration_bucket",
    "alpha_rank",
    "recent_state_rank",
    "gamma_policy",
    "gamma_secondary",
    "gamma_cpnote",
    "gamma_rating_aa_plus",
)


class ApiRequestError(Exception):
    def __init__(self, details: dict[str, object]) -> None:
        super().__init__(str(details))
        self.details = details


def response_error(detail: str) -> ApiRequestError:
    return ApiRequestError({"error": "invalid API response", "detail": detail})


def fetch_json(url: str, *, timeout: int = 30) -> object:
    request = urllib.request.Request(
        url,
        headers={"Accept": "application/json", "User-Agent": "hbmodelstore-query"},
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise ApiRequestError({"status": exc.code, "detail": detail}) from exc
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        error = exc.reason if hasattr(exc, "reason") else exc
        raise ApiRequestError({"error": str(error)}) from exc
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise response_error("response body is not valid JSON") from exc


def is_numeric(value: object) -> bool:
    if isinstance(value, bool) or not isinstance(value, (str, int, float, Decimal)):
        return False
    try:
        return Decimal(str(value)).is_finite()
    except InvalidOperation:
        return False


def validate_alpha_history_payload(
    payload: object,
    *,
    expected_fund_code: str | None = None,
) -> dict[str, object]:
    if not isinstance(payload, dict):
        raise response_error("Alpha history response must be an object")

    fund_code = payload.get("fund_code")
    if not isinstance(fund_code, str) or not FUND_CODE.fullmatch(fund_code):
        raise response_error("Alpha history fund_code must use six digits and .OF")
    if expected_fund_code is not None and fund_code != expected_fund_code:
        raise response_error(
            f"Alpha history fund_code mismatch: expected {expected_fund_code}, received {fund_code}"
        )

    fund_name = payload.get("fund_name")
    if fund_name is not None and not isinstance(fund_name, str):
        raise response_error("Alpha history fund_name must be a string or null")
    points = payload.get("points")
    if not isinstance(points, list):
        raise response_error("Alpha history response must contain a points array")

    previous_date: date | None = None
    for index, point in enumerate(points):
        if not isinstance(point, dict):
            raise response_error(f"Alpha history points[{index}] must be an object")
        raw_date = point.get("model_date")
        if not isinstance(raw_date, str):
            raise response_error(
                f"Alpha history points[{index}].model_date must be YYYY-MM-DD"
            )
        try:
            model_date = date.fromisoformat(raw_date)
        except ValueError as exc:
            raise response_error(
                f"Alpha history points[{index}].model_date must be YYYY-MM-DD"
            ) from exc
        if previous_date is not None and model_date <= previous_date:
            raise response_error("Alpha history points must be ordered by model_date")
        previous_date = model_date

        if point.get("sample_type") not in ALPHA_SAMPLE_TYPES:
            raise response_error(
                f"Alpha history points[{index}].sample_type is invalid"
            )
        for field in ALPHA_HISTORY_NUMERIC_FIELDS:
            if field not in point:
                raise response_error(
                    f"Alpha history points[{index}] is missing required field {field}"
                )
            value = point[field]
            if value is not None and not is_numeric(value):
                raise response_error(
                    f"Alpha history points[{index}].{field} must be numeric or null"
                )
    return payload


def alpha_history_url(
    fund_code: str,
    *,
    start: str | None,
    end: str | None,
    base_url: str = DEFAULT_ALPHA_URL,
) -> str:
    params: list[tuple[str, str]] = [("fund_code", fund_code)]
    if start is not None:
        params.append(("start", start))
    if end is not None:
        params.append(("end", end))
    return f"{base_url}/history?{urllib.parse.urlencode(params)}"


def fetch_alpha_history(
    fund_code: str,
    *,
    start: str | None,
    end: str | None,
    base_url: str = DEFAULT_ALPHA_URL,
) -> dict[str, object]:
    payload = fetch_json(
        alpha_history_url(
            fund_code,
            start=start,
            end=end,
            base_url=base_url,
        )
    )
    return validate_alpha_history_payload(payload, expected_fund_code=fund_code)


def load_alpha_history(path: Path) -> dict[str, object]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise ApiRequestError(
            {"error": "unable to read Alpha history input", "detail": str(exc)}
        ) from exc
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise response_error("Alpha history input is not valid JSON") from exc

    if isinstance(payload, dict) and payload.get("ok") is True:
        data = payload.get("data")
        if isinstance(data, dict) and isinstance(data.get("series"), list):
            series = data["series"]
            if len(series) != 1:
                raise response_error(
                    "Alpha history input must contain exactly one fund series"
                )
            payload = series[0]
    return validate_alpha_history_payload(payload)
