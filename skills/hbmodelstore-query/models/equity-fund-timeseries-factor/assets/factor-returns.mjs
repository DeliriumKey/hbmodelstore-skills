import { prepareOption } from '../../../assets/charts/style.mjs';

export const RETURN_FACTORS = [
  ['mkt', '市场', '#4e79a7', '#86a9ce'],
  ['smb_ep', '规模', '#f28e2b', '#f7b16a'],
  ['vmg_ep', '价值', '#59a14f', '#92c68a'],
  ['mom', '动量', '#b07aa1', '#d3a5c6'],
  ['credit', '信用债', '#76b7b2', '#9ed3ce'],
  ['cb', '转债', '#e15759', '#ee9293'],
];
const finite = n => typeof n === 'number' && Number.isFinite(n);
const pct = n => `${n.toFixed(2)}%`;

export function prepareFactorReturns(payload, { start, end } = {}) {
  if (payload.model_key !== 'equity-fund-timeseries-factor' || payload.return_unit !== 'decimal'
    || payload.frequency !== 'daily' || payload.has_more !== false || payload.next_start != null
    || !payload.rows?.length) throw new Error('需要完整的市场因子日收益数据。');
  const all = payload.rows;
  if (all.some((r, i) => !/^\d{4}-\d{2}-\d{2}$/.test(r.model_date)
    || (i && r.model_date <= all[i - 1].model_date)
    || RETURN_FACTORS.some(([key]) => !finite(r[key])))) throw new Error('因子收益日期或数值不完整。');
  const rows = all.filter(r => (!start || r.model_date >= start) && (!end || r.model_date <= end));
  if (rows.length < 2) throw new Error('所选区间需要至少两个有效日期。');
  if (rows.some(r => r.model_version !== rows[0].model_version || r.spec_id !== rows[0].spec_id))
    throw new Error('所选区间包含不同模型规格，请缩小区间。');
  const series = RETURN_FACTORS.map(([key, name, light, dark]) => {
    let cumulative = 0;
    const values = rows.map((r, i) => {
      // The first observation is the common starting point. Add daily factor
      // returns thereafter; long-short spreads are not a funded portfolio NAV.
      if (i) cumulative += r[key] * 100;
      return cumulative;
    });
    return { key, name, light, dark, values, total: values.at(-1) };
  });
  return { dates: rows.map(r => r.model_date), start: rows[0].model_date,
    end: rows.at(-1).model_date, series };
}

export function factorReturnsOption(payload, {
  start, end, unit = 'history', dark = false, width = 800, height = 320,
} = {}) {
  const data = prepareFactorReturns(payload, { start, end });
  if (!['history', 'period'].includes(unit)) throw new Error('Unknown factor return chart');
  const history = unit === 'history';
  const ranked = [...data.series].sort((a, b) => b.total - a.total);
  const option = {
    animation: false,
    color: data.series.map(s => dark ? s.dark : s.light),
    grid: { left: 14, right: 20, top: 22, bottom: history ? 54 : 24, containLabel: true },
    tooltip: { trigger: 'axis', valueFormatter: pct },
    ...(history ? { legend: { bottom: 0, data: data.series.map(s => s.name) } } : {}),
    xAxis: { type: 'category', data: history ? data.dates : ranked.map(s => s.name),
      boundaryGap: !history, axisLabel: history ? { formatter: s => s.slice(0, 7).replace('-', '/') } : {} },
    yAxis: { type: 'value', axisLabel: { formatter: n => `${Number(n.toFixed(1))}%` } },
    series: history ? data.series.map(s => ({ id: s.key, name: s.name, type: 'line',
      showSymbol: false, connectNulls: false, data: s.values }))
      : [{ name: '区间因子收益', type: 'bar', barMaxWidth: 44,
        data: ranked.map(s => ({ value: s.total, itemStyle: { color: dark ? s.dark : s.light } })) }],
  };
  return prepareOption(option, { width, height, dark, layout: 'preserve', axisLayout: 'preserve' }).option;
}

