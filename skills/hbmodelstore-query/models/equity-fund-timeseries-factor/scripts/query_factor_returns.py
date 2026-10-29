#!/usr/bin/env python3
"""Export the model's actual daily factor returns, with complete bounded pagination."""
import argparse
import json
from datetime import date
from pathlib import Path

from query import fetch


def export(start=None, end=None):
    rows = []
    for _ in range(20):
        payload = fetch("factor-returns", {"start": start, "end": end, "limit": 5000})
        rows.extend(payload["rows"])
        if not payload["has_more"]:
            return {**payload, "rows": rows}
        following = payload.get("next_start")
        if not following or (start and following <= start) or not payload.get("as_of"):
            raise ValueError("Invalid factor-return pagination")
        start, end = following, payload["as_of"]
    raise ValueError("Factor return history exceeds export limit")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", type=date.fromisoformat)
    parser.add_argument("--end", type=date.fromisoformat)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.start and args.end and args.start > args.end:
        parser.error("start must not exceed end")
    payload = export(str(args.start) if args.start else None, str(args.end) if args.end else None)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, allow_nan=False), encoding="utf-8")
    print(args.output.resolve())


if __name__ == "__main__":
    main()
