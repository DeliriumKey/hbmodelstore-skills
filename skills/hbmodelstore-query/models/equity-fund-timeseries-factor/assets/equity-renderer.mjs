// Shared by the documentation preview and offline Skill HTML. No network or model estimation.
const numeric = value => {
  const raw = Array.isArray(value) ? value.at(-1) : value;
  return raw == null || !Number.isFinite(Number(raw)) ? null : Number(raw);
};
export const formatEquityPercent = value => numeric(value) === null ? '—' : `${(numeric(value) * 100).toFixed(2)}%`;
export const formatEquityBeta = value => numeric(value) === null ? '—' : numeric(value).toFixed(3);

function historyBaseOptions(rows, dark = false, factorDates = []) {
  const ink = dark ? '#e5e5e5' : '#2b2b2b', grid = dark ? '#444444' : '#e5e5e5';
  const byDate = new Map(rows.map(row => [row.model_date, row]));
  const dates = [...new Set([...byDate.keys(), ...factorDates])]
    .filter(day => day >= rows[0]?.model_date && day <= rows.at(-1)?.model_date).sort();
  const groups = [
    [['alpha_annual', '年化 Alpha', '#d80012'], ['return_252', '252 日收益', '#7f7f7f']],
    [['beta_mkt', '市场', '#d80012'], ['beta_smb_ep', '规模', '#225395'],
      ['beta_vmg_ep', '价值（EP）', '#7f7f7f'], ['beta_mom', '动量', '#b28189']],
    [['beta_credit', '信用债', '#d80012'],
      ...(rows.some(row => row.cb_enabled === true) ? [['beta_cb', '转债', '#225395']] : [])],
  ];
  return groups.map((group, index) => ({
    backgroundColor: 'transparent', animation: false, aria: { enabled: true, label: {
      description: `${group.map(series => series[1]).join('、')}历史时序；${index ? '单位为回归系数' : '纵轴为百分比'}。`,
    } },
    textStyle: { color: ink, fontSize: 12, fontFamily: 'Arial, "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", sans-serif' },
    grid: { left: 52, right: 16, top: 18, bottom: 44 },
    legend: { bottom: 0, type: 'scroll', textStyle: { color: ink, fontSize: 12 } },
    tooltip: { trigger: 'axis', confine: true, backgroundColor: dark ? '#222' : '#fff',
      axisPointer: { type: 'line', lineStyle: { color: '#7f7f7f', type: 'dashed', width: 1 } },
      textStyle: { color: ink }, valueFormatter: index ? formatEquityBeta : formatEquityPercent },
    xAxis: { type: 'time', axisLabel: { color: ink, hideOverlap: true },
      axisTick: { show: false }, axisLine: { lineStyle: { color: ink } }, splitLine: { show: false } },
    yAxis: { type: 'value', scale: true,
      axisLine: { show: true, lineStyle: { color: ink, width: 1 } },
      axisLabel: { color: ink, ...(index ? {} : { formatter: value => `${(value * 100).toFixed(1)}%` }) },
      splitLine: { lineStyle: { color: grid, type: 'solid', width: 1 } } },
    series: group.map(([field, name, color]) => ({
      name, type: 'line', showSymbol: false, smooth: false, connectNulls: false,
      lineStyle: { width: 1.5, type: 'solid' }, itemStyle: { color },
      // Only actual factor/model days can be missing; calendar holidays are not observations.
      data: dates.map(day => [day, field === 'beta_cb' && byDate.get(day)?.cb_enabled !== true
        ? null : byDate.get(day)?.[field] ?? null]),
    })),
  }));
}

export function equityHistoryOptions(rows, dark = false, factorDates = []) {
  return [equityPerformanceOption({ rows, factor_dates: factorDates }, { dark })];
}

// Standalone drawing unit; the combined performance view uses the same option.
export function equityPerformanceOption(payload, { dark = false, field = 'all' } = {}) {
  if (!['all', 'alpha_annual', 'return_252'].includes(field)) throw new Error('Unknown performance unit');
  const option = historyBaseOptions(payload.rows, dark, payload.factor_dates)[0];
  if (field !== 'all') option.series = option.series.filter(s => s.name === (field === 'alpha_annual' ? '年化 Alpha' : '252 日收益'));
  return option;
}

