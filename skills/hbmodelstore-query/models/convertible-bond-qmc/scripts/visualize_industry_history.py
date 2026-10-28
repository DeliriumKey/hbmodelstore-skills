"""Render industry history with the website's shared ECharts renderer."""
import argparse
import json
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from chart_source import renderer_source
from public_data import load_json, unwrap


def render(payload):
    payload = unwrap(payload)
    if (payload.get("industry_standard") not in ("SW2021", "SW2014")
            or payload.get("bond_type") != "all" or not isinstance(payload.get("rows"), list)):
        raise ValueError("Use complete industry-history data with classification and all bonds")
    seen = set()
    for row in payload["rows"]:
        date.fromisoformat(row["model_date"])
        if row.get("scope") not in ("market", "industry"):
            raise ValueError("Invalid industry scope")
        key = (row["model_date"], row["scope"], row.get("industry_code"))
        if key in seen:
            raise ValueError("Duplicate industry/date")
        seen.add(key)
    root = Path(__file__).resolve().parents[1]
    stylesheet = (root.parents[1] / "assets/preview.css").read_text()
    runtime = (root.parents[1] / "assets/echarts-6.1.0.min.js").read_text()
    renderer = renderer_source("industry-history.mjs")
    safe = json.dumps(payload, ensure_ascii=False, allow_nan=False).replace("<", "\\u003c")
    return '''<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>行业转债估值走势</title><style>''' + stylesheet + '''
.chart{width:100%;min-height:320px}
</style><body class="hb-preview"><main><header><h1>行业转债估值走势</h1></header>
<div class="preview-controls" aria-label="历史区间">
<button data-years="1" aria-pressed="true">近一年</button>
<button data-years="3" aria-pressed="false">近三年</button>
<button data-years="0" aria-pressed="false">全部</button></div>
<h2>市场价减理论价中位数（元）</h2><p id="empty" role="status"></p>
<div id="history" class="chart" role="img" aria-label="行业转债估值历史折线图"></div>
<p id="classification" class="source"></p><p id="source" class="source"></p>
</main><script>''' + runtime + '''</script><script type="module">
''' + renderer + '\nconst payload=' + safe + ''';
const element=document.getElementById('history'), chart=echarts.init(element);
const theme=matchMedia('(prefers-color-scheme:dark)'); let years=1;
function draw(){
  const rows=industryHistoryWindow(payload.rows,years);
  const view=industryHistoryChart(rows), width=element.clientWidth;
  element.style.height=industryHistoryLayout(view,width).height+'px';chart.resize();
  const selected=chart.getOption()?.legend?.[0]?.selected;
  chart.setOption(industryHistoryOption(view,theme.matches,width),true);
  if(selected)chart.setOption({legend:{selected}});
  document.getElementById('empty').textContent=rows.length?'':'所选范围暂无模型结果。';
  document.getElementById('classification').textContent=
    '分类标准：申万 '+payload.industry_standard.slice(2);
  const fmt=value=>value.replaceAll('-','/');
  document.getElementById('source').textContent='数据来源：好买基金研究中心'+(view.dates.length
    ?'，时间区间：'+fmt(view.dates[0])+'~'+fmt(view.dates.at(-1)):'');
}
document.querySelectorAll('button[data-years]').forEach(button=>button.onclick=()=>{
  years=Number(button.dataset.years);
  document.querySelectorAll('button[data-years]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  draw();
});
new ResizeObserver(draw).observe(document.querySelector('main'));
theme.addEventListener('change',draw);draw();
</script></body></html>'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    html = render(load_json(args.input))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(html, encoding="utf-8")
    print(args.output)


if __name__ == "__main__":
    main()
