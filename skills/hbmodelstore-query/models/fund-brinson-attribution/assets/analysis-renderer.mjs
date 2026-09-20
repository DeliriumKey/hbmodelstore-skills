// Reuse the single-period website/Skill chart style; only adapt linked result data.
// Fetching and Carino calculations stay in the analysis layer, never in this renderer.
import { brinsonOption, numeric, formatPercent, formatContribution, weightCellBackground } from './brinson-renderer.mjs';
import { SECURITY_RANKING_COLUMNS, MISSING_SECURITY_INDUSTRY, securityRankingFilters,
  filterSecurityRankings, sortRankingRows, securityRankingPage } from './analysis-tables.mjs';

const pct = formatPercent;
const fmtDate = (v) => v.replaceAll('-', '/');
const marketNames = { A_SHARE: 'A 股', HK: '港股', CONVERTIBLE_BOND: '转债', PURE_BOND: '纯债' };
function el(tag, text, cls) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}
function table(headers, rows, sort, cellBackground) {
  const wrap = el('div', undefined, 'table-wrap');
  const t = el('table');
  const head = el('tr');
  headers.forEach((label, column) => {
    const th = el('th', sort ? undefined : label);
    if (sort) {
      const selected = sort.column === column;
      th.setAttribute('aria-sort', selected ? (sort.descending ? 'descending' : 'ascending') : 'none');
      const button = el('button', `${label} ${selected ? (sort.descending ? '↓' : '↑') : '↕'}`, 'sort-button');
      button.type = 'button';
      button.setAttribute('aria-label', `按${label}${selected && sort.descending ? '升' : '降'}序排序`);
      button.addEventListener('click', () => sort.onChange(column));
      th.append(button);
    }
    head.append(th);
  });
  t.append(el('thead'));
  t.firstChild.append(head);
  const body = el('tbody');
  rows.forEach((row, rowIndex) => {
    const tr = el('tr'); row.forEach((value, column) => {
      const cell = el('td');
      const background = cellBackground?.(rowIndex, column);
      if (background) cell.style.backgroundColor = background;
      if (value && typeof value === 'object') cell.append(value);
      else cell.textContent = value;
      tr.append(cell);
    }); body.append(tr);
  });
  t.append(body); wrap.append(t); return wrap;
}
function amount(value) {
  const n = numeric(value);
  return el('span', formatContribution(value), n === null || n === 0 ? '' : n > 0 ? 'amount-positive' : 'amount-negative');
}
function caption(start, end) {
  // This project's requested comma-separated source/date convention.
  return el('p', `数据来源：Wind、好买基金研究中心，${start === end ? '截止日期' : '时间区间'}：${fmtDate(start)}${start === end ? '' : `~${fmtDate(end)}`}`, 'source');
}
function section(title) {
  const node = el('section', undefined, 'report-section');
  node.setAttribute('aria-label', title);
  const heading = el('div', undefined, 'section-heading');
  heading.append(el('h2', title)); node.append(heading);
  return node;
}
function select(label, options, value, onChange) {
  const node = el('select'); node.setAttribute('aria-label', label);
  setOptions(node, options, value);
  node.addEventListener('change', () => onChange(node.value));
  return node;
}
function setOptions(node, options, value) {
  node.replaceChildren(...options.map(([key, label]) => {
    const option = el('option', label); option.value = String(key); return option;
  }));
  node.value = String(value);
}
function entityName(row) {
  const node = el('span', marketNames[row.name] || row.name);
  if (row.security_code) node.append(el('span', row.security_code, 'entity-code'));
  return node;
}
function unavailable(block, data) {
  if (data.status === 'complete') return false;
  const message = el('p', `明细暂不可用：${data.detail}`, 'muted');
  message.setAttribute('role', 'status'); block.append(message); return true;
}
function rankings(title, entity, data, segment, filterMarket = false) {
  const block = section(title);
  if (unavailable(block, data)) return block;
  let market = '';
  const sort = { column: 1, descending: true, onChange(column) {
    sort.descending = sort.column === column ? !sort.descending : true;
    sort.column = column; draw();
  } };
  const content = el('div', undefined, 'ranking-content');
  if (filterMarket && data.rows.length) {
    const markets = [...new Set(data.rows.map(row => row.market_code).filter(Boolean))].sort();
    block.firstChild.append(select('行业市场', [['', '全部市场'], ...markets.map(v => [v, marketNames[v] || v])], market,
      value => { market = value; draw(); }));
  }
  block.append(content);
  function draw() {
    const rows = sortRankingRows(market ? data.rows.filter(r => r.market_code === market) : data.rows,
      ['name', 'linked_contribution', 'observed_periods'][sort.column], sort.descending);
    content.replaceChildren();
    if (!rows.length) { content.append(el('p', '本区间无可归因项目', 'muted')); return; }
    content.append(table([entity, '跨期贡献', '出现期数'], rows.map(row => [entityName(row),
      amount(row.linked_contribution), `${row.observed_periods}/${segment.period_count}`]), sort),
    caption(segment.period_start, segment.period_end));
  }
  draw(); return block;
}
function securityRankings(data, segment) {
  const block = section('个股选择贡献');
  if (unavailable(block, data)) return block;
  const total = el('span', undefined, 'muted'); block.firstChild.append(total);
  let market = '', industry = '', query = '', page = 1;
  const sort = { column: 3, descending: true, onChange(column) {
    sort.descending = sort.column === column ? !sort.descending : true;
    sort.column = column; page = 1; draw();
  } };
  const filters = el('div', undefined, 'ranking-controls');
  const options = securityRankingFilters(data.rows);
  const industryOptions = () => {
    const result = securityRankingFilters(data.rows, market);
    return [['', '全部行业'], ...result.industries.map(v => [v, v]),
      ...(result.hasMissingIndustry ? [[MISSING_SECURITY_INDUSTRY, '未分类']] : [])];
  };
  const industrySelect = select('个股行业', industryOptions(), industry,
    value => { industry = value; page = 1; draw(); });
  const marketSelect = select('个股市场', [['', '全部市场'], ...options.markets.map(v => [v, marketNames[v] || v])], market,
    value => { market = value; industry = ''; page = 1;
      setOptions(industrySelect, industryOptions(), industry); draw(); });
  const search = el('input'); search.type = 'search'; search.placeholder = '筛选名称或代码';
  search.setAttribute('aria-label', '筛选个股');
  search.addEventListener('input', () => { query = search.value; page = 1; draw(); });
  filters.append(marketSelect, industrySelect, search);
  if (data.rows.length) block.append(filters);
  const content = el('div', undefined, 'ranking-content'); block.append(content);
  function draw() {
    const filtered = filterSecurityRankings(data.rows, market, industry, query);
    const result = securityRankingPage(filtered, SECURITY_RANKING_COLUMNS[sort.column][1], sort.descending, page);
    total.textContent = `共 ${result.total} 项`; content.replaceChildren();
    if (!result.rows.length) {
      const message = el('p', data.rows.length ? '所选条件下无可归因个股' : '本区间无可归因个股', 'muted');
      message.setAttribute('role', 'status'); content.append(message); return;
    }
    const weights = ['cumulative_holding_weight', 'average_period_holding_weight'];
    const limits = weights.map(field => Math.max(0, ...filtered.map(row => numeric(row[field]) ?? 0)));
    content.append(table(SECURITY_RANKING_COLUMNS.map(([label]) => label), result.rows.map(row => [entityName(row),
      pct(row.cumulative_holding_weight), pct(row.average_period_holding_weight), amount(row.linked_contribution),
      `${row.observed_periods}/${segment.period_count}`]), sort,
    (i, column) => column === 1 || column === 2 ? weightCellBackground(result.rows[i][weights[column - 1]], limits[column - 1]) : null));
    if (result.pageCount > 1) {
      const nav = el('nav', undefined, 'ranking-pagination'); nav.setAttribute('aria-label', '个股选择贡献分页');
      nav.append(el('span', '每页 20 项', 'muted'));
      const button = (label, nextPage, disabled) => {
        const node = el('button', label); node.type = 'button'; node.disabled = disabled;
        node.setAttribute('aria-label', `个股${label}`);
        node.addEventListener('click', () => { page = nextPage; draw(); }); return node;
      };
      const label = el('label', '第');
      label.append(select('个股页码', Array.from({ length: result.pageCount }, (_, i) => [i + 1, i + 1]), result.page,
        value => { page = Number(value); draw(); }), el('span', `/ ${result.pageCount} 页`));
      nav.append(button('上一页', result.page - 1, result.page === 1), label,
        button('下一页', result.page + 1, result.page === result.pageCount));
      content.append(nav);
    }
    content.append(caption(segment.period_start, segment.period_end));
  }
  draw(); return block;
}
export function navOption(path, fundName, { dark = false } = {}) {
  const base = brinsonOption('nav', path.points, { dark, fundName });
  return {
    ...base,
    aria: { enabled: true, description: `${fundName}连续区间的实际、持仓拟合与模型复合基准净值，按半年期复利衔接。` },
    // Industry-matched NAV is not linked in the current analysis contract.
    // Do not invent a fourth curve just to match the single-period series count.
    series: base.series.filter(series => series.name !== '行业匹配组合'),
  };
}
export function effectsOption(segment, labels, { dark = false } = {}) {
  return brinsonOption('effects', [segment.effects], { dark, effectLabels: labels, linked: true });
}
export function historyOption(periods, segment, { dark = false } = {}) {
  // Raw half-year contributions, restricted to the selected continuous segment.
  const rows = periods.filter(r => r.period_start >= segment.period_start && r.period_end <= segment.period_end);
  return rows.length > 1 ? brinsonOption('history', rows, { dark }) : null;
}
export function renderBrinsonAnalysis({ echarts, root, analysis,
  ResizeObserverClass = globalThis.ResizeObserver }) {
  if (analysis.schema !== 'brinson-analysis-v1') throw new Error('unsupported analysis schema');
  const disposers = [];
  const fundName = analysis.fund_name || analysis.fund_code;
  root.replaceChildren();
  root.append(el('h1', `${fundName} · 跨期收益归因`),
    el('p', `${analysis.fund_code} · ${analysis.coverage.available_periods}/${analysis.coverage.expected_periods} 个完整半年期`, 'muted'));
  const warnings = el('div', undefined, 'warnings');
  analysis.warnings.forEach(text => warnings.append(el('p', text)));
  if (analysis.coverage.missing_periods.length) warnings.append(el('p',
    `缺少：${analysis.coverage.missing_periods.map(p => p.period_end).join('、')}`));
  if (analysis.coverage.rejected_periods.length) warnings.append(el('p',
    `未参与：${analysis.coverage.rejected_periods.map(p => `${p.period_end}（${p.detail}）`).join('；')}`));
  root.append(warnings);
  if (!analysis.segments.length) {
    root.append(el('p', '当前区间没有可汇总的完整半年期，未生成零收益或空白曲线。'));
    return () => {};
  }
  const control = el('label', '连续分析区间  ', 'segment-control');
  const selector = el('select');
  analysis.segments.forEach((s, i) => {
    const option = el('option', `${s.period_start} — ${s.period_end}（${s.period_count}期）`);
    option.value = String(i); selector.append(option);
  });
  selector.value = String(analysis.segments.length - 1);
  control.append(selector);
  if (analysis.segments.length > 1) root.append(control);
  const content = el('div', undefined, 'analysis-content'); root.append(content);
  const media = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
  function drawChart(block, option, start, end) {
    const node = el('div', undefined, 'chart'); block.append(node);
    node.setAttribute('role', 'img'); node.setAttribute('aria-label', block.getAttribute('aria-label'));
    const chart = echarts.init(node, null, { renderer: 'svg' });
    const update = () => chart.setOption(option({ dark: media?.matches ?? false }), true);
    update(); media?.addEventListener('change', update);
    const observer = new ResizeObserverClass(() => chart.resize()); observer.observe(node);
    disposers.push(() => { media?.removeEventListener('change', update); observer.disconnect(); chart.dispose(); });
    block.append(caption(start, end));
  }
  function draw() {
    disposers.splice(0).forEach(dispose => dispose()); content.replaceChildren();
    const s = analysis.segments[Number(selector.value)];
    const periods = analysis.periods.filter(r => r.period_start >= s.period_start && r.period_end <= s.period_end);
    const attribution = section(`${fundName} · 跨期归因`);
    attribution.firstChild.append(el('span', `${fmtDate(s.period_start)}~${fmtDate(s.period_end)} · ${s.period_count === 1 ? '仅 1 期' : `${s.period_count} 个半年期`}`, 'muted'));
    content.append(attribution);
    drawChart(attribution, theme => effectsOption(s, analysis.effect_labels, theme), s.period_start, s.period_end);
    const summary = section('跨期结果');
    summary.append(table(
      ['基金累计收益', '模型复合基准', '累计超额收益', '累计残差'],
      [[pct(s.fund_return), pct(s.benchmark_return), amount(s.active_return), amount(s.effects.residual_effect)]],
    ), caption(s.period_start, s.period_end));
    content.append(summary);
    const nav = section(`${fundName} · 净值对比`); content.append(nav);
    s.nav_paths.forEach(path => {
      if (s.nav_paths.length > 1) nav.append(el('p', `净值段：${fmtDate(path.period_start)}~${fmtDate(path.period_end)}`, 'muted'));
      drawChart(nav, theme => navOption(path, fundName, theme), path.points[0].trade_date, path.points.at(-1).trade_date);
    });
    s.nav_issues.forEach(issue => nav.append(el('p', `净值未衔接 ${issue.period_end}：${issue.detail}`, 'muted')));
    if (!s.nav_paths.length && !s.nav_issues.length) nav.append(el('p', '本区间暂无净值曲线', 'muted'));
    if (historyOption(periods, s)) {
      const history = section(`${fundName} · 半年期归因历史`); content.append(history);
      drawChart(history, theme => historyOption(periods, s, theme), s.period_start, s.period_end);
    }
    content.append(rankings('股票行业贡献', '行业', s.drilldown.industries, s, true),
      securityRankings(s.drilldown.securities, s),
      rankings('资产贡献', '资产', s.drilldown.markets, s),
      rankings('转债贡献', '转债', s.drilldown.convertible_bonds, s));
    const performance = section('逐期表现与贡献');
    performance.append(table(['期末', '基金收益', '基准收益', '资产配置', '行业配置', '股票选择', '残差'],
      periods.map(p => [fmtDate(p.period_end), pct(p.fund_return), pct(p.benchmark_return),
        ...['market_allocation_effect', 'industry_allocation_effect', 'security_selection_effect', 'residual_effect'].map(k => amount(p[k]))])),
    caption(s.period_start, s.period_end));
    content.append(performance);
  }
  selector.addEventListener('change', draw); draw();
  return () => { selector.removeEventListener('change', draw); disposers.splice(0).forEach(d => d()); };
}