// A standalone drawing unit: the shaded band is a distribution, not a confidence interval.
export function equityAlphaPeerOption(payload, { dark = false, mode = 'value' } = {}) {
  if (!['value', 'percentile'].includes(mode)) throw new Error('Unknown Alpha peer mode');
  const peer = payload.alpha_peer_history;
  if (!peer?.rows?.length || peer.has_more || peer.fund_code !== payload.fund_code) {
    throw new Error('需要同一基金完整的 Alpha 同类历史');
  }
  const option = equityPerformanceOption(payload, { dark, field: 'alpha_annual' });
  const byDate = new Map(peer.rows.map(r => [r.model_date, r]));
  const dates = option.series[0].data.map(p => p[0]);
  const cohort = r => r && `${r.category}|${r.model_version}|${r.spec_id}`;
  const gray = dark ? '#bfbfbf' : '#7f7f7f';
  const bandColor = dark ? 'rgba(191,191,191,0.18)' : 'rgba(127,127,127,0.14)';
  const peerPoints = key => dates.flatMap((day, i) => {
    const current = byDate.get(day), previous = byDate.get(dates[i - 1]);
    const point = [day, current?.[key] ?? null];
    return current && previous && cohort(current) !== cohort(previous)
      ? [[(Date.parse(day) + Date.parse(dates[i - 1])) / 2, null], point] : [point];
  });
  const line = (name, data, color) => ({ name, type: 'line', data, showSymbol: false,
    smooth: false, connectNulls: false, lineStyle: { width: 1.5, type: 'solid', color }, itemStyle: { color }, z: 3 });
  const band = [];
  for (let i = 1; i < dates.length; i++) {
    const a = byDate.get(dates[i - 1]), b = byDate.get(dates[i]);
    if (a && b && cohort(a) === cohort(b)) band.push([
      Date.parse(dates[i - 1]), a.p25, a.p75, Date.parse(dates[i]), b.p25, b.p75,
    ]);
  }
  option.aria.label.description = mode === 'value' ? '基金 Alpha、同类中位数及同类25%至75%区间'
    : '基金 Alpha 在同类中的分位数，数值越高表示 Alpha 越高';
  option.legend.data = mode === 'value'
    ? ['基金 Alpha', '同类中位数', { name: '同类25%–75%区间', icon: 'rect' }]
    : ['同类分位数', '50%分位'];
  option.series = mode === 'value' ? [
    { name: '同类25%–75%区间', type: 'custom', silent: true, clip: true, z: 1,
      data: band, encode: { x: [0, 3], y: [1, 2, 4, 5] }, itemStyle: { color: bandColor },
      tooltip: { show: false }, renderItem: (_, api) => ({ type: 'polygon',
        shape: { points: [[0, 1], [0, 2], [3, 5], [3, 4]].map(([x, y]) => api.coord([api.value(x), api.value(y)])) },
        style: { fill: bandColor }, silent: true }) },
    line('同类中位数', peerPoints('median'), gray),
    line('基金 Alpha', option.series[0].data, '#d80012'),
  ] : [
    line('50%分位', dates.map(day => [day, byDate.has(day) ? .5 : null]), gray),
    line('同类分位数', peerPoints('percentile'), '#d80012'),
  ];
  if (mode === 'percentile') Object.assign(option.yAxis, { min: 0, max: 1, interval: .25,
    axisLabel: { ...option.yAxis.axisLabel, formatter: v => `${Math.round(v * 100)}%` } });
  const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  option.tooltip.formatter = items => {
    const points = Array.isArray(items) ? items : [items];
    const target = points.find(p => p.seriesName === (mode === 'value' ? '基金 Alpha' : '同类分位数'))
      ?? points.find(p => p.seriesType === 'line');
    const day = target?.value?.[0];
    const r = byDate.get(day);
    if (!r) return '';
    const visible = new Set(points.map(p => p.seriesName));
    const lines = [escape(day)];
    if (mode === 'value') {
      if (visible.has('基金 Alpha')) lines.push(`基金 Alpha：${formatEquityPercent(r.alpha_annual)}`);
      if (visible.has('同类中位数')) lines.push(`同类中位数：${formatEquityPercent(r.median)}`);
      // The interval remains available in the tooltip even though its polygons are non-interactive.
      if (option.legend.selected?.['同类25%–75%区间'] !== false) lines.push(`同类25%–75%区间：${formatEquityPercent(r.p25)}～${formatEquityPercent(r.p75)}`);
    } else lines.push(`同类分位数：${formatEquityPercent(r.percentile)}`);
    lines.push(`${escape(r.category)}，${r.sample_count}只`);
    return lines.join('<br>');
  };
  return option;
}

