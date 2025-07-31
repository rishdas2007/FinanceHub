-- FinanceHub Pro Database Schema
-- Complete PostgreSQL schema for deployment

-- Economic Indicators History Table
CREATE TABLE economic_indicators_history (
    id SERIAL PRIMARY KEY,
    series_id VARCHAR(50) NOT NULL,
    value DECIMAL(10,3) NOT NULL,
    period_date DATE NOT NULL,
    unit VARCHAR(50),
    release_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_economic_series_date ON economic_indicators_history(series_id, period_date DESC);
CREATE INDEX idx_economic_period_date ON economic_indicators_history(period_date DESC);
CREATE INDEX idx_economic_series_id ON economic_indicators_history(series_id);

-- Sample data for key economic indicators (representative data)
-- This provides the structure - full historical data will be loaded via FRED API on startup

INSERT INTO economic_indicators_history (series_id, value, period_date, unit, release_date) VALUES
-- GDP Growth Rate (A191RL1Q225SBEA)
('A191RL1Q225SBEA', 3.0, '2025-06-22', 'percent', '2025-06-22'),
('A191RL1Q225SBEA', -0.5, '2025-03-22', 'percent', '2025-03-22'),

-- CPI All Items (CPIAUCSL) 
('CPIAUCSL', 314.540, '2025-06-01', 'index', '2025-06-01'),
('CPIAUCSL', 314.069, '2025-05-01', 'index', '2025-05-01'),

-- Unemployment Rate (UNRATE)
('UNRATE', 4.0, '2025-06-22', 'percent', '2025-06-22'),
('UNRATE', 3.9, '2025-05-22', 'percent', '2025-05-22'),

-- Federal Funds Rate (FEDFUNDS)
('FEDFUNDS', 5.33, '2025-06-22', 'percent', '2025-06-22'),
('FEDFUNDS', 5.33, '2025-05-22', 'percent', '2025-05-22'),

-- Core PPI (WPUSOP3000) - Fixed data without duplicates
('WPUSOP3000', 2.8, '2025-06-01', 'percent', '2025-06-01'),
('WPUSOP3000', 2.4, '2025-05-01', 'percent', '2025-05-01'),

-- Nonfarm Payrolls (PAYEMS)
('PAYEMS', 158829, '2025-06-22', 'thousands', '2025-06-22'),
('PAYEMS', 158649, '2025-05-22', 'thousands', '2025-05-22'),

-- Industrial Production YoY (calculated field)
('INDPRO', 104.8, '2025-06-01', 'index', '2025-06-01'),
('INDPRO', 104.4, '2025-05-01', 'index', '2025-05-01'),

-- Initial Claims (ICSA) - Fixed units
('ICSA', 217.0, '2025-06-22', 'thousands', '2025-06-22'),
('ICSA', 221.0, '2025-06-15', 'thousands', '2025-06-15'),

-- Continuing Claims (CCSA) - Fixed units  
('CCSA', 1955.0, '2025-06-22', 'thousands', '2025-06-22'),
('CCSA', 1951.0, '2025-06-15', 'thousands', '2025-06-15');

-- FRED Update Log Table (for incremental updates)
CREATE TABLE fred_update_log (
    id SERIAL PRIMARY KEY,
    series_id VARCHAR(50) NOT NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    records_added INTEGER DEFAULT 0,
    api_calls_used INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'success'
);

-- Economic Indicators Current Table (for caching)
CREATE TABLE economic_indicators_current (
    series_id VARCHAR(50) PRIMARY KEY,
    current_value DECIMAL(10,3),
    current_date DATE,
    unit VARCHAR(50),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Session storage (if needed)
CREATE TABLE "session" (
    "sid" VARCHAR NOT NULL COLLATE "default",
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL
) WITH (OIDS=FALSE);

ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX "IDX_session_expire" ON "session" ("expire");

-- Comments for documentation
COMMENT ON TABLE economic_indicators_history IS 'Historical economic data from FRED API with mixed unit integrity fixes applied';
COMMENT ON TABLE fred_update_log IS 'Tracks FRED API incremental updates and usage statistics';
COMMENT ON TABLE economic_indicators_current IS 'Current economic indicator values for fast dashboard loading';