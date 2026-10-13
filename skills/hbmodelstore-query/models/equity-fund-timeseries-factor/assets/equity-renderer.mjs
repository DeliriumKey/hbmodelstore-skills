// Shared by the documentation preview and offline Skill HTML. No network or model estimation.
const numeric = value => {
  const raw = Array.isArray(value) ? value.at(-1) : value;
  return raw == null || !Number.isFinite(Number(raw)) ? null : Number(raw);
};
export const formatEquityPercent = value => numeric(value) === null ? '—' : `${(numeric(value) * 100).toFixed(2)}%`;
export const formatEquityBeta = value => numeric(value) === null ? '—' : numeric(value).toFixed(3);

export function equityHistoryOptions(rows, dark = false, factorDates = []) {
  const ink = dark ? '#e5e5e5' : '#2b2b2b', grid = dark ? '#444444' : '#e5e5e5';
  const byDate = new Map(rows.map(row => [row.model_date, row]));
  const dates = [...new Set([...byDate.keys(), ...factorDates])]
    .filter(day => day >= rows[0]?.model_date && day <= rows.at(-1)?.model_date).sort();
  const groups = [
    [['alpha_annual', '年化 Alpha', '#d80012'], ['return_252', '252 日收益', '#7f7f7f']],
    [['beta_mkt', '市场', '#d80012'], ['beta_smb_ep', '规模', '#225395'],
      ['beta_vmg_ep', '价值（EP）', '#7f7f7f'], ['beta_mom', '动量', '#b28189']],
    [['beta_credit', '信用债', '#d80012'],
      ...(rows.some(row => row.cb_enabled === true) ? [['beta_cb', '转债', '#225395']] : [])],
  ];
  return groups.map((group, index) => ({
    backgroundColor: 'transparent', animation: false, aria: { enabled: true, label: {
      description: `${group.map(series => series[1]).join('、')}历史时序；${index ? '单位为回归系数' : '纵轴为百分比'}。`,
    } },
    textStyle: { color: ink, fontSize: 12, fontFamily: 'Arial, "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", sans-serif' },
    grid: { left: 52, right: 16, top: 18, bottom: 44 },
    legend: { bottom: 0, type: 'scroll', textStyle: { color: ink, fontSize: 12 } },
    tooltip: { trigger: 'axis', confine: true, backgroundColor: dark ? '#222' : '#fff',
      axisPointer: { type: 'line', lineStyle: { color: '#7f7f7f', type: 'solid', width: 1 } },
      textStyle: { color: ink }, valueFormatter: index ? formatEquityBeta : formatEquityPercent },
    xAxis: { type: 'time', axisLabel: { color: ink, hideOverlap: true },
      axisTick: { show: false }, axisLine: { lineStyle: { color: ink } }, splitLine: { show: false } },
    yAxis: { type: 'value', scale: true,
      axisLine: { show: true, lineStyle: { color: ink, width: 1 } },
      axisLabel: { color: ink, ...(index ? {} : { formatter: value => `${(value * 100).toFixed(1)}%` }) },
      splitLine: { lineStyle: { color: grid, type: 'solid', width: 1 } } },
    series: group.map(([field, name, color]) => ({
      name, type: 'line', showSymbol: false, smooth: false, connectNulls: false,
      lineStyle: { width: 1.5, type: 'solid' }, itemStyle: { color },
      // Only actual factor/model days can be missing; calendar holidays are not observations.
      data: dates.map(day => [day, field === 'beta_cb' && byDate.get(day)?.cb_enabled !== true
        ? null : byDate.get(day)?.[field] ?? null]),
    })),
  }));
}

export function renderEquityHistory({ echarts, root, payload }) {
  const rows = payload.rows;
  if (!rows?.length || payload.has_more) throw new Error('需要完整、非空的单基金历史 JSON');
  const latest = rows.at(-1);
  root.replaceChildren();
  root.classList.add('equity-history');
  const style = document.createElement('style');
  style.textContent = `.equity-history{min-width:0;font-family:Arial,"Microsoft YaHei","PingFang SC","Hiragino Sans GB",sans-serif}
    .equity-history h2{font-size:16px;margin:20px 0 6px;font-weight:600}.equity-history h3{font-size:14px;margin:24px 0 8px;font-weight:600}
    .equity-history .note{font-size:12px;line-height:1.8;color:#7f7f7f;margin:6px 0}.equity-history .chart{height:300px;min-width:0;width:100%}`;
  root.append(style);
  const add = (tag, text, className, parent = root) => {
    const el = document.createElement(tag); el.textContent = text; if (className) el.className = className;
    parent.append(el); return el;
  };
  add('h2', `${latest.name} · ${payload.fund_code}`);
  add('p', `${latest.category} · 最新模型日 ${latest.model_date} · ${rows.length} 个模型日`, 'note');
  const titles = ['Alpha 时序', '股票因子暴露', rows.some(row => row.cb_enabled === true)
    ? '债券与转债因子暴露' : '信用债因子暴露'];
  const group = `equity-${Math.random().toString(36).slice(2)}`;
  const charts = titles.map(title => {
    add('h3', title);
    const div = add('div', '', 'chart'); div.setAttribute('role', 'img'); div.setAttribute('aria-label', title);
    const chart = echarts.init(div); chart.group = group; return chart;
  });
  echarts.connect(group);
  const stamp = day => day.replaceAll('-', '/');
  const range = rows[0].model_date === latest.model_date ? `截止日期：${stamp(latest.model_date)}`
    : `时间区间：${stamp(rows[0].model_date)}~${stamp(latest.model_date)}`;
  add('p', `数据来源：Wind、好买基金研究中心，${range}`, 'note');
  const media = matchMedia('(prefers-color-scheme:dark)');
  function draw() {
    const dark = document.documentElement.classList.contains('dark')
      || (!document.documentElement.classList.contains('light') && media.matches);
    const options = equityHistoryOptions(rows, dark, payload.factor_dates);
    charts.forEach((chart, i) => {
      const old = chart.getOption();
      if (old?.legend?.[0]?.selected) options[i].legend.selected = old.legend[0].selected;
      chart.setOption(options[i], true);
    });
  }
  const resize = new ResizeObserver(() => charts.forEach(chart => chart.resize())); resize.observe(root);
  const theme = new MutationObserver(draw); theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  media.addEventListener('change', draw); draw();
  return () => { resize.disconnect(); theme.disconnect(); media.removeEventListener('change', draw);
    echarts.disconnect(group); charts.forEach(chart => chart.dispose()); root.replaceChildren(); };
}