export function renderEquityHistory({ echarts, root, payload, field = 'all', peerOnly = false, mode = 'value' }) {
  const rows = payload.rows;
  if (!rows?.length || payload.has_more) throw new Error('需要完整、非空的单基金历史 JSON');
  const hasPeers = !!payload.alpha_peer_history?.rows?.length;
  if (peerOnly && !hasPeers) throw new Error('需要 Alpha 同类历史');
  const showPeers = hasPeers && (field === 'all' || peerOnly);
  const latest = rows.at(-1);
  root.replaceChildren(); root.classList.add('equity-history');
  const style = document.createElement('style');
  style.textContent = `.equity-history{min-width:0;font-family:Arial,"Microsoft YaHei","PingFang SC",sans-serif}
    .equity-history h2{font-size:16px;margin:20px 0 6px;font-weight:600}.equity-history h3{font-size:14px;margin:0;font-weight:600}
    .equity-history .note{font-size:12px;line-height:1.8;color:#7f7f7f;margin:8px 0}.equity-history .chart{height:300px;min-width:0;width:100%}
    .equity-history .chart-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:24px 0 8px}
    .equity-history .switch{display:flex;gap:2px;flex-wrap:wrap}.equity-history button{font:inherit;font-size:12px;padding:4px 10px;border-radius:4px;cursor:pointer;border:1px solid transparent;background:transparent;color:inherit}
    .equity-history button[aria-pressed=true]{background:rgba(127,127,127,.12);border-color:rgba(127,127,127,.3)}
    .equity-history .periods{gap:8px;margin:16px 0 0}
    .equity-history .periods button{min-height:32px;padding:6px 10px;border:1px solid #ddd;border-radius:6px}
    .equity-history .periods button[aria-pressed=true]{color:#fff;background:#2b2b2b;border-color:#2b2b2b}
    .dark .equity-history .periods button{border-color:#555}
    .dark .equity-history .periods button[aria-pressed=true]{background:#ddd;color:#222;border-color:#ddd}`;
  root.append(style);
  const add = (tag, text, className, parent = root) => {
    const el = document.createElement(tag); el.textContent = text; if (className) el.className = className;
    parent.append(el); return el;
  };
  add('h2', `${latest.name}（${payload.fund_code}）`);
  const rangeControls = add('div', '', 'switch periods'); rangeControls.setAttribute('aria-label', '展示区间');
  let years = 3, peerMode = mode;
  const group = `equity-${Math.random().toString(36).slice(2)}`;
  const charts = [];
  const makeChart = (title, unit) => {
    const head = add('div', '', 'chart-head'); add('h3', title, '', head);
    const div = add('div', '', 'chart'); div.setAttribute('role', 'img'); div.setAttribute('aria-label', title); div.dataset.hbChart = unit;
    const chart = echarts.init(div); chart.group = group; charts.push(chart); return head;
  };
  if (!peerOnly) makeChart(field === 'alpha_annual' ? '年化 Alpha' : field === 'return_252' ? '252 日收益' : 'Alpha 与252日收益',
    field === 'all' ? 'equity-performance' : `equity-${field}`);
  let modeButtons = [];
  if (showPeers) {
    const head = makeChart('Alpha 与同类比较', 'equity-alpha-peer');
    const controls = add('div', '', 'switch', head); controls.setAttribute('aria-label', 'Alpha 同类展示');
    modeButtons = [['Alpha', 'value'], ['同类分位数', 'percentile']].map(([label, value]) => {
      const button = add('button', label, '', controls); button.type = 'button';
      button.onclick = () => { peerMode = value; draw(); }; return [button, value];
    });
  }
  echarts.connect(group);
  charts.forEach(chart => chart.on('legendselectchanged', () => draw()));
  const note = add('p', '', 'note');
  const media = matchMedia('(prefers-color-scheme:dark)');
  const buttons = [['近一年', 1], ['近三年', 3], ['全部', 0]].map(([label, value]) => {
    const button = add('button', label, '', rangeControls); button.type = 'button'; button.dataset.years = String(value);
    button.onclick = () => { years = value; draw(); }; return [button, value];
  });
  function draw() {
    const end = new Date(`${latest.model_date}T00:00:00Z`); end.setUTCFullYear(end.getUTCFullYear() - years);
    const start = years ? end.toISOString().slice(0, 10) : '';
    const visible = rows.filter(r => r.model_date >= start);
    const input = { ...payload, rows: visible };
    const dark = document.documentElement.classList.contains('dark')
      || (!document.documentElement.classList.contains('light') && media.matches);
    const options = [...(!peerOnly ? [equityPerformanceOption(input, { dark, field })] : []),
      ...(showPeers ? [equityAlphaPeerOption(input, { dark, mode: peerMode })] : [])];
    charts.forEach((chart, i) => {
      const old = chart.getOption();
      if (old?.legend?.[0]?.selected) options[i].legend.selected = old.legend[0].selected;
      chart.setOption(options[i], true);
    });
    [...buttons].forEach(([button, value]) => button.setAttribute('aria-pressed', String(years === value)));
    modeButtons.forEach(([button, value]) => button.setAttribute('aria-pressed', String(peerMode === value)));
    note.textContent = `数据来源：Wind、好买基金研究中心，时间区间：${visible[0].model_date.replaceAll('-', '/')}~${latest.model_date.replaceAll('-', '/')}`;
  }
  const resize = new ResizeObserver(() => charts.forEach(chart => chart.resize())); resize.observe(root);
  const theme = new MutationObserver(draw); theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  media.addEventListener('change', draw); draw();
  return () => { resize.disconnect(); theme.disconnect(); media.removeEventListener('change', draw);
    echarts.disconnect(group); charts.forEach(chart => chart.dispose()); root.replaceChildren(); };
}

