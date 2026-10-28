import { researchOption } from './research-style.mjs';
// Shared valuation definitions for the docs and exported Skill HTML. No data access.
export const QUINTILES = Array.from({ length: 5 }, (_, i) => ({ key: `q${i + 1}`, label: `Q${i + 1}` }));
export const VALUATION_COLUMNS = [
  ['bond_code', '代码'], ['bond_name', '名称'], ['industry_name', '行业'],
  ['conversion_value', '平价'], ['pure_bond_value', '底价'], ['parity_floor_premium', '平底溢价率'],
  ['market_price', '市场价'], ['theoretical_price', '理论价'],
  ['market_vs_theoretical_pct', '理论溢价率'], ['remaining_years', '剩余期限（年）'],
];
export const INDUSTRY_COLUMNS = [
  ['label', '行业'], ['count', '只数'], ['parity_floor_premium', '平底溢价率中位数'], ['value', '市场价减理论价中位数（元）'],
];
export const INDUSTRY_STANDARDS = [['SW2021', '申万 2021'], ['SW2014', '申万 2014']];
export function valuationClassificationNote(snapshot) {
  const standard = INDUSTRY_STANDARDS.find(([key]) => key === snapshot.industry_standard)?.[1] ?? snapshot.industry_standard ?? '—';
  return `分类标准：${standard}，分类日期：${snapshot.industry_as_of_date ?? '—'}`;
}
export function previousQuarterEnd(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day))
    || new Date(day).toISOString().slice(0, 10) !== day) throw new Error('模型日期无效。');
  const value = new Date(day);
  return new Date(Date.UTC(value.getUTCFullYear(), Math.floor(value.getUTCMonth() / 3) * 3, 0)).toISOString().slice(0, 10);
}
export const finite = value => typeof value === 'number' && Number.isFinite(value);
// Excel red/blue overlays: fixed neutral points, separate column ranges over all
// filtered rows (before pagination). Neutral and missing cells stay transparent.
export function valuationCellBackground(rows) {
  return centeredCellBackground(rows, { conversion_value: 100, pure_bond_value: 100, market_vs_theoretical_pct: 0, parity_floor_premium: 0 });
}
export function industryCellBackground(rows) {
  return centeredCellBackground(rows, { parity_floor_premium: 0, value: 0 });
}
export function industryTableRows(rows, { sort = 'value', descending = true } = {}) {
  return [...rows].sort((a, b) => {
    const av = a[sort], bv = b[sort];
    const missing = value => value == null || (typeof value === 'number' && !finite(value));
    if (missing(av) || missing(bv)) return missing(av) ? (missing(bv) ? 0 : 1) : -1;
    return (descending ? -1 : 1) * (typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv), 'zh-CN'))
      || String(a.label).localeCompare(String(b.label))
      || String(a.key ?? a.label).localeCompare(String(b.key ?? b.label));
  });
}
function centeredCellBackground(rows, centers) {
  const ranges = Object.fromEntries(Object.entries(centers).map(([key, center]) => {
    const values = rows.map(row => row[key]).filter(finite);
    return [key, { center, min: Math.min(center, ...values), max: Math.max(center, ...values) }];
  }));
  return (row, key) => {
    const range = ranges[key], value = row?.[key];
    if (!range) return undefined;
    if (!finite(value) || value === range.center) return 'transparent';
    const above = value > range.center;
    const span = above ? range.max - range.center : range.center - range.min;
    const fraction = span ? Math.min(1, Math.abs(value - range.center) / span) : 0;
    return `rgba(${above ? '248, 105, 107' : '90, 138, 198'}, ${fraction})`;
  };
}
export function median(values) {
  const sorted = values.filter(finite).sort((a, b) => a - b), n = sorted.length;
  return n ? (sorted[Math.floor((n - 1) / 2)] + sorted[Math.floor(n / 2)]) / 2 : null;
}
export function valuationFormat(key, value, row = {}) {
  if (value === null || value === undefined || (typeof value === 'number' && !finite(value))) return '—';
  if (key.endsWith('_rate')) return row.pricing_method === 'announced-redemption-bs' ? '—' : `${(value * 100).toFixed(1)}%`;
  if (key === 'market_vs_theoretical_pct' || key === 'parity_floor_premium') return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  return typeof value === 'number' ? value.toFixed(2) : String(value);
}
export function valuationSnapshot(payload) {
  if (!payload.model_date || !Array.isArray(payload.rows) || payload.total !== payload.rows.length
    || new Set(payload.rows.map(row => row.bond_code)).size !== payload.total
    || payload.rows.some(row => !row.bond_code || row.model_date !== payload.model_date)) {
    throw new Error('请使用同一模型日的完整截面；分页、重复券或混合日期不能用于分组。');
  }
  const quarter = previousQuarterEnd(payload.model_date), standard = payload.industry_standard || 'SW2021';
  if (!INDUSTRY_STANDARDS.some(([key]) => key === standard)) throw new Error('不支持的行业分类版本。');
  if (payload.industry_as_of_date && payload.industry_as_of_date !== quarter) throw new Error('截面分类日期不是上个季度末。');
  const rows = payload.rows.map(row => {
    const mapped = row.industry_name && row.industry_code && row.industry_standard
      && row.industry_standard === standard && row.industry_as_of_date === quarter;
    const days = (Date.parse(row.maturity_date) - Date.parse(row.model_date)) / 86400000;
    return { ...row, remaining_years: Number.isFinite(days) ? days / 365.25 : null,
      industry_key: mapped ? `${row.industry_standard}:${row.industry_code}` : 'unclassified',
      industry_name: mapped ? row.industry_name : '未分类', parity_floor_premium: parityFloorPremium(row), quintile: null };
  });
  const valid = rows.filter(row => row.conversion_value > 0 && finite(row.parity_floor_premium))
    .sort((a, b) => a.parity_floor_premium - b.parity_floor_premium || a.bond_code.localeCompare(b.bond_code));
  // Equal-count groups: the first n % 5 groups get one extra bond.
  let offset = 0;
  QUINTILES.forEach((group, i) => {
    const count = Math.floor(valid.length / 5) + (i < valid.length % 5 ? 1 : 0);
    valid.slice(offset, offset + count).forEach(row => { row.quintile = group.key; });
    offset += count;
  });
  return { ...payload, industry_standard: standard, industry_as_of_date: quarter,
    rows, ungrouped: rows.length - valid.length,
    groups: QUINTILES.map(group => {
      const members = rows.filter(row => row.quintile === group.key);
      return { ...group, count: members.length, min: members.length ? Math.min(...members.map(row => row.parity_floor_premium)) : null,
        max: members.length ? Math.max(...members.map(row => row.parity_floor_premium)) : null,
        premium: median(members.map(row => row.market_vs_theoretical_pct)) };
    }) };
}
// Fetch the fixed-date complete sample before ANY UI filter or quintile assignment.
export async function loadValuationSnapshot(query, date, signal, industryStandard = 'SW2021') {
  if (!INDUSTRY_STANDARDS.some(([key]) => key === industryStandard)) throw new Error('不支持的行业分类版本。');
  const rows = [];
  let first;
  do {
    const page = await query({ date, industry_standard: industryStandard, sort: 'bond_code', order: 'asc', limit: '500', offset: String(rows.length) }, signal);
    if (page.industry_frequency !== 'previous_quarter_end') {
      throw new Error('当前 API 尚未启用上季末行业分类，请先更新接口并补充分类快照。');
    }
    if (page.industry_standard !== industryStandard || page.industry_as_of_date !== previousQuarterEnd(date)
      || page.rows?.some(row => row.industry_standard !== industryStandard || row.industry_as_of_date !== previousQuarterEnd(date))) {
      throw new Error('返回的行业版本或分类日期与查询口径不一致。');
    }
    if (!first) first = page;
    if (page.model_date !== date || page.total !== first.total || !Array.isArray(page.rows)
      || page.offset !== rows.length || (!page.rows.length && rows.length < page.total)) {
      throw new Error('模型截面分页不一致，请重试。');
    }
    rows.push(...page.rows);
    if (rows.length > page.total || rows.length > 10000) throw new Error('模型截面分页数量异常。');
  } while (rows.length < first.total);
  return valuationSnapshot({ ...first, rows });
}
export function valuationRows(snapshot, { group = 'all', industry = '', q = '', bondType = '', sort = 'market_vs_theoretical_pct', descending = false } = {}) {
  const needle = q.trim().toLowerCase();
  return snapshot.rows.filter(row => (group === 'all' || row.quintile === group)
    && (!industry || row.industry_key === industry) && (!bondType || row.bond_type === bondType)
    && (!needle || `${row.bond_code} ${row.bond_name}`.toLowerCase().includes(needle)))
    .sort((a, b) => {
      const av = a[sort], bv = b[sort];
      if (av == null || bv == null) return av == null ? (bv == null ? 0 : 1) : -1;
      return (descending ? -1 : 1) * (typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv)))
        || a.bond_code.localeCompare(b.bond_code);
    });
}
// Industry comparison always uses all parity ranges, including links saved with a Q filter.
export function valuationViewFilters(filters, industryView = false) {
  return { ...filters, group: industryView ? 'all' : filters.group ?? 'all' };
}
export function parityFloorPremium(row) {
  if (!finite(row.conversion_value) || row.conversion_value < 0 || !finite(row.pure_bond_value) || row.pure_bond_value <= 0) return null;
  const value = (row.conversion_value / row.pure_bond_value - 1) * 100;
  return finite(value) ? value : null;
}
export function withValuationBalances(snapshot, balances) {
  if (balances.model_date !== snapshot.model_date || balances.unit !== 'CNY_100M'
    || !Array.isArray(balances.rows) || balances.rows.length !== snapshot.rows.length) {
    throw new Error('余额数据与模型日期、样本或单位不一致。');
  }
  const values = new Map();
  for (const row of balances.rows) {
    if (values.has(row.bond_code) || !finite(row.outstanding_balance) || row.outstanding_balance < 0) throw new Error('余额数据重复或无效。');
    values.set(row.bond_code, row.outstanding_balance);
  }
  if (snapshot.rows.some(row => !values.has(row.bond_code))) throw new Error('余额数据未覆盖全部模型样本。');
  return { ...snapshot, rows: snapshot.rows.map(row => ({ ...row, outstanding_balance: values.get(row.bond_code) })) };
}
export function valuationIndustries(rows) {
  const buckets = new Map();
  rows.forEach(row => {
    if (!buckets.has(row.industry_key)) buckets.set(row.industry_key, { key: row.industry_key, label: row.industry_name, rows: [] });
    buckets.get(row.industry_key).rows.push(row);
  });
  return [...buckets.values()].map(group => ({ key: group.key, label: group.label, count: group.rows.length,
    value: median(group.rows.map(row => row.market_minus_theoretical)),
    balance: group.rows.every(row => finite(row.outstanding_balance) && row.outstanding_balance >= 0)
      ? group.rows.reduce((sum, row) => sum + row.outstanding_balance, 0) : null,
    parity_floor_premium: median(group.rows.map(parityFloorPremium)),
    premium: median(group.rows.map(row => row.market_vs_theoretical_pct)) }))
    .sort((a, b) => (a.value == null ? (b.value == null ? 0 : 1) : b.value == null ? -1 : b.value - a.value)
      || a.label.localeCompare(b.label));
}

