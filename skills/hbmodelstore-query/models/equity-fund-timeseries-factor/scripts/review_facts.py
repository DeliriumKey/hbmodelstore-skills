#!/usr/bin/env python3
"""Offline history evidence; same-category math belongs to the comparison API."""

import argparse
import json
import math
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from public_data import load_json


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def read_snapshot(path):
    payload = load_json(path)
    if not isinstance(payload, dict) or not isinstance(payload.get("rows"), list):
        raise ValueError("Expected an exported snapshot with rows")
    if payload.get("has_more") or payload.get("next_start"):
        raise ValueError("Finish pagination before analysis")
    if payload.get("return_unit", "decimal") != "decimal":
        raise ValueError("Expected decimal returns")
    return payload


def history_facts(payload):
    if payload.get("has_more") or payload.get("next_start"):
        raise ValueError("Incomplete history")
    rows = sorted(payload["rows"], key=lambda row: row["model_date"])
    if not rows:
        raise ValueError("Empty history")
    codes = {row["code"] for row in rows}
    dates = [row["model_date"] for row in rows]
    if len(codes) != 1 or len(set(dates)) != len(dates):
        raise ValueError("History must contain one identity and unique model dates")
    for value in dates:
        date.fromisoformat(value)
    latest = rows[-1]
    valid = [row for row in rows if finite(row.get("alpha_annual"))]
    value = latest.get("alpha_annual")
    rank = None
    if finite(value):
        higher = sorted(
            (row for row in valid if row["alpha_annual"] > value),
            key=lambda row: (-row["alpha_annual"], row["model_date"]),
        )
        rank = {
            "value": value,
            "valid_records": len(valid),
            "strictly_higher_count": len(higher),
            "equal_count": sum(row["alpha_annual"] == value for row in valid),
            "descending_rank": 1 + len(higher),
            "higher_examples": [
                {key: row[key] for key in ("model_date", "alpha_annual")} for row in higher[:5]
            ],
        }
    return {
        "code": latest["code"],
        "start_date": dates[0],
        "end_date": dates[-1],
        "history_records": len(rows),
        "latest_alpha_history_rank": rank,
        "latest_return_252": latest.get("return_252"),
    }, latest


def attach_comparison(result, latest, payload):
    if payload.get("model_key") != "equity-fund-timeseries-factor":
        raise ValueError("Expected equity comparison response")
    if payload.get("return_unit") != "decimal" or payload.get("percentile_unit") != "fraction":
        raise ValueError("Unexpected comparison units")
    if payload.get("model_date") != latest["model_date"]:
        raise ValueError("Comparison date must match the selected history endpoint")
    if payload.get("category") != latest["category"]:
        raise ValueError("Comparison category differs from the history endpoint")
    target = payload.get("target", {})
    if any(target.get(key) != latest.get(key) for key in ("code", "model_version", "spec_id")):
        raise ValueError("Comparison identity or model specification differs")
    return {**result, "comparison": payload}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--history", type=Path, required=True)
    parser.add_argument("--comparison", type=Path, help="Saved comparison API/MCP response")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result, latest = history_facts(read_snapshot(args.history))
    if args.comparison:
        result = attach_comparison(result, latest, load_json(args.comparison))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False))
    print(args.output.resolve())


if __name__ == "__main__":
    main()
