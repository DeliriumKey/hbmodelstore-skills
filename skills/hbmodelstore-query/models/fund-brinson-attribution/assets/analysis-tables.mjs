// Shared table behavior for the website and offline Skill report.
export const SECURITY_RANKING_COLUMNS = Object.freeze([
  ['股票', 'name'],
  ['累计持仓权重', 'cumulative_holding_weight'], ['平均单期权重', 'average_period_holding_weight'],
  ['跨期贡献', 'linked_contribution'], ['出现期数', 'observed_periods'],
]);
export const SECURITY_RANKING_PAGE_SIZE = 20;
export const MISSING_SECURITY_INDUSTRY = '__unclassified__';

export function securityRankingFilters(rows, market = '') {
  const marketRows = market ? rows.filter(row => row.market_code === market) : rows;
  return {
    markets: [...new Set(rows.map(row => row.market_code).filter(Boolean))].sort(),
    industries: [...new Set(marketRows.map(row => row.industry_name?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN')),
    hasMissingIndustry: marketRows.some(row => !row.industry_name?.trim()),
  };
}

export function filterSecurityRankings(rows, market = '', industry = '', query = '') {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter(row => (!market || row.market_code === market)
    && (!industry || (industry === MISSING_SECURITY_INDUSTRY ? !row.industry_name?.trim() : row.industry_name?.trim() === industry))
    && terms.every(term => [row.name, row.security_code].filter(Boolean).join(' ').toLowerCase().includes(term)));
}

export function sortRankingRows(rows, field = 'linked_contribution', descending = true) {
  if (!SECURITY_RANKING_COLUMNS.some(([, key]) => key === field)) throw new Error('不支持的个股排序字段');
  const value = row => {
    if (field === 'name') return row[field] == null ? null : String(row[field]).trim() || null;
    const v = row[field];
    return (typeof v === 'number' || typeof v === 'string') && String(v).trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null;
  };
  return [...rows].sort((a, b) => {
    const left = value(a), right = value(b);
    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;
    const comparison = typeof left === 'string' && typeof right === 'string'
      ? left.localeCompare(right, 'zh-CN', { numeric: true }) : left - right;
    return descending ? -comparison : comparison;
  });
}

export function securityRankingPage(rows, field = 'linked_contribution', descending = true, page = 1) {
  const sorted = sortRankingRows(rows, field, descending);
  const pageCount = Math.max(1, Math.ceil(sorted.length / SECURITY_RANKING_PAGE_SIZE));
  const currentPage = Math.max(1, Math.min(pageCount, Number.isFinite(page) ? Math.trunc(page) : 1));
  return { rows: sorted.slice((currentPage - 1) * SECURITY_RANKING_PAGE_SIZE, currentPage * SECURITY_RANKING_PAGE_SIZE),
    page: currentPage, pageCount, total: sorted.length };
}
