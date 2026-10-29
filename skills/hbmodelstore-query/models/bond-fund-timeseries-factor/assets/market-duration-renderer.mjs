import { prepareOption } from '../../../assets/charts/style.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_THEME = Object.freeze({
  red: '#d80012',
  blue: '#225395',
  ink: '#2b2b2b',
  muted: '#7f7f7f',
  dispersion: '#a7a7a7',
  dispersionFill: '#c4c4c4',
  gridLine: '#e5e5e5',
  surface: '#fff',
  fontFamily:
    'Arial, "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", sans-serif',
});

const SERIES_LABELS = Object.freeze({
  long_term: '中长期纯债',
  short_term: '短期纯债',
  credit: '信用债基金',
  rate: '利率债基金',
  long_term_credit: '中长期纯债 · 信用债基金',
  long_term_rate: '中长期纯债 · 利率债基金',
  short_term_credit: '短期纯债 · 信用债基金',
});

function numeric(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateAtPercent(dates, percent) {
  const bounded = Math.min(100, Math.max(0, percent));
  const index = Math.round(((dates.length - 1) * bounded) / 100);
  return Date.parse(`${dates[index]}T00:00:00Z`);
}

function dateLabelMode(dates, startPercent, endPercent) {
  if (dates.length < 2) return 'day';
  const start = dateAtPercent(dates, Math.min(startPercent, endPercent));
  const end = dateAtPercent(dates, Math.max(startPercent, endPercent));
  const visibleDays = Math.abs(end - start) / DAY_MS;
  if (!Number.isFinite(visibleDays) || visibleDays <= 45) return 'day';
  if (visibleDays <= 180) return 'month-day';
  return 'month';
}

function formatDateLabel(value, mode) {
  const date = String(value);
  if (mode === 'day') return date.slice(0, 10);
  if (mode === 'month-day') return date.slice(5, 10);
  return date.slice(0, 7);
}

export function marketDurationSeriesLabel(series) {
  return SERIES_LABELS[series?.series_key] ?? String(series?.series_key ?? '');
}

export function renderMarketDurationChart({
  echarts,
  root,
  series,
  theme: themeOverrides = {},
  dark = root?.ownerDocument?.documentElement.classList.contains('dark') ?? false,
  ResizeObserverClass = globalThis.ResizeObserver,
}) {
  if (!echarts?.init) throw new Error('an ECharts implementation is required');
  if (!root) throw new Error('a chart root is required');

  const modelPoints = Array.isArray(series?.points) ? series.points : [];
  const disclosedPoints = Array.isArray(series?.disclosed_points)
    ? series.disclosed_points
    : [];
  const allDates = Array.from(
    new Set([
      ...modelPoints.map((point) => point.model_date),
      ...disclosedPoints.map((point) => point.report_date),
    ]),
  ).sort();
  if (allDates.length === 0) {
    root.textContent = '指定区间暂无已发布结果';
    return () => {};
  }

  const theme = { ...DEFAULT_THEME, ...themeOverrides };
  const modelByDate = new Map(
    modelPoints.map((point) => [point.model_date, point]),
  );
  const labelMode = dateLabelMode(allDates, 0, 100);
  const labelFormatter = (value) => formatDateLabel(value, labelMode);
  const chart = echarts.init(root, undefined, { renderer: 'canvas' });

  const original = {
    animation: false,
    aria: {
      enabled: true,
      description: `${marketDurationSeriesLabel(series)}修正久期中位数历史`,
    },
    textStyle: { color: theme.ink, fontFamily: theme.fontFamily },
    legend: {
      left: 'center', bottom: 8, itemWidth: 18, itemHeight: 8,
      data: ['模型中位数', '报告期披露中位数', '久期分散度'],
    },
    grid: { left: 52, right: 16, top: 18, bottom: 36 },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'line',
        lineStyle: { color: theme.muted, type: 'dashed' },
      },
      formatter: (items) => {
        const values = Array.isArray(items) ? items : [];
        const lines = [values[0]?.axisValueLabel ?? ''];
        for (const item of values) {
          const raw = Array.isArray(item.value) ? item.value[1] : item.value;
          const value = numeric(raw);
          if (value === null) continue;
          if (item.seriesName === '久期分散度') {
            const q25 = numeric(item.data?.q25);
            const q75 = numeric(item.data?.q75);
            const interval = q25 === null || q75 === null
              ? ''
              : ` · Q25 ${q25.toFixed(3)} · Q75 ${q75.toFixed(3)}`;
            lines.push(
              `${item.marker ?? ''}久期分散度 <b>${value.toFixed(3)} 年</b>${interval}`,
            );
            continue;
          }
          const count = Number(item.data?.fundCount ?? 0);
          const label = item.seriesName === '模型中位数'
            ? '模型中位数'
            : '报告期披露中位数';
          lines.push(
            `${item.marker ?? ''}${label} <b>${value.toFixed(3)} 年</b> · ${count} 只`,
          );
        }
        return lines.join('<br>');
      },
    },
    xAxis: {
      type: 'category',
      data: allDates,
      boundaryGap: true,
      axisLine: { lineStyle: { color: theme.ink } },
      axisTick: { show: false },
      axisLabel: {
        color: theme.ink,
        fontFamily: 'Arial',
        fontSize: 12,
        hideOverlap: true,
        formatter: labelFormatter,
      },
    },
    yAxis: [
      {
        type: 'value',
        scale: true,
        name: '久期（年）',
        nameGap: 15,
        nameTextStyle: { color: theme.ink, lineHeight: 14 },
        axisLine: { show: true, lineStyle: { color: theme.ink } },
        axisLabel: { color: theme.muted },
        splitLine: { lineStyle: { color: theme.gridLine } },
      },
      {
        type: 'value',
        min: 0,
        scale: true,
        name: 'IQR（年）',
        nameGap: 15,
        nameTextStyle: { color: theme.muted, lineHeight: 14 },
        axisLine: { show: true, lineStyle: { color: theme.dispersion } },
        axisLabel: { color: theme.muted },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '久期分散度',
        type: 'line',
        yAxisIndex: 1,
        data: allDates.map((date) => {
          const point = modelByDate.get(date);
          const value = numeric(point?.iqr_modified_duration);
          if (value === null) return null;
          return {
            value,
            q25: numeric(point?.q25_modified_duration),
            q75: numeric(point?.q75_modified_duration),
          };
        }),
        showSymbol: false,
        connectNulls: true,
        sampling: 'lttb',
        silent: false,
        lineStyle: { opacity: 0 },
        areaStyle: { color: theme.dispersionFill, opacity: 0.5 },
        itemStyle: { color: theme.dispersion },
        z: 0,
      },
      {
        name: '模型中位数',
        type: 'line',
        data: allDates.map((date) => {
          const point = modelByDate.get(date);
          const value = numeric(point?.median_modified_duration);
          if (value === null) return null;
          return { value, fundCount: Number(point?.fund_count ?? 0) };
        }),
        showSymbol: false,
        connectNulls: true,
        sampling: 'lttb',
        lineStyle: { color: theme.red, width: 1.5 },
        itemStyle: { color: theme.red },
        z: 3,
      },
      {
        name: '报告期披露中位数',
        type: 'scatter',
        data: disclosedPoints.map((point) => ({
          value: [point.report_date, numeric(point.median_disclosed_duration)],
          fundCount: Number(point.fund_count ?? 0),
        })),
        symbol: 'circle',
        symbolSize: 8,
        itemStyle: {
          color: theme.blue,
          borderColor: theme.surface,
          borderWidth: 1,
        },
        z: 5,
      },
    ],
  };
  const draw = () => {
    const option = prepareOption(original, {
      dark, width: root.clientWidth || 800, layout: 'auto',
      dateLabels: 'preserve', colorMode: 'preserve',
    }).option;
    option.grid.bottom = Math.max(65, option.grid.bottom);
    const selected = chart.getOption?.()?.legend?.[0]?.selected;
    if (selected) option.legend.selected = selected;
    chart.setOption(option);
  };
  draw();

  const charts = [chart];
  const chartRoots = [root];
  let disposed = false;
  const observers = ResizeObserverClass
    ? charts.map((observedChart, index) => {
        const observer = new ResizeObserverClass(() => {
          if (!disposed && !observedChart.isDisposed()) {
            observedChart.resize();
            draw();
          }
        });
        observer.observe(chartRoots[index]);
        return observer;
      })
    : [];

  return () => {
    if (disposed) return;
    disposed = true;
    observers.forEach((observer) => observer.disconnect());
    charts.forEach((sourceChart) => {
      if (!sourceChart.isDisposed()) sourceChart.dispose();
    });
  };
}
