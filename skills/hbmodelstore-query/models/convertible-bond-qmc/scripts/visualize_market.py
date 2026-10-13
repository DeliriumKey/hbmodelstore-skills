"""Render saved market data using the same ECharts options as the website."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from public_data import load_json, unwrap


def render(payload):
    payload = unwrap(payload)
    payload = {**payload, **{key: unwrap(payload[key]) for key in
                             ("market", "groups", "premium", "volatility") if key in payload}}
    for key in ("market", "groups", "premium", "volatility"):
        part = payload.get(key)
        if not isinstance(part, dict) or not isinstance(part.get("rows"), list):
            raise ValueError(f"{key} must be a complete API response with rows")
        rows = part["rows"]
        dates = [row["model_date"] for row in rows]
        if dates != sorted(set(dates)):
            raise ValueError(f"{key} dates must be unique and ascending")
    root = Path(__file__).resolve().parents[1]
    stylesheet = (root.parents[1] / "assets/preview.css").read_text()
    renderer = (root / "assets/market-renderer.mjs").read_text()
    runtime = (root.parents[1] / "assets/echarts-6.1.0.min.js").read_text()
    safe = json.dumps(payload, ensure_ascii=False, allow_nan=False).replace("<", "\\u003c")
    return '''<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>转债市场估值</title><style>''' + stylesheet + '''
.chart{height:280px}
.group-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:28px}
.group-heading h2{margin:0}.group-heading .preview-controls{margin:0}
</style><body class="hb-preview"><main><header><h1>转债市场估值</h1></header>
<div id="range" class="preview-controls" aria-label="历史区间">
<button data-years="1" aria-pressed="false">近一年</button>
<button data-years="3" aria-pressed="false">近三年</button>
<button data-years="0" aria-pressed="true">全部</button></div><p id="empty" role="status"></p>
<h2>理论溢价率</h2>
<div id="valuation" class="chart" role="img"
aria-label="理论溢价率，正负3%以外用红绿底色，正负5%以外加深"></div>
<p id="valuation-source" class="source"></p>
<div class="group-heading"><h2>分组理论溢价率</h2>
<div class="preview-controls" role="group" aria-label="分组溢价率显示方式">
<button data-mode="raw" aria-pressed="false">原始值</button>
<button data-mode="relative" aria-pressed="true">相对历史</button></div></div>
<p id="group-description" class="source"></p>
<div id="groups" class="chart" role="img" aria-label="高、中、低价组理论溢价率"></div>
<p id="groups-source" class="source"></p>
<h2>百元溢价率</h2>
<div id="premium" class="chart" role="img"
aria-label="百元溢价率历史对照，底色与理论溢价率的偏便宜和偏贵日期一致"></div>
<p id="premium-source" class="source"></p>
<h2>市场隐含波动率（中证1000股指期权）</h2>
<div id="volatility" class="chart" role="img" aria-label="短期与长期波动率"></div>
<p id="volatility-source" class="source"></p>
</main><script>''' + runtime + '''</script>
<script type="module">
''' + renderer + '\nconst payload=' + safe + ''';
const chartIds=['valuation','groups','premium','volatility'];
const charts=chartIds.map(
  id=>echarts.init(document.getElementById(id)));
echarts.connect(charts);
const theme=matchMedia('(prefers-color-scheme:dark)'); let years=0, mode='relative';
function draw(){
  const rows=marketWindow(alignPremiumHistory(payload.market.rows,payload.premium.rows),years);
  const vol=alignVolatilityHistory(rows,payload.volatility.rows);
  const byDate=new Map(payload.groups.rows.map(row=>[row.model_date,row]));
  const groups=rows.map(row=>byDate.get(row.model_date)??{
    model_date:row.model_date,low_pct:null,mid_pct:null,high_pct:null,
    low_count:0,mid_count:0,high_count:0});
  const coveredGroups=groups.filter(row=>(mode==='relative'?row.low_relative_pp:row.low_pct)!=null);
  document.getElementById('group-description').textContent=mode==='relative'
    ?(coveredGroups.length?'扣除当日三组均值，再扣除此前252个模型日的自身均值（单位：百分点）。'
      :'所选范围暂无完整252日历史，可切换原始值。')
    :'保留原有筛选，按每日平底溢价率（平价 ÷ 纯债价值 − 1）从低到高等分为三组。';
  document.getElementById('empty').textContent=rows.length?'':'所选范围暂无已发布结果。';
  [marketValuationOption(rows,theme.matches),marketGroupOption(groups,theme.matches,mode),
    marketPremiumOption(rows,theme.matches),
    marketVolatilityOption(vol,theme.matches)].forEach((option,i)=>{
    const selected=charts[i].getOption()?.legend?.[0]?.selected;
    charts[i].setOption(option,true); if(selected)charts[i].setOption({legend:{selected}});
  });
  [rows,coveredGroups,rows.filter(row=>row.premium_100!=null),
    vol.filter(row=>row.short_volatility_pct!=null||row.long_volatility_pct!=null)].forEach((data,i)=>{
    const fmt=date=>date.replaceAll('-','/');
    const range=data.length?
      `，时间区间：${fmt(data[0].model_date)}~${fmt(data.at(-1).model_date)}`:'';
    document.getElementById(chartIds[i]+'-source').textContent='数据来源：好买基金研究中心'+range;
  });
}
document.querySelectorAll('button[data-years]').forEach(button=>button.onclick=()=>{
  years=Number(button.dataset.years);document.querySelectorAll('button[data-years]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));draw();
});
document.querySelectorAll('button[data-mode]').forEach(button=>button.onclick=()=>{
  mode=button.dataset.mode;document.querySelectorAll('button[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));draw();
});
const resize=new ResizeObserver(()=>charts.forEach(chart=>chart.resize()));
resize.observe(document.querySelector('main'));
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
