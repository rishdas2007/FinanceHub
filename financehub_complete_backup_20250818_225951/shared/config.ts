/**
 * Centralized configuration
 * Eliminates environment configuration conflicts across the codebase
 */

export const config = {
  // Environment Detection
  environment: process.env.NODE_ENV || 'development',
  isReplit: !!process.env.REPL_ID,
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // API Rate Limits (centralized from scattered values)
  api: {
    TWELVE_DATA_LIMIT: 144, // calls per minute - now consistent across codebase
    ALPHA_VANTAGE_LIMIT: 25, // calls per minute
    CACHE_DURATION: {
      STOCK_QUOTES: 60, // 1 minute
      TECHNICAL_INDICATORS: 180, // 3 minutes
      SECTOR_DATA: 300, // 5 minutes
      SENTIMENT_DATA: 120, // 2 minutes
      ECONOMIC_CALENDAR: 1440, // 24 hours
    }
  },
  
  // Database Configuration
  database: {
    url: process.env.DATABASE_URL,
    sessionSecret: process.env.SESSION_SECRET,
  },
  
  // External Services
  services: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o', // Latest model as per blueprint
    },
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY,
    },
    twelveData: {
      apiKey: process.env.TWELVE_DATA_API_KEY,
    }
  }
} as const;

// Type-safe environment validation
export function validateEnvironment(): void {
  const required = [
    'DATABASE_URL',
    'OPENAI_API_KEY',
    'SENDGRID_API_KEY'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}