// Standalone multi-fund drawing unit: daily observations of annualized Alpha, not a NAV.
export function equityMultiFundAlphaOption(histories, { dark = false, start = '', width = 800 } = {}) {
  if (histories.length < 2 || histories.length > 11 || new Set(histories.map(h => h.fund_code)).size !== histories.length
    || histories.some(h => !h.rows?.length || h.has_more)) throw new Error('需要2–11只不同基金的完整历史');
  const option = equityPerformanceOption(histories[0], { dark, field: 'alpha_annual' });
  const colors = dark
    ? ['#d80012', '#bfbfbf', '#80b1d3', '#fdb462', '#b3de69', '#bc80bd', '#8dd3c7', '#fccde5', '#bebada', '#ffffb3', '#ccebc5']
    : ['#d80012', '#7f7f7f', '#225395', '#d98c32', '#438451', '#9765a4', '#29948a', '#b25e80', '#6566a1', '#a49235', '#637d7a'];
  const dates = [...new Set(histories.flatMap(h => [...h.rows.map(r => r.model_date), ...(h.factor_dates ?? [])]))]
    .filter(day => day >= start && histories.some(h => day >= h.rows[0].model_date && day <= h.rows.at(-1).model_date)).sort();
  option.aria.label.description = '多基金日频年化 Alpha 历史比较';
  option.series = histories.map((h, index) => {
    const lookup = new Map(h.rows.map(r => [r.model_date, r]));
    return {
      name: `${h.rows.at(-1).name}（${h.fund_code}）`, type: 'line',
      showSymbol: false, smooth: false, connectNulls: false,
      lineStyle: { width: 1.5, type: 'solid' }, itemStyle: { color: colors[index] },
      data: dates.map(day => [day, lookup.get(day)?.alpha_annual ?? null]),
    };
  });
  // Keep every fund visible in static exports as well as narrow research panels.
  const available = Math.max(180, width - 68);
  let legendRows = 1, used = 0;
  for (const series of option.series) {
    const size = 42 + [...series.name].reduce((n, c) => n + (c.charCodeAt(0) > 255 ? 12 : 7), 0);
    if (used && used + size > available) { legendRows++; used = 0; }
    used += size;
  }
  option.legend = { ...option.legend, type: 'plain', left: 52, right: 16, itemGap: 12 };
  option.grid.bottom = 28 + legendRows * 24;
  return option;
}

