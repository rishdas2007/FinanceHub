/**
 * Centralized constants to eliminate magic numbers and inconsistent values
 */

export const API_RATE_LIMITS = {
  TWELVE_DATA: 144, // calls per minute (enhanced quota)
  ALPHA_VANTAGE: 25, // calls per minute  
  FRED_API: 120, // calls per minute
} as const;

export const CACHE_DURATIONS = {
  STOCK_QUOTES: 60, // 1 minute
  TECHNICAL_INDICATORS: 180, // 3 minutes
  SECTOR_DATA_MARKET_HOURS: 300, // 5 minutes
  SECTOR_DATA_AFTER_HOURS: 1800, // 30 minutes
  SENTIMENT_DATA: 120, // 2 minutes
  ECONOMIC_CALENDAR: 86400, // 24 hours
  HISTORICAL_PERFORMANCE: 1800, // 30 minutes
} as const;

export const MARKET_HOURS = {
  OPEN_HOUR: 9,
  OPEN_MINUTE: 30,
  CLOSE_HOUR: 16,
  CLOSE_MINUTE: 0,
  TIMEZONE: 'America/New_York',
} as const;

export const ETF_SYMBOLS = [
  'SPY', 'XLK', 'XLV', 'XLF', 'XLY', 'XLI', 
  'XLC', 'XLP', 'XLE', 'XLU', 'XLB', 'XLRE'
] as const;

export const ECONOMIC_CATEGORIES = [
  'employment', 'inflation', 'consumer_spending', 
  'housing', 'manufacturing', 'sentiment'
] as const;