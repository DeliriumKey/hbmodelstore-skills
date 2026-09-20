// Shared by the website and Skill HTML export. Adapted from the earlier Brinson
// preview and duration renderers; API decimals stay nullable until presentation.
export function numeric(value) {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function formatPercent(value) {
  const n = numeric(value);
  return n === null ? '—' : `${(n * 100).toFixed(2)}%`;
}

export function formatContribution(value) {
  const n = numeric(value);
  return n === null ? '—' : `${n > 0 ? '+' : ''}${(n * 100).toFixed(2)}%`;
}

export function holdingDisplayRow(row, convertible = false) {
  const holding = {
    security_code: row.security_code,
    security_name: row.security_name,
    holding_nav_weight: row[convertible ? 'input_nav_weight' : 'portfolio_nav_weight'],
  };
  if (!row.included_in_attribution) return holding;
  return {
    ...row,
    ...holding,
    // The stock API's legacy field name stores scaled NAV weight, not market share.
    attribution_nav_weight: row[convertible ? 'attribution_nav_weight' : 'portfolio_market_weight'],
  };
}

export function holdingColumns(convertible = false) {
  return [
    [convertible ? '转债 / 正股' : '股票', 'security_name'],
    ['行业', 'industry_name'],
    ['持仓权重', 'holding_nav_weight'],
    ['归因权重', 'attribution_nav_weight'],
    [convertible ? '转债收益' : '股票收益', 'security_return'],
    ...(convertible ? [
      ['历史β', 'beta'],
      ['绝对贡献', 'actual_return_contribution'],
      ['正股行业配置', 'industry_allocation_contribution'],
      ['正股选择', 'stock_selection_contribution'],
      ['其他超额', 'other_excess_contribution'],
      ['续接', 'terminal_proxy_applied'],
    ] : [
      ['行业基准收益', 'comparison_return'],
      ['绝对贡献', 'actual_return_contribution'],
      ['选择贡献', 'excess_selection_contribution'],
    ]),
  ];
}

export const MISSING_HOLDING_INDUSTRY = '__missing_industry__';

export function holdingIndustryOptions(rows) {
  const industries = [...new Set(rows.map((row) => row.industry_name).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'zh-CN'));
  return [
    ['', '全部行业'],
    ...industries.map((industry) => [industry, industry]),
    ...(rows.some((row) => !row.industry_name) ? [[MISSING_HOLDING_INDUSTRY, '未分类']] : []),
  ];
}

export function filterHoldings(rows, query = '', industry = '') {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter((row) => {
    const matchesIndustry = !industry || (industry === MISSING_HOLDING_INDUSTRY
      ? !row.industry_name : row.industry_name === industry);
    const text = [row.security_name, row.security_code, row.underlying_code].filter(Boolean).join(' ').toLowerCase();
    return matchesIndustry && terms.every((term) => text.includes(term));
  });
}

/** @param {string | null} [field] */
export function sortHoldings(rows, field = null, descending = true) {
  const value = (row) => {
    if (field === null) {
      const contribution = numeric(row.actual_return_contribution);
      return contribution === null ? null : Math.abs(contribution);
    }
    if (field === 'security_name' || field === 'industry_name')
      return row[field] == null ? null : String(row[field]).trim() || null;
    if (field === 'terminal_proxy_applied')
      return typeof row[field] === 'boolean' ? Number(row[field]) : null;
    return numeric(row[field]);
  };
  return [...rows].sort((a, b) => {
    const left = value(a);
    const right = value(b);
    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;
    const comparison = typeof left === 'string' && typeof right === 'string'
      ? left.localeCompare(right, 'zh-CN', { numeric: true })
      : left - right;
    return descending ? -comparison : comparison;
  });
}

export function sortIndustries(rows, field = 'portfolio_market_weight', descending = true) {
  return [...rows].sort((a, b) => {
    const left = numeric(a[field]);
    const right = numeric(b[field]);
    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;
    return descending ? right - left : left - right;
  });
}

// One red overlay: zero is fully transparent, the selected market's maximum is opaque.
export function weightCellBackground(value, maximum) {
  const weight = numeric(value);
  if (weight === null || weight < 0) return undefined;
  const fraction = maximum > 0 ? Math.min(weight / maximum, 1) : 0;
  return `rgba(248, 105, 107, ${fraction})`;
}

export function industryColorLimits(rows) {
  return {
    weight: Math.max(0, ...rows.flatMap((row) => [
      numeric(row.portfolio_market_weight) ?? 0,
      numeric(row.benchmark_market_weight) ?? 0,
    ])),
    returnMagnitude: Math.max(0, ...rows.flatMap((row) => [
      Math.abs(numeric(row.portfolio_industry_return) ?? 0),
      Math.abs(numeric(row.benchmark_industry_return) ?? 0),
    ])),
  };
}

export function holdingColorLimits(rows, convertible = false) {
  return {
    weight: Math.max(0, ...rows.flatMap((row) => [
      numeric(row.holding_nav_weight) ?? 0,
      numeric(row.attribution_nav_weight) ?? 0,
    ])),
    returnMagnitude: Math.max(0, ...rows.flatMap((row) => [
      Math.abs(numeric(row.security_return) ?? 0),
      convertible ? 0 : Math.abs(numeric(row.comparison_return) ?? 0),
    ])),
  };
}

export function returnCellBackground(value, maximumMagnitude) {
  const result = numeric(value);
  if (result === null) return undefined;
  const fraction = maximumMagnitude > 0 ? Math.min(Math.abs(result) / maximumMagnitude, 1) : 0;
  const color = result < 0 ? '99, 190, 123' : '248, 105, 107';
  return `rgba(${color}, ${fraction})`;
}

export const ASSETS = [
  ['A_SHARE', 'A股'],
  ['HK', '港股'],
  ['CONVERTIBLE_BOND', '转债'],
  ['PURE_BOND', '纯债'],
];

export function assetEffects(market) {
  const rows = [['仓位配置贡献', market.allocation_effect]];
  if (market.market_code === 'CONVERTIBLE_BOND') {
    // other_effect=null is the old aggregate selection contract, not zero.
    rows.push(
      ['正股行业配置贡献', market.industry_allocation_effect],
      [
        '正股选择贡献',
        market.other_effect == null ? null : market.selection_effect,
      ],
      ['转债其他超额贡献', market.other_effect],
    );
  } else if (['A_SHARE', 'HK'].includes(market.market_code)) {
    rows.push(
      ['行业配置贡献', market.industry_allocation_effect],
      ['股票选择贡献', market.selection_effect],
    );
  }
  return rows;
}

// One column per asset; equal labels align, inapplicable or missing cells stay null.
export function assetTableRows(markets) {
  const columns = ASSETS.map(([code]) => markets.find((market) => market.market_code === code));
  const effects = columns.map((market) => new Map(market ? assetEffects(market) : []));
  return [
    ...[['实际权重', 'portfolio_weight'], ['基准权重', 'benchmark_weight']].map(([label, field]) => ({
      label,
      kind: 'weight',
      values: columns.map((market) => market?.[field] ?? null),
    })),
    ...[
      '仓位配置贡献',
      '行业配置贡献',
      '股票选择贡献',
      '正股行业配置贡献',
      '正股选择贡献',
      '转债其他超额贡献',
    ].map((label) => ({
      label,
      kind: 'contribution',
      values: effects.map((column) => column.get(label) ?? null),
    })),
  ];
}

export function assetWeightColorLimit(rows) {
  return Math.max(0, ...rows
    .filter((row) => row.kind === 'weight')
    .flatMap((row) => row.values.map((value) => numeric(value) ?? 0)));
}

export function assetContributionColorLimit(rows) {
  return Math.max(0, ...rows
    .filter((row) => row.kind === 'contribution')
    .flatMap((row) => row.values.map((value) => Math.abs(numeric(value) ?? 0))));
}

export const BRINSON_EFFECT_LABELS = Object.freeze({
  market_allocation_effect: '四资产配置',
  industry_allocation_effect: '股票行业配置',
  security_selection_effect: '股票选择',
  convertible_bond_industry_allocation_effect: '转债正股行业配置',
  convertible_bond_stock_selection_contribution: '转债正股选择',
  convertible_bond_other_excess_effect: '转债其他超额',
  residual_effect: '残差（含基准桥接）',
});

export function brinsonOption(
  kind,
  data,
  { dark = false, fundName = '基金', effectLabels = BRINSON_EFFECT_LABELS, linked = false } = {},
) {
  const ink = dark ? '#e5e5e5' : '#2b2b2b';
  const grid = dark ? '#373737' : '#e5e5e5';
  const pct = (v) => (numeric(v) === null ? null : numeric(v) * 100);
  const base = {
    animation: false,
    aria: {
      enabled: true,
      description:
        kind === 'nav'
          ? `${fundName}的实际净值、持仓拟合、行业匹配组合与模型复合基准的单期归一净值对比，起点均为1。`
          : '各已发布半年期的独立收益归因。贡献分项为正负堆叠柱，净和对应超额收益线。',
    },
    textStyle: {
      color: ink,
      fontFamily: "Arial, 'Microsoft YaHei', 'PingFang SC', sans-serif",
    },
    color: ['#c71632', '#225395', '#7f7f7f', '#8d0101', '#91a9ca'],
    grid: { top: 32, bottom: 86, left: 12, right: 18, containLabel: true },
    legend: {
      type: 'scroll',
      bottom: 0,
      textStyle: { color: ink },
      itemWidth: 14,
      itemHeight: 8,
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      renderMode: 'richText',
      valueFormatter: (v) =>
        numeric(v) === null ? '—' : Number(v).toFixed(kind === 'nav' ? 4 : 2),
    },
    xAxis: {
      type: 'category',
      axisLabel: { color: ink, hideOverlap: true },
      axisLine: { lineStyle: { color: grid } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      name: kind === 'nav' ? '' : '百分点',
      scale: kind === 'nav',
      nameTextStyle: { color: ink },
      axisLabel: { color: ink },
      splitLine: { lineStyle: { color: grid, type: 'dashed' } },
    },
    dataZoom: [
      // Retain the zoom target without intercepting the document's wheel events.
      { type: 'inside', disabled: true, zoomOnMouseWheel: false, moveOnMouseWheel: false },
      {
        type: 'slider',
        bottom: 30,
        height: 18,
        borderColor: grid,
        textStyle: { color: ink },
      },
    ],
  };
  if (kind === 'effects') {
    if (data.length !== 1) throw new Error('Contribution chart requires one selected result');
    const keys = Object.keys(effectLabels);
    const colors = {
      market_allocation_effect: base.color[0], industry_allocation_effect: base.color[1],
      security_selection_effect: base.color[2], convertible_bond_industry_allocation_effect: base.color[3],
      convertible_bond_stock_selection_contribution: '#c71632', convertible_bond_other_excess_effect: '#ec8089',
      residual_effect: base.color[4],
    };
    return {
      ...base,
      aria: { enabled: true, description: linked
        ? '连续区间的七项主动收益贡献，经过 Cariño 跨期链接；单位为百分点。'
        : `${fundName}所选半年期的七项原始主动收益贡献；单位为百分点。` },
      grid: { left: 12, right: 28, top: 24, bottom: 32, containLabel: true },
      legend: undefined, dataZoom: [],
      tooltip: { ...base.tooltip, valueFormatter: v => numeric(v) === null ? '—' : `${Number(v).toFixed(3)} pp` },
      xAxis: { ...base.yAxis, name: '', axisLabel: { ...base.yAxis.axisLabel, formatter: v => `${v} pp` } },
      yAxis: { ...base.xAxis, inverse: true, data: keys.map(k => effectLabels[k]), axisLine: { show: false } },
      series: [{ type: 'bar', barMaxWidth: 20,
        data: keys.map((k, i) => ({ value: pct(data[0][k]),
          itemStyle: { color: colors[k] ?? base.color[i % base.color.length] } })) }],
    };
  }
  if (kind === 'history') {
    const rows = [...data].sort((a, b) =>
      a.period_end.localeCompare(b.period_end),
    );
    const fields = [
      ['资产配置', 'market_allocation_effect'],
      ['股票行业配置', 'industry_allocation_effect'],
      ['股票选择', 'security_selection_effect'],
      ['转债选择合计', 'convertible_bond_selection_effect'],
      ['残差', 'residual_effect'],
    ];
    return {
      ...base,
      xAxis: {
        ...base.xAxis,
        data: rows.map((r) => r.period_end),
        boundaryGap: true,
      },
      series: [
        ...fields.map(([name, field]) => ({
          name,
          type: 'bar',
          stack: 'effects',
          barMaxWidth: 28,
          data: rows.map((r) => pct(r[field])),
        })),
        {
          name: '超额收益',
          type: 'line',
          showSymbol: true,
          symbolSize: 5,
          data: rows.map((r) => pct(r.active_return)),
          lineStyle: { color: ink, width: 1.5 },
          itemStyle: { color: ink },
        },
      ],
    };
  }
  if (kind !== 'nav') throw new Error(`Unknown Brinson chart: ${kind}`);
  const points = [...data].sort((a, b) =>
    a.trade_date.localeCompare(b.trade_date),
  );
  const fields = [
    ['实际净值', 'fund_nav_index', '#c71632'],
    ['持仓拟合', 'fitted_nav_index', '#3274a1'],
    ['行业匹配组合', 'industry_matched_nav_index', '#bd8d32'],
    ['模型复合基准', 'benchmark_nav_index', dark ? '#b5b5b5' : '#757575'],
  ];
  return {
    ...base,
    xAxis: {
      ...base.xAxis,
      data: points.map((p) => p.trade_date),
      boundaryGap: false,
      // Keep endpoint dates inside the canvas in both web and offline reports.
      axisLabel: { ...base.xAxis.axisLabel, alignMinLabel: 'left', alignMaxLabel: 'right' },
    },
    series: fields.map(([name, field, color]) => ({
      name,
      type: 'line',
      showSymbol: false,
      connectNulls: false,
      lineStyle: { width: 1.8, type: 'solid', color },
      itemStyle: { color },
      data: points.map((p) => numeric(p[field])),
    })),
  };
}

export function renderBrinsonChart({
  echarts,
  root,
  kind,
  data,
  options = {},
  ResizeObserverClass = globalThis.ResizeObserver,
}) {
  const chart = echarts.init(root, undefined, { renderer: 'canvas' });
  chart.setOption(brinsonOption(kind, data, options));
  let disposed = false;
  const observer = ResizeObserverClass
    ? new ResizeObserverClass(() => {
        if (!disposed) chart.resize();
      })
    : null;
  observer?.observe(root);
  return () => {
    disposed = true;
    observer?.disconnect();
    chart.dispose();
  };
}
