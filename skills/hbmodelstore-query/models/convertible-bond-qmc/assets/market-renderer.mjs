import { researchOption } from './research-style.mjs';
// Shared ECharts options. Consumes API aggregates; never fetches or reprices bonds.
const percent = value => value == null ? '—' : `${Number(value).toFixed(2)}%`;

function base(rows, dark) {
  const ink = dark ? '#e5e5e5' : '#2b2b2b';
  const gray = dark ? '#bfbfbf' : '#7f7f7f';
  const axis = {
    axisLine: { show: true, onZero: false, lineStyle: { color: ink } },
    axisTick: { show: false },
    axisLabel: { color: ink, fontSize: 12, hideOverlap: true },
    splitLine: { lineStyle: { color: dark ? '#444444' : '#e5e5e5', type: 'solid' } },
  };
  return { ink, gray, axis, option: {
    backgroundColor: 'transparent', animation: false, aria: { enabled: true },
    textStyle: { color: ink, fontSize: 12,
      fontFamily: 'Arial, "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", sans-serif' },
    grid: { left: 54, right: 20, top: 28, bottom: 60 },
    legend: { bottom: 0, textStyle: { color: ink, fontSize: 12 } },
    tooltip: { trigger: 'axis', confine: true, transitionDuration: 0,
      backgroundColor: dark ? '#202020' : '#fff', textStyle: { color: ink },
      axisPointer: { lineStyle: { type: 'solid', color: gray } }, valueFormatter: percent },
    xAxis: { ...axis, type: 'category', boundaryGap: false,
      data: rows.map(row => row.model_date), splitLine: { show: false },
      axisLabel: { ...axis.axisLabel, formatter: value => value.slice(0, 7) } },
    yAxis: { ...axis, type: 'value', scale: true,
      axisLabel: { ...axis.axisLabel, formatter: '{value}%' } },
  } };
}

function line(rows, field, name, color) {
  return { name, type: 'line', data: rows.map(row => row[field] ?? null),
    showSymbol: false, smooth: false, connectNulls: false, z: 3,
    lineStyle: { width: 2, color }, itemStyle: { color },
    emphasis: { disabled: true }, tooltip: { valueFormatter: percent } };
}

export function marketValuationBands(rows) {
  const bands = [];
  rows.forEach((row, index) => {
    const value = row.market_vs_theoretical_pct;
    const state = !Number.isFinite(value) ? null : value > 3 ? 'expensive' : value < -3 ? 'cheap' : null;
    if (!state) return;
    const level = Math.abs(value) > 5 ? 2 : 1;
    const last = bands.at(-1);
    if (last?.state === state && last.level === level && last.endIndex === index - 1) last.endIndex = index;
    else bands.push({ startIndex: index, endIndex: index, state, level });
  });
  return bands;
}

function valuationBackground(rows, dark) {
  const colors = { cheap: '#278a70', expensive: '#d80012' };
  return {
    type: 'custom', name: '', silent: true, z: 0,
    dimensions: ['start', 'end', 'expensive', 'level'],
    // Background intervals must not contribute to either axis's data extent.
    encode: { x: -1, y: -1 },
    data: marketValuationBands(rows).map(band => [
      band.startIndex, band.endIndex, Number(band.state === 'expensive'), band.level,
    ]),
    tooltip: { show: false }, emphasis: { disabled: true },
    renderItem: (params, api) => {
      const grid = params.coordSys;
      // Half a trading-day slot on each side keeps isolated dates visible.
      const half = rows.length > 1 ? grid.width / (rows.length - 1) / 2 : grid.width / 2;
      const left = Math.max(grid.x, api.coord([api.value(0), 0])[0] - half);
      const right = Math.min(grid.x + grid.width, api.coord([api.value(1), 0])[0] + half);
      return { type: 'rect', silent: true,
        shape: { x: left, y: grid.y, width: right - left, height: grid.height },
        style: { fill: api.value(2) ? colors.expensive : colors.cheap,
          opacity: api.value(3) === 2 ? (dark ? 0.32 : 0.20) : (dark ? 0.18 : 0.09) },
      };
    },
  };
}

