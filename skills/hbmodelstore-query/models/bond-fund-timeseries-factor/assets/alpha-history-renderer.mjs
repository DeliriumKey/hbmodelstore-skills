import {
  chartDateLabelMode,
  formatChartDateLabel,
} from './chart-renderer.mjs';

const DEFAULT_THEME = Object.freeze({
  red: '#c71632',
  darkBlue: '#0c2748',
  blue: '#225395',
  ink: '#2b2b2b',
  muted: '#7f7f7f',
  gridLine: '#e5e5e5',
  surface: '#ffffff',
  creditMid: '#f3a9b4',
  rateMid: '#91a9ca',
  fontFamily:
    'Arial, "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", sans-serif',
});

const GAMMA_ROWS = Object.freeze([
  Object.freeze(['gamma_policy', '政金债']),
  Object.freeze(['gamma_secondary', '二级资本债']),
  Object.freeze(['gamma_cpnote', '票据信用']),
  Object.freeze(['gamma_rating_aa_plus', 'AA+评级']),
]);

function numeric(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formalScore(point) {
  const longRank = numeric(point.alpha_rank) ?? 0;
  const recentRank = numeric(point.recent_state_rank) ?? 0;
  return point.sample_type === '信用债基金'
    ? 0.75 * longRank + 0.25 * recentRank
    : longRank;
}

function chartIsDisposed(chart) {
  return typeof chart.isDisposed === 'function' && chart.isDisposed();
}

function readZoomRange(chart) {
  const zoom = chart.getOption?.()?.dataZoom?.[0] ?? {};
  return {
    start: Number.isFinite(Number(zoom.start)) ? Number(zoom.start) : 0,
    end: Number.isFinite(Number(zoom.end)) ? Number(zoom.end) : 100,
  };
}

export function renderAlphaHistoryCharts({
  echarts,
  roots,
  zoomRoot,
  history,
  groupId = 'hbmodelstore-alpha-history',
  themeOverrides = {},
  ResizeObserverClass = globalThis.ResizeObserver,
}) {
  if (!echarts?.init) throw new Error('an ECharts implementation is required');
  if (!zoomRoot) throw new Error('missing Alpha history zoom root');
  for (const kind of ['signal', 'duration', 'gamma']) {
    if (!roots?.[kind]) throw new Error(`missing Alpha history root: ${kind}`);
  }

  const points = Array.isArray(history?.points) ? history.points : [];
  if (points.length === 0) {
    Object.values(roots).forEach((root) => {
      root.textContent = '指定区间暂无已发布结果';
    });
    return () => {};
  }

  const theme = { ...DEFAULT_THEME, ...themeOverrides };
  const dates = points.map((point) => point.model_date);
  let dateLabelMode = chartDateLabelMode(dates, 0, 100);
  const dateLabelFormatter = (value) =>
    formatChartDateLabel(value, dateLabelMode);
  const xAxis = (boundaryGap = false) => ({
    type: 'category',
    data: dates,
    boundaryGap,
    axisLine: { lineStyle: { color: theme.ink } },
    axisTick: { show: false },
    axisLabel: {
      color: theme.ink,
      fontFamily: 'Arial',
      fontSize: 11,
      hideOverlap: true,
      formatter: dateLabelFormatter,
    },
  });
  const insideZoom = () => [
    {
      type: 'inside',
      xAxisIndex: 0,
      filterMode: 'none',
      start: 0,
      end: 100,
      zoomOnMouseWheel: false,
      moveOnMouseWheel: false,
    },
  ];
  const charts = [];
  const chartRoots = [];
  const observers = [];
  let disposed = false;

  function register(chart, root) {
    charts.push(chart);
    chartRoots.push(root);
  }

  const zoomChart = echarts.init(zoomRoot, undefined, { renderer: 'canvas' });
  zoomChart.setOption({
    animation: false,
    aria: { enabled: false },
    grid: { left: 0, right: 0, top: 0, bottom: 0 },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
      show: false,
    },
    yAxis: { type: 'value', show: false },
    dataZoom: [
      {
        type: 'slider',
        xAxisIndex: 0,
        filterMode: 'none',
        start: 0,
        end: 100,
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
        data: dates.map(() => 0),
        showSymbol: false,
        silent: true,
        lineStyle: { opacity: 0 },
      },
    ],
  });
  register(zoomChart, zoomRoot);

  const signalChart = echarts.init(roots.signal, undefined, {
    renderer: 'canvas',
  });
  signalChart.setOption({
    animation: false,
    aria: {
      enabled: true,
      description: '单只基金长期 Alpha、近期残差及同组排名历史',
    },
    textStyle: { color: theme.ink, fontFamily: theme.fontFamily, fontSize: 12 },
    legend: {
      top: 0,
      left: 0,
      itemWidth: 18,
      itemHeight: 8,
      itemGap: 14,
      selected: {
        '240日排名': false,
        '60日排名': false,
      },
      textStyle: { color: theme.ink, fontFamily: theme.fontFamily, fontSize: 11 },
    },
    grid: { left: 12, right: 12, top: 48, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      confine: true,
      formatter: (params) => {
        const list = Array.isArray(params) ? params : [];
        const index = Number(list[0]?.dataIndex ?? 0);
        const point = points[index];
        if (!point) return '';
        return [
          `<strong>${point.model_date}</strong>`,
          `${point.sample_type} · Q${point.duration_bucket}`,
          `240日 Alpha：${((numeric(point.alpha_daily) ?? 0) * 10_000).toFixed(2)} bp/日`,
          `60日残差：${((numeric(point.recent_residual_mean_60) ?? 0) * 10_000).toFixed(2)} bp/日`,
          `240日排名：${((numeric(point.alpha_rank) ?? 0) * 100).toFixed(1)}%`,
          `60日排名：${((numeric(point.recent_state_rank) ?? 0) * 100).toFixed(1)}%`,
          `正式得分：${(formalScore(point) * 100).toFixed(1)}%`,
        ].join('<br/>');
      },
    },
    xAxis: xAxis(),
    yAxis: [
      {
        type: 'value',
        name: 'bp/日',
        scale: true,
        axisLine: { show: true, lineStyle: { color: theme.ink } },
        axisLabel: { color: theme.muted, fontSize: 11 },
        splitLine: { lineStyle: { color: theme.gridLine, type: 'dashed' } },
      },
      {
        type: 'value',
        name: '排名',
        min: 0,
        max: 100,
        axisLine: { show: true, lineStyle: { color: theme.ink } },
        axisLabel: { formatter: '{value}%', color: theme.muted, fontSize: 11 },
        splitLine: { show: false },
      },
    ],
    dataZoom: insideZoom(),
    series: [
      {
        name: '240日 Alpha',
        type: 'line',
        showSymbol: false,
        lineStyle: { color: theme.darkBlue, width: 1.6, opacity: 0.76 },
        itemStyle: { color: theme.darkBlue },
        data: points.map((point) => (numeric(point.alpha_daily) ?? 0) * 10_000),
      },
      {
        name: '60日残差',
        type: 'line',
        showSymbol: false,
        lineStyle: { color: theme.blue, width: 1.4, opacity: 0.72 },
        itemStyle: { color: theme.blue },
        data: points.map(
          (point) => (numeric(point.recent_residual_mean_60) ?? 0) * 10_000,
        ),
      },
      {
        name: '240日排名',
        type: 'line',
        yAxisIndex: 1,
        showSymbol: false,
        lineStyle: {
          color: theme.darkBlue,
          width: 1.1,
          type: 'dashed',
          opacity: 0.42,
        },
        itemStyle: { color: theme.darkBlue },
        data: points.map((point) => (numeric(point.alpha_rank) ?? 0) * 100),
      },
      {
        name: '60日排名',
        type: 'line',
        yAxisIndex: 1,
        showSymbol: false,
        lineStyle: {
          color: theme.blue,
          width: 1.1,
          type: 'dashed',
          opacity: 0.42,
        },
        itemStyle: { color: theme.blue },
        data: points.map(
          (point) => (numeric(point.recent_state_rank) ?? 0) * 100,
        ),
      },
      {
        name: '正式得分',
        type: 'line',
        yAxisIndex: 1,
        showSymbol: false,
        lineStyle: { color: theme.red, width: 2.2 },
        itemStyle: { color: theme.red },
        data: points.map((point) => formalScore(point) * 100),
      },
    ],
  });
  register(signalChart, roots.signal);

  const durationChart = echarts.init(roots.duration, undefined, {
    renderer: 'canvas',
  });
  durationChart.setOption({
    animation: false,
    aria: {
      enabled: true,
      description: '单只基金隐含麦考利久期及久期五分位组历史',
    },
    textStyle: { color: theme.ink, fontFamily: theme.fontFamily, fontSize: 12 },
    legend: {
      top: 0,
      left: 0,
      itemWidth: 18,
      itemHeight: 8,
      itemGap: 14,
      textStyle: { color: theme.ink, fontFamily: theme.fontFamily, fontSize: 11 },
    },
    grid: { left: 12, right: 12, top: 48, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', confine: true },
    xAxis: xAxis(),
    yAxis: [
      {
        type: 'value',
        name: '久期（年）',
        scale: true,
        axisLine: { show: true, lineStyle: { color: theme.ink } },
        axisLabel: { color: theme.muted, fontSize: 11 },
        splitLine: { lineStyle: { color: theme.gridLine, type: 'dashed' } },
      },
      {
        type: 'value',
        name: '久期组',
        min: 1,
        max: 5,
        interval: 1,
        axisLine: { show: true, lineStyle: { color: theme.ink } },
        axisLabel: { formatter: 'Q{value}', color: theme.muted, fontSize: 11 },
        splitLine: { show: false },
      },
    ],
    dataZoom: insideZoom(),
    series: [
      {
        name: '隐含麦考利久期',
        type: 'line',
        showSymbol: false,
        lineStyle: { color: theme.red, width: 2 },
        itemStyle: { color: theme.red },
        data: points.map((point) => numeric(point.implied_macaulay_duration)),
      },
      {
        name: '久期组',
        type: 'line',
        yAxisIndex: 1,
        step: 'end',
        showSymbol: false,
        lineStyle: { color: theme.muted, width: 1.2, type: 'dashed' },
        itemStyle: { color: theme.muted },
        data: points.map((point) => point.duration_bucket),
      },
    ],
  });
  register(durationChart, roots.duration);

  const gammaValues = points.flatMap((point) =>
    GAMMA_ROWS.map(([field]) => numeric(point[field])),
  );
  const maximum = Math.max(
    0.1,
    ...gammaValues.filter((value) => value !== null),
  );
  function gammaHeat(sampleType) {
    return points.flatMap((point, x) => {
      if (point.sample_type !== sampleType) return [];
      return GAMMA_ROWS.map(([field], y) => {
        const exposure = numeric(point[field]);
        return {
          value: [x, y, Math.max(0, exposure ?? 0), exposure],
          ...(exposure === null
            ? { itemStyle: { color: theme.surface } }
            : {}),
        };
      });
    });
  }
  const gammaChart = echarts.init(roots.gamma, undefined, {
    renderer: 'canvas',
  });
  gammaChart.setOption({
    animation: false,
    aria: { enabled: true, description: '单只基金长期利差暴露历史' },
    color: [theme.red, theme.blue],
    textStyle: { color: theme.ink, fontFamily: theme.fontFamily, fontSize: 12 },
    legend: {
      top: 0,
      left: 0,
      itemWidth: 18,
      itemHeight: 8,
      itemGap: 14,
      textStyle: { color: theme.ink, fontFamily: theme.fontFamily, fontSize: 11 },
    },
    grid: { left: 12, right: 12, top: 40, bottom: 8, containLabel: true },
    tooltip: {
      position: 'top',
      formatter: (params) => {
        const rawData = params?.data;
        const data = Array.isArray(rawData) ? rawData : rawData?.value;
        if (!Array.isArray(data)) return '';
        const point = points[data[0]];
        const row = GAMMA_ROWS[data[1]];
        const exposure = data[3];
        return `<strong>${point.model_date}</strong><br/>${row[1]}：${
          exposure === null ? '未启用' : Number(exposure).toFixed(3)
        }`;
      },
    },
    xAxis: xAxis(true),
    yAxis: {
      type: 'category',
      data: GAMMA_ROWS.map(([, label]) => label),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: theme.ink, fontSize: 11 },
    },
    dataZoom: insideZoom(),
    visualMap: [
      {
        min: 0,
        max: maximum,
        dimension: 2,
        seriesIndex: 0,
        show: false,
        inRange: { color: [theme.surface, theme.creditMid, theme.red] },
      },
      {
        min: 0,
        max: maximum,
        dimension: 2,
        seriesIndex: 1,
        show: false,
        inRange: { color: [theme.surface, theme.rateMid, theme.blue] },
      },
    ],
    series: [
      {
        name: '信用债基',
        type: 'heatmap',
        data: gammaHeat('信用债基金'),
        itemStyle: { borderColor: theme.surface, borderWidth: 0.25 },
        emphasis: { itemStyle: { borderColor: theme.ink, borderWidth: 1 } },
      },
      {
        name: '利率债基',
        type: 'heatmap',
        data: gammaHeat('利率债基金'),
        itemStyle: { borderColor: theme.surface, borderWidth: 0.25 },
        emphasis: { itemStyle: { borderColor: theme.ink, borderWidth: 1 } },
      },
    ],
  });
  register(gammaChart, roots.gamma);

  charts.forEach((chart) => {
    chart.group = groupId;
  });
  echarts.connect(groupId);

  const zoomHandlers = charts.map((chart) => {
    const handler = () => {
      if (disposed || chartIsDisposed(chart)) return;
      const { start, end } = readZoomRange(chart);
      const nextMode = chartDateLabelMode(dates, start, end);
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
    echarts.disconnect(groupId);
    charts.forEach((chart) => {
      if (!chartIsDisposed(chart)) chart.dispose();
    });
  };
}
