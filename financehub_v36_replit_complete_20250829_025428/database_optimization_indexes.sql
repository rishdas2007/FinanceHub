-- FinanceHub Pro v25 Database Optimization Indexes
-- High-impact database query optimizations

-- 1. Optimize batch sparklines query
-- This index will dramatically speed up the economic indicators sparkline batch processing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_obs_batch_sparklines
ON econ_series_observation (series_id, period_end DESC, value_std)
WHERE value_std IS NOT NULL;

-- 2. Optimize economic health dashboard queries  
-- This targets the most frequently accessed economic indicators
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_obs_health_series
ON econ_series_observation (series_id, period_end DESC)
WHERE series_id IN ('GDPC1', 'UNRATE', 'CPIAUCSL', 'DGS10', 'PAYEMS', 'FEDFUNDS', 'MORTGAGE30US');

-- 3. Optimize ETF metrics queries
-- This speeds up the ETF technical analysis data retrieval
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_etf_latest_metrics
ON etf_metrics_latest (symbol, updated_at DESC);

-- 4. Optimize historical data queries with composite index
-- This improves performance for trend analysis and historical comparisons
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_obs_series_period_transform
ON econ_series_observation (series_id, transform_code, period_end DESC);

-- 5. Speed up Z-score and feature queries
-- This optimizes the technical analysis feature calculations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_features_series
ON econ_series_features (series_id, updated_at DESC);

-- 6. Optimize market data queries
-- This improves stock data retrieval performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_data_symbol_date
ON stock_data (symbol, date DESC);

-- 7. Optimize technical indicators queries
-- This speeds up technical analysis calculations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_technical_indicators_symbol_date
ON technical_indicators (symbol, date DESC);

-- Performance monitoring query to check index usage
-- Run this to verify the indexes are being used effectively
/*
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE tablename IN ('econ_series_observation', 'etf_metrics_latest', 'stock_data')
ORDER BY tablename, attname;
*/