export function marketValuationOption(rows, dark = false) {
  const { gray, option } = base(rows, dark);
  return researchOption({ ...option,
    aria: { enabled: true, label: { description: '蒙特卡洛理论溢价率。低于负3%为绿底色，高于正3%为红底色，低于负5%或高于正5%时底色加深；中间区间与缺失日期不着色。' } },
    legend: { ...option.legend, data: ['蒙特卡洛理论溢价率'] },
    yAxis: { ...option.yAxis,
      // Keep both observation thresholds visible even in a narrow date window.
      min: ({ min }) => !Number.isFinite(min) || min > -3 ? -5 : null,
      max: ({ max }) => !Number.isFinite(max) || max < 3 ? 5 : null },
    series: [{ ...line(rows, 'market_vs_theoretical_pct', '蒙特卡洛理论溢价率', '#d80012'),
      markLine: { silent: true, symbol: 'none', animation: false,
        lineStyle: { type: 'solid', color: gray, width: 1 },
        label: { show: false },
        data: [{ yAxis: 3 }, { yAxis: -3 }],
      } }, valuationBackground(rows, dark)],
  }, dark);
}

export function marketPremiumOption(rows, dark = false) {
  const { option } = base(rows, dark);
  return researchOption({ ...option,
    aria: { enabled: true, label: { description: '百元溢价率历史对照。底色同步蒙特卡洛理论溢价率的日期分档，绿色为偏便宜，红色为偏贵，超过正负5%的偏离使用更深底色。' } },
    legend: { ...option.legend, data: ['百元溢价率'] }, series: [
    line(rows, 'premium_100', '百元溢价率', dark ? '#91a9ca' : '#225395'),
    valuationBackground(rows, dark),
  ] }, dark);
}

export function marketGroupOption(rows, dark = false, mode = 'raw') {
  const { gray, option } = base(rows, dark);
  const relative = mode === 'relative';
  const suffix = relative ? 'relative_pp' : 'pct';
  const format = percent;
  const groups = [
    ['high', '高平底比组', '#d80012'],
    ['mid', '中平底比组', gray],
    ['low', '低平底比组', dark ? '#91a9ca' : '#225395'],
  ];
  return researchOption({ ...option,
    aria: { enabled: true, label: { description: relative
      ? '各组先扣除当日三组简单均值，再扣除此前252个模型日的自身均值。低于零表示相对自身历史便宜，数值以%展示。'
      : '原筛选样本按每日平底溢价率分为三等份，比较高、中、低平底比组的等权蒙特卡洛理论溢价率。' } },
    yAxis: { ...option.yAxis, ...(relative ? { scale: false,
      axisLabel: { ...option.yAxis.axisLabel, formatter: '{value}%' } } : {}) },
    legend: { ...option.legend, data: groups.map(([, name]) => name) },
    series: groups.map(([key, name, color], index) => ({
      ...line(rows, `${key}_${suffix}`, name, color),
      data: rows.map(row => ({ value: row[`${key}_${suffix}`] ?? null, count: row[`${key}_count`] ?? 0 })),
      tooltip: { valueFormatter: format },
      ...(index === 0 ? { markLine: { silent: true, symbol: 'none', animation: false,
        lineStyle: { type: 'solid', color: gray, width: 1 }, label: { show: false },
        data: relative ? [{ yAxis: 0 }] : [{ yAxis: 3 }, { yAxis: -3 }],
      } } : {}),
    })),
    tooltip: { ...option.tooltip, formatter: items => {
      if (!Array.isArray(items) || !items.length) return '';
      return `${items[0].axisValueLabel}<br/>` + items.map(item =>
        `${item.marker}${item.seriesName}：${format(item.value)}（${item.data.count}只）`).join('<br/>');
    } },
  }, dark);
}

export function marketSpreadOption(rows, dark = false) {
  const { ink, axis, option } = base(rows, dark);
  const yuan = value => value == null ? '—' : `${Number(value).toFixed(2)}元`;
  return researchOption({ ...option,
    tooltip: { ...option.tooltip, valueFormatter: yuan },
    yAxis: { ...option.yAxis, scale: false, name: '元', nameGap: 12,
      nameTextStyle: { color: ink, fontSize: 12 },
      axisLabel: { ...axis.axisLabel, formatter: '{value}' } },
    series: [{ ...line(rows, 'market_minus_theoretical', '平均价差', '#d80012'),
      tooltip: { valueFormatter: yuan } }],
  }, dark);
}

export function alignPremiumHistory(rows, premiumRows) {
  const byDate = new Map(premiumRows.map(row => [row.model_date, row.premium_100]));
  return rows.map(row => {
    const value = byDate.get(row.model_date);
    return { ...row, premium_100: Number.isFinite(value) ? value : null };
  });
}

export function alignVolatilityHistory(rows, volatilityRows) {
  const byDate = new Map(volatilityRows.map(row => [row.model_date, row]));
  return rows.map(row => ({ model_date: row.model_date,
    short_volatility_pct: byDate.get(row.model_date)?.short_volatility_pct ?? null,
    long_volatility_pct: byDate.get(row.model_date)?.long_volatility_pct ?? null,
  }));
}

