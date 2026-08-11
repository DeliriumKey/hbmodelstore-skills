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

MODEL_URL = "https://api.delirium.com.cn/models/bond-fund-duration"
FUND_CODE = re.compile(r"^[0-9]{6}(?:\.OF)?$", re.IGNORECASE)


def fund_code(value: str) -> str:
    if not FUND_CODE.fullmatch(value):
        raise argparse.ArgumentTypeError("fund code must be six digits with optional .OF")
    return value.upper()


def iso_date(value: str) -> str:
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError as exc:
        raise argparse.ArgumentTypeError("date must use YYYY-MM-DD") from exc


def request(endpoint: str, params: list[tuple[str, str]]) -> int:
    url = f"{MODEL_URL}/{endpoint}?{urllib.parse.urlencode(params)}"
    try:
        with urllib.request.urlopen(url, timeout=20) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        print(json.dumps({"ok": False, "status": exc.code, "detail": detail}), file=sys.stderr)
        return 1
    except (urllib.error.URLError, TimeoutError) as exc:
        error = exc.reason if hasattr(exc, "reason") else exc
        print(json.dumps({"ok": False, "error": str(error)}), file=sys.stderr)
        return 1
    print(json.dumps({"ok": True, "data": payload}, ensure_ascii=False, default=str))
    return 0


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description="Query the bond fund duration model")
    commands = result.add_subparsers(dest="command", required=True)

    latest = commands.add_parser("latest")
    latest.add_argument("--fund-code", action="append", required=True, type=fund_code)

    history = commands.add_parser("history")
    history.add_argument("--fund-code", required=True, type=fund_code)
    history.add_argument("--start", required=True, type=iso_date)
    history.add_argument("--end", required=True, type=iso_date)
    history.add_argument("--limit", type=int, choices=range(1, 2501), default=2500)

    cross = commands.add_parser("cross-section")
    cross.add_argument("--mode", choices=("summary", "high"), default="summary")
    cross.add_argument("--sample-type", choices=("利率债基金", "信用债基金"))
    cross.add_argument("--limit", type=int, choices=range(1, 201), default=50)
    return result


def main() -> int:
    args = parser().parse_args()
    if args.command == "latest":
        return request("latest", [("fund_code", value) for value in args.fund_code])
    if args.command == "history":
        if args.end < args.start:
            parser().error("--end must not be earlier than --start")
        return request(
            "history",
            [
                ("fund_code", args.fund_code),
                ("start", args.start),
                ("end", args.end),
                ("limit", str(args.limit)),
            ],
        )
    if args.mode == "high" and args.sample_type is None:
        parser().error("--sample-type is required when --mode high")
    if args.mode == "summary" and args.sample_type is not None:
        parser().error("--sample-type is only valid when --mode high")
    params = [("mode", args.mode), ("limit", str(args.limit))]
    if args.sample_type:
        params.append(("sample_type", args.sample_type))
    return request("cross-section", params)


if __name__ == "__main__":
    raise SystemExit(main())
