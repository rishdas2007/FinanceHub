import { logger } from '../middleware/logging';
import { optimizedZScoreCalculator } from './optimized-zscore-calculator';
import { parallelZScoreProcessor } from './parallel-zscore-processor';
import { zScorePerformanceMonitor } from './zscore-performance-monitor';
import { zScoreCalculationCircuitBreaker } from './zscore-circuit-breaker';
import { optimizedDbPool } from './optimized-db-pool';

interface ServiceConfig {
  name: string;
  timeout: number;
  dependencies?: string[];
  initializer: () => Promise<void>;
}

/**
 * Enhanced Z-Score Service with optimized startup sequencing and advanced statistical methods
 * Integrates all performance optimizations and provides intelligent service coordination
 */
export class EnhancedZScoreService {
  private services: Map<string, boolean> = new Map();
  private isInitialized = false;
  private cache: Map<string, any> = new Map();

  constructor() {
    logger.info('🧮 Enhanced Z-Score Service initializing with advanced optimizations');
  }

  /**
   * Intelligent service startup sequencing
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.info('✅ Enhanced Z-Score Service already initialized');
      return;
    }

    const optimizedServiceConfig: ServiceConfig[] = [
      {
        name: 'database-warmup',
        timeout: 5000,
        initializer: async () => {
          logger.info('🔥 Pre-warming database connections for z-score queries...');
          await this.preloadZScoreBaseData();
          await this.validateDataIntegrity();
        }
      },
      {
        name: 'cache-preloader',
        dependencies: ['database-warmup'],
        timeout: 3000,
        initializer: async () => {
          logger.info('🚀 Pre-calculating z-scores for most active ETFs...');
          await this.precalculateTopETFs(['SPY', 'QQQ', 'XLK', 'XLF']);
        }
      },
      {
        name: 'lazy-z-score-service',
        dependencies: ['cache-preloader'],
        timeout: 1000,
        initializer: async () => {
          logger.info('⚡ Starting z-score service in background mode...');
          await this.initializeLazyZScoreCalculation();
        }
      },
      {
        name: 'performance-monitoring',
        dependencies: ['lazy-z-score-service'],
        timeout: 500,
        initializer: async () => {
          logger.info('📊 Initializing performance monitoring dashboard...');
          // Performance monitor is already started in constructor
        }
      }
    ];

    try {
      await this.executeServiceSequence(optimizedServiceConfig);
      this.isInitialized = true;
      logger.info('✅ Enhanced Z-Score Service initialization complete');

    } catch (error) {
      logger.error('💥 Enhanced Z-Score Service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Execute service initialization in dependency order
   */
  private async executeServiceSequence(configs: ServiceConfig[]): Promise<void> {
    const completed = new Set<string>();
    const remaining = [...configs];

    while (remaining.length > 0) {
      const readyServices = remaining.filter(config => 
        !config.dependencies || config.dependencies.every(dep => completed.has(dep))
      );

      if (readyServices.length === 0) {
        throw new Error('Circular dependency detected in service configuration');
      }

      // Execute ready services in parallel
      await Promise.all(
        readyServices.map(async (config) => {
          const startTime = Date.now();
          
          try {
            await Promise.race([
              config.initializer(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`Service ${config.name} initialization timeout`)), config.timeout)
              )
            ]);

            completed.add(config.name);
            this.services.set(config.name, true);
            
            const duration = Date.now() - startTime;
            logger.info(`✅ Service '${config.name}' initialized in ${duration}ms`);

          } catch (error) {
            logger.error(`💥 Service '${config.name}' initialization failed:`, error);
            // Mark as failed but continue with other services
            this.services.set(config.name, false);
          }
        })
      );

      // Remove completed services from remaining
      readyServices.forEach(config => {
        const index = remaining.indexOf(config);
        remaining.splice(index, 1);
      });
    }
  }

  /**
   * Pre-load frequently accessed z-score base data
   */
  private async preloadZScoreBaseData(): Promise<void> {
    try {
      // Refresh materialized view to ensure fresh data
      await optimizedDbPool.refreshZScoreView();
      
      // Pre-load base data for top ETFs
      const topSymbols = ['SPY', 'QQQ', 'XLK', 'XLF', 'XLV', 'XLY'];
      const preloadPromises = topSymbols.map(async (symbol) => {
        const data = await optimizedDbPool.getZScoreBaseData(symbol, 756);
        logger.debug(`📊 Pre-loaded ${data.length} records for ${symbol}`);
      });

      await Promise.all(preloadPromises);
      logger.info('✅ Z-score base data pre-loaded successfully');

    } catch (error) {
      logger.warn('⚠️ Z-score base data pre-loading failed:', error);
    }
  }

  /**
   * Validate data integrity for z-score calculations
   */
  private async validateDataIntegrity(): Promise<void> {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_records,
          COUNT(DISTINCT symbol) as unique_symbols,
          MIN(date) as earliest_date,
          MAX(date) as latest_date
        FROM zscore_base_data
      `;
      
      const result = await optimizedDbPool.query(query);
      const stats = result.rows[0];
      
      logger.info('📊 Z-score data integrity check:', {
        totalRecords: parseInt(stats.total_records),
        uniqueSymbols: parseInt(stats.unique_symbols),
        dateRange: `${stats.earliest_date} to ${stats.latest_date}`
      });

      // Validate minimum data requirements
      if (parseInt(stats.total_records) < 1000) {
        logger.warn('⚠️ Low data volume detected for z-score calculations');
      }

      if (parseInt(stats.unique_symbols) < 10) {
        logger.warn('⚠️ Limited symbol coverage for z-score calculations');
      }

    } catch (error) {
      logger.error('💥 Data integrity validation failed:', error);
      throw error;
    }
  }

  /**
   * Pre-calculate z-scores for most active ETFs
   */
  private async precalculateTopETFs(symbols: string[]): Promise<void> {
    try {
      const precalculatePromises = symbols.map(async (symbol) => {
        try {
          const startTime = Date.now();
          const result = await parallelZScoreProcessor.processSingleETF(symbol);
          
          // Cache the result
          this.cache.set(`zscore_${symbol}`, {
            data: result,
            timestamp: Date.now(),
            ttl: 300000 // 5 minutes
          });

          const duration = Date.now() - startTime;
          zScorePerformanceMonitor.trackCalculation(symbol, duration, false, true);
          
          logger.debug(`✅ Pre-calculated z-score for ${symbol} in ${duration}ms`);

        } catch (error) {
          logger.warn(`⚠️ Pre-calculation failed for ${symbol}:`, error);
        }
      });

      await Promise.all(precalculatePromises);
      logger.info(`✅ Pre-calculated z-scores for ${symbols.length} ETFs`);

    } catch (error) {
      logger.warn('⚠️ ETF pre-calculation failed:', error);
    }
  }

  /**
   * Initialize lazy z-score calculation system
   */
  private async initializeLazyZScoreCalculation(): Promise<void> {
    // Set up background refresh for cached z-scores
    setInterval(() => {
      this.refreshExpiredCache();
    }, 60000); // Check every minute

    logger.info('⚡ Lazy z-score calculation system initialized');
  }

  /**
   * Refresh expired cache entries in background
   */
  private async refreshExpiredCache(): Promise<void> {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, value] of this.cache) {
      if (now - value.timestamp > value.ttl) {
        expiredKeys.push(key);
      }
    }

    if (expiredKeys.length > 0) {
      logger.debug(`🔄 Refreshing ${expiredKeys.length} expired z-score cache entries`);
      
      // Remove expired entries
      expiredKeys.forEach(key => this.cache.delete(key));
    }
  }

  /**
   * Calculate enhanced z-score with all optimizations
   */
  async calculateEnhancedZScore(
    symbol: string, 
    options: {
      useCache?: boolean;
      useParallel?: boolean;
      vixLevel?: number;
    } = {}
  ): Promise<any> {
    const { useCache = true, useParallel = false, vixLevel = 20 } = options;

    // Check cache first
    if (useCache) {
      const cached = this.getCachedResult(`zscore_${symbol}`);
      if (cached) {
        zScorePerformanceMonitor.trackCalculation(symbol, 0, true, true);
        return cached;
      }
    }

    const startTime = Date.now();

    try {
      let result;
      
      if (useParallel) {
        result = await parallelZScoreProcessor.processSingleETF(symbol, vixLevel);
      } else {
        // Use circuit breaker for single calculations
        result = await zScoreCalculationCircuitBreaker.executeWithFallback(
          async () => {
            const historicalData = await optimizedDbPool.getZScoreBaseData(symbol, 756);
            const prices = historicalData.map(row => parseFloat(row.close));
            const currentValue = prices[0] || 0;
            
            return await optimizedZScoreCalculator.calculateEnhancedZScore(
              symbol,
              prices.slice(1),
              currentValue,
              {},
              vixLevel
            );
          },
          async () => {
            // Fallback: return simple enhanced z-score format
            logger.warn(`⚠️ Using fallback z-score calculation for ${symbol}`);
            const fallbackResult = optimizedZScoreCalculator.updateZScoreIncremental(symbol, 0, vixLevel);
            return fallbackResult.enhanced;
          },
          `enhanced-zscore-${symbol}`
        );
      }

      // Cache successful result
      if (useCache && result) {
        this.cache.set(`zscore_${symbol}`, {
          data: result,
          timestamp: Date.now(),
          ttl: 300000 // 5 minutes
        });
      }

      const duration = Date.now() - startTime;
      zScorePerformanceMonitor.trackCalculation(symbol, duration, false, true);

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      zScorePerformanceMonitor.trackCalculation(symbol, duration, false, false);
      
      logger.error(`💥 Enhanced z-score calculation failed for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Batch calculate z-scores for multiple symbols
   */
  async calculateBatchZScores(
    symbols: string[], 
    options: { vixLevel?: number } = {}
  ): Promise<Map<string, any>> {
    const { vixLevel = 20 } = options;

    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      logger.info(`🧮 Calculating z-scores for ${symbols.length} symbols in parallel`);
      return await parallelZScoreProcessor.processAllETFs(symbols, vixLevel);

    } catch (error) {
      logger.error('💥 Batch z-score calculation failed:', error);
      throw error;
    }
  }

  /**
   * Get cached result if available and not expired
   */
  private getCachedResult(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    return null;
  }

  /**
   * Get comprehensive performance report
   */
  getPerformanceReport(): any {
    return {
      serviceStatus: Object.fromEntries(this.services),
      isInitialized: this.isInitialized,
      cacheStats: {
        totalEntries: this.cache.size,
        hitRate: 'tracked by performance monitor'
      },
      performanceMetrics: zScorePerformanceMonitor.generatePerformanceReport(),
      parallelProcessorStats: parallelZScoreProcessor.getPerformanceStats(),
      circuitBreakerStatus: zScoreCalculationCircuitBreaker.getStatus(),
      databaseMetrics: optimizedDbPool.getMetrics()
    };
  }

  /**
   * Health check for all components
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check database connectivity
      const dbHealthy = await optimizedDbPool.healthCheck();
      
      // Check service initialization
      const servicesHealthy = Array.from(this.services.values()).every(status => status);
      
      // Check circuit breaker status
      const circuitBreakerHealthy = zScoreCalculationCircuitBreaker.getStatus().isHealthy;
      
      const overall = dbHealthy && servicesHealthy && circuitBreakerHealthy;
      
      logger.info('🏥 Enhanced Z-Score Service health check:', {
        database: dbHealthy,
        services: servicesHealthy,
        circuitBreaker: circuitBreakerHealthy,
        overall
      });
      
      return overall;

    } catch (error) {
      logger.error('💥 Health check failed:', error);
      return false;
    }
  }

  /**
   * Graceful shutdown of all components
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('🛑 Shutting down Enhanced Z-Score Service...');

      // Stop performance monitoring
      zScorePerformanceMonitor.stopMonitoring();
      
      // Shutdown parallel processor
      await parallelZScoreProcessor.shutdown();
      
      // Close database connections
      await optimizedDbPool.close();
      
      // Clear cache
      this.cache.clear();
      
      // Reset service status
      this.services.clear();
      this.isInitialized = false;
      
      logger.info('✅ Enhanced Z-Score Service shutdown complete');

    } catch (error) {
      logger.error('💥 Error during Enhanced Z-Score Service shutdown:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const enhancedZScoreService = new EnhancedZScoreService();