export function marketVolatilityOption(rows, dark = false) {
  const { gray, option } = base(rows, dark);
  return researchOption({ ...option, series: [
    line(rows, 'short_volatility_pct', '短期波动率', '#d80012'),
    line(rows, 'long_volatility_pct', '长期波动率', gray),
  ] }, dark);
}

export function alignMarketMomentumHistory(marketRows, momentumRows) {
  const market = new Map(marketRows.map(row => [row.model_date, row]));
  const momentum = new Map(momentumRows.map(row => [row.model_date, row]));
  const finite = value => Number.isFinite(value) ? value : null;
  return [...new Set([...market.keys(), ...momentum.keys()])].sort().map(model_date => ({
    model_date,
    market_vs_theoretical_pct: finite(market.get(model_date)?.market_vs_theoretical_pct),
    momentum_pct: finite(momentum.get(model_date)?.momentum_pct),
  }));
}

export function marketMomentumBands(rows) {
  const bands = [];
  rows.forEach((row, index) => {
    const valuation = row.market_vs_theoretical_pct, momentum = row.momentum_pct;
    if (!Number.isFinite(valuation) || !Number.isFinite(momentum)) return;
    const state = valuation < 0 && momentum > 0 ? 'discount_rising'
      : valuation > 0 && momentum < 0 ? 'premium_falling' : null;
    if (!state) return;
    const last = bands.at(-1);
    if (last?.state === state && last.endIndex === index - 1) last.endIndex = index;
    else bands.push({ startIndex: index, endIndex: index, state });
  });
  return bands;
}

export function marketMomentumOption(rows, dark = false, width = 800) {
  const { gray, option } = base(rows, dark);
  const names = ['市场理论溢价率', '931078指数20日动量'];
  return researchOption({ ...option,
    aria: { enabled: true, label: { description:
      '市场理论溢价率与931078指数20日动量。折价且动量为正的日期用浅绿底色，溢价且动量为负的日期用浅红底色；其他组合、零值与缺失日期不着色。' } },
    legend: { ...option.legend, data: names },
    yAxis: { ...option.yAxis, scale: false },
    series: [
      { ...line(rows, 'market_vs_theoretical_pct', names[0], '#d80012'),
        markLine: { silent: true, symbol: 'none', animation: false,
          lineStyle: { type: 'solid', color: gray, width: 1 },
          label: { show: false }, data: [{ yAxis: 0 }] } },
      line(rows, 'momentum_pct', names[1], dark ? '#e5e5e5' : '#000000'),
      { type: 'custom', name: '', silent: true, z: 0,
        dimensions: ['start', 'end', 'premium_falling'], encode: { x: -1, y: -1 },
        data: marketMomentumBands(rows).map(band => [
          band.startIndex, band.endIndex, Number(band.state === 'premium_falling')]),
        tooltip: { show: false }, emphasis: { disabled: true },
        renderItem: (params, api) => {
          const grid = params.coordSys;
          const half = rows.length > 1 ? grid.width / (rows.length - 1) / 2 : grid.width / 2;
          const left = Math.max(grid.x, api.coord([api.value(0), 0])[0] - half);
          const right = Math.min(grid.x + grid.width, api.coord([api.value(1), 0])[0] + half);
          return { type: 'rect', silent: true,
            shape: { x: left, y: grid.y, width: right - left, height: grid.height },
            style: { fill: api.value(2) ? '#d80012' : '#278a70', opacity: dark ? 0.16 : 0.07 } };
        },
      },
    ],
  }, dark, width);
}

export function conversionPremiumOption(rows, dark = false) {
  const { gray, option } = base(rows, dark);
  return researchOption({ ...option, series: [
    line(rows, 'actual_conversion_premium_pct', '实际转股溢价率', '#d80012'),
    line(rows, 'theoretical_conversion_premium_pct', '理论转股溢价率', gray),
  ] }, dark);
}

export function marketWindow(rows, years) {
  if (!years || !rows.length) return rows;
  const start = new Date(`${rows.at(-1).model_date}T00:00:00Z`);
  start.setUTCFullYear(start.getUTCFullYear() - years);
  const left = start.toISOString().slice(0, 10);
  return rows.filter(row => row.model_date >= left);
}

export function marketPercentile(rows) {
  const latest = rows.at(-1)?.market_vs_theoretical_pct;
  if (!Number.isFinite(latest)) return null;
  const valid = rows.map(row => row.market_vs_theoretical_pct).filter(Number.isFinite);
  return valid.filter(value => value <= latest).length / valid.length * 100;
}
