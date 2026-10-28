#!/usr/bin/env python3
"""Render a complete style-map snapshot with the website's shared implementation."""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from public_data import load_json


def render(payload, unit="all", mode="exposure"):
    history, cross = payload["history"], payload["cross_section"]
    if payload.get("peer_history", {}).get("fund_code") != history.get("fund_code"):
        raise ValueError("Style map requires the fund's daily peer history")
    if payload["peer_history"].get("statistic") != "median":
        raise ValueError("Refresh peer history to obtain medians before rendering")
    if (
        not history.get("rows")
        or history.get("has_more") is not False
        or history.get("next_start") is not None
        or cross.get("has_more") is not False
        or cross.get("offset") != 0
        or len(cross.get("rows", [])) != cross.get("total")
    ):
        raise ValueError("Style map requires complete history and a complete category snapshot")
    latest = history["rows"][-1]
    if (
        cross.get("model_date") != latest["model_date"]
        or cross.get("category") != latest["category"]
    ):
        raise ValueError("Category snapshot must match the latest history date and category")
    root = Path(__file__).resolve().parents[1]
    assets = root.parents[1] / "assets"
    renderer = (
        (root / "assets/style-map.mjs")
        .read_text()
        .replace("import { prepareOption } from '../../../assets/charts/style.mjs';", "")
        .replace("export ", "")
    )
    style = (assets / "charts/style.mjs").read_text().replace("export ", "")
    data = json.dumps(payload, ensure_ascii=False, allow_nan=False).replace("<", "\\u003c")
    return (
        '<!doctype html><html lang="zh-CN"><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        "<title>基金风格与因子暴露</title><style>"
        + (assets / "preview.css").read_text()
        + '</style><body class="hb-preview"><main><div id="style-map"></div></main><script>'
        + (assets / "echarts-6.1.0.min.js").read_text()
        + "</script><script>"
        + style
        + "\n"
        + renderer
        + "\nconst payload="
        + data
        + ";\n"
        + "renderEquityStyleMap({echarts,root:document.getElementById('style-map'),payload,unit:" + json.dumps(unit) + ",mode:" + json.dumps(mode) + "});"
        + "</script></body></html>"
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--chart", default="all", choices=["all", "map", "beta_mkt", "beta_smb_ep", "beta_vmg_ep", "beta_mom", "beta_credit", "beta_cb"], help="Render the complete component or one independent chart")
    parser.add_argument("--mode", choices=["exposure", "percentile"], default="exposure")
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve():
        parser.error("Do not overwrite the source JSON")
    html = render(load_json(args.input), args.chart, args.mode)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(html, encoding="utf-8")
    print(args.output.resolve())


if __name__ == "__main__":
    main()
