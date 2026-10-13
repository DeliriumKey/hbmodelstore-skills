#!/usr/bin/env python3
"""Export bounded public queries; ordinary interactive queries use native MCP."""

import argparse
import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from public_data import fetch_json

BASE = "https://api.delirium.com.cn/models/equity-fund-timeseries-factor"


def fetch(endpoint, params):
    query = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
    return fetch_json(f"{BASE}/{endpoint}?{query}", timeout=45)


def export_history(code, start=None, end=None):
    if not end:
        end = fetch("info", {}).get("end_date")
    rows = []
    factor_dates = set()
    for _ in range(20):
        payload = fetch("history", {"fund_code": code, "start": start, "end": end, "limit": 5000})
        rows.extend(payload["rows"])
        factor_dates.update(payload.get("factor_dates", []))
        if not payload["has_more"]:
            return {**payload, "rows": rows, "factor_dates": sorted(factor_dates)}
        following = payload.get("next_start")
        if not following or (start and following <= start):
            raise ValueError("Invalid history pagination cursor")
        start = following
    raise ValueError("History exceeds export limit; narrow the date range")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    history = commands.add_parser("history")
    history.add_argument("--fund-code", required=True, help="Exact primary code; preserve !1")
    history.add_argument("--start", type=date.fromisoformat)
    history.add_argument("--end", type=date.fromisoformat)
    cross = commands.add_parser("cross-section")
    cross.add_argument("--date", type=date.fromisoformat)
    cross.add_argument("--category")
    cross.add_argument(
        "--sort",
        choices=["alpha_annual", "beta_mkt", "beta_cb", "r2", "n_train"],
        default="alpha_annual",
    )
    cross.add_argument("--order", choices=["asc", "desc"], default="desc")
    cross.add_argument("--limit", type=int, default=20)
    cross.add_argument("--offset", type=int, default=0)
    comparison = commands.add_parser("comparison")
    comparison.add_argument("--fund-code", required=True)
    comparison.add_argument("--date", type=date.fromisoformat)
    comparison.add_argument("--peers", type=int, choices=range(5, 11), default=5)
    for sub in (history, cross, comparison):
        sub.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.command in {"history", "comparison"} and not re.fullmatch(
        r"\d{6}(?:!\d+)?(?:\.OF)?", args.fund_code, re.IGNORECASE
    ):
        parser.error("Invalid primary fund code")
    if args.command == "comparison":
        payload = fetch(
            "comparison",
            {
                "fund_code": args.fund_code,
                "date": args.date,
                "peers": args.peers,
            },
        )
    elif args.command == "history":
        if args.start and args.end and args.start > args.end:
            parser.error("start must not exceed end")
        payload = export_history(
            args.fund_code,
            str(args.start) if args.start else None,
            str(args.end) if args.end else None,
        )
    else:
        if not 1 <= args.limit <= 200 or not 0 <= args.offset <= 100000:
            parser.error("Invalid page bounds")
        payload = fetch(
            "cross-section",
            {
                "date": args.date,
                "category": args.category,
                "sort": args.sort,
                "order": args.order,
                "limit": args.limit,
                "offset": args.offset,
            },
        )
    # Only write after a complete successful response; no partial snapshot on network failure.
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, allow_nan=False), encoding="utf-8"
    )
    print(args.output.resolve())


if __name__ == "__main__":
    main()
