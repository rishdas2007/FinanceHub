-- Add explicit component z-score columns (safe re-run)
ALTER TABLE equity_features_daily
  ADD COLUMN IF NOT EXISTS rsi_z_60d     double precision,
  ADD COLUMN IF NOT EXISTS bb_z_60d      double precision,
  ADD COLUMN IF NOT EXISTS ma_gap_z_60d  double precision,
  ADD COLUMN IF NOT EXISTS mom5d_z_60d   double precision;

-- (Optional) helper index if you'll sort/filter by these a lot
CREATE INDEX IF NOT EXISTS idx_efd_compz_60d
  ON equity_features_daily (horizon, asof_date DESC, rsi_z_60d, bb_z_60d, ma_gap_z_60d, mom5d_z_60d);