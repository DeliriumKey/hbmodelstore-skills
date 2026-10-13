// Aggregate already calculated issue profits. No fetching or re-estimation of allocations.
export function previousMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit' }).formatToParts(now);
  const year = Number(parts.find(part => part.type === 'year').value);
  const month = Number(parts.find(part => part.type === 'month').value);
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
}

export function monthRange(month) {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const end = new Date(`${month}-01T00:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + 1, 0);
  return { start: `${month}-01`, end: end.toISOString().slice(0, 10) };
}

export function isFullySubscribed(row) {
  const requested = Number(row.subscription_units), cap = Number(row.subscription_cap);
  return Number.isFinite(requested) && Number.isFinite(cap) && cap > 0 && requested >= cap;
}

export function monthlyAnalysis(payload) {
  const months = [];
  const first = payload.start.slice(0, 7), last = payload.end.slice(0, 7);
  for (let month = first; month <= last;) {
    months.push(month);
    const [year, value] = month.split('-').map(Number);
    month = value === 12 ? `${year + 1}-01` : `${year}-${String(value + 1).padStart(2, '0')}`;
  }
  const counts = new Map(months.map(month => [month, 0]));
  for (const row of payload.scenarios[0]?.details ?? []) {
    const month = row.listing_date.slice(0, 7);
    if (counts.has(month)) counts.set(month, counts.get(month) + 1);
  }
  return { ...payload, months, counts: months.map(month => counts.get(month)),
    scenarios: payload.scenarios.map(scenario => {
      const profits = new Map(months.map(month => [month, 0]));
      const unfilled = new Map(months.map(month => [month, 0]));
      const filled = new Map(months.map(month => [month, 0]));
      for (const row of scenario.details) {
        const month = row.listing_date.slice(0, 7);
        if (!profits.has(month)) continue;
        const value = row.profit_yuan == null ? null : Number(row.profit_yuan);
        for (const totals of [profits, isFullySubscribed(row) ? filled : unfilled]) {
          const current = totals.get(month);
          totals.set(month, current == null || value == null || !Number.isFinite(value)
            ? null : current + value);
        }
      }
      return { ...scenario, monthly: months.map(month => {
        const profit = profits.get(month);
        const percent = value => value == null ? null : value / scenario.capital_yuan * 100;
        return { month, profit_yuan: profit,
          return_pct: percent(profit), unfilled_return_pct: percent(unfilled.get(month)),
          filled_return_pct: percent(filled.get(month)) };
      }) };
    }) };
}

export function chartMonth(event, months) {
  const value = event.componentType === 'xAxis' ? event.value
    : event.componentType === 'series' ? event.name : null;
  const month = typeof value === 'string' ? value.replaceAll('/', '-') : null;
  return months.includes(month) ? month : null;
}

export function bindMonthSelection(chart, months, onMonthChange) {
  const selectAxis = event => {
    if (event.componentType !== 'xAxis') return;
    const month = chartMonth(event, months);
    if (month) onMonthChange(month);
  };
  const selectPlot = event => {
    const point = [event.offsetX, event.offsetY];
    if (!chart.containPixel({ gridIndex: 0 }, point)) return;
    const value = chart.convertFromPixel({ xAxisIndex: 0 }, event.offsetX);
    if (typeof value !== 'number' || !Number.isFinite(value)) return;
    const index = Math.max(0, Math.min(months.length - 1, Math.round(value)));
    if (months[index]) onMonthChange(months[index]);
  };
  const layer = chart.getZr();
  chart.on('click', selectAxis);
  layer.on('click', selectPlot);
  return () => { chart.off('click', selectAxis); layer.off('click', selectPlot); };
}

/**
 * @template {{ listing_date: string }} T
 * @param {{ details: T[] }} scenario
 * @param {string | null} month
 * @returns {T[]}
 */
export function detailsForMonth(scenario, month = null) {
  return scenario.details.filter(row => month == null || row.listing_date.startsWith(`${month}-`)).reverse();
}

/**
 * Sort raw values before pagination; displayed rounding never determines the order.
 * @template {{ listing_date: string, code: string, name: string, first_day_return_pct: number | string,
 * allocation_rate: number | string, issue_price: number | string,
 * subscription_units: number | string, subscription_cap: number | string,
 * return_pct: number | string }} T
 * @param {T[]} records
 * @param {number} column
 * @param {boolean} descending
 * @returns {T[]}
 */
export function sortIssuanceDetails(records, column, descending = true) {
  const value = row => [row.listing_date, row.code, row.name, Number(row.first_day_return_pct),
    Number(row.allocation_rate), Number(row.subscription_units) * Number(row.issue_price),
    Number(row.subscription_units) / Number(row.subscription_cap), Number(row.return_pct)][column];
  return [...records].sort((left, right) => {
    const a = value(left), b = value(right);
    const comparison = typeof a === 'string' && typeof b === 'string'
      ? a.localeCompare(b, 'zh-CN') : Number(a) - Number(b);
    return descending ? -comparison : comparison;
  });
}
