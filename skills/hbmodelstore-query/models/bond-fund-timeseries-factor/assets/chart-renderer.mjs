const CREDIT_FUND = '信用债基金';
const RATE_FUND = '利率债基金';

const DEFAULT_THEME = Object.freeze({
  red: '#c71632',
  blue: '#225395',
  ink: '#2b2b2b',
  muted: '#7f7f7f',
  gridLine: '#e5e5e5',
  surface: '#fff',
  creditMid: '#f3a9b4',
  rateMid: '#91a9ca',
  fontFamily:
    'Arial, "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", sans-serif',
});

export const TERM_EXPOSURE_ROWS = Object.freeze([
  Object.freeze(['beta_0', '0Y', '期限 β']),
  Object.freeze(['beta_1', '1Y', '期限 β']),
  Object.freeze(['beta_3', '3Y', '期限 β']),
  Object.freeze(['beta_10', '10Y', '期限 β']),
  Object.freeze(['beta_30', '30Y', '期限 β']),
]);

export const SPREAD_EXPOSURE_ROWS = Object.freeze([
  Object.freeze(['gamma_policy', '政策性\n金融债', '利差 γ']),
  Object.freeze(['gamma_secondary', '二级\n资本债', '利差 γ']),
  Object.freeze(['gamma_high_grade_credit', '高评级\n信用债', '利差 γ']),
  Object.freeze(['gamma_low_grade_credit', '低评级\n信用债', '利差 γ']),
]);

const DAY_MS = 24 * 60 * 60 * 1000;
const FULL_DATE_THRESHOLD_DAYS = 45;
const MONTH_DAY_THRESHOLD_DAYS = 180;
const SUPPORTED_CHART_KINDS = new Set([
  'duration',
  'term-exposure',
  'spread-exposure',
]);

function dateAtPercent(dates, percent) {
  const bounded = Math.min(100, Math.max(0, percent));
  const index = Math.round(((dates.length - 1) * bounded) / 100);
  return Date.parse(`${dates[index]}T00:00:00Z`);
}

export function chartDateLabelMode(dates, startPercent, endPercent) {
  if (dates.length < 2) return 'day';

  const start = dateAtPercent(dates, Math.min(startPercent, endPercent));
  const end = dateAtPercent(dates, Math.max(startPercent, endPercent));
  const visibleDays = Math.abs(end - start) / DAY_MS;

  if (!Number.isFinite(visibleDays) || visibleDays <= FULL_DATE_THRESHOLD_DAYS) {
    return 'day';
  }
  if (visibleDays <= MONTH_DAY_THRESHOLD_DAYS) return 'month-day';
  return 'month';
}

export function formatChartDateLabel(value, mode) {
  const date = String(value);
  if (mode === 'day') return date.slice(0, 10);
  if (mode === 'month-day') return date.slice(5, 10);
  return date.slice(0, 7);
}

