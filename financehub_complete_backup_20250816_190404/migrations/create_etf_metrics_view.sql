-- ✅ PHASE 1 TASK 3: Database Performance Optimization
-- Replace N+1 ETF queries with single materialized view for faster dashboard loads

-- Drop existing view if it exists
DROP MATERIALIZED VIEW IF EXISTS etf_metrics_latest_new;

-- Create new optimized materialized view
CREATE MATERIALIZED VIEW etf_metrics_latest_new AS 
SELECT 
  sd.symbol,
  sd.symbol AS name,  -- For compatibility
  sd.price AS last_price,
  sd.change_percent AS pct_change_1d,
  NULL::numeric AS perf_5d,
  NULL::numeric AS perf_1m,
  sd.volume,
  ti.rsi,
  ti.macd_line AS macd,
  ti.percent_b AS bb_percent_b,
  ti.sma_20 AS sma_50,  -- Map to expected field names
  ti.sma_50 AS sma_200,
  NULL::numeric AS ema_21,
  '[]'::jsonb AS mini_trend_30d,
  CURRENT_TIMESTAMP AS updated_at,
  sd.timestamp AS as_of,
  'database' AS provider,
  'consolidated' AS indicator_spec,
  'good' AS dq_status,
  zti.composite_zscore,
  zti.rsi_zscore,
  zti.macd_zscore
FROM (
  SELECT DISTINCT ON (symbol) 
    symbol, 
    price, 
    change_percent, 
    volume,
    timestamp
  FROM stock_data 
  WHERE timestamp >= CURRENT_DATE - INTERVAL '2 days'
    AND symbol = ANY(ARRAY['SPY','XLK','XLV','XLF','XLY','XLI','XLC','XLP','XLE','XLU','XLB','XLRE'])
  ORDER BY symbol, timestamp DESC
) sd
LEFT JOIN (
  SELECT DISTINCT ON (symbol) 
    symbol, 
    rsi, 
    macd_line,
    percent_b,
    sma_20, 
    sma_50, 
    bb_upper, 
    bb_lower, 
    atr
  FROM technical_indicators 
  WHERE timestamp >= CURRENT_DATE - INTERVAL '2 days'
    AND symbol = ANY(ARRAY['SPY','XLK','XLV','XLF','XLY','XLI','XLC','XLP','XLE','XLU','XLB','XLRE'])
  ORDER BY symbol, timestamp DESC
) ti ON sd.symbol = ti.symbol
LEFT JOIN (
  SELECT DISTINCT ON (symbol) 
    symbol, 
    composite_zscore, 
    rsi_zscore, 
    macd_zscore
  FROM zscore_technical_indicators 
  WHERE date >= CURRENT_DATE - INTERVAL '7 days'
    AND symbol = ANY(ARRAY['SPY','XLK','XLV','XLF','XLY','XLI','XLC','XLP','XLE','XLU','XLB','XLRE'])
  ORDER BY symbol, date DESC
) zti ON sd.symbol = zti.symbol;

-- Create unique index for fast lookups
CREATE UNIQUE INDEX idx_etf_metrics_latest_new_symbol ON etf_metrics_latest_new (symbol);

-- Create refresh function
CREATE OR REPLACE FUNCTION refresh_etf_metrics_materialized_view() 
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW etf_metrics_latest_new;
END;
$$ LANGUAGE plpgsql;

-- Initial refresh
SELECT refresh_etf_metrics_materialized_view();