#!/usr/bin/env python3
"""Public API -> self-contained HTML, using the same renderer as the docs site."""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from html import escape
from pathlib import Path

from brinson_data import normalize_code
from chart_assets import inline_chart_style
from public_data import api_url, fetch_json, load_json, unwrap

BASE = api_url("/models/fund-brinson-attribution")
ROOT = Path(__file__).resolve().parents[1]


def source_note(start: str, end: str) -> str:
    interval = start.replace("-", "/")
    label = "截止日期" if start == end else "时间区间"
    if start != end:
        interval += "~" + end.replace("-", "/")
    return f"数据来源：好买基金研究中心，{label}：{interval}"


def fetch(endpoint: str, **params: object) -> dict:
    return fetch_json(
        f"{BASE}/{endpoint}?{urllib.parse.urlencode(params)}", timeout=60
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--fund-code")
    source.add_argument("--input", type=Path, help="Saved history/detail/nav bundle; offline")
    parser.add_argument("--period-end", type=date.fromisoformat)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    data = load_json(args.input) if args.input else None
    code = normalize_code(args.fund_code) if args.fund_code else None
    history = data["history"] if data else fetch("history", fund_code=code, limit=40)
    history = history if isinstance(history, list) else unwrap(history)["rows"]
    if not history:
        parser.exit(1, "该基金暂无已发布结果；未生成图表。\n")
    history.sort(key=lambda r: r["period_end"])
    end = args.period_end.isoformat() if args.period_end else history[-1]["period_end"]
    if end not in {r["period_end"] for r in history}:
        parser.error("period-end is not an actual published period")
    code = history[-1]["fund_code"]
    if data:
        detail = unwrap(data["details"][end] if "details" in data else data["detail"])
        nav = unwrap(data["nav"][end] if end in data["nav"] else data["nav"])
        if detail["period"]["period_end"] != end or detail["period"]["fund_code"] != code:
            parser.error("Saved detail does not match the selected fund and period")
        if nav.get("fund_code") != code or nav.get("period_end", end) != end:
            parser.error("Saved NAV does not match the selected fund and period")
    else:
        detail = fetch("period", fund_code=code, period_end=end)
        nav = fetch("nav-comparison", fund_code=code, period_end=end)
    data = {"history": history, "detail": detail, "nav": nav}
    title = f"{history[-1]['fund_name']}（{code}）Brinson归因"
    renderer = inline_chart_style((ROOT / "assets/brinson-renderer.mjs").read_text())
    single_renderer = (ROOT / "assets/single-period-renderer.mjs").read_text()
    stylesheet = (ROOT / "assets/brinson-report.css").read_text()
    preview_style = (ROOT.parents[1] / "assets/preview.css").read_text()
    echarts = (
        (ROOT.parents[1] / "assets/echarts-6.1.0.min.js")
        .read_text()
        .replace("</script", "<\\/script")
    )
    embedded = json.dumps(data, ensure_ascii=False).replace("<", "\\u003c")
    nav_start = nav["points"][0]["trade_date"] if nav["points"] else None
    nav_end = nav["points"][-1]["trade_date"] if nav["points"] else None
    nav_note = source_note(nav_start, nav_end) if nav_start else "该期没有净值点。"
    period_note = source_note(detail["period"]["period_start"], detail["period"]["period_end"])
    html = f"""<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(title)}</title>
<style>{preview_style}\n{stylesheet}</style><body class="hb-preview"><main>
<header><h1>{escape(title)}</h1></header><div id="single-period" class="analysis-content"></div>
</main><script>{echarts}</script><script type="module">{renderer}
{single_renderer}
const data={embedded};
renderBrinsonSinglePeriod({{echarts,root:document.querySelector('#single-period'),data,
notes:{{period:{json.dumps(period_note, ensure_ascii=False)},
nav:{json.dumps(nav_note, ensure_ascii=False)}}},
helpers:{{ASSETS,assetTableRows,assetWeightColorLimit,assetContributionColorLimit,
formatContribution,formatPercent,holdingDisplayRow,holdingColumns,holdingIndustryOptions,
filterHoldings,holdingColorLimits,sortHoldings,numeric,renderBrinsonChart,sortIndustries,
weightCellBackground,industryColorLimits,returnCellBackground}}}});
</script></body></html>"""
    args.output_dir.mkdir(parents=True, exist_ok=True)
    stem = f"{code}-{end}"
    (args.output_dir / f"{stem}.json").write_text(json.dumps(data, ensure_ascii=False, indent=2))
    path = args.output_dir / f"{stem}.html"
    path.write_text(html)
    print(path)


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as exc:
        sys.exit(f"API请求失败（HTTP {exc.code}），未生成图表。")
    except (urllib.error.URLError, TimeoutError) as exc:
        sys.exit(f"无法连接API：{exc}。未生成图表。")