export function renderFactorReturns({ echarts, root, payload, unit = 'all', initialStart = undefined, initialEnd = undefined }) {
  const full = prepareFactorReturns(payload);
  if (!['all', 'history', 'period'].includes(unit)) throw new Error('Unknown factor return unit');
  root.replaceChildren();
  const add = (tag, text, parent = root) => {
    const el = document.createElement(tag); if (text) el.textContent = text;
    parent.append(el); return el;
  };
  const css = add('style');
  css.textContent = `.factor-return-controls{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:20px}
    .factor-return-controls button,.factor-return-controls input{font:inherit;font-size:12px;border:1px solid #ddd;border-radius:6px;padding:6px 10px;background:transparent;color:inherit;min-height:32px}
    .factor-return-controls button{cursor:pointer}.factor-return-controls button[aria-pressed=true]{background:#2b2b2b;color:white;border-color:#2b2b2b}
    .factor-return-dates{display:flex;align-items:center;gap:6px;margin-left:auto}
    .dark .factor-return-controls button,.dark .factor-return-controls input{border-color:#555}
    .dark .factor-return-controls button[aria-pressed=true]{background:#ddd;color:#222}
    @media(max-width:560px){.factor-return-dates{margin-left:0;width:100%}}`;
  const controls = add('div'); controls.className = 'factor-return-controls';
  const dates = add('div'); dates.className = 'factor-return-dates';
  const first = add('input', null, dates); first.type = 'date'; first.setAttribute('aria-label', '开始日期');
  add('span', '至', dates);
  const last = add('input', null, dates); last.type = 'date'; last.setAttribute('aria-label', '结束日期');
  for (const input of [first, last]) { input.min = full.start; input.max = full.end; }
  const error = add('p'); error.setAttribute('role', 'alert'); error.style.cssText = 'font-size:13px;color:#d80012;display:none';
  const charts = [['history', '累计因子收益', 330], ['period', '区间因子收益', 260]]
    .filter(([key]) => unit === 'all' || unit === key).map(([key, label, height]) => {
      const title = add('h3', label); title.style.cssText = 'font-size:15px;font-weight:600;margin:24px 0 8px';
      const el = add('div'); el.dataset.hbChart = `equity-factor-returns-${key}`;
      el.setAttribute('role', 'img'); el.setAttribute('aria-label', label);
      el.style.cssText = `height:${height}px;width:100%;min-width:0`;
      const note = add('p'); note.style.cssText = 'font-size:12px;color:#7f7f7f;margin:8px 0 0;line-height:1.6';
      return { key, el, note, chart: echarts.init(el) };
    });
  const media = matchMedia('(prefers-color-scheme:dark)');
  let start, end = initialEnd ?? full.end;
  const cutoff = months => {
    const d = new Date(`${full.end}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - months);
    return months ? d.toISOString().slice(0, 10) : full.start;
  };
  const custom = initialStart != null || initialEnd != null;
  start = initialStart ?? (custom ? full.start : cutoff(12));
  const initialRange = prepareFactorReturns(payload, { start, end });
  start = initialRange.start; end = initialRange.end;
  first.value = start; last.value = end;
  const draw = () => {
    let data;
    try { data = prepareFactorReturns(payload, { start, end }); }
    catch (e) { error.textContent = e.message; error.style.display = ''; return; }
    error.style.display = 'none';
    const dark = document.documentElement.classList.contains('dark')
      || (!document.documentElement.classList.contains('light') && media.matches);
    for (const { key, el, note, chart } of charts) {
      const selected = chart.getOption()?.legend?.[0]?.selected;
      const option = factorReturnsOption(payload, { start, end, unit: key, dark, width: el.clientWidth, height: el.clientHeight });
      if (selected && option.legend) option.legend.selected = selected;
      chart.resize(); chart.setOption(option, true);
      note.textContent = `数据来源：Wind、好买基金研究中心，时间区间：${data.start.replaceAll('-', '/')}~${data.end.replaceAll('-', '/')}`;
    }
  };
  const ranges = [...(custom ? [['本轮区间', null]] : []), ['近三个月', 3], ['近一年', 12], ['近三年', 36], ['全部', 0]];
  const buttons = ranges.map(([label, months]) => {
    const b = add('button', label, controls); b.type = 'button'; b.setAttribute('aria-pressed', String(custom ? months === null : months === 12));
    b.onclick = () => { start = months === null ? initialRange.start : cutoff(months); end = months === null ? initialRange.end : full.end;
      first.value = start < full.start ? full.start : start; last.value = end;
      buttons.forEach(el => el.setAttribute('aria-pressed', String(el === b))); draw(); };
    return b;
  });
  controls.append(dates);
  first.onchange = last.onchange = () => { start = first.value; end = last.value;
    buttons.forEach(b => b.setAttribute('aria-pressed', 'false')); draw(); };
  const resize = new ResizeObserver(draw); resize.observe(root);
  const theme = new MutationObserver(draw); theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  media.addEventListener('change', draw); draw();
  return () => { resize.disconnect(); theme.disconnect(); media.removeEventListener('change', draw);
    charts.forEach(({ chart }) => chart.dispose()); root.replaceChildren(); };
}
