import { etfCacheCron } from './etf-cache-cron-service';
import { etf5MinCache } from './etf-5min-cache-service';
import logger from '../utils/logger';

export class ETFCacheStartupService {
  private static isInitialized = false;

  /**
   * Initialize ETF caching system on server startup
   */
  static async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('⚠️ ETF cache system already initialized');
      return;
    }

    try {
      logger.info('🚀 Initializing ETF 5-minute caching system...');

      // Step 1: Test materialized view connectivity
      await this.testMaterializedView();

      // Step 2: Initialize cache service
      logger.info('📊 Initializing ETF cache service...');
      const testResult = await etf5MinCache.getETFMetrics();
      if (testResult.success) {
        logger.info(`✅ ETF cache service initialized with ${testResult.data.length} ETFs`);
      } else {
        logger.warn('⚠️ ETF cache service test failed, will use fallbacks');
      }

      // Step 3: Initialize cron jobs
      logger.info('⏰ Starting ETF cache background jobs...');
      etfCacheCron.initialize();
      etfCacheCron.start();

      // Step 4: Initial cache warmup
      logger.info('🔥 Performing initial cache warmup...');
      await this.performInitialWarmup();

      this.isInitialized = true;
      logger.info('✅ ETF 5-minute caching system fully initialized');

    } catch (error) {
      logger.error('❌ Failed to initialize ETF caching system:', error);
      // Don't throw - allow server to start without caching
    }
  }

  /**
   * Test materialized view connectivity
   */
  private static async testMaterializedView(): Promise<void> {
    try {
      logger.info('🔍 Testing materialized view connectivity...');
      const refreshResult = await etf5MinCache.refreshMaterializedView();
      logger.info('✅ Materialized view test successful', refreshResult);
    } catch (error) {
      logger.warn('⚠️ Materialized view test failed - will use database fallbacks:', error);
    }
  }

  /**
   * Perform initial cache warmup
   */
  private static async performInitialWarmup(): Promise<void> {
    try {
      // Clear any existing cache
      etf5MinCache.clearMemoryCache();

      // Load fresh data into cache
      const result = await etf5MinCache.getETFMetrics();
      
      if (result.success) {
        logger.info(`🔥 Initial warmup completed: ${result.data.length} ETFs cached`);
      } else {
        logger.warn('⚠️ Initial warmup failed - cache will populate on first request');
      }
    } catch (error) {
      logger.warn('⚠️ Initial cache warmup failed:', error);
    }
  }

  /**
   * Get system status
   */
  static getStatus(): {
    initialized: boolean;
    cache_service_status: any;
    cron_status: any;
  } {
    return {
      initialized: this.isInitialized,
      cache_service_status: etf5MinCache.getCacheStats(),
      cron_status: etfCacheCron.getStatus()
    };
  }

  /**
   * Shutdown caching system
   */
  static shutdown(): void {
    try {
      logger.info('⏹️ Shutting down ETF caching system...');
      etfCacheCron.stop();
      etf5MinCache.clearMemoryCache();
      this.isInitialized = false;
      logger.info('✅ ETF caching system shutdown complete');
    } catch (error) {
      logger.error('❌ Error during ETF cache shutdown:', error);
    }
  }
}

// Export for use in server startup
export const etfCacheStartup = ETFCacheStartupService;