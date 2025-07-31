import { fredCacheStrategy } from './fred-cache-strategy';
import { fredDatabaseCache } from './fred-database-cache';
import { logger } from '../../shared/utils/logger';
import * as cron from 'node-cron';

export class FREDCacheScheduler {
  private static instance: FREDCacheScheduler;
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  
  static getInstance(): FREDCacheScheduler {
    if (!FREDCacheScheduler.instance) {
      FREDCacheScheduler.instance = new FREDCacheScheduler();
    }
    return FREDCacheScheduler.instance;
  }

  /**
   * Initialize all FRED cache scheduled jobs
   */
  async initializeScheduler(): Promise<void> {
    try {
      logger.info('🔄 Initializing FRED cache scheduler...');
      
      // Daily refresh at 6 AM EST (before market open)
      this.scheduleJob('daily-fred-refresh', '0 6 * * 1-5', async () => {
        logger.info('🔄 Starting daily FRED cache refresh...');
        const result = await fredCacheStrategy.batchRefreshAllIndicators();
        logger.info(`✅ Daily FRED refresh completed: ${result.refreshed.length} success, ${result.failed.length} failed`);
      });
      
      // Cleanup expired entries every 4 hours
      this.scheduleJob('cache-cleanup', '0 */4 * * *', async () => {
        logger.info('🧹 Starting cache cleanup...');
        const result = await fredDatabaseCache.cleanupExpiredEntries();
        const total = result.current + result.historical + result.yoy;
        if (total > 0) {
          logger.info(`✅ Cache cleanup completed: ${total} expired entries removed`);
        }
      });
      
      // Cache statistics logging every hour
      this.scheduleJob('cache-stats', '0 * * * *', async () => {
        const stats = await fredCacheStrategy.getCacheStatistics();
        logger.info(`📊 FRED Cache Stats: ${stats.cache_hit_rate.toFixed(1)}% hit rate, ${stats.api_calls_saved} API calls saved`);
      });
      
      // Trigger initial refresh after 30 seconds
      setTimeout(async () => {
        logger.info('🚀 Triggering initial FRED cache population...');
        try {
          const result = await fredCacheStrategy.batchRefreshAllIndicators();
          logger.info(`✅ Initial FRED cache population: ${result.refreshed.length} indicators cached`);
        } catch (error) {
          logger.error('❌ Initial FRED cache population failed:', error);
        }
      }, 30000);
      
      logger.info(`✅ FRED cache scheduler initialized with ${this.jobs.size} jobs`);
      
    } catch (error) {
      logger.error('❌ Failed to initialize FRED cache scheduler:', error);
    }
  }

  /**
   * Schedule a new cron job
   */
  private scheduleJob(name: string, schedule: string, task: () => Promise<void>): void {
    try {
      const job = cron.schedule(schedule, async () => {
        try {
          logger.debug(`⏰ Executing scheduled job: ${name}`);
          await task();
        } catch (error) {
          logger.error(`❌ Scheduled job ${name} failed:`, error);
        }
      }, {
        scheduled: true,
        timezone: 'America/New_York'
      });
      
      this.jobs.set(name, job);
      logger.info(`📅 Scheduled job "${name}" with pattern: ${schedule}`);
      
    } catch (error) {
      logger.error(`❌ Failed to schedule job ${name}:`, error);
    }
  }

  /**
   * Get scheduler status
   */
  getSchedulerStatus(): {
    total_jobs: number;
    active_jobs: number;
    job_details: Array<{
      name: string;
      running: boolean;
      next_execution?: Date;
    }>;
  } {
    const jobDetails = Array.from(this.jobs.entries()).map(([name, job]) => ({
      name,
      running: job.running || false,
      next_execution: job.nextDates ? job.nextDates() : undefined
    }));
    
    return {
      total_jobs: this.jobs.size,
      active_jobs: jobDetails.filter(job => job.running).length,
      job_details: jobDetails
    };
  }

  /**
   * Stop all scheduled jobs
   */
  stopAllJobs(): void {
    this.jobs.forEach((job, name) => {
      job.stop();
      logger.info(`⏹️ Stopped scheduled job: ${name}`);
    });
    this.jobs.clear();
    logger.info('✅ All FRED cache scheduler jobs stopped');
  }

  /**
   * Manually trigger a specific job
   */
  async triggerJob(jobName: string): Promise<boolean> {
    try {
      switch (jobName) {
        case 'daily-fred-refresh':
          logger.info('🔄 Manually triggering FRED refresh...');
          const result = await fredCacheStrategy.batchRefreshAllIndicators();
          logger.info(`✅ Manual FRED refresh: ${result.refreshed.length} success, ${result.failed.length} failed`);
          return result.success;
          
        case 'cache-cleanup':
          logger.info('🧹 Manually triggering cache cleanup...');
          const cleanupResult = await fredDatabaseCache.cleanupExpiredEntries();
          const total = cleanupResult.current + cleanupResult.historical + cleanupResult.yoy;
          logger.info(`✅ Manual cache cleanup: ${total} expired entries removed`);
          return true;
          
        case 'cache-stats':
          const stats = await fredCacheStrategy.getCacheStatistics();
          logger.info(`📊 FRED Cache Manual Stats: ${JSON.stringify(stats, null, 2)}`);
          return true;
          
        default:
          logger.warn(`❌ Unknown job name: ${jobName}`);
          return false;
      }
    } catch (error) {
      logger.error(`❌ Failed to trigger job ${jobName}:`, error);
      return false;
    }
  }
}

export const fredCacheScheduler = FREDCacheScheduler.getInstance();