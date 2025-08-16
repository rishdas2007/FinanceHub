-- ============================================
-- FinanceHub: ETF features & helpers migration
-- ============================================
-- Safe to re-run: uses IF NOT EXISTS everywhere.
-- Target: Postgres 13+

-- 0) Ensure base tables exist (no-op if present)
CREATE TABLE IF NOT EXISTS equity_daily_bars (
  symbol      text NOT NULL,
  ts_utc      timestamptz NOT NULL,
  open        double precision,
  high        double precision,
  low         double precision,
  close       double precision,
  volume      double precision,
  PRIMARY KEY (symbol, ts_utc)
);

CREATE TABLE IF NOT EXISTS equity_features_daily (
  symbol            text NOT NULL,
  asof_date         date NOT NULL,
  horizon           text NOT NULL,   -- e.g., '20D'|'60D'|'252D'
  pipeline_version  text NOT NULL DEFAULT 'v1',
  z_close           double precision,  -- legacy/basic z if you had it
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- 0.1) Uniqueness for features rows (one row per symbol/date/horizon)
CREATE UNIQUE INDEX IF NOT EXISTS idx_efd_uniq
  ON equity_features_daily (symbol, asof_date, horizon);

-- 1) New feature columns (nullable; computed by builder)
ALTER TABLE equity_features_daily
  ADD COLUMN IF NOT EXISTS composite_z_60d   double precision,
  ADD COLUMN IF NOT EXISTS dz1_60d           double precision,
  ADD COLUMN IF NOT EXISTS dz5_60d           double precision,
  ADD COLUMN IF NOT EXISTS macd_z_60d        double precision,
  ADD COLUMN IF NOT EXISTS rsi14             double precision,
  ADD COLUMN IF NOT EXISTS bb_pctb_20        double precision,    -- 0..1
  ADD COLUMN IF NOT EXISTS ma50              double precision,
  ADD COLUMN IF NOT EXISTS ma200             double precision,
  ADD COLUMN IF NOT EXISTS ma_gap_pct        double precision,    -- (ma50-ma200)/ma200
  ADD COLUMN IF NOT EXISTS atr14             double precision,
  ADD COLUMN IF NOT EXISTS rs_spy_30d        double precision,    -- 30D return diff vs SPY
  ADD COLUMN IF NOT EXISTS rs_spy_90d        double precision,
  ADD COLUMN IF NOT EXISTS beta_spy_252d     double precision,
  ADD COLUMN IF NOT EXISTS corr_spy_252d     double precision,
  ADD COLUMN IF NOT EXISTS vol_dollar_20d    double precision;

-- 2) Helpful constraints (non-blocking; comment out if you prefer looser)
-- Keep %B in [0,1] when present
ALTER TABLE equity_features_daily
  ADD CONSTRAINT IF NOT EXISTS chk_efd_bb_pctb_20_range
  CHECK (bb_pctb_20 IS NULL OR (bb_pctb_20 >= 0 AND bb_pctb_20 <= 1));

-- 3) Indexes for fast dashboards
CREATE INDEX IF NOT EXISTS idx_edb_symbol_date
  ON equity_daily_bars (symbol, ts_utc DESC);

CREATE INDEX IF NOT EXISTS idx_efd_sym_date
  ON equity_features_daily (symbol, asof_date DESC);

CREATE INDEX IF NOT EXISTS idx_efd_sym_date_h
  ON equity_features_daily (symbol, asof_date DESC, horizon);

-- 4) (Optional) Watchlist & alerts for later features
CREATE TABLE IF NOT EXISTS user_watchlist (
  user_id     uuid NOT NULL,
  symbol      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, symbol)
);

CREATE TABLE IF NOT EXISTS alert_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  symbol      text NOT NULL,
  rule        text NOT NULL,           -- e.g., 'composite_z_60d<=-1.0'
  horizon     text NOT NULL DEFAULT '60D',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 5) Add primary key to equity_features_daily if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'equity_features_daily' 
        AND constraint_type = 'PRIMARY KEY'
    ) THEN
        ALTER TABLE equity_features_daily ADD PRIMARY KEY (symbol, asof_date, horizon);
    END IF;
END $$;