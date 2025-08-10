-- Direct Signal Performance Analysis Queries
-- Run these one by one in your database console

-- 1. Check if you have recent z-score signal data
SELECT 
  'Signal Data Check' as analysis,
  COUNT(*) as total_records,
  COUNT(DISTINCT symbol) as unique_symbols,
  MIN(created_at) as earliest_date,
  MAX(created_at) as latest_date,
  COUNT(CASE WHEN signal = 'BUY' THEN 1 END) as buy_signals,
  COUNT(CASE WHEN signal = 'SELL' THEN 1 END) as sell_signals,
  COUNT(CASE WHEN signal = 'HOLD' THEN 1 END) as hold_signals
FROM zscore_technical_indicators 
WHERE created_at >= NOW() - INTERVAL '30 days';

-- 2. Recent signal distribution by symbol
SELECT 
  symbol,
  COUNT(*) as total_signals,
  COUNT(CASE WHEN signal = 'BUY' THEN 1 END) as buy_count,
  COUNT(CASE WHEN signal = 'SELL' THEN 1 END) as sell_count,
  ROUND(AVG(CAST(composite_zscore AS DECIMAL)), 3) as avg_composite_zscore,
  MAX(created_at) as last_signal_date
FROM zscore_technical_indicators 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY symbol
ORDER BY last_signal_date DESC;

-- 3. Sample of recent signals with component analysis
SELECT 
  symbol,
  DATE(created_at) as signal_date,
  signal,
  ROUND(CAST(composite_zscore AS DECIMAL), 3) as composite_zscore,
  ROUND(CAST(rsi_zscore AS DECIMAL), 2) as rsi_z,
  ROUND(CAST(macd_zscore AS DECIMAL), 2) as macd_z,
  ROUND(CAST(bollinger_zscore AS DECIMAL), 2) as bollinger_z,
  ROUND(CAST(ma_trend_zscore AS DECIMAL), 2) as ma_trend_z,
  ROUND(CAST(price_momentum_zscore AS DECIMAL), 2) as momentum_z
FROM zscore_technical_indicators 
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND signal != 'HOLD'
ORDER BY created_at DESC
LIMIT 20;

-- 4. Historical price data check for performance analysis
SELECT 
  'Price Data Check' as analysis,
  COUNT(*) as total_records,
  COUNT(DISTINCT symbol) as unique_symbols,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM historical_stock_data;

-- 5. Quick performance spot check (if you have both tables)
SELECT 
  z.symbol,
  DATE(z.created_at) as signal_date,
  z.signal,
  ROUND(CAST(z.composite_zscore AS DECIMAL), 2) as zscore,
  h1.close as signal_price,
  h2.close as price_next_day,
  CASE WHEN h2.close IS NOT NULL AND h1.close IS NOT NULL THEN
    ROUND(((CAST(h2.close AS DECIMAL) - CAST(h1.close AS DECIMAL)) / CAST(h1.close AS DECIMAL)) * 100, 2)
  END as next_day_return_pct
FROM zscore_technical_indicators z
LEFT JOIN historical_stock_data h1 ON h1.symbol = z.symbol AND DATE(h1.date) = DATE(z.created_at)
LEFT JOIN historical_stock_data h2 ON h2.symbol = z.symbol AND h2.date = DATE(z.created_at) + INTERVAL '1 day'
WHERE z.created_at >= NOW() - INTERVAL '14 days'
  AND z.signal != 'HOLD'
ORDER BY z.created_at DESC
LIMIT 15;