export function equityComparisonOptions(histories, dark = false, start = '') {
  const percent = equityHistoryOptions(histories[0].rows, dark, histories[0].factor_dates)[0];
  const beta = equityHistoryOptions(histories[0].rows, dark, histories[0].factor_dates)[1];
  const colors = dark ? ['#d80012', '#bfbfbf', '#91a9ca', '#ec8089', '#e5e5e5']
    : ['#d80012', '#7f7f7f', '#225395', '#8d0101', '#2b2b2b'];
  const dates = [...new Set(histories.flatMap(h => [...h.rows.map(r => r.model_date), ...(h.factor_dates ?? [])]))]
    .filter(day => day >= start && histories.some(h => day >= h.rows[0].model_date && day <= h.rows.at(-1).model_date)).sort();
  const fields = [['alpha_annual', '年化 Alpha'], ['return_252', '252 日收益'],
    ['beta_mkt', '市场暴露'], ['beta_smb_ep', '规模暴露'], ['beta_vmg_ep', '价值暴露'],
    ['beta_mom', '动量暴露'], ['beta_credit', '信用债暴露'],
    ...(histories.some(h => h.rows.some(r => r.cb_enabled)) ? [['beta_cb', '转债暴露']] : [])];
  const lookup = histories.map(h => new Map(h.rows.map(r => [r.model_date, r])));
  return fields.map(([field, title], i) => ({ title, option: {
    ...(i < 2 ? percent : beta),
    aria: { enabled: true, label: { description: `${title}的多基金历史比较` } },
    series: histories.map((h, index) => ({
      name: `${h.rows.at(-1).name} · ${h.fund_code}`, type: 'line',
      showSymbol: false, smooth: false, connectNulls: false,
      lineStyle: { width: 1.5, type: 'solid' }, itemStyle: { color: colors[index] },
      data: dates.map(day => { const row = lookup[index].get(day);
        return [day, field === 'beta_cb' && row?.cb_enabled !== true ? null : row?.[field] ?? null]; }),
    })),
  } }));
}

export function renderEquityComparison({ echarts, root, histories }) {
  if (histories.length < 2 || histories.length > 5 || new Set(histories.map(h => h.fund_code)).size !== histories.length
    || histories.some(h => !h.rows?.length || h.has_more)) throw new Error('需要2–5只不同基金的完整历史');
  root.replaceChildren();
  const add = (tag, text, parent = root) => { const el = document.createElement(tag); el.textContent = text;
    parent.append(el); return el; };
  add('h1', '多基金比较');
  const controls = add('div', ''); controls.style.cssText = 'display:flex;gap:8px;margin:18px 0';
  let start = '', selected = {};
  const end = histories.map(h => h.rows.at(-1).model_date).sort().at(-1);
  const media = matchMedia('(prefers-color-scheme:dark)');
  const group = `comparison-${Math.random().toString(36).slice(2)}`;
  const charts = equityComparisonOptions(histories).map(({ title }) => {
    const figure = add('section', ''); figure.style.marginTop = '28px'; add('h2', title, figure);
    const canvas = add('div', '', figure); canvas.style.cssText = 'height:300px;width:100%;min-width:0';
    canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', title);
    const chart = echarts.init(canvas); chart.group = group; return chart;
  });
  echarts.connect(group);
  charts.forEach(chart => chart.on('legendselectchanged', event => { selected = event.selected; }));
  const first = histories.map(h => h.rows[0].model_date).sort()[0];
  const note = add('p', `数据来源：Wind、好买基金研究中心，时间区间：${first.replaceAll('-', '/')}~${end.replaceAll('-', '/')}`);
  note.style.cssText = 'font-size:12px;color:#7f7f7f;margin-top:8px';
  const draw = () => {
    const dark = document.documentElement.classList.contains('dark')
      || (!document.documentElement.classList.contains('light') && media.matches);
    equityComparisonOptions(histories, dark, start).forEach(({ option }, index) => {
      option.legend.selected = selected; charts[index].setOption(option, true);
    });
  };
  const buttons = [['近一年', 1], ['近三年', 3], ['全部', 0]].map(([label, years]) => {
    const button = add('button', label, controls); button.type = 'button';
    button.setAttribute('aria-pressed', String(years === 0));
    button.onclick = () => {
      const day = new Date(`${end}T00:00:00Z`); day.setUTCFullYear(day.getUTCFullYear() - years);
      start = years ? day.toISOString().slice(0, 10) : '';
      buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button))); draw();
    }; return button;
  });
  const resize = new ResizeObserver(() => charts.forEach(chart => chart.resize())); resize.observe(root);
  const theme = new MutationObserver(draw); theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  media.addEventListener('change', draw); draw();
  return () => { resize.disconnect(); theme.disconnect(); media.removeEventListener('change', draw);
    echarts.disconnect(group); charts.forEach(chart => chart.dispose()); root.replaceChildren(); };
}

