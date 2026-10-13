// Shared by the website and local Skill HTML. Data only; no HTTP or model fitting.
const RED = '#d80012';

function base(dark) {
  const ink = dark ? '#e5e5e5' : '#2b2b2b';
  const grid = dark ? '#353535' : '#e5e5e5';
  const axis = { axisLine: { lineStyle: { color: ink } }, axisTick: { show: false },
    axisLabel: { color: ink, fontSize: 12, hideOverlap: true },
    splitLine: { lineStyle: { color: grid, type: 'dashed' } } };
  return { ink, axis, option: { animation: false, aria: { enabled: true },
    textStyle: { color: ink, fontFamily: 'Arial, "Microsoft YaHei", sans-serif', fontSize: 12 },
    grid: { left: 56, right: 22, top: 18, bottom: 28 },
    tooltip: { trigger: 'axis', confine: true, transitionDuration: 0,
      backgroundColor: dark ? '#202020' : '#fff', textStyle: { color: ink },
      valueFormatter: value => `${Number(value).toFixed(2)}%` } } };
}

export function historyOption(rows, dark = false) {
  const { axis, option, ink } = base(dark);
  const verticalAxis = { ...axis, axisLine: { ...axis.axisLine, show: true, onZero: false } };
  return { ...option,
    grid: { ...option.grid, top: 28, right: 58, bottom: 60 },
    legend: { bottom: 0, textStyle: { color: ink, fontSize: 12 } },
    xAxis: { ...axis, type: 'category', boundaryGap: false,
      data: rows.map(row => row.model_date), splitLine: { show: false },
      axisLabel: { ...axis.axisLabel, showMinLabel: true, showMaxLabel: true } },
    yAxis: [
      { ...verticalAxis, type: 'value', position: 'left', scale: true, axisLabel: { ...axis.axisLabel, formatter: '{value}%' } },
      { ...verticalAxis, type: 'value', position: 'right', min: 0, minInterval: 1,
        name: '只', nameLocation: 'end', nameGap: 12,
        nameTextStyle: { color: ink, fontSize: 12, align: 'left' },
        splitLine: { show: false }, axisLabel: { ...axis.axisLabel, formatter: '{value}' } },
    ],
    series: [{ name: '百元溢价率', type: 'line', yAxisIndex: 0, z: 3, data: rows.map(row => row.premium_100),
      showSymbol: false, lineStyle: { width: 2, color: RED }, itemStyle: { color: RED },
      smooth: false, connectNulls: false,
      tooltip: { valueFormatter: value => value == null ? '—' : `${Number(value).toFixed(2)}%` },
      emphasis: { disabled: true } },
    { name: '拟合券数', type: 'line', yAxisIndex: 1, z: 1, data: rows.map(row => row.fitted_count ?? null),
      showSymbol: false, smooth: false, connectNulls: false,
      lineStyle: { width: 0 }, itemStyle: { color: '#7f7f7f' },
      areaStyle: { color: '#7f7f7f', opacity: 0.14, origin: 0 },
      tooltip: { valueFormatter: value => value == null ? '—' : `${Number(value).toFixed(0)}只` },
      emphasis: { disabled: true } }] };
}

export function curveOption(payload, dark = false) {
  const { axis, option, ink } = base(dark);
  return { ...option,
    tooltip: { ...option.tooltip, formatter: items => {
      const point = items[0]?.value;
      return point ? `平价：${Number(point[0]).toFixed(1)}元<br>转股溢价率：${Number(point[1]).toFixed(2)}%` : '';
    } },
    xAxis: { ...axis, type: 'value', min: 50, max: 150, interval: 20, splitLine: { show: false },
      axisLabel: { ...axis.axisLabel, formatter: '{value}元' } },
    yAxis: { ...axis, type: 'value', scale: true, axisLabel: { ...axis.axisLabel, formatter: '{value}%' } },
    series: [{ name: '转股溢价率', type: 'line', data: payload.curve.map(row => [row.parity, row.fitted_premium]),
      showSymbol: false, lineStyle: { width: 2, color: ink }, itemStyle: { color: ink },
      emphasis: { disabled: true },
      markLine: { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: '#7f7f7f', type: 'dashed' },
        data: [{ xAxis: 70 }, { xAxis: 100 }, { xAxis: 130 }] },
      markPoint: { symbol: 'circle', symbolSize: 8, label: { show: false }, itemStyle: { color: RED },
        data: [{ coord: [100, payload.result.premium_100] }] } }] };
}
