#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.parse
from datetime import date

from bond_fund_data import (
    ApiRequestError,
    fetch_json,
)
from bond_fund_data import (
    fetch_alpha_history as fetch_alpha_history_data,
)

MODEL_ROOT_URL = (
    "https://api.delirium.com.cn/models/bond-fund-timeseries-factor"
)
FUND_SEARCH_URL = f"{MODEL_ROOT_URL}/funds"
MODEL_URL = f"{MODEL_ROOT_URL}/modified-duration"
DISCLOSED_DURATION_URL = (
    "https://api.delirium.com.cn/models/"
    "bond-fund-timeseries-factor/disclosed-duration"
)
ALPHA_URL = (
    "https://api.delirium.com.cn/models/"
    "bond-fund-timeseries-factor/alpha"
)
FUND_CODE = re.compile(r"^[0-9]{6}(?:\.OF)?$", re.IGNORECASE)
MEDIAN_BREAKDOWNS = {
    "fund-invest-type": "fund_invest_type",
    "sample-type": "sample_type",
    "sample-type-and-fund-type": "sample_type_and_fund_invest_type",
}
HISTORY_FIELDS = (
    "estimated_modified_duration",
    "sample_type",
    "beta_0",
    "beta_1",
    "beta_3",
    "beta_10",
    "beta_30",
    "gamma_policy",
    "gamma_secondary",
    "gamma_high_grade_credit",
    "gamma_low_grade_credit",
)
ALPHA_SAMPLE_TYPES = {
    "rate": "利率债基金",
    "credit": "信用债基金",
}
MODEL_RESULT_TYPES = {
    "modified-duration": "modified_duration",
    "alpha": "alpha",
}


def fund_codes(value: str) -> tuple[str, ...]:
    values = [item.strip() for item in value.split(",")]
    if not values or any(not item for item in values):
        raise argparse.ArgumentTypeError(
            "fund codes must be comma-separated six-digit codes with optional .OF"
        )

    normalized: list[str] = []
    for item in values:
        if not FUND_CODE.fullmatch(item):
            raise argparse.ArgumentTypeError(
                "fund codes must be comma-separated six-digit codes with optional .OF"
            )
        code = f"{item[:6]}.OF"
        if code not in normalized:
            normalized.append(code)
    if len(normalized) > 20:
        raise argparse.ArgumentTypeError("at most 20 fund codes may be queried at once")
    return tuple(normalized)


def iso_date(value: str) -> str:
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError as exc:
        raise argparse.ArgumentTypeError("date must use YYYY-MM-DD") from exc


