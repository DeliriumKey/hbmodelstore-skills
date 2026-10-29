import { prepareOption } from '../../../assets/charts/style.mjs';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const coordinates = row => [row.beta_vmg_ep, row.beta_smb_ep];
const sameSpec = (a, b) => a.model_version === b.model_version && a.spec_id === b.spec_id;
export const STYLE_FACTORS = [
  ['beta_mkt', '市场暴露'], ['beta_smb_ep', '规模暴露'], ['beta_vmg_ep', '价值暴露'],
  ['beta_mom', '动量暴露'], ['beta_credit', '信用债暴露'], ['beta_cb', '转债暴露'],
];
const FACTOR_COLORS = {
  beta_mkt: ['#4e79a7', '#86a9ce'], beta_smb_ep: ['#f28e2b', '#f7b16a'],
  beta_vmg_ep: ['#59a14f', '#92c68a'], beta_mom: ['#b07aa1', '#d3a5c6'],
  beta_credit: ['#76b7b2', '#9ed3ce'], beta_cb: ['#e15759', '#ee9293'],
};
const escapeHtml = text => String(text ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Background is one complete, fixed-date category; history never changes that population.
export function prepareStyleMap(payload, years = 3, displayStart) {
  const { history, cross_section: cross } = payload;
  if (!history?.rows?.length || history.has_more !== false || history.next_start != null)
    throw new Error('需要完整的单基金历史。');
  const dates = history.rows.map(row => row.model_date);
  if (dates.some((day, i) => i && day <= dates[i - 1])
    || history.rows.some(row => row.code !== history.fund_code)) throw new Error('基金历史身份或日期顺序不一致。');
  const latest = history.rows.at(-1);
  if (!cross || cross.has_more !== false || cross.offset !== 0 || cross.total !== cross.rows?.length
    || new Set(cross.rows.map(row => row.code)).size !== cross.total) throw new Error('需要完整同类截面，不能只使用一页。');
  if (cross.model_date !== latest.model_date || cross.category !== latest.category
    || cross.rows.some(row => row.model_date !== latest.model_date || row.category !== latest.category))
    throw new Error('截面日期和分类应与基金历史末日一致。');
  const target = cross.rows.find(row => row.code === latest.code);
  if (!target || !sameSpec(target, latest)
    || coordinates(target).some((value, i) => value !== coordinates(latest)[i])
    || !coordinates(latest).every(finite)) throw new Error('目标基金历史与同日截面不一致。');
  if (![0, 1, 3, 5].includes(years)) throw new Error('Unsupported history range');
  const start = new Date(`${latest.model_date}T00:00:00Z`);
  start.setUTCFullYear(start.getUTCFullYear() - years);
  const cutoff = displayStart ?? (years ? start.toISOString().slice(0, 10) : '');
  const sampled = history.rows.filter(row => row.model_date >= cutoff);
  if (!sampled.length) throw new Error('所选区间没有基金历史数据。');
  const byDate = new Map(sampled.map(row => [row.model_date, row]));
  const modelDates = [...new Set([...byDate.keys(), ...(history.factor_dates ?? [])])]
    .filter(day => day >= sampled[0].model_date && day <= latest.model_date).sort();
  const points = sampled.filter(row => coordinates(row).every(finite));
  const segments = modelDates.slice(1).flatMap((day, i) => {
    const row = byDate.get(day), before = byDate.get(modelDates[i]);
    return row && before && coordinates(row).every(finite) && coordinates(before).every(finite)
      && sameSpec(before, row) ? [{ coords: [coordinates(before), coordinates(row)], before, row }] : [];
  });
  const peerHistory = payload.peer_history;
  if (peerHistory?.fund_code !== history.fund_code || peerHistory?.frequency !== 'daily' || peerHistory.has_more !== false || peerHistory.next_start != null
    || peerHistory?.statistic !== 'median' || peerHistory?.includes_target !== true || !Array.isArray(peerHistory.rows))
    throw new Error('需要与基金对应的完整日频同类中位数与分位数历史。');
  const peerByDate = new Map(peerHistory.rows.map(row => [row.model_date, row]));
  if (peerByDate.size !== peerHistory.rows.length) throw new Error('同类历史日期重复。');
  for (const row of sampled) {
    const peer = peerByDate.get(row.model_date);
    if (!peer || !sameSpec(peer, row) || peer.category !== row.category || peer.cb_enabled !== row.cb_enabled
      || STYLE_FACTORS.some(([field]) => !Number.isInteger(peer.sample_counts?.[field]) || peer.sample_counts[field] < 0
        || (peer.sample_counts[field] > 0 ? !finite(peer.median?.[field]) : peer.median?.[field] !== null)))
      throw new Error('同类中位数与基金当期日期、分类或规格不一致。');
  }
  const timeline = modelDates.map(day => ({ day, row: byDate.get(day), peer: peerByDate.get(day) }));
  return { latest, points, segments, timeline, start: sampled[0].model_date,
    peers: cross.rows.filter(row => row.code !== latest.code && sameSpec(row, latest) && coordinates(row).every(finite)) };
}

export function equityStyleMapOption(payload, { years = 3, start, dark = false, width = 800, height = 360 } = {}) {
  const { latest, peers, points, segments } = prepareStyleMap(payload, years, start);
  const red = '#d80012', gray = dark ? '#bfbfbf' : '#7f7f7f';
  const dot = row => ({ value: coordinates(row), row });
  const firstDate = Date.parse(points[0].model_date), lastDate = Date.parse(latest.model_date);
  const pathColor = day => {
    const t = lastDate === firstDate ? 1 : (Date.parse(day) - firstDate) / (lastDate - firstDate);
    const start = dark ? [243, 169, 180] : [249, 203, 209], end = [216, 0, 18];
    return `rgb(${start.map((value, i) => Math.round(value + (end[i] - value) * t)).join(',')})`;
  };
  const axes = dimension => {
    const values = [...peers, ...points].map(row => Math.abs(coordinates(row)[dimension]));
    const limit = Math.ceil(Math.max(.1, ...values) * 1.1 * 10) / 10;
    return { type: 'value', inverse: true, min: -limit, max: limit, interval: limit,
      axisLine: { show: true, onZero: false }, axisTick: { show: false },
      axisLabel: { showMinLabel: true, showMaxLabel: true, margin: 12,
        formatter: value => value === 0 ? '0' : dimension ? (value < 0 ? '大盘' : '小盘') : (value > 0 ? '价值' : '成长') },
      splitLine: { show: false } };
  };
  const option = {
    grid: { left: 54, right: 24, top: 20, bottom: 64,
      show: true, borderColor: dark ? '#666666' : '#bfbfbf', borderWidth: 1 },
    legend: { bottom: 0, data: ['同类基金', '日频轨迹', '最新位置'], itemWidth: 14, itemHeight: 10 },
    tooltip: { trigger: 'item', confine: true, formatter: item => {
      const row = item.data?.row;
      if (!row) return '';
      return `${escapeHtml(row.name)} ${escapeHtml(row.code)}<br>${escapeHtml(row.model_date)}<br>`
        + `价值暴露：${row.beta_vmg_ep.toFixed(3)}<br>规模暴露：${row.beta_smb_ep.toFixed(3)}`;
    } },
    xAxis: axes(0),
    yAxis: axes(1),
    series: [
      { name: '同类基金', type: 'scatter', symbolSize: 5, data: peers.map(dot),
        itemStyle: { color: gray, opacity: .22 }, emphasis: { itemStyle: { opacity: 1 }, scale: 1.7 },
        markLine: { silent: true, symbol: 'none', label: { show: false },
          lineStyle: { color: gray, type: 'solid', width: 1, opacity: .6 }, data: [{ xAxis: 0 }, { yAxis: 0 }] } },
      { name: '日频轨迹', type: 'lines', coordinateSystem: 'cartesian2d', z: 3,
        data: segments.map(segment => {
          const [before, after] = segment.coords;
          return { ...segment, lineStyle: { color: { type: 'linear',
            x: after[0] > before[0] ? 1 : 0, x2: after[0] < before[0] ? 1 : 0,
            y: after[1] < before[1] ? 1 : 0, y2: after[1] > before[1] ? 1 : 0,
            colorStops: [{ offset: 0, color: pathColor(segment.before.model_date) },
              { offset: 1, color: pathColor(segment.row.model_date) }] } } };
        }), symbol: 'none',
        lineStyle: { color: red, opacity: 1, width: 2, type: 'solid' } },
      { name: '最新位置', type: 'scatter', z: 5, symbol: 'circle', symbolSize: 6, data: [dot(latest)],
        itemStyle: { color: red, opacity: 1, borderWidth: 0 },
        emphasis: { scale: 1.3 },
        label: { show: false } },
    ],
  };
  return prepareOption(option, { width, height, dark, layout: 'preserve', axisLayout: 'preserve' }).option;
}

export function equityStyleHistoryOption(payload, { years = 3, start, field = 'beta_vmg_ep', dark = false, width = 800, height = 190, mode = 'exposure' } = {}) {
  if (!STYLE_FACTORS.some(([key]) => key === field)) throw new Error('Unsupported style factor');
  if (!['exposure', 'percentile'].includes(mode)) throw new Error('Unsupported exposure mode');
  const { timeline } = prepareStyleMap(payload, years, start);
  const name = STYLE_FACTORS.find(([key]) => key === field)[1];
  const color = FACTOR_COLORS[field][dark ? 1 : 0];
  const peerColor = dark ? '#bfbfbf' : '#7f7f7f';
  const percentile = mode === 'percentile';
  if (percentile && payload.peer_history.percentile_method !== 'midrank')
    throw new Error('需要日频同类分位数数据。');
  const peerLabel = percentile ? '同类50%分位' : '同类中位数';
  const valueFor = (point, peer) => percentile
    ? (!point.row || !finite(point.peer?.percentile?.[field]) ? null : peer ? .5 : point.peer.percentile[field])
    : peer ? point.peer?.median[field]
      : field === 'beta_cb' && point.row?.cb_enabled === false ? 0 : point.row?.[field];
  const values = timeline.flatMap(point => [valueFor(point, false), valueFor(point, true)]).filter(finite);
  const crossesZero = Math.min(...values) < 0 && Math.max(...values) > 0;
  // Separate specifications into independent lines, keeping both endpoint observations.
  const runs = peer => {
    const result = []; let previous;
    for (const [i, point] of timeline.entries()) {
      const { row } = point, value = valueFor(point, peer);
      if (!row || !finite(value)) { previous = undefined; continue; }
      if (!previous || !sameSpec(previous, row) || ((peer || percentile) && previous.category !== row.category)) result.push(Array(timeline.length).fill(null));
      result.at(-1)[i] = { value, row }; previous = row;
    }
    return result;
  };
  const tickStep = Math.max(1, Math.ceil((timeline.length - 1) / Math.max(2, Math.floor((width - 90) / 65))));
  // Shade only intervals whose paired observations support a comparison. Locate
  // crossings on the same straight segments as the two curves; gaps stay blank.
  const bands = [];
  for (let i = 1; i < timeline.length; i++) {
    const a = timeline[i - 1], b = timeline[i];
    const values = [valueFor(a, false), valueFor(a, true), valueFor(b, false), valueFor(b, true)];
    if (!a.row || !b.row || !sameSpec(a.row, b.row) || a.row.category !== b.row.category || !values.every(finite)) continue;
    const [fundA, peerA, fundB, peerB] = values, left = fundA - peerA, right = fundB - peerB;
    if (left <= 0 && right <= 0) continue;
    const crossing = i - 1 + left / (left - right);
    const from = left >= 0 ? i - 1 : crossing, to = right >= 0 ? i : crossing;
    if (bands.length && Math.abs(bands.at(-1)[1] - from) < 1e-9) bands.at(-1)[1] = to;
    else bands.push([from, to]);
  }
  // Category axes are evenly spaced. Pixel positions allow fractional crossings
  // without rounding them to an observation; redraw recomputes them after resize.
  const bandX = index => 54 + (width - 78) * index / Math.max(1, timeline.length - 1);
  const series = [false, true].flatMap(peer => runs(peer).map((data, i) => ({ name: peer ? peerLabel : '基金', type: 'line', data, smooth: false, connectNulls: false,
    symbol: 'none', showSymbol: false, z: 3, lineStyle: { color: peer ? peerColor : color, width: 1.8 },
    itemStyle: { color: peer ? peerColor : color },
    ...(!peer && i === 0 ? { markArea: { silent: true, label: { show: false },
      itemStyle: { color, opacity: dark ? .13 : .08 },
      data: bands.map(([from, to]) => [{ x: bandX(from) }, { x: bandX(to) }]) } } : {}),
    ...(!peer && i === 0 && crossesZero ? { markLine: { silent: true, symbol: 'none', label: { show: false },
      lineStyle: { color: dark ? '#888888' : '#aaaaaa', width: 1, type: 'solid' }, data: [{ yAxis: 0 }] } } : {}) })));
  const option = {
    grid: { left: 54, right: 24, top: 12, bottom: 54 },
    legend: { bottom: 0, data: ['基金', peerLabel], itemWidth: 18, itemHeight: 8 },
    tooltip: { trigger: 'axis', confine: true, formatter: items => {
      const row = items.find(item => item.data?.row)?.data.row;
      if (!row) return '该日暂无数据';
      const displayed = [...new Map(items.filter(item => finite(item.data?.value)).map(item => [item.seriesName, item.data.value])).entries()];
      return `${escapeHtml(row.model_date)}　${name}<br>${displayed.map(([label, value]) => `${label}：${percentile ? (value * 100).toFixed(1) + '%' : value.toFixed(3)}`).join('<br>')}`;
    } },
    xAxis: { type: 'category', data: timeline.map(point => point.day), boundaryGap: timeline.length === 1,
      axisTick: { show: false }, axisLine: { onZero: false },
      axisLabel: { formatter: value => value.slice(0, 7).replace('-', '/'), interval: i => i % tickStep === 0 || i === timeline.length - 1,
        hideOverlap: true, showMinLabel: true, showMaxLabel: true } },
    yAxis: { type: 'value', ...(percentile ? { min: 0, max: 1, interval: .5 } : {}), scale: true, boundaryGap: ['12%', '12%'], splitNumber: 3,
      axisLine: { onZero: false }, axisTick: { show: false },
      axisLabel: { formatter: value => percentile ? `${Math.round(value * 100)}%` : Math.abs(value) < .00001 ? '0' : value.toFixed(2) }, splitLine: { show: true } },
    series,
  };
  return prepareOption(option, { width, height, dark, layout: 'preserve', axisLayout: 'preserve' }).option;
}

export function renderEquityStyleMap({ echarts, root, payload, unit = 'all', mode: initialMode = 'exposure', initialStart = undefined, initialEnd = undefined }) {
  if (!['all', 'map', ...STYLE_FACTORS.map(([field]) => field)].includes(unit)) throw new Error('Unknown chart unit');
  const initial = prepareStyleMap(payload);
  if (initialEnd != null && initialEnd !== initial.latest.model_date)
    throw new Error('风格面板的截止日须与历史末日及同类截面一致，请按该日获取完整历史。');
  if (initialStart != null) prepareStyleMap(payload, 0, initialStart);
  root.replaceChildren();
  const add = (tag, text, parent = root) => {
    const el = document.createElement(tag); if (text) el.textContent = text;
    parent.append(el); return el;
  };
  const label = unit === 'all' ? '风格与因子暴露' : unit === 'map' ? '风格定位' : STYLE_FACTORS.find(([field]) => field === unit)[1];
  const title = add('h2', `${initial.latest.name}${label}`);
  title.style.cssText = 'font-size:15px;font-weight:600;margin:24px 0 16px';
  const controls = add('div'); controls.className = 'style-map-controls';
  const css = add('style');
  css.textContent = `.style-map-controls{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 8px}
    .style-map-controls button{font:inherit;font-size:12px;border:1px solid #ddd;padding:6px 12px;border-radius:6px;background:transparent;cursor:pointer}
    .style-map-controls button[aria-pressed=true]{color:white;background:#2b2b2b;border-color:#2b2b2b}
    .dark .style-map-controls button{border-color:#555}.dark .style-map-controls button[aria-pressed=true]{background:#ddd;color:#222}`;
  const makeChart = (id, label, height) => {
    const el = add('div'); el.dataset.hbChart = id;
    el.setAttribute('role', 'img'); el.setAttribute('aria-label', label);
    el.style.cssText = `width:100%;height:${height};min-width:0`;
    return { el, chart: echarts.init(el) };
  };
  const note = () => { const el = add('p'); el.style.cssText = 'font-size:12px;line-height:1.7;color:#7f7f7f;margin:8px 0 0'; return el; };
  const map = unit === 'all' || unit === 'map' ? makeChart('equity-style-map', '同类风格分布、基金日频轨迹与最新位置', 'clamp(280px,40vw,360px)') : null;
  const mapNote = map ? note() : null;
  const modeControls = add('div'); modeControls.className = 'style-map-controls'; modeControls.style.marginTop = '24px';
  if (unit === 'map') modeControls.style.display = 'none';
  const histories = STYLE_FACTORS.filter(([field]) => unit === 'all' || unit === field).map(([field, label]) => {
    const heading = add('h3', label); heading.style.cssText = 'font-size:14px;font-weight:600;margin:28px 0 8px';
    const suffix = field.replace('beta_', '').replace('_ep', '');
    const id = field === 'beta_vmg_ep' ? 'value' : field === 'beta_smb_ep' ? 'size' : suffix;
    return { ...makeChart(`equity-style-${id}-history`, `${label}与同类的日频比较`, '190px'), field, heading };
  });
  const historyNote = note();
  const group = echarts.connect(histories.map(item => item.chart));
  const media = matchMedia('(prefers-color-scheme:dark)');
  let years = 3, mode = initialMode, start = initialStart;
  const draw = () => {
    const dark = document.documentElement.classList.contains('dark')
      || (!document.documentElement.classList.contains('light') && media.matches);
    if (map) {
    map.chart.resize();
    const selected = map.chart.getOption()?.legend?.[0]?.selected;
    const option = equityStyleMapOption(payload, { years, start, width: map.el.clientWidth, height: map.el.clientHeight, dark });
    if (selected) option.legend.selected = selected;
    map.chart.setOption(option, true);
    }
    const data = prepareStyleMap(payload, years, start);
    for (const { chart, el, field, heading } of histories) {
      const visible = field !== 'beta_cb' || data.timeline.some(point => point.row?.cb_enabled);
      el.style.display = heading.style.display = visible ? '' : 'none';
      if (!visible) { chart.clear(); continue; }
      const selected = chart.getOption()?.legend?.[0]?.selected;
      const option = equityStyleHistoryOption(payload, { years, start, field, width: el.clientWidth, height: el.clientHeight, dark, mode });
      if (selected) option.legend.selected = selected;
      chart.resize(); chart.setOption(option, true);
    }
    const stamp = value => value.replaceAll('-', '/');
    if (mapNote) mapNote.textContent = `同类：${data.latest.category}；数据来源：Wind、好买基金研究中心，截止日期：${stamp(data.latest.model_date)}`;
    historyNote.textContent = `数据来源：Wind、好买基金研究中心，时间区间：${stamp(data.start)}~${stamp(data.latest.model_date)}`;
  };
  const ranges = [...(initialStart != null ? [['本轮区间', null]] : []), ['近一年', 1], ['近三年', 3], ['全部', 0]];
  const buttons = ranges.map(([label, value]) => {
    const button = add('button', label, controls); button.type = 'button';
    button.dataset.years = String(value); button.setAttribute('aria-pressed', String(initialStart != null ? value === null : years === value));
    button.onclick = () => { years = value ?? 0; start = value === null ? initialStart : undefined;
      buttons.forEach(b => b.setAttribute('aria-pressed', String(b === button))); draw(); };
    return button;
  });
  const modes = [['暴露值', 'exposure'], ['同类分位数', 'percentile']].map(([label, value]) => {
    const button = add('button', label, modeControls); button.type = 'button'; button.dataset.mode = value;
    button.setAttribute('aria-pressed', String(mode === value));
    button.onclick = () => { mode = value; modes.forEach(b => b.setAttribute('aria-pressed', String(b === button))); draw(); };
    return button;
  });
  const resize = new ResizeObserver(draw); resize.observe(root);
  const theme = new MutationObserver(draw); theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  media.addEventListener('change', draw); draw();
  return () => { resize.disconnect(); theme.disconnect(); media.removeEventListener('change', draw); echarts.disconnect(group);
    [map, ...histories].filter(Boolean).forEach(item => item.chart.dispose()); root.replaceChildren(); };
}
