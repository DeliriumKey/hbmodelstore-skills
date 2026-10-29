// Shared website / offline Skill chart options. No fetching or changes to calculation inputs.
import { prepareOption, theme } from '../../../assets/charts/style.mjs';

const RED = '#d80012';

export function capitalLabel(value) {
  return value >= 1e8 ? `${Number((value / 1e8).toFixed(2))} 亿元` : `${Number((value / 1e4).toFixed(2))} 万元`;
}

// The panel owns its layout; typography, axes, grids and hover styling are shared.
function panelOption(option, dark) {
  const axis = { axisTick: { show: false }, axisLabel: { hideOverlap: true } };
  const axes = input => Array.isArray(input) ? input.map(item => ({ ...axis, ...item,
    axisTick: { ...axis.axisTick, ...item.axisTick }, axisLabel: { ...axis.axisLabel, ...item.axisLabel } }))
    : { ...axis, ...input, axisLabel: { ...axis.axisLabel, ...input.axisLabel } };
  return prepareOption({
    ...option, grid: { left: 52, right: 48, top: 30, bottom: 52, ...option.grid },
    tooltip: { trigger: 'axis', ...option.tooltip },
    legend: { bottom: 0, type: 'scroll', itemWidth: 20, itemHeight: 8, ...option.legend },
    xAxis: axes(option.xAxis), yAxis: axes(option.yAxis),
  }, { dark, layout: 'preserve', dateLabels: 'preserve', barHover: 'native' }).option;
}

/** @param {number | null} focusCapital */
export function historyOption(payload, dark = false, metric = 'return', focusCapital = null) {
  const focus = focusCapital ?? payload.scenarios[0]?.capital_yuan;
  const field = metric === 'profit' ? 'profit_yuan' : 'return_pct';
  const unit = metric === 'profit' ? '万元' : '%';
  const colors = theme(dark).palette;
  const dateValue = d => Date.parse(`${d}T00:00:00Z`);
  return panelOption({ useUTC: true,
    aria: { enabled: true, label: { description: `不同规模的累计打新${metric === 'profit' ? '毛收益，单位万元' : '收益，单位百分比'}。各规模使用好买色谱的不同颜色实线，对应关系见图例。逐笔结果见发行明细。` } },
    tooltip: { valueFormatter: v => v == null ? '—' : `${Number(v).toFixed(metric === 'profit' ? 2 : 3)}${unit}` },
    legend: { selected: Object.fromEntries(payload.scenarios.map((s, i) =>
      [capitalLabel(s.capital_yuan), i < 5 || s.capital_yuan === focus])) },
    xAxis: { type: 'time', min: dateValue(payload.start), max: dateValue(payload.end),
      splitLine: { show: false }, axisLabel: {
        formatter: { year: '{yyyy}', month: '{yyyy}/{MM}', day: '{MM}/{dd}',
          hour: '{MM}/{dd}', minute: '{MM}/{dd}', second: '{MM}/{dd}', millisecond: '{MM}/{dd}' } } },
    yAxis: { type: 'value',
      ...(metric === 'profit' ? { name: unit, nameGap: 14 } : {}),
      axisLabel: {
      formatter: value => `${value}${metric === 'profit' ? '' : '%'}` } },
    series: payload.scenarios.map((s, index) => {
      const points = new Map([[payload.start, 0], ...s.history.map(p => [p.date, p[field]])]);
      if (!points.has(payload.end)) {
        const last = s.history.at(-1);
        points.set(payload.end, last ? last[field] : 0);
      }
      const active = s.capital_yuan === focus;
      const color = colors[index % colors.length];
      return { id: String(s.capital_yuan), name: capitalLabel(s.capital_yuan), type: 'line',
        step: 'end', smooth: false, connectNulls: false, showSymbol: false,
        z: active ? 5 : 1, itemStyle: { color },
        lineStyle: { color, width: active ? 2.5 : 1.5, type: 'solid' },
        data: [...points].sort(([a], [b]) => a.localeCompare(b))
          .map(([date, value]) => [dateValue(date), value == null ? null : value / (metric === 'profit' ? 1e4 : 1)]) };
    }) }, dark);
}

/**
 * Monthly profits have already been aggregated by monthlyAnalysis.
 * @param {number | null} focusCapital
 * @param {string | null} selectedMonth
 */
