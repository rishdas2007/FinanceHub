import { z } from 'zod';

/**
 * Comprehensive application configuration schema with validation
 * Centralizes all environment variables and constants
 */
const ConfigSchema = z.object({
  api: z.object({
    port: z.number().default(5000),
    environment: z.enum(['development', 'production', 'test']).default('development'),
    twelveDataKey: z.string().min(1, 'Twelve Data API key is required'),
    fredApiKey: z.string().min(1, 'FRED API key is required'),
    openaiApiKey: z.string().optional(),
    sendgridApiKey: z.string().optional(),
    rateLimit: z.object({
      windowMs: z.number().default(15 * 60 * 1000), // 15 minutes
      max: z.number().default(100),
      skipSuccessfulRequests: z.boolean().default(false)
    }),
    cors: z.object({
      origin: z.union([z.string(), z.array(z.string())]).default('*'),
      credentials: z.boolean().default(true)
    })
  }),
  
  database: z.object({
    url: z.string().url('Valid database URL is required'),
    poolSize: z.number().default(10),
    connectionTimeout: z.number().default(10000),
    queryTimeout: z.number().default(30000),
    ssl: z.boolean().default(true)
  }),
  
  cache: z.object({
    redis: z.object({
      url: z.string().optional(),
      ttl: z.number().default(300), // 5 minutes
      maxMemory: z.string().default('100mb')
    }),
    memory: z.object({
      maxSize: z.number().default(100),
      ttl: z.number().default(300)
    }),
    performance: z.object({
      enableBackgroundRefresh: z.boolean().default(true),
      prefetchThreshold: z.number().default(0.8),
      compressionLevel: z.number().default(6)
    })
  }),
  
  calculations: z.object({
    rsi: z.object({
      period: z.number().default(14),
      overbought: z.number().default(70),
      oversold: z.number().default(30),
      fallback: z.object({
        mean: z.number().default(50),
        stddev: z.number().default(15)
      })
    }),
    macd: z.object({
      fastPeriod: z.number().default(12),
      slowPeriod: z.number().default(26),
      signalPeriod: z.number().default(9),
      fallback: z.object({
        mean: z.number().default(0),
        stddev: z.number().default(1.03)
      })
    }),
    bollinger: z.object({
      period: z.number().default(20),
      multiplier: z.number().default(2),
      fallback: z.object({
        mean: z.number().default(0.5),
        stddev: z.number().default(0.25)
      })
    }),
    zScore: z.object({
      buyThreshold: z.number().default(-1.5),
      sellThreshold: z.number().default(1.5),
      extremeThreshold: z.number().default(3.0),
      minDataPoints: z.number().default(10),
      maxDataPoints: z.number().default(90)
    })
  }),
  
  etf: z.object({
    symbols: z.array(z.string()).default([
      'SPY', 'XLB', 'XLC', 'XLE', 'XLF', 'XLI', 'XLK', 'XLP', 'XLRE', 'XLU', 'XLV', 'XLY'
    ]),
    refreshInterval: z.number().default(30000), // 30 seconds
    maxRetries: z.number().default(3),
    timeout: z.number().default(10000)
  }),
  
  economic: z.object({
    fredUpdateInterval: z.number().default(24 * 60 * 60 * 1000), // 24 hours
    maxIndicators: z.number().default(50),
    historicalYears: z.number().default(10)
  }),
  
  monitoring: z.object({
    enableMetrics: z.boolean().default(true),
    metricsInterval: z.number().default(60000), // 1 minute
    healthCheckInterval: z.number().default(30000), // 30 seconds
    alertThresholds: z.object({
      responseTime: z.number().default(5000), // 5 seconds
      errorRate: z.number().default(0.05), // 5%
      memoryUsage: z.number().default(0.85) // 85%
    })
  }),
  
  security: z.object({
    enableHelmet: z.boolean().default(true),
    enableCompression: z.boolean().default(true),
    logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    trustProxy: z.boolean().default(true)
  })
});

export type AppConfig = z.infer<typeof ConfigSchema>;

/**
 * Centralized configuration manager with validation and type safety
 */
export class ConfigManager {
  private static instance: AppConfig;
  private static initialized = false;
  
