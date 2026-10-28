// DOM renderer for the standalone single-period Skill export. Data semantics,
// sorting, filtering, formatting and colors are supplied by brinson-renderer.mjs.
export function renderBrinsonSinglePeriod({ echarts, root, data, notes, helpers }) {
  const {
    ASSETS, assetTableRows, assetWeightColorLimit, assetContributionColorLimit,
    formatContribution, formatPercent, holdingDisplayRow, holdingColumns,
    holdingIndustryOptions, filterHoldings, holdingColorLimits, sortHoldings,
    numeric, renderBrinsonChart, sortIndustries, weightCellBackground,
    industryColorLimits, returnCellBackground,
  } = helpers;
  const detail = data.detail;
  const period = detail.period;
  const name = data.history.at(-1).fund_name;
  const end = period.period_end;
  const el = (tag, text = '', className = '') => {
    const node = document.createElement(tag);
    if (text !== '') node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const section = (title) => {
    const node = el('section', '', 'report-section');
    node.append(el('h2', title)); root.append(node); return node;
  };
  const source = (text) => { const p = el('p', text, 'source'); return p; };
  const amount = (value) => {
    const span = el('span', formatContribution(value));
    const n = numeric(value);
    if (n > 0) span.className = 'amount-positive';
    if (n < 0) span.className = 'amount-negative';
    return span;
  };
  const appendValue = (cell, value) => cell.append(value instanceof Node ? value : document.createTextNode(value));
  const table = ({ headers, rows, textColumns = [0], styles, sort }) => {
    const wrap = el('div', '', 'table-wrap');
    const node = el('table'); const head = el('thead'); const trh = el('tr');
    headers.forEach((header, column) => {
      const th = el('th');
      if (sort) {
        const button = el('button', `${header}${sort.column === column ? (sort.descending ? ' ↓' : ' ↑') : ''}`, 'sort-button');
        button.type = 'button'; button.addEventListener('click', () => sort.onChange(column)); th.append(button);
      } else th.textContent = header;
      trh.append(th);
    });
    head.append(trh); node.append(head); const body = el('tbody');
    rows.forEach((row, rowIndex) => {
      const tr = el('tr'); row.forEach((value, column) => {
        const td = el('td'); if (textColumns.includes(column)) td.style.textAlign = 'left';
        appendValue(td, value); const style = styles?.(rowIndex, column);
        if (style?.backgroundColor) td.style.backgroundColor = style.backgroundColor;
        tr.append(td);
      }); body.append(tr);
    });
    node.append(body); wrap.append(node); return wrap;
  };
  const chart = (parent, kind, rows) => {
    const node = el('div', '', 'chart'); parent.append(node);
    renderBrinsonChart({ echarts, root: node, kind, data: rows, options: { fundName: name } });
  };

  const attribution = section(`${name} · 单期归因 · ${end}`);
  chart(attribution, 'effects', [period]); attribution.append(source(notes.period));

  const result = section('单期结果');
  result.append(table({ headers: ['基金收益', '模型复合基准', '超额收益', '残差'], textColumns: [], rows: [[
    formatPercent(period.fund_return), formatPercent(period.benchmark_return),
    amount(period.active_return), amount(period.residual_effect),
  ]] }));
  const assetRows = assetTableRows(detail.markets);
  const weightLimit = assetWeightColorLimit(assetRows);
  const contributionLimit = assetContributionColorLimit(assetRows);
  for (const kind of ['weight', 'contribution']) {
    const rows = assetRows.filter(row => row.kind === kind);
    result.append(table({ headers: ['项目', ...ASSETS.map(([, label]) => label)], rows: rows.map(row => [
      row.label, ...row.values.map(value => kind === 'weight' ? formatPercent(value) : formatContribution(value)),
    ]), styles: (row, column) => column === 0 ? null : ({ backgroundColor: kind === 'weight'
      ? weightCellBackground(rows[row].values[column - 1], weightLimit)
      : returnCellBackground(rows[row].values[column - 1], contributionLimit) }) }));
  }
  result.append(source(notes.period));

  const nav = section(`${name} · 净值对比`);
  if (data.nav.points.length) { chart(nav, 'nav', data.nav.points); nav.append(source(notes.nav)); }
  else nav.append(el('p', '该期未返回净值点。', 'muted'));

  const industry = section('股票行业贡献');
  const industryHeading = el('div', '', 'section-heading');
  industry.replaceChildren(industryHeading);
  industryHeading.append(el('h2', '股票行业贡献'));
  const marketSelect = el('select'); marketSelect.setAttribute('aria-label', '行业市场');
  for (const [value, label] of [['A_SHARE', 'A股'], ['HK', '港股']]) { const option = el('option', label); option.value = value; marketSelect.append(option); }
  industryHeading.append(marketSelect); const industryContent = el('div', '', 'ranking-content'); industry.append(industryContent);
  let industryMarket = 'A_SHARE'; let industrySort = { column: 1, descending: true };
  const industryFields = ['industry_name', 'portfolio_market_weight', 'benchmark_market_weight', 'portfolio_industry_return', 'benchmark_industry_return', 'allocation_effect', 'selection_effect'];
  const drawIndustries = () => {
    const rows = sortIndustries(detail.industries.filter(row => row.market_code === industryMarket), industryFields[industrySort.column], industrySort.descending);
    const limits = industryColorLimits(rows);
    industryContent.replaceChildren(table({ headers: ['行业', '组合权重', '基准权重', '组合行业收益', '行业基准收益', '配置贡献', '选择贡献'],
      sort: { ...industrySort, onChange(column) { industrySort = { column, descending: industrySort.column === column ? !industrySort.descending : true }; drawIndustries(); } },
      rows: rows.map(row => [String(row.industry_name ?? '—'), formatPercent(row.portfolio_market_weight), formatPercent(row.benchmark_market_weight), formatPercent(row.portfolio_industry_return), formatPercent(row.benchmark_industry_return), amount(row.allocation_effect), amount(row.selection_effect)]),
      styles: (row, column) => ({ backgroundColor: [1, 2].includes(column) ? weightCellBackground(rows[row][industryFields[column]], limits.weight) : [3, 4].includes(column) ? returnCellBackground(rows[row][industryFields[column]], limits.returnMagnitude) : undefined }),
    }));
    industryContent.append(el('p', '组合权重为该行业占基金所选A股或港股组合的比例，基准权重为该行业占对应市场基准的比例，均非占基金净值。', 'note'));
    const standard = rows[0]?.industry_standard; industryContent.append(source(`${notes.period}${standard ? `；行业体系：${standard}` : ''}`));
  };
  marketSelect.addEventListener('change', () => { industryMarket = marketSelect.value; industrySort = { column: 1, descending: true }; drawIndustries(); }); drawIndustries();

  const holdings = section('持仓明细');
  const controls = el('div', '', 'controls'); const holdingMarket = el('select'); holdingMarket.setAttribute('aria-label', '持仓市场');
  for (const [value, label] of ASSETS.slice(0, 3)) { const option = el('option', label); option.value = value; holdingMarket.append(option); }
  const holdingIndustry = el('select'); holdingIndustry.setAttribute('aria-label', '持仓行业');
  controls.append(holdingMarket, holdingIndustry); holdings.append(controls);
  const toolbar = el('div', '', 'table-toolbar'); const search = el('input'); search.type = 'search'; search.placeholder = '筛选持仓'; search.setAttribute('aria-label', '筛选持仓');
  const pager = el('nav', '', 'pagination'); toolbar.append(search, pager); holdings.append(toolbar);
  const holdingContent = el('div', '', 'ranking-content'); holdings.append(holdingContent);
  let holdingMarketValue = 'A_SHARE'; let industryValue = ''; let query = ''; let holdingSort = null; let page = 1;
  const drawHoldings = () => {
    const convertible = holdingMarketValue === 'CONVERTIBLE_BOND'; const columns = holdingColumns(convertible);
    const sourceRows = convertible ? detail.convertible_bonds : detail.securities.filter(row => row.market_code === holdingMarketValue);
    const displayRows = sourceRows.map(row => holdingDisplayRow(row, convertible));
    holdingIndustry.replaceChildren(...holdingIndustryOptions(displayRows).map(([value, label]) => { const option = el('option', label); option.value = value; option.selected = value === industryValue; return option; }));
    const filtered = filterHoldings(displayRows, query, industryValue);
    const sorted = sortHoldings(filtered, holdingSort ? columns[holdingSort.column][1] : null, holdingSort?.descending ?? true);
    const colors = holdingColorLimits(displayRows, convertible); const pageCount = Math.max(1, Math.ceil(sorted.length / 20)); page = Math.min(page, pageCount);
    const rows = sorted.slice((page - 1) * 20, page * 20);
    pager.replaceChildren(); pager.hidden = pageCount <= 1;
    const pageButton = (label, target, current = false) => { const button = el('button', label); button.type = 'button'; button.disabled = target < 1 || target > pageCount; if (current) button.setAttribute('aria-current', 'page'); button.addEventListener('click', () => { page = target; drawHoldings(); }); pager.append(button); };
    pageButton('←', page - 1); for (let i = 1; i <= pageCount; i += 1) pageButton(String(i), i, i === page); pageButton('→', page + 1);
    holdingContent.replaceChildren(table({ headers: columns.map(([label]) => label), textColumns: convertible ? [0, 1, 2, 3, columns.length - 1] : [0, 1, 2],
      sort: { column: holdingSort?.column ?? -1, descending: holdingSort?.descending ?? true, onChange(column) { holdingSort = { column, descending: holdingSort?.column === column ? !holdingSort.descending : true }; page = 1; drawHoldings(); } },
      rows: rows.map(row => [String(row.security_code ?? '—'), String(row.security_name ?? '—'), ...(convertible ? [String(row.underlying_code ?? '—')] : []), String(row.industry_name ?? '—'), formatPercent(row.holding_nav_weight), formatPercent(row.attribution_nav_weight), formatPercent(row.security_return), ...(convertible ? [numeric(row.beta)?.toFixed(2) ?? '—', amount(row.actual_return_contribution), amount(row.industry_allocation_contribution), amount(row.stock_selection_contribution), amount(row.other_excess_contribution), row.terminal_proxy_applied ? '等值转股' : '—'] : [formatPercent(row.comparison_return), amount(row.actual_return_contribution), amount(row.excess_selection_contribution)])]),
      styles: (rowIndex, column) => { const field = columns[column][1]; const value = rows[rowIndex][field]; return { backgroundColor: ['holding_nav_weight', 'attribution_nav_weight'].includes(field) ? weightCellBackground(value, colors.weight) : ['security_return', 'comparison_return'].includes(field) ? returnCellBackground(value, colors.returnMagnitude) : undefined }; },
    }));
  };
  holdingMarket.addEventListener('change', () => { holdingMarketValue = holdingMarket.value; industryValue = ''; holdingSort = null; page = 1; drawHoldings(); });
  holdingIndustry.addEventListener('change', () => { industryValue = holdingIndustry.value; page = 1; drawHoldings(); });
  search.addEventListener('input', () => { query = search.value; page = 1; drawHoldings(); }); drawHoldings();
  holdings.append(el('p', '持仓权重为原始披露比例，归因权重为市场内标准化后的比例，均占基金净值。', 'note'), source(notes.period));
  if (detail.securities.length >= 500 || detail.convertible_bonds.length >= 1000) holdings.append(el('p', '明细已达到接口返回上限，当前排序仅针对已返回证券。', 'muted'));
}