export function equityStyleOption(payload, dark = false) {
  const ink = dark ? '#e5e5e5' : '#2b2b2b', grid = dark ? '#444444' : '#e5e5e5';
  const factors = [['beta_mkt', '市场'], ['beta_smb_ep', '规模'],
    ['beta_vmg_ep', '价值（EP）'], ['beta_mom', '动量']];
  const data = factors.map(([key, label], index) => {
    const position = payload.category_factor_positions?.[key];
    if (!position?.valid_count || numeric(position.percentile_below) === null
      || numeric(position.percentile_at_or_below) === null) return null;
    return { value: [position.percentile_at_or_below * 100, index],
      factor: label, position };
  }).filter(Boolean);
  return {
    backgroundColor: 'transparent', animation: false, aria: { enabled: true },
    textStyle: { color: ink, fontSize: 12, fontFamily: 'Arial, "Microsoft YaHei", "PingFang SC", sans-serif' },
    grid: { left: 72, right: 28, top: 16, bottom: 60 },
    legend: { bottom: 0, textStyle: { color: ink }, data: ['本基金', '同类50%位置'] },
    tooltip: { trigger: 'item', confine: true, textStyle: { color: ink },
      backgroundColor: dark ? '#222' : '#fff', formatter: item => {
        const p = item.data.position;
        if (!p) return '';
        const lower = (p.percentile_below * 100).toFixed(1);
        const upper = (p.percentile_at_or_below * 100).toFixed(1);
        return `${item.data.factor}<br>暴露：${formatEquityBeta(p.target_value)}`
          + `<br>同类中位数：${formatEquityBeta(p.median)}<br>同类分位：${lower}%–${upper}%`;
      } },
    xAxis: { type: 'value', min: 0, max: 100, interval: 25,
      axisLabel: { color: ink, formatter: '{value}%' }, axisLine: { show: true, lineStyle: { color: ink } },
      splitLine: { lineStyle: { color: grid, type: 'solid' } } },
    yAxis: { type: 'category', inverse: true, data: factors.map(f => f[1]),
      axisLabel: { color: ink }, axisTick: { show: false }, axisLine: { show: false } },
    series: [{ name: '同类50%位置', type: 'line', silent: true, showSymbol: false,
      data: [[50, 0], [50, 3]], lineStyle: { width: 1, color: '#7f7f7f' }, itemStyle: { color: '#7f7f7f' } },
    { name: '本基金', type: 'scatter', data, symbol: 'circle', symbolSize: 10, itemStyle: { color: '#d80012' } }],
  };
}

export function renderEquityStyle({ echarts, root, payload }) {
  root.replaceChildren();
  const heading = document.createElement('h3');
  heading.textContent = '同类风格定位';
  heading.style.cssText = 'font-size:14px;font-weight:600;margin:24px 0 8px';
  const canvas = document.createElement('div');
  canvas.style.cssText = 'height:280px;min-width:0;width:100%';
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', '市场、规模、价值、动量在同类中的位置');
  const note = document.createElement('p');
  note.style.cssText = 'font-size:12px;color:#7f7f7f;margin:8px 0';
  note.textContent = `数据来源：Wind、好买基金研究中心，截止日期：${payload.model_date.replaceAll('-', '/')}；${payload.category}`;
  root.append(heading, canvas, note);
  const chart = echarts.init(canvas), media = matchMedia('(prefers-color-scheme:dark)');
  const draw = () => chart.setOption(equityStyleOption(payload, document.documentElement.classList.contains('dark')
    || (!document.documentElement.classList.contains('light') && media.matches)), true);
  const resize = new ResizeObserver(() => chart.resize()); resize.observe(root);
  const theme = new MutationObserver(draw); theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  media.addEventListener('change', draw); draw();
  return () => { resize.disconnect(); theme.disconnect(); media.removeEventListener('change', draw); chart.dispose(); root.replaceChildren(); };
}
