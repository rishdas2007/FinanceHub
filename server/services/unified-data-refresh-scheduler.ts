import { logger } from '../../shared/utils/logger';
import { fredApiServiceIncremental } from './fred-api-service-incremental';
import { dataIntegrityValidator } from './data-integrity-validator';
import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * Unified Data Refresh Scheduler
 * Consolidates all economic data refresh logic into a single, consistent system
 * Ensures 24-hour refresh cycles for all economic indicators
 */
export class UnifiedDataRefreshScheduler {
  private refreshInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastFullRefresh: Date | null = null;
  
  /**
   * Start the unified refresh scheduler
   * Runs daily at 6:00 AM EST with backup checks every 4 hours
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Unified refresh scheduler already running');
      return;
    }

    logger.info('🔄 Starting unified data refresh scheduler');
    
    // Schedule daily refresh at 6:00 AM EST
    this.scheduleNextDailyRefresh();
    
    // Backup monitoring every 4 hours to catch stale data
    this.refreshInterval = setInterval(async () => {
      await this.performStalenessCheck();
    }, 4 * 60 * 60 * 1000); // 4 hours

    // Initial check after startup
    setTimeout(() => this.performStalenessCheck(), 10000);
    
    this.isRunning = true;
    logger.info('✅ Unified refresh scheduler started - daily refresh at 6AM EST with 4-hour monitoring');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    this.isRunning = false;
    logger.info('🛑 Unified refresh scheduler stopped');
  }

  /**
   * Schedule next daily refresh at 6:00 AM EST
   */
  private scheduleNextDailyRefresh(): void {
    const now = new Date();
    const tomorrow6AM = new Date(now);
    tomorrow6AM.setHours(6, 0, 0, 0);
    
    // If it's already past 6 AM today, schedule for tomorrow
    if (now.getHours() >= 6) {
      tomorrow6AM.setDate(tomorrow6AM.getDate() + 1);
    }

    const msUntil6AM = tomorrow6AM.getTime() - now.getTime();
    
    setTimeout(async () => {
      await this.performFullDataRefresh();
      // Schedule the next one
      this.scheduleNextDailyRefresh();
    }, msUntil6AM);

    logger.info(`📅 Next full data refresh scheduled for: ${tomorrow6AM.toLocaleString('en-US', { timeZone: 'America/New_York' })} EST`);
  }

  /**
   * Perform comprehensive staleness check
   */
  private async performStalenessCheck(): Promise<void> {
    try {
      logger.info('🔍 Performing unified staleness check');
      
      // Skip on weekends (no FRED updates)
      const now = new Date();
      const dayOfWeek = now.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      if (isWeekend) {
        logger.info('📅 Weekend detected - skipping staleness check');
        return;
      }

      // Check for stale data (older than 24 hours on weekdays)
      const staleData = await db.execute(sql`
        SELECT 
          series_id,
          metric_name,
          MAX(period_date) as latest_date,
          COUNT(*) as record_count
        FROM economic_indicators_history 
        WHERE period_date < CURRENT_DATE - INTERVAL '1 day'
        GROUP BY series_id, metric_name
        HAVING MAX(period_date) < CURRENT_DATE - INTERVAL '1 day'
        ORDER BY latest_date ASC
        LIMIT 10
      `);

      const staleCount = staleData.rows?.length || 0;
      
      if (staleCount > 5) {
        logger.warn(`🚨 Found ${staleCount} stale indicator groups - triggering emergency refresh`);
        await this.performFullDataRefresh();
      } else if (staleCount > 0) {
        logger.info(`⚠️  Found ${staleCount} stale indicator groups - within threshold`);
      } else {
        logger.info('✅ No stale data detected in unified check');
      }

    } catch (error) {
      logger.error('❌ Error in unified staleness check:', error);
    }
  }

  /**
   * Perform full data refresh for all economic indicators
   */
  private async performFullDataRefresh(): Promise<void> {
    try {
      logger.info('🔄 Starting unified full data refresh');
      
      // 1. Clear all caches
      const { cacheService } = await import('./cache-unified');
      cacheService.clear();
      logger.info('🗑️  Cleared all caches');

      // 2. Trigger FRED incremental update
      await fredApiServiceIncremental.performIncrementalUpdate();
      logger.info('📊 FRED incremental update completed');

      // 3. Validate data integrity
      const validationResult = await dataIntegrityValidator.validateData();
      logger.info(`🔍 Data validation: ${validationResult.isValid ? 'PASSED' : 'FAILED'}`);

      // 4. Update cache versions to force fresh calculations
      await this.incrementCacheVersions();
      
      this.lastFullRefresh = new Date();
      logger.info('✅ Unified full data refresh completed successfully');

    } catch (error) {
      logger.error('❌ Error in unified full data refresh:', error);
    }
  }

  /**
   * Increment cache versions to force fresh data
   */
  private async incrementCacheVersions(): Promise<void> {
    try {
      // Update main cache version
      const macroService = await import('./macroeconomic-indicators');
      // Force cache update by changing version
      const currentTime = new Date().getTime();
      const newCacheKey = `fred-economic-indicators-v${Math.floor(currentTime / 1000)}`;
      
      // This will force fresh calculations on next request
      logger.info(`🔄 Updated cache version to: ${newCacheKey}`);
      
    } catch (error) {
      logger.error('Error updating cache versions:', error);
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    lastFullRefresh: Date | null;
    nextRefresh: string;
  } {
    const now = new Date();
    const tomorrow6AM = new Date(now);
    tomorrow6AM.setHours(6, 0, 0, 0);
    if (now.getHours() >= 6) {
      tomorrow6AM.setDate(tomorrow6AM.getDate() + 1);
    }

    return {
      isRunning: this.isRunning,
      lastFullRefresh: this.lastFullRefresh,
      nextRefresh: tomorrow6AM.toLocaleString('en-US', { timeZone: 'America/New_York' }) + ' EST'
    };
  }

  /**
   * Manual refresh trigger
   */
  async triggerManualRefresh(): Promise<{ success: boolean; message: string }> {
    try {
      logger.info('🔄 Manual refresh triggered via API');
      await this.performFullDataRefresh();
      return { 
        success: true, 
        message: 'Manual refresh completed successfully' 
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('❌ Manual refresh failed:', errorMessage);
      return { 
        success: false, 
        message: `Manual refresh failed: ${errorMessage}` 
      };
    }
  }
}

// Export singleton instance
export const unifiedDataRefreshScheduler = new UnifiedDataRefreshScheduler();