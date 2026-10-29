#!/usr/bin/env python3
"""Render two to eleven fund histories as one daily annualized Alpha chart."""

import argparse
import json
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from chart_assets import inline_chart_style
from visualize import load


def render(histories, start=None, end=None):
    codes = [item["fund_code"] for item in histories]
    if not 2 <= len(histories) <= 11 or len(set(codes)) != len(codes):
        raise ValueError("Provide 2–11 distinct fund histories")
    root = Path(__file__).resolve().parents[1]
    assets = root.parents[1] / "assets"
    css = (assets / "preview.css").read_text()
    runtime = (assets / "echarts-6.1.0.min.js").read_text()
    renderer = inline_chart_style((root / "assets/equity-renderer.mjs").read_text())
    renderer = renderer.replace("export ", "")
    data = json.dumps(histories, ensure_ascii=False, allow_nan=False).replace("<", "\\u003c")
    return (
        '<!doctype html><html lang="zh-CN"><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        "<title>年化 Alpha 比较</title><style>" + css + '</style><body class="hb-preview">'
        '<main id="comparison"></main><script>'
        + runtime
        + '</script><script type="module">'
        + renderer
        + '\nrenderEquityComparison({echarts,root:document.getElementById("comparison"),histories:'
        + data
        + ",initialStart:"
        + json.dumps(start)
        + ",initialEnd:"
        + json.dumps(end)
        + "});</script></body></html>"
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inputs", type=Path, nargs="+", required=True)
    parser.add_argument("--output", type=Path, required=True)
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
    if args.output.resolve() in {path.resolve() for path in args.inputs}:
        parser.error("Output must not overwrite input")
    try:
        html = render([load(path) for path in args.inputs], args.start, args.end)
    except ValueError as error:
        parser.error(str(error))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(html, encoding="utf-8")
    print(args.output.resolve())


if __name__ == "__main__":
    main()
