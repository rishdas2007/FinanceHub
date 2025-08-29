-- Economic Data Performance Indexes for FinanceHub Pro v30
-- Optimized for 104,625+ historical records and high-frequency queries
-- Created: August 15, 2025

-- Performance indexes for economic data queries
-- These indexes support the 3-layer economic data model (Bronze -> Silver -> Gold)

-- Primary lookup index: series + date (most common query pattern)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_obs_series_date 
ON econ_series_observation (series_id, period_end DESC);

-- Date range queries (dashboard queries for recent data)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_obs_date_range 
ON econ_series_observation (period_end DESC) 
WHERE period_end >= '2020-01-01';

-- Transform-specific queries (YoY, MoM calculations)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_obs_transform 
ON econ_series_observation (series_id, transform_code, period_end DESC);

-- Z-score calculation window index (critical for performance)
-- Supports 60+ month lookback calculations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_obs_zscore_window
ON econ_series_observation (series_id, period_end DESC)
WHERE period_end >= CURRENT_DATE - INTERVAL '72 months';

-- Series definitions lookup optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_def_category 
ON econ_series_def (category, type_tag);

-- Transform and unit lookup for data processing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_def_transform_unit
ON econ_series_def (default_transform, standard_unit);

-- Economic features table indexes (Gold layer)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_features_series_date
ON econ_series_features (series_id, period_end DESC);

-- Multi-signal classification index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_features_signals
ON econ_series_features (level_class, trend_class, multi_signal);

-- Pipeline version index for data lineage
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_features_pipeline
ON econ_series_features (pipeline_version, period_end DESC);

-- Composite index for economic health dashboard queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_dashboard_composite
ON econ_series_observation (series_id, period_end DESC, transform_code)
WHERE series_id IN ('CPIAUCSL', 'UNRATE', 'DFF', 'DGS10', 'ICSA', 'PAYEMS', 'INDPRO');

-- Recent data index for real-time dashboard performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_obs_recent
ON econ_series_observation (period_end DESC, series_id)
WHERE period_end >= CURRENT_DATE - INTERVAL '24 months';

-- Standard unit grouping for formatting queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_econ_obs_unit_group
ON econ_series_observation (standard_unit, scale_hint);

-- ANALYZE tables to update statistics after index creation
ANALYZE econ_series_observation;
ANALYZE econ_series_def;
ANALYZE econ_series_features;

-- Create helpful views for common queries
CREATE OR REPLACE VIEW econ_series_current AS
SELECT 
    obs.series_id,
    def.display_name,
    def.category,
    def.type_tag,
    obs.period_end,
    obs.value_std,
    obs.standard_unit,
    obs.scale_hint,
    obs.display_precision,
    obs.transform_code,
    def.default_transform
FROM econ_series_observation obs
JOIN econ_series_def def ON obs.series_id = def.series_id
WHERE obs.period_end = (
    SELECT MAX(period_end) 
    FROM econ_series_observation obs2 
    WHERE obs2.series_id = obs.series_id
);

-- Create view for critical economic indicators
CREATE OR REPLACE VIEW econ_critical_indicators AS
SELECT 
    series_id,
    display_name,
    category,
    type_tag,
    value_std as current_value,
    period_end as current_date,
    standard_unit,
    scale_hint,
    display_precision
FROM econ_series_current
WHERE series_id IN ('CPIAUCSL', 'UNRATE', 'DFF', 'DGS10', 'ICSA', 'PAYEMS', 'INDPRO')
ORDER BY 
    CASE 
        WHEN category = 'Inflation' THEN 1
        WHEN category = 'Labor' THEN 2
        WHEN category = 'Monetary Policy' THEN 3
        WHEN category = 'Financial' THEN 4
        ELSE 5
    END,
    series_id;

-- Grant necessary permissions
GRANT SELECT ON econ_series_current TO PUBLIC;
GRANT SELECT ON econ_critical_indicators TO PUBLIC;

-- Performance monitoring query for validation
-- This query can be used to verify index effectiveness
/*
EXPLAIN (ANALYZE, BUFFERS) 
SELECT series_id, period_end, value_std 
FROM econ_series_observation 
WHERE series_id = 'CPIAUCSL' 
  AND period_end >= CURRENT_DATE - INTERVAL '60 months'
ORDER BY period_end DESC;
*/

-- Index size monitoring
SELECT 
    schemaname,
    tablename,
    attname as column_name,
    n_distinct,
    correlation
FROM pg_stats 
WHERE schemaname = 'public' 
  AND tablename LIKE 'econ_%'
ORDER BY tablename, attname;

-- Final validation: Ensure all critical indexes exist
SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes 
WHERE tablename LIKE 'econ_%' 
  AND schemaname = 'public'
ORDER BY tablename, indexname;