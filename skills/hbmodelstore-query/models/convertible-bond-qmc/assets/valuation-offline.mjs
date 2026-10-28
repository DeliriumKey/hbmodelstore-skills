import { QUINTILES, VALUATION_COLUMNS, INDUSTRY_COLUMNS, valuationClassificationNote, valuationCellBackground, industryCellBackground, industryTableRows, valuationSnapshot, withValuationBalances, valuationRows, valuationViewFilters, valuationIndustries, valuationFormat, industryValuationOption, industryValuationHeight, industryCountOption, industryCountLayout, bondHistoryOption } from './valuation-explorer.mjs';

// Offline UI uses the website's exact grouping, statistics, column formats and options.
export function mountValuationExplorer({ root, payload, balances, showDistribution = false, view = 'pricing', initial = {}, histories = [], dates = [], echarts }) {
  const baseSnapshot = valuationSnapshot(payload);
  const snapshot = showDistribution && balances ? withValuationBalances(baseSnapshot, balances) : baseSnapshot;
  const industryView = view === 'industry';
  const state = { industry: '', q: '', bondType: '', sort: 'market_vs_theoretical_pct', descending: false, page: 1,
    ...valuationViewFilters(initial, industryView) };
  let industrySort = { sort: 'value', descending: true };
  const allIndustries = valuationIndustries(snapshot.rows);
  const charts = [];
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const node = (tag, text = '', parent = root) => { const element = document.createElement(tag); element.textContent = text; parent.append(element); return element; };
  const source = (parent, start = snapshot.model_date, end = snapshot.model_date, name = '好买基金研究中心', classification = false) => {
    if (classification) node('p', valuationClassificationNote(snapshot), parent).className = 'source';
    const note = node('p', `数据来源：${name}，${start === end ? `截止日期：${end.replaceAll('-', '/')}` : `时间区间：${start.replaceAll('-', '/')}~${end.replaceAll('-', '/')}`}`, parent);
    note.className = 'source';
    if (classification) note.style.marginTop = '4px';
  };
  const option = (parent, value, label) => { const item = node('option', label, parent); item.value = value; };
  function select(parent, label, values, current, change) {
    const wrapper = node('label', `${label} `, parent), input = node('select', '', wrapper);
    input.setAttribute('aria-label', label);
    values.forEach(([value, title]) => option(input, value, title)); input.value = current;
    input.onchange = () => change(input.value); return input;
  }
  function action(parent, label, click) { const element = node('button', label, parent); element.type = 'button'; element.onclick = click; return element; }
  function table(parent, headers, rows, sorter, textColumns = [0, 1, 2], classification = false, cellBackground) {
    const wrap = node('div', '', parent); wrap.className = 'table-wrap';
    const element = node('table', '', wrap), tr = node('tr', '', node('thead', '', element));
    headers.forEach((label, i) => { const th = node('th', '', tr); th.scope = 'col';
      if (sorter) {
        const active = sorter.column === i;
        th.setAttribute('aria-sort', active ? sorter.descending ? 'descending' : 'ascending' : 'none');
        action(th, `${label}${active ? sorter.descending ? ' ↓' : ' ↑' : ' ↕'}`, () => sorter.onChange(i));
      } else th.textContent = label;
    });
    const body = node('tbody', '', element);
    rows.forEach((values, row) => { const line = node('tr', '', body); values.forEach((value, i) => {
      const cell = node('td', '', line); cell.style.textAlign = textColumns.includes(i) ? 'left' : 'right';
      const background = cellBackground?.(row, i);
      if (background) cell.style.backgroundColor = background;
      if (value instanceof Node) cell.append(value); else cell.textContent = String(value);
    }); });
    if (!rows.length) { const cell = node('td', '当前筛选没有结果。', node('tr', '', body)); cell.colSpan = headers.length; }
    source(parent, undefined, undefined, undefined, classification);
  }
  function chart(parent, height, build, label, responsiveHeight) {
    const element = node('div', '', parent); element.style.height = `${height}px`; element.style.width = '100%';
    element.setAttribute('role', 'img'); element.setAttribute('aria-label', label);
    const instance = echarts.init(element);
    const render = () => {
      const selected = instance.getOption()?.legend?.[0]?.selected;
      const width = element.clientWidth || instance.getWidth();
      if (responsiveHeight) {
        const next = `${responsiveHeight(width)}px`;
        if (element.style.height !== next) element.style.height = next;
      }
      instance.resize(); instance.setOption(build(media.matches, instance.getWidth()), { notMerge: true });
      if (selected) instance.setOption({ legend: { selected } });
    };
    render();
    const observer = new ResizeObserver(render); observer.observe(element);
    media.addEventListener('change', render);
    charts.push(() => { observer.disconnect(); media.removeEventListener('change', render); instance.dispose(); });
  }
  function detail(row, parent) {
    parent.replaceChildren(); node('h2', `${row.bond_name} · ${row.bond_code}`, parent);
    table(parent, ['纯债价值', '到期日', '强赎终止比例', '下修比例'], [[
      valuationFormat('pure_bond_value', row.pure_bond_value), row.maturity_date ?? '—',
      valuationFormat('call_rate', row.call_rate, row), valuationFormat('reset_rate', row.reset_rate, row)]]);
    const start = new Date(Date.parse(snapshot.model_date) - 365 * 86400000).toISOString().slice(0, 10);
    const history = histories.filter(item => item.bond_code === row.bond_code && item.model_date >= start && item.model_date <= snapshot.model_date).sort((a, b) => a.model_date.localeCompare(b.model_date));
    if (!history.length) { node('p', '本文件未附该券历史。', parent); return; }
    const historyPanel = node('div', '', parent), plot = node('div', '', parent);
    node('h3', '近一年估值', historyPanel);
    let metric = 'price';
    const controls = node('div', '', historyPanel); controls.className = 'controls';
    const makeOption = (dark, width) => bondHistoryOption(history, dates.filter(date => date >= start && date <= snapshot.model_date), metric, dark, width);
    plot.style.height = '280px'; const historyChart = echarts.init(plot);
    const render = () => { historyChart.resize(); historyChart.setOption(makeOption(media.matches, historyChart.getWidth()), { notMerge: true }); };
    select(controls, '历史指标', [['price', '市场价与理论价'], ['premium', '理论溢价率']], metric, value => { metric = value; render(); });
    render(); const resize = new ResizeObserver(render); resize.observe(plot); media.addEventListener('change', render);
    charts.push(() => { resize.disconnect(); media.removeEventListener('change', render); historyChart.dispose(); });
    source(parent, history[0].model_date, history.at(-1).model_date);
  }
  function paint() {
    charts.splice(0).forEach(dispose => dispose()); root.replaceChildren();
    const controls = node('div'); controls.className = 'controls';
    node('span', snapshot.model_date, controls);
    const update = patch => { Object.assign(state, patch, { page: 1 }); paint(); };
    select(controls, '券类型', [['', '全部券'], ['cb', '可转债'], ['eb', '可交债']], state.bondType, value => update({ bondType: value, industry: '' }));
    if (!industryView) {
      const panel = node('div'); panel.className = 'valuation-group-panel';
      node('span', '平底溢价率组', panel).className = 'valuation-group-label';
      const buttons = node('div', '', panel); buttons.className = 'valuation-groups';
      buttons.setAttribute('role', 'group'); buttons.setAttribute('aria-label', '平底溢价率五分组');
      [{ key: 'all', label: '全部' }, ...QUINTILES].forEach(group => {
        const button = action(buttons, group.label, () => update({ group: group.key, industry: '' }));
        button.setAttribute('aria-pressed', String(state.group === group.key));
      });
      if (snapshot.ungrouped) node('p', `${snapshot.ungrouped} 只缺少有效平价或纯债价值，仅在“全部”中展示。`);
    }
    const industries = valuationIndustries(valuationRows(snapshot,
      valuationViewFilters({ group: state.group, bondType: state.bondType }, industryView)));
    if (industryView) {
      if (industries.length) {
        if (showDistribution) {
          const countFigure = node('figure'); countFigure.style.margin = '24px 0';
          node('h2', '行业只数占比', countFigure);
          chart(countFigure, 340, (dark, width) => industryCountOption(industries, dark, width, allIndustries),
            '前十大行业与其他行业转债只数占比', width => industryCountLayout(industries, width).height);
          source(countFigure, undefined, undefined, undefined, true);
          if (balances && industries.some(row => row.balance > 0)) {
            const balanceFigure = node('figure'); balanceFigure.style.margin = '28px 0';
            node('h2', '行业债券余额占比', balanceFigure);
            chart(balanceFigure, 340, (dark, width) => industryCountOption(industries, dark, width, allIndustries, 'balance'),
              '前十大行业与其他行业债券余额占比', width => industryCountLayout(industries, width, 'balance').height);
            source(balanceFigure, snapshot.model_date, snapshot.model_date, 'Wind、好买基金研究中心', true);
          }
        }
        const valueFigure = node('figure'); valueFigure.style.margin = '28px 0';
        node('h2', '各行业市场价减理论价中位数（元）', valueFigure);
        chart(valueFigure, industryValuationHeight(industries), (dark, width) => industryValuationOption(industries, dark, width), '各行业价差中位数');
        source(valueFigure, undefined, undefined, undefined, true);
      } else node('p', '当前没有行业样本。');
      const summary = node('figure'); summary.style.margin = '28px 0';
      node('h2', '行业汇总', summary);
      const industryBackground = industryCellBackground(industries);
      const industryRows = industryTableRows(industries, industrySort);
      table(summary, INDUSTRY_COLUMNS.map(([, label]) => label), industryRows.map(item =>
        [item.label, item.count, valuationFormat('parity_floor_premium', item.parity_floor_premium), valuationFormat('', item.value)]
      ), { column: INDUSTRY_COLUMNS.findIndex(([key]) => key === industrySort.sort), descending: industrySort.descending,
        onChange: column => { industrySort = { sort: INDUSTRY_COLUMNS[column][0],
          descending: industrySort.sort === INDUSTRY_COLUMNS[column][0] ? !industrySort.descending : column !== 0 }; paint(); } },
      [0], true, (row, column) => industryBackground(industryRows[row], INDUSTRY_COLUMNS[column][0]));
      return;
    }
    const filters = node('div'); filters.className = 'controls';
    select(filters, '行业', [['', '全部行业'], ...industries.map(item => [item.key, `${item.label}（${item.count}只）`])], state.industry, value => update({ industry: value }));
    const toolbar = node('div'); toolbar.className = 'table-toolbar';
    const searchForm = node('form', '', toolbar); searchForm.setAttribute('role', 'search');
    const search = node('input', '', searchForm); search.type = 'search'; search.placeholder = '名称或代码'; search.setAttribute('aria-label', '搜索转债'); search.value = state.q;
    const submit = node('button', '查询', searchForm); submit.type = 'submit';
    searchForm.onsubmit = event => { event.preventDefault(); update({ q: search.value }); };
    const rows = valuationRows(snapshot, valuationViewFilters(state, industryView)), pages = Math.max(1, Math.ceil(rows.length / 20)); state.page = Math.min(state.page, pages);
    const cellBackground = valuationCellBackground(rows);
    const pageRows = rows.slice((state.page - 1) * 20, state.page * 20);
    const pager = node('nav', '', toolbar); pager.className = 'pager'; pager.setAttribute('aria-label', '表格分页'); pager.hidden = pages <= 1;
    const previous = action(pager, '‹', () => { state.page--; paint(); }); previous.setAttribute('aria-label', '上一页'); previous.disabled = state.page === 1;
    const candidates = pages <= 7 ? Array.from({ length: pages }, (_, i) => i + 1)
      : [...new Set([1, pages, state.page - 1, state.page, state.page + 1].filter(n => n >= 1 && n <= pages))].sort((a, b) => a - b);
    let last = 0;
    for (const target of candidates) {
      if (target - last > 1) node('span', '…', pager);
      const button = action(pager, String(target), () => { state.page = target; paint(); }); button.setAttribute('aria-label', `第 ${target} 页`);
      if (state.page === target) button.setAttribute('aria-current', 'page');
      last = target;
    }
    const next = action(pager, '›', () => { state.page++; paint(); }); next.setAttribute('aria-label', '下一页'); next.disabled = state.page === pages;
    const tablePanel = node('div'), detailPanel = node('section'); detailPanel.style.marginTop = '24px';
    let disposeDetails = () => {};
    table(tablePanel, VALUATION_COLUMNS.map(([, label]) => label), pageRows.map(row => VALUATION_COLUMNS.map(([key]) => {
      if (key !== 'bond_name') return valuationFormat(key, row[key], row);
      const link = document.createElement('button'); link.type = 'button'; link.textContent = row.bond_name; link.className = 'valuation-bond-link';
      link.onclick = () => { disposeDetails(); const count = charts.length; detail(row, detailPanel); disposeDetails = () => charts.splice(count).forEach(dispose => dispose()); };
      return link;
    })), { column: VALUATION_COLUMNS.findIndex(([key]) => key === state.sort), descending: state.descending,
      onChange: i => update({ sort: VALUATION_COLUMNS[i][0], descending: state.sort === VALUATION_COLUMNS[i][0] ? !state.descending : false }) }, [0, 1, 2], true,
    (row, column) => cellBackground(pageRows[row], VALUATION_COLUMNS[column][0]));
  }
  paint(); return () => { charts.splice(0).forEach(dispose => dispose()); root.replaceChildren(); };
}
