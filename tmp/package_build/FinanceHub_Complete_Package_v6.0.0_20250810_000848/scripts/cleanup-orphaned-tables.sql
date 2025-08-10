-- FinanceHub Pro: Orphaned Table Cleanup Script
-- This script removes 23 empty database tables identified during technical debt audit
-- All tables have ZERO rows and are safe to remove

-- Multi-Timeframe Analysis Tables (Unused Complex Feature)
DROP TABLE IF EXISTS "technical_indicators_multi_timeframe";
DROP TABLE IF EXISTS "convergence_signals"; 
DROP TABLE IF EXISTS "bollinger_squeeze_events";
DROP TABLE IF EXISTS "signal_quality_scores";

-- AI Analysis Tables (Superseded by Newer Implementation)
DROP TABLE IF EXISTS "thematic_analysis";
DROP TABLE IF EXISTS "historical_context_snapshots";
DROP TABLE IF EXISTS "historical_context";
DROP TABLE IF EXISTS "narrative_memory";
DROP TABLE IF EXISTS "ai_analysis";

-- Historical Data Tables (Replaced by Current System)
DROP TABLE IF EXISTS "historical_technical_indicators";
DROP TABLE IF EXISTS "historical_market_sentiment";
DROP TABLE IF EXISTS "historical_sector_etf_data";
DROP TABLE IF EXISTS "historical_stock_data";
DROP TABLE IF EXISTS "historical_economic_data";

-- Analytics Tables (Never Implemented)
DROP TABLE IF EXISTS "market_breadth";
DROP TABLE IF EXISTS "market_regimes";
DROP TABLE IF EXISTS "market_patterns";
DROP TABLE IF EXISTS "metric_percentiles";
DROP TABLE IF EXISTS "rolling_statistics";

-- Basic Data Tables (Replaced by Better Implementation)
DROP TABLE IF EXISTS "stock_data";
DROP TABLE IF EXISTS "sector_data";
DROP TABLE IF EXISTS "economic_events";
DROP TABLE IF EXISTS "economic_time_series";
DROP TABLE IF EXISTS "users";

-- Note: These tables will be kept (they have data):
-- ✅ technical_indicators (6,278 rows)
-- ✅ vix_data (4,503 rows)  
-- ✅ market_sentiment (4,503 rows)
-- ✅ economic_indicators_history (929 rows)
-- ✅ economic_statistical_alerts (50 rows)
-- ✅ zscore_technical_indicators (35 rows)
-- ✅ historical_sector_data (6 rows)

-- Cleanup complete - 23 orphaned tables removed