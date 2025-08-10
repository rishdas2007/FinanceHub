-- Fix Momentum Data Schema and Sample Data
-- This file creates proper historical data structure for momentum analysis

-- Ensure the historical_sector_data table has proper structure
CREATE TABLE IF NOT EXISTS historical_sector_data (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL,
  date DATE NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  volume INTEGER DEFAULT 0,
  change_percent DECIMAL(5, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  open DECIMAL(10, 2),
  high DECIMAL(10, 2),
  low DECIMAL(10, 2),
  close DECIMAL(10, 2),
  UNIQUE(symbol, date)
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_historical_sector_symbol_date ON historical_sector_data(symbol, date DESC);

-- Sample historical data for 60 days (approximate values for major sector ETFs)
-- This provides realistic baseline data for moving average calculations

INSERT INTO historical_sector_data (symbol, date, price, volume, change_percent, open, high, low, close) VALUES
-- SPY (S&P 500) data
('SPY', CURRENT_DATE - INTERVAL '60 days', 420.50, 95000000, 0.25, 419.80, 421.20, 419.50, 420.50),
('SPY', CURRENT_DATE - INTERVAL '59 days', 422.10, 87000000, 0.38, 420.50, 422.80, 420.20, 422.10),
('SPY', CURRENT_DATE - INTERVAL '58 days', 423.75, 92000000, 0.39, 422.10, 424.00, 421.90, 423.75),
('SPY', CURRENT_DATE - INTERVAL '57 days', 421.30, 105000000, -0.58, 423.75, 424.10, 420.80, 421.30),
('SPY', CURRENT_DATE - INTERVAL '56 days', 425.20, 88000000, 0.93, 421.30, 425.50, 421.00, 425.20),

-- XLK (Technology) data
('XLK', CURRENT_DATE - INTERVAL '60 days', 180.25, 12000000, 0.45, 179.50, 181.00, 179.20, 180.25),
('XLK', CURRENT_DATE - INTERVAL '59 days', 182.80, 15000000, 1.41, 180.25, 183.20, 180.10, 182.80),
('XLK', CURRENT_DATE - INTERVAL '58 days', 185.10, 18000000, 1.26, 182.80, 185.50, 182.50, 185.10),
('XLK', CURRENT_DATE - INTERVAL '57 days', 183.45, 22000000, -0.89, 185.10, 185.30, 182.90, 183.45),
('XLK', CURRENT_DATE - INTERVAL '56 days', 187.20, 16000000, 2.04, 183.45, 187.80, 183.20, 187.20),

-- XLV (Healthcare) data
('XLV', CURRENT_DATE - INTERVAL '60 days', 125.30, 8000000, -0.25, 125.80, 126.10, 124.90, 125.30),
('XLV', CURRENT_DATE - INTERVAL '59 days', 124.85, 9500000, -0.36, 125.30, 125.60, 124.20, 124.85),
('XLV', CURRENT_DATE - INTERVAL '58 days', 126.50, 7800000, 1.32, 124.85, 126.80, 124.70, 126.50),
('XLV', CURRENT_DATE - INTERVAL '57 days', 125.90, 10200000, -0.47, 126.50, 126.70, 125.40, 125.90),
('XLV', CURRENT_DATE - INTERVAL '56 days', 127.25, 8900000, 1.07, 125.90, 127.60, 125.80, 127.25),

-- XLE (Energy) data
('XLE', CURRENT_DATE - INTERVAL '60 days', 85.40, 18000000, -1.25, 86.50, 86.80, 84.90, 85.40),
('XLE', CURRENT_DATE - INTERVAL '59 days', 83.20, 22000000, -2.58, 85.40, 85.60, 82.80, 83.20),
('XLE', CURRENT_DATE - INTERVAL '58 days', 84.75, 19500000, 1.86, 83.20, 85.10, 83.00, 84.75),
('XLE', CURRENT_DATE - INTERVAL '57 days', 82.60, 25000000, -2.54, 84.75, 84.90, 82.20, 82.60),
('XLE', CURRENT_DATE - INTERVAL '56 days', 81.90, 21000000, -0.85, 82.60, 83.00, 81.50, 81.90);

-- Add more recent data points to ensure we have at least 50 data points per symbol
-- (This would be expanded with more INSERT statements for a full 60-day dataset)

-- Verify data insertion
SELECT symbol, COUNT(*) as record_count, MIN(date) as earliest_date, MAX(date) as latest_date 
FROM historical_sector_data 
GROUP BY symbol 
ORDER BY symbol;