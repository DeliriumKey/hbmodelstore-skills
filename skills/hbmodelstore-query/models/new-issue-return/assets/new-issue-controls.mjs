// Shared parameter presentation for the documentation page and offline Skill HTML.
import { defaultPrice } from './new-issue-analysis.mjs';
import { capitalLabel } from './new-issue-renderer.mjs';

export const PRICE_LABELS = { open: '首日开盘价', close: '首日收盘价', average: '首日均价' };

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