// Retain the option-list entry for existing callers; comparison now contains only Alpha.
export function equityComparisonOptions(histories, dark = false, start = '') {
  return [{ title: '年化 Alpha 比较', option: equityMultiFundAlphaOption(histories, { dark, start }) }];
}

export function renderEquityComparison({ echarts, root, histories }) {
  equityMultiFundAlphaOption(histories); // Validate before modifying the container.
  root.replaceChildren(); root.classList.add('equity-comparison');
  const add = (tag, text, parent = root) => { const el = document.createElement(tag); el.textContent = text;
    parent.append(el); return el; };
  add('style', `.equity-comparison .periods{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}
    .equity-comparison .periods button{font:inherit;font-size:12px;min-height:32px;padding:6px 10px;border:1px solid #ddd;border-radius:6px;background:transparent;color:inherit;cursor:pointer}
    .equity-comparison .periods button[aria-pressed=true]{background:#2b2b2b;color:#fff;border-color:#2b2b2b}
    .dark .equity-comparison .periods button{border-color:#555}
    .dark .equity-comparison .periods button[aria-pressed=true]{background:#ddd;color:#222;border-color:#ddd}`);
  add('h2', '年化 Alpha 比较');
  const controls = add('div', ''); controls.className = 'periods'; controls.setAttribute('aria-label', '展示区间');
  const canvas = add('div', ''); canvas.style.cssText = 'height:350px;width:100%;min-width:0';
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', '多基金日频年化 Alpha');
  canvas.dataset.hbChart = 'equity-multi-alpha';
  const chart = echarts.init(canvas);
  let years = 3, selected = {}, automaticHeight = 350;
  const end = histories.map(h => h.rows.at(-1).model_date).sort().at(-1);
  const media = matchMedia('(prefers-color-scheme:dark)');
  chart.on('legendselectchanged', event => { selected = event.selected; });
  const note = add('p', ''); note.style.cssText = 'font-size:12px;color:#7f7f7f;margin-top:8px';
  function draw() {
    const day = new Date(`${end}T00:00:00Z`); day.setUTCFullYear(day.getUTCFullYear() - years);
    const start = years ? day.toISOString().slice(0, 10) : '';
    const dark = document.documentElement.classList.contains('dark')
      || (!document.documentElement.classList.contains('light') && media.matches);
    const option = equityMultiFundAlphaOption(histories, { dark, start, width: chart.getWidth() });
    const height = Math.max(350, 270 + option.grid.bottom);
    // Honor an explicit export height; only resize a height still controlled by this panel.
    if (canvas.clientHeight === automaticHeight && canvas.clientHeight !== height) {
      automaticHeight = height; canvas.style.height = `${height}px`;
      chart.resize({ width: canvas.clientWidth, height: canvas.clientHeight });
    }
    option.legend.selected = selected; chart.setOption(option, true);
    buttons.forEach(([button, value]) => button.setAttribute('aria-pressed', String(value === years)));
    const first = option.series[0].data[0]?.[0];
    note.textContent = first ? `数据来源：Wind、好买基金研究中心，时间区间：${first.replaceAll('-', '/')}~${end.replaceAll('-', '/')}` : '';
  }
  const buttons = [['近一年', 1], ['近三年', 3], ['全部', 0]].map(([label, value]) => {
    const button = add('button', label, controls); button.type = 'button'; button.dataset.years = String(value);
    button.onclick = () => { years = value; draw(); }; return [button, value];
  });
  const resize = new ResizeObserver(() => { chart.resize({ width: canvas.clientWidth, height: canvas.clientHeight }); draw(); }); resize.observe(canvas);
  const theme = new MutationObserver(draw); theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  media.addEventListener('change', draw); draw();
  return () => { resize.disconnect(); theme.disconnect(); media.removeEventListener('change', draw);
    chart.dispose(); root.replaceChildren(); };
}

