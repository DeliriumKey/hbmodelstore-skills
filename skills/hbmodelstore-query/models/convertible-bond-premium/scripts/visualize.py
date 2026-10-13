"""Render a complete MCP history export offline; standard library only."""
import argparse
import json
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from public_data import load_json


def load(path):
    payload = load_json(path)
    # Native MCP clients export either the result object or structuredContent.
    for key in ('structuredContent', 'structured_content'):
        if isinstance(payload.get(key), dict):
            payload = payload[key]
            break
    if payload.get('unit') != 'percent' or not payload.get('rows'):
        raise ValueError('Expected a complete, nonempty premium history export')
    dates = [row['model_date'] for row in payload['rows']]
    if dates != sorted(set(dates)):
        raise ValueError('History dates must be unique and sorted')
    for row in payload['rows']:
        date.fromisoformat(row['model_date'])
        for key in ('premium_100', 'intercept', 'inverse_coefficient', 'mae', 'fitted_count'):
            if not isinstance(row[key], (float, int)):
                raise ValueError(f'Non-numeric {key}')
    json.dumps(payload, allow_nan=False)
    return payload


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    payload = load(args.input)
    root = Path(__file__).resolve().parents[1]
    stylesheet = (root.parents[1] / 'assets/preview.css').read_text()
    runtime = (root.parents[1] / 'assets/echarts-6.1.0.min.js').read_text()
    renderer = (root / 'assets/premium-renderer.mjs').read_text()
    renderer = renderer.replace('export function', 'function')
    data = json.dumps(payload, allow_nan=False).replace('<', '\\u003c')
    page = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>百元溢价率</title>
<style>__STYLE__
.chart{height:280px}
#summary{display:flex;flex-wrap:wrap;gap:30px;margin:24px 0}.value{font-size:22px;font-weight:600}
.bar{display:flex;align-items:baseline;justify-content:space-between;
flex-wrap:wrap;gap:8px 16px;margin:28px 0 8px}
.bar label{font-size:12px;color:var(--muted)}
</style><body class="hb-preview"><main><header><h1>百元溢价率</h1></header>
<div id="ranges" class="preview-controls"><button data-years="1">近一年</button>
<button data-years="3">近三年</button><button data-years="0">全部</button></div>
<div id="summary"></div><h2>百元溢价率（左轴）与拟合券数（右轴）</h2>
<div class="chart" id="history" role="img" aria-label="百元溢价率与拟合券数历史"></div>
<p class="note" id="source"></p><div class="bar"><h2>转股溢价率拟合曲线</h2>
<label>模型日期 <select id="date"></select></label></div><div class="chart" id="curve"></div>
<p class="note" id="curve-source"></p>
<p class="note">灰色虚线为70、100与130元平价，红点为百元溢价率。
70–130元之外为外推；本指标不直接代表个券公允价值或未来收益。</p>
</main><script>__RUNTIME__</script><script>__RENDERER__
const payload=__DATA__, all=payload.rows, latest=all.at(-1),
mode=matchMedia('(prefers-color-scheme:dark)');
const h=echarts.init(document.getElementById('history')),
c=echarts.init(document.getElementById('curve'));
const select=document.getElementById('date'); let years=3;
for(const row of [...all].reverse()){const option=document.createElement('option');
option.textContent=row.model_date;select.append(option);}
const stamp=value=>value.replaceAll('-','/');
function draw(){const start=new Date(latest.model_date+'T00:00:00Z');
start.setUTCFullYear(start.getUTCFullYear()-years);
const rows=years?all.filter(r=>r.model_date>=start.toISOString().slice(0,10)):all;
const percentile=100*rows.filter(r=>r.premium_100<=latest.premium_100).length/rows.length;
document.getElementById('summary').replaceChildren();
for(const [name,value] of [['百元溢价率',latest.premium_100.toFixed(2)+'%'],
['区间历史分位',percentile.toFixed(1)+'%']]){const box=document.createElement('div');
const label=document.createElement('small'),val=document.createElement('div');
label.textContent=name;val.textContent=value;
val.className='value';box.append(label,val);document.getElementById('summary').append(box);}
const selected=h.getOption()?.legend?.[0]?.selected;
h.setOption(historyOption(rows,mode.matches),true);if(selected)h.setOption({legend:{selected}});
const row=all.find(r=>r.model_date===select.value),
curve=Array.from({length:201},(_,i)=>({parity:50+i*.5,
fitted_premium:row.intercept+row.inverse_coefficient*100/(50+i*.5)}));c.setOption(curveOption({result:row,curve},mode.matches),true);
document.getElementById('source').textContent='数据来源：Wind、好买基金研究中心，时间区间：'+stamp(rows[0].model_date)+'~'+stamp(latest.model_date);
document.getElementById('curve-source').textContent='数据来源：Wind、好买基金研究中心，截止日期：'+stamp(row.model_date);
document.querySelectorAll('[data-years]').forEach(button=>button.setAttribute('aria-pressed',Number(button.dataset.years)===years));}
document.querySelectorAll('[data-years]').forEach(button=>button.onclick=()=>{years=Number(button.dataset.years);draw();});
select.onchange=draw;mode.addEventListener('change',draw);
new ResizeObserver(()=>{h.resize();c.resize();}).observe(document.body);draw();
</script></body></html>'''
    page = (page.replace('__STYLE__', stylesheet).replace('__RUNTIME__', runtime)
            .replace('__RENDERER__', renderer).replace('__DATA__', data))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(page)
    print(args.output.resolve())


if __name__ == '__main__':
    main()
