// Shared website / offline Skill detail presentation; no fetching or recalculation.
import { detailsForMonth, isFullySubscribed, monthRange, sortIssuanceDetails } from './new-issue-monthly.mjs';

const DETAILS_PAGE_SIZE = 12;
const detailsFormat = (value, digits = 2) => Number(value).toLocaleString('zh-CN', {
  minimumFractionDigits: digits, maximumFractionDigits: digits,
});

/** Build the same filtered, sorted and paged view for React and standalone HTML. */
export function issuanceDetailsView(data, { month, capital, page = 0, column = 0, descending = true, query = '' }) {
  const scenario = data.scenarios.find(s => s.capital_yuan === capital) ?? data.scenarios[0];
  const records = detailsForMonth(scenario, month);
  const needle = query.trim().toLowerCase();
  const matching = records.filter(row => !needle || [row.code, row.name]
    .some(value => String(value ?? '').toLowerCase().includes(needle)));
  const ordered = sortIssuanceDetails(matching, column, descending);
  const pageCount = Math.ceil(matching.length / DETAILS_PAGE_SIZE);
  const currentPage = Math.max(0, Math.min(page, Math.max(0, pageCount - 1)));
  const period = monthRange(month) ?? (records.length
    ? { start: records.at(-1).listing_date, end: records[0].listing_date } : null);
  const heatValues = row => ({
    3: Number(row.first_day_return_pct), 4: Number(row.allocation_rate), 7: Number(row.return_pct),
  });
  /** @type {Record<number, [number, number]>} */
  const heatRanges = {};
  for (const index of [3, 4, 7]) {
    const values = records.map(row => heatValues(row)[index]).filter(Number.isFinite);
    if (values.length) heatRanges[index] = [Math.min(...values), Math.max(...values)];
  }
  const amountLabel = data.market === 'reits' ? '认购金额' : '申购金额';
  const rows = ordered.slice(currentPage * DETAILS_PAGE_SIZE, (currentPage + 1) * DETAILS_PAGE_SIZE).map(row => {
    const amount = Number(row.subscription_units) * Number(row.issue_price);
    const maximum = Number(row.subscription_cap) * Number(row.issue_price);
    const usage = Math.min(100, Math.max(0, amount / maximum * 100));
    /** @type {Record<number, string>} */
    const heatColors = {};
    for (const index of [3, 4, 7]) {
      const value = heatValues(row)[index], range = heatRanges[index];
      if (!range || !Number.isFinite(value)) continue;
      const [minimum, maximum] = range;
      const fraction = maximum > minimum ? (value - minimum) / (maximum - minimum) : 0.5;
      heatColors[index] = `rgba(248, 105, 107, ${fraction})`;
    }
    return { issue_id: row.issue_id, date: row.listing_date.replaceAll('-', '/'), name: row.name, code: row.code,
      firstDayReturn: `${detailsFormat(row.first_day_return_pct, 2)}%`,
      allocationRate: `${detailsFormat(Number(row.allocation_rate) * 100, 4)}%`,
      subscriptionAmount: detailsFormat(amount / 1e4, 2), contribution: `${detailsFormat(row.return_pct, 5)}%`,
      heatColors, quota: { usage, filled: isFullySubscribed(row), text: `${detailsFormat(usage, 2)}%`,
        title: `${amountLabel} ÷ 最大可${data.market === 'reits' ? '认购' : '申购'}金额：${detailsFormat(amount / 1e4, 2)} ÷ ${detailsFormat(maximum / 1e4, 2)} 万元` } };
  });
  return { headers: ['上市日', '代码', '名称', '首日涨幅', '配售率', `${amountLabel}（万元）`, '额度使用率', '收益贡献率'],
    textColumns: [0, 1, 2], rows, period, pageCount, currentPage };
}
