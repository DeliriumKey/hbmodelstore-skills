#!/usr/bin/env python3
"""Public API -> self-contained HTML, using the same renderer as the docs site."""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from html import escape
from pathlib import Path

BASE = "https://api.delirium.com.cn/models/fund-brinson-attribution"
ROOT = Path(__file__).resolve().parents[1]


def source_note(start: str, end: str) -> str:
    interval = start.replace("-", "/")
    label = "截止日期" if start == end else "时间区间"
    if start != end:
        interval += "~" + end.replace("-", "/")
    return f"数据来源：好买基金研究中心，{label}：{interval}"


def fetch(endpoint: str, **params: object) -> dict:
    with urllib.request.urlopen(
        f"{BASE}/{endpoint}?{urllib.parse.urlencode(params)}", timeout=60
    ) as response:
        return json.load(response)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fund-code", required=True)
    parser.add_argument("--period-end", type=date.fromisoformat)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    if not re.fullmatch(r"\d{6}(?:\.OF)?", args.fund_code, re.I):
        parser.error("fund-code must be six digits with optional .OF")
    code = f"{args.fund_code[:6]}.OF"
    history = fetch("history", fund_code=code, limit=40)["rows"]
    if not history:
        parser.exit(1, "该基金暂无已发布结果；未生成图表。\n")
    history.sort(key=lambda r: r["period_end"])
    end = args.period_end.isoformat() if args.period_end else history[-1]["period_end"]
    if end not in {r["period_end"] for r in history}:
        parser.error("period-end is not an actual published period")
    code = history[-1]["fund_code"]
    detail = fetch("period", fund_code=code, period_end=end)
    nav = fetch("nav-comparison", fund_code=code, period_end=end)
    data = {"history": history, "detail": detail, "nav": nav}
    title = f"{history[-1]['fund_name']}（{code}）Brinson归因"
    renderer = (ROOT / "assets/brinson-renderer.mjs").read_text()
    stylesheet = (ROOT / "assets/brinson-report.css").read_text()
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
<style>{stylesheet}</style>
<h1>{escape(title)}</h1><h2>单期归因 · {end}</h2><div id="contributions" class="chart"></div>
<p class="source">{escape(period_note)}</p>
<h2>单期四资产拆分 · {end}</h2><div class="table asset-table"><table id="weights"><thead><tr>
<th>项目</th><th>A股</th><th>港股</th><th>转债</th><th>纯债</th>
</tr></thead><tbody></tbody></table></div>
<div class="table asset-table"><table id="effects"><thead><tr>
<th>项目</th><th>A股</th><th>港股</th><th>转债</th><th>纯债</th>
</tr></thead><tbody></tbody></table></div>
<h2>净值对比</h2>
<div id="nav" class="chart"></div><p class="source">{escape(nav_note)}</p>
<script>{echarts}</script><script type="module">{renderer}
const data={embedded};
const name=data.history.at(-1).fund_name;
renderBrinsonChart({{echarts,root:document.querySelector('#contributions'),
kind:'effects',data:[data.detail.period],options:{{fundName:name}}}});
renderBrinsonChart({{echarts,root:document.querySelector('#nav'),
kind:'nav',data:data.nav.points,options:{{fundName:name}}}});
const assetRows=assetTableRows(data.detail.markets);
const assetColorLimit=assetContributionColorLimit(assetRows);
for(const {{label,kind,values}} of assetRows){{
const body=document.querySelector(kind==='weight'?'#weights tbody':'#effects tbody');
const tr=document.createElement('tr');
const first=document.createElement('td');first.textContent=label;tr.append(first);
for(const value of values){{
const td=document.createElement('td');
td.textContent=kind==='weight'?formatPercent(value):formatContribution(value);
if(kind==='contribution')td.style.backgroundColor=returnCellBackground(value,assetColorLimit)??'';
tr.append(td);
}}body.append(tr);
}}
</script></html>"""
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