def unit_weight(value: str) -> float:
    try:
        weight = float(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("weight must be a number from 0 to 1") from exc
    if not 0 <= weight <= 1:
        raise argparse.ArgumentTypeError("weight must be a number from 0 to 1")
    return weight


def search_limit(value: str) -> int:
    try:
        limit = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("limit must be an integer from 1 to 20") from exc
    if not 1 <= limit <= 20:
        raise argparse.ArgumentTypeError("limit must be an integer from 1 to 20")
    return limit


def search_offset(value: str) -> int:
    try:
        offset = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(
            "offset must be an integer from 0 to 5000"
        ) from exc
    if not 0 <= offset <= 5000:
        raise argparse.ArgumentTypeError("offset must be an integer from 0 to 5000")
    return offset


def history_fields(value: str) -> tuple[str, ...]:
    fields = tuple(dict.fromkeys(item.strip() for item in value.split(",")))
    if not fields or any(not item for item in fields):
        raise argparse.ArgumentTypeError("fields must be a comma-separated list")
    unknown = [field for field in fields if field not in HISTORY_FIELDS]
    if unknown:
        raise argparse.ArgumentTypeError(
            "unknown history fields: " + ", ".join(unknown)
        )
    return fields


def fetch(
    endpoint: str,
    params: list[tuple[str, str]],
    *,
    base_url: str = MODEL_URL,
) -> object:
    query = urllib.parse.urlencode(params)
    url = f"{base_url}/{endpoint}"
    if query:
        url = f"{url}?{query}"
    return fetch_json(url, timeout=20)


def print_error(exc: ApiRequestError, *, fund_code: str | None = None) -> None:
    payload: dict[str, object] = {"ok": False}
    if fund_code is not None:
        payload["fund_code"] = fund_code
    payload.update(exc.details)
    print(json.dumps(payload, ensure_ascii=False), file=sys.stderr)


def request(
    endpoint: str,
    params: list[tuple[str, str]],
    *,
    base_url: str = MODEL_URL,
) -> int:
    try:
        payload = fetch(endpoint, params, base_url=base_url)
    except ApiRequestError as exc:
        print_error(exc)
        return 1
    print(json.dumps({"ok": True, "data": payload}, ensure_ascii=False, default=str))
    return 0


def request_history(
    fund_codes: tuple[str, ...],
    start: str | None,
    end: str | None,
    fields: tuple[str, ...] | None,
) -> int:
    series: list[object] = []
    for code in fund_codes:
        params = [("fund_code", code)]
        if start is not None:
            params.append(("start", start))
        if end is not None:
            params.append(("end", end))
        if fields is not None:
            params.extend(("fields", field) for field in fields)
        try:
            series.append(fetch("history", params))
        except ApiRequestError as exc:
            print_error(exc, fund_code=code)
            return 1

    print(
        json.dumps(
            {"ok": True, "data": {"series": series}},
            ensure_ascii=False,
            default=str,
        )
    )
    return 0


def add_combined_alpha_score(payload: object, alpha_weight: float) -> object:
    if not isinstance(payload, dict):
        return payload
    recent_weight = 1.0 - alpha_weight
    result = dict(payload)
    result["derived_score_weights"] = {
        "alpha_rank": alpha_weight,
        "recent_state_rank": recent_weight,
    }
    collection_name = "rows" if "rows" in result else "points"
    collection = result.get(collection_name)
    if not isinstance(collection, list):
        return result
    derived_collection: list[object] = []
    for item in collection:
        if not isinstance(item, dict):
            derived_collection.append(item)
            continue
        derived_item = dict(item)
        alpha_rank = derived_item.get("alpha_rank")
        recent_rank = derived_item.get("recent_state_rank")
        if alpha_rank is None or recent_rank is None:
            derived_item["combined_score"] = None
        else:
            derived_item["combined_score"] = round(
                alpha_weight * float(alpha_rank) + recent_weight * float(recent_rank),
                12,
            )
        derived_collection.append(derived_item)
    if collection_name == "rows":
        derived_collection.sort(key=combined_alpha_sort_key)
    result[collection_name] = derived_collection
    return result


def combined_alpha_sort_key(item: object) -> tuple[int, float, str]:
    if not isinstance(item, dict):
        return (1, 0.0, "")
    fund_code = str(item.get("fund_code") or "")
    score = item.get("combined_score")
    if score is None:
        return (1, 0.0, fund_code)
    try:
        return (0, -float(score), fund_code)
    except (TypeError, ValueError):
        return (1, 0.0, fund_code)


def request_alpha_cross_section(
    model_date: str | None,
    sample_type: str | None,
    duration_bucket: int | None,
    alpha_weight: float | None,
) -> int:
    params: list[tuple[str, str]] = []
    if model_date is not None:
        params.append(("date", model_date))
    if sample_type is not None:
        params.append(("sample_type", ALPHA_SAMPLE_TYPES[sample_type]))
    if duration_bucket is not None:
        params.append(("duration_bucket", str(duration_bucket)))
    try:
        payload = fetch("cross-section", params, base_url=ALPHA_URL)
    except ApiRequestError as exc:
        print_error(exc)
        return 1
    if alpha_weight is not None:
        payload = add_combined_alpha_score(payload, alpha_weight)
    print(json.dumps({"ok": True, "data": payload}, ensure_ascii=False, default=str))
    return 0


def request_alpha_history(
    codes: tuple[str, ...],
    start: str | None,
    end: str | None,
    alpha_weight: float | None,
) -> int:
    series: list[object] = []
    for code in codes:
        try:
            payload = fetch_alpha_history_data(
                code,
                start=start,
                end=end,
                base_url=ALPHA_URL,
            )
        except ApiRequestError as exc:
            print_error(exc, fund_code=code)
            return 1
        if alpha_weight is not None:
            payload = add_combined_alpha_score(payload, alpha_weight)
        series.append(payload)
    print(
        json.dumps(
            {"ok": True, "data": {"series": series}},
            ensure_ascii=False,
            default=str,
        )
    )
    return 0


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(
        description="Query published bond-fund duration and Alpha results"
    )
    commands = result.add_subparsers(dest="command", required=True)

    search_funds = commands.add_parser(
        "search-funds",
        help="search funds whose latest model date is within two years, with bounded pagination",
    )
    search_funds.add_argument("--query", required=True)
    search_funds.add_argument("--limit", type=search_limit, default=10)
    search_funds.add_argument("--offset", type=search_offset, default=0)

    cross_section = commands.add_parser(
        "cross-section",
        help="query all funds for an exact model date or the latest date",
    )
    cross_section.add_argument("--date", type=iso_date)

    history = commands.add_parser(
        "history",
        help="query one or more funds' history with optional date bounds",
    )
    history.add_argument(
        "--fund-code",
        required=True,
        type=fund_codes,
        help="one or more comma-separated fund codes",
    )
    history.add_argument("--start", type=iso_date)
    history.add_argument("--end", type=iso_date)
    history.add_argument(
        "--fields",
        type=history_fields,
        help=(
            "comma-separated response fields; defaults to "
            "estimated_modified_duration"
        ),
    )

    median = commands.add_parser(
        "median",
        help="query pure-bond-fund modified-duration median history",
    )
    median.add_argument("--start", type=iso_date)
    median.add_argument("--end", type=iso_date)
    median.add_argument(
        "--breakdown",
        choices=tuple(MEDIAN_BREAKDOWNS),
        default="sample-type",
        help="group by fund type, asset type, or their cross-classification",
    )

    disclosed_history = commands.add_parser(
        "disclosed-history",
        help="query one fund's sparse historical disclosed duration observations",
    )
    disclosed_history.add_argument(
        "--fund-code",
        required=True,
        type=fund_codes,
        help="one fund code with optional .OF suffix",
    )
    disclosed_history.add_argument("--start", type=iso_date)
    disclosed_history.add_argument("--end", type=iso_date)

    alpha_cross_section = commands.add_parser(
        "alpha-cross-section",
        help="query 240-day Alpha and frozen 60-day residual-state cross-section",
    )
    alpha_cross_section.add_argument("--date", type=iso_date)
    alpha_cross_section.add_argument(
        "--sample-type",
        choices=tuple(ALPHA_SAMPLE_TYPES),
        help="optionally keep rate or credit bond funds",
    )
    alpha_cross_section.add_argument("--duration-bucket", type=int, choices=range(1, 6))
    alpha_cross_section.add_argument(
        "--alpha-weight",
        type=unit_weight,
        help=(
            "optionally derive combined_score from alpha_rank and recent_state_rank; "
            "the recent-state weight is 1 minus this value"
        ),
    )

    alpha_history = commands.add_parser(
        "alpha-history",
        help="query one or more funds' 240-day Alpha and frozen 60-day state history",
    )
    alpha_history.add_argument(
        "--fund-code",
        required=True,
        type=fund_codes,
        help="one or more comma-separated fund codes",
    )
    alpha_history.add_argument("--start", type=iso_date)
    alpha_history.add_argument("--end", type=iso_date)
    alpha_history.add_argument(
        "--alpha-weight",
        type=unit_weight,
        help=(
            "optionally derive combined_score from alpha_rank and recent_state_rank; "
            "the recent-state weight is 1 minus this value"
        ),
    )
    model_dates = commands.add_parser(
        "model-dates",
        help="query every published date available for one result type",
    )
    model_dates.add_argument(
        "--result-type",
        required=True,
        choices=tuple(MODEL_RESULT_TYPES),
        help="query modified-duration or alpha dates",
    )
    return result


def main() -> int:
    args = parser().parse_args()
    if args.command == "search-funds":
        query = args.query.strip()
        if not query:
            parser().error("--query must not be blank")
        return request(
            "search",
            [
                ("q", query),
                ("limit", str(args.limit)),
                ("offset", str(args.offset)),
            ],
            base_url=FUND_SEARCH_URL,
        )
    if args.command == "cross-section":
        params = [] if args.date is None else [("date", args.date)]
        return request("cross-section", params)

    if args.command == "alpha-cross-section":
        return request_alpha_cross_section(
            args.date,
            args.sample_type,
            args.duration_bucket,
            args.alpha_weight,
        )

    if args.command == "model-dates":
        return request(
            "model-dates",
            [("result_type", MODEL_RESULT_TYPES[args.result_type])],
            base_url=MODEL_ROOT_URL,
        )

    if args.start is not None and args.end is not None and args.end < args.start:
        parser().error("--end must not be earlier than --start")
    if args.command == "median":
        params = [("breakdown", MEDIAN_BREAKDOWNS[args.breakdown])]
        if args.start is not None:
            params.append(("start", args.start))
        if args.end is not None:
            params.append(("end", args.end))
        return request("median-history", params)
    if args.command == "disclosed-history":
        if len(args.fund_code) != 1:
            parser().error("disclosed-history accepts exactly one fund code")
        params = [("fund_code", args.fund_code[0])]
        if args.start is not None:
            params.append(("start", args.start))
        if args.end is not None:
            params.append(("end", args.end))
        return request("history", params, base_url=DISCLOSED_DURATION_URL)
    if args.command == "alpha-history":
        return request_alpha_history(
            args.fund_code,
            args.start,
            args.end,
            args.alpha_weight,
        )
    return request_history(args.fund_code, args.start, args.end, args.fields)


if __name__ == "__main__":
    raise SystemExit(main())
