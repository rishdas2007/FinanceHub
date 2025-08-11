-- Migration: New Architecture Tables (Bronze → Silver → Gold)
-- Phase 1: Equities refactor with feature store

-- Create authoritative daily bars table (replaces historical_stock_data eventually)
CREATE TABLE IF NOT EXISTS equity_daily_bars (
  symbol TEXT NOT NULL,
  ts_utc TIMESTAMPTZ NOT NULL,
  open DOUBLE PRECISION NOT NULL,
  high DOUBLE PRECISION NOT NULL,
  low DOUBLE PRECISION NOT NULL,
  close DOUBLE PRECISION NOT NULL,
  volume INTEGER,
  PRIMARY KEY (symbol, ts_utc)
);

CREATE INDEX IF NOT EXISTS idx_edb_symbol_desc ON equity_daily_bars (symbol, ts_utc DESC);

-- Create intraday quotes table (ephemeral)
CREATE TABLE IF NOT EXISTS quote_snapshots (
  symbol TEXT NOT NULL,
  ts_utc TIMESTAMPTZ NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  change DOUBLE PRECISION,
  percent_change DOUBLE PRECISION,
  volume INTEGER,
  market_cap INTEGER,
  PRIMARY KEY (symbol, ts_utc)
);

-- Create feature store for precomputed technicals & composites
CREATE TABLE IF NOT EXISTS equity_features_daily (
  symbol TEXT NOT NULL,
  asof_date DATE NOT NULL,
  horizon TEXT NOT NULL,
  
  -- Technical indicators
  rsi14 DOUBLE PRECISION,
  macd DOUBLE PRECISION,
  macd_signal DOUBLE PRECISION,
  boll_up DOUBLE PRECISION,
  boll_mid DOUBLE PRECISION,
  boll_low DOUBLE PRECISION,
  z_close DOUBLE PRECISION,
  sma20 DOUBLE PRECISION,
  sma50 DOUBLE PRECISION,
  sma200 DOUBLE PRECISION,
  atr DOUBLE PRECISION,
  percent_b DOUBLE PRECISION,
  
  -- Statistical metadata
  observations INTEGER NOT NULL,
  mean_value DOUBLE PRECISION,
  std_dev DOUBLE PRECISION,
  
  -- Quality flags
  data_quality TEXT NOT NULL DEFAULT 'medium',
  has_sufficient_data BOOLEAN NOT NULL DEFAULT false,
  
  extras JSONB NOT NULL DEFAULT '{}',
  pipeline_version TEXT NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (symbol, asof_date, horizon, pipeline_version)
);

CREATE INDEX IF NOT EXISTS idx_efd_symbol_date ON equity_features_daily (symbol, asof_date DESC);

-- Phase 2: Macro Bronze/Silver/Gold tables

-- Series definitions (metadata)
CREATE TABLE IF NOT EXISTS econ_series_def (
  series_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL,
  type_tag TEXT NOT NULL,
  native_unit TEXT NOT NULL,
  standard_unit TEXT NOT NULL,
  scale_hint TEXT NOT NULL DEFAULT 'NONE',
  display_precision INTEGER NOT NULL DEFAULT 2,
  default_transform TEXT NOT NULL,
  align_policy TEXT NOT NULL DEFAULT 'last',
  preferred_window_months INTEGER NOT NULL DEFAULT 60,
  seasonal_adj TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_esd_category ON econ_series_def (category);

-- Silver layer: standardized observations
CREATE TABLE IF NOT EXISTS econ_series_observation (
  series_id TEXT NOT NULL REFERENCES econ_series_def(series_id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  freq TEXT NOT NULL,
  value_std DOUBLE PRECISION NOT NULL,
  standard_unit TEXT NOT NULL,
  agg_method TEXT NOT NULL,
  scale_hint TEXT NOT NULL,
  display_precision INTEGER NOT NULL,
  transform_code TEXT NOT NULL,
  PRIMARY KEY (series_id, period_end, transform_code)
);

CREATE INDEX IF NOT EXISTS idx_eso_series_end ON econ_series_observation (series_id, period_end DESC);

-- Gold layer: z-scores and signals
CREATE TABLE IF NOT EXISTS econ_series_features (
  series_id TEXT NOT NULL REFERENCES econ_series_def(series_id),
  period_end DATE NOT NULL,
  transform_code TEXT NOT NULL,
  ref_window_months INTEGER NOT NULL,
  
  value_t DOUBLE PRECISION NOT NULL,
  delta_t DOUBLE PRECISION NOT NULL,
  mean_level DOUBLE PRECISION NOT NULL,
  sd_level DOUBLE PRECISION NOT NULL,
  mean_delta DOUBLE PRECISION NOT NULL,
  sd_delta DOUBLE PRECISION NOT NULL,
  
  level_z DOUBLE PRECISION NOT NULL,
  change_z DOUBLE PRECISION NOT NULL,
  level_class TEXT NOT NULL,
  trend_class TEXT NOT NULL,
  multi_signal TEXT NOT NULL,
  
  pipeline_version TEXT NOT NULL,
  provenance JSONB NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (series_id, period_end, transform_code, pipeline_version)
);

CREATE INDEX IF NOT EXISTS idx_esf_series_end ON econ_series_features (series_id, period_end DESC);

-- Add comments for documentation
COMMENT ON TABLE equity_daily_bars IS 'Authoritative daily OHLCV bars in UTC (replaces historical_stock_data)';
COMMENT ON TABLE equity_features_daily IS 'Precomputed technical indicators and Z-scores (feature store)';
COMMENT ON TABLE econ_series_def IS 'Economic series metadata and formatting rules';
COMMENT ON TABLE econ_series_observation IS 'Silver layer: standardized economic observations';
COMMENT ON TABLE econ_series_features IS 'Gold layer: Z-scores, signals, and classifications';