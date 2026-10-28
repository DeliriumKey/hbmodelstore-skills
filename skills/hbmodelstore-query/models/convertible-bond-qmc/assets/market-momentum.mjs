import { alignMarketMomentumHistory, marketMomentumOption } from './market-renderer.mjs';

// A chart unit within market research; both inputs are saved API responses.
export function buildChart({ market, momentum }, context = {}) {
  if (!Array.isArray(market?.rows) || !Array.isArray(momentum?.rows)) {
    throw new Error('market and momentum must be saved API responses with rows');
  }
  if (momentum.rows.some(row => row.index_code !== '931078.CSI' || row.lookback !== 20)) {
    throw new Error('momentum must use 931078.CSI with a 20-trading-day lookback');
  }
  const rows = alignMarketMomentumHistory(market.rows, momentum.rows);
  return { option: marketMomentumOption(rows, context.dark, context.width) };
}
