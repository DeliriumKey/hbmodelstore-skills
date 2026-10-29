#!/usr/bin/env python3
"""Render market factor returns with the same implementation as the website."""

import argparse
import json
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from public_data import load_json


def render(payload, unit="all", start=None, end=None):
    if (
        payload.get("model_key") != "equity-fund-timeseries-factor"
        or payload.get("return_unit") != "decimal"
        or payload.get("has_more") is not False
        or payload.get("next_start") is not None
        or not payload.get("rows")
    ):
        raise ValueError("Complete factor-return history is required")
    root = Path(__file__).resolve().parents[1]
    assets = root.parents[1] / "assets"
    renderer = (
        (root / "assets/factor-returns.mjs")
        .read_text()
        .replace("import { prepareOption } from '../../../assets/charts/style.mjs';", "")
        .replace("export ", "")
    )
    style = (assets / "charts/style.mjs").read_text().replace("export ", "")
    data = json.dumps(payload, ensure_ascii=False, allow_nan=False).replace("<", "\\u003c")
    return (
        '<!doctype html><html lang="zh-CN"><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        "<title>市场因子表现</title><style>"
        + (assets / "preview.css").read_text()
        + '</style><body class="hb-preview"><main><h1>市场因子表现</h1><div id="factors"></div>'
        + "</main><script>"
        + (assets / "echarts-6.1.0.min.js").read_text()
        + "</script>"
        + '<script type="module">'
        + style
        + "\n"
        + renderer
        + "\nconst payload="
        + data
        + ';renderFactorReturns({echarts,root:document.getElementById("factors"),payload,unit:'
        + json.dumps(unit)
        + ",initialStart:"
        + json.dumps(start)
        + ",initialEnd:"
        + json.dumps(end)
        + "});</script></body></html>"
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--chart", choices=["all", "history", "period"], default="all")
    parser.add_argument(
        "--start",
        type=lambda value: date.fromisoformat(value).isoformat(),
        help="Initial display start; retain full input history",
    )
    parser.add_argument(
        "--end",
        type=lambda value: date.fromisoformat(value).isoformat(),
        help="Initial display end",
    )
    args = parser.parse_args()
    if args.start and args.end and args.start > args.end:
        parser.error("start must not exceed end")
    if args.input.resolve() == args.output.resolve():
        parser.error("Do not overwrite the source JSON")
    html = render(load_json(args.input), args.chart, args.start, args.end)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(html, encoding="utf-8")
    print(args.output.resolve())


if __name__ == "__main__":
    main()
