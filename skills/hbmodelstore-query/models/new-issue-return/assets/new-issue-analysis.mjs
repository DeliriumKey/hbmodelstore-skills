// Browser counterpart of the Decimal-based offline analyze.py. No I/O or model refresh.
export const STARTS = { hs: '2023-04-10', bse: '2021-11-15', reits: '2021-06-21' };
export const defaultPrice = market => market === 'reits' ? 'average' : 'open';
const PRICE_FIELDS = { open: 'first_day_open', close: 'first_day_close', average: 'first_day_average' };

function number(value) {
  if (typeof value === 'boolean' || value == null || String(value).trim() === '') throw new Error('数值无效');
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error('数值无效');
  return result;
}

function date(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(value).toISOString().slice(0, 10) !== value) {
    throw new Error('日期须为有效的 YYYY-MM-DD');
  }
  return value;
}

export function analyze(tables, { market, capitals, start, end, scope = 'sh', investor_class = 'A',
  budget_ratio = 0.9, price_basis = defaultPrice(market) }) {
  if (!(market in STARTS) || !['sh', 'sz', 'dual'].includes(scope)
    || !['A', 'B'].includes(investor_class) || !(price_basis in PRICE_FIELDS)) throw new Error('计算参数无效');
  if (date(start) > date(end)) throw new Error('结束日不能早于起始日');
  const ratio = number(budget_ratio);
  if (!(ratio > 0 && ratio <= 1)) throw new Error('申报预算比例须大于 0 且不超过 100%');
  const amounts = [...new Set(capitals.map(number))].sort((a, b) => a - b);
  if (!amounts.length || amounts.length > 8 || amounts.some(c => c <= 0 || c > 1e12)) {
    throw new Error('请输入 1–8 个正数规模，最高 1 万亿元');
  }
  const minimum = scope === 'dual' ? 2e8 : 1e8;
  if (market === 'hs' && amounts.some(c => c < minimum)) {
    throw new Error(scope === 'dual' ? '双打按合计规模计算，最低 2 亿元' : '沪或深的最低展示规模为 1 亿元');
  }
  const rows = tables[market];
  if (!Array.isArray(rows) || rows.length > 10500) throw new Error('发行表无效或超过上限');
  if (new Set(rows.map(r => r.issue_id)).size !== rows.length) throw new Error('发行记录重复');
  const selected = rows.filter(r => start <= (r.listing_date || r.subscription_date || '')
    && (r.listing_date || r.subscription_date || '') <= end
    && (market !== 'hs' || scope === 'dual' || r.code.endsWith(scope === 'sh' ? '.SH' : '.SZ')))
    .sort((a, b) => (a.listing_date || a.subscription_date).localeCompare(b.listing_date || b.subscription_date)
      || a.issue_id.localeCompare(b.issue_id));
  const rateField = market === 'hs' ? `offline_rate_${investor_class.toLowerCase()}`
    : market === 'bse' ? 'online_rate' : 'offline_rate';
  const capField = market === 'bse' ? 'online_cap' : 'offline_cap', priceField = PRICE_FIELDS[price_basis];
  const valid = [], omitted = [];
  for (const row of selected) {
    let reason = null, missing = [];
    if (market === 'hs' && [false, 0].includes(row.has_offline)) reason = 'no_offline';
    else if (!row.listing_date) reason = 'pending';
    else {
      missing = ['issue_price', priceField, rateField, capField].filter(f => row[f] == null);
      if (market === 'hs' && ![true, 1].includes(row.has_offline)) missing.push('has_offline');
      if (missing.length) reason = 'missing_data';
    }
    if (reason) { omitted.push({ issue_id: row.issue_id, code: row.code, reason, missing }); continue; }
    const [issue, sell, rate, cap] = ['issue_price', priceField, rateField, capField].map(f => number(row[f]));
    if (issue <= 0 || sell <= 0 || cap <= 0 || rate < 0 || rate > 1) throw new Error(`${row.code} 的财务数值无效`);
    valid.push({ row, issue, sell, rate, cap });
  }
  const scenarios = amounts.map(capital => {
    let total = 0;
    const history = [], details = [];
    for (const { row, issue, sell, rate, cap } of valid) {
      const requested = Math.min(capital * ratio / issue, cap), allocated = requested * rate;
      const profit = allocated * (sell - issue);
      total += profit;
      const point = { date: row.listing_date, profit_yuan: total, return_pct: total / capital * 100 };
      if (history.at(-1)?.date === point.date) history[history.length - 1] = point;
      else history.push(point);
      details.push({ issue_id: row.issue_id, code: row.code, name: row.name, listing_date: row.listing_date,
        issue_price: String(issue), sell_price: String(sell), first_day_return_pct: (sell - issue) / issue * 100,
        subscription_cap: String(cap), allocation_rate: String(rate),
        subscription_units: String(requested), allocated_units: String(allocated), profit_yuan: String(profit),
        return_pct: profit / capital * 100 });
    }
    return { capital_yuan: capital, profit_yuan: total, return_pct: total / capital * 100,
      included: valid.length, history, details };
  });
  return { model_key: 'new-issue-return', market, scope: market === 'hs' ? scope : null, start, end,
    price_basis, investor_class: market === 'hs' ? investor_class : null, budget_ratio: ratio,
    sample_count: selected.length, included: valid.length, omitted, source_rows: selected, scenarios,
    updated_at: selected.map(r => r.updated_at || '').sort().at(-1) || null };
}
