#!/usr/bin/env python3
"""Render a complete history snapshot offline with the website's shared renderer."""

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from public_data import load_json, unwrap

NUMBERS = (
    "alpha_annual",
    "beta_mkt",
    "beta_smb_ep",
    "beta_vmg_ep",
    "beta_mom",
    "beta_credit",
    "beta_cb",
    "r2",
    "n_train",
)


def load(path):
    payload = load_json(path)
    if payload.get("ok") is True:
        payload = payload["data"]
    if (
        payload.get("model_key") != "equity-fund-timeseries-factor"
        or payload.get("return_unit") != "decimal"
    ):
        raise ValueError("Expected equity-factor history with decimal returns")
    if payload.get("has_more") is not False or payload.get("next_start") is not None:
        raise ValueError("Incomplete history: fetch all pages before plotting")
    code = payload.get("fund_code", "")
    if not re.fullmatch(r"\d{6}(?:!\d+)?\.OF", code):
        raise ValueError("Expected an exact primary share identity")
    rows = payload.get("rows", [])
    if not rows:
        raise ValueError("No model results to plot")
    days = [row["model_date"] for row in rows]
    if days != sorted(set(days)):
        raise ValueError("Model days must be unique and ascending")
    factor_dates = payload.get("factor_dates", [])
    if factor_dates != sorted(set(factor_dates)):
        raise ValueError("Factor dates must be unique and ascending")
    for day in factor_dates:
        date.fromisoformat(day)
    for row in rows:
        if row["code"] != code:
            raise ValueError("Mixed fund identities")
        for key in ("model_date", "train_start", "train_end", "report_date"):
            date.fromisoformat(row[key])
        for key in NUMBERS:
            if type(row[key]) not in (int, float):
                raise ValueError(f"Non-numeric {key}")
        if row.get("return_252") is not None and type(row["return_252"]) not in (int, float):
            raise ValueError("Non-numeric return_252")
        if not isinstance(row["cb_enabled"], bool):
            raise ValueError("Missing CB gate")
    json.dumps(payload, allow_nan=False)
    return payload


def render(payload, comparison=None, chart="performance", mode="value"):
    peers = payload.get("alpha_peer_history")
    if chart == "alpha-peer" and not peers:
        raise ValueError("Alpha comparison requires history --with-alpha-peers")
    if peers:
        if (
            peers.get("fund_code") != payload["fund_code"]
            or peers.get("has_more") is not False
            or peers.get("next_start") is not None
            or peers.get("return_unit") != "decimal"
            or [(r["model_date"], r["alpha_annual"]) for r in peers["rows"]]
            != [(r["model_date"], r["alpha_annual"]) for r in payload["rows"]]
        ):
            raise ValueError("Expected complete, matching Alpha peer history")
        for row in peers["rows"]:
            if not (
                row["p25"] <= row["median"] <= row["p75"]
                and 0 <= row["percentile"] <= 1
                and row["sample_count"] > 0
            ):
                raise ValueError("Invalid Alpha peer distribution")
    if chart == "style-position" and comparison is None:
        raise ValueError("Style position requires --comparison")
    if comparison is not None:
        comparison = unwrap(comparison)
        latest = payload["rows"][-1]
        if (
            comparison.get("model_date") != latest["model_date"]
            or comparison.get("target", {}).get("code") != payload["fund_code"]
        ):
            raise ValueError("Comparison must match the history fund and latest model date")
        if not isinstance(comparison.get("category_factor_positions"), dict):
            raise ValueError("Comparison is missing category factor positions")
    root = Path(__file__).resolve().parents[1]
    stylesheet = (root.parents[1] / "assets/preview.css").read_text(encoding="utf-8")
    runtime = (root.parents[1] / "assets/echarts-6.1.0.min.js").read_text()
    renderer = (root / "assets/equity-renderer.mjs").read_text().replace("export ", "")
    data = json.dumps(payload, ensure_ascii=False, allow_nan=False).replace("<", "\\u003c")
    return (
        """<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>含权基金 Alpha 与252日收益</title>
<style>"""
        + stylesheet
        + """</style><body class="hb-preview"><main>
<div id="preview"></div><div id="style"></div></main><script>"""
        + runtime
        + "</script><script>"
        + renderer
        + "\n"
        + (
            "renderEquityHistory({echarts,root:document.getElementById('preview'),payload:"
            + data
            + ",field:"
            + json.dumps({"alpha": "alpha_annual", "return": "return_252"}.get(chart, "all"))
            + ",peerOnly:"
            + json.dumps(chart == "alpha-peer")
            + ",mode:"
            + json.dumps(mode)
            + "});"
            if chart != "style-position"
            else ""
        )
        + (
            "renderEquityStyle({echarts,root:document.getElementById('style'),payload:"
            + json.dumps(comparison, ensure_ascii=False, allow_nan=False).replace("<", "\\u003c")
            + "});"
            if chart == "style-position"
            else ""
        )
        + "</script></body></html>"
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument(
        "--comparison", type=Path, help="Same-date comparison export for style positioning"
    )
    parser.add_argument(
        "--chart",
        choices=["performance", "alpha", "return", "alpha-peer", "style-position"],
        default="performance",
    )
    parser.add_argument("--mode", choices=["value", "percentile"], default="value")
    args = parser.parse_args()
    payload = load(args.input)
    if args.output.resolve() in {p.resolve() for p in (args.input, args.comparison) if p}:
        parser.error("Output must not overwrite the input snapshot")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    comparison = load_json(args.comparison) if args.comparison else None
    args.output.write_text(render(payload, comparison, args.chart, args.mode), encoding="utf-8")
    print(args.output.resolve())


if __name__ == "__main__":
    main()
