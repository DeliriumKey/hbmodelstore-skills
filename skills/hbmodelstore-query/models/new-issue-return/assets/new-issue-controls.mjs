// Shared parameter presentation for the documentation page and offline Skill HTML.
import { defaultPrice } from './new-issue-analysis.mjs';
import { capitalLabel } from './new-issue-renderer.mjs';

export const PRICE_LABELS = { open: '首日开盘价', close: '首日收盘价', average: '首日均价' };

export const BSE_POLICY_NOTICE = {
  title: '北交所市值配售改革',
  text: '若采用市值配售，收益测算需依据持股市值、申购额度和新的配售规则计算打新贡献，并将股票底仓盈亏纳入策略总收益。原先依靠现金申购、不承担股票底仓波动的低风险打新方式将无法原样延续。本组件仍按现金申购、网上比例配售测算历史收益。监管部门已提出推进改革；截至 2026/10/27，尚未查到实施细则及生效日期。',
  sourceLabel: '政策报道：中国证券报，2026/10/22',
  sourceUrl: 'https://finance.eastmoney.com/a/202610223903100179.html',
};

export function scenarioRequest({ market, scope, capitals, defaults, price, budget, investor }) {
  const label = market === 'hs' ? { sh: '沪市', sz: '深市', dual: '沪深双打' }[scope]
    : market === 'bse' ? '北交所' : 'REITs';
  let request = `比较${label}不同规模的打新收益，生成交互网页。`;
  if (capitals.length !== defaults.length || capitals.some((value, index) => value !== defaults[index])) {
    request += `规模为${capitals.map(capitalLabel).join('、')}。`;
  }
  const options = [];
  if (price !== defaultPrice(market)) options.push(PRICE_LABELS[price]);
  if (budget !== 90) options.push(`${budget}%申报预算`);
  if (market === 'hs' && investor !== 'A') options.push(`${investor}类`);
  if (options.length) request += `按${options.join('、')}计算。`;
  return request;
}
