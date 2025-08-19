import { etf5MinCache } from './etf-5min-cache-service';
import logger from '../utils/logger';

export class ETFCacheCronService {
  private refreshInterval: NodeJS.Timeout | null = null;
  private warmupInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  /**
   * Initialize ETF cache interval jobs
   */
  initialize(): void {
    if (this.isInitialized) {
      logger.warn('⚠️ ETF cache cron service already initialized');
      return;
    }

    try {
      this.isInitialized = true;
      logger.info('✅ ETF cache cron service initialized');
      
    } catch (error) {
      logger.error('❌ Failed to initialize ETF cache cron service:', error);
      throw error;
    }
  }

  /**
   * Start interval jobs
   */
  start(): void {
    if (!this.isInitialized) {
      this.initialize();
    }

    try {
      // Job 1: Refresh materialized view every 5 minutes (300,000ms)
      this.refreshInterval = setInterval(async () => {
        await this.refreshMaterializedView();
      }, 5 * 60 * 1000);

      // Job 2: Warm up memory cache every 4 minutes (240,000ms)
      this.warmupInterval = setInterval(async () => {
        await this.warmupMemoryCache();
      }, 4 * 60 * 1000);
      
      logger.info('🚀 ETF cache interval jobs started');
      logger.info('📅 Materialized view refresh: every 5 minutes');
      logger.info('🔥 Memory cache warmup: every 4 minutes (offset)');
      
    } catch (error) {
      logger.error('❌ Failed to start ETF cache interval jobs:', error);
      throw error;
    }
  }

  /**
   * Stop interval jobs
   */
  stop(): void {
    try {
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
        this.refreshInterval = null;
      }
      
      if (this.warmupInterval) {
        clearInterval(this.warmupInterval);
        this.warmupInterval = null;
      }
      
      logger.info('⏹️ ETF cache interval jobs stopped');
      
    } catch (error) {
      logger.error('❌ Failed to stop ETF cache interval jobs:', error);
    }
  }

  /**
   * Get interval job status
   */
  getStatus(): {
    initialized: boolean;
    refresh_job_running: boolean;
    warmup_job_running: boolean;
    refresh_interval_ms: number;
    warmup_interval_ms: number;
  } {
    return {
      initialized: this.isInitialized,
      refresh_job_running: this.refreshInterval !== null,
      warmup_job_running: this.warmupInterval !== null,
      refresh_interval_ms: 5 * 60 * 1000, // 5 minutes
      warmup_interval_ms: 4 * 60 * 1000   // 4 minutes
    };
  }

  /**
   * Refresh materialized view job
   */
  private async refreshMaterializedView(): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info('🔄 [CRON] Starting materialized view refresh...');
      
      const refreshResult = await etf5MinCache.refreshMaterializedView();
      const duration = Date.now() - startTime;
      
      logger.info(`✅ [CRON] Materialized view refreshed in ${duration}ms`, {
        refresh_stats: refreshResult,
        duration_ms: duration
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`❌ [CRON] Materialized view refresh failed after ${duration}ms:`, error);
    }
  }

  /**
   * Warm up memory cache job
   */
  private async warmupMemoryCache(): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info('🔥 [CRON] Starting memory cache warmup...');
      
      // Clear existing cache to force fresh load
      etf5MinCache.clearMemoryCache();
      
      // Trigger cache load
      const result = await etf5MinCache.getETFMetrics();
      const duration = Date.now() - startTime;
      
      if (result.success) {
        logger.info(`✅ [CRON] Memory cache warmed up in ${duration}ms`, {
          etfs_loaded: result.data.length,
          cache_source: result.source,
          duration_ms: duration
        });
      } else {
        logger.error(`❌ [CRON] Memory cache warmup failed after ${duration}ms`);
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`❌ [CRON] Memory cache warmup error after ${duration}ms:`, error);
    }
  }

  /**
   * Manual trigger for testing
   */
  async triggerRefresh(): Promise<void> {
    await this.refreshMaterializedView();
  }

  async triggerWarmup(): Promise<void> {
    await this.warmupMemoryCache();
  }
}

// Export singleton instance
export const etfCacheCron = new ETFCacheCronService();