export function equityStyleOption(payload, dark = false) {
  const ink = dark ? '#e5e5e5' : '#2b2b2b', grid = dark ? '#444444' : '#e5e5e5';
  const factors = [['beta_mkt', '市场'], ['beta_smb_ep', '规模'],
    ['beta_vmg_ep', '价值（EP）'], ['beta_mom', '动量']];
  const data = factors.map(([key, label], index) => {
    const position = payload.category_factor_positions?.[key];
    if (!position?.valid_count || numeric(position.percentile_below) === null
      || numeric(position.percentile_at_or_below) === null) return null;
    return { value: [position.percentile_at_or_below * 100, index],
      factor: label, position };
  }).filter(Boolean);
  return {
    backgroundColor: 'transparent', animation: false, aria: { enabled: true },
    textStyle: { color: ink, fontSize: 12, fontFamily: 'Arial, "Microsoft YaHei", "PingFang SC", sans-serif' },
    grid: { left: 72, right: 28, top: 16, bottom: 60 },
    legend: { bottom: 0, textStyle: { color: ink }, data: ['本基金', '同类50%位置'] },
    tooltip: { trigger: 'item', confine: true, textStyle: { color: ink },
      backgroundColor: dark ? '#222' : '#fff', formatter: item => {
        const p = item.data.position;
        if (!p) return '';
        const lower = (p.percentile_below * 100).toFixed(1);
        const upper = (p.percentile_at_or_below * 100).toFixed(1);
        return `${item.data.factor}<br>暴露：${formatEquityBeta(p.target_value)}`
          + `<br>同类中位数：${formatEquityBeta(p.median)}<br>同类分位：${lower}%–${upper}%`;
      } },
    xAxis: { type: 'value', min: 0, max: 100, interval: 25,
      axisLabel: { color: ink, formatter: '{value}%' }, axisLine: { show: true, lineStyle: { color: ink } },
      splitLine: { lineStyle: { color: grid, type: 'solid' } } },
    yAxis: { type: 'category', inverse: true, data: factors.map(f => f[1]),
      axisLabel: { color: ink }, axisTick: { show: false }, axisLine: { show: false } },
    series: [{ name: '同类50%位置', type: 'line', silent: true, showSymbol: false,
      data: [[50, 0], [50, 3]], lineStyle: { width: 1, color: '#7f7f7f' }, itemStyle: { color: '#7f7f7f' } },
    { name: '本基金', type: 'scatter', data, symbol: 'circle', symbolSize: 10, itemStyle: { color: '#d80012' } }],
  };
}

export function renderEquityStyle({ echarts, root, payload }) {
  root.replaceChildren();
  const heading = document.createElement('h3');
  heading.textContent = '同类风格定位';
  heading.style.cssText = 'font-size:14px;font-weight:600;margin:24px 0 8px';
  const canvas = document.createElement('div');
  canvas.style.cssText = 'height:280px;min-width:0;width:100%';
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', '市场、规模、价值、动量在同类中的位置');
  const note = document.createElement('p');
  note.style.cssText = 'font-size:12px;color:#7f7f7f;margin:8px 0';
  note.textContent = `数据来源：Wind、好买基金研究中心，截止日期：${payload.model_date.replaceAll('-', '/')}；${payload.category}`;
  root.append(heading, canvas, note);
  const chart = echarts.init(canvas), media = matchMedia('(prefers-color-scheme:dark)');
  const draw = () => chart.setOption(equityStyleOption(payload, document.documentElement.classList.contains('dark')
    || (!document.documentElement.classList.contains('light') && media.matches)), true);
  const resize = new ResizeObserver(() => { chart.resize({ width: canvas.clientWidth, height: canvas.clientHeight }); draw(); }); resize.observe(canvas);
  const theme = new MutationObserver(draw); theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  media.addEventListener('change', draw); draw();
  return () => { resize.disconnect(); theme.disconnect(); media.removeEventListener('change', draw); chart.dispose(); root.replaceChildren(); };
}
