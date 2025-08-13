// Configuration for movers endpoints
export const MOVERS = {
  Z_THRESH_BUY: -1.0,
  Z_THRESH_SELL: +1.0,
  ETF_DEFAULT_HORIZON: '60D' as const,   // or '252D'
  ETF_SPARK_DAYS: 30,
  ECON_TREND_MONTHS: 12,
  CACHE_TTL_ETF_MS: 60_000,              // 60s
  CACHE_TTL_ECON_MS: 30 * 60_000,        // 30m
  ETF_UNIVERSE: ['SPY', 'XLK', 'XLF', 'XLV', 'XLY', 'XLI', 'XLC', 'XLE', 'XLP', 'XLU', 'IYR', 'IWM']
};