import { researchOption } from './research-style.mjs';

// The example's four industries, mapped to each classification standard for queries.
export const INDUSTRY_HISTORY_PRESETS = {
  SW2021: ['基础化工', '电子', '医药生物', '电力设备'],
  SW2014: ['化工', '电子', '医药生物', '电气设备'],
};

const keyOf = row => row.industry_code ?? 'unclassified';
const palette = ['#d80012', '#7f7f7f', '#225395', '#8d0101', '#0c2748', '#f3a9b4', '#91a9ca'];

export function industryHistoryWindow(rows, years = 1) {
  if (!years || !rows.length) return rows;
  const latest = rows.reduce((day, row) => row.model_date > day ? row.model_date : day, '');
  const cutoff = new Date(`${latest}T00:00:00Z`);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - years);
  const start = cutoff.toISOString().slice(0, 10);
  return rows.filter(row => row.model_date >= start);
}

export function industryHistoryChoices(rows) {
  const latest = new Map();
  for (const row of rows) {
    if (row.scope !== 'industry') continue;
    const key = keyOf(row);
    if (!latest.has(key) || latest.get(key).model_date < row.model_date) latest.set(key, row);
  }
  return [...latest].sort(([a], [b]) => a.localeCompare(b)).map(([key, row]) => ({
    key, label: row.industry_name, count: row.bond_count, date: row.model_date,
  }));
}

export function industryHistoryChart(rows) {
  const choices = industryHistoryChoices(rows);
  const dates = [...new Set(rows.map(row => row.model_date))].sort();
  const series = [{ key: 'market', label: '全市场', color: '#2b2b2b' },
    ...choices.map(item => {
      // Stable industry-code color, independent of time window.
      const hash = [...item.key].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0);
      return { ...item, color: palette[hash % palette.length] };
    })].map(item => {
      const byDate = new Map(rows.filter(row => item.key === 'market' ? row.scope === 'market'
        : row.scope === 'industry' && keyOf(row) === item.key).map(row => [row.model_date, row]));
      return { ...item, data: dates.map(day => {
        const value = byDate.get(day)?.market_minus_theoretical;
        return Number.isFinite(value) ? value : null;
      }) };
    });
  return { dates, series, title: '市场价减理论价中位数（元）' };
}

export function industryHistoryLayout(view, width = 800) {
  const available = Math.max(120, width - 24), data = [];
  let used = 0, lines = 0;
  for (const item of view.series) {
    const itemWidth = 30 + [...item.label].reduce((sum, char) => sum + (char.charCodeAt(0) > 255 ? 12 : 8), 0);
    if (used && used + 16 + itemWidth > available) { data.push('\n'); used = 0; }
    if (!used) lines++;
    data.push(item.label);
    used += (used ? 16 : 0) + itemWidth;
  }
  const legendHeight = lines * 18 + Math.max(0, lines - 1) * 16;
  const bottom = 44 + legendHeight;
  return { data, bottom, height: Math.max(320, 264 + bottom) };
}

export function industryHistoryOption(view, dark = false, width = 800) {
  const ink = dark ? '#e5e5e5' : '#2b2b2b';
  const format = value => value == null ? '—' : `${Number(value).toFixed(2)} 元`;
  const colors = dark ? { '#2b2b2b': '#e5e5e5', '#7f7f7f': '#bfbfbf', '#225395': '#91a9ca', '#8d0101': '#ec8089', '#0c2748': '#6998cb' } : {};
  const layout = industryHistoryLayout(view, width);
  return researchOption({
    backgroundColor: 'transparent', animation: false, aria: { enabled: true },
    grid: { left: 64, right: 20, top: 24, bottom: layout.bottom },
    legend: { bottom: 0, left: 'center', width: Math.max(120, width - 24), padding: 0,
      data: layout.data, itemWidth: 20, itemGap: 16, textStyle: { color: ink, fontSize: 12, lineHeight: 18 } },
    tooltip: { trigger: 'axis', confine: true, valueFormatter: format, enterable: true,
      extraCssText: 'max-height:280px;overflow-y:auto;',
      backgroundColor: dark ? '#202020' : '#fff', textStyle: { color: ink },
      axisPointer: { type: 'line', lineStyle: { type: 'dashed', width: 1 } } },
    xAxis: { type: 'category', boundaryGap: false, data: view.dates,
      axisLabel: { color: ink, hideOverlap: true, formatter: value => value.slice(0, 7) },
      splitLine: { show: false } },
    yAxis: { type: 'value', scale: true,
      axisLabel: { color: ink, formatter: '{value}' },
      splitLine: { lineStyle: { type: 'solid', color: dark ? '#444444' : '#e5e5e5' } } },
    series: view.series.map(item => ({ name: item.label, type: 'line', data: item.data,
      smooth: false, connectNulls: false, showSymbol: view.dates.length === 1, symbolSize: 5,
      lineStyle: { color: colors[item.color] ?? item.color, width: item.key === 'market' ? 2.5 : 2, type: 'solid' },
      itemStyle: { color: colors[item.color] ?? item.color },
      emphasis: { focus: 'series' },
    })),
  }, dark, width);
}
