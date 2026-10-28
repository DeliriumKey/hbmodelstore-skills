#!/usr/bin/env python3
"""Export bounded public queries; ordinary interactive queries use native MCP."""

import argparse
import json
import re
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from public_data import api_url, fetch_json, load_json

BASE = api_url("/models/equity-fund-timeseries-factor")


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


def export_alpha_peers(history):
    if not history["rows"]:
        return history
    start = history["rows"][0]["model_date"]
    rows = []
    for _ in range(20):
        peers = fetch(
            "alpha-peer-history",
            {
                "fund_code": history["fund_code"],
                "start": start,
                "end": history["rows"][-1]["model_date"],
                "limit": 5000,
            },
        )
        if peers.get("fund_code") != history["fund_code"]:
            raise ValueError("Unexpected identity in Alpha peer history")
        rows.extend(peers["rows"])
        if not peers.get("has_more"):
            if [(r["model_date"], r["alpha_annual"]) for r in rows] != [
                (r["model_date"], r["alpha_annual"]) for r in history["rows"]
            ]:
                raise ValueError("Fund/Alpha peer history changed or is incomplete; retry query")
            return {**history, "alpha_peer_history": {**peers, "rows": rows}}
        following = peers.get("next_start")
        if not following or following <= start:
            raise ValueError("Invalid Alpha peer pagination cursor")
        start = following
    raise ValueError("Alpha peer history exceeds export limit")


def export_style_map(code, end=None, history=None):
    history = history if history is not None else export_history(code, end=end)
    normalized = code.upper() if code.upper().endswith(".OF") else code.upper() + ".OF"
    if (
        history.get("fund_code") != normalized
        or not history.get("rows")
        or history.get("has_more") is not False
        or history.get("next_start") is not None
    ):
        raise ValueError("Expected complete history of the exact requested fund")
    latest = history["rows"][-1]
    if end and latest["model_date"] > end:
        raise ValueError("Saved history exceeds the requested end date")

    def page(offset):
        return fetch(
            "cross-section",
            {
                "date": latest["model_date"],
                "category": latest["category"],
                "limit": 200,
                "offset": offset,
            },
        )

    first = page(0)
    if not 0 < first["total"] <= 10000:
        raise ValueError("Category snapshot is empty or exceeds 10000 funds")
    with ThreadPoolExecutor(max_workers=4) as pool:
        pages = [first, *pool.map(page, range(200, first["total"], 200))]
    if any(
        p["total"] != first["total"]
        or p["model_date"] != latest["model_date"]
        or p["category"] != latest["category"]
        for p in pages
    ):
        raise ValueError("Category snapshot changed while paginating")
    rows = [row for p in pages for row in p["rows"]]
    if len(rows) != first["total"] or len({r["code"] for r in rows}) != len(rows):
        raise ValueError("Incomplete or duplicated category snapshot")
    peer_rows = []
    start = history["rows"][0]["model_date"]
    for _ in range(20):
        result = fetch(
            "exposure-peer-history",
            {
                "fund_code": normalized,
                "start": start,
                "end": latest["model_date"],
                "frequency": "daily",
                "limit": 5000,
            },
        )
        if result.get("fund_code") != normalized or result.get("frequency") != "daily":
            raise ValueError("Unexpected fund or frequency in peer history")
        peer_rows.extend(result["rows"])
        if not result.get("has_more"):
            break
        following = result.get("next_start")
        if not following or following <= start:
            raise ValueError("Invalid peer history pagination cursor")
        start = following
    else:
        raise ValueError("Peer history exceeds export limit")
    if len(peer_rows) != len(history["rows"]):
        raise ValueError("Fund/peer history changed or is incomplete")
    peer_history = {**result, "rows": peer_rows}
    return {
        "model_key": "equity-fund-timeseries-factor",
        "history": history,
        "cross_section": {**first, "rows": rows, "has_more": False},
        "peer_history": peer_history,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    history = commands.add_parser("history")
    history.add_argument("--fund-code", required=True, help="Exact primary code; preserve !1")
    history.add_argument("--start", type=date.fromisoformat)
    history.add_argument("--end", type=date.fromisoformat)
    history.add_argument(
        "--with-alpha-peers",
        action="store_true",
        help="Include daily Alpha quartiles and percentile for the full component",
    )
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
    style_map = commands.add_parser("style-map")
    style_map.add_argument("--fund-code", required=True)
    style_map.add_argument("--end", type=date.fromisoformat)
    style_map.add_argument("--history", type=Path, help="Reuse a complete saved history response")
    for sub in (history, cross, comparison, style_map):
        sub.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.command in {"history", "comparison", "style-map"} and not re.fullmatch(
        r"\d{6}(?:!\d+)?(?:\.OF)?", args.fund_code, re.IGNORECASE
    ):
        parser.error("Invalid primary fund code")
    if args.command == "style-map":
        payload = export_style_map(
            args.fund_code,
            str(args.end) if args.end else None,
            load_json(args.history) if args.history else None,
        )
    elif args.command == "comparison":
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
        if args.with_alpha_peers:
            payload = export_alpha_peers(payload)
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