export async function loadIndustrySnapshot(query, date, signal, industryStandard = 'SW2021') {
  const payload = await query({ start: date, end: date, industry_standard: industryStandard, industries: 'none' }, signal);
  if (payload.start !== date || payload.end !== date || payload.industry_standard !== industryStandard
    || payload.bond_type !== 'all' || payload.industries !== null || payload.aggregation !== 'median_per_bond'
    || payload.industry_frequency !== 'previous_quarter_end'
    || payload.rows.some(row => row.model_date !== date || row.industry_as_of_date !== previousQuarterEnd(date))) {
    throw new Error('行业汇总与查询口径不一致。');
  }
  return { model_date: date, industry_standard: industryStandard, industry_as_of_date: previousQuarterEnd(date),
    rows: [], groups: [], ungrouped: 0,
    industry_summary: industryTableRows(payload.rows.filter(row => row.scope === 'industry').map(row => ({
      key: `${industryStandard}:${row.industry_code ?? 'unclassified'}`, label: row.industry_name, count: row.bond_count,
      value: row.market_minus_theoretical, parity_floor_premium: row.parity_floor_premium, balance: null, premium: null,
    }))),
  };
}
const FONT = 'Arial, Microsoft YaHei, PingFang SC, sans-serif';
function chartBase(dark) {
  const ink = dark ? '#e5e5e5' : '#2b2b2b';
  return { animation: false, stateAnimation: { duration: 0 }, backgroundColor: 'transparent',
    aria: { enabled: true }, textStyle: { fontFamily: FONT, fontSize: 12, color: ink },
    tooltip: { trigger: 'axis', confine: true, transitionDuration: 0,
      axisPointer: { type: 'line' }, backgroundColor: dark ? '#222222' : '#ffffff',
      borderColor: dark ? '#555555' : '#dddddd', textStyle: { color: ink, fontFamily: FONT, fontSize: 12 } },
    legend: { bottom: 0, left: 'center', itemWidth: 18, itemHeight: 8, textStyle: { color: ink, fontSize: 12 } },
  };
}
export function industryValuationHeight(rows) {
  return Math.max(160, rows.length * 24 + 56);
}
export function industryValuationOption(rows, dark = false, width = 700) {
  const base = chartBase(dark), ink = base.textStyle.color;
  return researchOption({ ...base, grid: { top: 12, left: width < 480 ? 64 : 72, right: 38, bottom: 44 },
    tooltip: { ...base.tooltip, valueFormatter: value => finite(value) ? `${value.toFixed(2)} 元` : '—' },
    xAxis: { type: 'value', scale: false,
      name: '元', nameGap: 10, axisLine: { show: true, onZero: false, lineStyle: { color: ink } },
      axisTick: { show: false }, splitLine: { lineStyle: { color: dark ? '#444444' : '#e5e5e5' } } },
    yAxis: { type: 'category', inverse: true, data: rows.map(row => row.label),
      axisLine: { show: true, onZero: true, lineStyle: { color: dark ? '#e5e5e5' : '#000000', width: 1, type: 'solid' } },
      axisTick: { show: false }, axisLabel: { color: ink, fontSize: 12, interval: 0 } },
    series: [{ name: '市场价减理论价中位数', type: 'bar', barWidth: 16,
      data: rows.map(row => ({ value: row.value, itemStyle: { color: row.value < 0 ? (dark ? '#91a9ca' : '#225395') : '#d80012' } })),
      emphasis: { disabled: true } }], legend: { show: false } }, dark, width);
}
export function industryPieRows(rows, metric = 'count') {
  const sorted = rows.filter(row => finite(row[metric]) && row[metric] > 0)
    .sort((a, b) => b[metric] - a[metric] || a.key.localeCompare(b.key));
  const result = sorted.slice(0, 10).map(row => ({ key: row.key, label: row.label, value: row[metric] }));
  if (sorted.length > 10) result.push({ key: '__other__', label: '其他', value: sorted.slice(10).reduce((sum, row) => sum + row[metric], 0) });
  return result;
}
export function industryCountLayout(rows, width = 700, metric = 'count') {
  return industryLegendLayout(industryPieRows(rows, metric), width);
}
function industryLegendLayout(rows, width) {
  const available = Math.max(120, width - 24), data = [];
  let used = 0, lines = 0;
  for (const row of rows) {
    // Reserve the icon, its gap, and conservative 12px label widths. Explicit
    // breaks keep the legend and its reserved height in sync in both renderers.
    const itemWidth = 18 + 5 + 4 + [...row.label].reduce((sum, char) => sum + (char.charCodeAt(0) > 255 ? 12 : 8), 0);
    if (used && used + 10 + itemWidth > available) { data.push('\n'); used = 0; }
    if (!used) lines++;
    data.push(row.label);
    used += (used ? 10 : 0) + itemWidth;
  }
  const legendHeight = lines ? lines * 18 + (lines - 1) * 10 : 0;
  return { data, legendHeight, height: 292 + 16 + legendHeight };
}
function industryColors(universe, dark) {
  // Howbuy red/gray/blue families. More than nine named sectors use the approved
  // blue extensions, then stable neutral grays; no additional hues or cycling.
  const palette = dark
    ? ['#d80012', '#bfbfbf', '#91a9ca', '#ec8089', '#eeeeee', '#5f84b4', '#f3a9b4', '#999999', '#c1cede', '#67a2d4', '#477eb1']
    : ['#d80012', '#7f7f7f', '#225395', '#8d0101', '#2b2b2b', '#0c2748', '#ec8089', '#bfbfbf', '#91a9ca', '#2d75b3', '#154373'];
  const grays = ['#9a9a9a', '#b0b0b0', '#cdcdcd', '#8b8b8b', '#a4a4a4', '#c4c4c4', '#d6d6d6', '#969696', '#b8b8b8'];
  const keys = [...new Set([...industryPieRows(universe), ...industryPieRows(universe, 'balance'),
    ...[...universe].sort((a, b) => a.key.localeCompare(b.key))].map(row => row.key).filter(key => key !== '__other__'))];
  return new Map([...keys.map((key, i) => [key, key === 'unclassified' ? (dark ? '#707070' : '#e0e0e0')
    : palette[i] ?? grays[i - palette.length] ?? '#d0d0d0']),
  ['__other__', dark ? '#707070' : '#e0e0e0']]);
}
export function industryCountOption(rows, dark = false, width = 700, universe = rows, metric = 'count') {
  const base = chartBase(dark), ink = base.textStyle.color;
  const layout = industryCountLayout(rows, width, metric);
  const colors = industryColors(universe, dark);
  const sorted = industryPieRows(rows, metric);
  const total = sorted.reduce((sum, row) => sum + row.value, 0);
  const format = value => metric === 'balance' ? `${value.toFixed(2)} 亿元` : `${value} 只`;
  return { ...base,
    tooltip: { ...base.tooltip, trigger: 'item',
      formatter: item => `${escapeHtml(item.name)}<br/>${format(item.value)} · ${total ? (item.value / total * 100).toFixed(2) : '0.00'}%` },
    legend: { ...base.legend, type: 'plain', selectedMode: false, left: 'center', width: Math.max(120, width - 24),
      padding: 0, itemGap: 10, textStyle: { ...base.legend.textStyle, lineHeight: 18 }, data: layout.data },
    series: [{ name: metric === 'balance' ? '行业债券余额' : '行业转债只数', type: 'pie', top: 0, bottom: layout.legendHeight + 16, radius: '70%', center: ['50%', '50%'],
      minAngle: 0, stillShowZeroSum: false, selectedMode: false, avoidLabelOverlap: true,
      label: { color: ink, fontSize: 12, lineHeight: 17, formatter: '{b}\n{d}%', alignTo: width < 480 ? 'edge' : 'labelLine', edgeDistance: 8 },
      labelLine: { length: 10, length2: 8, lineStyle: { color: dark ? '#888888' : '#aaaaaa' } },
      itemStyle: { borderColor: dark ? '#222222' : '#ffffff', borderWidth: 1 },
      emphasis: { disabled: true, scale: false },
      data: sorted.map((row, i) => ({
        name: row.label, value: row.value, itemStyle: { color: colors.get(row.key) },
        label: { show: row.key === '__other__' || i < (width < 480 ? 6 : 10) },
        labelLine: { show: row.key === '__other__' || i < (width < 480 ? 6 : 10) },
      })),
    }],
  };
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
export function bondHistoryOption(rows, dates, metric = 'price', dark = false, width = 700) {
  const base = chartBase(dark), ink = base.textStyle.color;
  const fields = metric === 'price' ? [['market_price', '市场价'], ['theoretical_price', '理论价']] : [['market_vs_theoretical_pct', '理论溢价率']];
  const map = new Map(rows.map(row => [row.model_date, row]));
  const labels = [...new Set(dates)].sort();
  const month = date => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
  const span = labels.length ? month(labels.at(-1)) - month(labels[0]) : 0;
  const capacity = Math.max(2, Math.floor((width - 80) / 85));
  const step = [1, 3, 6, 12, 24, 60].find(value => span / value <= capacity - 1) ?? 120;
  const gap = Math.ceil(Math.max(0, labels.length - 1) * 72 / Math.max(100, width - 80));
  const ticks = new Set([0, labels.length - 1]);
  labels.forEach((date, i) => {
    if (i >= gap && labels.length - 1 - i >= gap && date.slice(0, 7) !== labels[i - 1]?.slice(0, 7)
      && (month(date) - month(labels[0])) % step === 0) ticks.add(i);
  });
  return researchOption({ ...base, grid: { top: 24, left: 55, right: 16, bottom: 64 },
    tooltip: { ...base.tooltip, valueFormatter: value => finite(value) ? `${value.toFixed(2)}${metric === 'price' ? ' 元' : '%'}` : '—' },
    xAxis: { type: 'category', data: labels, boundaryGap: false, axisTick: { show: false },
      axisLine: { lineStyle: { color: ink } }, axisLabel: { color: ink, hideOverlap: true,
        interval: i => ticks.has(i), formatter: label => label.slice(0, 7) } },
    yAxis: { type: 'value', scale: metric === 'price', name: metric === 'price' ? '元' : '',
      axisLabel: { color: ink, formatter: metric === 'price' ? '{value}' : '{value}%' }, axisTick: { show: false },
      splitLine: { lineStyle: { color: dark ? '#444444' : '#e5e5e5' } } },
    series: fields.map(([key, name], i) => ({ name, type: 'line', smooth: false, showSymbol: false, connectNulls: false,
      data: labels.map(date => map.get(date)?.[key] ?? null), lineStyle: { width: 1.8 },
      itemStyle: { color: i === 0 ? '#d80012' : (dark ? '#bfbfbf' : '#7f7f7f') }, emphasis: { disabled: true } })) }, dark, width);
}
