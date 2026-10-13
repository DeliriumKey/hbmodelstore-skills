#!/usr/bin/env python3
"""Export complete bounded issuance tables through the public read-only API."""

import argparse
import json
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from public_data import fetch_json

BASE = "https://api.delirium.com.cn/models/new-issue-return"
STARTS = {"hs": "2023-04-10", "bse": "2021-11-15", "reits": "2021-06-21"}


def fetch(endpoint, params):
    url = BASE + "/" + endpoint + "?" + urllib.parse.urlencode(params)
    return fetch_json(url, timeout=45)


def export_tables(start=None, end=None):
    info = fetch("info", {})
    tables = {}
    for market, beginning in STARTS.items():
        rows, offset = [], 0
        for _ in range(21):
            params = {"start": start or beginning, "limit": 500, "offset": offset}
            if end:
                params["end"] = end
            page = fetch(market, params)
            rows.extend(page["rows"])
            following = page["next_offset"]
            if following is None:
                break
            if not isinstance(following, int) or following <= offset or following > 10000:
                raise ValueError("Invalid or oversized pagination; narrow the interval")
            offset = following
        else:
            raise ValueError("Export exceeds the bounded query surface")
        if len({r["issue_id"] for r in rows}) != len(rows):
            raise ValueError("Duplicate issuance identity; no partial export written")
        tables[market] = rows
    return {"model_key": "new-issue-return", "info": info, "tables": tables}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", type=date.fromisoformat)
    parser.add_argument("--end", type=date.fromisoformat)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.start and args.end and args.start > args.end:
        parser.error("start must not exceed end")
    result = export_tables(
        str(args.start) if args.start else None, str(args.end) if args.end else None
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(result, ensure_ascii=False, allow_nan=False), encoding="utf-8"
    )
    print(args.output.resolve())


if __name__ == "__main__":
    main()
