#!/usr/bin/env python3
"""Render two to five complete equity-fund histories as one offline comparison Panel."""

import argparse
import json
from pathlib import Path

from visualize import load


def render(histories):
    codes = [item["fund_code"] for item in histories]
    if not 2 <= len(histories) <= 5 or len(set(codes)) != len(codes):
        raise ValueError("Provide 2–5 distinct fund histories")
    root = Path(__file__).resolve().parents[1]
    assets = root.parents[1] / "assets"
    css = (assets / "preview.css").read_text()
    runtime = (assets / "echarts-6.1.0.min.js").read_text()
    renderer = (root / "assets/equity-renderer.mjs").read_text().replace("export ", "")
    data = json.dumps(histories, ensure_ascii=False, allow_nan=False).replace("<", "\\u003c")
    return (
        '<!doctype html><html lang="zh-CN"><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>多基金比较</title><style>' + css + '</style><body class="hb-preview">'
        '<main id="comparison"></main><script>' + runtime + '</script><script>' + renderer
        + '\nrenderEquityComparison({echarts,root:document.getElementById("comparison"),histories:'
        + data + '});</script></body></html>'
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inputs", type=Path, nargs="+", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.output.resolve() in {path.resolve() for path in args.inputs}:
        parser.error("Output must not overwrite input")
    try:
        html = render([load(path) for path in args.inputs])
    except ValueError as error:
        parser.error(str(error))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(html, encoding="utf-8")
    print(args.output.resolve())


if __name__ == "__main__":
    main()
