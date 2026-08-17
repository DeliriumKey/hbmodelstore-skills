#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date

MODEL_URL = (
    "https://api.delirium.com.cn/models/"
    "bond-fund-timeseries-factor/modified-duration"
)
FUND_CODE = re.compile(r"^[0-9]{6}(?:\.OF)?$", re.IGNORECASE)
MEDIAN_BREAKDOWNS = {
    "sample-type": "sample_type",
    "sample-type-and-fund-type": "sample_type_and_fund_invest_type",
}


class ApiRequestError(Exception):
    def __init__(self, details: dict[str, object]) -> None:
        super().__init__(str(details))
        self.details = details


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
    return tuple(normalized)


def iso_date(value: str) -> str:
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError as exc:
        raise argparse.ArgumentTypeError("date must use YYYY-MM-DD") from exc


def fetch(endpoint: str, params: list[tuple[str, str]]) -> object:
    query = urllib.parse.urlencode(params)
    url = f"{MODEL_URL}/{endpoint}"
    if query:
        url = f"{url}?{query}"
    try:
        with urllib.request.urlopen(url, timeout=20) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise ApiRequestError({"status": exc.code, "detail": detail}) from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        error = exc.reason if hasattr(exc, "reason") else exc
        raise ApiRequestError({"error": str(error)}) from exc


def print_error(exc: ApiRequestError, *, fund_code: str | None = None) -> None:
    payload: dict[str, object] = {"ok": False}
    if fund_code is not None:
        payload["fund_code"] = fund_code
    payload.update(exc.details)
    print(json.dumps(payload, ensure_ascii=False), file=sys.stderr)


def request(endpoint: str, params: list[tuple[str, str]]) -> int:
    try:
        payload = fetch(endpoint, params)
    except ApiRequestError as exc:
        print_error(exc)
        return 1
    print(json.dumps({"ok": True, "data": payload}, ensure_ascii=False, default=str))
    return 0


def request_history(
    fund_codes: tuple[str, ...], start: str | None, end: str | None
) -> int:
    series: list[object] = []
    for code in fund_codes:
        params = [("fund_code", code)]
        if start is not None:
            params.append(("start", start))
        if end is not None:
            params.append(("end", end))
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


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(
        description="Query published bond-fund estimated modified durations"
    )
    commands = result.add_subparsers(dest="command", required=True)

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
        help="group by model sample type, optionally split by pure-bond fund type",
    )
    return result


def main() -> int:
    args = parser().parse_args()
    if args.command == "cross-section":
        params = [] if args.date is None else [("date", args.date)]
        return request("cross-section", params)

    if args.start is not None and args.end is not None and args.end < args.start:
        parser().error("--end must not be earlier than --start")
    if args.command == "median":
        params = [("breakdown", MEDIAN_BREAKDOWNS[args.breakdown])]
        if args.start is not None:
            params.append(("start", args.start))
        if args.end is not None:
            params.append(("end", args.end))
        return request("median-history", params)
    return request_history(args.fund_code, args.start, args.end)


if __name__ == "__main__":
    raise SystemExit(main())
