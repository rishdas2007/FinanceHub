// Centralized Application Configuration - Eliminates magic numbers and hardcoded values
import { EnvironmentValidator } from '../utils/EnvironmentValidator';

export class AppConfig {
  private static instance: AppConfig;
  private environmentValidator = EnvironmentValidator.getInstance();

  private constructor() {}

  static getInstance(): AppConfig {
    if (!AppConfig.instance) {
      AppConfig.instance = new AppConfig();
    }
    return AppConfig.instance;
  }

  // API Configuration
  get api() {
    return {
      rateLimits: {
        standard: 100,     // requests per 15 minutes
        strict: 10,        // requests per minute for sensitive endpoints
        auth: 5,           // requests per 15 minutes for auth endpoints
        health: 1000       // requests per 15 minutes for health checks
      },
      timeouts: {
        ai: 30000,         // 30 seconds for AI API calls
        fred: 10000,       // 10 seconds for FRED API calls
        twelveData: 5000,  // 5 seconds for Twelve Data API calls
        database: 30000,   // 30 seconds for complex database queries
        default: 5000      // 5 seconds default timeout
      },
      retries: {
        maxAttempts: 3,
        backoffMultiplier: 2,
        initialDelay: 1000
      }
    };
  }

  // Scheduler Configuration
  get scheduler() {
    return {
      intervals: {
        dataRefresh: '0 6 * * *',        // 6:00 AM daily
        monitoring: '0 */4 * * *',       // Every 4 hours
        cleanup: '0 2 * * *',            // 2:00 AM daily
        emailDelivery: '20 8 * * 1-5',   // 8:20 AM weekdays
        fredUpdate: '0 */4 * * 1-5',     // Every 4 hours on weekdays
        stalenessCheck: '*/30 * * * *'   // Every 30 minutes
      },
      timeouts: {
        serviceStartup: 30000,     // 30 seconds max for service startup
        dataCollection: 60000,     // 60 seconds for data collection
        emailGeneration: 45000,    // 45 seconds for email generation
        cacheCleanup: 10000       // 10 seconds for cache cleanup
      }
    };
  }

  // Cache Configuration
  get cache() {
    return {
      ttl: {
        default: 300000,           // 5 minutes
        economicData: 1800000,     // 30 minutes
        momentumData: 300000,      // 5 minutes
        technicalData: 60000,      // 1 minute
        staticData: 3600000,       // 1 hour
        healthCheck: 60000         // 1 minute
      },
      maxSize: {
        memory: 100,               // 100 MB
        entries: 10000            // Maximum cache entries
      },
      cleanup: {
        interval: 300000,          // Clean up every 5 minutes
        maxAge: 3600000           // Remove entries older than 1 hour
      }
    };
  }

  // Circuit Breaker Configuration
  get circuitBreaker() {
    return {
      openai: {
        failureThreshold: 3,
        resetTimeout: 30000,      // 30 seconds
        halfOpenMaxCalls: 1
      },
      fred: {
        failureThreshold: 5,
        resetTimeout: 60000,      // 1 minute
        halfOpenMaxCalls: 2
      },
      twelveData: {
        failureThreshold: 3,
        resetTimeout: 30000,      // 30 seconds
        halfOpenMaxCalls: 1
      },
      sendgrid: {
        failureThreshold: 2,
        resetTimeout: 300000,     // 5 minutes
        halfOpenMaxCalls: 1
      }
    };
  }

  // Performance Monitoring Configuration
  get performance() {
    return {
      slowQueryThreshold: 5000,   // 5 seconds
      memoryWarningThreshold: 0.8, // 80% memory usage
      cpuWarningThreshold: 0.9,   // 90% CPU usage
      responseTimeWarning: 2000,  // 2 seconds
      metricsRetention: 86400000  // 24 hours
    };
  }

  // Database Configuration
  get database() {
    return {
      pool: {
        min: 2,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000
      },
      query: {
        timeout: 30000,           // 30 seconds
        maxRetries: 3,
        retryDelay: 1000
      },
      migration: {
        timeout: 300000,          // 5 minutes
        batchSize: 1000
      }
    };
  }

  // Logging Configuration
  get logging() {
    const env = this.environmentValidator.getConfig().NODE_ENV;
    
    return {
      level: env === 'production' ? 'info' : 'debug',
      format: env === 'production' ? 'json' : 'pretty',
      maxFiles: 5,
      maxSize: '10m',
      retention: '30d'
    };
  }

  // Security Configuration
  get security() {
    return {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? ['https://financehub-pro.com'] 
          : true,
        credentials: true
      },
      headers: {
        contentSecurityPolicy: true,
        xssProtection: true,
        noSniff: true,
        referrerPolicy: 'strict-origin-when-cross-origin'
      },
      session: {
        maxAge: 86400000,         // 24 hours
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
      }
    };
  }

  // Feature Flags
  get features() {
    return {
      enableMetrics: this.environmentValidator.isConfigured('ENABLE_METRICS'),
      enableEmailNotifications: this.environmentValidator.isConfigured('SENDGRID_API_KEY'),
      enableAdvancedAnalytics: true,
      enablePerformanceMonitoring: true,
      enableCircuitBreakers: true,
      enableDataIntegrityChecks: true
    };
  }

  // Business Logic Configuration
  get business() {
    return {
      statistical: {
        zScoreThreshold: 1.0,      // Statistical significance threshold
        historicalPeriodMonths: 12, // 12-month historical analysis
        minimumDataPoints: 15,     // Minimum data points for analysis
        outlierCapZScore: 5.0      // Cap z-scores at ±5 for outlier protection
      },
      momentum: {
        rsiOverbought: 70,
        rsiOversold: 30,
        maGapThreshold: 0.05,      // 5% moving average gap threshold
        volatilityPeriod: 20       // 20-day volatility calculation
      },
      alerts: {
        maxAlertsPerCategory: 8,
        priorityThreshold: 2.0,    // High priority alerts above 2.0 z-score
        emailAlertThreshold: 1.5   // Email alerts above 1.5 z-score
      }
    };
  }
}

// Singleton instance
export const config = AppConfig.getInstance();