  /**
   * Initialize configuration from environment variables
   */
  static initialize(): AppConfig {
    if (this.initialized) {
      return this.instance;
    }

    try {
      const rawConfig = {
        api: {
          port: parseInt(process.env.PORT || '5000'),
          environment: process.env.NODE_ENV || 'development',
          twelveDataKey: process.env.TWELVE_DATA_API_KEY,
          fredApiKey: process.env.FRED_API_KEY,
          openaiApiKey: process.env.OPENAI_API_KEY,
          sendgridApiKey: process.env.SENDGRID_API_KEY,
          rateLimit: {
            windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
            max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
            skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESS === 'true'
          },
          cors: {
            origin: process.env.CORS_ORIGIN || '*',
            credentials: process.env.CORS_CREDENTIALS !== 'false'
          }
        },
        
        database: {
          url: process.env.DATABASE_URL,
          poolSize: parseInt(process.env.DB_POOL_SIZE || '10'),
          connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'),
          queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'),
          ssl: process.env.DB_SSL !== 'false'
        },
        
        cache: {
          redis: {
            url: process.env.REDIS_URL,
            ttl: parseInt(process.env.CACHE_TTL || '300'),
            maxMemory: process.env.REDIS_MAX_MEMORY || '100mb'
          },
          memory: {
            maxSize: parseInt(process.env.MEMORY_CACHE_SIZE || '100'),
            ttl: parseInt(process.env.MEMORY_CACHE_TTL || '300')
          },
          performance: {
            enableBackgroundRefresh: process.env.CACHE_BACKGROUND_REFRESH !== 'false',
            prefetchThreshold: parseFloat(process.env.CACHE_PREFETCH_THRESHOLD || '0.8'),
            compressionLevel: parseInt(process.env.CACHE_COMPRESSION_LEVEL || '6')
          }
        },
        
        calculations: {
          rsi: {
            period: parseInt(process.env.RSI_PERIOD || '14'),
            overbought: parseInt(process.env.RSI_OVERBOUGHT || '70'),
            oversold: parseInt(process.env.RSI_OVERSOLD || '30')
          },
          macd: {
            fastPeriod: parseInt(process.env.MACD_FAST_PERIOD || '12'),
            slowPeriod: parseInt(process.env.MACD_SLOW_PERIOD || '26'),
            signalPeriod: parseInt(process.env.MACD_SIGNAL_PERIOD || '9')
          },
          bollinger: {
            period: parseInt(process.env.BB_PERIOD || '20'),
            multiplier: parseFloat(process.env.BB_MULTIPLIER || '2')
          },
          zScore: {
            buyThreshold: parseFloat(process.env.ZSCORE_BUY_THRESHOLD || '-1.5'),
            sellThreshold: parseFloat(process.env.ZSCORE_SELL_THRESHOLD || '1.5'),
            extremeThreshold: parseFloat(process.env.ZSCORE_EXTREME_THRESHOLD || '3.0'),
            minDataPoints: parseInt(process.env.ZSCORE_MIN_DATA_POINTS || '10'),
            maxDataPoints: parseInt(process.env.ZSCORE_MAX_DATA_POINTS || '90')
          }
        },
        
        etf: {
          symbols: process.env.ETF_SYMBOLS?.split(',') || undefined,
          refreshInterval: parseInt(process.env.ETF_REFRESH_INTERVAL || '30000'),
          maxRetries: parseInt(process.env.ETF_MAX_RETRIES || '3'),
          timeout: parseInt(process.env.ETF_TIMEOUT || '10000')
        },
        
        economic: {
          fredUpdateInterval: parseInt(process.env.FRED_UPDATE_INTERVAL || '86400000'),
          maxIndicators: parseInt(process.env.FRED_MAX_INDICATORS || '50'),
          historicalYears: parseInt(process.env.FRED_HISTORICAL_YEARS || '10')
        },
        
        monitoring: {
          enableMetrics: process.env.ENABLE_METRICS !== 'false',
          metricsInterval: parseInt(process.env.METRICS_INTERVAL || '60000'),
          healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
          alertThresholds: {
            responseTime: parseInt(process.env.ALERT_RESPONSE_TIME || '5000'),
            errorRate: parseFloat(process.env.ALERT_ERROR_RATE || '0.05'),
            memoryUsage: parseFloat(process.env.ALERT_MEMORY_USAGE || '0.85')
          }
        },
        
        security: {
          enableHelmet: process.env.ENABLE_HELMET !== 'false',
          enableCompression: process.env.ENABLE_COMPRESSION !== 'false',
          logLevel: process.env.LOG_LEVEL || 'info',
          trustProxy: process.env.TRUST_PROXY !== 'false'
        }
      };

      // Validate configuration
      this.instance = ConfigSchema.parse(rawConfig);
      this.initialized = true;
      
      console.log('✅ Configuration validated successfully');
      console.log(`🌍 Environment: ${this.instance.api.environment}`);
      console.log(`🚀 Port: ${this.instance.api.port}`);
      console.log(`💾 Database: ${this.instance.database.url ? 'Connected' : 'Not configured'}`);
      console.log(`🔄 Cache: ${this.instance.cache.redis.url ? 'Redis' : 'Memory'}`);
      
      return this.instance;
      
    } catch (error) {
      console.error('❌ Configuration validation failed:', error);
      
      if (error instanceof z.ZodError) {
        console.error('Configuration errors:');
        error.errors.forEach(err => {
          console.error(`  - ${err.path.join('.')}: ${err.message}`);
        });
      }
      
      throw new Error('Invalid configuration. Please check your environment variables.');
    }
  }
  
  /**
   * Get the current configuration
   */
  static get(): AppConfig {
    if (!this.initialized || !this.instance) {
      throw new Error('Configuration not initialized. Call ConfigManager.initialize() first.');
    }
    return this.instance;
  }
  
  /**
   * Get a specific configuration section
   */
  static getSection<K extends keyof AppConfig>(section: K): AppConfig[K] {
    return this.get()[section];
  }
  
  /**
   * Check if we're in production environment
   */
  static isProduction(): boolean {
    return this.get().api.environment === 'production';
  }
  
  /**
   * Check if we're in development environment
   */
  static isDevelopment(): boolean {
    return this.get().api.environment === 'development';
  }
  
  /**
   * Check if we're in test environment
   */
  static isTest(): boolean {
    return this.get().api.environment === 'test';
  }
  
  /**
   * Validate required API keys are present
   */
  static validateApiKeys(): void {
    const config = this.get();
    
    if (!config.api.twelveDataKey) {
      throw new Error('TWELVE_DATA_API_KEY is required');
    }
    
    if (!config.api.fredApiKey) {
      throw new Error('FRED_API_KEY is required');
    }
    
    console.log('✅ All required API keys are present');
  }
  
  /**
   * Get database configuration for Drizzle
   */
  static getDatabaseConfig() {
    const config = this.get();
    return {
      connectionString: config.database.url,
      ssl: config.database.ssl,
      pool: {
        max: config.database.poolSize,
        connectionTimeoutMillis: config.database.connectionTimeout,
        query_timeout: config.database.queryTimeout
      }
    };
  }
}

// Export default configuration for immediate use
export const config = ConfigManager;
export default ConfigManager;