function numeric(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function rootFor(roots, kind) {
  const root = roots[kind];
  if (!root) throw new Error(`missing chart root for ${kind}`);
  return root;
}

function validateChartKinds(chartKinds) {
  if (!Array.isArray(chartKinds) || chartKinds.length === 0) {
    throw new Error('chartKinds must contain at least one chart');
  }
  if (new Set(chartKinds).size !== chartKinds.length) {
    throw new Error('chartKinds must not contain duplicates');
  }
  for (const kind of chartKinds) {
    if (!SUPPORTED_CHART_KINDS.has(kind)) {
      throw new Error(`unsupported chart kind: ${kind}`);
    }
  }
}

function readZoomRange(chart) {
  const option = chart.getOption();
  const dataZoom = Array.isArray(option.dataZoom) ? option.dataZoom[0] : undefined;
  return {
    start: typeof dataZoom?.start === 'number' ? dataZoom.start : 0,
    end: typeof dataZoom?.end === 'number' ? dataZoom.end : 100,
  };
}

/**
 * Render the published duration and factor-exposure charts.
 *
 * The caller owns data fetching and the surrounding UI. It supplies an ECharts
 * implementation and one DOM root for every requested chart. The returned
 * function removes listeners, observers, chart connections and instances.
 */
export function renderBondFundCharts({
  echarts,
  roots,
  zoomRoot,
  history,
  disclosed,
  chartKinds = ['duration', 'term-exposure', 'spread-exposure'],
  groupId = 'hbmodelstore-chart-sync',
  theme: themeOverrides = {},
  ResizeObserverClass = globalThis.ResizeObserver,
}) {
  if (!echarts?.init) throw new Error('an ECharts implementation is required');
  validateChartKinds(chartKinds);

  const source = Array.isArray(history?.points) ? history.points : [];
  const requestedRoots = chartKinds.map((kind) => rootFor(roots, kind));
  if (source.length === 0) {
    requestedRoots.forEach((root) => {
      root.textContent = '指定区间暂无已发布结果';
    });
    return () => {};
  }

  const theme = { ...DEFAULT_THEME, ...themeOverrides };
  const disclosedPoints = (Array.isArray(disclosed?.points) ? disclosed.points : []).filter(
    (point) => !point.anomaly_flag && numeric(point.disclosed_duration) !== null,
  );
  const includeDisclosed = chartKinds.includes('duration');
  const allDates = Array.from(
    new Set([
      ...source.map((point) => point.model_date),
      ...(includeDisclosed ? disclosedPoints.map((point) => point.report_date) : []),
    ]),
  ).sort();
  const dateIndex = new Map(allDates.map((value, index) => [value, index]));
  let dateLabelMode = chartDateLabelMode(allDates, 0, 100);
  const dateLabelFormatter = (value) => formatChartDateLabel(value, dateLabelMode);
  const xAxis = () => ({
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
      formatter: dateLabelFormatter,
    },
  });
  const zoom = () => [
    {
      type: 'inside',
      xAxisIndex: 0,
      filterMode: 'none',
      zoomOnMouseWheel: false,
      moveOnMouseWheel: false,
    },
  ];
  const charts = [];
  const chartRoots = [];
  const observers = [];
  let disposed = false;

  function chartIsDisposed(chart) {
    return typeof chart.isDisposed === 'function' && chart.isDisposed();
  }

  function buildZoomControl() {
    if (!zoomRoot) return;

    const chart = echarts.init(zoomRoot, undefined, { renderer: 'canvas' });
    chart.setOption({
      animation: false,
      aria: { enabled: false },
      grid: { left: 52, right: 16, top: 0, bottom: 0 },
      xAxis: {
        type: 'category',
        data: allDates,
        boundaryGap: true,
        show: false,
      },
      yAxis: { type: 'value', show: false },
      dataZoom: [
        {
          type: 'slider',
          xAxisIndex: 0,
          filterMode: 'none',
          top: 4,
          left: 88,
          right: 88,
          height: 16,
          showDataShadow: false,
          showDetail: true,
          labelFormatter: (_value, valueString) => valueString,
          brushSelect: false,
          borderColor: 'transparent',
          backgroundColor: theme.gridLine,
          fillerColor: `${theme.red}22`,
          handleSize: '90%',
          handleStyle: {
            color: theme.surface,
            borderColor: theme.red,
            borderWidth: 1,
          },
          moveHandleStyle: { color: theme.red, opacity: 0.45 },
          emphasis: {
            handleStyle: { color: theme.surface, borderColor: theme.red },
            moveHandleStyle: { color: theme.red, opacity: 0.65 },
          },
        },
      ],
      series: [
        {
          type: 'line',
          data: allDates.map(() => 0),
          showSymbol: false,
          silent: true,
          lineStyle: { opacity: 0 },
        },
      ],
    });
    charts.push(chart);
    chartRoots.push(zoomRoot);
  }

  function buildDuration() {
    const durationValues = new Map(
      source
        .map((point) => [point.model_date, numeric(point.estimated_modified_duration)])
        .filter((entry) => entry[1] !== null),
    );
    const chart = echarts.init(rootFor(roots, 'duration'), undefined, {
      renderer: 'canvas',
    });
    chart.setOption({
      animation: false,
      aria: {
        enabled: true,
        description: '单只基金估算修正久期与报告期披露久期历史',
      },
      textStyle: { color: theme.ink, fontFamily: theme.fontFamily },
      grid: { left: 52, right: 16, top: 18, bottom: 35 },
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
            if (!Number.isFinite(Number(raw))) continue;
            const label = item.seriesName === '30 日模型估计' ? '模型估计' : '披露久期';
            lines.push(
              `${item.marker ?? ''}${label} <b>${Number(raw).toFixed(3)} 年</b>`,
            );
          }
          return lines.join('<br>');
        },
      },
      xAxis: xAxis(),
      yAxis: {
        type: 'value',
        scale: true,
        name: '年',
        nameGap: 15,
        nameTextStyle: { color: theme.ink },
        axisLine: { show: true, lineStyle: { color: theme.ink } },
        axisLabel: { color: theme.muted },
        splitLine: { lineStyle: { color: theme.gridLine } },
      },
      dataZoom: zoom(),
      series: [
        {
          name: '30 日模型估计',
          type: 'line',
          data: allDates.map((date) => durationValues.get(date) ?? null),
          showSymbol: false,
          smooth: false,
          sampling: 'lttb',
          lineStyle: { color: theme.red, width: 1.5 },
          itemStyle: { color: theme.red },
          connectNulls: true,
        },
        {
          name: '报告期披露久期',
          type: 'scatter',
          data: disclosedPoints.map((point) => [
            point.report_date,
            numeric(point.disclosed_duration),
          ]),
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
    });
    charts.push(chart);
    chartRoots.push(rootFor(roots, 'duration'));
  }

  function makeHeat(rows, sampleType) {
    const heat = [];
    rows.forEach((row, rowIndex) => {
      source.forEach((point) => {
        if (point.sample_type !== sampleType) return;
        const value = numeric(point[row[0]]);
        const item = {
          value: [
            dateIndex.get(point.model_date),
            rowIndex,
            Math.max(0, value ?? 0),
            value,
          ],
        };
        if (value === null) item.itemStyle = { color: theme.surface };
        heat.push(item);
      });
    });
    return heat;
  }

  function buildExposure(kind) {
    const term = kind === 'term-exposure';
    const rows = term ? TERM_EXPOSURE_ROWS : SPREAD_EXPOSURE_ROWS;
    const maxValue = term ? 1 : 1.5;
    const chart = echarts.init(rootFor(roots, kind), undefined, {
      renderer: 'canvas',
    });
    chart.setOption({
      animation: false,
      aria: {
        enabled: true,
        description: `单只基金三十日模型${term ? '期限' : '利差'}暴露热力图`,
      },
      textStyle: { color: theme.ink, fontFamily: theme.fontFamily },
      grid: { left: 52, right: 16, top: 24, bottom: 38 },
      tooltip: {
        position: 'top',
        formatter: (item) => {
          const row = rows[item.value[1]];
          const exposure = item.value[3];
          return `${allDates[item.value[0]]}<br>${item.seriesName}<br>${row[2]} · ${row[1].replace('\n', '')}<br><b>${
            exposure === null ? '无有效暴露' : `暴露 ${Number(exposure).toFixed(3)}`
          }</b>`;
        },
      },
      xAxis: xAxis(),
      yAxis: {
        type: 'category',
        data: rows.map((row) => row[1]),
        inverse: true,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: theme.ink,
          fontFamily: theme.fontFamily,
          fontSize: 12,
          lineHeight: 14,
        },
      },
      visualMap: [
        {
          min: 0,
          max: maxValue,
          dimension: 2,
          seriesIndex: 0,
          show: false,
          inRange: { color: [theme.surface, theme.creditMid, theme.red] },
        },
        {
          min: 0,
          max: maxValue,
          dimension: 2,
          seriesIndex: 1,
          show: false,
          inRange: { color: [theme.surface, theme.rateMid, theme.blue] },
        },
      ],
      dataZoom: zoom(),
      series: [
        {
          name: CREDIT_FUND,
          type: 'heatmap',
          data: makeHeat(rows, CREDIT_FUND),
          progressive: 5000,
          itemStyle: { borderWidth: 0 },
          emphasis: { itemStyle: { borderColor: theme.ink, borderWidth: 1 } },
        },
        {
          name: RATE_FUND,
          type: 'heatmap',
          data: makeHeat(rows, RATE_FUND),
          progressive: 5000,
          itemStyle: { borderWidth: 0 },
          emphasis: { itemStyle: { borderColor: theme.ink, borderWidth: 1 } },
        },
      ],
    });
    charts.push(chart);
    chartRoots.push(rootFor(roots, kind));
  }

  buildZoomControl();
  chartKinds.forEach((kind) => {
    if (kind === 'duration') buildDuration();
    else buildExposure(kind);
  });

  const connected = charts.length > 1;
  if (connected) {
    charts.forEach((chart) => {
      chart.group = groupId;
    });
    echarts.connect(groupId);
  }

  const zoomHandlers = charts.map((chart) => {
    const handler = () => {
      if (disposed || chartIsDisposed(chart)) return;
      const { start, end } = readZoomRange(chart);
      const nextMode = chartDateLabelMode(allDates, start, end);
      if (nextMode === dateLabelMode) return;

      dateLabelMode = nextMode;
      charts.forEach((connectedChart) => {
        connectedChart.setOption({
          xAxis: { axisLabel: { formatter: dateLabelFormatter } },
        });
      });
    };
    chart.on('datazoom', handler);
    return { chart, handler };
  });

  if (ResizeObserverClass) {
    charts.forEach((chart, index) => {
      const observer = new ResizeObserverClass(() => {
        if (!disposed && !chartIsDisposed(chart)) chart.resize();
      });
      observer.observe(chartRoots[index]);
      observers.push(observer);
    });
  }

  return () => {
    if (disposed) return;
    disposed = true;
    observers.forEach((observer) => observer.disconnect());
    zoomHandlers.forEach(({ chart, handler }) => {
      if (!chartIsDisposed(chart)) chart.off('datazoom', handler);
    });
    if (connected) echarts.disconnect(groupId);
    charts.forEach((chart) => {
      if (!chartIsDisposed(chart)) chart.dispose();
    });
  };
}
