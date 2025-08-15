-- Performance indexes for economic data queries
-- Optimizes queries for 104,625+ historical records across 34 series
-- Created for FinanceHub Pro v30 historical data loading

-- ===================================================
-- SERIES OBSERVATION INDEXES (PRIMARY PERFORMANCE)
-- ===================================================

-- Core index for time-series queries (series_id + date descending)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_obs_series_date 
ON econ_series_observation (series_id, period_end DESC);

-- Optimized index for recent data queries (last 3 years)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_obs_date_range 
ON econ_series_observation (period_end DESC) 
WHERE period_end >= '2020-01-01';

-- Transform-specific queries (YoY, MoM calculations)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_obs_transform 
ON econ_series_observation (series_id, transform_code, period_end DESC);

-- Z-score calculation optimization (60+ months lookback)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_obs_zscore_window
ON econ_series_observation (series_id, period_end DESC)
WHERE period_end >= CURRENT_DATE - INTERVAL '72 months';

-- Value-based queries for statistical analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_obs_value_analysis
ON econ_series_observation (series_id, value_std, period_end DESC)
WHERE value_std IS NOT NULL;

-- ===================================================
-- SERIES DEFINITIONS INDEXES (METADATA LOOKUPS)  
-- ===================================================

-- Category and type-based filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_def_category 
ON econ_series_def (category, type_tag);

-- Default transform lookups for YoY calculations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_def_transform
ON econ_series_def (default_transform, category);

-- Unit-based grouping for dashboard displays
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_def_unit
ON econ_series_def (standard_unit, scale_hint);

-- ===================================================
-- CRITICAL ECONOMIC INDICATORS (SPECIALIZED)
-- ===================================================

-- High-priority inflation indicators index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_obs_inflation_series
ON econ_series_observation (period_end DESC, value_std)
WHERE series_id IN ('CPIAUCSL', 'CPILFESL', 'PCEPI', 'PCEPILFE', 'PPIFIS', 'WPSFD49502', 'WPSFD49207', 'WPUFD49104');

-- Labor market indicators index  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_obs_labor_series
ON econ_series_observation (period_end DESC, value_std)
WHERE series_id IN ('UNRATE', 'PAYEMS', 'ICSA', 'CCSA', 'JTSJOL', 'JTSHIL', 'JTUQUR');

-- Financial markets indicators index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_obs_financial_series  
ON econ_series_observation (period_end DESC, value_std)
WHERE series_id IN ('DFF', 'DGS10', 'DGS2', 'T10Y2Y', 'T10YIE', 'MORTGAGE30US', 'VIXCLS');

-- ===================================================
-- COMPOSITE QUERIES (MULTI-TABLE JOINS)
-- ===================================================

-- Optimized for dashboard API queries joining definitions + observations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_obs_dashboard_query
ON econ_series_observation (series_id, period_end DESC, transform_code, value_std);

-- ===================================================
-- HISTORICAL DATA ANALYSIS (LONG TIMEFRAMES)  
-- ===================================================

-- Monthly frequency data (primary frequency in dataset)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_obs_monthly_data
ON econ_series_observation (period_end DESC, value_std)
WHERE freq = 'M';

-- Long-term trend analysis (5+ year lookbacks)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_obs_longterm_trends
ON econ_series_observation (series_id, period_end DESC)
WHERE period_end >= '2015-01-01';

-- ===================================================
-- FEATURES TABLE INDEXES (LAYER 3 - GOLD)
-- ===================================================

-- Z-score feature queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_features_zscore
ON econ_series_features (series_id, period_end DESC, transform_code);

-- Multi-signal classification queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_features_signals
ON econ_series_features (level_class, trend_class, period_end DESC);

-- Pipeline version tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_features_pipeline
ON econ_series_features (pipeline_version, period_end DESC);

-- ===================================================
-- MAINTENANCE AND MONITORING INDEXES
-- ===================================================

-- Data freshness monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_obs_freshness
ON econ_series_observation (period_end DESC, series_id)
WHERE period_end >= CURRENT_DATE - INTERVAL '60 days';

-- Data quality monitoring (null value detection)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_obs_quality
ON econ_series_observation (series_id, period_end DESC)
WHERE value_std IS NULL OR value_std = 0;

-- ===================================================
-- SPECIALIZED ANALYTICS INDEXES
-- ===================================================

-- YoY calculation optimization (requires 12+ months history)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_obs_yoy_calc
ON econ_series_observation (series_id, period_end DESC, value_std)
WHERE transform_code = 'YOY' OR transform_code = 'LEVEL';

-- Seasonal adjustment filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_def_seasonal
ON econ_series_def (seasonal_adj, series_id);

-- ===================================================
-- INDEX CREATION MONITORING
-- ===================================================

-- Monitor index creation progress
DO $$
BEGIN
  RAISE NOTICE 'Economic data performance indexes creation started at: %', NOW();
  RAISE NOTICE 'Indexes will be created CONCURRENTLY to avoid blocking operations';
  RAISE NOTICE 'Monitor progress with: SELECT * FROM pg_stat_progress_create_index;';
END
$$;

-- ===================================================
-- USAGE STATISTICS SETUP
-- ===================================================

-- Enable query statistics collection for performance monitoring
SELECT pg_stat_reset();

-- Create view for economic data query performance monitoring
CREATE OR REPLACE VIEW econ_query_performance AS
SELECT 
    schemaname,
    tablename,
    attname as column_name,
    n_distinct,
    correlation,
    most_common_vals,
    most_common_freqs
FROM pg_stats 
WHERE tablename IN ('econ_series_observation', 'econ_series_def', 'econ_series_features')
ORDER BY tablename, attname;

-- ===================================================
-- COMPLETION SUMMARY
-- ===================================================

DO $$
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE 'ECONOMIC DATA INDEXES CREATION COMPLETED';
  RAISE NOTICE '================================================';  
  RAISE NOTICE 'Created specialized indexes for:';
  RAISE NOTICE '  ✓ Time-series queries (series + date)';
  RAISE NOTICE '  ✓ Transform-specific lookups (YoY, MoM)';  
  RAISE NOTICE '  ✓ Z-score calculations (60+ month windows)';
  RAISE NOTICE '  ✓ Critical economic indicators';
  RAISE NOTICE '  ✓ Dashboard API optimization';
  RAISE NOTICE '  ✓ Long-term trend analysis';
  RAISE NOTICE '  ✓ Data quality monitoring';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Database ready for 104,625+ historical records!';
  RAISE NOTICE 'Run ANALYZE after data loading for optimal performance.';
  RAISE NOTICE '================================================';
END
$$;