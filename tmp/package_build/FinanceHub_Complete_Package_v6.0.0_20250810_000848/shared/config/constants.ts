// Cache Duration Constants (in seconds)
export const CACHE_DURATION = {
  STOCK_QUOTES: 60,           // 1 minute
  TECHNICAL_INDICATORS: 180,  // 3 minutes
  SECTOR_DATA: 300,           // 5 minutes
  AI_ANALYSIS: 300,           // 5 minutes
  ECONOMIC_DATA: 3600,        // 1 hour
  HISTORICAL_DATA: 1800,      // 30 minutes
  MARKET_SENTIMENT: 300       // 5 minutes
} as const;

// API Rate Limits
export const RATE_LIMITS = {
  DEFAULT: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 100                   // requests per window
  },
  INTENSIVE: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 20                    // requests per window
  },
  AUTH: {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 5                     // requests per window
  }
} as const;

// Database Configuration
export const DATABASE_CONFIG = {
  CONNECTION_TIMEOUT: 30000,   // 30 seconds
  QUERY_TIMEOUT: 10000,        // 10 seconds
  BULK_INSERT_SIZE: 1000       // Records per bulk insert
} as const;

// External API Configuration
export const API_CONFIG = {
  TWELVE_DATA: {
    BASE_URL: 'https://api.twelvedata.com',
    RATE_LIMIT: 144,           // calls per minute
    TIMEOUT: 5000              // 5 seconds
  },
  OPENAI: {
    MODEL: 'gpt-4o',
    MAX_TOKENS: 2000,
    TEMPERATURE: 0.1,
    TIMEOUT: 30000             // 30 seconds
  }
} as const;

// Market Hours (EST)
export const MARKET_HOURS = {
  OPEN_HOUR: 9,
  OPEN_MINUTE: 30,
  CLOSE_HOUR: 16,
  CLOSE_MINUTE: 0,
  TIMEZONE: 'America/New_York'
} as const;

// Financial Data Constants
export const FINANCIAL_CONSTANTS = {
  SECTOR_ETFS: [
    'SPY', 'XLK', 'XLV', 'XLF', 'XLY', 'XLI', 
    'XLC', 'XLP', 'XLE', 'XLU', 'XLB', 'XLRE'
  ],
  RISK_FREE_RATE: 0.05,        // 5% annual risk-free rate
  TRADING_DAYS_PER_YEAR: 252   // Standard trading days
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  INVALID_SYMBOL: 'Invalid stock symbol format',
  INSUFFICIENT_DATA: 'Insufficient historical data available',
  API_LIMIT_REACHED: 'API rate limit reached. Please try again later',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
  AUTHENTICATION_FAILED: 'Authentication failed',
  VALIDATION_ERROR: 'Request validation failed'
} as const;