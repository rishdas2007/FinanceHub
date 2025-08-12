-- db/materialized_tables.sql
-- Materialized table for ETF metrics optimization
-- This table will be populated from existing equity_features_daily data

CREATE TABLE IF NOT EXISTS etf_metrics_latest (
  symbol TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  last_price NUMERIC NOT NULL,
  pct_change_1d NUMERIC NOT NULL,
  perf_5d NUMERIC,
  perf_1m NUMERIC,
  volume BIGINT,
  rsi NUMERIC,
  macd NUMERIC,
  bb_percent_b NUMERIC,
  sma_50 NUMERIC,
  sma_200 NUMERIC,
  ema_21 NUMERIC,
  mini_trend_30d JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create or refresh this table from equity_features_daily
INSERT INTO etf_metrics_latest (
  symbol, name, last_price, pct_change_1d, perf_5d, perf_1m,
  volume, rsi, macd, bb_percent_b, sma_50, sma_200, ema_21,
  mini_trend_30d
)
SELECT DISTINCT ON (symbol)
  symbol,
  COALESCE(name, symbol) as name,
  COALESCE(close_price, 0) as last_price,
  COALESCE(pct_change_1d, 0) as pct_change_1d,
  COALESCE(perf_5d, 0) as perf_5d,
  COALESCE(perf_1m, 0) as perf_1m,
  COALESCE(volume, 0) as volume,
  COALESCE(rsi_14, 0) as rsi,
  COALESCE(macd_line, 0) as macd,
  COALESCE(bb_percent_b, 0) as bb_percent_b,
  COALESCE(sma_50, 0) as sma_50,
  COALESCE(sma_200, 0) as sma_200,
  COALESCE(ema_21, 0) as ema_21,
  COALESCE('[]'::jsonb) as mini_trend_30d
FROM equity_features_daily
WHERE date_calculated >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY symbol ASC, date_calculated DESC
ON CONFLICT (symbol) DO UPDATE SET
  name = EXCLUDED.name,
  last_price = EXCLUDED.last_price,
  pct_change_1d = EXCLUDED.pct_change_1d,
  perf_5d = EXCLUDED.perf_5d,
  perf_1m = EXCLUDED.perf_1m,
  volume = EXCLUDED.volume,
  rsi = EXCLUDED.rsi,
  macd = EXCLUDED.macd,
  bb_percent_b = EXCLUDED.bb_percent_b,
  sma_50 = EXCLUDED.sma_50,
  sma_200 = EXCLUDED.sma_200,
  ema_21 = EXCLUDED.ema_21,
  mini_trend_30d = EXCLUDED.mini_trend_30d,
  updated_at = CURRENT_TIMESTAMP;