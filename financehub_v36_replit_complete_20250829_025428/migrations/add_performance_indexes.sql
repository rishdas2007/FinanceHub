-- ✅ PHASE 1 TASK 3: Add Missing Database Indexes for Performance Optimization

-- Economic data query optimization for YoY transformer
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_current_series_period 
ON economic_indicators_current (series_id, period_date DESC) 
INCLUDE (value_numeric, unit);

-- Historical economic data optimization  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_history_metric_date_value 
ON economic_indicators_history (metric_name, period_date DESC) 
INCLUDE (value, unit, series_id);

-- ETF Symbol batch query optimization for stock_data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_data_symbol_array 
ON stock_data (symbol, timestamp DESC) 
INCLUDE (price, change_percent, volume)
WHERE symbol = ANY(ARRAY['SPY','XLK','XLV','XLF','XLY','XLI','XLC','XLP','XLE','XLU','XLB','XLRE']);

-- Technical indicators join optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tech_indicators_symbol_timestamp 
ON technical_indicators (symbol, timestamp DESC) 
INCLUDE (rsi, macd_line, percent_b, sma_20, sma_50, bb_upper, bb_lower, atr);

-- Z-score composite index for faster ETF metrics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zscore_tech_composite 
ON zscore_technical_indicators (symbol, date DESC) 
INCLUDE (composite_zscore, rsi_zscore, macd_zscore, signal);

-- Equity features daily optimization for ETF processing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_equity_features_symbol_date
ON equity_features_daily (symbol, asof_date DESC)
INCLUDE (rsi14, macd, bb_pctb_20, composite_z_60d)
WHERE symbol = ANY(ARRAY['SPY','XLK','XLV','XLF','XLY','XLI','XLC','XLP','XLE','XLU','XLB','XLRE']);

-- Economic indicators current quick lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_current_latest
ON economic_indicators_current (series_id, is_latest, period_date DESC)
WHERE is_latest = true;

-- Performance monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_data_recent_activity
ON stock_data (timestamp DESC, symbol);

-- ETF volume and price trends
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_data_etf_trends
ON stock_data (symbol, timestamp)
INCLUDE (price, volume, change_percent);