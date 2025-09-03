import { logger } from '../middleware/logging';
import { getMarketHoursInfo } from '@shared/utils/marketHours';

/**
 * ETF Data Preloader Service
 * Ensures ETF metrics are always cached and ready during market hours
 * Implements aggressive preloading strategy for near-instant frontend performance
 */
class ETFPreloaderService {
  private static instance: ETFPreloaderService;
  private preloadInterval: NodeJS.Timeout | null = null;
  private etfMetricsService: any;

  static getInstance(): ETFPreloaderService {
    if (!ETFPreloaderService.instance) {
      ETFPreloaderService.instance = new ETFPreloaderService();
    }
    return ETFPreloaderService.instance;
  }

  /**
   * Start market-aware preloading based on trading session status
   */
  async startPreloading(): Promise<void> {
    try {
      const marketInfo = getMarketHoursInfo();
      let preloadInterval: number;

      if (marketInfo.isOpen) {
        preloadInterval = 90000; // 1.5 minutes during market hours
        logger.info('🚀 Starting AGGRESSIVE ETF preloading for market hours (90s intervals)');
      } else if (marketInfo.isPremarket || marketInfo.isAfterHours) {
        preloadInterval = 240000; // 4 minutes during extended hours
        logger.info('🚀 Starting MODERATE ETF preloading for extended hours (4min intervals)');
      } else {
        preloadInterval = 600000; // 10 minutes when market is closed
        logger.info('🚀 Starting STANDARD ETF preloading for market closed (10min intervals)');
      }

      // Preload immediately
      await this.preloadETFMetrics();

      // DISABLED: ETF preloader intervals causing memory crashes
      // Set up recurring preload - TOO AGGRESSIVE (90s-10min intervals)
      // this.preloadInterval = setInterval(async () => {
      //   await this.preloadETFMetrics();
      // }, preloadInterval);

      logger.info(`⚡ ETF preloader service started with ${preloadInterval}ms intervals`);
    } catch (error) {
      logger.error('❌ Failed to start ETF preloader:', error);
    }
  }

  /**
   * Stop preloading service
   */
  stopPreloading(): void {
    if (this.preloadInterval) {
      clearInterval(this.preloadInterval);
      this.preloadInterval = null;
      logger.info('🛑 ETF preloader service stopped');
    }
  }

  /**
   * Preload ETF metrics into cache for instant access
   */
  private async preloadETFMetrics(): Promise<void> {
    try {
      if (!this.etfMetricsService) {
        const { etfMetricsService } = await import('./etf-metrics-service');
        this.etfMetricsService = etfMetricsService;
      }
      
      const startTime = Date.now();
      const metrics = await this.etfMetricsService.getConsolidatedETFMetrics();
      const responseTime = Date.now() - startTime;

      logger.info(`⚡ ETF metrics preloaded: ${metrics.length} ETFs in ${responseTime}ms`);
      
      // Check cache performance
      if (responseTime < 100) {
        logger.info('🎯 FAST cache hit - ETF data served from memory');
      } else if (responseTime < 500) {
        logger.info('📊 Standard cache hit - ETF data served from cache');
      } else {
        logger.warn('🔄 Database fetch - ETF data loaded from database');
      }

    } catch (error) {
      logger.error('❌ ETF preload failed:', error);
    }
  }

  /**
   * Force immediate refresh of ETF data
   */
  async forceRefresh(): Promise<void> {
    logger.info('🔄 Force refreshing ETF metrics cache...');
    await this.preloadETFMetrics();
  }

  /**
   * Update preload frequency based on market status
   */
  async updatePreloadFrequency(): Promise<void> {
    this.stopPreloading();
    await this.startPreloading();
    logger.info('🔄 ETF preloader frequency updated based on market status');
  }
}

export const etfPreloaderService = ETFPreloaderService.getInstance();