export function monthlyOption(payload, dark = false, focusCapital = null, selectedMonth = null) {
  const scenario = payload.scenarios.find(s => s.capital_yuan === focusCapital) ?? payload.scenarios[0];
  const countColor = dark ? '#f0f0f0' : '#111111';
  const filledColor = dark ? '#bfbfbf' : '#7f7f7f';
  const selectedIndex = payload.months.indexOf(selectedMonth);
  const selection = { silent: true, z: 0, label: { show: false },
    itemStyle: { color: dark ? '#333333' : '#ededed', opacity: 1 },
    data: selectedIndex < 0 ? [] : [[{ xAxis: selectedIndex }, { xAxis: selectedIndex }]] };
  return panelOption({
    aria: { enabled: true, label: { description: `${capitalLabel(scenario.capital_yuan)}的逐月打新收益与项目数量。收益按未打满和打满拆为堆叠柱，未打满为红色、打满为好买灰色，左轴单位百分比；深色主题打满用浅灰色。正负收益分别从零轴延伸，两部分相加为当月收益。折线为参与计算的上市项目数，右轴单位个。选中月份以灰色背景标示。点击月份或绘图区空白处查看发行明细。` } },
    tooltip: { axisPointer: { type: 'shadow' }, formatter: params => {
      const points = Array.isArray(params) ? params : [params];
      if (!points.length) return '';
      const percent = value => value == null ? '—' : `${Number(value).toFixed(3)}%`;
      const lines = points.map(point => `${point.marker ?? ''}${point.seriesName}：${point.seriesId === 'issue-count'
        ? point.value == null ? '—' : `${point.value} 个` : percent(point.value)}`);
      const total = scenario.monthly[points[0].dataIndex]?.return_pct;
      return [points[0].axisValueLabel, ...lines, `合计收益：${percent(total)}`].join('<br/>');
    } },
    legend: { selected: { '未打满（左轴）': true, '打满（左轴）': true, '项目数量（右轴）': true } },
    xAxis: { type: 'category', triggerEvent: true,
      data: payload.months.map(month => month.replace('-', '/')),
      axisTick: { show: false, interval: 0 },
      splitLine: { show: false } },
    yAxis: [{ type: 'value', axisLabel: { formatter: '{value}%' } },
      { type: 'value', min: 0, minInterval: 1, splitLine: { show: false },
        name: '个', nameGap: 14,
        axisLabel: { formatter: '{value}' } }],
    series: [{
      id: 'monthly-return', name: '未打满（左轴）', type: 'bar',
      stack: 'monthly-return', stackStrategy: 'samesign',
      barMaxWidth: 24, itemStyle: { color: RED, opacity: 1 }, markArea: selection,
      data: scenario.monthly.map(point => point.unfilled_return_pct),
      tooltip: { valueFormatter: value => value == null ? '—' : `${Number(value).toFixed(3)}%` },
    }, {
      id: 'monthly-return-filled', name: '打满（左轴）', type: 'bar',
      stack: 'monthly-return', stackStrategy: 'samesign',
      barMaxWidth: 24, itemStyle: { color: filledColor, opacity: 1 }, markArea: selection,
      data: scenario.monthly.map(point => point.filled_return_pct),
      tooltip: { valueFormatter: value => value == null ? '—' : `${Number(value).toFixed(3)}%` },
    }, { id: 'issue-count', name: '项目数量（右轴）', type: 'line', yAxisIndex: 1,
      smooth: false, connectNulls: false, showSymbol: true, symbolSize: 4, z: 6,
      itemStyle: { color: countColor, opacity: 1 }, lineStyle: { color: countColor, width: 1.5, opacity: 1 },
      data: payload.counts, tooltip: { valueFormatter: value => value == null ? '—' : `${value} 个` } }],
  }, dark);
}

export function scaleOption(payload, dark = false) {
  return panelOption({ grid: { right: 68, bottom: 58 },
    xAxis: { type: 'category', data: payload.scenarios.map(s => capitalLabel(s.capital_yuan)), splitLine: { show: false } },
    yAxis: [{ type: 'value', name: '万元' },
      { type: 'value', axisLabel: { formatter: '{value}%' }, splitLine: { show: false } }],
    series: [{ name: '理论毛收益', type: 'bar', barMaxWidth: 46, itemStyle: { color: RED },
      data: payload.scenarios.map(s => s.profit_yuan / 1e4),
      tooltip: { valueFormatter: v => `${Number(v).toFixed(2)} 万元` } },
    { name: '打新贡献', type: 'line', yAxisIndex: 1, itemStyle: { color: '#7f7f7f' },
      data: payload.scenarios.map(s => s.return_pct),
      tooltip: { valueFormatter: v => `${Number(v).toFixed(3)}%` } }] }, dark);
}
